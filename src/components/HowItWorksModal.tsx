import React, { useState } from 'react';
import { 
  X, 
  Store, 
  Users, 
  QrCode, 
  ShoppingBag, 
  DollarSign, 
  Clock, 
  Leaf, 
  CheckCircle2, 
  ArrowRight,
  ShieldCheck,
  Building2
} from 'lucide-react';
import { Language } from '../types';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onOpenMerchant: () => void;
}

export const HowItWorksModal: React.FC<HowItWorksModalProps> = ({
  isOpen,
  onClose,
  lang,
  onOpenMerchant,
}) => {
  const [activeTab, setActiveTab] = useState<'customer' | 'restaurant'>('restaurant');

  if (!isOpen) return null;

  const isArabic = lang === 'ar';

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-elevation-4 overflow-hidden border border-[#E2E8F0] my-8 animate-in zoom-in-95 duration-200 flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div className="p-6 bg-gradient-to-r from-slate-900 via-slate-800 to-[#991B1B] text-white flex items-center justify-between">
          <div>
            <span className="px-2.5 py-0.5 rounded-full bg-red-500/30 text-red-200 text-[11px] font-bold uppercase tracking-wider">
              {isArabic ? 'دليل المنصة الشامل' : 'Platform Operations Guide'}
            </span>
            <h3 className="font-headline font-extrabold text-xl sm:text-2xl mt-1">
              {isArabic ? 'كيف يعمل تطبيق فلاستر Flaster؟' : 'How Flaster Works'}
            </h3>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Audience Switcher Tabs */}
        <div className="flex border-b border-[#E2E8F0] bg-[#F8FAFC] p-1.5 gap-1 text-xs font-bold">
          <button
            onClick={() => setActiveTab('restaurant')}
            className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'restaurant'
                ? 'bg-white text-[#DC2626] shadow-sm border border-[#E2E8F0]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>{isArabic ? 'للمطاعم والشركات (كيف تضيف وتتحكم)' : 'For Restaurants & Partners'}</span>
          </button>

          <button
            onClick={() => setActiveTab('customer')}
            className={`flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition-all ${
              activeTab === 'customer'
                ? 'bg-white text-[#059669] shadow-sm border border-[#E2E8F0]'
                : 'text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>{isArabic ? 'للزبائن والعملاء (كيف يطلبون ويستلمون)' : 'For Consumers & Customers'}</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs">
          
          {activeTab === 'restaurant' ? (
            /* Restaurant Operations Guide */
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-red-50/70 border border-red-200 text-red-950 space-y-1">
                <p className="font-bold text-sm text-[#991B1B]">
                  {isArabic 
                    ? '🎯 هدف المنصة للمطاعم: تحويل الفائض من خسارة إلى أرباح محمية وصفر هدر' 
                    : 'Goal: Turn end-of-day surplus into recovered revenue and zero landfill waste'}
                </p>
                <p className="text-[11px] text-[#7F1D1D] leading-relaxed">
                  {isArabic 
                    ? 'بدلاً من رمي الأطعمة الطازجة عند الإغلاق، يطرح الشيف أو مدير المطعم بوكسات مفاجئة بخصم 50% إلى 70%، ويستلم قيمتها فوراً.' 
                    : 'Instead of discarding fresh food at closing, post surprise mystery packs at 50-70% off to recover costs.'}
                </p>
              </div>

              {/* 3 Step Workflow */}
              <div className="space-y-4">
                <h4 className="font-headline font-bold text-sm text-[#0F172A]">
                  {isArabic ? 'خطوات إضافة المطعم وبث الوجبات:' : '3 Easy Steps to Broadcast & Manage:'}
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  
                  <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-red-100 text-[#DC2626] font-bold flex items-center justify-center font-metric">
                      1
                    </div>
                    <h5 className="font-bold text-[#0F172A]">
                      {isArabic ? 'افتح بوابة الشركاء' : 'Open Partner Portal'}
                    </h5>
                    <p className="text-[#64748B] text-[11px] leading-relaxed">
                      {isArabic 
                        ? 'اضغط على زر "بوابة المطاعم" أعلى الشاشة للدخول إلى لوحة التحكم الإدارية.' 
                        : 'Click "Merchant Workspace" in the header to access kitchen inventory controls.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-red-100 text-[#DC2626] font-bold flex items-center justify-center font-metric">
                      2
                    </div>
                    <h5 className="font-bold text-[#0F172A]">
                      {isArabic ? 'اضغط "بث دفعة فائض"' : 'Click Broadcast Batch'}
                    </h5>
                    <p className="text-[#64748B] text-[11px] leading-relaxed">
                      {isArabic 
                        ? 'حدد اسم المطعم، التصنيف، عدد الوجبات المتوفرة الليلة، السعر الأصلي والمخفض، وساعات الاستلام.' 
                        : 'Set restaurant name, category, stock count, discounted rescue price, and pickup hours.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-xl bg-white border border-[#E2E8F0] space-y-2">
                    <div className="w-8 h-8 rounded-lg bg-red-100 text-[#DC2626] font-bold flex items-center justify-center font-metric">
                      3
                    </div>
                    <h5 className="font-bold text-[#0F172A]">
                      {isArabic ? 'مسح الكود وتسليم الطلب' : 'Scan Pass at Counter'}
                    </h5>
                    <p className="text-[#64748B] text-[11px] leading-relaxed">
                      {isArabic 
                        ? 'عندما يحضر الزبون للكاونتر، يبرز لك كود QR على جواله؛ تسلمه البوكس وتنتهي العملية في 10 ثوانٍ!' 
                        : 'Customer arrives with their QR pass; verify it in 10 seconds and hand over the meal pack!'}
                    </p>
                  </div>

                </div>
              </div>

              {/* Action */}
              <div className="pt-2">
                <button
                  onClick={() => {
                    onClose();
                    onOpenMerchant();
                  }}
                  className="w-full h-12 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold flex items-center justify-center gap-2 shadow-md shadow-red-500/20 active:scale-98 transition-all"
                >
                  <Store className="w-4 h-4" />
                  <span>{isArabic ? 'انتقل إلى لوحة التحكم وبوابة المطاعم الآن' : 'Go to Merchant Workspace Now'}</span>
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </button>
              </div>
            </div>
          ) : (
            /* Customer Experience Guide */
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
                <p className="font-bold text-sm text-[#065F46]">
                  {isArabic 
                    ? '🛍️ تجربة الزبون: وجبات فاخرة من فنادق ومخابز 5 نجوم بنصف السعر' 
                    : 'Customer Promise: 5-Star resort buffets and artisan bakeries at 50-70% off'}
                </p>
                <p className="text-[11px] text-emerald-800 leading-relaxed">
                  {isArabic 
                    ? 'كل وجبة طازجة ومعدّة اليوم بأيدي أمهر الطهاة، تحجزها وتستلمها مباشرة من المطعم بنفسك.' 
                    : 'Freshly prepared meals ready for self-pickup at the restaurant counter.'}
                </p>
              </div>

              {/* Customer 4 Steps */}
              <div className="space-y-3">
                <h4 className="font-headline font-bold text-sm text-[#0F172A]">
                  {isArabic ? 'كيف تطلب وتستلم كزبون؟' : 'How Customers Order & Collect:'}
                </h4>

                <div className="space-y-2.5">
                  
                  <div className="flex items-start gap-3 p-3 rounded-lg border border-[#E2E8F0] bg-white">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center font-metric shrink-0 mt-0.5">
                      1
                    </div>
                    <div>
                      <h5 className="font-bold text-[#0F172A]">
                        {isArabic ? 'تصفح البوكسات المتاحة' : 'Browse Available Surplus'}
                      </h5>
                      <p className="text-[#64748B] text-[11px] mt-0.5">
                        {isArabic 
                          ? 'اختر منطقتك في رأس الخيمة، واستكشف بوفيهات الفنادق، المخابز الفرنسية، أو الكافيهات.' 
                          : 'Select your neighborhood in Ras Al Khaimah and discover active bakery & buffet bags.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg border border-[#E2E8F0] bg-white">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center font-metric shrink-0 mt-0.5">
                      2
                    </div>
                    <div>
                      <h5 className="font-bold text-[#0F172A]">
                        {isArabic ? 'احجز البوكس قبل نفاده' : 'Reserve & Checkout'}
                      </h5>
                      <p className="text-[#64748B] text-[11px] mt-0.5">
                        {isArabic 
                          ? 'اضغط "احجز الآن" لتأكيد حجز البوكس فوراً وحمايته قبل أن ينفد المخزون.' 
                          : 'Tap "Reserve Now" to lock in your discounted surplus bag before sold out.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg border border-[#E2E8F0] bg-white">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center font-metric shrink-0 mt-0.5">
                      3
                    </div>
                    <div>
                      <h5 className="font-bold text-[#0F172A]">
                        {isArabic ? 'تصلك تذكرة استلام رقمية (كود QR)' : 'Instant Digital Pass (QR Code)'}
                      </h5>
                      <p className="text-[#64748B] text-[11px] mt-0.5">
                        {isArabic 
                          ? 'يظهر لك كود QR ورمز تذكرة فوري (مثل RAK-9281-WA) مع مؤقت عد تنازلي لموعد الاستلام.' 
                          : 'Get a scannable digital pass with pickup window countdown timer.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 rounded-lg border border-[#E2E8F0] bg-white">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center font-metric shrink-0 mt-0.5">
                      4
                    </div>
                    <div>
                      <h5 className="font-bold text-[#0F172A]">
                        {isArabic ? 'التوجه للمطعم والاستلام' : 'Pick Up at Counter'}
                      </h5>
                      <p className="text-[#64748B] text-[11px] mt-0.5">
                        {isArabic 
                          ? 'توجه إلى كاونتر المطعم أو الفندق، أظهر الشاشة للموظف واستلم وجبتك الساخنة والطازجة!' 
                          : 'Head to the counter, show the QR code to staff, and enjoy your gourmet meal!'}
                      </p>
                    </div>
                  </div>

                </div>
              </div>

              {/* Action */}
              <button
                onClick={onClose}
                className="w-full h-12 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-98 transition-all"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>{isArabic ? 'تصفح العروض والبوكسات الآن' : 'Start Browsing Deals'}</span>
              </button>
            </div>
          )}

        </div>

        {/* Modal Footer Note */}
        <div className="p-4 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between text-[11px] text-[#64748B]">
          <span className="flex items-center gap-1 text-[#059669] font-semibold">
            <ShieldCheck className="w-4 h-4" />
            {isArabic ? 'نظام معتمد وفق اشتراطات بلدية رأس الخيمة' : 'Compliant with RAK Municipality Food Standards'}
          </span>

          <button
            onClick={onClose}
            className="text-[#0F172A] font-bold hover:underline"
          >
            {isArabic ? 'إغلاق' : 'Close'}
          </button>
        </div>

      </div>
    </div>
  );
};
