import express from 'express';
import {
  getCustomerLoyaltySummary,
  hydrateWalletFromFirestore,
  claimDailyLoginReward,
  claimSocialFollowReward,
  revokeSocialFollowReward,
  awardReviewReward,
  claimNewUserWelcomeBonus,
  getPlatformRewardsLiabilityReport,
  processPointsExpirationCleanup,
  loyaltyConfig,
} from './loyaltyService.ts';
import { requireAdminAuth, resolveCallerIdentity } from './adminAuth.ts';

const router = express.Router();

/**
 * 0. POST /api/loyalty/register-bonus
 * Validates verified phone and IP rate limit via Firestore transaction.
 * Strictly ignores client attempts to self-mark `firstOrderCompleted` (welcome bonus unlocks only via completed order).
 */
router.post('/register-bonus', async (req, res) => {
  try {
    const { customerId, customerName } = req.body || {};
    if (!customerId || typeof customerId !== 'string') {
      return res.status(400).json({ success: false, error: 'customerId (verified phone) is required' });
    }

    const clientIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      '127.0.0.1';

    // Never trust client-claimed firstOrderCompleted flag over HTTP!
    const result = await claimNewUserWelcomeBonus(
      customerId,
      typeof customerName === 'string' ? customerName.slice(0, 120) : undefined,
      clientIp,
      false
    );

    if (result.rateLimited) {
      return res.status(429).json(result);
    }

    return res.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: errorMsg });
  }
});

/**
 * 1. GET /api/loyalty/wallet/:customerId
 */
router.get('/wallet/:customerId', async (req, res) => {
  const { customerId } = req.params;
  if (!customerId) {
    return res.status(400).json({ success: false, error: 'customerId مطلوب' });
  }

  const caller = await resolveCallerIdentity(req);
  const isAdmin =
    caller.role === 'super_admin' || caller.role === 'ops_admin' || caller.role === 'founder_admin';
  const headerCid =
    typeof req.headers['x-customer-id'] === 'string' ? req.headers['x-customer-id'].trim() : '';

  if (caller.authenticated && caller.role === 'customer' && caller.uid && !isAdmin) {
    if (customerId !== caller.uid && customerId !== headerCid && !customerId.startsWith('+')) {
      return res.status(403).json({ success: false, error: 'Forbidden: لا يمكنك استعراض محفظة عميل آخر' });
    }
  }

  await hydrateWalletFromFirestore(customerId);
  const summary = getCustomerLoyaltySummary(customerId);
  return res.json({ success: true, ...summary });
});

/**
 * 2. POST /api/loyalty/daily-login
 */
router.post('/daily-login', async (req, res) => {
  const { customerId } = req.body || {};
  if (!customerId || typeof customerId !== 'string') {
    return res.status(400).json({ success: false, error: 'customerId مطلوب' });
  }

  await hydrateWalletFromFirestore(customerId);
  const result = claimDailyLoginReward(customerId);
  return res.json(result);
});

/**
 * 2b. POST /api/loyalty/social-follow
 * Awards 5 points per followed official Flaster platform (5 platforms max).
 */
router.post('/social-follow', async (req, res) => {
  const { customerId, pageId, handle } = req.body || {};
  if (!customerId || typeof customerId !== 'string' || !pageId || typeof pageId !== 'string') {
    return res.status(400).json({ success: false, error: 'customerId و pageId مطلوبان' });
  }

  await hydrateWalletFromFirestore(customerId);
  const result = claimSocialFollowReward(
    customerId,
    pageId,
    typeof handle === 'string' ? handle : undefined
  );
  return res.json(result);
});

/**
 * 2c. POST /api/loyalty/admin/revoke-social-follow (Admin only)
 * Deducts 5 points if customer unfollowed the platform.
 */
router.post('/admin/revoke-social-follow', requireAdminAuth, async (req, res) => {
  const { customerId, pageId } = req.body || {};
  if (!customerId || typeof customerId !== 'string' || !pageId || typeof pageId !== 'string') {
    return res.status(400).json({ success: false, error: 'customerId و pageId مطلوبان' });
  }
  await hydrateWalletFromFirestore(customerId);
  const result = revokeSocialFollowReward(customerId, pageId);
  return res.json(result);
});

/**
 * 3. POST /api/loyalty/review
 */
router.post('/review', (req, res) => {
  const { customerId, orderId, rating, comment } = req.body || {};
  if (
    !customerId ||
    !orderId ||
    typeof rating !== 'number' ||
    !Number.isInteger(rating) ||
    rating < 1 ||
    rating > 5
  ) {
    return res.status(400).json({
      success: false,
      error: 'customerId, orderId, و rating (عدد صحيح بين 1 و 5) مطلوبة',
    });
  }

  const result = awardReviewReward({
    customerId: String(customerId),
    orderId: String(orderId),
    rating,
    comment: typeof comment === 'string' ? comment.slice(0, 500) : undefined,
  });
  return res.json(result);
});

/**
 * 4. POST /api/loyalty/redeem
 * Point redemption is only executed atomically during checkout inside POST /api/orders/create
 * (or by verified Admin), preventing unauthenticated arbitrary point draining/tampering.
 */
router.post('/redeem', requireAdminAuth, (_req, res) => {
  return res.status(400).json({
    success: false,
    error: 'يتم خصم واستبدال النقاط حصرياً وبشكل ذري عبر نقطة إنشاء الطلب /api/orders/create.',
  });
});

/**
 * 5. GET /api/loyalty/admin/report (Admin only)
 */
router.get('/admin/report', requireAdminAuth, (_req, res) => {
  const report = getPlatformRewardsLiabilityReport();
  return res.json({ success: true, report });
});

/**
 * 6. POST /api/loyalty/admin/config (Admin only)
 */
router.post('/admin/config', requireAdminAuth, (req, res) => {
  const {
    dailyLoginPoints,
    purchaseRewardPoints,
    reviewRewardPoints,
    pointsPerAed,
    expirationDays,
    minRedemptionPoints,
    maxRedemptionPointsPerOrder,
  } = req.body || {};

  const validatePositiveInt = (v: unknown, min: number, max: number) =>
    typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

  if (dailyLoginPoints !== undefined) {
    if (!validatePositiveInt(dailyLoginPoints, 0, 100)) {
      return res.status(400).json({ success: false, error: 'dailyLoginPoints invalid (0-100)' });
    }
    loyaltyConfig.dailyLoginPoints = dailyLoginPoints;
  }
  if (purchaseRewardPoints !== undefined) {
    if (!validatePositiveInt(purchaseRewardPoints, 0, 500)) {
      return res.status(400).json({ success: false, error: 'purchaseRewardPoints invalid (0-500)' });
    }
    loyaltyConfig.purchaseRewardPoints = purchaseRewardPoints;
  }
  if (reviewRewardPoints !== undefined) {
    if (!validatePositiveInt(reviewRewardPoints, 0, 500)) {
      return res.status(400).json({ success: false, error: 'reviewRewardPoints invalid (0-500)' });
    }
    loyaltyConfig.reviewRewardPoints = reviewRewardPoints;
  }
  if (pointsPerAed !== undefined) {
    if (!validatePositiveInt(pointsPerAed, 10, 1000)) {
      return res.status(400).json({ success: false, error: 'pointsPerAed invalid (10-1000)' });
    }
    loyaltyConfig.pointsPerAed = pointsPerAed;
  }
  if (expirationDays !== undefined) {
    if (!validatePositiveInt(expirationDays, 30, 730)) {
      return res.status(400).json({ success: false, error: 'expirationDays invalid (30-730)' });
    }
    loyaltyConfig.expirationDays = expirationDays;
  }
  if (minRedemptionPoints !== undefined) {
    if (!validatePositiveInt(minRedemptionPoints, 1, 5000)) {
      return res.status(400).json({ success: false, error: 'minRedemptionPoints invalid (1-5000)' });
    }
    loyaltyConfig.minRedemptionPoints = minRedemptionPoints;
  }
  if (maxRedemptionPointsPerOrder !== undefined) {
    if (!validatePositiveInt(maxRedemptionPointsPerOrder, 100, 50000)) {
      return res.status(400).json({ success: false, error: 'maxRedemptionPointsPerOrder invalid (100-50000)' });
    }
    loyaltyConfig.maxRedemptionPointsPerOrder = maxRedemptionPointsPerOrder;
  }

  return res.json({
    success: true,
    message: 'تم تحديث إعدادات نظام نقاط الولاء بنجاح',
    config: loyaltyConfig,
  });
});

/**
 * 7. POST /api/loyalty/admin/cleanup-expired (Admin only)
 */
router.post('/admin/cleanup-expired', requireAdminAuth, (req, res) => {
  const { customerId } = req.body || {};
  const result = processPointsExpirationCleanup(
    typeof customerId === 'string' ? customerId : undefined
  );
  return res.json({ success: true, result });
});

export default router;
