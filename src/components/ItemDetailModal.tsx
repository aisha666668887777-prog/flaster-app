import React, { useState } from 'react';
import {
  X,
  Clock,
  MapPin,
  Star,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  Plus,
  Minus,
  ShoppingCart,
  ArrowRight,
  Info,
  Heart,
  Coins,
} from 'lucide-react';
import { SurplusItem, Language } from '../types';
import { translations } from '../translations';

interface ItemDetailModalProps {
  item: SurplusItem | null;
  lang: Language;
  isFavorite: boolean;
  onToggleFavorite: (itemId: string) => void;
  onClose: () => void;
  onReserveNow: (item: SurplusItem, quantity: number) => void;
  onAddToCart: (item: SurplusItem, quantity: number) => void;
}

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  lang,
  isFavorite,
  onToggleFavorite,
  onClose,
  onReserveNow,
  onAddToCart,
}) => {
  const [quantity, setQuantity] = useState(1);

  if (!item) return null;

  const t = translations[lang];
  const isArabic = lang === 'ar';

  const title = isArabic ? item.title.ar : item.title.en;
  const description = isArabic ? item.description.ar : item.description.en;
  const contents = isArabic ? item.possibleContents.ar : item.possibleContents.en;
  const merchantName = isArabic ? item.merchant.nameAr : item.merchant.name;
  const address = isArabic ? item.merchant.addressAr : item.merchant.address;
  const neighborhood = isArabic ? item.merchant.neighborhoodAr : item.merchant.neighborhood;
  const pickupDay = item.pickupDate === 'today' ? t.today : t.tomorrow;

  const maxAllowed = Math.min(item.stockRemaining, 4);
  const totalDiscountedPrice = item.discountedPrice * quantity;
  const totalOriginalPrice = item.originalPrice * quantity;
  const totalSavings = totalOriginalPrice - totalDiscountedPrice;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-[#FFFDF9] rounded-2xl shadow-2xl overflow-hidden border border-[#EAE4DC] my-8 animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Floating Actions: Favorite & Close Button */}
        <div className="absolute top-4 end-4 z-20 flex items-center gap-2">
          <button
            onClick={() => onToggleFavorite(item.id)}
            className={`w-9 h-9 rounded-full backdrop-blur-md border border-[#EAE4DC] flex items-center justify-center shadow-md transition-transform active:scale-90 ${
              isFavorite
                ? 'bg-white text-[#ee5253]'
                : 'bg-white/90 text-stone-400 hover:text-[#ee5253]'
            }`}
            title={lang === 'ar' ? 'إضافة إلى المفضلة' : 'Save to Favorites'}
          >
            <Heart className={`w-4 h-4 ${isFavorite ? 'fill-[#ee5253] text-[#ee5253]' : ''}`} />
          </button>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/90 backdrop-blur-md border border-[#EAE4DC] text-[#1C1917] hover:bg-white flex items-center justify-center shadow-md transition-transform active:scale-90 cursor-pointer"
            aria-label={t.close}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Hero Image Section with Badges */}
        <div className="relative aspect-[16/9] w-full bg-amber-50 overflow-hidden">
          <img src={item.imageUrl} alt={title} className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

          {/* Inline-Start Discount Pill */}
          <div className="absolute top-4 start-4">
            <span className="inline-flex items-center px-3 py-1.5 rounded-full bg-[#ee5253] text-white font-metric font-extrabold text-sm shadow-lg">
              -{item.discountPercent}%
            </span>
          </div>

          {/* Quality & Halal Badges */}
          <div className="absolute bottom-4 start-4 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-stone-950 text-xs font-extrabold shadow-md">
              <Sparkles className="w-3.5 h-3.5 text-[#ee5253]" />
              {t.valueBox1Title}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-950/80 backdrop-blur-md text-emerald-300 text-xs font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              {t.halalCertified}
            </span>
          </div>
        </div>

        {/* Modal Content Body */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[60vh] overflow-y-auto">
          {/* Header Title & Merchant Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[#64748B]">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[#0F172A] text-sm">{merchantName}</span>
                {item.merchant.verified && (
                  <CheckCircle2 className="w-4 h-4 text-[#059669]" />
                )}
              </div>
              <div className="flex items-center gap-1 font-metric font-bold text-amber-600">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span>
                  {item.merchant.rating} ({item.merchant.reviewsCount})
                </span>
              </div>
            </div>

            <h2 className="font-headline font-extrabold text-2xl sm:text-3xl text-[#1C1917]">
              {title}
            </h2>

            {/* Pickup Tag Container */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FEF9EE] border border-amber-300 text-amber-950 text-xs font-metric font-semibold">
              <Clock className="w-4 h-4 text-amber-700" />
              <span>
                {t.pickupWindow}: {pickupDay} {item.pickupStart} - {item.pickupEnd}
              </span>
            </div>
          </div>

          {/* Culinary Description */}
          <div className="bg-[#FAF7F2] rounded-xl p-4 border border-[#EAE4DC]">
            <p className="text-sm text-[#44403C] leading-relaxed">{description}</p>
          </div>

          {/* Surplus Dish - What is included */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-[#ee5253]" />
              <h4 className="font-headline font-bold text-sm text-[#1C1917]">{t.whatInside}</h4>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {contents.map((itemStr, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-[#FAF7F2] border border-[#EAE4DC] text-[#44403C]"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ee5253] shrink-0" />
                  <span>{itemStr}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Allergens & Ingredients Notice */}
          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-300 text-amber-950 text-xs space-y-2">
            {item.allergens && item.allergens.length > 0 && (
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">{t.allergensTitle}: </span>
                  <span>{item.allergens.join(', ')}</span>
                </div>
              </div>
            )}
            {item.ingredients && (
              <div className="flex items-start gap-2 pt-1.5 border-t border-amber-200/70 text-[11px] text-amber-950">
                <Info className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">
                    {isArabic ? 'المكونات الأساسية: ' : 'Key Ingredients: '}
                  </span>
                  <span>
                    {typeof item.ingredients === 'string'
                      ? item.ingredients
                      : isArabic
                        ? item.ingredients.ar
                        : item.ingredients.en}
                  </span>
                </div>
              </div>
            )}
            {item.expiryTime && (
              <div className="flex items-center justify-between pt-1.5 border-t border-amber-200/70 text-[11px] font-metric text-emerald-900">
                <span className="font-bold">
                  {isArabic ? 'صالح للاستهلاك حتى (Best Before):' : 'Best Before / Expiry:'}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                  {new Date(item.expiryTime).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  ({pickupDay})
                </span>
              </div>
            )}
          </div>

          {/* 3 Commercial Value Boxes inside Offer Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#EAE4DC] space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-red-50 text-[#ee5253] border border-red-200 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <h5 className="font-headline font-bold text-[#1C1917]">
                {t.valueBox1Title}
              </h5>
              <p className="text-[11px] text-[#78716C] leading-relaxed">
                {t.valueBox1Desc}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#EAE4DC] space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#059669] border border-emerald-200 flex items-center justify-center">
                <Coins className="w-4 h-4" />
              </div>
              <h5 className="font-headline font-bold text-[#1C1917]">
                {t.valueBox2Title}
              </h5>
              <p className="text-[11px] text-[#78716C] leading-relaxed">
                {t.valueBox2Desc}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#EAE4DC] space-y-1.5">
              <div className="w-8 h-8 rounded-lg bg-amber-100/80 text-amber-800 border border-amber-300 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <h5 className="font-headline font-bold text-[#1C1917]">
                {t.valueBox3Title}
              </h5>
              <p className="text-[11px] text-[#78716C] leading-relaxed">
                {t.valueBox3Desc}
              </p>
            </div>
          </div>

          {/* Location Card */}
          <div className="p-4 rounded-xl border border-[#EAE4DC] space-y-2 text-xs bg-[#FFFDF9]">
            <div className="flex items-start gap-2 text-[#1C1917]">
              <MapPin className="w-4 h-4 text-[#ee5253] shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {merchantName} ({neighborhood})
                </p>
                <p className="text-[#78716C] text-[11px] mt-0.5">{address}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Sticky Bottom Action Footer */}
        <div className="p-4 sm:p-6 bg-[#FAF7F2] border-t border-[#EAE4DC] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Price & Quantity Selector */}
          <div className="flex items-center justify-between sm:justify-start gap-5">
            <div className="flex items-center border border-[#EAE4DC] rounded-xl bg-[#FFFDF9] p-1">
              <button
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                className="w-8 h-8 flex items-center justify-center text-[#78716C] hover:text-[#1C1917] disabled:opacity-30 cursor-pointer"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-8 text-center font-metric font-bold text-sm text-[#1C1917]">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(Math.min(maxAllowed, quantity + 1))}
                disabled={quantity >= maxAllowed}
                className="w-8 h-8 flex items-center justify-center text-[#78716C] hover:text-[#1C1917] disabled:opacity-30 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col">
              <span className="text-xs text-[#A8A29E] line-through font-metric">
                {totalOriginalPrice} {t.currency}
              </span>
              <div className="flex items-baseline gap-1">
                <span className="font-headline font-extrabold text-2xl text-[#1C1917]">
                  {totalDiscountedPrice}
                </span>
                <span className="font-metric text-xs font-bold text-[#ee5253]">
                  {t.currency}
                </span>
                <span className="text-[11px] text-[#059669] font-semibold ms-1">
                  ({t.totalSavings}: {totalSavings} {t.currency})
                </span>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => onAddToCart(item, quantity)}
              className="flex-1 sm:flex-initial h-12 px-4 rounded-xl bg-[#ee5253] hover:bg-[#d63f40] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-red-600/20 transition-all cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>{t.quickAdd}</span>
            </button>

            <button
              onClick={() => onReserveNow(item, quantity)}
              className="flex-1 sm:flex-initial h-12 px-5 rounded-xl bg-amber-400 hover:bg-amber-500 text-stone-950 text-xs font-extrabold flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <span>{t.reserveNow}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

