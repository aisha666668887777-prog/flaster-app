import React from 'react';
import {
  X,
  Trash2,
  ShoppingCart,
  Clock,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { CartItem, Language } from '../types';
import { translations } from '../translations';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  lang: Language;
  onUpdateQuantity: (itemId: string, newQty: number) => void;
  onRemoveItem: (itemId: string) => void;
  onCheckout: () => void;
}

export const CartDrawer: React.FC<CartDrawerProps> = ({
  isOpen,
  onClose,
  cartItems,
  lang,
  onUpdateQuantity,
  onRemoveItem,
  onCheckout,
}) => {
  if (!isOpen) return null;

  const t = translations[lang];
  const isArabic = lang === 'ar';

  const subtotal = cartItems.reduce(
    (sum, ci) => sum + ci.item.discountedPrice * ci.quantity,
    0
  );
  const totalRegular = cartItems.reduce(
    (sum, ci) => sum + ci.item.originalPrice * ci.quantity,
    0
  );
  const totalSaved = totalRegular - subtotal;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-[#FFFDF9] h-full shadow-2xl flex flex-col justify-between border-s border-[#EAE4DC] animate-in slide-in-from-end duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drawer Header */}
        <div className="p-5 border-b border-[#EAE4DC] flex items-center justify-between bg-[#FAF7F2]">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-red-50 border border-red-200 text-[#ee5253] flex items-center justify-center font-bold">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-headline font-extrabold text-lg text-[#1C1917]">
                {t.cartTitle}
              </h3>
              <p className="text-xs text-[#78716C]">
                {cartItems.length} {isArabic ? 'أصناف مختارة' : 'selected items'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-[#EAE4DC] bg-[#FFFDF9] text-[#78716C] hover:text-[#1C1917] flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Drawer Items List */}
        <div className="flex-1 overflow-y-auto p-5 flex flex-col">
          {cartItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12 px-4 space-y-5">
              {/* Large Empty Shopping Cart Icon in Center with subtle cart background */}
              <div className="relative w-28 h-28 rounded-full bg-red-50/80 border border-red-100 mx-auto flex items-center justify-center text-[#DC2626] shadow-inner">
                <ShoppingCart className="w-14 h-14 stroke-[1.75]" />
              </div>

              <div className="space-y-2">
                <h4 className="font-headline font-extrabold text-xl text-[#0F172A]">
                  {t.cartEmpty}
                </h4>
                <p className="text-xs sm:text-sm text-[#64748B] max-w-xs mx-auto leading-relaxed">
                  {t.cartEmptySub}
                </p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full max-w-xs h-12 rounded-xl bg-gradient-to-r from-[#DC2626] to-amber-500 hover:from-[#B91C1C] hover:to-amber-600 text-white font-headline font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg shadow-red-600/20 active:scale-95 transition-all cursor-pointer mt-2"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>{t.shopNow}</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Commercial Smart Savings Banner */}
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 flex items-center justify-between text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#DC2626]" />
                  <span>{t.brandSubtitle}</span>
                </div>
                <span className="font-metric font-extrabold text-[#059669]">
                  {isArabic ? `وفّرت ${totalSaved} ${t.currency}` : `Saved ${totalSaved} ${t.currency}`}
                </span>
              </div>

              {/* Items */}
              <div className="space-y-3">
                {cartItems.map(({ item, quantity }) => {
                  const title = isArabic ? item.title.ar : item.title.en;
                  const merchantName = isArabic ? item.merchant.nameAr : item.merchant.name;

                  return (
                    <div
                      key={item.id}
                      className="p-3.5 rounded-xl border border-[#EAE4DC] bg-[#FFFDF9] hover:border-amber-300 transition-all flex gap-3 text-xs"
                    >
                      <img
                        src={item.imageUrl}
                        alt={title}
                        className="w-16 h-16 rounded-lg object-cover shrink-0"
                      />

                      <div className="flex-1 space-y-1">
                        <div className="flex items-start justify-between gap-1">
                          <div>
                            <h5 className="font-bold text-[#0F172A] line-clamp-1">{title}</h5>
                            <p className="text-[#64748B] text-[11px]">{merchantName}</p>
                          </div>
                          <button
                            onClick={() => onRemoveItem(item.id)}
                            className="text-[#94A3B8] hover:text-[#ee5253] p-1 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center gap-1 text-[11px] text-[#78350F] font-metric">
                          <Clock className="w-3 h-3 text-[#92400E]" />
                          <span>
                            {item.pickupStart} - {item.pickupEnd}
                          </span>
                        </div>

                        <div className="pt-1 flex items-center justify-between">
                          {/* Quantity +/- */}
                          <div className="flex items-center border border-[#CBD5E1] rounded bg-slate-50">
                            <button
                              onClick={() => onUpdateQuantity(item.id, quantity - 1)}
                              className="w-6 h-6 flex items-center justify-center font-bold text-[#64748B] cursor-pointer"
                            >
                              -
                            </button>
                            <span className="w-6 text-center font-bold text-[#0F172A] font-metric">
                              {quantity}
                            </span>
                            <button
                              onClick={() => onUpdateQuantity(item.id, quantity + 1)}
                              disabled={quantity >= item.stockRemaining}
                              className="w-6 h-6 flex items-center justify-center font-bold text-[#64748B] disabled:opacity-30 cursor-pointer"
                            >
                              +
                            </button>
                          </div>

                          {/* Price */}
                          <div className="text-end font-metric">
                            <span className="text-[10px] text-[#94A3B8] line-through block">
                              {item.originalPrice * quantity} {t.currency}
                            </span>
                            <span className="font-bold text-sm text-[#0F172A]">
                              {item.discountedPrice * quantity} {t.currency}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Order note */}
              <div className="p-3 bg-[#FAF7F2] rounded-xl border border-[#EAE4DC] text-[11px] text-[#78716C] space-y-1">
                <p className="font-semibold text-[#1C1917]">
                  ℹ️ {isArabic ? 'تأكيد الحجز الفوري' : 'Instant Order Confirmation'}
                </p>
                <p>{t.cartNotice}</p>
              </div>
            </div>
          )}
        </div>

        {/* Drawer Sticky Footer with Subtotal & Checkout */}
        {cartItems.length > 0 && (
          <div className="p-5 border-t border-[#EAE4DC] bg-[#FAF7F2] space-y-4">
            <div className="space-y-1.5 text-xs font-metric">
              <div className="flex items-center justify-between text-[#78716C]">
                <span>{isArabic ? 'السعر الأصلي للمطعم' : 'Original Price'}</span>
                <span className="line-through">
                  {totalRegular} {t.currency}
                </span>
              </div>
              <div className="flex items-center justify-between text-[#059669] font-semibold">
                <span>{t.totalSavings}</span>
                <span>
                  -{totalSaved} {t.currency}
                </span>
              </div>
              <div className="flex items-center justify-between text-[#1C1917] font-extrabold text-base pt-2 border-t border-[#EAE4DC]">
                <span>{isArabic ? 'إجمالي السلة' : 'Total'}</span>
                <span className="text-xl text-[#ee5253] font-headline">
                  {subtotal} {t.currency}
                </span>
              </div>
            </div>

            <button
              onClick={onCheckout}
              className="w-full h-12 rounded-xl bg-[#ee5253] hover:bg-[#d63f40] text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-red-600/25 active:scale-98 transition-all cursor-pointer"
            >
              <span>{t.checkout}</span>
              <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

