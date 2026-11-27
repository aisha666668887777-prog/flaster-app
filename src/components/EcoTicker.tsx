import React from 'react';
import { Leaf, UtensilsCrossed, Sparkles, TrendingUp } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../translations';

interface EcoTickerProps {
  lang: Language;
}

export const EcoTicker: React.FC<EcoTickerProps> = ({ lang }) => {
  const t = translations[lang];

  return (
    <div className="bg-[#4F6345] text-[#FFFDF7] py-1.5 px-3 sm:py-2 sm:px-4 text-xs w-full overflow-hidden border-b border-[#3F5136]">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 sm:gap-3 font-medium">
        
        {/* Left Headline */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <span className="font-semibold tracking-wide text-[#FEF3C7] flex items-center gap-1.5 text-[11px] sm:text-xs">
            <Sparkles className="w-3.5 h-3.5 text-[#F4C430]" />
            {lang === 'ar' ? 'المبادرة الوطنية لتوفير الغذاء وصفر هدر' : 'Smart Saving & Zero Food Waste Initiative'}
          </span>
        </div>

        {/* Live Counters */}
        <div className="flex items-center gap-3 sm:gap-8 font-metric overflow-x-auto no-scrollbar py-0.5 text-[#F3F6F0] text-[11px] sm:text-xs">
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <UtensilsCrossed className="w-3.5 h-3.5 text-[#F4C430]" />
            <span className="font-bold text-white tabular-nums">18,490</span>
            <span className="text-[#DDE7D8] text-[11px]">{t.totalMealsRescued}</span>
          </div>

          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <Leaf className="w-3.5 h-3.5 text-[#F4C430]" />
            <span className="font-bold text-white tabular-nums">46.2</span>
            <span className="text-[#DDE7D8] text-[11px]">{lang === 'ar' ? 'طن CO2e تم تفاديه' : 'Tons CO2e Prevented'}</span>
          </div>

          <div className="hidden md:flex items-center gap-1.5 whitespace-nowrap">
            <TrendingUp className="w-3.5 h-3.5 text-[#F4C430]" />
            <span className="font-bold text-white tabular-nums">412,800</span>
            <span className="text-[#DDE7D8] text-[11px]">{t.totalMoneySaved}</span>
          </div>
        </div>

      </div>
    </div>
  );
};
