import React from 'react';
import { 
  X, 
  Leaf, 
  Award, 
  Trees, 
  Car, 
  UtensilsCrossed, 
  Sparkles, 
  Share2, 
  ShieldCheck,
  CheckCircle2,
  TrendingUp
} from 'lucide-react';
import { Language } from '../types';
import { translations } from '../translations';

interface ImpactModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  rescuedMealsCount: number;
  totalSavedAed: number;
}

export const ImpactModal: React.FC<ImpactModalProps> = ({
  isOpen,
  onClose,
  lang,
  rescuedMealsCount,
  totalSavedAed,
}) => {
  if (!isOpen) return null;

  const t = translations[lang];
  const isArabic = lang === 'ar';

  const userMeals = Math.max(rescuedMealsCount, 4); // sample default + current session
  const userCo2 = (userMeals * 2.8).toFixed(1);
  const userAedSaved = Math.max(totalSavedAed, 185);
  const treesEquivalent = (Number(userCo2) / 21).toFixed(1); // 1 tree absorbs ~21kg CO2/year
  const carKmEquivalent = Math.round(Number(userCo2) * 8.2); // ~8.2 km driving avoided per kg CO2

  const badges = [
    {
      title: isArabic ? 'رائد إنقاذ الغذاء' : 'Zero Waste Pioneer',
      desc: isArabic ? 'أكملت أول عملية إنقاذ طعام بنجاح' : 'Completed your first surplus rescue',
      icon: '🌱',
      earned: true,
    },
    {
      title: isArabic ? 'حامي بوفيهات الفنادق' : '5-Star Buffet Savior',
      desc: isArabic ? 'أنقذت ٣ وجبات من أفخم مطاعم رأس الخيمة' : 'Rescued 3 luxury restaurant dishes',
      icon: '⭐',
      earned: true,
    },
    {
      title: isArabic ? 'بطل المخابز الفرنسية' : 'Artisan Patisserie Champion',
      desc: isArabic ? 'وفّرت معجنات طازجة من الهدر اليومي' : 'Prevented morning pastry waste',
      icon: '🥐',
      earned: true,
    },
    {
      title: isArabic ? 'سفير الاستدامة الإماراتي' : 'UAE Green Ambassador',
      desc: isArabic ? 'تفاديت أكثر من ٥٠ كجم من الكربون' : 'Diverted over 50kg CO2e emissions',
      icon: '🏅',
      earned: false,
    },
  ];

  const [copiedToast, setCopiedToast] = React.useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-2xl bg-white rounded-xl shadow-elevation-4 overflow-hidden border border-[#E2E8F0] my-8 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Banner with Emerald Gradient */}
        <div className="bg-gradient-to-r from-[#003B27] via-[#006646] to-[#047857] text-white p-6 sm:p-8 relative">
          <button
            onClick={onClose}
            className="absolute top-4 end-4 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-400/20 text-emerald-200 text-[11px] font-metric font-semibold border border-emerald-400/30">
              {t.ecoLevel}
            </span>
          </div>

          <h2 className="font-headline font-extrabold text-2xl sm:text-3xl tracking-tight">
            {lang === 'ar' ? 'سجل الأثر البيئي الخاص بك' : 'Your Food Rescue Impact'}
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100 mt-1 max-w-lg">
            {lang === 'ar'
              ? 'كل وجبة فائضة تنقذها تقلل من انبعاثات الميثان في مكبات النفايات وتدعم مطاعم ومخابز رأس الخيمة.'
              : 'Every surplus meal you rescue prevents methane landfill emissions while supporting local RAK bakeries and resorts.'}
          </p>
        </div>

        {/* Impact Numbers */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[60vh] overflow-y-auto">
          
          <div className="grid grid-cols-3 gap-3 font-metric text-center">
            <div className="p-4 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] space-y-1">
              <span className="text-[11px] text-[#065F46] font-semibold block uppercase">
                {t.totalMealsRescued}
              </span>
              <span className="font-extrabold text-2xl sm:text-3xl text-[#006646] block">
                {userMeals}
              </span>
              <span className="text-[10px] text-emerald-700 block">
                {lang === 'ar' ? 'وجبات غذائية كاملة' : 'full meals saved'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#ECFDF5] border border-[#A7F3D0] space-y-1">
              <span className="text-[11px] text-[#065F46] font-semibold block uppercase">
                {lang === 'ar' ? 'كربون تم تفاديه' : 'CO2e Prevented'}
              </span>
              <span className="font-extrabold text-2xl sm:text-3xl text-[#006646] block">
                {userCo2} <span className="text-sm font-bold">kg</span>
              </span>
              <span className="text-[10px] text-emerald-700 block">
                {lang === 'ar' ? 'من انبعاثات الغازات' : 'greenhouse gases'}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-[#FEF3C7] border border-[#FDE68A] space-y-1">
              <span className="text-[11px] text-[#92400E] font-semibold block uppercase">
                {t.totalSavings}
              </span>
              <span className="font-extrabold text-2xl sm:text-3xl text-[#78350F] block">
                {userAedSaved} <span className="text-xs font-bold">{t.currency}</span>
              </span>
              <span className="text-[10px] text-amber-800 block">
                {lang === 'ar' ? 'في جيبك' : 'in your pocket'}
              </span>
            </div>
          </div>

          {/* Environmental Equivalencies */}
          <div className="bg-[#F8FAFC] rounded-xl p-5 border border-[#E2E8F0] space-y-3">
            <h4 className="font-headline font-bold text-xs uppercase tracking-wider text-[#64748B]">
              {lang === 'ar' ? 'المعادل البيئي لأثرك حتى الآن' : 'Your Environmental Equivalence'}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-white border border-[#E2E8F0]">
                <div className="w-10 h-10 rounded-lg bg-emerald-100 text-[#059669] flex items-center justify-center shrink-0">
                  <Trees className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-[#0F172A] block">
                    {treesEquivalent} {lang === 'ar' ? 'أشجار مزروعة سنوياً' : 'Trees Planted Equivalent'}
                  </span>
                  <span className="text-[#64748B] text-[11px]">
                    {lang === 'ar' ? 'في امتصاص ثاني أكسيد الكربون' : 'Annual CO2 absorption capacity'}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-white border border-[#E2E8F0]">
                <div className="w-10 h-10 rounded-lg bg-amber-100 text-[#D97706] flex items-center justify-center shrink-0">
                  <Car className="w-5 h-5" />
                </div>
                <div>
                  <span className="font-bold text-[#0F172A] block">
                    {carKmEquivalent} km {lang === 'ar' ? 'قيادة سيارة تم إلغاؤها' : 'Car Driving Offset'}
                  </span>
                  <span className="text-[#64748B] text-[11px]">
                    {lang === 'ar' ? 'بناءً على معايير الانبعاثات' : 'Calculated vs passenger vehicle'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Badges Section */}
          <div className="space-y-3">
            <h4 className="font-headline font-bold text-xs uppercase tracking-wider text-[#64748B]">
              {t.myBadges}
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {badges.map((b, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg border flex items-center gap-3 transition-all ${
                    b.earned
                      ? 'bg-white border-[#E2E8F0] shadow-sm'
                      : 'bg-slate-50 border-dashed border-slate-200 opacity-60'
                  }`}
                >
                  <span className="text-2xl">{b.icon}</span>
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-[#0F172A]">
                      <span>{b.title}</span>
                      {b.earned && <CheckCircle2 className="w-3.5 h-3.5 text-[#059669]" />}
                    </div>
                    <p className="text-[11px] text-[#64748B]">{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {copiedToast && (
            <div className="p-3 text-center text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-md font-semibold animate-in fade-in">
              {lang === 'ar' ? '✓ تم نسخ بطاقة الأثر البيئي لمشاركتها!' : '✓ Eco impact card copied to clipboard!'}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-5 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-[#059669] font-semibold">
            <Leaf className="w-4 h-4" />
            <span>{lang === 'ar' ? 'معاً من أجل رأس خيمة خضراء ومستدامة' : 'Building a Zero-Waste RAK Together'}</span>
          </div>

          <button
            onClick={() => {
              setCopiedToast(true);
              setTimeout(() => setCopiedToast(false), 3000);
            }}
            className="px-4 py-2 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{t.shareImpact}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
