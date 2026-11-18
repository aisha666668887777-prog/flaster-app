import express from 'express';
import crypto from 'crypto';
import {
  createOrderAtomic,
  validateAndProcessOrderRefund,
  getRefundAuditLogs,
  getServerOrder,
  getAllOrdersSynced,
  registerOrderInServerCache,
  registerServerCatalogItem,
  getServerCatalogItem,
  getMerchantCatalogItems,
  verifyPickupCodeLocally,
} from './orderService.ts';
import type { SurplusItem } from '../types/index.ts';
import {
  adminDb,
  getPickupSecretPepper,
  requireAdminAuth,
  requireMerchantOrAdminAuth,
  resolveCallerIdentity,
  timingSafeStringEqual,
} from './adminAuth.ts';
import { awardPurchaseReward, refundRedeemedPoints } from './loyaltyService.ts';

const router = express.Router();

/**
 * Valid state transitions for the order status flow:
 * placed -> accepted -> preparing -> ready -> picked_up / delivered -> completed / cancelled
 */
export function isValidTransition(currentStatus: string, newStatus: string): boolean {
  const curr = currentStatus.toLowerCase();
  const next = newStatus.toLowerCase();

  if (curr === 'placed' || curr === 'pending' || curr === 'new') {
    return next === 'accepted' || next === 'preparing' || next === 'cancelled';
  }
  if (curr === 'accepted') {
    return (
      next === 'preparing' ||
      next === 'ready' ||
      next === 'ready_for_pickup' ||
      next === 'cancelled'
    );
  }
  if (curr === 'preparing') {
    return (
      next === 'ready' ||
      next === 'ready_for_pickup' ||
      next === 'out_for_delivery' ||
      next === 'cancelled'
    );
  }
  if (curr === 'ready' || curr === 'ready_for_pickup') {
    return (
      next === 'picked_up' ||
      next === 'out_for_delivery' ||
      next === 'delivered' ||
      next === 'completed' ||
      next === 'collected'
    );
  }
  if (curr === 'picked_up' || curr === 'out_for_delivery' || curr === 'delivered') {
    return next === 'completed' || next === 'collected' || next === 'delivered';
  }
  return false; // completed / collected / cancelled are terminal
}

/**
 * 0. GET /api/orders
 * Returns orders scoped by authenticated caller role:
 * - Admin / Portal Admin: all orders
 * - Merchant: strictly ONLY their restaurant's orders from the verified portalToken (never from query/body)
 * - Customer: only their own orders (matching Firebase UID or x-customer-id)
 */
router.get('/', async (req, res) => {
  try {
    const caller = await resolveCallerIdentity(req);
    if (caller.tokenError) {
      return res.status(caller.tokenStatusCode || 401).json({
        success: false,
        error: caller.tokenError,
        orders: [],
      });
    }

    const isAdminOrStaff =
      caller.role === 'super_admin' ||
      caller.role === 'ops_admin' ||
      caller.role === 'founder_admin';

    if (isAdminOrStaff) {
      const queryMerchantId =
        typeof req.query.merchantId === 'string' && req.query.merchantId.trim()
          ? req.query.merchantId.trim()
          : undefined;
      const orders = queryMerchantId
        ? await getAllOrdersSynced({ merchantId: queryMerchantId })
        : await getAllOrdersSynced({ includeAll: true });
      return res.status(200).json({ success: true, orders });
    }

    if (caller.role === 'merchant') {
      if (!caller.merchantId) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: توكن المطعم لا يحتوي على معرف المطعم',
          orders: [],
        });
      }
      const queryMerchantId =
        typeof req.query.merchantId === 'string' ? req.query.merchantId.trim() : '';
      if (queryMerchantId && queryMerchantId !== caller.merchantId) {
        return res.status(403).json({
          success: false,
          error: 'Forbidden: لا يمكنك عرض طلبات مطعم آخر نهائياً',
          orders: [],
        });
      }
      const orders = await getAllOrdersSynced({ merchantId: caller.merchantId });
      return res.status(200).json({ success: true, orders });
    }

    const headerCustomerId = req.headers['x-customer-id'];
    const requestedCustomerId =
      caller.uid || (typeof headerCustomerId === 'string' ? headerCustomerId.trim() : '');
    const orders = await getAllOrdersSynced({
      customerId: requestedCustomerId || undefined,
    });
    return res.status(200).json({ success: true, orders });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: errorMsg, orders: [] });
  }
});

/**
 * 0a. GET /api/orders/catalog (Merchant or Admin only)
 * Returns catalog items strictly filtered by caller.merchantId for merchants.
 */
router.get('/catalog', requireMerchantOrAdminAuth, (req, res) => {
  const caller = (req as express.Request & { caller?: { role: string; merchantId?: string } }).caller;
  if (caller?.role === 'merchant') {
    const queryMerchantId =
      typeof req.query.merchantId === 'string' ? req.query.merchantId.trim() : '';
    if (!caller.merchantId || (queryMerchantId && queryMerchantId !== caller.merchantId)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: لا يمكنك عرض عناصر مطعم آخر',
      });
    }
    return res.status(200).json({
      success: true,
      items: getMerchantCatalogItems(caller.merchantId),
    });
  }
  return res.status(200).json({
    success: true,
    items: getMerchantCatalogItems(),
  });
});

/**
 * 0b. POST /api/orders/catalog (Merchant or Admin only)
 * Registers or updates a surplus item authoritatively on the server catalog.
 * Strictly binds item.merchant.id to caller.merchantId from the token and rejects cross-merchant edits (403).
 */
router.post('/catalog', requireMerchantOrAdminAuth, (req, res) => {
  const caller = (req as express.Request & { caller?: { role: string; merchantId?: string } }).caller;
  const { item, merchantId: bodyMerchantId } = (req.body || {}) as {
    item?: SurplusItem;
    merchantId?: string;
  };
  if (!item || !item.id || typeof item.discountedPrice !== 'number' || item.discountedPrice < 0) {
    return res.status(400).json({ success: false, error: 'بيانات العرض غير صالحة' });
  }

  const existingItem = getServerCatalogItem(item.id);

  if (caller?.role === 'merchant') {
    if (!caller.merchantId) {
      return res.status(403).json({ success: false, error: 'Forbidden: Missing merchantId in token' });
    }
    if (
      (bodyMerchantId && bodyMerchantId !== caller.merchantId) ||
      (item.merchant?.id && item.merchant.id !== caller.merchantId) ||
      (existingItem && existingItem.merchant?.id && existingItem.merchant.id !== caller.merchantId)
    ) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: لا يمكنك إضافة أو تعديل عنصر يخص مطعماً آخر',
      });
    }
  }

  const discountedFils =
    typeof item.discountedPriceFils === 'number' && Number.isInteger(item.discountedPriceFils)
      ? item.discountedPriceFils
      : Math.round(item.discountedPrice * 100);
  const originalFils =
    typeof item.originalPriceFils === 'number' && Number.isInteger(item.originalPriceFils)
      ? item.originalPriceFils
      : Math.round((item.originalPrice || item.discountedPrice) * 100);

  const authoritativeMerchantId =
    caller?.role === 'merchant'
      ? caller.merchantId!
      : item.merchant?.id || bodyMerchantId || 'merchant-alsharisha-heritage';

  registerServerCatalogItem({
    ...item,
    merchant: {
      ...(item.merchant || existingItem?.merchant || {
        id: authoritativeMerchantId,
        name: authoritativeMerchantId,
        neighborhood: 'Ras Al Khaimah',
        neighborhoodAr: 'رأس الخيمة',
        rating: 4.9,
        logo: '',
        verified: true,
        lat: 25.765,
        lng: 55.932,
      }),
      id: authoritativeMerchantId,
    },
    discountedPriceFils: discountedFils,
    originalPriceFils: originalFils,
  });
  return res.status(201).json({
    success: true,
    itemId: item.id,
    merchantId: authoritativeMerchantId,
  });
});

/**
 * 1. POST /api/orders/create
 * Authoritatively resolves item pricing & loyalty discounts on server (ignores client price fields).
 */
router.post('/create', async (req, res) => {
  try {
    const {
      customerId,
      customerName,
      customerPhone,
      deliveryAddress,
      merchantId,
      items,
      fulfillmentType,
      paymentMethod,
      paymentStatus,
      paymentTransactionId,
      paymentGateway,
      idempotencyKey,
      pointsToRedeem,
    } = req.body || {};

    if (!customerId || !merchantId || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'بيانات الطلب غير مكتملة (customerId, merchantId, items مطلوبة)',
      });
    }

    const caller = await resolveCallerIdentity(req);
    // If Firebase-authenticated customer, bind customerId to verified UID unless staff
    const resolvedCustomerId =
      caller.authenticated && caller.role === 'customer' && caller.uid && !String(customerId).startsWith('+')
        ? caller.uid
        : String(customerId);

    const key =
      typeof idempotencyKey === 'string' && idempotencyKey.trim()
        ? idempotencyKey.trim()
        : `IDEM-${resolvedCustomerId}-${Date.now()}`;

    const sanitizedItems = (items as Array<{ itemId?: string; quantity?: number }>).map((it) => ({
      itemId: String(it?.itemId || ''),
      quantity: Number(it?.quantity || 0),
    }));

    const orderResult = await createOrderAtomic({
      customerId: resolvedCustomerId,
      customerName,
      customerPhone,
      deliveryAddress,
      merchantId,
      items: sanitizedItems,
      fulfillmentType: fulfillmentType === 'delivery' ? 'delivery' : 'pickup',
      paymentMethod:
        paymentMethod === 'pickup_cash' || paymentMethod === 'credit_card'
          ? paymentMethod
          : 'apple_pay',
      paymentStatus,
      paymentTransactionId,
      paymentGateway,
      idempotencyKey: key,
      pointsToRedeem: typeof pointsToRedeem === 'number' ? pointsToRedeem : 0,
    });

    if (!orderResult.success) {
      return res.status(orderResult.conflict ? 409 : 400).json(orderResult);
    }

    return res.status(201).json(orderResult);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: errorMsg });
  }
});

/**
 * 2. POST /api/orders/refund
 * Strictly server-validated refund/cancel endpoint:
 * - Never trusts currentStatus or amountFils from request body.
 * - Verifies caller owns the order (or is Admin).
 * - Prevents duplicate refunds and caps refund <= order total.
 */
router.post('/refund', async (req, res) => {
  try {
    const {
      orderId,
      customerId = 'anonymous',
      requestedBy = 'customer',
      reason = 'Customer requested cancellation prior to preparation',
    } = req.body || {};

    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'رقم الطلب (orderId) مطلوب لإجراء الاسترداد / orderId is required',
      });
    }

    const caller = await resolveCallerIdentity(req);
    const serverOrder = getServerOrder(orderId);
    const isAdminOrStaff =
      caller.role === 'super_admin' ||
      caller.role === 'ops_admin' ||
      caller.role === 'founder_admin';

    if (serverOrder && !isAdminOrStaff) {
      const headerCustomerId =
        typeof req.headers['x-customer-id'] === 'string' ? req.headers['x-customer-id'].trim() : '';
      const requesterId = caller.authenticated
        ? caller.uid || ''
        : headerCustomerId || String(customerId);
      const ownsOrder =
        Boolean(requesterId) &&
        (serverOrder.customerId === requesterId ||
          (Boolean(serverOrder.customerPhone) && serverOrder.customerPhone === requesterId));
      if (!ownsOrder) {
        return res.status(403).json({
          success: false,
          refundStatus: 'rejected',
          error: 'Forbidden: لا يمكنك طلب استرداد لطلب لا يخص حسابك.',
        });
      }
    }

    const result = await validateAndProcessOrderRefund({
      orderId,
      customerId: String(caller.uid || customerId),
      requestedBy: String(caller.email || caller.uid || requestedBy),
      reason: String(reason),
      // Deliberately omit any client currentStatusOverride or amountFilsOverride!
    });

    if (!result.success) {
      return res.status(result.notFound ? 404 : 400).json(result);
    }

    return res.status(200).json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: errorMsg });
  }
});

/**
 * 2b. GET /api/orders/refund-logs (Admin only)
 */
router.get('/refund-logs', requireAdminAuth, (_req, res) => {
  return res.json({
    success: true,
    logs: getRefundAuditLogs(),
  });
});

/**
 * 3. POST /api/orders/verify-pickup (Merchant or Admin only)
 * Verifies 6-digit pickup code cryptographically via HMAC-SHA256 + crypto.timingSafeEqual
 */
router.post('/verify-pickup', requireMerchantOrAdminAuth, async (req, res) => {
  try {
    const { orderId, pickupCode, verifiedBy = 'store_counter', customerId } = req.body || {};

    if (
      !orderId ||
      !pickupCode ||
      typeof pickupCode !== 'string' ||
      !/^\d{6}$/.test(pickupCode.trim())
    ) {
      return res.status(400).json({
        success: false,
        error: 'رمز الاستلام غير صالح (يجب أن يتكون من 6 أرقام)',
      });
    }

    const caller = (req as express.Request & { caller?: { role: string; merchantId?: string } }).caller;
    const cachedCheck = getServerOrder(orderId);
    if (
      caller?.role === 'merchant' &&
      caller.merchantId &&
      cachedCheck &&
      cachedCheck.merchantId !== caller.merchantId
    ) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: هذا الطلب يتبع لمطعم آخر.',
      });
    }

    const serverPepper = getPickupSecretPepper();
    const computedHash = crypto
      .createHmac('sha256', serverPepper)
      .update(pickupCode.trim())
      .digest('hex');

    let resolvedCustomerId = customerId;

    try {
      const result = await adminDb.runTransaction(async (transaction) => {
        const secretRef = adminDb.collection('pickup_secrets').doc(orderId);
        const secretDoc = await transaction.get(secretRef);

        if (!secretDoc.exists) {
          throw new Error('NOT_FOUND: وثيقة التحقق من الاستلام غير موجودة');
        }

        const secretData = secretDoc.data()!;
        if (secretData.consumed === true) {
          throw new Error('ALREADY_CONSUMED: تم استلام هذا الطلب واستهلاك الرمز مسبقاً');
        }

        const now = Date.now();
        if (secretData.lockedUntil && now < new Date(secretData.lockedUntil).getTime()) {
          const remainingMinutes = Math.ceil(
            (new Date(secretData.lockedUntil).getTime() - now) / 60000
          );
          throw new Error(
            `LOCKED_OUT: تم قفل التحقق من هذا الرمز مؤقتاً. المتبقي: ${remainingMinutes} دقيقة.`
          );
        }

        const orderRef = adminDb.collection('orders').doc(orderId);
        const orderDoc = await transaction.get(orderRef);
        if (!orderDoc.exists) {
          throw new Error('ORDER_NOT_FOUND: الطلب غير موجود');
        }

        const orderData = orderDoc.data()!;
        if (
          caller?.role === 'merchant' &&
          caller.merchantId &&
          orderData.merchantId !== caller.merchantId
        ) {
          throw new Error('FORBIDDEN: هذا الطلب يتبع لمطعم آخر');
        }

        resolvedCustomerId = orderData.customerId || resolvedCustomerId;

        if (
          orderData.status !== 'ready_for_pickup' &&
          orderData.status !== 'ready' &&
          orderData.workflowStatus !== 'ready'
        ) {
          throw new Error(
            `INVALID_STATE: الطلب غير جاهز للاستلام بعد (الحالة الحالية: ${orderData.status})`
          );
        }

        const isMatch = timingSafeStringEqual(
          String(secretData.pickupCodeHash || ''),
          computedHash
        );

        if (!isMatch) {
          const newFailed = (secretData.failedAttempts || 0) + 1;
          const updates: Record<string, unknown> = { failedAttempts: newFailed };

          if (newFailed >= 3) {
            const lockUntil = new Date(now + 30 * 60 * 1000).toISOString();
            updates.lockedUntil = lockUntil;
            transaction.update(secretRef, updates);
            throw new Error(
              'MAX_ATTEMPTS_EXCEEDED: تم إدخال رمز خاطئ 3 مرات متتالية. تم قفل الطلب لمدة 30 دقيقة.'
            );
          }

          transaction.update(secretRef, updates);
          throw new Error(`INVALID_CODE: رمز الاستلام غير صحيح. المحاولات المتبقية: ${3 - newFailed}`);
        }

        const nowIso = new Date().toISOString();
        transaction.update(orderRef, {
          status: 'completed',
          workflowStatus: 'completed',
          completedAt: nowIso,
          verifiedBy,
          updatedAt: nowIso,
        });

        transaction.update(secretRef, {
          consumed: true,
          consumedAt: nowIso,
        });

        return {
          success: true,
          orderId,
          status: 'completed',
          completedAt: nowIso,
          message: 'تم التحقق من رمز الاستلام بنجاح، واكتمل تسليم الوجبة!',
        };
      });

      const rewardInfo = resolvedCustomerId
        ? awardPurchaseReward(resolvedCustomerId, orderId)
        : undefined;

      return res.status(200).json({ ...result, rewardInfo });
    } catch (txErr: unknown) {
      const msg = txErr instanceof Error ? txErr.message : String(txErr);
      if (msg.includes('FORBIDDEN')) {
        return res.status(403).json({ success: false, error: msg });
      }
      if (
        msg.includes('INVALID_CODE') ||
        msg.includes('LOCKED_OUT') ||
        msg.includes('MAX_ATTEMPTS') ||
        msg.includes('ALREADY_CONSUMED') ||
        msg.includes('INVALID_STATE')
      ) {
        const statusCode = msg.includes('LOCKED_OUT') || msg.includes('MAX_ATTEMPTS') ? 429 : 400;
        return res.status(statusCode).json({ success: false, error: msg });
      }

      // When Firestore Admin credentials are unavailable locally, STILL enforce cryptographic HMAC-SHA256 verification!
      const localResult = verifyPickupCodeLocally({
        orderId,
        pickupCode: pickupCode.trim(),
        verifiedBy,
      });
      if (!localResult.success) {
        return res.status(localResult.statusCode).json({
          success: false,
          error: localResult.error,
        });
      }
      return res.status(200).json(localResult);
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return res.status(400).json({ success: false, error: errorMsg });
  }
});

/**
 * 4. POST /api/orders/update-status (Merchant or Admin only)
 * Manages order status flow:
 * placed -> accepted -> preparing -> ready -> picked_up / delivered -> completed / cancelled
 */
router.post('/update-status', requireMerchantOrAdminAuth, async (req, res) => {
  try {
    const {
      orderId,
      newStatus,
      customerId,
      merchantNotes,
      cancellationReason,
    } = req.body || {};

    if (!orderId || !newStatus) {
      return res.status(400).json({ success: false, error: 'orderId و newStatus مطلوبة' });
    }

    const caller = (req as express.Request & { caller?: { role: string; merchantId?: string } }).caller;
    const nowIso = new Date().toISOString();
    const cached = getServerOrder(orderId);
    if (!cached) {
      return res.status(404).json({ success: false, error: 'ORDER_NOT_FOUND: الطلب غير موجود' });
    }

    if (caller?.role === 'merchant' && caller.merchantId && cached.merchantId !== caller.merchantId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: لا يمكن للمتجر تعديل طلب لا يخص مطعمه.',
      });
    }

    const currentStatus = cached.workflowStatus || cached.status || 'placed';
    const normalizedWorkflow = newStatus === 'ready_for_pickup' ? 'ready' : newStatus;

    if (!isValidTransition(currentStatus, newStatus)) {
      return res.status(400).json({
        success: false,
        error: `غير مصرح بالانتقال من الحالة (${currentStatus}) إلى (${newStatus})`,
      });
    }

    cached.status = normalizedWorkflow;
    cached.workflowStatus = normalizedWorkflow;
    cached.updatedAt = nowIso;
    registerOrderInServerCache(cached);

    let rewardInfo = undefined;
    const effectiveCustomerId = customerId || cached.customerId;
    if (
      (newStatus === 'completed' || newStatus === 'collected' || newStatus === 'delivered' || newStatus === 'picked_up') &&
      effectiveCustomerId
    ) {
      rewardInfo = awardPurchaseReward(effectiveCustomerId, orderId);
    }

    if (newStatus === 'cancelled' && effectiveCustomerId && cached.pointsRedeemed > 0) {
      refundRedeemedPoints(effectiveCustomerId, orderId);
    }

    try {
      const orderRef = adminDb.collection('orders').doc(orderId);
      await orderRef.set(
        {
          status: normalizedWorkflow,
          workflowStatus: normalizedWorkflow,
          ...(merchantNotes ? { merchantNotes: String(merchantNotes).slice(0, 300) } : {}),
          ...(cancellationReason ? { cancellationReason: String(cancellationReason).slice(0, 300) } : {}),
          updatedAt: nowIso,
        },
        { merge: true }
      );
    } catch (err) {
      console.warn('[OrderStatus] Local cache updated (Firestore offline):', err instanceof Error ? err.message : err);
    }

    return res.status(200).json({
      success: true,
      orderId,
      previousStatus: currentStatus,
      newStatus,
      rewardInfo,
      updatedAt: nowIso,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: errorMsg });
  }
});

export default router;
