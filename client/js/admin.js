(function () {
  var companies = [
    { id: 'LOG-1', name: 'ABC Logistics', area: 'Pune, Mumbai' },
    { id: 'LOG-2', name: 'GreenMove Transport', area: 'Bengaluru, Chennai' },
    { id: 'LOG-3', name: 'EcoCargo', area: 'Hyderabad, Nagpur' }
  ];
  function requests() { return EcoAuth.read('ecoexchange_logistics', []); }
  function forward(order, companyId) {
    var company = companies.find(function (item) { return item.id === companyId; });
    var request = { id: 'REQ-' + Date.now(), orderId: order.id, companyId: company.id, companyName: company.name, status: 'ASSIGNED', createdAt: new Date().toISOString() };
    var list = requests(); list.unshift(request); EcoAuth.write('ecoexchange_logistics', list); EcoOrders.update(order.id, { status: 'FORWARDED_TO_LOGISTICS', logisticsCompany: company.name }); return request;
  }
  function updateRequest(id, status) {
    var request = requests().find(function (item) { return item.id === id; });
    if (!request) return null;
    var updated = requests().map(function (item) { return item.id === id ? Object.assign({}, item, { status: status, updatedAt: new Date().toISOString() }) : item; });
    EcoAuth.write('ecoexchange_logistics', updated);
    var linkedStatus = { PICKED_UP: 'PICKUP_SCHEDULED', IN_TRANSIT: 'IN_TRANSIT', DELIVERED: 'DELIVERED', COMPLETED: 'COMPLETED' }[status];
    if (linkedStatus) EcoOrders.update(request.orderId, { status: linkedStatus });
    return request;
  }
  function overview() {
    var orders = EcoOrders.all(), users = EcoAuth.users(), listings = EcoBuy.listings();
    var industryNames = users.map(function (item) { return item.industryName; }).concat(listings.map(function (item) { return item.sellerIndustry; }));
    return { totalOrders: orders.length, pending: orders.filter(function (o) { return ['ORDER_PLACED', 'ADMIN_REVIEW'].includes(o.status); }).length, forwarded: orders.filter(function (o) { return o.status === 'FORWARDED_TO_LOGISTICS'; }).length, completed: orders.filter(function (o) { return o.status === 'COMPLETED'; }).length, waste: listings.length, industries: [...new Set(industryNames)].length };
  }
  window.EcoAdmin = { companies: companies, requests: requests, forward: forward, updateRequest: updateRequest, overview: overview };
}());
