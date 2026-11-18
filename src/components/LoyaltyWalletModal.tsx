import React, { useState, useEffect } from 'react';
import { 
  X, 
  Coins, 
  Sparkles, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertTriangle, 
  ShoppingBag, 
  Star, 
  ArrowUpRight, 
  ArrowDownLeft, 
  ShieldCheck, 
  RefreshCw,
  Gift,
  Flame,
  ChevronRight
} from 'lucide-react';
import { Language } from '../types';
import confetti from 'canvas-confetti';

interface LoyaltyWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  customerId?: string;
  onPointsUpdated?: (newBalance: number) => void;
}

interface WalletData {
  availablePoints: number;
  equivalentAed: number;
  totalEarnedPoints: number;
  totalRedeemedPoints: number;
  totalExpiredPoints: number;
  lastDailyLoginDate?: string;
  nextExpirationDate?: string;
  pointsSubjectToExpiry: number;
  daysUntilExpiry?: number;
}

interface TransactionItem {
  id: string;
  type: string;
  points: number;
  equivalentAed: number;
  note?: string;
  relatedOrderId?: string;
  createdAt: string;
}

export const LoyaltyWalletModal: React.FC<LoyaltyWalletModalProps> = ({
  isOpen,
  onClose,
  lang,
  customerId = 'customer-rak-demo',
  onPointsUpdated
}) => {
  const isArabic = lang === 'ar';

  const [activeTab, setActiveTab] = useState<'all' | 'earned' | 'redeemed'>('all');
  const [wallet, setWallet] = useState<WalletData>({
    availablePoints: 150,
    equivalentAed: 1.5,
    totalEarnedPoints: 150,
    totalRedeemedPoints: 0,
    totalExpiredPoints: 0,
    pointsSubjectToExpiry: 150,
    daysUntilExpiry: 120
  });
  const [history, setHistory] = useState<TransactionItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [claimingLogin, setClaimingLogin] = useState(false);
  const [loginClaimMessage, setLoginClaimMessage] = useState<string | null>(null);
  const [upcomingExpiryWarning, setUpcomingExpiryWarning] = useState(false);

  // Review Reward Simulation State
  const [showReviewInput, setShowReviewInput] = useState(false);
  const [reviewOrderId, setReviewOrderId] = useState('AM-ORD-DEMO');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  // Fetch Wallet Data
  const fetchWallet = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/loyalty/wallet/${customerId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.wallet) {
          setWallet(data.wallet);
          setHistory(data.history || []);
          setUpcomingExpiryWarning(Boolean(data.upcomingExpiryWarning));
          if (onPointsUpdated) onPointsUpdated(data.wallet.availablePoints);
        }
      }
    } catch {
      // offline fallback maintains initial state
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchWallet();
    }
  }, [isOpen, customerId]);

  // Claim Daily Login Reward (1 Point)
  const handleClaimDailyLogin = async () => {
    setClaimingLogin(true);
    setLoginClaimMessage(null);
    try {
      const res = await fetch('/api/loyalty/daily-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerId })
      });
      const data = await res.json();
      if (data.success) {
        setWallet(data.wallet);
        setLoginClaimMessage(data.message || (isArabic ? 'تم كسب نقطة تسجيل الدخول اليومية!' : 'Daily login point earned!'));
        if (onPointsUpdated) onPointsUpdated(data.wallet.availablePoints);
        fetchWallet();
        try {
          confetti({
            particleCount: 50,
            spread: 60,
            origin: { y: 0.6 }
          });
        } catch {
          // ignore
        }
      } else {
        setLoginClaimMessage(data.message || (isArabic ? 'لقد سجلت دخولك وحصلت على النقطة مسبقاً لهذا اليوم.' : 'Already claimed today.'));
      }
    } catch {
      setLoginClaimMessage(isArabic ? 'تعذر الاتصال بالخادم، يرجى المحاولة لاحقاً' : 'Network error, please retry');
    } finally {
      setClaimingLogin(false);
    }
  };

  // Submit Review Reward (10 Points)
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReview(true);
    setReviewMessage(null);
    try {
      const res = await fetch('/api/loyalty/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId,
          orderId: reviewOrderId || `ORD-${Date.now()}`,
          rating: reviewRating,
          comment: reviewComment
        })
      });
      const data = await res.json();
      if (data.success) {
        setReviewMessage(data.message || (isArabic ? 'تمت إضافة 10 نقاط لمشاركتك التقييم!' : '10 points added for your review!'));
        setShowReviewInput(false);
        setReviewComment('');
        fetchWallet();
        try {
          confetti({
            particleCount: 75,
            spread: 70,
            origin: { y: 0.5 }
          });
        } catch {
          // ignore
        }
      } else {
        setReviewMessage(data.message || (isArabic ? 'تم تقييم هذا الطلب مسبقاً.' : 'Already reviewed.'));
      }
    } catch {
      setReviewMessage(isArabic ? 'حدث خطأ أثناء إرسال التقييم' : 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (!isOpen) return null;

  const filteredHistory = history.filter((t) => {
    if (activeTab === 'earned') return t.points > 0;
    if (activeTab === 'redeemed') return t.points < 0;
    return true;
  });

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-2xl bg-[#FFFDF9] rounded-3xl shadow-2xl border border-[#EAE4DC] overflow-hidden max-h-[92vh] flex flex-col animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className="relative p-6 bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-rose-600 flex items-center justify-center shadow-lg shadow-orange-500/30">
                <Coins className="w-6 h-6 text-amber-300" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-headline font-extrabold text-xl text-white">
                    {isArabic ? 'محفظة مكافآت فلاستر' : 'Flaster Rewards Wallet'}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-bold border border-amber-400/30">
                    {isArabic ? '100 نقطة = 1 درهم' : '100 Pts = 1 AED'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {isArabic ? 'نقاطك مدعومة وممولة بالكامل 100% من إدارة فلاستر Flaster' : '100% Platform Funded by Flaster • Zero Cost to Merchants'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Balance Card */}
          <div className="mt-5 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="text-xs text-slate-300 font-medium block">
                {isArabic ? 'الرصيد النشط المتاح للاستبدال:' : 'Available Active Balance:'}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-headline font-extrabold text-3xl sm:text-4xl text-amber-300 tracking-tight">
                  {wallet.availablePoints}
                </span>
                <span className="text-sm font-semibold text-slate-300">
                  {isArabic ? 'نقطة ولاء' : 'Points'}
                </span>
                <span className="text-slate-400 text-sm">•</span>
                <span className="text-sm font-bold text-emerald-300">
                  ≈ {wallet.equivalentAed} {isArabic ? 'درهم إماراتي' : 'AED'}
                </span>
              </div>
            </div>

            {/* Quick Action: Daily Check-In */}
            <button
              onClick={handleClaimDailyLogin}
              disabled={claimingLogin}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-amber-500/20 active:scale-95 transition-all disabled:opacity-50"
            >
              {claimingLogin ? (
                <RefreshCw className="w-4 h-4 animate-spin text-slate-950" />
              ) : (
                <Gift className="w-4 h-4 text-slate-950" />
              )}
              <span>
                {isArabic ? 'سجل دخولك اليومي (+1 نقطة)' : 'Claim Daily Check-in (+1 Pt)'}
              </span>
            </button>
          </div>

          {/* 4-Month Expiry Pill Alert */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] bg-slate-800/80 rounded-xl px-3.5 py-2 border border-slate-700/60">
            <div className="flex items-center gap-2 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                {isArabic 
                  ? `دورة صلاحية النقاط: 4 أشهر (120 يوماً) من تاريخ الاكتساب.`
                  : `4-Month Expiration Cycle (120 Days validity).`}
              </span>
            </div>
            {wallet.daysUntilExpiry !== undefined && (
              <span className={`font-bold px-2 py-0.5 rounded-md ${
                upcomingExpiryWarning 
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse' 
                  : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                {isArabic 
                  ? `متبقي على دورة التصفير: ${wallet.daysUntilExpiry} يوماً` 
                  : `${wallet.daysUntilExpiry} days until cycle reset`}
              </span>
            )}
          </div>

          {loginClaimMessage && (
            <div className="mt-2 text-xs font-semibold text-amber-200 bg-amber-900/60 p-2 rounded-lg border border-amber-500/30">
              {loginClaimMessage}
            </div>
          )}
        </div>

        {/* Earning Rules Quick Bar */}
        <div className="grid grid-cols-3 divide-x divide-slate-100 rtl:divide-x-reverse border-b border-slate-200 bg-slate-50 text-center py-2.5 px-4 text-xs font-medium text-slate-600">
          <div className="px-2">
            <span className="block font-bold text-slate-900 font-metric">+1 {isArabic ? 'نقطة' : 'pt'}</span>
            <span className="text-[10px] text-slate-500">{isArabic ? 'تسجيل دخول يومي' : 'Daily Login'}</span>
          </div>
          <div className="px-2">
            <span className="block font-bold text-orange-600 font-metric">+15 {isArabic ? 'نقطة' : 'pts'}</span>
            <span className="text-[10px] text-slate-500">{isArabic ? 'كل طلب مكتمل' : 'Completed Order'}</span>
          </div>
          <div className="px-2">
            <span className="block font-bold text-emerald-600 font-metric">+10 {isArabic ? 'نقاط' : 'pts'}</span>
            <span className="text-[10px] text-slate-500">{isArabic ? 'تقييم تجربة الشراء' : 'Order Review'}</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          
          {/* Review Reward Section (Interactive) */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-200 text-amber-800 flex items-center justify-center">
                  <Star className="w-4 h-4 fill-amber-500 text-amber-600" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-900">
                    {isArabic ? 'شاركنا تقييمك واكسب 10 نقاط ولاء فورية!' : 'Review a completed order and earn 10 Points!'}
                  </h4>
                  <p className="text-[11px] text-slate-600">
                    {isArabic ? 'كل تقييم لوجبة أنقذتها يمنحك 10 نقاط مضافة لمحفظتك' : 'Help other savers and earn 10 reward points per review'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowReviewInput(!showReviewInput)}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shrink-0"
              >
                {showReviewInput ? (isArabic ? 'إلغاء' : 'Cancel') : (isArabic ? 'اكتب تقييمك' : 'Review')}
              </button>
            </div>

            {showReviewInput && (
              <form onSubmit={handleSubmitReview} className="mt-3 pt-3 border-t border-amber-200/80 space-y-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-700">
                    {isArabic ? 'التقييم:' : 'Rating:'}
                  </span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        type="button"
                        key={star}
                        onClick={() => setReviewRating(star)}
                        className="p-1 focus:outline-none"
                      >
                        <Star className={`w-5 h-5 ${star <= reviewRating ? 'fill-amber-400 text-amber-500' : 'text-slate-300'}`} />
                      </button>
                    ))}
                  </div>
                </div>

                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder={isArabic ? 'صف جودة الوجبة وتجربة الاستلام من المطعم...' : 'Describe your rescue meal experience...'}
                  className="w-full h-16 p-2.5 bg-white border border-amber-300 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-amber-600"
                />

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {submittingReview ? (isArabic ? 'جاري الإرسال...' : 'Submitting...') : (isArabic ? 'إرسال التقييم واستلام 10 نقاط' : 'Submit & Earn 10 Pts')}
                  </button>
                </div>
              </form>
            )}

            {reviewMessage && (
              <p className="mt-2 text-xs font-bold text-emerald-800 bg-emerald-100 p-2 rounded-lg">
                {reviewMessage}
              </p>
            )}
          </div>

          {/* History Header & Tabs */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-headline font-bold text-sm text-slate-900">
                {isArabic ? 'سجل حركات المحفظة المالي:' : 'Rewards Ledger & Activity:'}
              </h4>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    activeTab === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  {isArabic ? 'الكل' : 'All'}
                </button>
                <button
                  onClick={() => setActiveTab('earned')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all ${
                    activeTab === 'earned' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  {isArabic ? 'المكتسبة' : 'Earned'}
                </button>
                <button
                  onClick={() => setActiveTab('redeemed')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    activeTab === 'redeemed' ? 'bg-white text-orange-600 shadow-xs' : 'text-slate-600'
                  }`}
                >
                  {isArabic ? 'المستبدلة' : 'Redeemed'}
                </button>
              </div>
            </div>

            {/* Transactions List */}
            {filteredHistory.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs">
                {isArabic ? 'لا توجد حركات مسجلة حالياً في هذا القسم' : 'No transactions recorded in this category'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredHistory.map((item) => {
                  const isEarned = item.points > 0;
                  return (
                    <div 
                      key={item.id}
                      className="p-3 rounded-xl bg-[#FAF7F2] border border-[#EAE4DC] flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                          isEarned ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'
                        }`}>
                          {isEarned ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-bold text-[#1C1917]">
                            {item.note || (isEarned ? 'نقاط مكتسبة' : 'استبدال نقاط في الطلب')}
                          </p>
                          <p className="text-[10px] text-slate-500 font-metric mt-0.5">
                            {new Date(item.createdAt).toLocaleDateString(isArabic ? 'ar-AE' : 'en-US', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="text-end">
                        <span className={`font-metric font-extrabold text-sm block ${
                          isEarned ? 'text-emerald-600' : 'text-orange-600'
                        }`}>
                          {isEarned ? `+${item.points}` : item.points} {isArabic ? 'نقطة' : 'pts'}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {isEarned ? '+' : ''}{item.equivalentAed} {isArabic ? 'درهم' : 'AED'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Legal / Founder Transparency Guarantee */}
          <div className="p-3.5 rounded-2xl bg-slate-100 border border-slate-200 text-slate-600 text-[11px] space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>{isArabic ? 'ميثاق التمويل المالي المستقل لتوفير:' : '100% Platform Funding Guarantee:'}</span>
            </div>
            <p className="leading-relaxed">
              {isArabic 
                ? 'تتحمل إدارة تطبيق فلاستر (Flaster) كافة الأعباء والخصومات المالية الناتجة عن استبدال نقاط الولاء دون اقتطاع أي فلس من مستحقات المطاعم أو تسويات الشركاء في رأس الخيمة.'
                : 'Flaster fully funds customer rewards. Merchants receive their exact agreed payouts with zero deductions for loyalty discounts.'}
            </p>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-slate-500">
            {isArabic ? 'الحد الأدنى للاستبدال: 100 نقطة (1 درهم)' : 'Min redemption: 100 pts (1 AED)'}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition-colors"
          >
            {isArabic ? 'إغلاق المحفظة' : 'Close Wallet'}
          </button>
        </div>

      </div>
    </div>
  );
};
