(function () {
  function ordersFor(user) {
    return EcoAuth.read('ecoexchange_orders', []).filter(function (order) { return order.buyerId === user.id || order.sellerId === user.id; });
  }
  function listingsFor(user) {
    return EcoAuth.read('ecoexchange_listings', []).filter(function (listing) { return listing.sellerId === user.id; });
  }
  function stats(user) {
    var orders = ordersFor(user), listings = listingsFor(user);
    return {
      sales: orders.filter(function (o) { return o.sellerId === user.id; }).reduce(function (sum, o) { return sum + o.finalAmount; }, 0),
      purchases: orders.filter(function (o) { return o.buyerId === user.id; }).reduce(function (sum, o) { return sum + o.finalAmount; }, 0),
      active: orders.filter(function (o) { return !['COMPLETED', 'CANCELLED'].includes(o.status); }).length,
      completed: orders.filter(function (o) { return o.status === 'COMPLETED'; }).length,
      listed: listings.length,
      purchased: orders.filter(function (o) { return o.buyerId === user.id; }).length
    };
  }
  window.EcoDashboard = { ordersFor: ordersFor, listingsFor: listingsFor, stats: stats };
}());
