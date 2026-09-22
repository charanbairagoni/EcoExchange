(function () {
  var KEY = 'ecoexchange_conversations';
  var MESSAGE_KEY = 'ecoexchange_messages';
  var ADMIN_ID = 'ADMIN-DEMO';
  function conversations() { return EcoAuth.read(KEY, []); }
  function messages() { return EcoAuth.read(MESSAGE_KEY, []); }
  function saveConversations(value) { EcoAuth.write(KEY, value); }
  function saveMessages(value) { EcoAuth.write(MESSAGE_KEY, value); }
  function userName(user) { return user && (user.industryName || user.ownerName || user.email) || 'Unknown user'; }
  function orderLabel(order) { return order && (order.orderCode || order.id) || 'Order'; }
  function find(id) { return conversations().find(function (conversation) { return String(conversation.id) === String(id); }); }
  function ensure(order) {
    if (!order || !order.sellerId || !order.buyerId) throw new Error('This order does not have both participants.');
    var existing = conversations().find(function (conversation) { return String(conversation.orderId) === String(order.id); });
    if (existing) return existing;
    var conversation = { id: 'CONV-' + Date.now(), orderId: order.id, sellerId: order.sellerId, buyerId: order.buyerId, adminId: ADMIN_ID, status: 'OPEN', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    var all = conversations(); all.unshift(conversation); saveConversations(all); return conversation;
  }
  function visibleFor(user) {
    if (!user) return [];
    var all = conversations();
    if (user.role === 'ADMIN') return all;
    return all.filter(function (conversation) { return String(conversation.sellerId) === String(user.id) || String(conversation.buyerId) === String(user.id); });
  }
  function unreadFor(conversation, user) {
    return messages().filter(function (message) { return message.conversationId === conversation.id && message.receiverId === user.id && !message.isRead; }).length;
  }
  function totalUnread(user) { return visibleFor(user).reduce(function (sum, conversation) { return sum + unreadFor(conversation, user); }, 0); }
  function send(conversationId, user, content, receiverRole) {
    var conversation = find(conversationId), text = String(content || '').trim();
    if (!conversation) throw new Error('Conversation not found.');
    if (!text) throw new Error('Message cannot be empty.');
    if (conversation.status === 'CLOSED') throw new Error('This conversation is closed.');
    var senderRole = user.role === 'ADMIN' ? 'ADMIN' : String(conversation.sellerId) === String(user.id) ? 'SELLER' : String(conversation.buyerId) === String(user.id) ? 'BUYER' : null;
    if (!senderRole) throw new Error('You do not have access to this conversation.');
    var targetRole = senderRole === 'ADMIN' ? receiverRole : 'ADMIN';
    if (senderRole === 'ADMIN' && targetRole !== 'SELLER' && targetRole !== 'BUYER') throw new Error('Choose a seller or buyer recipient.');
    var targetId = targetRole === 'SELLER' ? conversation.sellerId : targetRole === 'BUYER' ? conversation.buyerId : ADMIN_ID;
    var message = { id: 'MSG-' + Date.now(), conversationId: conversation.id, senderId: user.id, senderRole: senderRole, receiverId: targetId, receiverRole: targetRole, content: text, isRead: false, createdAt: new Date().toISOString() };
    var all = messages(); all.push(message); saveMessages(all);
    conversation.updatedAt = message.createdAt;
    saveConversations(conversations().map(function (item) { return item.id === conversation.id ? conversation : item; }));
    return message;
  }
  function markRead(conversationId, user) {
    var changed = messages().map(function (message) { return message.conversationId === conversationId && message.receiverId === user.id ? Object.assign({}, message, { isRead: true }) : message; });
    saveMessages(changed);
  }
  function setStatus(conversationId, status) {
    saveConversations(conversations().map(function (conversation) { return conversation.id === conversationId ? Object.assign({}, conversation, { status: status, updatedAt: new Date().toISOString() }) : conversation; }));
  }
  function render(user, activeId) {
    var allOrders = EcoOrders.all(), visible = visibleFor(user).map(function (conversation) {
      var order = allOrders.find(function (item) { return String(item.id) === String(conversation.orderId); });
      var history = messages().filter(function (message) { return message.conversationId === conversation.id; });
      return { conversation: conversation, order: order, last: history[history.length - 1], unread: unreadFor(conversation, user) };
    }).sort(function (a, b) { return new Date(b.conversation.updatedAt) - new Date(a.conversation.updatedAt); });
    var active = visible.find(function (item) { return item.conversation.id === activeId; }) || visible[0];
    var list = visible.length ? visible.map(function (item) { return '<button class="chat-list-item ' + (active && item.conversation.id === active.conversation.id ? 'active' : '') + '" data-action="open-chat" data-id="' + item.conversation.id + '" data-search="' + esc((item.order ? orderLabel(item.order) + ' ' + (item.order.sellerIndustry || '') + ' ' + (item.order.buyerIndustry || '') : item.conversation.orderId)) + '"><strong>' + esc(item.order ? orderLabel(item.order) : item.conversation.orderId) + '</strong><span>' + esc(item.order ? item.order.sellerIndustry || 'Seller' : 'Seller') + ' → ' + esc(item.order ? item.order.buyerIndustry || 'Buyer' : 'Buyer') + '</span><small>' + (item.last ? esc(item.last.content) : 'No messages yet.') + '</small>' + (item.unread ? '<b class="chat-unread">' + item.unread + '</b>' : '') + '</button>'; }).join('') : '<div class="empty"><h3>No messages yet.</h3><p>Open an order and message the EcoExchange Admin.</p></div>';
    var detail = active ? chatDetail(active, user) : '<div class="chat-empty"><h3>Choose a conversation</h3><p>Messages between industries are mediated by the EcoExchange Admin.</p></div>';
    return '<div class="chat-shell"><aside class="chat-sidebar"><div class="chat-sidebar-head"><div><p class="eyebrow">Workspace</p><h3>Conversations</h3></div><span class="badge">' + totalUnread(user) + ' unread</span></div><input id="chat-search" placeholder="Search order or industry"><div id="chat-list" class="chat-list">' + list + '</div></aside><section class="chat-window">' + detail + '</section></div>';
  }
  function chatDetail(item, user) {
    var conversation = item.conversation, order = item.order, history = messages().filter(function (message) { return message.conversationId === conversation.id; });
    markRead(conversation.id, user);
    var seller = order && (order.sellerIndustry || 'Seller'), buyer = order && (order.buyerIndustry || 'Buyer');
    var historyHtml = history.length ? history.map(function (message) { var own = message.senderId === user.id; return '<div class="chat-message ' + (own ? 'own' : '') + '"><div class="chat-message-meta"><strong>' + (message.senderRole === 'ADMIN' ? 'EcoExchange Admin' : message.senderRole === 'SELLER' ? esc(seller) : esc(buyer)) + '</strong><time>' + new Date(message.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) + '</time></div><p>' + esc(message.content) + '</p><small>To ' + (message.receiverRole === 'ADMIN' ? 'Admin' : message.receiverRole === 'SELLER' ? esc(seller) : esc(buyer)) + '</small></div>'; }).join('') : '<div class="chat-empty"><h3>Start a conversation with the EcoExchange Admin.</h3><p>Your message will only be delivered to the platform administrator.</p></div>';
    var recipient = user.role === 'ADMIN' ? '<label>Reply to<select id="chat-recipient" name="recipient"><option value="SELLER">Seller · ' + esc(seller) + '</option><option value="BUYER">Buyer · ' + esc(buyer) + '</option></select></label>' : '<span class="chat-recipient">To EcoExchange Admin</span>';
    return '<div class="chat-header"><div><p class="eyebrow">Order conversation</p><h2>' + esc(order ? orderLabel(order) : conversation.orderId) + '</h2><p>' + esc(seller) + ' · ' + esc(buyer) + '</p></div><div class="button-row"><span class="badge ' + (conversation.status === 'CLOSED' ? 'red' : '') + '">' + conversation.status + '</span>' + (user.role === 'ADMIN' ? '<button class="button ghost small" data-action="toggle-chat-status" data-id="' + conversation.id + '">' + (conversation.status === 'CLOSED' ? 'Reopen' : 'Close') + '</button>' : '') + '</div></div><div class="chat-order-meta"><span>Seller: <strong>' + esc(seller) + '</strong></span><span>Buyer: <strong>' + esc(buyer) + '</strong></span><span>Status: <strong>' + esc(order ? order.status : '—') + '</strong></span></div><div class="chat-history">' + historyHtml + '</div>' + (conversation.status === 'OPEN' ? '<form id="chat-form" class="chat-composer"><textarea name="content" rows="2" maxlength="4000" placeholder="Type a message..."></textarea><div class="chat-composer-actions">' + recipient + '<button class="button primary" type="submit">Send message</button></div></form>' : '<div class="empty">This conversation is closed. An admin can reopen it when follow-up is needed.</div>');
  }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>'"]/g, function (char) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]; }); }
  window.EcoChat = { ADMIN_ID: ADMIN_ID, ensure: ensure, find: find, visibleFor: visibleFor, totalUnread: totalUnread, send: send, markRead: markRead, setStatus: setStatus, render: render, orderLabel: orderLabel };
}());

if (typeof module !== 'undefined') module.exports = {};
