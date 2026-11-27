import React, { useState, useEffect } from 'react';
import { 
  Language, 
  Category, 
  SurplusItem, 
  CartItem, 
  Order, 
  MerchantListing,
  DynamicRegion,
  DynamicCategory,
  UserAddress,
  CustomerProfile,
  MerchantPartner,
  MerchantAccountPublicInfo,
  OrderWorkflowStatus
} from './types';
import { translations } from './translations';
import { 
  INITIAL_SURPLUS_ITEMS, 
  INITIAL_MERCHANT_LISTINGS,
  INITIAL_MERCHANT_PARTNERS
} from './data/mockData';
import { 
  PersistedCustomerWallet,
  subscribeToSurplusItems, 
  subscribeToMerchantPartners,
  subscribeToPlatformSettings, 
  subscribeToCustomerWalletFull,
  saveCustomerWalletToFirestore,
  saveLoyaltyTransactionToFirestore,
  isSurplusItemExpired,
  saveOrderToFirestore,
  saveSurplusItemToFirestore,
  deleteSurplusItemFromFirestore,
  deleteMerchantPartnerFromFirestore
} from './firebase/db';
import { 
  submitOrderToBackend, 
  updateOrderStatusOnBackend, 
  verifyPickupOnBackend, 
  requestOrderRefundOnBackend,
  fetchOrdersFromBackend,
  registerCatalogItemOnBackend
} from './firebase/orders';
import { getAuthHeaders, setPortalSessionToken } from './firebase/authHeaders';
import { 
  CUSTOMER_SERVICE_FEE_FILS,
  DEFAULT_PLATFORM_SETTINGS, 
  PlatformSettings, 
  ADMIN_EMAIL_ALLOWLIST,
  aedToFils, 
  filsToAed, 
  getCustomerItemPriceAed,
  calculateIncludedVatFils, 
  formatSequentialInvoiceNumber 
} from './config/platformConfig';
import { useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { EcoTicker } from './components/EcoTicker';
import { CategoryFilter } from './components/CategoryFilter';
import { SurplusCard } from './components/SurplusCard';
import { SunsetUrgencyBanner } from './components/SunsetUrgencyBanner';
import { ItemDetailModal } from './components/ItemDetailModal';
import { ActiveOrdersModal } from './components/ActiveOrdersModal';
import { CartDrawer } from './components/CartDrawer';
import { ImpactModal } from './components/ImpactModal';
import { MerchantWorkspace } from './components/MerchantWorkspace';
import { HowItWorksModal } from './components/HowItWorksModal';
import { MerchantAuthModal } from './components/MerchantAuthModal';
import { InteractiveMapView } from './components/InteractiveMapView';
import { PaymentModal } from './components/PaymentModal';
import { GlobalDomTranslator } from './components/GlobalDomTranslator';
import { LoyaltyWalletModal } from './components/LoyaltyWalletModal';
import { CustomerAuthModal } from './components/CustomerAuthModal';
import { AddressManagerModal } from './components/AddressManagerModal';
import { DigitalReceiptModal } from './components/DigitalReceiptModal';
import { FAQModal } from './components/FAQModal';
import { CustomerSupportModal } from './components/CustomerSupportModal';
import { LegalModal } from './components/LegalModal';
import { LegalConsentModal } from './components/LegalConsentModal';
import { AdminFoundersDashboard } from './components/AdminFoundersDashboard';
import { SocialMediaKitModal } from './components/SocialMediaKitModal';
import { RestaurantPartnerModal } from './components/RestaurantPartnerModal';
import { SocialLinksRewardsBanner } from './components/SocialLinksRewardsBanner';
import { PWAUpdateBanner } from './components/PWAUpdateBanner';
import { 
  Leaf, 
  ShieldCheck, 
  HeartHandshake, 
  Utensils, 
  BellRing,
  Share2,
  Download,
  Sparkles,
  Clock
} from 'lucide-react';
import confetti from 'canvas-confetti';
import flasterLogoImg from './assets/images/flaster_new_icon_1795639863426.jpg';

export default function App() {
  const { currentUser, signOut } = useAuth();
  const [lang, setLang] = useState<Language>('ar');
  const [viewMode, setViewMode] = useState<'consumer' | 'merchant' | 'admin'>('consumer');
  const [selectedLocation, setSelectedLocation] = useState<string>('region-all');
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterExpiringOnly, setFilterExpiringOnly] = useState<boolean>(false);
  const [isMapView, setIsMapView] = useState<boolean>(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState<boolean>(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isSocialMediaKitOpen, setIsSocialMediaKitOpen] = useState<boolean>(false);
  const [isPartnerModalOpen, setIsPartnerModalOpen] = useState<boolean>(false);
  const [isLegalConsentOpen, setIsLegalConsentOpen] = useState<boolean>(() => !localStorage.getItem('flaster_legal_accepted'));

  // Dynamic Regions & Categories fetched from database
  const [regions, setRegions] = useState<DynamicRegion[]>([]);
  const [categories, setCategories] = useState<DynamicCategory[]>([]);

  // Customer Profile & Saved Addresses (Starts clean with zero demo data)
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([]);

  // Core Data State (Clean production slate synced live with Firestore)
  const [items, setItems] = useState<SurplusItem[]>(INITIAL_SURPLUS_ITEMS);
  const [merchantListings, setMerchantListings] = useState<MerchantListing[]>(INITIAL_MERCHANT_LISTINGS);
  const [pausedListingIds, setPausedListingIds] = useState<string[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [invoiceCounter, setInvoiceCounter] = useState<number>(1001);
  const [platformSettings, setPlatformSettings] = useState<PlatformSettings>(DEFAULT_PLATFORM_SETTINGS);
  const [orders, setOrders] = useState<Order[]>([]);

  // Modal / Drawer visibility
  const [selectedItem, setSelectedItem] = useState<SurplusItem | null>(null);
  const [isOrdersOpen, setIsOrdersOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isImpactOpen, setIsImpactOpen] = useState(false);
  const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isLoyaltyOpen, setIsLoyaltyOpen] = useState(false);
  // Real balance synced live with Firestore /wallets/{uid} + localStorage mirror
  const [loyaltyPoints, setLoyaltyPoints] = useState<number>(0);
  const [customerWalletSnapshot, setCustomerWalletSnapshot] = useState<PersistedCustomerWallet | null>(null);
  const [firstOrderBonusClaimed, setFirstOrderBonusClaimed] = useState<boolean>(false);
  const [checkoutItems, setCheckoutItems] = useState<{ item: SurplusItem; quantity: number }[]>([]);
  const [liveNotification, setLiveNotification] = useState<{ title: string; body: string } | null>(null);

  // Customer Services & Modals
  const [isCustomerAuthOpen, setIsCustomerAuthOpen] = useState(false);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isFaqModalOpen, setIsFaqModalOpen] = useState(false);
  const [isSupportModalOpen, setIsSupportModalOpen] = useState(false);
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [legalInitialTab, setLegalInitialTab] = useState<'privacy' | 'terms' | 'refund' | 'food_safety' | 'contact'>('terms');
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Per-Restaurant Portal Authentication state
  const [isMerchantAuthenticated, setIsMerchantAuthenticated] = useState(false);
  const [authenticatedMerchant, setAuthenticatedMerchant] = useState<MerchantAccountPublicInfo | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Dynamic Platform Commission Rate
  const [platformCommissionRate, setPlatformCommissionRate] = useState<number>(15);

  // Per-store Custom Commission Partner Registry
  const [merchantPartners, setMerchantPartners] = useState<MerchantPartner[]>(INITIAL_MERCHANT_PARTNERS);

  const handleUpdateMerchantCommission = (merchantId: string, newRate: number) => {
    setMerchantPartners((prev) =>
      prev.map((m) => (m.id === merchantId ? { ...m, commissionPercent: newRate } : m))
    );
  };

  const handleAddPartnerStore = (newPartner: MerchantPartner, newItem?: SurplusItem) => {
    setMerchantPartners((prev) => [newPartner, ...prev.filter((m) => m.id !== newPartner.id)]);
    if (newItem) {
      setItems((prev) => [newItem, ...prev.filter((it) => it.id !== newItem.id)]);
    }
    // Immediately sync the newly added store into Partner Portal if founder/admin is active
    if (isMasterFounder) {
      setIsMerchantAuthenticated(true);
      setAuthenticatedMerchant({
        merchantId: newPartner.id,
        username: newPartner.username || newPartner.id.replace(/^merchant-/, ''),
        name: newPartner.name,
        nameAr: newPartner.nameAr,
        phone: newPartner.phone || '+971500000000',
        disabled: Boolean(newPartner.disabled),
        failedAttempts: 0,
        lockedUntil: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const handleDeleteMerchant = (merchantId: string) => {
    setMerchantPartners((prev) => prev.filter((m) => m.id !== merchantId));
    setItems((prev) => prev.filter((it) => it.merchant.id !== merchantId));
    void deleteMerchantPartnerFromFirestore(merchantId);
  };

  const handleUpdateMerchantStatus = (merchantId: string, disabled: boolean) => {
    setMerchantPartners((prev) =>
      prev.map((m) => (m.id === merchantId ? { ...m, disabled } : m))
    );
  };

  const activeFounderEmail = (customerProfile?.email || currentUser?.email || '').toLowerCase();
  const isMasterFounder = Boolean(
    currentUser?.isAdmin ||
    (activeFounderEmail && ADMIN_EMAIL_ALLOWLIST.includes(activeFounderEmail))
  );

  // Sync authenticated Firebase user into customerProfile on session restore or Google Sign-In
  useEffect(() => {
    if (currentUser && !currentUser.isAnonymous && !customerProfile) {
      setCustomerProfile({
        id: currentUser.uid,
        name:
          currentUser.displayName ||
          currentUser.email?.split('@')[0] ||
          (lang === 'ar' ? 'حساب فلاستر' : 'Flaster Account'),
        phone: currentUser.phone || '+971504116994',
        email: currentUser.email || '',
        savedAddresses,
        loyaltyPoints,
        welcomeBonusClaimed: false,
        completedOrdersCount: 0,
        joinedAt: new Date().toISOString(),
      });
    }
  }, [currentUser, customerProfile, lang, loyaltyPoints, savedAddresses]);

  // Auto-authenticate master founders & keep active Partner Portal store synced live with Admin changes
  useEffect(() => {
    if (isMasterFounder && viewMode === 'merchant' && !isMerchantAuthenticated) {
      setIsMerchantAuthenticated(true);
    }

    if (merchantPartners.length === 0) return;

    if (isMasterFounder) {
      const currentExists = authenticatedMerchant
        ? merchantPartners.find((m) => m.id === authenticatedMerchant.merchantId)
        : undefined;

      if (!authenticatedMerchant || authenticatedMerchant.merchantId === 'merchant-master' || !currentExists) {
        const firstStore = merchantPartners[0];
        if (!authenticatedMerchant || authenticatedMerchant.merchantId !== firstStore.id) {
          setAuthenticatedMerchant({
            merchantId: firstStore.id,
            username: firstStore.username || firstStore.id.replace(/^merchant-/, ''),
            name: firstStore.name,
            nameAr: firstStore.nameAr,
            phone: firstStore.phone || '+971500000000',
            disabled: Boolean(firstStore.disabled),
            failedAttempts: 0,
            lockedUntil: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      } else if (
        currentExists.name !== authenticatedMerchant.name ||
        currentExists.nameAr !== authenticatedMerchant.nameAr ||
        Boolean(currentExists.disabled) !== Boolean(authenticatedMerchant.disabled)
      ) {
        setAuthenticatedMerchant((prev) =>
          prev
            ? {
                ...prev,
                name: currentExists.name,
                nameAr: currentExists.nameAr,
                phone: currentExists.phone || prev.phone,
                disabled: Boolean(currentExists.disabled),
              }
            : prev
        );
      }
    } else if (authenticatedMerchant) {
      const livePartner = merchantPartners.find((m) => m.id === authenticatedMerchant.merchantId);
      if (
        livePartner &&
        (livePartner.name !== authenticatedMerchant.name ||
          livePartner.nameAr !== authenticatedMerchant.nameAr ||
          Boolean(livePartner.disabled) !== Boolean(authenticatedMerchant.disabled))
      ) {
        setAuthenticatedMerchant((prev) =>
          prev
            ? {
                ...prev,
                name: livePartner.name,
                nameAr: livePartner.nameAr,
                phone: livePartner.phone || prev.phone,
                disabled: Boolean(livePartner.disabled),
              }
            : prev
        );
      }
    }
  }, [isMasterFounder, viewMode, isMerchantAuthenticated, authenticatedMerchant, merchantPartners]);

  const t = translations[lang];

  // Sync HTML dir and lang attributes on language change
  useEffect(() => {
    document.documentElement.dir = lang === 'ar' || lang === 'ur' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }, [lang]);

  // Reactive Firestore Live Stream for Surplus Items, Partner Merchants, and Platform Settings
  useEffect(() => {
    const unsubscribeItems = subscribeToSurplusItems((liveItems) => {
      setItems(liveItems);
    });
    const unsubscribeMerchants = subscribeToMerchantPartners((liveMerchants) => {
      setMerchantPartners(liveMerchants);
    });
    const unsubscribeSettings = subscribeToPlatformSettings((liveSettings) => {
      setPlatformSettings(liveSettings);
      if (liveSettings.defaultCommissionPercent !== undefined) {
        setPlatformCommissionRate(liveSettings.defaultCommissionPercent);
      }
    });
    return () => {
      unsubscribeItems();
      unsubscribeMerchants();
      unsubscribeSettings();
    };
  }, []);

  // Fetch dynamic regions and categories from database API
  useEffect(() => {
    let active = true;
    fetch('/api/regions')
      .then((res) => res.json())
      .then((data) => {
        if (active && data.success && Array.isArray(data.regions)) {
          setRegions(data.regions);
        }
      })
      .catch((err) => {
        console.warn('[App] Regions fetch failed:', err instanceof Error ? err.message : err);
      });

    fetch('/api/categories')
      .then((res) => res.json())
      .then((data) => {
        if (active && data.success && Array.isArray(data.categories)) {
          setCategories(data.categories);
        }
      })
      .catch((err) => {
        console.warn('[App] Categories fetch failed:', err instanceof Error ? err.message : err);
      });

    return () => {
      active = false;
    };
  }, []);

  // Real-time Order Synchronization across Customer, Merchant Kitchen, and Admin views
  useEffect(() => {
    let isMounted = true;
    const customerKey = customerProfile?.id || currentUser?.uid;
    const syncOrders = async () => {
      const serverOrders = await fetchOrdersFromBackend(customerKey);
      if (!isMounted) return;

      // When in Merchant view, strictly replace orders with the server's token-filtered orders for this restaurant
      if (viewMode === 'merchant' && isMerchantAuthenticated) {
        setOrders(
          [...serverOrders].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
        );
        return;
      }

      if (serverOrders.length === 0) return;

      setOrders((prev) => {
        const mergedMap = new Map<string, Order>();
        prev.forEach((o) => mergedMap.set(o.id, o));
        serverOrders.forEach((so) => mergedMap.set(so.id, so));
        return Array.from(mergedMap.values()).sort(
          (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
        );
      });
    };

    void syncOrders();
    const intervalId = setInterval(syncOrders, 4000);
    const handleFocus = () => void syncOrders();
    window.addEventListener('focus', handleFocus);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
    };
  }, [customerProfile?.id, currentUser?.uid, viewMode, isMerchantAuthenticated, authenticatedMerchant?.merchantId]);

  // Permanently sync & persist customer loyalty wallet via Firestore /wallets/{uid} + localStorage mirror
  useEffect(() => {
    const customerUid = currentUser?.uid || customerProfile?.id;
    if (!customerUid || customerUid === 'guest') {
      setLoyaltyPoints(0);
      setCustomerWalletSnapshot(null);
      return;
    }

    const cacheKey = `flaster_wallet_v2_${customerUid}`;
    let cachedWallet: PersistedCustomerWallet | null = null;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedCustomerWallet;
        if (typeof parsed.availablePoints === 'number') {
          cachedWallet = parsed;
          setCustomerWalletSnapshot(parsed);
          setLoyaltyPoints(parsed.availablePoints);
        }
      }
    } catch {
      // ignore localStorage errors
    }

    let initializedInFirestore = false;
    const unsubscribeWallet = subscribeToCustomerWalletFull(customerUid, (liveWallet) => {
      if (liveWallet) {
        setCustomerWalletSnapshot(liveWallet);
        setLoyaltyPoints(liveWallet.availablePoints);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(liveWallet));
        } catch {
          // ignore
        }
        return;
      }

      // First-ever visit for this signed-in user: create permanent Firestore wallet ONCE with 90 welcome points
      if (!initializedInFirestore && currentUser && currentUser.uid === customerUid) {
        initializedInFirestore = true;
        const nowIso = new Date().toISOString();
        const expiryIso = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString();
        const initialPoints = cachedWallet ? Math.min(125, Math.max(90, cachedWallet.availablePoints)) : 90;
        const bootstrapWallet: PersistedCustomerWallet = {
          customerId: customerUid,
          customerName: customerProfile?.name || currentUser.displayName || undefined,
          availablePoints: initialPoints,
          totalEarnedPoints: cachedWallet?.totalEarnedPoints ?? initialPoints,
          totalRedeemedPoints: cachedWallet?.totalRedeemedPoints ?? 0,
          totalExpiredPoints: cachedWallet?.totalExpiredPoints ?? 0,
          welcomeBonusClaimed: true,
          completedOrdersCount: cachedWallet?.completedOrdersCount ?? 0,
          claimedSocialPages: cachedWallet?.claimedSocialPages ?? [],
          lastDailyLoginDate: cachedWallet?.lastDailyLoginDate,
          nextExpirationDate: cachedWallet?.nextExpirationDate || expiryIso,
          updatedAt: nowIso,
        };
        setCustomerWalletSnapshot(bootstrapWallet);
        setLoyaltyPoints(initialPoints);
        try {
          localStorage.setItem(cacheKey, JSON.stringify(bootstrapWallet));
        } catch {
          // ignore
        }
        void saveCustomerWalletToFirestore(bootstrapWallet);
        void saveLoyaltyTransactionToFirestore({
          id: `TXN-WELCOME-${customerUid.slice(0, 24)}`,
          customerId: customerUid,
          type: 'welcome_bonus',
          points: 90,
          equivalentFils: 90,
          equivalentAed: 0.9,
          note: 'نقاط ترحيبية عند الانضمام إلى فلاستر',
          status: 'COMPLETED',
          createdAt: nowIso,
          expiryDate: expiryIso,
        });
      }
    });

    return () => {
      unsubscribeWallet();
    };
  }, [currentUser, customerProfile?.id, customerProfile?.name]);

  const handleLoyaltyPointsUpdated = React.useCallback((newPts: number) => {
    setLoyaltyPoints((prev) => (prev === newPts ? prev : newPts));
    setCustomerProfile((prev) =>
      prev && prev.loyaltyPoints !== newPts ? { ...prev, loyaltyPoints: newPts } : prev
    );
  }, []);

  // Helper to apply and persist any loyalty points delta (order earn / redeem / refund) to Firestore + localStorage
  const persistLoyaltyPointsDelta = (
    deltaPoints: number,
    txnType: string,
    note: string,
    relatedOrderId?: string
  ) => {
    const customerUid = currentUser?.uid || customerProfile?.id;
    const nextPoints = Math.max(0, loyaltyPoints + deltaPoints);
    setLoyaltyPoints(nextPoints);
    setCustomerProfile((prev) => (prev ? { ...prev, loyaltyPoints: nextPoints } : prev));

    if (!customerUid || customerUid === 'guest') return;
    const nowIso = new Date().toISOString();
    const expiryIso = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString();
    const base = customerWalletSnapshot;
    const updatedWallet: PersistedCustomerWallet = {
      customerId: customerUid,
      customerName: customerProfile?.name || currentUser?.displayName || base?.customerName,
      availablePoints: nextPoints,
      totalEarnedPoints: (base?.totalEarnedPoints ?? loyaltyPoints) + (deltaPoints > 0 ? deltaPoints : 0),
      totalRedeemedPoints: (base?.totalRedeemedPoints ?? 0) + (deltaPoints < 0 ? Math.abs(deltaPoints) : 0),
      totalExpiredPoints: base?.totalExpiredPoints ?? 0,
      welcomeBonusClaimed: base?.welcomeBonusClaimed ?? true,
      completedOrdersCount: (base?.completedOrdersCount ?? 0) + (txnType === 'order_completion' ? 1 : 0),
      claimedSocialPages: base?.claimedSocialPages ?? [],
      lastDailyLoginDate: base?.lastDailyLoginDate,
      nextExpirationDate: base?.nextExpirationDate || expiryIso,
      updatedAt: nowIso,
    };

    setCustomerWalletSnapshot(updatedWallet);
    try {
      localStorage.setItem(`flaster_wallet_v2_${customerUid}`, JSON.stringify(updatedWallet));
    } catch {
      // ignore
    }
    void saveCustomerWalletToFirestore(updatedWallet);
    void saveLoyaltyTransactionToFirestore({
      id: `TXN-${txnType.toUpperCase()}-${Date.now()}`,
      customerId: customerUid,
      type: txnType,
      points: deltaPoints,
      equivalentFils: deltaPoints,
      equivalentAed: Number((deltaPoints / 100).toFixed(2)),
      note,
      relatedOrderId,
      status: 'COMPLETED',
      createdAt: nowIso,
      expiryDate: deltaPoints > 0 ? expiryIso : undefined,
    });
  };

  // Favorite toggle handler
  const handleToggleFavorite = (itemId: string) => {
    setFavorites((prev) => {
      const exists = prev.includes(itemId);
      const next = exists ? prev.filter((id) => id !== itemId) : [...prev, itemId];
      setLiveNotification({
        title: exists 
          ? (lang === 'ar' ? 'تمت الإزالة من المفضلة' : 'Removed from favorites')
          : (lang === 'ar' ? 'تمت الإضافة للمفضلة ❤️' : 'Added to favorites ❤️'),
        body: exists 
          ? (lang === 'ar' ? 'يمكنك دائماً استكشاف وحفظ المطاعم من جديد' : 'Explore surplus deals anytime')
          : (lang === 'ar' ? 'ستصلك عروض الفائض اللحظية من هذا المطعم' : 'You will see live drops from this kitchen')
      });
      setTimeout(() => setLiveNotification(null), 3500);
      return next;
    });
  };

  // Cart calculations (includes blended customer item price transparently)
  const cartCount = cartItems.reduce((acc, ci) => acc + ci.quantity, 0);
  const cartTotal = cartItems.reduce(
    (acc, ci) => acc + getCustomerItemPriceAed(ci.item.discountedPrice) * ci.quantity,
    0
  );

  // Quick Add Item
  const handleQuickAdd = (item: SurplusItem) => {
    setCartItems((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.item.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
    setIsCartOpen(true);
  };

  // Add with specific quantity from Modal
  const handleAddToCartWithQty = (item: SurplusItem, quantity: number) => {
    setCartItems((prev) => {
      const existing = prev.find((ci) => ci.item.id === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.item.id === item.id ? { ...ci, quantity: ci.quantity + quantity } : ci
        );
      }
      return [...prev, { item, quantity }];
    });
    setSelectedItem(null);
    setIsCartOpen(true);
  };

  // Initiate Direct Checkout from modal or map
  const handleInitiateDirectCheckout = (item: SurplusItem, quantity: number = 1) => {
    setCheckoutItems([{ item, quantity }]);
    setSelectedItem(null);
    setIsPaymentOpen(true);
  };

  // Initiate Checkout for Cart
  const handleInitiateCartCheckout = () => {
    if (cartItems.length === 0) return;
    setCheckoutItems(cartItems);
    setIsCartOpen(false);
    setIsPaymentOpen(true);
  };

  // Loud Annoying Phone Ring / Alarm for Merchant Order Notification
  const playOrderNotificationAlarm = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const playBeepCycle = (startTime: number) => {
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'square';
        osc1.frequency.setValueAtTime(880, startTime);
        osc1.frequency.setValueAtTime(1174.66, startTime + 0.1);
        gain1.gain.setValueAtTime(0.4, startTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, startTime + 0.25);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(startTime);
        osc1.stop(startTime + 0.25);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(880, startTime + 0.3);
        osc2.frequency.setValueAtTime(1174.66, startTime + 0.4);
        gain2.gain.setValueAtTime(0.4, startTime + 0.3);
        gain2.gain.exponentialRampToValueAtTime(0.01, startTime + 0.55);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(startTime + 0.3);
        osc2.stop(startTime + 0.55);
      };
      const now = ctx.currentTime;
      playBeepCycle(now);
      playBeepCycle(now + 0.7);
      playBeepCycle(now + 1.4);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Core Order Creation & Notification Helper (used both for direct completion and hosted payment return URL)
  const completeOrderCreation = async (
    itemsForOrder: { item: SurplusItem; quantity: number }[],
    details: {
      fulfillmentType: 'pickup' | 'delivery';
      customerName: string;
      customerPhone: string;
      deliveryAddress?: string;
      paymentMethod: 'apple_pay' | 'credit_card' | 'pickup_cash';
      pointsRedeemed?: number;
      pointsDiscountAed?: number;
      paymentTransactionId?: string;
      paymentStatus?: Order['paymentStatus'];
      paymentGateway?: string;
    }
  ) => {
    if (itemsForOrder.length === 0) return;

    const customerUid = currentUser?.uid || customerProfile?.id || 'customer-rak-demo';
    const primaryMerchantId = itemsForOrder[0]?.item.merchant.id || 'merchant-waldorf';

    // Submit authoritative order to backend endpoint (/api/orders/create)
    const serverRes = await submitOrderToBackend({
      customerId: customerUid,
      customerName: details.customerName,
      customerPhone: details.customerPhone,
      merchantId: primaryMerchantId,
      items: itemsForOrder.map((ci) => ({
        itemId: ci.item.id,
        quantity: ci.quantity,
      })),
      fulfillmentType: 'pickup',
      paymentMethod: details.paymentMethod,
      paymentStatus: details.paymentStatus,
      paymentTransactionId: details.paymentTransactionId,
      paymentGateway: details.paymentGateway,
      pointsToRedeem: details.pointsRedeemed || 0,
    });

    if (serverRes.serverRejected) {
      setLiveNotification({
        title: lang === 'ar' ? '⚠️ تعذر إتمام الطلب' : '⚠️ Order Rejected by Server',
        body:
          serverRes.error ||
          (lang === 'ar'
            ? 'تعذر تأكيد الطلب من الخادم. يرجى التحقق من الكمية والنقاط والمحاولة مجدداً.'
            : 'Order could not be confirmed by the server. Please check stock and points.'),
      });
      setTimeout(() => setLiveNotification(null), 5500);
      return;
    }

    const authoritativePointsRedeemed = serverRes.success
      ? (serverRes.pointsRedeemed ?? 0)
      : (details.pointsRedeemed || 0);
    if (authoritativePointsRedeemed > 0) {
      persistLoyaltyPointsDelta(
        -authoritativePointsRedeemed,
        'order_redemption',
        lang === 'ar'
          ? `استبدال ${authoritativePointsRedeemed} نقطة كخصم في الطلب`
          : `Redeemed ${authoritativePointsRedeemed} pts on order`,
        serverRes.orderId
      );
    }

    const fallback6Digit = Math.floor(100000 + Math.random() * 900000).toString();
    const backendOrderId = serverRes.success && serverRes.orderId
      ? serverRes.orderId
      : `ord-${Date.now()}-${itemsForOrder[0]?.item.id || 'box'}`;
    const backendPickupCode =
      (serverRes.success && (serverRes.pickupCode || serverRes.code?.replace(/^RAK-/, ''))) ||
      fallback6Digit;

    const nextInvSeq = invoiceCounter;
    setInvoiceCounter((prev) => prev + itemsForOrder.length);

    const newOrders: Order[] =
      serverRes.success && serverRes.order && itemsForOrder.length === 1
        ? [serverRes.order]
        : itemsForOrder.map((ci, idx) => {
            const subtotalFils =
              idx === 0 && serverRes.success && typeof serverRes.subtotalFils === 'number'
                ? serverRes.subtotalFils
                : aedToFils(ci.item.discountedPrice) * ci.quantity;
            const serviceFeeFils =
              idx === 0 && serverRes.success && typeof serverRes.serviceFeeFils === 'number'
                ? serverRes.serviceFeeFils
                : CUSTOMER_SERVICE_FEE_FILS * Math.max(1, ci.quantity);
            const deliveryFeeFils = 0;
            const discountFils =
              idx === 0
                ? serverRes.success && typeof serverRes.pointsDiscountFils === 'number'
                  ? serverRes.pointsDiscountFils
                  : aedToFils(details.pointsDiscountAed || 0)
                : 0;
            const finalPaidFils =
              idx === 0 && serverRes.success && typeof serverRes.totalFils === 'number'
                ? serverRes.totalFils
                : Math.max(0, subtotalFils + serviceFeeFils - discountFils);
            const finalPaid = filsToAed(finalPaidFils);
            const vatFils =
              idx === 0 && serverRes.success && typeof serverRes.vatFils === 'number'
                ? serverRes.vatFils
                : calculateIncludedVatFils(finalPaidFils);
            const vatAed = filsToAed(vatFils);
            const seqNum = nextInvSeq + idx;
            const formattedInv =
              (idx === 0 && serverRes.success && serverRes.invoiceNumber) ||
              formatSequentialInvoiceNumber(seqNum);

            const newOrderObj: Order = {
              id: idx === 0 ? backendOrderId : `${backendOrderId}-${idx}`,
              code:
                (idx === 0 && serverRes.success && serverRes.code) ||
                `RAK-${backendPickupCode.slice(0, 4)}`,
              pickupCode: backendPickupCode,
              invoiceSequence: seqNum,
              invoiceNumber: formattedInv,
              receiptNumber: formattedInv,
              subtotalFils,
              serviceFeeFils,
              deliveryFeeFils,
              pointsDiscountFils: discountFils,
              totalFils: finalPaidFils,
              vatFils,
              vatAed,
              item: ci.item,
              quantity: ci.quantity,
              totalAed: finalPaid,
              serviceFeeAed: filsToAed(serviceFeeFils),
              deliveryFeeAed: 0,
              pointsDiscountAed: filsToAed(discountFils),
              pointsRedeemed: idx === 0 ? authoritativePointsRedeemed : 0,
              refundStatus: 'none',
              co2SavedKg: Number((ci.item.co2SavedKg * ci.quantity).toFixed(1)),
              createdAt: new Date().toISOString(),
              pickupStart: ci.item.pickupStart,
              pickupEnd: ci.item.pickupEnd,
              pickupDate: ci.item.pickupDate,
              status: 'active',
              workflowStatus: 'placed',
              fulfillmentType: 'pickup',
              customerId: customerUid,
              customerName: details.customerName,
              customerPhone: details.customerPhone,
              paymentMethod: details.paymentMethod,
              paymentStatus: details.paymentStatus,
              paymentTransactionId: details.paymentTransactionId,
              paymentGateway: details.paymentGateway,
            };

            return newOrderObj;
          });

    newOrders.forEach((ord) => {
      void saveOrderToFirestore(ord, customerUid);
    });

    // Decrement stock for each
    setItems((prev) =>
      prev.map((item) => {
        const inOrder = itemsForOrder.find((ci) => ci.item.id === item.id);
        if (inOrder) {
          return { ...item, stockRemaining: Math.max(0, item.stockRemaining - inOrder.quantity) };
        }
        return item;
      })
    );

    // Remove purchased items from cart if present
    setCartItems((prev) =>
      prev.filter((ci) => !itemsForOrder.some((b) => b.item.id === ci.item.id))
    );

    setOrders((prev) => {
      const existingIds = new Set(prev.map((o) => o.id));
      return [...newOrders.filter((o) => !existingIds.has(o.id)), ...prev];
    });
    
    // Play loud annoying order alarm for the merchant / cafe owner
    playOrderNotificationAlarm();

    setIsPaymentOpen(false);
    setIsOrdersOpen(true);

    // Live in-app toast
    setLiveNotification({
      title: lang === 'ar' ? '🔔 تم استلام وتأكيد طلبك بنجاح!' : '🔔 Rescue Order Placed!',
      body: lang === 'ar'
        ? `تم إشعار مطبخ ${itemsForOrder[0]?.item.merchant.nameAr || 'المطعم'} ومزامنة الطلب فوراً. كود الاستلام جاهز الآن.`
        : `Kitchen notified and order synced immediately. Your digital QR pass is ready.`
    });
    setTimeout(() => setLiveNotification(null), 5500);

    try {
      confetti({
        particleCount: 110,
        spread: 80,
        origin: { y: 0.5 }
      });
    } catch {
      // safe fallback
    }
  };

  // Payment Success Execution from Modal
  const handlePaymentSuccess = async (details: {
    fulfillmentType: 'pickup' | 'delivery';
    customerName: string;
    customerPhone: string;
    deliveryAddress?: string;
    paymentMethod: 'apple_pay' | 'credit_card' | 'pickup_cash';
    pointsRedeemed?: number;
    pointsDiscountAed?: number;
    paymentTransactionId?: string;
    paymentStatus?: Order['paymentStatus'];
    paymentGateway?: string;
  }) => {
    await completeOrderCreation(checkoutItems, details);
  };

  // Handle Return URL after Hosted Ziina / Stripe Payment Redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatusParam = params.get('payment_status');
    const intentIdParam = params.get('intent_id');

    if (!paymentStatusParam) return;

    // Clean URL query params immediately to avoid duplicate execution on refresh
    window.history.replaceState({}, document.title, window.location.pathname);

    if (paymentStatusParam === 'cancel' || paymentStatusParam === 'failed') {
      setLiveNotification({
        title: lang === 'ar' ? '⚠️ تم إلغاء عملية الدفع' : '⚠️ Payment Cancelled',
        body: lang === 'ar'
          ? 'لم يتم خصم أي مبلغ. يمكنك إعادة المحاولة أو اختيار الدفع نقداً عند الاستلام.'
          : 'No charge was made. You can try again or choose Cash on Pickup.',
      });
      setTimeout(() => setLiveNotification(null), 5500);
      return;
    }

    if (paymentStatusParam === 'success' && intentIdParam) {
      let pendingRaw: string | null = null;
      try {
        pendingRaw = sessionStorage.getItem('flaster_pending_checkout');
      } catch {
        pendingRaw = null;
      }

      fetch(`/api/payments/verify-intent/${encodeURIComponent(intentIdParam)}`)
        .then((res) => res.json())
        .then(async (verifyData) => {
          if (verifyData.success && verifyData.paid && pendingRaw) {
            const pending = JSON.parse(pendingRaw);
            try {
              sessionStorage.removeItem('flaster_pending_checkout');
            } catch {
              // ignore
            }
            await completeOrderCreation(pending.itemsToBuy || [], {
              fulfillmentType: pending.fulfillmentType || 'pickup',
              customerName: pending.customerName || 'Flaster Customer',
              customerPhone: pending.customerPhone || '+971500000000',
              deliveryAddress: pending.deliveryAddress,
              paymentMethod: pending.paymentMethod || 'apple_pay',
              pointsRedeemed: pending.pointsRedeemed || 0,
              pointsDiscountAed: pending.pointsDiscountAed || 0,
              paymentTransactionId: intentIdParam,
              paymentStatus: 'paid',
              paymentGateway: verifyData.provider === 'stripe' ? 'Stripe UAE' : 'Ziina UAE',
            });
          } else {
            setLiveNotification({
              title: lang === 'ar' ? '⚠️ لم يكتمل تأكيد الدفع' : '⚠️ Payment Not Confirmed',
              body: lang === 'ar'
                ? 'تعذر التحقق من اكتمال الدفع لدى البوابة. يرجى التحقق من طلباتك أو المحاولة مجدداً.'
                : 'Could not confirm payment completion with the gateway.',
            });
            setTimeout(() => setLiveNotification(null), 5500);
          }
        })
        .catch((err) => {
          console.warn('[PaymentReturn] Verification failed:', err instanceof Error ? err.message : err);
          setLiveNotification({
            title: lang === 'ar' ? '⚠️ تعذر التحقق من الدفع' : '⚠️ Payment Verification Error',
            body: lang === 'ar'
              ? 'يرجى التحقق من اتصالك بالإنترنت ومراجعة حالة طلبك.'
              : 'Please check your internet connection and inspect your order status.',
          });
          setTimeout(() => setLiveNotification(null), 5500);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update Order Workflow Status (placed -> accepted -> preparing -> ready -> picked_up/delivered -> completed/cancelled)
  const handleUpdateOrderStatus = async (
    orderId: string,
    status: OrderWorkflowStatus | 'collected' | 'new'
  ) => {
    const previousOrder = orders.find((o) => o.id === orderId);
    const isCompleting = status === 'completed' || status === 'collected';
    const mappedWorkflow: OrderWorkflowStatus =
      status === 'collected' ? 'completed' : status === 'new' ? 'placed' : status;

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              workflowStatus: mappedWorkflow,
              status: isCompleting ? 'collected' : status === 'cancelled' ? 'cancelled' : o.status
            }
          : o
      )
    );

    let serverStatus:
      | 'placed'
      | 'accepted'
      | 'preparing'
      | 'ready_for_pickup'
      | 'picked_up'
      | 'delivered'
      | 'completed'
      | 'cancelled'
      | null = null;
    if (status === 'placed' || status === 'new') serverStatus = 'placed';
    else if (status === 'accepted') serverStatus = 'accepted';
    else if (status === 'preparing') serverStatus = 'preparing';
    else if (status === 'ready') serverStatus = 'ready_for_pickup';
    else if (status === 'picked_up') serverStatus = 'picked_up';
    else if (status === 'delivered') serverStatus = 'delivered';
    else if (status === 'completed' || status === 'collected') serverStatus = 'completed';
    else if (status === 'cancelled') serverStatus = 'cancelled';

    if (serverStatus) {
      const res = await updateOrderStatusOnBackend({
        orderId,
        newStatus: serverStatus,
        updatedBy: 'merchant_kitchen'
      });
      if (res.serverRejected && previousOrder) {
        setOrders((prev) => prev.map((o) => (o.id === orderId ? previousOrder : o)));
        setLiveNotification({
          title: lang === 'ar' ? '⚠️ تعذر تحديث حالة الطلب' : '⚠️ Status Update Rejected',
          body: res.error || (lang === 'ar' ? 'انتقال الحالة غير مصرح به.' : 'Unauthorized status transition.'),
        });
        setTimeout(() => setLiveNotification(null), 4500);
      }
    }
  };

  // Update Cart Quantity
  const handleUpdateCartQuantity = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      setCartItems((prev) => prev.filter((ci) => ci.item.id !== itemId));
    } else {
      setCartItems((prev) =>
        prev.map((ci) => (ci.item.id === itemId ? { ...ci, quantity: newQty } : ci))
      );
    }
  };

  // Remove Item from Cart
  const handleRemoveFromCart = (itemId: string) => {
    setCartItems((prev) => prev.filter((ci) => ci.item.id !== itemId));
  };

  // Mark Order as Collected & Award 500 Welcome Bonus on First Completed Order (Step 2)
  const handleMarkOrderCollected = async (orderId: string, alreadyVerified: boolean = false) => {
    const targetOrder = orders.find((o) => o.id === orderId);
    let bonusJustAwarded = false;

    if (!alreadyVerified && targetOrder?.pickupCode) {
      const res = await verifyPickupOnBackend({
        orderId,
        pickupCode: targetOrder.pickupCode,
        verifiedBy: 'store_counter'
      });
      if (res.serverRejected) {
        setLiveNotification({
          title: lang === 'ar' ? '⚠️ تعذر تأكيد الاستلام' : '⚠️ Pickup Verification Failed',
          body:
            res.error ||
            (lang === 'ar'
              ? 'يرجى التأكد من صلاحية البوابة وأن حالة الطلب جاهزة للاستلام.'
              : 'Please verify portal authorization and ensure order is ready for pickup.'),
        });
        setTimeout(() => setLiveNotification(null), 5000);
        return;
      }
      if (res.welcomeBonusAwarded) {
        bonusJustAwarded = true;
      }
      if (typeof res.newPointsBalance === 'number') {
        setLoyaltyPoints(res.newPointsBalance);
      }
    }

    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: 'collected', workflowStatus: 'completed' } : o))
    );

    // Award +15 points on completed order and save permanently to Firestore + localStorage
    if (!firstOrderBonusClaimed && (customerProfile || currentUser)) {
      setFirstOrderBonusClaimed(true);
      if (!bonusJustAwarded) {
        persistLoyaltyPointsDelta(
          15,
          'order_completion',
          lang === 'ar' ? 'مكافأة إتمام واستلام الطلب (+15 نقطة)' : 'Completed order reward (+15 pts)',
          orderId
        );
      }
      setLiveNotification({
        title: lang === 'ar' ? '🎁 مبروك! ربحت 15 نقطة إضافية للطلب المكتمل!' : '🎁 15 Points Earned for Completed Order!',
        body: lang === 'ar'
          ? 'تمت إضافة 15 نقطة إلى محفظتك وحفظها في حسابك بنجاح!'
          : '15 loyalty points have been credited and saved to your wallet!'
      });
      setTimeout(() => setLiveNotification(null), 5500);
    }
  };

  // Merchant Portal Handlers (Synced live with Firestore items & backend catalog)
  const handleUpdateStock = (listingId: string, delta: number) => {
    setMerchantListings((prev) =>
      prev.map((item) =>
        item.id === listingId ? { ...item, stock: Math.max(0, item.stock + delta) } : item
      )
    );
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== listingId) return it;
        const updated = { ...it, stockRemaining: Math.max(0, it.stockRemaining + delta) };
        void saveSurplusItemToFirestore(updated);
        void registerCatalogItemOnBackend(updated);
        return updated;
      })
    );
  };

  const handleToggleStatus = (listingId: string) => {
    setPausedListingIds((prev) =>
      prev.includes(listingId) ? prev.filter((id) => id !== listingId) : [...prev, listingId]
    );
    setMerchantListings((prev) =>
      prev.map((item) => {
        if (item.id === listingId) {
          const nextStatus = item.status === 'paused' ? 'active' : 'paused';
          return { ...item, status: nextStatus };
        }
        return item;
      })
    );
  };

  // STEP 5: Server-Validated Refund Handler (Allowed ONLY before merchant accepts/prepares)
  const handleRefundOrder = async (orderId: string, reason: string) => {
    const target = orders.find((o) => o.id === orderId);
    if (!target) return;

    const currentStage = target.workflowStatus || (target.status === 'collected' ? 'completed' : 'placed');

    // Call server-side refund validator
    const serverRes = await requestOrderRefundOnBackend({
      orderId,
      reason,
      requestedBy: customerProfile?.phone || currentUser?.uid || 'customer'
    });

    // Enforce strict policy: allowed ONLY when placed / new (before merchant accepts or prepares)
    const isAllowedLocally = currentStage === 'placed' || currentStage === 'new';
    if (!serverRes.allowed || !isAllowedLocally) {
      setLiveNotification({
        title: lang === 'ar' ? '⚠️ تعذر إلغاء أو استرداد الطلب' : '⚠️ Refund Not Allowed at This Stage',
        body:
          serverRes.error ||
          (lang === 'ar'
            ? 'يُسمح بالإلغاء واسترداد المبلغ فقط قبل قبول المتجر للطلب أو البدء في تحضيره. لا يمكن الاسترداد بعد التحضير أو الاستلام.'
            : 'Cancellation and refund are only permitted before the merchant accepts or starts preparing the order.')
      });
      setTimeout(() => setLiveNotification(null), 5500);
      return;
    }

    setOrders((prev) =>
      prev.map((o) => {
        if (o.id === orderId) {
          return {
            ...o,
            status: 'cancelled',
            workflowStatus: 'cancelled',
            refundStatus: 'refunded',
            refundReason: reason,
            refundedAt: new Date().toISOString()
          };
        }
        return o;
      })
    );

    if (target.pointsRedeemed && target.pointsRedeemed > 0) {
      persistLoyaltyPointsDelta(
        target.pointsRedeemed,
        'order_refund',
        lang === 'ar'
          ? `استرجاع ${target.pointsRedeemed} نقطة بعد إلغاء الطلب ${target.code}`
          : `Restored ${target.pointsRedeemed} pts for cancelled order ${target.code}`,
        orderId
      );
    }

    setLiveNotification({
      title: lang === 'ar' ? '↩ تم استرداد الطلب بنجاح' : '↩ Order Refunded Successfully',
      body: lang === 'ar' 
        ? `تم إلغاء الطلب ${target.code} قبل التحضير وإعادة المبلغ ورصيد النقاط كاملاً.` 
        : `Order ${target.code} cancelled before preparation and funds/points restored.`
    });
    setTimeout(() => setLiveNotification(null), 4500);
  };

  // Customer Authentication Success — preserve any existing saved points & show simple welcome message
  const handleCustomerAuthSuccess = (profile: CustomerProfile) => {
    setCustomerProfile(profile);
    setSavedAddresses(profile.savedAddresses);
    setLoyaltyPoints((prev) => Math.max(prev, profile.loyaltyPoints || 0));
    setIsCustomerAuthOpen(false);

    setLiveNotification({
      title: lang === 'ar' ? '🎉 أهلاً بك في فلاستر!' : '🎉 Welcome to Flaster!',
      body: lang === 'ar'
        ? 'تم تسجيل دخولك بنجاح وإضافة نقاطك الترحيبية وحفظها تلقائياً في حسابك.'
        : 'Welcome! Your welcome loyalty points have been added and saved automatically to your account.'
    });
    setTimeout(() => setLiveNotification(null), 5000);
  };

  const handleViewModeChange = (targetMode: 'consumer' | 'merchant' | 'admin') => {
    if (targetMode === 'merchant') {
      if (isMerchantAuthenticated || isMasterFounder) {
        if (!isMerchantAuthenticated) {
          setIsMerchantAuthenticated(true);
        }
        if (!authenticatedMerchant && isMasterFounder) {
          setAuthenticatedMerchant({
            merchantId: merchantPartners[0]?.id || 'merchant-master',
            username: 'master_admin',
            name: merchantPartners[0]?.name || 'Master Founder',
            nameAr: merchantPartners[0]?.nameAr || 'المدير العام',
            phone: '+971500000000',
            disabled: false,
            failedAttempts: 0,
            lockedUntil: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
        setViewMode('merchant');
      } else {
        setIsAuthModalOpen(true);
      }
    } else if (targetMode === 'admin') {
      setViewMode('admin');
    } else {
      setViewMode('consumer');
    }
  };

  const handleAuthSuccess = (merchant?: MerchantAccountPublicInfo) => {
    setIsMerchantAuthenticated(true);
    if (merchant) {
      setAuthenticatedMerchant(merchant);
    }
    setIsAuthModalOpen(false);
    setViewMode('merchant');
  };

  const handleMerchantLogout = () => {
    setPortalSessionToken(null);
    setIsMerchantAuthenticated(false);
    setAuthenticatedMerchant(null);
    setViewMode('consumer');
  };

  const handleAddMerchantListing = (newListingData: Omit<MerchantListing, 'id' | 'revenueAed'>) => {
    if (!newListingData.imageUrl || !newListingData.imageUrl.trim()) {
      setLiveNotification({
        title: lang === 'ar' ? '⚠️ صورة الصنف مطلوبة' : '⚠️ Product Photo Required',
        body:
          lang === 'ar'
            ? 'يرجى رفع صورة حقيقية لصنف الطعام من جهازك قبل النشر.'
            : 'Please upload a real photo of your food item before publishing.',
      });
      setTimeout(() => setLiveNotification(null), 4000);
      return;
    }

    const sharedItemId = `item-${Date.now()}`;
    const activePartner = merchantPartners.find(
      (m) =>
        authenticatedMerchant &&
        (m.id === authenticatedMerchant.merchantId || m.username === authenticatedMerchant.username)
    );

    const resolvedMerchantName =
      activePartner?.name || authenticatedMerchant?.name || newListingData.merchantName || 'Flaster Partner';
    const resolvedMerchantNameAr =
      activePartner?.nameAr ||
      authenticatedMerchant?.nameAr ||
      newListingData.merchantNameAr ||
      newListingData.merchantName ||
      'شريك فلاستر';
    const resolvedMerchantId =
      activePartner?.id || authenticatedMerchant?.merchantId || 'merchant-master';
    const resolvedNeighborhood =
      newListingData.neighborhood || activePartner?.neighborhood || 'Al Hamra Village';
    const resolvedNeighborhoodAr =
      newListingData.neighborhood || activePartner?.neighborhoodAr || activePartner?.neighborhood || 'رأس الخيمة';

    const newListing: MerchantListing = {
      ...newListingData,
      merchantName: resolvedMerchantName,
      merchantNameAr: resolvedMerchantNameAr,
      neighborhood: resolvedNeighborhoodAr,
      id: sharedItemId,
      revenueAed: 0,
    };
    setMerchantListings((prev) => [newListing, ...prev.filter((l) => l.id !== sharedItemId)]);

    // Push live food item to consumer catalog & Firestore with the exact uploaded photo
    const newSurplusItem: SurplusItem = {
      id: sharedItemId,
      title: {
        en: newListingData.title,
        ar: newListingData.titleAr || newListingData.title,
      },
      merchant: {
        id: resolvedMerchantId,
        name: resolvedMerchantName,
        nameAr: resolvedMerchantNameAr,
        verified: true,
        rating: activePartner?.rating || 4.9,
        reviewsCount: 1,
        neighborhood: resolvedNeighborhood,
        neighborhoodAr: resolvedNeighborhoodAr,
        distanceKm: 1.5,
        avatar: activePartner?.avatar || newListingData.imageUrl,
        address: activePartner?.address || `${resolvedNeighborhood}, Ras Al Khaimah`,
        addressAr: activePartner?.addressAr || `${resolvedNeighborhoodAr}، رأس الخيمة`,
        lat: activePartner?.lat ?? 25.7925,
        lng: activePartner?.lng ?? 55.9555,
      },
      category: newListingData.category,
      imageUrl: newListingData.imageUrl,
      discountPercent: Math.max(
        5,
        Math.round(
          ((newListingData.originalPrice - newListingData.discountedPrice) /
            Math.max(1, newListingData.originalPrice)) *
            100
        )
      ),
      originalPrice: newListingData.originalPrice,
      discountedPrice: newListingData.discountedPrice,
      originalPriceFils: aedToFils(newListingData.originalPrice),
      discountedPriceFils: aedToFils(newListingData.discountedPrice),
      stockRemaining: newListingData.stock,
      pickupStart: newListingData.pickupWindow.split('-')[0]?.trim() || '21:00',
      pickupEnd: newListingData.pickupWindow.split('-')[1]?.trim() || '22:30',
      pickupDate: 'today',
      expiryTime: newListingData.expiryTime || new Date(Date.now() + 4 * 3600 * 1000).toISOString(),
      co2SavedKg: 2.8,
      description: {
        en: 'Freshly prepared food item crafted today by our kitchen chefs. Ready for self-pickup.',
        ar: 'صنف طعام طازج أعدّه طهاة المطعم اليوم بأعلى معايير الجودة والنكهة، جاهز للاستلام المباشر.'
      },
      possibleContents: {
        en: ['Fresh chef-prepared dish', 'Original kitchen packaging'],
        ar: ['وجبة طازجة من إعداد الشيف', 'تغليف صحي ومحكم من المطعم']
      },
      allergens: newListingData.allergens && newListingData.allergens.length > 0 ? newListingData.allergens : ['Gluten', 'Dairy'],
      ingredients: {
        en: newListingData.ingredients || 'Fresh kitchen ingredients',
        ar: newListingData.ingredientsAr || newListingData.ingredients || 'مكونات طازجة يومياً'
      },
      isHalal: true,
      tags: ['Fresh Food Item', 'Self-Pickup']
    };

    setItems((prev) => [newSurplusItem, ...prev.filter((it) => it.id !== sharedItemId)]);
    void saveSurplusItemToFirestore(newSurplusItem);
    void registerCatalogItemOnBackend(newSurplusItem);
  };

  const handleEditMerchantListing = (listingId: string, updated: Partial<MerchantListing>) => {
    const existingListing = merchantListings.find((l) => l.id === listingId);
    setMerchantListings((prev) =>
      prev.map((item) => (item.id === listingId ? { ...item, ...updated } : item))
    );

    // Sync changes to matching item in consumer catalog & Firestore
    setItems((prev) =>
      prev.map((it) => {
        const matchesId = it.id === listingId;
        const matchesTitle =
          existingListing &&
          (it.title.en === existingListing.title || it.title.ar === existingListing.titleAr);
        if (!matchesId && !matchesTitle) return it;

        const nextOriginal = updated.originalPrice ?? it.originalPrice;
        const nextDiscounted = updated.discountedPrice ?? it.discountedPrice;
        const nextPickupStart = updated.pickupWindow
          ? updated.pickupWindow.split('-')[0]?.trim() || it.pickupStart
          : it.pickupStart;
        const nextPickupEnd = updated.pickupWindow
          ? updated.pickupWindow.split('-')[1]?.trim() || it.pickupEnd
          : it.pickupEnd;

        const updatedItem: SurplusItem = {
          ...it,
          title: {
            en: updated.title || it.title.en,
            ar: updated.titleAr || updated.title || it.title.ar,
          },
          category: updated.category || it.category,
          imageUrl: updated.imageUrl || it.imageUrl,
          originalPrice: nextOriginal,
          discountedPrice: nextDiscounted,
          originalPriceFils: aedToFils(nextOriginal),
          discountedPriceFils: aedToFils(nextDiscounted),
          discountPercent: Math.max(
            5,
            Math.round(((nextOriginal - nextDiscounted) / Math.max(1, nextOriginal)) * 100)
          ),
          stockRemaining: updated.stock ?? it.stockRemaining,
          pickupStart: nextPickupStart,
          pickupEnd: nextPickupEnd,
          expiryTime: updated.expiryTime || it.expiryTime,
        };

        void saveSurplusItemToFirestore(updatedItem);
        void registerCatalogItemOnBackend(updatedItem);
        return updatedItem;
      })
    );

    setLiveNotification({
      title: lang === 'ar' ? '✓ تم تحديث الصنف وأوقات العرض' : '✓ Item & Offer Times Updated',
      body:
        lang === 'ar'
          ? 'تم حفظ تعديلات الصنف وأوقات الاستلام وتحديثها في المتجر فوراً.'
          : 'Your item details and pickup window have been updated live in the store.',
    });
    setTimeout(() => setLiveNotification(null), 4000);
  };

  const handleDeleteMerchantListing = (listingId: string) => {
    const existingListing = merchantListings.find((l) => l.id === listingId);
    setMerchantListings((prev) => prev.filter((item) => item.id !== listingId));
    setPausedListingIds((prev) => prev.filter((id) => id !== listingId));
    const matchingItemIds = items
      .filter(
        (it) =>
          it.id === listingId ||
          (existingListing &&
            (it.title.en === existingListing.title || it.title.ar === existingListing.titleAr))
      )
      .map((it) => it.id);
    if (matchingItemIds.length === 0) {
      void deleteSurplusItemFromFirestore(listingId);
    } else {
      matchingItemIds.forEach((id) => {
        void deleteSurplusItemFromFirestore(id);
      });
    }
    setItems((prev) =>
      prev.filter(
        (it) =>
          it.id !== listingId &&
          (!existingListing ||
            (it.title.en !== existingListing.title && it.title.ar !== existingListing.titleAr))
      )
    );
  };

  // Derive live Partner Portal listings directly from Firestore items + local listings for the active store
  const derivedMerchantListings = React.useMemo<MerchantListing[]>(() => {
    const activeMerchantId = authenticatedMerchant?.merchantId;
    const activeName = authenticatedMerchant?.name;
    const activeNameAr = authenticatedMerchant?.nameAr;

    const matchingStoreItems = authenticatedMerchant
      ? items.filter(
          (it) =>
            it.merchant.id === activeMerchantId ||
            (activeName && it.merchant.name === activeName) ||
            (activeNameAr && it.merchant.nameAr === activeNameAr)
        )
      : items;

    const fromFirestore: MerchantListing[] = matchingStoreItems.map((it) => {
      const itemSalesAed = orders
        .filter((o) => o.status !== 'cancelled' && o.item?.id === it.id)
        .reduce((sum, o) => sum + o.item.discountedPrice * o.quantity, 0);

      return {
        id: it.id,
        title: it.title.en,
        titleAr: it.title.ar,
        merchantName: it.merchant.name,
        merchantNameAr: it.merchant.nameAr,
        neighborhood: it.merchant.neighborhoodAr || it.merchant.neighborhood,
        category: it.category,
        originalPrice: it.originalPrice,
        discountedPrice: it.discountedPrice,
        stock: it.stockRemaining,
        initialStock: it.stockRemaining,
        pickupWindow: `${it.pickupStart} - ${it.pickupEnd}`,
        expiryTime: it.expiryTime,
        imageUrl: it.imageUrl,
        status:
          it.stockRemaining <= 0
            ? 'sold_out'
            : pausedListingIds.includes(it.id)
              ? 'paused'
              : 'active',
        revenueAed: Number(itemSalesAed.toFixed(2)),
        allergens: it.allergens,
        ingredients:
          typeof it.ingredients === 'string' ? it.ingredients : it.ingredients?.en,
        ingredientsAr:
          typeof it.ingredients === 'string' ? it.ingredients : it.ingredients?.ar,
      };
    });

    const firestoreIds = new Set(fromFirestore.map((l) => l.id));
    const localExtras = merchantListings.filter((l) => {
      if (firestoreIds.has(l.id)) return false;
      if (!authenticatedMerchant) return true;
      return (
        !l.merchantName ||
        l.merchantName === authenticatedMerchant.name ||
        l.merchantNameAr === authenticatedMerchant.nameAr
      );
    });

    return [...fromFirestore, ...localExtras];
  }, [items, merchantListings, authenticatedMerchant, orders, pausedListingIds]);

  // Filter items for Consumer Marketplace with Smart RAK Proximity Fallback (at least 10 closest stores)
  const filteredItems = React.useMemo(() => {
    const baseList = items.filter((item) => {
      if (pausedListingIds.includes(item.id)) return false;
      if (isSurplusItemExpired(item.expiryTime)) return false;
      if (showFavoritesOnly && !favorites.includes(item.id)) return false;
      if (selectedCategory !== 'all') {
        const isDirectMatch = item.category === selectedCategory;
        let isAliasMatch = false;
        if (selectedCategory === 'restaurants_cafeterias') {
          isAliasMatch = item.category === 'buffet' || item.category === 'gourmet';
        } else if (selectedCategory === 'bakeries_coffeeshops') {
          isAliasMatch = item.category === 'bakery' || item.category === 'cafe';
        } else if (selectedCategory === 'supermarkets_groceries') {
          isAliasMatch = item.category === 'grocery';
        }
        if (!isDirectMatch && !isAliasMatch) return false;
      }
      if (filterExpiringOnly && item.stockRemaining > 2) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchEn =
          item.title.en.toLowerCase().includes(q) ||
          item.merchant.name.toLowerCase().includes(q) ||
          item.merchant.neighborhood.toLowerCase().includes(q);
        const matchAr =
          item.title.ar.toLowerCase().includes(q) ||
          item.merchant.nameAr.toLowerCase().includes(q) ||
          item.merchant.neighborhoodAr.toLowerCase().includes(q);
        if (!matchEn && !matchAr) return false;
      }
      return true;
    });

    if (!selectedLocation || selectedLocation === 'region-all' || selectedLocation === 'rak_all') {
      return baseList;
    }

    const activeReg = regions.find((r) => r.id === selectedLocation);
    if (!activeReg) return baseList;

    const exactMatches = baseList.filter((item) =>
      item.merchant.neighborhood.toLowerCase().includes(activeReg.name.toLowerCase()) ||
      item.merchant.neighborhoodAr.includes(activeReg.nameAr) ||
      activeReg.name.toLowerCase().includes(item.merchant.neighborhood.toLowerCase()) ||
      activeReg.nameAr.includes(item.merchant.neighborhoodAr)
    );

    // If region has 20-30 or enough items, return them. If fewer than 10, pad with closest items until at least 10.
    if (exactMatches.length >= 10 || exactMatches.length >= baseList.length) {
      return exactMatches;
    }

    const otherItems = baseList.filter((item) => !exactMatches.includes(item));
    return [...exactMatches, ...otherItems].slice(0, Math.max(10, exactMatches.length));
  }, [items, pausedListingIds, selectedLocation, regions, selectedCategory, showFavoritesOnly, favorites, filterExpiringOnly, searchQuery]);

  const activeOrdersCount = orders.filter((o) => o.status === 'active').length;
  const rescuedMealsCount = orders.reduce((sum, o) => sum + o.quantity, 0);
  const totalSavedAed = orders.reduce((sum, o) => sum + (o.item.originalPrice - o.item.discountedPrice) * o.quantity, 0);

  return (
    <div className="min-h-screen w-full max-w-full flex flex-col bg-[#FAF7F2] text-[#1C1917] selection:bg-[#DC2626] selection:text-white relative">
      <GlobalDomTranslator lang={lang} />
      
      {/* Floating Live Notification Alert Toast */}
      {liveNotification && (
        <div className="fixed bottom-6 start-6 end-6 sm:end-auto z-50 max-w-md bg-stone-900 text-stone-100 rounded-2xl p-4 shadow-2xl border border-stone-800 flex items-start gap-3.5 animate-in slide-in-from-bottom-5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#DC2626] to-amber-500 text-white flex items-center justify-center shrink-0 shadow">
            <BellRing className="w-5 h-5 animate-bounce" />
          </div>
          <div className="flex-1 space-y-0.5">
            <h5 className="font-headline font-bold text-xs text-white">
              {liveNotification.title}
            </h5>
            <p className="text-[11px] text-slate-300 leading-snug">
              {liveNotification.body}
            </p>
          </div>
          <button
            onClick={() => setLiveNotification(null)}
            className="text-slate-400 hover:text-white text-xs p-1"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Brand Sticky Header */}
      <Header
        lang={lang}
        onLanguageChange={setLang}
        selectedLocation={selectedLocation}
        onLocationChange={setSelectedLocation}
        regions={regions}
        cartCount={cartCount}
        cartTotal={cartTotal}
        onOpenCart={() => setIsCartOpen(true)}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        isMerchantAuthenticated={isMerchantAuthenticated}
        activeOrdersCount={activeOrdersCount}
        onOpenOrders={() => setIsOrdersOpen(true)}
        onOpenImpact={() => setIsImpactOpen(true)}
        onOpenHowItWorks={() => setIsHowItWorksOpen(true)}
        loyaltyPoints={loyaltyPoints}
        onOpenLoyalty={() => setIsLoyaltyOpen(true)}
        customerProfile={customerProfile}
        onOpenAuth={() => setIsCustomerAuthOpen(true)}
        onOpenAddresses={() => setIsAddressModalOpen(true)}
        onOpenFaq={() => setIsFaqModalOpen(true)}
        onOpenSupport={() => setIsSupportModalOpen(true)}
        onOpenLegal={() => {
          setLegalInitialTab('terms');
          setIsLegalModalOpen(true);
        }}
        onOpenLegalTab={(tab) => {
          setLegalInitialTab(tab);
          setIsLegalModalOpen(true);
        }}
        onOpenPartnerModal={() => setIsPartnerModalOpen(true)}
        onLogoutCustomer={async () => {
          try {
            await signOut();
          } catch {
            // ignore signOut failure
          }
          setPortalSessionToken(null);
          setCustomerProfile(null);
          setLoyaltyPoints(0);
          setIsMerchantAuthenticated(false);
          setAuthenticatedMerchant(null);
          setViewMode('consumer');
          setLiveNotification({
            title: lang === 'ar' ? 'تم تسجيل الخروج' : 'Logged Out',
            body: lang === 'ar' ? 'يمكنك الدخول في أي وقت واستخدام رصيدك' : 'You can log back in anytime'
          });
          setTimeout(() => setLiveNotification(null), 3000);
        }}
      />

      {/* Main View Router: Consumer Marketplace vs Kitchen Merchant Hub vs Admin Dashboard */}
      {viewMode === 'admin' ? (
        <main className="flex-1">
          <AdminFoundersDashboard
            orders={orders}
            listings={merchantListings}
            lang={lang}
            regions={regions}
            commissionRate={platformCommissionRate}
            onCommissionRateChange={setPlatformCommissionRate}
            merchantPartners={merchantPartners}
            onUpdateMerchantCommission={handleUpdateMerchantCommission}
            onAddPartnerStore={handleAddPartnerStore}
            onDeleteMerchant={handleDeleteMerchant}
            onUpdateMerchantStatus={handleUpdateMerchantStatus}
            platformSettings={platformSettings}
            onUpdatePlatformSettings={setPlatformSettings}
            onSwitchToMarketplace={() => setViewMode('consumer')}
            onOpenReceipt={(ord) => {
              setReceiptOrder(ord);
              setIsReceiptModalOpen(true);
            }}
            onRefundOrder={handleRefundOrder}
          />
        </main>
      ) : viewMode === 'merchant' ? (
        <main className="flex-1">
          <MerchantWorkspace
            listings={derivedMerchantListings}
            orders={
              authenticatedMerchant
                ? orders.filter(
                    (o) =>
                      o.item?.merchant?.id === authenticatedMerchant.merchantId ||
                      o.item?.merchant?.name === authenticatedMerchant.name ||
                      o.item?.merchant?.nameAr === authenticatedMerchant.nameAr
                  )
                : orders
            }
            lang={lang}
            regions={regions}
            categories={categories}
            authenticatedMerchant={authenticatedMerchant}
            merchantPartners={
              isMasterFounder
                ? merchantPartners
                : merchantPartners.filter(
                    (m) => authenticatedMerchant && m.id === authenticatedMerchant.merchantId
                  )
            }
            isMasterFounder={isMasterFounder}
            onSelectMerchant={
              isMasterFounder
                ? (partner) =>
                    setAuthenticatedMerchant({
                      merchantId: partner.id,
                      username: partner.username || partner.id.replace(/^merchant-/, ''),
                      name: partner.name,
                      nameAr: partner.nameAr,
                      phone: partner.phone || '+971500000000',
                      disabled: Boolean(partner.disabled),
                      failedAttempts: 0,
                      lockedUntil: 0,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    })
                : undefined
            }
            platformCommissionPercent={platformCommissionRate}
            onUpdateStock={handleUpdateStock}
            onToggleStatus={handleToggleStatus}
            onAddListing={handleAddMerchantListing}
            onEditListing={handleEditMerchantListing}
            onDeleteListing={handleDeleteMerchantListing}
            onMarkOrderCollected={handleMarkOrderCollected}
            onUpdateOrderStatus={handleUpdateOrderStatus}
            onSwitchToMarketplace={() => setViewMode('consumer')}
            onLogout={handleMerchantLogout}
          />
        </main>
      ) : (
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8 w-full">
          
          {/* Official Linktree Hub Banner (Follow Rewards Live Inside My Points Modal) */}
          <SocialLinksRewardsBanner
            lang={lang}
            onOpenLoyalty={() => setIsLoyaltyOpen(true)}
          />

          {/* Urgent Sunset Rescue Countdown Carousel */}
          <SunsetUrgencyBanner
            items={items}
            lang={lang}
            onSelectItem={(item) => setSelectedItem(item)}
          />

          {/* Search Bar & Category Filters with Map/List and Favorites toggles */}
          <section className="space-y-4">
            <CategoryFilter
              lang={lang}
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
              categoriesList={categories}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filterExpiringOnly={filterExpiringOnly}
              onToggleExpiringOnly={() => setFilterExpiringOnly(!filterExpiringOnly)}
              showFavoritesOnly={showFavoritesOnly}
              onToggleFavoritesOnly={() => setShowFavoritesOnly(!showFavoritesOnly)}
              isMapView={isMapView}
              onToggleMapView={() => setIsMapView(!isMapView)}
              favoritesCount={favorites.length}
              regions={regions}
              selectedLocation={selectedLocation}
              onLocationChange={setSelectedLocation}
            />
          </section>

          {/* Marketplace Catalog Section: Map View vs Grid View */}
          <section className="space-y-4">
            
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-headline font-extrabold text-xl sm:text-2xl text-[#0F172A]">
                  {showFavoritesOnly
                    ? (lang === 'ar' ? 'مطاعمك ومخابزك المفضلة ❤️' : 'Your Favorite Rescue Kitchens ❤️')
                    : isMapView
                    ? (lang === 'ar' ? 'خريطة المطاعم والمتاجر الحية 🗺️' : 'Surplus Rescue Venues on Map 🗺️')
                    : selectedCategory === 'all'
                    ? (lang === 'ar' ? 'عروض فائض الطعام الطازجة اليوم' : 'Today\'s Fresh Surplus Rescue')
                    : (lang === 'ar' ? `عروض ${t[selectedCategory] || selectedCategory}` : `${t[selectedCategory] || selectedCategory} Offerings`)}
                </h2>
                <p className="text-xs text-[#64748B] mt-0.5">
                  {showFavoritesOnly
                    ? (lang === 'ar' ? 'قائمتك المختارة من المطابخ المفضلة لمتابعة عروضها اليومية فور بثها' : 'Your curated list of favorite kitchens and artisan bakeries')
                    : isMapView
                    ? (lang === 'ar' ? 'انقر على أي نقطة على الخريطة لمشاهدة أصناف الطعام وموعد استلامها' : 'Tap any pin on the map to inspect available food items')
                    : (lang === 'ar'
                      ? 'أصناف طعام طازجة تُحجز بخصم 50% إلى 70% وتُستلم مباشرة من كاونتر المطعم'
                      : 'Fresh gourmet food items prepared today, reserved at 50-70% off for self-pickup')}
                </p>
              </div>

              <span className="font-metric text-xs font-semibold text-[#4F6345] bg-[#EFF4EC] px-3 py-1.5 rounded-lg border border-[#6E8462]/30 shadow-2xs">
                {filteredItems.length} {lang === 'ar' ? 'صنف متوفر' : 'items available'}
              </span>
            </div>

            {isMapView ? (
              <InteractiveMapView
                items={filteredItems}
                lang={lang}
                favorites={favorites}
                regions={regions}
                onToggleFavorite={handleToggleFavorite}
                onSelectItem={(item) => setSelectedItem(item)}
                onQuickAdd={handleQuickAdd}
                onDirectCheckout={(item) => handleInitiateDirectCheckout(item, 1)}
                onOpenAdminAddStore={() => handleViewModeChange('admin')}
              />
            ) : filteredItems.length === 0 ? (
              <div className="bg-[#FFFDF9] rounded-2xl border border-[#EAE4DC] p-12 text-center space-y-3 shadow-sm">
                <div className="w-16 h-16 rounded-full bg-amber-100 text-[#DC2626] mx-auto flex items-center justify-center">
                  <Utensils className="w-8 h-8" />
                </div>
                <h3 className="font-headline font-bold text-lg text-[#1C1917]">
                  {showFavoritesOnly
                    ? (lang === 'ar' ? 'لم تقم بإضافة مطاعم إلى المفضلة بعد' : 'No favorite restaurants saved yet')
                    : (lang === 'ar' ? 'لا توجد عروض مطابقة لبحثك حالياً' : 'No surplus bags match your search')}
                </h3>
                <p className="text-xs text-[#78716C] max-w-sm mx-auto">
                  {showFavoritesOnly
                    ? (lang === 'ar' ? 'اضغط على رمز القلب (❤️) على أي مطعم لحفظه هنا والوصول إليه بسرعة.' : 'Click the heart icon on any venue to save it here for quick access.')
                    : (lang === 'ar'
                      ? 'جرب اختيار تصنيف آخر أو مسح البحث لاستعراض جميع المخابز والبوفيهات المتوفرة.'
                      : 'Try clearing your search filters or browse another category to see all available listings.')}
                </p>
                <button
                  onClick={() => {
                    setSelectedCategory('all');
                    setSearchQuery('');
                    setFilterExpiringOnly(false);
                    setShowFavoritesOnly(false);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold shadow-md shadow-red-600/20 transition-all cursor-pointer"
                >
                  {lang === 'ar' ? 'عرض جميع الأصناف' : 'Reset All Filters'}
                </button>
              </div>
            ) : (
              /* Responsive Breakpoints & Adapters as mandated in specs:
                 Mobile (<768px): 1-col; Tablet (768-1024px): 2-col; Desktop (>1024px): 3-col or 4-col */
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {filteredItems.map((item) => (
                  <SurplusCard
                    key={item.id}
                    item={item}
                    lang={lang}
                    isFavorite={favorites.includes(item.id)}
                    onToggleFavorite={handleToggleFavorite}
                    onSelect={(it) => setSelectedItem(it)}
                    onQuickAdd={handleQuickAdd}
                  />
                ))}
              </div>
            )}

          </section>

          {/* Commercial Value & Quality Guarantee Bar */}
          <section className="bg-[#FFFDF9] rounded-2xl border border-[#EAE4DC] p-6 shadow-sm">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
              
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FDF2F3] text-[#9E1B28] border border-[#9E1B28]/25 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-headline font-bold text-sm text-[#1C1917]">
                    {t.valueBox1Title}
                  </h4>
                  <p className="text-[#78716C] text-[11px] mt-0.5 leading-relaxed">
                    {t.valueBox1Desc}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EFF4EC] text-[#4F6345] border border-[#6E8462]/30 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-headline font-bold text-sm text-[#1C1917]">
                    {t.valueBox2Title}
                  </h4>
                  <p className="text-[#64748B] text-[11px] mt-0.5 leading-relaxed">
                    {t.valueBox2Desc}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FEF9E1] text-[#854D0E] border border-[#F4C430] flex items-center justify-center shrink-0">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-headline font-bold text-sm text-[#1C1917]">
                    {t.valueBox3Title}
                  </h4>
                  <p className="text-[#64748B] text-[11px] mt-0.5 leading-relaxed">
                    {t.valueBox3Desc}
                  </p>
                </div>
              </div>

            </div>
          </section>

        </main>
      )}

      {/* Minimal Footer: Only Copyright & Ras Al Khaimah Licensing Statement */}
      <footer className="bg-[#FFFDF9] border-t border-[#EAE4DC] mt-16 text-xs text-[#78716C] py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-[#78716C] text-center sm:text-start">
            <p className="font-semibold text-[#1C1917]">
              © {new Date().getFullYear()} Flaster • فلاستر. {lang === 'ar' ? 'جميع الحقوق محفوظة.' : 'All rights reserved.'}
            </p>
            <p className="font-metric">
              {lang === 'ar'
                ? 'مرخص ومعتمد في إمارة رأس الخيمة • دولة الإمارات العربية المتحدة'
                : 'Licensed and certified in Ras Al Khaimah • United Arab Emirates'}
            </p>
          </div>
        </div>
      </footer>

      {/* Modals & Drawers */}
      <ItemDetailModal
        item={selectedItem}
        lang={lang}
        isFavorite={selectedItem ? favorites.includes(selectedItem.id) : false}
        onToggleFavorite={handleToggleFavorite}
        onClose={() => setSelectedItem(null)}
        onReserveNow={(it, qty) => handleInitiateDirectCheckout(it, qty)}
        onAddToCart={handleAddToCartWithQty}
      />

      <ActiveOrdersModal
        isOpen={isOrdersOpen}
        orders={orders}
        lang={lang}
        onClose={() => setIsOrdersOpen(false)}
        onMarkCollected={handleMarkOrderCollected}
        onViewReceipt={(ord) => {
          setReceiptOrder(ord);
          setIsReceiptModalOpen(true);
        }}
        onRequestRefund={(ord) => {
          handleRefundOrder(ord.id, lang === 'ar' ? 'طلب إلغاء واسترداد من العميل قبل التحضير' : 'Customer cancellation request before preparation');
        }}
      />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cartItems}
        lang={lang}
        onUpdateQuantity={handleUpdateCartQuantity}
        onRemoveItem={handleRemoveFromCart}
        onCheckout={handleInitiateCartCheckout}
      />

      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        itemsToBuy={checkoutItems}
        lang={lang}
        customerPointsBalance={loyaltyPoints}
        savedAddresses={savedAddresses}
        customerProfile={customerProfile}
        onPaymentSuccess={handlePaymentSuccess}
      />

      <LoyaltyWalletModal
        isOpen={isLoyaltyOpen}
        onClose={() => setIsLoyaltyOpen(false)}
        lang={lang}
        customerId={currentUser?.uid || customerProfile?.id || 'guest'}
        currentPoints={loyaltyPoints}
        customerName={customerProfile?.name || currentUser?.displayName || undefined}
        isAuthenticated={Boolean((currentUser && !currentUser.isAnonymous) || customerProfile)}
        onRequireAuth={() => {
          setIsLoyaltyOpen(false);
          setIsCustomerAuthOpen(true);
        }}
        onPointsUpdated={handleLoyaltyPointsUpdated}
      />

      <ImpactModal
        isOpen={isImpactOpen}
        onClose={() => setIsImpactOpen(false)}
        lang={lang}
        rescuedMealsCount={rescuedMealsCount}
        totalSavedAed={totalSavedAed}
      />

      <HowItWorksModal
        isOpen={isHowItWorksOpen}
        onClose={() => setIsHowItWorksOpen(false)}
        lang={lang}
        onOpenMerchant={() => handleViewModeChange('merchant')}
      />

      <MerchantAuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        lang={lang}
        onSuccess={handleAuthSuccess}
      />

      {/* Customer Mobile OTP & Profile Auth Modal */}
      <CustomerAuthModal
        isOpen={isCustomerAuthOpen}
        onClose={() => setIsCustomerAuthOpen(false)}
        lang={lang}
        onAuthSuccess={handleCustomerAuthSuccess}
        initialProfile={customerProfile}
      />

      {/* Address Management Modal (Home, Work, Pickup Location) */}
      <AddressManagerModal
        isOpen={isAddressModalOpen}
        onClose={() => setIsAddressModalOpen(false)}
        lang={lang}
        addresses={savedAddresses}
        onSaveAddresses={(updatedAddrs) => {
          setSavedAddresses(updatedAddrs);
          if (customerProfile) {
            setCustomerProfile({ ...customerProfile, savedAddresses: updatedAddrs });
          }
        }}
        regions={regions}
      />

      {/* Official UAE Digital Receipt / Tax Invoice & Refund Modal */}
      <DigitalReceiptModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setReceiptOrder(null);
        }}
        order={receiptOrder || orders[0]}
        lang={lang}
        platformSettings={platformSettings}
        onRequestRefund={async (orderId, reason) => {
          await handleRefundOrder(orderId, reason);
          setIsReceiptModalOpen(false);
        }}
      />

      {/* Frequently Asked Questions (FAQ) Modal */}
      <FAQModal
        isOpen={isFaqModalOpen}
        onClose={() => setIsFaqModalOpen(false)}
        lang={lang}
        onOpenSupport={() => {
          setIsFaqModalOpen(false);
          setIsSupportModalOpen(true);
        }}
      />

      {/* Direct Customer Support & WhatsApp Modal */}
      <CustomerSupportModal
        isOpen={isSupportModalOpen}
        onClose={() => setIsSupportModalOpen(false)}
        lang={lang}
        platformSettings={platformSettings}
      />

      {/* UAE Licensed Commercial Privacy Policy, Terms, Refund, Food Safety & Contact Modal */}
      <LegalModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
        lang={lang}
        initialTab={legalInitialTab}
        platformSettings={platformSettings}
      />

      {/* Official Flaster Social Media Kit & Family Share Modal */}
      <SocialMediaKitModal
        isOpen={isSocialMediaKitOpen}
        onClose={() => setIsSocialMediaKitOpen(false)}
        lang={lang}
      />

      {/* Official RAK Restaurant & Bakery Partner Pitch Modal */}
      <RestaurantPartnerModal
        isOpen={isPartnerModalOpen}
        onClose={() => setIsPartnerModalOpen(false)}
        lang={lang}
        onOpenKitchenDemo={() => setViewMode('merchant')}
      />

      {/* UAE PDPL Legal Consent Modal */}
      <LegalConsentModal
        isOpen={isLegalConsentOpen}
        onAccept={() => {
          localStorage.setItem('flaster_legal_accepted', 'true');
          setIsLegalConsentOpen(false);
        }}
        lang={lang}
      />

      {/* Non-intrusive PWA Update Banner (only shown if update awaits user confirmation) */}
      <PWAUpdateBanner lang={lang} />

    </div>
  );
}
