import { adminAuth, assignSuperAdminClaim, verifyAuthToken, revokeUserClaims } from '../src/server/adminAuth';

interface TestSummary {
  name: string;
  passed: boolean;
  details: string;
  error?: string;
}

const results: TestSummary[] = [];

async function runAuthTests() {
  console.log('====================================================');
  console.log('🚀 بدء اختبارات المرحلة 2.1: Firebase Authentication');
  console.log('====================================================\n');

  let testUserUid = '';

  // TEST 1: إنشاء مستخدم اختبار مجهول/تجريبي في Auth
  try {
    const testUser = await adminAuth.createUser({
      displayName: 'Test Customer RAK',
      email: `test_customer_${Date.now()}@barakahbites.test`
    });
    testUserUid = testUser.uid;
    results.push({
      name: 'TEST 1: إنشاء مستخدم اختباري في Firebase Auth',
      passed: true,
      details: `تم إنشاء المستخدم برقم UID: ${testUserUid}`
    });
  } catch (err: unknown) {
    results.push({
      name: 'TEST 1: إنشاء مستخدم اختباري في Firebase Auth',
      passed: false,
      details: 'فشل إنشاء المستخدم',
      error: String(err)
    });
  }

  // TEST 2: إصدار Custom Token ومحاكاة التحقق من هوية مستخدم عادي (Customer)
  let customToken = '';
  try {
    customToken = await adminAuth.createCustomToken(testUserUid);
    results.push({
      name: 'TEST 2: إصدار Custom Token خادمي للمستخدم',
      passed: true,
      details: `تم توليد التوكن بنجاح (طوله: ${customToken.length} محرف)`
    });
  } catch (err: unknown) {
    results.push({
      name: 'TEST 2: إصدار Custom Token خادمي للمستخدم',
      passed: false,
      details: 'فشل توليد التوكن',
      error: String(err)
    });
  }

  // TEST 3: تعيين صلاحية Super Admin عبر الـ Backend فقط
  try {
    const claimResult = await assignSuperAdminClaim(testUserUid, testUserUid);
    const hasRole = claimResult.claims && (claimResult.claims as { role?: string }).role === 'super_admin';
    results.push({
      name: 'TEST 3: إسناد Custom Claim (role: super_admin) خادمياً',
      passed: hasRole,
      details: `تم تعيين الـ Claims بنجاح: ${JSON.stringify(claimResult.claims)}`
    });
  } catch (err: unknown) {
    results.push({
      name: 'TEST 3: إسناد Custom Claim (role: super_admin) خادمياً',
      passed: false,
      details: 'فشل تعيين الـ Claim',
      error: String(err)
    });
  }

  // TEST 4: رفض توكن غير صالح أو عشوائي (Rejection of Invalid Token)
  try {
    const invalidTokenCheck = await verifyAuthToken('Bearer invalid_fake_token_12345', true);
    const properlyRejected = invalidTokenCheck.valid === false;
    results.push({
      name: 'TEST 4: رفض التوكن المزور أو غير الصالح',
      passed: properlyRejected,
      details: `تم الرفض بنجاح برسالة: ${invalidTokenCheck.error}`
    });
  } catch (err: unknown) {
    results.push({
      name: 'TEST 4: رفض التوكن المزور أو غير الصالح',
      passed: false,
      details: 'حدث استثناء غير متوقع',
      error: String(err)
    });
  }

  // TEST 5: فحص سحب الجلسة وإلغاء التوكنات (Revocation Test)
  try {
    await revokeUserClaims(testUserUid, true);
    const userAfterRevocation = await adminAuth.getUser(testUserUid);
    const claimsCleared = !userAfterRevocation.customClaims || Object.keys(userAfterRevocation.customClaims).length === 0;
    results.push({
      name: 'TEST 5: سحب وإلغاء الصلاحيات والجلسات (Revoke Refresh Tokens & Claims)',
      passed: claimsCleared,
      details: 'تم مسح الصلاحيات وإلغاء صلاحية التوكنات بنجاح'
    });
  } catch (err: unknown) {
    results.push({
      name: 'TEST 5: سحب وإلغاء الصلاحيات والجلسات',
      passed: false,
      details: 'فشل إلغاء الصلاحيات',
      error: String(err)
    });
  }

  // Cleanup: حذف مستخدم الاختبار لعدم تلويث بيئة Firebase
  if (testUserUid) {
    try {
      await adminAuth.deleteUser(testUserUid);
      results.push({
        name: 'CLEANUP: تنظيف مستخدم الاختبار من Firebase Auth',
        passed: true,
        details: 'تم حذف حساب الاختبار بنجاح'
      });
    } catch (err: unknown) {
      results.push({
        name: 'CLEANUP: تنظيف مستخدم الاختبار من Firebase Auth',
        passed: false,
        details: 'فشل حذف الحساب',
        error: String(err)
      });
    }
  }

  // طباعة النتائج النهائية
  console.log('\n📊 ملخص نتائج الاختبارات:');
  console.log('----------------------------------------------------');
  let allPassed = true;
  for (const r of results) {
    const icon = r.passed ? '✅' : '❌';
    console.log(`${icon} [${r.name}] -> ${r.details}`);
    if (r.error) console.log(`   خطأ: ${r.error}`);
    if (!r.passed) allPassed = false;
  }
  console.log('----------------------------------------------------');
  console.log(allPassed ? '🎉 جميع اختبارات المرحلة 2.1 نجحت بنسبة 100%!' : '⚠️ هناك بعض الاختبارات التي تحتاج مراجعة.');

  // Exit clean
  process.exit(allPassed ? 0 : 1);
}

runAuthTests();
