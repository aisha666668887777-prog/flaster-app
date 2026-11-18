import express from 'express';
import {
  processPaymentIntent,
  getPaymentTransaction,
  getPaymentGatewayConfig,
  createHostedPaymentIntent,
  verifyHostedPaymentIntent,
  confirmSandboxPayment,
  handleZiinaWebhook,
  registerZiinaWebhook,
  handleStripeWebhook,
} from './paymentService.ts';
import { getServerOrder } from './orderService.ts';
import { requireAdminAuth, requireMerchantOrAdminAuth } from './adminAuth.ts';
import type { RequestWithRawBody } from './app.ts';

const router = express.Router();

/**
 * 1. GET /api/payments/gateway-status
 * Returns gateway readiness (Ziina UAE / Stripe UAE / Sandbox mode)
 */
router.get('/gateway-status', (_req, res) => {
  const config = getPaymentGatewayConfig();
  return res.json({ success: true, gateway: config });
});

/**
 * 2. POST /api/payments/create-intent
 * Creates a real Ziina v2 or Stripe Checkout payment intent (or sandbox intent when unconfigured).
 * Enforces integer UAE Fils and validates against order total when orderId is provided.
 */
router.post('/create-intent', async (req, res) => {
  try {
    const { amountFils, paymentMethod, message, originUrl, customerEmail, orderId } = req.body || {};

    if (typeof amountFils !== 'number' || !Number.isInteger(amountFils) || amountFils <= 0) {
      return res.status(400).json({
        success: false,
        error: 'المبلغ المطلوب بالدفع يجب أن يكون عدداً صحيحاً بالفلس (amountFils مطلوب).',
      });
    }

    let authoritativeAmountFils = amountFils;
    if (typeof orderId === 'string' && orderId.trim()) {
      const serverOrder = getServerOrder(orderId.trim());
      if (!serverOrder) {
        return res.status(404).json({
          success: false,
          error: 'الطلب المرتبط غير موجود على الخادم.',
        });
      }
      authoritativeAmountFils = serverOrder.totalFils;
    }

    const method = paymentMethod === 'credit_card' ? 'credit_card' : 'apple_pay';
    const requestOrigin =
      (typeof originUrl === 'string' && originUrl.startsWith('http') ? originUrl : '') ||
      (typeof req.headers.origin === 'string' && req.headers.origin.startsWith('http')
        ? req.headers.origin
        : '') ||
      process.env.APP_URL ||
      'https://flaster.ae';

    const result = await createHostedPaymentIntent({
      amountFils: authoritativeAmountFils,
      paymentMethod: method,
      message: typeof message === 'string' && message.trim() ? message : 'Flaster UAE Rescue Order',
      originUrl: requestOrigin,
      customerEmail: typeof customerEmail === 'string' ? customerEmail : undefined,
      orderId: typeof orderId === 'string' && orderId.trim() ? orderId.trim() : undefined,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.status(200).json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(502).json({ success: false, error: msg });
  }
});

/**
 * 3. GET /api/payments/verify-intent/:intentId
 * Verifies a hosted payment intent directly with Ziina / Stripe
 */
router.get('/verify-intent/:intentId', async (req, res) => {
  try {
    const { intentId } = req.params;
    if (!intentId || intentId.length > 160) {
      return res.status(400).json({ success: false, paid: false, error: 'Invalid intentId' });
    }
    const verification = await verifyHostedPaymentIntent(intentId);
    if (!verification.success) {
      return res.status(404).json(verification);
    }
    return res.status(200).json(verification);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, paid: false, error: msg });
  }
});

/**
 * 4. POST /api/payments/sandbox-confirm
 * Completes a sandbox test payment ONLY when no live gateway token is configured.
 */
router.post('/sandbox-confirm', (req, res) => {
  const { intentId, amountFils, paymentMethod, cardLast4 } = req.body || {};
  if (typeof amountFils !== 'number' || !Number.isInteger(amountFils) || amountFils < 200) {
    return res.status(400).json({
      success: false,
      error: 'amountFils must be a positive integer >= 200 fils',
    });
  }

  const result = confirmSandboxPayment({
    intentId: typeof intentId === 'string' ? intentId : undefined,
    amountFils,
    paymentMethod: paymentMethod === 'credit_card' ? 'credit_card' : 'apple_pay',
    cardLast4: typeof cardLast4 === 'string' ? cardLast4.slice(-4) : undefined,
  });

  if (!result.success) {
    return res.status(result.forbidden ? 403 : 400).json(result);
  }

  return res.status(200).json(result);
});

/**
 * 5. POST /api/payments/ziina-webhook
 * Receives payment_intent.status.updated events from Ziina.
 * Signature verification against raw request body is MANDATORY.
 */
router.post('/ziina-webhook', async (req, res) => {
  try {
    const signatureHeader = req.headers['x-hmac-signature'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    const rawBody = (req as RequestWithRawBody).rawBody ?? JSON.stringify(req.body || {});
    const result = await handleZiinaWebhook(rawBody, signature, req.body || {});

    if (!result.valid) {
      return res
        .status(result.missingSecret ? 503 : 401)
        .json({ success: false, error: result.error || 'Invalid Ziina webhook HMAC signature' });
    }
    return res.status(200).json({ success: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

/**
 * 5b. POST /api/payments/ziina-register-webhook (Admin Only)
 * Automatically registers https://flaster.ae/api/ziina/webhook with Ziina API v2
 */
router.post('/ziina-register-webhook', requireAdminAuth, async (req, res) => {
  try {
    const customBaseUrl =
      typeof req.body?.baseUrl === 'string' && req.body.baseUrl.startsWith('https://')
        ? req.body.baseUrl
        : undefined;
    const result = await registerZiinaWebhook(customBaseUrl);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(200).json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

/**
 * 6. POST /api/payments/stripe-webhook
 * Receives Stripe webhook events (checkout.session.completed, payment_intent.succeeded, etc.).
 * Stripe-Signature HMAC-SHA256 verification against rawBody is MANDATORY.
 */
router.post('/stripe-webhook', async (req, res) => {
  try {
    const signatureHeader = req.headers['stripe-signature'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    const rawBody = (req as RequestWithRawBody).rawBody ?? JSON.stringify(req.body || {});
    const result = await handleStripeWebhook(rawBody, signature, req.body || {});

    if (!result.valid) {
      return res
        .status(result.missingSecret ? 503 : 401)
        .json({ success: false, error: result.error || 'Invalid Stripe webhook signature' });
    }
    return res.status(200).json({ success: true, ...result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

/**
 * 7. POST /api/payments/charge
 * Processes idempotent payment ledger entry for Apple Pay, Card, or Cash on Pickup.
 * Strictly validates integer Fils and authoritative order amount when order exists.
 */
router.post('/charge', async (req, res) => {
  try {
    const { idempotencyKey, orderId, amountFils, paymentMethod, customerInfo, merchantId } = req.body || {};

    if (
      !idempotencyKey ||
      !orderId ||
      typeof amountFils !== 'number' ||
      !Number.isInteger(amountFils) ||
      amountFils < 0 ||
      !paymentMethod
    ) {
      return res.status(400).json({
        success: false,
        error: 'بيانات الدفع غير مكتملة أو المبلغ غير صحيح (amountFils يجب أن يكون عدداً صحيحاً بالفلس)',
      });
    }

    const serverOrder = getServerOrder(String(orderId));
    const authoritativeFils = serverOrder ? serverOrder.totalFils : amountFils;

    const result = await processPaymentIntent({
      idempotencyKey: String(idempotencyKey),
      orderId: String(orderId),
      amountFils: authoritativeFils,
      currency: 'AED',
      paymentMethod:
        paymentMethod === 'pickup_cash' || paymentMethod === 'credit_card'
          ? paymentMethod
          : 'apple_pay',
      customerInfo: customerInfo || { name: 'عميل معتمد', phone: '+971 50 123 4567' },
      merchantId: serverOrder?.merchantId || merchantId,
    });

    return res.status(200).json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

/**
 * 8. GET /api/payments/verify/:transactionId (Merchant or Admin)
 * Verifies transaction integrity and enforces per-merchant isolation.
 */
router.get('/verify/:transactionId', requireMerchantOrAdminAuth, (req, res) => {
  const { transactionId } = req.params;
  const txn = getPaymentTransaction(transactionId);

  if (!txn) {
    return res.status(404).json({ success: false, error: 'المعاملة المالية غير موجودة' });
  }

  const caller = (req as express.Request & { caller?: { role: string; merchantId?: string } }).caller;
  if (caller?.role === 'merchant') {
    const serverOrder = txn.orderId ? getServerOrder(txn.orderId) : undefined;
    if (!caller.merchantId || (serverOrder && serverOrder.merchantId !== caller.merchantId)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: لا يمكنك التحقق من معاملة مالية تخص مطعماً آخر',
      });
    }
  }

  return res.json({ success: true, transaction: txn });
});

export default router;
