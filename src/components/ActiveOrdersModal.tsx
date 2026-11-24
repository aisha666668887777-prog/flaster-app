import React, { useState } from 'react';
import { 
  X, 
  QrCode, 
  Clock, 
  CheckCircle2, 
  Leaf, 
  MapPin, 
  Share2, 
  Receipt,
  RotateCcw,
  Package,
  ShieldCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Order, Language } from '../types';
import { translations } from '../translations';
import { REFUND_POLICY_TEXT } from '../config/platformConfig';

interface ActiveOrdersModalProps {
  isOpen: boolean;
  orders: Order[];
  lang: Language;
  onClose: () => void;
  onMarkCollected: (orderId: string) => void;
  onViewReceipt?: (order: Order) => void;
  onRequestRefund?: (order: Order) => void;
}

export const ActiveOrdersModal: React.FC<ActiveOrdersModalProps> = ({
  isOpen,
  orders,
  lang,
  onClose,
  onMarkCollected,
  onViewReceipt,
  onRequestRefund,
}) => {
  const [filterTab, setFilterTab] = useState<'active' | 'completed' | 'all'>('active');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [sharedToast, setSharedToast] = useState(false);

  if (!isOpen) return null;

  const t = translations[lang];
  const isArabic = lang === 'ar';

  const filteredOrders = orders.filter((order) => {
    if (filterTab === 'active') {
      return order.status === 'active' && order.refundStatus !== 'refunded';
    }
    if (filterTab === 'completed') {
      return order.status === 'collected';
    }
    return true; // all
  });

  const activeOrder = filteredOrders.find((o) => o.id === selectedOrderId) || filteredOrders[0] || orders[0];

  const handleCollect = (orderId: string) => {
    onMarkCollected(orderId);
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch {
      // safe fallback
    }
  };

  const handleShare = () => {
    setSharedToast(true);
    setTimeout(() => setSharedToast(false), 2500);
  };

  const getOrderStageIndex = (order: Order): number => {
    const wf = order.workflowStatus || (order.status === 'collected' ? 'completed' : 'placed');
    if (order.status === 'collected' || wf === 'completed' || wf === 'collected') return 4;
    if (wf === 'picked_up' || wf === 'delivered' || wf === 'out_for_delivery') return 3;
    if (wf === 'ready') return 2;
    if (wf === 'accepted' || wf === 'preparing') return 1;
    return 0; // placed / new
  };

  const isOrderRefundAllowed = (order: Order): boolean => {
    if (order.refundStatus === 'refunded' || order.status === 'cancelled' || order.status === 'collected') {
      return false;
    }
    const wf = order.workflowStatus || 'placed';
    return wf === 'placed' || wf === 'new';
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-4xl bg-white rounded-2xl shadow-elevation-4 overflow-hidden border border-[#EAE4DC] my-8 animate-in zoom-in-95 duration-200 flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-[#EAE4DC] flex items-center justify-between bg-[#FAF8F5]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-[#D97706]">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-lg text-[#0F172A]">
                {isArabic ? 'سجل الطلبات وتصاريح الاستلام' : 'Orders & Rescue Passes'}
              </h3>
              <p className="text-xs text-[#64748B]">
                {orders.length} {isArabic ? 'طلبات مسجلة في حسابك' : 'orders registered in your account'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 border border-[#CBD5E1] text-[#0F172A] flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 px-6 pt-3 border-b border-[#EAE4DC] bg-[#FAF8F5]/50">
          <button
            onClick={() => { setFilterTab('active'); setSelectedOrderId(null); }}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              filterTab === 'active'
                ? 'border-[#DC2626] text-[#DC2626]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>{isArabic ? 'الطلبات النشطة (قيد الاستلام)' : 'Active Orders'}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-red-100 text-[#DC2626] text-[10px] font-bold">
              {orders.filter(o => o.status === 'active' && o.refundStatus !== 'refunded').length}
            </span>
          </button>

          <button
            onClick={() => { setFilterTab('completed'); setSelectedOrderId(null); }}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              filterTab === 'completed'
                ? 'border-[#059669] text-[#059669]'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>{isArabic ? 'الطلبات السابقة المكتملة' : 'Completed / Past'}</span>
            <span className="px-1.5 py-0.2 rounded-full bg-emerald-100 text-[#059669] text-[10px] font-bold">
              {orders.filter(o => o.status === 'collected').length}
            </span>
          </button>

          <button
            onClick={() => { setFilterTab('all'); setSelectedOrderId(null); }}
            className={`pb-3 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 ${
              filterTab === 'all'
                ? 'border-slate-800 text-slate-900'
                : 'border-transparent text-[#64748B] hover:text-[#0F172A]'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            <span>{isArabic ? 'كافة الطلبات' : 'All Orders'} ({orders.length})</span>
          </button>
        </div>

        {/* Content Area */}
        {orders.length === 0 ? (
          <div className="p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-400">
              <QrCode className="w-8 h-8" />
            </div>
            <div>
              <h4 className="font-headline font-bold text-base text-[#0F172A]">
                {t.noActiveOrders}
              </h4>
              <p className="text-xs text-[#64748B] mt-1 max-w-sm mx-auto">
                {isArabic ? 'لم تقم بإنقاذ أي وجبات بعد. تصفح عروض اليوم وابدأ التوفير!' : 'You have not rescued any meals yet. Browse today\'s surplus boxes!'}
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2.5 rounded-full bg-[#DC2626] text-white text-xs font-bold shadow-md hover:bg-[#B91C1C] transition-all"
            >
              {isArabic ? 'تصفح وجبات وفائض اليوم' : 'Browse Today\'s Surplus'}
            </button>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-semibold text-[#64748B]">
              {isArabic ? 'لا توجد طلبات في هذا القسم حالياً' : 'No orders in this category'}
            </p>
            <button
              onClick={() => setFilterTab('all')}
              className="px-4 py-2 rounded-lg bg-slate-100 text-xs font-bold text-slate-700 hover:bg-slate-200"
            >
              {isArabic ? 'عرض كافة الطلبات' : 'Show all orders'}
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x rtl:md:divide-x-reverse divide-[#EAE4DC]">
            
            {/* Orders List Sidebar */}
            <div className="md:col-span-5 p-4 space-y-2 bg-[#FAF8F5]/40 overflow-y-auto">
              <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider px-2">
                {isArabic ? 'اختر الطلب لعرض التفاصيل' : 'Select Order Details'}
              </span>
              {filteredOrders.map((order) => {
                const isSelected = order.id === activeOrder?.id;
                const isCollected = order.status === 'collected';
                const isRefunded = order.refundStatus === 'refunded';

                return (
                  <button
                    key={order.id}
                    onClick={() => setSelectedOrderId(order.id)}
                    className={`w-full text-start p-3 rounded-xl border transition-all text-xs flex items-center justify-between ${
                      isSelected
                        ? 'bg-white border-[#DC2626] shadow-elevation-1 ring-1 ring-red-400/20'
                        : 'bg-white/80 border-[#EAE4DC] hover:bg-white'
                    }`}
                  >
                    <div className="space-y-1 truncate pe-2">
                      <div className="flex items-center gap-1.5 font-bold text-[#0F172A] truncate">
                        <span>{isArabic ? order.item.title.ar : order.item.title.en}</span>
                      </div>
                      <div className="text-[11px] text-[#64748B] flex items-center gap-2">
                        <span className="font-metric font-semibold text-[#DC2626]">
                          {order.code}
                        </span>
                        <span>•</span>
                        <span>{order.totalAed.toFixed(2)} {t.currency}</span>
                      </div>
                    </div>

                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isRefunded
                        ? 'bg-rose-100 text-rose-800'
                        : isCollected
                        ? 'bg-slate-100 text-slate-600'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}>
                      {isRefunded
                        ? (isArabic ? 'مسترد ↩' : 'Refunded')
                        : isCollected 
                        ? (isArabic ? 'مكتمل ✓' : 'Completed') 
                        : (isArabic ? 'نشط' : 'Active')}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Active Selected Order Pass Detail */}
            {activeOrder && (
              <div className="md:col-span-7 p-6 space-y-5 overflow-y-auto">
                
                {/* Status Alert Banner */}
                {activeOrder.refundStatus === 'refunded' ? (
                  <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-3 text-xs">
                    <RotateCcw className="w-5 h-5 text-rose-600 shrink-0" />
                    <div>
                      <p className="font-bold">{isArabic ? 'تم استرداد هذا الطلب بنجاح' : 'This order has been refunded'}</p>
                      <p className="text-[11px] text-rose-700">
                        {isArabic ? `السبب: ${activeOrder.refundReason || 'بناءً على طلب العميل'}` : `Reason: ${activeOrder.refundReason || 'Customer requested refund'}`}
                      </p>
                    </div>
                  </div>
                ) : activeOrder.status === 'collected' ? (
                  <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-3 text-xs">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold">{t.orderCollected}</p>
                      <p className="text-[11px] text-emerald-700">
                        {t.co2Celebration.replace('{co2}', activeOrder.co2SavedKg.toString())}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between text-xs font-medium">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
                      <span>{t.pickupWindow}: <strong>{activeOrder.pickupStart} - {activeOrder.pickupEnd}</strong></span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-900 text-[10px] font-bold uppercase">
                      {isArabic ? 'اليوم' : 'Today'}
                    </span>
                  </div>
                )}

                {/* 5-Step Live Order Stage Stepper: placed -> accepted -> ready -> picked_up/delivered -> completed */}
                <div className="bg-[#FAF8F5] border border-[#EAE4DC] rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#0F172A]">
                      {isArabic ? 'مسار حالة الطلب (Placed → Completed):' : 'Order Status Flow:'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300">
                      {activeOrder.refundStatus === 'refunded'
                        ? (isArabic ? 'تم الإلغاء والاسترداد ↩' : 'Cancelled & Refunded ↩')
                        : activeOrder.status === 'collected' || activeOrder.workflowStatus === 'completed'
                        ? (isArabic ? 'مكتمل (Completed) ✓' : 'Completed ✓')
                        : activeOrder.workflowStatus === 'picked_up' || activeOrder.workflowStatus === 'delivered'
                        ? (isArabic ? 'تم الاستلام من المطعم' : 'Picked Up at Restaurant')
                        : activeOrder.workflowStatus === 'ready'
                        ? (isArabic ? 'جاهز للاستلام (Ready) 📦' : 'Ready for Pickup 📦')
                        : activeOrder.workflowStatus === 'accepted' || activeOrder.workflowStatus === 'preparing'
                        ? (isArabic ? 'مقبول وقيد التحضير 👨‍🍳' : 'Accepted & Preparing 👨‍🍳')
                        : (isArabic ? 'تم إرسال الطلب (Placed)' : 'Placed')}
                    </span>
                  </div>

                  {/* 5-step Progress Indicator */}
                  {(() => {
                    const stageIdx = getOrderStageIndex(activeOrder);
                    const steps = [
                      { label: isArabic ? 'مرسل' : 'Placed' },
                      { label: isArabic ? 'مقبول' : 'Accepted' },
                      { label: isArabic ? 'جاهز' : 'Ready' },
                      { label: isArabic ? 'مستلم' : 'Picked Up' },
                      { label: isArabic ? 'مكتمل' : 'Completed' },
                    ];
                    return (
                      <div className="grid grid-cols-5 gap-1 text-center pt-1">
                        {steps.map((st, idx) => (
                          <div key={idx} className="space-y-1">
                            <div className={`h-1.5 rounded-full ${idx <= stageIdx ? 'bg-emerald-500' : 'bg-slate-200'}`} />
                            <span className={`text-[10px] font-semibold block ${idx === stageIdx ? 'text-emerald-800 font-bold' : 'text-slate-500'}`}>
                              {st.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* Digital Ticket / Pass Box */}
                <div className="border-2 border-dashed border-[#CBD5E1] rounded-2xl p-5 bg-[#FAF8F5]/80 text-center space-y-4 relative overflow-hidden">
                  
                  <div className="space-y-1">
                    <span className="text-[11px] font-bold text-[#64748B] uppercase tracking-widest">
                      {t.rescueCode}
                    </span>
                    <div className="font-metric font-extrabold text-2xl tracking-wider text-[#DC2626] bg-red-50 py-1.5 px-4 rounded-lg inline-block border border-red-200">
                      {activeOrder.code}
                    </div>
                    {activeOrder.pickupCode && (
                      <p className="text-[11px] text-[#64748B] font-mono font-bold mt-1">
                        {isArabic ? 'رمز الاستلام السري: ' : 'Pickup Secret Code: '}
                        <span className="text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-300 tracking-wider">
                          {activeOrder.pickupCode}
                        </span>
                      </p>
                    )}
                  </div>

                  {/* QR Code SVG Visualizer */}
                  <div className="w-40 h-40 mx-auto p-3 bg-white rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col items-center justify-center">
                    <svg viewBox="0 0 100 100" className="w-full h-full text-[#0F172A]" fill="currentColor">
                      <rect x="5" y="5" width="28" height="28" rx="4" />
                      <rect x="9" y="9" width="20" height="20" fill="white" rx="2" />
                      <rect x="13" y="13" width="12" height="12" rx="2" />

                      <rect x="67" y="5" width="28" height="28" rx="4" />
                      <rect x="71" y="9" width="20" height="20" fill="white" rx="2" />
                      <rect x="75" y="13" width="12" height="12" rx="2" />

                      <rect x="5" y="67" width="28" height="28" rx="4" />
                      <rect x="9" y="71" width="20" height="20" fill="white" rx="2" />
                      <rect x="13" y="75" width="12" height="12" rx="2" />

                      <rect x="38" y="10" width="6" height="6" />
                      <rect x="48" y="10" width="6" height="6" />
                      <rect x="56" y="16" width="6" height="6" />
                      <rect x="38" y="24" width="6" height="6" />
                      <rect x="48" y="24" width="6" height="6" />
                      
                      <rect x="10" y="38" width="6" height="6" />
                      <rect x="18" y="46" width="6" height="6" />
                      <rect x="28" y="38" width="6" height="6" />
                      <rect x="38" y="42" width="10" height="10" fill="#DC2626" rx="2" />
                      <rect x="54" y="38" width="6" height="6" />
                      <rect x="68" y="44" width="8" height="6" />
                      <rect x="82" y="38" width="8" height="8" />

                      <rect x="38" y="60" width="6" height="6" />
                      <rect x="48" y="66" width="6" height="6" />
                      <rect x="58" y="60" width="6" height="6" />
                      <rect x="70" y="70" width="8" height="8" />
                      <rect x="84" y="66" width="8" height="8" />
                      <rect x="80" y="82" width="10" height="10" />
                      <rect x="68" y="84" width="6" height="6" />
                      <rect x="44" y="80" width="8" height="8" />
                    </svg>
                  </div>

                  <div className="flex items-center justify-center gap-2 pt-1">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold">
                      <Leaf className="w-3.5 h-3.5" />
                      {activeOrder.co2SavedKg} kg CO2e
                    </span>
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-slate-200 text-slate-800 text-xs font-metric font-semibold">
                      {activeOrder.quantity}x • {activeOrder.totalAed} {t.currency}
                    </span>
                  </div>
                </div>

                {/* Merchant Venue Details */}
                <div className="bg-[#FAF8F5] rounded-xl p-4 border border-[#EAE4DC] space-y-2 text-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <h5 className="font-bold text-[#0F172A]">
                        {isArabic ? activeOrder.item.merchant.nameAr : activeOrder.item.merchant.name}
                      </h5>
                      <p className="text-[#64748B] text-[11px] mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-[#DC2626]" />
                        <span>{isArabic ? activeOrder.item.merchant.addressAr : activeOrder.item.merchant.address}</span>
                      </p>
                    </div>
                    <span className="font-metric text-xs font-bold text-[#64748B]">
                      {activeOrder.item.merchant.distanceKm} km
                    </span>
                  </div>
                </div>

                {/* Refund Policy Callout */}
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                  <p>{isArabic ? REFUND_POLICY_TEXT.ar : REFUND_POLICY_TEXT.en}</p>
                </div>

                {/* Action Buttons Row */}
                <div className="space-y-3">
                  
                  {activeOrder.status === 'active' && activeOrder.refundStatus !== 'refunded' && (
                    <button
                      onClick={() => handleCollect(activeOrder.id)}
                      className="w-full h-11 rounded-xl bg-[#059669] hover:bg-[#047857] text-white text-xs font-extrabold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-98 transition-all"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{t.markCollected}</span>
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {/* View Digital Receipt */}
                    <button
                      onClick={() => onViewReceipt && onViewReceipt(activeOrder)}
                      className="py-2.5 px-3 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Receipt className="w-3.5 h-3.5 text-amber-700" />
                      <span>{isArabic ? 'الإيصال الرقمي' : 'Digital Receipt'}</span>
                    </button>

                    {/* Refund Request Button (Allowed ONLY before merchant accepts/prepares) */}
                    {isOrderRefundAllowed(activeOrder) ? (
                      <button
                        onClick={() => onRequestRefund && onRequestRefund(activeOrder)}
                        className="py-2.5 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                        <span>{isArabic ? 'إلغاء واسترداد الطلب' : 'Cancel & Refund'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={handleShare}
                        className="py-2.5 px-3 rounded-xl border border-[#CBD5E1] hover:bg-slate-50 text-[#0F172A] text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Share2 className="w-3.5 h-3.5 text-[#DC2626]" />
                        <span>{t.shareImpact}</span>
                      </button>
                    )}
                  </div>

                  {sharedToast && (
                    <div className="p-2 text-center text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg animate-in fade-in">
                      {isArabic ? '✓ تم تجهيز بطاقة وإيصال الإنقاذ بنجاح!' : '✓ Rescue pass & receipt ready!'}
                    </div>
                  )}

                </div>

              </div>
            )}

          </div>
        )}

      </div>
    </div>
  );
};
