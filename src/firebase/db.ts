import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  getDoc,
  orderBy,
  Unsubscribe,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './config';
import {
  SurplusItem,
  Order,
  FirestoreSurplusItem,
  MerchantPartner,
  CommissionAuditLog,
} from '../types';
import {
  CUSTOMER_SERVICE_FEE_FILS,
  DEFAULT_PLATFORM_SETTINGS,
  MIN_MERCHANT_ITEM_PRICE_FILS,
  PlatformSettings,
  aedToFils,
  filsToAed,
} from '../config/platformConfig';

/**
 * Checks whether an item's expiryTime has passed.
 * Supports both ISO date strings and "HH:MM" today strings.
 */
export function isSurplusItemExpired(expiryTime?: string, pickupDate: 'today' | 'tomorrow' = 'today'): boolean {
  if (!expiryTime || !expiryTime.trim()) return false;
  const trimmed = expiryTime.trim();

  // If "HH:MM" format
  if (/^\d{1,2}:\d{2}$/.test(trimmed)) {
    if (pickupDate === 'tomorrow') return false;
    const [hours, minutes] = trimmed.split(':').map(Number);
    const now = new Date();
    const exp = new Date(now);
    exp.setHours(hours, minutes, 59, 999);
    return now.getTime() > exp.getTime();
  }

  // Otherwise parse ISO timestamp
  const parsed = Date.parse(trimmed);
  if (!Number.isNaN(parsed)) {
    return Date.now() > parsed;
  }
  return false;
}

/**
 * Transforms a Firestore Surplus Item document into the application's SurplusItem UI model.
 * Converts integer UAE Fils to AED for display.
 */
export function mapFirestoreToSurplusItem(docData: FirestoreSurplusItem): SurplusItem {
  const allergensList = Array.isArray(docData.allergens)
    ? docData.allergens
    : typeof docData.allergens === 'string' && docData.allergens.trim()
      ? docData.allergens.split(',').map((s) => s.trim()).filter(Boolean)
      : [];

  return {
    id: docData.id,
    title: {
      en: docData.titleEn || '',
      ar: docData.titleAr || '',
    },
    merchant: {
      id: docData.merchantId,
      name: docData.merchantName || 'Flaster Partner',
      nameAr: docData.merchantNameAr || 'شريك معتمد - فلاستر',
      verified: true,
      rating: 4.9,
      reviewsCount: 140,
      neighborhood: 'Ras Al Khaimah',
      neighborhoodAr: 'رأس الخيمة',
      distanceKm: 1.8,
      avatar:
        docData.imageUrl ||
        'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=120&auto=format&fit=crop&q=80',
      address: 'Ras Al Khaimah, UAE',
      addressAr: 'رأس الخيمة، دولة الإمارات',
      lat: 25.7942,
      lng: 55.9754,
    },
    category: docData.category || 'bakery',
    imageUrl:
      docData.imageUrl ||
      'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&auto=format&fit=crop&q=80',
    discountPercent:
      docData.originalPriceFils > 0
        ? Math.round(
            ((docData.originalPriceFils - docData.discountedPriceFils) /
              docData.originalPriceFils) *
              100
          )
        : 50,
    originalPriceFils: docData.originalPriceFils,
    discountedPriceFils: docData.discountedPriceFils,
    originalPrice: filsToAed(docData.originalPriceFils),
    discountedPrice: filsToAed(docData.discountedPriceFils),
    stockRemaining: docData.stockRemaining ?? 0,
    pickupStart: docData.pickupStart || '18:00',
    pickupEnd: docData.pickupEnd || '21:00',
    pickupDate: docData.pickupDate || 'today',
    expiryTime: docData.expiryTime || undefined,
    co2SavedKg: docData.co2SavedKg || 2.5,
    description: {
      en: docData.descriptionEn || '',
      ar: docData.descriptionAr || '',
    },
    possibleContents: {
      en: ['Assorted fresh gourmet surplus selection'],
      ar: ['تشكيلة طازجة ومختارة من فائض اليوم الفاخر'],
    },
    allergens: allergensList,
    ingredients: docData.ingredients || undefined,
    isHalal: docData.isHalal ?? true,
    tags: docData.tags || ['Flaster', 'Zero Waste', 'Fresh Halal'],
  };
}

/**
 * Subscribes to live active surplus meals and auto-hides expired items.
 */
export function subscribeToSurplusItems(
  onUpdate: (items: SurplusItem[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  try {
    const q = query(collection(db, 'surplus_items'), where('status', '==', 'active'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          const liveItems: SurplusItem[] = [];
          snapshot.forEach((d) => {
            const data = d.data() as FirestoreSurplusItem;
            if (
              data.stockRemaining > 0 &&
              !isSurplusItemExpired(data.expiryTime, data.pickupDate)
            ) {
              liveItems.push(mapFirestoreToSurplusItem(data));
            }
          });

          onUpdate(liveItems);
          return;
        }
        onUpdate([]);
      },
      (error) => {
        if (onError) onError(error);
        onUpdate([]);
      }
    );

    return unsubscribe;
  } catch {
    onUpdate([]);
    return () => {};
  }
}

/**
 * Subscribes to customer orders for a specific user.
 */
export function subscribeToCustomerOrders(
  customerId: string,
  onUpdate: (orders: Order[]) => void
): Unsubscribe {
  if (!customerId) {
    return () => {};
  }

  try {
    const q = query(
      collection(db, 'orders'),
      where('customerId', '==', customerId),
      orderBy('createdAt', 'desc')
    );

    return onSnapshot(
      q,
      (snapshot) => {
        const liveOrders: Order[] = [];
        snapshot.forEach((d) => {
          const data = d.data();
          liveOrders.push(data as Order);
        });
        if (liveOrders.length > 0) {
          onUpdate(liveOrders);
        }
      },
      () => {
        // Keep existing orders in memory if query fails
      }
    );
  } catch {
    return () => {};
  }
}

/**
 * Subscribes to a customer's real-time loyalty wallet balance in Firestore.
 */
export function subscribeToCustomerWallet(
  customerId: string,
  onUpdate: (availablePoints: number, welcomeBonusClaimed: boolean) => void
): Unsubscribe {
  if (!customerId) {
    onUpdate(0, false);
    return () => {};
  }

  try {
    const walletRef = doc(db, 'wallets', customerId);
    return onSnapshot(
      walletRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          onUpdate(
            typeof data.availablePoints === 'number' ? data.availablePoints : 0,
            Boolean(data.welcomeBonusClaimed)
          );
        }
      },
      () => {
        // Keep current balance on permission/offline error
      }
    );
  } catch {
    return () => {};
  }
}

export interface PersistedCustomerWallet {
  customerId: string;
  customerName?: string;
  availablePoints: number;
  totalEarnedPoints: number;
  totalRedeemedPoints: number;
  totalExpiredPoints: number;
  welcomeBonusClaimed: boolean;
  completedOrdersCount: number;
  claimedSocialPages: string[];
  lastDailyLoginDate?: string;
  nextExpirationDate?: string;
  updatedAt: string;
}

export interface PersistedLoyaltyTransaction {
  id: string;
  customerId: string;
  type: string;
  points: number;
  equivalentFils: number;
  equivalentAed: number;
  note?: string;
  relatedOrderId?: string;
  relatedReviewId?: string;
  status: 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  expiryDate?: string;
}

export interface SocialFollowClaimRecord {
  id: string;
  customerId: string;
  customerName?: string;
  pageId: 'instagram' | 'tiktok' | 'snapchat' | 'facebook' | 'x';
  handle: string;
  pointsAwarded: 5;
  status: 'active' | 'revoked';
  claimedAt: string;
  revokedAt?: string;
  updatedAt: string;
}

const VALID_SOCIAL_PAGE_IDS = ['instagram', 'tiktok', 'snapchat', 'facebook', 'x'] as const;

function sanitizeSocialPages(pages?: unknown): string[] {
  if (!Array.isArray(pages)) return [];
  const validSet = new Set<string>(VALID_SOCIAL_PAGE_IDS);
  return Array.from(new Set(pages.filter((p): p is string => typeof p === 'string' && validSet.has(p))));
}

/**
 * Subscribes to the full customer loyalty wallet in Firestore /wallets/{customerId}.
 * Calls onUpdate(null) when no wallet document exists yet so callers can initialize welcome points once.
 */
export function subscribeToCustomerWalletFull(
  customerId: string,
  onUpdate: (wallet: PersistedCustomerWallet | null) => void
): Unsubscribe {
  if (!customerId || customerId === 'guest') {
    onUpdate(null);
    return () => {};
  }

  try {
    const walletRef = doc(db, 'wallets', customerId);
    return onSnapshot(
      walletRef,
      (snap) => {
        if (!snap.exists()) {
          onUpdate(null);
          return;
        }
        const data = snap.data();
        onUpdate({
          customerId: typeof data.customerId === 'string' ? data.customerId : customerId,
          customerName: typeof data.customerName === 'string' ? data.customerName : undefined,
          availablePoints: typeof data.availablePoints === 'number' ? Math.max(0, Math.round(data.availablePoints)) : 0,
          totalEarnedPoints: typeof data.totalEarnedPoints === 'number' ? Math.max(0, Math.round(data.totalEarnedPoints)) : 0,
          totalRedeemedPoints: typeof data.totalRedeemedPoints === 'number' ? Math.max(0, Math.round(data.totalRedeemedPoints)) : 0,
          totalExpiredPoints: typeof data.totalExpiredPoints === 'number' ? Math.max(0, Math.round(data.totalExpiredPoints)) : 0,
          welcomeBonusClaimed: Boolean(data.welcomeBonusClaimed),
          completedOrdersCount: typeof data.completedOrdersCount === 'number' ? Math.max(0, Math.round(data.completedOrdersCount)) : 0,
          claimedSocialPages: sanitizeSocialPages(data.claimedSocialPages),
          lastDailyLoginDate: typeof data.lastDailyLoginDate === 'string' ? data.lastDailyLoginDate : undefined,
          nextExpirationDate: typeof data.nextExpirationDate === 'string' ? data.nextExpirationDate : undefined,
          updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
        });
      },
      (err) => {
        console.warn('[Firestore] subscribeToCustomerWalletFull error:', err.message);
      }
    );
  } catch {
    return () => {};
  }
}

/**
 * Permanently saves a customer's loyalty wallet to Firestore /wallets/{customerId}.
 * Strictly matches firestore.rules isValidWallet().
 */
export async function saveCustomerWalletToFirestore(wallet: PersistedCustomerWallet): Promise<boolean> {
  if (!wallet.customerId || wallet.customerId === 'guest' || !auth.currentUser) {
    return false;
  }

  try {
    const payload: Record<string, unknown> = {
      customerId: wallet.customerId.slice(0, 128),
      availablePoints: Math.max(0, Math.min(1000000, Math.round(wallet.availablePoints))),
      totalEarnedPoints: Math.max(0, Math.round(wallet.totalEarnedPoints)),
      totalRedeemedPoints: Math.max(0, Math.round(wallet.totalRedeemedPoints)),
      totalExpiredPoints: Math.max(0, Math.round(wallet.totalExpiredPoints)),
      welcomeBonusClaimed: Boolean(wallet.welcomeBonusClaimed),
      completedOrdersCount: Math.max(0, Math.round(wallet.completedOrdersCount)),
      claimedSocialPages: sanitizeSocialPages(wallet.claimedSocialPages),
      updatedAt: (wallet.updatedAt || new Date().toISOString()).slice(0, 64),
    };

    if (wallet.customerName && wallet.customerName.trim()) {
      payload.customerName = wallet.customerName.trim().slice(0, 120);
    }
    if (wallet.lastDailyLoginDate && wallet.lastDailyLoginDate.trim()) {
      payload.lastDailyLoginDate = wallet.lastDailyLoginDate.trim().slice(0, 32);
    }
    if (wallet.nextExpirationDate && wallet.nextExpirationDate.trim()) {
      payload.nextExpirationDate = wallet.nextExpirationDate.trim().slice(0, 64);
    }

    await setDoc(doc(db, 'wallets', wallet.customerId), payload);
    return true;
  } catch (err) {
    console.warn('[Firestore] Deferred wallet write:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Subscribes to a customer's loyalty transaction history in Firestore.
 * Sorts client-side by createdAt desc to avoid composite index requirements.
 */
export function subscribeToCustomerLoyaltyTransactions(
  customerId: string,
  onUpdate: (transactions: PersistedLoyaltyTransaction[]) => void
): Unsubscribe {
  if (!customerId || customerId === 'guest') {
    onUpdate([]);
    return () => {};
  }

  try {
    const q = query(collection(db, 'loyalty_transactions'), where('customerId', '==', customerId));
    return onSnapshot(
      q,
      (snap) => {
        const list: PersistedLoyaltyTransaction[] = [];
        snap.forEach((d) => {
          const data = d.data();
          const pts = typeof data.points === 'number' ? Math.round(data.points) : 0;
          list.push({
            id: typeof data.id === 'string' ? data.id : d.id,
            customerId: typeof data.customerId === 'string' ? data.customerId : customerId,
            type: typeof data.type === 'string' ? data.type : 'bonus',
            points: pts,
            equivalentFils: typeof data.equivalentFils === 'number' ? Math.round(data.equivalentFils) : pts,
            equivalentAed: typeof data.equivalentAed === 'number' ? data.equivalentAed : Number((pts / 100).toFixed(2)),
            note: typeof data.note === 'string' ? data.note : undefined,
            relatedOrderId: typeof data.relatedOrderId === 'string' ? data.relatedOrderId : undefined,
            relatedReviewId: typeof data.relatedReviewId === 'string' ? data.relatedReviewId : undefined,
            status: data.status === 'CANCELLED' ? 'CANCELLED' : 'COMPLETED',
            createdAt: typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString(),
            expiryDate: typeof data.expiryDate === 'string' ? data.expiryDate : undefined,
          });
        });
        list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
        onUpdate(list);
      },
      (err) => {
        console.warn('[Firestore] subscribeToCustomerLoyaltyTransactions error:', err.message);
      }
    );
  } catch {
    return () => {};
  }
}

/**
 * Saves a single loyalty transaction ledger record to Firestore /loyalty_transactions/{txnId}.
 * Strictly matches firestore.rules isValidLoyaltyTransaction().
 */
export async function saveLoyaltyTransactionToFirestore(
  txn: PersistedLoyaltyTransaction
): Promise<boolean> {
  if (!txn.customerId || txn.customerId === 'guest' || !auth.currentUser) {
    return false;
  }

  try {
    const safeId = txn.id.replace(/[^a-zA-Z0-9_\-+]/g, '_').slice(0, 128);
    const pointsInt = Math.max(-5000, Math.min(500, Math.round(txn.points)));
    const payload: Record<string, unknown> = {
      id: safeId,
      customerId: txn.customerId.slice(0, 128),
      type: txn.type.slice(0, 64),
      points: pointsInt,
      equivalentFils: Math.round(txn.equivalentFils ?? pointsInt),
      equivalentAed: Number((txn.equivalentAed ?? pointsInt / 100).toFixed(2)),
      status: txn.status === 'CANCELLED' ? 'CANCELLED' : 'COMPLETED',
      createdAt: (txn.createdAt || new Date().toISOString()).slice(0, 64),
    };
    if (txn.note) payload.note = txn.note.slice(0, 300);
    if (txn.relatedOrderId) payload.relatedOrderId = txn.relatedOrderId.slice(0, 128);
    if (txn.relatedReviewId) payload.relatedReviewId = txn.relatedReviewId.slice(0, 128);
    if (txn.expiryDate) payload.expiryDate = txn.expiryDate.slice(0, 64);

    await setDoc(doc(db, 'loyalty_transactions', safeId), payload);
    return true;
  } catch (err) {
    console.warn('[Firestore] Deferred loyalty transaction write:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Saves a customer's social media @handle follow claim to Firestore /social_follow_claims/{claimId}.
 */
export async function saveSocialFollowClaimToFirestore(
  claim: SocialFollowClaimRecord
): Promise<boolean> {
  if (!claim.customerId || claim.customerId === 'guest' || !auth.currentUser) {
    return false;
  }

  try {
    const safeId = claim.id.replace(/[^a-zA-Z0-9_\-+]/g, '_').slice(0, 128);
    const payload: Record<string, unknown> = {
      id: safeId,
      customerId: claim.customerId.slice(0, 128),
      pageId: claim.pageId,
      handle: claim.handle.trim().slice(0, 64),
      pointsAwarded: 5,
      status: claim.status === 'revoked' ? 'revoked' : 'active',
      claimedAt: (claim.claimedAt || new Date().toISOString()).slice(0, 64),
      updatedAt: (claim.updatedAt || new Date().toISOString()).slice(0, 64),
    };
    if (claim.customerName && claim.customerName.trim()) {
      payload.customerName = claim.customerName.trim().slice(0, 120);
    }
    if (claim.revokedAt) {
      payload.revokedAt = claim.revokedAt.slice(0, 64);
    }

    await setDoc(doc(db, 'social_follow_claims', safeId), payload);
    return true;
  } catch (err) {
    console.warn('[Firestore] Deferred social follow claim write:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Subscribes to a customer's own social follow verification claims.
 */
export function subscribeToCustomerSocialClaims(
  customerId: string,
  onUpdate: (claims: SocialFollowClaimRecord[]) => void
): Unsubscribe {
  if (!customerId || customerId === 'guest') {
    onUpdate([]);
    return () => {};
  }

  try {
    const q = query(collection(db, 'social_follow_claims'), where('customerId', '==', customerId));
    return onSnapshot(
      q,
      (snap) => {
        const claims: SocialFollowClaimRecord[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (VALID_SOCIAL_PAGE_IDS.includes(data.pageId)) {
            claims.push({
              id: typeof data.id === 'string' ? data.id : d.id,
              customerId: typeof data.customerId === 'string' ? data.customerId : customerId,
              customerName: typeof data.customerName === 'string' ? data.customerName : undefined,
              pageId: data.pageId,
              handle: typeof data.handle === 'string' ? data.handle : '',
              pointsAwarded: 5,
              status: data.status === 'revoked' ? 'revoked' : 'active',
              claimedAt: typeof data.claimedAt === 'string' ? data.claimedAt : new Date().toISOString(),
              revokedAt: typeof data.revokedAt === 'string' ? data.revokedAt : undefined,
              updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
            });
          }
        });
        claims.sort((a, b) => Date.parse(b.claimedAt) - Date.parse(a.claimedAt));
        onUpdate(claims);
      },
      (err) => {
        console.warn('[Firestore] subscribeToCustomerSocialClaims error:', err.message);
      }
    );
  } catch {
    return () => {};
  }
}

/**
 * Subscribes to ALL social follow verification claims for the Admin audit & unfollow deduction console.
 */
export function subscribeToAllSocialFollowClaims(
  onUpdate: (claims: SocialFollowClaimRecord[]) => void
): Unsubscribe {
  try {
    const q = query(collection(db, 'social_follow_claims'));
    return onSnapshot(
      q,
      (snap) => {
        const claims: SocialFollowClaimRecord[] = [];
        snap.forEach((d) => {
          const data = d.data();
          if (VALID_SOCIAL_PAGE_IDS.includes(data.pageId)) {
            claims.push({
              id: typeof data.id === 'string' ? data.id : d.id,
              customerId: typeof data.customerId === 'string' ? data.customerId : '',
              customerName: typeof data.customerName === 'string' ? data.customerName : undefined,
              pageId: data.pageId,
              handle: typeof data.handle === 'string' ? data.handle : '',
              pointsAwarded: 5,
              status: data.status === 'revoked' ? 'revoked' : 'active',
              claimedAt: typeof data.claimedAt === 'string' ? data.claimedAt : new Date().toISOString(),
              revokedAt: typeof data.revokedAt === 'string' ? data.revokedAt : undefined,
              updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
            });
          }
        });
        claims.sort((a, b) => Date.parse(b.claimedAt) - Date.parse(a.claimedAt));
        onUpdate(claims);
      },
      (err) => {
        console.warn('[Firestore] subscribeToAllSocialFollowClaims error:', err.message);
      }
    );
  } catch {
    return () => {};
  }
}

/**
 * Admin Action: Marks a social follow claim as revoked (unfollowed), deducts 5 points from the customer's
 * Firestore wallet, removes the platform from claimedSocialPages, and writes a -5 deduction transaction.
 */
export async function revokeSocialFollowClaimInFirestore(
  claim: SocialFollowClaimRecord
): Promise<{ success: boolean; newPointsBalance?: number }> {
  if (!auth.currentUser) return { success: false };

  const nowIso = new Date().toISOString();
  try {
    await saveSocialFollowClaimToFirestore({
      ...claim,
      status: 'revoked',
      revokedAt: nowIso,
      updatedAt: nowIso,
    });

    const walletRef = doc(db, 'wallets', claim.customerId);
    const walletSnap = await getDoc(walletRef);
    let nextPoints = 0;

    if (walletSnap.exists()) {
      const existing = walletSnap.data();
      const currentPoints = typeof existing.availablePoints === 'number' ? Math.round(existing.availablePoints) : 0;
      nextPoints = Math.max(0, currentPoints - 5);
      const nextPages = sanitizeSocialPages(existing.claimedSocialPages).filter((p) => p !== claim.pageId);

      await saveCustomerWalletToFirestore({
        customerId: claim.customerId,
        customerName: typeof existing.customerName === 'string' ? existing.customerName : claim.customerName,
        availablePoints: nextPoints,
        totalEarnedPoints: typeof existing.totalEarnedPoints === 'number' ? Math.round(existing.totalEarnedPoints) : currentPoints,
        totalRedeemedPoints: typeof existing.totalRedeemedPoints === 'number' ? Math.round(existing.totalRedeemedPoints) : 0,
        totalExpiredPoints: typeof existing.totalExpiredPoints === 'number' ? Math.round(existing.totalExpiredPoints) : 0,
        welcomeBonusClaimed: Boolean(existing.welcomeBonusClaimed),
        completedOrdersCount: typeof existing.completedOrdersCount === 'number' ? Math.round(existing.completedOrdersCount) : 0,
        claimedSocialPages: nextPages,
        lastDailyLoginDate: typeof existing.lastDailyLoginDate === 'string' ? existing.lastDailyLoginDate : undefined,
        nextExpirationDate: typeof existing.nextExpirationDate === 'string' ? existing.nextExpirationDate : undefined,
        updatedAt: nowIso,
      });
    }

    await saveLoyaltyTransactionToFirestore({
      id: `TXN-UNFOLLOW-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
      customerId: claim.customerId,
      type: 'social_unfollow_deduction',
      points: -5,
      equivalentFils: -5,
      equivalentAed: -0.05,
      note: `خصم 5 نقاط بسبب إلغاء متابعة صفحة (${claim.pageId}) — حساب ${claim.handle}`,
      status: 'COMPLETED',
      createdAt: nowIso,
    });

    return { success: true, newPointsBalance: nextPoints };
  } catch (err) {
    console.warn('[Firestore] Failed revoking social follow claim:', err instanceof Error ? err.message : err);
    return { success: false };
  }
}

/**
 * Subscribes to merchants and their commission rates in Firestore.
 */
export function subscribeToMerchantPartners(
  onUpdate: (merchants: MerchantPartner[]) => void
): Unsubscribe {
  try {
    const q = query(collection(db, 'merchants'), where('isVerified', 'in', [true, false]));
    return onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          const list: MerchantPartner[] = [];
          snap.forEach((d) => {
            const data = d.data();
            list.push({
              id: data.id || d.id,
              username: data.username || (data.id || d.id).replace(/^merchant-/, ''),
              disabled: Boolean(data.disabled ?? false),
              name: data.name || 'Flaster Partner',
              nameAr: data.nameAr || 'شريك فلاستر',
              category: data.category || 'restaurants_cafeterias',
              neighborhood: data.neighborhood || 'Ras Al Khaimah',
              neighborhoodAr: data.neighborhoodAr || 'رأس الخيمة',
              commissionPercent:
                typeof data.commissionPercent === 'number' ? data.commissionPercent : 15,
              isVerified: Boolean(data.isVerified ?? true),
              totalSalesAed:
                typeof data.totalSalesFils === 'number'
                  ? filsToAed(data.totalSalesFils)
                  : data.totalSalesAed || 0,
              totalSalesFils: data.totalSalesFils || 0,
              activeListingsCount: data.activeListingsCount || 0,
              rating: data.rating || 4.9,
              phone: data.phone,
              iban: data.iban,
              lat: typeof data.lat === 'number' ? data.lat : undefined,
              lng: typeof data.lng === 'number' ? data.lng : undefined,
              address: data.address,
              addressAr: data.addressAr,
              avatar: data.avatar,
            });
          });
          onUpdate(list);
          return;
        }
        onUpdate([]);
      },
      () => {
        onUpdate([]);
      }
    );
  } catch {
    onUpdate([]);
    return () => {};
  }
}

/**
 * Subscribes to platform settings (TRN, Support Phone, Default Commission) in Firestore.
 */
export function subscribeToPlatformSettings(
  onUpdate: (settings: PlatformSettings) => void
): Unsubscribe {
  try {
    const settingsRef = doc(db, 'settings', 'global');
    return onSnapshot(
      settingsRef,
      (snap) => {
        if (snap.exists()) {
          const data = snap.data();
          onUpdate({
            ...DEFAULT_PLATFORM_SETTINGS,
            businessName: data.businessName || DEFAULT_PLATFORM_SETTINGS.businessName,
            businessNameAr: data.businessNameAr || DEFAULT_PLATFORM_SETTINGS.businessNameAr,
            trn: typeof data.trn === 'string' ? data.trn : DEFAULT_PLATFORM_SETTINGS.trn,
            supportPhoneE164:
              data.supportPhoneE164 || DEFAULT_PLATFORM_SETTINGS.supportPhoneE164,
            supportWhatsappDigits:
              data.supportWhatsappDigits || DEFAULT_PLATFORM_SETTINGS.supportWhatsappDigits,
            supportEmail: data.supportEmail || DEFAULT_PLATFORM_SETTINGS.supportEmail,
            defaultCommissionPercent:
              typeof data.defaultCommissionPercent === 'number'
                ? data.defaultCommissionPercent
                : DEFAULT_PLATFORM_SETTINGS.defaultCommissionPercent,
            sequentialInvoiceCounter:
              typeof data.sequentialInvoiceCounter === 'number'
                ? data.sequentialInvoiceCounter
                : DEFAULT_PLATFORM_SETTINGS.sequentialInvoiceCounter,
          });
        } else {
          onUpdate(DEFAULT_PLATFORM_SETTINGS);
        }
      },
      () => {
        onUpdate(DEFAULT_PLATFORM_SETTINGS);
      }
    );
  } catch {
    onUpdate(DEFAULT_PLATFORM_SETTINGS);
    return () => {};
  }
}

/**
 * Saves platform settings to Firestore (Admin only).
 */
export async function savePlatformSettingsToFirestore(
  settings: Partial<PlatformSettings>,
  changedBy?: string
): Promise<void> {
  const path = 'settings/global';
  try {
    await setDoc(
      doc(db, 'settings', 'global'),
      {
        businessName: settings.businessName || settings.businessNameEn || DEFAULT_PLATFORM_SETTINGS.businessName,
        businessNameEn: settings.businessNameEn || settings.businessName || DEFAULT_PLATFORM_SETTINGS.businessNameEn,
        businessNameAr: settings.businessNameAr || DEFAULT_PLATFORM_SETTINGS.businessNameAr,
        trn: (settings.trn ?? DEFAULT_PLATFORM_SETTINGS.trn).slice(0, 32),
        supportPhoneE164: (
          settings.supportPhoneE164 || DEFAULT_PLATFORM_SETTINGS.supportPhoneE164
        ).slice(0, 32),
        supportWhatsappDigits: (
          settings.supportWhatsappDigits || DEFAULT_PLATFORM_SETTINGS.supportWhatsappDigits
        ).slice(0, 32),
        supportEmail: (settings.supportEmail || DEFAULT_PLATFORM_SETTINGS.supportEmail).slice(
          0,
          120
        ),
        vatRatePercent: 5,
        defaultCommissionPercent:
          typeof settings.defaultCommissionPercent === 'number'
            ? settings.defaultCommissionPercent
            : 15,
        sequentialInvoiceCounter:
          typeof settings.sequentialInvoiceCounter === 'number'
            ? settings.sequentialInvoiceCounter
            : 1001,
        updatedBy: changedBy || 'admin',
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

/**
 * Saves a commission change and writes an immutable audit log entry in Firestore (Admin only).
 */
export async function saveMerchantCommissionToFirestore(
  merchant: MerchantPartner,
  newCommission: number,
  changedBy: string
): Promise<CommissionAuditLog> {
  const nowIso = new Date().toISOString();
  const logEntry: CommissionAuditLog = {
    id: `CLOG-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    merchantId: merchant.id,
    merchantName: merchant.name,
    changedBy: changedBy.slice(0, 200),
    oldValue: merchant.commissionPercent,
    newValue: newCommission,
    timestamp: nowIso,
    changedAt: nowIso,
  };

  try {
    await setDoc(
      doc(db, 'merchants', merchant.id),
      {
        id: merchant.id,
        name: merchant.name.slice(0, 160),
        nameAr: merchant.nameAr.slice(0, 160),
        category: merchant.category,
        neighborhood: merchant.neighborhood,
        neighborhoodAr: merchant.neighborhoodAr,
        commissionPercent: newCommission,
        isVerified: merchant.isVerified,
        updatedAt: nowIso,
      },
      { merge: true }
    );

    await setDoc(doc(db, 'commission_logs', logEntry.id), logEntry);
  } catch {
    // Server API also persists and logs authoritatively
  }

  return logEntry;
}

/**
 * Subscribes to live updates of a single surplus item
 */
export function subscribeToItemStock(
  itemId: string,
  onStockChange: (newStock: number, isSoldOut: boolean) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  try {
    const docRef = doc(db, 'surplus_items', itemId);
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as FirestoreSurplusItem;
          onStockChange(
            data.stockRemaining,
            data.stockRemaining <= 0 || data.status === 'sold_out'
          );
        }
      },
      (err) => {
        console.warn('[Firestore] subscribeToItemStock error:', err.message);
        onError?.(err);
      }
    );
  } catch (err) {
    console.warn('[Firestore] subscribeToItemStock init error:', err instanceof Error ? err.message : err);
    return () => {};
  }
}

/**
 * Fetches user profile from Firestore /users/{uid}
 */
export async function fetchUserProfileFromFirestore(uid: string) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? snap.data() : null;
  } catch {
    return null;
  }
}

/**
 * Persists an order document to Firestore /orders/{orderId} (strictly adhering to firestore.rules isValidOrder)
 */
export async function saveOrderToFirestore(order: Order, customerUid?: string): Promise<void> {
  if (!auth.currentUser) {
    // Guest orders are persisted authoritatively on the backend (/api/orders/create)
    return;
  }

  try {
    const nowIso = new Date().toISOString();
    const safePayload: Record<string, unknown> = {
      id: order.id,
      code: order.code,
      invoiceNumber: order.invoiceNumber || order.receiptNumber || `INV-${order.id.slice(-6).toUpperCase()}`,
      customerId: auth.currentUser.uid || customerUid || order.customerId || 'anonymous',
      customerName: (order.customerName || 'Flaster Customer').slice(0, 120),
      customerPhone: (order.customerPhone || '+971500000000').slice(0, 32),
      deliveryAddress: '',
      merchantId: order.item.merchant.id || order.item.merchant.name,
      subtotalFils: order.subtotalFils ?? Math.round(order.totalAed * 100),
      serviceFeeFils:
        order.serviceFeeFils ?? CUSTOMER_SERVICE_FEE_FILS * Math.max(1, order.quantity || 1),
      deliveryFeeFils: 0,
      pointsDiscountFils: order.pointsDiscountFils ?? Math.round((order.pointsDiscountAed || 0) * 100),
      pointsRedeemed: order.pointsRedeemed ?? 0,
      vatFils: order.vatFils ?? Math.round(((order.totalAed * 100) * 5) / 105),
      totalFils: order.totalFils ?? Math.round(order.totalAed * 100),
      status: order.workflowStatus || 'placed',
      fulfillmentType: 'pickup',
      paymentMethod: order.paymentMethod,
      refundStatus: order.refundStatus || 'none',
      createdAt: order.createdAt || nowIso,
      updatedAt: nowIso,
    };

    if (order.refundReason) {
      safePayload.refundReason = order.refundReason.slice(0, 240);
    }
    if (order.refundedAt) {
      safePayload.refundedAt = order.refundedAt;
    }

    await setDoc(doc(db, 'orders', order.id), safePayload, { merge: true });
  } catch (err) {
    console.warn('[Firestore] Deferred order write (authoritative copy stored on backend):', err instanceof Error ? err.message : err);
  }
}

/**
 * Persists a merchant partner document to Firestore /merchants/{merchantId} (Admin only)
 */
export async function saveMerchantPartnerToFirestore(merchant: MerchantPartner): Promise<void> {
  try {
    const payload: Record<string, unknown> = {
      id: merchant.id,
      name: merchant.name.slice(0, 160),
      nameAr: merchant.nameAr.slice(0, 160),
      category: merchant.category,
      neighborhood: merchant.neighborhood,
      neighborhoodAr: merchant.neighborhoodAr,
      commissionPercent: merchant.commissionPercent,
      isVerified: Boolean(merchant.isVerified),
      totalSalesAed: merchant.totalSalesAed || 0,
      totalSalesFils: merchant.totalSalesFils ?? Math.round((merchant.totalSalesAed || 0) * 100),
      activeListingsCount: merchant.activeListingsCount || 0,
      rating: merchant.rating || 5.0,
      updatedAt: new Date().toISOString(),
    };
    if (merchant.username) payload.username = merchant.username.slice(0, 80);
    if (typeof merchant.disabled === 'boolean') payload.disabled = merchant.disabled;
    if (merchant.phone) payload.phone = merchant.phone;
    if (merchant.iban) payload.iban = merchant.iban;
    if (typeof merchant.lat === 'number') payload.lat = merchant.lat;
    if (typeof merchant.lng === 'number') payload.lng = merchant.lng;
    if (merchant.address) payload.address = merchant.address;
    if (merchant.addressAr) payload.addressAr = merchant.addressAr;
    if (merchant.avatar) payload.avatar = merchant.avatar;

    await setDoc(doc(db, 'merchants', merchant.id), payload, { merge: true });
  } catch (err) {
    console.warn('[Firestore] Deferred merchant write (backend authoritative):', err instanceof Error ? err.message : err);
  }
}

/**
 * Permanently deletes a merchant partner document from Firestore /merchants/{merchantId} (Admin only)
 */
export async function deleteMerchantPartnerFromFirestore(merchantId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'merchants', merchantId));
  } catch (err) {
    console.warn('[Firestore] Deferred merchant delete:', err instanceof Error ? err.message : err);
  }
}

/**
 * Persists a surplus food item to Firestore /surplus_items/{itemId} strictly adhering to firestore.rules isValidSurplusItem
 */
export async function saveSurplusItemToFirestore(item: SurplusItem): Promise<void> {
  try {
    const nowIso = new Date().toISOString();
    const rawDiscountedFils = Math.round(
      item.discountedPriceFils ?? aedToFils(item.discountedPrice || 0)
    );
    const discountedPriceFils = Math.max(MIN_MERCHANT_ITEM_PRICE_FILS, rawDiscountedFils);
    const originalPriceFils = Math.max(
      discountedPriceFils,
      Math.round(item.originalPriceFils ?? aedToFils(item.originalPrice || 0))
    );
    const allergensStr = Array.isArray(item.allergens)
      ? item.allergens.join(', ').slice(0, 500)
      : '';
    const ingredientsStr =
      typeof item.ingredients === 'string'
        ? item.ingredients.slice(0, 1000)
        : item.ingredients
          ? `${item.ingredients.ar || ''} ${item.ingredients.en || ''}`.trim().slice(0, 1000)
          : '';

    const payload: Record<string, unknown> = {
      id: item.id.slice(0, 128),
      merchantId: (item.merchant?.id || 'flaster-partner').slice(0, 128),
      merchantName: (item.merchant?.name || 'Flaster Partner').slice(0, 160),
      merchantNameAr: (item.merchant?.nameAr || 'شريك فلاستر').slice(0, 160),
      titleEn: (item.title?.en || item.title?.ar || 'Fresh Food Item').slice(0, 200),
      titleAr: (item.title?.ar || item.title?.en || 'صنف طعام طازج').slice(0, 200),
      descriptionEn: (item.description?.en || '').slice(0, 1000),
      descriptionAr: (item.description?.ar || '').slice(0, 1000),
      category: item.category || 'gourmet',
      imageUrl: (item.imageUrl || '').slice(0, 500000),
      originalPriceFils,
      discountedPriceFils,
      initialStock: Math.max(0, Math.round(item.stockRemaining || 0)),
      stockRemaining: Math.max(0, Math.round(item.stockRemaining || 0)),
      pickupStart: (item.pickupStart || '20:00').slice(0, 32),
      pickupEnd: (item.pickupEnd || '22:30').slice(0, 32),
      pickupDate: item.pickupDate || 'today',
      isHalal: item.isHalal ?? true,
      co2SavedKg: item.co2SavedKg ?? 2.5,
      status: (item.stockRemaining || 0) > 0 ? 'active' : 'sold_out',
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    if (item.expiryTime) payload.expiryTime = String(item.expiryTime).slice(0, 64);
    if (allergensStr) payload.allergens = allergensStr;
    if (ingredientsStr) payload.ingredients = ingredientsStr;

    await setDoc(doc(db, 'surplus_items', item.id), payload, { merge: true });
  } catch (err) {
    console.warn('[Firestore] Deferred surplus item write:', err instanceof Error ? err.message : err);
  }
}

/**
 * Permanently deletes a surplus food item from Firestore /surplus_items/{itemId} (Admin only)
 */
export async function deleteSurplusItemFromFirestore(itemId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'surplus_items', itemId));
  } catch (err) {
    console.warn('[Firestore] Deferred surplus item delete:', err instanceof Error ? err.message : err);
  }
}

const LEGACY_MOCK_SURPLUS_IDS = [
  'item-sharisha-1',
  'item-1',
  'item-2',
  'item-3',
  'item-4',
  'item-5',
  'item-6',
  'item-7',
  'item-8',
];

const LEGACY_MOCK_MERCHANT_IDS = [
  'merchant-alsharisha-heritage',
  'merchant-waldorf',
  'merchant-alhamra-patisserie',
  'merchant-aldhait-green',
  'merchant-umrashid-home',
  'merchant-alnakheel-roastery',
  'merchant-qasralsham',
  'merchant-sharisha-bakeries',
  'merchant-rixos',
  'merchant-crust-ferment',
  'merchant-cove-rotana',
  'merchant-seven-waves',
  'merchant-alnakheel-organic',
  'merchant-albait-alqadeem',
];

const LEGACY_MOCK_ORDER_IDS = ['ord-initial-1'];

/**
 * Deletes any previously seeded demo/mock documents from Firestore (Admin only).
 */
export async function purgeLegacyMockDataFromFirestore(): Promise<{ deletedCount: number }> {
  let deletedCount = 0;
  const tasks: Promise<void>[] = [];

  for (const id of LEGACY_MOCK_SURPLUS_IDS) {
    tasks.push(
      deleteDoc(doc(db, 'surplus_items', id))
        .then(() => {
          deletedCount += 1;
        })
        .catch(() => {})
    );
  }
  for (const id of LEGACY_MOCK_MERCHANT_IDS) {
    tasks.push(
      deleteDoc(doc(db, 'merchants', id))
        .then(() => {
          deletedCount += 1;
        })
        .catch(() => {})
    );
  }
  for (const id of LEGACY_MOCK_ORDER_IDS) {
    tasks.push(
      deleteDoc(doc(db, 'orders', id))
        .then(() => {
          deletedCount += 1;
        })
        .catch(() => {})
    );
  }

  await Promise.all(tasks);
  return { deletedCount };
}

/**
 * Writes an immutable commission audit log entry to Firestore /commission_logs/{logId}
 */
export async function logCommissionChangeToFirestore(logEntry: CommissionAuditLog): Promise<void> {
  try {
    const timestamp = logEntry.timestamp || logEntry.changedAt || new Date().toISOString();
    await setDoc(doc(db, 'commission_logs', logEntry.id), {
      ...logEntry,
      timestamp,
      changedAt: timestamp,
    });
  } catch (err) {
    console.warn('[Firestore] Deferred commission log write (backend authoritative):', err instanceof Error ? err.message : err);
  }
}

/**
 * Alias for savePlatformSettingsToFirestore
 */
export const updatePlatformSettingsInFirestore = savePlatformSettingsToFirestore;

