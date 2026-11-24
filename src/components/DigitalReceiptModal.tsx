import React, { useState } from 'react';
import {
  ReceiptText,
  X,
  Printer,
  AlertTriangle,
  RotateCcw,
  ShieldCheck,
  Coins,
  Lock,
} from 'lucide-react';
import { Order, Language } from '../types';
import { translations } from '../translations';
import {
  CUSTOMER_SERVICE_FEE_FILS,
  aedToFils,
  calculateIncludedVatFils,
  calculateNetExclVatFils,
  formatFilsToAedString,
  PlatformSettings,
} from '../config/platformConfig';

interface DigitalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  lang: Language;
  trn?: string;
  businessName?: string;
  platformSettings?: PlatformSettings;
  onRequestRefund?: (orderId: string, reason: string) => Promise<{ success: boolean; message?: string } | void>;
}

export const DigitalReceiptModal: React.FC<DigitalReceiptModalProps> = ({
  isOpen,
  onClose,
  order,
  lang,
  trn = '',
  businessName = 'Flaster',
  platformSettings,
  onRequestRefund,
}) => {
  const isArabic = lang === 'ar';
  const t = translations[lang];

  const [showRefundForm, setShowRefundForm] = useState(false);
  const [refundReason, setRefundReason] = useState('إلغاء قبل بدء التحضير');
  const [refundStatusMsg, setRefundStatusMsg] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isSubmittingRefund, setIsSubmittingRefund] = useState(false);

  if (!isOpen || !order) return null;

  const effectiveTrn = (trn || platformSettings?.trn || order.trn || '').trim();
  const hasTrn = effectiveTrn.length > 0;

  // Document title depends on whether TRN is set
  const documentTitle = hasTrn
    ? isArabic
      ? 'فاتورة ضريبية (Tax Invoice)'
      : 'Tax Invoice'
    : isArabic
      ? 'إيصال إلكتروني (Receipt)'
      : 'Receipt';

  const invoiceNumber =
    order.invoiceNumber ||
    order.receiptNumber ||
    `INV-${new Date(order.createdAt).getUTCFullYear()}-${order.id.slice(-5).toUpperCase()}`;

  // All monetary amounts computed in integer UAE Fils (1 AED = 100 Fils)
  const rawMerchantUnitFils =
    order.item.discountedPriceFils ?? aedToFils(order.item.discountedPrice);
  const rawSubtotalFils =
    order.subtotalFils ?? rawMerchantUnitFils * order.quantity;
  const serviceFeeFils =
    order.serviceFeeFils ?? CUSTOMER_SERVICE_FEE_FILS * Math.max(1, order.quantity);
  // Blended customer-facing subtotal & unit price (zero separate service fee line shown to customer)
  const customerSubtotalFils = rawSubtotalFils + serviceFeeFils;
  const unitPriceFils =
    order.quantity > 0 ? Math.round(customerSubtotalFils / order.quantity) : customerSubtotalFils;
  const pointsDiscountFils =
    order.pointsDiscountFils ?? aedToFils(order.pointsDiscountAed ?? 0);
  const totalFils =
    order.totalFils ??
    Math.max(0, customerSubtotalFils - pointsDiscountFils);

  // Prices include 5% VAT -> VAT = totalFils * 5 / 105
  const vatFils = order.vatFils ?? calculateIncludedVatFils(totalFils);
  const netExclVatFils = calculateNetExclVatFils(totalFils);

  const isRefunded = order.refundStatus === 'refunded' || order.status === 'cancelled';
  const currentWorkflow = (order.workflowStatus || 'placed').toLowerCase();

  // Refund allowed ONLY before merchant accepts or prepares the order ('placed' / 'new')
  const isRefundAllowed =
    !isRefunded &&
    order.status === 'active' &&
    (currentWorkflow === 'placed' || currentWorkflow === 'new');

  const handlePrint = () => {
    window.print();
  };

  const handleRefundSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onRequestRefund) return;

    setIsSubmittingRefund(true);
    setRefundStatusMsg(null);

    try {
      const result = await onRequestRefund(order.id, refundReason);
      if (result && result.success === false) {
        setRefundStatusMsg({
          type: 'error',
          text:
            result.message ||
            (isArabic
              ? 'لا يمكن استرداد الطلب بعد قبول المتجر له أو بدء تحضيره.'
              : 'Refund blocked: Order has already been accepted or prepared.'),
        });
      } else {
        setRefundStatusMsg({
          type: 'success',
          text:
            (result && result.message) ||
            (isArabic
              ? '✓ تمت الموافقة على الاسترداد وإلغاء الطلب بنجاح.'
              : '✓ Refund approved and order cancelled.'),
        });
        setTimeout(() => {
          setShowRefundForm(false);
        }, 2500);
      }
    } catch {
      setRefundStatusMsg({
        type: 'error',
        text: isArabic
          ? 'حدث خطأ أثناء معالجة طلب الاسترداد.'
          : 'Failed to process refund request.',
      });
    } finally {
      setIsSubmittingRefund(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-elevation-4 border border-[#EAE4DC] overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200 print:m-0 print:p-0 print:border-none print:shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Receipt Top Header */}
        <div className="bg-[#FAF8F5] p-5 border-b border-[#EAE4DC] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-sm">
              <ReceiptText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-sm text-[#0F172A]">
                {documentTitle}
              </h3>
              <p className="text-[10px] text-[#64748B] font-metric">
                {invoiceNumber}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 print:hidden">
            <button
              onClick={handlePrint}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white hover:text-[#0F172A]"
              title={isArabic ? 'طباعة' : 'Print'}
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:text-slate-800"
              title={isArabic ? 'إغلاق' : 'Close'}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Receipt Content Scrollable Area */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          {/* Brand, Sequential Invoice Number, Date & Conditional TRN */}
          <div className="text-center space-y-1 pb-4 border-b border-dashed border-slate-200">
            <span className="font-headline font-black text-xl text-[#0F172A] tracking-tight block">
              {businessName} • فلاستر
            </span>
            <span className="text-[10px] text-[#D97706] font-bold block uppercase tracking-wider">
              SMART SAVING. LESS WASTE. • توفير ذكي • هدر أقل
            </span>
            <span className="text-[11px] font-bold text-[#0F172A] block font-metric">
              {documentTitle} #{invoiceNumber}
            </span>
            {hasTrn && (
              <span className="text-[10px] text-slate-600 font-bold block font-metric">
                TRN: {effectiveTrn}
              </span>
            )}
            <span className="text-[11px] text-slate-500 block">
              {new Date(order.createdAt).toLocaleString(isArabic ? 'ar-AE' : 'en-US', {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </span>
          </div>

          {/* Refund Banner if Refunded */}
          {isRefunded && (
            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 font-bold flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-rose-600" />
              <span>
                {isArabic
                  ? 'تم إلغاء هذا الطلب واسترداد المبلغ والنقاط'
                  : 'This order was refunded & cancelled'}
              </span>
            </div>
          )}

          {/* Store / Merchant & Customer Details */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-[#FAF8F5] rounded-xl border border-[#EAE4DC] text-[11px]">
            <div>
              <span className="text-slate-500 block mb-0.5">
                {isArabic ? 'المتجر / المطبخ:' : 'Merchant:'}
              </span>
              <strong className="text-[#0F172A] block text-xs truncate">
                {isArabic ? order.item.merchant.nameAr : order.item.merchant.name}
              </strong>
              <span className="text-slate-500 block text-[10px] truncate">
                {isArabic
                  ? order.item.merchant.neighborhoodAr
                  : order.item.merchant.neighborhood}
              </span>
            </div>

            <div>
              <span className="text-slate-500 block mb-0.5">
                {isArabic ? 'العميل المستلم:' : 'Customer:'}
              </span>
              <strong className="text-[#0F172A] block text-xs truncate">
                {order.customerName || (isArabic ? 'عميل معتمد' : 'Verified Customer')}
              </strong>
              <span className="text-slate-500 font-metric block text-[10px]">
                {order.customerPhone || '—'}
              </span>
            </div>
          </div>

          {/* Itemized Line Items Table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b pb-1">
              <span>{isArabic ? 'الصنف' : 'Item Description'}</span>
              <span>{isArabic ? 'المجموع' : 'Total'}</span>
            </div>

            <div className="space-y-1.5 py-1">
              <div className="flex items-start justify-between font-medium">
                <div>
                  <span className="text-[#0F172A] font-bold text-xs block">
                    {order.quantity}x{' '}
                    {isArabic ? order.item.title.ar : order.item.title.en}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {formatFilsToAedString(unitPriceFils)} {t.currency} /{' '}
                    {isArabic ? 'صنف' : 'item'}
                  </span>
                </div>
                <strong className="font-metric text-[#0F172A] text-xs tabular-nums">
                  {formatFilsToAedString(customerSubtotalFils)} {t.currency}
                </strong>
              </div>
            </div>
          </div>

          {/* Pricing Totals Breakdown (Integer Fils -> Formatted Display) */}
          <div className="pt-2 border-t border-dashed border-slate-200 space-y-1.5 font-metric text-xs">
            <div className="flex justify-between text-slate-600">
              <span>{isArabic ? 'قيمة الأصناف:' : 'Items Subtotal:'}</span>
              <span className="tabular-nums">
                {formatFilsToAedString(customerSubtotalFils)} {t.currency}
              </span>
            </div>

            {pointsDiscountFils > 0 && (
              <div className="flex justify-between text-[#059669] font-bold">
                <span className="flex items-center gap-1">
                  <Coins className="w-3 h-3" />
                  <span>
                    {isArabic ? 'خصم نقاط مكافآت فلاستر:' : 'Loyalty Points Discount:'}
                  </span>
                </span>
                <span>
                  -{formatFilsToAedString(pointsDiscountFils)} {t.currency}
                </span>
              </div>
            )}

            <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
              <span>{isArabic ? 'الصافي قبل الضريبة:' : 'Net Excl. VAT:'}</span>
              <span>
                {formatFilsToAedString(netExclVatFils)} {t.currency}
              </span>
            </div>

            <div className="flex justify-between text-[11px] text-slate-600">
              <span>
                {isArabic
                  ? 'ضريبة القيمة المضافة المشمولة (5% = الإجمالي × 5/105):'
                  : 'Included 5% VAT (Total × 5/105):'}
              </span>
              <span>
                {formatFilsToAedString(vatFils)} {t.currency}
              </span>
            </div>

            <div className="flex justify-between text-sm font-extrabold text-[#0F172A] pt-2 border-t border-slate-200">
              <span>
                {isArabic
                  ? 'الإجمالي المدفوع (شامل 5% ض.ق.م):'
                  : 'Total Paid (Incl. 5% VAT):'}
              </span>
              <span className="text-[#DC2626] font-black">
                {formatFilsToAedString(totalFils)} {t.currency}
              </span>
            </div>

            <div className="flex justify-between text-[11px] text-slate-500 pt-1">
              <span>{isArabic ? 'طريقة الدفع:' : 'Payment Method:'}</span>
              <span className="font-bold text-[#0F172A]">
                {order.paymentMethod === 'pickup_cash'
                  ? isArabic
                    ? '💵 نقداً عند الاستلام من المطعم'
                    : '💵 Cash on Pickup at Restaurant'
                  : order.paymentMethod === 'apple_pay'
                    ? ` Apple Pay (${order.paymentGateway || 'Ziina / Stripe UAE'})`
                    : `💳 ${isArabic ? 'بطاقة ائتمانية' : 'Card Payment'} (${order.paymentGateway || 'Ziina / Stripe UAE'})`}
              </span>
            </div>

            {order.paymentMethod !== 'pickup_cash' && !isRefunded && (
              <div className="pt-2">
                <div
                  className={`w-full py-2 px-3 rounded-lg font-bold text-[11px] flex items-center justify-between gap-2 border ${
                    order.paymentStatus === 'paid'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                      : 'bg-amber-50 border-amber-200 text-amber-900'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>
                      {order.paymentStatus === 'paid'
                        ? isArabic
                          ? 'مدفوع وموثّق إلكترونياً'
                          : 'Paid & Gateway Verified'
                        : order.paymentStatus === 'sandbox_paid'
                          ? isArabic
                            ? 'دفع تجريبي (Sandbox Test)'
                            : 'Sandbox Test Payment'
                          : isArabic
                            ? 'معاملة دفع إلكتروني'
                            : 'Electronic Payment'}
                    </span>
                  </span>
                  {order.paymentTransactionId && (
                    <span className="font-metric text-[10px] opacity-80 truncate max-w-[140px]">
                      {order.paymentTransactionId}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Refund Policy & Trigger Section */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-[11px]">
            <p className="font-bold text-[#0F172A] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>{isArabic ? 'سياسة الإلغاء والاسترداد:' : 'Refund & Cancellation Policy:'}</span>
            </p>
            <p className="text-slate-600 leading-relaxed">
              {isArabic
                ? 'يُسمح بإلغاء الطلب واسترداد المبلغ فقط قبل قبول المتجر للطلب أو بدء تحضيره. يُحظر الاسترداد بعد بدء التحضير أو الاستلام.'
                : 'Cancellations and refunds are allowed strictly before the merchant accepts or prepares the order, and are blocked after preparation or pickup.'}
            </p>
          </div>

          {!isRefunded && (
            <div className="pt-1 print:hidden">
              {isRefundAllowed ? (
                !showRefundForm ? (
                  <button
                    onClick={() => setShowRefundForm(true)}
                    className="w-full py-2 px-3 rounded-lg border border-slate-200 hover:border-red-300 text-slate-600 hover:text-red-700 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      {isArabic
                        ? 'إلغاء الطلب واسترداد المبلغ (متاح قبل قبول المتجر)'
                        : 'Cancel & Request Refund (Available prior to merchant acceptance)'}
                    </span>
                  </button>
                ) : (
                  <form
                    onSubmit={handleRefundSubmit}
                    className="p-3.5 bg-rose-50 rounded-xl border border-rose-200 space-y-2.5 animate-in fade-in"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-rose-900 text-xs">
                        {isArabic
                          ? 'طلب استرداد وإلغاء الطلب:'
                          : 'Request Order Refund:'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowRefundForm(false)}
                        className="text-slate-400 hover:text-slate-700"
                      >
                        ✕
                      </button>
                    </div>

                    <select
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      className="w-full h-9 px-2 bg-white border border-rose-300 rounded-lg text-xs text-rose-950 focus:outline-none"
                    >
                      <option value="إلغاء قبل بدء التحضير">
                        {isArabic
                          ? 'إلغاء قبل قبول المتجر أو بدء التحضير'
                          : 'Cancel prior to merchant acceptance'}
                      </option>
                      <option value="تم الطلب بالخطأ">
                        {isArabic ? 'تم الطلب بالخطأ' : 'Ordered by mistake'}
                      </option>
                      <option value="تغيير موعد الاستلام">
                        {isArabic
                          ? 'عدم التمكن من الحضور في نافذة الاستلام'
                          : 'Unable to make pickup window'}
                      </option>
                    </select>

                    {refundStatusMsg && (
                      <div
                        className={`p-2 rounded font-bold text-center text-[11px] ${
                          refundStatusMsg.type === 'success'
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-red-100 text-red-900'
                        }`}
                      >
                        {refundStatusMsg.text}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isSubmittingRefund}
                      className="w-full py-2 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-colors"
                    >
                      {isSubmittingRefund
                        ? isArabic
                          ? 'جاري التحقق من الخادم...'
                          : 'Validating on server...'
                        : isArabic
                          ? 'تأكيد الإلغاء والاسترداد'
                          : 'Confirm Refund & Cancel'}
                    </button>
                  </form>
                )
              ) : (
                <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 text-[11px] flex items-center justify-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    {isArabic
                      ? `الاسترداد مغلق (الحالة الحالية: ${currentWorkflow}) — تم قبول الطلب أو استلامه`
                      : `Refund locked (Status: ${currentWorkflow}) — Order already accepted or fulfilled`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Security & Verification Stamp */}
          <div className="text-center pt-2 text-[10px] text-slate-400 space-y-1">
            <div className="flex items-center justify-center gap-1.5 text-emerald-700 font-semibold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>
                {hasTrn
                  ? isArabic
                    ? 'فاتورة ضريبية إلكترونية معتمدة'
                    : 'Verified Electronic Tax Invoice'
                  : isArabic
                    ? 'إيصال إلكتروني معتمد عبر منصة فلاستر'
                    : 'Verified Electronic Receipt'}
              </span>
            </div>
            <p>Flaster UAE • support@flaster.ae</p>
          </div>
        </div>
      </div>
    </div>
  );
};
