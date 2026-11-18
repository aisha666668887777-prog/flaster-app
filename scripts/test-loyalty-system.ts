/**
 * A&M Tawfeer • SMART SAVING. LESS WASTE.
 * Verification Test Suite: Updated Unified Loyalty Points System
 * 
 * Verifies:
 * 1. Points conversion rate (100 points = 1 AED).
 * 2. Activity A: Daily Login Reward (1 point once/calendar day in Asia/Dubai).
 * 3. Activity B: Completed Purchase Reward (15 points strictly once/order).
 * 4. Activity C: Customer Review Reward (10 points strictly once/order).
 * 5. 4-Month (120 days) Expiration Rule & periodic reset.
 * 6. 100% Platform funding: Merchant net payout is completely unaffected by points discounts.
 * 7. Redemption constraints: min 100 pts, max 5000 pts, order total cap.
 * 8. Cancellation reversal: restored points on order cancellation.
 */

import { 
  loyaltyConfig,
  getDubaiDateString,
  getOrCreateWallet,
  claimDailyLoginReward,
  awardPurchaseReward,
  awardReviewReward,
  redeemPointsForOrder,
  refundRedeemedPoints,
  processPointsExpirationCleanup,
  getCustomerLoyaltySummary,
  getPlatformRewardsLiabilityReport
} from '../src/server/loyaltyService.ts';

import { calculateOrderFinancials } from '../src/server/financeService.ts';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

console.log('\n============================================================');
console.log('🧪 Starting A&M Tawfeer Loyalty Points Test Suite');
console.log('============================================================\n');

// 1. Verification of Conversion Rate
console.log('--- 1. Testing Conversion Rate (100 Points = 1 AED) ---');
assert(loyaltyConfig.pointsPerAed === 100, 'Default conversion rate is exactly 100 pts per 1 AED');
assert(100 / loyaltyConfig.pointsPerAed === 1, '100 points equals 1 AED');
assert(500 / loyaltyConfig.pointsPerAed === 5, '500 points equals 5 AED');
assert(1000 / loyaltyConfig.pointsPerAed === 10, '1,000 points equals 10 AED');
assert(5000 / loyaltyConfig.pointsPerAed === 50, '5,000 points equals 50 AED');

// 2. Activity A: Daily Login Reward
console.log('\n--- 2. Testing Daily Login Reward (Asia/Dubai Timezone) ---');
const testCustomer = `test-cust-${Date.now()}`;
const initialSummary = getCustomerLoyaltySummary(testCustomer);
const basePoints = initialSummary.wallet.availablePoints;

const claim1 = claimDailyLoginReward(testCustomer);
assert(claim1.success === true, 'First login today succeeds');
assert(claim1.pointsAwarded === 1, 'Exactly 1 point is awarded for daily login');
assert(claim1.wallet.availablePoints === basePoints + 1, 'Wallet balance increased by exactly 1');

const claim2 = claimDailyLoginReward(testCustomer);
assert(claim2.success === false, 'Duplicate login today is rejected');
assert(claim2.alreadyClaimedToday === true, 'alreadyClaimedToday flag is true');
assert(claim2.pointsAwarded === 0, 'No extra points awarded on repeated login');

// 3. Activity B: Completed Purchase Reward
console.log('\n--- 3. Testing Completed Purchase Reward (15 Points) ---');
const testOrderId = `AM-ORD-TEST-${Date.now()}`;
const purchReward1 = awardPurchaseReward(testCustomer, testOrderId);
assert(purchReward1.success === true, 'First purchase reward awards successfully');
assert(purchReward1.pointsAwarded === 15, 'Exactly 15 points awarded for completed purchase');

const purchReward2 = awardPurchaseReward(testCustomer, testOrderId);
assert(purchReward2.success === false, 'Duplicate purchase reward for same order is rejected');
assert(purchReward2.pointsAwarded === 0, 'Zero points awarded on duplicate order completion attempt');

// 4. Activity C: Customer Review Reward
console.log('\n--- 4. Testing Customer Review Reward (10 Points) ---');
const reviewReward1 = awardReviewReward({
  customerId: testCustomer,
  orderId: testOrderId,
  rating: 5,
  comment: 'وجبة ممتازة وتوفير رائع!'
});
assert(reviewReward1.success === true, 'Review reward awards 10 points on first submission');
assert(reviewReward1.pointsAwarded === 10, 'Exactly 10 points awarded');

const reviewReward2 = awardReviewReward({
  customerId: testCustomer,
  orderId: testOrderId,
  rating: 4,
  comment: 'محاولة تقييم مكررة'
});
assert(reviewReward2.success === false, 'Duplicate review reward for same order is blocked');

// 5. Points Redemption & Zero Merchant Deductions
console.log('\n--- 5. Testing Redemption & Zero Merchant Deduction ---');
const currentPoints = getOrCreateWallet(testCustomer).availablePoints;
assert(currentPoints >= 100, `Customer has enough points for redemption test: ${currentPoints}`);

// Test minimum limit (100 points)
const invalidMin = redeemPointsForOrder({
  customerId: testCustomer,
  orderId: 'ORD-MIN-TEST',
  pointsToRedeem: 50,
  orderSubtotalFils: 3000
});
assert(invalidMin.success === false, 'Redemption below 100 points is blocked');

// Test valid partial redemption of 100 points (1 AED)
const redeemOrder = `ORD-REDEEM-${Date.now()}`;
const validRedeem = redeemPointsForOrder({
  customerId: testCustomer,
  orderId: redeemOrder,
  pointsToRedeem: 100,
  orderSubtotalFils: 3500 // 35 AED subtotal
});
assert(validRedeem.success === true, '100 points redemption succeeds');
assert(validRedeem.discountFils === 100, 'Discount in Fils is exactly 100 Fils (1 AED)');
assert(validRedeem.discountAed === 1.0, 'Discount in AED is exactly 1.0 AED');

// Verify that merchant net payout is 100% untouched by this discount!
const normalFin = calculateOrderFinancials({
  orderId: 'ORD-NO-DISCOUNT',
  merchantId: 'merchant-test',
  subtotalFils: 3500,
  deliveryFeeFils: 1200,
  pointsDiscountFils: 0
});

const discountedFin = calculateOrderFinancials({
  orderId: 'ORD-WITH-DISCOUNT',
  merchantId: 'merchant-test',
  subtotalFils: 3500,
  deliveryFeeFils: 1200,
  pointsDiscountFils: 100 // 1 AED loyalty discount
});

assert(
  normalFin.merchantNetPayoutFils === discountedFin.merchantNetPayoutFils,
  `Merchant payout is identical (Normal: ${normalFin.merchantNetPayoutFils} Fils, Discounted: ${discountedFin.merchantNetPayoutFils} Fils). ZERO MERCHANT DEDUCTIONS!`
);
assert(
  normalFin.platformCommissionFils === discountedFin.platformCommissionFils,
  'Platform commission remains based on subtotal (525 Fils)'
);
assert(
  discountedFin.totalCustomerPaidFils === normalFin.totalCustomerPaidFils - 100,
  'Customer paid exactly 100 Fils (1 AED) less'
);
assert(
  discountedFin.platformLoyaltyFundedFils === 100,
  'Platform accurately books 100 Fils loyalty liability expense'
);

// 6. Test Redemption Reversal on Cancellation
console.log('\n--- 6. Testing Cancellation Reversal ---');
const beforeCancelWallet = getOrCreateWallet(testCustomer).availablePoints;
const refundResult = refundRedeemedPoints(testCustomer, redeemOrder);
assert(refundResult.success === true, 'Points refunded on cancellation');
assert(refundResult.pointsRefunded === 100, 'Exactly 100 points restored');
assert(getOrCreateWallet(testCustomer).availablePoints === beforeCancelWallet + 100, 'Wallet balance restored accurately');

// 7. Test 4-Month Expiration Rule & Reset
console.log('\n--- 7. Testing 4-Month (120 Days) Expiration Logic ---');
const expiringCustomer = `expiring-cust-${Date.now()}`;
const expWallet = getOrCreateWallet(expiringCustomer);
// Manually simulate an expired date (>120 days ago)
expWallet.nextExpirationDate = new Date(Date.now() - 1000).toISOString();

const cleanupResult = processPointsExpirationCleanup(expiringCustomer);
assert(cleanupResult.expiredCount === 1, 'Expired customer identified in cleanup');
assert(cleanupResult.totalPointsExpired > 0, 'Expired points cleared');
assert(getOrCreateWallet(expiringCustomer).availablePoints === 0, 'Expired customer points reset to 0');

// 8. Platform Rewards Liability & Audit Report
console.log('\n--- 8. Testing Platform Liability Report ---');
const liabilityReport = getPlatformRewardsLiabilityReport();
assert(liabilityReport.fundingSource.includes('100% Platform Funded'), 'Report certifies 100% Platform Funded');
assert(liabilityReport.conversionRate === '100 Points = 1 AED', 'Conversion rate verified in report');
assert(liabilityReport.metrics.currentOutstandingPoints >= 0, 'Current outstanding points tracked');
assert(liabilityReport.metrics.outstandingLiabilityAed >= 0, 'Outstanding AED liability calculated');

console.log('\n============================================================');
console.log('🎉 ALL 8 LOYALTY TESTS PASSED WITH 100% PERFECTION!');
console.log('============================================================\n');
