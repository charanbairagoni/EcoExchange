(function () {
  var app = document.getElementById('app');
  var toastRegion = document.getElementById('toast-region');
  var currentSell = EcoSell.blank();
  var pending = null;
  var demoListings = [
    { id: 'LIST-DEMO-1', sellerId: 'DEMO-SELLER', sellerIndustry: 'ABC Manufacturing', wasteType: 'Metal Scrap', quantity: 1200, unit: 'kg', price: 95000, location: 'Pune', description: 'High-grade steel scrap suitable for re-melting and industrial reuse.', imageUrl: 'https://images.unsplash.com/photo-1581092160607-ee2279d0d3a8?auto=format&fit=crop&w=900&q=80', availability: 'Available', status: 'LISTED', createdAt: '2026-09-21T00:00:00.000Z' },
    { id: 'LIST-DEMO-2', sellerId: 'DEMO-SELLER-2', sellerIndustry: 'EcoPlast Solutions', wasteType: 'Plastic Waste', quantity: 900, unit: 'kg', price: 62000, location: 'Bengaluru', description: 'Clean HDPE and LDPE polymer waste sorted by grade.', imageUrl: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=900&q=80', availability: 'Available', status: 'LISTED', createdAt: '2026-09-20T00:00:00.000Z' },
    { id: 'LIST-DEMO-3', sellerId: 'DEMO-SELLER', sellerIndustry: 'ABC Manufacturing', wasteType: 'Fly Ash', quantity: 5, unit: 'tonnes', price: 150000, location: 'Nagpur', description: 'Ash by-product with consistent density for construction and filler use.', imageUrl: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=80', availability: 'Available', status: 'LISTED', createdAt: '2026-09-18T00:00:00.000Z' }
  ];
  var money = function (value) { return '₹' + Number(value || 0).toLocaleString('en-IN'); };
  var esc = function (value) { return String(value == null ? '' : value).replace(/[&<>'"]/g, function (char) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]; }); };
  var date = function (value) { return value ? new Date(value).toLocaleDateString('en-IN') : '—'; };
  var readForm = function (form) { return Object.fromEntries(new FormData(form).entries()); };

  function seed() {
    if (!localStorage.getItem('ecoexchange_listings')) EcoAuth.write('ecoexchange_listings', demoListings);
    if (!localStorage.getItem('ecoexchange_orders')) EcoAuth.write('ecoexchange_orders', []);
    if (!localStorage.getItem('ecoexchange_logistics')) EcoAuth.write('ecoexchange_logistics', []);
    if (window.EcoSellerModeration) window.EcoSellerModeration.seedInitialData();
  }
  function route() { return (location.hash || '#home').slice(1); }
  function requireAdmin() { var current = getCurrentUser(); if (!current || current.role !== 'ADMIN') { notify('You do not have permission to view this page.', 'error'); go('login'); return false; } return true; }
  function sellerSummary(sellerId) { return window.EcoSellerModeration ? window.EcoSellerModeration.calculateSellerSummary(sellerId) : { averageRating: 0, reviewCount: 0, completedOrders: 0, totalOrders: 0, successfulTransactions: 0 }; }
  function listingSummary(listingId) { if (!window.EcoSellerModeration) return { averageRating: 0, reviewCount: 0, reviews: [], recentReviews: [], averageText: 'No ratings yet', reviewLabel: 'No ratings yet' }; var summary = window.EcoSellerModeration.calculateListingRating(listingId); summary.recentReviews = window.EcoSellerModeration.getRecentReviewsForListing(listingId, 4); return summary; }
  function stars(value) { return window.EcoSellerModeration ? window.EcoSellerModeration.makeStars(value) : '☆☆☆☆☆'; }
  function ratingHtmlForOrder(order, currentUser) {
    var existing = window.EcoSellerModeration ? window.EcoSellerModeration.getRatings().find(function (item) { return item.orderId === order.id && item.buyerId === currentUser.id; }) : null;
    if (existing) return '<div class="review-summary"><strong>' + stars(existing.rating) + ' ' + existing.rating + '/5</strong><span>Rated ✓</span></div>';
    if (order.status === 'COMPLETED') return '<button class="button primary small" data-action="rate-order" data-id="' + order.id + '">Rate Material</button>';
    return '<span class="muted">Not available</span>';
  }
  function sellerById(id) { var list = EcoAuth.users(); return list.find(function (item) { return item.id === id; }) || { id: id, industryName: 'Seller', ownerName: 'Unknown', email: '—', location: '—', status: 'ACTIVE' }; }
  function go(target) { location.hash = target; }
  function notify(message, type) { var node = document.createElement('div'); node.className = 'toast ' + (type || ''); node.textContent = message; toastRegion.appendChild(node); setTimeout(function () { node.remove(); }, 3300); }
  function getCurrentUser() { return EcoAuth.session(); }
  function requireUser() { if (!getCurrentUser()) { notify('Please log in to continue.', 'error'); go('login'); return false; } return true; }
  function logout() {
    EcoAuth.clearSession();
    updateNavigation();
    notify('You have been logged out.');
    go('login');
    render();
  }
  function updateNavigation() {
    var current = getCurrentUser();
    var validRole = current && (current.role === 'USER' || current.role === 'ADMIN');
    var normalUser = validRole && current.role === 'USER';
    var adminUser = validRole && current.role === 'ADMIN';
    var profileLink = document.getElementById('profile-nav');
    var adminLink = document.getElementById('admin-nav');
    var logoutButton = document.getElementById('logout-nav');
    var loginLink = document.getElementById('login-nav');
    var messagesLink = document.getElementById('messages-nav');
    if (profileLink) profileLink.hidden = !normalUser;
    if (adminLink) adminLink.hidden = !adminUser;
    if (logoutButton) logoutButton.hidden = !validRole;
    if (loginLink) loginLink.hidden = validRole;
    if (messagesLink) { messagesLink.hidden = !validRole; messagesLink.textContent = 'Messages' + (window.EcoChat && EcoChat.totalUnread(current) ? ' (' + EcoChat.totalUnread(current) + ')' : ''); }
  }

  function header() {
    var active = route().split('/')[0];
    return '<header class="site-header"><div class="header-inner"><a class="brand" href="#home"><span class="brand-mark">E</span><span class="brand-copy"><strong>EcoExchange</strong><small>Turning Industrial Waste Into Valuable Resources.</small></span></a><button class="mobile-toggle" data-action="menu" aria-label="Toggle navigation">☰</button><nav class="nav" id="main-nav"><a class="' + (active === 'home' ? 'active' : '') + '" href="#home">Home</a><a class="' + (active === 'sell' ? 'active' : '') + '" href="#sell">Sell</a><a class="' + (active === 'buy' ? 'active' : '') + '" href="#buy">Buy</a><a class="' + (active === 'dashboard' ? 'active' : '') + '" href="#dashboard">Dashboard</a><a id="messages-nav" class="' + (active === 'messages' ? 'active' : '') + '" href="#messages" hidden>Messages</a><a class="' + (active === 'about' ? 'active' : '') + '" href="#about">About</a><a id="profile-nav" class="' + (active === 'profile' ? 'active' : '') + '" href="#profile" hidden>Profile</a><a id="admin-nav" class="' + (active === 'admin' ? 'active' : '') + '" href="#admin" hidden>Admin</a><button id="logout-nav" data-action="logout" hidden>Logout</button><a id="login-nav" class="' + (active === 'login' ? 'active' : '') + '" href="#login">Login</a></nav></div></header>';
  }
  function layout(content) { app.innerHTML = header() + '<main>' + content + '</main><footer class="footer">EcoExchange demo platform · Local browser mode · Built for circular industry.</footer>'; updateNavigation(); }
  function home() {
    layout('<section class="hero"><div><p class="eyebrow">Industrial circularity, made practical</p><h1>Turn Industrial Waste Into Valuable Resources</h1><p class="lead">EcoExchange connects industries that generate industrial waste with businesses that can reuse, recycle, or process those materials.</p><div class="actions"><a class="button primary" href="#sell">Sell Waste</a><a class="button secondary" href="#buy">Buy Waste</a><a class="button ghost" href="#dashboard">Dashboard</a></div></div><div class="hero-panel"><span class="panel-label">Recovered materials this month</span><div class="hero-number">4,820 t</div><div class="panel-grid"><div><strong>39%</strong><span>Lower landfill volume</span></div><div><strong>12K</strong><span>Logistics miles saved</span></div></div></div></section><section class="section"><div class="section-heading"><div><p class="eyebrow">How EcoExchange Works</p><h2>Simple chain. Circular impact.</h2></div></div><div class="steps">' + ['List Waste', 'Discover Materials', 'Place Order', 'Logistics Pickup', 'Complete Exchange'].map(function (item, i) { return '<div class="step"><b>' + (i + 1) + '</b><strong>' + item + '</strong></div>'; }).join('') + '</div></section><section class="section"><div class="section-heading"><div><p class="eyebrow">Marketplace pulse</p><h2>Measurable impact for industry</h2></div></div><div class="stat-grid"><div class="stat"><small>Industries Connected</small><strong>320+</strong></div><div class="stat"><small>Waste Listed</small><strong>48.6K kg</strong></div><div class="stat"><small>Orders Completed</small><strong>1,430</strong></div><div class="stat"><small>Waste Exchanged</small><strong>92%</strong></div></div></section><section class="section"><div class="benefit-grid"><div class="benefit"><strong>Verified connections</strong><p>Find credible industry partners with clear material details and locations.</p></div><div class="benefit"><strong>Transparent pricing</strong><p>See commissions, transport charges, and the final amount before ordering.</p></div><div class="benefit"><strong>Coordinated logistics</strong><p>Keep every exchange moving from listing to pickup and delivery.</p></div></div></section>');
  }
  function about() { layout('<section class="page-head"><div><p class="eyebrow">About EcoExchange</p><h1>Industrial by-products deserve a second market.</h1><p>EcoExchange gives manufacturers, recyclers, and processors one shared place to discover materials, negotiate value, and coordinate the physical exchange.</p></div></section><section class="benefit-grid"><div class="benefit"><strong>Reuse first</strong><p>Make useful materials visible before they become disposal costs.</p></div><div class="benefit"><strong>Evidence over guesswork</strong><p>Every listing carries quantity, unit, price, location, and description.</p></div><div class="benefit"><strong>One connected workflow</strong><p>Seller, buyer, administrator, and logistics partner can follow the same order.</p></div></section>'); }

  function authPage(mode) {
    var register = mode === 'register';
    layout('<div class="auth-wrap"><section class="auth-card"><p class="eyebrow">' + (register ? 'Join EcoExchange' : 'Welcome back') + '</p><h2>' + (register ? 'Create your industry account' : 'Login to EcoExchange') + '</h2>' + (register ? '<form id="register-form" class="form-grid"><label>Industry Name<input name="industryName" required></label><label>Owner Name<input name="ownerName" required></label><label>Email<input name="email" type="email" required></label><label>Location<input name="location" required></label><label>Contact Number<input name="contactNumber" required></label><label>Create Password<input name="password" type="password" minlength="8" required></label><label>Confirm Password<input name="confirmPassword" type="password" minlength="8" required></label><div class="full button-row"><button class="button primary">Register</button><a class="button ghost" href="#login">Already have an account?</a></div></form>' : '<form id="login-form" novalidate><div class="form-grid"><label>Email<input name="email" type="email" placeholder="Enter your email" required></label><label>Password<input name="password" type="password" placeholder="Enter your password" required></label></div><div class="button-row"><button class="button primary">Login</button><a class="button ghost" href="#register">Create Account</a></div></form>') + '</section></div>');
  }

  function dashboard() {
    if (!requireUser()) return;
    var current = getCurrentUser(), stats = EcoDashboard.stats(current), orders = EcoDashboard.ordersFor(current), listings = EcoDashboard.listingsFor(current);
    if (current.role !== 'ADMIN' && (current.status === 'SUSPENDED' || current.status === 'REMOVED')) { notify('Your seller account has been suspended by the administrator.', 'error'); go('login'); return; }
    var profile = '<div class="profile-grid"><div class="profile-item"><small>Industry Name</small><strong>' + esc(current.industryName) + '</strong></div><div class="profile-item"><small>Owner Name</small><strong>' + esc(current.ownerName) + '</strong></div><div class="profile-item"><small>Email</small><strong>' + esc(current.email) + '</strong></div><div class="profile-item"><small>Contact Number</small><strong>' + esc(current.contactNumber) + '</strong></div><div class="profile-item"><small>Location</small><strong>' + esc(current.location) + '</strong></div><div class="profile-item"><small>Account</small><strong>' + (current.role === 'ADMIN' ? 'Administrator' : 'Industry') + '</strong></div></div>';
    var statHtml = [['Total Sales', money(stats.sales)], ['Total Purchases', money(stats.purchases)], ['Active Orders', stats.active], ['Completed Orders', stats.completed], ['Total Waste Listed', stats.listed], ['Total Waste Purchased', stats.purchased]].map(function (item) { return '<div class="mini-stat"><strong>' + item[1] + '</strong><span>' + item[0] + '</span></div>'; }).join('');
    var myOrderRows = orders.length ? orders.map(function (o) { return '<tr><td><strong>' + esc(o.orderCode) + '</strong></td><td>' + esc(o.wasteType) + '</td><td>' + esc(o.sellerIndustry) + '</td><td>' + date(o.createdAt) + '</td><td>' + EcoOrders.badge(o.status) + '</td><td><div class="button-row"><button class="button secondary small" data-action="message-order" data-id="' + esc(o.id) + '">Message Admin</button>' + ratingHtmlForOrder(o, current) + '</div></td></tr>'; }).join('') : '<tr><td colspan="6">No orders yet. Place an order from the Buy page to see it here.</td></tr>';
    var orderRows = orders.length ? orders.slice(0, 8).map(function (o) { return '<tr><td><strong>' + esc(o.orderCode) + '</strong></td><td>' + esc(o.wasteType) + '</td><td>' + (o.buyerId === current.id ? 'Purchase' : 'Sale') + '</td><td>' + money(o.finalAmount) + '</td><td>' + EcoOrders.badge(o.status) + '</td><td>' + date(o.createdAt) + '</td></tr>'; }).join('') : '<tr><td colspan="6">No orders yet. Place an order from the Buy page to see it here.</td></tr>';
    var listingRows = listings.length ? listings.map(function (l) { return '<tr><td>' + esc(l.wasteType) + '</td><td>' + l.quantity + ' ' + esc(l.unit) + '</td><td>' + money(l.price) + '</td><td>' + esc(l.location) + '</td><td>' + EcoOrders.badge(l.status) + '</td></tr>'; }).join('') : '<tr><td colspan="5">No listings yet. Create your first listing from Sell.</td></tr>';
    layout('<div class="page-head"><div><p class="eyebrow">Industry dashboard</p><h1>Good to see you, ' + esc(current.ownerName) + '.</h1><p>Track your material exchange activity in one place.</p></div><a class="button primary" href="#sell">+ List Waste</a></div><div class="dashboard-layout"><aside class="side-card"><h3>Workspace</h3><ul class="side-list"><li><button class="active">Overview</button></li><li><button data-route="sell">Sell Waste</button></li><li><button data-route="buy">Buy Materials</button></li><li><button data-action="logout">Logout</button></li></ul></aside><div class="content-stack"><section class="card"><h3>Industry profile</h3>' + profile + '</section><section class="card"><h3>Overview</h3><div class="mini-stat-grid">' + statHtml + '</div></section><section class="table-card"><h3>My Orders</h3><div class="table-scroll"><table><thead><tr><th>Order</th><th>Material</th><th>Seller</th><th>Date</th><th>Status</th><th>Action</th></tr></thead><tbody>' + myOrderRows + '</tbody></table></div></section><section class="table-card"><h3>Recent Orders</h3><div class="table-scroll"><table><thead><tr><th>Order ID</th><th>Waste Type</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>' + orderRows + '</tbody></table></div></section><section class="table-card"><h3>Recent Sales / Listings</h3><div class="table-scroll"><table><thead><tr><th>Waste Type</th><th>Quantity</th><th>Price</th><th>Location</th><th>Status</th></tr></thead><tbody>' + listingRows + '</tbody></table></div></section></div></div>');
  }

  function profile() {
    var current = getCurrentUser();
    if (!current || current.role !== 'USER') {
      notify('Please login to view your profile.', 'error');
      go('login');
      return;
    }
    layout('<div class="page-head"><div><p class="eyebrow">Your account</p><h1>Profile</h1><p>Review your industry account details.</p></div></div><section class="auth-card"><div class="profile-grid"><div class="profile-item"><small>Industry Name</small><strong>' + esc(current.industryName) + '</strong></div><div class="profile-item"><small>Owner Name</small><strong>' + esc(current.ownerName) + '</strong></div><div class="profile-item"><small>Email</small><strong>' + esc(current.email) + '</strong></div><div class="profile-item"><small>Contact Number</small><strong>' + esc(current.contactNumber) + '</strong></div><div class="profile-item"><small>Location</small><strong>' + esc(current.location) + '</strong></div></div></section>');
  }

  function messagesPage() {
    if (!requireUser()) return;
    var current = getCurrentUser();
    layout('<div class="page-head"><div><p class="eyebrow">Admin-mediated support</p><h1>Messages</h1><p>Every seller and buyer conversation is routed through the EcoExchange Admin.</p></div></div>' + EcoChat.render(current, route().split('/')[1] || ''));
  }

  function sell() {
    if (!requireUser()) return;
    var data = currentSell, commission = Number(data.price || 0) * .02, net = Number(data.price || 0) - commission;
    layout('<div class="page-head"><div><p class="eyebrow">Seller workspace</p><h1>List a material for exchange.</h1><p>Give buyers enough detail to make a confident reuse decision.</p></div></div><section class="auth-card"><form id="sell-form" class="form-grid"><label>Waste Type<select name="wasteType">' + EcoSell.types.map(function (type) { return '<option ' + (data.wasteType === type ? 'selected' : '') + '>' + type + '</option>'; }).join('') + '</select></label><label>Waste Photo<input name="photo" type="file" accept="image/*"><img id="image-preview" class="image-preview ' + (data.imageUrl ? 'visible' : '') + '" src="' + esc(data.imageUrl) + '" alt="Waste preview"></label><label>Quantity<input name="quantity" type="number" min="1" value="' + esc(data.quantity) + '" required></label><label>Unit<select name="unit"><option>kg</option><option>tonnes</option><option>litres</option><option>units</option></select></label><label>Price<input name="price" id="sell-price" type="number" min="1" value="' + esc(data.price) + '" required></label><label>Location<input name="location" value="' + esc(data.location) + '" required></label><label class="full">Description<textarea name="description" rows="4" required>' + esc(data.description) + '</textarea></label><div class="summary-box full"><div class="summary-row"><span>Listed Price</span><strong id="sell-base">' + money(data.price) + '</strong></div><div class="summary-row"><span>Seller Commission (2%)</span><strong id="seller-fee">' + money(commission) + '</strong></div><div class="summary-row total"><span>Net Amount</span><strong id="seller-net">' + money(net) + '</strong></div></div><div class="full button-row"><button class="button primary">Place Order / Listing</button><a class="button ghost" href="#dashboard">Cancel</a></div></form></section>');
  }

  function buy(filters) {
    filters = filters || { search: '', type: 'All', location: 'All', sort: 'newest' };
    var all = EcoBuy.listings().filter(function (item) { var q = filters.search.toLowerCase(); return (!q || (item.wasteType + ' ' + item.location + ' ' + item.sellerIndustry).toLowerCase().includes(q)) && (filters.type === 'All' || item.wasteType === filters.type) && (filters.location === 'All' || item.location === filters.location) && (!filters.minPrice || item.price >= Number(filters.minPrice)) && (!filters.minQuantity || item.quantity >= Number(filters.minQuantity)); });
    all.sort(function (a, b) { return filters.sort === 'low' ? a.price - b.price : filters.sort === 'high' ? b.price - a.price : new Date(b.createdAt) - new Date(a.createdAt); });
    var types = [...new Set(EcoBuy.listings().map(function (i) { return i.wasteType; }))], locations = [...new Set(EcoBuy.listings().map(function (i) { return i.location; }))];
    var cards = all.length ? all.map(function (item) {
      var summary = listingSummary(item.id);
      var ratingText = summary.reviewCount ? ('⭐ ' + Number(summary.averageRating || 0).toFixed(1) + '/5 • ' + summary.reviewCount + ' ' + (summary.reviewCount === 1 ? 'rating' : 'ratings')) : 'No ratings yet';
      return '<article class="listing"><img src="' + esc(EcoBuy.image(item)) + '" alt="' + esc(item.wasteType) + '"><div class="listing-body"><div class="listing-top"><span class="badge">' + esc(item.wasteType) + '</span><strong>' + money(item.price) + '</strong></div><h3>' + esc(item.sellerIndustry) + '</h3><p class="muted">' + esc(item.description) + '</p><div class="listing-meta"><span>' + item.quantity + ' ' + esc(item.unit) + '</span><span>' + esc(item.location) + '</span></div><div class="rating-row"><small>' + esc(ratingText) + '</small></div><div class="button-row"><a class="button secondary small" href="#buy/' + item.id + '">View Details</a><button class="button primary small place-order-btn" data-listing-id="' + esc(item.id) + '" data-id="' + esc(item.id) + '" data-action="buy-confirm">Place Order</button></div></div></article>';
    }).join('') : '<div class="empty"><h3>No matching listings</h3><p>Try a different search or list a new material.</p></div>';
    layout('<div class="page-head"><div><p class="eyebrow">Buyer marketplace</p><h1>Find materials ready for reuse.</h1><p>Compare industrial by-products by material, location, quantity, and price.</p></div><a class="button primary" href="#sell">+ Sell Waste</a></div><form id="filters-form" class="filters"><input name="search" value="' + esc(filters.search) + '" placeholder="Search material, location, industry"><select name="type"><option>All</option>' + types.map(function (x) { return '<option ' + (filters.type === x ? 'selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select><select name="location"><option>All</option>' + locations.map(function (x) { return '<option ' + (filters.location === x ? 'selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select><input name="minPrice" type="number" min="0" value="' + esc(filters.minPrice || '') + '" placeholder="Min price"><input name="minQuantity" type="number" min="0" value="' + esc(filters.minQuantity || '') + '" placeholder="Min quantity"><select name="sort"><option value="newest" ' + (filters.sort === 'newest' ? 'selected' : '') + '>Newest</option><option value="low" ' + (filters.sort === 'low' ? 'selected' : '') + '>Price: Low to High</option><option value="high" ' + (filters.sort === 'high' ? 'selected' : '') + '>Price: High to Low</option></select><button class="button primary">Filter</button></form><div class="listing-grid">' + cards + '</div>');
  }

  function reviewComposer(listing, editingReview) {
    var current = getCurrentUser();
    var existing = editingReview || (current && EcoSellerModeration.getUserRating(listing.id, current.id));
    if (existing && !editingReview) return '<section class="card review-composer"><h3>Your Review</h3><strong>' + stars(existing.rating) + ' ' + existing.rating + '/5</strong><p>"' + esc(existing.review) + '"</p><div class="button-row"><button class="button secondary small" data-action="edit-review" data-id="' + esc(existing.id) + '">Edit Review</button><button class="button danger small" data-action="delete-review" data-id="' + esc(existing.id) + '">Delete Review</button></div></section>';
    return '<section class="card review-composer"><h3>' + (editingReview ? 'Edit Review' : 'Rate &amp; Review This Material') + '</h3><p>How would you rate this material?</p><div class="review-stars"><button type="button" class="button ghost small" data-review-star="1">' + (existing && existing.rating >= 1 ? '★' : '☆') + '</button><button type="button" class="button ghost small" data-review-star="2">' + (existing && existing.rating >= 2 ? '★' : '☆') + '</button><button type="button" class="button ghost small" data-review-star="3">' + (existing && existing.rating >= 3 ? '★' : '☆') + '</button><button type="button" class="button ghost small" data-review-star="4">' + (existing && existing.rating >= 4 ? '★' : '☆') + '</button><button type="button" class="button ghost small" data-review-star="5">' + (existing && existing.rating >= 5 ? '★' : '☆') + '</button></div><p id="review-rating-caption" class="muted">Your Rating: ' + (existing ? existing.rating : 0) + '/5</p><form id="review-form"><input type="hidden" name="rating" value="' + (existing ? existing.rating : 0) + '"><input type="hidden" name="reviewId" value="' + (existing ? esc(existing.id) : '') + '"><input type="hidden" name="listingId" value="' + esc(listing.id) + '"><label>Write your review:<textarea name="review" rows="4" placeholder="Write your experience about this material...">' + (existing ? esc(existing.review) : '') + '</textarea></label><button class="button primary" type="submit">' + (editingReview ? 'Update Review' : 'Submit Review') + '</button></form></section>';
  }

  function buyDetail(id) {
    var listing = EcoBuy.find(id);
      if (!listing) { buy(); return; }
    var totals = EcoBuy.totals(listing);
    var summary = listingSummary(listing.id);
    var breakdown = [];
    var reviewHtml = summary.recentReviews && summary.recentReviews.length ? summary.recentReviews.map(function (review) { return '<div class="card"><strong>' + stars(review.rating) + '</strong><p class="muted">"' + esc(review.review || '') + '"</p><p class="muted">— ' + esc(review.userName || review.ratedBy || review.userId || review.buyerId || 'User') + '</p></div>'; }).join('') : '<div class="empty"><h3>No reviews yet</h3></div>';
    layout('<div class="page-head"><div><p class="eyebrow">Material details</p><h1>' + esc(listing.wasteType) + '</h1><p>Review the complete order economics before confirming.</p></div><a class="button ghost" href="#buy">← Back to marketplace</a></div><section class="detail-card"><img src="' + esc(EcoBuy.image(listing)) + '" alt="' + esc(listing.wasteType) + '"><div class="detail-copy"><span class="badge">Available</span><h2>' + esc(listing.sellerIndustry) + '</h2><div class="detail-meta"><span>' + listing.quantity + ' ' + esc(listing.unit) + '</span><span>' + esc(listing.location) + '</span><span>Listed ' + date(listing.createdAt) + '</span></div><p class="muted" style="margin-top:18px">' + esc(listing.description) + '</p><div class="summary-box"><div class="summary-row"><span>Material Rating</span><strong>' + (summary.reviewCount ? (stars(summary.averageRating) + ' ' + Number(summary.averageRating || 0).toFixed(1) + '/5') : 'No ratings yet') + '</strong></div><div class="summary-row"><span>Verified Ratings</span><strong>' + summary.reviewCount + '</strong></div></div><div class="card" style="margin-top:14px"><h3>Rating breakdown</h3>' + breakdown.map(function (entry) { return '<div class="summary-row"><span>' + '★'.repeat(entry.star) + '☆'.repeat(5 - entry.star) + ' ' + entry.star + '</span><strong>' + entry.count + '</strong></div>'; }).join('') + '</div><div class="card" style="margin-top:14px"><h3>Recent verified reviews</h3>' + reviewHtml + '</div><div class="summary-box" style="margin-top:14px"><div class="summary-row"><span>Base Price</span><strong>' + money(totals.base) + '</strong></div><div class="summary-row"><span>Buyer Commission (5%)</span><strong>' + money(totals.commission) + '</strong></div><div class="summary-row"><span>Transport Charge</span><strong>' + money(totals.transport) + '</strong></div><div class="summary-row total"><span>Final Price</span><strong>' + money(totals.final) + '</strong></div></div><button class="button primary place-order-btn" data-action="buy-confirm" data-listing-id="' + listing.id + '" data-id="' + listing.id + '">Place Order</button></div></section>');
    var breakdownCard = Array.from(document.querySelectorAll('.card')).find(function (card) { return card.textContent.indexOf('Rating breakdown') !== -1; });
    if (breakdownCard) breakdownCard.remove();
    Array.from(document.querySelectorAll('.summary-row span')).filter(function (node) { return node.textContent === 'Verified Ratings'; }).forEach(function (node) { node.textContent = 'Total Ratings'; });
    Array.from(document.querySelectorAll('.detail-copy h3')).filter(function (node) { return node.textContent === 'Recent verified reviews'; }).forEach(function (node) { node.textContent = 'Recent Reviews'; });
    Array.from(document.querySelectorAll('.summary-row strong')).filter(function (node) { return node.textContent === 'No ratings yet'; }).forEach(function (node) { node.textContent = 'No rating yet'; });
    var detailCopy = document.querySelector('.detail-copy');
    if (detailCopy && !detailCopy.querySelector('.review-composer')) detailCopy.insertAdjacentHTML('beforeend', reviewComposer(listing));
  }

  function orderModal(listing) { var totals = EcoBuy.totals(listing); pending = { kind: 'order', listing: listing }; document.body.insertAdjacentHTML('beforeend', '<div class="confirm-modal" id="modal"><section class="modal-card"><div class="modal-head"><div><p class="eyebrow">Confirm Purchase</p><h2>Confirm your order</h2></div><button class="close" data-action="close-modal">×</button></div><p class="muted"><strong>Material:</strong> ' + esc(listing.wasteType) + '</p><p class="muted"><strong>Seller:</strong> ' + esc(listing.sellerIndustry) + '</p><p class="muted"><strong>Quantity:</strong> ' + esc(listing.quantity + ' ' + listing.unit) + '</p><div class="summary-box"><div class="summary-row"><span>Base Price</span><strong>' + money(totals.base) + '</strong></div><div class="summary-row"><span>Buyer Commission (5%)</span><strong>' + money(totals.commission) + '</strong></div><div class="summary-row"><span>Transport Charge</span><strong>' + money(totals.transport) + '</strong></div><div class="summary-row total"><span>Final Price</span><strong>' + money(totals.final) + '</strong></div></div><div class="button-row"><button class="button primary" data-action="confirm-order" type="button">Confirm Order</button><button class="button ghost" data-action="close-modal" type="button">Cancel</button></div></section></div>'); }
  function orderDetail(order) { var steps = EcoOrders.timeline(order.status); return '<div class="confirm-modal" id="modal"><section class="modal-card"><div class="modal-head"><div><p class="eyebrow">Order tracking</p><h2>' + esc(order.orderCode) + '</h2></div><button class="close" data-action="close-modal">×</button></div><p><strong>' + esc(order.wasteType) + '</strong> · ' + money(order.finalAmount) + ' · ' + EcoOrders.badge(order.status) + '</p><div class="timeline">' + steps.map(function (step, i) { return '<div class="timeline-step ' + (step.done ? 'done' : '') + '"><span class="timeline-dot">' + (step.done ? '✓' : '·') + '</span><strong>' + step.label + '</strong></div>'; }).join('') + '</div></section></div>'; }

  function admin() {
    if (!requireUser()) return;
    if (!requireAdmin()) return;
    var section = route().split('/')[1] || 'overview';
    var overview = EcoAdmin.overview(), orders = EcoOrders.all(), listings = EcoBuy.listings(), requests = EcoAdmin.requests(), users = EcoAuth.users();
    var sellers = users.filter(function (item) { return item.role !== 'ADMIN'; });
    var buyers = orders.map(function (item) { return item.buyerIndustry; }).filter(function (value, index, array) { return array.indexOf(value) === index; });
    var navItems = [['overview', 'Overview'], ['orders', 'Orders'], ['messages', 'Messages'], ['sellers', 'Seller Management'], ['buyers', 'Buyers'], ['listings', 'Waste Listings'], ['logistics', 'Logistics'], ['reports', 'Seller Reports'], ['transactions', 'Transactions']];
    var nav = navItems.map(function (item) { return '<li><a class="' + (section === item[0] ? 'active' : '') + '" href="#admin/' + item[0] + '">' + item[1] + '</a></li>'; }).join('');
    var rows = orders.length ? orders.map(function (o) { return '<tr><td><button class="button ghost small" data-action="order-detail" data-id="' + o.id + '">' + esc(o.orderCode) + '</button></td><td>' + esc(o.sellerIndustry) + '</td><td>' + esc(o.buyerIndustry) + '</td><td>' + esc(o.wasteType) + '</td><td>' + o.quantity + '</td><td>' + money(o.basePrice) + '</td><td>' + money(o.buyerCommission) + '</td><td>' + money(o.transportCharge) + '</td><td>' + money(o.finalAmount) + '</td><td>' + EcoOrders.badge(o.status) + '</td><td>' + date(o.createdAt) + '</td><td><div class="button-row"><button class="button secondary small" data-action="message-order" data-id="' + o.id + '">Chat</button>' + (o.status === 'ORDER_PLACED' || o.status === 'ADMIN_REVIEW' ? '<button class="button primary small" data-action="forward" data-id="' + o.id + '">Forward to Logistics</button>' : '<select data-action="status" data-id="' + o.id + '">' + EcoOrders.statuses.map(function (s) { return '<option ' + (s === o.status ? 'selected' : '') + '>' + s + '</option>'; }).join('') + '</select>') + '</div></td></tr>'; }).join('') : '<tr><td colspan="12">No orders yet. Buyer orders will appear here.</td></tr>';
    var logisticsRows = requests.length ? requests.map(function (r) { var requestOrder = orders.find(function (o) { return o.id === r.orderId; }); return '<tr><td>' + r.id + '</td><td>' + (requestOrder ? esc(requestOrder.orderCode) : esc(r.orderId)) + '</td><td>' + esc(r.companyName) + '</td><td>' + EcoOrders.badge(r.status) + '</td><td><select data-action="logistics-status" data-id="' + r.id + '">' + ['ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'].map(function (status) { return '<option ' + (status === r.status ? 'selected' : '') + '>' + status + '</option>'; }).join('') + '</select></td></tr>'; }).join('') : '<tr><td colspan="5">No logistics requests yet. Forward an order to create one.</td></tr>';
    var listingRows = listings.map(function (listing) { var materialRating = listingSummary(listing.id); return '<tr><td>' + esc(listing.id) + '</td><td>' + esc(listing.sellerIndustry) + '</td><td>' + esc(listing.wasteType) + '</td><td>' + listing.quantity + ' ' + esc(listing.unit) + '</td><td>' + money(listing.price) + '</td><td>' + esc(listing.location) + '</td><td>' + (materialRating.reviewCount ? ('⭐ ' + Number(materialRating.averageRating || 0).toFixed(1) + '/5') : 'No ratings yet') + '</td><td>' + materialRating.reviewCount + '</td><td>' + EcoOrders.badge(listing.status) + '</td><td><button class="button ghost small" data-action="material-reviews" data-id="' + listing.id + '">View Reviews</button></td></tr>'; }).join('') || '<tr><td colspan="10">No waste listings yet.</td></tr>';
    var peopleRows = function (items) { return items.map(function (item) { return '<tr><td>' + esc(item.industryName) + '</td><td>' + esc(item.ownerName) + '</td><td>' + esc(item.email) + '</td><td>' + esc(item.contactNumber) + '</td><td>' + esc(item.location) + '</td><td>' + date(item.createdAt) + '</td></tr>'; }).join('') || '<tr><td colspan="6">No registered industries yet.</td></tr>'; };
    var sellerRows = sellers.length ? sellers.map(function (seller) { var sellerListings = listings.filter(function (item) { return item.sellerId === seller.id; }); var sellerOrders = orders.filter(function (order) { return order.sellerId === seller.id; }); var sellerSummaryData = sellerSummary(seller.id); var summaryText = (sellerSummaryData.averageRating || 0) > 0 ? (stars(sellerSummaryData.averageRating) + ' ' + Number(sellerSummaryData.averageRating).toFixed(1) + ' ') : 'No ratings'; return '<tr><td>' + esc(seller.id) + '</td><td>' + esc(seller.industryName) + '</td><td>' + esc(seller.ownerName) + '</td><td>' + esc(seller.email) + '</td><td>' + esc(seller.location) + '</td><td>' + sellerListings.length + ' listings</td><td>' + sellerOrders.length + ' orders</td><td>' + sellerOrders.filter(function (item) { return item.status === 'COMPLETED'; }).length + ' completed</td><td>' + summaryText + '</td><td>' + sellerSummaryData.reviewCount + ' reviews</td><td>' + (seller.status || 'ACTIVE') + '</td><td><div class="button-row"><button class="button ghost small" data-action="seller-view" data-id="' + seller.id + '">View</button>' + (seller.status === 'SUSPENDED' ? '<button class="button primary small" data-action="seller-reactivate" data-id="' + seller.id + '">Reactivate</button>' : '<button class="button secondary small" data-action="seller-suspend" data-id="' + seller.id + '">Suspend</button>') + '<button class="button danger small" data-action="seller-remove" data-id="' + seller.id + '">Remove</button></div></td></tr>'; }).join('') : '<tr><td colspan="12">No sellers registered.</td></tr>';
    var reportRows = window.EcoSellerModeration.getReports().length ? window.EcoSellerModeration.getReports().map(function (report) { var seller = sellerById(report.sellerId); return '<tr><td>' + esc(report.id) + '</td><td>' + esc(seller.industryName || report.sellerId) + '</td><td>' + esc(report.reportedBy) + '</td><td>' + esc(report.reason) + '</td><td>' + esc(report.orderId || '—') + '</td><td>' + date(report.createdAt) + '</td><td>' + esc(report.status) + '</td><td><div class="button-row"><button class="button ghost small" data-action="report-view" data-id="' + report.id + '">View</button><button class="button primary small" data-action="report-reviewed" data-id="' + report.id + '">Mark Reviewed</button><button class="button secondary small" data-action="report-dismiss" data-id="' + report.id + '">Dismiss</button></div></td></tr>'; }).join('') : '<tr><td colspan="8">No seller reports yet.</td></tr>';
    var transactionRows = orders.map(function (o) { return '<tr><td>' + esc(o.orderCode) + '</td><td>BUY</td><td>' + money(o.finalAmount) + '</td><td>' + EcoOrders.badge(o.status) + '</td><td>' + date(o.createdAt) + '</td></tr>'; }).join('') || '<tr><td colspan="5">No transactions yet.</td></tr>';
    var stats = '<div class="stat-grid"><div class="stat"><small>Total Sellers</small><strong>' + sellers.length + '</strong></div><div class="stat"><small>Active Sellers</small><strong>' + sellers.filter(function (seller) { return (seller.status || 'ACTIVE') === 'ACTIVE'; }).length + '</strong></div><div class="stat"><small>Suspended Sellers</small><strong>' + sellers.filter(function (seller) { return (seller.status || 'ACTIVE') === 'SUSPENDED'; }).length + '</strong></div><div class="stat"><small>Removed Sellers</small><strong>' + sellers.filter(function (seller) { return (seller.status || 'ACTIVE') === 'REMOVED'; }).length + '</strong></div><div class="stat"><small>Average Platform Rating</small><strong>' + (window.EcoSellerModeration ? (window.EcoSellerModeration.getRatings().length ? (window.EcoSellerModeration.averageRating(window.EcoSellerModeration.getRatings())).toFixed(1) : '0.0') : '0.0') + '</strong></div><div class="stat"><small>Pending Seller Reports</small><strong>' + window.EcoSellerModeration.getReports().filter(function (report) { return report.status === 'PENDING'; }).length + '</strong></div></div>';
    var content = stats;
    if (section === 'orders' || section === 'overview') content += '<section class="table-card"><h3>' + (section === 'overview' ? 'Recent Orders' : 'All Orders') + '</h3><div class="table-scroll"><table><thead><tr><th>Order ID</th><th>Seller</th><th>Buyer</th><th>Waste Type</th><th>Qty</th><th>Base Price</th><th>Commission</th><th>Transport</th><th>Final</th><th>Status</th><th>Date</th><th>Action</th></tr></thead><tbody>' + rows + '</tbody></table></div></section>';
    if (section === 'sellers') content += '<section class="table-card"><h3>Seller Management</h3><div class="table-scroll"><table><thead><tr><th>Seller ID</th><th>Industry Name</th><th>Owner Name</th><th>Email</th><th>Location</th><th>Total Listings</th><th>Total Orders</th><th>Completed Orders</th><th>Average Rating</th><th>Reviews</th><th>Account Status</th><th>Actions</th></tr></thead><tbody>' + sellerRows + '</tbody></table></div></section>';
    if (section === 'buyers') content += '<section class="table-card"><h3>Buyers</h3><div class="table-scroll"><table><thead><tr><th>Industry</th><th>Owner</th><th>Email</th><th>Contact</th><th>Location</th><th>Joined</th></tr></thead><tbody>' + peopleRows(users.filter(function (item) { return item.role !== 'ADMIN'; })) + '</tbody></table></div></section>';
    if (section === 'listings') content += '<section class="table-card"><h3>Waste Listings</h3><div class="table-scroll"><table><thead><tr><th>Listing ID</th><th>Seller</th><th>Waste Type</th><th>Quantity</th><th>Price</th><th>Location</th><th>Average Rating</th><th>Total Ratings</th><th>Status</th><th>Actions</th></tr></thead><tbody>' + listingRows + '</tbody></table></div></section>';
    if (section === 'logistics') content += '<section class="table-card"><h3>Logistics Requests</h3><div class="table-scroll"><table><thead><tr><th>Request</th><th>Order</th><th>Company</th><th>Status</th><th>Update Status</th></tr></thead><tbody>' + logisticsRows + '</tbody></table></div></section><section class="card"><h3>Available logistics companies</h3><div class="benefit-grid">' + EcoAdmin.companies.map(function (c) { return '<div class="benefit"><strong>' + c.name + '</strong><p>' + c.area + '</p></div>'; }).join('') + '</div></section>';
    if (section === 'reports') content += '<section class="table-card"><h3>Seller Reports</h3><div class="table-scroll"><table><thead><tr><th>Report ID</th><th>Seller</th><th>Reported By</th><th>Reason</th><th>Order ID</th><th>Date</th><th>Status</th><th>Action</th></tr></thead><tbody>' + reportRows + '</tbody></table></div></section>';
    if (section === 'transactions') content += '<section class="table-card"><h3>Transactions</h3><div class="table-scroll"><table><thead><tr><th>Order</th><th>Type</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead><tbody>' + transactionRows + '</tbody></table></div></section>';
    layout('<div class="page-head"><div><p class="eyebrow">Administration</p><h1>Control the exchange network.</h1><p>Review shared marketplace data, assign logistics, and move materials through the chain.</p></div></div><div class="admin-layout"><aside class="side-card"><h3>Admin workspace</h3><ul class="side-list">' + nav + '</ul></aside><div class="content-stack">' + content + '</div></div>');
  }

  function sellerProfilePage(id) {
    var seller = sellerById(id);
    var summary = sellerSummary(id);
    var listings = EcoBuy.listings().filter(function (item) { return item.sellerId === id; });
    var reviews = window.EcoSellerModeration ? window.EcoSellerModeration.getRatings().filter(function (item) { return item.sellerId === id; }).slice(0, 4) : [];
    var reviewHtml = reviews.length ? reviews.map(function (review) { return '<div class="card"><strong>' + stars(review.rating) + '</strong><p class="muted">"' + esc(review.review) + '"</p><p class="muted">— ' + esc(review.userName || review.ratedBy || review.userId || 'User') + '</p></div>'; }).join('') : '<div class="empty"><h3>No reviews yet</h3></div>';
    layout('<div class="page-head"><div><p class="eyebrow">Seller profile</p><h1>' + esc(seller.industryName) + '</h1><p>' + stars(summary.averageRating) + ' ' + Number(summary.averageRating || 0).toFixed(1) + ' · Based on ' + summary.reviewCount + ' verified reviews</p></div><div class="button-row"><button class="button secondary" data-action="report-seller" data-id="' + seller.id + '">Report Seller</button><a class="button ghost" href="#buy">← Back to marketplace</a></div></div><section class="card"><div class="profile-grid"><div class="profile-item"><small>Industry Name</small><strong>' + esc(seller.industryName) + '</strong></div><div class="profile-item"><small>Owner Name</small><strong>' + esc(seller.ownerName) + '</strong></div><div class="profile-item"><small>Email</small><strong>' + esc(seller.email) + '</strong></div><div class="profile-item"><small>Location</small><strong>' + esc(seller.location) + '</strong></div><div class="profile-item"><small>Completed Transactions</small><strong>' + summary.completedOrders + '</strong></div><div class="profile-item"><small>Seller Status</small><strong>' + (seller.status || 'ACTIVE') + '</strong></div></div></section><section class="card"><h3>Rating Summary</h3><div class="mini-stat-grid"><div class="mini-stat"><strong>' + stars(summary.averageRating) + '</strong><span>Average Rating</span></div><div class="mini-stat"><strong>' + summary.reviewCount + '</strong><span>Reviews</span></div><div class="mini-stat"><strong>' + summary.completedOrders + '</strong><span>Completed Orders</span></div><div class="mini-stat"><strong>' + listings.length + '</strong><span>Total Listings</span></div></div></section><section class="card"><h3>Recent Reviews</h3>' + reviewHtml + '</section>');
  }

  function render() { var current = route(); if (current.indexOf('buy/') === 0) return buyDetail(current.split('/')[1]); if (current.indexOf('seller/') === 0) return sellerProfilePage(current.split('/')[1]); if (current.indexOf('messages') === 0) return messagesPage(); if (current === 'home') return home(); if (current === 'about') return about(); if (current === 'register') return authPage('register'); if (current === 'login') return authPage('login'); if (current === 'profile') return profile(); if (current === 'dashboard') return dashboard(); if (current === 'sell') return sell(); if (current === 'buy') return buy(); if (current === 'admin' || current.indexOf('admin/') === 0) return admin(); return home(); }

  document.addEventListener('click', function (event) {
    var target = event.target.closest('[data-action], [data-route], .place-order-btn, [data-review-star], [data-rate-star]'); if (!target) return;
    var action = target.dataset.action;
    if (target.dataset.route) { event.preventDefault(); go(target.dataset.route); return; }
    if (action === 'menu') document.getElementById('main-nav').classList.toggle('open');
    if (action === 'logout') { event.preventDefault(); event.stopPropagation(); logout(); return; }
    if (action === 'message-order') {
      if (!requireUser()) return;
      var chatOrder = EcoOrders.all().find(function (order) { return String(order.id) === String(target.dataset.id); });
      if (!chatOrder) { notify('Order not found.', 'error'); return; }
      try { var conversation = EcoChat.ensure(chatOrder); go('messages/' + conversation.id); } catch (error) { notify(error.message, 'error'); }
      return;
    }
    if (action === 'open-chat') { go('messages/' + target.dataset.id); return; }
    if (action === 'toggle-chat-status') {
      if (!requireAdmin()) return;
      var statusConversation = EcoChat.find(target.dataset.id);
      if (statusConversation) { EcoChat.setStatus(statusConversation.id, statusConversation.status === 'CLOSED' ? 'OPEN' : 'CLOSED'); notify(statusConversation.status === 'CLOSED' ? 'Conversation reopened.' : 'Conversation closed.'); render(); }
      return;
    }
    if (action === 'close-modal') { var modal = document.getElementById('modal'); if (modal) modal.remove(); pending = null; }
    if (action === 'edit-review') {
      var reviewToEdit = EcoSellerModeration.getRatings().find(function (review) { return review.id === target.dataset.id; });
      if (!reviewToEdit || !getCurrentUser() || String(reviewToEdit.userId || reviewToEdit.buyerId) !== String(getCurrentUser().id)) return;
      var editForm = reviewComposer(EcoBuy.find(reviewToEdit.listingId), reviewToEdit);
      var composer = document.querySelector('.review-composer');
      if (composer) { composer.outerHTML = editForm; document.querySelector('#review-form textarea').value = reviewToEdit.review; document.querySelectorAll('[data-review-star]').forEach(function (button) { button.textContent = Number(button.dataset.reviewStar) <= reviewToEdit.rating ? '★' : '☆'; }); document.getElementById('review-rating-caption').textContent = 'Your Rating: ' + reviewToEdit.rating + '/5'; }
      return;
    }
    if (action === 'delete-review') {
      var reviewToDelete = EcoSellerModeration.getRatings().find(function (review) { return review.id === target.dataset.id; });
      if (!reviewToDelete || !getCurrentUser() || String(reviewToDelete.userId || reviewToDelete.buyerId) !== String(getCurrentUser().id)) return;
      if (window.confirm('Are you sure you want to delete your review?')) { EcoSellerModeration.removeRating(reviewToDelete.id); notify('Review deleted.'); render(); }
      return;
    }
    if (action === 'buy-confirm') {
      var listingId = target.dataset.listingId || target.dataset.id;
      if (!listingId) {
        notify('This material is no longer available.', 'error');
        return;
      }
      if (!getCurrentUser()) {
        notify('Please login to place an order.', 'error');
        go('login');
        return;
      }
      var buyer = getCurrentUser();
      if (buyer.role === 'ADMIN') {
        notify('Admin users cannot place orders.', 'error');
        return;
      }
      var selectedListing = EcoBuy.find(listingId);
      if (!selectedListing) {
        notify('This material is no longer available.', 'error');
        return;
      }
      if (selectedListing.status === 'REMOVED' || selectedListing.status === 'SOLD' || selectedListing.availability === 'Sold' || selectedListing.availability === 'Unavailable') {
        notify('This material is currently unavailable.', 'error');
        return;
      }
      if (String(selectedListing.sellerId) === String(buyer.id)) {
        notify('You cannot purchase your own listing.', 'error');
        return;
      }
      orderModal(selectedListing);
      return;
    }
    if (action === 'confirm-order') {
      if (pending && pending.kind === 'order' && pending.__processing) return;
      var current = getCurrentUser();
      if (!current) {
        notify('Please login to place an order.', 'error');
        go('login');
        return;
      }
      if (current.role === 'ADMIN') {
        notify('Admin users cannot place orders.', 'error');
        return;
      }
      var listing = pending && pending.listing ? pending.listing : null;
      if (!listing) {
        notify('This material is no longer available.', 'error');
        return;
      }
      if (String(listing.sellerId) === String(current.id)) {
        notify('You cannot purchase your own listing.', 'error');
        return;
      }
      var duplicateOrder = EcoOrders.findPendingForBuyer(listing.id, current.id);
      if (duplicateOrder) {
        notify('This order has already been submitted.', 'error');
        return;
      }
      if (!EcoBuy.find(listing.id)) {
        notify('This material is no longer available.', 'error');
        return;
      }
      pending.__processing = true;
      var confirmButton = target.closest('[data-action="confirm-order"]');
      if (confirmButton) confirmButton.disabled = true;
      try {
        var createdOrder = EcoOrders.createFromListing(listing, current);
        var modal = document.getElementById('modal');
        if (modal) modal.remove();
        pending = null;
        notify('Order placed successfully! Order ID: ' + createdOrder.id);
        go('dashboard');
      } catch (error) {
        pending = null;
        notify(error.message || 'Unable to place order.', 'error');
      }
      return;
    }
    if (action === 'order-detail') { var found = EcoOrders.all().find(function (o) { return o.id === target.dataset.id; }); document.body.insertAdjacentHTML('beforeend', orderDetail(found)); }
    var starTarget = event.target.closest('[data-rate-star]');
    if (starTarget) {
      var ratingInput = document.querySelector('#rating-form input[name="rating"]');
      var caption = document.getElementById('rating-caption');
      if (ratingInput) ratingInput.value = starTarget.dataset.rateStar;
      if (caption) caption.textContent = starTarget.dataset.rateStar + ' ' + stars(Number(starTarget.dataset.rateStar));
      return;
    }
    var reviewStarTarget = event.target.closest('[data-review-star]');
    if (reviewStarTarget) {
      var reviewForm = document.getElementById('review-form');
      var reviewRatingInput = reviewForm && reviewForm.querySelector('input[name="rating"]');
      var selectedRating = Number(reviewStarTarget.dataset.reviewStar);
      if (reviewRatingInput) reviewRatingInput.value = selectedRating;
      document.querySelectorAll('[data-review-star]').forEach(function (button) { button.textContent = Number(button.dataset.reviewStar) <= selectedRating ? '★' : '☆'; });
      var reviewCaption = document.getElementById('review-rating-caption');
      if (reviewCaption) reviewCaption.textContent = 'Your Rating: ' + selectedRating + '/5';
      return;
    }
    if (action === 'forward') { var order = EcoOrders.all().find(function (o) { return o.id === target.dataset.id; }); pending = { kind: 'forward', order: order }; document.body.insertAdjacentHTML('beforeend', '<div class="confirm-modal" id="modal"><section class="modal-card"><div class="modal-head"><div><p class="eyebrow">Logistics handoff</p><h2>Assign logistics company</h2></div><button class="close" data-action="close-modal">×</button></div><p class="muted">Choose a partner for ' + esc(order.orderCode) + '.</p><select id="logistics-company">' + EcoAdmin.companies.map(function (c) { return '<option value="' + c.id + '">' + c.name + ' · ' + c.area + '</option>'; }).join('') + '</select><div class="button-row" style="margin-top:18px"><button class="button primary" data-action="assign">Assign Logistics</button><button class="button ghost" data-action="close-modal">Cancel</button></div></section></div>'); }
    if (action === 'assign') { var companyId = document.getElementById('logistics-company').value; EcoAdmin.forward(pending.order, companyId); document.getElementById('modal').remove(); pending = null; notify('Order forwarded and logistics assigned.'); render(); }
    if (action === 'rate-order') {
      var orderForRating = EcoOrders.all().find(function (item) { return item.id === target.dataset.id; });
      if (!orderForRating) return;
      pending = { kind: 'rating', order: orderForRating };
      document.body.insertAdjacentHTML('beforeend', '<div class="confirm-modal" id="modal"><section class="modal-card"><div class="modal-head"><div><p class="eyebrow">Seller rating</p><h2>Rate this material</h2></div><button class="close" data-action="close-modal">×</button></div><p class="muted">' + esc(orderForRating.wasteType) + ' · Order ' + esc(orderForRating.orderCode) + '</p><div class="button-row" style="margin-top:18px; margin-bottom:12px"><button class="button ghost small" data-rate-star="1">☆</button><button class="button ghost small" data-rate-star="2">☆</button><button class="button ghost small" data-rate-star="3">☆</button><button class="button ghost small" data-rate-star="4">☆</button><button class="button ghost small" data-rate-star="5">☆</button></div><p id="rating-caption" class="muted">Your Rating: 0/5</p><form id="rating-form"><input type="hidden" name="rating" value="0"><label class="full">Write your review<textarea name="review" rows="4" placeholder="Write your review" required></textarea></label><div class="button-row"><button class="button primary" type="submit">Submit Rating</button><button class="button ghost" type="button" data-action="close-modal">Cancel</button></div></form></section></div>');
      var caption = document.getElementById('rating-caption');
      if (caption) caption.textContent = 'Your Rating: 0/5';
    }
    if (action === 'seller-view') { var sellerToView = sellerById(target.dataset.id); if (sellerToView) sellerProfilePage(sellerToView.id); }
    if (action === 'seller-suspend') {
      if (!requireAdmin()) return;
      var sellerToSuspend = sellerById(target.dataset.id); if (!sellerToSuspend) return;
      var sellerRecord = EcoAuth.users().find(function (item) { return item.id === sellerToSuspend.id; });
      if (sellerRecord) {
        EcoSellerModeration.suspendSeller(sellerRecord.id, getCurrentUser().id, 'Seller suspended by administrator through moderation dashboard');
        notify('Seller suspended.', 'error');
        render();
      }
    }
    if (action === 'seller-reactivate') {
      if (!requireAdmin()) return;
      var sellerToReactivate = sellerById(target.dataset.id); if (!sellerToReactivate) return;
      EcoSellerModeration.reactivateSeller(sellerToReactivate.id, getCurrentUser().id, 'Seller reactivated by administrator');
      notify('Seller reactivated.');
      render();
    }
    if (action === 'seller-remove') {
      if (!requireAdmin()) return;
      var sellerToRemove = sellerById(target.dataset.id); if (!sellerToRemove) return;
      if (!window.confirm('Are you sure you want to remove this seller?')) return;
      EcoSellerModeration.removeSeller(sellerToRemove.id, getCurrentUser().id, 'Seller removed by administrator');
      notify('Seller removed.');
      render();
    }
    if (action === 'report-seller') {
      if (!requireUser()) return;
      var seller = sellerById(target.dataset.id); if (!seller) return;
      pending = { kind: 'report', seller: seller, orderId: '' };
      document.body.insertAdjacentHTML('beforeend', '<div class="confirm-modal" id="modal"><section class="modal-card"><div class="modal-head"><div><p class="eyebrow">Report Seller</p><h2>Report issue</h2></div><button class="close" data-action="close-modal">×</button></div><form id="seller-report-form"><input type="hidden" name="sellerId" value="' + esc(seller.id) + '"><label>Reason<select name="reason"><option value="Fake seller">Fake seller</option><option value="Incorrect material">Incorrect material</option><option value="Misleading listing">Misleading listing</option><option value="Fraudulent activity">Fraudulent activity</option><option value="Material quality issue">Material quality issue</option><option value="Seller not responding">Seller not responding</option><option value="Other">Other</option></select></label><label class="full">Description<textarea name="description" rows="4" placeholder="Tell us what happened"></textarea></label><div class="button-row"><button class="button primary" type="submit">Submit Report</button><button class="button ghost" type="button" data-action="close-modal">Cancel</button></div></form></section></div>');
    }
    if (action === 'report-view') {
      var reportToView = window.EcoSellerModeration.getReports().find(function (item) { return item.id === target.dataset.id; }); if (!reportToView) return;
      var sellerDesk = sellerById(reportToView.sellerId);
      notify('Report ' + reportToView.id + ' · ' + reportToView.reason + ' · ' + reportToView.status, '');
      if (sellerDesk) sellerProfilePage(sellerDesk.id);
    }
    if (action === 'material-reviews') {
      var listingReviews = EcoBuy.find(target.dataset.id);
      if (!listingReviews) return;
      var reviewData = listingSummary(listingReviews.id);
      var reviewList = reviewData.recentReviews && reviewData.recentReviews.length ? reviewData.recentReviews.map(function (review) { return '<div class="card"><strong>' + stars(review.rating) + '</strong><p class="muted">"' + esc(review.review || '') + '"</p><p class="muted">User: ' + esc(review.userName || review.userId || review.buyerId || 'User') + ' · Date: ' + date(review.createdAt) + '</p><button class="button danger small" data-action="remove-rating" data-id="' + esc(review.id) + '">Remove Review</button></div>'; }).join('') : '<div class="empty"><h3>No reviews yet</h3></div>';
      document.body.insertAdjacentHTML('beforeend', '<div class="confirm-modal" id="modal"><section class="modal-card"><div class="modal-head"><div><p class="eyebrow">Material reviews</p><h2>' + esc(listingReviews.wasteType) + '</h2></div><button class="close" data-action="close-modal">×</button></div>' + reviewList + '<div class="button-row" style="margin-top:18px"><button class="button ghost" data-action="close-modal">Close</button></div></section></div>');
    }
    if (action === 'remove-rating') {
      if (!requireAdmin()) return;
      EcoSellerModeration.removeRating(target.dataset.id);
      var reviewModal = document.getElementById('modal');
      if (reviewModal) reviewModal.remove();
      notify('Review removed.');
      render();
    }
    if (action === 'report-reviewed') {
      if (!requireAdmin()) return;
      window.EcoSellerModeration.updateReport(target.dataset.id, 'REVIEWED', getCurrentUser().id);
      notify('Report marked reviewed.');
      render();
    }
    if (action === 'report-dismiss') {
      if (!requireAdmin()) return;
      window.EcoSellerModeration.updateReport(target.dataset.id, 'DISMISSED', getCurrentUser().id);
      notify('Report dismissed.');
      render();
    }
  });
  document.addEventListener('submit', function (event) {
    var form = event.target; if (!form.id) return; event.preventDefault(); var data = readForm(form);
    if (form.id === 'chat-form') {
      var chatUser = getCurrentUser();
      if (!chatUser) { notify('Your session has expired. Please login again.', 'error'); go('login'); return; }
      var chatId = route().split('/')[1];
      try { EcoChat.send(chatId, chatUser, data.content, data.recipient); notify('Message sent.'); render(); } catch (error) { notify(error.message || 'Unable to send message.', 'error'); }
      return;
    }
    if (form.id === 'register-form') { if (data.password !== data.confirmPassword) return notify('Passwords do not match.', 'error'); try { EcoAuth.register(data); notify('Registration successful.'); go('dashboard'); } catch (error) { notify(error.message, 'error'); } }
    if (form.id === 'login-form') { try { var logged = EcoAuth.login(data.email, data.password); updateNavigation(); notify('Login successful.'); go(logged.role === 'ADMIN' ? 'admin' : 'dashboard'); } catch (error) { notify('Invalid email or password.', 'error'); } }
    if (form.id === 'sell-form') { if (!requireUser()) return; if (getCurrentUser().status === 'SUSPENDED' || getCurrentUser().status === 'REMOVED') return notify('Your seller account has been suspended by the administrator.', 'error'); if (!data.description.trim()) return notify('Description is required.', 'error'); data.imageUrl = currentSell.imageUrl || ''; delete data.photo; EcoSell.save(data, getCurrentUser()); currentSell = EcoSell.blank(); notify('Waste listing created successfully.'); go('dashboard'); }
    if (form.id === 'filters-form') { buy(data); }
    if (form.id === 'review-form') {
      var reviewUser = getCurrentUser();
      if (!reviewUser) { notify('Please login to rate and review this material.', 'error'); go('login'); return; }
      var reviewListing = EcoBuy.find(data.listingId);
      if (!reviewListing) { notify('This material is no longer available.', 'error'); return; }
      var reviewPayload = { id: data.reviewId || '', listingId: reviewListing.id, sellerId: reviewListing.sellerId, userId: reviewUser.id, userName: reviewUser.ownerName || reviewUser.industryName || reviewUser.email, rating: Number(data.rating), review: data.review, wasteType: reviewListing.wasteType, existingRatings: EcoSellerModeration.getRatings() };
      var reviewValidation = EcoSellerModeration.validateRatingSubmission(reviewPayload);
      if (!reviewValidation.valid) { notify(reviewValidation.errors.join(' '), 'error'); return; }
      try {
        if (data.reviewId) EcoSellerModeration.updateRating(reviewPayload); else EcoSellerModeration.createRating(reviewPayload);
        notify('✓ Review submitted successfully');
        render();
      } catch (error) { notify(error.message, 'error'); }
      return;
    }
    if (form.id === 'rating-form') {
      var ratingOrder = pending && pending.kind === 'rating' ? pending.order : null;
      if (!ratingOrder) return;
      var currentUser = getCurrentUser();
      var parsed = Number(data.rating);
      var validation = EcoSellerModeration.validateRatingSubmission({ listingId: ratingOrder.listingId || ratingOrder.id, sellerId: ratingOrder.sellerId, userId: currentUser.id, userName: currentUser.ownerName || currentUser.industryName || currentUser.email, rating: parsed, review: data.review || '', wasteType: ratingOrder.wasteType, existingRatings: EcoSellerModeration.getRatings() });
      if (!validation.valid) { notify(validation.errors.join(' '), 'error'); return; }
      try {
        var created = EcoSellerModeration.createRating({ listingId: ratingOrder.listingId || ratingOrder.id, sellerId: ratingOrder.sellerId, userId: currentUser.id, userName: currentUser.ownerName || currentUser.industryName || currentUser.email, rating: parsed, review: data.review || '', wasteType: ratingOrder.wasteType, createdAt: new Date().toISOString(), existingRatings: EcoSellerModeration.getRatings() });
        document.getElementById('modal').remove(); pending = null; notify('Rating submitted successfully.'); render();
        return created;
      } catch (error) { notify(error.message, 'error'); }
    }
    if (form.id === 'seller-report-form') {
      if (!requireUser()) return;
      var reportPayload = { sellerId: data.sellerId, reportedBy: getCurrentUser().id, reason: data.reason, description: data.description, orderId: pending && pending.orderId ? pending.orderId : '', status: 'PENDING' };
      try { EcoSellerModeration.submitReport(reportPayload); document.getElementById('modal').remove(); pending = null; notify('Seller report submitted.'); render(); } catch (error) { notify(error.message, 'error'); }
    }
  });
  document.addEventListener('input', function (event) { if (event.target.id === 'sell-price') { var value = Number(event.target.value || 0), fee = value * .02; document.getElementById('sell-base').textContent = money(value); document.getElementById('seller-fee').textContent = money(fee); document.getElementById('seller-net').textContent = money(value - fee); } if (event.target.name === 'rating' && document.getElementById('rating-caption')) { var val = Number(event.target.value || 0); document.getElementById('rating-caption').textContent = val + ' ' + stars(val); } if (event.target.id === 'chat-search') { var query = event.target.value.toLowerCase(); document.querySelectorAll('.chat-list-item').forEach(function (item) { item.hidden = query && item.dataset.search.toLowerCase().indexOf(query) < 0; }); } });
  document.addEventListener('change', function (event) { if (event.target.name === 'photo' && event.target.files[0]) { var reader = new FileReader(); reader.onload = function (e) { currentSell.imageUrl = e.target.result; var preview = document.getElementById('image-preview'); preview.src = e.target.result; preview.classList.add('visible'); }; reader.readAsDataURL(event.target.files[0]); } if (event.target.dataset.action === 'status') { EcoOrders.update(event.target.dataset.id, { status: event.target.value }); notify('Order status updated.'); render(); } if (event.target.dataset.action === 'logistics-status') { EcoAdmin.updateRequest(event.target.dataset.id, event.target.value); notify('Logistics and order status updated.'); render(); } });
  window.addEventListener('hashchange', render);
  window.addEventListener('storage', function (event) { if (event.key === 'currentUser' || event.key === 'ecoexchange_session') { updateNavigation(); render(); } });
  seed(); render();
}());
