/**
 * Automated Security, RBAC, Failure Cases & Business Logic Tests for Flaster
 * Run via: npx tsx src/tests/businessLogic.test.ts
 */

import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import {
  aedToFils,
  filsToAed,
  calculateIncludedVatFils,
  validateCommissionRate,
  formatSequentialInvoiceNumber,
} from '../config/platformConfig.ts';
import {
  getOrCreateWallet,
  claimNewUserWelcomeBonus,
} from '../server/loyaltyService.ts';
import {
  calculateOrderFinancials,
  updateMerchantCommissionRate,
  getCommissionAuditLogs,
} from '../server/financeService.ts';
import {
  validateAndProcessOrderRefund,
  isOrderRefundableStatus,
  getRefundAuditLogs,
  createOrderAtomic,
  getAllOrdersSynced,
} from '../server/orderService.ts';
import {
  getPaymentGatewayConfig,
  confirmSandboxPayment,
} from '../server/paymentService.ts';
import {
  issuePortalSessionToken,
  resetMerchantSecret,
  getMerchantCredentialRecordForTest,
  GENERIC_MERCHANT_LOGIN_ERROR,
} from '../server/adminAuth.ts';
import { createServer } from '../server/app.ts';
import { INITIAL_SURPLUS_ITEMS } from '../data/mockData.ts';

async function runTests() {
  console.log('====================================================');
  console.log('Running Flaster Automated Business Logic & Security Tests');
  console.log('====================================================\n');

  // Ensure test secrets exist in process.env ONLY during automated test run (never in source code)
  const testPin = crypto.randomBytes(4).toString('hex');
  const testZiinaWebhookSecret = crypto.randomBytes(16).toString('hex');
  const testStripeWebhookSecret = crypto.randomBytes(16).toString('hex');
  process.env.PORTAL_ACCESS_PIN = testPin;
  process.env.PORTAL_SESSION_SECRET = crypto.randomBytes(24).toString('hex');
  process.env.PICKUP_SECRET_PEPPER = crypto.randomBytes(24).toString('hex');
  process.env.ZIINA_TEST_MODE = 'true';

  // -------------------------------------------------------------------------
  // 1. MONEY (INTEGER FILS) & 5% INCLUDED VAT TESTS
  // -------------------------------------------------------------------------
  console.log('1) Testing Integer Fils & 5% Included VAT Calculation...');
  assert.equal(aedToFils(45), 4500, '45 AED should equal 4500 fils');
  assert.equal(aedToFils(19.99), 1999, '19.99 AED should equal 1999 fils');
  assert.equal(filsToAed(4500), 45, '4500 fils should equal 45 AED');

  const vatOn105Aed = calculateIncludedVatFils(10500, 5);
  assert.equal(vatOn105Aed, 500, 'VAT on 10500 fils (5% inclusive) must be 500 fils (total * 5 / 105)');

  const split = calculateOrderFinancials({
    orderId: 'ORD-TEST-105',
    merchantId: 'm-zaatar',
    subtotalFils: 10500,
    deliveryFeeFils: 0,
    pointsDiscountFils: 0,
    commissionRatePercent: 15,
  });
  assert.equal(split.vatFils, 500, 'Order split VAT on 10500 fils must be 500 fils');
  assert.equal(split.totalCustomerPaidFils, 10500, 'Order split totalCustomerPaidFils must be 10500 fils');
  assert.equal(split.platformCommissionFils, 1575, '15% commission on 10500 fils must be 1575 fils');
  assert.equal(split.merchantNetPayoutFils, 8925, 'Merchant net payout on 10500 fils must be 8925 fils');

  const invNo = formatSequentialInvoiceNumber(42, new Date('2026-05-01T00:00:00Z'));
  assert.equal(invNo, 'INV-2026-00042', 'Sequential invoice format should be INV-YYYY-XXXXX');
  console.log('   [PASS] Integer Fils & 5% Included VAT tests passed.\n');

  // -------------------------------------------------------------------------
  // 2. COMMISSION VALIDATION & AUDIT LOG TESTS
  // -------------------------------------------------------------------------
  console.log('2) Testing Commission Validation (0–50%, non-negative) & Audit Logging...');
  assert.equal(validateCommissionRate(15).valid, true, '15% should be valid');
  assert.equal(validateCommissionRate(0).valid, true, '0% should be valid');
  assert.equal(validateCommissionRate(50).valid, true, '50% should be valid');
  assert.equal(validateCommissionRate(-5).valid, false, 'Negative commission (-5%) must be rejected');
  assert.equal(validateCommissionRate(55).valid, false, 'Commission > 50% (55%) must be rejected');

  const invalidNegResult = await updateMerchantCommissionRate({
    merchantId: 'm-zaatar',
    newCommissionPercent: -10,
    changedBy: 'admin@test.ae',
  });
  assert.equal(invalidNegResult.success, false, 'Server must reject negative commission update');

  const invalidHighResult = await updateMerchantCommissionRate({
    merchantId: 'm-zaatar',
    newCommissionPercent: 65,
    changedBy: 'admin@test.ae',
  });
  assert.equal(invalidHighResult.success, false, 'Server must reject >50% commission update');

  const validUpdateResult = await updateMerchantCommissionRate({
    merchantId: 'm-zaatar',
    newCommissionPercent: 18,
    changedBy: 'admin@test.ae',
  });
  assert.equal(validUpdateResult.success, true, 'Server should accept 18% commission update');
  assert.equal(validUpdateResult.auditLog?.newValue, 18, 'Audit log must record newValue = 18');
  assert.equal(validUpdateResult.auditLog?.changedBy, 'admin@test.ae', 'Audit log must record changedBy');
  assert.ok(getCommissionAuditLogs().length >= 1, 'Commission audit log array should contain the change');
  console.log('   [PASS] Commission validation & audit log tests passed.\n');

  // -------------------------------------------------------------------------
  // 3. WELCOME BONUS (500 POINTS ONLY AFTER FIRST COMPLETED ORDER & ONCE)
  // -------------------------------------------------------------------------
  console.log('3) Testing Welcome Bonus (0 at signup, 500 after 1st completed order, atomic lock)...');
  const testPhone = '+971509998877';

  const initialWallet = getOrCreateWallet(testPhone);
  assert.equal(initialWallet.availablePoints, 0, 'New user wallet must start with 0 points at signup');

  const beforeOrderClaim = await claimNewUserWelcomeBonus(
    testPhone,
    'Test User',
    '192.0.2.10',
    false
  );
  assert.equal(beforeOrderClaim.pointsAwarded, 0, 'Bonus must NOT be awarded before first completed order');
  assert.equal(beforeOrderClaim.wallet.availablePoints, 0, 'Balance must remain 0 before first completed order');

  const afterFirstOrderClaim = await claimNewUserWelcomeBonus(
    testPhone,
    'Test User',
    '192.0.2.10',
    true
  );
  assert.equal(afterFirstOrderClaim.pointsAwarded, 500, 'Points awarded must be 500 after first completed order');
  assert.equal(afterFirstOrderClaim.wallet.availablePoints, 500, 'Wallet balance must be 500 after bonus');

  const duplicateClaim = await claimNewUserWelcomeBonus(
    testPhone,
    'Test User',
    '192.0.2.10',
    true
  );
  assert.equal(duplicateClaim.pointsAwarded, 0, 'Duplicate welcome bonus claim must award 0 points');
  assert.equal(duplicateClaim.alreadyClaimed, true, 'Duplicate welcome bonus claim must set alreadyClaimed = true');
  assert.equal(duplicateClaim.wallet.availablePoints, 500, 'Wallet balance must remain 500 on duplicate claim');
  console.log('   [PASS] Welcome bonus eligibility & idempotency tests passed.\n');

  // -------------------------------------------------------------------------
  // 4. SERVER-SIDE REFUND VALIDATION, DOUBLE-REFUND & OVER-REFUND TESTS
  // -------------------------------------------------------------------------
  console.log('4) Testing Server-Side Refund Policy, Double-Refund Prevention & Over-Refund Cap...');
  assert.equal(isOrderRefundableStatus('placed'), true, 'Status "placed" must be refundable');
  assert.equal(isOrderRefundableStatus('accepted'), false, 'Status "accepted" must NOT be refundable');
  assert.equal(isOrderRefundableStatus('preparing'), false, 'Status "preparing" must NOT be refundable');
  assert.equal(isOrderRefundableStatus('ready'), false, 'Status "ready" must NOT be refundable');
  assert.equal(isOrderRefundableStatus('picked_up'), false, 'Status "picked_up" must NOT be refundable');
  assert.equal(isOrderRefundableStatus('delivered'), false, 'Status "delivered" must NOT be refundable');
  assert.equal(isOrderRefundableStatus('completed'), false, 'Status "completed" must NOT be refundable');

  const allowedRefund = await validateAndProcessOrderRefund({
    orderId: 'ORD-TEST-PLACED',
    customerId: 'cust-1',
    requestedBy: 'cust-1',
    reason: 'Ordered by mistake',
    currentStatusOverride: 'placed',
    amountFilsOverride: 4500,
    allowMissingOrderForTest: true,
  });
  assert.equal(allowedRefund.success, true, 'Refund must succeed when order status is "placed"');
  assert.equal(allowedRefund.auditLog.outcome, 'APPROVED', 'Audit log outcome must be APPROVED');

  // Second refund attempt on same order must fail!
  const doubleRefund = await validateAndProcessOrderRefund({
    orderId: 'ORD-TEST-PLACED',
    customerId: 'cust-1',
    requestedBy: 'cust-1',
    reason: 'Second attempt',
    currentStatusOverride: 'placed',
    amountFilsOverride: 4500,
    allowMissingOrderForTest: true,
  });
  assert.equal(doubleRefund.success, false, 'Double refund on same order must be strictly rejected');
  assert.ok(doubleRefund.error?.includes('ALREADY_REFUNDED'), 'Must flag ALREADY_REFUNDED');

  const blockedAcceptedRefund = await validateAndProcessOrderRefund({
    orderId: 'ORD-TEST-ACCEPTED',
    customerId: 'cust-1',
    requestedBy: 'cust-1',
    reason: 'Changed mind after merchant accepted',
    currentStatusOverride: 'accepted',
    amountFilsOverride: 4500,
    allowMissingOrderForTest: true,
  });
  assert.equal(blockedAcceptedRefund.success, false, 'Refund must be blocked when order status is "accepted"');
  assert.equal(blockedAcceptedRefund.auditLog.outcome, 'REJECTED', 'Audit log outcome must be REJECTED');

  const blockedPickedUpRefund = await validateAndProcessOrderRefund({
    orderId: 'ORD-TEST-PICKEDUP',
    customerId: 'cust-1',
    requestedBy: 'cust-1',
    reason: 'After pickup',
    currentStatusOverride: 'picked_up',
    amountFilsOverride: 4500,
    allowMissingOrderForTest: true,
  });
  assert.equal(blockedPickedUpRefund.success, false, 'Refund must be blocked after pickup/delivery');
  assert.ok(getRefundAuditLogs().length >= 4, 'All refund attempts must be logged');
  console.log('   [PASS] Refund validation, double-refund & cap tests passed.\n');

  // -------------------------------------------------------------------------
  // 5. ORDER SYNC & ZERO PLATFORM DELIVERY FEE (RESTAURANT SELF-DELIVERY)
  // -------------------------------------------------------------------------
  console.log('5) Testing Order Sync & Zero Platform Delivery Fee (Restaurant Self-Delivery)...');
  const firstCatalogItem = INITIAL_SURPLUS_ITEMS[0];
  const createdDeliveryOrder = await createOrderAtomic({
    customerId: 'cust-sync-test',
    customerName: 'Sync Test Customer',
    customerPhone: '+971501112233',
    deliveryAddress: 'Al Hamra Village, Villa 12',
    merchantId: firstCatalogItem.merchant.id || 'merchant-waldorf',
    items: [
      {
        itemId: firstCatalogItem.id,
        quantity: 1,
      },
    ],
    fulfillmentType: 'delivery',
    paymentMethod: 'apple_pay',
    paymentStatus: 'sandbox_paid',
    paymentGateway: 'Sandbox Test',
    idempotencyKey: `TEST-SYNC-${Date.now()}`,
  });

  assert.equal(createdDeliveryOrder.success, true, 'createOrderAtomic must succeed for catalog item');
  assert.equal(createdDeliveryOrder.deliveryFeeFils, 0, 'Platform deliveryFeeFils must be 0');
  assert.equal(
    createdDeliveryOrder.totalFils,
    createdDeliveryOrder.subtotalFils,
    'Total must equal subtotal with 0 AED platform delivery fee'
  );

  // Over-refund attempt against actual order total must be rejected
  const overRefund = await validateAndProcessOrderRefund({
    orderId: createdDeliveryOrder.orderId!,
    customerId: 'cust-sync-test',
    requestedBy: 'cust-sync-test',
    reason: 'Inflated amount',
    amountFilsOverride: (createdDeliveryOrder.totalFils || 5500) + 1000,
  });
  assert.equal(overRefund.success, false, 'Over-refund exceeding order total must be rejected');
  assert.ok(overRefund.error?.includes('REFUND_EXCEEDS_ORDER_TOTAL'));

  const syncedOrders = await getAllOrdersSynced({ includeAll: true });
  assert.ok(
    syncedOrders.some((o) => o.id === 'ord-initial-1'),
    'getAllOrdersSynced() must include seeded demo order ord-initial-1'
  );
  assert.ok(
    syncedOrders.some((o) => o.id === createdDeliveryOrder.orderId),
    'getAllOrdersSynced() must include the newly created order for cross-portal sync'
  );
  console.log('   [PASS] Order sync & restaurant self-delivery passed.\n');

  // -------------------------------------------------------------------------
  // 6. PAYMENT GATEWAY CONFIG & ZIINA_TEST_MODE CONTROL TESTS
  // -------------------------------------------------------------------------
  console.log('6) Testing Payment Gateway Config (Credit Card, Apple Pay, Cash Only + ZIINA_TEST_MODE)...');
  const gwConfig = getPaymentGatewayConfig();
  assert.equal(typeof gwConfig.hasLiveGateway, 'boolean', 'hasLiveGateway must be boolean');
  assert.equal(gwConfig.testMode, true, 'ZIINA_TEST_MODE=true must set testMode=true');
  assert.deepEqual(
    gwConfig.supportedPaymentMethods,
    ['credit_card', 'apple_pay', 'pickup_cash'],
    'Only credit_card, apple_pay, and pickup_cash are permitted (no Tabby/Tamara)'
  );
  assert.ok(gwConfig.supportedCurrencies.includes('AED'), 'AED must be supported');

  if (!gwConfig.hasLiveGateway) {
    const sbxRes = confirmSandboxPayment({
      amountFils: 5500,
      paymentMethod: 'credit_card',
      cardLast4: '4242',
    });
    assert.equal(sbxRes.success, true, 'confirmSandboxPayment should succeed when ZIINA_TEST_MODE is true');
    assert.ok(sbxRes.transactionId?.startsWith('TXN-SBX-'), 'Sandbox transaction ID must start with TXN-SBX-');
  }
  console.log('   [PASS] Payment gateway config & ZIINA_TEST_MODE control passed.\n');

  // -------------------------------------------------------------------------
  // LIVE EXPRESS SERVER INTEGRATION TESTS (RBAC, WEBHOOKS, TAMPERING, ISOLATION)
  // -------------------------------------------------------------------------
  const app = createServer();
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // -----------------------------------------------------------------------
    // 7. RBAC PERMISSION BOUNDARIES & REMOVAL OF UNIFIED MERCHANT PIN
    // -----------------------------------------------------------------------
    console.log('7) Testing RBAC Permission Boundaries & Removal of Unified Merchant PIN...');

    // Unauthenticated callers must get 401 on protected routes
    const unauthComm = await fetch(`${baseUrl}/api/finance/commissions/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId: 'merchant-alnakheel-bakery', newRate: 10 }),
    });
    assert.equal(unauthComm.status, 401, 'Unauthenticated user cannot update commission');

    const unauthLogs = await fetch(`${baseUrl}/api/finance/commissions/logs`);
    assert.equal(unauthLogs.status, 401, 'Unauthenticated user cannot read commission logs');

    const unauthLoyaltyReport = await fetch(`${baseUrl}/api/loyalty/admin/report`);
    assert.equal(unauthLoyaltyReport.status, 401, 'Unauthenticated user cannot read admin loyalty report');

    const unauthStatusUpdate = await fetch(`${baseUrl}/api/orders/update-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 'ord-initial-1', newStatus: 'accepted' }),
    });
    assert.equal(unauthStatusUpdate.status, 401, 'Unauthenticated customer cannot mutate order status');

    const unauthRefundLogs = await fetch(`${baseUrl}/api/orders/refund-logs`);
    assert.equal(unauthRefundLogs.status, 401, 'Unauthenticated user cannot view refund audit logs');

    // Unified Merchant PIN MUST be rejected (403)
    const legacyMerchantPinRes = await fetch(`${baseUrl}/api/auth/verify-portal-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: testPin, portalType: 'merchant' }),
    });
    assert.equal(
      legacyMerchantPinRes.status,
      403,
      'Unified merchant PIN must be disabled and rejected with 403'
    );

    // Admin emergency PIN still unlocks Admin scope
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/verify-portal-pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: testPin, portalType: 'admin' }),
    });
    assert.equal(adminLoginRes.status, 200, 'Valid admin PIN must unlock admin scope');
    const adminLoginData = (await adminLoginRes.json()) as { portalToken: string };

    // Reset a seeded merchant's secret via Admin API and log in with username + 8-digit secretCode
    const targetMerchantId = INITIAL_SURPLUS_ITEMS[1].merchant.id || 'merchant-alnakheel-bakery';
    const resetSeededRes = await resetMerchantSecret(targetMerchantId);
    const merchantLoginRes = await fetch(`${baseUrl}/api/auth/merchant-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: resetSeededRes.account.username,
        secretCode: resetSeededRes.oneTimeSecretCode,
      }),
    });
    assert.equal(merchantLoginRes.status, 200, 'Valid per-merchant username + 8-digit secret must log in (200)');
    const merchantLoginData = (await merchantLoginRes.json()) as { portalToken: string };
    assert.ok(merchantLoginData.portalToken, 'Merchant login must return signed portalToken');

    // Merchant token CANNOT access Admin finance/loyalty/merchant-creation routes!
    const merchantAdminBlocked = await fetch(`${baseUrl}/api/finance/commissions/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-portal-token': merchantLoginData.portalToken,
      },
      body: JSON.stringify({ merchantId: targetMerchantId, newRate: 10 }),
    });
    assert.equal(merchantAdminBlocked.status, 403, 'Merchant token must be blocked (403) from Admin routes');

    const adminLogsAllowed = await fetch(`${baseUrl}/api/finance/commissions/logs`, {
      headers: { 'x-portal-token': adminLoginData.portalToken },
    });
    assert.equal(adminLogsAllowed.status, 200, 'Admin token must access commission logs (200)');

    const adminSettingsAllowed = await fetch(`${baseUrl}/api/finance/summary`, {
      headers: { 'x-portal-token': adminLoginData.portalToken },
    });
    assert.equal(adminSettingsAllowed.status, 200, 'Admin token must access financial summary (200)');
    console.log('   [PASS] RBAC permission boundaries & unified PIN removal passed.\n');

    // -----------------------------------------------------------------------
    // 8. ADMIN PIN & WHATSAPP OTP BRUTE-FORCE RATE LIMITING + LOCKOUT
    // -----------------------------------------------------------------------
    console.log('8) Testing Admin PIN & WhatsApp OTP Brute-Force Rate Limiting...');
    const attackerIp = '198.51.100.77';
    for (let i = 0; i < 5; i += 1) {
      const badTry = await fetch(`${baseUrl}/api/auth/verify-portal-pin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': attackerIp,
        },
        body: JSON.stringify({ pin: '0000', portalType: 'admin' }),
      });
      const expectedPinStatus = i === 4 ? 429 : 401;
      assert.equal(badTry.status, expectedPinStatus, `Wrong PIN attempt #${i + 1} must return ${expectedPinStatus}`);
    }
    const lockedPinTry = await fetch(`${baseUrl}/api/auth/verify-portal-pin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': attackerIp,
      },
      body: JSON.stringify({ pin: testPin, portalType: 'admin' }),
    });
    assert.equal(lockedPinTry.status, 429, '6th PIN attempt after 5 failures must return 429 Locked Out');

    // WhatsApp OTP brute-force lockout
    const otpPhone = '+971508887766';
    const sendOtpRes = await fetch(`${baseUrl}/api/auth/send-whatsapp-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: otpPhone }),
    });
    assert.equal(sendOtpRes.status, 200, 'OTP send should succeed');
    const sendOtpData = (await sendOtpRes.json()) as { code?: string };

    for (let i = 0; i < 5; i += 1) {
      const badOtp = await fetch(`${baseUrl}/api/auth/verify-whatsapp-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: otpPhone, code: '000000' }),
      });
      const expectedCode = i === 4 ? 429 : 400;
      assert.equal(badOtp.status, expectedCode, `Bad OTP attempt #${i + 1} status check`);
    }
    assert.ok(sendOtpData.code, 'Non-production OTP preview code returned for verification test');
    console.log('   [PASS] Admin PIN & OTP brute-force lockouts passed.\n');

    // -----------------------------------------------------------------------
    // 9. MANDATORY WEBHOOK SIGNATURE VERIFICATION (ZIINA & STRIPE)
    // -----------------------------------------------------------------------
    console.log('9) Testing Mandatory Ziina & Stripe Webhook Signature Verification...');
    delete process.env.ZIINA_WEBHOOK_SECRET;
    delete process.env.STRIPE_WEBHOOK_SECRET;

    const missingZiinaSecretRes = await fetch(`${baseUrl}/api/payments/ziina-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: 'payment_intent.status.updated', data: { id: 'pi_1', status: 'completed' } }),
    });
    assert.equal(missingZiinaSecretRes.status, 503, 'Ziina webhook must fail closed (503) if secret missing');

    const missingStripeSecretRes = await fetch(`${baseUrl}/api/payments/stripe-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_1' } } }),
    });
    assert.equal(missingStripeSecretRes.status, 503, 'Stripe webhook must fail closed (503) if secret missing');

    process.env.ZIINA_WEBHOOK_SECRET = testZiinaWebhookSecret;
    process.env.STRIPE_WEBHOOK_SECRET = testStripeWebhookSecret;

    const ziinaPayload = JSON.stringify({
      event: 'payment_intent.status.updated',
      data: { id: 'pi_test_ziina_1', status: 'completed', amount: 5500 },
    });
    const forgedZiinaRes = await fetch(`${baseUrl}/api/payments/ziina-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hmac-signature': 'deadbeef' },
      body: ziinaPayload,
    });
    assert.equal(forgedZiinaRes.status, 401, 'Forged Ziina HMAC must return 401');

    const validZiinaSig = crypto
      .createHmac('sha256', testZiinaWebhookSecret)
      .update(ziinaPayload)
      .digest('hex');
    const validZiinaRes = await fetch(`${baseUrl}/api/payments/ziina-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-hmac-signature': validZiinaSig },
      body: ziinaPayload,
    });
    assert.equal(validZiinaRes.status, 200, 'Valid Ziina HMAC signature must pass (200)');

    const stripePayload = JSON.stringify({
      id: 'evt_test_1',
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_stripe_test_1', amount_received: 2800 } },
    });
    const forgedStripeRes = await fetch(`${baseUrl}/api/payments/stripe-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': 't=12345,v1=deadbeef' },
      body: stripePayload,
    });
    assert.equal(forgedStripeRes.status, 401, 'Forged Stripe signature must return 401');

    const tsNow = Math.floor(Date.now() / 1000);
    const validStripeSig = crypto
      .createHmac('sha256', testStripeWebhookSecret)
      .update(`${tsNow}.${stripePayload}`)
      .digest('hex');
    const validStripeRes = await fetch(`${baseUrl}/api/payments/stripe-webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': `t=${tsNow},v1=${validStripeSig}`,
      },
      body: stripePayload,
    });
    assert.equal(validStripeRes.status, 200, 'Valid Stripe-Signature must pass (200)');
    console.log('   [PASS] Ziina & Stripe mandatory webhook signature verification passed.\n');

    // -----------------------------------------------------------------------
    // 10. CLIENT TAMPERING, IDEMPOTENCY CONFLICT, PICKUP LOCKOUT & CUSTOMER SCOPING
    // -----------------------------------------------------------------------
    console.log('10) Testing Anti-Tampering, Idempotency Conflict, Pickup HMAC & Scoping...');
    const idemKey = `IDEM-HTTP-${Date.now()}`;
    const catalogItem = INITIAL_SURPLUS_ITEMS[1];
    const expectedTotalFils = catalogItem.discountedPriceFils ?? Math.round(catalogItem.discountedPrice * 100);

    // Attempt to spoof totalFils = 100 and discountedPrice = 1 in body
    const createRes = await fetch(`${baseUrl}/api/orders/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-customer-id': 'cust-alice' },
      body: JSON.stringify({
        customerId: 'cust-alice',
        customerName: 'Alice',
        customerPhone: '+971501111111',
        merchantId: catalogItem.merchant.id,
        items: [{ itemId: catalogItem.id, quantity: 1 }],
        itemSnapshot: { discountedPrice: 1, discountedPriceFils: 100 },
        totalFils: 100,
        fulfillmentType: 'pickup',
        paymentMethod: 'apple_pay',
        idempotencyKey: idemKey,
      }),
    });
    assert.equal(createRes.status, 201, 'Create order must succeed cleanly');
    const createdJson = (await createRes.json()) as {
      orderId: string;
      pickupCode: string;
      totalFils: number;
    };
    assert.equal(
      createdJson.totalFils,
      expectedTotalFils,
      'Server MUST ignore spoofed client price/total and enforce catalog Fils price'
    );

    // Duplicate retry with identical key + identical payload -> replays same orderId
    const replayRes = await fetch(`${baseUrl}/api/orders/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: 'cust-alice',
        customerName: 'Alice',
        customerPhone: '+971501111111',
        merchantId: catalogItem.merchant.id,
        items: [{ itemId: catalogItem.id, quantity: 1 }],
        fulfillmentType: 'pickup',
        paymentMethod: 'apple_pay',
        idempotencyKey: idemKey,
      }),
    });
    const replayJson = (await replayRes.json()) as { orderId: string; idempotentReplay?: boolean };
    assert.equal(replayJson.orderId, createdJson.orderId, 'Idempotent retry returns same orderId');
    assert.equal(replayJson.idempotentReplay, true);

    // Same idempotencyKey with altered payload -> 409 Conflict
    const conflictRes = await fetch(`${baseUrl}/api/orders/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: 'cust-alice',
        merchantId: catalogItem.merchant.id,
        items: [{ itemId: catalogItem.id, quantity: 2 }],
        fulfillmentType: 'pickup',
        paymentMethod: 'apple_pay',
        idempotencyKey: idemKey,
      }),
    });
    assert.equal(conflictRes.status, 409, 'Reusing idempotency key with changed payload must return 409');

    // Bob cannot see Alice's order in GET /api/orders
    const bobOrdersRes = await fetch(`${baseUrl}/api/orders`, {
      headers: { 'x-customer-id': 'cust-bob' },
    });
    const bobOrdersJson = (await bobOrdersRes.json()) as { orders: { id: string }[] };
    assert.equal(
      bobOrdersJson.orders.some((o) => o.id === createdJson.orderId),
      false,
      'Customer Bob must NOT see Customer Alice order'
    );

    // Bob cannot refund Alice's order -> 403 Forbidden
    const bobRefundAlice = await fetch(`${baseUrl}/api/orders/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-customer-id': 'cust-bob' },
      body: JSON.stringify({
        orderId: createdJson.orderId,
        customerId: 'cust-bob',
        requestedBy: 'cust-bob',
        reason: 'Trying to cancel someone else order',
      }),
    });
    assert.equal(bobRefundAlice.status, 403, 'Customer cannot refund another customer order');

    // Fractional amountFils must be rejected (400)
    const fractionalIntentRes = await fetch(`${baseUrl}/api/payments/create-intent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountFils: 28.5, paymentMethod: 'apple_pay' }),
    });
    assert.equal(fractionalIntentRes.status, 400, 'Non-integer amountFils must be rejected (400)');

    // Transition order placed -> accepted -> preparing -> ready_for_pickup with matching merchant token
    for (const nextState of ['accepted', 'preparing', 'ready_for_pickup']) {
      const trRes = await fetch(`${baseUrl}/api/orders/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-portal-token': merchantLoginData.portalToken,
        },
        body: JSON.stringify({ orderId: createdJson.orderId, newStatus: nextState }),
      });
      assert.equal(trRes.status, 200, `Merchant status transition to ${nextState} must succeed`);
    }

    // Wrong pickup code fails, and valid code succeeds cleanly via timingSafeEqual
    const wrongPickup = await fetch(`${baseUrl}/api/orders/verify-pickup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-portal-token': merchantLoginData.portalToken,
      },
      body: JSON.stringify({ orderId: createdJson.orderId, pickupCode: '000000' }),
    });
    assert.equal(wrongPickup.status, 400, 'Wrong pickup code must be rejected (400)');

    const rightPickup = await fetch(`${baseUrl}/api/orders/verify-pickup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-portal-token': merchantLoginData.portalToken,
      },
      body: JSON.stringify({
        orderId: createdJson.orderId,
        pickupCode: createdJson.pickupCode,
      }),
    });
    assert.equal(rightPickup.status, 200, 'Valid pickup code must succeed (200)');

    // Second reuse of consumed pickup code must fail!
    const reusePickup = await fetch(`${baseUrl}/api/orders/verify-pickup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-portal-token': merchantLoginData.portalToken,
      },
      body: JSON.stringify({
        orderId: createdJson.orderId,
        pickupCode: createdJson.pickupCode,
      }),
    });
    assert.equal(reusePickup.status, 400, 'Consumed pickup code cannot be reused');

    // Verify client spoofing firstOrderCompleted on /register-bonus awards 0 points
    const spoofBonusRes = await fetch(`${baseUrl}/api/loyalty/register-bonus`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: '+971507776655',
        customerName: 'Spoofer',
        firstOrderCompleted: true,
      }),
    });
    const spoofBonusJson = (await spoofBonusRes.json()) as { pointsAwarded: number };
    assert.equal(
      spoofBonusJson.pointsAwarded,
      0,
      'Client spoofing firstOrderCompleted=true must be ignored (0 points)'
    );

    console.log('   [PASS] Anti-tampering, idempotency conflict, pickup HMAC & customer scoping passed.\n');

    // -----------------------------------------------------------------------
    // 11. PER-RESTAURANT ISOLATION (403), SCRYPT HASHING, INDEPENDENT 5-TRY LOCKOUT & TOKEN TAMPERING
    // -----------------------------------------------------------------------
    console.log(
      '11) Testing Per-Restaurant Account Isolation (403), Scrypt Hashing, Per-Merchant Lockout & Token Tampering...'
    );

    // 11a. Admin creates Restaurant A and Restaurant B
    const createRestARes = await fetch(`${baseUrl}/api/auth/merchants/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-portal-token': adminLoginData.portalToken,
      },
      body: JSON.stringify({
        merchantId: 'merchant-rest-alpha',
        name: 'Alpha Grills RAK',
        nameAr: 'مطعم ألفا للمشاوي',
        phone: '+971501110001',
      }),
    });
    assert.equal(createRestARes.status, 201, 'Admin creating Restaurant A must return 201');
    const restAData = (await createRestARes.json()) as {
      account: { merchantId: string; username: string };
      oneTimeSecretCode: string;
    };
    assert.match(restAData.oneTimeSecretCode, /^\d{8}$/, 'One-time secret code for Restaurant A must be 8 digits');

    const createRestBRes = await fetch(`${baseUrl}/api/auth/merchants/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-portal-token': adminLoginData.portalToken,
      },
      body: JSON.stringify({
        merchantId: 'merchant-rest-beta',
        name: 'Beta Bakery RAK',
        nameAr: 'مخبز بيتا رأس الخيمة',
        phone: '+971501110002',
      }),
    });
    assert.equal(createRestBRes.status, 201, 'Admin creating Restaurant B must return 201');
    const restBData = (await createRestBRes.json()) as {
      account: { merchantId: string; username: string };
      oneTimeSecretCode: string;
    };
    assert.match(restBData.oneTimeSecretCode, /^\d{8}$/, 'One-time secret code for Restaurant B must be 8 digits');
    assert.notEqual(restAData.account.username, restBData.account.username, 'Usernames must be unique');

    // 11b. Verify secret code is NEVER stored in plaintext nor exposed in subsequent API responses
    const storedRecordA = getMerchantCredentialRecordForTest(restAData.account.merchantId);
    const storedRecordB = getMerchantCredentialRecordForTest(restBData.account.merchantId);
    assert.ok(storedRecordA && storedRecordB, 'Server credential vault records must exist');
    assert.equal(storedRecordA.salt.length, 32, 'Restaurant A must have a unique 16-byte (32 hex) salt');
    assert.equal(storedRecordA.secretHash.length, 128, 'Restaurant A must have a 64-byte (128 hex) scrypt hash');
    assert.notEqual(storedRecordA.salt, storedRecordB.salt, 'Each restaurant must have its own unique salt');
    assert.equal(
      storedRecordA.secretHash.includes(restAData.oneTimeSecretCode),
      false,
      'Stored hash must never contain plaintext secret code'
    );

    const listMerchantsRes = await fetch(`${baseUrl}/api/auth/merchants`, {
      headers: { 'x-portal-token': adminLoginData.portalToken },
    });
    const listMerchantsText = await listMerchantsRes.text();
    assert.equal(
      listMerchantsText.includes(restAData.oneTimeSecretCode),
      false,
      'Plaintext secret code of Restaurant A must NEVER appear in GET /api/auth/merchants response'
    );
    assert.equal(
      listMerchantsText.includes(restBData.oneTimeSecretCode),
      false,
      'Plaintext secret code of Restaurant B must NEVER appear in GET /api/auth/merchants response'
    );
    assert.equal(
      listMerchantsText.includes(storedRecordA.secretHash),
      false,
      'scrypt secretHash must NEVER be exposed in GET /api/auth/merchants response'
    );

    // 11c. Generic login error message & independent 5-attempt per-restaurant lockout
    const nonExistentUserRes = await fetch(`${baseUrl}/api/auth/merchant-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'unknown-ghost-restaurant', secretCode: '12345678' }),
    });
    assert.equal(nonExistentUserRes.status, 401, 'Non-existent username must return 401');
    const nonExistentUserJson = (await nonExistentUserRes.json()) as { error: string };
    assert.equal(
      nonExistentUserJson.error,
      GENERIC_MERCHANT_LOGIN_ERROR,
      'Non-existent username must return the exact generic error message'
    );

    // 5 wrong attempts on Restaurant A lock out Restaurant A (429 on 5th wrong attempt)
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const wrongTry = await fetch(`${baseUrl}/api/auth/merchant-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: restAData.account.username,
          secretCode: '00000000',
        }),
      });
      if (attempt < 5) {
        assert.equal(wrongTry.status, 401, `Restaurant A wrong attempt #${attempt} must return 401`);
        const wrongJson = (await wrongTry.json()) as { error: string };
        assert.equal(
          wrongJson.error,
          GENERIC_MERCHANT_LOGIN_ERROR,
          'Wrong password on valid username must return the exact same generic error message'
        );
      } else {
        assert.equal(wrongTry.status, 429, 'Restaurant A 5th wrong attempt must trigger 15-min lockout (429)');
      }
    }

    // Even with the CORRECT secret code, Restaurant A is now locked out for 15 minutes (429)
    const lockedRestATry = await fetch(`${baseUrl}/api/auth/merchant-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: restAData.account.username,
        secretCode: restAData.oneTimeSecretCode,
      }),
    });
    assert.equal(lockedRestATry.status, 429, 'Locked-out Restaurant A must reject login with 429');

    // Meanwhile, Restaurant B is completely unaffected and logs in immediately (200)!
    const loginRestBRes = await fetch(`${baseUrl}/api/auth/merchant-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: restBData.account.username,
        secretCode: restBData.oneTimeSecretCode,
      }),
    });
    assert.equal(
      loginRestBRes.status,
      200,
      'Restaurant B must log in cleanly (200) while Restaurant A is locked out'
    );
    const loginRestBJson = (await loginRestBRes.json()) as { portalToken: string };
    assert.ok(loginRestBJson.portalToken, 'Restaurant B receives its own signed portalToken');

    // Admin resets Restaurant A's secret code -> clears lockout and issues new 8-digit code
    const resetRestARes = await fetch(
      `${baseUrl}/api/auth/merchants/${encodeURIComponent(restAData.account.merchantId)}/reset-secret`,
      {
        method: 'POST',
        headers: { 'x-portal-token': adminLoginData.portalToken },
      }
    );
    assert.equal(resetRestARes.status, 200, 'Admin resetting Restaurant A code must return 200');
    const resetRestAJson = (await resetRestARes.json()) as { oneTimeSecretCode: string };

    const loginRestARes = await fetch(`${baseUrl}/api/auth/merchant-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: restAData.account.username,
        secretCode: resetRestAJson.oneTimeSecretCode,
      }),
    });
    assert.equal(loginRestARes.status, 200, 'Restaurant A logs in with newly reset 8-digit code');
    const loginRestAJson = (await loginRestARes.json()) as { portalToken: string };

    // 11d. Strict Cross-Restaurant Data Isolation (Orders, Status, Pickup, Catalog, Finance Reports)
    // Register a catalog item for Restaurant A and one for Restaurant B
    const itemRestAId = `item-alpha-${Date.now()}`;
    const itemRestBId = `item-beta-${Date.now()}`;

    const addCatARes = await fetch(`${baseUrl}/api/orders/catalog`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-portal-token': loginRestAJson.portalToken,
      },
      body: JSON.stringify({
        item: {
          ...INITIAL_SURPLUS_ITEMS[0],
          id: itemRestAId,
          discountedPrice: 30,
          discountedPriceFils: 3000,
          stockRemaining: 5,
          merchant: { ...INITIAL_SURPLUS_ITEMS[0].merchant, id: restAData.account.merchantId },
        },
      }),
    });
    assert.equal(addCatARes.status, 201, 'Restaurant A can register its own catalog item');

    const addCatBRes = await fetch(`${baseUrl}/api/orders/catalog`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-portal-token': loginRestBJson.portalToken,
      },
      body: JSON.stringify({
        item: {
          ...INITIAL_SURPLUS_ITEMS[0],
          id: itemRestBId,
          discountedPrice: 25,
          discountedPriceFils: 2500,
          stockRemaining: 5,
          merchant: { ...INITIAL_SURPLUS_ITEMS[0].merchant, id: restBData.account.merchantId },
        },
      }),
    });
    assert.equal(addCatBRes.status, 201, 'Restaurant B can register its own catalog item');

    // Restaurant A attempts to modify or create an item belonging to Restaurant B -> MUST return 403
    const crossCatalogAttempt = await fetch(`${baseUrl}/api/orders/catalog`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-portal-token': loginRestAJson.portalToken,
      },
      body: JSON.stringify({
        item: {
          ...INITIAL_SURPLUS_ITEMS[0],
          id: itemRestBId,
          discountedPrice: 5,
          merchant: { ...INITIAL_SURPLUS_ITEMS[0].merchant, id: restBData.account.merchantId },
        },
      }),
    });
    assert.equal(
      crossCatalogAttempt.status,
      403,
      'Restaurant A attempting to modify Restaurant B catalog item must return 403'
    );

    // Create an order for Restaurant A and an order for Restaurant B
    const orderARes = await createOrderAtomic({
      customerId: 'cust-iso-1',
      customerName: 'Customer 1',
      customerPhone: '+971501230001',
      merchantId: restAData.account.merchantId,
      items: [{ itemId: itemRestAId, quantity: 1 }],
      fulfillmentType: 'pickup',
      paymentMethod: 'apple_pay',
      idempotencyKey: `ISO-ORD-A-${Date.now()}`,
    });
    const orderBRes = await createOrderAtomic({
      customerId: 'cust-iso-2',
      customerName: 'Customer 2',
      customerPhone: '+971501230002',
      merchantId: restBData.account.merchantId,
      items: [{ itemId: itemRestBId, quantity: 1 }],
      fulfillmentType: 'pickup',
      paymentMethod: 'apple_pay',
      idempotencyKey: `ISO-ORD-B-${Date.now()}`,
    });
    assert.ok(orderARes.orderId && orderBRes.orderId, 'Both orders created');

    // Restaurant A fetches GET /api/orders -> sees ONLY Restaurant A's order, NEVER Restaurant B's order
    const getOrdersARes = await fetch(`${baseUrl}/api/orders`, {
      headers: { 'x-portal-token': loginRestAJson.portalToken },
    });
    assert.equal(getOrdersARes.status, 200);
    const getOrdersAJson = (await getOrdersARes.json()) as { orders: { id: string }[] };
    assert.equal(
      getOrdersAJson.orders.some((o) => o.id === orderARes.orderId),
      true,
      'Restaurant A must see its own order'
    );
    assert.equal(
      getOrdersAJson.orders.some((o) => o.id === orderBRes.orderId),
      false,
      'Restaurant A must NEVER see Restaurant B order'
    );

    // Restaurant A attempts to query Restaurant B's orders via query string -> 403
    const crossQueryOrders = await fetch(
      `${baseUrl}/api/orders?merchantId=${encodeURIComponent(restBData.account.merchantId)}`,
      {
        headers: { 'x-portal-token': loginRestAJson.portalToken },
      }
    );
    assert.equal(
      crossQueryOrders.status,
      403,
      'Restaurant A passing Restaurant B merchantId in query must return 403'
    );

    // Restaurant A attempts to update status of Restaurant B's order -> 403
    const crossStatusAttempt = await fetch(`${baseUrl}/api/orders/update-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-portal-token': loginRestAJson.portalToken,
      },
      body: JSON.stringify({ orderId: orderBRes.orderId, newStatus: 'accepted' }),
    });
    assert.equal(
      crossStatusAttempt.status,
      403,
      'Restaurant A attempting to update Restaurant B order status must return 403'
    );

    // Restaurant A attempts to verify pickup code of Restaurant B's order -> 403
    const crossPickupAttempt = await fetch(`${baseUrl}/api/orders/verify-pickup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-portal-token': loginRestAJson.portalToken,
      },
      body: JSON.stringify({ orderId: orderBRes.orderId, pickupCode: orderBRes.pickupCode }),
    });
    assert.equal(
      crossPickupAttempt.status,
      403,
      'Restaurant A attempting to verify pickup on Restaurant B order must return 403'
    );

    // Restaurant A attempts to view Restaurant B's financial settlement statement -> 403
    const crossSettlementAttempt = await fetch(
      `${baseUrl}/api/finance/settlements/merchants/${encodeURIComponent(restBData.account.merchantId)}`,
      {
        headers: { 'x-portal-token': loginRestAJson.portalToken },
      }
    );
    assert.equal(
      crossSettlementAttempt.status,
      403,
      'Restaurant A attempting to read Restaurant B financial settlement must return 403'
    );

    // 11e. Expired, Tampered, and Suspended portalTokens must be rejected
    const expiredToken = issuePortalSessionToken('merchant', {
      merchantId: restAData.account.merchantId,
      ttlSeconds: -10,
    });
    const expiredRes = await fetch(`${baseUrl}/api/orders`, {
      headers: { 'x-portal-token': expiredToken },
    });
    assert.equal(expiredRes.status, 401, 'Expired portalToken must be rejected with 401');

    // Tamper with Restaurant A's valid token payload to claim merchantId = Restaurant B
    const [origPayloadB64, origSig] = loginRestAJson.portalToken.split('.');
    const decodedClaims = JSON.parse(Buffer.from(origPayloadB64, 'base64url').toString('utf8'));
    decodedClaims.merchantId = restBData.account.merchantId;
    const tamperedPayloadB64 = Buffer.from(JSON.stringify(decodedClaims), 'utf8').toString('base64url');
    const tamperedToken = `${tamperedPayloadB64}.${origSig}`;

    const tamperedRes = await fetch(`${baseUrl}/api/orders`, {
      headers: { 'x-portal-token': tamperedToken },
    });
    assert.equal(tamperedRes.status, 401, 'Tampered portalToken payload must be rejected with 401');

    // Admin suspends Restaurant B -> Restaurant B's existing token is immediately rejected (403)
    const suspendRestBRes = await fetch(
      `${baseUrl}/api/auth/merchants/${encodeURIComponent(restBData.account.merchantId)}/status`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-portal-token': adminLoginData.portalToken,
        },
        body: JSON.stringify({ disabled: true }),
      }
    );
    assert.equal(suspendRestBRes.status, 200, 'Admin suspending Restaurant B must succeed');

    const suspendedTokenUse = await fetch(`${baseUrl}/api/orders`, {
      headers: { 'x-portal-token': loginRestBJson.portalToken },
    });
    assert.equal(
      suspendedTokenUse.status,
      403,
      'Suspended restaurant account token must be rejected with 403'
    );

    console.log(
      '   [PASS] Per-restaurant isolation (403), scrypt hashing, 5-attempt lockout & token verification passed.\n'
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('====================================================');
  console.log('ALL 11 AUTOMATED SECURITY & BUSINESS TEST SUITES PASSED!');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
