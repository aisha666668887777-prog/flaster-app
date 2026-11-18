import React from 'react';
import { Clock, CheckCircle2, Star, ShoppingCart, MapPin, Heart } from 'lucide-react';
import { SurplusItem, Language } from '../types';
import { translations } from '../translations';

interface SurplusCardProps {
  item: SurplusItem;
  lang: Language;
  isFavorite: boolean;
  onToggleFavorite: (itemId: string) => void;
  onSelect: (item: SurplusItem) => void;
  onQuickAdd: (item: SurplusItem) => void;
}

export const SurplusCard: React.FC<SurplusCardProps> = ({
  item,
  lang,
  isFavorite,
  onToggleFavorite,
  onSelect,
  onQuickAdd,
}) => {
  const t = translations[lang];
  const isArabic = lang === 'ar';

  const title = isArabic ? item.title.ar : item.title.en;
  const merchantName = isArabic ? item.merchant.nameAr : item.merchant.name;
  const neighborhood = isArabic ? item.merchant.neighborhoodAr : item.merchant.neighborhood;
  const pickupDay = item.pickupDate === 'today' ? t.today : t.tomorrow;

  const isLowStock = item.stockRemaining <= 2;
  const savedAmount = Math.max(0, item.originalPrice - item.discountedPrice);

  return (
    <article
      onClick={() => onSelect(item)}
      className="group bg-[#FFFDF9] rounded-2xl border border-[#EAE4DC] hover:border-amber-400 shadow-xs hover:shadow-lg hover:shadow-amber-950/5 transition-all duration-300 overflow-hidden flex flex-col cursor-pointer relative"
    >
      {/* 16:9 Image Container with Pinned Badges */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-stone-100">
        <img
          src={item.imageUrl}
          alt={title}
          loading="lazy"
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20" />

        {/* Pinned Discount Badge (#ee5253) */}
        <div className="absolute top-3 start-3">
          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full bg-[#ee5253] text-white font-metric font-extrabold text-xs tracking-tight shadow-md shadow-red-600/25">
            -{item.discountPercent}%
          </span>
        </div>

        {/* Pinned Stock Ticker & Favorite Button (Inline-End) */}
        <div className="absolute top-3 end-3 flex items-center gap-1.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(item.id);
            }}
            className={`w-7 h-7 rounded-full backdrop-blur-md flex items-center justify-center transition-all ${
              isFavorite
                ? 'bg-white text-[#ee5253] shadow-md scale-105'
                : 'bg-black/50 text-white hover:text-red-400 hover:bg-black/70'
            }`}
            title={lang === 'ar' ? 'حفظ في المفضلة' : 'Save to Favorites'}
          >
            <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-[#ee5253] text-[#ee5253]' : ''}`} />
          </button>

          {item.stockRemaining > 0 ? (
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-metric font-bold shadow-md ${
                isLowStock
                  ? 'bg-amber-300 text-stone-950 border border-amber-400'
                  : 'bg-black/65 backdrop-blur-sm text-white'
              }`}
            >
              {isLowStock
                ? t.onlyLeft.replace('{count}', item.stockRemaining.toString())
                : `${item.stockRemaining} ${t.left}`}
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-stone-800 text-stone-300 text-xs font-semibold">
              {t.soldOut}
            </span>
          )}
        </div>

        {/* Commercial Savings Floating Badge at Bottom-Inline-Start of image */}
        <div className="absolute bottom-2.5 start-3">
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-gradient-to-r from-[#059669] to-emerald-600 text-white text-[11px] font-metric font-extrabold shadow-sm border border-emerald-400/50">
            ✨ {lang === 'ar'
              ? `وفّر ${savedAmount} ${t.currency}`
              : lang === 'ur'
                ? `بچت ${savedAmount} ${t.currency}`
                : lang === 'hi'
                  ? `बचत ${savedAmount} ${t.currency}`
                  : lang === 'tl'
                    ? `Tipid ${savedAmount} ${t.currency}`
                    : `Save ${savedAmount} ${t.currency}`}
          </span>
        </div>
      </div>

      {/* Card Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-3 bg-[#FFFDF9]">
        {/* Merchant & Distance Meta */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-[#78716C]">
            <div className="flex items-center gap-1.5 font-medium truncate">
              <span className="truncate text-[#1C1917] font-semibold">{merchantName}</span>
              {item.merchant.verified && (
                <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] shrink-0" />
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0 text-amber-600 font-metric font-bold">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>{item.merchant.rating}</span>
            </div>
          </div>

          <div className="flex items-center gap-1 text-[11px] text-[#78716C]">
            <MapPin className="w-3 h-3 text-[#DC2626] shrink-0" />
            <span className="truncate">{neighborhood}</span>
            <span>•</span>
            <span className="font-metric">{item.merchant.distanceKm} km</span>
          </div>

          {/* Item Title */}
          <h3 className="font-headline font-bold text-base sm:text-lg text-[#1C1917] line-clamp-1 group-hover:text-[#DC2626] transition-colors pt-1">
            {title}
          </h3>
        </div>

        {/* Contained Pickup Window Tag with Clock Glyph */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#FEF9EE] border border-amber-300 text-amber-950 text-xs font-metric font-semibold">
          <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span>
            {pickupDay} {item.pickupStart} - {item.pickupEnd}
          </span>
        </div>

        {/* Pricing & CTA Row */}
        <div className="pt-2 border-t border-[#F5EFEB] flex items-center justify-between gap-3">
          {/* Price cluster */}
          <div className="flex flex-col">
            <span className="text-[11px] text-[#A8A29E] line-through font-metric">
              {item.originalPrice} {t.currency}
            </span>
            <div className="flex items-baseline gap-1">
              <span className="font-headline font-black text-xl text-[#059669]">
                {item.discountedPrice}
              </span>
              <span className="font-metric text-xs font-bold text-[#DC2626]">
                {t.currency}
              </span>
            </div>
          </div>

          {/* Action Button in Solid Crimson Red labeled «أضف إلى السلة» */}
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickAdd(item);
              }}
              disabled={item.stockRemaining <= 0}
              className="h-10 px-4 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] disabled:bg-stone-200 disabled:text-stone-400 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>{t.quickAdd}</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
};

