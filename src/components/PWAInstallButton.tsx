import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  Smartphone,
  Share,
  PlusSquare,
  X,
  CheckCircle2,
  Sparkles,
  Zap,
  WifiOff,
  MoreVertical,
} from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from '../hooks/usePWAInstall';
import { Language } from '../types';
import { translations } from '../translations';
import flasterLogoImg from '../assets/images/flaster_brand_logo_1794321576013.jpg';

interface PWAInstallButtonProps {
  lang: Language;
  variant?: 'header' | 'sidebar';
}

export const OfflineIndicator: React.FC<{ lang: Language }> = ({ lang }) => {
  const isOnline = useOnlineStatus();
  const isArabic = lang === 'ar' || lang === 'ur';

  if (isOnline || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed bottom-4 start-4 z-[9990] flex items-center gap-2.5 rounded-xl bg-amber-400 px-4 py-2.5 text-xs font-bold text-stone-950 shadow-xl border border-amber-500 animate-in fade-in">
      <WifiOff className="w-4 h-4 shrink-0 animate-pulse text-[#DC2626]" />
      <span>
        {isArabic
          ? 'وضع عدم الاتصال — يتم عرض البيانات المخزنة مؤقتاً بسرعة فائقة.'
          : 'Offline Mode — Using fast cached data.'}
      </span>
    </div>,
    document.body
  );
};

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  lang,
  variant = 'header',
}) => {
  const {
    isInstalled,
    isIOS,
    isModalOpen,
    dismissModal,
    openModal,
  } = usePWAInstall();

  const t = translations[lang];
  const isRtl = lang === 'ar' || lang === 'ur';
  const isArabic = lang === 'ar';
  const [activePlatformTab, setActivePlatformTab] = useState<'android' | 'ios'>(
    isIOS ? 'ios' : 'android'
  );

  useEffect(() => {
    if (isIOS) {
      setActivePlatformTab('ios');
    } else {
      setActivePlatformTab('android');
    }
  }, [isIOS]);

  // Lock body scroll when the large installation modal is open
  useEffect(() => {
    if (isModalOpen) {
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prevOverflow;
      };
    }
  }, [isModalOpen]);

  // Automatically stop showing once installed or running in standalone mode
  if (isInstalled) {
    return null;
  }

  // Sidebar variant renders a clean solid Emerald Green button inside the Sidebar drawer
  if (variant === 'sidebar') {
    return (
      <button
        type="button"
        onClick={openModal}
        className="w-full py-3 px-4 rounded-xl bg-[#059669] hover:bg-[#047857] text-white font-headline font-extrabold text-xs shadow-sm transition-all flex items-center justify-between gap-2 cursor-pointer"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white text-[#059669] flex items-center justify-center shrink-0">
            <Download className="w-4 h-4" />
          </div>
          <div className="text-start">
            <span className="block text-xs font-extrabold text-white">
              {t.installApp} 📲
            </span>
            <span className="block text-[10px] text-emerald-100 font-semibold">
              {isArabic ? 'يعمل بملء الشاشة للآيفون والأندرويد' : 'Full-screen for iPhone & Android'}
            </span>
          </div>
        </div>
        <span className="px-2.5 py-1 rounded-lg bg-white text-[#059669] text-[10px] font-extrabold shrink-0">
          {t.installApp}
        </span>
      </button>
    );
  }

  const modalNode =
    isModalOpen && typeof document !== 'undefined'
      ? createPortal(
          <div
            dir={isRtl ? 'rtl' : 'ltr'}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-stone-950/75 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200"
            onClick={dismissModal}
          >
            <div
              className="relative w-full max-w-lg bg-[#FFFDF9] rounded-3xl shadow-2xl border border-[#EAE4DC] overflow-hidden my-auto animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top Hero Banner in Clean Solid Crimson Red */}
              <div className="relative bg-[#DC2626] text-white p-6 sm:p-7 overflow-hidden">
                {/* Dismiss X Button */}
                <button
                  type="button"
                  onClick={dismissModal}
                  aria-label={t.close}
                  className="absolute top-4 end-4 w-9 h-9 rounded-full bg-black/25 hover:bg-black/40 text-white flex items-center justify-center transition-colors cursor-pointer border border-white/30 z-10"
                >
                  <X className="w-5 h-5" />
                </button>

                <div className="relative z-10 flex items-center gap-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border-2 border-white shadow-xl bg-white shrink-0">
                    <img
                      src={flasterLogoImg}
                      alt="Flaster App Icon"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-400 text-stone-950 text-[11px] font-extrabold shadow-2xs">
                      <Sparkles className="w-3 h-3 text-[#DC2626]" />
                      <span>
                        {isArabic ? 'تطبيق الهاتف المباشر' : 'Direct Mobile App'}
                      </span>
                    </span>
                    <h2 className="font-headline font-extrabold text-xl sm:text-2xl text-white leading-tight">
                      {isArabic
                        ? 'ثبّت تطبيق Flaster على هاتفك الآن!'
                        : 'Install Flaster on Your Phone Now!'}
                    </h2>
                    <p className="text-xs sm:text-sm text-red-100 font-bold">
                      {t.brandSubtitle}
                    </p>
                  </div>
                </div>

                {/* 3 Value Pills inside Hero */}
                <div className="relative z-10 grid grid-cols-3 gap-2 mt-5 pt-4 border-t border-white/20 text-[11px] font-bold text-white">
                  <div className="flex items-center gap-1.5 bg-black/20 rounded-xl px-2.5 py-2">
                    <Smartphone className="w-4 h-4 text-amber-300 shrink-0" />
                    <span>{isArabic ? 'شاشة كاملة' : 'Full-Screen'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-black/20 rounded-xl px-2.5 py-2">
                    <Zap className="w-4 h-4 text-amber-300 shrink-0" />
                    <span>{isArabic ? 'سريع وخفيف' : 'Fast & Light'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-black/20 rounded-xl px-2.5 py-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-300 shrink-0" />
                    <span>{isArabic ? 'بدون متجر' : 'Direct Install'}</span>
                  </div>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-5 sm:p-6 space-y-5">
                {/* Device Selector Tabs (Android vs iPhone/iOS) */}
                <div className="grid grid-cols-2 gap-2 p-1.5 rounded-2xl bg-[#FAF7F2] border border-[#EAE4DC]">
                  <button
                    type="button"
                    onClick={() => setActivePlatformTab('android')}
                    className={`py-2.5 px-3 rounded-xl font-headline font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      activePlatformTab === 'android'
                        ? 'bg-[#DC2626] text-white shadow-sm'
                        : 'text-[#57534E] hover:text-[#1C1917]'
                    }`}
                  >
                    <Download className="w-4 h-4" />
                    <span>{isArabic ? 'أندرويد / Chrome' : 'Android / Chrome'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePlatformTab('ios')}
                    className={`py-2.5 px-3 rounded-xl font-headline font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                      activePlatformTab === 'ios'
                        ? 'bg-[#DC2626] text-white shadow-sm'
                        : 'text-[#57534E] hover:text-[#1C1917]'
                    }`}
                  >
                    <Share className="w-4 h-4" />
                    <span>{isArabic ? 'آيفون / iPhone (iOS)' : 'iPhone / iPad (iOS)'}</span>
                  </button>
                </div>

                {/* TAB 1: ANDROID / CHROME (Clear Step-by-Step Guide — No Misleading Button) */}
                {activePlatformTab === 'android' && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] border border-[#EAE4DC] space-y-3.5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-headline font-extrabold text-sm text-[#1C1917]">
                        {isArabic
                          ? 'طريقة إضافة التطبيق على أندرويد (Chrome):'
                          : 'How to Add Flaster on Android (Chrome):'}
                      </h3>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-900 border border-emerald-300">
                        {isArabic ? '3 خطوات سهلة' : '3 Easy Steps'}
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      {/* Step 1 */}
                      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-[#EAE4DC]">
                        <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center shrink-0 font-extrabold">
                          <MoreVertical className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <span className="font-bold text-[#1C1917] block">
                            {isArabic
                              ? '1. اضغط على قائمة الثلاث نقاط (⋮)'
                              : '1. Tap the 3-dots menu (⋮)'}
                          </span>
                          <span className="text-[#78716C] text-[11px]">
                            {isArabic
                              ? 'الموجودة في أعلى الزاوية في متصفح جوجل كروم (Chrome).'
                              : 'Located at the top corner of your Google Chrome browser.'}
                          </span>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-[#EAE4DC]">
                        <div className="w-9 h-9 rounded-xl bg-red-50 text-[#DC2626] border border-red-200 flex items-center justify-center shrink-0 font-extrabold">
                          <PlusSquare className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <span className="font-bold text-[#1C1917] block">
                            {isArabic
                              ? '2. اختر «الإضافة إلى الشاشة الرئيسية» أو «تثبيت التطبيق»'
                              : '2. Select "Add to Home screen" or "Install app"'}
                          </span>
                          <span className="text-[#78716C] text-[11px]">
                            {isArabic
                              ? 'من القائمة التي ستظهر لك مباشرة.'
                              : 'Choose it from the dropdown menu.'}
                          </span>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-[#EAE4DC]">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#059669] border border-emerald-200 flex items-center justify-center shrink-0 font-extrabold">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <span className="font-bold text-[#1C1917] block">
                            {isArabic
                              ? '3. اضغط «تثبيت» أو «إضافة» (Install / Add)'
                              : '3. Tap "Install" or "Add"'}
                          </span>
                          <span className="text-[#78716C] text-[11px]">
                            {isArabic
                              ? 'سيظهر تطبيق Flaster بشعاره الرسمي على شاشة جوالك ويعمل مثل أي تطبيق!'
                              : 'Flaster will appear on your home screen and launch like a native app!'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: iOS / SAFARI (iPhone & iPad Visual Step-by-Step Guide) */}
                {activePlatformTab === 'ios' && (
                  <div className="p-4 sm:p-5 rounded-2xl bg-[#FAF7F2] border border-[#EAE4DC] space-y-3.5">
                    <div className="flex items-center justify-between">
                      <h3 className="font-headline font-extrabold text-sm text-[#1C1917]">
                        {isArabic
                          ? 'طريقة التثبيت على آيفون وآيباد (Safari):'
                          : 'How to Install on iPhone & iPad (Safari):'}
                      </h3>
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300">
                        {isArabic ? '3 خطوات سهلة' : '3 Easy Steps'}
                      </span>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      {/* Step 1 */}
                      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-[#EAE4DC]">
                        <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 border border-amber-300 flex items-center justify-center shrink-0 font-extrabold">
                          <Share className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <span className="font-bold text-[#1C1917] block">
                            {isArabic
                              ? '1. اضغط على أيقونة المشاركة (Share)'
                              : '1. Tap the Share button'}
                          </span>
                          <span className="text-[#78716C] text-[11px]">
                            {isArabic
                              ? 'الموجودة في الشريط السفلي لمتصفح سفاري (Safari).'
                              : 'Located at the bottom bar of your Safari browser.'}
                          </span>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-[#EAE4DC]">
                        <div className="w-9 h-9 rounded-xl bg-red-50 text-[#DC2626] border border-red-200 flex items-center justify-center shrink-0 font-extrabold">
                          <PlusSquare className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <span className="font-bold text-[#1C1917] block">
                            {isArabic
                              ? '2. اختر «إضافة إلى الشاشة الرئيسية»'
                              : '2. Select "Add to Home Screen"'}
                          </span>
                          <span className="text-[#78716C] text-[11px]">
                            {isArabic
                              ? 'مرّر القائمة للأعلى واضغط على (إضافة إلى الشاشة الرئيسية ⊞).'
                              : 'Scroll down the share sheet and tap "Add to Home Screen".'}
                          </span>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-[#EAE4DC]">
                        <div className="w-9 h-9 rounded-xl bg-emerald-50 text-[#059669] border border-emerald-200 flex items-center justify-center shrink-0 font-extrabold">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div className="flex-1">
                          <span className="font-bold text-[#1C1917] block">
                            {isArabic
                              ? '3. اضغط «إضافة» (Add) في الأعلى'
                              : '3. Tap "Add" in the top corner'}
                          </span>
                          <span className="text-[#78716C] text-[11px]">
                            {isArabic
                              ? 'سيظهر تطبيق Flaster بشعاره الرسمي على شاشة هاتفك ويعمل بملء الشاشة!'
                              : 'Flaster will appear on your home screen and launch in full screen!'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom Dismiss / Continue Button */}
                <div className="pt-1 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={dismissModal}
                    className="w-full py-3 px-4 rounded-xl bg-[#FAF7F2] hover:bg-stone-200/70 text-[#57534E] border border-[#EAE4DC] font-headline font-extrabold text-xs transition-colors cursor-pointer"
                  >
                    {isArabic ? 'تصفح المتجر الآن وتثبيته لاحقاً' : 'Maybe Later — Continue to Store'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {/* Trigger Button in Header: Compact on mobile so Header never overflows, Solid Emerald Green */}
      <button
        type="button"
        onClick={openModal}
        style={{ pointerEvents: 'auto', touchAction: 'manipulation' }}
        className="pwa-touch-btn flex items-center justify-center gap-1.5 w-9 h-9 sm:w-auto sm:px-3 rounded-full bg-[#059669] hover:bg-[#047857] text-white text-xs font-extrabold shadow-2xs transition-all active:scale-95 cursor-pointer shrink-0 select-none"
        title={t.installApp}
      >
        <Download className="w-4 h-4 text-white shrink-0 pointer-events-none" />
        <span className="hidden sm:inline pointer-events-none">{t.installApp}</span>
      </button>

      {modalNode}
    </>
  );
};
