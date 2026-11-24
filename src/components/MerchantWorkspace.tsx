import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Store, 
  Clock, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  DollarSign, 
  Layers, 
  Sparkles, 
  RotateCcw,
  Lock,
  QrCode,
  Search,
  CheckCircle,
  X,
  ShieldCheck,
  Bell, 
  Volume2, 
  VolumeX, 
  MessageSquare, 
  ChefHat, 
  Building2,
  CreditCard,
  Download,
  FileSpreadsheet,
  Banknote,
  Upload,
  Camera,
  Trash2,
  Utensils,
  Wallet,
  ArrowDownLeft,
  ArrowUpRight
} from 'lucide-react';
import {
  MerchantListing,
  Category,
  Language,
  Order,
  OrderWorkflowStatus,
  DynamicRegion,
  DynamicCategory,
  MerchantAccountPublicInfo,
  MerchantPartner,
} from '../types';
import { translations } from '../translations';
import { verifyPickupOnBackend } from '../firebase/orders';
import { isSurplusItemExpired } from '../firebase/db';
import {
  CUSTOMER_SERVICE_FEE_AED,
  CUSTOMER_SERVICE_FEE_FILS,
  MIN_MERCHANT_ITEM_PRICE_AED,
  aedToFils,
  filsToAed,
  calculateIncludedVatFils,
} from '../config/platformConfig';

interface MerchantWorkspaceProps {
  listings: MerchantListing[];
  orders: Order[];
  lang: Language;
  regions?: DynamicRegion[];
  categories?: DynamicCategory[];
  authenticatedMerchant?: MerchantAccountPublicInfo | null;
  merchantPartners?: MerchantPartner[];
  isMasterFounder?: boolean;
  onSelectMerchant?: (partner: MerchantPartner) => void;
  onUpdateStock: (id: string, delta: number) => void;
  onToggleStatus: (id: string) => void;
  onAddListing: (newListing: Omit<MerchantListing, 'id' | 'revenueAed'>) => void;
  onEditListing?: (id: string, updated: Partial<MerchantListing>) => void;
  onDeleteListing?: (id: string) => void;
  onMarkOrderCollected: (orderId: string, alreadyVerified?: boolean) => void;
  onUpdateOrderStatus?: (orderId: string, status: OrderWorkflowStatus) => void;
  onSwitchToMarketplace: () => void;
  onLogout: () => void;
  platformCommissionPercent?: number;
}

export const MerchantWorkspace: React.FC<MerchantWorkspaceProps> = ({
  listings,
  orders,
  lang,
  regions = [],
  authenticatedMerchant = null,
  merchantPartners = [],
  isMasterFounder = false,
  onSelectMerchant,
  onUpdateStock,
  onToggleStatus,
  onAddListing,
  onEditListing,
  onDeleteListing,
  onMarkOrderCollected,
  onUpdateOrderStatus,
  onSwitchToMarketplace,
  onLogout,
  platformCommissionPercent = 15,
}) => {
  const t = translations[lang];
  const isArabic = lang === 'ar';

  // Resolve live partner record from Firestore-synced merchantPartners
  const activePartnerRecord = merchantPartners.find(
    (m) =>
      authenticatedMerchant &&
      (m.id === authenticatedMerchant.merchantId || m.username === authenticatedMerchant.username)
  );
  const effectiveCommissionPercent = activePartnerRecord?.commissionPercent ?? platformCommissionPercent;
  const activeStoreNameAr = activePartnerRecord?.nameAr || authenticatedMerchant?.nameAr || '';
  const activeStoreNameEn = activePartnerRecord?.name || authenticatedMerchant?.name || '';
  const activeStoreNeighborhood =
    activePartnerRecord?.neighborhoodAr ||
    activePartnerRecord?.neighborhood ||
    (isArabic ? 'رأس الخيمة' : 'Ras Al Khaimah');

  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyCodeInput, setVerifyCodeInput] = useState('');
  const [verifiedSuccess, setVerifiedSuccess] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<'inventory' | 'live_orders' | 'settlements'>('inventory');
  const [kitchenChimeEnabled, setKitchenChimeEnabled] = useState(true);
  const [chimeTestFeedback, setChimeTestFeedback] = useState<string | null>(null);
  const [showExpiredListings, setShowExpiredListings] = useState(false);
  const [priceValidationError, setPriceValidationError] = useState<string | null>(null);
  const [imageValidationError, setImageValidationError] = useState<string | null>(null);
  const [bankName, setBankName] = useState('بنك أبوظبي الأول (FAB) / Wio Bank');
  const [wioIban, setWioIban] = useState(activePartnerRecord?.iban || '');
  const [isIbanEditing, setIsIbanEditing] = useState(false);
  const [statementSuccessMsg, setStatementSuccessMsg] = useState<string | null>(null);

  // Loud, Insistent, Annoying Phone Ring & Kitchen Buzzer (High volume, aggressive multi-pulse alert)
  const playKitchenBell = () => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      // Play 4 aggressive, loud, insistent pulses (telephone ring & buzzer style)
      for (let i = 0; i < 4; i++) {
        const startTime = ctx.currentTime + (i * 0.22);
        
        // High frequency pulse A
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(1046.50, startTime); // C6
        gain1.gain.setValueAtTime(0.95, startTime);
        gain1.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(startTime);
        osc1.stop(startTime + 0.18);

        // Piercing frequency pulse B
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'square';
        osc2.frequency.setValueAtTime(1567.98, startTime + 0.06); // G6
        gain2.gain.setValueAtTime(0.95, startTime + 0.06);
        gain2.gain.exponentialRampToValueAtTime(0.001, startTime + 0.18);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(startTime + 0.06);
        osc2.stop(startTime + 0.18);
      }
    } catch {
      // Ignore audio restrictions
    }
  };

  // Automatically ring kitchen bell when a new order arrives
  const prevOrdersCountRef = useRef(orders.length);
  useEffect(() => {
    if (orders.length > prevOrdersCountRef.current && kitchenChimeEnabled) {
      playKitchenBell();
    }
    prevOrdersCountRef.current = orders.length;
  }, [orders.length, kitchenChimeEnabled]);

  const handleVerifyCodeDirectly = async (targetOrder?: Order, codeToTest?: string) => {
    const rawInput = (codeToTest || verifyCodeInput).trim();
    const rawDigits = rawInput.replace(/[^0-9]/g, '');

    let matchedOrder: Order | undefined = targetOrder;
    if (!matchedOrder && rawInput) {
      matchedOrder = orders.find(
        (o) =>
          o.code.toLowerCase().includes(rawInput.toLowerCase()) ||
          (rawDigits.length >= 3 && o.code.replace(/[^0-9]/g, '').includes(rawDigits)) ||
          Boolean(o.pickupCode && o.pickupCode === rawDigits)
      );
    }

    if (!matchedOrder && (!rawDigits || rawDigits.length < 3)) {
      setVerifyError(
        isArabic
          ? 'يرجى إدخال رقم التذكرة أو الضغط على زر "تسليم الوجبة ✓" بجانب الطلب أدناه.'
          : 'Please enter a valid ticket code or click "Hand Over ✓" next to the order below.'
      );
      return;
    }

    setIsVerifying(true);
    setVerifyError(null);

    try {
      const orderIdToVerify = matchedOrder?.id || '';
      if (!orderIdToVerify) {
        setVerifyError(
          isArabic
            ? 'لم يتم العثور على طلب مطابق لهذا الرمز. اختر الطلب من القائمة أدناه مباشرة.'
            : 'No matching order found. Select the order from the list below.'
        );
        return;
      }

      const pickupDigits =
        rawDigits.length === 6
          ? rawDigits
          : matchedOrder?.pickupCode || rawDigits.padStart(6, '0');

      const res = await verifyPickupOnBackend({
        orderId: orderIdToVerify,
        pickupCode: pickupDigits,
        verifiedBy: 'merchant_counter',
      });

      if (!res.success) {
        setVerifyError(
          res.error ||
            (isArabic
              ? 'فشل التحقق من رمز الاستلام على الخادم. يرجى التأكد من الرمز وحالة الطلب.'
              : 'Pickup verification failed on server. Check code and order readiness.')
        );
        return;
      }

      onMarkOrderCollected(orderIdToVerify, true);
      if (kitchenChimeEnabled) playKitchenBell();
      setVerifiedSuccess(
        res.message ||
          (isArabic
            ? `✓ تم التحقق من التذكرة (${matchedOrder?.code || orderIdToVerify}) وتسليم الوجبة للزبون بنجاح!`
            : `✓ Ticket (${matchedOrder?.code || orderIdToVerify}) verified and meal handed over!`)
      );
      setVerifyCodeInput('');
      setVerifyError(null);
      setTimeout(() => setVerifiedSuccess(null), 5000);
    } catch (err: unknown) {
      setVerifyError(
        err instanceof Error
          ? err.message
          : isArabic
            ? 'حدث خطأ أثناء التحقق من رمز الاستلام.'
            : 'An error occurred while verifying the pickup code.'
      );
    } finally {
      setIsVerifying(false);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Lock background body scroll whenever modal is open to prevent scroll-leak bug
  useEffect(() => {
    if (showBroadcastModal || showVerifyModal) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [showBroadcastModal, showVerifyModal]);

  const [formData, setFormData] = useState({
    restaurantName: activeStoreNameAr || activeStoreNameEn || '',
    neighborhood: activePartnerRecord?.neighborhood || 'Al Hamra Village',
    title: '',
    titleAr: '',
    category: (activePartnerRecord?.category || 'restaurants_cafeterias') as Category,
    imageUrl: '',
    stock: 5,
    originalPrice: 45,
    discountedPrice: 20,
    pickupWindow: '20:00 - 22:30',
    expiryHours: 4,
    allergens: '',
    ingredients: '',
  });

  // Sync form restaurant defaults whenever the selected/authenticated store updates
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      restaurantName: activeStoreNameAr || activeStoreNameEn || prev.restaurantName,
      neighborhood: activePartnerRecord?.neighborhood || prev.neighborhood,
      category: (activePartnerRecord?.category || prev.category) as Category,
    }));
    if (activePartnerRecord?.iban) {
      setWioIban(activePartnerRecord.iban);
    }
  }, [activeStoreNameAr, activeStoreNameEn, activePartnerRecord?.neighborhood, activePartnerRecord?.category, activePartnerRecord?.iban]);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const rawData = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 1000;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.78);
          setFormData((prev) => ({ ...prev, imageUrl: compressed }));
          setImageValidationError(null);
        } else {
          setFormData((prev) => ({ ...prev, imageUrl: rawData }));
          setImageValidationError(null);
        }
      };
      img.src = rawData;
    };
    reader.readAsDataURL(file);
  };

  // Auto-hide expired items unless merchant toggles showExpiredListings
  const visibleListings = listings.filter((item) => {
    const expired = isSurplusItemExpired(item.expiryTime) || item.status === 'expired';
    if (expired && !showExpiredListings) return false;
    return true;
  });

  const expiredCount = listings.filter((item) => isSurplusItemExpired(item.expiryTime) || item.status === 'expired').length;
  const totalSalvagedRevenue = listings.reduce((sum, item) => sum + item.revenueAed, 0);
  const totalStockLeft = visibleListings.reduce((sum, item) => sum + item.stock, 0);
  const activeListingsCount = visibleListings.filter((item) => item.status === 'active').length;
  const activeOrdersCount = orders.filter((o) => o.status === 'active').length;

  const handleOpenEditModal = (item: MerchantListing) => {
    setEditingListingId(item.id);
    setPriceValidationError(null);
    setImageValidationError(null);
    setFormData({
      restaurantName: item.merchantNameAr || item.merchantName || activeStoreNameAr || '',
      neighborhood: item.neighborhood || activePartnerRecord?.neighborhood || 'Al Hamra Village',
      title: item.title,
      titleAr: item.titleAr || item.title,
      category: item.category,
      imageUrl: item.imageUrl || '',
      stock: item.stock,
      originalPrice: Math.max(MIN_MERCHANT_ITEM_PRICE_AED, item.originalPrice),
      discountedPrice: Math.max(MIN_MERCHANT_ITEM_PRICE_AED, item.discountedPrice),
      pickupWindow: item.pickupWindow,
      expiryHours: 4,
      allergens: item.allergens ? item.allergens.join(', ') : '',
      ingredients: item.ingredients || '',
    });
    setShowBroadcastModal(true);
  };

  const handleSubmitBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    setPriceValidationError(null);
    setImageValidationError(null);
    if (!formData.title && !formData.titleAr) return;

    // Strictly require real uploaded product photo (no photo bank allowed)
    if (!formData.imageUrl || !formData.imageUrl.trim()) {
      setImageValidationError(
        isArabic
          ? 'يجب رفع صورة حقيقية لصنف الطعام من جهازك أو الكاميرا قبل النشر.'
          : 'You must upload a real photo of your food item before publishing.'
      );
      return;
    }

    if (!Number.isFinite(formData.discountedPrice) || formData.discountedPrice < MIN_MERCHANT_ITEM_PRICE_AED) {
      setPriceValidationError(
        isArabic
          ? `الحد الأدنى لسعر البيع الذي يمكن للتاجر إدخاله هو ${MIN_MERCHANT_ITEM_PRICE_AED} درهماً إماراتياً.`
          : `Minimum selling price is ${MIN_MERCHANT_ITEM_PRICE_AED} AED.`
      );
      return;
    }

    const safeDiscountedPrice = Number(formData.discountedPrice);
    const safeOriginalPrice = Math.max(safeDiscountedPrice, Number(formData.originalPrice) || safeDiscountedPrice);

    const expiryIso = new Date(Date.now() + Math.max(1, formData.expiryHours) * 3600 * 1000).toISOString();
    const parsedAllergens = formData.allergens
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean);

    if (editingListingId && onEditListing) {
      onEditListing(editingListingId, {
        title: formData.title || formData.titleAr,
        titleAr: formData.titleAr || formData.title,
        merchantName: formData.restaurantName,
        merchantNameAr: formData.restaurantName,
        neighborhood: formData.neighborhood,
        category: formData.category,
        imageUrl: formData.imageUrl,
        stock: formData.stock,
        originalPrice: safeOriginalPrice,
        discountedPrice: safeDiscountedPrice,
        pickupWindow: formData.pickupWindow,
        expiryTime: expiryIso,
        allergens: parsedAllergens,
        ingredients: formData.ingredients,
        ingredientsAr: formData.ingredients,
      });
    } else {
      onAddListing({
        title: formData.title || formData.titleAr,
        titleAr: formData.titleAr || formData.title,
        merchantName: formData.restaurantName,
        merchantNameAr: formData.restaurantName,
        neighborhood: formData.neighborhood,
        category: formData.category,
        imageUrl: formData.imageUrl,
        stock: formData.stock,
        initialStock: formData.stock,
        originalPrice: safeOriginalPrice,
        discountedPrice: safeDiscountedPrice,
        pickupWindow: formData.pickupWindow,
        expiryTime: expiryIso,
        allergens: parsedAllergens,
        ingredients: formData.ingredients,
        ingredientsAr: formData.ingredients,
        status: 'active',
      });
    }

    setEditingListingId(null);
    setPriceValidationError(null);
    setImageValidationError(null);
    setFormData({
      restaurantName: activeStoreNameAr || activeStoreNameEn || '',
      neighborhood: activePartnerRecord?.neighborhood || 'Al Hamra Village',
      title: '',
      titleAr: '',
      category: (activePartnerRecord?.category || 'restaurants_cafeterias') as Category,
      imageUrl: '',
      stock: 5,
      originalPrice: 45,
      discountedPrice: 20,
      pickupWindow: '20:00 - 22:30',
      expiryHours: 4,
      allergens: '',
      ingredients: '',
    });
    setShowBroadcastModal(false);
  };

  // Exact Integer-Fils Accounting Helper for Every Order (Cash vs Electronic Settlement)
  const computeOrderLedger = (o: Order) => {
    const qty = Math.max(1, o.quantity || 1);
    const merchantSubtotalFils =
      typeof o.subtotalFils === 'number'
        ? Math.round(o.subtotalFils)
        : aedToFils(o.item.discountedPrice) * qty;
    const platformServiceFeeFils =
      typeof o.serviceFeeFils === 'number'
        ? Math.round(o.serviceFeeFils)
        : CUSTOMER_SERVICE_FEE_FILS * qty;
    const pointsDiscountFils =
      typeof o.pointsDiscountFils === 'number'
        ? Math.round(o.pointsDiscountFils)
        : aedToFils(o.pointsDiscountAed || 0);
    const customerPaidFils =
      typeof o.totalFils === 'number'
        ? Math.round(o.totalFils)
        : Math.max(0, merchantSubtotalFils + platformServiceFeeFils - pointsDiscountFils);
    const commissionFils = Math.round((merchantSubtotalFils * effectiveCommissionPercent) / 100);
    const merchantNetEarningsFils = Math.max(0, merchantSubtotalFils - commissionFils);
    const isCash = o.paymentMethod === 'pickup_cash';

    // Cash order: Merchant collects customerPaidFils at counter, keeps merchantNetEarningsFils, owes platform the difference
    // Online order: Platform collects customerPaidFils online, owes merchant merchantNetEarningsFils
    const merchantOwesPlatformFils = isCash
      ? Math.max(0, customerPaidFils - merchantNetEarningsFils)
      : 0;
    const platformOwesMerchantFils = isCash
      ? Math.max(0, merchantNetEarningsFils - customerPaidFils)
      : merchantNetEarningsFils;

    return {
      isCash,
      merchantSubtotalFils,
      platformServiceFeeFils,
      customerPaidFils,
      commissionFils,
      merchantNetEarningsFils,
      merchantOwesPlatformFils,
      platformOwesMerchantFils,
    };
  };

  const validOrders = orders.filter((o) => o.status !== 'cancelled');
  const electronicOrders = validOrders.filter((o) => o.paymentMethod !== 'pickup_cash');
  const cashOrders = validOrders.filter((o) => o.paymentMethod === 'pickup_cash');

  const ledgerTotals = validOrders.reduce(
    (acc, o) => {
      const l = computeOrderLedger(o);
      acc.merchantSubtotalFils += l.merchantSubtotalFils;
      acc.customerPaidFils += l.customerPaidFils;
      acc.commissionFils += l.commissionFils;
      acc.merchantNetEarningsFils += l.merchantNetEarningsFils;
      acc.merchantOwesPlatformFils += l.merchantOwesPlatformFils;
      acc.platformOwesMerchantFils += l.platformOwesMerchantFils;
      if (l.isCash) {
        acc.cashCollectedFils += l.customerPaidFils;
      } else {
        acc.onlineCollectedFils += l.customerPaidFils;
      }
      return acc;
    },
    {
      merchantSubtotalFils: 0,
      customerPaidFils: 0,
      commissionFils: 0,
      merchantNetEarningsFils: 0,
      merchantOwesPlatformFils: 0,
      platformOwesMerchantFils: 0,
      cashCollectedFils: 0,
      onlineCollectedFils: 0,
    }
  );

  const totalGrossSales = filsToAed(ledgerTotals.merchantSubtotalFils);
  const electronicSales = filsToAed(ledgerTotals.onlineCollectedFils);
  const cashSales = filsToAed(ledgerTotals.cashCollectedFils);
  const platformCommissionTotal = filsToAed(ledgerTotals.commissionFils);
  const merchantNetEarningsTotal = filsToAed(ledgerTotals.merchantNetEarningsFils);
  const merchantOwesPlatformTotal = filsToAed(ledgerTotals.merchantOwesPlatformFils);
  const platformOwesMerchantTotal = filsToAed(ledgerTotals.platformOwesMerchantFils);
  // Positive = Platform owes Merchant; Negative = Merchant owes Platform
  const netBalanceFils = ledgerTotals.platformOwesMerchantFils - ledgerTotals.merchantOwesPlatformFils;
  const netBalanceAed = filsToAed(Math.abs(netBalanceFils));

  const handleExportSettlementCSV = () => {
    const headers = [
      'Order Code',
      'Date',
      'Food Item',
      'Payment Method',
      'Customer Paid (AED)',
      'Merchant Base Price (AED)',
      `Commission (${effectiveCommissionPercent}%) AED`,
      'Merchant Net Earnings (AED)',
      'Merchant Owes Platform - Cash (AED)',
      'Platform Owes Merchant - Online (AED)',
    ];
    const rows = validOrders.map((o) => {
      const l = computeOrderLedger(o);
      return [
        `"${o.code}"`,
        `"${new Date(o.createdAt).toLocaleDateString()}"`,
        `"${(isArabic ? o.item.title.ar : o.item.title.en).replace(/"/g, '""')}"`,
        `"${l.isCash ? 'Cash on Pickup' : 'Online Payment'}"`,
        filsToAed(l.customerPaidFils).toFixed(2),
        filsToAed(l.merchantSubtotalFils).toFixed(2),
        filsToAed(l.commissionFils).toFixed(2),
        filsToAed(l.merchantNetEarningsFils).toFixed(2),
        filsToAed(l.merchantOwesPlatformFils).toFixed(2),
        filsToAed(l.platformOwesMerchantFils).toFixed(2),
      ].join(',');
    });
    const csvString = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Flaster_Store_Settlement_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setStatementSuccessMsg(isArabic ? '✓ تم تصدير كشف الحساب والتسوية المالية بنجاح!' : '✓ Settlement statement exported successfully!');
    setTimeout(() => setStatementSuccessMsg(null), 4000);
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-200">
      
      {/* Live Synced Partner Store Selector Bar (Visible to Founder/Admin whenever stores exist in Admin) */}
      {isMasterFounder && (
        <div className="bg-[#FFFDF9] rounded-xl border border-[#EAE4DC] p-4 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-[#DC2626]" />
              <span className="font-headline font-bold text-xs text-[#1C1917]">
                {isArabic
                  ? `المتاجر المسجّلة في الإدارة العامة (${merchantPartners.length}) — متزامنة لحظياً:`
                  : `Live Synced Partner Stores from Admin (${merchantPartners.length}):`}
              </span>
            </div>
            <span className="text-[11px] text-[#78716C]">
              {isArabic
                ? 'أي متجر تضيفه في الإدارة العامة يظهر هنا فوراً كمتجر إلكتروني مصغر'
                : 'Any store added in Admin appears here instantly as a mini-store'}
            </span>
          </div>

          {merchantPartners.length === 0 ? (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-950 font-semibold">
              {isArabic
                ? 'لا توجد متاجر مضافة بعد. أضف أول متجر من لوحة الإدارة العامة وسيظهر هنا تلقائياً فوراً.'
                : 'No stores added yet. Add your first store in Admin Dashboard and it will appear here instantly.'}
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {merchantPartners.map((partner) => {
                const isSelected = authenticatedMerchant?.merchantId === partner.id;
                return (
                  <button
                    key={partner.id}
                    type="button"
                    onClick={() => onSelectMerchant && onSelectMerchant(partner)}
                    className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-2 border ${
                      isSelected
                        ? 'bg-[#DC2626] text-white border-[#DC2626] shadow-sm'
                        : 'bg-[#FAF7F2] text-[#1C1917] border-[#EAE4DC] hover:border-amber-400'
                    }`}
                  >
                    <Store className="w-3.5 h-3.5" />
                    <span>{isArabic ? partner.nameAr : partner.name}</span>
                    <span className={`text-[10px] font-metric ${isSelected ? 'text-amber-200' : 'text-[#78716C]'}`}>
                      ({partner.commissionPercent}%)
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Top Banner / Mini E-Commerce Storefront Identity */}
      <div className="bg-[#FFFDF9] rounded-2xl border border-[#EAE4DC] p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#DC2626] to-[#991B1B] text-white flex items-center justify-center shadow-md shrink-0">
            <Store className="w-7 h-7" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#78716C]">
              <span className="font-bold text-[#059669]">
                {isArabic ? 'متجر إلكتروني مصغر نشط' : 'Live Mini-Storefront'}
              </span>
              {authenticatedMerchant?.username && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-metric font-bold text-[#1C1917]" dir="ltr">
                    @{authenticatedMerchant.username}
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span>{activeStoreNeighborhood}</span>
              <span aria-hidden="true">·</span>
              <span className="font-metric font-semibold text-[#DC2626]">
                {isArabic ? `عمولة المنصة ${effectiveCommissionPercent}%` : `Commission ${effectiveCommissionPercent}%`}
              </span>
            </div>
            <h1 className="font-headline font-extrabold text-2xl text-[#1C1917] mt-1">
              {activeStoreNameAr || activeStoreNameEn
                ? isArabic
                  ? activeStoreNameAr || activeStoreNameEn
                  : activeStoreNameEn || activeStoreNameAr
                : isArabic
                  ? 'بوابة الشركاء — متجرك الإلكتروني المصغر'
                  : 'Partner Portal — Your Mini Store'}
            </h1>
            <p className="text-xs text-[#78716C]">
              {isArabic
                ? 'أضف أصناف طعامك بصورها الحقيقية، حدد الأسعار، استقبل حجوزات الزبائن، وتابع أرباحك وحساب النقدي والإلكتروني لحظياً'
                : 'List food items with real photos, set prices, receive customer bookings, and track cash vs online settlements live'}
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <button
            type="button"
            onClick={() => {
              setEditingListingId(null);
              setPriceValidationError(null);
              setImageValidationError(null);
              setFormData((prev) => ({
                ...prev,
                restaurantName: activeStoreNameAr || activeStoreNameEn || prev.restaurantName,
                title: '',
                titleAr: '',
                imageUrl: '',
              }));
              setShowBroadcastModal(true);
            }}
            className="flex-1 md:flex-initial h-11 px-5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>{isArabic ? 'إضافة صنف طعام جديد' : 'Add New Food Item'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowVerifyModal(true)}
            className="flex-1 md:flex-initial h-11 px-4 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all cursor-pointer whitespace-nowrap"
          >
            <QrCode className="w-4 h-4" />
            <span>{isArabic ? 'تسليم حجز (كود الاستلام)' : 'Verify Pickup Code'}</span>
          </button>

          <button
            type="button"
            onClick={onSwitchToMarketplace}
            className="flex-1 md:flex-initial h-11 px-4 rounded-xl bg-white border border-[#EAE4DC] hover:bg-[#FAF7F2] text-[#1C1917] font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-4 h-4 text-[#78716C]" />
            <span>{t.consumerMarketplace}</span>
          </button>

          <button
            type="button"
            onClick={onLogout}
            className="flex-1 md:flex-initial h-11 px-4 rounded-xl bg-[#FAF7F2] hover:bg-stone-200 border border-[#EAE4DC] text-stone-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
            title={lang === 'ar' ? 'تسجيل الخروج' : 'Logout'}
          >
            <Lock className="w-3.5 h-3.5 text-[#DC2626]" />
            <span>{isArabic ? 'خروج' : 'Logout'}</span>
          </button>
        </div>
      </div>

      {/* Real-Time Mini-Store Earnings & Cash/Electronic Settlement KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-metric">
        {/* Card 1: Total Store Net Earnings */}
        <div className="bg-[#FFFDF9] rounded-xl p-5 border border-[#EAE4DC] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#78716C] font-sans">
            <span>{isArabic ? 'صافي أرباح متجرك' : 'Your Net Earnings'}</span>
            <DollarSign className="w-4 h-4 text-[#059669]" />
          </div>
          <div className="text-2xl font-extrabold text-[#1C1917] tabular-nums">
            {merchantNetEarningsTotal.toFixed(2)}{' '}
            <span className="text-xs font-semibold text-[#059669]">{t.currency}</span>
          </div>
          <p className="text-[11px] text-[#78716C] font-sans">
            {isArabic
              ? `من ${validOrders.length} حجز (بعد خصم عمولة ${effectiveCommissionPercent}%)`
              : `From ${validOrders.length} bookings (after ${effectiveCommissionPercent}% fee)`}
          </p>
        </div>

        {/* Card 2: Cash Orders — What Merchant Owes Platform */}
        <div className="bg-amber-50/70 rounded-xl p-5 border border-amber-300 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-amber-950 font-sans font-bold">
            <span>{isArabic ? 'عليك تدفعه لنا (الدفع النقدي)' : 'You Owe Us (Cash Orders)'}</span>
            <ArrowUpRight className="w-4 h-4 text-[#DC2626]" />
          </div>
          <div className="text-2xl font-extrabold text-[#DC2626] tabular-nums">
            {merchantOwesPlatformTotal.toFixed(2)}{' '}
            <span className="text-xs font-semibold">{t.currency}</span>
          </div>
          <p className="text-[11px] text-amber-900 font-sans">
            {isArabic
              ? `استلمت ${cashSales.toFixed(2)} د.إ كاش (${cashOrders.length} طلب)`
              : `Collected ${cashSales.toFixed(2)} AED cash (${cashOrders.length} orders)`}
          </p>
        </div>

        {/* Card 3: Electronic Orders — What Platform Owes Merchant */}
        <div className="bg-emerald-50/70 rounded-xl p-5 border border-emerald-300 shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-emerald-950 font-sans font-bold">
            <span>{isArabic ? 'علينا ندفعه لك (الدفع الإلكتروني)' : 'We Owe You (Online Orders)'}</span>
            <ArrowDownLeft className="w-4 h-4 text-[#059669]" />
          </div>
          <div className="text-2xl font-extrabold text-[#059669] tabular-nums">
            {platformOwesMerchantTotal.toFixed(2)}{' '}
            <span className="text-xs font-semibold">{t.currency}</span>
          </div>
          <p className="text-[11px] text-emerald-900 font-sans">
            {isArabic
              ? `مبيعات إلكترونية ${electronicSales.toFixed(2)} د.إ (${electronicOrders.length} طلب)`
              : `Online sales ${electronicSales.toFixed(2)} AED (${electronicOrders.length} orders)`}
          </p>
        </div>

        {/* Card 4: Net Final Settlement + Active Items */}
        <div className="bg-[#FFFDF9] rounded-xl p-5 border border-[#EAE4DC] shadow-xs space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#78716C] font-sans font-bold">
            <span>{isArabic ? 'صافي التسوية النهائي' : 'Net Final Balance'}</span>
            <Wallet className="w-4 h-4 text-[#1C1917]" />
          </div>
          <div
            className={`text-2xl font-extrabold tabular-nums ${
              netBalanceFils > 0
                ? 'text-[#059669]'
                : netBalanceFils < 0
                  ? 'text-[#DC2626]'
                  : 'text-[#1C1917]'
            }`}
          >
            {netBalanceAed.toFixed(2)} <span className="text-xs font-semibold">{t.currency}</span>
          </div>
          <p className="text-[11px] font-sans font-semibold text-[#57534E]">
            {netBalanceFils > 0
              ? isArabic
                ? 'المستحق لك للتحويل من المنصة'
                : 'Net payout due to your store'
              : netBalanceFils < 0
                ? isArabic
                  ? 'المستحق عليك تحويله للمنصة'
                  : 'Net balance payable to Flaster'
                : isArabic
                  ? `${activeListingsCount} أصناف معروضة • ${totalStockLeft} قطعة متوفرة`
                  : `${activeListingsCount} active items • ${totalStockLeft} in stock`}
          </p>
        </div>
      </div>

      {/* Workspace Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#CBD5E1] pb-2">
        <div className="flex items-center gap-2">
          
          <button
            onClick={() => setWorkspaceTab('inventory')}
            className={`px-4 py-2.5 rounded-xl font-headline font-bold text-xs flex items-center gap-2 transition-all ${
              workspaceTab === 'inventory'
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-[#64748B] hover:text-[#0F172A] border border-slate-200'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>{t.activeListings}</span>
            <span className="font-metric text-[10px] bg-white/20 px-1.5 py-0.5 rounded">
              {listings.length}
            </span>
          </button>

          <button
            onClick={() => setWorkspaceTab('live_orders')}
            className={`px-4 py-2.5 rounded-xl font-headline font-bold text-xs flex items-center gap-2 transition-all relative ${
              workspaceTab === 'live_orders'
                ? 'bg-[#DC2626] text-white shadow-md'
                : 'bg-white text-[#64748B] hover:text-[#DC2626] border border-slate-200'
            }`}
          >
            <Bell className="w-4 h-4 animate-bounce" />
            <span>{isArabic ? 'مركز استقبال الطلبات الحية الفورية' : 'Live Kitchen Orders Feed'}</span>
            {activeOrdersCount > 0 && (
              <span className="font-metric text-[10px] bg-white text-[#DC2626] font-extrabold px-2 py-0.5 rounded-full shadow-sm">
                {activeOrdersCount} {isArabic ? 'جديد' : 'new'}
              </span>
            )}
          </button>

          <button
            onClick={() => setWorkspaceTab('settlements')}
            className={`px-4 py-2.5 rounded-xl font-headline font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              workspaceTab === 'settlements'
                ? 'bg-amber-400 text-stone-950 shadow-md'
                : 'bg-white text-[#64748B] hover:text-[#0F172A] border border-slate-200'
            }`}
          >
            <Banknote className="w-4 h-4 text-[#059669]" />
            <span>{isArabic ? 'حسابات المطعم والتسويات البنكية' : 'Bank Account & Settlements'}</span>
          </button>
        </div>

        {/* Live Status Indicator & Loud Kitchen Chime Toggle + Test Button */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const nextState = !kitchenChimeEnabled;
              setKitchenChimeEnabled(nextState);
              if (nextState) {
                playKitchenBell();
                setChimeTestFeedback(isArabic ? '🔔 تم تشغيل جرس المطبخ وتجربته!' : '🔔 Kitchen bell enabled!');
                setTimeout(() => setChimeTestFeedback(null), 3000);
              }
            }}
            className={`px-3 py-2 rounded-xl border text-xs flex items-center gap-1.5 transition-all cursor-pointer font-bold ${
              kitchenChimeEnabled
                ? 'bg-amber-100 text-amber-950 border-amber-400 shadow-2xs'
                : 'bg-slate-100 text-slate-500 border-slate-300'
            }`}
            title={isArabic ? 'تفعيل أو كتم جرس التنبيه للمطبخ' : 'Toggle Kitchen Alert Sound'}
          >
            {kitchenChimeEnabled ? <Volume2 className="w-4 h-4 text-[#DC2626] animate-pulse" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
            <span>{isArabic ? (kitchenChimeEnabled ? 'جرس المطبخ: مفعّل 🔊' : 'جرس المطبخ: صامت 🔇') : t.soundAlertToggle}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              playKitchenBell();
              setKitchenChimeEnabled(true);
              setChimeTestFeedback(isArabic ? '🔔 رنّ جرس المطبخ الآن! هذا الصوت يعمل تلقائياً عند وصول أي طلب جديد.' : '🔔 Kitchen bell chimed! Plays automatically on new orders.');
              setTimeout(() => setChimeTestFeedback(null), 4000);
            }}
            className="px-3 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
          >
            <Bell className="w-3.5 h-3.5 text-amber-300" />
            <span>{isArabic ? '🔔 اضغط لتجربة صوت الجرس' : '🔔 Test Bell Sound'}</span>
          </button>

          <div className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-100 text-emerald-900 text-xs font-bold border border-emerald-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>{isArabic ? 'المطبخ متصل ويستقبل الطلبات' : 'Kitchen Live Online'}</span>
          </div>
        </div>
      </div>

      {chimeTestFeedback && (
        <div className="p-3.5 rounded-xl bg-amber-100 border border-amber-400 text-amber-950 text-xs font-bold flex items-center justify-between shadow-sm animate-in fade-in">
          <div className="flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-[#DC2626]" />
            <span>{chimeTestFeedback}</span>
          </div>
          <button onClick={() => setChimeTestFeedback(null)} className="font-bold cursor-pointer">✕</button>
        </div>
      )}

      {/* TAB 1: Mini E-Commerce Storefront Items Catalog */}
      {workspaceTab === 'inventory' && (
        <div className="bg-[#FFFDF9] rounded-2xl border border-[#EAE4DC] shadow-xs overflow-hidden animate-in fade-in">
          <div className="p-5 border-b border-[#EAE4DC] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-headline font-bold text-lg text-[#1C1917] flex items-center gap-2">
                <Utensils className="w-5 h-5 text-[#DC2626]" />
                <span>{isArabic ? 'أصناف الطعام في متجرك الإلكتروني' : 'Food Items in Your Mini Store'}</span>
              </h3>
              <p className="text-xs text-[#78716C]">
                {isArabic
                  ? 'أضف أصناف طعامك بصورها الحقيقية، حدد السعر والكمية وأوقات الاستلام، وتابع حالتها مباشرة'
                  : 'Add your food items with real photos, set prices, stock, and pickup windows'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {expiredCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowExpiredListings(!showExpiredListings)}
                  className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs font-bold cursor-pointer"
                >
                  {showExpiredListings
                    ? (isArabic ? 'إخفاء المنتهية تلقائياً' : 'Auto-hide Expired')
                    : (isArabic ? `إظهار المنتهية (${expiredCount})` : `Show Expired (${expiredCount})`)}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setEditingListingId(null);
                  setPriceValidationError(null);
                  setImageValidationError(null);
                  setFormData((prev) => ({
                    ...prev,
                    restaurantName: activeStoreNameAr || activeStoreNameEn || prev.restaurantName,
                    title: '',
                    titleAr: '',
                    imageUrl: '',
                  }));
                  setShowBroadcastModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{isArabic ? 'إضافة صنف جديد' : 'Add Food Item'}</span>
              </button>
            </div>
          </div>

          {visibleListings.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-200 text-[#DC2626] mx-auto flex items-center justify-center">
                <Utensils className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h4 className="font-headline font-bold text-base text-[#1C1917]">
                  {isArabic ? 'متجرك جاهز — أضف أول صنف طعام الآن' : 'Your Mini Store is Ready — Add Your First Food Item'}
                </h4>
                <p className="text-xs text-[#78716C] max-w-md mx-auto">
                  {isArabic
                    ? 'ارفع صورة حقيقية لصنف الطعام، حدد السعر (بحد أدنى 15 درهم) والكمية ووقت الاستلام ليظهر للزبائن فوراً.'
                    : 'Upload a real photo of your dish, set the price (minimum 15 AED), stock, and pickup window to go live immediately.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingListingId(null);
                  setPriceValidationError(null);
                  setImageValidationError(null);
                  setShowBroadcastModal(true);
                }}
                className="px-5 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isArabic ? 'إضافة أول صنف طعام' : 'Add First Food Item'}</span>
              </button>
            </div>
          ) : (
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleListings.map((item) => {
                const title = isArabic ? item.titleAr || item.title : item.title;
                const isSoldOut = item.stock === 0 || item.status === 'sold_out';
                const isPaused = item.status === 'paused';
                const isExpired = isSurplusItemExpired(item.expiryTime) || item.status === 'expired';
                const merchantPriceFils = aedToFils(item.discountedPrice);
                const merchantNetPerUnitAed = filsToAed(
                  merchantPriceFils - Math.round((merchantPriceFils * effectiveCommissionPercent) / 100)
                );

                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-[#EAE4DC] bg-white overflow-hidden flex flex-col justify-between shadow-2xs"
                  >
                    {/* Uploaded Product Photo */}
                    <div className="relative aspect-[16/10] bg-stone-100 overflow-hidden">
                      {item.imageUrl ? (
                        <img
                          src={item.imageUrl}
                          alt={title}
                          referrerPolicy="no-referrer"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-stone-400">
                          <Camera className="w-8 h-8" />
                        </div>
                      )}
                      <div className="absolute top-2.5 start-2.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-black/70 text-white">
                        {isExpired
                          ? isArabic ? 'منتهي الصلاحية' : 'Expired'
                          : isSoldOut
                            ? isArabic ? 'نفدت الكمية' : 'Sold Out'
                            : isPaused
                              ? isArabic ? 'متوقف مؤقتاً' : 'Paused'
                              : isArabic ? 'متاح للحجز' : 'Live'}
                      </div>
                    </div>

                    {/* Item Details */}
                    <div className="p-4 space-y-3 flex-1 flex flex-col justify-between text-xs">
                      <div className="space-y-1">
                        <h4 className="font-headline font-bold text-sm text-[#1C1917] line-clamp-1">
                          {title}
                        </h4>
                        <div className="flex items-center justify-between text-[11px] text-[#78716C] font-metric">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            <span>{item.pickupWindow}</span>
                          </span>
                          <span>
                            {isArabic ? 'ربحك الصافي/قطعة:' : 'Your Net/unit:'}{' '}
                            <strong className="text-[#059669] tabular-nums">
                              {merchantNetPerUnitAed.toFixed(2)} {t.currency}
                            </strong>
                          </span>
                        </div>
                      </div>

                      {/* Price & Stock Controls */}
                      <div className="flex items-center justify-between pt-2 border-t border-[#F5EFEB]">
                        <div className="font-metric">
                          <span className="text-[10px] text-stone-400 line-through block">
                            {item.originalPrice.toFixed(2)} {t.currency}
                          </span>
                          <strong className="text-base font-extrabold text-[#1C1917] tabular-nums">
                            {item.discountedPrice.toFixed(2)} {t.currency}
                          </strong>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onUpdateStock(item.id, -1)}
                            disabled={item.stock <= 0}
                            className="w-8 h-8 rounded-lg border border-[#EAE4DC] bg-[#FAF7F2] hover:bg-amber-50 disabled:opacity-30 text-[#1C1917] font-bold cursor-pointer"
                          >
                            -
                          </button>
                          <span className="font-metric font-extrabold text-sm w-7 text-center tabular-nums">
                            {item.stock}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateStock(item.id, 1)}
                            className="w-8 h-8 rounded-lg border border-[#EAE4DC] bg-[#FAF7F2] hover:bg-amber-50 text-[#1C1917] font-bold cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 pt-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(item)}
                          className="flex-1 py-2 px-2.5 rounded-lg text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-200 cursor-pointer"
                        >
                          {isArabic ? 'تعديل السعر والصنف' : 'Edit Item'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onToggleStatus(item.id)}
                          className="py-2 px-2.5 rounded-lg text-xs font-semibold border border-[#EAE4DC] bg-[#FAF7F2] hover:bg-stone-100 text-stone-700 cursor-pointer"
                        >
                          {isPaused ? t.resumeListing : t.pauseListing}
                        </button>
                        {onDeleteListing && (
                          <button
                            type="button"
                            onClick={() => onDeleteListing(item.id)}
                            title={isArabic ? 'حذف الصنف' : 'Delete'}
                            className="p-2 rounded-lg text-red-600 hover:bg-red-50 border border-red-200/70 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Live Kitchen Orders Dispatch Center */}
      {workspaceTab === 'live_orders' && (
        <div className="space-y-4 animate-in fade-in">
          
          <div className="bg-[#FFFDF9] rounded-xl border border-[#EAE4DC] p-5 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="font-headline font-bold text-lg text-[#1C1917] flex items-center gap-2">
                <ChefHat className="w-5 h-5 text-[#DC2626]" />
                <span>{isArabic ? 'طلبات الزبائن الواردة لحظياً لمطبخك' : 'Incoming Real-Time Kitchen Orders'}</span>
              </h3>
              <p className="text-xs text-[#78716C]">
                {isArabic 
                  ? 'عندما يطلب الزبون، يرن جرس التنبيه الصوتي تلقائياً وتظهر بطاقة الطلب هنا فوراً مع زر مراسلة الزبون عبر واتساب.'
                  : 'Whenever a customer orders, the kitchen bell chimes automatically and the order appears here with 1-click WhatsApp alert.'}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={playKitchenBell}
                className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <Bell className="w-3.5 h-3.5 text-[#DC2626]" />
                <span>{isArabic ? 'اختبار رنين الجرس 🔊' : 'Test Chime 🔊'}</span>
              </button>
              <span className="font-metric text-xs bg-[#FAF7F2] border border-[#EAE4DC] px-3 py-1.5 rounded-full text-[#1C1917] font-bold">
                {orders.length} {isArabic ? 'إجمالي طلبات اليوم' : 'total today'}
              </span>
            </div>
          </div>

          {/* Orders Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders.map((order) => {
              const isCollected = order.status === 'collected';
              const title = isArabic ? order.item.title.ar : order.item.title.en;
              const currentStatus = order.workflowStatus || (isCollected ? 'collected' : 'ready');

              return (
                <div 
                  key={order.id}
                  className={`bg-[#FFFDF9] rounded-xl border p-5 shadow-xs space-y-4 transition-all ${
                    currentStatus === 'new'
                      ? 'border-[#DC2626] ring-2 ring-red-500/15'
                      : 'border-[#EAE4DC]'
                  }`}
                >
                  {/* Top Card Badge & Timestamp */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-metric font-extrabold text-sm text-[#059669] bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                        {order.code}
                      </span>
                      {currentStatus === 'new' && (
                        <span className="bg-[#DC2626] text-white font-bold text-[10px] px-2 py-0.5 rounded-full animate-pulse">
                          {isArabic ? 'طلب جديد وارد' : 'New Order'}
                        </span>
                      )}
                    </div>

                    <span className="text-[11px] text-[#78716C] font-metric">
                      {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Item Details */}
                  <div className="space-y-1">
                    <h4 className="font-headline font-bold text-sm text-[#1C1917] line-clamp-1">
                      {title}
                    </h4>
                    <p className="text-xs text-[#78716C]">
                      {order.quantity}x {isArabic ? 'وجبة فائض' : 'surplus meal'} • <strong className="text-[#1C1917] font-metric">{order.totalAed.toFixed(2)} {t.currency}</strong>
                    </p>
                  </div>

                  {/* Fulfillment mode: Strictly Self-Pickup */}
                  <div className="p-2.5 rounded-lg text-xs font-semibold flex items-center justify-between bg-emerald-50 text-emerald-900 border border-emerald-200">
                    <div className="flex items-center gap-2">
                      <Store className="w-4 h-4 text-emerald-600" />
                      <span>{isArabic ? 'استلام شخصي من الكاونتر فقط' : 'Self-Pickup at Counter'}</span>
                    </div>
                    <span className="font-metric text-[11px] font-bold">
                      {order.pickupStart} - {order.pickupEnd}
                    </span>
                  </div>

                  {/* Payment Method & Exact Per-Order Settlement Breakdown */}
                  {(() => {
                    const ledger = computeOrderLedger(order);
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-[#FAF7F2] border border-[#EAE4DC]">
                          <span className="text-[#78716C] flex items-center gap-1 font-medium">
                            <CreditCard className="w-3.5 h-3.5" />
                            {isArabic ? 'طريقة الدفع:' : 'Payment:'}
                          </span>
                          <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                            ledger.isCash
                              ? 'text-amber-900 bg-amber-100 border border-amber-300'
                              : 'text-emerald-900 bg-emerald-100 border border-emerald-300'
                          }`}>
                            {ledger.isCash
                              ? (isArabic ? 'نقداً عند الاستلام بالفرع' : 'Cash on Pickup')
                              : (isArabic ? 'مدفوع إلكترونياً للمنصة' : 'Paid Online')}
                          </span>
                        </div>

                        <div
                          className={`p-2.5 rounded-lg border text-[11px] font-metric space-y-1 ${
                            ledger.isCash
                              ? 'bg-amber-50/70 border-amber-300 text-amber-950'
                              : 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                          }`}
                        >
                          <div className="flex justify-between">
                            <span className="font-sans">{isArabic ? 'صافي ربح متجرك:' : 'Your Net Profit:'}</span>
                            <strong className="text-[#059669] tabular-nums">
                              +{filsToAed(ledger.merchantNetEarningsFils).toFixed(2)} {t.currency}
                            </strong>
                          </div>
                          {ledger.isCash ? (
                            <div className="flex justify-between">
                              <span className="font-sans font-bold text-[#DC2626]">
                                {isArabic ? 'عليك تدفعه لنا (نقدي):' : 'You Owe Flaster (Cash):'}
                              </span>
                              <strong className="text-[#DC2626] tabular-nums">
                                {filsToAed(ledger.merchantOwesPlatformFils).toFixed(2)} {t.currency}
                              </strong>
                            </div>
                          ) : (
                            <div className="flex justify-between">
                              <span className="font-sans font-bold text-[#059669]">
                                {isArabic ? 'علينا ندفعه لك (إلكتروني):' : 'Flaster Owes You (Online):'}
                              </span>
                              <strong className="text-[#059669] tabular-nums">
                                +{filsToAed(ledger.platformOwesMerchantFils).toFixed(2)} {t.currency}
                              </strong>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Customer Info */}
                  <div className="p-3 bg-[#FAF7F2] rounded-lg text-[11px] text-[#44403C] space-y-1 border border-[#EAE4DC]">
                    <div className="flex justify-between">
                      <span className="text-[#78716C]">{isArabic ? 'الزبون:' : 'Customer:'}</span>
                      <strong className="text-[#1C1917]">{order.customerName || 'زبون معتمد'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#78716C]">{isArabic ? 'الهاتف:' : 'Phone:'}</span>
                      <span className="font-metric font-semibold text-[#1C1917]">{order.customerPhone || '+971 50 123 4567'}</span>
                    </div>
                  </div>

                  {/* Status Stepper Progression */}
                  <div className="space-y-2 pt-1 border-t border-[#EAE4DC]">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-[#78716C] uppercase tracking-wider block">
                        {isArabic ? 'مرحلة تحضير وتسليم الطلب:' : 'Order Kitchen Stage:'}
                      </span>
                      <span className="font-metric text-[10px] font-bold text-[#DC2626]">
                        {currentStatus.toUpperCase()}
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1 text-center">
                      <button
                        onClick={() => onUpdateOrderStatus && onUpdateOrderStatus(order.id, 'accepted')}
                        className={`py-1.5 px-0.5 rounded text-[10px] font-bold transition-all border cursor-pointer ${
                          currentStatus === 'accepted' || currentStatus === 'preparing'
                            ? 'bg-amber-400 text-stone-950 border-amber-500 shadow-xs'
                            : 'bg-white text-stone-700 border-[#EAE4DC] hover:bg-amber-50'
                        }`}
                      >
                        {isArabic ? 'قبول وتحضير 👨‍🍳' : 'Accept 👨‍🍳'}
                      </button>

                      <button
                        onClick={() => onUpdateOrderStatus && onUpdateOrderStatus(order.id, 'ready')}
                        className={`py-1.5 px-0.5 rounded text-[10px] font-bold transition-all border cursor-pointer ${
                          currentStatus === 'ready'
                            ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                            : 'bg-white text-stone-700 border-[#EAE4DC] hover:bg-amber-50'
                        }`}
                      >
                        {isArabic ? 'جاهز 📦' : 'Ready 📦'}
                      </button>

                      <button
                        onClick={() => onUpdateOrderStatus && onUpdateOrderStatus(order.id, 'picked_up')}
                        className={`py-1.5 px-0.5 rounded text-[10px] font-bold transition-all border cursor-pointer ${
                          currentStatus === 'picked_up' || currentStatus === 'delivered'
                            ? 'bg-[#DC2626] text-white border-red-700 shadow-xs'
                            : 'bg-white text-stone-700 border-[#EAE4DC] hover:bg-amber-50'
                        }`}
                      >
                        {isArabic ? 'تم الاستلام 🛍️' : 'Picked Up 🛍️'}
                      </button>

                      <button
                        onClick={() => onMarkOrderCollected(order.id)}
                        className={`py-1.5 px-0.5 rounded text-[10px] font-bold transition-all border cursor-pointer ${
                          isCollected || currentStatus === 'completed' || currentStatus === 'collected'
                            ? 'bg-[#059669] text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-stone-700 border-[#EAE4DC] hover:bg-amber-50'
                        }`}
                      >
                        {isArabic ? 'مكتمل ✓' : 'Completed ✓'}
                      </button>
                    </div>
                  </div>

                  {/* 1-Click WhatsApp update to Customer */}
                  <div className="pt-1">
                    <a
                      href={`https://wa.me/${(order.customerPhone || '971501234567').replace(/[^0-9]/g, '')}?text=${encodeURIComponent(
                        isArabic
                          ? `مرحباً ${order.customerName || 'عزيزنا الزبون'}! وجبة الفائض المحجوزة #${order.code} من مطبخنا أصبحت جاهزة للاستلام الآن خلال الموعد (${order.pickupStart} - ${order.pickupEnd}). نتطلع لاستقبالك!`
                          : `Hello ${order.customerName || 'customer'}! Your rescue order #${order.code} is ready for pickup during ${order.pickupStart}-${order.pickupEnd}. See you soon!`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[#059669] text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>{isArabic ? 'إرسال إشعار للزبون بالواتساب' : 'WhatsApp Customer'}</span>
                    </a>
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* TAB 3: Honest Bank Account Details & Financial Settlement Records */}
      {workspaceTab === 'settlements' && (
        <div className="space-y-6 animate-in fade-in">
          
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-[#991B1B] via-[#DC2626] to-amber-600 rounded-2xl p-6 sm:p-8 text-white space-y-4 shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-300 text-stone-950 text-xs font-extrabold">
                  <Banknote className="w-4 h-4 text-red-700" />
                  <span>{isArabic ? 'سجل التسويات المالية وحساب المطعم البنكي' : 'Merchant Financial Settlement Records'}</span>
                </div>
                <h3 className="font-headline font-bold text-xl sm:text-2xl text-white">
                  {isArabic ? 'كشف حساب المبيعات وصافي مستحقات المطعم' : 'Merchant Sales & Net Payout Statement'}
                </h3>
                <p className="text-xs text-amber-100 max-w-2xl">
                  {isArabic
                    ? `يحسب هذا الجدول تلقائياً إجمالي المبيعات، والمدفوعات الإلكترونية عبر رابط زينا (Ziina)، والمقبوضات النقدية، ويخصم عمولة المنصة (${platformCommissionPercent}%) ليظهر لكِ الصافي بدقة.`
                    : `Automatically calculates gross sales, online Ziina payments, cash collected, and nets the ${platformCommissionPercent}% platform fee.`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportSettlementCSV}
                  className="px-4 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-headline font-bold text-xs flex items-center gap-2 shadow-lg transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>{isArabic ? 'تنزيل كشف الحساب (Excel/CSV)' : 'Export Statement (CSV)'}</span>
                </button>
              </div>
            </div>

            {statementSuccessMsg && (
              <div className="p-3 bg-white/20 border border-white/40 text-white rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-amber-300" />
                <span>{statementSuccessMsg}</span>
              </div>
            )}
          </div>

          {/* Honest, Editable Bank Account Record Card */}
          <div className="bg-[#FFFDF9] rounded-xl border border-[#EAE4DC] p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#EAE4DC] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-100 text-[#DC2626] flex items-center justify-center font-bold text-lg border border-amber-300">
                  <Building2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="font-headline font-bold text-sm text-[#1C1917]">
                    {isArabic ? 'بيانات الحساب البنكي للمطعم (لحفظ رقم الـ IBAN للتحويل)' : 'Saved Restaurant Bank Details (IBAN Record)'}
                  </h4>
                  <p className="text-xs text-[#78716C]">
                    {isArabic ? 'سجلي هنا اسم البنك ورقم الآيبان (IBAN) الخاص بالمطعم للرجوع إليه عند تحويل مستحقاته الأسبوعية' : 'Record the restaurant bank name and UAE IBAN here for weekly payout transfers'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsIbanEditing(!isIbanEditing)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 cursor-pointer transition-colors"
              >
                {isIbanEditing ? (isArabic ? 'إغلاق التعديل' : 'Cancel Edit') : (isArabic ? 'تعديل بيانات البنك ✎' : 'Edit Bank Info ✎')}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
              <div className="p-3.5 bg-[#FAF7F2] rounded-xl border border-[#EAE4DC] space-y-1">
                <span className="text-[#78716C] block font-semibold">{isArabic ? 'اسم البنك:' : 'Bank Name:'}</span>
                {isIbanEditing ? (
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-[#EAE4DC] rounded-lg text-xs text-[#1C1917]"
                  />
                ) : (
                  <strong className="text-[#1C1917] block text-sm">{bankName}</strong>
                )}
              </div>

              <div className="p-3.5 bg-[#FAF7F2] rounded-xl border border-[#EAE4DC] space-y-1">
                <span className="text-[#78716C] block font-semibold">{isArabic ? 'رقم الآيبان المسجل (IBAN):' : 'Saved IBAN:'}</span>
                {isIbanEditing ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={wioIban}
                      onChange={(e) => setWioIban(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-[#EAE4DC] rounded-lg font-metric text-xs flex-1 text-[#1C1917]"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setIsIbanEditing(false);
                        setStatementSuccessMsg(isArabic ? '✓ تم حفظ بيانات الحساب البنكي والآيبان بنجاح!' : '✓ Bank details saved!');
                        setTimeout(() => setStatementSuccessMsg(null), 3500);
                      }}
                      className="px-3 py-1.5 bg-[#059669] text-white rounded-lg font-bold text-xs cursor-pointer"
                    >
                      {isArabic ? 'حفظ ✓' : 'Save ✓'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <strong className="font-metric text-sm text-[#1C1917] tracking-wider">{wioIban}</strong>
                  </div>
                )}
              </div>

              <div className="p-3.5 bg-[#FAF7F2] rounded-xl border border-[#EAE4DC] space-y-1">
                <span className="text-[#78716C] block font-semibold">{isArabic ? 'بوابة الدفع الإلكتروني المرتبطة:' : 'Online Payment Gateway:'}</span>
                <strong className="text-[#059669] block text-sm">
                  {isArabic ? 'بوابة الدفع الإلكتروني المعتمدة (Ziina API v2 / Apple Pay & Cards)' : 'Certified Payment Gateway (Ziina API v2 / Apple Pay & Cards)'}
                </strong>
              </div>
            </div>
          </div>

          {/* Financial Breakdown KPI Cards: Cash vs Online Settlement */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 font-metric">
            
            <div className="bg-[#FFFDF9] rounded-xl p-4 border border-[#EAE4DC] shadow-xs space-y-1">
              <span className="text-xs text-[#78716C] block">{isArabic ? 'صافي أرباح متجرك' : 'Your Net Earnings'}</span>
              <div className="text-xl font-bold text-[#059669]">
                {merchantNetEarningsTotal.toFixed(2)} <span className="text-xs font-semibold text-[#059669]">{t.currency}</span>
              </div>
              <span className="text-[10px] text-[#78716C] block">
                {isArabic ? `من إجمالي مبيعات ${totalGrossSales.toFixed(2)} د.إ` : `From ${totalGrossSales.toFixed(2)} AED sales`}
              </span>
            </div>

            <div className="bg-emerald-50/70 rounded-xl p-4 border border-emerald-200 shadow-xs space-y-1">
              <span className="text-xs text-emerald-900 font-bold block">{isArabic ? 'علينا ندفعه لك (إلكتروني)' : 'Platform Owes You (Online)'}</span>
              <div className="text-xl font-bold text-[#059669]">
                {platformOwesMerchantTotal.toFixed(2)} <span className="text-xs font-semibold text-[#059669]">{t.currency}</span>
              </div>
              <span className="text-[10px] text-emerald-800 block">
                {electronicOrders.length} {isArabic ? `طلب إلكتروني (${electronicSales.toFixed(2)} د.إ)` : `online (${electronicSales.toFixed(2)} AED)`}
              </span>
            </div>

            <div className="bg-red-50/70 rounded-xl p-4 border border-red-200 shadow-xs space-y-1">
              <span className="text-xs text-red-900 font-bold block">{isArabic ? 'عليك تدفعه لنا (نقدي)' : 'You Owe Platform (Cash)'}</span>
              <div className="text-xl font-bold text-[#DC2626]">
                {merchantOwesPlatformTotal.toFixed(2)} <span className="text-xs font-semibold text-[#DC2626]">{t.currency}</span>
              </div>
              <span className="text-[10px] text-red-800 block">
                {cashOrders.length} {isArabic ? `طلب نقدي (${cashSales.toFixed(2)} د.إ)` : `cash (${cashSales.toFixed(2)} AED)`}
              </span>
            </div>

            <div className="bg-[#FFFDF9] rounded-xl p-4 border border-[#EAE4DC] shadow-xs space-y-1">
              <span className="text-xs text-[#78716C] block">{isArabic ? `عمولة المنصة (${effectiveCommissionPercent}%)` : `Platform Fee (${effectiveCommissionPercent}%)`}</span>
              <div className="text-xl font-bold text-[#1C1917]">
                {platformCommissionTotal.toFixed(2)} <span className="text-xs font-semibold text-[#78716C]">{t.currency}</span>
              </div>
              <span className="text-[10px] text-[#78716C] block">{validOrders.length} {isArabic ? 'طلب معتمد' : 'valid orders'}</span>
            </div>

            <div className={`rounded-xl p-4 border shadow-xs space-y-1 ${
              netBalanceFils >= 0
                ? 'bg-emerald-50 border-emerald-300'
                : 'bg-amber-50 border-amber-300'
            }`}>
              <span className={`text-xs font-bold block ${
                netBalanceFils >= 0 ? 'text-emerald-900' : 'text-amber-950'
              }`}>
                {netBalanceFils >= 0
                  ? (isArabic ? 'صافي التسوية: علينا لك' : 'Net: Platform Pays You')
                  : (isArabic ? 'صافي التسوية: عليك لنا' : 'Net: You Pay Platform')}
              </span>
              <div className={`text-2xl font-black ${
                netBalanceFils >= 0 ? 'text-[#059669]' : 'text-amber-800'
              }`}>
                {netBalanceAed.toFixed(2)} <span className="text-xs font-semibold">{t.currency}</span>
              </div>
              <span className="text-[10px] text-[#57534E] font-semibold block">
                {netBalanceFils >= 0
                  ? (isArabic ? 'يُحوَّل لحساب متجرك' : 'Transfer to your bank')
                  : (isArabic ? 'مستحق التحويل للمنصة' : 'Due to Flaster')}
              </span>
            </div>

          </div>

          {/* Orders Financial Audit Table */}
          <div className="bg-[#FFFDF9] rounded-xl border border-[#EAE4DC] overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-[#EAE4DC] flex items-center justify-between">
              <h4 className="font-headline font-bold text-sm text-[#1C1917] flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#DC2626]" />
                <span>{isArabic ? 'كشف حساب الطلبات (نقدي vs إلكتروني)' : 'Order Settlement Ledger (Cash vs Online)'}</span>
              </h4>
              <span className="font-metric text-xs text-[#78716C]">{validOrders.length} {isArabic ? 'طلب' : 'orders'}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-[#FAF7F2] border-b border-[#EAE4DC] text-[#78716C] font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">{isArabic ? 'رقم الطلب' : 'Code'}</th>
                    <th className="px-4 py-3">{isArabic ? 'صنف الطعام' : 'Food Item'}</th>
                    <th className="px-4 py-3">{isArabic ? 'طريقة الدفع' : 'Payment'}</th>
                    <th className="px-4 py-3 text-end">{isArabic ? 'سعر الصنف' : 'Item Base'}</th>
                    <th className="px-4 py-3 text-end">{isArabic ? 'صافي ربحك' : 'Your Profit'}</th>
                    <th className="px-4 py-3 text-end">{isArabic ? 'التسوية (لنا / لك)' : 'Settlement'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE4DC] font-metric">
                  {validOrders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-[#78716C] font-sans">
                        {isArabic
                          ? 'لا توجد طلبات مسجلة لهذا المتجر حتى الآن.'
                          : 'No orders recorded for this store yet.'}
                      </td>
                    </tr>
                  ) : (
                    validOrders.map((order) => {
                      const l = computeOrderLedger(order);

                      return (
                        <tr key={order.id} className="hover:bg-[#FAF7F2] transition-colors">
                          <td className="px-4 py-3 font-bold text-[#1C1917]">{order.code}</td>
                          <td className="px-4 py-3 text-[#57534E]">
                            {isArabic ? order.item.title.ar : order.item.title.en} × {order.quantity}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              l.isCash ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {l.isCash ? (isArabic ? 'نقدي بالفرع' : 'Cash') : (isArabic ? 'دفع إلكتروني' : 'Online')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-end font-semibold text-[#1C1917]">
                            {filsToAed(l.merchantSubtotalFils).toFixed(2)} AED
                          </td>
                          <td className="px-4 py-3 text-end font-bold text-[#059669]">
                            {filsToAed(l.merchantNetEarningsFils).toFixed(2)} AED
                          </td>
                          <td className="px-4 py-3 text-end font-bold">
                            {l.isCash ? (
                              <span className="text-[#DC2626]">
                                {isArabic
                                  ? `عليك لنا: ${filsToAed(l.merchantOwesPlatformFils).toFixed(2)} د.إ`
                                  : `You owe: ${filsToAed(l.merchantOwesPlatformFils).toFixed(2)} AED`}
                              </span>
                            ) : (
                              <span className="text-[#059669]">
                                {isArabic
                                  ? `علينا لك: ${filsToAed(l.platformOwesMerchantFils).toFixed(2)} د.إ`
                                  : `We owe you: ${filsToAed(l.platformOwesMerchantFils).toFixed(2)} AED`}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* Broadcast Surplus Batch Modal */}
      {showBroadcastModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-900/70 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
          onClick={() => setShowBroadcastModal(false)}
        >
          <div 
            className="relative w-full max-w-2xl bg-[#FFFDF9] rounded-2xl sm:rounded-3xl shadow-2xl border border-[#EAE4DC] flex flex-col max-h-[92vh] overflow-hidden my-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header with Prominent Exit Button */}
            <div className="sticky top-0 z-20 bg-[#FAF7F2] border-b border-[#EAE4DC] px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[#DC2626] to-amber-500 text-white flex items-center justify-center shadow-xs">
                  <Sparkles className="w-5 h-5 text-amber-100" />
                </div>
                <div>
                  <h3 className="font-headline font-extrabold text-base sm:text-lg text-[#1C1917]">
                    {editingListingId
                      ? (isArabic ? 'تحديث وتعديل الصنف وأوقات العرض ✏️' : 'Edit Item & Offer Pickup Times ✏️')
                      : (isArabic ? 'إضافة وبث عرض جديد للمطعم' : t.quickBroadcastTitle)}
                  </h3>
                  <p className="text-xs text-[#78716C]">
                    {editingListingId
                      ? (isArabic ? 'عدّل أوقات الاستلام، الأسعار، الكميات أو الصورة واحفظ التغييرات فوراً' : 'Update pickup window, prices, stock, or photo immediately')
                      : (isArabic ? 'أدخل تفاصيل الوجبة، ارفع صورتها، واعرضها للزبائن فوراً' : 'List your surplus gourmet package with custom photos')}
                  </p>
                </div>
              </div>

              {/* High-visibility Close Button */}
              <button
                type="button"
                onClick={() => {
                  setEditingListingId(null);
                  setShowBroadcastModal(false);
                }}
                className="w-9 h-9 rounded-full bg-white border border-[#EAE4DC] text-stone-600 hover:text-stone-900 hover:bg-stone-100 flex items-center justify-center cursor-pointer shadow-xs transition-colors shrink-0"
                title={isArabic ? 'إغلاق وخروج' : 'Close & Exit'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSubmitBroadcast} className="flex-1 flex flex-col min-h-0">
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs overscroll-contain">
                
                {/* 1. Restaurant Name & Service Zone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-semibold text-[#1C1917] mb-1.5">
                      {lang === 'ar' ? 'اسم المطعم / المنشأة *' : 'Restaurant / Partner Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Al Hamra Patisserie"
                      value={formData.restaurantName}
                      onChange={(e) => setFormData({ ...formData, restaurantName: e.target.value })}
                      className="w-full h-11 px-3 bg-white border border-[#EAE4DC] rounded-xl text-xs text-[#1C1917] focus:outline-none focus:border-[#DC2626]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#1C1917] mb-1.5">
                      {lang === 'ar' ? 'المنطقة التابعة برأس الخيمة *' : 'Service Zone *'}
                    </label>
                    <select
                      value={formData.neighborhood}
                      onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                      className="w-full h-11 px-3 bg-white border border-[#EAE4DC] rounded-xl text-xs text-[#1C1917] focus:outline-none focus:border-[#DC2626] cursor-pointer"
                    >
                      {regions.length > 0 ? (
                        regions.filter(r => r.id !== 'region-all').map((r) => (
                          <option key={r.id} value={r.name}>
                            {isArabic ? `${r.nameAr} (${r.cityAr})` : `${r.name} (${r.city})`}
                          </option>
                        ))
                      ) : (
                        <>
                          <option value="Sharisha Core">الشريشة (Sharisha)</option>
                          <option value="Al Hamra Village">قرية الحمراء (Al Hamra)</option>
                          <option value="Mina Al Arab">ميناء العرب (Mina Al Arab)</option>
                        </>
                      )}
                    </select>
                  </div>
                </div>

                {/* 2. Food Item Names */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-semibold text-[#1C1917] mb-1.5">
                      {lang === 'ar' ? 'اسم صنف الطعام (عربي) *' : 'Food Item Name (Arabic)'}
                    </label>
                    <input
                      type="text"
                      placeholder={isArabic ? 'مثال: برياني لحم طازج أو كرواسون بالزبدة' : 'e.g. Fresh Mutton Biryani'}
                      value={formData.titleAr}
                      onChange={(e) => setFormData({ ...formData, titleAr: e.target.value })}
                      className="w-full h-11 px-3 bg-white border border-[#EAE4DC] rounded-xl text-xs text-[#1C1917] focus:outline-none focus:border-[#DC2626]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#1C1917] mb-1.5">
                      {lang === 'ar' ? 'اسم الصنف (إنجليزي)' : 'Food Item Name (English)'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Fresh Mutton Biryani"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full h-11 px-3 bg-white border border-[#EAE4DC] rounded-xl text-xs text-[#1C1917] focus:outline-none focus:border-[#DC2626]"
                    />
                  </div>
                </div>

                {/* 3. MANDATORY REAL PRODUCT PHOTO UPLOAD (Photo Bank Removed) */}
                <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#EAE4DC] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-[#DC2626]" />
                      <span className="font-bold text-xs text-[#1C1917]">
                        {isArabic ? 'صورة حقيقية لصنف الطعام * (إلزامي من جهازك أو الكاميرا)' : 'Real Product Photo * (Required from device or camera)'}
                      </span>
                    </div>
                    {formData.imageUrl && (
                      <span className="text-[11px] font-bold text-emerald-700">
                        ✓ {isArabic ? 'تم رفع الصورة' : 'Photo Ready'}
                      </span>
                    )}
                  </div>

                  {/* Hidden native file input */}
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageFileChange}
                    className="hidden"
                  />

                  {formData.imageUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-[#EAE4DC] bg-black/5 aspect-[16/9] max-h-48 group">
                      <img
                        src={formData.imageUrl}
                        alt="Product Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 flex items-end justify-between p-3">
                        <span className="text-[11px] text-white font-semibold bg-black/50 px-2.5 py-1 rounded-lg">
                          {isArabic ? 'صورة المنتج المرفوعة' : 'Uploaded Product Photo'}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-lg bg-white hover:bg-stone-50 text-stone-900 font-bold text-xs shadow-sm cursor-pointer flex items-center gap-1"
                          >
                            <Upload className="w-3.5 h-3.5 text-[#DC2626]" />
                            <span>{isArabic ? 'تغيير الصورة' : 'Change'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, imageUrl: '' }))}
                            className="px-2.5 py-1.5 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs shadow-sm cursor-pointer"
                            title={isArabic ? 'حذف الصورة' : 'Remove Photo'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all space-y-2 group ${
                        imageValidationError
                          ? 'border-red-500 bg-red-50/40'
                          : 'border-amber-400 hover:border-[#DC2626] bg-white hover:bg-amber-50/40'
                      }`}
                    >
                      <div className="w-11 h-11 rounded-full bg-amber-100 text-[#DC2626] mx-auto flex items-center justify-center group-hover:scale-105 transition-transform">
                        <Upload className="w-5 h-5" />
                      </div>
                      <p className="font-bold text-xs text-[#1C1917]">
                        {isArabic ? 'اضغط هنا لرفع صورة حقيقية لصنف الطعام من جهازك أو الكاميرا' : 'Click to upload a real photo of your food item'}
                      </p>
                      <p className="text-[11px] text-[#78716C]">
                        {isArabic ? 'يجب رفع صورة حقيقية لمنتجك (JPG, PNG, WebP) — لا توجد صور جاهزة' : 'Real product photo required (JPG, PNG, WebP)'}
                      </p>
                    </div>
                  )}

                  {imageValidationError && (
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-300 text-red-800 text-xs font-bold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                      <span>{imageValidationError}</span>
                    </div>
                  )}
                </div>

                {/* 4. Category & Stock */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-semibold text-[#1C1917] mb-1.5">
                      {t.selectCategory}
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value as Category })}
                      className="w-full h-11 px-3 bg-white border border-[#EAE4DC] rounded-xl text-xs text-[#1C1917] focus:outline-none focus:border-[#DC2626] cursor-pointer"
                    >
                      <option value="restaurants_cafeterias">
                        {isArabic ? 'مطاعم وكفتيريات' : 'Restaurants & Cafeterias'}
                      </option>
                      <option value="bakeries_coffeeshops">
                        {isArabic ? 'مخابز وكوفي شوب' : 'Bakeries & Coffee Shops'}
                      </option>
                      <option value="supermarkets_groceries">
                        {isArabic ? 'أسواق ومواد غذائية' : 'Supermarkets & Groceries'}
                      </option>
                      <option value="home_businesses">
                        {isArabic ? 'مشاريع منزلية' : 'Home-Based Businesses'}
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#1C1917] mb-1.5">
                      {t.quantityAvailable} (الوجبات المتوفرة الليلة) *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      required
                      value={formData.stock}
                      onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 1 })}
                      className="w-full h-11 px-3 bg-white border border-[#EAE4DC] rounded-xl text-sm font-metric text-[#1C1917] focus:outline-none focus:border-[#DC2626]"
                    />
                  </div>
                </div>

                {/* 5. Pricing: Regular vs Surplus Rescue Price (Minimum 15 AED + Automatic 1.50 AED Customer Service Fee) */}
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block font-semibold text-[#1C1917] mb-1.5">
                        {t.regularPriceAed} (سعر المنيو العادي) *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={MIN_MERCHANT_ITEM_PRICE_AED}
                          step="0.5"
                          required
                          value={formData.originalPrice}
                          onChange={(e) => setFormData({ ...formData, originalPrice: parseFloat(e.target.value) || 0 })}
                          className="w-full h-11 px-3 pe-12 bg-white border border-[#EAE4DC] rounded-xl text-sm font-metric text-[#1C1917] focus:outline-none focus:border-[#DC2626]"
                        />
                        <span className="absolute end-3 top-3 text-xs text-[#78716C] font-metric font-semibold">AED</span>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-[#1C1917] mb-1.5">
                        {t.rescuePriceAed} ({isArabic ? `الحد الأدنى ${MIN_MERCHANT_ITEM_PRICE_AED} درهم` : `Min ${MIN_MERCHANT_ITEM_PRICE_AED} AED`}) *
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={MIN_MERCHANT_ITEM_PRICE_AED}
                          step="0.5"
                          required
                          value={formData.discountedPrice}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setFormData({ ...formData, discountedPrice: val });
                            if (val >= MIN_MERCHANT_ITEM_PRICE_AED) {
                              setPriceValidationError(null);
                            }
                          }}
                          className={`w-full h-11 px-3 pe-12 bg-white border rounded-xl text-sm font-metric font-extrabold focus:outline-none ${
                            formData.discountedPrice < MIN_MERCHANT_ITEM_PRICE_AED
                              ? 'border-red-500 text-red-600 focus:border-red-600'
                              : 'border-[#EAE4DC] text-[#DC2626] focus:border-[#DC2626]'
                          }`}
                        />
                        <span className="absolute end-3 top-3 text-xs text-[#DC2626] font-metric font-bold">AED</span>
                      </div>
                      {formData.discountedPrice < MIN_MERCHANT_ITEM_PRICE_AED ? (
                        <p className="text-[11px] text-red-600 font-bold mt-1 flex items-center gap-1">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>
                            {isArabic
                              ? `الحد الأدنى المسموح به للسعر هو ${MIN_MERCHANT_ITEM_PRICE_AED} درهم`
                              : `Minimum allowed price is ${MIN_MERCHANT_ITEM_PRICE_AED} AED`}
                          </span>
                        </p>
                      ) : formData.originalPrice > formData.discountedPrice ? (
                        <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                          ✓ {isArabic ? 'نسبة الخصم للزبون: ' : 'Discount rate: '}
                          {Math.round(((formData.originalPrice - formData.discountedPrice) / formData.originalPrice) * 100)}%
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {priceValidationError && (
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-300 text-red-800 text-xs font-bold flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                      <span>{priceValidationError}</span>
                    </div>
                  )}

                  {/* Locked Automatic Price Preview (+1.50 AED blended silently into customer price) */}
                  <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-300 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-amber-950 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Lock className="w-3.5 h-3.5 text-amber-700" />
                        <span>
                          {isArabic
                            ? 'احتساب السعر التلقائي للزبون (مقفل وغير قابل للتعديل):'
                            : 'Automatic Customer Price Breakdown (Locked):'}
                        </span>
                      </span>
                      <span className="text-[10px] font-extrabold text-amber-900">
                        {isArabic ? 'تلقائي ومقفل' : 'Locked'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1.5 border-t border-amber-200/80 font-metric text-[11px] tabular-nums">
                      <div className="bg-white/80 rounded-lg p-2 border border-amber-200/70">
                        <span className="text-[#78716C] block text-[10px] font-sans">
                          {isArabic ? 'سعر الصنف (لك)' : 'Your Price'}
                        </span>
                        <strong className="text-[#1C1917] text-xs">
                          {Math.max(0, formData.discountedPrice || 0).toFixed(2)} {t.currency}
                        </strong>
                      </div>
                      <div className="bg-white/80 rounded-lg p-2 border border-amber-200/70">
                        <span className="text-amber-800 block text-[10px] font-sans">
                          {isArabic ? 'إضافة المنصة (ثابتة)' : 'Platform Markup'}
                        </span>
                        <strong className="text-amber-700 text-xs">
                          +{CUSTOMER_SERVICE_FEE_AED.toFixed(2)} {t.currency}
                        </strong>
                      </div>
                      <div className="bg-emerald-50 rounded-lg p-2 border border-emerald-200">
                        <span className="text-emerald-800 block text-[10px] font-sans">
                          {isArabic ? 'السعر الظاهر للزبون' : 'Displayed to Customer'}
                        </span>
                        <strong className="text-emerald-900 text-xs font-extrabold">
                          {(Math.max(0, formData.discountedPrice || 0) + CUSTOMER_SERVICE_FEE_AED).toFixed(2)} {t.currency}
                        </strong>
                      </div>
                    </div>
                    <p className="text-[10px] text-amber-900 leading-relaxed">
                      {isArabic
                        ? `تُضاف ${CUSTOMER_SERVICE_FEE_AED.toFixed(2)} درهم تلقائياً ضمن السعر النهائي المعروض للزبون دون إظهارها كرسوم منفصلة، ولا يمكن تعديلها.`
                        : `${CUSTOMER_SERVICE_FEE_AED.toFixed(2)} AED is seamlessly included in the displayed customer price with no separate fee line shown.`}
                    </p>
                  </div>
                </div>

                {/* 6. Pickup Window & Expiry Hours */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-semibold text-[#1C1917] mb-1.5">
                      {lang === 'ar' ? 'ساعات الاستلام من الفرع *' : 'Pickup Window Tonight *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={t.pickupHoursPlaceholder}
                      value={formData.pickupWindow}
                      onChange={(e) => setFormData({ ...formData, pickupWindow: e.target.value })}
                      className="w-full h-11 px-3 bg-white border border-[#EAE4DC] rounded-xl text-xs font-metric text-[#1C1917] focus:outline-none focus:border-[#DC2626]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#1C1917] mb-1.5">
                      {lang === 'ar' ? 'صلاحية العرض (ساعات قبل الإخفاء التلقائي) *' : 'Auto-Expiry (Hours) *'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="48"
                      required
                      value={formData.expiryHours}
                      onChange={(e) => setFormData({ ...formData, expiryHours: parseInt(e.target.value) || 4 })}
                      className="w-full h-11 px-3 bg-white border border-[#EAE4DC] rounded-xl text-xs font-metric text-[#1C1917] focus:outline-none focus:border-[#DC2626]"
                    />
                  </div>
                </div>

                {/* 7. Allergens & Key Ingredients */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-semibold text-[#1C1917] mb-1.5">
                      {lang === 'ar' ? 'مسببات الحساسية (اختياري)' : 'Allergens (optional)'}
                    </label>
                    <input
                      type="text"
                      placeholder="Gluten, Dairy, Nuts, Eggs"
                      value={formData.allergens}
                      onChange={(e) => setFormData({ ...formData, allergens: e.target.value })}
                      className="w-full h-11 px-3 bg-white border border-[#EAE4DC] rounded-xl text-xs text-[#1C1917] focus:outline-none focus:border-[#DC2626]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#1C1917] mb-1.5">
                      {lang === 'ar' ? 'المكونات الأساسية' : 'Key Ingredients'}
                    </label>
                    <input
                      type="text"
                      placeholder="Wheat flour, butter, milk..."
                      value={formData.ingredients}
                      onChange={(e) => setFormData({ ...formData, ingredients: e.target.value })}
                      className="w-full h-11 px-3 bg-white border border-[#EAE4DC] rounded-xl text-xs text-[#1C1917] focus:outline-none focus:border-[#DC2626]"
                    />
                  </div>
                </div>

              </div>

              {/* Sticky Form Footer with Close and Submit Actions */}
              <div className="sticky bottom-0 z-20 bg-[#FAF7F2] border-t border-[#EAE4DC] px-5 py-3.5 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setEditingListingId(null);
                    setShowBroadcastModal(false);
                  }}
                  className="px-5 py-2.5 rounded-xl border border-[#EAE4DC] bg-white hover:bg-stone-50 text-stone-700 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                >
                  <X className="w-4 h-4" />
                  <span>{isArabic ? 'إلغاء وخروج' : 'Cancel & Exit'}</span>
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-headline font-bold text-xs shadow-lg shadow-red-600/25 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  <span>
                    {editingListingId
                      ? (isArabic ? 'حفظ التعديلات وتحديث العرض فوراً ✓' : 'Save Changes & Update Offer ✓')
                      : (isArabic ? 'نشر وبث الوجبة الآن في المتجر 🚀' : t.launchBroadcast)}
                  </span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Customer Pass Verification & Scanner Modal — Fixed Scrollable Structure */}
      {showVerifyModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-900/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
          onClick={() => {
            setShowVerifyModal(false);
            setVerifiedSuccess(null);
            setVerifyError(null);
          }}
        >
          <div 
            className="relative w-full max-w-lg bg-[#FFFDF9] rounded-2xl sm:rounded-3xl shadow-2xl border border-[#EAE4DC] flex flex-col max-h-[90vh] overflow-hidden my-auto animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Sticky Header with Prominent Close Button */}
            <div className="sticky top-0 z-20 bg-[#FAF7F2] border-b border-[#EAE4DC] px-5 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-[#059669] flex items-center justify-center shadow-xs">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-headline font-extrabold text-base text-[#1C1917]">
                    {isArabic ? 'التحقق من تذكرة زبون وتسليم الوجبة' : 'Verify Customer Pass & Handover'}
                  </h3>
                  <p className="text-xs text-[#78716C]">
                    {isArabic ? 'اكتب رقم التذكرة أو اضغط على زر التسليم بجانب الطلب مباشرة' : 'Enter ticket code or tap Hand Over next to the order'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowVerifyModal(false);
                  setVerifiedSuccess(null);
                  setVerifyError(null);
                }}
                className="w-9 h-9 rounded-full bg-white border border-[#EAE4DC] flex items-center justify-center text-stone-600 hover:text-stone-950 hover:bg-stone-100 cursor-pointer shadow-xs shrink-0"
                title={isArabic ? 'إغلاق وخروج' : 'Close & Exit'}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 min-h-0 overscroll-contain">
              {/* Compact Camera Scanner View */}
              <div className="relative h-36 rounded-xl bg-stone-900 border-2 border-dashed border-emerald-500/60 overflow-hidden flex flex-col items-center justify-center text-white p-3">
                <div className="absolute inset-x-8 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-pulse" />
                <div className="w-20 h-20 border-2 border-emerald-400/70 rounded-lg relative flex items-center justify-center mb-1.5">
                  <div className="w-full h-full bg-emerald-500/10" />
                  <span className="absolute text-[10px] text-emerald-300 font-bold bg-black/60 px-2 py-0.5 rounded whitespace-nowrap">
                    {isArabic ? 'وجه الكاميرا لكود الزبون' : 'Align QR inside box'}
                  </span>
                </div>
                <p className="text-[11px] text-stone-300 text-center">
                  {isArabic ? 'أو استخدم الإدخال السريع أو زر التسليم المباشر بالأسفل ↓' : 'Or use manual code entry / direct handover below ↓'}
                </p>
              </div>

              {/* Quick Code Search Input */}
              <div className="space-y-1.5 text-xs">
                <label className="block font-bold text-[#1C1917]">
                  {isArabic ? 'أدخل رقم التذكرة أو اسم الزبون للتحقق والتسليم:' : 'Enter ticket number or customer name:'}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder={isArabic ? 'مثال: 8921 أو اسم الزبون...' : 'e.g. 8921 or customer...'}
                      value={verifyCodeInput}
                      onChange={(e) => {
                        setVerifyCodeInput(e.target.value);
                        if (verifyError) setVerifyError(null);
                      }}
                      className="w-full h-11 ps-9 pe-4 bg-white border border-[#EAE4DC] rounded-xl text-sm font-metric text-[#1C1917] focus:outline-none focus:border-[#059669]"
                    />
                    <Search className="w-4 h-4 text-stone-400 absolute start-3 top-3.5" />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleVerifyCodeDirectly()}
                    disabled={isVerifying || !verifyCodeInput.trim()}
                    className="px-4 h-11 rounded-xl bg-[#059669] hover:bg-[#047857] disabled:opacity-50 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer shrink-0"
                  >
                    {isVerifying ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <ShieldCheck className="w-4 h-4" />
                    )}
                    <span>{isArabic ? 'تحقق وتسليم ✓' : 'Verify & Hand Over'}</span>
                  </button>
                </div>
              </div>

              {verifiedSuccess && (
                <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-950 rounded-xl flex items-center gap-2 text-xs font-bold animate-in fade-in">
                  <CheckCircle className="w-4 h-4 text-[#059669] shrink-0" />
                  <span>{verifiedSuccess}</span>
                </div>
              )}

              {verifyError && (
                <div className="p-3.5 bg-red-50 border border-red-300 text-red-900 rounded-xl flex items-center gap-2 text-xs font-bold animate-in fade-in">
                  <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
                  <span>{verifyError}</span>
                </div>
              )}

              {/* Orders Matching Feed */}
              <div className="space-y-2.5 pt-1">
                <span className="text-[11px] font-extrabold text-[#1C1917] uppercase tracking-wider block">
                  {isArabic ? 'اضغط على "تسليم الوجبة ✓" بجانب طلب الزبون:' : 'Tap "Hand Over ✓" next to customer order:'}
                </span>

                <div className="space-y-2">
                  {orders
                    .filter((o) => 
                      !verifyCodeInput.trim() || 
                      o.code.toLowerCase().includes(verifyCodeInput.toLowerCase()) ||
                      (o.pickupCode && o.pickupCode.includes(verifyCodeInput)) ||
                      (o.customerName && o.customerName.toLowerCase().includes(verifyCodeInput.toLowerCase())) ||
                      o.item.title.ar.includes(verifyCodeInput) ||
                      o.item.title.en.toLowerCase().includes(verifyCodeInput.toLowerCase())
                    )
                    .map((order) => {
                      const isCollected = order.status === 'collected';
                      const title = isArabic ? order.item.title.ar : order.item.title.en;

                      return (
                        <div
                          key={order.id}
                          className="p-3.5 rounded-xl border border-[#EAE4DC] bg-[#FAF7F2] flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-metric font-extrabold text-[#059669] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 shrink-0">
                                {order.code}
                              </span>
                              <span className="font-bold text-[#1C1917] truncate">
                                {title}
                              </span>
                            </div>
                            <p className="text-[11px] text-[#78716C]">
                              {order.customerName || (isArabic ? 'زبون' : 'Customer')} • {order.quantity}x • {order.totalAed} {t.currency}
                            </p>
                          </div>

                          {isCollected ? (
                            <span className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-[11px] shrink-0">
                              ✓ {isArabic ? 'تم التسليم' : 'Handed Over'}
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleVerifyCodeDirectly(order, order.pickupCode || order.code)}
                              disabled={isVerifying}
                              className="px-3.5 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs shadow-sm active:scale-95 transition-all disabled:opacity-50 cursor-pointer shrink-0"
                            >
                              {isArabic ? 'تسليم الوجبة ✓' : 'Hand Over ✓'}
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* Sticky Bottom Dismiss Footer */}
            <div className="sticky bottom-0 z-20 bg-[#FAF7F2] border-t border-[#EAE4DC] px-5 py-3.5">
              <button
                type="button"
                onClick={() => {
                  setShowVerifyModal(false);
                  setVerifiedSuccess(null);
                  setVerifyError(null);
                }}
                className="w-full h-11 rounded-xl bg-white hover:bg-stone-100 border border-[#EAE4DC] text-[#1C1917] text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
              >
                <X className="w-4 h-4 text-[#DC2626]" />
                <span>{isArabic ? 'إغلاق وخروج من نافذة التحقق' : 'Close & Exit Verification'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
