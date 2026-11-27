import React, { useState, useEffect } from 'react';
import { Clock, Flame, ArrowRight } from 'lucide-react';
import { SurplusItem, Language } from '../types';
import { translations } from '../translations';
import { getCustomerItemPriceAed } from '../config/platformConfig';

interface SunsetUrgencyBannerProps {
  items: SurplusItem[];
  lang: Language;
  onSelectItem: (item: SurplusItem) => void;
}

export const SunsetUrgencyBanner: React.FC<SunsetUrgencyBannerProps> = ({
  items,
  lang,
  onSelectItem,
}) => {
  const t = translations[lang];
  const isArabic = lang === 'ar';

  // Real-time animated countdown clock (1h 48m 22s)
  const [secondsLeft, setSecondsLeft] = useState(6522);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 7200));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;

  const urgentItems = items.filter((item) => item.stockRemaining <= 2).slice(0, 3);

  if (urgentItems.length === 0) return null;

  return (
    <section className="bg-gradient-to-br from-[#9E1B28] to-[#78121D] border border-[#78121D] rounded-2xl p-5 sm:p-7 text-white shadow-lg relative overflow-hidden">
      {/* Subtle warm golden glow */}
      <div className="absolute -end-10 -bottom-10 w-64 h-64 bg-[#F4C430]/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        {/* Left Headline & Live Ticking Countdown */}
        <div className="space-y-2.5 max-w-md">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#F4C430] text-[#2D2200] text-xs font-extrabold shadow-xs">
            <Flame className="w-4 h-4 fill-[#9E1B28] text-[#9E1B28]" />
            <span>{t.urgentExpiringTitle}</span>
          </div>

          <h2 className="font-headline font-extrabold text-2xl sm:text-3xl tracking-tight text-white leading-tight drop-shadow-xs">
            {t.brandSubtitle}
          </h2>

          <p className="text-xs sm:text-sm text-[#FEF3C7] font-medium">
            {t.urgentExpiringSubtitle}
          </p>

          {/* Live Urgency Countdown */}
          <div className="inline-flex items-center gap-2 pt-1 font-metric">
            <Clock className="w-4 h-4 text-[#F4C430]" />
            <span className="text-xs text-[#FEF3C7] font-bold">
              {lang === 'ar' ? 'ينتهي العرض في:' : 'Ends in:'}
            </span>
            <div className="flex items-center gap-1 text-sm font-extrabold text-[#2D2200] bg-[#F4C430] border border-[#E5B520] px-2.5 py-1 rounded-md shadow-xs tabular-nums">
              <span>{String(hours).padStart(2, '0')}</span>:
              <span>{String(minutes).padStart(2, '0')}</span>:
              <span>{String(seconds).padStart(2, '0')}</span>
            </div>
          </div>
        </div>

        {/* Right Carousel of Mini Urgency Cards */}
        <div className="w-full md:w-auto flex-1 max-w-xl">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-3">
            {urgentItems.map((item) => {
              const title = isArabic ? item.title.ar : item.title.en;
              const merchant = isArabic ? item.merchant.nameAr : item.merchant.name;

              return (
                <div
                  key={item.id}
                  onClick={() => onSelectItem(item)}
                  className="bg-[#FFFDF9] hover:bg-white border border-[#F4C430]/60 rounded-xl p-3 flex gap-3 cursor-pointer transition-all hover:scale-[1.02] text-xs text-[#1C1917] group shadow-md"
                >
                  <img
                    src={item.imageUrl}
                    alt={title}
                    className="w-16 h-16 rounded-lg object-cover shrink-0 border border-[#E8E3D8]"
                  />
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-center justify-between gap-1">
                        <span className="px-1.5 py-0.5 rounded bg-[#9E1B28] text-white text-[10px] font-metric font-extrabold shadow-xs">
                          -{item.discountPercent}%
                        </span>
                        <span className="text-[#4F6345] bg-[#EFF4EC] px-1.5 py-0.5 rounded font-metric font-bold text-[10px] border border-[#6E8462]/30">
                          {item.stockRemaining} {t.left}
                        </span>
                      </div>
                      <h4 className="font-headline font-bold text-xs text-[#1C1917] line-clamp-1 mt-1 group-hover:text-[#9E1B28]">
                        {title}
                      </h4>
                      <p className="text-[#78716C] text-[10px] truncate">{merchant}</p>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="font-metric font-extrabold text-sm text-[#9E1B28] tabular-nums">
                        {getCustomerItemPriceAed(item.discountedPrice).toFixed(2)} {t.currency}
                      </span>
                      <span className="text-[10px] text-[#2D2200] bg-[#F4C430] px-2.5 py-0.5 rounded-lg font-extrabold flex items-center gap-0.5 group-hover:bg-[#E5B520]">
                        <span>{lang === 'ar' ? 'احجز الآن' : 'Order'}</span>
                        <ArrowRight className="w-3 h-3 rtl:rotate-180" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
