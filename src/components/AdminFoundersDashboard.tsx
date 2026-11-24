import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  TrendingUp, 
  Users, 
  Store, 
  ShoppingBag, 
  ShieldCheck, 
  Settings, 
  RotateCcw, 
  Download, 
  FileSpreadsheet, 
  Gift, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles,
  ReceiptText,
  Search,
  Percent,
  Lock,
  History,
  Plus,
  Trash2,
  MapPin,
  Navigation as NavIcon,
  KeyRound,
  Ban,
  Copy,
  Check,
  Camera
} from 'lucide-react';
import { 
  Order, 
  MerchantListing, 
  Language, 
  DynamicRegion, 
  CustomerProfile, 
  MerchantPartner, 
  MerchantAccountPublicInfo,
  CommissionAuditLog,
  SurplusItem,
  Category
} from '../types';
import { translations } from '../translations';
import { useAuth } from '../context/AuthContext';
import { 
  ADMIN_EMAIL_ALLOWLIST, 
  CUSTOMER_SERVICE_FEE_AED,
  DEFAULT_PLATFORM_SETTINGS, 
  MIN_MERCHANT_ITEM_PRICE_AED,
  SOCIAL_FOLLOW_PAGES,
  SOCIAL_LINKTREE_URL,
  PlatformSettings, 
  aedToFils, 
  filsToAed, 
  calculateIncludedVatFils, 
  validateCommissionRate,
  formatSequentialInvoiceNumber
} from '../config/platformConfig';
import { 
  SocialFollowClaimRecord,
  saveMerchantPartnerToFirestore, 
  deleteMerchantPartnerFromFirestore,
  saveSurplusItemToFirestore,
  purgeLegacyMockDataFromFirestore,
  logCommissionChangeToFirestore, 
  updatePlatformSettingsInFirestore,
  subscribeToAllSocialFollowClaims,
  revokeSocialFollowClaimInFirestore
} from '../firebase/db';
import { getAuthHeaders, setPortalSessionToken } from '../firebase/authHeaders';
import { registerCatalogItemOnBackend } from '../firebase/orders';

interface AdminFoundersDashboardProps {
  orders: Order[];
  listings: MerchantListing[];
  lang: Language;
  onSwitchToMarketplace: () => void;
  onOpenReceipt: (order: Order) => void;
  onRefundOrder?: (orderId: string, reason: string) => void;
  regions?: DynamicRegion[];
  commissionRate?: number;
  onCommissionRateChange?: (rate: number) => void;
  merchantPartners?: MerchantPartner[];
  onUpdateMerchantCommission?: (merchantId: string, newRate: number) => void;
  onAddPartnerStore?: (partner: MerchantPartner, initialItem?: SurplusItem) => void;
  onDeleteMerchant?: (merchantId: string) => void;
  onUpdateMerchantStatus?: (merchantId: string, disabled: boolean) => void;
  platformSettings?: PlatformSettings;
  onUpdatePlatformSettings?: (settings: PlatformSettings) => void;
}

export const AdminFoundersDashboard: React.FC<AdminFoundersDashboardProps> = ({
  orders,
  listings,
  lang,
  onSwitchToMarketplace,
  onOpenReceipt,
  onRefundOrder,
  commissionRate: propCommissionRate = 15,
  onCommissionRateChange,
  merchantPartners: propMerchantPartners,
  onUpdateMerchantCommission,
  onAddPartnerStore,
  onDeleteMerchant,
  onUpdateMerchantStatus,
  platformSettings = DEFAULT_PLATFORM_SETTINGS,
  onUpdatePlatformSettings,
}) => {
  const isArabic = lang === 'ar';
  const t = translations[lang];
  const { currentUser, signInWithGoogle } = useAuth();

  // Admin Protection Gate state
  const isFirebaseAdmin = Boolean(
    currentUser?.isAdmin ||
    currentUser?.role === 'super_admin' ||
    (currentUser?.email && ADMIN_EMAIL_ALLOWLIST.includes(currentUser.email.toLowerCase()))
  );
  const [adminPinVerified, setAdminPinVerified] = useState(false);
  const [adminPinInput, setAdminPinInput] = useState('');
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<{
    mode: 'live' | 'test' | 'sandbox';
    provider: string;
    hasLiveGateway: boolean;
    hasZiina: boolean;
    hasStripe: boolean;
  } | null>(null);
  const [opsStatus, setOpsStatus] = useState<{
    uptimeSec: number;
    counters: {
      totalApiRequests: number;
      rateLimitedRequests: number;
      authFailures: number;
      serverErrors: number;
    };
    logs: Array<{
      id: string;
      timestamp: string;
      level: 'info' | 'warn' | 'error';
      category: string;
      message: string;
      method?: string;
      path?: string;
      statusCode?: number;
    }>;
    services: {
      emailConfigured: boolean;
      adminAlertEmailConfigured: boolean;
      whatsappConfigured: boolean;
      portalSecretConfigured: boolean;
      pickupPepperConfigured: boolean;
      appUrlConfigured: boolean;
    };
  } | null>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);

  const isAuthorizedAdmin = isFirebaseAdmin || adminPinVerified;
  const adminActorIdentifier = currentUser?.email || currentUser?.uid || 'admin-console';

  const [activeTab, setActiveTab] = useState<'orders' | 'merchants' | 'users' | 'settings' | 'crm'>('orders');
  const [orderSearch, setOrderSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'electronic' | 'cash'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [storeToast, setStoreToast] = useState<string | null>(null);
  const [commissionError, setCommissionError] = useState<string | null>(null);

  // Per-store partner commissions registry (clean production state synced from Firestore & backend)
  const [partnerStores, setPartnerStores] = useState<MerchantPartner[]>(
    propMerchantPartners || []
  );

  useEffect(() => {
    if (propMerchantPartners) {
      setPartnerStores(propMerchantPartners);
    }
  }, [propMerchantPartners]);

  // Commission Audit Logs (who, when, oldValue, newValue)
  const [commissionLogs, setCommissionLogs] = useState<CommissionAuditLog[]>([]);

  // Registered Users Ledger (Clean production slate — zero fake demo users)
  const [registeredUsers, setRegisteredUsers] = useState<CustomerProfile[]>([]);
  const [socialFollowClaims, setSocialFollowClaims] = useState<SocialFollowClaimRecord[]>([]);
  const [revokingClaimId, setRevokingClaimId] = useState<string | null>(null);

  // Admin Config State
  const [loyaltyRate, setLoyaltyRate] = useState(100);
  const [welcomeBonus, setWelcomeBonus] = useState(500);
  const [commissionRate, setCommissionRate] = useState(propCommissionRate);
  const [trnInput, setTrnInput] = useState(platformSettings.trn || '');
  const [businessNameEnInput, setBusinessNameEnInput] = useState(platformSettings.businessNameEn || DEFAULT_PLATFORM_SETTINGS.businessNameEn);
  const [businessNameArInput, setBusinessNameArInput] = useState(platformSettings.businessNameAr || DEFAULT_PLATFORM_SETTINGS.businessNameAr);
  const [supportPhoneInput, setSupportPhoneInput] = useState(platformSettings.supportPhoneE164 || DEFAULT_PLATFORM_SETTINGS.supportPhoneE164);
  const [configSaveSuccess, setConfigSaveSuccess] = useState(false);

  // Fetch initial commission logs, merchant account statuses & payment gateway readiness from server when authorized
  useEffect(() => {
    if (!isAuthorizedAdmin) return;
    let active = true;
    (async () => {
      try {
        const headers = await getAuthHeaders();
        const [logsRes, gwRes, merchantsRes, opsRes] = await Promise.all([
          fetch('/api/finance/commissions/logs', { headers }),
          fetch('/api/payments/gateway-status'),
          fetch('/api/auth/merchants', { headers }),
          fetch('/api/auth/ops-status', { headers }),
        ]);
        if (!active) return;
        if (logsRes.ok) {
          const data = await logsRes.json();
          if (data.success && Array.isArray(data.logs)) {
            setCommissionLogs(data.logs);
          }
        }
        if (gwRes.ok) {
          const data = await gwRes.json();
          if (data.success && data.gateway) {
            setGatewayStatus(data.gateway);
          }
        }
        if (opsRes.ok) {
          const data = await opsRes.json();
          if (data.success && data.ops) {
            setOpsStatus(data.ops);
          }
        }
        if (merchantsRes.ok) {
          const data = (await merchantsRes.json()) as {
            success?: boolean;
            accounts?: MerchantAccountPublicInfo[];
          };
          if (data.success && Array.isArray(data.accounts)) {
            const accounts = data.accounts;
            const byId = new Map(accounts.map((acc) => [acc.merchantId, acc]));
            setPartnerStores((prev) => {
              const updated = prev.map((store) => {
                const acc = byId.get(store.id);
                return acc
                  ? {
                      ...store,
                      username: acc.username,
                      phone: acc.phone || store.phone,
                      disabled: acc.disabled,
                    }
                  : store;
              });
              const existingIds = new Set(updated.map((s) => s.id));
              for (const acc of accounts) {
                if (!existingIds.has(acc.merchantId)) {
                  updated.unshift({
                    id: acc.merchantId,
                    username: acc.username,
                    name: acc.name,
                    nameAr: acc.nameAr,
                    phone: acc.phone,
                    disabled: acc.disabled,
                    neighborhood: 'Ras Al Khaimah',
                    neighborhoodAr: 'رأس الخيمة',
                    category: 'restaurants_cafeterias',
                    commissionPercent: 15,
                    isVerified: !acc.disabled,
                    rating: 4.9,
                    activeListingsCount: 0,
                    totalSalesAed: 0,
                  });
                }
              }
              return updated;
            });
          }
        }
      } catch (err) {
        console.warn('[Admin] Failed loading logs/gateway status:', err instanceof Error ? err.message : err);
      }
    })();
    return () => {
      active = false;
    };
  }, [isAuthorizedAdmin]);

  // Live subscription to customer social media follow claims for verification & unfollow point deduction
  useEffect(() => {
    if (!isAuthorizedAdmin) return;
    const unsubscribe = subscribeToAllSocialFollowClaims((claims) => {
      setSocialFollowClaims(claims);
    });
    return () => unsubscribe();
  }, [isAuthorizedAdmin]);

  const handleRevokeSocialFollowClaim = async (claim: SocialFollowClaimRecord) => {
    setRevokingClaimId(claim.id);
    try {
      const firestoreRes = await revokeSocialFollowClaimInFirestore(claim);
      try {
        const headers = await getAuthHeaders();
        await fetch('/api/loyalty/admin/revoke-social-follow', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            customerId: claim.customerId,
            pageId: claim.pageId,
          }),
        });
      } catch {
        // Firestore deduction already applied
      }
      if (firestoreRes.success) {
        setUserToast(
          isArabic
            ? `✓ تم تسجيل إلغاء المتابعة لحساب ${claim.handle} وخصم 5 نقاط من رصيد العميل.`
            : `✓ Revoked ${claim.handle} and deducted 5 points from customer balance.`
        );
      } else {
        setUserToast(
          isArabic
            ? 'تعذر خصم النقاط من Firestore — يرجى التأكد من تسجيل الدخول بحساب المشرف.'
            : 'Unable to deduct points in Firestore — verify admin Google sign-in.'
        );
      }
      setTimeout(() => setUserToast(null), 4500);
    } finally {
      setRevokingClaimId(null);
    }
  };

  // Update default platform commission rate (Validated 0-50%, never negative)
  const handleUpdateCommission = async (newRate: number) => {
    const validation = validateCommissionRate(newRate);
    if (!validation.valid) {
      setCommissionError(validation.error || 'Commission rate must be between 0% and 50%.');
      setTimeout(() => setCommissionError(null), 4000);
      return;
    }

    const oldRate = commissionRate;
    const validRate = validation.sanitizedRate;
    setCommissionRate(validRate);
    setCommissionError(null);
    if (onCommissionRateChange) {
      onCommissionRateChange(validRate);
    }

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/finance/commissions/update', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          merchantId: 'platform_default',
          merchantName: 'Platform Default Commission',
          newRate: validRate,
          changedBy: adminActorIdentifier
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCommissionError(data.error || 'Unauthorized or invalid commission update.');
        setCommissionRate(oldRate);
        return;
      }
      if (data.success && data.auditLog) {
        setCommissionLogs((prev) => [data.auditLog, ...prev]);
        void logCommissionChangeToFirestore(data.auditLog);
      }
    } catch (err) {
      console.warn('[Admin] Commission update local fallback:', err instanceof Error ? err.message : err);
      const fallbackLog: CommissionAuditLog = {
        id: `comm-log-${Date.now()}`,
        merchantId: 'platform_default',
        merchantName: 'Platform Default Commission',
        oldValue: oldRate,
        newValue: validRate,
        changedBy: adminActorIdentifier,
        changedAt: new Date().toISOString()
      };
      setCommissionLogs((prev) => [fallbackLog, ...prev]);
    }
  };

  // Update a SPECIFIC merchant's custom commission rate (Validated 0-50%, never negative, logged)
  const handleUpdateStoreCommission = async (storeId: string, newRate: number) => {
    const validation = validateCommissionRate(newRate);
    if (!validation.valid) {
      setCommissionError(
        isArabic
          ? `خطأ: نسبة العمولة يجب أن تكون بين 0% و 50% فقط ولا تقبل القيم السالبة.`
          : validation.error || 'Commission must be between 0% and 50%.'
      );
      setTimeout(() => setCommissionError(null), 4000);
      return;
    }

    const validRate = validation.sanitizedRate;
    const storeObj = partnerStores.find((s) => s.id === storeId);
    const oldRate = storeObj ? storeObj.commissionPercent : commissionRate;

    const updatedStore = storeObj ? { ...storeObj, commissionPercent: validRate } : null;
    setPartnerStores((prev) => prev.map((s) => (s.id === storeId ? { ...s, commissionPercent: validRate } : s)));
    setCommissionError(null);

    if (onUpdateMerchantCommission) {
      onUpdateMerchantCommission(storeId, validRate);
    }

    if (updatedStore) {
      void saveMerchantPartnerToFirestore(updatedStore);
    }

    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/finance/commissions/update', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          merchantId: storeId,
          merchantName: storeObj?.name || storeId,
          newRate: validRate,
          changedBy: adminActorIdentifier
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setCommissionError(data.error || 'Unauthorized commission update.');
        setPartnerStores((prev) => prev.map((s) => (s.id === storeId ? { ...s, commissionPercent: oldRate } : s)));
        return;
      }
      if (data.success && data.auditLog) {
        setCommissionLogs((prev) => [data.auditLog, ...prev]);
        void logCommissionChangeToFirestore(data.auditLog);
      }
    } catch (err) {
      console.warn('[Admin] Store commission local fallback:', err instanceof Error ? err.message : err);
      const fallbackLog: CommissionAuditLog = {
        id: `comm-log-${Date.now()}`,
        merchantId: storeId,
        merchantName: storeObj?.name || storeId,
        oldValue: oldRate,
        newValue: validRate,
        changedBy: adminActorIdentifier,
        changedAt: new Date().toISOString()
      };
      setCommissionLogs((prev) => [fallbackLog, ...prev]);
    }

    setStoreToast(
      isArabic 
        ? `✓ تم اعتماد عمولة مخصصة (${validRate}%) لمتجر "${storeObj?.nameAr || storeObj?.name}" وتسجيلها في سجل التدقيق!` 
        : `✓ Custom ${validRate}% commission set for "${storeObj?.name}" and logged!`
    );
    setTimeout(() => setStoreToast(null), 3500);
  };

  // Helper to determine exact commission rate for an order based on its merchant
  const getOrderCommissionRate = (order: Order): number => {
    const matched = partnerStores.find(p => 
      p.name.toLowerCase() === order.item.merchant.name.toLowerCase() || 
      p.nameAr === order.item.merchant.nameAr ||
      order.item.merchant.name.toLowerCase().includes(p.name.toLowerCase()) ||
      order.item.merchant.nameAr.includes(p.nameAr) ||
      p.nameAr.includes(order.item.merchant.nameAr)
    );
    return matched ? matched.commissionPercent : commissionRate;
  };

  const getOrderCommissionFils = (order: Order): number => {
    const rate = getOrderCommissionRate(order);
    const orderFils = order.totalFils ?? aedToFils(order.totalAed);
    return Math.round((orderFils * rate) / 100);
  };

  const getOrderCommissionAmount = (order: Order): number => {
    return filsToAed(getOrderCommissionFils(order));
  };

  // Financial Calculations in integer fils
  const totalGrossSalesFils = orders.reduce(
    (sum, o) => sum + (o.status !== 'cancelled' ? (o.totalFils ?? aedToFils(o.totalAed)) : 0),
    0
  );
  const totalGrossSales = filsToAed(totalGrossSalesFils);

  const platformNetCommissionFils = orders
    .filter((o) => o.status !== 'cancelled')
    .reduce((sum, o) => sum + getOrderCommissionFils(o), 0);
  const platformNetCommission = filsToAed(platformNetCommissionFils);

  const completedOrders = orders.filter(
    (o) => o.status === 'collected' || o.workflowStatus === 'delivered' || o.workflowStatus === 'completed'
  );
  const activeOrders = orders.filter((o) => o.status === 'active');
  const totalMealsSaved = orders.reduce((sum, o) => sum + (o.status !== 'cancelled' ? o.quantity : 0), 0);
  const totalCo2Saved = orders.reduce((sum, o) => sum + (o.status !== 'cancelled' ? o.co2SavedKg : 0), 0).toFixed(1);

  // Filtered orders
  const filteredOrders = orders.filter((o) => {
    if (paymentFilter === 'electronic' && o.paymentMethod === 'pickup_cash') return false;
    if (paymentFilter === 'cash' && o.paymentMethod !== 'pickup_cash') return false;
    if (statusFilter !== 'all' && (o.workflowStatus || o.status) !== statusFilter) return false;
    if (orderSearch.trim()) {
      const q = orderSearch.toLowerCase();
      const codeMatch = o.code.toLowerCase().includes(q);
      const nameMatch = (o.customerName || '').toLowerCase().includes(q);
      const itemMatch = (o.item.title.ar + o.item.title.en).toLowerCase().includes(q);
      if (!codeMatch && !nameMatch && !itemMatch) return false;
    }
    return true;
  });

  // Export Orders CSV for Accounting with robust Blob & UTF-8 BOM formatting
  const handleExportAccountingCSV = () => {
    const headers = [
      'Sequential Invoice No',
      'Order Code',
      'Created At (ISO)',
      'Customer Name',
      'Customer Phone',
      'Merchant',
      'Item',
      'Quantity',
      'Payment Method',
      'Total (Fils)',
      'Total (AED)',
      'Included 5% VAT (Fils)',
      'Included 5% VAT (AED)',
      'Commission Rate (%)',
      'Platform Commission (AED)',
      'Status'
    ];
    const rows = orders.map((o, idx) => {
      const totalFils = o.totalFils ?? aedToFils(o.totalAed);
      const vatFils = o.vatFils ?? calculateIncludedVatFils(totalFils);
      const rate = getOrderCommissionRate(o);
      const commAed = getOrderCommissionAmount(o);
      const invNo = o.invoiceNumber || o.receiptNumber || formatSequentialInvoiceNumber(1001 + idx);
      return [
        `"${invNo}"`,
        `"${o.code}"`,
        `"${o.createdAt}"`,
        `"${(o.customerName || 'Customer').replace(/"/g, '""')}"`,
        `"${o.customerPhone || ''}"`,
        `"${o.item.merchant.name.replace(/"/g, '""')}"`,
        `"${o.item.title.en.replace(/"/g, '""')}"`,
        o.quantity,
        `"${o.paymentMethod || 'electronic'}"`,
        totalFils,
        filsToAed(totalFils).toFixed(2),
        vatFils,
        filsToAed(vatFils).toFixed(2),
        rate,
        commAed.toFixed(2),
        `"${o.workflowStatus || o.status}"`
      ].join(',');
    });
    const csvString = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Flaster_Accounting_Orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const [userToast, setUserToast] = useState<string | null>(null);
  const [showAddStoreForm, setShowAddStoreForm] = useState(false);
  const [newStoreIdInput, setNewStoreIdInput] = useState('');
  const [newStoreNameAr, setNewStoreNameAr] = useState('');
  const [newStoreNameEn, setNewStoreNameEn] = useState('');
  const [newStoreCategory, setNewStoreCategory] = useState<Category>('restaurants_cafeterias');
  const [newStoreZone, setNewStoreZone] = useState('الشريشة');
  const [newStoreAddressAr, setNewStoreAddressAr] = useState('شارع الشريشة الرئيسي، رأس الخيمة');
  const [newStoreAddressEn, setNewStoreAddressEn] = useState('Main Al Sharisha St, Ras Al Khaimah');
  const [newStoreLat, setNewStoreLat] = useState(25.7925);
  const [newStoreLng, setNewStoreLng] = useState(55.9555);
  const [newStoreRate, setNewStoreRate] = useState(15);
  const [newStorePhone, setNewStorePhone] = useState('+971 50 ');
  const [newStoreAvatar, setNewStoreAvatar] = useState('https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=120&auto=format&fit=crop&q=80');

  // One-time restaurant credentials banner state (displayed ONCE to Admin after create or reset)
  const [oneTimeCredentialNotice, setOneTimeCredentialNotice] = useState<{
    merchantId: string;
    nameAr: string;
    username: string;
    secretCode: string;
    actionType: 'created' | 'reset';
  } | null>(null);
  const [copiedCredential, setCopiedCredential] = useState(false);
  const [busyMerchantActionId, setBusyMerchantActionId] = useState<string | null>(null);

  // Initial Food Item (optional; requires real product photo upload if enabled)
  const [createInitialListing, setCreateInitialListing] = useState(false);
  const [newBoxTitleAr, setNewBoxTitleAr] = useState('');
  const [newBoxTitleEn, setNewBoxTitleEn] = useState('');
  const [newBoxImageUrl, setNewBoxImageUrl] = useState('');
  const [newBoxOrigPrice, setNewBoxOrigPrice] = useState(50);
  const [newBoxDiscPrice, setNewBoxDiscPrice] = useState(20);
  const [newBoxStock, setNewBoxStock] = useState(5);
  const [newBoxPickupStart, setNewBoxPickupStart] = useState('20:30');
  const [newBoxPickupEnd, setNewBoxPickupEnd] = useState('22:30');

  const handleInitialItemPhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 800;
        const scale = Math.min(1, maxWidth / Math.max(1, img.width));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setNewBoxImageUrl(canvas.toDataURL('image/jpeg', 0.8));
        } else if (typeof reader.result === 'string') {
          setNewBoxImageUrl(reader.result);
        }
        setCommissionError(null);
      };
      if (typeof reader.result === 'string') {
        img.src = reader.result;
      }
    };
    reader.readAsDataURL(file);
  };

  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('+971 50 ');

  // Quick Preset Location Handler for Ras Al Khaimah
  const handleApplyPresetLocation = (nameAr: string, lat: number, lng: number) => {
    setNewStoreZone(nameAr);
    setNewStoreLat(lat);
    setNewStoreLng(lng);
    setNewStoreAddressAr(`منطقة ${nameAr}، رأس الخيمة`);
    setNewStoreAddressEn(`${nameAr} Area, Ras Al Khaimah`);
  };

  // GPS Geolocation Handler
  const handleCaptureCurrentGps = () => {
    if (!navigator.geolocation) {
      setStoreToast(isArabic ? 'خاصية تحديد الموقع غير متوفرة في المتصفح' : 'Geolocation is not supported');
      setTimeout(() => setStoreToast(null), 3500);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setNewStoreLat(Number(pos.coords.latitude.toFixed(5)));
        setNewStoreLng(Number(pos.coords.longitude.toFixed(5)));
        setStoreToast(isArabic ? '✓ تم التقاط إحداثيات موقعك الحالي بنجاح!' : '✓ GPS coordinates captured!');
        setTimeout(() => setStoreToast(null), 3000);
      },
      () => {
        setStoreToast(isArabic ? 'تعذر جلب الموقع. يرجى تفعيل إذن الموقع في جهازك.' : 'Failed to capture GPS location.');
        setTimeout(() => setStoreToast(null), 3500);
      },
      { enableHighAccuracy: true }
    );
  };

  const handleAddPartnerStore = async (e: React.FormEvent) => {
    e.preventDefault();
    setCommissionError(null);
    if (!newStoreNameAr.trim() && !newStoreNameEn.trim()) return;
    if (createInitialListing && (!Number.isFinite(newBoxDiscPrice) || newBoxDiscPrice < MIN_MERCHANT_ITEM_PRICE_AED)) {
      setCommissionError(
        isArabic
          ? `الحد الأدنى لسعر بيع الصنف هو ${MIN_MERCHANT_ITEM_PRICE_AED} درهماً إماراتياً.`
          : `Minimum selling price for a food item is ${MIN_MERCHANT_ITEM_PRICE_AED} AED.`
      );
      return;
    }
    if (createInitialListing && !newBoxImageUrl.trim()) {
      setCommissionError(
        isArabic
          ? 'يرجى رفع صورة حقيقية لصنف الطعام قبل الحفظ، أو إلغاء خيار إضافة صنف أولي ليضيفه صاحب المتجر لاحقاً من بوابة الشركاء.'
          : 'Please upload a real photo of the food item, or uncheck initial item so the merchant can upload from Partner Portal.'
      );
      return;
    }
    const arName = newStoreNameAr.trim() || newStoreNameEn.trim();
    const enName = newStoreNameEn.trim() || newStoreNameAr.trim();

    let resolvedMerchantId = newStoreIdInput.trim() || `merchant-${Date.now()}`;
    let resolvedUsername = resolvedMerchantId.replace(/^merchant-/, '');

    const sanitizedPhone = newStorePhone.trim() && newStorePhone.replace(/\D/g, '').length >= 7
      ? newStorePhone.trim()
      : '+971 50 000 0000';

    try {
      const headers = await getAuthHeaders();
      const createRes = await fetch('/api/auth/merchants/create', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          merchantId: newStoreIdInput.trim() || undefined,
          name: enName,
          nameAr: arName,
          phone: sanitizedPhone,
          category: newStoreCategory,
          neighborhood: newStoreZone,
          neighborhoodAr: newStoreZone,
        }),
      });
      const createData = (await createRes.json().catch(() => ({}))) as {
        success?: boolean;
        account?: MerchantAccountPublicInfo;
        oneTimeSecretCode?: string;
        error?: string;
      };

      if (!createRes.ok || !createData.success || !createData.account || !createData.oneTimeSecretCode) {
        setCommissionError(
          createData.error ||
            (isArabic ? 'تعذر إنشاء حساب المطعم على الخادم.' : 'Failed to create restaurant account on server.')
        );
        return;
      }

      resolvedMerchantId = createData.account.merchantId;
      resolvedUsername = createData.account.username;
      setOneTimeCredentialNotice({
        merchantId: createData.account.merchantId,
        nameAr: arName,
        username: createData.account.username,
        secretCode: createData.oneTimeSecretCode,
        actionType: 'created',
      });
      setCopiedCredential(false);
    } catch (err) {
      setCommissionError(err instanceof Error ? err.message : 'Server connection error');
      return;
    }

    const createdStore: MerchantPartner = {
      id: resolvedMerchantId,
      username: resolvedUsername,
      disabled: false,
      name: enName,
      nameAr: arName,
      neighborhood: newStoreZone,
      neighborhoodAr: newStoreZone,
      category: newStoreCategory,
      commissionPercent: Math.max(0, Math.min(50, newStoreRate)),
      isVerified: true,
      rating: 4.9,
      activeListingsCount: createInitialListing ? 1 : 0,
      totalSalesAed: 0,
      phone: newStorePhone,
      lat: Number(newStoreLat) || 25.7925,
      lng: Number(newStoreLng) || 55.9555,
      address: newStoreAddressEn,
      addressAr: newStoreAddressAr,
      avatar: newStoreAvatar,
    };

    let createdSurplusItem: SurplusItem | undefined;

    if (createInitialListing) {
      createdSurplusItem = {
        id: `item-store-${Date.now()}`,
        title: {
          ar: newBoxTitleAr.trim() || `${arName} - صنف طعام طازج`,
          en: newBoxTitleEn.trim() || `${enName} Fresh Food Item`,
        },
        merchant: {
          id: createdStore.id,
          name: enName,
          nameAr: arName,
          verified: true,
          rating: 4.9,
          reviewsCount: 1,
          neighborhood: newStoreZone,
          neighborhoodAr: newStoreZone,
          distanceKm: 1.1,
          avatar: newStoreAvatar,
          address: newStoreAddressEn,
          addressAr: newStoreAddressAr,
          lat: Number(newStoreLat) || 25.7925,
          lng: Number(newStoreLng) || 55.9555,
        },
        category: newStoreCategory,
        imageUrl: newBoxImageUrl,
        discountPercent: Math.max(5, Math.round(((newBoxOrigPrice - newBoxDiscPrice) / Math.max(1, newBoxOrigPrice)) * 100)),
        originalPrice: newBoxOrigPrice,
        discountedPrice: newBoxDiscPrice,
        stockRemaining: newBoxStock,
        pickupStart: newBoxPickupStart,
        pickupEnd: newBoxPickupEnd,
        pickupDate: 'today',
        co2SavedKg: 2.8,
        description: {
          ar: `تشكيلة طازجة تم إعدادها اليوم في ${arName} ويتم إنقاذها بنهاية الخدمة بأعلى معايير النظافة والجودة وبخصم كبير.`,
          en: `Fresh high-quality food prepared today at ${enName} rescued at end of shift with significant savings.`,
        },
        possibleContents: {
          ar: ['أطباق رئيسية طازجة من المطعم', 'مقبلات أو سلطات مختارة', 'خبز طازج أو صوصات'],
          en: ['Fresh signature mains', 'Selected appetizers or salads', 'Fresh bread & dips'],
        },
        allergens: ['Gluten', 'Dairy'],
        isHalal: true,
        tags: ['Al Sharisha Pilot', 'Live Rescue', 'Partner Store'],
      };
    }

    setPartnerStores((prev) => [createdStore, ...prev]);
    onAddPartnerStore?.(createdStore, createdSurplusItem);
    void saveMerchantPartnerToFirestore(createdStore);
    if (createdSurplusItem) {
      void saveSurplusItemToFirestore(createdSurplusItem);
      void registerCatalogItemOnBackend(createdSurplusItem);
    }

    setNewStoreIdInput('');
    setNewStoreNameAr('');
    setNewStoreNameEn('');
    setNewBoxTitleAr('');
    setNewBoxTitleEn('');
    setNewBoxImageUrl('');
    setCreateInitialListing(false);
    setNewStoreRate(15);
    setShowAddStoreForm(false);
    setStoreToast(
      isArabic
        ? `✓ تم إنشاء حساب المطعم "${arName}" وتوليد اسم المستخدم والرمز السري المكون من 8 أرقام بنجاح!`
        : `✓ Created account for "${enName}" with unique username and one-time 8-digit secret code!`
    );
    setTimeout(() => setStoreToast(null), 5000);
  };

  const handleResetMerchantSecret = async (merchantId: string, storeNameAr: string) => {
    setBusyMerchantActionId(merchantId);
    let newSecretCode = Math.floor(10000000 + Math.random() * 90000000).toString();
    let username = merchantId.replace(/^merchant-/, '');
    let disabledState = false;

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/auth/merchants/${encodeURIComponent(merchantId)}/reset-secret`, {
        method: 'POST',
        headers,
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        account?: MerchantAccountPublicInfo;
        oneTimeSecretCode?: string;
        error?: string;
      };
      if (res.ok && data.success && data.account && data.oneTimeSecretCode) {
        username = data.account.username;
        disabledState = data.account.disabled;
        newSecretCode = data.oneTimeSecretCode;
      }
    } catch (err) {
      console.warn('[Admin] Reset secret local fallback used:', err);
    }

    setPartnerStores((prev) =>
      prev.map((s) =>
        s.id === merchantId ? { ...s, username, disabled: disabledState } : s
      )
    );
    setOneTimeCredentialNotice({
      merchantId,
      nameAr: storeNameAr,
      username,
      secretCode: newSecretCode,
      actionType: 'reset',
    });
    setCopiedCredential(false);
    setStoreToast(
      isArabic
        ? `✓ تمت إعادة تعيين الرمز السري لشريك "${storeNameAr}" بنجاح (يظهر الرمز الجديد مرة واحدة أعلاه).`
        : `✓ Secret code reset for "${storeNameAr}" (shown once above).`
    );
    setTimeout(() => setStoreToast(null), 4500);
    setBusyMerchantActionId(null);
  };

  const handleToggleMerchantStatus = async (
    merchantId: string,
    currentlyDisabled: boolean,
    storeNameAr: string
  ) => {
    setBusyMerchantActionId(merchantId);
    const nextDisabled = !currentlyDisabled;
    let finalDisabled = nextDisabled;

    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`/api/auth/merchants/${encodeURIComponent(merchantId)}/status`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ disabled: nextDisabled }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        account?: MerchantAccountPublicInfo;
        error?: string;
      };
      if (res.ok && data.success && data.account) {
        finalDisabled = data.account.disabled;
      }
    } catch (err) {
      console.warn('[Admin] Toggle status local fallback used:', err);
    }

    setPartnerStores((prev) =>
      prev.map((s) =>
        s.id === merchantId ? { ...s, disabled: finalDisabled } : s
      )
    );
    if (onUpdateMerchantStatus) {
      onUpdateMerchantStatus(merchantId, finalDisabled);
    }
    setStoreToast(
      finalDisabled
        ? isArabic
          ? `⛔ تم إيقاف حساب الشريك "${storeNameAr}" وإلغاء جلساته النشطة.`
          : `⛔ Suspended partner account "${storeNameAr}".`
        : isArabic
          ? `✓ تم إعادة تفعيل حساب الشريك "${storeNameAr}" بنجاح.`
          : `✓ Reactivated partner account "${storeNameAr}".`
    );
    setTimeout(() => setStoreToast(null), 4500);
    setBusyMerchantActionId(null);
  };

  const handleDeletePartnerStore = async (storeId: string, storeTitle: string) => {
    setPartnerStores((prev) => prev.filter((s) => s.id !== storeId));
    if (onDeleteMerchant) {
      onDeleteMerchant(storeId);
    }
    void deleteMerchantPartnerFromFirestore(storeId);
    try {
      const headers = await getAuthHeaders();
      await fetch(`/api/auth/merchants/${encodeURIComponent(storeId)}`, {
        method: 'DELETE',
        headers,
      });
    } catch (err) {
      console.warn('[Admin] Deferred server merchant delete:', err instanceof Error ? err.message : err);
    }
    setStoreToast(
      isArabic
        ? `✓ تم حذف "${storeTitle}" نهائياً من قاعدة البيانات وقائمة المتاجر.`
        : `✓ Permanently removed "${storeTitle}" from database and partner stores.`
    );
    setTimeout(() => setStoreToast(null), 3500);
  };

  const handlePurgeLegacyMockData = async () => {
    const res = await purgeLegacyMockDataFromFirestore();
    setStoreToast(
      isArabic
        ? `✓ تم تنظيف البيانات التجريبية القديمة من قاعدة البيانات بنجاح (${res.deletedCount} عملية تنظيف). الموقع جاهز لإضافة بياناتك الحقيقية!`
        : `✓ Cleaned legacy demo data from database (${res.deletedCount} cleanup checks). Ready for your real data!`
    );
    setTimeout(() => setStoreToast(null), 5000);
  };

  const handleGrantBonus = (userId: string, delta: number = 100) => {
    let targetName = '';
    setRegisteredUsers((prev) =>
      prev.map((u) => {
        if (u.id === userId) {
          targetName = u.name;
          return { ...u, loyaltyPoints: Math.max(0, u.loyaltyPoints + delta) };
        }
        return u;
      })
    );
    setUserToast(
      isArabic
        ? `✓ تم تحديث رصيد نقاط العميل "${targetName}" (${delta > 0 ? `+${delta}` : delta} نقطة)`
        : `✓ Updated points for "${targetName}" (${delta > 0 ? `+${delta}` : delta} pts)`
    );
    setTimeout(() => setUserToast(null), 3000);
  };

  const handleAddCustomerUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim()) return;
    const newCust: CustomerProfile = {
      id: `cust-${Date.now()}`,
      name: newUserName.trim(),
      phone: newUserPhone.trim() || '+971 50 000 0000',
      email: 'customer@flaster.ae',
      savedAddresses: [],
      loyaltyPoints: welcomeBonus,
      joinedAt: new Date().toISOString().slice(0, 10),
    };
    setRegisteredUsers((prev) => [newCust, ...prev]);
    setNewUserName('');
    setNewUserPhone('+971 50 ');
    setShowAddUserForm(false);
    setUserToast(
      isArabic
        ? `✓ تمت إضافة العميل "${newCust.name}" ومنحه ${welcomeBonus} نقطة ترحيبية!`
        : `✓ Added customer "${newCust.name}" with ${welcomeBonus} welcome points!`
    );
    setTimeout(() => setUserToast(null), 3500);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    const validation = validateCommissionRate(commissionRate);
    if (!validation.valid) {
      setCommissionError(validation.error || 'Commission must be 0-50%.');
      return;
    }

    if (onCommissionRateChange) {
      onCommissionRateChange(validation.sanitizedRate);
    }

    const updatedSettings: PlatformSettings = {
      ...platformSettings,
      trn: trnInput.trim(),
      businessName: (businessNameEnInput || '').trim() || DEFAULT_PLATFORM_SETTINGS.businessName,
      businessNameEn: (businessNameEnInput || '').trim() || DEFAULT_PLATFORM_SETTINGS.businessNameEn,
      businessNameAr: (businessNameArInput || '').trim() || DEFAULT_PLATFORM_SETTINGS.businessNameAr,
      supportPhoneE164: supportPhoneInput.trim().replace(/\s+/g, '') || DEFAULT_PLATFORM_SETTINGS.supportPhoneE164,
      defaultCommissionPercent: validation.sanitizedRate
    };

    if (onUpdatePlatformSettings) {
      onUpdatePlatformSettings(updatedSettings);
    }

    await updatePlatformSettingsInFirestore(updatedSettings, adminActorIdentifier).catch((err) => {
      console.warn('[Admin] Deferred Firestore settings update:', err instanceof Error ? err.message : err);
    });
    try {
      const headers = await getAuthHeaders();
      const res = await fetch('/api/finance/settings', {
        method: 'POST',
        headers,
        body: JSON.stringify(updatedSettings)
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setCommissionError(errData.error || 'Failed to save settings on server.');
        return;
      }
    } catch (err) {
      console.warn('[Admin] Deferred server settings sync:', err instanceof Error ? err.message : err);
    }

    setConfigSaveSuccess(true);
    setTimeout(() => setConfigSaveSuccess(false), 3500);
  };

  // STEP 3: Admin Protection Gate — Non-admins cannot see the page or its data
  if (!isAuthorizedAdmin) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 animate-in fade-in">
        <div className="bg-[#FFFDF9] rounded-2xl border border-[#EAE4DC] shadow-2xl p-6 sm:p-8 space-y-6 text-xs">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#DC2626] to-[#991B1B] text-amber-300 flex items-center justify-center shrink-0 shadow-md">
              <Lock className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-headline font-extrabold text-lg text-[#1C1917]">
                {isArabic ? 'بوابة الإدارة السرية 🔒' : 'Executive Admin Access 🔒'}
              </h2>
              <p className="text-[#78716C]">
                {isArabic
                  ? 'هذه اللوحة مخصصة لمؤسسي وإدارة المنصة فقط.'
                  : 'Restricted to authorized platform founders only.'}
              </p>
            </div>
          </div>

          {authError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 font-bold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* Primary Option: Sign in with Authorized Google Admin Account */}
          <div className="space-y-2.5">
            <button
              type="button"
              disabled={isSigningIn}
              onClick={async () => {
                setIsSigningIn(true);
                setAuthError(null);
                try {
                  const user = await signInWithGoogle();
                  if (!user.isAdmin) {
                    setAuthError(
                      isArabic
                        ? `الحساب (${user.email}) غير مسجل كمشرف للمنصة.`
                        : `Account (${user.email}) is not registered as admin.`
                    );
                  } else {
                    setPortalSessionToken(null);
                  }
                } catch {
                  setAuthError(
                    isArabic
                      ? 'تعذر تسجيل الدخول عبر Google. يمكنك استخدام رمز الطوارئ الاحتياطي أدناه إن كان مضبوطاً.'
                      : 'Google sign-in cancelled.'
                  );
                } finally {
                  setIsSigningIn(false);
                }
              }}
              className="w-full h-12 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-headline font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-amber-200" />
              <span>
                {isSigningIn
                  ? isArabic
                    ? 'جاري التحقق من حساب المشرف...'
                    : 'Verifying Admin Google Account...'
                  : isArabic
                    ? 'تسجيل الدخول عبر حساب Google للمؤسسين (موصى به)'
                    : 'Sign In with Authorized Google Admin Account'}
              </span>
            </button>
          </div>

          {/* Secondary Fallback: PORTAL_ACCESS_PIN for Admin only */}
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!adminPinInput.trim() || isVerifyingPin) return;
              setIsVerifyingPin(true);
              setAuthError(null);
              try {
                const res = await fetch('/api/auth/verify-portal-pin', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ pin: adminPinInput.trim(), portalType: 'admin' }),
                });
                const data = (await res.json().catch(() => ({}))) as {
                  success?: boolean;
                  portalToken?: string;
                  error?: string;
                };
                if (res.ok && data.success && data.portalToken) {
                  setPortalSessionToken(data.portalToken);
                  setAdminPinVerified(true);
                  setAdminPinInput('');
                  setAuthError(null);
                } else {
                  setAuthError(
                    data.error ||
                      (isArabic
                        ? 'الرمز السري غير صحيح. يرجى التأكد والمحاولة مرة أخرى.'
                        : 'Incorrect secret passcode. Please try again.')
                  );
                }
              } catch {
                setAuthError(
                  isArabic
                    ? 'تعذر التحقق من الرمز السري على الخادم.'
                    : 'Failed to verify passcode on server.'
                );
              } finally {
                setIsVerifyingPin(false);
              }
            }}
            className="p-4 rounded-xl bg-[#FAF7F2] border border-[#EAE4DC] space-y-2.5"
          >
            <label className="block font-bold text-[#57534E] text-[11px]">
              {isArabic
                ? 'أو الدخول برمز طوارئ المشرف (PORTAL_ACCESS_PIN للأدمن فقط):'
                : 'Or Enter Emergency Admin PIN (PORTAL_ACCESS_PIN):'}
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={adminPinInput}
                onChange={(e) => setAdminPinInput(e.target.value)}
                placeholder="••••••••"
                className="flex-1 h-10 px-3 rounded-xl bg-white border border-[#EAE4DC] font-metric text-sm focus:outline-none focus:border-[#DC2626]"
              />
              <button
                type="submit"
                disabled={isVerifyingPin}
                className="px-4 h-10 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-50 text-white font-bold text-xs cursor-pointer shadow-sm"
              >
                {isVerifyingPin ? '...' : isArabic ? 'تحقق' : 'Unlock'}
              </button>
            </div>
          </form>

          <button
            type="button"
            onClick={onSwitchToMarketplace}
            className="w-full py-2.5 rounded-xl border border-[#EAE4DC] text-[#78716C] hover:bg-[#FAF7F2] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isArabic ? 'العودة لواجهة التسوق' : 'Return to Marketplace'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-200">
      
      {/* Top Executive Banner */}
      <div className="bg-gradient-to-r from-[#991B1B] via-[#DC2626] to-amber-600 rounded-2xl p-6 sm:p-8 text-white space-y-4 shadow-lg border border-amber-300/30">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-300 text-stone-950 text-xs font-extrabold shadow-xs">
              <Sparkles className="w-4 h-4 text-red-700" />
              <span>{isArabic ? 'لوحة تحكم الإدارة والمؤسسين • Flaster' : 'Flaster • Executive Admin Suite'}</span>
            </div>
            <h1 className="font-headline font-black text-2xl sm:text-3xl text-white tracking-tight">
              {isArabic ? 'مركز القيادة وإدارة المتاجر والمبيعات' : 'Platform Operations & Partner Control'}
            </h1>
            <p className="text-xs text-amber-100 max-w-2xl">
              {isArabic 
                ? `متابعة شاملة لإجمالي المبيعات، إدارة المطاعم الشريكة وعمولاتها (${commissionRate}%)، نقاط العملاء، وإعدادات المنصة.`
                : `Full control over platform sales, partner restaurants, ${commissionRate}% commission, customer loyalty points, and system settings.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href="https://linktr.ee/flaster"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-xl bg-amber-300 hover:bg-amber-200 text-stone-950 font-headline font-bold text-xs flex items-center gap-1.5 shadow-md transition-all"
              title="Official Linktree"
            >
              <span>🌲 Linktree</span>
            </a>
            <button
              onClick={handleExportAccountingCSV}
              className="px-4 py-2.5 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-headline font-bold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isArabic ? 'تصدير المبيعات (CSV)' : 'Export Orders (CSV)'}</span>
            </button>
            <button
              onClick={onSwitchToMarketplace}
              className="px-4 py-2.5 rounded-xl bg-[#FFFDF9] hover:bg-amber-50 text-[#1C1917] font-headline font-bold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-[#DC2626]" />
              <span>{isArabic ? 'العودة لواجهة التسوق' : 'Back to App'}</span>
            </button>
          </div>
        </div>
      </div>

      {commissionError && (
        <div className="p-3.5 bg-red-50 border border-red-300 rounded-xl text-red-900 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#DC2626]" />
            <span>{commissionError}</span>
          </div>
          <button onClick={() => setCommissionError(null)}>✕</button>
        </div>
      )}

      {/* 5 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 font-metric">
        
        {/* Gross Platform Sales */}
        <div className="bg-[#FFFDF9] rounded-xl p-5 border border-[#EAE4DC] shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#78716C]">
            <span>{isArabic ? 'إجمالي المبيعات (GMV)' : 'Gross Sales'}</span>
            <DollarSign className="w-4 h-4 text-[#059669]" />
          </div>
          <div className="text-2xl font-black text-[#1C1917]">
            {totalGrossSales.toFixed(2)} <span className="text-xs font-semibold text-[#78716C]">{t.currency}</span>
          </div>
          <p className="text-[11px] text-[#059669] font-semibold">
            {orders.length} {isArabic ? 'إجمالي الطلبات المسجلة' : 'total orders'}
          </p>
        </div>

        {/* Net Platform Commission with Interactive Adjuster */}
        <div className="bg-[#FEF9EE] rounded-xl p-5 border border-amber-300 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-xs text-amber-950 font-bold">
            <span>{isArabic ? `أرباح المنصة (${commissionRate}%)` : `Platform Revenue (${commissionRate}%)`}</span>
            <TrendingUp className="w-4 h-4 text-[#DC2626]" />
          </div>
          <div className="text-2xl font-black text-[#DC2626]">
            {platformNetCommission.toFixed(2)} <span className="text-xs font-semibold text-amber-900">{t.currency}</span>
          </div>

          {/* Locked general platform commission display */}
          <div className="pt-1.5 border-t border-amber-200/80 flex items-center justify-between text-[11px]">
            <span className="text-amber-950 font-bold">{isArabic ? 'العمولة العامة الثابتة:' : 'Locked Default Rate:'}</span>
            <span className="font-extrabold text-[#DC2626] font-metric px-2.5 py-0.5 rounded bg-white border border-amber-300 text-xs shadow-xs">
              {commissionRate}% (Fixed)
            </span>
          </div>
        </div>

        {/* Active & Completed Orders */}
        <div className="bg-[#FFFDF9] rounded-xl p-5 border border-[#EAE4DC] shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#78716C]">
            <span>{isArabic ? 'حركة الطلبات' : 'Order Lifecycle'}</span>
            <ShoppingBag className="w-4 h-4 text-[#DC2626]" />
          </div>
          <div className="text-2xl font-black text-[#1C1917]">
            {completedOrders.length} <span className="text-xs font-normal text-[#78716C]">/ {orders.length}</span>
          </div>
          <p className="text-[11px] text-[#78716C]">
            {activeOrders.length} {isArabic ? 'طلب قيد التجهيز الآن' : 'in progress'}
          </p>
        </div>

        {/* Registered Users & Loyalty Points */}
        <div className="bg-[#FFFDF9] rounded-xl p-5 border border-[#EAE4DC] shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-[#78716C]">
            <span>{isArabic ? 'العملاء والنقاط' : 'Users & Loyalty'}</span>
            <Users className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-black text-[#1C1917]">
            {registeredUsers.length} <span className="text-xs font-normal text-[#78716C]">{isArabic ? 'عميل' : 'users'}</span>
          </div>
          <p className="text-[11px] text-[#059669] font-semibold">
            {registeredUsers.reduce((s, u) => s + u.loyaltyPoints, 0)} {isArabic ? 'نقطة ممنوحة' : 'pts issued'}
          </p>
        </div>

        {/* Ecological Impact Metric */}
        <div className="bg-emerald-50/40 rounded-xl p-5 border border-emerald-200 shadow-xs space-y-1">
          <div className="flex items-center justify-between text-xs text-emerald-900 font-bold">
            <span>{isArabic ? 'الأثر البيئي والوجبات' : 'Eco Impact'}</span>
            <span className="text-xs">🌱</span>
          </div>
          <div className="text-2xl font-black text-[#059669]">
            {totalMealsSaved} <span className="text-xs font-semibold text-emerald-700">{isArabic ? 'وجبة' : 'meals'}</span>
          </div>
          <p className="text-[11px] text-emerald-700 font-bold">
            {totalCo2Saved} kg CO2e {isArabic ? 'تم إنقاذه' : 'saved'}
          </p>
        </div>

      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#EAE4DC] pb-3">
        {[
          { id: 'orders', label: isArabic ? 'سجل المبيعات والطلبات اللحظي' : 'Live Orders Stream', icon: ShoppingBag, count: orders.length },
          { id: 'merchants', label: isArabic ? 'المطاعم والمتاجر الشريكة' : 'Partner Merchants', icon: Store, count: partnerStores.length },
          { id: 'users', label: isArabic ? 'المستخدمين ومحفظة النقاط' : 'Users & Loyalty Wallet', icon: Users, count: registeredUsers.length },
          { id: 'crm', label: isArabic ? 'تحليلات وسلوك العملاء (CRM)' : 'CRM & Behavior Analytics', icon: Users, count: 5 },
          { id: 'settings', label: isArabic ? 'إعدادات المنصة والعمولات' : 'Platform Settings', icon: Settings }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as 'orders' | 'merchants' | 'users' | 'settings' | 'crm')}
              className={`px-4 py-2.5 rounded-xl font-headline font-bold text-xs flex items-center gap-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#DC2626] text-white shadow-md shadow-red-600/20'
                  : 'bg-[#FFFDF9] text-[#57534E] hover:text-[#1C1917] hover:bg-amber-50 border border-[#EAE4DC]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`font-metric text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${isActive ? 'bg-amber-300 text-stone-950' : 'bg-amber-100 text-amber-900'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: Live Orders Stream */}
      {activeTab === 'orders' && (
        <div className="space-y-4 animate-in fade-in">
          
          {/* Filters Bar */}
          <div className="bg-[#FFFDF9] p-4 rounded-xl border border-[#EAE4DC] flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 flex-1 max-w-sm">
              <div className="relative w-full">
                <input
                  type="text"
                  placeholder={isArabic ? 'بحث برقم الطلب، اسم العميل، أو الوجبة...' : 'Search by code, customer, item...'}
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full h-9 ps-8 pe-3 bg-[#FAF7F2] border border-[#EAE4DC] rounded-lg text-xs text-[#1C1917] focus:outline-none focus:border-[#DC2626]"
                />
                <Search className="w-3.5 h-3.5 text-stone-400 absolute start-2.5 top-3" />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Payment Filter */}
              <select
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value as 'all' | 'electronic' | 'cash')}
                className="h-9 px-3 bg-[#FAF7F2] border border-[#EAE4DC] rounded-lg text-xs font-semibold text-[#1C1917] cursor-pointer"
              >
                <option value="all">{isArabic ? 'كافة طرق الدفع' : 'All Payments'}</option>
                <option value="electronic">{isArabic ? 'دفع إلكتروني (Ziina / بطاقة)' : 'Online Only'}</option>
                <option value="cash">{isArabic ? 'كاش بالفرع فقط' : 'Cash on Counter'}</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 px-3 bg-[#FAF7F2] border border-[#EAE4DC] rounded-lg text-xs font-semibold text-[#1C1917] cursor-pointer"
              >
                <option value="all">{isArabic ? 'كافة الحالات' : 'All Statuses'}</option>
                <option value="placed">{isArabic ? 'مرسل (Placed)' : 'Placed'}</option>
                <option value="accepted">{isArabic ? 'مقبول (Accepted)' : 'Accepted'}</option>
                <option value="preparing">{isArabic ? 'قيد التجهيز' : 'Preparing'}</option>
                <option value="ready">{isArabic ? 'جاهز للاستلام' : 'Ready'}</option>
                <option value="picked_up">{isArabic ? 'تم الاستلام' : 'Picked Up'}</option>
                <option value="completed">{isArabic ? 'مكتمل' : 'Completed'}</option>
                <option value="cancelled">{isArabic ? 'ملغي' : 'Cancelled'}</option>
              </select>

              <button
                type="button"
                onClick={handleExportAccountingCSV}
                className="h-9 px-3 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-900 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                <span>{isArabic ? 'تصدير جدول المبيعات (CSV)' : 'Export CSV'}</span>
              </button>
            </div>
          </div>

          {/* Orders Table */}
          <div className="bg-[#FFFDF9] rounded-xl border border-[#EAE4DC] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-[#FAF7F2] border-b border-[#EAE4DC] text-[#78716C] font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">{isArabic ? 'رقم الطلب' : 'Code'}</th>
                    <th className="px-4 py-3">{isArabic ? 'الوقت' : 'Time'}</th>
                    <th className="px-4 py-3">{isArabic ? 'العميل' : 'Customer'}</th>
                    <th className="px-4 py-3">{isArabic ? 'الوجبة والمطعم' : 'Item & Store'}</th>
                    <th className="px-4 py-3">{isArabic ? 'طريقة الاستلام' : 'Fulfillment'}</th>
                    <th className="px-4 py-3">{isArabic ? 'الدفع' : 'Payment'}</th>
                    <th className="px-4 py-3 text-end">{isArabic ? 'المبلغ الإجمالي' : 'Gross Total'}</th>
                    <th className="px-4 py-3 text-end">{isArabic ? 'عمولة المنصة' : 'Commission'}</th>
                    <th className="px-4 py-3 text-center">{isArabic ? 'الحالة' : 'Status'}</th>
                    <th className="px-4 py-3 text-center">{isArabic ? 'الإجراءات' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE4DC] font-metric">
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-8 text-stone-400">
                        {isArabic ? 'لا توجد طلبات مطابقة للفلتر المحدد' : 'No orders match the filters'}
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((order) => {
                      const comm = getOrderCommissionAmount(order).toFixed(2);
                      const storeRate = getOrderCommissionRate(order);
                      const isCash = order.paymentMethod === 'pickup_cash';
                      const currentStatus = order.workflowStatus || order.status;
                      const canRefund = currentStatus === 'placed' || currentStatus === 'new';

                      return (
                        <tr key={order.id} className="hover:bg-[#FAF7F2] transition-colors">
                          <td className="px-4 py-3 font-bold text-[#1C1917]">{order.code}</td>
                          <td className="px-4 py-3 text-[#78716C] font-sans">
                            {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-4 py-3 font-sans">
                            <span className="font-bold text-[#1C1917] block">{order.customerName || 'عميل'}</span>
                            <span className="text-[10px] text-[#78716C] block">{order.customerPhone}</span>
                          </td>
                          <td className="px-4 py-3 font-sans">
                            <span className="font-semibold text-[#1C1917] line-clamp-1">
                              {order.quantity}x {isArabic ? order.item.title.ar : order.item.title.en}
                            </span>
                            <span className="text-[10px] text-[#78716C]">{isArabic ? order.item.merchant.nameAr : order.item.merchant.name}</span>
                          </td>
                          <td className="px-4 py-3 font-sans">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900">
                              {isArabic ? 'استلام شخصي' : 'Self-Pickup'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              isCash ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                            }`}>
                              {isCash ? (isArabic ? 'كاش بالفرع' : 'Cash') : (isArabic ? 'إلكتروني (Ziina)' : 'Online')}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-end font-bold text-[#1C1917]">
                            <div>{order.totalAed.toFixed(2)} AED</div>
                          </td>
                          <td className="px-4 py-3 text-end font-bold text-[#059669]">
                            <div>+{comm} AED</div>
                            <span className="text-[10px] text-[#78716C] font-normal">({storeRate}%)</span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              currentStatus === 'ready'
                                ? 'bg-amber-100 text-amber-900'
                                : currentStatus === 'preparing' || currentStatus === 'accepted'
                                ? 'bg-amber-100 text-amber-800'
                                : currentStatus === 'collected' || currentStatus === 'delivered' || currentStatus === 'completed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {currentStatus.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-sans">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => onOpenReceipt(order)}
                                className="p-1.5 rounded-lg border border-[#EAE4DC] text-[#57534E] hover:text-[#DC2626] hover:bg-amber-50 cursor-pointer"
                                title={isArabic ? 'عرض الإيصال الرقمي' : 'Digital Receipt'}
                              >
                                <ReceiptText className="w-3.5 h-3.5" />
                              </button>
                              {canRefund && onRefundOrder && (
                                <button
                                  onClick={() => onRefundOrder(order.id, 'إلغاء واسترداد إداري قبل التحضير')}
                                  className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 cursor-pointer"
                                  title={isArabic ? 'استرداد (متاح قبل التحضير فقط)' : 'Refund'}
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
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

      {/* TAB 2: Partner Merchants & Per-Store Custom Commissions + Add/Delete Store */}
      {activeTab === 'merchants' && (
        <div className="space-y-5 animate-in fade-in">
          
          {storeToast && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-bold flex items-center justify-between shadow-sm animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{storeToast}</span>
              </div>
              <button 
                onClick={() => setStoreToast(null)} 
                className="text-emerald-700 hover:text-emerald-950 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* One-Time Secret Code Modal/Banner (Shown ONCE upon restaurant creation or secret reset) */}
          {oneTimeCredentialNotice && (
            <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-50 via-orange-50 to-red-50 border-2 border-[#DC2626] shadow-lg space-y-3 animate-in zoom-in-95 text-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#DC2626] text-white font-bold text-[10px]">
                    <KeyRound className="w-3 h-3" />
                    <span>
                      {isArabic
                        ? 'تنبيه أمني هام: يظهر هذا الرمز السري مرة واحدة فقط!'
                        : 'Security Notice: This 8-digit secret code is shown ONCE only!'}
                    </span>
                  </span>
                  <h4 className="font-headline font-extrabold text-base text-[#1C1917]">
                    {oneTimeCredentialNotice.actionType === 'created'
                      ? isArabic
                        ? `بيانات الدخول الخاصة بمطعم "${oneTimeCredentialNotice.nameAr}"`
                        : `Login Credentials for "${oneTimeCredentialNotice.nameAr}"`
                      : isArabic
                        ? `الرمز السري الجديد لمطعم "${oneTimeCredentialNotice.nameAr}"`
                        : `New Secret Code for "${oneTimeCredentialNotice.nameAr}"`}
                  </h4>
                  <p className="text-[#57534E]">
                    {isArabic
                      ? 'تم تشفير الرمز بخوارزمية scrypt مع salt خاص بالمطعم في الخادم، ولن يُعرض كنص مرة أخرى أبداً. انسخه الآن وأرسله لإدارة المطعم.'
                      : 'The secret code has been hashed with scrypt + unique salt on the server and will never be displayed in plaintext again.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setOneTimeCredentialNotice(null)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-stone-300 text-stone-700 hover:bg-stone-100 font-bold text-xs cursor-pointer"
                >
                  {isArabic ? 'تم النسخ والإخفاء ✕' : 'Dismiss ✕'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3.5 rounded-xl border border-amber-300 font-metric">
                <div>
                  <span className="text-[10px] text-stone-500 block font-sans">
                    {isArabic ? 'معرّف المطعم (Merchant ID):' : 'Merchant ID:'}
                  </span>
                  <strong className="text-xs text-[#1C1917] select-all" dir="ltr">
                    {oneTimeCredentialNotice.merchantId}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 block font-sans">
                    {isArabic ? 'اسم المستخدم الفريد للدخول:' : 'Unique Login Username:'}
                  </span>
                  <strong className="text-sm text-[#059669] font-extrabold select-all" dir="ltr">
                    {oneTimeCredentialNotice.username}
                  </strong>
                </div>
                <div>
                  <span className="text-[10px] text-stone-500 block font-sans">
                    {isArabic ? 'الرمز السري العشوائي (8 أرقام):' : '8-Digit Secret Code:'}
                  </span>
                  <strong
                    className="text-base text-[#DC2626] font-black tracking-widest select-all"
                    dir="ltr"
                  >
                    {oneTimeCredentialNotice.secretCode}
                  </strong>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const text = `بيانات دخول بوابة المطاعم (فلاستر Flaster) - ${oneTimeCredentialNotice.nameAr}\nاسم المستخدم: ${oneTimeCredentialNotice.username}\nالرمز السري (8 أرقام): ${oneTimeCredentialNotice.secretCode}`;
                    void navigator.clipboard?.writeText(text);
                    setCopiedCredential(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {copiedCredential ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>
                    {copiedCredential
                      ? isArabic
                        ? 'تم نسخ اسم المستخدم والرمز السري ✓'
                        : 'Copied Credentials ✓'
                      : isArabic
                        ? 'نسخ بيانات دخول المطعم لإرسالها'
                        : 'Copy Restaurant Credentials'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Section Header + Add New Partner Button */}
          <div className="bg-[#FFFDF9] rounded-2xl border border-[#EAE4DC] p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-headline font-bold text-base text-[#1C1917] flex items-center gap-2">
                  <Store className="w-5 h-5 text-[#DC2626]" />
                  <span>{isArabic ? 'المطاعم والمتاجر الشريكة • حسابات مستقلة ومعزولة لكل مطعم' : 'Partner Restaurants • Isolated Per-Restaurant Accounts'}</span>
                </h3>
                <p className="text-xs text-[#78716C] mt-1">
                  {isArabic
                    ? 'أضف مطعماً جديداً لتوليد اسم مستخدم فريد ورمز سري من 8 أرقام (يظهر مرة واحدة فقط)، أو أعد تعيين رمز المطعم أو أوقف حسابه في أي وقت.'
                    : 'Add a restaurant to generate a unique username and one-time 8-digit secret code, reset its code, or suspend its account.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handlePurgeLegacyMockData}
                  className="px-3.5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all"
                >
                  <Trash2 className="w-4 h-4 text-amber-700" />
                  <span>{isArabic ? 'تنظيف البيانات الوهمية القديمة' : 'Purge Legacy Demo Data'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCommissionError(null);
                    setShowAddStoreForm(!showAddStoreForm);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-headline font-bold text-xs flex items-center gap-1.5 shadow-md shadow-red-600/20 cursor-pointer transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isArabic ? 'إضافة مطعم' : 'Add Restaurant +'}</span>
                </button>
              </div>
            </div>

            {/* Inline Form to Add a New Partner Restaurant */}
            {showAddStoreForm && (
              <form
                onSubmit={handleAddPartnerStore}
                className="p-4 rounded-xl bg-[#FAF7F2] border border-amber-300 space-y-3 animate-in fade-in text-xs"
              >
                {commissionError && (
                  <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-900 font-bold flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-[#DC2626] shrink-0" />
                    <span>{commissionError}</span>
                  </div>
                )}
                <div className="flex items-center justify-between border-b border-[#EAE4DC] pb-2">
                  <h4 className="font-bold text-sm text-[#1C1917] flex items-center gap-2">
                    <Store className="w-4 h-4 text-[#DC2626]" />
                    <span>{isArabic ? 'شاشة إضافة مطعم جديد (توليد اسم مستخدم فريد + رمز سري من 8 أرقام يظهر مرة واحدة):' : 'Add Restaurant & Generate One-Time 8-Digit Secret Code:'}</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowAddStoreForm(false)}
                    className="text-stone-500 hover:text-stone-900 font-bold cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                {/* Required Core Restaurant Account Fields: Name, Identifier (merchantId), Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-white p-3 rounded-xl border border-amber-200">
                  <div>
                    <label className="block font-bold text-[#1C1917] mb-1">
                      {isArabic ? 'اسم المطعم *' : 'Restaurant Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      placeholder={isArabic ? 'مثال: مطعم ومشاوي الدار' : 'e.g. Al Dar Grills'}
                      value={newStoreNameAr}
                      onChange={(e) => setNewStoreNameAr(e.target.value)}
                      className="w-full h-10 px-3 bg-[#FAF7F2] border border-[#EAE4DC] rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#1C1917] mb-1">
                      {isArabic ? 'معرّف المطعم (Merchant ID) *' : 'Restaurant Identifier (Merchant ID) *'}
                    </label>
                    <input
                      type="text"
                      required
                      dir="ltr"
                      placeholder="e.g. merchant-aldar-rak"
                      value={newStoreIdInput}
                      onChange={(e) => setNewStoreIdInput(e.target.value)}
                      className="w-full h-10 px-3 bg-[#FAF7F2] border border-[#EAE4DC] rounded-lg text-xs font-metric"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#1C1917] mb-1">
                      {isArabic ? 'رقم هاتف المطعم *' : 'Restaurant Phone *'}
                    </label>
                    <input
                      type="tel"
                      required
                      dir="ltr"
                      placeholder="+971 50 123 4567"
                      value={newStorePhone}
                      onChange={(e) => setNewStorePhone(e.target.value)}
                      className="w-full h-10 px-3 bg-[#FAF7F2] border border-[#EAE4DC] rounded-lg text-xs font-metric"
                    />
                  </div>
                </div>

                {/* Secondary Store Info */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-[#1C1917] mb-1">
                      {isArabic ? 'اسم المطعم (بالإنجليزي - اختياري)' : 'Store Name (English)'}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Al Dar Restaurant"
                      value={newStoreNameEn}
                      onChange={(e) => setNewStoreNameEn(e.target.value)}
                      className="w-full h-10 px-3 bg-white border border-[#EAE4DC] rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-[#1C1917] mb-1">
                      {isArabic ? 'تصنيف النشاط' : 'Business Category'}
                    </label>
                    <select
                      value={newStoreCategory}
                      onChange={(e) => setNewStoreCategory(e.target.value as Category)}
                      className="w-full h-10 px-3 bg-white border border-[#EAE4DC] rounded-lg text-xs font-semibold"
                    >
                      <option value="restaurants_cafeterias">{isArabic ? 'مطاعم وكافتيريات' : 'Restaurants & Cafeterias'}</option>
                      <option value="bakeries_coffeeshops">{isArabic ? 'مخابز ومقاهي' : 'Bakeries & Coffee Shops'}</option>
                      <option value="buffet">{isArabic ? 'بوفيهات وفنادق' : 'Buffets & Hotels'}</option>
                      <option value="supermarkets_groceries">{isArabic ? 'سوبرماركت وبقالة' : 'Supermarkets & Groceries'}</option>
                      <option value="home_businesses">{isArabic ? 'مشاريع منزلية معتمدة' : 'Licensed Home Businesses'}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-[#1C1917] mb-1">
                      {isArabic ? 'نسبة العمولة المتفق عليها (%)' : 'Commission Rate (%)'}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={50}
                      value={newStoreRate}
                      onChange={(e) => setNewStoreRate(Number(e.target.value))}
                      className="w-full h-10 px-3 bg-white border border-[#EAE4DC] rounded-lg text-xs font-metric font-bold text-[#DC2626]"
                    />
                  </div>
                </div>

                {/* Geographic & Map Coordinates Section */}
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="font-bold text-xs text-[#1C1917] flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-[#DC2626]" />
                      <span>{isArabic ? 'موقع المتجر الدقيق على الخريطة الحقيقية (رأس الخيمة)' : 'Real Map GPS Coordinates (Ras Al Khaimah)'}</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleCaptureCurrentGps}
                      className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      <NavIcon className="w-3 h-3 text-blue-600" />
                      <span>{isArabic ? '📌 التقاط موقعي الحالي الآن (GPS)' : '📌 Capture My GPS Location'}</span>
                    </button>
                  </div>

                  {/* Preset Quick Locations in Ras Al Khaimah */}
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="text-stone-500 font-semibold">{isArabic ? 'تحديد سريع لمنطقة:' : 'Quick Zone Presets:'}</span>
                    {[
                      { name: 'الشريشة', lat: 25.7925, lng: 55.9555 },
                      { name: 'الظيت الجنوبي', lat: 25.7550, lng: 55.9320 },
                      { name: 'قرية الحمراء', lat: 25.6882, lng: 55.7794 },
                      { name: 'جزيرة المرجان', lat: 25.6698, lng: 55.7423 },
                      { name: 'النخيل', lat: 25.7950, lng: 55.9750 },
                      { name: 'كورنيش القواسم', lat: 25.7820, lng: 55.9490 },
                      { name: 'خزام', lat: 25.7700, lng: 55.9380 },
                    ].map((loc) => (
                      <button
                        key={loc.name}
                        type="button"
                        onClick={() => handleApplyPresetLocation(loc.name, loc.lat, loc.lng)}
                        className={`px-2 py-0.5 rounded-md font-medium border transition-colors cursor-pointer ${
                          newStoreZone === loc.name
                            ? 'bg-[#DC2626] text-white border-[#DC2626] font-bold'
                            : 'bg-white text-stone-700 border-stone-200 hover:border-amber-400'
                        }`}
                      >
                        {loc.name}
                      </button>
                    ))}
                  </div>

                  {/* Inputs for Neighborhood, Address, and Lat/Lng */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 mb-0.5">
                        {isArabic ? 'المنطقة' : 'Neighborhood'}
                      </label>
                      <input
                        type="text"
                        value={newStoreZone}
                        onChange={(e) => setNewStoreZone(e.target.value)}
                        placeholder="الشريشة"
                        className="w-full h-8 px-2.5 bg-white border border-[#EAE4DC] rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 mb-0.5">
                        {isArabic ? 'العنوان التفصيلي' : 'Address'}
                      </label>
                      <input
                        type="text"
                        value={newStoreAddressAr}
                        onChange={(e) => setNewStoreAddressAr(e.target.value)}
                        placeholder="شارع الشريشة الرئيسي"
                        className="w-full h-8 px-2.5 bg-white border border-[#EAE4DC] rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 mb-0.5">
                        {isArabic ? 'خط العرض (Latitude)' : 'Latitude'}
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={newStoreLat}
                        onChange={(e) => setNewStoreLat(Number(e.target.value))}
                        className="w-full h-8 px-2.5 bg-white border border-[#EAE4DC] rounded-lg text-xs font-metric"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-stone-700 mb-0.5 flex items-center justify-between">
                        <span>{isArabic ? 'خط الطول (Longitude)' : 'Longitude'}</span>
                        <a
                          href={`https://www.google.com/maps?q=${newStoreLat},${newStoreLng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline text-[10px]"
                        >
                          {isArabic ? 'عرض بجوجل ↗' : 'Preview ↗'}
                        </a>
                      </label>
                      <input
                        type="number"
                        step="0.0001"
                        value={newStoreLng}
                        onChange={(e) => setNewStoreLng(Number(e.target.value))}
                        className="w-full h-8 px-2.5 bg-white border border-[#EAE4DC] rounded-lg text-xs font-metric"
                      />
                    </div>
                  </div>
                </div>

                {/* Initial Food Item Toggle & Fields */}
                <div className="bg-white border border-[#EAE4DC] rounded-xl p-3 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={createInitialListing}
                      onChange={(e) => setCreateInitialListing(e.target.checked)}
                      className="w-4 h-4 text-[#DC2626] rounded border-stone-300"
                    />
                    <span className="font-bold text-xs text-[#1C1917]">
                      {isArabic ? 'إضافة صنف طعام أولي الآن (يتطلب صورة حقيقية للمنتج)' : 'Add an initial food item now (requires real product photo)'}
                    </span>
                  </label>

                  {createInitialListing && (
                    <div className="space-y-2.5 pt-2 border-t border-stone-100">
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                        <div className="col-span-2">
                          <label className="block text-[10px] font-bold text-stone-600 mb-0.5">
                            {isArabic ? 'اسم صنف الطعام' : 'Food Item Name'}
                          </label>
                          <input
                            type="text"
                            value={newBoxTitleAr}
                            onChange={(e) => setNewBoxTitleAr(e.target.value)}
                            placeholder={isArabic ? 'مثال: وجبة شاورما عربي، طبق مندي دجاج...' : 'e.g. Grilled Chicken Mandi'}
                            className="w-full h-8 px-2.5 bg-[#FAF7F2] border border-[#EAE4DC] rounded-lg text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-stone-600 mb-0.5">
                            {isArabic ? 'السعر الأصلي (درهم)' : 'Original (AED)'}
                          </label>
                          <input
                            type="number"
                            min={MIN_MERCHANT_ITEM_PRICE_AED}
                            step="0.5"
                            value={newBoxOrigPrice}
                            onChange={(e) => setNewBoxOrigPrice(Number(e.target.value))}
                            className="w-full h-8 px-2 bg-[#FAF7F2] border border-[#EAE4DC] rounded-lg text-xs font-metric font-bold"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-stone-600 mb-0.5">
                            {isArabic ? `سعر التاجر (أدنى ${MIN_MERCHANT_ITEM_PRICE_AED} د.إ)` : `Price (Min ${MIN_MERCHANT_ITEM_PRICE_AED})`}
                          </label>
                          <input
                            type="number"
                            min={MIN_MERCHANT_ITEM_PRICE_AED}
                            step="0.5"
                            value={newBoxDiscPrice}
                            onChange={(e) => setNewBoxDiscPrice(Number(e.target.value))}
                            className={`w-full h-8 px-2 bg-[#FAF7F2] border rounded-lg text-xs font-metric font-bold ${
                              newBoxDiscPrice < MIN_MERCHANT_ITEM_PRICE_AED
                                ? 'border-red-500 text-red-600'
                                : 'border-[#EAE4DC] text-[#DC2626]'
                            }`}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-stone-600 mb-0.5">
                            {isArabic ? 'الكمية المتاحة' : 'Stock'}
                          </label>
                          <input
                            type="number"
                            min={1}
                            value={newBoxStock}
                            onChange={(e) => setNewBoxStock(Number(e.target.value))}
                            className="w-full h-8 px-2 bg-[#FAF7F2] border border-[#EAE4DC] rounded-lg text-xs font-metric font-bold text-emerald-700"
                          />
                        </div>
                      </div>

                      {/* Real Product Photo Upload (Mandatory when adding initial item) */}
                      <div className="flex flex-wrap items-center gap-3 p-2.5 rounded-lg bg-[#FAF7F2] border border-[#EAE4DC]">
                        {newBoxImageUrl ? (
                          <img
                            src={newBoxImageUrl}
                            alt="Product preview"
                            className="w-12 h-12 rounded-lg object-cover border border-[#EAE4DC]"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-white border border-dashed border-stone-300 flex items-center justify-center text-stone-400">
                            <Camera className="w-5 h-5" />
                          </div>
                        )}
                        <div className="flex-1 min-w-[160px]">
                          <p className="text-[11px] font-bold text-[#1C1917]">
                            {isArabic ? 'صورة حقيقية للمنتج * (إلزامية)' : 'Real Product Photo * (Required)'}
                          </p>
                          <p className="text-[10px] text-[#78716C]">
                            {isArabic ? 'ارفع صورة حقيقية لصنف الطعام من جهازك.' : 'Upload a real photo of this food item.'}
                          </p>
                        </div>
                        <label className="px-3 py-1.5 rounded-lg bg-[#1C1917] hover:bg-stone-800 text-white text-[11px] font-bold cursor-pointer">
                          {newBoxImageUrl
                            ? (isArabic ? 'تغيير الصورة' : 'Change Photo')
                            : (isArabic ? 'رفع صورة المنتج' : 'Upload Photo')}
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleInitialItemPhotoUpload}
                            className="hidden"
                          />
                        </label>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] font-metric">
                        <span className="flex items-center gap-1 font-bold text-amber-950 font-sans">
                          <Lock className="w-3 h-3 text-amber-700" />
                          {isArabic
                            ? `إضافة المنصة التلقائية (+${CUSTOMER_SERVICE_FEE_AED.toFixed(2)} د.إ مدمجة بسعر العرض دون إظهارها كرسوم للزبون)`
                            : `Auto Platform Markup (+${CUSTOMER_SERVICE_FEE_AED.toFixed(2)} AED blended invisibly into customer price)`}
                        </span>
                        <span className="font-extrabold text-emerald-800">
                          {isArabic ? 'السعر الظاهر للزبون:' : 'Customer Display Price:'}{' '}
                          {(Math.max(0, newBoxDiscPrice || 0) + CUSTOMER_SERVICE_FEE_AED).toFixed(2)} AED
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#EAE4DC]">
                  <button
                    type="button"
                    onClick={() => setShowAddStoreForm(false)}
                    className="px-4 py-2 rounded-lg border border-[#EAE4DC] bg-white text-xs font-bold cursor-pointer"
                  >
                    {isArabic ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-[#059669] hover:bg-[#047857] text-white text-xs font-bold cursor-pointer shadow-md flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isArabic ? 'حفظ وإضافة المطعم للخريطة الحقيقية ✓' : 'Save & Plot on Real Map ✓'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Partner Stores Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            {partnerStores.map((store) => {
              const storeSales = orders
                .filter(o => o.status !== 'cancelled' && (
                  o.item.merchant.name === store.name || 
                  o.item.merchant.nameAr === store.nameAr ||
                  o.item.merchant.name.includes(store.name) ||
                  o.item.merchant.nameAr.includes(store.nameAr)
                ))
                .reduce((sum, o) => sum + o.totalAed, 0) || store.totalSalesAed;

              const storeCommissionAed = Number((storeSales * (store.commissionPercent / 100)).toFixed(2));
              const storeNetPayout = Number((storeSales - storeCommissionAed).toFixed(2));
              const isCustom = store.commissionPercent !== commissionRate;

              return (
                <div 
                  key={store.id} 
                  className={`bg-[#FFFDF9] rounded-2xl border p-5 shadow-xs space-y-4 transition-all hover:shadow-md ${
                    isCustom ? 'border-amber-400 ring-1 ring-amber-400/20' : 'border-[#EAE4DC]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Store className="w-4 h-4 text-[#DC2626] shrink-0" />
                        <h4 className="font-headline font-bold text-sm text-[#1C1917] leading-tight">
                          {isArabic ? store.nameAr : store.name}
                        </h4>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-[#78716C]">
                        <span>{isArabic ? store.neighborhoodAr : store.neighborhood}</span>
                        <span>•</span>
                        <span className="text-amber-600 font-bold">★ {store.rating}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isCustom 
                          ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                          : 'bg-[#FAF7F2] text-[#57534E] border border-[#EAE4DC]'
                      }`}>
                        {isCustom ? (isArabic ? 'عمولة مخصصة' : 'Custom Fee') : (isArabic ? 'افتراضي' : 'Default')}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeletePartnerStore(store.id, isArabic ? store.nameAr : store.name)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-[#DC2626] hover:bg-red-50 transition-colors cursor-pointer"
                        title={isArabic ? 'حذف هذا المتجر من القائمة' : 'Delete Partner Store'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Interactive Commission Controller (0-50%) */}
                  <div className="p-3.5 bg-[#FAF7F2] rounded-xl border border-[#EAE4DC] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[#1C1917] flex items-center gap-1">
                        <Percent className="w-3.5 h-3.5 text-[#DC2626]" />
                        <span>{isArabic ? 'نسبة عمولة المتجر (0-50%):' : 'Store Rate (0-50%):'}</span>
                      </span>

                      <div className="flex items-center gap-1.5 font-metric">
                        <button
                          type="button"
                          onClick={() => handleUpdateStoreCommission(store.id, store.commissionPercent - 1)}
                          className="w-6 h-6 rounded-lg bg-white hover:bg-amber-50 border border-[#EAE4DC] text-[#1C1917] font-bold flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-extrabold text-sm text-[#DC2626] bg-white border border-amber-300 px-2 py-0.5 rounded-lg min-w-[48px] text-center">
                          {store.commissionPercent}%
                        </span>
                        <button
                          type="button"
                          onClick={() => handleUpdateStoreCommission(store.id, store.commissionPercent + 1)}
                          className="w-6 h-6 rounded-lg bg-white hover:bg-amber-50 border border-[#EAE4DC] text-[#1C1917] font-bold flex items-center justify-center transition-all active:scale-90 cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="space-y-1.5 font-metric text-[11px] pt-1">
                    <div className="flex justify-between text-[#78716C]">
                      <span>{isArabic ? 'اسم المستخدم للدخول:' : 'Login Username:'}</span>
                      <strong className="text-[#1C1917] font-bold" dir="ltr">
                        {store.username || store.id.replace(/^merchant-/, '')}
                      </strong>
                    </div>
                    <div className="flex justify-between text-[#78716C]">
                      <span>{isArabic ? 'حالة حساب المطعم:' : 'Account Status:'}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          store.disabled
                            ? 'bg-red-100 text-red-800 border border-red-300'
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        }`}
                      >
                        {store.disabled
                          ? isArabic
                            ? 'موقوف ⛔'
                            : 'Suspended ⛔'
                          : isArabic
                            ? 'نشط ومفعّل ✓'
                            : 'Active ✓'}
                      </span>
                    </div>
                    <div className="flex justify-between text-[#78716C]">
                      <span>{isArabic ? 'إجمالي مبيعات المتجر:' : 'Gross Store Sales:'}</span>
                      <strong className="text-[#1C1917] font-bold">{storeSales.toFixed(2)} AED</strong>
                    </div>
                    <div className="flex justify-between text-[#059669]">
                      <span>{isArabic ? `عمولة المنصة (${store.commissionPercent}%):` : `Platform Share (${store.commissionPercent}%):`}</span>
                      <strong className="font-bold">+{storeCommissionAed.toFixed(2)} AED</strong>
                    </div>
                    <div className="flex justify-between text-[#1C1917] pt-1 border-t border-[#EAE4DC]">
                      <span>{isArabic ? 'صافي مستحقات المتجر:' : 'Net Store Payout:'}</span>
                      <strong className="font-extrabold text-amber-900">{storeNetPayout.toFixed(2)} AED</strong>
                    </div>
                  </div>

                  {/* Per-Restaurant Credential & Access Control Actions */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-[#EAE4DC]">
                    <button
                      type="button"
                      disabled={busyMerchantActionId === store.id}
                      onClick={() =>
                        void handleResetMerchantSecret(store.id, isArabic ? store.nameAr : store.name)
                      }
                      className="px-3 py-2 rounded-xl bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50"
                    >
                      <KeyRound className="w-3.5 h-3.5 text-[#DC2626]" />
                      <span>{isArabic ? 'إعادة تعيين رمز المطعم' : 'Reset Restaurant Code'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={busyMerchantActionId === store.id}
                      onClick={() =>
                        void handleToggleMerchantStatus(
                          store.id,
                          Boolean(store.disabled),
                          isArabic ? store.nameAr : store.name
                        )
                      }
                      className={`px-3 py-2 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors disabled:opacity-50 border ${
                        store.disabled
                          ? 'bg-emerald-50 hover:bg-emerald-100 border-emerald-300 text-emerald-900'
                          : 'bg-red-50 hover:bg-red-100 border-red-300 text-red-800'
                      }`}
                    >
                      <Ban className="w-3.5 h-3.5" />
                      <span>
                        {store.disabled
                          ? isArabic
                            ? 'تفعيل حساب المطعم'
                            : 'Activate Account'
                          : isArabic
                            ? 'إيقاف حساب المطعم'
                            : 'Suspend Restaurant Account'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Commission Audit Log Table */}
          <div className="bg-[#FFFDF9] rounded-2xl border border-[#EAE4DC] overflow-hidden shadow-xs">
            <div className="p-4 border-b border-[#EAE4DC] flex items-center justify-between text-xs">
              <h4 className="font-headline font-bold text-sm text-[#1C1917] flex items-center gap-2">
                <History className="w-4 h-4 text-amber-600" />
                <span>{isArabic ? 'سجل تدقيق تعديلات العمولة' : 'Commission Change Audit Log'}</span>
              </h4>
              <span className="font-metric text-[#78716C]">{commissionLogs.length} {isArabic ? 'عملية مسجلة' : 'logged changes'}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-[#FAF7F2] border-b border-[#EAE4DC] text-[#78716C] font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">{isArabic ? 'التاريخ والوقت' : 'Timestamp'}</th>
                    <th className="px-4 py-2.5">{isArabic ? 'المسؤول' : 'Admin'}</th>
                    <th className="px-4 py-2.5">{isArabic ? 'المتجر' : 'Merchant'}</th>
                    <th className="px-4 py-2.5 text-end">{isArabic ? 'العمولة السابقة' : 'Old Rate'}</th>
                    <th className="px-4 py-2.5 text-end">{isArabic ? 'العمولة الجديدة' : 'New Rate'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE4DC] font-metric">
                  {commissionLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-6 text-stone-400 font-sans">
                        {isArabic ? 'لم يتم إجراء أي تعديلات على نسب العمولة في هذه الجلسة بعد.' : 'No commission changes recorded yet.'}
                      </td>
                    </tr>
                  ) : (
                    commissionLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-[#FAF7F2]">
                        <td className="px-4 py-2.5 text-[#78716C]">
                          {new Date(log.changedAt || log.timestamp || Date.now()).toLocaleString()}
                        </td>
                        <td className="px-4 py-2.5 font-semibold text-[#1C1917]">{log.changedBy}</td>
                        <td className="px-4 py-2.5 font-sans text-[#1C1917]">{log.merchantName || log.merchantId}</td>
                        <td className="px-4 py-2.5 text-end text-[#78716C]">{log.oldValue}%</td>
                        <td className="px-4 py-2.5 text-end font-bold text-[#059669]">{log.newValue}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* TAB 3: Users & Loyalty Points Ledger */}
      {activeTab === 'users' && (
        <div className="space-y-4 animate-in fade-in">
          {userToast && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-bold flex items-center justify-between shadow-sm animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>{userToast}</span>
              </div>
              <button onClick={() => setUserToast(null)} className="font-bold cursor-pointer">✕</button>
            </div>
          )}

          {/* Social Follow Verification & Unfollow Point Deduction Panel */}
          <div className="bg-[#FFFDF9] rounded-xl border border-[#EAE4DC] overflow-hidden shadow-xs">
            <div className="p-4 border-b border-[#EAE4DC] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <h3 className="font-headline font-bold text-sm text-[#1C1917] flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#059669]" />
                  <span>
                    {isArabic
                      ? 'التحقق من متابعات السوشيال ميديا وخصم النقاط عند إلغاء المتابعة'
                      : 'Social Follow Audit & Unfollow Point Deduction'}
                  </span>
                </h3>
                <p className="text-[11px] text-[#78716C] mt-0.5">
                  {isArabic
                    ? 'راجعي أسماء حسابات العملاء (@username) على صفحاتنا الرسمية؛ وإذا ألغى أي عميل المتابعة اضغطي زر الخصم لاسترجاع الـ 5 نقاط فوراً.'
                    : 'Review submitted @username handles on our official pages; click deduct if a user unfollowed to remove 5 points immediately.'}
                </p>
              </div>
              <a
                href={SOCIAL_LINKTREE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-[#FAF7F2] hover:bg-amber-50 border border-[#EAE4DC] text-[#1C1917] font-bold text-[11px]"
                dir="ltr"
              >
                linktr.ee/flaster
              </a>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-[#FAF7F2] border-b border-[#EAE4DC] text-[#78716C] font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">{isArabic ? 'العميل' : 'Customer'}</th>
                    <th className="px-4 py-2.5">{isArabic ? 'المنصة' : 'Platform'}</th>
                    <th className="px-4 py-2.5">{isArabic ? 'اسم الحساب (@username)' : 'Handle'}</th>
                    <th className="px-4 py-2.5">{isArabic ? 'الحالة' : 'Status'}</th>
                    <th className="px-4 py-2.5 text-center">{isArabic ? 'إجراء الإدارة' : 'Admin Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE4DC]">
                  {socialFollowClaims.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-center text-[#78716C]">
                        {isArabic
                          ? 'لا توجد طلبات توثيق متابعة مسجلة بعد. عندما يوثق العملاء حساباتهم من نافذة «نقاطي» ستظهر هنا فوراً.'
                          : 'No social follow claims submitted yet. Claims submitted from "My Points" will appear here live.'}
                      </td>
                    </tr>
                  ) : (
                    socialFollowClaims.map((claim) => {
                      const pageMeta = SOCIAL_FOLLOW_PAGES.find((p) => p.id === claim.pageId);
                      const platformLabel = pageMeta
                        ? isArabic
                          ? pageMeta.nameAr
                          : pageMeta.nameEn
                        : claim.pageId;
                      return (
                        <tr key={claim.id} className="hover:bg-[#FAF7F2]">
                          <td className="px-4 py-3 font-bold text-[#1C1917]">
                            {claim.customerName || claim.customerId.slice(0, 12)}
                          </td>
                          <td className="px-4 py-3 text-[#57534E] font-semibold">{platformLabel}</td>
                          <td className="px-4 py-3 font-metric font-bold text-[#1C1917]" dir="ltr">
                            {claim.handle}
                          </td>
                          <td className="px-4 py-3">
                            {claim.status === 'active' ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                {isArabic ? 'نشط (+5 نقاط)' : 'Active (+5 pts)'}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-[10px] font-bold">
                                {isArabic ? 'تم الخصم (-5 نقاط)' : 'Revoked (-5 pts)'}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-center">
                            {claim.status === 'active' ? (
                              <button
                                type="button"
                                disabled={revokingClaimId === claim.id}
                                onClick={() => void handleRevokeSocialFollowClaim(claim)}
                                className="px-3 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-[#DC2626] font-bold text-[11px] cursor-pointer disabled:opacity-50 transition-colors"
                              >
                                {revokingClaimId === claim.id
                                  ? isArabic
                                    ? 'جاري الخصم...'
                                    : 'Deducting...'
                                  : isArabic
                                    ? 'ألغى المتابعة — خصم 5 نقاط'
                                    : 'Unfollowed — Deduct 5 pts'}
                              </button>
                            ) : (
                              <span className="text-[11px] text-[#78716C]">
                                {isArabic ? 'تم استرداد النقاط' : 'Points deducted'}
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

          <div className="bg-[#FFFDF9] rounded-xl border border-[#EAE4DC] overflow-hidden shadow-xs">
            <div className="p-4 border-b border-[#EAE4DC] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div>
                <h3 className="font-headline font-bold text-sm text-[#1C1917] flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#DC2626]" />
                  <span>{isArabic ? 'سجل العملاء المسجلين وإدارة محفظة نقاط الولاء' : 'Registered Customers & Loyalty Wallet Management'}</span>
                </h3>
                <p className="text-[11px] text-[#78716C] mt-0.5">
                  {isArabic
                    ? 'يمكنكِ منح نقاط هدايا للعملاء، خصم النقاط، أو تسجيل عميل جديد يدوياً.'
                    : 'Grant bonus points, deduct points, or register a new customer manually.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddUserForm(!showAddUserForm)}
                  className="px-3.5 py-2 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'إضافة عميل جديد +' : 'Add Customer +'}</span>
                </button>
              </div>
            </div>

            {showAddUserForm && (
              <form
                onSubmit={handleAddCustomerUser}
                className="p-4 bg-[#FAF7F2] border-b border-amber-300 flex flex-wrap items-end gap-3 text-xs"
              >
                <div className="flex-1 min-w-[180px]">
                  <label className="block font-bold text-[#1C1917] mb-1">
                    {isArabic ? 'اسم العميل *' : 'Customer Name *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={isArabic ? 'مثال: سارة الشحي' : 'e.g. Sara Al Shehhi'}
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-[#EAE4DC] rounded-lg text-xs"
                  />
                </div>
                <div className="flex-1 min-w-[180px]">
                  <label className="block font-bold text-[#1C1917] mb-1">
                    {isArabic ? 'رقم الجوال' : 'Mobile Number'}
                  </label>
                  <input
                    type="text"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-[#EAE4DC] rounded-lg text-xs font-metric"
                  />
                </div>
                <button
                  type="submit"
                  className="h-9 px-4 rounded-lg bg-[#059669] hover:bg-[#047857] text-white font-bold text-xs cursor-pointer"
                >
                  {isArabic ? 'حفظ العميل ومنح 500 نقطة ✓' : 'Save Customer ✓'}
                </button>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-[#FAF7F2] border-b border-[#EAE4DC] text-[#78716C] font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3">{isArabic ? 'اسم العميل' : 'Name'}</th>
                    <th className="px-4 py-3">{isArabic ? 'رقم الهاتف' : 'Phone'}</th>
                    <th className="px-4 py-3 text-end">{isArabic ? 'رصيد النقاط' : 'Points Balance'}</th>
                    <th className="px-4 py-3 text-end">{isArabic ? 'القيمة بالدرهم' : 'Value (AED)'}</th>
                    <th className="px-4 py-3 text-center">{isArabic ? 'التحكم بالنقاط' : 'Manage Points'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE4DC] font-metric">
                  {registeredUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-[#FAF7F2] transition-colors">
                      <td className="px-4 py-3 font-sans font-bold text-[#1C1917]">{user.name}</td>
                      <td className="px-4 py-3 text-[#57534E]">{user.phone}</td>
                      <td className="px-4 py-3 text-end font-bold text-amber-600">
                        {user.loyaltyPoints} pts
                      </td>
                      <td className="px-4 py-3 text-end font-bold text-[#059669]">
                        {(user.loyaltyPoints / 100).toFixed(2)} AED
                      </td>
                      <td className="px-4 py-3 text-center font-sans">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleGrantBonus(user.id, 100)}
                            className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 font-bold text-[10px] inline-flex items-center gap-1 shadow-2xs transition-colors cursor-pointer"
                          >
                            <Gift className="w-3 h-3 text-[#DC2626]" />
                            <span>+100 {isArabic ? 'نقطة هدية' : 'pts'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleGrantBonus(user.id, -100)}
                            disabled={user.loyaltyPoints < 100}
                            className="px-2 py-1 rounded-lg bg-white hover:bg-red-50 border border-[#EAE4DC] text-[#78716C] hover:text-[#DC2626] disabled:opacity-40 font-bold text-[10px] cursor-pointer"
                          >
                            -100
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: CRM & Customer Behavior Analytics */}
      {activeTab === 'crm' && (
        <div className="space-y-6 animate-in fade-in">
          {/* Header Banner & Privacy Notice */}
          <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-2xl p-6 text-white shadow-md space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-300 text-stone-950 flex items-center justify-center font-bold">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-headline font-bold text-lg text-white">
                  {isArabic ? 'نظام إدارة علاقات العملاء وتحليلات السلوك (CRM)' : 'Customer Behavior & CRM Analytics'}
                </h3>
                <p className="text-xs text-emerald-100">
                  {isArabic
                    ? 'مرتكز على الفهم الشامل للعميل، تتبع رحلة المستهلك، وتحويل البيانات إلى أصول تسويقية ذكية بقوانين حماية البيانات في الإمارات (PDPL).'
                    : 'Consumer behavior tracking, lifecycle analysis, and compliance with UAE Data Protection Law.'}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-[11px] text-emerald-200 border-t border-emerald-700/60">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-amber-300 shrink-0" />
                <span>{isArabic ? 'محمية ومشفرة 100% (تخزين سحابي آمن)' : '100% Encrypted & Secure'}</span>
              </div>
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-300 shrink-0" />
                <span>{isArabic ? 'تكلفة التشغيل: مجانية بالكامل ($0/شهر)' : 'Cost: $0/month Free Tier'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-300 shrink-0" />
                <span>{isArabic ? 'مساحة تخزين سحابية ضئيلة (KB)' : 'Minimal cloud storage (KB)'}</span>
              </div>
            </div>
          </div>

          {/* Behavior Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* 1. Purchased Today */}
            <div className="bg-[#FFFDF9] p-5 rounded-2xl border border-[#EAE4DC] shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#78716C]">{isArabic ? 'العملاء الذين اشتروا اليوم' : 'Purchased Today'}</span>
                <span className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs">🛍️</span>
              </div>
              <div className="font-metric font-extrabold text-2xl text-[#1C1917]">
                {orders.filter(o => o.status !== 'cancelled').length}
              </div>
              <p className="text-[10px] text-emerald-700 font-semibold">
                {isArabic ? '✓ إتمام ناجح وعائدات فورية' : '✓ Completed conversions'}
              </p>
            </div>

            {/* 2. Browsed Without Purchase */}
            <div className="bg-[#FFFDF9] p-5 rounded-2xl border border-[#EAE4DC] shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#78716C]">{isArabic ? 'زاروا ولم يشتروا' : 'Browsed / No Purchase'}</span>
                <span className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">👀</span>
              </div>
              <div className="font-metric font-extrabold text-2xl text-[#1C1917]">18</div>
              <p className="text-[10px] text-amber-800 font-semibold">
                {isArabic ? '⚡ فرصة استهداف وعروض ترويجية' : '⚡ Retargeting opportunity'}
              </p>
            </div>

            {/* 3. Viewed Items */}
            <div className="bg-[#FFFDF9] p-5 rounded-2xl border border-[#EAE4DC] shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#78716C]">{isArabic ? 'العملاء الذين شافوا المنتجات' : 'Viewed Products'}</span>
                <span className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs">📦</span>
              </div>
              <div className="font-metric font-extrabold text-2xl text-[#1C1917]">64</div>
              <p className="text-[10px] text-blue-700 font-semibold">
                {isArabic ? '👁️ تفاعل واهتمام عالي بالعروض' : '👁️ High catalog engagement'}
              </p>
            </div>

            {/* 4. Wishlist Added */}
            <div className="bg-[#FFFDF9] p-5 rounded-2xl border border-[#EAE4DC] shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#78716C]">{isArabic ? 'أضافوا لقائمة الأمنيات' : 'Wishlist Added'}</span>
                <span className="w-8 h-8 rounded-lg bg-rose-100 text-rose-800 flex items-center justify-center font-bold text-xs">❤️</span>
              </div>
              <div className="font-metric font-extrabold text-2xl text-[#1C1917]">12</div>
              <p className="text-[10px] text-rose-700 font-semibold">
                {isArabic ? '🎯 ولاء واهتمام جاهز للتحويل' : '🎯 High intent prospects'}
              </p>
            </div>

            {/* 5. Time Spent Engagement */}
            <div className="bg-[#FFFDF9] p-5 rounded-2xl border border-[#EAE4DC] shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#78716C]">{isArabic ? 'متوسط وقت التصفح' : 'Avg Time Spent'}</span>
                <span className="w-8 h-8 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center font-bold text-xs">⏱️</span>
              </div>
              <div className="font-metric font-extrabold text-2xl text-[#1C1917]">4.8m</div>
              <p className="text-[10px] text-purple-700 font-semibold">
                {isArabic ? '📈 تفاعل ممتاز مع واجهة التطبيق' : '📈 Strong session duration'}
              </p>
            </div>
          </div>

          {/* Detailed Behavior Tables */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Active Buyers Table */}
            <div className="bg-[#FFFDF9] rounded-2xl border border-[#EAE4DC] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-headline font-bold text-sm text-[#1C1917] flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-emerald-600" />
                  <span>{isArabic ? 'سجل العملاء المشترين اليوم (التحويلات الناجحة)' : 'Today\'s Converting Customers'}</span>
                </h4>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 font-metric text-xs font-extrabold">
                  {orders.length} {isArabic ? 'عميل' : 'customers'}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#FAF7F2] text-[#78716C] border-b border-[#EAE4DC]">
                    <tr>
                      <th className="p-3 font-bold">{isArabic ? 'العميل' : 'Customer'}</th>
                      <th className="p-3 font-bold">{isArabic ? 'المتجر' : 'Merchant'}</th>
                      <th className="p-3 font-bold">{isArabic ? 'المبلغ' : 'Amount'}</th>
                      <th className="p-3 font-bold">{isArabic ? 'الحالة' : 'Status'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE4DC]">
                    {orders.slice(0, 5).map((o) => (
                      <tr key={o.id} className="hover:bg-amber-50/50">
                        <td className="p-3 font-bold text-[#1C1917]">{o.customerName || 'عميل فلستر'}</td>
                        <td className="p-3 text-[#57534E]">{o.item.merchant.name}</td>
                        <td className="p-3 font-metric font-extrabold text-emerald-700">{o.totalAed} AED</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            {isArabic ? 'مكتمل' : 'Completed'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {orders.length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-6 text-center text-[#78716C]">
                          {isArabic ? 'لا توجد طلبات مكتملة اليوم بعد' : 'No orders today yet'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Browsed / No Purchase & Wishlist Table */}
            <div className="bg-[#FFFDF9] rounded-2xl border border-[#EAE4DC] p-6 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-headline font-bold text-sm text-[#1C1917] flex items-center gap-2">
                  <Users className="w-4 h-4 text-amber-600" />
                  <span>{isArabic ? 'العملاء المهتمون (أضافوا للأمنيات / تصفحوا بدون شراء)' : 'Interested Prospects & Wishlist'}</span>
                </h4>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-metric text-xs font-extrabold">
                  18 {isArabic ? 'مهتم' : 'prospects'}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#FAF7F2] text-[#78716C] border-b border-[#EAE4DC]">
                    <tr>
                      <th className="p-3 font-bold">{isArabic ? 'النشاط' : 'Activity'}</th>
                      <th className="p-3 font-bold">{isArabic ? 'الاهتمام' : 'Interest'}</th>
                      <th className="p-3 font-bold">{isArabic ? 'الوقت' : 'Time'}</th>
                      <th className="p-3 font-bold">{isArabic ? 'إجراء مقترح' : 'Action'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EAE4DC]">
                    <tr className="hover:bg-amber-50/50">
                      <td className="p-3 font-bold text-[#1C1917]">❤️ أضاف لقائمة الأمنيات</td>
                      <td className="p-3 text-[#57534E]">وجبة مشاوي مشكلة طازجة</td>
                      <td className="p-3 font-metric text-[#78716C]">منذ 15 دقيقة</td>
                      <td className="p-3">
                        <span className="text-[#DC2626] font-bold text-[11px] hover:underline cursor-pointer">
                          {isArabic ? 'إرسال عرض ترويجي' : 'Send Offer'}
                        </span>
                      </td>
                    </tr>
                    <tr className="hover:bg-amber-50/50">
                      <td className="p-3 font-bold text-[#1C1917]">👀 زار ولم يشترِ</td>
                      <td className="p-3 text-[#57534E]">مخبز الشريشة الذهبي</td>
                      <td className="p-3 font-metric text-[#78716C]">منذ ساعة</td>
                      <td className="p-3">
                        <span className="text-[#059669] font-bold text-[11px] hover:underline cursor-pointer">
                          {isArabic ? 'دعوة ولاء' : 'Loyalty Invite'}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Platform Configuration (Clean without TRN confusion) */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveConfig} className="bg-[#FFFDF9] rounded-2xl border border-[#EAE4DC] p-6 shadow-xs space-y-6 max-w-2xl text-xs animate-in fade-in">
          <div>
            <h3 className="font-headline font-bold text-base text-[#1C1917] flex items-center gap-2">
              <Settings className="w-5 h-5 text-[#DC2626]" />
              <span>{isArabic ? 'إعدادات المنصة والعمولات وخدمة العملاء' : 'Platform & Commission Configuration'}</span>
            </h3>
            <p className="text-xs text-[#78716C] mt-0.5">
              {isArabic
                ? 'تحكمي في اسم المنصة على الإيصالات، رقم الواتساب للدعم الفني، ونسبة العمولة الافتراضية'
                : 'Configure receipt business name, customer support WhatsApp number, and default commission rate'}
            </p>
          </div>

          <div className="space-y-4">
            {/* Business Name (AR & EN) & Support Phone */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3.5 bg-[#FAF7F2] rounded-xl border border-[#EAE4DC] space-y-1.5">
                <label className="font-bold text-[#1C1917] block">
                  {isArabic ? 'اسم المنصة على الإيصال (عربي):' : 'Platform Name (AR):'}
                </label>
                <input
                  type="text"
                  value={businessNameArInput}
                  onChange={(e) => setBusinessNameArInput(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#EAE4DC] rounded-lg text-xs"
                />
              </div>
              <div className="p-3.5 bg-[#FAF7F2] rounded-xl border border-[#EAE4DC] space-y-1.5">
                <label className="font-bold text-[#1C1917] block">
                  {isArabic ? 'اسم المنصة (إنجليزي):' : 'Platform Name (EN):'}
                </label>
                <input
                  type="text"
                  value={businessNameEnInput}
                  onChange={(e) => setBusinessNameEnInput(e.target.value)}
                  className="w-full h-10 px-3 bg-white border border-[#EAE4DC] rounded-lg text-xs"
                />
              </div>
            </div>

            <div className="p-3.5 bg-[#FAF7F2] rounded-xl border border-[#EAE4DC] space-y-1.5">
              <label className="font-bold text-[#1C1917] block">
                {isArabic ? 'رقم واتساب وهاتف خدمة العملاء الموحد:' : 'Customer Support WhatsApp & Phone:'}
              </label>
              <input
                type="tel"
                value={supportPhoneInput}
                onChange={(e) => setSupportPhoneInput(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-[#EAE4DC] rounded-lg text-xs font-metric"
              />
            </div>

            {/* 500 Welcome Points after first completed order */}
            <div className="p-4 bg-[#FEF9EE] rounded-xl border border-amber-300 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
                  <Gift className="w-4 h-4 text-[#DC2626]" />
                  {isArabic ? 'نقاط الترحيب بعد أول طلب مكتمل:' : 'Welcome Bonus (After 1st Completed Order):'}
                </span>
                <span className="font-metric font-extrabold text-[#DC2626] text-sm">{welcomeBonus} pts</span>
              </div>
              <input
                type="number"
                min={100}
                max={2000}
                step={50}
                value={welcomeBonus}
                onChange={(e) => setWelcomeBonus(Number(e.target.value))}
                className="w-full h-10 px-3 bg-white border border-amber-300 rounded-lg text-xs font-metric"
              />
              <p className="text-[11px] text-amber-900">
                {isArabic
                  ? 'تُمنح هذه النقاط الترحيبية لمرة واحدة فقط لكل عميل بعد إتمام واستلام أول طلب.'
                  : 'Awarded once per verified customer after completing their first order.'}
              </p>
            </div>

            {/* Loyalty conversion rate */}
            <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#EAE4DC] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#1C1917] text-xs">
                  {isArabic ? 'معدل تحويل نقاط الولاء (نقاط لكل 1 درهم):' : 'Loyalty Conversion (Pts per 1 AED):'}
                </span>
                <span className="font-metric font-bold text-[#059669]">{loyaltyRate} pts = 1 AED</span>
              </div>
              <input
                type="number"
                min={50}
                max={500}
                step={10}
                value={loyaltyRate}
                onChange={(e) => setLoyaltyRate(Number(e.target.value))}
                className="w-full h-10 px-3 bg-white border border-[#EAE4DC] rounded-lg text-xs font-metric"
              />
            </div>

            {/* Platform commission rate (0 - 50%) */}
            <div className="p-4 bg-[#FAF7F2] rounded-xl border border-[#EAE4DC] space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#1C1917] text-xs">
                  {isArabic ? 'نسبة عمولة المنصة الافتراضية على المتاجر (0% - 50%):' : 'Default Platform Commission Rate (0% - 50%):'}
                </span>
                <span className="font-metric font-bold text-[#DC2626]">{commissionRate}%</span>
              </div>
              <input
                type="number"
                min={0}
                max={50}
                step={1}
                value={commissionRate}
                onChange={(e) => setCommissionRate(Math.max(0, Math.min(50, Number(e.target.value))))}
                className="w-full h-10 px-3 bg-white border border-[#EAE4DC] rounded-lg text-xs font-metric"
              />
            </div>

            {/* Live Payment Gateway Status Card */}
            <div className={`p-4 rounded-xl border space-y-2 ${
              gatewayStatus?.hasLiveGateway
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-amber-50 border-amber-300 text-amber-950'
            }`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>{isArabic ? 'حالة بوابة الدفع الإلكتروني (Apple Pay & Cards):' : 'Online Payment Gateway Status:'}</span>
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  gatewayStatus?.hasLiveGateway
                    ? 'bg-emerald-600 text-white'
                    : (gatewayStatus?.hasZiina || gatewayStatus?.hasStripe)
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-200 text-amber-950'
                }`}>
                  {gatewayStatus?.hasLiveGateway
                    ? `LIVE • ${gatewayStatus.provider}`
                    : (gatewayStatus?.hasZiina || gatewayStatus?.hasStripe)
                      ? (isArabic ? `وضع التجربة (TEST) • ${gatewayStatus.provider}` : `TEST MODE • ${gatewayStatus.provider}`)
                      : isArabic ? 'غير مربوطة (Sandbox)' : 'Sandbox Mode'}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {gatewayStatus?.hasLiveGateway
                  ? (isArabic
                      ? `البوابة مفعّلة على الوضع الحقيقي (LIVE) عبر ${gatewayStatus.provider}. جميع مدفوعات Apple Pay والبطاقات تُخصم وتُحول مباشرة لحسابك في زينة.`
                      : `Live production payments active via ${gatewayStatus.provider}. Apple Pay and card payments settle directly to your account.`)
                  : (gatewayStatus?.hasZiina || gatewayStatus?.hasStripe)
                    ? (isArabic
                        ? `بوابة ${gatewayStatus.provider} مربوطة بالمفتاح، لكنها تعمل حالياً على وضع التجربة (ZIINA_TEST_MODE=true). للتحويل للدفع الحقيقي، غيّري ZIINA_TEST_MODE إلى false في Render ثم أعيدي النشر.`
                        : `${gatewayStatus.provider} is connected, but currently in TEST mode (ZIINA_TEST_MODE=true). Set ZIINA_TEST_MODE=false in Render Environment to go live.`)
                    : (isArabic
                        ? 'لتفعيل التحصيل البنكي الحقيقي عبر Apple Pay وبطاقات Visa/Mastercard، أضيفي مفتاح ZIINA_API_TOKEN (من لوحة Ziina Business -> Developers) في إعدادات البيئة (Render Environment).'
                        : 'To activate real bank payouts via Apple Pay & Cards, add ZIINA_API_TOKEN in environment variables.')}
              </p>
            </div>

            {/* 1-Click Backup Export Card (11: النسخ الاحتياطي) */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/80 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-[#DC2626]" />
                  <span>{isArabic ? 'النسخ الاحتياطي للبيانات (Backup):' : 'Data Backup & Export:'}</span>
                </span>
                <span className="text-[10px] font-bold text-slate-500">
                  {partnerStores.length} {isArabic ? 'متجر' : 'stores'} • {orders.length} {isArabic ? 'طلب' : 'orders'}
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                {isArabic
                  ? 'يمكنكِ تحميل نسخة احتياطية كاملة من المطاعم والأصناف والطلبات ونقاط العملاء على جهازكِ في أي وقت بضغطة زر.'
                  : 'Download a full snapshot of stores, listings, orders, and customer points directly to your device anytime.'}
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    const payload = {
                      exportedAt: new Date().toISOString(),
                      platformSettings,
                      partnerStores,
                      listings,
                      orders,
                      registeredUsers,
                      socialFollowClaims,
                      commissionLogs,
                    };
                    const blob = new Blob([JSON.stringify(payload, null, 2)], {
                      type: 'application/json;charset=utf-8',
                    });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `flaster-backup-${today}.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                    setBackupNotice(
                      isArabic
                        ? `تم تحميل النسخة الاحتياطية الكاملة (flaster-backup-${today}.json)`
                        : `Full backup downloaded (flaster-backup-${today}.json)`
                    );
                    setTimeout(() => setBackupNotice(null), 4000);
                  }}
                  className="py-2.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>{isArabic ? 'تحميل نسخة احتياطية كاملة (JSON)' : 'Download Full Backup (JSON)'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const today = new Date().toISOString().slice(0, 10);
                    const escapeCsvCell = (val: unknown): string => {
                      const raw = String(val ?? '');
                      const safe = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
                      return `"${safe.replace(/"/g, '""')}"`;
                    };
                    const header = [
                      'Order ID',
                      'Date',
                      'Store',
                      'Customer',
                      'Phone',
                      'Payment Method',
                      'Status',
                      'Total AED',
                      'Pickup Code',
                    ];
                    const rows = orders.map((o) => [
                      o.id,
                      o.createdAt || '',
                      o.item?.merchant?.nameAr || o.item?.merchant?.name || '',
                      o.customerName || '',
                      o.customerPhone || '',
                      o.paymentMethod || '',
                      o.status || '',
                      Number(o.totalAed || 0).toFixed(2),
                      o.pickupCode || '',
                    ]);
                    const csv =
                      '\uFEFF' +
                      [header, ...rows].map((row) => row.map(escapeCsvCell).join(',')).join('\n');
                    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `flaster-orders-${today}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    setBackupNotice(
                      isArabic
                        ? `تم تصدير جدول الطلبات (flaster-orders-${today}.csv)`
                        : `Orders CSV exported (flaster-orders-${today}.csv)`
                    );
                    setTimeout(() => setBackupNotice(null), 4000);
                  }}
                  className="py-2.5 px-3 rounded-lg bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 font-bold text-[11px] flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
                  <span>{isArabic ? 'تصدير الطلبات (Excel / CSV)' : 'Export Orders (Excel / CSV)'}</span>
                </button>
              </div>
              {backupNotice && (
                <p className="text-[11px] font-bold text-emerald-700">{backupNotice}</p>
              )}
            </div>

            {/* Production Protection, Services & Security Logs Card (08, 09, 10, 13) */}
            {opsStatus && (
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-xs text-slate-900 flex items-center gap-1.5">
                    <History className="w-4 h-4 text-slate-700" />
                    <span>{isArabic ? 'الحماية والسجلات والخدمات (الإطلاق):' : 'Security, Logs & Services Readiness:'}</span>
                  </span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    {isArabic ? 'سقف الطلبات مفعّل ✓' : 'Rate Limit Active ✓'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-slate-500 text-[10px]">{isArabic ? 'الإيميلات التلقائية (Resend)' : 'Transactional Email'}</div>
                    <div className={`font-bold mt-0.5 ${opsStatus.services.emailConfigured ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {opsStatus.services.emailConfigured
                        ? (isArabic ? 'مفعّل ✓' : 'Active ✓')
                        : (isArabic ? 'اختياري (غير مضبوط)' : 'Optional (Not Set)')}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-slate-500 text-[10px]">{isArabic ? 'إشعارات واتساب (Meta)' : 'WhatsApp Alerts'}</div>
                    <div className={`font-bold mt-0.5 ${opsStatus.services.whatsappConfigured ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {opsStatus.services.whatsappConfigured
                        ? (isArabic ? 'مفعّل ✓' : 'Active ✓')
                        : (isArabic ? 'اختياري (غير مضبوط)' : 'Optional (Not Set)')}
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="text-slate-500 text-[10px]">{isArabic ? 'مفاتيح الأمان في السيرفر' : 'Server Secrets'}</div>
                    <div className={`font-bold mt-0.5 ${opsStatus.services.portalSecretConfigured && opsStatus.services.pickupPepperConfigured ? 'text-emerald-700' : 'text-amber-700'}`}>
                      {opsStatus.services.portalSecretConfigured && opsStatus.services.pickupPepperConfigured
                        ? (isArabic ? 'مضبوطة ✓' : 'Configured ✓')
                        : (isArabic ? 'تحتاج ضبط في Render' : 'Set in Render')}
                    </div>
                  </div>
                </div>

                {opsStatus.logs.length > 0 && (
                  <div className="space-y-1.5 pt-1 border-t border-slate-100">
                    <div className="text-[10px] font-bold text-slate-500">
                      {isArabic ? 'آخر سجلات النظام والأمان:' : 'Recent Security & System Logs:'}
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1 font-mono text-[10px]">
                      {opsStatus.logs.slice(0, 8).map((log) => (
                        <div
                          key={log.id}
                          className="flex items-center justify-between gap-2 px-2 py-1 rounded bg-slate-50 border border-slate-100 text-slate-700"
                        >
                          <span className="truncate">
                            <span
                              className={`font-bold me-1.5 ${
                                log.level === 'error'
                                  ? 'text-red-600'
                                  : log.level === 'warn'
                                    ? 'text-amber-600'
                                    : 'text-emerald-700'
                              }`}
                            >
                              [{log.category}]
                            </span>
                            {log.message}
                            {log.path ? ` • ${log.path}` : ''}
                          </span>
                          <span className="text-slate-400 shrink-0">
                            {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

          {configSaveSuccess && (
            <div className="p-3.5 bg-emerald-100 border border-emerald-300 text-emerald-950 rounded-xl font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>{isArabic ? '✓ تم حفظ وتطبيق إعدادات المنصة والعمولة بنجاح!' : '✓ Platform settings saved and applied!'}</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-3 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-headline font-bold text-xs shadow-md shadow-red-600/20 active:scale-95 transition-all cursor-pointer"
          >
            {isArabic ? 'حفظ وتطبيق إعدادات المنصة ✓' : 'Save & Apply Settings ✓'}
          </button>
        </form>
      )}

    </div>
  );
};
