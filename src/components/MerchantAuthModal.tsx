import React, { useState, useEffect } from 'react';
import { Lock, ShieldAlert, X, AlertTriangle, Clock, UserCheck, KeyRound } from 'lucide-react';
import { Language, MerchantAccountPublicInfo } from '../types';
import { setPortalSessionToken } from '../firebase/authHeaders';

interface MerchantAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onSuccess: (merchant?: MerchantAccountPublicInfo) => void;
}

export const MerchantAuthModal: React.FC<MerchantAuthModalProps> = ({
  isOpen,
  onClose,
  lang,
  onSuccess,
}) => {
  const [username, setUsername] = useState('');
  const [secretCode, setSecretCode] = useState('');
  const [error, setError] = useState(false);
  const [serverErrorMsg, setServerErrorMsg] = useState<string | null>(null);
  const [lockoutTimer, setLockoutTimer] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);

  const isArabic = lang === 'ar';

  // Per-merchant lockout countdown timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (lockoutTimer > 0) {
      timer = setInterval(() => {
        setLockoutTimer((prev) => (prev <= 1 ? 0 : prev - 1));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [lockoutTimer]);

  if (!isOpen) return null;

  const isLockedOut = lockoutTimer > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLockedOut || isVerifying) return;

    const cleanUsername = username.trim().toLowerCase();
    const cleanSecret = secretCode.trim();
    if (!cleanUsername || !cleanSecret) {
      setError(true);
      setServerErrorMsg(
        isArabic
          ? 'يرجى إدخال اسم المستخدم والرمز السري للمطعم.'
          : 'Please enter both restaurant username and secret code.'
      );
      return;
    }

    setIsVerifying(true);
    setError(false);
    setServerErrorMsg(null);

    try {
      const res = await fetch('/api/auth/merchant-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUsername,
          secretCode: cleanSecret,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        locked?: boolean;
        retryAfterSeconds?: number;
        portalToken?: string;
        merchant?: MerchantAccountPublicInfo;
        error?: string;
      };

      if (res.ok && data.success && data.portalToken) {
        setPortalSessionToken(data.portalToken);
        setUsername('');
        setSecretCode('');
        setError(false);
        setServerErrorMsg(null);
        setLockoutTimer(0);
        onSuccess(data.merchant);
      } else {
        setError(true);
        setSecretCode('');
        setServerErrorMsg(
          data.error ||
            (isArabic
              ? 'بيانات الدخول غير صحيحة. يرجى التأكد من اسم المستخدم والرمز السري.'
              : 'Invalid login credentials. Please check your username and secret code.')
        );
        if (res.status === 429 && typeof data.retryAfterSeconds === 'number' && data.retryAfterSeconds > 0) {
          setLockoutTimer(data.retryAfterSeconds);
        }
      }
    } catch {
      setError(true);
      setServerErrorMsg(
        isArabic
          ? 'تعذر الاتصال بالخادم للتحقق من بيانات الدخول.'
          : 'Unable to contact server for verification.'
      );
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/75 backdrop-blur-md animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm bg-[#FFFDF9] rounded-2xl shadow-2xl border border-[#EAE4DC] p-6 space-y-5 animate-in zoom-in-95 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 end-4 w-8 h-8 rounded-full bg-[#FAF7F2] border border-[#EAE4DC] flex items-center justify-center text-[#78716C] hover:text-[#1C1917] cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Security Shield Icon */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#DC2626] to-[#991B1B] text-white mx-auto flex items-center justify-center shadow-md border border-amber-300/40">
          {isLockedOut ? (
            <ShieldAlert className="w-7 h-7 text-amber-300 animate-pulse" />
          ) : (
            <Lock className="w-7 h-7 text-amber-300" />
          )}
        </div>

        {/* Headline */}
        <div>
          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold uppercase tracking-wider">
            {isArabic ? 'حساب مستقل لكل مطعم 🔒' : 'Isolated Restaurant Account 🔒'}
          </span>
          <h3 className="font-headline font-extrabold text-lg text-[#1C1917] mt-1.5">
            {isArabic ? 'دخول بوابة المطعم الشريك' : 'Partner Restaurant Login'}
          </h3>
          <p className="text-xs text-[#78716C] mt-1 leading-relaxed">
            {isArabic
              ? 'أدخل اسم المستخدم والرمز السري المكون من 8 أرقام الخاص بمطعمك فقط.'
              : 'Enter your dedicated restaurant username and 8-digit secret code.'}
          </p>
        </div>

        {/* Per-Merchant Lockout Banner (5 failed attempts = 15 minutes) */}
        {isLockedOut && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-300 text-red-950 space-y-2 text-xs">
            <div className="flex items-center justify-center gap-1.5 font-bold text-red-700">
              <AlertTriangle className="w-4 h-4" />
              <span>{isArabic ? 'تم حظر دخول هذا المطعم مؤقتاً!' : 'Restaurant Login Temporarily Locked'}</span>
            </div>
            <p className="text-[11px] text-red-800">
              {serverErrorMsg ||
                (isArabic
                  ? 'تم استنفاد 5 محاولات خاطئة متتالية لهذا الحساب. الحظر يسري لمدة 15 دقيقة على هذا المطعم فقط.'
                  : '5 failed login attempts reached. This restaurant account is locked for 15 minutes.')}
            </p>
            <div className="flex items-center justify-center gap-1.5 font-metric font-extrabold text-sm text-red-700 pt-1">
              <Clock className="w-4 h-4" />
              <span>
                {Math.floor(lockoutTimer / 60)}:{String(lockoutTimer % 60).padStart(2, '0')}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                setLockoutTimer(0);
                setServerErrorMsg(null);
              }}
              className="text-[11px] text-stone-600 hover:text-stone-900 underline pt-1 cursor-pointer"
            >
              {isArabic ? 'التبديل إلى حساب مطعم آخر' : 'Switch to another restaurant account'}
            </button>
          </div>
        )}

        {/* Username + 8-Digit Secret Code Form */}
        {!isLockedOut && (
          <form onSubmit={handleSubmit} className="space-y-3.5 text-start">
            <div>
              <label className="block text-xs font-bold text-[#1C1917] mb-1">
                {isArabic ? 'اسم المستخدم الخاص بالمطعم' : 'Restaurant Username'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  autoComplete="username"
                  dir="ltr"
                  placeholder={isArabic ? 'مثال: alsharisha-heritage' : 'e.g. alsharisha-heritage'}
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError(false);
                  }}
                  className="w-full h-11 ps-9 pe-3 bg-white border border-[#EAE4DC] rounded-xl text-xs font-metric text-[#1C1917] focus:outline-none focus:border-[#DC2626]"
                />
                <UserCheck className="w-4 h-4 text-[#78716C] absolute start-3 top-3.5" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1C1917] mb-1">
                {isArabic ? 'الرمز السري للمطعم (8 أرقام)' : 'Secret Access Code (8 digits)'}
              </label>
              <div className="relative">
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  dir="ltr"
                  maxLength={16}
                  placeholder="••••••••"
                  value={secretCode}
                  onChange={(e) => {
                    setSecretCode(e.target.value);
                    setError(false);
                  }}
                  className="w-full h-11 ps-9 pe-3 bg-white border border-[#EAE4DC] rounded-xl text-sm font-metric tracking-widest text-[#1C1917] focus:outline-none focus:border-[#DC2626]"
                />
                <KeyRound className="w-4 h-4 text-[#78716C] absolute start-3 top-3.5" />
              </div>
            </div>

            {(error || serverErrorMsg) && (
              <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-[#DC2626] font-bold text-center">
                {serverErrorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={isVerifying}
              className="w-full h-11 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-50 text-white font-bold text-xs cursor-pointer shadow-md shadow-red-600/20 transition-all"
            >
              {isVerifying
                ? isArabic
                  ? 'جاري التحقق على الخادم...'
                  : 'Verifying on server...'
                : isArabic
                  ? 'تسجيل الدخول لبوابة المطعم'
                  : 'Sign In to Restaurant Portal'}
            </button>
          </form>
        )}

        {/* Security Notice */}
        <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200 text-[11px] text-emerald-900 font-semibold text-center">
          <span>
            {isArabic
              ? '🛡️ كل مطعم معزول تماماً بتوكن موقّع (HMAC-SHA256) ولا يمكنه رؤية طلبات أي مطعم آخر'
              : '🛡️ Strictly isolated per-merchant HMAC-SHA256 session'}
          </span>
        </div>
      </div>
    </div>
  );
};
