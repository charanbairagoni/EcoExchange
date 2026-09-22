(function () {
  var types = ['Metal Scrap', 'Plastic Waste', 'Paper Waste', 'Glass Waste', 'Textile Waste', 'Electronic Waste', 'Organic Waste', 'Chemical By-products', 'Fly Ash', 'Construction Waste', 'Other'];
  function blank() { return { wasteType: types[0], quantity: '', unit: 'kg', price: '', location: '', description: '', imageUrl: '' }; }
  function save(form, user) {
    if (!user || (user.role !== 'USER' && user.role !== 'ADMIN')) throw new Error('Seller details are missing.');
    if (user.role !== 'ADMIN' && (user.status === 'SUSPENDED' || user.status === 'REMOVED')) throw new Error('Your seller account has been suspended by the administrator.');
    var listings = EcoAuth.read('ecoexchange_listings', []);
    var listing = Object.assign({ id: 'LIST-' + Date.now(), sellerId: user.id, sellerIndustry: user.industryName, availability: 'Available', status: 'LISTED', createdAt: new Date().toISOString() }, form, { quantity: Number(form.quantity), price: Number(form.price) });
    listings.unshift(listing); EcoAuth.write('ecoexchange_listings', listings); return listing;
  }
  window.EcoSell = { types: types, blank: blank, save: save };
}());
