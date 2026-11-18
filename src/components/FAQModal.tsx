import React, { useState } from 'react';
import { 
  HelpCircle, 
  ChevronDown, 
  X, 
  Store, 
  Clock, 
  CreditCard, 
  Gift, 
  ShieldCheck, 
  RotateCcw, 
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { Language } from '../types';

interface FAQModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onOpenSupport?: () => void;
}

export const FAQModal: React.FC<FAQModalProps> = ({
  isOpen,
  onClose,
  lang,
  onOpenSupport
}) => {
  const isArabic = lang === 'ar';
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  if (!isOpen) return null;

  const faqs = [
    {
      qAr: 'كيف أستلم طلبي من المطعم أو المخبز؟',
      qEn: 'How do I collect my surplus order?',
      aAr: 'الأمر بسيط جداً! بعد إتمام حجز الوجبة في التطبيق، ستحصل فوراً على تذكرة استلام رقمية (Digital Pass) تحتوي على رمز QR وكود من 6 أرقام. توجه للمطعم خلال فترة الاستلام المحددة (Pickup Window)، واعرض الشاشة للموظف عند الكاونتر ليقوم بمسح الكود وتسليمك البوكس مباشرة.',
      aEn: 'Very easy! After confirming your order, you get an instant Digital Pass with a QR code and 6-digit number. Show it at the counter during the pickup window to collect your freshly packed surplus box.',
      icon: Store
    },
    {
      qAr: 'ماذا أفعل إذا تأخر موعد تحضير أو تسليم الطلب؟',
      qEn: 'What should I do if the order is delayed?',
      aAr: 'جميع المطاعم تتلقى إشعاراً صوتياً ولحظياً فور دفعك للطلب. إذا تأخر المطبخ عن موعد الاستلام أو حدث أي طارئ، يمكنك النقر على "طلب استرداد أو إلغاء" في الإيصال الرقمي أو التواصل مباشرة مع خدمة العملاء بالواتساب وسيتم حل المشكلة أو استرجاع نقودك ونقاطك فوراً.',
      aEn: 'Kitchens receive instant sound alerts upon payment. If there is an unexpected delay, you can tap "Request Refund / Cancel" in your receipt or text customer support to resolve it immediately.',
      icon: Clock
    },
    {
      qAr: 'ما هي طرق الدفع المتاحة في تطبيق فلاستر Flaster؟',
      qEn: 'What payment methods are available in Flaster?',
      aAr: 'نوفر لك خيارات دفع متعددة ومرنة: يمكنك الدفع الإلكتروني الآمن عبر Apple Pay أو البطاقات الائتمانية والخصم المباشر (Visa / MasterCard)، أو اختيار الدفع نقداً عند الاستلام بالفرع (Cash on Counter) دون الحاجة لبطاقة بنكية.',
      aEn: 'We support Apple Pay, Credit/Debit cards (Visa, MasterCard), and Cash on Counter pickup without requiring a card.',
      icon: CreditCard
    },
    {
      qAr: 'كيف أحصل على 500 نقطة ترحيبية وأستفيد منها؟',
      qEn: 'How do I get the 500 welcome points and redeem them?',
      aAr: 'بمجرد تسجيل حساب جديد برقم هاتفك وتأكيد الرمز، يتم إضافة 500 نقطة ولاء مجاناً إلى محفظتك تلقائياً! كل 100 نقطة تساوي 1 درهم إماراتي، مما يعني أنك حصلت على 5 دراهم يمكنك خصمها فوراً من قيمة طلبك عند الدفع دون أي قيود.',
      aEn: 'Signing up automatically credits 500 bonus points (= AED 5.00) to your wallet. Every 100 points equals AED 1, redeemable directly on your checkout.',
      icon: Gift
    },
    {
      qAr: 'هل وجبات وأطعمة الفائض صالحة وطازجة ومضمونة؟',
      qEn: 'Is the surplus food safe, fresh, and guaranteed?',
      aAr: 'نعم بنسبة 100%! الأطعمة الفائضة ليست طعاماً بائتاً أو تالفاً على الإطلاق، بل هي وجبات طازجة، بوفيهات فنادق فاخرة، ومخبوزات حرفية تم إعدادها في نفس اليوم وزادت عن حاجة البيع اليومي. جميع شركائنا مرخصون وملتزمون بأعلى معايير سلامة الغذاء في دولة الإمارات.',
      aEn: '100% yes! Surplus food is freshly prepared the same day by licensed hotels, bakeries, and kitchens. It is perfectly edible and strictly compliant with UAE food safety regulations.',
      icon: ShieldCheck
    },
    {
      qAr: 'كيف يتم استرداد أموالي إذا ألغيت طلبي؟',
      qEn: 'How are refunds handled if I cancel?',
      aAr: 'إذا قمت بإلغاء الطلب قبل تجهيزه، يتم إرجاع أي نقاط ولاء مستخدمة إلى محفظتك فوراً، ويتم تحويل المبلغ المدفوع إلكترونياً إلى بطاقتك أو محفظتك حسب نظام الدفع المتبع دون أي تعقيد.',
      aEn: 'If cancelled before preparation, used loyalty points return to your wallet immediately, and electronic payments are refunded promptly.',
      icon: RotateCcw
    }
  ];

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-xl bg-white rounded-2xl shadow-elevation-4 border border-[#EAE4DC] overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#FAF8F5] p-5 border-b border-[#EAE4DC] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-900 flex items-center justify-center shadow-sm">
              <HelpCircle className="w-6 h-6 text-amber-700" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-base text-[#0F172A]">
                {isArabic ? 'الأسئلة الشائعة والمساعدة السريعة' : 'Frequently Asked Questions (FAQ)'}
              </h3>
              <p className="text-xs text-[#64748B]">
                {isArabic ? 'إجابات واضحة وموثوقة لكل ما يهمك حول المنصة والطلبات' : 'Clear answers about pickup, payments, and points'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* FAQs Accordion */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1 text-xs">
          {faqs.map((faq, idx) => {
            const isOpen = openIndex === idx;
            const Icon = faq.icon;
            return (
              <div
                key={idx}
                className={`rounded-xl border transition-all overflow-hidden ${
                  isOpen 
                    ? 'border-amber-400/80 bg-[#FFFDF8] shadow-sm' 
                    : 'border-[#EAE4DC] bg-white hover:border-slate-300'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : idx)}
                  className="w-full p-4 text-start font-bold text-sm text-[#0F172A] flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isOpen ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="leading-snug">{isArabic ? faq.qAr : faq.qEn}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isOpen ? 'rotate-180 text-amber-600' : ''}`} />
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 pt-1 text-xs text-[#475569] leading-relaxed border-t border-amber-100">
                    <p>{isArabic ? faq.aAr : faq.aEn}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Support Banner */}
        <div className="p-4 bg-[#FAF8F5] border-t border-[#EAE4DC] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-[#475569]">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>{isArabic ? 'هل تحتاج لمساعدة إضافية خاصة؟' : 'Need more help?'}</span>
          </div>

          <button
            onClick={() => {
              onClose();
              if (onOpenSupport) onOpenSupport();
            }}
            className="px-4 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{isArabic ? 'تواصل مع خدمة العملاء بالواتساب' : 'WhatsApp Support'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
