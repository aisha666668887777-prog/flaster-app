import React, { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Language } from '../types';
import {
  applyPwaUpdateNow,
  PwaUpdateState,
  subscribePwaUpdate,
} from '../pwa/registerPwaUpdates';

interface PWAUpdateBannerProps {
  lang: Language;
}

export const PWAUpdateBanner: React.FC<PWAUpdateBannerProps> = ({ lang }) => {
  const [pwaState, setPwaState] = useState<PwaUpdateState>({
    updateAvailable: false,
    isUpdating: false,
  });
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    return subscribePwaUpdate((nextState) => {
      setPwaState(nextState);
      if (nextState.updateAvailable) {
        setDismissed(false);
      }
    });
  }, []);

  if (!pwaState.updateAvailable || dismissed) {
    return null;
  }

  const isAr = lang === 'ar';

  return (
    <div
      role="status"
      aria-live="polite"
      dir={isAr ? 'rtl' : 'ltr'}
      className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:end-4 z-[9999] max-w-md mx-auto sm:mx-0"
    >
      <div className="bg-[#1C1917] text-white rounded-2xl shadow-2xl border border-[#F4C430]/30 px-4 py-3.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-[#9E1B28] flex items-center justify-center shrink-0">
            <RefreshCw
              className={`w-4 h-4 text-[#F4C430] ${pwaState.isUpdating ? 'animate-spin' : ''}`}
            />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold leading-tight">
              {isAr ? 'يتوفر تحديث جديد لتطبيق فلاستر' : 'New Flaster update available'}
            </p>
            <p className="text-xs text-stone-300 mt-0.5 leading-snug">
              {isAr
                ? 'اضغط تحديث للحصول على أحدث التحسينات فوراً.'
                : 'Tap Update to load the latest version now.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            disabled={pwaState.isUpdating}
            onClick={() => void applyPwaUpdateNow()}
            className="px-3.5 py-2 rounded-xl bg-[#F4C430] hover:bg-[#E5B520] disabled:opacity-60 text-[#2D2200] text-xs font-extrabold transition-colors cursor-pointer whitespace-nowrap"
          >
            {pwaState.isUpdating
              ? isAr
                ? 'جارٍ التحديث...'
                : 'Updating...'
              : isAr
              ? 'تحديث الآن'
              : 'Update Now'}
          </button>
          <button
            type="button"
            aria-label={isAr ? 'إغلاق' : 'Dismiss'}
            onClick={() => setDismissed(true)}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
