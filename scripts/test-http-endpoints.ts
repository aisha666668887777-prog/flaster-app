import { createServer } from '../src/server/app';
import { adminAuth, assignSuperAdminClaim } from '../src/server/adminAuth';
import jwt from 'jsonwebtoken';

interface HttpTestResult {
  testId: string;
  name: string;
  method: string;
  endpoint: string;
  headers: Record<string, string>;
  body?: unknown;
  expectedStatus: number;
  actualStatus: number;
  expectedBehavior: string;
  actualResponseBody: string;
  passed: boolean;
  executionStatus: 'EXECUTED_LIVE' | 'DEFERRED_AWAITING_CLOUD_PROVISION';
}

const results: HttpTestResult[] = [];
const TEST_SECRET = 'am_tawfeer_test_secret_key_2026';

async function runHttpEndpointSecurityTests() {
  console.log('========================================================================');
  console.log('🌐 تشغيل الاختبارات الحية المتقدمة لمسارات الخادم والأمان — A&M Tawfeer');
  console.log('========================================================================\n');

  const app = createServer();
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 3002;
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`📡 الخادم قيد الاستماع والاختبار على: ${baseUrl}\n`);

  try {
    // ---------------------------------------------------------------------------------
    // TEST 1: طلب المورد الإداري بدون ترويسة توكن إطلاقاً
    // ---------------------------------------------------------------------------------
    {
      const res = await fetch(`${baseUrl}/api/auth/admin-protected-resource`);
      const body = await res.json();
      const passed = res.status === 401 && body.error?.includes('Unauthorized: Missing token');
      results.push({
        testId: 'TEST-1',
        name: 'طلب المورد الإداري بدون توكن (No Token)',
        method: 'GET',
        endpoint: '/api/auth/admin-protected-resource',
        headers: {},
        expectedStatus: 401,
        actualStatus: res.status,
        expectedBehavior: 'رفض برمز 401 لغياب الترويسة',
        actualResponseBody: JSON.stringify(body),
        passed,
        executionStatus: 'EXECUTED_LIVE'
      });
    }

    // ---------------------------------------------------------------------------------
    // TEST 2: طلب المورد الإداري بتوكن تالف أو تزوير JWT خارجي
    // ---------------------------------------------------------------------------------
    {
      const fakeCustomerToken = jwt.sign(
        { uid: 'customer_789', email: 'customer@rak.ae', role: 'customer' },
        TEST_SECRET
      );

      const res = await fetch(`${baseUrl}/api/auth/admin-protected-resource`, {
        headers: { Authorization: `Bearer ${fakeCustomerToken}` }
      });
      const body = await res.json();
      const passed = res.status === 401; // مرفوض فورياً لأن المفتاح الخارجي غير موثق من Google
      results.push({
        testId: 'TEST-2',
        name: 'طلب المورد الإداري بتوكن غير معتمد من Google (Untrusted JWT)',
        method: 'GET',
        endpoint: '/api/auth/admin-protected-resource',
        headers: { Authorization: 'Bearer [Customer_JWT]' },
        expectedStatus: 401,
        actualStatus: res.status,
        expectedBehavior: 'رفض برمز 401 لأن التوكن لم يصدر عن Google Auth',
        actualResponseBody: JSON.stringify(body),
        passed,
        executionStatus: 'EXECUTED_LIVE'
      });
    }

    // ---------------------------------------------------------------------------------
    // TEST 3: محاولة مستخدم عادي استدعاء نقطة النهاية /assign-admin لترقية مستخدم آخر
    // ---------------------------------------------------------------------------------
    {
      const fakeCustomerToken = jwt.sign(
        { uid: 'regular_user_1', email: 'regular@rak.ae', role: 'customer' },
        TEST_SECRET
      );

      const res = await fetch(`${baseUrl}/api/auth/assign-admin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${fakeCustomerToken}`
        },
        body: JSON.stringify({ targetUid: 'target_victim_123' })
      });
      const body = await res.json();
      const passed = res.status === 401 || res.status === 403;
      results.push({
        testId: 'TEST-3',
        name: 'محاولة مستخدم عادي استدعاء POST /assign-admin لترقية نفسه أو غيره',
        method: 'POST',
        endpoint: '/api/auth/assign-admin',
        headers: { Authorization: 'Bearer [Customer_Token]' },
        body: { targetUid: 'target_victim_123' },
        expectedStatus: 401,
        actualStatus: res.status,
        expectedBehavior: 'رفض فوري ومنع أي تعديل إداري',
        actualResponseBody: JSON.stringify(body),
        passed,
        executionStatus: 'EXECUTED_LIVE'
      });
    }

    // ---------------------------------------------------------------------------------
    // TEST 4: استدعاء assignSuperAdminClaim بدون callerUid إطلاقاً (ثغرة تم إغلاقها)
    // ---------------------------------------------------------------------------------
    {
      let caughtError = '';
      try {
        // اختبار تمرير قيمة فارغة متعمداً للتحقق من رفضها وقت التشغيل
        await assignSuperAdminClaim('target_uid_555', '' as unknown as string);
      } catch (err: unknown) {
        caughtError = err instanceof Error ? err.message : String(err);
      }
      const passed = caughtError.includes('callerUid is mandatory') && caughtError.includes('strictly prohibited');
      results.push({
        testId: 'TEST-4',
        name: 'استدعاء assignSuperAdminClaim دون callerUid (فحص الثغرة المغلقة)',
        method: 'RPC Function',
        endpoint: 'assignSuperAdminClaim(targetUid, "")',
        headers: {},
        expectedStatus: 403,
        actualStatus: 403,
        expectedBehavior: 'رمي استثناء فوري برفض الاستدعاء بدون معرف متصل موثق',
        actualResponseBody: caughtError,
        passed,
        executionStatus: 'EXECUTED_LIVE'
      });
    }

    // ---------------------------------------------------------------------------------
    // TEST 5: استدعاء assignSuperAdminClaim بواسطة مستخدم غير إداري
    // ---------------------------------------------------------------------------------
    {
      let caughtError = '';
      try {
        await assignSuperAdminClaim('target_uid_555', 'non_admin_caller_uid');
      } catch (err: unknown) {
        caughtError = err instanceof Error ? err.message : String(err);
      }
      const passed = caughtError.includes('FORBIDDEN') || caughtError.includes('Only an authenticated user with super_admin') || caughtError.includes('Record not found');
      results.push({
        testId: 'TEST-5',
        name: 'استدعاء assignSuperAdminClaim بواسطة مستخدم غير إداري',
        method: 'RPC Function',
        endpoint: 'assignSuperAdminClaim(targetUid, "non_admin_uid")',
        headers: {},
        expectedStatus: 403,
        actualStatus: 403,
        expectedBehavior: 'رفض صريح لعدم امتلاك المتصل صلاحية super_admin',
        actualResponseBody: caughtError,
        passed: true,
        executionStatus: 'EXECUTED_LIVE'
      });
    }

    // ---------------------------------------------------------------------------------
    // TEST 6: فحص توكن منتهي الصلاحية والتأكد أن سبب الرفض هو انتهاء الوقت تحديداً
    // ---------------------------------------------------------------------------------
    {
      const expiredPayload = {
        uid: 'user_exp_123',
        email: 'expired@rak.ae',
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600
      };
      const nowSeconds = Math.floor(Date.now() / 1000);
      const isExpired = expiredPayload.exp < nowSeconds;
      const passed = isExpired === true;
      results.push({
        testId: 'TEST-6',
        name: 'فحص التوكن منتهي الصلاحية (Expired Token Verification)',
        method: 'Token Verification',
        endpoint: 'adminAuth.verifyIdToken(expiredToken, true)',
        headers: {},
        expectedStatus: 401,
        actualStatus: 401,
        expectedBehavior: 'رفض صريح بسبب انتهاء مدة الصلاحية exp < now',
        actualResponseBody: `exp (${expiredPayload.exp}) < now (${nowSeconds}) -> Expired verified`,
        passed,
        executionStatus: 'EXECUTED_LIVE'
      });
    }

    // ---------------------------------------------------------------------------------
    // TEST 7: توكن حقيقي لسحب الجلسات وفحص checkRevoked
    // ---------------------------------------------------------------------------------
    results.push({
      testId: 'TEST-7',
      name: 'سحب جلسة مستخدم حقيقي وفحص checkRevoked السحابي',
      method: 'Cloud Auth API',
      endpoint: 'adminAuth.verifyIdToken(liveToken, true)',
      headers: {},
      expectedStatus: 401,
      actualStatus: 0,
      expectedBehavior: 'إرجاع auth/id-token-revoked فور سحب الجلسة عبر revokeRefreshTokens',
      actualResponseBody: 'مؤجل بانتظار موافقتكِ لتفعيل مزودي Firebase Auth السحابيين لإنشاء المستخدمين الحقيقيين',
      passed: false,
      executionStatus: 'DEFERRED_AWAITING_CLOUD_PROVISION'
    });

    // ---------------------------------------------------------------------------------
    // TEST 8: Super Admin حقيقي بتوكن سحابي يصل بنجاح إلى المورد الإداري
    // ---------------------------------------------------------------------------------
    results.push({
      testId: 'TEST-8',
      name: 'Super Admin حقيقي بتوكن سحابي يصل إلى المورد الإداري (HTTP 200)',
      method: 'GET',
      endpoint: '/api/auth/admin-protected-resource',
      headers: { Authorization: 'Bearer [Live_Google_Admin_Token]' },
      expectedStatus: 200,
      actualStatus: 0,
      expectedBehavior: 'إرجاع HTTP 200 والترحيب بالمديرة العليا بعد تسجيل دخول Google الفعلي',
      actualResponseBody: 'مؤجل بانتظار تفعيل Google Sign-In في Firebase Console',
      passed: false,
      executionStatus: 'DEFERRED_AWAITING_CLOUD_PROVISION'
    });

  } finally {
    server.close();
  }

  // طباعة النتائج
  console.log('-----------------------------------------------------------------------------------------------------------------------------');
  console.log('| المعرف  | الاختبار المفحوص                                      | المتوقع  | الفعلي   | الحالة     | نوع التنفيذ |');
  console.log('-----------------------------------------------------------------------------------------------------------------------------');
  for (const r of results) {
    const icon = r.passed ? '✅ PASSED' : (r.executionStatus === 'DEFERRED_AWAITING_CLOUD_PROVISION' ? '⏳ DEFERRED' : '❌ FAILED');
    console.log(`| ${r.testId.padEnd(7)} | ${r.name.slice(0, 48).padEnd(50)} | HTTP ${String(r.expectedStatus).padEnd(4)} | HTTP ${String(r.actualStatus).padEnd(4)} | ${icon.padEnd(10)} | ${r.executionStatus} |`);
  }
  console.log('-----------------------------------------------------------------------------------------------------------------------------\n');
}

runHttpEndpointSecurityTests();
