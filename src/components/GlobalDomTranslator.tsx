import React, { useEffect } from 'react';
import { Language } from '../types';

interface MultiLangEntry {
  ur: string;
  hi: string;
  tl: string;
}

/**
 * Full-System 5-Language Dictionary (Merchant Workspace, Admin Portal,
 * Kitchen Orders, Settlements, Courier Dispatch, Customer Modals, Checkout)
 */
const EXACT_PHRASE_DICTIONARY: Record<string, MultiLangEntry> = {
  // === MERCHANT WORKSPACE (RESTAURANT MANAGER PORTAL) ===
  'Live Verified': {
    ur: 'لائیو تصدیق شدہ',
    hi: 'लाइव सत्यापित',
    tl: 'Live na Beripikado',
  },
  'Ras Al Khaimah': {
    ur: 'راس الخیمہ',
    hi: 'रस अल खैमाह',
    tl: 'Ras Al Khaimah',
  },
  'Scan / Verify Customer Code': {
    ur: 'گاہک کا کوڈ اسکین / تصدیق کریں',
    hi: 'ग्राहक कोड स्कैन / सत्यापित करें',
    tl: 'I-scan / Beripikahin ang Code ng Customer',
  },
  'Lock Portal 🔒': {
    ur: 'پورٹل لاک کریں 🔒',
    hi: 'पोर्टल लॉक करें 🔒',
    tl: 'I-lock ang Portal 🔒',
  },
  'Lock & Logout': {
    ur: 'لاک اور لاگ آؤٹ کریں',
    hi: 'लॉक और लॉगआउट करें',
    tl: 'I-lock at Mag-logout',
  },
  'vs last week': {
    ur: 'پچھلے ہفتے کے مقابلے میں',
    hi: 'पिछले सप्ताह की तुलना में',
    tl: 'kumpara noong nakaraang linggo',
  },
  'Salvage Rate': {
    ur: 'فروخت کی شرح',
    hi: 'बिक्री दर',
    tl: 'Antas ng Benta',
  },
  'Zero edible waste target': {
    ur: 'صفر خوراک کے ضیاع کا ہدف',
    hi: 'शून्य खाद्य बर्बादी लक्ष्य',
    tl: 'Target na walang nasasayang na pagkain',
  },
  'Active Offerings': {
    ur: 'فعال آفرز',
    hi: 'सक्रिय ऑफ़र',
    tl: 'Mga Aktibong Alok',
  },
  'Pickup Compliance': {
    ur: 'پک اپ کی پابندی',
    hi: 'पिकअप अनुपालन',
    tl: 'Pagsunod sa Pickup',
  },
  '30s counter scan speed': {
    ur: '30 سیکنڈ کاؤنٹر اسکین رفتار',
    hi: '30 सेकंड काउंटर स्कैन गति',
    tl: '30s bilis ng pag-scan sa counter',
  },
  'Live Kitchen Orders Feed': {
    ur: 'لائیو کچن آرڈرز سینٹر',
    hi: 'लाइव किचन ऑर्डर सेंटर',
    tl: 'Live na Sentro ng Order sa Kusina',
  },
  'Delivery & Courier Dispatch': {
    ur: 'ڈیلیوری اور کوریئر کا انتظام',
    hi: 'डिलीवरी और कूरियर प्रबंधन',
    tl: 'Pamamahala ng Delivery at Rider',
  },
  'Bank Account & Settlements': {
    ur: 'بینک اکاؤنٹ اور مالیاتی تصفیہ',
    hi: 'बैंक खाता और भुगतान निपटान',
    tl: 'Bank Account at Bayarin',
  },
  '🔔 Test Bell Sound': {
    ur: '🔔 گھنٹی کی آواز چیک کریں',
    hi: '🔔 घंटी की आवाज़ जांचें',
    tl: '🔔 Subukan ang Tunog ng Bell',
  },
  'Kitchen Live Online': {
    ur: 'کچن آن لائن اور فعال ہے',
    hi: 'किचन ऑनलाइन और सक्रिय है',
    tl: 'Online at Aktibo ang Kusina',
  },
  'Manage live quantities, pickup windows, and expiry times': {
    ur: 'لائیو مقدار، پک اپ کے اوقات اور ایکسپائری کا انتظام کریں',
    hi: 'लाइव मात्रा, पिकअप समय और समाप्ति समय प्रबंधित करें',
    tl: 'Pamahalaan ang dami, oras ng pickup, at expiry',
  },
  'Auto-hide Expired': {
    ur: 'ختم شدہ آفرز چھپائیں',
    hi: 'समाप्त ऑफ़र छिपाएं',
    tl: 'Itago ang Expired',
  },
  'Expiry & Allergens': {
    ur: 'میعاد ختم ہونے کا وقت / الرجی',
    hi: 'समाप्ति समय / एलर्जी',
    tl: 'Expiry at Allergens',
  },
  'Edit': {
    ur: 'ترمیم کریں',
    hi: 'संपादित करें',
    tl: 'I-edit',
  },
  'Edit ✏️': {
    ur: 'ترمیم کریں ✏️',
    hi: 'संपादित करें ✏️',
    tl: 'I-edit ✏️',
  },
  'Delete Listing': {
    ur: 'آفر حذف کریں',
    hi: 'ऑफ़र हटाएं',
    tl: 'Burahin ang Alok',
  },
  'Incoming Real-Time Kitchen Orders': {
    ur: 'آپ کے کچن کے لائیو آرڈرز',
    hi: 'आपके किचन के लाइव ऑर्डर',
    tl: 'Mga Pumapasok na Live Order sa Kusina',
  },
  'Whenever a customer orders, the kitchen bell chimes automatically and the order appears here with 1-click WhatsApp alert.': {
    ur: 'جب بھی کوئی گاہک آرڈر کرتا ہے، کچن کی گھنٹی خودکار طور پر بجتی ہے اور آرڈر یہاں واٹس ایپ بٹن کے ساتھ ظاہر ہوتا ہے۔',
    hi: 'जब भी कोई ग्राहक ऑर्डर करता है, किचन की घंटी स्वतः बजती है और ऑर्डर व्हाट्सएप बटन के साथ यहाँ दिखाई देता है।',
    tl: 'Tuwing may оorder na customer, tutunog nang kusa ang bell sa kusina at lilitaw dito ang order kasama ang WhatsApp button.',
  },
  'Test Chime 🔊': {
    ur: 'گھنٹی چیک کریں 🔊',
    hi: 'घंटी जांचें 🔊',
    tl: 'Subukan ang Bell 🔊',
  },
  'New Order': {
    ur: 'نیا آرڈر',
    hi: 'नया ऑर्डर',
    tl: 'Bagong Order',
  },
  'Direct Restaurant Delivery': {
    ur: 'ریسٹورنٹ کی براہ راست ڈیلیوری',
    hi: 'रेस्तरां द्वारा सीधी डिलीवरी',
    tl: 'Direktang Delivery ng Restawran',
  },
  'Counter Pickup': {
    ur: 'کاؤنٹر سے خود پک اپ',
    hi: 'काउंटर से सेल्फ पिकअप',
    tl: 'Pickup sa Counter',
  },
  'Payment:': {
    ur: 'ادائیگی کا طریقہ:',
    hi: 'भुगतान का तरीका:',
    tl: 'Paraan ng Bayad:',
  },
  '💵 Cash on Pickup': {
    ur: '💵 پک اپ پر نقد ادائیگی (کیش)',
    hi: '💵 पिकअप पर नकद भुगतान (कैश)',
    tl: '💵 Cash sa Pickup',
  },
  '💳 Paid Online (Ziina / Card)': {
    ur: '💳 آن لائن ادا شدہ (Ziina / کارڈ)',
    hi: '💳 ऑनलाइन भुगतान किया गया (Ziina / कार्ड)',
    tl: '💳 Bayad na Online (Ziina / Card)',
  },
  'Customer:': {
    ur: 'گاہک کا نام:',
    hi: 'ग्राहक का नाम:',
    tl: 'Customer:',
  },
  'Phone:': {
    ur: 'فون نمبر:',
    hi: 'फ़ोन नंबर:',
    tl: 'Telepono:',
  },
  'Delivery Address:': {
    ur: 'ڈیلیوری کا پتہ:',
    hi: 'डिलीवरी का पता:',
    tl: 'Address ng Delivery:',
  },
  'Order Kitchen Stage:': {
    ur: 'آرڈر کی تیاری کا مرحلہ:',
    hi: 'ऑर्डर तैयारी का चरण:',
    tl: 'Yugto ng Order sa Kusina:',
  },
  'Accept 👨‍🍳': {
    ur: 'قبول اور تیاری 👨‍🍳',
    hi: 'स्वीकार व तैयारी 👨‍🍳',
    tl: 'Tanggapin 👨‍🍳',
  },
  'Ready 📦': {
    ur: 'تیار ہے 📦',
    hi: 'तैयार है 📦',
    tl: 'Handa Na 📦',
  },
  'Delivered 🛵': {
    ur: 'ڈیلیور ہو گیا 🛵',
    hi: 'डिलीवर हो गया 🛵',
    tl: 'Na-deliver Na 🛵',
  },
  'Picked Up 🛍️': {
    ur: 'وصول کر لیا گیا 🛍️',
    hi: 'पिकअप हो गया 🛍️',
    tl: 'Na-pickup Na 🛍️',
  },
  'Completed ✓': {
    ur: 'مکمل ✓',
    hi: 'पूरा हुआ ✓',
    tl: 'Tapos Na ✓',
  },
  'WhatsApp Customer': {
    ur: 'گاہک کو واٹس ایپ میسج بھیجیں',
    hi: 'ग्राहक को व्हाट्सएप संदेश भेजें',
    tl: 'I-WhatsApp ang Customer',
  },
  'Direct Restaurant Self-Delivery 🛵': {
    ur: 'ریسٹورنٹ کی اپنی ڈیلیوری کا انتظام 🛵',
    hi: 'रेस्तरां की स्वयं की डिलीवरी प्रबंधन 🛵',
    tl: 'Pamamahala ng Sariling Delivery ng Restawran 🛵',
  },
  'Each restaurant handles delivery directly using its own driver and 1-click WhatsApp dispatch': {
    ur: 'ہر ریسٹورنٹ اپنے ڈرائیور کے ذریعے براہ راست ڈیلیوری کرتا ہے اور ایک کلک پر واٹس ایپ پر لوکیشن بھیج سکتا ہے',
    hi: 'प्रत्येक रेस्तरां अपने ड्राइवर के माध्यम से सीधे डिलीवरी संभालता है और 1-क्लिक में व्हाट्सएप पर पता भेजता है',
    tl: 'Bawat restawran ay nagde-deliver gamit ang sariling rider at 1-click na pagpapadala sa WhatsApp',
  },
  'Restaurant Self-Delivery (0 AED Platform Fee)': {
    ur: 'ریسٹورنٹ کی براہ راست ڈیلیوری (0 درہم پلیٹ فارم فیس)',
    hi: 'रेस्तरां की सीधी डिलीवरी (0 AED प्लेटफ़ॉर्म शुल्क)',
    tl: 'Sariling Delivery ng Restawran (0 AED Platform Fee)',
  },
  'Active Courier / Driver Name:': {
    ur: 'ڈیلیوری ڈرائیور / رائیڈر کا نام:',
    hi: 'डिलीवरी ड्राइवर / कूरियर का नाम:',
    tl: 'Pangalan ng Rider / Driver:',
  },
  'Courier WhatsApp Number:': {
    ur: 'ڈرائیور کا واٹس ایپ نمبر:',
    hi: 'ड्राइवर का व्हाट्सएप नंबर:',
    tl: 'WhatsApp Number ng Rider:',
  },
  'Save Courier Info ✓': {
    ur: 'ڈرائیور کی معلومات محفوظ کریں ✓',
    hi: 'ड्राइवर की जानकारी सहेजें ✓',
    tl: 'I-save ang Impormasyon ng Rider ✓',
  },
  'Orders Requiring Home Delivery:': {
    ur: 'ہوم ڈیلیوری والے آرڈرز:',
    hi: 'होम डिलीवरी वाले ऑर्डर:',
    tl: 'Mga Order na Kailangang I-deliver:',
  },
  'All current orders are counter self-pickup': {
    ur: 'موجودہ تمام آرڈرز ریسٹورنٹ سے خود پک اپ والے ہیں',
    hi: 'वर्तमान सभी ऑर्डर काउंटर सेल्फ-पिकअप हैं',
    tl: 'Lahat ng kasalukuyang order ay self-pickup sa counter',
  },
  'Whenever a customer selects Direct Restaurant Delivery, their order and address will appear here for your restaurant driver.': {
    ur: 'جب کوئی گاہک ہوم ڈیلیوری منتخب کرے گا تو اس کا آرڈر اور پتہ یہاں آپ کے ڈرائیور کے لیے ظاہر ہو جائے گا۔',
    hi: 'जब भी कोई ग्राहक होम डिलीवरी चुनता है, तो उसका ऑर्डर और पता आपके ड्राइवर के लिए यहाँ दिखाई देगा।',
    tl: 'Kapag pumili ang customer ng Direct Delivery, lilitaw dito ang order at address para sa iyong rider.',
  },
  'Send to Courier via WhatsApp 🛵': {
    ur: 'ڈرائیور کو واٹس ایپ پر آرڈر بھیجیں 🛵',
    hi: 'ड्राइवर को व्हाट्सएप पर ऑर्डर भेजें 🛵',
    tl: 'Ipadala sa Rider sa WhatsApp 🛵',
  },
  'Delivered ✓': {
    ur: 'ڈیلیور ہو گیا ✓',
    hi: 'डिलीवर हो गया ✓',
    tl: 'Na-deliver Na ✓',
  },
  'Merchant Financial Settlement Records': {
    ur: 'ریسٹورنٹ کا مالیاتی ریکارڈ اور بینک اکاؤنٹ',
    hi: 'रेस्तरां वित्तीय निपटान और बैंक रिकॉर्ड',
    tl: 'Rekord ng Pinansyal at Bank Account ng Restawran',
  },
  'Merchant Sales & Net Payout Statement': {
    ur: 'فروخت اور خالص آمدنی کا حساب کتاب',
    hi: 'बिक्री और शुद्ध भुगतान विवरण',
    tl: 'Statement ng Benta at Netong Kita ng Restawran',
  },
  'Export Statement (CSV)': {
    ur: 'اسٹیٹمنٹ ڈاؤن لوڈ کریں (CSV)',
    hi: 'स्टेटमेंट डाउनलोड करें (CSV)',
    tl: 'I-download ang Statement (CSV)',
  },
  'Saved Restaurant Bank Details (IBAN Record)': {
    ur: 'ریسٹورنٹ کے بینک اکاؤنٹ کی تفصیلات (IBAN)',
    hi: 'रेस्तरां के बैंक खाते का विवरण (IBAN)',
    tl: 'Detalye ng Bank Account ng Restawran (IBAN)',
  },
  'Record the restaurant bank name and UAE IBAN here for weekly payout transfers': {
    ur: 'ہفتہ وار ادائیگیوں کی منتقلی کے لیے یہاں اپنے بینک کا نام اور IBAN نمبر درج کریں',
    hi: 'साप्ताहिक भुगतान हस्तांतरण के लिए यहाँ बैंक का नाम और UAE IBAN दर्ज करें',
    tl: 'Ilagay dito ang pangalan ng bangko at UAE IBAN para sa lingguhang bayad',
  },
  'Edit Bank Info ✎': {
    ur: 'بینک معلومات میں ترمیم کریں ✎',
    hi: 'बैंक जानकारी संपादित करें ✎',
    tl: 'I-edit ang Impormasyon ng Bangko ✎',
  },
  'Cancel Edit': {
    ur: 'ترمیم بند کریں',
    hi: 'संपादन बंद करें',
    tl: 'Isara ang Pag-edit',
  },
  'Bank Name:': {
    ur: 'بینک کا نام:',
    hi: 'बैंक का नाम:',
    tl: 'Pangalan ng Bangko:',
  },
  'Saved IBAN:': {
    ur: 'محفوظ شدہ IBAN نمبر:',
    hi: 'पंजीकृत IBAN नंबर:',
    tl: 'Naka-save na IBAN:',
  },
  'Save ✓': {
    ur: 'محفوظ کریں ✓',
    hi: 'सहेजें ✓',
    tl: 'I-save ✓',
  },
  'Online Payment Gateway:': {
    ur: 'آن لائن ادائیگی کا گیٹ وے:',
    hi: 'ऑनलाइन भुगतान गेटवे:',
    tl: 'Online Payment Gateway:',
  },
  'Certified Payment Gateway (Ziina API v2 / Apple Pay & Cards)': {
    ur: 'تصدیق شدہ پیمنٹ گیٹ وے (Ziina / Apple Pay & Cards)',
    hi: 'प्रमाणित भुगतान गेटवे (Ziina / Apple Pay & Cards)',
    tl: 'Sertipikadong Payment Gateway (Ziina / Apple Pay & Cards)',
  },
  'Gross Sales': {
    ur: 'کل فروخت',
    hi: 'कुल बिक्री',
    tl: 'Kabuuang Benta',
  },
  'Online Payments': {
    ur: 'آن لائن ادائیگیاں (Ziina)',
    hi: 'ऑनलाइन भुगतान (Ziina)',
    tl: 'Mga Bayad Online (Ziina)',
  },
  'Counter Cash': {
    ur: 'نقد وصولی (کیش)',
    hi: 'काउंटर पर नकद (कैश)',
    tl: 'Cash sa Counter',
  },
  'Flaster commission': {
    ur: 'فلاستر پلیٹ فارم کمیشن',
    hi: 'फ़्लास्टर प्लेटफ़ॉर्म कमीशन',
    tl: 'Komisyon ng Flaster',
  },
  'Net Store Payout': {
    ur: 'ریسٹورنٹ کی خالص رقم',
    hi: 'रेस्तरां की शुद्ध राशि',
    tl: 'Netong Kita ng Restawran',
  },
  'Net transfer amount': {
    ur: 'منتقلی کے قابل خالص رقم',
    hi: 'हस्तांतरण योग्य शुद्ध राशि',
    tl: 'Netong halagang ipapadala',
  },
  'Current Settlement Period Orders': {
    ur: 'موجودہ دورانیے کے آرڈرز کی تفصیل',
    hi: 'वर्तमान अवधि के ऑर्डर का विवरण',
    tl: 'Detalye ng mga Order sa Kasalukuyang Panahon',
  },
  'Edit Item & Offer Pickup Times ✏️': {
    ur: 'آفر اور پک اپ کے وقت میں ترمیم کریں ✏️',
    hi: 'ऑफ़र और पिकअप समय संपादित करें ✏️',
    tl: 'I-edit ang Alok at Oras ng Pickup ✏️',
  },
  'Update pickup window, prices, stock, or photo immediately': {
    ur: 'پک اپ کا وقت، قیمت، مقدار یا تصویر فوری تبدیل کریں',
    hi: 'पिकअप समय, कीमत, मात्रा या फ़ोटो तुरंत अपडेट करें',
    tl: 'I-update agad ang oras ng pickup, presyo, dami, o larawan',
  },
  'List your surplus gourmet package with custom photos': {
    ur: 'کھانے کی تفصیلات اور تصویر اپ لوڈ کر کے فوری آفر شائع کریں',
    hi: 'भोजन का विवरण और फ़ोटो अपलोड करके तुरंत ऑफ़र प्रकाशित करें',
    tl: 'Ilagay ang detalye ng pagkain at larawan upang mai-post agad',
  },
  'Restaurant / Partner Name *': {
    ur: 'ریسٹورنٹ کا نام *',
    hi: 'रेस्तरां का नाम *',
    tl: 'Pangalan ng Restawran *',
  },
  'Service Zone *': {
    ur: 'راس الخیمہ کا علاقہ *',
    hi: 'रस अल खैमाह का क्षेत्र *',
    tl: 'Lugar sa Ras Al Khaimah *',
  },
  'Surplus Item Name (Arabic) *': {
    ur: 'کھانے / آفر کا نام (عربی) *',
    hi: 'भोजन / ऑफ़र का नाम (अरबी) *',
    tl: 'Pangalan ng Pagkain (Arabic) *',
  },
  'Item Name (English) *': {
    ur: 'کھانے / آفر کا نام (انگریزی) *',
    hi: 'भोजन / ऑफ़र का नाम (अंग्रेज़ी) *',
    tl: 'Pangalan ng Pagkain (English) *',
  },
  'Dish Photo (Upload or Pick from Library)': {
    ur: 'کھانے کی تصویر (فون یا کیمرے سے اپ لوڈ کریں)',
    hi: 'भोजन की फ़ोटो (फ़ोन या कैमरे से अपलोड करें)',
    tl: 'Larawan ng Pagkain (Mag-upload mula sa Telepono o Camera)',
  },
  'Click to upload photo from your device or camera': {
    ur: 'فون یا کیمرے سے کھانے کی تصویر اپ لوڈ کرنے کے لیے یہاں کلک کریں',
    hi: 'फ़ोन या कैमरे से भोजन की फ़ोटो अपलोड करने के लिए यहाँ क्लिक करें',
    tl: 'Pindutin dito upang mag-upload ng larawan mula sa iyong telepono o camera',
  },
  'Or choose from suggested dish library:': {
    ur: 'یا تجویز کردہ تصاویر میں سے ایک منتخب کریں:',
    hi: 'या सुझाई गई फ़ोटो में से चुनें:',
    tl: 'O pumili mula sa mga iminumungkahing larawan:',
  },
  'Pickup Window Tonight *': {
    ur: 'پک اپ کا وقت (اسٹور سے وصولی کے اوقات) *',
    hi: 'पिकअप का समय (स्टोर से प्राप्त करने का समय) *',
    tl: 'Oras ng Pickup Ngayong Gabi *',
  },
  'Auto-Expiry (Hours) *': {
    ur: 'آفر ختم ہونے کا وقت (گھنٹوں میں) *',
    hi: 'ऑफ़र समाप्त होने का समय (घंटों में) *',
    tl: 'Oras Bago Mag-expire (Oras) *',
  },
  'Allergens (optional)': {
    ur: 'الرجی کی معلومات (اختیاری)',
    hi: 'एलर्जी की जानकारी (वैकल्पिक)',
    tl: 'Allergens (opsyonal)',
  },
  'Key Ingredients': {
    ur: 'بنیادی اجزاء',
    hi: 'मुख्य सामग्री',
    tl: 'Mga Pangunahing Sangkap',
  },
  'Cancel & Exit': {
    ur: 'منسوخ کریں اور باہر نکلیں',
    hi: 'रद्द करें और बाहर निकलें',
    tl: 'Kanselahin at Lumabas',
  },
  'Save Changes & Update Offer ✓': {
    ur: 'تبدیلیاں محفوظ کریں اور آفر اپ ڈیٹ کریں ✓',
    hi: 'परिवर्तन सहेजें और ऑफ़र अपडेट करें ✓',
    tl: 'I-save ang Pagbabago at I-update ang Alok ✓',
  },
  'Verify Customer Pass & Handover': {
    ur: 'گاہک کے ٹکٹ کی تصدیق اور کھانا حوالے کریں',
    hi: 'ग्राहक टिकट सत्यापित करें और भोजन सौंपें',
    tl: 'Beripikahin ang Ticket ng Customer at Ibigay ang Order',
  },
  'Enter ticket code or tap Hand Over next to the order': {
    ur: 'ٹکٹ کوڈ درج کریں یا آرڈر کے سامنے حوالے کریں بٹن دبائیں',
    hi: 'टिकट कोड दर्ज करें या ऑर्डर के बगल में सौंपें बटन दबाएं',
    tl: 'Ilagay ang ticket code o pindutin ang Ibigay sa tabi ng order',
  },
  'Align QR inside box': {
    ur: 'کیمرے کو QR کوڈ کے سامنے رکھیں',
    hi: 'कैमरे को QR कोड के सामने रखें',
    tl: 'Itapat ang QR code sa loob ng kahon',
  },
  'Or use manual code entry / direct handover below ↓': {
    ur: 'یا نیچے کوڈ درج کریں یا براہ راست حوالے کرنے کا بٹن دبائیں ↓',
    hi: 'या नीचे कोड दर्ज करें या सीधे सौंपने का बटन दबाएं ↓',
    tl: 'O ilagay ang code sa ibaba / pindutin ang direktang pagbigay ↓',
  },
  'Enter ticket number or customer name:': {
    ur: 'ٹکٹ نمبر یا گاہک کا نام درج کریں:',
    hi: 'टिकट नंबर या ग्राहक का नाम दर्ज करें:',
    tl: 'Ilagay ang numero ng ticket o pangalan ng customer:',
  },
  'Verify & Hand Over': {
    ur: 'تصدیق اور حوالے کریں ✓',
    hi: 'सत्यापित करें और सौंपें ✓',
    tl: 'Beripikahin at Ibigay ✓',
  },
  'Tap "Hand Over ✓" next to customer order:': {
    ur: 'گاہک کے آرڈر کے سامنے "حوالے کریں ✓" پر کلک کریں:',
    hi: 'ग्राहक के ऑर्डर के बगल में "सौंपें ✓" पर क्लिक करें:',
    tl: 'Pindutin ang "Ibigay ✓" sa tabi ng order ng customer:',
  },
  'Hand Over ✓': {
    ur: 'حوالے کریں ✓',
    hi: 'सौंपें ✓',
    tl: 'Ibigay ✓',
  },
  'Handed Over': {
    ur: 'حوالے کر دیا گیا',
    hi: 'सौंप दिया गया',
    tl: 'Naibigay Na',
  },
  'Close & Exit Verification': {
    ur: 'تصدیق ونڈو بند کریں',
    hi: 'सत्यापन विंडो बंद करें',
    tl: 'Isara ang Verification Window',
  },

  // === ADMIN FOUNDERS DASHBOARD ===
  'Executive Admin Access 🔒': {
    ur: 'ایگزیکٹو ایڈمن پورٹل 🔒',
    hi: 'एग्जीक्यूटिव एडमिन पोर्टल 🔒',
    tl: 'Executive Admin Access 🔒',
  },
  'Restricted to authorized platform founders only.': {
    ur: 'یہ کنٹرول پینل صرف پلیٹ فارم کے منتظمین کے لیے مختص ہے۔',
    hi: 'यह कंट्रोल पैनल केवल प्लेटफ़ॉर्म प्रशासकों के लिए आरक्षित है।',
    tl: 'Para lamang sa mga awtorisadong admin ng platform.',
  },
  'Sign In with Authorized Google Admin Account': {
    ur: 'ایڈمن گوگل اکاؤنٹ کے ذریعے لاگ ان کریں',
    hi: 'एडमिन Google खाते से साइन इन करें',
    tl: 'Mag-sign In gamit ang Admin Google Account',
  },
  'Or Enter Emergency Admin PIN (PORTAL_ACCESS_PIN):': {
    ur: 'یا ایڈمن سیکیورٹی پن کوڈ درج کریں (PORTAL_ACCESS_PIN):',
    hi: 'या एडमिन सुरक्षा पिन दर्ज करें (PORTAL_ACCESS_PIN):',
    tl: 'O Ilagay ang Emergency Admin PIN (PORTAL_ACCESS_PIN):',
  },
  'Unlock': {
    ur: 'کھولیں',
    hi: 'खोलें',
    tl: 'Buksan',
  },
  'Return to Marketplace': {
    ur: 'شاپنگ اسکرین پر واپس جائیں',
    hi: 'शॉपिंग स्क्रीन पर वापस जाएं',
    tl: 'Bumalik sa Marketplace',
  },
  'Flaster • Executive Admin Suite': {
    ur: 'فلاستر • ایڈمن کنٹرول سینٹر',
    hi: 'फ़्लास्टर • एडमिन कंट्रोल सेंटर',
    tl: 'Flaster • Sentro ng Kontrol ng Admin',
  },
  'Platform Operations & Partner Control': {
    ur: 'پلیٹ فارم آپریشنز اور پارٹنر ریسٹورنٹس کا انتظام',
    hi: 'प्लेटफ़ॉर्म संचालन और पार्टनर रेस्तरां प्रबंधन',
    tl: 'Pamamahala ng Operasyon at Partner na Restawran',
  },
  'Export Orders (CSV)': {
    ur: 'سیلز رپورٹ ڈاؤن لوڈ کریں (CSV)',
    hi: 'बिक्री रिपोर्ट डाउनलोड करें (CSV)',
    tl: 'I-download ang Benta (CSV)',
  },
  'Back to App': {
    ur: 'ایپ پر واپس جائیں',
    hi: 'ऐप पर वापस जाएं',
    tl: 'Bumalik sa App',
  },
  'Default Rate:': {
    ur: 'عمومی کمیشن:',
    hi: 'सामान्य कमीशन:',
    tl: 'Default na Komisyon:',
  },
  'Order Lifecycle': {
    ur: 'آرڈرز کی صورتحال',
    hi: 'ऑर्डर की स्थिति',
    tl: 'Katayuan ng mga Order',
  },
  'Users & Loyalty': {
    ur: 'گاہک اور پوائنٹس',
    hi: 'ग्राहक और पॉइंट्स',
    tl: 'Mga User at Puntos',
  },
  'Live Orders Stream': {
    ur: 'لائیو آرڈرز اور سیلز ریکارڈ',
    hi: 'लाइव ऑर्डर और बिक्री रिकॉर्ड',
    tl: 'Live na Rekord ng mga Order',
  },
  'Partner Merchants': {
    ur: 'پارٹنر ریسٹورنٹس اور اسٹورز',
    hi: 'पार्टनर रेस्तरां और स्टोर',
    tl: 'Mga Partner na Restawran',
  },
  'Users & Loyalty Wallet': {
    ur: 'صارفین اور لائلٹی پوائنٹس',
    hi: 'उपयोगकर्ता और लॉयल्टी पॉइंट्स',
    tl: 'Mga User at Loyalty Wallet',
  },
  'Platform Settings': {
    ur: 'پلیٹ فارم کی ترتیبات اور کمیشن',
    hi: 'प्लेटफ़ॉर्म सेटिंग्स और कमीशन',
    tl: 'Mga Setting ng Platform',
  },
  'All Payments': {
    ur: 'تمام ادائیگیاں',
    hi: 'सभी भुगतान',
    tl: 'Lahat ng Bayad',
  },
  'Online Only': {
    ur: 'صرف آن لائن ادائیگی',
    hi: 'केवल ऑनलाइन भुगतान',
    tl: 'Online na Bayad Lamang',
  },
  'Cash on Counter': {
    ur: 'صرف نقد (کیش)',
    hi: 'केवल नकद (कैश)',
    tl: 'Cash sa Counter Lamang',
  },
  'All Statuses': {
    ur: 'تمام مراحل',
    hi: 'सभी स्थितियाँ',
    tl: 'Lahat ng Katayuan',
  },
  'Export CSV': {
    ur: 'CSV ڈاؤن لوڈ کریں',
    hi: 'CSV डाउनलोड करें',
    tl: 'I-export ang CSV',
  },
  'Add Restaurant +': {
    ur: 'نیا ریسٹورنٹ شامل کریں +',
    hi: 'नया रेस्तरां जोड़ें +',
    tl: 'Magdagdag ng Restawran +',
  },
  'Partner Restaurants • Isolated Per-Restaurant Accounts': {
    ur: 'پارٹنر ریسٹورنٹس • ہر ریسٹورنٹ کا الگ محفوظ اکاؤنٹ',
    hi: 'पार्टनर रेस्तरां • प्रत्येक रेस्तरां के लिए अलग सुरक्षित खाता',
    tl: 'Mga Partner na Restawran • Hiwalay na Account Bawat Restawran',
  },

  // === MERCHANT AUTH MODAL ===
  'Isolated Restaurant Account 🔒': {
    ur: 'محفوظ ریسٹورنٹ اکاؤنٹ 🔒',
    hi: 'सुरक्षित रेस्तरां खाता 🔒',
    tl: 'Hiwalay na Account ng Restawran 🔒',
  },
  'Partner Restaurant Login': {
    ur: 'پارٹنر ریسٹورنٹ لاگ ان',
    hi: 'पार्टनर रेस्तरां लॉगिन',
    tl: 'Login ng Partner na Restawran',
  },
  'Enter your dedicated restaurant username and 8-digit secret code.': {
    ur: 'اپنے ریسٹورنٹ کا یوزر نیم اور 8 ہندسوں کا خفیہ کوڈ درج کریں۔',
    hi: 'अपने रेस्तरां का यूज़रनेम और 8-अंकीय गुप्त कोड दर्ज करें।',
    tl: 'Ilagay ang username ng iyong restawran at 8-digit na secret code.',
  },
  'Restaurant Username': {
    ur: 'ریسٹورنٹ یوزر نیم',
    hi: 'रेस्तरां यूज़रनेम',
    tl: 'Username ng Restawran',
  },
  'Secret Access Code (8 digits)': {
    ur: 'خفیہ ایکسیس کوڈ (8 ہندسے)',
    hi: 'गुप्त एक्सेस कोड (8 अंक)',
    tl: 'Secret Access Code (8 digit)',
  },
  'Sign In to Restaurant Portal': {
    ur: 'ریسٹورنٹ پورٹل میں لاگ ان کریں',
    hi: 'रेस्तरां पोर्टल में साइन इन करें',
    tl: 'Mag-sign In sa Portal ng Restawran',
  },
  'Verifying on server...': {
    ur: 'تصدیق ہو رہی ہے...',
    hi: 'सर्वर पर सत्यापन हो रहा है...',
    tl: 'Bineberipika sa server...',
  },
  '🛡️ Strictly isolated per-merchant HMAC-SHA256 session': {
    ur: '🛡️ ہر ریسٹورنٹ کا ڈیٹا اور آرڈرز مکمل طور پر محفوظ اور الگ ہیں',
    hi: '🛡️ प्रत्येक रेस्तरां का डेटा और ऑर्डर पूरी तरह से सुरक्षित और अलग हैं',
    tl: '🛡️ Ganap na hiwalay at ligtas ang session ng bawat restawran',
  },

  // === MARKETPLACE & FOOTER ===
  'All rights reserved.': {
    ur: 'جملہ حقوق محفوظ ہیں۔',
    hi: 'सर्वाधिकार सुरक्षित।',
    tl: 'Lahat ng karapatan ay nakalaan.',
  },
  'Licensed and certified in Ras Al Khaimah • United Arab Emirates': {
    ur: 'راس الخیمہ • متحدہ عرب امارات میں لائسنس یافتہ اور تصدیق شدہ',
    hi: 'रस अल खैमाह • संयुक्त अरब अमीरात में लाइसेंस प्राप्त और प्रमाणित',
    tl: 'Lisensyado at sertipikado sa Ras Al Khaimah • UAE',
  },
  'No favorite restaurants saved yet': {
    ur: 'ابھی تک کوئی پسندیدہ ریسٹورنٹ محفوظ نہیں کیا گیا',
    hi: 'अभी तक कोई पसंदीदा रेस्तरां सहेजा नहीं गया है',
    tl: 'Wala pang naka-save na paboritong restawran',
  },
  'No surplus bags match your search': {
    ur: 'آپ کی تلاش کے مطابق کوئی آفر نہیں ملی',
    hi: 'आपकी खोज से मेल खाने वाला कोई ऑफ़र नहीं मिला',
    tl: 'Walang alok na tumutugma sa iyong paghahanap',
  },
  'Reset All Filters': {
    ur: 'تمام آفرز دکھائیں',
    hi: 'सभी ऑफ़र दिखाएं',
    tl: 'Ipakita Lahat ng Alok',
  },
};

const SUBSTRING_REPLACEMENTS: Array<{
  en: string;
  ur: string;
  hi: string;
  tl: string;
}> = [
  {
    en: 'boxes waiting',
    ur: 'آفرز دستیاب ہیں',
    hi: 'ऑफ़र उपलब्ध हैं',
    tl: 'mga alok na naghihintay',
  },
  {
    en: 'active listings',
    ur: 'فعال آفرز',
    hi: 'सक्रिय ऑफ़र',
    tl: 'mga aktibong alok',
  },
  {
    en: 'initially broadcasted',
    ur: 'ابتدائی مقدار',
    hi: 'प्रारंभिक मात्रा',
    tl: 'unang inilagay',
  },
  {
    en: 'total today',
    ur: 'آج کے کل آرڈرز',
    hi: 'आज के कुल ऑर्डर',
    tl: 'kabuuan ngayong araw',
  },
  {
    en: 'surplus meal',
    ur: 'وجبہ',
    hi: 'भोजन पैकेट',
    tl: 'meal box',
  },
  {
    en: 'delivery orders',
    ur: 'ڈیلیوری آرڈرز',
    hi: 'डिलीवरी ऑर्डर',
    tl: 'delivery order',
  },
  {
    en: 'online orders',
    ur: 'آن لائن آرڈرز',
    hi: 'ऑनलाइन ऑर्डर',
    tl: 'online order',
  },
  {
    en: 'cash orders',
    ur: 'نقد آرڈرز',
    hi: 'नकद ऑर्डर',
    tl: 'cash order',
  },
  {
    en: 'total orders',
    ur: 'کل آرڈرز',
    hi: 'कुल ऑर्डर',
    tl: 'kabuuang order',
  },
  {
    en: 'in progress',
    ur: 'تیاری کے مراحل میں',
    hi: 'प्रगति पर',
    tl: 'kasalukuyang ginagawa',
  },
  {
    en: 'Discount rate: ',
    ur: 'رعایت کی شرح: ',
    hi: 'छूट दर: ',
    tl: 'Diskwento: ',
  },
];

type TrackedTextNode = Text & { __flasterOrigText?: string };
type TrackedElement = HTMLElement & {
  __flasterOrigPlaceholder?: string;
  __flasterOrigTitle?: string;
};

export const GlobalDomTranslator: React.FC<{ lang: Language }> = ({ lang }) => {
  useEffect(() => {
    const translateString = (raw: string): string => {
      const trimmed = raw.trim();
      if (!trimmed) return raw;

      if (lang === 'ar' || lang === 'en') {
        return raw;
      }

      const targetLang = lang as 'ur' | 'hi' | 'tl';

      const exactMatch = EXACT_PHRASE_DICTIONARY[trimmed];
      if (exactMatch) {
        return raw.replace(trimmed, exactMatch[targetLang]);
      }

      let result = raw;
      for (const rule of SUBSTRING_REPLACEMENTS) {
        if (result.includes(rule.en)) {
          result = result.replace(rule.en, rule[targetLang]);
        }
      }
      return result;
    };

    const processNode = (root: Node) => {
      if (
        root instanceof HTMLElement &&
        root.closest('[data-no-dom-translate="true"]')
      ) {
        return;
      }

      // 1. Translate Text Nodes
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
      let currentNode = walker.nextNode() as TrackedTextNode | null;

      while (currentNode) {
        const parentEl = currentNode.parentElement;
        const parentTag = parentEl?.tagName;
        if (
          parentTag !== 'SCRIPT' &&
          parentTag !== 'STYLE' &&
          !parentEl?.closest('[data-no-dom-translate="true"]')
        ) {
          const currentVal = currentNode.nodeValue || '';

          if (lang === 'ar' || lang === 'en') {
            if (currentNode.__flasterOrigText && currentVal !== currentNode.__flasterOrigText) {
              delete currentNode.__flasterOrigText;
            }
          } else {
            const baseText = currentNode.__flasterOrigText || currentVal;
            const nextText = translateString(baseText);
            if (nextText !== currentVal) {
              if (!currentNode.__flasterOrigText) {
                currentNode.__flasterOrigText = currentVal;
              }
              currentNode.nodeValue = nextText;
            }
          }
        }
        currentNode = walker.nextNode() as TrackedTextNode | null;
      }

      // 2. Translate Input Placeholders & Element Titles
      if (root instanceof HTMLElement || root instanceof Document) {
        const elements = root.querySelectorAll<TrackedElement>('[placeholder], [title]');
        elements.forEach((el) => {
          if (el.closest('[data-no-dom-translate="true"]')) return;
          if (lang === 'ar' || lang === 'en') {
            delete el.__flasterOrigPlaceholder;
            delete el.__flasterOrigTitle;
            return;
          }
          const placeholder = el.getAttribute('placeholder');
          if (placeholder) {
            const basePh = el.__flasterOrigPlaceholder || placeholder;
            const nextPh = translateString(basePh);
            if (nextPh !== placeholder) {
              if (!el.__flasterOrigPlaceholder) el.__flasterOrigPlaceholder = placeholder;
              el.setAttribute('placeholder', nextPh);
            }
          }
          const titleAttr = el.getAttribute('title');
          if (titleAttr) {
            const baseTitle = el.__flasterOrigTitle || titleAttr;
            const nextTitle = translateString(baseTitle);
            if (nextTitle !== titleAttr) {
              if (!el.__flasterOrigTitle) el.__flasterOrigTitle = titleAttr;
              el.setAttribute('title', nextTitle);
            }
          }
        });
      }
    };

    processNode(document.body);

    if (lang === 'ar' || lang === 'en') return;

    let isMutating = false;
    const observer = new MutationObserver((mutations) => {
      if (isMutating) return;
      isMutating = true;
      for (const m of mutations) {
        if (m.type === 'childList') {
          m.addedNodes.forEach((n) => processNode(n));
        }
      }
      isMutating = false;
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [lang]);

  return null;
};
