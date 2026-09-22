(function () {
  var statuses = ['ORDER_PLACED', 'ADMIN_REVIEW', 'FORWARDED_TO_LOGISTICS', 'PICKUP_SCHEDULED', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED'];
  var labels = ['Order Placed', 'Admin Reviewed', 'Forwarded to Logistics', 'Pickup Scheduled', 'In Transit', 'Delivered', 'Completed'];
  function all() { return EcoAuth.read('ecoexchange_orders', []); }
  function nextOrderNumber() {
    var max = all().reduce(function (largest, order) {
      var id = String(order && (order.id || order.orderCode || '')).replace(/\D/g, '');
      var numeric = Number(id || 0);
      return Math.max(largest, numeric);
    }, 0);
    return max + 1;
  }
  function nextOrderId() {
    return 'ECX' + String(nextOrderNumber()).padStart(4, '0');
  }
  function findPendingForBuyer(listingId, buyerId) {
    return all().find(function (order) {
      return String(order.listingId) === String(listingId) && String(order.buyerId) === String(buyerId) && order.status !== 'CANCELLED';
    });
  }
  function buildFromListing(listing, buyer) {
    if (!listing || !buyer) throw new Error('Invalid listing or buyer details.');
    var base = Number(listing.price || 0);
    var commission = base * 0.05;
    var transport = 5000;
    var finalValue = base + commission + transport;
    var numericId = nextOrderNumber();
    return {
      id: 'ECX' + String(numericId).padStart(4, '0'),
      orderCode: 'ECX' + String(numericId).padStart(4, '0'),
      listingId: listing.id,
      sellerId: listing.sellerId,
      sellerIndustry: listing.sellerIndustry,
      buyerId: buyer.id,
      buyerIndustry: buyer.industryName,
      wasteType: listing.wasteType,
      quantity: Number(listing.quantity || 0),
      unit: listing.unit || 'kg',
      location: listing.location || '',
      basePrice: base,
      buyerCommission: commission,
      transportCharge: transport,
      finalAmount: finalValue,
      finalPrice: finalValue,
      status: 'PENDING',
      createdAt: new Date().toISOString()
    };
  }
  function createFromListing(listing, buyer) {
    if (!listing) throw new Error('This material is no longer available.');
    if (findPendingForBuyer(listing.id, buyer.id)) throw new Error('This order has already been submitted.');
    var order = buildFromListing(listing, buyer);
    save(order);
    return order;
  }
  function save(order) { var orders = all(); orders.unshift(order); EcoAuth.write('ecoexchange_orders', orders); return order; }
  function update(id, changes) { var orders = all().map(function (order) { return order.id === id ? Object.assign({}, order, changes, { updatedAt: new Date().toISOString() }) : order; }); EcoAuth.write('ecoexchange_orders', orders); return orders.find(function (order) { return order.id === id; }); }
  function timeline(status) { var current = statuses.indexOf(status); return labels.map(function (label, index) { return { label: label, done: index <= current }; }); }
  function badge(status) { var tone = status === 'COMPLETED' ? '' : (status === 'CANCELLED' ? 'red' : 'amber'); return '<span class="badge ' + tone + '">' + status.replaceAll('_', ' ') + '</span>'; }
  window.EcoOrders = { statuses: statuses, labels: labels, all: all, nextOrderId: nextOrderId, findPendingForBuyer: findPendingForBuyer, buildFromListing: buildFromListing, createFromListing: createFromListing, save: save, update: update, timeline: timeline, badge: badge };
}());
