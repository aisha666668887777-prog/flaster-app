import React, { useState } from 'react';
import { 
  X, 
  Store, 
  TrendingUp, 
  ShieldCheck, 
  Sparkles, 
  Coins, 
  Clock, 
  Smartphone, 
  CheckCircle2, 
  MessageCircle, 
  ArrowRight,
  Layers,
  ChefHat
} from 'lucide-react';
import { Language } from '../types';

interface RestaurantPartnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onOpenKitchenDemo?: () => void;
}

export const RestaurantPartnerModal: React.FC<RestaurantPartnerModalProps> = ({
  isOpen,
  onClose,
  lang,
  onOpenKitchenDemo,
}) => {
  const [dailySurplusMeals, setDailySurplusMeals] = useState<number>(10);
  const [averagePrice, setAveragePrice] = useState<number>(30);

  if (!isOpen) return null;

  const isArabic = lang === 'ar';

  // Calculator Logic
  const monthlyRevenue = dailySurplusMeals * averagePrice * 30;
  const platformCommission = monthlyRevenue * 0.15;
  const netMonthlyProfit = monthlyRevenue - platformCommission;
  const yearlyNetProfit = netMonthlyProfit * 12;

  const whatsappHref = `https://wa.me/971504116994?text=${encodeURIComponent(
    isArabic
      ? 'مرحباً إدارة فلاستر، أود الاستفسار عن تسجيل مطعمنا كشريك معتمد في منصة فلاستر برأس الخيمة.'
      : 'Hello Flaster Team, I would like to inquire about registering our restaurant as an approved partner in Ras Al Khaimah.'
  )}`;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in overflow-y-auto"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden my-auto flex flex-col animate-in zoom-in-95 max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className="relative bg-gradient-to-r from-slate-950 via-slate-900 to-red-950 text-white p-6 sm:p-7 shrink-0">
          <button 
            onClick={onClose}
            className="absolute top-4 end-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs uppercase tracking-wider mb-2">
            <ChefHat className="w-4 h-4" />
            <span>{isArabic ? 'شراكة المطاعم والمخابز الفاخرة برأس الخيمة' : 'RAK Restaurant & Bakery Partnership'}</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black font-headline leading-tight">
            {isArabic 
              ? 'حوّل فائض طعامك اليومي إلى أرباح حقيقية وعملاء جدد!'
              : 'Turn Daily Surplus Food into Guaranteed Revenue!'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-1.5 leading-relaxed max-w-lg">
            {isArabic
              ? 'انضم لمنصة فودكس وتخلص من خسائر الهدر الغذائي اليومي بنهاية كل وردية دون أي مجهود إضافي على طاقمك.'
              : 'Join Fodex & Flaster platform to eliminate daily food waste losses at the end of every shift with zero extra effort.'}
          </p>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">

          {/* Interactive ROI Calculator Card */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-red-500/5 to-slate-50 border border-amber-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-sm">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-[#0F172A]">
                    {isArabic ? 'حاسبة أرباح مطعمك التقديرية من الفائض' : 'Surplus Revenue Calculator'}
                  </h3>
                  <p className="text-[11px] text-[#64748B]">
                    {isArabic ? 'كم يخسر مطعمك حالياً من رمي الطعام؟ وكم ستربح معنا؟' : 'See how much waste turns into pure profit'}
                  </p>
                </div>
              </div>
            </div>

            {/* Sliders */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-[#0F172A]">
                  <span>{isArabic ? 'الوجبات الفائضة يومياً:' : 'Daily Surplus Meals:'}</span>
                  <span className="font-metric text-[#DC2626] font-extrabold text-sm">{dailySurplusMeals} {isArabic ? 'وجبة' : 'meals'}</span>
                </div>
                <input 
                  type="range" 
                  min="3" 
                  max="40" 
                  value={dailySurplusMeals}
                  onChange={(e) => setDailySurplusMeals(Number(e.target.value))}
                  className="w-full accent-[#DC2626] cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold text-[#0F172A]">
                  <span>{isArabic ? 'متوسط سعر الصنف:' : 'Average Item Price:'}</span>
                  <span className="font-metric text-[#DC2626] font-extrabold text-sm">{averagePrice} {isArabic ? 'درهم' : 'AED'}</span>
                </div>
                <input 
                  type="range" 
                  min="15" 
                  max="80" 
                  step="5"
                  value={averagePrice}
                  onChange={(e) => setAveragePrice(Number(e.target.value))}
                  className="w-full accent-[#DC2626] cursor-pointer"
                />
              </div>
            </div>

            {/* Profit Result Display (Commission hidden from public view as requested) */}
            <div className="grid grid-cols-2 gap-3 pt-2 border-t border-amber-200/60">
              <div className="p-3 bg-white rounded-xl border border-slate-200 text-center shadow-xs">
                <p className="text-[10px] font-bold text-[#64748B] uppercase">
                  {isArabic ? 'صافي ربحك الإضافي شهرياً' : 'Net Monthly Extra Profit'}
                </p>
                <p className="text-xl sm:text-2xl font-black text-emerald-600 font-headline mt-0.5">
                  +{netMonthlyProfit.toLocaleString()} <span className="text-xs font-bold">{isArabic ? 'درهم' : 'AED'}</span>
                </p>
                <p className="text-[9px] text-[#059669] font-bold mt-0.5">
                  {isArabic ? 'عوائد مباشرة لخزينة المطعم' : 'Direct revenue to kitchen'}
                </p>
              </div>

              <div className="p-3 bg-white rounded-xl border border-slate-200 text-center shadow-xs">
                <p className="text-[10px] font-bold text-[#64748B] uppercase">
                  {isArabic ? 'صافي أرباحك السنوية التقديرية' : 'Estimated Annual Profit'}
                </p>
                <p className="text-xl sm:text-2xl font-black text-[#0F172A] font-headline mt-0.5">
                  +{yearlyNetProfit.toLocaleString()} <span className="text-xs font-bold">{isArabic ? 'درهم' : 'AED'}</span>
                </p>
                <p className="text-[9px] text-[#059669] font-bold mt-0.5">
                  {isArabic ? 'أموال كانت تذهب في سلة النفايات!' : 'Revenue recovered from 100% loss'}
                </p>
              </div>
            </div>
          </div>

          {/* 3 Simple Operational Steps */}
          <div className="space-y-3">
            <h4 className="font-extrabold text-sm text-[#0F172A] flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#DC2626]" />
              <span>{isArabic ? 'كيف يعمل النظام لمطعمك؟ (3 خطوات بسيطة)' : 'How it works for your kitchen:'}</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="w-6 h-6 rounded-lg bg-red-100 text-[#DC2626] font-bold text-xs flex items-center justify-center">
                  1
                </div>
                <p className="font-extrabold text-xs text-[#0F172A]">
                  {isArabic ? 'فائض فطور، غداء أو عشاء' : 'Breakfast, Lunch & Dinner Surplus'}
                </p>
                <p className="text-[11px] text-[#64748B] leading-relaxed">
                  {isArabic 
                    ? 'من بداية اليوم أو خلال الوردية، يحدد الشيف الأصناف الفائضة الطازجة بكل مرونة وسرعة.'
                    : 'From the start of the day or during shifts, chefs list fresh surplus items.'}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="w-6 h-6 rounded-lg bg-red-100 text-[#DC2626] font-bold text-xs flex items-center justify-center">
                  2
                </div>
                <p className="font-extrabold text-xs text-[#0F172A]">
                  {isArabic ? 'تحديد السعر والكمية' : 'Set Price & Count'}
                </p>
                <p className="text-[11px] text-[#64748B] leading-relaxed">
                  {isArabic 
                    ? 'من الجوال بضغطة واحدة: تضع السعر المخفض وساعات الاستلام المتاحة للزبائن.'
                    : '1-tap on mobile to set discount price and convenient pickup window.'}
                </p>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="w-6 h-6 rounded-lg bg-emerald-100 text-[#059669] font-bold text-xs flex items-center justify-center">
                  3
                </div>
                <p className="font-extrabold text-xs text-[#0F172A]">
                  {isArabic ? 'تسليم واستلام الأرباح' : 'Pickup & Get Paid'}
                </p>
                <p className="text-[11px] text-[#64748B] leading-relaxed">
                  {isArabic 
                    ? 'الزبون يحجز عبر التطبيق، ويتوجه للمطعم لاستلام وجبته المحددة مباشرة من الكاونتر.'
                    : 'Customer reserves in-app and picks up the item directly at your counter.'}
                </p>
              </div>
            </div>
          </div>

          {/* Key Merchant Guarantees */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            <div className="flex items-start gap-2 p-2.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[#0F172A]">{isArabic ? 'صفر تكاليف تأسيس أو اشتراك' : 'Zero Setup Fees'}</p>
                <p className="text-[10px] text-slate-600">{isArabic ? 'مجاني 100%، وتخلص تام من خسائر الهدر' : '100% free signup, zero waste losses'}</p>
              </div>
            </div>

            <div className="flex items-start gap-2 p-2.5 bg-blue-50/70 border border-blue-200 rounded-xl">
              <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[#0F172A]">{isArabic ? 'عرض واضح للأصناف الطازجة' : 'Real Menu Item Showcase'}</p>
                <p className="text-[10px] text-slate-600">{isArabic ? 'عرض الصنف بصورته الحقيقية وسعره الأصلي والمخفض' : 'Display authentic dishes with original and rescue prices'}</p>
              </div>
            </div>

            <div className="flex items-start gap-2 p-2.5 bg-purple-50/70 border border-purple-200 rounded-xl">
              <Coins className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[#0F172A]">{isArabic ? 'مدفوعات فورية معتمدة' : 'Official Central Bank Payments'}</p>
                <p className="text-[10px] text-slate-600">{isArabic ? 'تحويل الأرباح لحساب مطعمك البنكي بانتظام' : 'Secure payouts via licensed UAE payment infrastructure'}</p>
              </div>
            </div>

            <div className="flex items-start gap-2 p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-[#0F172A]">{isArabic ? 'تسويق مجاني لمطعمك' : 'Free Brand Exposure'}</p>
                <p className="text-[10px] text-slate-600">{isArabic ? 'آلاف العملاء الجدد في رأس الخيمة يتعرفون على مطعمك' : 'Attract new loyal customers across Ras Al Khaimah'}</p>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Sticky Footer Actions (WhatsApp only, kitchen preview removed as requested) */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-center">
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-headline font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-98 transition-all cursor-pointer"
          >
            <MessageCircle className="w-4 h-4" />
            <span>{isArabic ? 'تواصل معنا لتسجيل مطعمك (واتساب)' : 'Chat with Us to Register (WhatsApp)'}</span>
          </a>
        </div>

      </div>
    </div>
  );
};
