import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  setDoc,
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
import { INITIAL_SURPLUS_ITEMS, INITIAL_MERCHANT_PARTNERS } from '../data/mockData';
import {
  DEFAULT_PLATFORM_SETTINGS,
  PlatformSettings,
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

          if (liveItems.length > 0) {
            onUpdate(liveItems);
            return;
          }
        }
        onUpdate(
          INITIAL_SURPLUS_ITEMS.filter(
            (it) => !isSurplusItemExpired(it.expiryTime, it.pickupDate)
          )
        );
      },
      (error) => {
        if (onError) onError(error);
        onUpdate(
          INITIAL_SURPLUS_ITEMS.filter(
            (it) => !isSurplusItemExpired(it.expiryTime, it.pickupDate)
          )
        );
      }
    );

    return unsubscribe;
  } catch {
    onUpdate(INITIAL_SURPLUS_ITEMS);
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
              activeListingsCount: data.activeListingsCount || 2,
              rating: data.rating || 4.8,
              phone: data.phone,
              iban: data.iban,
            });
          });
          if (list.length > 0) {
            onUpdate(list);
            return;
          }
        }
        onUpdate(INITIAL_MERCHANT_PARTNERS);
      },
      () => {
        onUpdate(INITIAL_MERCHANT_PARTNERS);
      }
    );
  } catch {
    onUpdate(INITIAL_MERCHANT_PARTNERS);
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
      deliveryAddress: (order.deliveryAddress || '').slice(0, 240),
      merchantId: order.item.merchant.id || order.item.merchant.name,
      subtotalFils: order.subtotalFils ?? Math.round(order.totalAed * 100),
      deliveryFeeFils: order.deliveryFeeFils ?? 0,
      pointsDiscountFils: order.pointsDiscountFils ?? Math.round((order.pointsDiscountAed || 0) * 100),
      pointsRedeemed: order.pointsRedeemed ?? 0,
      vatFils: order.vatFils ?? Math.round(((order.totalAed * 100) * 5) / 105),
      totalFils: order.totalFils ?? Math.round(order.totalAed * 100),
      status: order.workflowStatus || 'placed',
      fulfillmentType: order.fulfillmentType,
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
    await setDoc(
      doc(db, 'merchants', merchant.id),
      {
        id: merchant.id,
        name: merchant.name.slice(0, 160),
        nameAr: merchant.nameAr.slice(0, 160),
        category: merchant.category,
        neighborhood: merchant.neighborhood,
        neighborhoodAr: merchant.neighborhoodAr,
        commissionPercent: merchant.commissionPercent,
        isVerified: merchant.isVerified,
        totalSalesAed: merchant.totalSalesAed,
        totalSalesFils: merchant.totalSalesFils ?? Math.round(merchant.totalSalesAed * 100),
        activeListingsCount: merchant.activeListingsCount,
        rating: merchant.rating,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[Firestore] Deferred merchant write (backend authoritative):', err instanceof Error ? err.message : err);
  }
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

