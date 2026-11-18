/**
 * Flaster UAE • SMART SAVING. LESS WASTE.
 * Real Payment Gateway Integration:
 * 1. Ziina Payment Intent API v2 (https://api-v2.ziina.com/api/payment_intent)
 * 2. Stripe Checkout REST fallback (when STRIPE_SECRET_KEY is configured).
 * 3. Sandbox Mode (strictly only when neither ZIINA_API_TOKEN nor STRIPE_SECRET_KEY is set).
 * 4. Cash on Pickup / Direct Delivery Counter Ledger.
 *
 * Security Guarantees:
 * - Strictly integer UAE Fils (1 AED = 100 Fils), rejecting fractional inputs.
 * - Mandatory HMAC-SHA256 verification on Ziina & Stripe Webhooks (fail-closed if secret unset).
 * - Constant-time comparison (crypto.timingSafeEqual) on all signatures.
 */

import crypto from 'crypto';
import { getMerchantCommissionPercent } from './financeService.ts';
import { filsToAed } from '../config/platformConfig.ts';

export interface PaymentIntentRequest {
  idempotencyKey: string;
  orderId: string;
  amountFils: number;
  currency: 'AED';
  paymentMethod: 'apple_pay' | 'credit_card' | 'pickup_cash';
  customerInfo: {
    uid?: string;
    name: string;
    phone: string;
    email?: string;
  };
  merchantId?: string;
  stripeToken?: string;
}

export interface PaymentIntentResponse {
  success: boolean;
  transactionId: string;
  orderId: string;
  status: 'SUCCEEDED' | 'PENDING_CASH_COLLECTION' | 'FAILED';
  amountFils: number;
  amountAed: number;
  platformCommissionFils: number;
  merchantPayoutFils: number;
  paymentMethod: string;
  authorizationCode: string;
  receiptNumber: string;
  processedAt: string;
  gatewayProvider: 'Ziina UAE' | 'Stripe UAE' | 'Apple Pay Direct' | 'Cash Counter Ledger' | 'Sandbox Test';
  isLiveEnvironment: boolean;
  wioSettlementBatchId?: string;
  error?: string;
}

export interface HostedPaymentIntentRecord {
  intentId: string;
  orderId?: string;
  provider: 'ziina' | 'stripe' | 'sandbox';
  status: 'pending' | 'completed' | 'failed' | 'canceled';
  amountFils: number;
  currency: 'AED';
  paymentMethod: 'apple_pay' | 'credit_card';
  redirectUrl?: string;
  message: string;
  createdAt: string;
  verifiedAt?: string;
  testMode: boolean;
}

// Global In-memory idempotency transaction & intent registries
const processedPayments = new Map<string, PaymentIntentResponse>();
const hostedIntents = new Map<string, HostedPaymentIntentRecord>();

type WebhookOrderSyncListener = (params: {
  intentId: string;
  orderId?: string;
  status: 'completed' | 'failed' | 'canceled' | 'pending';
  amountFils?: number;
  provider: 'ziina' | 'stripe';
}) => Promise<void> | void;

let webhookOrderSyncListener: WebhookOrderSyncListener | null = null;

export function registerPaymentWebhookOrderSync(listener: WebhookOrderSyncListener): void {
  webhookOrderSyncListener = listener;
}

export function registerHostedIntentForTest(record: HostedPaymentIntentRecord): void {
  hostedIntents.set(record.intentId, record);
}

/**
 * Checks Gateway Production Configuration.
 * Test mode is controlled exclusively by ZIINA_TEST_MODE.
 * Supported payment methods are strictly Credit/Debit Card, Apple Pay, and Cash on Pickup.
 */
export function getPaymentGatewayConfig() {
  const ziinaToken = (process.env.ZIINA_API_TOKEN || '').trim();
  const isTestMode = process.env.ZIINA_TEST_MODE === 'true';
  const stripeSecretKey = (process.env.STRIPE_SECRET_KEY || '').trim();
  const stripePublishableKey = (process.env.STRIPE_PUBLISHABLE_KEY || '').trim();

  const hasZiina = ziinaToken.length > 0;
  const hasStripe = stripeSecretKey.length > 0;
  const activeGateway: 'ziina' | 'stripe' | 'sandbox' = hasZiina
    ? 'ziina'
    : hasStripe
      ? 'stripe'
      : 'sandbox';

  const hasLiveGateway = (hasZiina || hasStripe) && !isTestMode;
  const isLive = hasLiveGateway;

  return {
    provider:
      activeGateway === 'ziina'
        ? 'Ziina UAE (Apple Pay & Cards)'
        : activeGateway === 'stripe'
          ? 'Stripe UAE (Apple Pay & Cards)'
          : 'Sandbox Test Mode (ZIINA_TEST_MODE)',
    activeGateway,
    hasLiveGateway,
    hasZiina,
    hasStripe,
    isLive,
    testMode: isTestMode,
    mode: hasZiina || hasStripe ? (isTestMode ? 'test' : 'live') : 'sandbox',
    hasLiveStripeKey: hasStripe && !isTestMode,
    hasPublishableKey: Boolean(stripePublishableKey),
    applePayConfigured: true,
    supportedPaymentMethods: ['credit_card', 'apple_pay', 'pickup_cash'] as const,
    supportedCurrencies: ['AED'],
    commissionRatePercent: 15,
    cashOnPickupSupported: true,
  };
}

/**
 * Creates a real Ziina v2 or Stripe Checkout hosted payment session (or sandbox session if unconfigured)
 */
export async function createHostedPaymentIntent(params: {
  amountFils: number;
  paymentMethod: 'apple_pay' | 'credit_card';
  message: string;
  originUrl: string;
  customerEmail?: string;
  orderId?: string;
}): Promise<{
  success: boolean;
  provider: 'ziina' | 'stripe' | 'sandbox';
  mode: 'live' | 'test' | 'sandbox';
  intentId: string;
  redirectUrl?: string;
  status: 'pending' | 'completed';
  error?: string;
}> {
  if (!Number.isInteger(params.amountFils) || params.amountFils < 200) {
    return {
      success: false,
      provider: 'sandbox',
      mode: 'sandbox',
      intentId: '',
      status: 'pending',
      error: 'المبلغ يجب أن يكون عدداً صحيحاً بالفلس ولا يقل عن 200 فلس (2.00 د.إ). / amountFils must be an integer >= 200.',
    };
  }

  const amountFils = params.amountFils;
  const config = getPaymentGatewayConfig();
  const baseUrl = (params.originUrl || process.env.APP_URL || 'https://flaster.ae').replace(/\/$/, '');

  // 1. Ziina Payment Intent API v2
  if (config.hasZiina) {
    const ziinaToken = process.env.ZIINA_API_TOKEN!.trim();
    const isTest = process.env.ZIINA_TEST_MODE === 'true';

    const successUrl = `${baseUrl}/?payment_status=success&provider=ziina&intent_id={PAYMENT_INTENT_ID}`;
    const cancelUrl = `${baseUrl}/?payment_status=cancel&provider=ziina&intent_id={PAYMENT_INTENT_ID}`;
    const failureUrl = `${baseUrl}/?payment_status=failed&provider=ziina&intent_id={PAYMENT_INTENT_ID}`;

    const res = await fetch('https://api-v2.ziina.com/api/payment_intent', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ziinaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountFils,
        currency_code: 'AED',
        message: params.message.slice(0, 200),
        success_url: successUrl,
        cancel_url: cancelUrl,
        failure_url: failureUrl,
        test: isTest,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      redirect_url?: string;
      status?: string;
      message?: string;
      error?: string;
    };

    if (!res.ok || !data.id || !data.redirect_url) {
      throw new Error(
        data.message || data.error || `Ziina API error (${res.status}): failed to create payment intent`
      );
    }

    hostedIntents.set(data.id, {
      intentId: data.id,
      orderId: params.orderId,
      provider: 'ziina',
      status: 'pending',
      amountFils,
      currency: 'AED',
      paymentMethod: params.paymentMethod,
      redirectUrl: data.redirect_url,
      message: params.message,
      createdAt: new Date().toISOString(),
      testMode: isTest,
    });

    return {
      success: true,
      provider: 'ziina',
      mode: isTest ? 'test' : 'live',
      intentId: data.id,
      redirectUrl: data.redirect_url,
      status: 'pending',
    };
  }

  // 2. Stripe Checkout REST API (zero-SDK fetch integration)
  if (config.hasStripe) {
    const stripeKey = process.env.STRIPE_SECRET_KEY!.trim();
    const form = new URLSearchParams();
    form.set('mode', 'payment');
    form.set(
      'success_url',
      `${baseUrl}/?payment_status=success&provider=stripe&intent_id={CHECKOUT_SESSION_ID}`
    );
    form.set('cancel_url', `${baseUrl}/?payment_status=cancel&provider=stripe`);
    form.set('currency', 'aed');
    form.set('line_items[0][price_data][currency]', 'aed');
    form.set('line_items[0][price_data][unit_amount]', String(amountFils));
    form.set('line_items[0][price_data][product_data][name]', params.message.slice(0, 120));
    form.set('line_items[0][quantity]', '1');
    if (params.orderId) {
      form.set('metadata[orderId]', params.orderId);
      form.set('client_reference_id', params.orderId);
    }
    if (params.customerEmail) {
      form.set('customer_email', params.customerEmail);
    }

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    });

    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      url?: string;
      error?: { message?: string };
    };

    if (!res.ok || !data.id || !data.url) {
      throw new Error(data.error?.message || `Stripe API error (${res.status})`);
    }

    const isTest = process.env.ZIINA_TEST_MODE === 'true';
    hostedIntents.set(data.id, {
      intentId: data.id,
      orderId: params.orderId,
      provider: 'stripe',
      status: 'pending',
      amountFils,
      currency: 'AED',
      paymentMethod: params.paymentMethod,
      redirectUrl: data.url,
      message: params.message,
      createdAt: new Date().toISOString(),
      testMode: isTest,
    });

    return {
      success: true,
      provider: 'stripe',
      mode: isTest ? 'test' : 'live',
      intentId: data.id,
      redirectUrl: data.url,
      status: 'pending',
    };
  }

  // 3. Sandbox Mode (no gateway token configured yet)
  const sandboxId = `SBX-INT-${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  hostedIntents.set(sandboxId, {
    intentId: sandboxId,
    orderId: params.orderId,
    provider: 'sandbox',
    status: 'pending',
    amountFils,
    currency: 'AED',
    paymentMethod: params.paymentMethod,
    message: params.message,
    createdAt: new Date().toISOString(),
    testMode: true,
  });

  return {
    success: true,
    provider: 'sandbox',
    mode: 'sandbox',
    intentId: sandboxId,
    status: 'pending',
  };
}

/**
 * Verifies a hosted payment intent directly against Ziina v2 or Stripe REST API
 */
export async function verifyHostedPaymentIntent(intentId: string): Promise<{
  success: boolean;
  paid: boolean;
  status: string;
  provider: 'ziina' | 'stripe' | 'sandbox';
  amountFils?: number;
  intentId: string;
  error?: string;
}> {
  const existing = hostedIntents.get(intentId);
  const config = getPaymentGatewayConfig();

  // Check Ziina API v2 if token configured or intent is Ziina
  if (config.hasZiina && (!existing || existing.provider === 'ziina')) {
    const ziinaToken = process.env.ZIINA_API_TOKEN!.trim();
    const res = await fetch(`https://api-v2.ziina.com/api/payment_intent/${encodeURIComponent(intentId)}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${ziinaToken}`,
      },
    });
    const data = (await res.json().catch(() => ({}))) as {
      id?: string;
      status?: string;
      amount?: number;
      message?: string;
    };

    if (!res.ok) {
      return {
        success: false,
        paid: false,
        status: 'error',
        provider: 'ziina',
        intentId,
        error: data.message || `Ziina verification failed (${res.status})`,
      };
    }

    const paid = data.status === 'completed';
    if (existing && paid) {
      existing.status = 'completed';
      existing.verifiedAt = new Date().toISOString();
      hostedIntents.set(intentId, existing);
    }

    return {
      success: true,
      paid,
      status: data.status || 'unknown',
      provider: 'ziina',
      amountFils: data.amount ?? existing?.amountFils,
      intentId,
    };
  }

  // Check Stripe Checkout Session
  if (config.hasStripe && (!existing || existing.provider === 'stripe')) {
    const stripeKey = process.env.STRIPE_SECRET_KEY!.trim();
    const res = await fetch(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(intentId)}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
        },
      }
    );
    const data = (await res.json().catch(() => ({}))) as {
      payment_status?: string;
      status?: string;
      amount_total?: number;
      error?: { message?: string };
    };

    if (!res.ok) {
      return {
        success: false,
        paid: false,
        status: 'error',
        provider: 'stripe',
        intentId,
        error: data.error?.message || `Stripe verification failed (${res.status})`,
      };
    }

    const paid = data.payment_status === 'paid';
    if (existing && paid) {
      existing.status = 'completed';
      existing.verifiedAt = new Date().toISOString();
      hostedIntents.set(intentId, existing);
    }

    return {
      success: true,
      paid,
      status: data.payment_status || data.status || 'unknown',
      provider: 'stripe',
      amountFils: data.amount_total ?? existing?.amountFils,
      intentId,
    };
  }

  // Sandbox lookup
  if (existing && existing.provider === 'sandbox') {
    return {
      success: true,
      paid: existing.status === 'completed',
      status: existing.status,
      provider: 'sandbox',
      amountFils: existing.amountFils,
      intentId,
    };
  }

  return {
    success: false,
    paid: false,
    status: 'not_found',
    provider: config.activeGateway,
    intentId,
    error: 'Payment intent not found',
  };
}

/**
 * Confirms a Sandbox test payment ONLY when no live gateway token is configured.
 * Strictly rejected (403) when ZIINA_API_TOKEN or STRIPE_SECRET_KEY is active.
 */
export function confirmSandboxPayment(params: {
  intentId?: string;
  amountFils: number;
  paymentMethod: 'apple_pay' | 'credit_card';
  cardLast4?: string;
}): {
  success: boolean;
  forbidden?: boolean;
  transactionId?: string;
  intentId?: string;
  status?: string;
  error?: string;
} {
  const config = getPaymentGatewayConfig();
  if (config.hasLiveGateway) {
    return {
      success: false,
      forbidden: true,
      error: 'Sandbox confirmation is disabled while a live payment gateway token is configured.',
    };
  }

  if (!Number.isInteger(params.amountFils) || params.amountFils < 200) {
    return {
      success: false,
      error: 'Invalid integer amountFils (minimum 200 fils)',
    };
  }

  const intentId = params.intentId || `SBX-INT-${crypto.randomBytes(5).toString('hex').toUpperCase()}`;
  const nowIso = new Date().toISOString();
  hostedIntents.set(intentId, {
    intentId,
    provider: 'sandbox',
    status: 'completed',
    amountFils: params.amountFils,
    currency: 'AED',
    paymentMethod: params.paymentMethod,
    message: `Sandbox ${params.paymentMethod}${params.cardLast4 ? ` (*${params.cardLast4})` : ''}`,
    createdAt: nowIso,
    verifiedAt: nowIso,
    testMode: true,
  });

  return {
    success: true,
    intentId,
    transactionId: `TXN-SBX-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
    status: 'completed',
  };
}

function timingSafeHexEqual(aRaw: string, bRaw: string): boolean {
  const cleanA = aRaw.replace(/^sha256=/i, '').trim().toLowerCase();
  const cleanB = bRaw.replace(/^sha256=/i, '').trim().toLowerCase();
  if (!cleanA || cleanA.length !== cleanB.length) return false;
  const bufA = Buffer.from(cleanA, 'utf8');
  const bufB = Buffer.from(cleanB, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * MANDATORY Ziina Webhook HMAC-SHA256 signature verification (fail-closed if secret missing)
 */
export async function handleZiinaWebhook(
  rawBody: string,
  hmacHeader: string | undefined,
  payload: { event?: string; data?: { id?: string; status?: string; amount?: number } }
): Promise<{
  valid: boolean;
  missingSecret?: boolean;
  updated: boolean;
  intentId?: string;
  error?: string;
}> {
  const secret = (process.env.ZIINA_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    return {
      valid: false,
      missingSecret: true,
      updated: false,
      error: 'ZIINA_WEBHOOK_SECRET is not configured on server (fail-closed)',
    };
  }

  if (!hmacHeader || typeof hmacHeader !== 'string') {
    return { valid: false, updated: false, error: 'Missing X-Hmac-Signature header' };
  }

  const expected = crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex');
  if (!timingSafeHexEqual(hmacHeader, expected)) {
    return { valid: false, updated: false, error: 'Invalid Ziina webhook HMAC signature' };
  }

  const intentId = payload.data?.id;
  const newStatus = payload.data?.status;
  if (payload.event === 'payment_intent.status.updated' && intentId && newStatus) {
    const mappedStatus: HostedPaymentIntentRecord['status'] =
      newStatus === 'completed'
        ? 'completed'
        : newStatus === 'failed'
          ? 'failed'
          : newStatus === 'canceled'
            ? 'canceled'
            : 'pending';

    const existing = hostedIntents.get(intentId);
    if (existing) {
      if (
        typeof payload.data?.amount === 'number' &&
        payload.data.amount !== existing.amountFils
      ) {
        return {
          valid: false,
          updated: false,
          intentId,
          error: 'Webhook amount mismatch against recorded payment intent',
        };
      }

      existing.status = mappedStatus;
      if (mappedStatus === 'completed') {
        existing.verifiedAt = new Date().toISOString();
      }
      hostedIntents.set(intentId, existing);
    }

    if (webhookOrderSyncListener) {
      await webhookOrderSyncListener({
        intentId,
        orderId: existing?.orderId,
        status: mappedStatus,
        amountFils: payload.data?.amount ?? existing?.amountFils,
        provider: 'ziina',
      });
    }

    return { valid: true, updated: Boolean(existing), intentId };
  }

  return { valid: true, updated: false, intentId };
}

/**
 * Registers the public HTTPS webhook endpoint with Ziina API v2 (POST https://api-v2.ziina.com/api/webhook)
 * using the configured ZIINA_API_TOKEN and ZIINA_WEBHOOK_SECRET.
 */
export async function registerZiinaWebhook(customBaseUrl?: string): Promise<{
  success: boolean;
  webhookUrl?: string;
  error?: string;
}> {
  const ziinaToken = (process.env.ZIINA_API_TOKEN || '').trim();
  const webhookSecret = (process.env.ZIINA_WEBHOOK_SECRET || '').trim();

  if (!ziinaToken || !webhookSecret) {
    return {
      success: false,
      error: 'يرجى التأكد من إدخال ZIINA_API_TOKEN و ZIINA_WEBHOOK_SECRET في متغيرات البيئة أولاً.',
    };
  }

  const baseUrl = (customBaseUrl || process.env.APP_URL || 'https://flaster.ae').trim().replace(/\/$/, '');
  const webhookUrl = `${baseUrl}/api/ziina/webhook`;

  try {
    const res = await fetch('https://api-v2.ziina.com/api/webhook', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ziinaToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: webhookUrl,
        secret: webhookSecret,
      }),
    });

    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
      return {
        success: false,
        webhookUrl,
        error: errData.message || errData.error || `Ziina webhook registration failed (${res.status})`,
      };
    }

    return {
      success: true,
      webhookUrl,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      webhookUrl,
      error: msg,
    };
  }
}

/**
 * MANDATORY Stripe Webhook Signature verification (`Stripe-Signature: t=...,v1=...`)
 * Fail-closed if STRIPE_WEBHOOK_SECRET is missing or timestamp drift > 300 seconds.
 */
export async function handleStripeWebhook(
  rawBody: string,
  stripeSigHeader: string | undefined,
  payload: {
    type?: string;
    data?: {
      object?: {
        id?: string;
        payment_status?: string;
        status?: string;
        amount_total?: number;
        amount_received?: number;
        client_reference_id?: string;
        metadata?: { orderId?: string };
      };
    };
  }
): Promise<{
  valid: boolean;
  missingSecret?: boolean;
  updated: boolean;
  intentId?: string;
  error?: string;
}> {
  const secret = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!secret) {
    return {
      valid: false,
      missingSecret: true,
      updated: false,
      error: 'STRIPE_WEBHOOK_SECRET is not configured on server (fail-closed)',
    };
  }

  if (!stripeSigHeader || typeof stripeSigHeader !== 'string') {
    return { valid: false, updated: false, error: 'Missing Stripe-Signature header' };
  }

  const parts = stripeSigHeader.split(',').map((p) => p.trim());
  let timestampStr = '';
  const v1Sigs: string[] = [];
  for (const part of parts) {
    if (part.startsWith('t=')) timestampStr = part.slice(2);
    else if (part.startsWith('v1=')) v1Sigs.push(part.slice(3));
  }

  const timestampSec = Number(timestampStr);
  if (!Number.isInteger(timestampSec) || v1Sigs.length === 0) {
    return { valid: false, updated: false, error: 'Malformed Stripe-Signature header' };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - timestampSec) > 300) {
    return { valid: false, updated: false, error: 'Stripe webhook timestamp tolerance exceeded' };
  }

  const signedPayload = `${timestampStr}.${rawBody}`;
  const expectedSig = crypto.createHmac('sha256', secret).update(signedPayload, 'utf8').digest('hex');
  const signatureMatched = v1Sigs.some((sig) => timingSafeHexEqual(sig, expectedSig));

  if (!signatureMatched) {
    return { valid: false, updated: false, error: 'Invalid Stripe webhook signature' };
  }

  const obj = payload.data?.object;
  const intentId = obj?.id;
  const eventType = payload.type || '';

  if (
    intentId &&
    (eventType === 'checkout.session.completed' ||
      eventType === 'payment_intent.succeeded' ||
      eventType === 'payment_intent.payment_failed' ||
      eventType === 'checkout.session.expired')
  ) {
    const mappedStatus: HostedPaymentIntentRecord['status'] =
      eventType === 'checkout.session.completed' || eventType === 'payment_intent.succeeded'
        ? 'completed'
        : eventType === 'payment_intent.payment_failed'
          ? 'failed'
          : 'canceled';

    const existing = hostedIntents.get(intentId);
    const payloadAmount = obj?.amount_total ?? obj?.amount_received;
    const orderId = obj?.metadata?.orderId || obj?.client_reference_id || existing?.orderId;

    if (existing) {
      if (typeof payloadAmount === 'number' && payloadAmount !== existing.amountFils) {
        return {
          valid: false,
          updated: false,
          intentId,
          error: 'Stripe webhook amount mismatch against recorded payment intent',
        };
      }
      existing.status = mappedStatus;
      if (mappedStatus === 'completed') {
        existing.verifiedAt = new Date().toISOString();
      }
      hostedIntents.set(intentId, existing);
    }

    if (webhookOrderSyncListener) {
      await webhookOrderSyncListener({
        intentId,
        orderId,
        status: mappedStatus,
        amountFils: payloadAmount ?? existing?.amountFils,
        provider: 'stripe',
      });
    }

    return { valid: true, updated: Boolean(existing || orderId), intentId };
  }

  return { valid: true, updated: false, intentId };
}

/**
 * Processes payment intent ledger record with strict idempotency & integer Fils math
 */
export async function processPaymentIntent(req: PaymentIntentRequest): Promise<PaymentIntentResponse> {
  if (!Number.isInteger(req.amountFils) || req.amountFils < 0) {
    throw new Error('INVALID_AMOUNT: amountFils must be a non-negative integer');
  }

  if (processedPayments.has(req.idempotencyKey)) {
    return processedPayments.get(req.idempotencyKey)!;
  }

  const gatewayConfig = getPaymentGatewayConfig();
  const nowIso = new Date().toISOString();
  const receiptNumber = `RCP-FLS-${Date.now()}`;
  const authCode = String(crypto.randomInt(100000, 1000000));

  const commissionPercent = req.merchantId
    ? getMerchantCommissionPercent(req.merchantId)
    : gatewayConfig.commissionRatePercent;
  const platformCommissionFils = Math.round((req.amountFils * commissionPercent) / 100);
  const merchantPayoutFils = req.amountFils - platformCommissionFils;

  if (req.paymentMethod === 'pickup_cash') {
    const transactionId = `TXN-CASH-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const response: PaymentIntentResponse = {
      success: true,
      transactionId,
      orderId: req.orderId,
      status: 'PENDING_CASH_COLLECTION',
      amountFils: req.amountFils,
      amountAed: filsToAed(req.amountFils),
      platformCommissionFils,
      merchantPayoutFils,
      paymentMethod: 'pickup_cash',
      authorizationCode: `CASH-${authCode}`,
      receiptNumber,
      processedAt: nowIso,
      gatewayProvider: 'Cash Counter Ledger',
      isLiveEnvironment: gatewayConfig.isLive,
      wioSettlementBatchId: `WIO-SETTLE-${new Date().toISOString().slice(0, 10)}`,
    };

    processedPayments.set(req.idempotencyKey, response);
    return response;
  }

  const transactionId = `TXN-${gatewayConfig.activeGateway.toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const response: PaymentIntentResponse = {
    success: true,
    transactionId,
    orderId: req.orderId,
    status: 'SUCCEEDED',
    amountFils: req.amountFils,
    amountAed: filsToAed(req.amountFils),
    platformCommissionFils,
    merchantPayoutFils,
    paymentMethod: req.paymentMethod,
    authorizationCode: `AUTH-${authCode}`,
    receiptNumber,
    processedAt: nowIso,
    gatewayProvider: gatewayConfig.hasZiina
      ? 'Ziina UAE'
      : gatewayConfig.hasStripe
        ? req.paymentMethod === 'apple_pay'
          ? 'Apple Pay Direct'
          : 'Stripe UAE'
        : 'Sandbox Test',
    isLiveEnvironment: gatewayConfig.isLive,
    wioSettlementBatchId: `WIO-SETTLE-${new Date().toISOString().slice(0, 10)}`,
  };

  processedPayments.set(req.idempotencyKey, response);
  return response;
}

/**
 * Retrieves transaction by ID
 */
export function getPaymentTransaction(transactionId: string): PaymentIntentResponse | null {
  for (const [, txn] of processedPayments.entries()) {
    if (txn.transactionId === transactionId) {
      return txn;
    }
  }
  return null;
}
