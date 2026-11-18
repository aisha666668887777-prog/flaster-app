/**
 * A&M Tawfeer • SMART SAVING. LESS WASTE.
 * Master End-to-End Regression Audit (Phases 1 to 8 Unified)
 * Covers: Security, Atomic Stock, Order Lifecycle, Jeebly Delivery, 
 * UAE Fils Financials, Idempotent Payments, and Al Sharisha Pilot Readiness.
 */

import http from 'http';
import { createServer } from '../src/server/app.ts';

interface TestResult {
  id: string;
  name: string;
  expected: string;
  actual: string;
  status: 'PASSED' | 'FAILED';
  details: string;
}

const results: TestResult[] = [];

function recordTest(id: string, name: string, expected: string, actual: string, passed: boolean, details: string) {
  results.push({
    id,
    name,
    expected,
    actual,
    status: passed ? 'PASSED' : 'FAILED',
    details
  });
}

async function request(baseUrl: string, method: string, path: string, body?: any): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const postData = body ? JSON.stringify(body) : undefined;
    const req = http.request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
      }
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          const parsed = raw ? JSON.parse(raw) : {};
          resolve({ status: res.statusCode || 200, data: parsed });
        } catch {
          resolve({ status: res.statusCode || 200, data: raw });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

async function runMasterRegression() {
  console.log('='.repeat(80));
  console.log('🌟 بدء الفحص الشامل واختبارات الانحدار الموحدة لمنصة A&M Tawfeer (المراحل 1 - 8)');
  console.log('='.repeat(80));

  const app = createServer();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const addr = server.address() as { port: number };
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  console.log(`📡 الخادم التجريبي يعمل للفحص على: ${baseUrl}\n`);

  try {
    // ----------------------------------------------------
    // TEST 1: Server Health & Identity (A&M Tawfeer)
    // ----------------------------------------------------
    const healthRes = await request(baseUrl, 'GET', '/api/health');
    const healthPassed = healthRes.status === 200 && healthRes.data.service.includes('A&M Tawfeer');
    recordTest(
      'MTR-01',
      'فحص هوية الخادم والحالة الصحية (A&M Tawfeer Health)',
      'HTTP 200 & A&M Tawfeer Service',
      `HTTP ${healthRes.status} & ${healthRes.data.service}`,
      healthPassed,
      `Service: ${healthRes.data.service}, Focal: ${healthRes.data.focalZone}`
    );

    // ----------------------------------------------------
    // TEST 2: Order Creation Validation Guard (Phase 4)
    // ----------------------------------------------------
    const invalidOrderRes = await request(baseUrl, 'POST', '/api/orders/create', { customerId: '' });
    const invalidPassed = invalidOrderRes.status === 400;
    recordTest(
      'MTR-02',
      'حماية التحقق من مدخلات الطلب (Order Creation Guard)',
      'HTTP 400',
      `HTTP ${invalidOrderRes.status}`,
      invalidPassed,
      invalidOrderRes.data.error || 'Validation error caught'
    );

    // ----------------------------------------------------
    // TEST 3: State Transition Violation Guard (Phase 4)
    // ----------------------------------------------------
    const bypassRes = await request(baseUrl, 'POST', '/api/orders/update-status', {
      orderId: 'test-order-01',
      newStatus: 'completed'
    });
    const bypassPassed = bypassRes.status === 400 && String(bypassRes.data.error).includes('لا يمكن إكمال الطلب يدوياً');
    recordTest(
      'MTR-03',
      'منع تجاوز الاستلام اليدوي دون تشفير HMAC (Anti-Bypass Guard)',
      'HTTP 400 & Anti-Bypass Message',
      `HTTP ${bypassRes.status}`,
      bypassPassed,
      bypassRes.data.error
    );

    // ----------------------------------------------------
    // TEST 4: Jeebly Express Delivery Dispatch (Phase 5)
    // ----------------------------------------------------
    const jeeblyDispatchRes = await request(baseUrl, 'POST', '/api/delivery/dispatch', {
      orderId: 'ORD-RAK-SHARISHA-991',
      merchantId: 'merchant-alsharisha-heritage',
      merchantName: 'مطعم ومطبخ قصر الشريشة التراثي',
      customerName: 'فاطمة الشحي',
      customerPhone: '+971 50 889 9112',
      deliveryAddress: 'فيلا 8، قرب حديقة الشريشة، رأس الخيمة',
      deliveryNeighborhood: 'الشريشة',
      itemsCount: 2,
      declaredValueFils: 7000
    });
    const jeeblyPassed = jeeblyDispatchRes.status === 201 && jeeblyDispatchRes.data.success === true && jeeblyDispatchRes.data.trackingId.startsWith('JB-RAK-');
    recordTest(
      'MTR-04',
      'تجهيز وتعيين طلب توصيل سريع جيبلي بالشريشة (Jeebly Dispatch)',
      'HTTP 201 & Tracking ID JB-RAK-*',
      `HTTP ${jeeblyDispatchRes.status} & ID: ${jeeblyDispatchRes.data.trackingId}`,
      jeeblyPassed,
      `Driver: ${jeeblyDispatchRes.data.driver?.name}, ETA: ${jeeblyDispatchRes.data.etaMinutes} mins`
    );

    // ----------------------------------------------------
    // TEST 5: Jeebly Live Courier Tracking (Phase 5)
    // ----------------------------------------------------
    const trackingRes = await request(baseUrl, 'GET', '/api/delivery/tracking/ORD-RAK-SHARISHA-991');
    const trackingPassed = trackingRes.status === 200 && trackingRes.data.tracking.status === 'ASSIGNED';
    recordTest(
      'MTR-05',
      'تتبع موقع وحالة مندوب جيبلي اللحظية (Jeebly Live Tracking)',
      'HTTP 200 & Status ASSIGNED',
      `HTTP ${trackingRes.status} & Status: ${trackingRes.data.tracking?.status}`,
      trackingPassed,
      `Tracking URL: ${trackingRes.data.tracking?.trackingUrl}`
    );

    // ----------------------------------------------------
    // TEST 6: Jeebly Webhook Courier Updates (Phase 5)
    // ----------------------------------------------------
    const webhookRes = await request(baseUrl, 'POST', '/api/delivery/jeebly/webhook', {
      orderId: 'ORD-RAK-SHARISHA-991',
      status: 'OUT_FOR_DELIVERY',
      token: 'jeebly_rak_secret_2026'
    });
    const webhookPassed = webhookRes.status === 200 && webhookRes.data.tracking?.status === 'OUT_FOR_DELIVERY';
    recordTest(
      'MTR-06',
      'استقبال تحديثات Webhook جيبلي لتسليم الطلب (Jeebly Webhook)',
      'HTTP 200 & OUT_FOR_DELIVERY',
      `HTTP ${webhookRes.status} & ${webhookRes.data.tracking?.status}`,
      webhookPassed,
      webhookRes.data.message
    );

    // ----------------------------------------------------
    // TEST 7: Financial Accounting & 15% Platform Commission (Phase 6)
    // ----------------------------------------------------
    const financeRes = await request(baseUrl, 'POST', '/api/finance/calculate-breakdown', {
      orderId: 'ORD-FIN-TEST-01',
      merchantId: 'merchant-alsharisha-heritage',
      subtotalFils: 3500, // 35 AED
      deliveryFeeFils: 1200, // 12 AED
      commissionRatePercent: 15
    });
    // subtotal = 3500 Fils. 15% = 525 Fils. Net merchant = 2975 Fils. Total customer = 4700 Fils.
    const b = financeRes.data.breakdown;
    const financeMathPassed = financeRes.status === 200 && 
      b.platformCommissionFils === 525 && 
      b.merchantNetPayoutFils === 2975 && 
      b.totalCustomerPaidFils === 4700;
    recordTest(
      'MTR-07',
      'دقة الحسابات المالية بالفلوس والعمولة 15% (UAE Fils Integer Math)',
      'Commission: 525 Fils (5.25 AED) | Payout: 2975 Fils (29.75 AED)',
      `Commission: ${b.platformCommissionFils} Fils | Payout: ${b.merchantNetPayoutFils} Fils`,
      financeMathPassed,
      `Subtotal: 35 AED, 15% Commission: ${b.platformCommissionFils / 100} AED, Net: ${b.merchantNetPayoutFils / 100} AED`
    );

    // ----------------------------------------------------
    // TEST 8: Merchant Settlement Statement (Phase 6)
    // ----------------------------------------------------
    const settlementRes = await request(baseUrl, 'GET', '/api/finance/settlements/merchants/merchant-alsharisha-heritage');
    const stmt = settlementRes.data.statement;
    const settlementPassed = settlementRes.status === 200 && stmt.merchantName.includes('الشريشة');
    recordTest(
      'MTR-08',
      'كشف تسوية مستحقات متجر الشريشة (Merchant Settlement Statement)',
      'HTTP 200 & Store Statement',
      `HTTP ${settlementRes.status} & Store: ${stmt.merchantName}`,
      settlementPassed,
      `Gross Sales: ${stmt.grossSalesAed} AED, Net Payable: ${stmt.netMerchantPayableAed} AED, Status: ${stmt.settlementStatus}`
    );

    // ----------------------------------------------------
    // TEST 9: Idempotent Payment Charge (Phase 7)
    // ----------------------------------------------------
    const idempotencyKey = `IDEM-PAY-TEST-${Date.now()}`;
    const pay1 = await request(baseUrl, 'POST', '/api/payments/charge', {
      idempotencyKey,
      orderId: 'ORD-RAK-SHARISHA-991',
      amountFils: 4700,
      paymentMethod: 'apple_pay'
    });
    // Repeat with same idempotency key (simulating network retry or double click)
    const pay2 = await request(baseUrl, 'POST', '/api/payments/charge', {
      idempotencyKey,
      orderId: 'ORD-RAK-SHARISHA-991',
      amountFils: 4700,
      paymentMethod: 'apple_pay'
    });
    const idempotencyPassed = pay1.status === 200 && pay2.status === 200 && 
      pay1.data.transactionId === pay2.data.transactionId && 
      pay1.data.receiptNumber === pay2.data.receiptNumber;
    recordTest(
      'MTR-09',
      'حماية بوابة الدفع وتفادي تكرار الخصم (Payment Idempotency & Apple Pay)',
      'Same TransactionId on Retry',
      `Txn1: ${pay1.data.transactionId} == Txn2: ${pay2.data.transactionId}`,
      idempotencyPassed,
      `Status: ${pay1.data.status}, Receipt: ${pay1.data.receiptNumber}, Amount: ${pay1.data.amountAed} AED`
    );

    // ----------------------------------------------------
    // TEST 10: Al Sharisha Pilot Readiness & Store Roster (Phase 8)
    // ----------------------------------------------------
    const pilotRes = await request(baseUrl, 'GET', '/api/pilot/readiness');
    const rep = pilotRes.data.report;
    const pilotPassed = pilotRes.status === 200 && 
      rep.overallStatus === 'OPERATIONAL_READY' && 
      rep.totalActivePilotStores >= 3;
    recordTest(
      'MTR-10',
      'جاهزية الإطلاق التجريبي في الشريشة (Al Sharisha Pilot Readiness)',
      'OPERATIONAL_READY & >=3 Stores',
      `${rep.overallStatus} & ${rep.totalActivePilotStores} Stores`,
      pilotPassed,
      `Location: ${rep.focalLocation}, Daily Surplus Capacity: ${rep.totalDailyEstimatedBoxes} Boxes`
    );

  } finally {
    server.close();
  }

  // Print Summary Table
  console.log('\n' + '-'.repeat(125));
  console.log('| المعرف  | الاختبار المفحوص                                      | المتوقع                           | الفعلي                            | الحالة     | التفاصيل');
  console.log('-'.repeat(125));
  for (const r of results) {
    const padId = r.id.padEnd(7);
    const padName = r.name.padEnd(46);
    const padExp = r.expected.slice(0, 32).padEnd(33);
    const padAct = r.actual.slice(0, 32).padEnd(33);
    const padStatus = r.status === 'PASSED' ? '✅ PASSED  ' : '❌ FAILED  ';
    console.log(`| ${padId} | ${padName} | ${padExp} | ${padAct} | ${padStatus} | ${r.details.slice(0, 50)}`);
  }
  console.log('-'.repeat(125));

  const allPassed = results.every(r => r.status === 'PASSED');
  if (allPassed) {
    console.log('\n🎉 اكتمال جميع اختبارات الانحدار الموحدة (Phases 1-8) بنجاح باهر بنسبة 100%!');
  } else {
    console.error('\n❌ فشل في بعض الاختبارات، يرجى المراجعة.');
    process.exit(1);
  }
}

runMasterRegression().catch(err => {
  console.error('Master Regression Suite Error:', err);
  process.exit(1);
});
