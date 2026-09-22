const test = require('node:test');
const assert = require('node:assert/strict');

const moderation = require('../client/js/seller-moderation.js');

test('rating summary calculates average and review count', () => {
  const summary = moderation.calculateSellerSummary([
    { rating: 5 },
    { rating: 4 },
    { rating: 5 },
    { rating: 3 }
  ]);

  assert.equal(summary.averageRating, 4.25);
  assert.equal(summary.reviewCount, 4);
  assert.equal(summary.completedOrders, 4);
});

test('duplicate material review validation rejects a second review by the same user', () => {
  const validation = moderation.validateRatingSubmission({
    listingId: 'LIST-1',
    userId: 'USER-1',
    sellerId: 'SELL-1',
    rating: 5,
    review: 'Great material',
    existingRatings: [{ listingId: 'LIST-1', userId: 'USER-1' }]
  });

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.includes('already reviewed')));
});

test('seller report validation keeps required fields', () => {
  const result = moderation.validateSellerReport({
    sellerId: 'SELL-1',
    reportedBy: 'BUY-1',
    reason: 'Fake seller',
    description: 'Suspicious listing',
    orderId: 'ORD-1'
  });

  assert.equal(result.valid, true);
  assert.equal(result.report.status, 'PENDING');
});

test('users can review a material without a purchase', () => {
  const validation = moderation.validateRatingSubmission({
    userId: 'USER-2',
    sellerId: 'SELL-2',
    listingId: 'LIST-2',
    rating: 4,
    review: 'Material matched the listing.',
    existingRatings: []
  });

  assert.equal(validation.valid, true);
  assert.equal(validation.errors.length, 0);
});
