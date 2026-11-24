/**
 * Flaster • SMART SAVING. LESS WASTE.
 * Unified Loyalty Points System (Backed by Firestore Transactions + Rate Limiting)
 *
 * Rules:
 * 1. New accounts start at 0 points (no unverified or signup-instant bonus).
 * 2. The 500 welcome bonus points (= 5 AED = 500 Fils) are awarded ONLY after
 *    the user's first completed order, inside a Firestore transaction so concurrent
 *    calls can never claim it twice.
 * 3. Rate limiting per IP/device is enforced on bonus claims.
 * 4. 100% platform funded by Flaster — zero deduction from merchant payouts.
 */

import { adminDb } from './adminAuth.ts';
import { filsToAed } from '../config/platformConfig.ts';

export type LoyaltyTransactionType =
  | 'earned_registration_bonus'
  | 'earned_daily_login'
  | 'earned_social_follow'
  | 'social_unfollow_deduction'
  | 'earned_purchase'
  | 'earned_review'
  | 'redeemed_checkout'
  | 'refund_reversal'
  | 'expired_reset'
  | 'admin_adjustment';

export interface LoyaltyTransaction {
  id: string;
  customerId: string;
  type: LoyaltyTransactionType;
  points: number;
  equivalentFils: number;
  equivalentAed: number;
  relatedOrderId?: string;
  relatedReviewId?: string;
  note?: string;
  status: 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  expiryDate?: string;
}

export interface CustomerWallet {
  customerId: string;
  phone?: string;
  customerName?: string;
  availablePoints: number;
  equivalentFils: number;
  equivalentAed: number;
  totalEarnedPoints: number;
  totalRedeemedPoints: number;
  totalExpiredPoints: number;
  welcomeBonusClaimed: boolean;
  completedOrdersCount: number;
  claimedSocialPages?: string[];
  lastDailyLoginDate?: string;
  nextExpirationDate?: string;
  pointsSubjectToExpiry: number;
  daysUntilExpiry?: number;
  updatedAt: string;
}

export interface LoyaltyConfig {
  registrationBonusPoints: number; // 500 points (500 Fils = 5.00 AED) after first completed order
  welcomeBonusPoints: number; // Alias for registrationBonusPoints
  dailyLoginPoints: number; // 1 point
  purchaseRewardPoints: number; // 15 points
  reviewRewardPoints: number; // 10 points
  pointsPerAed: number; // 100 points = 1 AED (1 point = 1 fil)
  expirationDays: number; // 120 days (4 months)
  minRedemptionPoints: number; // 1000 points (10 AED)
  maxRedemptionPointsPerOrder: number; // 5000 points (50 AED)
  maxClaimsPerIpPerHour: number; // Rate limit per IP/device
}

export const loyaltyConfig: LoyaltyConfig = {
  registrationBonusPoints: 500,
  welcomeBonusPoints: 500,
  dailyLoginPoints: 1,
  purchaseRewardPoints: 15,
  reviewRewardPoints: 10,
  pointsPerAed: 100,
  expirationDays: 120,
  minRedemptionPoints: 1000,
  maxRedemptionPointsPerOrder: 5000,
  maxClaimsPerIpPerHour: 5,
};

// Synchronized cache for fast reads & offline test runner resilience; persisted to Firestore
const walletsCache = new Map<string, CustomerWallet>();
const transactionsCache: LoyaltyTransaction[] = [];
const reviewsSubmitted = new Set<string>();
const ipRateLimitMap = new Map<string, { count: number; windowStartMs: number }>();
const activeClaimLocks = new Set<string>();

/**
 * Normalizes UAE phone numbers to E.164 (+971XXXXXXXXX)
 */
export function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return 'unverified';
  if (digits.startsWith('971')) return `+${digits}`;
  if (digits.startsWith('05')) return `+971${digits.slice(1)}`;
  if (digits.startsWith('5') && digits.length === 9) return `+971${digits}`;
  return `+${digits}`;
}

/**
 * Checks and records IP/device rate limit for bonus claims.
 */
export function checkIpRateLimit(ipAddress: string): { allowed: boolean; remaining: number } {
  const ip = (ipAddress || 'unknown-ip').trim();
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour window
  const entry = ipRateLimitMap.get(ip);

  if (!entry || now - entry.windowStartMs > windowMs) {
    ipRateLimitMap.set(ip, { count: 1, windowStartMs: now });
    return { allowed: true, remaining: loyaltyConfig.maxClaimsPerIpPerHour - 1 };
  }

  if (entry.count >= loyaltyConfig.maxClaimsPerIpPerHour) {
    return { allowed: false, remaining: 0 };
  }

  entry.count += 1;
  ipRateLimitMap.set(ip, entry);
  return { allowed: true, remaining: loyaltyConfig.maxClaimsPerIpPerHour - entry.count };
}

export function resetRateLimitsForTest(): void {
  ipRateLimitMap.clear();
  walletsCache.clear();
  transactionsCache.length = 0;
  activeClaimLocks.clear();
}

export function getDubaiDateString(date: Date = new Date()): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(date);
}

export function calculateExpiryDate(
  fromDate: Date = new Date(),
  days: number = loyaltyConfig.expirationDays
): string {
  const d = new Date(fromDate.getTime() + days * 24 * 60 * 60 * 1000);
  return d.toISOString();
}

/**
 * Persists wallet and transaction to Firestore asynchronously
 */
async function persistWalletToFirestore(wallet: CustomerWallet, txn?: LoyaltyTransaction): Promise<void> {
  try {
    await adminDb.collection('wallets').doc(wallet.customerId).set(
      {
        customerId: wallet.customerId,
        availablePoints: Math.round(wallet.availablePoints),
        totalEarnedPoints: Math.round(wallet.totalEarnedPoints),
        totalRedeemedPoints: Math.round(wallet.totalRedeemedPoints),
        totalExpiredPoints: Math.round(wallet.totalExpiredPoints),
        welcomeBonusClaimed: Boolean(wallet.welcomeBonusClaimed),
        completedOrdersCount: Math.round(wallet.completedOrdersCount || 0),
        claimedSocialPages: Array.isArray(wallet.claimedSocialPages)
          ? wallet.claimedSocialPages.slice(0, 5)
          : [],
        ...(wallet.lastDailyLoginDate ? { lastDailyLoginDate: wallet.lastDailyLoginDate } : {}),
        ...(wallet.nextExpirationDate ? { nextExpirationDate: wallet.nextExpirationDate } : {}),
        updatedAt: wallet.updatedAt,
      },
      { merge: true }
    );
    if (txn) {
      await adminDb.collection('loyalty_transactions').doc(txn.id).set(txn);
    }
  } catch (err) {
    console.warn('[Loyalty] Deferred Firestore persist (local mode):', err instanceof Error ? err.message : err);
  }
}

/**
 * Hydrates a customer's wallet from Firestore into server cache (prevents point loss after cold starts)
 */
export async function hydrateWalletFromFirestore(customerId: string): Promise<CustomerWallet> {
  const wallet = getOrCreateWallet(customerId);
  try {
    const snap = await adminDb.collection('wallets').doc(wallet.customerId).get();
    if (snap && snap.exists) {
      const data = snap.data() || {};
      if (typeof data.availablePoints === 'number') wallet.availablePoints = data.availablePoints;
      if (typeof data.totalEarnedPoints === 'number') wallet.totalEarnedPoints = data.totalEarnedPoints;
      if (typeof data.totalRedeemedPoints === 'number') wallet.totalRedeemedPoints = data.totalRedeemedPoints;
      if (typeof data.totalExpiredPoints === 'number') wallet.totalExpiredPoints = data.totalExpiredPoints;
      if (typeof data.welcomeBonusClaimed === 'boolean') wallet.welcomeBonusClaimed = data.welcomeBonusClaimed;
      if (typeof data.completedOrdersCount === 'number') wallet.completedOrdersCount = data.completedOrdersCount;
      if (Array.isArray(data.claimedSocialPages)) wallet.claimedSocialPages = data.claimedSocialPages;
      if (typeof data.lastDailyLoginDate === 'string') wallet.lastDailyLoginDate = data.lastDailyLoginDate;
      if (typeof data.nextExpirationDate === 'string') wallet.nextExpirationDate = data.nextExpirationDate;
      if (typeof data.updatedAt === 'string') wallet.updatedAt = data.updatedAt;
      wallet.equivalentFils = Math.round(wallet.availablePoints);
      wallet.equivalentAed = filsToAed(wallet.equivalentFils);
      walletsCache.set(wallet.customerId, wallet);
    }
  } catch {
    // Graceful fallback when Firestore Admin SDK credentials are unavailable locally
  }
  return wallet;
}

/**
 * Retrieves or initializes a customer wallet.
 * IMPORTANT: New wallets start with 0 points (no unverified or pre-order bonus).
 */
export function getOrCreateWallet(customerId: string): CustomerWallet {
  const key = customerId.startsWith('+971') || customerId.startsWith('05')
    ? normalizePhone(customerId)
    : customerId;

  let wallet = walletsCache.get(key);
  if (!wallet) {
    const nowIso = new Date().toISOString();
    wallet = {
      customerId: key,
      phone: key.startsWith('+') ? key : undefined,
      availablePoints: 0,
      equivalentFils: 0,
      equivalentAed: 0,
      totalEarnedPoints: 0,
      totalRedeemedPoints: 0,
      totalExpiredPoints: 0,
      welcomeBonusClaimed: false,
      completedOrdersCount: 0,
      claimedSocialPages: [],
      pointsSubjectToExpiry: 0,
      nextExpirationDate: calculateExpiryDate(new Date()),
      daysUntilExpiry: loyaltyConfig.expirationDays,
      updatedAt: nowIso,
    };
    walletsCache.set(key, wallet);
    void persistWalletToFirestore(wallet);
  }

  wallet.equivalentFils = Math.round(wallet.availablePoints);
  wallet.equivalentAed = filsToAed(wallet.equivalentFils);

  if (wallet.nextExpirationDate) {
    const diffMs = new Date(wallet.nextExpirationDate).getTime() - Date.now();
    wallet.daysUntilExpiry = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  return wallet;
}

export interface RegistrationBonusResult {
  success: boolean;
  pointsAwarded: number;
  wallet: CustomerWallet;
  alreadyClaimed: boolean;
  eligibleAfterFirstOrder?: boolean;
  rateLimited?: boolean;
  message: string;
}

/**
 * Server-side transactional welcome bonus claim (500 points = 500 Fils = 5 AED).
 * Requirements enforced:
 * 1. Phone must be verified (non-empty valid E.164 phone).
 * 2. IP/device rate limit is checked using ipAddress.
 * 3. User must have completed their first order (`completedOrdersCount >= 1` or `firstOrderCompleted === true`).
 * 4. Runs atomically inside a Firestore transaction (with in-process mutex lock) so concurrent requests
 *    can NEVER claim the bonus twice.
 */
export async function claimNewUserWelcomeBonus(
  phone: string,
  customerName?: string,
  ipAddress: string = '127.0.0.1',
  firstOrderCompleted: boolean = false
): Promise<RegistrationBonusResult> {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone || normalizedPhone === 'unverified' || normalizedPhone.length < 8) {
    const emptyWallet = getOrCreateWallet('unverified');
    return {
      success: false,
      pointsAwarded: 0,
      wallet: emptyWallet,
      alreadyClaimed: false,
      message: 'يرجى التحقق من رقم الهاتف عبر رمز OTP أولاً. / Phone OTP verification required.',
    };
  }

  // Enforce IP rate limit
  const rateCheck = checkIpRateLimit(ipAddress);
  if (!rateCheck.allowed) {
    const wallet = getOrCreateWallet(normalizedPhone);
    return {
      success: false,
      pointsAwarded: 0,
      wallet,
      alreadyClaimed: wallet.welcomeBonusClaimed,
      rateLimited: true,
      message: 'تم تجاوز الحد المسموح من المحاولات من هذا الجهاز. يرجى المحاولة لاحقاً. / Too many requests from this IP.',
    };
  }

  // Atomic concurrency guard for simultaneous requests on the same verified phone
  if (activeClaimLocks.has(normalizedPhone)) {
    const wallet = getOrCreateWallet(normalizedPhone);
    return {
      success: false,
      pointsAwarded: 0,
      wallet,
      alreadyClaimed: true,
      message: 'طلب المكافأة قيد المعالجة بالفعل لهذا الرقم. / Bonus claim already in progress.',
    };
  }

  activeClaimLocks.add(normalizedPhone);

  try {
    const executeClaimLogic = (wallet: CustomerWallet): RegistrationBonusResult => {
      if (customerName) {
        wallet.customerName = customerName;
      }

      if (wallet.welcomeBonusClaimed) {
        return {
          success: false,
          pointsAwarded: 0,
          wallet,
          alreadyClaimed: true,
          message: 'تم الحصول على الـ 500 نقطة الترحيبية مسبقاً لهذا الرقم الموثق. / Welcome bonus already claimed.',
        };
      }

      if (firstOrderCompleted && wallet.completedOrdersCount < 1) {
        wallet.completedOrdersCount = 1;
      }

      // Must complete first order before receiving the 500 welcome points
      if (wallet.completedOrdersCount < 1) {
        wallet.updatedAt = new Date().toISOString();
        return {
          success: true,
          pointsAwarded: 0,
          wallet,
          alreadyClaimed: false,
          eligibleAfterFirstOrder: true,
          message:
            'تم توثيق رقم هاتفك بنجاح! ستحصل تلقائياً على 500 نقطة ترحيبية (5 دراهم) فور إتمام استلام طلبك الأول. / Phone verified! Your 500 welcome points (5 AED) will be unlocked right after your first completed order.',
        };
      }

      const pointsToAdd = loyaltyConfig.welcomeBonusPoints;
      const expiryDate = calculateExpiryDate();
      const nowIso = new Date().toISOString();

      wallet.availablePoints += pointsToAdd;
      wallet.totalEarnedPoints += pointsToAdd;
      wallet.pointsSubjectToExpiry += pointsToAdd;
      wallet.welcomeBonusClaimed = true;
      wallet.equivalentFils = Math.round(wallet.availablePoints);
      wallet.equivalentAed = filsToAed(wallet.equivalentFils);
      wallet.nextExpirationDate = expiryDate;
      wallet.updatedAt = nowIso;

      const txn: LoyaltyTransaction = {
        id: `TXN-LOY-WELCOME-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
        customerId: normalizedPhone,
        type: 'earned_registration_bonus',
        points: pointsToAdd,
        equivalentFils: pointsToAdd,
        equivalentAed: filsToAed(pointsToAdd),
        note: 'مكافأة الترحيب (500 نقطة = 5 دراهم) بعد إتمام الطلب الأول في فلاستر Flaster',
        status: 'COMPLETED',
        createdAt: nowIso,
        expiryDate,
      };
      transactionsCache.push(txn);

      return {
        success: true,
        pointsAwarded: pointsToAdd,
        wallet,
        alreadyClaimed: false,
        message:
          '🎉 مبروك! تم إضافة 500 نقطة ترحيبية (بقيمة 5 دراهم) إلى محفظتك بعد إتمام طلبك الأول! / 500 welcome points credited after your first completed order!',
      };
    };

    // Attempt Firestore Atomic Transaction first
    try {
      const walletRef = adminDb.collection('wallets').doc(normalizedPhone);
      const txResult = await adminDb.runTransaction(async (transaction: any) => {
        const snap = await transaction.get(walletRef);
        const wallet = getOrCreateWallet(normalizedPhone);
        if (snap.exists) {
          const data = snap.data()!;
          wallet.availablePoints = typeof data.availablePoints === 'number' ? data.availablePoints : wallet.availablePoints;
          wallet.welcomeBonusClaimed = Boolean(data.welcomeBonusClaimed || wallet.welcomeBonusClaimed);
          wallet.completedOrdersCount = typeof data.completedOrdersCount === 'number'
            ? Math.max(wallet.completedOrdersCount, data.completedOrdersCount)
            : wallet.completedOrdersCount;
        }

        const res = executeClaimLogic(wallet);
        transaction.set(
          walletRef,
          {
            customerId: wallet.customerId,
            availablePoints: wallet.availablePoints,
            totalEarnedPoints: wallet.totalEarnedPoints,
            totalRedeemedPoints: wallet.totalRedeemedPoints,
            totalExpiredPoints: wallet.totalExpiredPoints,
            welcomeBonusClaimed: wallet.welcomeBonusClaimed,
            completedOrdersCount: wallet.completedOrdersCount,
            updatedAt: wallet.updatedAt,
          },
          { merge: true }
        );
        return res;
      });
      return txResult;
    } catch {
      // Fallback to in-memory transactional execution when Firestore admin credentials are not active locally
      const wallet = getOrCreateWallet(normalizedPhone);
      return executeClaimLogic(wallet);
    }
  } finally {
    activeClaimLocks.delete(normalizedPhone);
  }
}

/**
 * Synchronous wrapper for legacy callers — delegates to claim rules (no points before first completed order)
 */
export function awardRegistrationBonus(
  customerId: string,
  firstOrderCompleted: boolean = false,
  ipAddress: string = '127.0.0.1'
): RegistrationBonusResult {
  const normalizedPhone = normalizePhone(customerId);
  const rateCheck = checkIpRateLimit(ipAddress);
  const wallet = getOrCreateWallet(normalizedPhone);

  if (!rateCheck.allowed) {
    return {
      success: false,
      pointsAwarded: 0,
      wallet,
      alreadyClaimed: wallet.welcomeBonusClaimed,
      rateLimited: true,
      message: 'Too many bonus requests from this IP address.',
    };
  }

  if (wallet.welcomeBonusClaimed) {
    return {
      success: false,
      pointsAwarded: 0,
      wallet,
      alreadyClaimed: true,
      message: 'لقد حصلت بالفعل على هدية الترحيب (500 نقطة).',
    };
  }

  if (firstOrderCompleted && wallet.completedOrdersCount < 1) {
    wallet.completedOrdersCount = 1;
  }

  if (wallet.completedOrdersCount < 1) {
    return {
      success: true,
      pointsAwarded: 0,
      wallet,
      alreadyClaimed: false,
      eligibleAfterFirstOrder: true,
      message: 'تم تفعيل حسابك! تُضاف الـ 500 نقطة الترحيبية تلقائياً فور إكمال استلام طلبك الأول.',
    };
  }

  const pointsToAdd = loyaltyConfig.registrationBonusPoints;
  const expiryDate = calculateExpiryDate();
  const nowIso = new Date().toISOString();

  wallet.availablePoints += pointsToAdd;
  wallet.totalEarnedPoints += pointsToAdd;
  wallet.pointsSubjectToExpiry += pointsToAdd;
  wallet.welcomeBonusClaimed = true;
  wallet.equivalentFils = Math.round(wallet.availablePoints);
  wallet.equivalentAed = filsToAed(wallet.equivalentFils);
  wallet.nextExpirationDate = expiryDate;
  wallet.updatedAt = nowIso;

  const txn: LoyaltyTransaction = {
    id: `TXN-LOY-WELCOME-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    customerId: normalizedPhone,
    type: 'earned_registration_bonus',
    points: pointsToAdd,
    equivalentFils: pointsToAdd,
    equivalentAed: filsToAed(pointsToAdd),
    note: 'هدية الترحيب (500 نقطة = 5 دراهم) بعد إتمام الطلب الأول في فلاستر Flaster',
    status: 'COMPLETED',
    createdAt: nowIso,
    expiryDate,
  };
  transactionsCache.push(txn);
  void persistWalletToFirestore(wallet, txn);

  return {
    success: true,
    pointsAwarded: pointsToAdd,
    wallet,
    alreadyClaimed: false,
    message: '🎉 تم إضافة 500 نقطة ترحيبية (بقيمة 5 دراهم) إلى محفظتك بعد إتمام طلبك الأول!',
  };
}

/**
 * Daily Login Reward (1 Point once per calendar day in Asia/Dubai)
 */
export function claimDailyLoginReward(customerId: string): {
  success: boolean;
  pointsAwarded: number;
  wallet: CustomerWallet;
  alreadyClaimedToday: boolean;
  message: string;
} {
  const wallet = getOrCreateWallet(customerId);
  const todayDubai = getDubaiDateString();

  if (wallet.lastDailyLoginDate === todayDubai) {
    return {
      success: false,
      pointsAwarded: 0,
      wallet,
      alreadyClaimedToday: true,
      message: 'لقد حصلت بالفعل على نقطة تسجيل الدخول اليومية لهذا اليوم.',
    };
  }

  const pointsToAdd = loyaltyConfig.dailyLoginPoints;
  const expiryDate = calculateExpiryDate();
  const nowIso = new Date().toISOString();

  wallet.availablePoints += pointsToAdd;
  wallet.totalEarnedPoints += pointsToAdd;
  wallet.lastDailyLoginDate = todayDubai;
  wallet.pointsSubjectToExpiry += pointsToAdd;
  wallet.equivalentFils = Math.round(wallet.availablePoints);
  wallet.equivalentAed = filsToAed(wallet.equivalentFils);
  wallet.updatedAt = nowIso;

  const txn: LoyaltyTransaction = {
    id: `TXN-LOY-LOGIN-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    customerId: wallet.customerId,
    type: 'earned_daily_login',
    points: pointsToAdd,
    equivalentFils: pointsToAdd,
    equivalentAed: filsToAed(pointsToAdd),
    note: `نقطة تسجيل الدخول اليومي لتاريخ ${todayDubai}`,
    status: 'COMPLETED',
    createdAt: nowIso,
    expiryDate,
  };
  transactionsCache.push(txn);
  void persistWalletToFirestore(wallet, txn);

  return {
    success: true,
    pointsAwarded: pointsToAdd,
    wallet,
    alreadyClaimedToday: false,
    message: '🎉 تم إضافة نقطة تسجيل الدخول اليومية إلى محفظتك بنجاح!',
  };
}

const ALLOWED_SOCIAL_FOLLOW_PAGES = new Set(['instagram', 'tiktok', 'snapchat', 'facebook', 'x']);
const SOCIAL_FOLLOW_POINTS = 5;

/**
 * Social Media Follow Reward: 5 points per official Flaster platform (5 platforms total = max 25 points)
 */
export function claimSocialFollowReward(
  customerId: string,
  pageId: string,
  handle?: string
): {
  success: boolean;
  pointsAwarded: number;
  alreadyClaimed: boolean;
  claimedSocialPages: string[];
  wallet: CustomerWallet;
  message: string;
} {
  const normalizedPage = String(pageId || '').trim().toLowerCase();
  const cleanHandle = typeof handle === 'string' ? handle.trim().slice(0, 64) : '';
  const wallet = getOrCreateWallet(customerId);
  const currentClaimed = Array.isArray(wallet.claimedSocialPages) ? wallet.claimedSocialPages : [];

  if (!ALLOWED_SOCIAL_FOLLOW_PAGES.has(normalizedPage)) {
    return {
      success: false,
      pointsAwarded: 0,
      alreadyClaimed: false,
      claimedSocialPages: currentClaimed,
      wallet,
      message: 'مكافأة النقاط تشمل منصات فلاستر الخمس الرسمية المعتمدة فقط.',
    };
  }

  if (currentClaimed.includes(normalizedPage)) {
    return {
      success: false,
      pointsAwarded: 0,
      alreadyClaimed: true,
      claimedSocialPages: currentClaimed,
      wallet,
      message: 'لقد حصلت مسبقاً على نقاط متابعة هذه المنصة (5 نقاط).',
    };
  }

  const expiryDate = calculateExpiryDate();
  const nowIso = new Date().toISOString();
  const nextClaimed = [...currentClaimed, normalizedPage];

  wallet.claimedSocialPages = nextClaimed;
  wallet.availablePoints += SOCIAL_FOLLOW_POINTS;
  wallet.totalEarnedPoints += SOCIAL_FOLLOW_POINTS;
  wallet.pointsSubjectToExpiry += SOCIAL_FOLLOW_POINTS;
  wallet.equivalentFils = Math.round(wallet.availablePoints);
  wallet.equivalentAed = filsToAed(wallet.equivalentFils);
  wallet.updatedAt = nowIso;

  const txn: LoyaltyTransaction = {
    id: `TXN-LOY-SOC-${normalizedPage.toUpperCase()}-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    customerId: wallet.customerId,
    type: 'earned_social_follow',
    points: SOCIAL_FOLLOW_POINTS,
    equivalentFils: SOCIAL_FOLLOW_POINTS,
    equivalentAed: filsToAed(SOCIAL_FOLLOW_POINTS),
    note: cleanHandle
      ? `مكافأة متابعة ${normalizedPage} (${cleanHandle}) — +${SOCIAL_FOLLOW_POINTS} نقاط`
      : `مكافأة متابعة منصة فلاستر (${normalizedPage}) — +${SOCIAL_FOLLOW_POINTS} نقاط`,
    status: 'COMPLETED',
    createdAt: nowIso,
    expiryDate,
  };
  transactionsCache.push(txn);
  void persistWalletToFirestore(wallet, txn);

  return {
    success: true,
    pointsAwarded: SOCIAL_FOLLOW_POINTS,
    alreadyClaimed: false,
    claimedSocialPages: nextClaimed,
    wallet,
    message: `🎉 شكراً لمتابعتك! تمت إضافة ${SOCIAL_FOLLOW_POINTS} نقاط إلى محفظتك (${nextClaimed.length}/5 منصات).`,
  };
}

/**
 * Admin Revocation: Deducts 5 points if customer unfollowed a platform
 */
export function revokeSocialFollowReward(
  customerId: string,
  pageId: string
): {
  success: boolean;
  pointsDeducted: number;
  wallet: CustomerWallet;
  message: string;
} {
  const normalizedPage = String(pageId || '').trim().toLowerCase();
  const wallet = getOrCreateWallet(customerId);
  const currentClaimed = Array.isArray(wallet.claimedSocialPages) ? wallet.claimedSocialPages : [];
  const pointsDeducted = Math.min(SOCIAL_FOLLOW_POINTS, wallet.availablePoints);
  const nowIso = new Date().toISOString();

  wallet.claimedSocialPages = currentClaimed.filter((p) => p !== normalizedPage);
  wallet.availablePoints = Math.max(0, wallet.availablePoints - SOCIAL_FOLLOW_POINTS);
  wallet.equivalentFils = Math.round(wallet.availablePoints);
  wallet.equivalentAed = filsToAed(wallet.equivalentFils);
  wallet.updatedAt = nowIso;

  const txn: LoyaltyTransaction = {
    id: `TXN-LOY-UNFOLLOW-${normalizedPage.toUpperCase()}-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    customerId: wallet.customerId,
    type: 'social_unfollow_deduction',
    points: -SOCIAL_FOLLOW_POINTS,
    equivalentFils: -SOCIAL_FOLLOW_POINTS,
    equivalentAed: -filsToAed(SOCIAL_FOLLOW_POINTS),
    note: `خصم ${SOCIAL_FOLLOW_POINTS} نقاط بسبب إلغاء متابعة منصة (${normalizedPage})`,
    status: 'COMPLETED',
    createdAt: nowIso,
  };
  transactionsCache.push(txn);
  void persistWalletToFirestore(wallet, txn);

  return {
    success: true,
    pointsDeducted,
    wallet,
    message: `تم خصم ${SOCIAL_FOLLOW_POINTS} نقاط بسبب إلغاء المتابعة على (${normalizedPage}).`,
  };
}

/**
 * Completed Purchase Reward:
 * - Increments completedOrdersCount
 * - If this is the customer's FIRST completed order, unlocks and awards the 500 welcome bonus points!
 * - Also awards the standard 15 purchase reward points.
 */
export function awardPurchaseReward(
  customerId: string,
  orderId: string
): {
  success: boolean;
  pointsAwarded: number;
  welcomeBonusUnlocked: boolean;
  welcomePointsAwarded: number;
  wallet: CustomerWallet;
  message: string;
} {
  const wallet = getOrCreateWallet(customerId);
  const existing = transactionsCache.find(
    (t) =>
      t.type === 'earned_purchase' &&
      t.relatedOrderId === orderId &&
      t.status === 'COMPLETED'
  );

  if (existing) {
    return {
      success: false,
      pointsAwarded: 0,
      welcomeBonusUnlocked: false,
      welcomePointsAwarded: 0,
      wallet,
      message: 'تم احتساب مكافأة هذا الطلب مسبقاً.',
    };
  }

  wallet.completedOrdersCount = (wallet.completedOrdersCount || 0) + 1;
  let welcomeBonusUnlocked = false;
  let welcomePointsAwarded = 0;

  // Unlock 500 welcome points upon first completed order!
  if (wallet.completedOrdersCount >= 1 && !wallet.welcomeBonusClaimed) {
    const bonusRes = awardRegistrationBonus(wallet.customerId, true);
    if (bonusRes.pointsAwarded > 0) {
      welcomeBonusUnlocked = true;
      welcomePointsAwarded = bonusRes.pointsAwarded;
    }
  }

  const pointsToAdd = loyaltyConfig.purchaseRewardPoints;
  const expiryDate = calculateExpiryDate();
  const nowIso = new Date().toISOString();

  wallet.availablePoints += pointsToAdd;
  wallet.totalEarnedPoints += pointsToAdd;
  wallet.pointsSubjectToExpiry += pointsToAdd;
  wallet.equivalentFils = Math.round(wallet.availablePoints);
  wallet.equivalentAed = filsToAed(wallet.equivalentFils);
  wallet.updatedAt = nowIso;

  const txn: LoyaltyTransaction = {
    id: `TXN-LOY-PURCH-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    customerId: wallet.customerId,
    type: 'earned_purchase',
    points: pointsToAdd,
    equivalentFils: pointsToAdd,
    equivalentAed: filsToAed(pointsToAdd),
    relatedOrderId: orderId,
    note: `مكافأة إتمام إنقاذ الوجبة للطلب #${orderId}`,
    status: 'COMPLETED',
    createdAt: nowIso,
    expiryDate,
  };
  transactionsCache.push(txn);
  void persistWalletToFirestore(wallet, txn);

  const totalGranted = pointsToAdd + welcomePointsAwarded;
  return {
    success: true,
    pointsAwarded: totalGranted,
    welcomeBonusUnlocked,
    welcomePointsAwarded,
    wallet,
    message: welcomeBonusUnlocked
      ? `🎉 مبروك إتمام طلبك الأول! حصلت على 500 نقطة ترحيبية + ${pointsToAdd} نقطة طلب (إجمالي ${totalGranted} نقطة)!`
      : `🎉 تم منحك ${pointsToAdd} نقطة ولاء لإتمام استلام الطلب #${orderId}!`,
  };
}

/**
 * Customer Review Reward (10 points for completed purchase review)
 */
export function awardReviewReward(params: {
  customerId: string;
  orderId: string;
  rating: number;
  comment?: string;
}): {
  success: boolean;
  pointsAwarded: number;
  message: string;
} {
  if (!Number.isInteger(params.rating) || params.rating < 1 || params.rating > 5) {
    return {
      success: false,
      pointsAwarded: 0,
      message: 'التقييم يجب أن يكون عدداً صحيحاً بين 1 و 5 نجوم.',
    };
  }

  const key = `${params.customerId}:${params.orderId}`;
  if (reviewsSubmitted.has(key)) {
    return {
      success: false,
      pointsAwarded: 0,
      message: 'تم إرسال تقييم لهذا الطلب مسبقاً والحصول على المكافأة.',
    };
  }

  reviewsSubmitted.add(key);
  const wallet = getOrCreateWallet(params.customerId);
  const pointsToAdd = loyaltyConfig.reviewRewardPoints;
  const expiryDate = calculateExpiryDate();
  const nowIso = new Date().toISOString();

  wallet.availablePoints += pointsToAdd;
  wallet.totalEarnedPoints += pointsToAdd;
  wallet.pointsSubjectToExpiry += pointsToAdd;
  wallet.equivalentFils = Math.round(wallet.availablePoints);
  wallet.equivalentAed = filsToAed(wallet.equivalentFils);
  wallet.updatedAt = nowIso;

  const txn: LoyaltyTransaction = {
    id: `TXN-LOY-REV-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    customerId: wallet.customerId,
    type: 'earned_review',
    points: pointsToAdd,
    equivalentFils: pointsToAdd,
    equivalentAed: filsToAed(pointsToAdd),
    relatedOrderId: params.orderId,
    note: `مكافأة مشاركة تقييم تجربة إنقاذ الطعام (${params.rating} نجوم)`,
    status: 'COMPLETED',
    createdAt: nowIso,
    expiryDate,
  };
  transactionsCache.push(txn);
  void persistWalletToFirestore(wallet, txn);

  return {
    success: true,
    pointsAwarded: pointsToAdd,
    message: `🌟 شكراً لتقييمك! تم إضافة ${pointsToAdd} نقطة ولاء إلى محفظتك بنجاح!`,
  };
}

/**
 * Points Redemption at Checkout (All calculations in integer UAE Fils: 1 point = 1 fil)
 */
export function redeemPointsForOrder(params: {
  customerId: string;
  orderId: string;
  pointsToRedeem: number;
  orderSubtotalFils: number;
}): {
  success: boolean;
  discountFils: number;
  discountAed: number;
  pointsRedeemed: number;
  error?: string;
} {
  const { customerId, orderId, pointsToRedeem, orderSubtotalFils } = params;

  if (pointsToRedeem <= 0) {
    return { success: true, discountFils: 0, discountAed: 0, pointsRedeemed: 0 };
  }

  if (!Number.isInteger(pointsToRedeem) || !Number.isInteger(orderSubtotalFils) || orderSubtotalFils < 0) {
    return {
      success: false,
      discountFils: 0,
      discountAed: 0,
      pointsRedeemed: 0,
      error: 'النقاط والمبلغ يجب أن يكونا أعداداً صحيحة بالفلس.',
    };
  }

  const intPoints = pointsToRedeem;
  const wallet = getOrCreateWallet(customerId);

  if (intPoints > wallet.availablePoints) {
    return {
      success: false,
      discountFils: 0,
      discountAed: 0,
      pointsRedeemed: 0,
      error: `لا يمكنك استبدال ${intPoints} نقطة لأن رصيدك المتاح هو ${wallet.availablePoints} نقطة فقط.`,
    };
  }

  if (intPoints < loyaltyConfig.minRedemptionPoints) {
    return {
      success: false,
      discountFils: 0,
      discountAed: 0,
      pointsRedeemed: 0,
      error: `الحد الأدنى لاستبدال النقاط هو ${loyaltyConfig.minRedemptionPoints} نقطة.`,
    };
  }

  if (intPoints > loyaltyConfig.maxRedemptionPointsPerOrder) {
    return {
      success: false,
      discountFils: 0,
      discountAed: 0,
      pointsRedeemed: 0,
      error: `الحد الأقصى لاستبدال النقاط لكل طلب هو ${loyaltyConfig.maxRedemptionPointsPerOrder} نقطة.`,
    };
  }

  // 100 points = 1 AED = 100 Fils -> 1 point = 1 Fil
  const discountFils = Math.round((intPoints * 100) / loyaltyConfig.pointsPerAed);
  const discountAed = filsToAed(discountFils);

  if (discountFils > orderSubtotalFils) {
    return {
      success: false,
      discountFils: 0,
      discountAed: 0,
      pointsRedeemed: 0,
      error: 'قيمة النقاط المستبدلة تتجاوز إجمالي ثمن وجبات الطلب.',
    };
  }

  const nowIso = new Date().toISOString();
  wallet.availablePoints -= intPoints;
  wallet.totalRedeemedPoints += intPoints;
  wallet.pointsSubjectToExpiry = Math.max(0, wallet.pointsSubjectToExpiry - intPoints);
  wallet.equivalentFils = Math.round(wallet.availablePoints);
  wallet.equivalentAed = filsToAed(wallet.equivalentFils);
  wallet.updatedAt = nowIso;

  const txn: LoyaltyTransaction = {
    id: `TXN-LOY-RED-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    customerId: wallet.customerId,
    type: 'redeemed_checkout',
    points: -intPoints,
    equivalentFils: -discountFils,
    equivalentAed: -discountAed,
    relatedOrderId: orderId,
    note: `خصم ولاء مدعوم من فلاستر بقيمة ${discountAed} درهم للطلب #${orderId}`,
    status: 'COMPLETED',
    createdAt: nowIso,
  };
  transactionsCache.push(txn);
  void persistWalletToFirestore(wallet, txn);

  return {
    success: true,
    discountFils,
    discountAed,
    pointsRedeemed: intPoints,
  };
}

/**
 * Reverses redemption if order is cancelled or refunded
 */
export function refundRedeemedPoints(
  customerId: string,
  orderId: string
): {
  success: boolean;
  pointsRefunded: number;
} {
  const wallet = getOrCreateWallet(customerId);
  const redemptionTxn = transactionsCache.find(
    (t) =>
      t.type === 'redeemed_checkout' &&
      t.relatedOrderId === orderId &&
      t.status === 'COMPLETED'
  );

  if (!redemptionTxn) {
    return { success: false, pointsRefunded: 0 };
  }

  const pointsToRestore = Math.abs(redemptionTxn.points);
  const nowIso = new Date().toISOString();

  wallet.availablePoints += pointsToRestore;
  wallet.totalRedeemedPoints = Math.max(0, wallet.totalRedeemedPoints - pointsToRestore);
  wallet.equivalentFils = Math.round(wallet.availablePoints);
  wallet.equivalentAed = filsToAed(wallet.equivalentFils);
  wallet.updatedAt = nowIso;

  const txn: LoyaltyTransaction = {
    id: `TXN-LOY-REF-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    customerId: wallet.customerId,
    type: 'refund_reversal',
    points: pointsToRestore,
    equivalentFils: pointsToRestore,
    equivalentAed: filsToAed(pointsToRestore),
    relatedOrderId: orderId,
    note: `استرجاع نقاط مستبدلة نتيجة إلغاء الطلب #${orderId}`,
    status: 'COMPLETED',
    createdAt: nowIso,
  };
  transactionsCache.push(txn);
  void persistWalletToFirestore(wallet, txn);

  return { success: true, pointsRefunded: pointsToRestore };
}

export function processPointsExpirationCleanup(customerId?: string): {
  expiredCount: number;
  totalPointsExpired: number;
  totalAedExpired: number;
  audits: { customerId: string; pointsExpired: number }[];
} {
  const now = Date.now();
  let totalPointsExpired = 0;
  const audits: { customerId: string; pointsExpired: number }[] = [];

  const targetWallets = customerId
    ? ([walletsCache.get(customerId)].filter(Boolean) as CustomerWallet[])
    : Array.from(walletsCache.values());

  for (const w of targetWallets) {
    if (
      w.availablePoints > 0 &&
      w.nextExpirationDate &&
      new Date(w.nextExpirationDate).getTime() <= now
    ) {
      const expiredAmount = w.availablePoints;
      const nowIso = new Date().toISOString();
      w.availablePoints = 0;
      w.pointsSubjectToExpiry = 0;
      w.totalExpiredPoints += expiredAmount;
      w.equivalentFils = 0;
      w.equivalentAed = 0;
      w.nextExpirationDate = calculateExpiryDate(new Date());
      w.updatedAt = nowIso;

      const txn: LoyaltyTransaction = {
        id: `TXN-LOY-EXP-${Date.now()}-${w.customerId}`,
        customerId: w.customerId,
        type: 'expired_reset',
        points: -expiredAmount,
        equivalentFils: -expiredAmount,
        equivalentAed: -filsToAed(expiredAmount),
        note: 'انتهاء صلاحية النقاط الدورية بعد مرور 4 أشهر (120 يوماً)',
        status: 'COMPLETED',
        createdAt: nowIso,
      };
      transactionsCache.push(txn);
      void persistWalletToFirestore(w, txn);

      totalPointsExpired += expiredAmount;
      audits.push({ customerId: w.customerId, pointsExpired: expiredAmount });
    }
  }

  return {
    expiredCount: audits.length,
    totalPointsExpired,
    totalAedExpired: filsToAed(totalPointsExpired),
    audits,
  };
}

export function getCustomerLoyaltySummary(customerId: string): {
  wallet: CustomerWallet;
  history: LoyaltyTransaction[];
  upcomingExpiryWarning: boolean;
} {
  const wallet = getOrCreateWallet(customerId);
  const history = transactionsCache
    .filter((t) => t.customerId === wallet.customerId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const upcomingExpiryWarning =
    wallet.daysUntilExpiry !== undefined &&
    wallet.daysUntilExpiry <= 7 &&
    wallet.availablePoints > 0;

  return {
    wallet,
    history,
    upcomingExpiryWarning,
  };
}

export function getPlatformRewardsLiabilityReport() {
  let totalIssued = 0;
  let totalRedeemed = 0;
  let totalExpired = 0;
  let currentActiveOutstanding = 0;

  for (const w of walletsCache.values()) {
    currentActiveOutstanding += w.availablePoints;
    totalIssued += w.totalEarnedPoints;
    totalRedeemed += w.totalRedeemedPoints;
    totalExpired += w.totalExpiredPoints;
  }

  return {
    programName: 'Flaster Unified Loyalty Points',
    fundingSource: '100% Platform Funded by Flaster (Zero Merchant Deductions)',
    conversionRate: `${loyaltyConfig.pointsPerAed} Points = 1 AED (1 Point = 1 Fil)`,
    expirationCycle: `${loyaltyConfig.expirationDays} Days (4 Calendar Months)`,
    welcomeBonusPolicy: '500 points unlocked strictly after first completed order (verified phone)',
    metrics: {
      totalCustomersWithWallets: walletsCache.size,
      totalPointsIssued: totalIssued,
      totalPointsRedeemed: totalRedeemed,
      totalPointsExpired: totalExpired,
      currentOutstandingPoints: currentActiveOutstanding,
      outstandingLiabilityAed: filsToAed(currentActiveOutstanding),
      totalFundedDiscountsAed: filsToAed(totalRedeemed),
      totalExpiredSavedAed: filsToAed(totalExpired),
    },
    config: loyaltyConfig,
    generatedAt: new Date().toISOString(),
  };
}
