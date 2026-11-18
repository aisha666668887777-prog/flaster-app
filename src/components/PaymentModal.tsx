import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  ShieldCheck,
  Truck,
  Store,
  Lock,
  Sparkles,
  MapPin,
  Phone,
  User,
  ArrowRight,
  Coins,
  AlertCircle,
} from 'lucide-react';
import {
  SurplusItem,
  Language,
  FulfillmentType,
  UserAddress,
  CustomerProfile,
  Order,
} from '../types';
import { translations } from '../translations';
import { aedToFils, filsToAed, calculateIncludedVatFils } from '../config/platformConfig';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  itemsToBuy: { item: SurplusItem; quantity: number }[];
  lang: Language;
  customerPointsBalance?: number;
  savedAddresses?: UserAddress[];
  customerProfile?: CustomerProfile | null;
  onPaymentSuccess: (details: {
    fulfillmentType: FulfillmentType;
    customerName: string;
    customerPhone: string;
    deliveryAddress?: string;
    paymentMethod: 'apple_pay' | 'credit_card' | 'pickup_cash';
    pointsRedeemed?: number;
    pointsDiscountAed?: number;
    paymentTransactionId?: string;
    paymentStatus?: Order['paymentStatus'];
    paymentGateway?: string;
  }) => void;
}

interface GatewayStatusInfo {
  provider: string;
  activeGateway: 'ziina' | 'stripe' | 'sandbox';
  hasLiveGateway: boolean;
  hasZiina: boolean;
  hasStripe: boolean;
  isLive: boolean;
  mode: 'live' | 'test' | 'sandbox';
}

function isValidLuhn(rawDigits: string): boolean {
  const digits = rawDigits.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let digit = Number(digits[i]);
    if (shouldDouble) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function isValidExpiry(mmYy: string): boolean {
  const match = mmYy.trim().match(/^(\d{2})\/(\d{2})$/);
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return year > currentYear || (year === currentYear && month >= currentMonth);
}

function formatCardNumberInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 16);
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ');
}

function formatExpiryInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length >= 3) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }
  return digits;
}

function detectCardBrand(raw: string): 'Visa' | 'Mastercard' | 'Amex' | 'Card' {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('4')) return 'Visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  return 'Card';
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  isOpen,
  onClose,
  itemsToBuy,
  lang,
  customerPointsBalance = 0,
  savedAddresses = [],
  customerProfile,
  onPaymentSuccess,
}) => {
  const t = translations[lang];
  const isArabic = lang === 'ar';

  const defaultAddr = savedAddresses.find((a) => a.isDefault) || savedAddresses[0];

  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>('pickup');
  const [paymentMethod, setPaymentMethod] = useState<'apple_pay' | 'credit_card' | 'pickup_cash'>('apple_pay');

  const [customerName, setCustomerName] = useState(
    customerProfile?.name || (isArabic ? 'عميل فلاستر' : 'Flaster Customer')
  );
  const [customerPhone, setCustomerPhone] = useState(customerProfile?.phone || '+971 50 000 0000');
  const [deliveryAddress, setDeliveryAddress] = useState(
    defaultAddr ? `${defaultAddr.buildingOrVilla}, ${defaultAddr.street}, ${defaultAddr.city}` : ''
  );

  // Card inputs (cleaned on open; validated via Luhn + future expiry + CVV)
  const [cardholderName, setCardholderName] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');

  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [gatewayStatus, setGatewayStatus] = useState<GatewayStatusInfo | null>(null);
  const [applyPoints, setApplyPoints] = useState<boolean>(false);
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);

  // Sync profile fields and fetch live payment gateway status whenever modal opens
  useEffect(() => {
    if (!isOpen) return;
    setPaymentError(null);
    if (customerProfile?.name) setCustomerName(customerProfile.name);
    if (customerProfile?.phone) setCustomerPhone(customerProfile.phone);

    fetch('/api/payments/gateway-status')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.gateway) {
          setGatewayStatus(data.gateway as GatewayStatusInfo);
        }
      })
      .catch((err) => {
        console.warn('[PaymentModal] Gateway status check failed:', err instanceof Error ? err.message : err);
      });
  }, [isOpen, customerProfile?.name, customerProfile?.phone]);

  // Financial Calculations in integer fils (1 AED = 100 fils)
  const subtotalFils = itemsToBuy.reduce(
    (sum, ci) => sum + aedToFils(ci.item.discountedPrice) * ci.quantity,
    0
  );
  const subtotal = filsToAed(subtotalFils);
  // Direct restaurant self-delivery: 0 AED platform delivery fee
  const deliveryFeeFils = 0;

  const maxPossiblePoints = Math.min(customerPointsBalance, 5000, subtotalFils);
  useEffect(() => {
    if (maxPossiblePoints >= 100 && pointsToRedeem === 0) {
      setPointsToRedeem(Math.min(maxPossiblePoints, 100));
    } else if (maxPossiblePoints < 100) {
      setPointsToRedeem(0);
      setApplyPoints(false);
    }
  }, [maxPossiblePoints, pointsToRedeem]);

  if (!isOpen || itemsToBuy.length === 0) return null;

  const pointsDiscountFils = applyPoints && pointsToRedeem >= 100 ? Math.round(pointsToRedeem) : 0;
  const pointsDiscountAed = filsToAed(pointsDiscountFils);
  const grandTotalFils = Math.max(0, subtotalFils + deliveryFeeFils - pointsDiscountFils);
  const grandTotal = filsToAed(grandTotalFils);
  const includedVatFils = calculateIncludedVatFils(grandTotalFils);
  const includedVatAed = filsToAed(includedVatFils);

  const hasLiveGateway = Boolean(gatewayStatus?.hasLiveGateway);
  const cardDigits = cardNumber.replace(/\D/g, '');
  const detectedBrand = detectCardBrand(cardNumber);

  const playSuccessChime = () => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        const ctx = new AudioContextClass();
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.12);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch {
      // Ignore AudioContext restriction
    }
  };

  const handleExecutePayment = async () => {
    setPaymentError(null);

    if (!customerName.trim()) {
      setPaymentError(isArabic ? 'يرجى إدخال اسم المستلم' : 'Please enter customer name');
      return;
    }

    if (customerPhone.replace(/\D/g, '').length < 7) {
      setPaymentError(isArabic ? 'يرجى إدخال رقم هاتف إماراتي صحيح' : 'Please enter a valid phone number');
      return;
    }

    if (fulfillmentType === 'delivery' && deliveryAddress.trim().length < 5) {
      setPaymentError(
        isArabic
          ? 'يرجى كتابة عنوان التوصيل ليتمكن المطعم من إيصال الطلب إليك'
          : 'Please enter a delivery address for the restaurant driver'
      );
      return;
    }

    // 1. Cash on Pickup / Direct Delivery
    if (paymentMethod === 'pickup_cash') {
      setIsProcessing(true);
      playSuccessChime();
      onPaymentSuccess({
        fulfillmentType,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: fulfillmentType === 'delivery' ? deliveryAddress.trim() : undefined,
        paymentMethod: 'pickup_cash',
        pointsRedeemed: applyPoints ? pointsToRedeem : 0,
        pointsDiscountAed: applyPoints ? pointsDiscountAed : 0,
        paymentStatus: 'pending_cash',
        paymentGateway: 'Cash Counter Ledger',
      });
      setIsProcessing(false);
      return;
    }

    // 2. If 100% covered by points (0.00 AED remaining)
    if (grandTotalFils === 0) {
      setIsProcessing(true);
      playSuccessChime();
      onPaymentSuccess({
        fulfillmentType,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: fulfillmentType === 'delivery' ? deliveryAddress.trim() : undefined,
        paymentMethod,
        pointsRedeemed: applyPoints ? pointsToRedeem : 0,
        pointsDiscountAed: applyPoints ? pointsDiscountAed : 0,
        paymentTransactionId: `PTS-${Date.now()}`,
        paymentStatus: 'paid',
        paymentGateway: 'Flaster Loyalty Points',
      });
      setIsProcessing(false);
      return;
    }

    // 3. Enforce 2.00 AED minimum gateway charge
    if (grandTotalFils < 200) {
      setPaymentError(
        isArabic
          ? 'الحد الأدنى للدفع الإلكتروني هو 2.00 د.إ. يرجى تقليل النقاط المستبدلة أو اختيار الدفع نقداً.'
          : 'Minimum online card/Apple Pay amount is 2.00 AED. Reduce redeemed points or choose Cash.'
      );
      return;
    }

    // 4. Validate card inputs when paying by Credit/Debit Card in Sandbox mode
    if (paymentMethod === 'credit_card' && !hasLiveGateway) {
      if (cardholderName.trim().length < 2) {
        setPaymentError(isArabic ? 'يرجى إدخال اسم حامل البطاقة' : 'Please enter the cardholder name');
        return;
      }
      if (!isValidLuhn(cardDigits)) {
        setPaymentError(
          isArabic
            ? 'رقم البطاقة غير صحيح (تحقق من الأرقام الـ 16)'
            : 'Invalid card number (failed Luhn check)'
        );
        return;
      }
      if (!isValidExpiry(cardExpiry)) {
        setPaymentError(
          isArabic
            ? 'تاريخ انتهاء البطاقة غير صالح أو منتهي الصلاحية (MM/YY)'
            : 'Invalid or expired card expiry date (MM/YY)'
        );
        return;
      }
      if (!/^\d{3,4}$/.test(cardCvv.trim())) {
        setPaymentError(
          isArabic
            ? 'رمز الأمان CVV يجب أن يكون 3 أو 4 أرقام'
            : 'CVV must be 3 or 4 digits'
        );
        return;
      }
    }

    // 5. Create real payment intent on backend (Ziina API v2 / Stripe Checkout / Sandbox)
    setIsProcessing(true);
    try {
      const summaryLabel = itemsToBuy
        .map((ci) => `${ci.quantity}x ${isArabic ? ci.item.title.ar : ci.item.title.en}`)
        .join(', ');

      const intentRes = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountFils: grandTotalFils,
          paymentMethod,
          message: `Flaster Order: ${summaryLabel}`.slice(0, 200),
          originUrl: window.location.origin,
          customerEmail: customerProfile?.email,
        }),
      });

      const intentData = await intentRes.json();
      if (!intentRes.ok || !intentData.success) {
        throw new Error(
          intentData.error ||
            (isArabic ? 'تعذر إنشاء جلسة الدفع الإلكتروني' : 'Failed to create payment session')
        );
      }

      // Live Mode (Ziina UAE or Stripe Checkout): Save pending checkout & redirect to hosted gateway
      if (
        (intentData.provider === 'ziina' || intentData.provider === 'stripe') &&
        intentData.redirectUrl
      ) {
        try {
          sessionStorage.setItem(
            'flaster_pending_checkout',
            JSON.stringify({
              itemsToBuy,
              fulfillmentType,
              customerName: customerName.trim(),
              customerPhone: customerPhone.trim(),
              deliveryAddress: fulfillmentType === 'delivery' ? deliveryAddress.trim() : undefined,
              paymentMethod,
              pointsRedeemed: applyPoints ? pointsToRedeem : 0,
              pointsDiscountAed: applyPoints ? pointsDiscountAed : 0,
              intentId: intentData.intentId,
              provider: intentData.provider,
              createdAt: Date.now(),
            })
          );
        } catch {
          // Proceed even if sessionStorage is restricted
        }

        window.location.href = intentData.redirectUrl;
        return;
      }

      // Sandbox Mode (when live API tokens are not yet added to environment Secrets)
      const sandboxRes = await fetch('/api/payments/sandbox-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intentId: intentData.intentId,
          amountFils: grandTotalFils,
          paymentMethod,
          cardLast4: cardDigits.slice(-4) || undefined,
        }),
      });

      const sandboxData = await sandboxRes.json();
      if (!sandboxRes.ok || !sandboxData.success) {
        throw new Error(
          sandboxData.error ||
            (isArabic ? 'فشل تأكيد المعاملة في وضع الاختبار' : 'Sandbox confirmation failed')
        );
      }

      playSuccessChime();
      onPaymentSuccess({
        fulfillmentType,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        deliveryAddress: fulfillmentType === 'delivery' ? deliveryAddress.trim() : undefined,
        paymentMethod,
        pointsRedeemed: applyPoints ? pointsToRedeem : 0,
        pointsDiscountAed: applyPoints ? pointsDiscountAed : 0,
        paymentTransactionId: sandboxData.transactionId || intentData.intentId,
        paymentStatus: 'sandbox_paid',
        paymentGateway: 'Sandbox Test',
      });
    } catch (err: unknown) {
      setPaymentError(
        err instanceof Error
          ? err.message
          : isArabic
            ? 'حدث خطأ أثناء معالجة الدفع'
            : 'Payment processing error'
      );
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-[#FFFDF9] rounded-2xl shadow-2xl border border-[#EAE4DC] overflow-hidden max-h-[92vh] flex flex-col animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-5 border-b border-[#EAE4DC] bg-[#FAF7F2] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-100 to-orange-100 text-orange-600 flex items-center justify-center font-bold shadow-xs">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-base text-[#1C1917]">
                {t.paymentSheetTitle}
              </h3>
              <p className="text-xs text-[#78716C]">
                {itemsToBuy.length}{' '}
                {isArabic ? 'وجبات فائض مختارة • خصم مباشر' : 'selected rescue packages'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {gatewayStatus && (
              <span
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                  hasLiveGateway
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}
              >
                {hasLiveGateway
                  ? `${gatewayStatus?.mode === 'test' ? 'TEST' : 'LIVE'} • ${gatewayStatus?.provider}`
                  : isArabic
                    ? 'اختبار Sandbox'
                    : 'Sandbox Test'}
              </span>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full border border-[#EAE4DC] flex items-center justify-center text-[#78716C] hover:text-[#1C1917] bg-[#FFFDF9] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body Scroll Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* Inline Error Alert */}
          {paymentError && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-300 text-red-900 font-bold flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0 mt-0.5" />
              <span>{paymentError}</span>
            </div>
          )}

          {/* Order Summary Chips */}
          <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#EAE4DC] space-y-2">
            <span className="text-[11px] font-bold text-[#78716C] uppercase tracking-wider block">
              {isArabic ? 'ملخص الأصناف المحجوزة:' : 'Reserved Items:'}
            </span>
            <div className="space-y-1.5">
              {itemsToBuy.map(({ item, quantity }) => (
                <div key={item.id} className="flex items-center justify-between font-medium">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-5 h-5 rounded bg-white border border-amber-200 text-center font-metric font-bold text-[11px] leading-5 text-orange-600">
                      {quantity}x
                    </span>
                    <span className="text-[#1C1917] truncate">
                      {isArabic ? item.title.ar : item.title.en}
                    </span>
                  </div>
                  <span className="font-metric font-bold text-[#0F172A] shrink-0">
                    {item.discountedPrice * quantity} {t.currency}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Fulfillment Type Toggle (Self-Pickup vs Direct Restaurant Delivery) */}
          <div className="space-y-2">
            <label className="block font-bold text-[#0F172A] text-xs">
              {t.fulfillmentMethod}:
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFulfillmentType('pickup')}
                className={`p-3.5 rounded-xl border text-start transition-all flex flex-col gap-1.5 cursor-pointer ${
                  fulfillmentType === 'pickup'
                    ? 'border-[#059669] bg-emerald-50/70 text-emerald-950 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-[#64748B]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Store
                    className={`w-4 h-4 ${
                      fulfillmentType === 'pickup' ? 'text-[#059669]' : 'text-slate-400'
                    }`}
                  />
                  <span className="font-metric font-bold text-[11px] text-[#059669] bg-emerald-100 px-2 py-0.5 rounded-full">
                    {isArabic ? 'مجاناً' : 'Free'}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-xs text-[#0F172A]">
                    {isArabic ? 'استلام ذاتي من المحل' : 'Self-Pickup'}
                  </p>
                  <p className="text-[10px] text-[#64748B] mt-0.5">
                    {isArabic ? 'استلم من الكاونتر مع كود QR' : 'Collect directly at counter'}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFulfillmentType('delivery')}
                className={`p-3.5 rounded-xl border text-start transition-all flex flex-col gap-1.5 cursor-pointer ${
                  fulfillmentType === 'delivery'
                    ? 'border-orange-500 bg-orange-50/70 text-stone-900 ring-2 ring-orange-500/20'
                    : 'border-[#EAE4DC] bg-[#FFFDF9] hover:bg-amber-50/50 text-[#78716C]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <Truck
                    className={`w-4 h-4 ${
                      fulfillmentType === 'delivery' ? 'text-orange-600' : 'text-stone-400'
                    }`}
                  />
                  <span className="font-metric font-bold text-[11px] text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                    0 {t.currency}
                  </span>
                </div>
                <div>
                  <p className="font-bold text-xs text-[#1C1917]">{t.expressDelivery}</p>
                  <p className="text-[10px] text-[#78716C] mt-0.5">
                    {isArabic
                      ? 'يوصلها المطعم بنفسه (0 د.إ رسوم منصة)'
                      : 'Delivered directly by restaurant (0 AED platform fee)'}
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Flaster Loyalty Points Redemption (100% Platform Funded) */}
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-300/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-200 text-amber-900 flex items-center justify-center font-bold">
                  <Coins className="w-4 h-4 text-amber-700" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-[#1C1917]">
                    {isArabic ? 'استبدال نقاط مكافآت فلاستر' : 'Redeem Flaster Reward Points'}
                  </h4>
                  <p className="text-[10px] text-amber-900">
                    {isArabic
                      ? `رصيدك: ${customerPointsBalance} نقطة (≈ ${(customerPointsBalance / 100).toFixed(2)} درهم)`
                      : `Your balance: ${customerPointsBalance} pts (≈ ${(customerPointsBalance / 100).toFixed(2)} AED)`}
                  </p>
                </div>
              </div>

              {customerPointsBalance >= 100 ? (
                <button
                  type="button"
                  onClick={() => setApplyPoints(!applyPoints)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                    applyPoints
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-[#FFFDF9] border border-amber-300 text-amber-950 hover:bg-amber-100'
                  }`}
                >
                  {applyPoints
                    ? isArabic
                      ? 'مُفعّل ✓'
                      : 'Applied ✓'
                    : isArabic
                      ? 'تطبيق الخصم'
                      : 'Apply'}
                </button>
              ) : (
                <span className="text-[10px] font-semibold text-stone-500 bg-stone-200 px-2 py-0.5 rounded-full">
                  {isArabic ? 'الحد الأدنى 100 نقطة' : 'Min 100 pts'}
                </span>
              )}
            </div>

            {applyPoints && customerPointsBalance >= 100 && (
              <div className="pt-2 border-t border-amber-200/80 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-stone-700 font-medium">
                    {isArabic ? 'النقاط المراد استبدالها:' : 'Points to redeem:'}
                  </span>
                  <span className="font-metric font-extrabold text-orange-600">
                    {pointsToRedeem} {isArabic ? 'نقطة' : 'pts'} = -{pointsDiscountAed} {t.currency}
                  </span>
                </div>

                <input
                  type="range"
                  min={100}
                  max={Math.max(100, maxPossiblePoints)}
                  step={50}
                  value={pointsToRedeem}
                  onChange={(e) => setPointsToRedeem(Number(e.target.value))}
                  className="w-full accent-amber-600 cursor-pointer"
                />

                <div className="flex items-center justify-between text-[10px] text-slate-500 font-metric">
                  <span>100 {isArabic ? 'نقطة (1 درهم)' : 'pts (1 AED)'}</span>
                  <span>
                    {maxPossiblePoints} {isArabic ? 'نقطة (الحد الأقصى)' : 'pts (Max)'}
                  </span>
                </div>

                <div className="text-[10px] text-emerald-800 bg-emerald-100/80 px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                  <span>
                    {isArabic
                      ? 'خصم ممول بالكامل 100% من فلاستر Flaster دون أي استقطاع من أرباح المتجر.'
                      : '100% Platform funded by Flaster. Zero deduction from store earnings.'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Customer Details Form */}
          <div className="space-y-3 bg-white p-3.5 rounded-xl border border-slate-200">
            <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider block">
              {isArabic ? 'بيانات المستلم والإشعار الفوري:' : 'Customer & Instant Notification Details:'}
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[#0F172A] mb-1">
                  {isArabic ? 'اسم المستلم' : 'Full Name'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full h-10 ps-8 pe-3 bg-white border border-[#CBD5E1] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-[#DC2626]"
                  />
                  <User className="w-3.5 h-3.5 text-slate-400 absolute start-2.5 top-3.5" />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[#0F172A] mb-1">
                  {t.customerPhoneLabel}
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full h-10 ps-8 pe-3 bg-white border border-[#CBD5E1] rounded-lg text-xs font-metric text-[#0F172A] focus:outline-none focus:border-[#DC2626]"
                  />
                  <Phone className="w-3.5 h-3.5 text-slate-400 absolute start-2.5 top-3.5" />
                </div>
              </div>
            </div>

            {fulfillmentType === 'delivery' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-[11px] font-semibold text-[#0F172A]">
                    {t.deliveryAddressLabel}
                  </label>
                  {savedAddresses.length > 0 && (
                    <span className="text-[10px] text-[#64748B]">
                      {isArabic ? 'أو اختر من عناويني المحفوظة' : 'Or select saved'}
                    </span>
                  )}
                </div>

                {savedAddresses.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pb-1">
                    {savedAddresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        onClick={() =>
                          setDeliveryAddress(`${addr.buildingOrVilla}, ${addr.street}, ${addr.city}`)
                        }
                        className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-amber-100 border border-slate-200 hover:border-amber-400 text-[10px] font-semibold text-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <MapPin className="w-2.5 h-2.5 text-[#DC2626]" />
                        <span>
                          {addr.label} ({addr.city})
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="relative">
                  <input
                    type="text"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder={
                      isArabic
                        ? 'اسم الشارع، رقم المبنى / الفيلا'
                        : 'Street name, Building / Villa number'
                    }
                    className="w-full h-10 ps-8 pe-3 bg-white border border-[#CBD5E1] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-[#DC2626]"
                  />
                  <MapPin className="w-3.5 h-3.5 text-slate-400 absolute start-2.5 top-3.5" />
                </div>
              </div>
            )}
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2.5">
            <label className="block font-bold text-[#0F172A] text-xs">
              {isArabic ? 'اختر طريقة الدفع المعتمدة:' : 'Payment Method:'}
            </label>

            {!hasLiveGateway && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] leading-relaxed">
                {isArabic
                  ? 'وضع الاختبار (Sandbox): يمكنك تجربة Apple Pay وبطاقة الائتمان الآن. وعند إضافة مفتاح ZIINA_API_TOKEN أو STRIPE_SECRET_KEY سيتم التحويل التلقائي للبوابة الحية.'
                  : 'Sandbox Mode: Test Apple Pay and card validation safely. Add ZIINA_API_TOKEN or STRIPE_SECRET_KEY in Secrets to enable live charges.'}
              </div>
            )}

            {/* Apple Pay */}
            <div
              onClick={() => setPaymentMethod('apple_pay')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-2 ${
                paymentMethod === 'apple_pay'
                  ? 'border-black bg-slate-900 text-white shadow-md'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-[#0F172A]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                      paymentMethod === 'apple_pay'
                        ? 'bg-white text-black'
                        : 'bg-slate-900 text-white'
                    }`}
                  >
                    
                  </div>
                  <div>
                    <p className="font-bold text-xs">
                      {isArabic ? 'Apple Pay السريع' : 'Apple Pay Express'}
                    </p>
                    <p
                      className={`text-[10px] ${
                        paymentMethod === 'apple_pay' ? 'text-slate-300' : 'text-[#64748B]'
                      }`}
                    >
                      {hasLiveGateway
                        ? isArabic
                          ? `تحقق فوري عبر ${gatewayStatus?.provider}`
                          : `Verified via ${gatewayStatus?.provider}`
                        : isArabic
                          ? 'دفع فوري بلمسة واحدة (Face ID / Touch ID)'
                          : '1-Tap biometric express payment'}
                    </p>
                  </div>
                </div>

                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    paymentMethod === 'apple_pay' ? 'border-white bg-white' : 'border-slate-300'
                  }`}
                >
                  {paymentMethod === 'apple_pay' && (
                    <div className="w-2 h-2 rounded-full bg-black" />
                  )}
                </div>
              </div>
            </div>

            {/* Credit / Debit Card */}
            <div
              onClick={() => setPaymentMethod('credit_card')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col gap-3 ${
                paymentMethod === 'credit_card'
                  ? 'border-orange-500 bg-orange-50/40 text-[#1C1917] ring-2 ring-orange-500/10'
                  : 'border-[#EAE4DC] bg-[#FFFDF9] hover:bg-amber-50/50 text-[#1C1917]'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-bold text-xs">{t.cardPayment}</p>
                    <p className="text-[10px] text-[#78716C]">
                      Visa, Mastercard, Apple Pay • {hasLiveGateway ? gatewayStatus?.provider : 'PCI-DSS Ready'}
                    </p>
                  </div>
                </div>

                <div
                  className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                    paymentMethod === 'credit_card'
                      ? 'border-orange-500 bg-orange-500'
                      : 'border-stone-300'
                  }`}
                >
                  {paymentMethod === 'credit_card' && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
              </div>

              {paymentMethod === 'credit_card' && (
                <div
                  className="space-y-2.5 pt-2 border-t border-[#EAE4DC] text-xs"
                  onClick={(e) => e.stopPropagation()}
                >
                  {hasLiveGateway ? (
                    <div className="p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px]">
                      {isArabic
                        ? `سيتم توجيهك الآن إلى صفحة الدفع الآمنة المشفرة عبر ${gatewayStatus?.provider} لإدخال بيانات بطاقتك وإتمام الدفع.`
                        : `You will be securely redirected to ${gatewayStatus?.provider} encrypted checkout to enter your card details.`}
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="block text-[11px] font-semibold text-[#1C1917] mb-1">
                          {isArabic ? 'اسم حامل البطاقة' : 'Cardholder Name'}
                        </label>
                        <input
                          type="text"
                          value={cardholderName}
                          onChange={(e) => setCardholderName(e.target.value)}
                          placeholder={isArabic ? 'كما يظهر على البطاقة' : 'Name as shown on card'}
                          className="w-full h-10 px-3 bg-white border border-[#CBD5E1] rounded-lg text-xs text-[#0F172A] focus:outline-none focus:border-orange-500"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-[11px] font-semibold text-[#1C1917]">
                            {isArabic ? 'رقم البطاقة الائتمانية / الخصم' : 'Card Number'}
                          </label>
                          <span className="text-[10px] font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded">
                            {detectedBrand}
                          </span>
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          dir="ltr"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(formatCardNumberInput(e.target.value))}
                          placeholder="4242 4242 4242 4242"
                          maxLength={19}
                          className="w-full h-10 px-3 bg-white border border-[#CBD5E1] rounded-lg text-xs font-metric text-[#0F172A] focus:outline-none focus:border-orange-500"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-semibold text-[#1C1917] mb-1">
                            {isArabic ? 'تاريخ الانتهاء (MM/YY)' : 'Expiry (MM/YY)'}
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            dir="ltr"
                            value={cardExpiry}
                            onChange={(e) => setCardExpiry(formatExpiryInput(e.target.value))}
                            placeholder="08/28"
                            maxLength={5}
                            className="w-full h-10 px-3 bg-white border border-[#CBD5E1] rounded-lg text-xs font-metric text-[#0F172A] focus:outline-none focus:border-orange-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-[#1C1917] mb-1">
                            CVV
                          </label>
                          <input
                            type="password"
                            inputMode="numeric"
                            dir="ltr"
                            value={cardCvv}
                            onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                            placeholder="123"
                            maxLength={4}
                            className="w-full h-10 px-3 bg-white border border-[#CBD5E1] rounded-lg text-xs font-metric text-[#0F172A] focus:outline-none focus:border-orange-500"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Pay at Pickup / Cash */}
            <div
              onClick={() => setPaymentMethod('pickup_cash')}
              className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                paymentMethod === 'pickup_cash'
                  ? 'border-emerald-600 bg-emerald-50/50 text-[#0F172A] ring-2 ring-emerald-500/10'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-[#0F172A]'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#059669] flex items-center justify-center font-bold">
                  💵
                </div>
                <div>
                  <p className="font-bold text-xs">{t.cashOnPickup}</p>
                  <p className="text-[10px] text-[#64748B]">
                    {isArabic
                      ? 'ادفع نقداً أو ببطاقتك عند الاستلام أو لسائق المطعم'
                      : 'Pay in cash or POS at counter or to restaurant driver'}
                  </p>
                </div>
              </div>

              <div
                className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                  paymentMethod === 'pickup_cash'
                    ? 'border-emerald-600 bg-emerald-600'
                    : 'border-slate-300'
                }`}
              >
                {paymentMethod === 'pickup_cash' && (
                  <div className="w-2 h-2 rounded-full bg-white" />
                )}
              </div>
            </div>
          </div>

          {/* Operational Clarity Callout */}
          <div className="p-3.5 bg-amber-50/80 rounded-xl border border-amber-200 text-amber-900 text-[11px] space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>
                {isArabic
                  ? 'كيف يصل إشعار الطلب لمطعمك ولإدارتك؟'
                  : 'How the Kitchen & Admin are Notified:'}
              </span>
            </div>
            <p className="text-[#78350F] leading-relaxed">
              {isArabic
                ? 'عند إتمام هذا الطلب، تتم مزامنته فوراً مع شاشة المطبخ (Merchant Workspace) ولوحة الإدارة، مع تحديث المخزون وحفظ تذكرة الاستلام.'
                : 'Once completed, the order syncs immediately with the Merchant Workspace kitchen screen and Admin dashboard.'}
            </p>
          </div>
        </div>

        {/* Modal Sticky Footer with Breakdown & Pay Action */}
        <div className="p-5 border-t border-[#EAE4DC] bg-[#FAF7F2] space-y-3">
          <div className="space-y-1 font-metric text-xs">
            <div className="flex items-center justify-between text-[#78716C]">
              <span>{isArabic ? 'قيمة الوجبات المحجوزة' : 'Items Subtotal'}</span>
              <span>
                {subtotal.toFixed(2)} {t.currency}
              </span>
            </div>
            {fulfillmentType === 'delivery' && (
              <div className="flex items-center justify-between text-emerald-700 font-semibold">
                <span>
                  {isArabic
                    ? 'توصيل مباشر من المطعم (رسوم المنصة)'
                    : 'Direct Restaurant Delivery (Platform Fee)'}
                </span>
                <span>0.00 {t.currency}</span>
              </div>
            )}
            {applyPoints && pointsDiscountAed > 0 && (
              <div className="flex items-center justify-between text-emerald-600 font-bold">
                <span className="flex items-center gap-1">
                  <Coins className="w-3.5 h-3.5 text-amber-500" />
                  <span>
                    {isArabic
                      ? 'خصم نقاط مكافآت فلاستر (مدعوم 100%)'
                      : 'Flaster Rewards Discount (100% Funded)'}
                  </span>
                </span>
                <span className="font-metric">
                  -{pointsDiscountAed.toFixed(2)} {t.currency}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-[11px] text-stone-500">
              <span>
                {isArabic
                  ? 'ضريبة القيمة المضافة المتضمنة (5% VAT = الإجمالي × 5 / 105)'
                  : 'Included 5% VAT (Total × 5 / 105)'}
              </span>
              <span>
                {includedVatAed.toFixed(2)} {t.currency}
              </span>
            </div>
            <div className="flex items-center justify-between text-base font-extrabold text-[#1C1917] pt-1.5 border-t border-[#EAE4DC]">
              <span>{isArabic ? 'المبلغ الإجمالي (شامل الضريبة)' : 'Total Amount (Incl. VAT)'}</span>
              <span className="text-xl text-orange-600 font-headline">
                {grandTotal.toFixed(2)} {t.currency}
              </span>
            </div>
          </div>

          {/* Main Action Button */}
          {paymentMethod === 'apple_pay' ? (
            <button
              type="button"
              onClick={handleExecutePayment}
              disabled={isProcessing}
              className="w-full h-12 rounded-xl bg-black hover:bg-neutral-800 disabled:opacity-50 text-white font-headline font-bold text-sm flex items-center justify-center gap-2 shadow-lg active:scale-98 transition-all cursor-pointer"
            >
              {isProcessing ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <span className="text-lg"></span>
                  <span>
                    {isArabic
                      ? `الدفع عبر Apple Pay (${grandTotal.toFixed(2)} ${t.currency})`
                      : `Pay with Apple Pay (${grandTotal.toFixed(2)} ${t.currency})`}
                  </span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleExecutePayment}
              disabled={isProcessing}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:from-amber-600 hover:via-orange-600 hover:to-rose-700 text-white font-headline font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isProcessing ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>
                    {isArabic ? 'جاري معالجة وتأكيد الدفع...' : 'Processing Payment...'}
                  </span>
                </div>
              ) : (
                <>
                  <span>
                    {t.confirmPayment} ({grandTotal.toFixed(2)} {t.currency})
                  </span>
                  <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </>
              )}
            </button>
          )}

          <div className="flex items-center justify-center gap-1.5 text-[10px] text-[#94A3B8]">
            <Lock className="w-3 h-3 text-[#059669]" />
            <span>
              {isArabic
                ? 'معاملة مشفرة وآمنة بنسبة 100% وفق معايير مصرف الإمارات المركزي'
                : '100% Encrypted & Secure Payment'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
