import { adminDb, getPickupSecretPepper, timingSafeStringEqual } from './adminAuth.ts';
import type {
  FirestoreSurplusItem,
  FulfillmentType,
  Order,
  OrderWorkflowStatus,
  RefundAuditLog,
  SurplusItem,
} from '../types/index.ts';
import { INITIAL_SURPLUS_ITEMS } from '../data/mockData.ts';
import crypto from 'crypto';
import { redeemPointsForOrder, refundRedeemedPoints, awardPurchaseReward } from './loyaltyService.ts';
import {
  CUSTOMER_SERVICE_FEE_AED,
  CUSTOMER_SERVICE_FEE_FILS,
  calculateIncludedVatFils,
  filsToAed,
  formatSequentialInvoiceNumber,
} from '../config/platformConfig.ts';
import {
  calculateOrderFinancials,
  getNextSequentialInvoiceNumber,
  getMerchantCommissionPercent,
} from './financeService.ts';
import { registerPaymentWebhookOrderSync } from './paymentService.ts';

export interface OrderItemRequest {
  itemId: string;
  quantity: number;
}

export interface CreateOrderParams {
  customerId: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  merchantId: string;
  items: OrderItemRequest[];
  fulfillmentType: FulfillmentType;
  paymentMethod?: 'apple_pay' | 'credit_card' | 'pickup_cash';
  paymentStatus?: 'paid' | 'pending_cash' | 'sandbox_paid' | 'failed';
  paymentTransactionId?: string;
  paymentGateway?: string;
  idempotencyKey: string;
  pointsToRedeem?: number;
}

export interface CreateOrderResult {
  success: boolean;
  conflict?: boolean;
  orderId?: string;
  invoiceNumber?: string;
  code?: string;
  pickupCode?: string;
  totalFils?: number;
  vatFils?: number;
  serviceFeeFils?: number;
  deliveryFeeFils?: number;
  subtotalFils?: number;
  pointsRedeemed?: number;
  pointsDiscountFils?: number;
  stockUpdated?: { itemId: string; newStock: number; status: string }[];
  order?: Order;
  error?: string;
  idempotentReplay?: boolean;
}

export interface StoredServerOrder {
  id: string;
  invoiceNumber: string;
  code: string;
  pickupCode?: string;
  pickupCodeHash?: string;
  pickupFailedAttempts?: number;
  pickupLockedUntil?: string;
  pickupConsumed?: boolean;
  customerId: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  merchantId: string;
  subtotalFils: number;
  serviceFeeFils: number;
  deliveryFeeFils: number;
  pointsDiscountFils: number;
  pointsRedeemed: number;
  vatFils: number;
  totalFils: number;
  fulfillmentType: FulfillmentType;
  paymentMethod: 'apple_pay' | 'credit_card' | 'pickup_cash';
  paymentStatus?: 'paid' | 'pending_cash' | 'sandbox_paid' | 'failed' | 'refunded';
  paymentTransactionId?: string;
  paymentGateway?: string;
  status: string;
  workflowStatus: OrderWorkflowStatus;
  quantity: number;
  item: SurplusItem;
  refundStatus?: 'none' | 'requested' | 'refunded' | 'rejected';
  refundReason?: string;
  refundedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// In-memory idempotency, catalog & security locks fallback when Firestore ADC is unavailable locally
const serverIdempotencyCache = new Map<
  string,
  { customerId: string; payloadHash: string; result: CreateOrderResult }
>();
const inMemoryStockOverrides = new Map<string, number>();
const serverCatalogItems = new Map<string, SurplusItem>(
  INITIAL_SURPLUS_ITEMS.map((it) => [it.id, it])
);
const activeRefundLocks = new Set<string>();
const refundedOrderIds = new Set<string>();

export function registerServerCatalogItem(item: SurplusItem): void {
  if (item?.id) {
    serverCatalogItems.set(item.id, item);
  }
}

export function getServerCatalogItem(itemId: string): SurplusItem | undefined {
  return serverCatalogItems.get(itemId);
}

export function getMerchantCatalogItems(merchantId?: string): SurplusItem[] {
  const all = Array.from(serverCatalogItems.values());
  if (!merchantId) return all;
  return all.filter((it) => it.merchant?.id === merchantId);
}

function createEmptyFallbackItem(merchantId = 'flaster-partner'): SurplusItem {
  return {
    id: `fallback-${merchantId}`,
    title: { en: 'Fresh Food Item', ar: 'صنف طعام طازج' },
    merchant: {
      id: merchantId,
      name: 'Flaster Partner',
      nameAr: 'شريك فلاستر',
      verified: true,
      rating: 5.0,
      reviewsCount: 0,
      neighborhood: 'Ras Al Khaimah',
      neighborhoodAr: 'رأس الخيمة',
      distanceKm: 0,
      avatar: '',
      address: 'Ras Al Khaimah, UAE',
      addressAr: 'رأس الخيمة، الإمارات',
      lat: 25.7925,
      lng: 55.9555,
    },
    category: 'gourmet',
    imageUrl: '',
    discountPercent: 50,
    originalPrice: 0,
    discountedPrice: 0,
    stockRemaining: 0,
    pickupStart: '20:00',
    pickupEnd: '22:00',
    pickupDate: 'today',
    co2SavedKg: 2.5,
    description: { en: '', ar: '' },
    possibleContents: { en: [], ar: [] },
    allergens: [],
    isHalal: true,
    tags: [],
  };
}

// Production clean slate: starts with zero fake demo orders
const serverOrdersCache = new Map<string, StoredServerOrder>();
const refundAuditLogs: RefundAuditLog[] = [];

// Sync order payment status when verified Ziina/Stripe webhooks arrive
registerPaymentWebhookOrderSync(async ({ intentId, orderId, status, provider }) => {
  let targetOrder = orderId ? serverOrdersCache.get(orderId) : undefined;
  if (!targetOrder) {
    for (const ord of serverOrdersCache.values()) {
      if (ord.paymentTransactionId === intentId) {
        targetOrder = ord;
        break;
      }
    }
  }
  if (!targetOrder) return;

  const nowIso = new Date().toISOString();
  targetOrder.paymentStatus =
    status === 'completed' ? 'paid' : status === 'failed' || status === 'canceled' ? 'failed' : 'paid';
  targetOrder.paymentGateway = provider === 'ziina' ? 'Ziina UAE' : 'Stripe UAE';
  targetOrder.updatedAt = nowIso;
  serverOrdersCache.set(targetOrder.id, targetOrder);

  try {
    await adminDb.collection('orders').doc(targetOrder.id).set(
      {
        paymentStatus: targetOrder.paymentStatus,
        paymentGateway: targetOrder.paymentGateway,
        updatedAt: nowIso,
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('[OrderSync] Deferred Firestore webhook sync (offline/local):', err instanceof Error ? err.message : err);
  }
});

export function registerOrderInServerCache(order: StoredServerOrder): void {
  serverOrdersCache.set(order.id, order);
}

export function getServerOrder(orderId: string): StoredServerOrder | undefined {
  return serverOrdersCache.get(orderId);
}

export function getRefundAuditLogs(): RefundAuditLog[] {
  return [...refundAuditLogs];
}

function toUiOrder(stored: StoredServerOrder): Order {
  const wf = stored.workflowStatus || (stored.status as OrderWorkflowStatus) || 'placed';
  const isCollected =
    wf === 'completed' || wf === 'collected' || stored.status === 'collected';
  const isCancelled = wf === 'cancelled' || stored.status === 'cancelled';

  return {
    id: stored.id,
    code: stored.code,
    pickupCode: stored.pickupCode,
    invoiceNumber: stored.invoiceNumber,
    receiptNumber: stored.invoiceNumber,
    customerId: stored.customerId,
    customerName: stored.customerName,
    customerPhone: stored.customerPhone,
    deliveryAddress: stored.deliveryAddress,
    subtotalFils: stored.subtotalFils,
    serviceFeeFils: stored.serviceFeeFils ?? CUSTOMER_SERVICE_FEE_FILS,
    deliveryFeeFils: 0,
    pointsDiscountFils: stored.pointsDiscountFils,
    pointsRedeemed: stored.pointsRedeemed,
    totalFils: stored.totalFils,
    vatFils: stored.vatFils,
    vatAed: filsToAed(stored.vatFils),
    item: stored.item,
    quantity: stored.quantity || 1,
    totalAed: filsToAed(stored.totalFils),
    serviceFeeAed: filsToAed(stored.serviceFeeFils ?? CUSTOMER_SERVICE_FEE_FILS),
    deliveryFeeAed: 0,
    pointsDiscountAed: filsToAed(stored.pointsDiscountFils),
    co2SavedKg: Number(((stored.item?.co2SavedKg || 2.5) * (stored.quantity || 1)).toFixed(1)),
    createdAt: stored.createdAt,
    pickupStart: stored.item?.pickupStart || '20:00',
    pickupEnd: stored.item?.pickupEnd || '22:30',
    pickupDate: stored.item?.pickupDate || 'today',
    status: isCancelled ? 'cancelled' : isCollected ? 'collected' : 'active',
    workflowStatus: wf,
    fulfillmentType: 'pickup',
    paymentMethod: stored.paymentMethod || 'apple_pay',
    paymentStatus: stored.paymentStatus,
    paymentTransactionId: stored.paymentTransactionId,
    paymentGateway: stored.paymentGateway,
    refundStatus: stored.refundStatus || 'none',
    refundReason: stored.refundReason,
    refundedAt: stored.refundedAt,
  };
}

/**
 * Returns synchronized orders merged across Firestore & Server Cache (scoped by caller identity).
 */
export async function getAllOrdersSynced(filter?: {
  customerId?: string;
  merchantId?: string;
  includeAll?: boolean;
}): Promise<Order[]> {
  try {
    const snap = await adminDb
      .collection('orders')
      .orderBy('createdAt', 'desc')
      .limit(100)
      .get();

    snap.forEach((docSnap: any) => {
      const data = docSnap.data() as Record<string, unknown>;
      const id = String(data.id || docSnap.id);
      const existing = serverOrdersCache.get(id);

      if (existing) {
        const remoteStatus = String(data.status || existing.status);
        existing.status = remoteStatus;
        existing.workflowStatus = (data.workflowStatus ||
          remoteStatus ||
          existing.workflowStatus) as OrderWorkflowStatus;
        if (data.refundStatus) {
          existing.refundStatus = data.refundStatus as StoredServerOrder['refundStatus'];
          if (data.refundStatus === 'refunded') refundedOrderIds.add(id);
        }
        if (data.updatedAt) {
          existing.updatedAt = String(data.updatedAt);
        }
        serverOrdersCache.set(id, existing);
      } else {
        const itemsArr = Array.isArray(data.items)
          ? (data.items as Array<{ itemId?: string; quantity?: number }>)
          : [];
        const firstItem = itemsArr[0];
        const matchedCatalogItem =
          (data.itemSnapshot as SurplusItem | undefined) ||
          (firstItem?.itemId ? serverCatalogItems.get(firstItem.itemId) : undefined) ||
          INITIAL_SURPLUS_ITEMS.find((it) => it.merchant.id === data.merchantId) ||
          createEmptyFallbackItem(String(data.merchantId || 'flaster-partner'));

        const remoteStatus = String(data.status || 'placed');
        const totalFils = Number(data.totalFils || matchedCatalogItem.discountedPriceFils || 0);
        const stored: StoredServerOrder = {
          id,
          invoiceNumber: String(data.invoiceNumber || formatSequentialInvoiceNumber(1001)),
          code: String(data.code || `RAK-${id.slice(-4).toUpperCase()}`),
          pickupCode: data.pickupCode ? String(data.pickupCode) : undefined,
          pickupCodeHash: data.pickupCodeHash ? String(data.pickupCodeHash) : undefined,
          customerId: String(data.customerId || 'customer'),
          customerName: String(data.customerName || 'عميل فلاستر'),
          customerPhone: String(data.customerPhone || ''),
          deliveryAddress: String(data.deliveryAddress || ''),
          merchantId: String(data.merchantId || matchedCatalogItem.merchant.id || 'flaster-partner'),
          subtotalFils: Number(data.subtotalFils || totalFils),
          serviceFeeFils:
            typeof data.serviceFeeFils === 'number'
              ? Number(data.serviceFeeFils)
              : CUSTOMER_SERVICE_FEE_FILS,
          deliveryFeeFils: 0,
          pointsDiscountFils: Number(data.pointsDiscountFils || 0),
          pointsRedeemed: Number(data.pointsRedeemed || 0),
          vatFils: Number(data.vatFils || calculateIncludedVatFils(totalFils)),
          totalFils,
          fulfillmentType: 'pickup',
          paymentMethod:
            (data.paymentMethod as 'apple_pay' | 'credit_card' | 'pickup_cash') || 'apple_pay',
          paymentStatus: data.paymentStatus as StoredServerOrder['paymentStatus'],
          paymentTransactionId: data.paymentTransactionId
            ? String(data.paymentTransactionId)
            : undefined,
          paymentGateway: data.paymentGateway ? String(data.paymentGateway) : undefined,
          status: remoteStatus,
          workflowStatus: (data.workflowStatus || remoteStatus) as OrderWorkflowStatus,
          quantity: Number(firstItem?.quantity || 1),
          item: matchedCatalogItem,
          refundStatus: (data.refundStatus as StoredServerOrder['refundStatus']) || 'none',
          refundReason: data.refundReason ? String(data.refundReason) : undefined,
          refundedAt: data.refundedAt ? String(data.refundedAt) : undefined,
          createdAt: String(data.createdAt || new Date().toISOString()),
          updatedAt: String(data.updatedAt || data.createdAt || new Date().toISOString()),
        };
        if (stored.refundStatus === 'refunded') refundedOrderIds.add(id);
        serverOrdersCache.set(id, stored);
      }
    });
  } catch (err) {
    console.warn('[Orders] Using serverOrdersCache (Firestore Admin offline):', err instanceof Error ? err.message : err);
  }

  let list = Array.from(serverOrdersCache.values());
  if (!filter?.includeAll) {
    if (filter?.merchantId) {
      list = list.filter((o) => o.merchantId === filter.merchantId);
    } else if (filter?.customerId) {
      list = list.filter((o) => o.customerId === filter.customerId);
    } else {
      list = [];
    }
  }

  return list
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    .map(toUiOrder);
}

/**
 * Validates whether an order status is eligible for customer cancellation/refund.
 */
export function isOrderRefundableStatus(status: string): boolean {
  const normalized = String(status || '').toLowerCase().trim();
  return normalized === 'placed' || normalized === 'pending' || normalized === 'new';
}

/**
 * Server-side Refund & Cancellation Validator + Logger.
 * Security Guarantees:
 * - Atomic concurrency lock prevents double-refund race conditions.
 * - Strictly rejects duplicate refunds (refundStatus === 'refunded').
 * - Strictly enforces refund amount <= order.totalFils (never exceeds order total).
 * - Server order record ALWAYS overrides any external status/amount hint when present.
 */
export async function validateAndProcessOrderRefund(params: {
  orderId: string;
  customerId: string;
  requestedBy: string;
  reason: string;
  currentStatusOverride?: string;
  amountFilsOverride?: number;
  allowMissingOrderForTest?: boolean;
}): Promise<{
  success: boolean;
  notFound?: boolean;
  orderId: string;
  refundStatus: 'refunded' | 'rejected';
  refundedAmountFils?: number;
  auditLog: RefundAuditLog;
  messageAr: string;
  messageEn: string;
  error?: string;
}> {
  const {
    orderId,
    customerId,
    requestedBy,
    reason,
    currentStatusOverride,
    amountFilsOverride,
    allowMissingOrderForTest = false,
  } = params;
  const nowIso = new Date().toISOString();

  if (activeRefundLocks.has(orderId)) {
    const lockLog: RefundAuditLog = {
      id: `RLOG-${Date.now()}-${crypto.randomInt(100, 999)}`,
      orderId,
      customerId,
      requestedBy,
      amountFils: 0,
      orderStatusAtRequest: 'locked',
      outcome: 'REJECTED',
      reason: reason || 'Concurrent refund attempt',
      rejectionReason: 'CONCURRENT_REFUND_IN_PROGRESS',
      timestamp: nowIso,
    };
    refundAuditLogs.unshift(lockLog);
    return {
      success: false,
      orderId,
      refundStatus: 'rejected',
      auditLog: lockLog,
      messageAr: 'طلب الاسترداد قيد المعالجة بالفعل.',
      messageEn: 'Refund is already being processed for this order.',
      error: lockLog.rejectionReason,
    };
  }

  activeRefundLocks.add(orderId);
  try {
    let cachedOrder = serverOrdersCache.get(orderId);
    try {
      const orderDoc = await adminDb.collection('orders').doc(orderId).get();
      if (orderDoc.exists) {
        const data = orderDoc.data()!;
        const fallbackItem =
          cachedOrder?.item ||
          (data.itemSnapshot as SurplusItem | undefined) ||
          createEmptyFallbackItem(String(data.merchantId || 'flaster-partner'));
        cachedOrder = {
          id: orderId,
          invoiceNumber: data.invoiceNumber || `INV-2026-01001`,
          code: data.code || 'RAK-0000',
          pickupCode: data.pickupCode || cachedOrder?.pickupCode,
          customerId: data.customerId || customerId,
          customerName: data.customerName || '',
          customerPhone: data.customerPhone || '',
          deliveryAddress: data.deliveryAddress || '',
          merchantId: data.merchantId || '',
          subtotalFils: Number(data.subtotalFils || 0),
          serviceFeeFils:
            typeof data.serviceFeeFils === 'number'
              ? Number(data.serviceFeeFils)
              : CUSTOMER_SERVICE_FEE_FILS,
          deliveryFeeFils: 0,
          pointsDiscountFils: Number(data.pointsDiscountFils || 0),
          pointsRedeemed: Number(data.pointsRedeemed || 0),
          vatFils: Number(data.vatFils || 0),
          totalFils: Number(data.totalFils || 0),
          fulfillmentType: 'pickup',
          paymentMethod: data.paymentMethod || 'apple_pay',
          status: data.status || 'placed',
          workflowStatus: (data.workflowStatus || data.status || 'placed') as OrderWorkflowStatus,
          quantity: cachedOrder?.quantity || 1,
          item: fallbackItem,
          refundStatus: data.refundStatus || cachedOrder?.refundStatus || 'none',
          createdAt: data.createdAt || nowIso,
          updatedAt: nowIso,
        };
        serverOrdersCache.set(orderId, cachedOrder);
      }
    } catch (err) {
      console.warn('[Refund] Falling back to server cache:', err instanceof Error ? err.message : err);
    }

    if (!cachedOrder && !allowMissingOrderForTest) {
      const notFoundLog: RefundAuditLog = {
        id: `RLOG-${Date.now()}-${crypto.randomInt(100, 999)}`,
        orderId,
        customerId,
        requestedBy,
        amountFils: 0,
        orderStatusAtRequest: 'not_found',
        outcome: 'REJECTED',
        reason: reason || 'Order not found',
        rejectionReason: 'ORDER_NOT_FOUND',
        timestamp: nowIso,
      };
      refundAuditLogs.unshift(notFoundLog);
      return {
        success: false,
        notFound: true,
        orderId,
        refundStatus: 'rejected',
        auditLog: notFoundLog,
        messageAr: 'الطلب غير موجود.',
        messageEn: 'Order not found.',
        error: 'ORDER_NOT_FOUND',
      };
    }

    // Never allow client overrides when authoritative order record exists
    const authoritativeStatus = cachedOrder
      ? cachedOrder.workflowStatus || cachedOrder.status
      : currentStatusOverride || 'placed';
    const authoritativeMaxFils = cachedOrder
      ? cachedOrder.totalFils
      : Math.max(0, Math.round(amountFilsOverride ?? 0));
    const requestedAmountFils =
      amountFilsOverride !== undefined
        ? Math.round(amountFilsOverride)
        : authoritativeMaxFils;

    // Prevent double-refund
    if (cachedOrder?.refundStatus === 'refunded' || refundedOrderIds.has(orderId)) {
      const rejectedLog: RefundAuditLog = {
        id: `RLOG-${Date.now()}-${crypto.randomInt(100, 999)}`,
        orderId,
        customerId,
        requestedBy,
        amountFils: authoritativeMaxFils,
        orderStatusAtRequest: authoritativeStatus,
        outcome: 'REJECTED',
        reason: reason || 'Duplicate refund request',
        rejectionReason: 'ALREADY_REFUNDED: Order has already been refunded.',
        timestamp: nowIso,
      };
      refundAuditLogs.unshift(rejectedLog);
      return {
        success: false,
        orderId,
        refundStatus: 'rejected',
        auditLog: rejectedLog,
        messageAr: 'تم استرداد مبلغ هذا الطلب مسبقاً ولا يمكن تكرار الاسترداد.',
        messageEn: 'This order has already been refunded.',
        error: rejectedLog.rejectionReason,
      };
    }

    // Prevent refund exceeding authoritative order total
    if (
      !Number.isInteger(requestedAmountFils) ||
      requestedAmountFils < 0 ||
      requestedAmountFils > authoritativeMaxFils
    ) {
      const overAmountLog: RefundAuditLog = {
        id: `RLOG-${Date.now()}-${crypto.randomInt(100, 999)}`,
        orderId,
        customerId,
        requestedBy,
        amountFils: requestedAmountFils,
        orderStatusAtRequest: authoritativeStatus,
        outcome: 'REJECTED',
        reason: reason || 'Invalid refund amount',
        rejectionReason: `REFUND_EXCEEDS_ORDER_TOTAL: Requested ${requestedAmountFils} fils exceeds order total ${authoritativeMaxFils} fils.`,
        timestamp: nowIso,
      };
      refundAuditLogs.unshift(overAmountLog);
      return {
        success: false,
        orderId,
        refundStatus: 'rejected',
        auditLog: overAmountLog,
        messageAr: 'مبلغ الاسترداد المطلوب يتجاوز إجمالي قيمة الطلب.',
        messageEn: 'Refund amount cannot exceed order total.',
        error: overAmountLog.rejectionReason,
      };
    }

    if (!isOrderRefundableStatus(authoritativeStatus)) {
      const rejectionReason = `REFUND_BLOCKED_BY_POLICY: Cannot refund order in status '${authoritativeStatus}'. Refunds are only allowed before the merchant accepts or prepares the order.`;
      const rejectedLog: RefundAuditLog = {
        id: `RLOG-${Date.now()}-${crypto.randomInt(100, 999)}`,
        orderId,
        customerId,
        requestedBy,
        amountFils: requestedAmountFils,
        orderStatusAtRequest: authoritativeStatus,
        outcome: 'REJECTED',
        reason: reason || 'Customer requested cancellation',
        rejectionReason,
        timestamp: nowIso,
      };
      refundAuditLogs.unshift(rejectedLog);

      try {
        await adminDb.collection('refund_logs').doc(rejectedLog.id).set(rejectedLog);
      } catch (err) {
        console.warn('[Refund] Local audit log fallback:', err instanceof Error ? err.message : err);
      }

      return {
        success: false,
        orderId,
        refundStatus: 'rejected',
        auditLog: rejectedLog,
        messageAr: `عذراً، لا يمكن إلغاء أو استرداد الطلب بعد قبول المتجر له أو بدء تحضيره أو استلامه (الحالة الحالية: ${authoritativeStatus}). يُسمح بالاسترداد فقط قبل قبول المتجر للطلب.`,
        messageEn: `Refund denied: Orders can only be cancelled or refunded before the merchant accepts or prepares the order (Current status: ${authoritativeStatus}).`,
        error: rejectionReason,
      };
    }

    // Mark refunded atomically
    refundedOrderIds.add(orderId);

    if (cachedOrder) {
      cachedOrder.status = 'cancelled';
      cachedOrder.workflowStatus = 'cancelled';
      cachedOrder.refundStatus = 'refunded';
      cachedOrder.paymentStatus = 'refunded';
      cachedOrder.refundReason = reason;
      cachedOrder.refundedAt = nowIso;
      cachedOrder.updatedAt = nowIso;
      serverOrdersCache.set(orderId, cachedOrder);

      if (cachedOrder.pointsRedeemed > 0) {
        refundRedeemedPoints(cachedOrder.customerId, orderId);
      }
    }

    const approvedLog: RefundAuditLog = {
      id: `RLOG-${Date.now()}-${crypto.randomInt(100, 999)}`,
      orderId,
      customerId,
      requestedBy,
      amountFils: requestedAmountFils,
      orderStatusAtRequest: authoritativeStatus,
      outcome: 'APPROVED',
      reason: reason || 'Cancelled prior to merchant acceptance',
      timestamp: nowIso,
    };
    refundAuditLogs.unshift(approvedLog);

    try {
      await adminDb
        .collection('orders')
        .doc(orderId)
        .set(
          {
            status: 'cancelled',
            workflowStatus: 'cancelled',
            refundStatus: 'refunded',
            paymentStatus: 'refunded',
            refundReason: reason.slice(0, 300),
            refundedAt: nowIso,
            updatedAt: nowIso,
          },
          { merge: true }
        );
      await adminDb.collection('refund_logs').doc(approvedLog.id).set(approvedLog);
    } catch (err) {
      console.warn('[Refund] Local Firestore persist fallback:', err instanceof Error ? err.message : err);
    }

    return {
      success: true,
      orderId,
      refundStatus: 'refunded',
      refundedAmountFils: requestedAmountFils,
      auditLog: approvedLog,
      messageAr:
        'تمت الموافقة على الاسترداد وإلغاء الطلب بنجاح (قبل قبول المتجر). سيتم إرجاع المبلغ والنقاط فوراً.',
      messageEn: 'Refund approved and order cancelled successfully prior to merchant acceptance.',
    };
  } finally {
    activeRefundLocks.delete(orderId);
  }
}

/**
 * Local fallback verification for pickup codes when Firestore Admin credentials are unavailable.
 * ALWAYS validates code cryptographically using HMAC-SHA256 + crypto.timingSafeEqual + 3-attempt lockout.
 */
export function verifyPickupCodeLocally(params: {
  orderId: string;
  pickupCode: string;
  verifiedBy: string;
}): {
  success: boolean;
  statusCode: number;
  orderId: string;
  status?: string;
  completedAt?: string;
  rewardInfo?: ReturnType<typeof awardPurchaseReward>;
  error?: string;
  message?: string;
} {
  const { orderId, pickupCode, verifiedBy } = params;
  const cached = serverOrdersCache.get(orderId);
  if (!cached) {
    return {
      success: false,
      statusCode: 404,
      orderId,
      error: 'ORDER_NOT_FOUND: الطلب غير موجود',
    };
  }

  if (cached.pickupConsumed || cached.workflowStatus === 'completed' || cached.status === 'collected') {
    return {
      success: false,
      statusCode: 400,
      orderId,
      error: 'ALREADY_CONSUMED: تم استلام هذا الطلب واستهلاك الرمز مسبقاً',
    };
  }

  const now = Date.now();
  if (cached.pickupLockedUntil && now < new Date(cached.pickupLockedUntil).getTime()) {
    const remainingMinutes = Math.ceil((new Date(cached.pickupLockedUntil).getTime() - now) / 60000);
    return {
      success: false,
      statusCode: 429,
      orderId,
      error: `LOCKED_OUT: تم قفل التحقق من هذا الرمز مؤقتاً. المتبقي: ${remainingMinutes} دقيقة.`,
    };
  }

  if (
    cached.workflowStatus !== 'ready' &&
    cached.status !== 'ready' &&
    cached.status !== 'ready_for_pickup'
  ) {
    return {
      success: false,
      statusCode: 400,
      orderId,
      error: `INVALID_STATE: الطلب غير جاهز للاستلام بعد (الحالة الحالية: ${cached.workflowStatus || cached.status})`,
    };
  }

  const pepper = getPickupSecretPepper();
  const providedHash = crypto
    .createHmac('sha256', pepper)
    .update(pickupCode.trim())
    .digest('hex');

  const expectedHash =
    cached.pickupCodeHash ||
    (cached.pickupCode
      ? crypto.createHmac('sha256', pepper).update(cached.pickupCode.trim()).digest('hex')
      : '');

  if (!expectedHash || !timingSafeStringEqual(providedHash, expectedHash)) {
    const newFailed = (cached.pickupFailedAttempts || 0) + 1;
    cached.pickupFailedAttempts = newFailed;
    if (newFailed >= 3) {
      cached.pickupLockedUntil = new Date(now + 30 * 60 * 1000).toISOString();
      serverOrdersCache.set(orderId, cached);
      return {
        success: false,
        statusCode: 429,
        orderId,
        error: 'MAX_ATTEMPTS_EXCEEDED: تم إدخال رمز خاطئ 3 مرات متتالية. تم قفل الطلب لمدة 30 دقيقة.',
      };
    }
    serverOrdersCache.set(orderId, cached);
    return {
      success: false,
      statusCode: 400,
      orderId,
      error: `INVALID_CODE: رمز الاستلام غير صحيح. المحاولات المتبقية: ${3 - newFailed}`,
    };
  }

  const nowIso = new Date().toISOString();
  cached.status = 'completed';
  cached.workflowStatus = 'completed';
  cached.pickupConsumed = true;
  cached.updatedAt = nowIso;
  serverOrdersCache.set(orderId, cached);

  const rewardInfo = cached.customerId
    ? awardPurchaseReward(cached.customerId, orderId)
    : undefined;

  return {
    success: true,
    statusCode: 200,
    orderId,
    status: 'completed',
    completedAt: nowIso,
    rewardInfo,
    message: `تم التحقق من رمز الاستلام بنجاح (${verifiedBy})، واكتمل تسليم الوجبة!`,
  };
}

/**
 * Creates an order authoritatively, resolving prices STRICTLY from server catalog / Firestore
 * (never trusting client-supplied itemSnapshot prices).
 * All monetary math uses integer UAE Fils (1 AED = 100 Fils).
 */
export async function createOrderAtomic(params: CreateOrderParams): Promise<CreateOrderResult> {
  const {
    customerId,
    customerName = 'Customer',
    customerPhone = '',
    merchantId,
    items,
    paymentMethod = 'apple_pay',
    paymentStatus,
    paymentTransactionId,
    paymentGateway,
    idempotencyKey,
    pointsToRedeem = 0,
  } = params;
  // Self-pickup ONLY across the entire platform (no delivery option)
  const effectiveFulfillmentType: FulfillmentType = 'pickup';
  const deliveryAddress = '';

  if (!customerId) throw new Error('customerId is mandatory');
  if (!merchantId) throw new Error('merchantId is mandatory');
  if (!items || items.length === 0) throw new Error('At least one item is required');
  if (!idempotencyKey) throw new Error('idempotencyKey is mandatory');
  if (!Number.isInteger(pointsToRedeem) || pointsToRedeem < 0) {
    return {
      success: false,
      error: 'INVALID_POINTS: pointsToRedeem must be a non-negative integer',
    };
  }

  const itemQuantities = new Map<string, number>();
  for (const it of items) {
    if (!it.itemId || typeof it.itemId !== 'string' || it.quantity <= 0 || !Number.isInteger(it.quantity)) {
      return {
        success: false,
        error: `INVALID_ITEM_QUANTITY: Invalid item or integer quantity for item ${it.itemId}`,
      };
    }
    itemQuantities.set(it.itemId, (itemQuantities.get(it.itemId) || 0) + it.quantity);
  }

  const payloadHash = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        customerId,
        merchantId,
        items: Array.from(itemQuantities.entries()),
        fulfillmentType: effectiveFulfillmentType,
        pointsToRedeem,
      })
    )
    .digest('hex');

  // Check in-memory idempotency first
  const cachedIdem = serverIdempotencyCache.get(idempotencyKey);
  if (cachedIdem) {
    if (cachedIdem.customerId === customerId && cachedIdem.payloadHash === payloadHash) {
      return { ...cachedIdem.result, idempotentReplay: true };
    }
    return {
      success: false,
      conflict: true,
      error: 'IDEMPOTENCY_CONFLICT: Key reused with different payload',
    };
  }

  const orderId = `FLS-ORD-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const invoiceNumber = getNextSequentialInvoiceNumber();
  const rawPickupCode = String(crypto.randomInt(100000, 1000000));
  const serverPepper = getPickupSecretPepper();
  const pickupCodeHash = crypto
    .createHmac('sha256', serverPepper)
    .update(rawPickupCode)
    .digest('hex');
  const nowIso = new Date().toISOString();

  // Compute totals STRICTLY from Firestore surplus_items or authoritative serverCatalogItems
  let subtotalFils = 0;
  let totalQuantity = 0;
  let primaryItem: SurplusItem | null = null;
  const firestoreStockUpdates: { itemId: string; newStock: number; status: string }[] = [];
  const orderItemsSnapshot: {
    itemId: string;
    titleAr: string;
    titleEn: string;
    quantity: number;
    unitPriceFils: number;
    totalPriceFils: number;
  }[] = [];

  for (const [itemId, requestedQty] of itemQuantities) {
    let resolvedUnitFils = 0;
    let resolvedTitleAr = '';
    let resolvedTitleEn = '';
    let resolvedStock = 0;
    let resolvedActive = false;
    let hasFirestoreDoc = false;

    try {
      const itemSnap = await adminDb.collection('surplus_items').doc(itemId).get();
      if (itemSnap.exists) {
        hasFirestoreDoc = true;
        const fsData = itemSnap.data() as FirestoreSurplusItem;
        resolvedUnitFils = Math.round(fsData.discountedPriceFils);
        resolvedTitleAr = fsData.titleAr;
        resolvedTitleEn = fsData.titleEn;
        resolvedStock = fsData.stockRemaining;
        resolvedActive = fsData.status === 'active';
      }
    } catch {
      // Firestore Admin unavailable locally; fall back to authoritative server catalog
    }

    const catalogItem = serverCatalogItems.get(itemId) || null;
    if (!hasFirestoreDoc) {
      if (!catalogItem) {
        return {
          success: false,
          error: `ITEM_NOT_FOUND: Surplus item ${itemId} does not exist in authoritative server catalog`,
        };
      }
      resolvedUnitFils = Math.round(
        catalogItem.discountedPriceFils ?? Math.round(catalogItem.discountedPrice * 100)
      );
      resolvedTitleAr = catalogItem.title.ar;
      resolvedTitleEn = catalogItem.title.en;
      resolvedStock = inMemoryStockOverrides.has(itemId)
        ? inMemoryStockOverrides.get(itemId)!
        : catalogItem.stockRemaining;
      resolvedActive = resolvedStock > 0;
    }

    if (!primaryItem && catalogItem) {
      primaryItem = catalogItem;
    }

    if (resolvedStock < requestedQty) {
      return {
        success: false,
        error: `INSUFFICIENT_STOCK: نفد المخزون المطلوب لـ (${resolvedTitleAr}). المتبقي حالياً: ${resolvedStock} وجبات فقط.`,
      };
    }

    if (!resolvedActive) {
      return {
        success: false,
        error: `ITEM_NOT_ACTIVE: العرض (${resolvedTitleAr}) غير متاح حالياً للطلب.`,
      };
    }

    const newStock = resolvedStock - requestedQty;
    const newStatus = newStock === 0 ? 'sold_out' : 'active';
    inMemoryStockOverrides.set(itemId, newStock);
    if (hasFirestoreDoc) {
      firestoreStockUpdates.push({ itemId, newStock, status: newStatus });
    }

    const itemTotalFils = resolvedUnitFils * requestedQty;
    subtotalFils += itemTotalFils;
    totalQuantity += requestedQty;

    orderItemsSnapshot.push({
      itemId,
      titleAr: resolvedTitleAr,
      titleEn: resolvedTitleEn,
      quantity: requestedQty,
      unitPriceFils: resolvedUnitFils,
      totalPriceFils: itemTotalFils,
    });
  }

  // Self-pickup only (0 delivery fee) + Fixed immutable 1.50 AED (150 fils) per item blended into customer display price
  const deliveryFeeFils = 0;
  const serviceFeeFils = CUSTOMER_SERVICE_FEE_FILS * Math.max(1, totalQuantity);
  const commissionPercent = getMerchantCommissionPercent(merchantId);
  const platformCommissionFils = Math.round((subtotalFils * commissionPercent) / 100);
  const merchantEarningsFils = subtotalFils - platformCommissionFils;

  let pointsDiscountFils = 0;
  let actuallyRedeemedPoints = 0;
  if (pointsToRedeem > 0) {
    const redemption = redeemPointsForOrder({
      customerId,
      orderId,
      pointsToRedeem,
      orderSubtotalFils: subtotalFils,
    });
    if (!redemption.success) {
      return {
        success: false,
        error: `LOYALTY_REDEMPTION_FAILED: ${redemption.error}`,
      };
    }
    pointsDiscountFils = redemption.discountFils;
    actuallyRedeemedPoints = redemption.pointsRedeemed;
  }

  const totalFils = Math.max(0, subtotalFils + serviceFeeFils - pointsDiscountFils);
  const vatFils = calculateIncludedVatFils(totalFils);
  const orderCode = `RAK-${rawPickupCode.slice(0, 4)}`;
  const resolvedPaymentStatus =
    paymentStatus || (paymentMethod === 'pickup_cash' ? 'pending_cash' : 'paid');

  // Record in finance ledger with fixed 1.50 AED service fee
  calculateOrderFinancials({
    orderId,
    merchantId,
    subtotalFils,
    serviceFeeFils,
    deliveryFeeFils: 0,
    pointsDiscountFils,
    commissionRatePercent: commissionPercent,
    paymentMethod,
    invoiceNumber,
  });

  const storedOrder: StoredServerOrder = {
    id: orderId,
    invoiceNumber,
    code: orderCode,
    pickupCode: rawPickupCode,
    pickupCodeHash,
    pickupFailedAttempts: 0,
    pickupConsumed: false,
    customerId,
    customerName,
    customerPhone,
    deliveryAddress,
    merchantId,
    subtotalFils,
    serviceFeeFils,
    deliveryFeeFils: 0,
    pointsDiscountFils,
    pointsRedeemed: actuallyRedeemedPoints,
    vatFils,
    totalFils,
    fulfillmentType: effectiveFulfillmentType,
    paymentMethod,
    paymentStatus: resolvedPaymentStatus,
    paymentTransactionId,
    paymentGateway,
    status: 'placed',
    workflowStatus: 'placed',
    quantity: totalQuantity,
    item: primaryItem || createEmptyFallbackItem(merchantId),
    refundStatus: 'none',
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  registerOrderInServerCache(storedOrder);

  try {
    await adminDb.runTransaction(async (transaction: any) => {
      const idempotencyRef = adminDb.collection('idempotency_keys').doc(idempotencyKey);
      const idempotencyDoc = await transaction.get(idempotencyRef);
      if (idempotencyDoc.exists) {
        return;
      }

      for (const update of firestoreStockUpdates) {
        const itemRef = adminDb.collection('surplus_items').doc(update.itemId);
        transaction.update(itemRef, {
          stockRemaining: update.newStock,
          status: update.status,
          updatedAt: nowIso,
        });
      }

      const orderRef = adminDb.collection('orders').doc(orderId);
      transaction.set(orderRef, {
        id: orderId,
        invoiceNumber,
        code: orderCode,
        pickupCode: rawPickupCode,
        customerId,
        customerName,
        customerPhone,
        deliveryAddress,
        merchantId,
        items: orderItemsSnapshot,
        itemSnapshot: primaryItem || createEmptyFallbackItem(merchantId),
        subtotalFils,
        serviceFeeFils,
        deliveryFeeFils: 0,
        platformCommissionFils,
        merchantEarningsFils,
        pointsRedeemed: actuallyRedeemedPoints,
        pointsDiscountFils,
        platformLoyaltyExpenseFils: pointsDiscountFils,
        vatFils,
        totalFils,
        fulfillmentType: effectiveFulfillmentType,
        paymentMethod,
        paymentStatus: resolvedPaymentStatus,
        ...(paymentTransactionId ? { paymentTransactionId } : {}),
        ...(paymentGateway ? { paymentGateway } : {}),
        status: 'placed',
        workflowStatus: 'placed',
        refundStatus: 'none',
        pickupCodeHash,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      const secretRef = adminDb.collection('pickup_secrets').doc(orderId);
      transaction.set(secretRef, {
        orderId,
        pickupCodeHash,
        failedAttempts: 0,
        consumed: false,
        expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        createdAt: nowIso,
      });

      transaction.set(idempotencyRef, {
        idempotencyKey,
        customerId,
        payloadHash,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        createdAt: nowIso,
      });
    });
  } catch (err) {
    console.warn('[Order] Local transaction cache used (Firestore Admin offline):', err instanceof Error ? err.message : err);
  }

  const finalResult: CreateOrderResult = {
    success: true,
    orderId,
    invoiceNumber,
    code: orderCode,
    pickupCode: rawPickupCode,
    totalFils,
    vatFils,
    serviceFeeFils,
    deliveryFeeFils: 0,
    subtotalFils,
    pointsRedeemed: actuallyRedeemedPoints,
    pointsDiscountFils,
    order: {
      ...toUiOrder(storedOrder),
      serviceFeeFils,
      serviceFeeAed: CUSTOMER_SERVICE_FEE_AED,
    },
  };

  serverIdempotencyCache.set(idempotencyKey, {
    customerId,
    payloadHash,
    result: finalResult,
  });

  return finalResult;
}
