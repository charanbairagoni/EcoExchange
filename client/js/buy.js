(function () {
  var fallbackImages = {
    'Metal Scrap': 'https://images.unsplash.com/photo-1581092160607-ee2279d0d3a8?auto=format&fit=crop&w=900&q=80',
    'Plastic Waste': 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=900&q=80',
    'Plastic Scrap': 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?auto=format&fit=crop&w=900&q=80',
    'Fly Ash': 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=900&q=80'
  };
  function image(listing) { return listing.imageUrl || fallbackImages[listing.wasteType] || fallbackImages['Metal Scrap']; }
  function listings() { return EcoAuth.read('ecoexchange_listings', []); }
  function find(id) { return listings().find(function (item) { return item.id === id; }); }
  function totals(listing) { var commission = listing.price * .05; return { base: listing.price, commission: commission, transport: 5000, final: listing.price + commission + 5000 }; }
  window.EcoBuy = { image: image, listings: listings, find: find, totals: totals };
}());
