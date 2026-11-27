import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Coins,
  Clock,
  CheckCircle2,
  Star,
  ArrowUpRight,
  ArrowDownLeft,
  ShieldCheck,
  RefreshCw,
  Gift,
  ExternalLink,
  Share2,
  UserCheck,
  AlertTriangle,
  LogIn,
} from 'lucide-react';
import { Language } from '../types';
import confetti from 'canvas-confetti';
import {
  MIN_REDEMPTION_POINTS,
  SOCIAL_FOLLOW_PAGES,
  SOCIAL_FOLLOW_POINTS_PER_PAGE,
  SOCIAL_LINKTREE_URL,
  SocialFollowPageId,
} from '../config/platformConfig';
import { getAuthHeaders } from '../firebase/authHeaders';
import {
  PersistedCustomerWallet,
  PersistedLoyaltyTransaction,
  SocialFollowClaimRecord,
  saveCustomerWalletToFirestore,
  saveLoyaltyTransactionToFirestore,
  saveSocialFollowClaimToFirestore,
  subscribeToCustomerLoyaltyTransactions,
  subscribeToCustomerSocialClaims,
  subscribeToCustomerWalletFull,
} from '../firebase/db';

interface LoyaltyWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  customerId?: string;
  currentPoints?: number;
  customerName?: string;
  isAuthenticated?: boolean;
  onRequireAuth?: () => void;
  onPointsUpdated?: (newBalance: number) => void;
}

interface WalletViewState {
  availablePoints: number;
  equivalentAed: number;
  totalEarnedPoints: number;
  totalRedeemedPoints: number;
  totalExpiredPoints: number;
  welcomeBonusClaimed: boolean;
  completedOrdersCount: number;
  claimedSocialPages: string[];
  lastDailyLoginDate?: string;
  nextExpirationDate?: string;
  daysUntilExpiry: number;
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

const WALLET_CACHE_PREFIX = 'flaster_wallet_v2_';
const HISTORY_CACHE_PREFIX = 'flaster_wallet_history_v2_';

function getTodayUaeDate(): string {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Dubai' });
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function calcDaysUntilExpiry(nextExpIso?: string): number {
  if (!nextExpIso) return 120;
  const diffMs = Date.parse(nextExpIso) - Date.now();
  if (Number.isNaN(diffMs)) return 120;
  return Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
}

function loadCachedWallet(customerId: string): PersistedCustomerWallet | null {
  try {
    const raw = localStorage.getItem(`${WALLET_CACHE_PREFIX}${customerId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedCustomerWallet;
    if (typeof parsed.availablePoints === 'number') return parsed;
  } catch {
    // ignore storage errors
  }
  return null;
}

function saveCachedWallet(customerId: string, wallet: PersistedCustomerWallet) {
  try {
    localStorage.setItem(`${WALLET_CACHE_PREFIX}${customerId}`, JSON.stringify(wallet));
  } catch {
    // ignore storage errors
  }
}

function loadCachedHistory(customerId: string): TransactionItem[] {
  try {
    const raw = localStorage.getItem(`${HISTORY_CACHE_PREFIX}${customerId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveCachedHistory(customerId: string, txns: TransactionItem[]) {
  try {
    localStorage.setItem(`${HISTORY_CACHE_PREFIX}${customerId}`, JSON.stringify(txns.slice(0, 80)));
  } catch {
    // ignore storage errors
  }
}

export const LoyaltyWalletModal: React.FC<LoyaltyWalletModalProps> = ({
  isOpen,
  onClose,
  lang,
  customerId = 'guest',
  currentPoints = 0,
  customerName,
  isAuthenticated = false,
  onRequireAuth,
  onPointsUpdated,
}) => {
  const isArabic = lang === 'ar';
  const canPersistUser = Boolean(isAuthenticated && customerId && customerId !== 'guest');

  const [activeTab, setActiveTab] = useState<'all' | 'earned' | 'redeemed'>('all');
  const [wallet, setWallet] = useState<WalletViewState>(() => {
    const cached = canPersistUser ? loadCachedWallet(customerId) : null;
    const pts = cached ? cached.availablePoints : currentPoints;
    return {
      availablePoints: pts,
      equivalentAed: Number((pts / 100).toFixed(2)),
      totalEarnedPoints: cached?.totalEarnedPoints ?? pts,
      totalRedeemedPoints: cached?.totalRedeemedPoints ?? 0,
      totalExpiredPoints: cached?.totalExpiredPoints ?? 0,
      welcomeBonusClaimed: cached?.welcomeBonusClaimed ?? false,
      completedOrdersCount: cached?.completedOrdersCount ?? 0,
      claimedSocialPages: cached?.claimedSocialPages ?? [],
      lastDailyLoginDate: cached?.lastDailyLoginDate,
      nextExpirationDate: cached?.nextExpirationDate,
      daysUntilExpiry: calcDaysUntilExpiry(cached?.nextExpirationDate),
    };
  });
  const [history, setHistory] = useState<TransactionItem[]>(() =>
    canPersistUser ? loadCachedHistory(customerId) : []
  );
  const [socialClaims, setSocialClaims] = useState<SocialFollowClaimRecord[]>([]);
  const [socialHandleInputs, setSocialHandleInputs] = useState<Record<string, string>>({});
  const [busySocialPageId, setBusySocialPageId] = useState<string | null>(null);
  const [socialMessage, setSocialMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [claimingLogin, setClaimingLogin] = useState(false);
  const [loginClaimMessage, setLoginClaimMessage] = useState<string | null>(null);
  const [upcomingExpiryWarning, setUpcomingExpiryWarning] = useState(false);

  // Review Reward State
  const [showReviewInput, setShowReviewInput] = useState(false);
  const [reviewOrderId] = useState('FLASTER-ORDER');
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState<string | null>(null);

  const onPointsUpdatedRef = useRef(onPointsUpdated);
  onPointsUpdatedRef.current = onPointsUpdated;

  // Keep guest wallet points synced without tearing down Firestore subscriptions
  useEffect(() => {
    if (!isOpen || canPersistUser) return;
    setWallet((prev) => {
      if (prev.availablePoints === currentPoints) return prev;
      return {
        ...prev,
        availablePoints: currentPoints,
        equivalentAed: Number((currentPoints / 100).toFixed(2)),
      };
    });
  }, [isOpen, canPersistUser, currentPoints]);

  // Live Firestore + localStorage + backend hydration whenever modal opens or user changes
  useEffect(() => {
    if (!isOpen || !canPersistUser) return;

    const cached = loadCachedWallet(customerId);
    if (cached) {
      setWallet({
        availablePoints: cached.availablePoints,
        equivalentAed: Number((cached.availablePoints / 100).toFixed(2)),
        totalEarnedPoints: cached.totalEarnedPoints,
        totalRedeemedPoints: cached.totalRedeemedPoints,
        totalExpiredPoints: cached.totalExpiredPoints,
        welcomeBonusClaimed: cached.welcomeBonusClaimed,
        completedOrdersCount: cached.completedOrdersCount,
        claimedSocialPages: cached.claimedSocialPages,
        lastDailyLoginDate: cached.lastDailyLoginDate,
        nextExpirationDate: cached.nextExpirationDate,
        daysUntilExpiry: calcDaysUntilExpiry(cached.nextExpirationDate),
      });
    }
    const cachedHist = loadCachedHistory(customerId);
    if (cachedHist.length > 0) {
      setHistory(cachedHist);
    }

    const unsubWallet = subscribeToCustomerWalletFull(customerId, (liveWallet) => {
      if (!liveWallet) return;
      saveCachedWallet(customerId, liveWallet);
      const daysLeft = calcDaysUntilExpiry(liveWallet.nextExpirationDate);
      setUpcomingExpiryWarning(daysLeft <= 15);
      setWallet({
        availablePoints: liveWallet.availablePoints,
        equivalentAed: Number((liveWallet.availablePoints / 100).toFixed(2)),
        totalEarnedPoints: liveWallet.totalEarnedPoints,
        totalRedeemedPoints: liveWallet.totalRedeemedPoints,
        totalExpiredPoints: liveWallet.totalExpiredPoints,
        welcomeBonusClaimed: liveWallet.welcomeBonusClaimed,
        completedOrdersCount: liveWallet.completedOrdersCount,
        claimedSocialPages: liveWallet.claimedSocialPages,
        lastDailyLoginDate: liveWallet.lastDailyLoginDate,
        nextExpirationDate: liveWallet.nextExpirationDate,
        daysUntilExpiry: daysLeft,
      });
      onPointsUpdatedRef.current?.(liveWallet.availablePoints);
    });

    const unsubTxns = subscribeToCustomerLoyaltyTransactions(customerId, (liveTxns) => {
      if (liveTxns.length === 0) return;
      const mapped: TransactionItem[] = liveTxns.map((t) => ({
        id: t.id,
        type: t.type,
        points: t.points,
        equivalentAed: t.equivalentAed,
        note: t.note,
        relatedOrderId: t.relatedOrderId,
        createdAt: t.createdAt,
      }));
      setHistory((prev) => {
        const byId = new Map<string, TransactionItem>();
        prev.forEach((p) => byId.set(p.id, p));
        mapped.forEach((m) => byId.set(m.id, m));
        const merged = Array.from(byId.values()).sort(
          (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
        );
        saveCachedHistory(customerId, merged);
        return merged;
      });
    });

    const unsubClaims = subscribeToCustomerSocialClaims(customerId, (liveClaims) => {
      setSocialClaims(liveClaims);
    });

    // Also pull from backend endpoint (in case server has updates not yet cached)
    let active = true;
    (async () => {
      try {
        const headers = await getAuthHeaders(customerId);
        const res = await fetch(`/api/loyalty/wallet/${encodeURIComponent(customerId)}`, { headers });
        if (!active || !res.ok) return;
        const data = await res.json();
        if (active && data.success && data.wallet) {
          setWallet((prev) => {
            const bestPoints = Math.max(prev.availablePoints, data.wallet.availablePoints ?? 0);
            const mergedPages = Array.from(
              new Set([
                ...prev.claimedSocialPages,
                ...(Array.isArray(data.wallet.claimedSocialPages) ? data.wallet.claimedSocialPages : []),
              ])
            );
            return {
              ...prev,
              availablePoints: bestPoints,
              equivalentAed: Number((bestPoints / 100).toFixed(2)),
              claimedSocialPages: mergedPages,
              lastDailyLoginDate: prev.lastDailyLoginDate || data.wallet.lastDailyLoginDate,
            };
          });
          if (Array.isArray(data.history) && data.history.length > 0) {
            setHistory((prev) => {
              const byId = new Map<string, TransactionItem>();
              prev.forEach((p) => byId.set(p.id, p));
              (data.history as TransactionItem[]).forEach((h) => byId.set(h.id, h));
              const merged = Array.from(byId.values()).sort(
                (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
              );
              saveCachedHistory(customerId, merged);
              return merged;
            });
          }
        }
      } catch {
        // Firestore & localStorage remain authoritative
      }
    })();

    return () => {
      active = false;
      unsubWallet();
      unsubTxns();
      unsubClaims();
    };
  }, [isOpen, customerId, canPersistUser]);

  const persistWalletAndTransaction = async (
    nextWalletState: WalletViewState,
    txn: PersistedLoyaltyTransaction
  ) => {
    const nowIso = new Date().toISOString();
    const persistedWallet: PersistedCustomerWallet = {
      customerId,
      customerName: customerName || undefined,
      availablePoints: nextWalletState.availablePoints,
      totalEarnedPoints: nextWalletState.totalEarnedPoints,
      totalRedeemedPoints: nextWalletState.totalRedeemedPoints,
      totalExpiredPoints: nextWalletState.totalExpiredPoints,
      welcomeBonusClaimed: nextWalletState.welcomeBonusClaimed,
      completedOrdersCount: nextWalletState.completedOrdersCount,
      claimedSocialPages: nextWalletState.claimedSocialPages,
      lastDailyLoginDate: nextWalletState.lastDailyLoginDate,
      nextExpirationDate:
        nextWalletState.nextExpirationDate ||
        new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: nowIso,
    };

    setWallet(nextWalletState);
    saveCachedWallet(customerId, persistedWallet);
    onPointsUpdated?.(nextWalletState.availablePoints);

    const txnView: TransactionItem = {
      id: txn.id,
      type: txn.type,
      points: txn.points,
      equivalentAed: txn.equivalentAed,
      note: txn.note,
      relatedOrderId: txn.relatedOrderId,
      createdAt: txn.createdAt,
    };
    setHistory((prev) => {
      const next = [txnView, ...prev.filter((t) => t.id !== txn.id)];
      saveCachedHistory(customerId, next);
      return next;
    });

    await Promise.all([
      saveCustomerWalletToFirestore(persistedWallet),
      saveLoyaltyTransactionToFirestore(txn),
    ]);
  };

  // Claim Daily Login Reward (+1 Point, permanently saved to Firestore + localStorage + backend)
  const handleClaimDailyLogin = async () => {
    if (!canPersistUser) {
      setLoginClaimMessage(
        isArabic
          ? 'يرجى تسجيل الدخول بحسابك أولاً حتى تُحفظ نقاطك اليومية بشكل دائم.'
          : 'Please sign in first so your daily points are permanently saved.'
      );
      onRequireAuth?.();
      return;
    }

    const todayStr = getTodayUaeDate();
    if (wallet.lastDailyLoginDate === todayStr) {
      setLoginClaimMessage(
        isArabic
          ? 'لقد حصلت على نقطة الدخول اليومي اليوم بالفعل! عُد غداً لكسب نقطة جديدة.'
          : 'You already claimed today’s daily check-in point. Come back tomorrow!'
      );
      return;
    }

    setClaimingLogin(true);
    setLoginClaimMessage(null);
    const nowIso = new Date().toISOString();
    const expiryIso = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString();

    try {
      const nextPoints = wallet.availablePoints + 1;
      const nextWallet: WalletViewState = {
        ...wallet,
        availablePoints: nextPoints,
        equivalentAed: Number((nextPoints / 100).toFixed(2)),
        totalEarnedPoints: wallet.totalEarnedPoints + 1,
        lastDailyLoginDate: todayStr,
        nextExpirationDate: wallet.nextExpirationDate || expiryIso,
        daysUntilExpiry: calcDaysUntilExpiry(wallet.nextExpirationDate || expiryIso),
      };

      const txn: PersistedLoyaltyTransaction = {
        id: `TXN-DAILY-${todayStr}-${Date.now()}`,
        customerId,
        type: 'daily_login',
        points: 1,
        equivalentFils: 1,
        equivalentAed: 0.01,
        note: isArabic
          ? `مكافأة تسجيل الدخول اليومي (${todayStr})`
          : `Daily check-in reward (${todayStr})`,
        status: 'COMPLETED',
        createdAt: nowIso,
        expiryDate: expiryIso,
      };

      await persistWalletAndTransaction(nextWallet, txn);

      // Sync with backend route in background
      try {
        const headers = await getAuthHeaders(customerId);
        await fetch('/api/loyalty/daily-login', {
          method: 'POST',
          headers,
          body: JSON.stringify({ customerId }),
        });
      } catch {
        // Firestore persistence already succeeded
      }

      setLoginClaimMessage(
        isArabic
          ? '✓ تم إضافة +1 نقطة وحفظها في حسابك بنجاح!'
          : '✓ +1 daily point earned and permanently saved!'
      );
      try {
        confetti({ particleCount: 45, spread: 60, origin: { y: 0.6 } });
      } catch {
        // ignore
      }
    } finally {
      setClaimingLogin(false);
    }
  };

  // Claim Social Follow Reward (+5 Points per platform with @username handle verification)
  const handleVerifySocialFollow = async (pageId: SocialFollowPageId, label: string) => {
    setSocialMessage(null);

    if (!canPersistUser) {
      setSocialMessage({
        type: 'error',
        text: isArabic
          ? 'يرجى تسجيل الدخول بحسابك أولاً لتوثيق المتابعة وحفظ النقاط.'
          : 'Please sign in first to verify your follow and save points.',
      });
      onRequireAuth?.();
      return;
    }

    const existingClaim = socialClaims.find((c) => c.pageId === pageId);
    if (existingClaim?.status === 'active' || wallet.claimedSocialPages.includes(pageId)) {
      setSocialMessage({
        type: 'error',
        text: isArabic
          ? `تم احتساب 5 نقاط مسبقاً لمتابعة ${label}.`
          : `You already claimed 5 points for following ${label}.`,
      });
      return;
    }

    const rawHandle = (socialHandleInputs[pageId] || '').trim();
    if (rawHandle.length < 2) {
      setSocialMessage({
        type: 'error',
        text: isArabic
          ? `أدخل اسم حسابك (@username) على ${label} بعد المتابعة لتتمكن الإدارة من التحقق.`
          : `Enter your @username handle on ${label} after following so Admin can verify.`,
      });
      return;
    }

    const normalizedHandle = rawHandle.startsWith('@') ? rawHandle : `@${rawHandle}`;
    setBusySocialPageId(pageId);

    try {
      const nowIso = new Date().toISOString();
      const expiryIso = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString();
      const nextPoints = wallet.availablePoints + SOCIAL_FOLLOW_POINTS_PER_PAGE;
      const nextClaimedPages = Array.from(new Set([...wallet.claimedSocialPages, pageId]));

      const claimRecord: SocialFollowClaimRecord = {
        id: `CLAIM_${customerId.slice(0, 48)}_${pageId}`,
        customerId,
        customerName: customerName || undefined,
        pageId,
        handle: normalizedHandle,
        pointsAwarded: 5,
        status: 'active',
        claimedAt: nowIso,
        updatedAt: nowIso,
      };

      const nextWallet: WalletViewState = {
        ...wallet,
        availablePoints: nextPoints,
        equivalentAed: Number((nextPoints / 100).toFixed(2)),
        totalEarnedPoints: wallet.totalEarnedPoints + SOCIAL_FOLLOW_POINTS_PER_PAGE,
        claimedSocialPages: nextClaimedPages,
        nextExpirationDate: wallet.nextExpirationDate || expiryIso,
        daysUntilExpiry: calcDaysUntilExpiry(wallet.nextExpirationDate || expiryIso),
      };

      const txn: PersistedLoyaltyTransaction = {
        id: `TXN-SOCIAL-${pageId}-${Date.now()}`,
        customerId,
        type: 'social_follow',
        points: SOCIAL_FOLLOW_POINTS_PER_PAGE,
        equivalentFils: SOCIAL_FOLLOW_POINTS_PER_PAGE,
        equivalentAed: Number((SOCIAL_FOLLOW_POINTS_PER_PAGE / 100).toFixed(2)),
        note: isArabic
          ? `مكافأة متابعة ${label} (${normalizedHandle}) — +5 نقاط`
          : `Follow reward for ${label} (${normalizedHandle}) — +5 pts`,
        status: 'COMPLETED',
        createdAt: nowIso,
        expiryDate: expiryIso,
      };

      setSocialClaims((prev) => [claimRecord, ...prev.filter((c) => c.pageId !== pageId)]);
      await Promise.all([
        persistWalletAndTransaction(nextWallet, txn),
        saveSocialFollowClaimToFirestore(claimRecord),
      ]);

      try {
        const headers = await getAuthHeaders(customerId);
        await fetch('/api/loyalty/social-follow', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            customerId,
            pageId,
            handle: normalizedHandle,
          }),
        });
      } catch {
        // Firestore persistence already succeeded
      }

      setSocialHandleInputs((prev) => ({ ...prev, [pageId]: '' }));
      setSocialMessage({
        type: 'success',
        text: isArabic
          ? `✓ تم توثيق متابعتك لصفحة ${label} (${normalizedHandle}) وإضافة +5 نقاط وحفظها في رصيدك!`
          : `✓ Verified ${label} follow (${normalizedHandle}) and credited +5 points!`,
      });
      try {
        confetti({ particleCount: 55, spread: 65, origin: { y: 0.55 } });
      } catch {
        // ignore
      }
    } finally {
      setBusySocialPageId(null);
    }
  };

  // Submit Review Reward (+10 Points, permanently saved to Firestore + localStorage + backend)
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPersistUser) {
      setReviewMessage(
        isArabic
          ? 'يرجى تسجيل الدخول أولاً لحفظ نقاط التقييم في حسابك.'
          : 'Please sign in first to save review points.'
      );
      onRequireAuth?.();
      return;
    }

    setSubmittingReview(true);
    setReviewMessage(null);
    const nowIso = new Date().toISOString();
    const expiryIso = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString();
    const orderRef = `${reviewOrderId}-${Date.now()}`;

    try {
      const nextPoints = wallet.availablePoints + 10;
      const nextWallet: WalletViewState = {
        ...wallet,
        availablePoints: nextPoints,
        equivalentAed: Number((nextPoints / 100).toFixed(2)),
        totalEarnedPoints: wallet.totalEarnedPoints + 10,
        nextExpirationDate: wallet.nextExpirationDate || expiryIso,
        daysUntilExpiry: calcDaysUntilExpiry(wallet.nextExpirationDate || expiryIso),
      };

      const txn: PersistedLoyaltyTransaction = {
        id: `TXN-REV-${Date.now()}`,
        customerId,
        type: 'review_reward',
        points: 10,
        equivalentFils: 10,
        equivalentAed: 0.1,
        relatedOrderId: orderRef,
        note: isArabic
          ? `مكافأة تقييم تجربة الشراء (${reviewRating}/5)`
          : `Order review reward (${reviewRating}/5)`,
        status: 'COMPLETED',
        createdAt: nowIso,
        expiryDate: expiryIso,
      };

      await persistWalletAndTransaction(nextWallet, txn);

      try {
        const headers = await getAuthHeaders(customerId);
        await fetch('/api/loyalty/review', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            customerId,
            orderId: orderRef,
            rating: reviewRating,
            comment: reviewComment,
          }),
        });
      } catch {
        // Firestore persistence already succeeded
      }

      setReviewMessage(
        isArabic
          ? '✓ تمت إضافة +10 نقاط لتقييمك وحفظها في رصيدك!'
          : '✓ +10 points added and saved for your review!'
      );
      setShowReviewInput(false);
      setReviewComment('');
      try {
        confetti({ particleCount: 70, spread: 70, origin: { y: 0.5 } });
      } catch {
        // ignore
      }
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

  const todayClaimed = wallet.lastDailyLoginDate === getTodayUaeDate();
  const minRedeemAed = (MIN_REDEMPTION_POINTS / 100).toFixed(0);
  const progressPercent = Math.min(100, Math.round((wallet.availablePoints / MIN_REDEMPTION_POINTS) * 100));

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
                    {isArabic ? 'نقاطي — محفظة مكافآت فلاستر' : 'My Points — Flaster Rewards'}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-bold border border-amber-400/30">
                    {isArabic ? '100 نقطة = 1 درهم' : '100 Pts = 1 AED'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-0.5">
                  {isArabic
                    ? 'رصيدك محفوظ تلقائياً في حسابك بشكل دائم • ممول 100% من فلاستر'
                    : 'Permanently saved to your account • 100% funded by Flaster'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 border border-white/10 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Sign-In Notice for Guests */}
          {!canPersistUser && (
            <div className="mt-4 p-3 rounded-xl bg-amber-500/20 border border-amber-400/40 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-amber-100 font-semibold">
                {isArabic
                  ? 'سجّل الدخول بحسابك لحفظ نقاطك اليومية ونقاط المتابعة بشكل دائم في السحابة.'
                  : 'Sign in to permanently save your daily and follow points to your account.'}
              </span>
              {onRequireAuth && (
                <button
                  type="button"
                  onClick={onRequireAuth}
                  className="px-3 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-stone-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'تسجيل الدخول' : 'Sign In'}</span>
                </button>
              )}
            </div>
          )}

          {/* Balance Card */}
          <div className="mt-4 p-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1 w-full">
              <span className="text-xs text-slate-300 font-medium block">
                {isArabic ? 'الرصيد المحفوظ المتاح:' : 'Saved Active Balance:'}
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="font-headline font-extrabold text-3xl sm:text-4xl text-amber-300 tracking-tight tabular-nums">
                  {wallet.availablePoints}
                </span>
                <span className="text-sm font-semibold text-slate-300">
                  {isArabic ? 'نقطة ولاء' : 'Points'}
                </span>
                <span className="text-slate-400 text-sm">•</span>
                <span className="text-sm font-bold text-emerald-300 tabular-nums">
                  ≈ {wallet.equivalentAed.toFixed(2)} {isArabic ? 'درهم' : 'AED'}
                </span>
              </div>
              {/* Progress towards 1,000 points redemption */}
              <div className="mt-2.5 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-300 font-metric">
                  <span>
                    {wallet.availablePoints >= MIN_REDEMPTION_POINTS
                      ? isArabic
                        ? '✓ مؤهل للاستبدال الفوري عند الدفع!'
                        : '✓ Ready to redeem at checkout!'
                      : isArabic
                        ? `التقدم نحو الحد الأدنى للاستبدال (${MIN_REDEMPTION_POINTS} نقطة = ${minRedeemAed} دراهم)`
                        : `Progress to minimum redemption (${MIN_REDEMPTION_POINTS} pts = ${minRedeemAed} AED)`}
                  </span>
                  <span className="font-bold text-amber-300">{progressPercent}%</span>
                </div>
                <div className="h-1.5 w-full bg-white/15 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Quick Action: Daily Check-In */}
            <button
              onClick={handleClaimDailyLogin}
              disabled={claimingLogin || todayClaimed}
              className={`w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-md active:scale-95 transition-all shrink-0 cursor-pointer ${
                todayClaimed
                  ? 'bg-emerald-500/25 border border-emerald-400/40 text-emerald-200 cursor-default'
                  : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 shadow-amber-500/20 disabled:opacity-50'
              }`}
            >
              {claimingLogin ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : todayClaimed ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <Gift className="w-4 h-4" />
              )}
              <span>
                {todayClaimed
                  ? isArabic
                    ? 'تم تسجيل دخول اليوم ✓'
                    : 'Claimed Today ✓'
                  : isArabic
                    ? 'سجل دخولك اليومي (+1 نقطة)'
                    : 'Daily Check-in (+1 Pt)'}
              </span>
            </button>
          </div>

          {/* 4-Month Expiry Pill Alert */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] bg-slate-800/80 rounded-xl px-3.5 py-2 border border-slate-700/60">
            <div className="flex items-center gap-2 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                {isArabic
                  ? 'دورة صلاحية النقاط: 4 أشهر (120 يوماً) من تاريخ الاكتساب.'
                  : '4-Month Expiration Cycle (120 Days validity).'}
              </span>
            </div>
            <span
              className={`font-bold px-2 py-0.5 rounded-md ${
                upcomingExpiryWarning
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse'
                  : 'bg-emerald-500/20 text-emerald-300'
              }`}
            >
              {isArabic
                ? `متبقي على دورة التصفير: ${wallet.daysUntilExpiry} يوماً`
                : `${wallet.daysUntilExpiry} days remaining`}
            </span>
          </div>

          {loginClaimMessage && (
            <div className="mt-2 text-xs font-semibold text-amber-200 bg-amber-900/60 p-2 rounded-lg border border-amber-500/30">
              {loginClaimMessage}
            </div>
          )}
        </div>

        {/* Earning Rules Quick Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-slate-100 rtl:divide-x-reverse border-b border-slate-200 bg-slate-50 text-center py-2.5 px-3 text-xs font-medium text-slate-600">
          <div className="px-2">
            <span className="block font-bold text-slate-900 font-metric">+1 {isArabic ? 'نقطة' : 'pt'}</span>
            <span className="text-[10px] text-slate-500">{isArabic ? 'دخول يومي' : 'Daily Login'}</span>
          </div>
          <div className="px-2">
            <span className="block font-bold text-[#DC2626] font-metric">+5 {isArabic ? 'نقاط' : 'pts'}</span>
            <span className="text-[10px] text-slate-500">{isArabic ? 'متابعة كل منصة' : 'Per Social Follow'}</span>
          </div>
          <div className="px-2">
            <span className="block font-bold text-orange-600 font-metric">+15 {isArabic ? 'نقطة' : 'pts'}</span>
            <span className="text-[10px] text-slate-500">{isArabic ? 'كل طلب مكتمل' : 'Completed Order'}</span>
          </div>
          <div className="px-2">
            <span className="block font-bold text-emerald-600 font-metric">+10 {isArabic ? 'نقاط' : 'pts'}</span>
            <span className="text-[10px] text-slate-500">{isArabic ? 'تقييم الطلب' : 'Order Review'}</span>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Social Follow Rewards (+5 pts per platform with @username Verification & Unfollow Deduction Policy) */}
          <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#EAE4DC] space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <div>
                <h4 className="font-headline font-extrabold text-sm text-[#1C1917] flex items-center gap-2">
                  <Share2 className="w-4 h-4 text-[#DC2626]" />
                  <span>
                    {isArabic
                      ? 'تابع منصاتنا الرسمية واكسب 5 نقاط على كل منصة'
                      : 'Follow Our Official Platforms & Earn 5 Points Each'}
                  </span>
                </h4>
                <p className="text-[11px] text-[#57534E] mt-0.5 leading-relaxed">
                  {isArabic
                    ? 'افتح رابط صفحاتنا، تابع المنصة، ثم أدخل اسم حسابك (@username) لتوثيق المتابعة وإضافة +5 نقاط. في حال إلغاء المتابعة لاحقاً يتم خصم الـ 5 نقاط من رصيدك.'
                    : 'Open our official links, follow the platform, then enter your @username to claim +5 pts. Unfollowing later deducts 5 points from your balance.'}
                </p>
              </div>
              <a
                href={SOCIAL_LINKTREE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-[11px] flex items-center gap-1.5 shrink-0 self-start sm:self-center shadow-xs transition-colors"
              >
                <span dir="ltr">linktr.ee/flaster</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {socialMessage && (
              <div
                className={`p-2.5 rounded-xl text-xs font-bold flex items-center gap-2 border ${
                  socialMessage.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-red-50 border-red-200 text-red-900'
                }`}
              >
                {socialMessage.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-[#DC2626] shrink-0" />
                )}
                <span>{socialMessage.text}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SOCIAL_FOLLOW_PAGES.map((page) => {
                const label = isArabic ? page.nameAr : page.nameEn;
                const claim = socialClaims.find((c) => c.pageId === page.id);
                const isRevoked = claim?.status === 'revoked';
                const isActiveClaimed =
                  !isRevoked &&
                  (claim?.status === 'active' || wallet.claimedSocialPages.includes(page.id));
                const isBusy = busySocialPageId === page.id;

                return (
                  <div
                    key={page.id}
                    className={`p-3 rounded-xl border space-y-2 ${
                      isActiveClaimed
                        ? 'bg-emerald-50/70 border-emerald-200'
                        : isRevoked
                          ? 'bg-red-50/60 border-red-200'
                          : 'bg-white border-[#EAE4DC]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-headline font-bold text-xs text-[#1C1917]">{label}</span>
                      {isActiveClaimed ? (
                        <span className="text-[10px] font-bold text-[#059669] flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{isArabic ? 'موثّق (+5 نقاط)' : 'Verified (+5 pts)'}</span>
                        </span>
                      ) : isRevoked ? (
                        <span className="text-[10px] font-bold text-[#DC2626] flex items-center gap-1">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>{isArabic ? 'تم خصم -5 (إلغاء متابعة)' : 'Deducted -5 (Unfollowed)'}</span>
                        </span>
                      ) : (
                        <a
                          href={SOCIAL_LINKTREE_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] font-bold text-[#DC2626] hover:underline flex items-center gap-1"
                        >
                          <span>{isArabic ? 'افتح الصفحة' : 'Open Page'}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    {isActiveClaimed ? (
                      <p className="text-[11px] text-emerald-900 font-metric">
                        {claim?.handle
                          ? `${isArabic ? 'الحساب الموثّق:' : 'Verified handle:'} ${claim.handle}`
                          : isArabic
                            ? 'تم احتساب 5 نقاط لمتابعة هذه المنصة'
                            : '5 points credited for this platform'}
                      </p>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          dir="ltr"
                          value={socialHandleInputs[page.id] || ''}
                          onChange={(e) =>
                            setSocialHandleInputs((prev) => ({
                              ...prev,
                              [page.id]: e.target.value,
                            }))
                          }
                          placeholder="@username"
                          className="flex-1 h-8 px-2.5 bg-[#FAF7F2] border border-[#EAE4DC] rounded-lg text-[11px] font-metric text-[#1C1917] focus:outline-none focus:border-[#DC2626]"
                        />
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => handleVerifySocialFollow(page.id, label)}
                          className="h-8 px-2.5 rounded-lg bg-[#1C1917] hover:bg-stone-800 disabled:opacity-50 text-white font-bold text-[10px] flex items-center gap-1 shrink-0 cursor-pointer transition-colors"
                        >
                          <UserCheck className="w-3 h-3 text-amber-300" />
                          <span>{isArabic ? 'تأكيد (+5)' : 'Verify (+5)'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Review Reward Section (Interactive) */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-200 text-amber-800 flex items-center justify-center shrink-0">
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
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition-colors shrink-0 cursor-pointer"
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
                        className="p-1 focus:outline-none cursor-pointer"
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
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {submittingReview
                      ? isArabic
                        ? 'جاري الإرسال...'
                        : 'Submitting...'
                      : isArabic
                        ? 'إرسال التقييم واستلام 10 نقاط'
                        : 'Submit & Earn 10 Pts'}
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
                {isArabic ? 'سجل حركات المحفظة المحفوظة:' : 'Saved Rewards Activity:'}
              </h4>
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                    activeTab === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                  }`}
                >
                  {isArabic ? 'الكل' : 'All'}
                </button>
                <button
                  onClick={() => setActiveTab('earned')}
                  className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
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
                  {isArabic ? 'المستبدلة / المخصومة' : 'Redeemed / Deducted'}
                </button>
              </div>
            </div>

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
                        <div
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold ${
                            isEarned ? 'bg-emerald-100 text-emerald-600' : 'bg-orange-100 text-orange-600'
                          }`}
                        >
                          {isEarned ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                        </div>
                        <div>
                          <p className="font-bold text-[#1C1917]">
                            {item.note || (isEarned ? 'نقاط مكتسبة' : 'خصم / استبدال نقاط')}
                          </p>
                          <p className="text-[10px] text-slate-500 font-metric mt-0.5">
                            {new Date(item.createdAt).toLocaleDateString(isArabic ? 'ar-AE' : 'en-US', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>

                      <div className="text-end">
                        <span
                          className={`font-metric font-extrabold text-sm block ${
                            isEarned ? 'text-emerald-600' : 'text-orange-600'
                          }`}
                        >
                          {isEarned ? `+${item.points}` : item.points} {isArabic ? 'نقطة' : 'pts'}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-400">
                          {isEarned ? '+' : ''}
                          {item.equivalentAed} {isArabic ? 'درهم' : 'AED'}
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
              <span>{isArabic ? 'ميثاق التمويل المالي المستقل لفلاستر:' : '100% Platform Funding Guarantee:'}</span>
            </div>
            <p className="leading-relaxed">
              {isArabic
                ? 'تتحمل إدارة تطبيق فلاستر (Flaster) كافة الأعباء والخصومات المالية الناتجة عن استبدال نقاط الولاء دون اقتطاع أي فلس من مستحقات المطاعم أو تسويات الشركاء.'
                : 'Flaster fully funds customer rewards. Merchants receive their exact agreed payouts with zero deductions for loyalty discounts.'}
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-slate-600 font-semibold">
            {isArabic
              ? `الحد الأدنى للاستبدال: ${MIN_REDEMPTION_POINTS} نقطة (${minRedeemAed} دراهم)`
              : `Min redemption: ${MIN_REDEMPTION_POINTS} pts (${minRedeemAed} AED)`}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition-colors cursor-pointer"
          >
            {isArabic ? 'إغلاق المحفظة' : 'Close Wallet'}
          </button>
        </div>
      </div>
    </div>
  );
};
