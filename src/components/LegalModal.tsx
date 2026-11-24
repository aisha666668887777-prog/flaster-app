import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  FileText,
  Lock,
  Scale,
  Building2,
  RotateCcw,
  Utensils,
  Phone,
  MessageSquare,
  AlertTriangle,
  Clock,
  Globe,
  ExternalLink,
} from 'lucide-react';
import { Language } from '../types';
import { DEFAULT_PLATFORM_SETTINGS, PlatformSettings } from '../config/platformConfig';

export type LegalTabType = 'terms' | 'privacy' | 'refund' | 'food_safety' | 'contact';

interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  initialTab?: LegalTabType;
  supportPhoneE164?: string;
  platformSettings?: PlatformSettings;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  lang,
  initialTab = 'terms',
  supportPhoneE164,
  platformSettings,
}) => {
  const [activeTab, setActiveTab] = useState<LegalTabType>(initialTab);
  const isArabic = lang === 'ar';

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const phoneNoSpaces = (
    supportPhoneE164 || DEFAULT_PLATFORM_SETTINGS.supportPhoneE164
  ).replace(/\s+/g, '');
  const whatsappDigits = phoneNoSpaces.replace(/[^0-9]/g, '');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-white rounded-2xl shadow-elevation-4 overflow-hidden border border-[#EAE4DC] my-8 animate-in zoom-in-95 duration-200 flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#EAE4DC] flex items-center justify-between bg-[#FAF8F5]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center text-[#DC2626]">
              {activeTab === 'privacy' ? (
                <ShieldCheck className="w-5 h-5" />
              ) : activeTab === 'refund' ? (
                <RotateCcw className="w-5 h-5" />
              ) : activeTab === 'food_safety' ? (
                <Utensils className="w-5 h-5" />
              ) : activeTab === 'contact' ? (
                <Phone className="w-5 h-5" />
              ) : (
                <Scale className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 className="font-headline font-bold text-lg text-[#0F172A]">
                {isArabic
                  ? 'السياسات، شروط الاستخدام، والتواصل'
                  : 'Policies, Terms of Use & Contact'}
              </h3>
              <p className="text-xs text-[#64748B]">
                {isArabic
                  ? 'فلاستر Flaster • منصة مرخصة قانونياً وفق معايير دولة الإمارات العربية المتحدة'
                  : 'Flaster • Licensed under UAE E-Commerce & Consumer Protection Regulations'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 border border-[#CBD5E1] text-[#0F172A] flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher (4 Pages: Terms, Privacy, Refund Policy, Contact) */}
        <div className="flex flex-wrap border-b border-[#EAE4DC] bg-[#FAF8F5]/50 px-4 sm:px-6 pt-3 gap-1 sm:gap-2">
          <button
            onClick={() => setActiveTab('terms')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'terms'
                ? 'border-[#DC2626] text-[#DC2626]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{isArabic ? 'الشروط والأحكام' : 'Terms of Use'}</span>
          </button>

          <button
            onClick={() => setActiveTab('privacy')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'privacy'
                ? 'border-[#DC2626] text-[#DC2626]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>{isArabic ? 'سياسة الخصوصية' : 'Privacy Policy'}</span>
          </button>

          <button
            onClick={() => setActiveTab('refund')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'refund'
                ? 'border-[#DC2626] text-[#DC2626]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isArabic ? 'سياسة الاسترداد' : 'Refund Policy'}</span>
          </button>

          <button
            onClick={() => setActiveTab('contact')}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'contact'
                ? 'border-amber-600 text-amber-700'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Phone className="w-3.5 h-3.5" />
            <span>{isArabic ? 'اتصل بنا' : 'Contact'}</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700 leading-relaxed font-sans flex-1">
          {activeTab === 'terms' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-amber-700" />
                  {isArabic ? 'رخصة تجارية وسند قانوني رسمي' : 'Licensed UAE Commercial Entity'}
                </p>
                <p className="text-[11px] text-amber-800">
                  {isArabic
                    ? 'يتم تشغيل منصة فلاستر (Flaster) بموجب رخصة تجارية سارية في دولة الإمارات العربية المتحدة. المنصة مكرسة للحد من الهدر الغذائي وتوفير وجبات فائضة طازجة ومأمونة بنسبة 100%.'
                    : 'Flaster operates under a valid commercial trade license in the United Arab Emirates, dedicated to rescuing fresh, safe surplus food.'}
                </p>
              </div>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-[#0F172A]">
                  {isArabic
                    ? '1. طبيعة الخدمة وأصناف الطعام المعروضة'
                    : '1. Nature of Service & Fresh Food Items'}
                </h4>
                <p>
                  {isArabic
                    ? 'توفر منصة فلاستر (Flaster) وسيطاً رقمياً يربط بين المتاجر والمخابز والمطاعم والأسواق والمشاريع المنزلية المرخصة، وبين الزبائن الراغبين في إنقاذ الأغذية الفائضة بأسعار مخفضة تصل إلى 70%. الأسعار المعروضة شاملة ضريبة القيمة المضافة 5% (VAT = الإجمالي × 5 / 105).'
                    : 'Flaster connects licensed food merchants, bakeries, supermarkets, and home kitchens with consumers to rescue fresh daily surplus at discounts up to 70%. Displayed prices include 5% UAE VAT (VAT = Total × 5 / 105).'}
                </p>
              </section>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  {isArabic ? 'حماية البيانات الشخصية والخصوصية' : 'Personal Data Protection & Privacy'}
                </p>
                <p className="text-[11px] text-emerald-800">
                  {isArabic
                    ? 'نلتزم بقوانين حماية البيانات الشخصية في دولة الإمارات العربية المتحدة. لا يمكن لأي مستخدم قراءة أو تعديل بيانات مستخدم آخر.'
                    : 'We comply with UAE Personal Data Protection regulations. Strict Firestore security rules ensure users can only read or write their own profile and order records.'}
                </p>
              </div>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-[#0F172A]">
                  {isArabic ? '1. البيانات التي نجمعها' : '1. Data We Collect'}
                </h4>
                <p>
                  {isArabic
                    ? 'نجمع فقط رقم الهاتف المتحرك الموثق، الاسم، والبريد الإلكتروني الاختياري لإرسال الإيصالات وتصاريح الاستلام.'
                    : 'We collect only your verified mobile number, name, and optional email for receipts and pickup passes.'}
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-[#0F172A]">
                  {isArabic ? '2. أمان المدفوعات' : '2. Payment Security'}
                </h4>
                <p>
                  {isArabic
                    ? 'تتم معالجة المدفوعات الإلكترونية عبر بوابات مشفرة (Stripe UAE & Apple Pay) ولا يتم تخزين بيانات البطاقات البنكية داخل خوادم التطبيق.'
                    : 'Electronic payments are processed via encrypted gateways (Stripe UAE & Apple Pay). Card numbers are never stored on our servers.'}
                </p>
              </section>
            </div>
          )}

          {activeTab === 'refund' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <RotateCcw className="w-4 h-4 text-rose-700" />
                  {isArabic
                    ? 'سياسة الإلغاء واسترداد الأموال الرسمية'
                    : 'Official Refund & Cancellation Policy'}
                </p>
                <p className="text-[11px] text-rose-800">
                  {isArabic
                    ? 'تُطبق هذه السياسة إلكترونياً على الخادم لضمان حقوق الزبائن والمتاجر الشريكة.'
                    : 'Enforced server-side to protect both consumers and partner kitchens.'}
                </p>
              </div>

              <section className="space-y-2">
                <h4 className="font-bold text-sm text-[#0F172A]">
                  {isArabic
                    ? '1. متى يُسمح بإلغاء الطلب واسترداد المبلغ؟'
                    : '1. When are Refunds & Cancellations Allowed?'}
                </h4>
                <p>
                  {isArabic
                    ? 'يُسمح للزبون بإلغاء الطلب واسترداد كامل المبلغ (ونقاط الولاء المستبدلة) فقط عندما تكون حالة الطلب "تم الإرسال / قيد الانتظار" (Placed) أي قبل قيام المتجر بقبول الطلب أو بدء تحضيره.'
                    : 'Customers may cancel an order and receive a full refund (including any redeemed loyalty points) ONLY while the order is in "Placed" status—strictly before the merchant accepts or starts preparing the order.'}
                </p>
              </section>

              <section className="space-y-2">
                <h4 className="font-bold text-sm text-[#0F172A]">
                  {isArabic
                    ? '2. متى يُحظر الإلغاء أو الاسترداد؟'
                    : '2. When are Refunds Blocked?'}
                </h4>
                <p>
                  {isArabic
                    ? 'نظراً لأن الوجبات المعروضة هي فائض غذائي طازج يُحجز خصيصاً لك لمنع هدره، يُحظر إلغاء الطلب أو استرداد قيمته بعد قبول المتجر للطلب (Accepted)، أو أثناء تحضيره (Preparing)، أو بعد جاهزيته (Ready)، أو بعد استلامه من المطعم (Picked Up / Completed).'
                    : 'Because surplus food packages are reserved specifically to prevent waste, cancellations and refunds are strictly blocked once the merchant has accepted, prepared, or handed over the order at pickup.'}
                </p>
              </section>
            </div>
          )}

          {activeTab === 'food_safety' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Utensils className="w-4 h-4 text-emerald-700" />
                  {isArabic
                    ? 'إشعار سلامة الغذاء، نافذة الاستلام، ومسببات الحساسية'
                    : 'Food Safety Notice: Surplus Food, Pickup Windows & Allergens'}
                </p>
                <p className="text-[11px] text-emerald-800">
                  {isArabic
                    ? 'سلامتكم وجودة الوجبات هي أولويتنا القصوى في فلاستر.'
                    : 'Your health and culinary safety are our highest priority at Flaster.'}
                </p>
              </div>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-[#0F172A] flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-amber-600" />
                  <span>
                    {isArabic
                      ? '1. طبيعة الفائض الغذائي ونافذة الاستلام والصلاحية'
                      : '1. Surplus Food, Pickup Window & Expiry Time'}
                  </span>
                </h4>
                <p>
                  {isArabic
                    ? 'جميع الوجبات المعروضة هي فائض إنتاج يومي طازج وصالح للاستهلاك الآدمي 100% من منشآت غذائية مرخصة. يحدد كل متجر نافذة استلام دقيقة ووقت انتهاء صلاحية (Expiry / Best-Before Time). يقوم النظام تلقائياً بإخفاء أي وجبة فور انتهاء وقت صلاحيتها. يرجى استلام الطلب خلال النافذة المحددة واستهلاكه في نفس اليوم.'
                    : 'All listed packages consist of fresh, 100% safe daily surplus from licensed food establishments. Each listing specifies a strict pickup window and expiry/best-before time. Expired items are automatically hidden from the marketplace. Please collect your order within the designated pickup window and consume promptly.'}
                </p>
              </section>

              <section className="space-y-1.5">
                <h4 className="font-bold text-sm text-[#0F172A] flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <span>
                    {isArabic
                      ? '2. الإفصاح عن المكونات ومسببات الحساسية (Allergens)'
                      : '2. Allergens & Ingredients Disclosure'}
                  </span>
                </h4>
                <p>
                  {isArabic
                    ? 'توضح كل بطاقة منتج قائمة المكونات ومسببات الحساسية المحتملة (مثل: القمح/الجلوتين، الحليب ومشتقاته، المكسرات، البيض، الصويا، السمسم). إذا كنت تعاني من حساسية غذائية شديدة، يرجى مراجعة حقل مسببات الحساسية في صفحة المنتج وإبلاغ موظف المتجر عند الاستلام.'
                    : 'Every surplus listing displays known allergens and ingredients (e.g., Gluten/Wheat, Dairy, Tree Nuts, Eggs, Soy, Sesame). If you have food allergies or dietary restrictions, always check the item allergen notice and verify directly with the merchant staff upon pickup.'}
                </p>
              </section>
            </div>
          )}

          {activeTab === 'contact' && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 space-y-1">
                <p className="font-bold flex items-center gap-1.5">
                  <Phone className="w-4 h-4 text-amber-700" />
                  {isArabic ? 'قنوات التواصل الرسمية وخدمة العملاء' : 'Official Contact & Customer Care'}
                </p>
                <p className="text-[11px] text-amber-800">
                  {isArabic
                    ? 'فريق خدمة عملاء فلاستر متواجد يومياً من الساعة 10:00 صباحاً حتى 11:30 مساءً (بتوقيت الإمارات).'
                    : 'Flaster Customer Support is available daily from 10:00 AM to 11:30 PM GST.'}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <a
                  href={`tel:${phoneNoSpaces}`}
                  className="p-4 rounded-xl border border-amber-300 bg-white hover:bg-amber-50 flex items-center gap-3 shadow-sm transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="block text-xs text-[#0F172A]">
                      {isArabic ? 'رقم خدمة العملاء الموحد' : 'Customer Support Phone'}
                    </strong>
                    <span className="font-metric text-xs text-amber-800 font-bold" dir="ltr">
                      {phoneNoSpaces}
                    </span>
                  </div>
                </a>

                <a
                  href={`https://wa.me/${whatsappDigits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-xl border border-emerald-300 bg-white hover:bg-emerald-50 flex items-center gap-3 shadow-sm transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <strong className="block text-xs text-[#0F172A]">
                      {isArabic ? 'الدعم الفوري عبر واتساب' : 'WhatsApp Direct Support'}
                    </strong>
                    <span className="font-metric text-xs text-emerald-800 font-bold" dir="ltr">
                      {phoneNoSpaces}
                    </span>
                  </div>
                </a>
              </div>

              {/* Social Media Accounts */}
              <div className="pt-2">
                <h4 className="font-bold text-xs text-[#0F172A] mb-2">
                  {isArabic ? 'حسابات التواصل الإجتماعي' : 'Social Media Accounts'}
                </h4>
                <a
                  href="https://linktr.ee/flaster"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-4 rounded-xl border border-amber-300 bg-amber-50/70 hover:bg-amber-100/80 flex items-center justify-between shadow-sm transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Globe className="w-5 h-5" />
                    </div>
                    <div>
                      <strong className="block text-xs text-[#0F172A]">
                        {isArabic ? 'بوابة روابط التواصل للشركة' : 'Company Social Links Hub'}
                      </strong>
                      <span className="font-metric text-xs text-amber-800 font-bold" dir="ltr">
                        linktr.ee/flaster
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-amber-700" />
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:px-6 bg-[#FAF8F5] border-t border-[#EAE4DC] flex items-center justify-between">
          <span className="text-[11px] text-[#64748B]">
            {isArabic ? 'تاريخ آخر تحديث: نوفمبر 2026' : 'Last updated: November 2026'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#0F172A] hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer"
          >
            {isArabic ? 'موافق وإغلاق' : 'Acknowledge & Close'}
          </button>
        </div>
      </div>
    </div>
  );
};
