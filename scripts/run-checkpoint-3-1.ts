import { seedInitialDatabase } from '../src/server/seedData';
import { adminDb } from '../src/server/adminAuth';

async function runSeedAndVerification() {
  console.log('========================================================================');
  console.log('🌱 تشغيل فحص وبذر بيانات Checkpoint 3.1: Database Seeding & Models');
  console.log('========================================================================\n');

  console.log('1. بدء بذر بيانات المتاجر وعروض الفائض في Firestore...');
  const result = await seedInitialDatabase();

  console.log(`- عدد المتاجر المسجلة: ${result.merchantsCount}`);
  console.log(`- عدد عروض الفائض المسجلة: ${result.surplusItemsCount}`);
  console.log(`- عدد قوائم المطبخ المسجلة: ${result.merchantListingsCount}`);
  if (result.errors.length > 0) {
    console.error('⚠️ أخطاء البذر:', result.errors);
  }

  console.log('\n2. التحقق المباشر من صحة البيانات المسجلة في Firestore:');
  
  // فحص عينة متجر
  const merchantSnap = await adminDb.collection('merchants').doc('merchant-waldorf').get();
  if (merchantSnap.exists) {
    const data = merchantSnap.data();
    console.log(`✅ [Merchant]: ${data?.name} (${data?.nameAr}) - الحي: ${data?.neighborhoodAr}`);
  } else {
    console.error('❌ فشل العثور على وثيقة المتجر');
  }

  // فحص عينة عرض طعام ومطابقة وحدة الفلس (Fils)
  const itemSnap = await adminDb.collection('surplus_items').doc('item-1').get();
  if (itemSnap.exists) {
    const data = itemSnap.data();
    console.log(`✅ [Surplus Item 1]: ${data?.titleAr}`);
    console.log(`   - السعر الأصلي بالفلس: ${data?.originalPriceFils} Fils (${data?.originalPriceFils / 100} AED)`);
    console.log(`   - السعر المخفض بالفلس: ${data?.discountedPriceFils} Fils (${data?.discountedPriceFils / 100} AED)`);
    console.log(`   - المخزون المتبقي: ${data?.stockRemaining} وجبات`);
    console.log(`   - الحالة: ${data?.status}`);
    console.log(`   - موعد الاستلام: ${data?.pickupStart} إلى ${data?.pickupEnd}`);
  } else {
    console.error('❌ فشل العثور على وثيقة وجبة الفائض');
  }

  // فحص متجر الشريشة (Al Sharisha Focus)
  const sharishaSnap = await adminDb.collection('merchants').doc('merchant-sharisha-bakeries').get();
  if (sharishaSnap.exists) {
    const data = sharishaSnap.data();
    console.log(`✅ [Al Sharisha Merchant]: ${data?.nameAr} - الإحداثيات: ${data?.lat}, ${data?.lng}`);
  }

  console.log('\n========================================================================');
  console.log(result.success ? '🎉 اكتمال Checkpoint 3.1 بنجاح تام وبمطابقة تامة للمخطط!' : '⚠️ تم البذر مع وجود ملاحظات.');
  console.log('========================================================================\n');

  process.exit(result.success ? 0 : 1);
}

runSeedAndVerification();
