import React from 'react';
import { createPortal } from 'react-dom';
import {
  ShoppingCart,
  Store,
  ReceiptText,
  ChevronDown,
  HelpCircle,
  Coins,
  Shield,
  Headphones,
  Navigation,
  FileText,
  LogOut,
  Menu,
  X,
  Lock,
  Phone,
  RotateCcw,
  UserPlus,
  LayoutDashboard,
  Settings,
  Globe,
  Check,
  Share2,
} from 'lucide-react';

import { Language, DynamicRegion, CustomerProfile } from '../types';
import { translations, LANGUAGE_OPTIONS } from '../translations';
import { ADMIN_EMAIL_ALLOWLIST } from '../config/platformConfig';
import { useAuth } from '../context/AuthContext';
import { PWAInstallButton, OfflineIndicator } from './PWAInstallButton';
import flasterLogoImg from '../assets/images/flaster_brand_logo_1794321576013.jpg';

interface HeaderProps {
  lang: Language;
  onLanguageChange: (lang: Language) => void;
  selectedLocation: string;
  onLocationChange: (locId: string) => void;
  cartCount: number;
  cartTotal: number;
  onOpenCart: () => void;
  viewMode: 'consumer' | 'merchant' | 'admin';
  onViewModeChange: (mode: 'consumer' | 'merchant' | 'admin') => void;
  isMerchantAuthenticated: boolean;
  activeOrdersCount: number;
  onOpenOrders: () => void;
  onOpenImpact: () => void;
  onOpenHowItWorks: () => void;
  loyaltyPoints?: number;
  onOpenLoyalty?: () => void;
  regions?: DynamicRegion[];
  customerProfile?: CustomerProfile | null;
  onOpenAuth?: () => void;
  onOpenAddresses?: () => void;
  onOpenFaq?: () => void;
  onOpenSupport?: () => void;
  onOpenLegal?: () => void;
  onOpenLegalTab?: (tab: 'privacy' | 'terms' | 'refund' | 'food_safety' | 'contact') => void;
  onLogoutCustomer?: () => void;
  onOpenPartnerModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  lang,
  onLanguageChange,
  cartCount,
  cartTotal,
  onOpenCart,
  viewMode,
  onViewModeChange,
  activeOrdersCount,
  onOpenOrders,
  loyaltyPoints = 0,
  onOpenLoyalty,
  customerProfile,
  onOpenAuth,
  onOpenAddresses,
  onOpenFaq,
  onOpenSupport,
  onOpenLegal,
  onOpenLegalTab,
  onLogoutCustomer,
  onOpenPartnerModal,
}) => {
  const { currentUser } = useAuth();
  const activeUserEmail = (customerProfile?.email || currentUser?.email || '').toLowerCase();
  const isFounderAdmin = Boolean(
    currentUser?.isAdmin ||
    (activeUserEmail && ADMIN_EMAIL_ALLOWLIST.includes(activeUserEmail))
  );
  const t = translations[lang];
  const isRtl = lang === 'ar' || lang === 'ur';
  const isArabic = lang === 'ar';
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = React.useState(false);
  const [langDropdownOpen, setLangDropdownOpen] = React.useState(false);
  const [logoTapCount, setLogoTapCount] = React.useState(0);

  // Real points balance: 0 if not logged in
  const displayPoints = customerProfile ? loyaltyPoints : 0;

  const activeLangObj =
    LANGUAGE_OPTIONS.find((l) => l.code === lang) || LANGUAGE_OPTIONS[0];

  // Reliable touch + click handler for standalone PWA mode (iOS WebKit & Android WebAPK)
  const lastTapTimeRef = React.useRef<number>(0);
  const touchStartCoordsRef = React.useRef<{ x: number; y: number } | null>(null);

  const bindTap = (action: () => void) => ({
    onTouchStart: (e: React.TouchEvent) => {
      if (e.touches && e.touches.length === 1) {
        touchStartCoordsRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      }
    },
    onTouchEnd: (e: React.TouchEvent) => {
      e.stopPropagation();
      if (touchStartCoordsRef.current && e.changedTouches && e.changedTouches.length > 0) {
        const dx = Math.abs(e.changedTouches[0].clientX - touchStartCoordsRef.current.x);
        const dy = Math.abs(e.changedTouches[0].clientY - touchStartCoordsRef.current.y);
        touchStartCoordsRef.current = null;
        if (dx > 16 || dy > 16) {
          return;
        }
      }
      if (e.cancelable) {
        e.preventDefault();
      }
      lastTapTimeRef.current = Date.now();
      action();
    },
    onClick: (e: React.MouseEvent) => {
      e.stopPropagation();
      if (Date.now() - lastTapTimeRef.current < 450) {
        return;
      }
      lastTapTimeRef.current = Date.now();
      action();
    },
  });

  const handleLogoClick = () => {
    setLogoTapCount((prev) => {
      const next = prev + 1;
      if (next >= 3) {
        onViewModeChange('admin');
        return 0;
      }
      return next;
    });
    setTimeout(() => setLogoTapCount(0), 1500);
  };

  const userDropdownRef = React.useRef<HTMLDivElement>(null);
  const langButtonRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (sidebarOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [sidebarOpen]);

  const handleOpenPolicy = (tab: 'privacy' | 'terms' | 'refund' | 'food_safety' | 'contact') => {
    setSidebarOpen(false);
    if (onOpenLegalTab) {
      onOpenLegalTab(tab);
    } else if (onOpenLegal) {
      onOpenLegal();
    }
  };

  return (
    <>
      <header
        data-no-dom-translate="true"
        style={{
          pointerEvents: 'auto',
          boxSizing: 'border-box',
        }}
        className="pwa-safe-header sticky top-0 z-[100] bg-[#FFFDF9] border-b border-[#EAE4DC] shadow-2xs transition-all"
      >
        <div
          style={{ pointerEvents: 'auto' }}
          className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8"
        >
          <div
            style={{ pointerEvents: 'auto' }}
            className="flex items-center justify-between h-16 sm:h-20 gap-1.5 sm:gap-3"
          >
            {/* Start Cluster: Hamburger Menu (☰) + Official Flaster Brand & Clean Single-Color Slogan */}
            <div style={{ pointerEvents: 'auto' }} className="flex items-center gap-2 sm:gap-3 min-w-0">
              {/* Hamburger Button (☰) */}
              <button
                type="button"
                {...bindTap(() => {
                  setLangDropdownOpen(false);
                  setSidebarOpen((prev) => !prev);
                })}
                style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                className="pwa-touch-btn relative min-w-[42px] min-h-[42px] w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-[#FAF7F2] hover:bg-amber-50 active:bg-amber-100 border border-[#EAE4DC] text-[#1C1917] flex items-center justify-center shadow-2xs transition-all cursor-pointer shrink-0 select-none"
                aria-label={isArabic ? 'القائمة الجانبية' : 'Open Menu'}
                aria-expanded={sidebarOpen}
                title={isArabic ? 'القائمة الجانبية' : 'Menu'}
              >
                <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-[#DC2626] pointer-events-none" />
                {activeOrdersCount > 0 && (
                  <span className="md:hidden absolute -top-1 -end-1 w-4 h-4 rounded-full bg-[#DC2626] text-white text-[9px] font-bold flex items-center justify-center pointer-events-none">
                    {activeOrdersCount}
                  </span>
                )}
              </button>

              {/* Logo & Brand: Flaster with Single-Color Slogan underneath */}
              <button
                type="button"
                {...bindTap(handleLogoClick)}
                style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                className="pwa-touch-btn flex items-center gap-2 sm:gap-3 text-start group focus:outline-none cursor-pointer min-w-0 select-none"
                title="Flaster"
              >
                <div className="relative w-9 h-9 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl overflow-hidden bg-white shadow-sm border border-[#EAE4DC] group-hover:scale-105 transition-all shrink-0 pointer-events-none">
                  <img
                    src={flasterLogoImg}
                    alt="Flaster Logo"
                    className="w-full h-full object-cover pointer-events-none"
                  />
                </div>
                <div className="flex flex-col min-w-0 pointer-events-none">
                  <span className="font-headline font-black text-lg sm:text-2xl tracking-tight text-[#1C1917] leading-none group-hover:text-[#DC2626] transition-colors">
                    Flaster
                  </span>
                  <span className="text-[10px] sm:text-xs font-extrabold text-[#DC2626] mt-0.5 leading-tight truncate">
                    {t.brandSubtitle}
                  </span>
                </div>
              </button>
            </div>

            {/* End Action Cluster: Fit cleanly on mobile without overflowing */}
            <div style={{ pointerEvents: 'auto' }} className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
              {/* Customer Account Pill (Desktop) */}
              {customerProfile && (
                <div className="relative hidden md:block" ref={userDropdownRef}>
                  <button
                    type="button"
                    {...bindTap(() => setUserDropdownOpen((prev) => !prev))}
                    style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                    className="pwa-touch-btn flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FFFDF9] border border-[#EAE4DC] hover:border-amber-400 text-xs font-bold text-[#0F172A] shadow-2xs transition-all cursor-pointer"
                  >
                    <div className="w-6 h-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs pointer-events-none">
                      {customerProfile.name.charAt(0) || 'F'}
                    </div>
                    <span className="max-w-[90px] truncate pointer-events-none">
                      {customerProfile.name}
                    </span>
                    <ChevronDown className="w-3 h-3 text-[#64748B] pointer-events-none" />
                  </button>

                  {userDropdownOpen && (
                    <div className="absolute end-0 mt-2 w-64 rounded-2xl bg-[#FFFDF9] border border-[#EAE4DC] shadow-elevation-4 py-2 z-50">
                      <div className="px-4 py-2 border-b border-slate-100">
                        <p className="font-bold text-xs text-[#0F172A] truncate">
                          {customerProfile.name}
                        </p>
                        <p className="text-[11px] text-[#64748B] font-mono">
                          {customerProfile.phone}
                        </p>
                        <div className="mt-1 flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md">
                          <Coins className="w-3 h-3 text-amber-600" />
                          <span>
                            {displayPoints} {isArabic ? 'نقطة' : 'pts'}
                          </span>
                        </div>
                      </div>

                      <div className="py-1">
                        <button
                          type="button"
                          onClick={() => {
                            setUserDropdownOpen(false);
                            if (onOpenAddresses) onOpenAddresses();
                          }}
                          className="w-full text-start px-4 py-2 text-xs flex items-center gap-2 hover:bg-[#FAF8F5] text-[#0F172A]"
                        >
                          <Navigation className="w-3.5 h-3.5 text-[#DC2626]" />
                          <span>
                            {isArabic ? 'إدارة العناوين المحفوظة' : 'Saved Addresses'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setUserDropdownOpen(false);
                            if (onOpenLoyalty) onOpenLoyalty();
                          }}
                          className="w-full text-start px-4 py-2 text-xs flex items-center gap-2 hover:bg-[#FAF8F5] text-[#0F172A]"
                        >
                          <Coins className="w-3.5 h-3.5 text-amber-600" />
                          <span>
                            {isArabic ? 'محفظة النقاط والخصومات' : 'Points Wallet'}
                          </span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setUserDropdownOpen(false);
                            if (onOpenOrders) onOpenOrders();
                          }}
                          className="w-full text-start px-4 py-2 text-xs flex items-center gap-2 hover:bg-[#FAF8F5] text-[#0F172A]"
                        >
                          <ReceiptText className="w-3.5 h-3.5 text-slate-600" />
                          <span>{t.viewOrders}</span>
                        </button>
                      </div>

                      <div className="border-t border-slate-100 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setUserDropdownOpen(false);
                            if (onLogoutCustomer) onLogoutCustomer();
                          }}
                          className="w-full text-start px-4 py-2 text-xs flex items-center gap-2 hover:bg-red-50 text-[#DC2626] font-semibold"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                          <span>{t.signOut}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Rewards / Loyalty Points Pill (Hidden on narrow mobile so Header never overflows; accessible in Sidebar ☰) */}
              <button
                type="button"
                {...bindTap(() => {
                  if (onOpenLoyalty) onOpenLoyalty();
                })}
                style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                className="pwa-touch-btn hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 text-xs font-bold transition-all shadow-2xs active:scale-95 group shrink-0 cursor-pointer"
                title={
                  isArabic
                    ? 'محفظة نقاط فلاستر (100 نقطة = 1 درهم)'
                    : 'Rewards Wallet (100 Pts = 1 AED)'
                }
              >
                <Coins className="w-4 h-4 text-amber-600 group-hover:rotate-12 transition-transform pointer-events-none" />
                <span className="font-metric font-extrabold text-[#0F172A] text-xs pointer-events-none">
                  {displayPoints}
                </span>
                <span className="text-[10px] text-amber-800 font-semibold hidden lg:inline pointer-events-none">
                  {isArabic ? 'نقطة' : 'pts'}
                </span>
              </button>

              {/* Active Orders (Desktop button; on mobile accessible via Sidebar or quick badge) */}
              <button
                type="button"
                {...bindTap(onOpenOrders)}
                style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                className="pwa-touch-btn hidden md:flex relative p-2 rounded-full bg-[#FFFDF9] hover:bg-amber-50/40 border border-[#EAE4DC] text-[#0F172A] transition-colors shadow-2xs shrink-0 cursor-pointer"
                title={t.viewOrders}
              >
                <ReceiptText className="w-4 h-4 text-[#0F172A] pointer-events-none" />
                {activeOrdersCount > 0 && (
                  <span className="absolute -top-1 -end-1 w-5 h-5 rounded-full bg-[#DC2626] text-white text-[11px] font-bold flex items-center justify-center shadow-sm pointer-events-none">
                    {activeOrdersCount}
                  </span>
                )}
              </button>

              {/* PWA Install App Button (Compact on mobile, solid Emerald Green, hidden automatically in standalone mode) */}
              <PWAInstallButton lang={lang} />

              {/* 5-Language Selector Button (العربية, English, اردو, हिन्दी, Filipino) */}
              <div style={{ pointerEvents: 'auto' }} className="relative shrink-0">
                <button
                  ref={langButtonRef}
                  type="button"
                  {...bindTap(() => {
                    setSidebarOpen(false);
                    setLangDropdownOpen((prev) => !prev);
                  })}
                  style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                  aria-label="Select Language / اختر اللغة"
                  aria-expanded={langDropdownOpen}
                  className="pwa-touch-btn flex items-center gap-1 px-2.5 sm:px-3 min-h-[40px] h-10 rounded-full bg-[#FAF7F2] hover:bg-amber-50 active:bg-amber-100 border border-[#EAE4DC] text-[#1C1917] text-xs font-extrabold shadow-2xs transition-all cursor-pointer select-none"
                  title="Select Language / اختر اللغة"
                >
                  <Globe className="w-3.5 h-3.5 text-[#DC2626] shrink-0 pointer-events-none" />
                  <span className="text-[11px] sm:text-xs pointer-events-none">
                    {activeLangObj.nativeName}
                  </span>
                  <ChevronDown
                    className={`w-3 h-3 text-[#78716C] transition-transform duration-200 pointer-events-none ${
                      langDropdownOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              </div>

              {/* Shopping Cart Button in Pure Solid Crimson Red labeled «السلة» */}
              <button
                type="button"
                {...bindTap(() => {
                  setLangDropdownOpen(false);
                  setSidebarOpen(false);
                  onOpenCart();
                })}
                style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                className="pwa-touch-btn flex items-center gap-1.5 px-2.5 sm:px-4 min-h-[40px] h-10 rounded-full bg-[#DC2626] hover:bg-[#B91C1C] active:bg-[#991B1B] text-white font-bold text-xs sm:text-sm shadow-sm active:scale-95 transition-all shrink-0 cursor-pointer select-none"
                title={t.cartTitle}
              >
                <ShoppingCart className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[2.2] pointer-events-none" />
                <span className="pointer-events-none">{t.cartTitle}</span>
                <span className="font-metric font-extrabold px-1.5 py-0.2 rounded-full bg-white text-[#DC2626] text-[11px] pointer-events-none">
                  {cartCount}
                </span>
                {cartTotal > 0 && (
                  <span className="hidden lg:inline font-metric border-s border-white/40 ps-2 ms-0.5 pointer-events-none">
                    {cartTotal} {t.currency}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Portaled 5-Language Dropdown Menu: Guaranteed un-clipped & touch-responsive in Standalone PWA Mode */}
      {langDropdownOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-no-dom-translate="true"
            dir={isRtl ? 'rtl' : 'ltr'}
            style={{ pointerEvents: 'auto' }}
            className="fixed inset-0 z-[9998] bg-stone-950/25 flex items-start justify-end p-3 sm:p-5"
            {...bindTap(() => setLangDropdownOpen(false))}
          >
            <div
              style={{
                pointerEvents: 'auto',
                marginTop: 'calc(3.75rem + env(safe-area-inset-top, 0px))',
              }}
              className="w-60 rounded-2xl bg-[#FFFDF9] border border-[#EAE4DC] shadow-2xl py-2 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              <div className="px-4 py-2 text-[11px] font-extrabold text-[#78716C] border-b border-[#EAE4DC] flex items-center justify-between">
                <span>اختر اللغة • Language</span>
                <button
                  type="button"
                  {...bindTap(() => setLangDropdownOpen(false))}
                  className="pwa-touch-btn w-6 h-6 rounded-full bg-[#FAF7F2] hover:bg-stone-200 text-[#1C1917] flex items-center justify-center"
                  aria-label={t.close}
                >
                  <X className="w-3.5 h-3.5 pointer-events-none" />
                </button>
              </div>
              <div className="divide-y divide-[#EAE4DC]/60">
                {LANGUAGE_OPTIONS.map((option) => {
                  const isSelected = lang === option.code;
                  return (
                    <button
                      key={option.code}
                      type="button"
                      {...bindTap(() => {
                        onLanguageChange(option.code);
                        setLangDropdownOpen(false);
                      })}
                      style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                      className={`pwa-touch-btn w-full text-start px-4 py-3 text-xs flex items-center justify-between transition-colors cursor-pointer select-none ${
                        isSelected
                          ? 'bg-red-50 text-[#DC2626] font-extrabold'
                          : 'text-[#1C1917] font-semibold hover:bg-[#FAF7F2] active:bg-amber-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 pointer-events-none">
                        <span className="text-base">{option.flag}</span>
                        <span>{option.label}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-[#059669] pointer-events-none" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Sidebar Menu Drawer (القائمة الجانبية المنسدلة ☰) rendered in portal */}
      {sidebarOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            data-no-dom-translate="true"
            dir={isRtl ? 'rtl' : 'ltr'}
            style={{ pointerEvents: 'auto' }}
            className="fixed inset-0 z-[9995] bg-stone-900/60 flex justify-start"
            {...bindTap(() => setSidebarOpen(false))}
          >
            <aside
              style={{ pointerEvents: 'auto' }}
              className="w-full max-w-xs sm:max-w-sm bg-[#FFFDF9] h-full shadow-2xl border-e border-[#EAE4DC] flex flex-col justify-between overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
            >
              {/* Top Header of Sidebar: Clean Solid Crimson Red with Safe-Area Top Inset */}
              <div className="pwa-safe-drawer-top px-5 pb-5 bg-[#DC2626] text-white border-b border-red-700 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl overflow-hidden bg-white shadow-md border border-white/40 shrink-0">
                    <img
                      src={flasterLogoImg}
                      alt="Flaster Logo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <span className="font-headline font-black text-xl text-white block leading-none">
                      Flaster
                    </span>
                    <span className="text-xs font-bold text-red-100 block mt-1">
                      {t.brandSubtitle}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  {...bindTap(() => setSidebarOpen(false))}
                  style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                  className="pwa-touch-btn w-9 h-9 rounded-full bg-black/20 hover:bg-black/35 border border-white/30 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                  aria-label={t.close}
                >
                  <X className="w-4 h-4 pointer-events-none" />
                </button>
              </div>

              {/* Scrollable Ordered Links Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
                {/* Quick Mobile Actions: Orders & Loyalty Points */}
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    {...bindTap(() => {
                      setSidebarOpen(false);
                      onOpenOrders();
                    })}
                    style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                    className="pwa-touch-btn p-3 rounded-xl bg-[#FAF7F2] hover:bg-red-50/50 border border-[#EAE4DC] flex items-center gap-2.5 text-[#1C1917] font-bold cursor-pointer"
                  >
                    <ReceiptText className="w-4 h-4 text-[#DC2626] shrink-0 pointer-events-none" />
                    <div className="text-start truncate pointer-events-none">
                      <span className="block truncate">{t.viewOrders}</span>
                      <span className="text-[10px] text-[#DC2626] font-metric font-extrabold">
                        {activeOrdersCount} {isArabic ? 'نشط' : 'active'}
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    {...bindTap(() => {
                      setSidebarOpen(false);
                      if (onOpenLoyalty) onOpenLoyalty();
                    })}
                    style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                    className="pwa-touch-btn p-3 rounded-xl bg-amber-50 hover:bg-amber-100/70 border border-amber-200 flex items-center gap-2.5 text-amber-950 font-bold cursor-pointer"
                  >
                    <Coins className="w-4 h-4 text-amber-600 shrink-0 pointer-events-none" />
                    <div className="text-start truncate pointer-events-none">
                      <span className="block truncate">{isArabic ? 'نقاطي' : 'My Points'}</span>
                      <span className="text-[10px] text-amber-800 font-metric font-extrabold">
                        {displayPoints} {isArabic ? 'نقطة' : 'pts'}
                      </span>
                    </div>
                  </button>
                </div>

                {/* Direct App Install Card inside Sidebar */}
                <PWAInstallButton lang={lang} variant="sidebar" />

                {/* Group 1: المعلومات والدعم */}
                <div className="space-y-2">
                  <div className="px-2 text-[11px] font-extrabold text-[#78716C] uppercase tracking-wider">
                    {t.infoAndSupport}
                  </div>
                  <div className="bg-[#FAF7F2] rounded-2xl border border-[#EAE4DC] divide-y divide-[#EAE4DC] overflow-hidden">
                    <button
                      type="button"
                      {...bindTap(() => {
                        setSidebarOpen(false);
                        if (onOpenFaq) onOpenFaq();
                      })}
                      style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                      className="pwa-touch-btn w-full text-start px-4 py-3 flex items-center gap-3 hover:bg-amber-50/60 text-[#1C1917] font-semibold transition-colors cursor-pointer"
                    >
                      <HelpCircle className="w-4 h-4 text-[#DC2626] shrink-0 pointer-events-none" />
                      <span className="pointer-events-none">{t.faqTitle}</span>
                    </button>

                    <button
                      type="button"
                      {...bindTap(() => {
                        setSidebarOpen(false);
                        if (onOpenSupport) onOpenSupport();
                      })}
                      style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                      className="pwa-touch-btn w-full text-start px-4 py-3 flex items-center gap-3 hover:bg-amber-50/60 text-[#1C1917] font-semibold transition-colors cursor-pointer"
                    >
                      <Headphones className="w-4 h-4 text-[#059669] shrink-0 pointer-events-none" />
                      <span className="pointer-events-none">{t.customerSupport}</span>
                    </button>

                    <button
                      type="button"
                      {...bindTap(() => handleOpenPolicy('terms'))}
                      style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                      className="pwa-touch-btn w-full text-start px-4 py-3 flex items-center gap-3 hover:bg-amber-50/60 text-[#1C1917] font-semibold transition-colors cursor-pointer"
                    >
                      <FileText className="w-4 h-4 text-amber-600 shrink-0 pointer-events-none" />
                      <span className="pointer-events-none">{t.termsOfUse}</span>
                    </button>

                    <button
                      type="button"
                      {...bindTap(() => handleOpenPolicy('privacy'))}
                      style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                      className="pwa-touch-btn w-full text-start px-4 py-3 flex items-center gap-3 hover:bg-amber-50/60 text-[#1C1917] font-semibold transition-colors cursor-pointer"
                    >
                      <Shield className="w-4 h-4 text-[#059669] shrink-0 pointer-events-none" />
                      <span className="pointer-events-none">{t.privacyPolicy}</span>
                    </button>

                    <button
                      type="button"
                      {...bindTap(() => handleOpenPolicy('refund'))}
                      style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                      className="pwa-touch-btn w-full text-start px-4 py-3 flex items-center gap-3 hover:bg-amber-50/60 text-[#1C1917] font-semibold transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-4 h-4 text-[#DC2626] shrink-0 pointer-events-none" />
                      <span className="pointer-events-none">{t.refundPolicy}</span>
                    </button>

                    <button
                      type="button"
                      {...bindTap(() => handleOpenPolicy('contact'))}
                      style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                      className="pwa-touch-btn w-full text-start px-4 py-3 flex items-center gap-3 hover:bg-amber-50/60 text-[#1C1917] font-semibold transition-colors cursor-pointer"
                    >
                      <Phone className="w-4 h-4 text-[#059669] shrink-0 pointer-events-none" />
                      <span className="pointer-events-none">{t.contactUs}</span>
                    </button>

                    <a
                      href="https://linktr.ee/flaster"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                      className="pwa-touch-btn w-full text-start px-4 py-3 flex items-center gap-3 hover:bg-amber-50/60 text-[#1C1917] font-semibold transition-colors cursor-pointer"
                    >
                      <Share2 className="w-4 h-4 text-purple-600 shrink-0 pointer-events-none" />
                      <span className="pointer-events-none">{isArabic ? 'حسابات التواصل الاجتماعي' : 'Social Media Accounts'}</span>
                    </a>
                  </div>
                </div>

                {/* Group 2: الأقسام والشركاء */}
                <div className="space-y-2">
                  <div className="px-2 text-[11px] font-extrabold text-[#78716C] uppercase tracking-wider">
                    {t.sectionsAndPartners}
                  </div>
                  <div className="bg-[#FAF7F2] rounded-2xl border border-[#EAE4DC] divide-y divide-[#EAE4DC] overflow-hidden">
                    <button
                      type="button"
                      {...bindTap(() => {
                        setSidebarOpen(false);
                        onViewModeChange('consumer');
                      })}
                      style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                      className={`pwa-touch-btn w-full text-start px-4 py-3 flex items-center justify-between hover:bg-amber-50/60 font-semibold transition-colors cursor-pointer ${
                        viewMode === 'consumer' ? 'text-[#DC2626] bg-red-50/50' : 'text-[#1C1917]'
                      }`}
                    >
                      <div className="flex items-center gap-3 pointer-events-none">
                        <Store className="w-4 h-4 text-[#DC2626] shrink-0" />
                        <span>{t.consumerMarketplace}</span>
                      </div>
                    </button>

                    <button
                      type="button"
                      {...bindTap(() => {
                        setSidebarOpen(false);
                        if (onOpenPartnerModal) onOpenPartnerModal();
                      })}
                      style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                      className="pwa-touch-btn w-full text-start px-4 py-3 flex items-center gap-3 hover:bg-amber-50/60 text-[#1C1917] font-semibold transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4 text-[#059669] shrink-0 pointer-events-none" />
                      <span className="pointer-events-none">{t.joinPartner}</span>
                    </button>
                  </div>
                </div>

                {/* Group 3: الإدارة (General Admin & Reports visible ONLY to Master Founders) */}
                {isFounderAdmin && (
                  <div className="space-y-2">
                    <div className="px-2 text-[11px] font-extrabold text-[#78716C] uppercase tracking-wider">
                      {t.administrationGroup}
                    </div>
                    <div className="bg-[#FAF7F2] rounded-2xl border border-[#EAE4DC] divide-y divide-[#EAE4DC] overflow-hidden">
                      <button
                        type="button"
                        {...bindTap(() => {
                          setSidebarOpen(false);
                          onViewModeChange('admin');
                        })}
                        style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                        className="pwa-touch-btn w-full text-start px-4 py-3 flex items-center gap-3 hover:bg-amber-50/60 text-[#1C1917] font-semibold transition-colors cursor-pointer"
                      >
                        <Settings className="w-4 h-4 text-amber-600 shrink-0 pointer-events-none" />
                        <span className="pointer-events-none">{t.generalAdmin}</span>
                      </button>

                      <button
                        type="button"
                        {...bindTap(() => {
                          setSidebarOpen(false);
                          onViewModeChange('admin');
                        })}
                        style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                        className="pwa-touch-btn w-full text-start px-4 py-3 flex items-center gap-3 hover:bg-amber-50/60 text-[#1C1917] font-semibold transition-colors cursor-pointer"
                      >
                        <LayoutDashboard className="w-4 h-4 text-[#059669] shrink-0 pointer-events-none" />
                        <span className="pointer-events-none">{t.adminReports}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Partner Portal («بوابة الشركاء») */}
                <div className="space-y-2">
                  <div className="px-2 text-[11px] font-extrabold text-[#78716C] uppercase tracking-wider">
                    {t.merchantPortal}
                  </div>
                  <div className="bg-[#FAF7F2] rounded-2xl border border-[#EAE4DC] overflow-hidden">
                    <button
                      type="button"
                      {...bindTap(() => {
                        setSidebarOpen(false);
                        onViewModeChange('merchant');
                      })}
                      style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                      className="pwa-touch-btn w-full text-start px-4 py-3 flex items-center justify-between hover:bg-amber-50/60 text-[#1C1917] font-semibold transition-colors cursor-pointer"
                    >
                      <div className="flex items-center gap-3 pointer-events-none">
                        {isFounderAdmin ? (
                          <Store className="w-4 h-4 text-[#059669] shrink-0" />
                        ) : (
                          <Lock className="w-4 h-4 text-[#DC2626] shrink-0" />
                        )}
                        <span>{t.merchantPortal}</span>
                      </div>
                      {!isFounderAdmin && (
                        <Lock className="w-3.5 h-3.5 text-[#78716C] pointer-events-none" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Bottom Sticky Action Button: تسجيل الدخول in Solid Crimson Red */}
              <div className="p-5 bg-[#FAF7F2] border-t border-[#EAE4DC]">
                {customerProfile ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="font-bold text-[#1C1917] truncate">{customerProfile.name}</span>
                      <span className="font-metric text-[#78716C]">{customerProfile.phone}</span>
                    </div>
                    <button
                      type="button"
                      {...bindTap(() => {
                        setSidebarOpen(false);
                        if (onLogoutCustomer) onLogoutCustomer();
                      })}
                      style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                      className="pwa-touch-btn w-full h-11 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition-all cursor-pointer"
                    >
                      <LogOut className="w-4 h-4 pointer-events-none" />
                      <span className="pointer-events-none">{t.signOut}</span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    {...bindTap(() => {
                      setSidebarOpen(false);
                      if (onOpenAuth) onOpenAuth();
                    })}
                    style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
                    className="pwa-touch-btn w-full h-12 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-headline font-extrabold text-sm flex items-center justify-center gap-2 shadow-md shadow-red-600/20 active:scale-95 transition-all cursor-pointer"
                  >
                    <span className="pointer-events-none">{t.signIn}</span>
                  </button>
                )}
              </div>
            </aside>
          </div>,
          document.body
        )}

      {/* Offline Connectivity Indicator */}
      <OfflineIndicator lang={lang} />
    </>
  );
};
