(function (root) {
  function storage() {
    if (root && root.localStorage && root.localStorage.getItem) return root.localStorage;
    if (!root.__ecoStorage) root.__ecoStorage = {};
    return {
      getItem: function (key) { return Object.prototype.hasOwnProperty.call(root.__ecoStorage, key) ? String(root.__ecoStorage[key]) : null; },
      setItem: function (key, value) { root.__ecoStorage[key] = String(value); },
      removeItem: function (key) { delete root.__ecoStorage[key]; }
    };
  }

  function read(key, fallback) {
    try {
      var raw = storage().getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      return fallback;
    }
  }

  function write(key, value) {
    storage().setItem(key, JSON.stringify(value));
  }

  function allUsers() {
    return read('ecoexchange_users', []);
  }

  function setUsers(users) {
    write('ecoexchange_users', users);
  }

  function getRatings() {
    return read('ecoexchange_seller_ratings', []);
  }

  function getReports() {
    return read('ecoexchange_seller_reports', []);
  }

  function getAuditLogs() {
    return read('ecoexchange_seller_audit_logs', []);
  }

  function averageRating(list) {
    if (!list || !list.length) return 0;
    var total = list.reduce(function (sum, item) { return sum + Number(item.rating || 0); }, 0);
    return Number((total / list.length).toFixed(2));
  }

  function makeStars(value) {
    var score = Number(value || 0);
    var whole = Math.max(0, Math.min(5, Math.round(score)));
    return Array.from({ length: 5 }, function (_, index) { return index < whole ? '★' : '☆'; }).join('');
  }

  function calculateSellerSummary(sellerIdOrRatings, maybeSellerId) {
    var sellerId = maybeSellerId || null;
    var ratings = Array.isArray(sellerIdOrRatings) ? sellerIdOrRatings : getRatings().filter(function (rating) { return rating.sellerId === (sellerIdOrRatings || sellerId); });
    var orderList = sellerId ? (root.EcoOrders ? root.EcoOrders.all().filter(function (order) { return order.sellerId === sellerId; }) : []) : [];
    if (!sellerId && Array.isArray(sellerIdOrRatings) && sellerIdOrRatings.length && sellerIdOrRatings[0] && Array.isArray(sellerIdOrRatings[0].completedOrders)) {
      orderList = sellerIdOrRatings[0].completedOrders;
    }
    var average = averageRating(ratings);
    var completedOrders = (!sellerId && Array.isArray(sellerIdOrRatings)) ? ratings.length : (orderList && orderList.filter ? orderList.filter(function (order) { return order.status === 'COMPLETED'; }).length : ratings.length);
    return {
      averageRating: average,
      reviewCount: ratings.length,
      totalOrders: orderList && orderList.length ? orderList.length : ratings.length,
      completedOrders: completedOrders,
      successfulTransactions: completedOrders,
      ratings: ratings,
      averageRatingDisplay: average > 0 ? average.toFixed(1) : '0.0'
    };
  }

  function calculateListingRating(listingId) {
    var ratings = getRatings().filter(function (rating) { return String(rating.listingId) === String(listingId); });
    var average = averageRating(ratings);
    return {
      averageRating: average,
      reviewCount: ratings.length,
      reviews: ratings,
      averageText: ratings.length ? (makeStars(average) + ' ' + average.toFixed(1)) : 'No ratings yet',
      reviewLabel: ratings.length === 0 ? 'No ratings yet' : 'Based on ' + ratings.length + ' ratings'
    };
  }

  function getListingRatings(listingId) {
    return getRatings().filter(function (rating) { return String(rating.listingId) === String(listingId); });
  }

  function getRecentReviewsForListing(listingId, limit) {
    return getListingRatings(listingId).slice(0, limit || 3);
  }

  function validateRatingSubmission(payload) {
    var errors = [];
    if (!payload || !payload.listingId) errors.push('A valid material is required before rating.');
    if (!payload || !payload.userId) errors.push('User information is missing.');
    if (!payload || !payload.rating && payload.rating !== 0) errors.push('Rating is required.');
    if (payload && (Number(payload.rating) < 1 || Number(payload.rating) > 5)) errors.push('Rating must be between 1 and 5.');
    if (payload && (!payload.review || !String(payload.review).trim())) errors.push('A review is required.');

    if (payload) {
      var existingList = Array.isArray(payload.existingRatings) ? payload.existingRatings : (getRatings() || []);
      var duplicate = existingList.find(function (item) { return String(item.listingId) === String(payload.listingId) && String(item.userId || item.buyerId) === String(payload.userId); });
      if (duplicate && !payload.id) errors.push('You have already reviewed this material.');
    }

    return { valid: errors.length === 0, errors: errors };
  }

  function createRating(payload) {
    var validation = validateRatingSubmission(payload);
    if (!validation.valid) throw new Error(validation.errors.join(' '));

    var rating = {
      id: payload.id || 'RAT-' + Date.now(),
      listingId: payload.listingId,
      sellerId: payload.sellerId,
      userId: payload.userId,
      userName: payload.userName || payload.ratedBy || payload.userId,
      rating: Number(payload.rating),
      review: String(payload.review || '').trim(),
      wasteType: payload.wasteType || '',
      createdAt: payload.createdAt || new Date().toISOString()
    };

    var list = getRatings();
    list.unshift(rating);
    write('ecoexchange_seller_ratings', list);
    return rating;
  }

  function updateRating(payload) {
    var validation = validateRatingSubmission(payload);
    if (!validation.valid) throw new Error(validation.errors.join(' '));
    var updated = Object.assign({}, getRatings().find(function (rating) { return rating.id === payload.id; }), {
      listingId: payload.listingId,
      sellerId: payload.sellerId,
      userId: payload.userId,
      userName: payload.userName || payload.userId,
      rating: Number(payload.rating),
      review: String(payload.review).trim(),
      wasteType: payload.wasteType || '',
      updatedAt: new Date().toISOString()
    });
    write('ecoexchange_seller_ratings', getRatings().map(function (rating) { return rating.id === payload.id ? updated : rating; }));
    return updated;
  }

  function getUserRating(listingId, userId) {
    return getRatings().find(function (rating) { return String(rating.listingId) === String(listingId) && String(rating.userId || rating.buyerId) === String(userId); }) || null;
  }

  function removeRating(ratingId) {
    var ratings = getRatings();
    var removed = ratings.find(function (rating) { return rating.id === ratingId; });
    write('ecoexchange_seller_ratings', ratings.filter(function (rating) { return rating.id !== ratingId; }));
    return removed || null;
  }

  function validateSellerReport(data) {
    var errors = [];
    if (!data || !data.sellerId) errors.push('Seller is required.');
    if (!data || !data.reportedBy) errors.push('Reporting buyer is required.');
    if (!data || !data.reason) errors.push('Reason is required.');
    if (!data || !data.description || !String(data.description).trim()) errors.push('Description is required.');

    if (!errors.length) {
      var report = {
        id: data.id || 'REP-' + Date.now(),
        sellerId: data.sellerId,
        reportedBy: data.reportedBy,
        orderId: data.orderId || '',
        reason: data.reason,
        description: String(data.description).trim(),
        status: 'PENDING',
        createdAt: data.createdAt || new Date().toISOString(),
        updatedAt: data.createdAt || new Date().toISOString()
      };
      return { valid: true, report: report, errors: [] };
    }

    return { valid: false, errors: errors };
  }

  function submitReport(data) {
    var validation = validateSellerReport(data);
    if (!validation.valid) throw new Error(validation.errors.join(' '));
    var reports = getReports();
    reports.unshift(validation.report);
    write('ecoexchange_seller_reports', reports);
    return validation.report;
  }

  function appendAuditLog(action, sellerId, adminId, reason) {
    var logs = getAuditLogs();
    logs.unshift({
      id: 'AUD-' + Date.now(),
      action: action,
      sellerId: sellerId || '',
      admin: adminId || 'ADMIN',
      reason: reason || '',
      date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
      createdAt: new Date().toISOString()
    });
    write('ecoexchange_seller_audit_logs', logs);
    return logs[0];
  }

  function updateReport(id, status, adminId) {
    var reports = getReports().map(function (report) {
      if (report.id !== id) return report;
      return Object.assign({}, report, { status: status, updatedAt: new Date().toISOString() });
    });
    write('ecoexchange_seller_reports', reports);
    var selected = reports.find(function (report) { return report.id === id; });
    if (selected) {
      if (status === 'REVIEWED') appendAuditLog('SELLER_REPORT_REVIEWED', selected.sellerId, adminId, 'Seller report reviewed by admin');
      if (status === 'DISMISSED') appendAuditLog('SELLER_REPORT_DISMISSED', selected.sellerId, adminId, 'Seller report dismissed');
    }
    return selected;
  }

  function sellerStatus(user) {
    if (!user) return 'ACTIVE';
    return user.status || 'ACTIVE';
  }

  function canCreateListing(user) {
    return !!user && (user.role === 'USER' || user.role === 'seller' || user.role === 'INDUSTRY') && sellerStatus(user) === 'ACTIVE';
  }

  function suspendSeller(sellerId, adminId, reason) {
    var users = allUsers().map(function (user) {
      return user.id === sellerId ? Object.assign({}, user, { status: 'SUSPENDED' }) : user;
    });
    setUsers(users);
    appendAuditLog('SELLER_SUSPENDED', sellerId, adminId, reason || 'Seller suspended by administrator');
    return users.find(function (user) { return user.id === sellerId; });
  }

  function reactivateSeller(sellerId, adminId, reason) {
    var users = allUsers().map(function (user) {
      return user.id === sellerId ? Object.assign({}, user, { status: 'ACTIVE' }) : user;
    });
    setUsers(users);
    appendAuditLog('SELLER_REACTIVATED', sellerId, adminId, reason || 'Seller reactivated by administrator');
    return users.find(function (user) { return user.id === sellerId; });
  }

  function removeSeller(sellerId, adminId, reason) {
    var users = allUsers().map(function (user) {
      return user.id === sellerId ? Object.assign({}, user, { status: 'REMOVED' }) : user;
    });
    setUsers(users);
    appendAuditLog('SELLER_REMOVED', sellerId, adminId, reason || 'Seller removed by administrator');
    return users.find(function (user) { return user.id === sellerId; });
  }

  function seedInitialData() {
    if (!read('ecoexchange_seller_ratings', null)) write('ecoexchange_seller_ratings', []);
    if (!read('ecoexchange_seller_reports', null)) write('ecoexchange_seller_reports', []);
    if (!read('ecoexchange_seller_audit_logs', null)) write('ecoexchange_seller_audit_logs', []);
    var users = allUsers().map(function (user) {
      if (user && user.role !== 'ADMIN' && !user.status) user.status = 'ACTIVE';
      return user;
    });
    if (users.length) setUsers(users);
  }

  var api = {
    read: read,
    write: write,
    getRatings: getRatings,
    getReports: getReports,
    getAuditLogs: getAuditLogs,
    calculateSellerSummary: calculateSellerSummary,
    calculateListingRating: calculateListingRating,
    getListingRatings: getListingRatings,
    getRecentReviewsForListing: getRecentReviewsForListing,
    validateRatingSubmission: validateRatingSubmission,
    createRating: createRating,
    updateRating: updateRating,
    getUserRating: getUserRating,
    removeRating: removeRating,
    validateSellerReport: validateSellerReport,
    submitReport: submitReport,
    updateReport: updateReport,
    appendAuditLog: appendAuditLog,
    suspendSeller: suspendSeller,
    reactivateSeller: reactivateSeller,
    removeSeller: removeSeller,
    canCreateListing: canCreateListing,
    sellerStatus: sellerStatus,
    seedInitialData: seedInitialData,
    makeStars: makeStars,
    averageRating: averageRating,
    allUsers: allUsers,
    setUsers: setUsers
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.EcoSellerModeration = api;
}(typeof globalThis !== 'undefined' ? globalThis : this));
