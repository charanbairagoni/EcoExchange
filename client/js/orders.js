(function () {
  var statuses = ['ORDER_PLACED', 'ADMIN_REVIEW', 'FORWARDED_TO_LOGISTICS', 'PICKUP_SCHEDULED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED'];
  var labels = ['Order Placed', 'Admin Reviewed', 'Forwarded to Logistics', 'Pickup Scheduled', 'In Transit', 'Delivered', 'Completed'];
  function all() { return EcoAuth.read('ecoexchange_orders', []); }
  function save(order) { var orders = all(); orders.unshift(order); EcoAuth.write('ecoexchange_orders', orders); return order; }
  function update(id, changes) { var orders = all().map(function (order) { return order.id === id ? Object.assign({}, order, changes, { updatedAt: new Date().toISOString() }) : order; }); EcoAuth.write('ecoexchange_orders', orders); return orders.find(function (order) { return order.id === id; }); }
  function timeline(status) { var current = statuses.indexOf(status); return labels.map(function (label, index) { return { label: label, done: index <= current }; }); }
  function badge(status) { var tone = status === 'COMPLETED' ? '' : (status === 'CANCELLED' ? 'red' : 'amber'); return '<span class="badge ' + tone + '">' + status.replaceAll('_', ' ') + '</span>'; }
  window.EcoOrders = { statuses: statuses, labels: labels, all: all, save: save, update: update, timeline: timeline, badge: badge };
}());
