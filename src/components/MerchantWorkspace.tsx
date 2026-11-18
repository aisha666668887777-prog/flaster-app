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
  Truck, 
  MessageSquare, 
  ChefHat, 
  Building2,
  CreditCard,
  Download,
  FileSpreadsheet,
  Banknote,
  Upload,
  Image as ImageIcon,
  Camera,
  Trash2
} from 'lucide-react';
import { MerchantListing, Category, Language, Order, OrderWorkflowStatus, DynamicRegion, DynamicCategory, MerchantAccountPublicInfo } from '../types';
import { translations } from '../translations';
import { verifyPickupOnBackend } from '../firebase/orders';
import { isSurplusItemExpired } from '../firebase/db';
import { aedToFils, filsToAed, calculateIncludedVatFils } from '../config/platformConfig';

const CULINARY_PRESETS = [
  {
    id: 'pastry',
    labelAr: 'مخبوزات وكرواسون',
    labelEn: 'Bakery & Pastries',
    url: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&auto=format&fit=crop&q=80',
    emoji: '🥐',
  },
  {
    id: 'biryani',
    labelAr: 'برياني وأرز ملكي',
    labelEn: 'Biryani & Rice Feasts',
    url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80',
    emoji: '🍚',
  },
  {
    id: 'pizza',
    labelAr: 'بيتزا ومعجنات',
    labelEn: 'Pizza & Italian',
    url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=800&auto=format&fit=crop&q=80',
    emoji: '🍕',
  },
  {
    id: 'dessert',
    labelAr: 'حلويات وكيك فاخر',
    labelEn: 'Desserts & Cakes',
    url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=800&auto=format&fit=crop&q=80',
    emoji: '🍰',
  },
  {
    id: 'sandwich',
    labelAr: 'ساندويتشات ومقبلات',
    labelEn: 'Gourmet Sandwiches',
    url: 'https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800&auto=format&fit=crop&q=80',
    emoji: '🥪',
  },
  {
    id: 'coffee',
    labelAr: 'مشروبات وقهوة',
    labelEn: 'Coffee & Drinks',
    url: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&auto=format&fit=crop&q=80',
    emoji: '☕',
  },
  {
    id: 'burger',
    labelAr: 'برجر ومشاوي',
    labelEn: 'Burgers & Grills',
    url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800&auto=format&fit=crop&q=80',
    emoji: '🍔',
  },
  {
    id: 'buffet',
    labelAr: 'بوفيه وسلطات طازجة',
    labelEn: 'Buffet & Salads',
    url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80',
    emoji: '🥗',
  },
];

interface MerchantWorkspaceProps {
  listings: MerchantListing[];
  orders: Order[];
  lang: Language;
  regions?: DynamicRegion[];
  categories?: DynamicCategory[];
  authenticatedMerchant?: MerchantAccountPublicInfo | null;
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

  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [editingListingId, setEditingListingId] = useState<string | null>(null);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyCodeInput, setVerifyCodeInput] = useState('');
  const [verifiedSuccess, setVerifiedSuccess] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState<'inventory' | 'live_orders' | 'logistics_guide' | 'settlements'>('inventory');
  const [kitchenChimeEnabled, setKitchenChimeEnabled] = useState(true);
  const [chimeTestFeedback, setChimeTestFeedback] = useState<string | null>(null);
  const [showExpiredListings, setShowExpiredListings] = useState(false);
  const [bankName, setBankName] = useState('بنك أبوظبي الأول (FAB) / Wio Bank');
  const [wioIban, setWioIban] = useState('AE070860000001234567890');
  const [isIbanEditing, setIsIbanEditing] = useState(false);
  const [statementSuccessMsg, setStatementSuccessMsg] = useState<string | null>(null);

  // Courier Dispatch Management State
  const [courierName, setCourierName] = useState('مندوب التوصيل السريع - رأس الخيمة');
  const [courierPhone, setCourierPhone] = useState('+971 50 123 4567');
  const [courierToast, setCourierToast] = useState<string | null>(null);

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
    restaurantName: 'مخبز وبوفيه النخيل الفاخر',
    neighborhood: 'Al Hamra Village',
    title: '',
    titleAr: '',
    category: 'bakery' as Category,
    imageUrl: '',
    stock: 4,
    originalPrice: 85,
    discountedPrice: 28,
    pickupWindow: '21:00 - 22:30',
    expiryHours: 4,
    allergens: 'Gluten, Dairy, Eggs',
    ingredients: 'Wheat Flour, Butter, Fresh Milk, Eggs',
  });

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
          const compressed = canvas.toDataURL('image/jpeg', 0.85);
          setFormData((prev) => ({ ...prev, imageUrl: compressed }));
        } else {
          setFormData((prev) => ({ ...prev, imageUrl: rawData }));
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
    setFormData({
      restaurantName: item.merchantNameAr || item.merchantName || authenticatedMerchant?.nameAr || 'مخبز وبوفيه النخيل الفاخر',
      neighborhood: item.neighborhood || 'Al Hamra Village',
      title: item.title,
      titleAr: item.titleAr || item.title,
      category: item.category,
      imageUrl: item.imageUrl || '',
      stock: item.stock,
      originalPrice: item.originalPrice,
      discountedPrice: item.discountedPrice,
      pickupWindow: item.pickupWindow,
      expiryHours: 4,
      allergens: item.allergens ? item.allergens.join(', ') : 'Gluten, Dairy, Eggs',
      ingredients: item.ingredients || 'Wheat Flour, Butter, Fresh Milk, Eggs',
    });
    setShowBroadcastModal(true);
  };

  const handleSubmitBroadcast = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title && !formData.titleAr) return;

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
        imageUrl: formData.imageUrl || undefined,
        stock: formData.stock,
        originalPrice: formData.originalPrice,
        discountedPrice: formData.discountedPrice,
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
        imageUrl: formData.imageUrl || undefined,
        stock: formData.stock,
        initialStock: formData.stock,
        originalPrice: formData.originalPrice,
        discountedPrice: formData.discountedPrice,
        pickupWindow: formData.pickupWindow,
        expiryTime: expiryIso,
        allergens: parsedAllergens,
        ingredients: formData.ingredients,
        ingredientsAr: formData.ingredients,
        status: 'active',
      });
    }

    setEditingListingId(null);
    setFormData({
      restaurantName: authenticatedMerchant?.nameAr || 'مخبز وبوفيه النخيل الفاخر',
      neighborhood: 'Al Hamra Village',
      title: '',
      titleAr: '',
      category: 'bakery',
      imageUrl: '',
      stock: 4,
      originalPrice: 85,
      discountedPrice: 28,
      pickupWindow: '21:00 - 22:30',
      expiryHours: 4,
      allergens: 'Gluten, Dairy, Eggs',
      ingredients: 'Wheat Flour, Butter, Fresh Milk, Eggs',
    });
    setShowBroadcastModal(false);
  };

  // Financial Calculations for Wio Business Corporate Settlements (in integer fils)
  const totalGrossSalesFils = orders.reduce((sum, o) => sum + (o.status !== 'cancelled' ? aedToFils(o.totalAed) : 0), 0);
  const totalGrossSales = filsToAed(totalGrossSalesFils);
  const electronicOrders = orders.filter(o => o.status !== 'cancelled' && o.paymentMethod !== 'pickup_cash');
  const cashOrders = orders.filter(o => o.status !== 'cancelled' && o.paymentMethod === 'pickup_cash');
  const electronicSalesFils = electronicOrders.reduce((sum, o) => sum + aedToFils(o.totalAed), 0);
  const electronicSales = filsToAed(electronicSalesFils);
  const cashSalesFils = cashOrders.reduce((sum, o) => sum + aedToFils(o.totalAed), 0);
  const cashSales = filsToAed(cashSalesFils);
  const commissionRateFraction = platformCommissionPercent / 100;
  const platformCommissionTotalFils = Math.round(totalGrossSalesFils * commissionRateFraction);
  const platformCommissionTotal = filsToAed(platformCommissionTotalFils);
  const netBankPayoutFils = Math.max(0, electronicSalesFils - platformCommissionTotalFils);
  const netBankPayout = filsToAed(netBankPayoutFils);

  const handleExportSettlementCSV = () => {
    const headers = [
      'Order Code',
      'Date',
      'Item',
      'Fulfillment',
      'Payment Method',
      'Gross Total (Fils)',
      'Gross Total (AED)',
      'Included 5% VAT (AED)',
      `Commission (${platformCommissionPercent}%) AED`,
      'Net Merchant AED'
    ];
    const rows = orders.map(o => {
      const totalFils = aedToFils(o.totalAed);
      const vatFils = calculateIncludedVatFils(totalFils);
      const commFils = Math.round(totalFils * commissionRateFraction);
      const netFils = totalFils - commFils;
      return [
        o.code,
        new Date(o.createdAt).toLocaleDateString(),
        `"${(isArabic ? o.item.title.ar : o.item.title.en).replace(/"/g, '""')}"`,
        o.fulfillmentType,
        o.paymentMethod || 'electronic',
        totalFils,
        filsToAed(totalFils).toFixed(2),
        filsToAed(vatFils).toFixed(2),
        filsToAed(commFils).toFixed(2),
        filsToAed(netFils).toFixed(2)
      ].join(',');
    });
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Flaster_Settlement_Statement_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setStatementSuccessMsg(isArabic ? '✓ تم تصدير كشف الحساب والتحويلات البنكية بنجاح!' : '✓ Settlement statement exported successfully!');
    setTimeout(() => setStatementSuccessMsg(null), 4000);
  };

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-200">
      
      {/* Top Banner / Merchant Identity */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] p-6 shadow-elevation-1 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#DC2626] to-[#991B1B] text-white flex items-center justify-center shadow-md">
            <Store className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                {lang === 'ar' ? 'متصل وموثّق' : 'Live Verified'}
              </span>
              {authenticatedMerchant && (
                <span className="px-2 py-0.5 rounded text-[10px] font-metric font-bold bg-amber-100 text-amber-900 border border-amber-300" dir="ltr">
                  @{authenticatedMerchant.username}
                </span>
              )}
              <span className="text-xs text-[#64748B]">
                {lang === 'ar' ? 'فرع رأس الخيمة' : 'Ras Al Khaimah'}
              </span>
            </div>
            <h1 className="font-headline font-extrabold text-2xl text-[#0F172A] mt-1">
              {authenticatedMerchant
                ? lang === 'ar'
                  ? authenticatedMerchant.nameAr
                  : authenticatedMerchant.name
                : t.merchantHeadline}
            </h1>
            <p className="text-xs text-[#64748B]">
              {t.merchantSubheadline}
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setShowVerifyModal(true)}
            className="flex-1 md:flex-initial h-12 px-5 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
          >
            <QrCode className="w-4 h-4 text-emerald-200" />
            <span>{isArabic ? 'التحقق من تذكرة زبون (مسح كود)' : 'Scan / Verify Customer Code'}</span>
          </button>

          <button
            onClick={() => setShowBroadcastModal(true)}
            className="flex-1 md:flex-initial h-12 px-5 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:from-amber-600 hover:via-orange-600 hover:to-rose-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{isArabic ? 'بث وجبة فائض جديدة 🍽️' : t.broadcastSurplus}</span>
          </button>

          <button
            onClick={onSwitchToMarketplace}
            className="flex-1 md:flex-initial h-12 px-4 rounded-lg bg-white border border-[#CBD5E1] hover:bg-slate-50 text-[#0F172A] font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
          >
            <RotateCcw className="w-4 h-4 text-[#64748B]" />
            <span>{t.consumerMarketplace}</span>
          </button>

          <button
            onClick={onLogout}
            className="flex-1 md:flex-initial h-12 px-4 rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
            title={lang === 'ar' ? 'قفل البوابة وتسجيل الخروج' : 'Lock & Logout'}
          >
            <Lock className="w-3.5 h-3.5 text-[#DC2626]" />
            <span>{lang === 'ar' ? 'قفل البوابة 🔒' : 'Lock Portal 🔒'}</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-metric">
        
        {/* Metric 1 */}
        <div className="bg-white rounded-lg p-5 border border-[#E2E8F0] shadow-elevation-1 space-y-1">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span>{t.colRevenue}</span>
            <DollarSign className="w-4 h-4 text-[#059669]" />
          </div>
          <div className="text-2xl font-bold text-[#0F172A]">
            {totalSalvagedRevenue} <span className="text-sm font-semibold text-[#059669]">{t.currency}</span>
          </div>
          <p className="text-[11px] text-emerald-600 font-semibold">
            ↑ +24% {lang === 'ar' ? 'مقارنة بالأسبوع الماضي' : 'vs last week'}
          </p>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-lg p-5 border border-[#E2E8F0] shadow-elevation-1 space-y-1">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span>{lang === 'ar' ? 'نسبة تصريف الفائض' : 'Salvage Rate'}</span>
            <TrendingUp className="w-4 h-4 text-[#F59E0B]" />
          </div>
          <div className="text-2xl font-bold text-[#0F172A]">
            94.2%
          </div>
          <p className="text-[11px] text-[#64748B]">
            {lang === 'ar' ? 'صفر هدر في الأغذية الصالحة' : 'Zero edible waste target'}
          </p>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-lg p-5 border border-[#E2E8F0] shadow-elevation-1 space-y-1">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span>{lang === 'ar' ? 'الباقات النشطة المعروضة' : 'Active Offerings'}</span>
            <Layers className="w-4 h-4 text-[#DC2626]" />
          </div>
          <div className="text-2xl font-bold text-[#0F172A]">
            {activeListingsCount}
          </div>
          <p className="text-[11px] text-[#64748B]">
            {totalStockLeft} {lang === 'ar' ? 'وجبة بانتظار الحجز' : 'boxes waiting'}
          </p>
        </div>

        {/* Metric 4 */}
        <div className="bg-white rounded-lg p-5 border border-[#E2E8F0] shadow-elevation-1 space-y-1">
          <div className="flex items-center justify-between text-xs text-[#64748B]">
            <span>{lang === 'ar' ? 'التزام الاستلام' : 'Pickup Compliance'}</span>
            <CheckCircle2 className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl font-bold text-[#0F172A]">
            98.5%
          </div>
          <p className="text-[11px] text-sky-600 font-semibold">
            {lang === 'ar' ? 'متوسط وقت التحقق 30 ثانية' : '30s counter scan speed'}
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
            onClick={() => setWorkspaceTab('logistics_guide')}
            className={`px-4 py-2.5 rounded-xl font-headline font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
              workspaceTab === 'logistics_guide'
                ? 'bg-[#059669] text-white shadow-md'
                : 'bg-white text-[#64748B] hover:text-[#059669] border border-slate-200'
            }`}
          >
            <Truck className="w-4 h-4" />
            <span>{isArabic ? 'إدارة التوصيل والمناديب' : 'Delivery & Courier Dispatch'}</span>
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

      {/* TAB 1: Inventory Table */}
      {workspaceTab === 'inventory' && (
        <div className="bg-[#FFFDF9] rounded-xl border border-[#EAE4DC] shadow-xs overflow-hidden animate-in fade-in">
          
          <div className="p-5 border-b border-[#EAE4DC] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-headline font-bold text-lg text-[#1C1917]">
                {t.activeListings}
              </h3>
              <p className="text-xs text-[#78716C]">
                {isArabic
                  ? 'التحكم بالكميات، أوقات الاستلام، وإخفاء العروض المنتهية تلقائياً'
                  : 'Manage live quantities, pickup windows, and expiry times'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {expiredCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowExpiredListings(!showExpiredListings)}
                  className="px-3 py-1 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-xs font-bold cursor-pointer"
                >
                  {showExpiredListings
                    ? (isArabic ? 'إخفاء المنتهية تلقائياً' : 'Auto-hide Expired')
                    : (isArabic ? `إظهار المنتهية (${expiredCount})` : `Show Expired (${expiredCount})`)}
                </button>
              )}
              <span className="text-xs text-[#78716C] font-metric">
                {visibleListings.length} {lang === 'ar' ? 'عروض نشطة' : 'active listings'}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-start border-collapse">
              <thead>
                <tr className="bg-[#FAF7F2] border-b border-[#EAE4DC] text-[11px] font-metric uppercase tracking-wider text-[#78716C]">
                  <th className="py-3 px-5 text-start font-semibold">{t.colItem}</th>
                  <th className="py-3 px-4 text-start font-semibold">{t.colCategory}</th>
                  <th className="py-3 px-4 text-start font-semibold">{t.colStock}</th>
                  <th className="py-3 px-4 text-start font-semibold">{t.colPrice}</th>
                  <th className="py-3 px-4 text-start font-semibold">{t.colPickup}</th>
                  <th className="py-3 px-4 text-start font-semibold">{isArabic ? 'انتهاء الصلاحية / الحساسية' : 'Expiry & Allergens'}</th>
                  <th className="py-3 px-4 text-start font-semibold">{t.colRevenue}</th>
                  <th className="py-3 px-5 text-end font-semibold">{t.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EAE4DC] text-xs">
                {visibleListings.map((item) => {
                  const title = isArabic ? item.titleAr : item.title;
                  const isSoldOut = item.stock === 0 || item.status === 'sold_out';
                  const isPaused = item.status === 'paused';
                  const isExpired = isSurplusItemExpired(item.expiryTime) || item.status === 'expired';

                  return (
                    <tr 
                      key={item.id} 
                      className="h-14 hover:bg-[#FAF7F2] transition-colors duration-150"
                    >
                      {/* Item Title & Status Pill */}
                      <td className="py-3 px-5">
                        <div className="flex items-center gap-3">
                          <span className={`w-2.5 h-2.5 rounded-full ${
                            isExpired ? 'bg-red-500' : isSoldOut ? 'bg-stone-300' : isPaused ? 'bg-amber-400' : 'bg-[#059669]'
                          }`} />
                          <div>
                            <p className="font-bold text-[#1C1917]">{title}</p>
                            <p className="text-[11px] text-[#78716C]">
                              {item.initialStock} {lang === 'ar' ? 'طرحت في البداية' : 'initially broadcasted'}
                              {item.ingredients ? ` • ${isArabic ? (item.ingredientsAr || item.ingredients) : item.ingredients}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-4 text-[#78716C] capitalize">
                        {item.category}
                      </td>

                      {/* Stock with inline counter controls */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onUpdateStock(item.id, -1)}
                            disabled={item.stock <= 0}
                            className="w-7 h-7 rounded border border-[#EAE4DC] bg-white hover:bg-amber-50 disabled:opacity-30 text-[#1C1917] flex items-center justify-center font-bold cursor-pointer"
                          >
                            -
                          </button>
                          <span className="font-metric font-extrabold text-sm text-[#1C1917] w-6 text-center">
                            {item.stock}
                          </span>
                          <button
                            onClick={() => onUpdateStock(item.id, 1)}
                            className="w-7 h-7 rounded border border-[#EAE4DC] bg-white hover:bg-amber-50 text-[#1C1917] flex items-center justify-center font-bold cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </td>

                      {/* Rescue Price */}
                      <td className="py-3 px-4 font-metric">
                        <span className="text-stone-400 line-through text-[11px] me-1">
                          {item.originalPrice}
                        </span>
                        <strong className="text-[#DC2626] font-bold text-sm">
                          {item.discountedPrice} {t.currency}
                        </strong>
                      </td>

                      {/* Pickup Window (Clickable to edit offer time directly) */}
                      <td className="py-3 px-4 font-metric text-[#1C1917]">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(item)}
                          title={isArabic ? 'انقر لتعديل وقت العرض أو تفاصيل الصنف' : 'Click to edit offer pickup time or details'}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#FEF3C7] hover:bg-amber-200 text-[#78350F] text-[11px] font-bold border border-[#FDE68A] transition-colors cursor-pointer"
                        >
                          <Clock className="w-3 h-3 text-[#92400E]" />
                          <span>{item.pickupWindow}</span>
                          <span className="text-[10px] underline ms-1">{isArabic ? 'تعديل' : 'Edit'}</span>
                        </button>
                      </td>

                      {/* Expiry & Allergens */}
                      <td className="py-3 px-4 text-[11px]">
                        {item.expiryTime && (
                          <div className="font-metric font-semibold text-stone-700">
                            {isArabic ? 'ينتهي: ' : 'Exp: '}
                            {new Date(item.expiryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                        {item.allergens && item.allergens.length > 0 && (
                          <div className="text-[10px] text-amber-800">
                            ⚠️ {item.allergens.join(', ')}
                          </div>
                        )}
                      </td>

                      {/* Revenue */}
                      <td className="py-3 px-4 font-metric font-bold text-[#059669]">
                        +{item.revenueAed} {t.currency}
                      </td>

                      {/* Actions: Edit Item & Time, Pause/Resume, Delete */}
                      <td className="py-3 px-5 text-end">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(item)}
                            className="px-2.5 py-1.5 rounded text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 transition-all cursor-pointer"
                          >
                            {isArabic ? 'تعديل الصنف والوقت ✏️' : 'Edit ✏️'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onToggleStatus(item.id)}
                            className={`px-2.5 py-1.5 rounded text-xs font-semibold border transition-all cursor-pointer ${
                              isPaused
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-[#FAF7F2] text-stone-700 border-[#EAE4DC] hover:bg-amber-50'
                            }`}
                          >
                            {isPaused ? t.resumeListing : t.pauseListing}
                          </button>
                          {onDeleteListing && (
                            <button
                              type="button"
                              onClick={() => onDeleteListing(item.id)}
                              title={isArabic ? 'حذف الصنف' : 'Delete Listing'}
                              className="p-1.5 rounded text-xs text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 transition-all cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

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
              const isDelivery = order.fulfillmentType === 'delivery';

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
                      {order.quantity}x {isArabic ? 'وجبة فائض' : 'surplus meal'} • <strong className="text-[#1C1917] font-metric">{order.totalAed} {t.currency}</strong>
                    </p>
                  </div>

                  {/* Fulfillment mode: Self-Pickup vs Delivery */}
                  <div className={`p-2.5 rounded-lg text-xs font-semibold flex items-center justify-between ${
                    isDelivery 
                      ? 'bg-amber-50 text-amber-900 border border-amber-200' 
                      : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                  }`}>
                    <div className="flex items-center gap-2">
                      {isDelivery ? <Truck className="w-4 h-4 text-amber-600" /> : <Store className="w-4 h-4 text-emerald-600" />}
                      <span>{isDelivery ? (isArabic ? 'توصيل مباشر من المطعم (0 د.إ رسوم منصة)' : 'Direct Restaurant Delivery') : (isArabic ? 'استلام ذاتي من الكاونتر' : 'Counter Pickup')}</span>
                    </div>
                    <span className="font-metric text-[11px] font-bold">
                      {order.pickupStart} - {order.pickupEnd}
                    </span>
                  </div>

                  {/* Payment Method Badge */}
                  <div className="flex items-center justify-between text-[11px] px-2.5 py-1.5 rounded-lg bg-[#FAF7F2] border border-[#EAE4DC]">
                    <span className="text-[#78716C] flex items-center gap-1 font-medium">
                      <CreditCard className="w-3.5 h-3.5" />
                      {isArabic ? 'طريقة الدفع:' : 'Payment:'}
                    </span>
                    <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                      order.paymentMethod === 'pickup_cash'
                        ? 'text-amber-900 bg-amber-100 border border-amber-300'
                        : 'text-emerald-900 bg-emerald-100 border border-emerald-300'
                    }`}>
                      {order.paymentMethod === 'pickup_cash'
                        ? (isArabic ? '💵 نقداً عند الاستلام بالفرع' : '💵 Cash on Pickup')
                        : (isArabic ? '💳 مدفوع إلكترونياً (Ziina / بطاقة)' : '💳 Paid Online (Ziina / Card)')
                      }
                    </span>
                  </div>

                  {/* Customer Info & Address if delivery */}
                  <div className="p-3 bg-[#FAF7F2] rounded-lg text-[11px] text-[#44403C] space-y-1 border border-[#EAE4DC]">
                    <div className="flex justify-between">
                      <span className="text-[#78716C]">{isArabic ? 'الزبون:' : 'Customer:'}</span>
                      <strong className="text-[#1C1917]">{order.customerName || 'زبون معتمد'}</strong>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#78716C]">{isArabic ? 'الهاتف:' : 'Phone:'}</span>
                      <span className="font-metric font-semibold text-[#1C1917]">{order.customerPhone || '+971 50 123 4567'}</span>
                    </div>
                    {isDelivery && order.deliveryAddress && (
                      <div className="pt-1 border-t border-[#EAE4DC] text-amber-900">
                        <span className="font-bold block">{isArabic ? 'عنوان التوصيل:' : 'Delivery Address:'}</span>
                        <p>{order.deliveryAddress}</p>
                      </div>
                    )}
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
                        onClick={() => onUpdateOrderStatus && onUpdateOrderStatus(order.id, isDelivery ? 'delivered' : 'picked_up')}
                        className={`py-1.5 px-0.5 rounded text-[10px] font-bold transition-all border cursor-pointer ${
                          currentStatus === 'picked_up' || currentStatus === 'delivered'
                            ? 'bg-[#DC2626] text-white border-red-700 shadow-xs'
                            : 'bg-white text-stone-700 border-[#EAE4DC] hover:bg-amber-50'
                        }`}
                      >
                        {isDelivery ? (isArabic ? 'تم التوصيل 🛵' : 'Delivered 🛵') : (isArabic ? 'تم الاستلام 🛍️' : 'Picked Up 🛍️')}
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

      {/* TAB 3: Operational Delivery & Courier Dispatch Management (No founder Q&A essay) */}
      {workspaceTab === 'logistics_guide' && (
        <div className="space-y-6 animate-in fade-in">
          {courierToast && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-bold flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{courierToast}</span>
              </div>
              <button onClick={() => setCourierToast(null)} className="font-bold cursor-pointer">✕</button>
            </div>
          )}

          {/* Active Courier Configuration Card */}
          <div className="bg-[#FFFDF9] rounded-2xl border border-[#EAE4DC] p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EAE4DC] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center font-bold shadow-xs">
                  <Truck className="w-6 h-6 text-[#DC2626]" />
                </div>
                <div>
                  <h3 className="font-headline font-extrabold text-base sm:text-lg text-[#1C1917]">
                    {isArabic ? 'إدارة التوصيل الذاتي للمطعم 🛵' : 'Direct Restaurant Self-Delivery 🛵'}
                  </h3>
                  <p className="text-xs text-[#78716C]">
                    {isArabic
                      ? 'كل مطعم يتولى توصيل طلباته مباشرة عبر سائقه الخاص، وإرسال العنوان للسائق بضغطة زر'
                      : 'Each restaurant handles delivery directly using its own driver and 1-click WhatsApp dispatch'}
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-bold">
                {isArabic ? 'التوصيل مسؤولية المطعم مباشرة (0 د.إ رسوم منصة)' : 'Restaurant Self-Delivery (0 AED Platform Fee)'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs items-end">
              <div>
                <label className="block font-bold text-[#1C1917] mb-1.5">
                  {isArabic ? 'اسم المندوب أو شركة التوصيل المعتمدة:' : 'Active Courier / Driver Name:'}
                </label>
                <input
                  type="text"
                  value={courierName}
                  onChange={(e) => setCourierName(e.target.value)}
                  className="w-full h-10 px-3 bg-[#FAF7F2] border border-[#EAE4DC] rounded-xl text-xs text-[#1C1917]"
                />
              </div>
              <div>
                <label className="block font-bold text-[#1C1917] mb-1.5">
                  {isArabic ? 'رقم واتساب المندوب (لإرسال المواقع):' : 'Courier WhatsApp Number:'}
                </label>
                <input
                  type="tel"
                  value={courierPhone}
                  onChange={(e) => setCourierPhone(e.target.value)}
                  className="w-full h-10 px-3 bg-[#FAF7F2] border border-[#EAE4DC] rounded-xl text-xs font-metric text-[#1C1917]"
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setCourierToast(
                      isArabic
                        ? `✓ تم حفظ بيانات المندوب (${courierName} - ${courierPhone}) بنجاح!`
                        : `✓ Saved active courier (${courierName})!`
                    );
                    setTimeout(() => setCourierToast(null), 3500);
                  }}
                  className="w-full h-10 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs cursor-pointer shadow-xs transition-all"
                >
                  {isArabic ? 'حفظ بيانات المندوب المعتمد ✓' : 'Save Courier Info ✓'}
                </button>
              </div>
            </div>
          </div>

          {/* Delivery Orders Queue */}
          <div className="bg-[#FFFDF9] rounded-2xl border border-[#EAE4DC] p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-headline font-bold text-sm sm:text-base text-[#1C1917] flex items-center gap-2">
                <Truck className="w-4 h-4 text-[#DC2626]" />
                <span>{isArabic ? 'الطلبات المطلوب توصيلها للمنازل:' : 'Orders Requiring Home Delivery:'}</span>
              </h4>
              <span className="font-metric text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-950 border border-amber-300">
                {orders.filter((o) => o.fulfillmentType === 'delivery').length} {isArabic ? 'طلب توصيل' : 'delivery orders'}
              </span>
            </div>

            {orders.filter((o) => o.fulfillmentType === 'delivery').length === 0 ? (
              <div className="p-8 text-center bg-[#FAF7F2] rounded-xl border border-[#EAE4DC] text-xs text-[#78716C] space-y-2">
                <Truck className="w-8 h-8 text-amber-500 mx-auto" />
                <p className="font-bold text-[#1C1917]">
                  {isArabic ? 'جميع الطلبات الحالية هي استلام ذاتي من الفرع' : 'All current orders are counter self-pickup'}
                </p>
                <p>
                  {isArabic
                    ? 'عندما يختار أي زبون خيار "توصيل مباشر من المطعم"، سيظهر طلبه وعنوانه هنا فوراً لتسليمه عبر سائق المطعم.'
                    : 'Whenever a customer selects Direct Restaurant Delivery, their order and address will appear here for your restaurant driver.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {orders
                  .filter((o) => o.fulfillmentType === 'delivery')
                  .map((order) => {
                    const itemTitle = isArabic ? order.item.title.ar : order.item.title.en;
                    const merchantTitle = isArabic ? order.item.merchant.nameAr : order.item.merchant.name;
                    const courierDigits = courierPhone.replace(/[^0-9]/g, '') || '971501234567';
                    const dispatchMsg = isArabic
                      ? `🛵 *طلب توصيل جديد - فلاستر Flaster*\n• رقم الطلب: ${order.code}\n• استلام من مطعم: ${merchantTitle}\n• الوجبة: ${order.quantity}x ${itemTitle}\n• اسم الزبون: ${order.customerName || 'عميل'}\n• جوال الزبون: ${order.customerPhone || ''}\n• عنوان التوصيل: ${order.deliveryAddress || 'رأس الخيمة'}\n• طريقة الدفع: ${order.paymentMethod === 'pickup_cash' ? `تحصيل نقدي (${order.totalAed} درهم)` : 'مدفوع إلكترونياً بالكامل ✓'}`
                      : `🛵 *New Delivery Dispatch - Flaster*\n• Order: ${order.code}\n• Pickup from: ${merchantTitle}\n• Item: ${order.quantity}x ${itemTitle}\n• Customer: ${order.customerName || 'Customer'} (${order.customerPhone || ''})\n• Address: ${order.deliveryAddress || 'RAK'}`;

                    return (
                      <div
                        key={order.id}
                        className="p-4 rounded-xl bg-[#FAF7F2] border border-[#EAE4DC] space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-metric font-extrabold text-sm text-[#DC2626] bg-red-50 px-2.5 py-0.5 rounded border border-red-200">
                            {order.code}
                          </span>
                          <span className="font-bold text-[#059669]">
                            {order.totalAed} AED ({order.paymentMethod === 'pickup_cash' ? (isArabic ? 'كاش' : 'Cash') : (isArabic ? 'مدفوع' : 'Paid')})
                          </span>
                        </div>

                        <div className="space-y-1">
                          <p className="font-bold text-[#1C1917]">{order.quantity}x {itemTitle}</p>
                          <p className="text-[#78716C]">{isArabic ? 'المطعم:' : 'Store:'} {merchantTitle}</p>
                          <p className="text-[#1C1917] font-semibold">
                            📍 {isArabic ? 'عنوان الزبون:' : 'Address:'} {order.deliveryAddress || (isArabic ? 'رأس الخيمة - الشريشة' : 'Ras Al Khaimah')}
                          </p>
                          <p className="text-[#78716C] font-metric">
                            📞 {order.customerName} • {order.customerPhone}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#EAE4DC]">
                          <a
                            href={`https://wa.me/${courierDigits}?text=${encodeURIComponent(dispatchMsg)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1 py-2 px-3 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs"
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                            <span>{isArabic ? 'إرسال الطلب للمندوب بالواتساب 🛵' : 'Send to Courier via WhatsApp 🛵'}</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => {
                              if (onUpdateOrderStatus) onUpdateOrderStatus(order.id, 'delivered');
                              onMarkOrderCollected(order.id);
                              setCourierToast(isArabic ? `✓ تم تأكيد توصيل الطلب ${order.code} بنجاح!` : `✓ Order ${order.code} marked delivered!`);
                              setTimeout(() => setCourierToast(null), 3500);
                            }}
                            className="py-2 px-3 rounded-lg bg-amber-400 hover:bg-amber-500 text-stone-950 font-bold text-xs cursor-pointer"
                          >
                            {isArabic ? 'تم التوصيل ✓' : 'Delivered ✓'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: Honest Bank Account Details & Financial Settlement Records */}
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

          {/* Financial Breakdown KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 font-metric">
            
            <div className="bg-[#FFFDF9] rounded-xl p-4 border border-[#EAE4DC] shadow-xs space-y-1">
              <span className="text-xs text-[#78716C] block">{isArabic ? 'إجمالي المبيعات' : 'Gross Sales'}</span>
              <div className="text-xl font-bold text-[#1C1917]">
                {totalGrossSales.toFixed(2)} <span className="text-xs font-semibold text-[#78716C]">{t.currency}</span>
              </div>
              <span className="text-[10px] text-[#78716C] block">{orders.length} {isArabic ? 'طلب معتمد' : 'orders'}</span>
            </div>

            <div className="bg-[#FFFDF9] rounded-xl p-4 border border-[#EAE4DC] shadow-xs space-y-1">
              <span className="text-xs text-[#78716C] block">{isArabic ? 'مدفوع عبر زينا (Ziina)' : 'Online Payments'}</span>
              <div className="text-xl font-bold text-[#059669]">
                {electronicSales.toFixed(2)} <span className="text-xs font-semibold text-[#059669]">{t.currency}</span>
              </div>
              <span className="text-[10px] text-[#059669] block">{electronicOrders.length} {isArabic ? 'طلب إلكتروني' : 'online orders'}</span>
            </div>

            <div className="bg-[#FFFDF9] rounded-xl p-4 border border-[#EAE4DC] shadow-xs space-y-1">
              <span className="text-xs text-[#78716C] block">{isArabic ? 'نقد مستلم بالفرع' : 'Counter Cash'}</span>
              <div className="text-xl font-bold text-amber-700">
                {cashSales.toFixed(2)} <span className="text-xs font-semibold text-amber-600">{t.currency}</span>
              </div>
              <span className="text-[10px] text-amber-700 block">{cashOrders.length} {isArabic ? 'طلب كاش' : 'cash orders'}</span>
            </div>

            <div className="bg-[#FFFDF9] rounded-xl p-4 border border-[#EAE4DC] shadow-xs space-y-1">
              <span className="text-xs text-[#78716C] block">{isArabic ? `عمولة المنصة (${platformCommissionPercent}%)` : `Platform Fee (${platformCommissionPercent}%)`}</span>
              <div className="text-xl font-bold text-[#DC2626]">
                -{platformCommissionTotal.toFixed(2)} <span className="text-xs font-semibold text-[#DC2626]">{t.currency}</span>
              </div>
              <span className="text-[10px] text-[#DC2626] block">{isArabic ? 'حصة منصة فلاستر' : 'Flaster commission'}</span>
            </div>

            <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-300 shadow-xs space-y-1">
              <span className="text-xs text-emerald-900 font-bold block">{isArabic ? 'صافي مستحقات المتجر' : 'Net Store Payout'}</span>
              <div className="text-2xl font-black text-[#059669]">
                {netBankPayout.toFixed(2)} <span className="text-xs font-semibold text-emerald-700">{t.currency}</span>
              </div>
              <span className="text-[10px] text-emerald-800 font-semibold block">{isArabic ? 'المبلغ الصافي للتحويل' : 'Net transfer amount'}</span>
            </div>

          </div>

          {/* Orders Financial Audit Table */}
          <div className="bg-[#FFFDF9] rounded-xl border border-[#EAE4DC] overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-[#EAE4DC] flex items-center justify-between">
              <h4 className="font-headline font-bold text-sm text-[#1C1917] flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#DC2626]" />
                <span>{isArabic ? 'تفاصيل تسوية طلبات الدورة الحالية' : 'Current Settlement Period Orders'}</span>
              </h4>
              <span className="font-metric text-xs text-[#78716C]">{orders.length} {isArabic ? 'سجل' : 'records'}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-[#FAF7F2] border-b border-[#EAE4DC] text-[#78716C] font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">{isArabic ? 'رقم الطلب' : 'Code'}</th>
                    <th className="px-4 py-3">{isArabic ? 'الوجبة' : 'Item'}</th>
                    <th className="px-4 py-3">{isArabic ? 'القناة' : 'Payment'}</th>
                    <th className="px-4 py-3 text-end">{isArabic ? 'المبلغ الإجمالي' : 'Gross'}</th>
                    <th className="px-4 py-3 text-end">{isArabic ? `العمولة (${platformCommissionPercent}%)` : `Fee (${platformCommissionPercent}%)`}</th>
                    <th className="px-4 py-3 text-end">{isArabic ? 'صافي التاجر' : 'Net Share'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE4DC] font-metric">
                  {orders.map((order) => {
                    const gross = order.totalAed;
                    const fee = Number((gross * (platformCommissionPercent / 100)).toFixed(2));
                    const net = Number((gross - fee).toFixed(2));
                    const isCash = order.paymentMethod === 'pickup_cash';

                    return (
                      <tr key={order.id} className="hover:bg-[#FAF7F2] transition-colors">
                        <td className="px-4 py-3 font-bold text-[#1C1917]">{order.code}</td>
                        <td className="px-4 py-3 text-[#57534E]">{isArabic ? order.item.title.ar : order.item.title.en}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            isCash ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {isCash ? (isArabic ? 'كاش بالفرع' : 'Cash') : (isArabic ? 'إلكتروني (Ziina)' : 'Online (Ziina)')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-end font-semibold text-[#1C1917]">{gross.toFixed(2)} AED</td>
                        <td className="px-4 py-3 text-end text-[#DC2626]">-{fee.toFixed(2)} AED</td>
                        <td className="px-4 py-3 text-end font-bold text-[#059669]">{net.toFixed(2)} AED</td>
                      </tr>
                    );
                  })}
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

                {/* 2. Package Names (English & Arabic) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-semibold text-[#1C1917] mb-1.5">
                      {lang === 'ar' ? 'اسم صنف الفائض (عربي) *' : 'Surplus Item Name (Arabic) *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={isArabic ? 'مثال: برياني لحم فاخر أو بوكس كرواسون' : 'e.g. Royal Mutton Biryani'}
                      value={formData.titleAr}
                      onChange={(e) => setFormData({ ...formData, titleAr: e.target.value })}
                      className="w-full h-11 px-3 bg-white border border-[#EAE4DC] rounded-xl text-xs text-[#1C1917] focus:outline-none focus:border-[#DC2626]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-[#1C1917] mb-1.5">
                      {lang === 'ar' ? 'اسم الصنف (إنجليزي) *' : 'Item Name (English) *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Royal Biryani Feast Box"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      className="w-full h-11 px-3 bg-white border border-[#EAE4DC] rounded-xl text-xs text-[#1C1917] focus:outline-none focus:border-[#DC2626]"
                    />
                  </div>
                </div>

                {/* 3. 📸 PHOTO UPLOADER & PRESETS SECTION */}
                <div className="p-4 rounded-2xl bg-[#FAF7F2] border border-[#EAE4DC] space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-[#DC2626]" />
                      <span className="font-bold text-xs text-[#1C1917]">
                        {isArabic ? 'صورة الوجبة (رفع من الهاتف / الكاميرا أو اختيار من البنك)' : 'Dish Photo (Upload or Pick from Library)'}
                      </span>
                    </div>
                    {formData.imageUrl && (
                      <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        ✓ {isArabic ? 'تم تعيين الصورة' : 'Photo Attached'}
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
                    /* Active Image Preview Card */
                    <div className="relative rounded-xl overflow-hidden border border-[#EAE4DC] bg-black/5 aspect-[16/9] max-h-48 group">
                      <img
                        src={formData.imageUrl}
                        alt="Dish Preview"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30 flex items-end justify-between p-3">
                        <span className="text-[11px] text-white font-semibold bg-black/40 backdrop-blur-xs px-2.5 py-1 rounded-lg">
                          {isArabic ? 'معاينة صورة الصنف' : 'Attached Photo Preview'}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="px-3 py-1.5 rounded-lg bg-white/90 hover:bg-white text-stone-900 font-bold text-xs shadow-sm cursor-pointer transition-all flex items-center gap-1"
                          >
                            <Upload className="w-3.5 h-3.5 text-[#DC2626]" />
                            <span>{isArabic ? 'تغيير الصورة' : 'Change'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                            className="px-2.5 py-1.5 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs shadow-sm cursor-pointer transition-all flex items-center gap-1"
                            title={isArabic ? 'حذف الصورة' : 'Remove Photo'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Dropzone Button */
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-amber-400 hover:border-[#DC2626] bg-white hover:bg-amber-50/40 rounded-xl p-5 text-center cursor-pointer transition-all space-y-1.5 group"
                    >
                      <div className="w-10 h-10 rounded-full bg-amber-100 text-[#DC2626] mx-auto flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Upload className="w-5 h-5" />
                      </div>
                      <p className="font-bold text-xs text-[#1C1917]">
                        {isArabic ? 'اضغط هنا لرفع صورة الوجبة من ألبوم الصور أو التقاطها بالكاميرا' : 'Click to upload photo from your device or camera'}
                      </p>
                      <p className="text-[11px] text-[#78716C]">
                        {isArabic ? 'يدعم الصور المباشرة (JPG, PNG, WebP) مع ضغط فوري سريع' : 'Supports JPG, PNG, WebP (compressed automatically)'}
                      </p>
                    </div>
                  )}

                  {/* 1-Tap Preset Library */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] text-[#78716C] font-semibold block">
                      {isArabic ? 'أو اختر بنقرة واحدة من بنك صور الأطباق المقترحة:' : 'Or choose from suggested dish library:'}
                    </span>
                    <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                      {CULINARY_PRESETS.map((preset) => {
                        const isSelected = formData.imageUrl === preset.url;
                        return (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => setFormData(prev => ({ ...prev, imageUrl: preset.url }))}
                            className={`relative aspect-square rounded-xl overflow-hidden border transition-all cursor-pointer group ${
                              isSelected
                                ? 'border-[#DC2626] ring-2 ring-[#DC2626] shadow-sm scale-102'
                                : 'border-[#EAE4DC] hover:border-amber-400 opacity-85 hover:opacity-100'
                            }`}
                            title={isArabic ? preset.labelAr : preset.labelEn}
                          >
                            <img
                              src={preset.url}
                              alt={preset.labelEn}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] font-bold text-center py-0.5 truncate px-1">
                              {preset.emoji}
                            </span>
                            {isSelected && (
                              <div className="absolute top-1 end-1 w-4 h-4 rounded-full bg-[#DC2626] text-white flex items-center justify-center text-[9px] shadow-xs">
                                ✓
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
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

                {/* 5. Pricing: Regular vs Surplus Rescue Price */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-semibold text-[#1C1917] mb-1.5">
                      {t.regularPriceAed} (سعر المنيو العادي) *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        required
                        value={formData.originalPrice}
                        onChange={(e) => setFormData({ ...formData, originalPrice: parseInt(e.target.value) || 0 })}
                        className="w-full h-11 px-3 pe-12 bg-white border border-[#EAE4DC] rounded-xl text-sm font-metric text-[#1C1917] focus:outline-none focus:border-[#DC2626]"
                      />
                      <span className="absolute end-3 top-3 text-xs text-[#78716C] font-metric font-semibold">AED</span>
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-[#1C1917] mb-1.5">
                      {t.rescuePriceAed} (سعر فلاستر المخفض) *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        required
                        value={formData.discountedPrice}
                        onChange={(e) => setFormData({ ...formData, discountedPrice: parseInt(e.target.value) || 0 })}
                        className="w-full h-11 px-3 pe-12 bg-white border border-[#EAE4DC] rounded-xl text-sm font-metric text-[#DC2626] font-extrabold focus:outline-none focus:border-[#DC2626]"
                      />
                      <span className="absolute end-3 top-3 text-xs text-[#DC2626] font-metric font-bold">AED</span>
                    </div>
                    {formData.originalPrice > formData.discountedPrice && (
                      <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                        ✓ {isArabic ? 'نسبة الخصم للزبون: ' : 'Discount rate: '}
                        {Math.round(((formData.originalPrice - formData.discountedPrice) / formData.originalPrice) * 100)}%
                      </p>
                    )}
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
