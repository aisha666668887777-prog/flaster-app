import React, { useState, useEffect } from 'react';
import {
  Mail,
  User,
  Sparkles,
  X,
  ArrowRight,
  CheckCircle2,
  Gift,
  Clock,
  RefreshCw,
  Lock,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { doc, setDoc } from 'firebase/firestore';
import { Language, CustomerProfile } from '../types';
import { signInWithGoogle } from '../firebase/auth';
import { auth, db } from '../firebase/config';

interface CustomerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  onAuthSuccess: (profile: CustomerProfile, bonusAwarded: boolean) => void;
  initialProfile?: CustomerProfile | null;
}

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen,
  onClose,
  lang,
  onAuthSuccess,
  initialProfile,
}) => {
  const isArabic = lang === 'ar';

  const [step, setStep] = useState<'phone' | 'otp' | 'profile' | 'welcome'>('phone');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState(['', '', '', '', '', '']);
  const [generatedDemoOtp, setGeneratedDemoOtp] = useState('');
  const [sentViaMetaCloud, setSentViaMetaCloud] = useState(false);
  const [isOtpVerified, setIsOtpVerified] = useState(false);
  const [countdown, setCountdown] = useState(60);
  const [canResend, setCanResend] = useState(false);
  const [fullName, setFullName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [whatsappSent, setWhatsappSent] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState('');

  useEffect(() => {
    if (initialProfile) {
      setFullName(initialProfile.name);
      setEmailAddress(initialProfile.email);
      setPhoneNumber(initialProfile.phone.replace('+971', '').trim());
    }
  }, [initialProfile]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (step === 'otp' && countdown > 0) {
      timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    } else if (countdown === 0) {
      setCanResend(true);
    }
    return () => clearTimeout(timer);
  }, [step, countdown]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const formatE164Phone = (raw: string): string => {
    const digits = raw.replace(/\D/g, '').replace(/^0+/, '');
    return `+971${digits || '504116994'}`;
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const user = await signInWithGoogle();
      const profile: CustomerProfile = {
        id: user.uid,
        name: user.displayName || user.email?.split('@')[0] || (isArabic ? 'عميل فلاستر' : 'Flaster Customer'),
        phone: user.phone || '+971504116994',
        email: user.email || '',
        savedAddresses: initialProfile?.savedAddresses || [
          {
            id: 'addr-home-default',
            label: isArabic ? 'البيت' : 'Home',
            type: 'home',
            street: isArabic ? 'شارع الشيخ راشد' : 'Sheikh Rashid Street',
            buildingOrVilla: isArabic ? 'فيلا 14' : 'Villa 14',
            city: isArabic ? 'رأس الخيمة' : 'Ras Al Khaimah',
            isDefault: true,
          },
        ],
        loyaltyPoints: initialProfile?.loyaltyPoints || 0,
        welcomeBonusClaimed: false,
        completedOrdersCount: initialProfile?.completedOrdersCount || 0,
        joinedAt: initialProfile?.joinedAt || new Date().toISOString(),
      };

      onAuthSuccess(profile, false);
      setIsLoading(false);
      onClose();
    } catch (err: unknown) {
      setIsLoading(false);
      setErrorMsg(
        err instanceof Error ? err.message : isArabic ? 'فشل تسجيل الدخول عبر Google' : 'Google sign-in failed'
      );
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '').replace(/^0+/, '');
    if (cleanPhone.length < 7) {
      setErrorMsg(
        isArabic
          ? 'يرجى إدخال رقم هاتف إماراتي صحيح (مثال: 50 123 4567)'
          : 'Please enter a valid UAE phone number (e.g. 50 123 4567)'
      );
      return;
    }
    setErrorMsg(null);
    setIsLoading(true);
    setIsOtpVerified(false);

    const e164 = formatE164Phone(phoneNumber);

    try {
      const res = await fetch('/api/auth/send-whatsapp-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: e164 }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || (isArabic ? 'تعذر إرسال رمز التحقق' : 'Failed to send verification code'));
      }

      const isMetaLive = Boolean(data.sentViaMetaCloud);
      setSentViaMetaCloud(isMetaLive);

      if (!isMetaLive && typeof data.code === 'string' && data.code.length === 6) {
        setGeneratedDemoOtp(data.code);
        setOtpCode(data.code.split(''));
      } else {
        setGeneratedDemoOtp('');
        setOtpCode(['', '', '', '', '', '']);
      }

      setWhatsappSent(true);
      setWhatsappUrl(data.directWhatsAppUrl || `https://wa.me/971504116994`);
      setIsLoading(false);
      setStep('otp');
      setCountdown(60);
      setCanResend(false);
    } catch (err: unknown) {
      setIsLoading(false);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isArabic
            ? 'تعذر الاتصال بالخادم لإرسال رمز التحقق، يرجى المحاولة مرة أخرى.'
            : 'Unable to contact server to send verification code.'
      );
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const entered = otpCode.join('').trim();
    if (entered.length < 6) {
      setErrorMsg(
        isArabic
          ? 'يرجى إدخال رمز التحقق المكون من 6 أرقام والمستلم عبر واتساب'
          : 'Please enter the 6-digit WhatsApp verification code'
      );
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const e164 = formatE164Phone(phoneNumber);

    try {
      const res = await fetch('/api/auth/verify-whatsapp-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: e164, code: entered }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || (isArabic ? 'رمز التحقق غير صحيح، يرجى المحاولة مرة أخرى' : 'Invalid code'));
      }

      setIsOtpVerified(true);
      setIsLoading(false);
      if (initialProfile?.name) {
        await completeAuth(0);
      } else {
        setStep('profile');
      }
    } catch (err: unknown) {
      setIsLoading(false);
      setErrorMsg(
        err instanceof Error
          ? err.message
          : isArabic
            ? 'فشل التحقق من الرمز، يرجى التأكد من الرمز المستلم في واتساب'
            : 'WhatsApp verification failed, please check the code'
      );
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOtpVerified) {
      setErrorMsg(
        isArabic
          ? 'يجب التحقق من رقم الهاتف عبر رمز OTP أولاً'
          : 'Phone OTP verification is required first'
      );
      return;
    }

    if (!fullName.trim()) {
      setErrorMsg(isArabic ? 'يرجى كتابة الاسم الكريم' : 'Please enter your full name');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    const e164Phone = formatE164Phone(phoneNumber);
    let pointsAwardedNow = 0;

    // Register verified phone with server loyalty engine (0 points at signup; 500 unlocked after 1st completed order)
    try {
      const res = await fetch('/api/loyalty/register-bonus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: e164Phone,
          customerName: fullName.trim(),
        }),
      });
      const data = await res.json();
      if (data.success && typeof data.pointsAwarded === 'number') {
        pointsAwardedNow = data.pointsAwarded;
      }
    } catch (err) {
      console.warn('[Loyalty] Register bonus check deferred:', err instanceof Error ? err.message : err);
      pointsAwardedNow = 0;
    }

    setIsLoading(false);
    setStep('welcome');

    try {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.55 },
        colors: ['#F59E0B', '#DC2626', '#059669', '#FFD700'],
      });
    } catch {
      // ignore confetti error
    }

    setTimeout(() => {
      completeAuth(pointsAwardedNow, e164Phone);
    }, 2200);
  };

  const completeAuth = async (pointsAwardedNow: number, verifiedPhoneId?: string) => {
    const e164Phone = verifiedPhoneId || formatE164Phone(phoneNumber);
    const uid = auth.currentUser?.uid || e164Phone;
    const nowIso = new Date().toISOString();

    const profile: CustomerProfile = {
      id: uid,
      name: fullName.trim() || (isArabic ? 'عميل فلاستر' : 'Flaster Customer'),
      phone: e164Phone,
      email: emailAddress.trim() || '',
      savedAddresses: initialProfile?.savedAddresses || [
        {
          id: 'addr-home-default',
          label: isArabic ? 'البيت' : 'Home',
          type: 'home',
          street: isArabic ? 'شارع الشيخ راشد' : 'Sheikh Rashid Street',
          buildingOrVilla: isArabic ? 'فيلا 14' : 'Villa 14',
          city: isArabic ? 'رأس الخيمة' : 'Ras Al Khaimah',
          isDefault: true,
        },
      ],
      // Strictly 0 points at signup; 500 welcome points awarded after first completed order
      loyaltyPoints: (initialProfile?.loyaltyPoints || 0) + pointsAwardedNow,
      welcomeBonusClaimed: false,
      completedOrdersCount: initialProfile?.completedOrdersCount || 0,
      joinedAt: initialProfile?.joinedAt || nowIso,
    };

    if (auth.currentUser) {
      try {
        await setDoc(
          doc(db, 'users', auth.currentUser.uid),
          {
            uid: auth.currentUser.uid,
            name: profile.name.slice(0, 120),
            phone: profile.phone.slice(0, 32),
            email: profile.email.slice(0, 200),
            loyaltyPoints: profile.loyaltyPoints,
            welcomeBonusClaimed: false,
            completedOrdersCount: profile.completedOrdersCount || 0,
            savedAddresses: profile.savedAddresses.slice(0, 10),
            createdAt: profile.joinedAt,
            updatedAt: nowIso,
          },
          { merge: true }
        );
      } catch {
        // Handled gracefully if rules require additional token claims
      }
    }

    onAuthSuccess(profile, pointsAwardedNow > 0);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-elevation-4 border border-[#EAE4DC] overflow-hidden animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Invisible reCAPTCHA container for Firebase Phone Auth */}
        <div id="flaster-recaptcha-container" />

        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-[#7F1D1D] via-[#991B1B] to-[#B45309] p-6 text-white text-center relative overflow-hidden">
          <div className="absolute -top-12 -end-12 w-36 h-36 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />

          <button
            onClick={onClose}
            className="absolute top-4 end-4 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center mb-3 shadow-lg">
            <Gift className="w-7 h-7 text-amber-300 animate-bounce" />
          </div>

          <h3 className="font-headline font-extrabold text-xl text-white">
            {step === 'welcome'
              ? isArabic
                ? 'مبروك! تم توثيق حسابك في فلاستر'
                : 'Welcome to Flaster!'
              : isArabic
                ? 'تسجيل الدخول عبر رمز التحقق OTP'
                : 'Phone OTP Sign In & Rewards'}
          </h3>

          <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/25 border border-amber-300/50 text-[11px] font-bold text-amber-200">
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>
              {isArabic
                ? 'مكافأة 500 نقطة (5 دراهم) تُضاف بعد أول طلب مكتمل!'
                : '500 Welcome Points (AED 5) unlocked after your 1st completed order!'}
            </span>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-semibold animate-in fade-in">
              {errorMsg}
            </div>
          )}

          {/* STEP 1: Phone Number & Google Sign-In */}
          {step === 'phone' && (
            <div className="space-y-4 text-xs">
              {/* Google 1-Click Fast Sign-In */}
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full py-3 px-4 rounded-xl border-2 border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-headline font-bold text-xs flex items-center justify-center gap-2.5 shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{isArabic ? 'الدخول السريع بنقرة واحدة عبر Google ⚡' : 'One-Click Instant Login with Google'}</span>
              </button>

              <div className="flex items-center gap-3 my-1">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-[11px] text-slate-400 font-bold">{isArabic ? 'أو برقم الهاتف والواتساب' : 'OR with Phone & WhatsApp'}</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>

              <form onSubmit={handleSendOtp} className="space-y-3">
                <div>
                  <label className="block font-bold text-[#0F172A] mb-1.5 text-xs">
                    {isArabic ? 'رقم الهاتف المتحرك (دولة الإمارات):' : 'UAE Mobile Number:'}
                  </label>
                  <div className="flex items-center border border-[#CBD5E1] rounded-xl overflow-hidden focus-within:border-[#16A34A] bg-[#FAF8F5] transition-all">
                    <div className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 border-e border-[#CBD5E1] text-[#0F172A] font-metric font-bold text-xs select-none">
                      <span>🇦🇪</span>
                      <span>+971</span>
                    </div>
                    <input
                      type="tel"
                      required
                      autoFocus
                      placeholder="50 123 4567"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      className="flex-1 px-3 py-2.5 bg-transparent text-sm font-metric text-[#0F172A] focus:outline-none placeholder:text-slate-400"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-[#16A34A] to-[#15803D] hover:from-[#15803D] hover:to-[#166534] text-white font-headline font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
                  >
                    {isLoading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <span>💬</span>
                        <span>{isArabic ? 'إرسال رمز التحقق عبر واتساب' : 'Send WhatsApp Verification Code'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 2: OTP Verification */}
          {step === 'otp' && (
            <form onSubmit={handleVerifyOtp} className="space-y-4 text-xs text-center">
              <div>
                <span className="text-xs text-[#64748B] block">
                  {isArabic ? 'تم إرسال رمز التحقق الرسمي عبر واتساب إلى الرقم:' : 'Official verification code sent via WhatsApp to:'}
                </span>
                <strong className="font-metric text-sm text-[#0F172A] block mt-0.5" dir="ltr">
                  {formatE164Phone(phoneNumber)}
                </strong>
              </div>

              {/* 6-Digit OTP Input */}
              <div className="flex justify-center gap-2 my-2" dir="ltr">
                {otpCode.map((digit, idx) => (
                  <input
                    key={idx}
                    type="text"
                    maxLength={1}
                    value={digit}
                    onChange={(e) => {
                      const val = e.target.value.slice(-1);
                      const updated = [...otpCode];
                      updated[idx] = val;
                      setOtpCode(updated);
                    }}
                    className="w-10 h-12 text-center font-metric text-lg font-bold bg-[#FAF8F5] border-2 border-emerald-400 rounded-xl focus:border-[#16A34A] focus:outline-none text-[#0F172A] shadow-inner"
                  />
                ))}
              </div>

              {/* Direct WhatsApp Open Link & Preview Helper (hidden when live Meta WhatsApp API sent the code) */}
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 text-xs flex flex-col sm:flex-row items-center justify-between gap-2 text-start">
                <div>
                  <span className="font-bold block text-emerald-900">
                    {sentViaMetaCloud
                      ? isArabic
                        ? 'تم إرسال الرمز إلى تطبيق واتساب الخاص بك'
                        : 'Code sent to your WhatsApp'
                      : isArabic
                        ? 'وضع المعاينة التجريبي (واتساب غير مربوط بمفتاح حي):'
                        : 'Preview Mode (Meta Cloud API unconfigured):'}
                  </span>
                  {!sentViaMetaCloud && generatedDemoOtp && (
                    <span className="text-[11px] text-emerald-800">
                      {isArabic
                        ? `رمز المعاينة هو: ${generatedDemoOtp}`
                        : `Preview code: ${generatedDemoOtp}`}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {whatsappUrl && (
                    <a
                      href={whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-[#16A34A] hover:bg-[#15803D] text-white text-[11px] font-bold flex items-center gap-1 shadow-sm"
                    >
                      <span>💬</span>
                      <span>{isArabic ? 'فتح واتساب' : 'Open WhatsApp'}</span>
                    </a>
                  )}
                  {!sentViaMetaCloud && generatedDemoOtp && (
                    <button
                      type="button"
                      onClick={() => setOtpCode(generatedDemoOtp.split(''))}
                      className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold"
                    >
                      {isArabic ? 'تعبئة الرمز' : 'Auto Fill'}
                    </button>
                  )}
                </div>
              </div>

              {/* Resend Timer */}
              <div className="text-[11px] text-[#64748B] flex items-center justify-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {canResend ? (
                  <button
                    type="button"
                    onClick={async () => {
                      setCountdown(60);
                      setCanResend(false);
                      const e164 = formatE164Phone(phoneNumber);
                      try {
                        const res = await fetch('/api/auth/send-whatsapp-otp', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ phone: e164 }),
                        });
                        const data = await res.json();
                        setSentViaMetaCloud(Boolean(data.sentViaMetaCloud));
                        if (!data.sentViaMetaCloud && data.code) {
                          setGeneratedDemoOtp(data.code);
                        } else {
                          setGeneratedDemoOtp('');
                        }
                      } catch {
                        setErrorMsg(isArabic ? 'تعذر إعادة إرسال الرمز' : 'Failed to resend code');
                      }
                    }}
                    className="text-[#16A34A] font-bold hover:underline cursor-pointer"
                  >
                    {isArabic ? 'إعادة إرسال الرمز عبر واتساب الآن' : 'Resend WhatsApp Code Now'}
                  </button>
                ) : (
                  <span>
                    {isArabic
                      ? `إعادة الإرسال بعد ${countdown} ثانية`
                      : `Resend in ${countdown}s`}
                  </span>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="flex-1 py-2.5 rounded-xl border border-[#CBD5E1] text-[#64748B] font-bold text-xs hover:bg-slate-50"
                >
                  {isArabic ? 'تغيير الرقم' : 'Back'}
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#16A34A] to-[#15803D] hover:from-[#15803D] hover:to-[#166534] text-white font-headline font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95 cursor-pointer"
                >
                  {isLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : isArabic ? (
                    'تأكيد ودخول فوري 🚀'
                  ) : (
                    'Confirm & Enter Now 🚀'
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Complete Name & Email Profile */}
          {step === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950 space-y-1">
                <span className="font-bold flex items-center gap-1.5 text-xs text-emerald-900">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {isArabic ? 'تم توثيق رقم هاتفك بنجاح!' : 'Phone verified via OTP!'}
                </span>
                <p className="text-[11px] text-emerald-800">
                  {isArabic
                    ? 'أكمل ملفك الشخصي. ستحصل تلقائياً على 500 نقطة ترحيبية (5 دراهم) فور إتمام استلام طلبك الأول!'
                    : 'Complete your profile. You will automatically receive 500 welcome points (5 AED) right after completing your first order!'}
                </p>
              </div>

              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">
                  {isArabic ? 'الاسم الكريم:' : 'Full Name:'}
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    maxLength={120}
                    placeholder={
                      isArabic ? 'مثال: سارة النعيمي أو خالد الظاهري' : 'e.g. Sara Al Nuaimi'
                    }
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full h-11 ps-9 pe-3 bg-[#FAF7F2] border border-[#EAE4DC] rounded-xl text-xs text-[#1C1917] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                  />
                  <User className="w-4 h-4 text-stone-400 absolute start-3 top-3.5" />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-[#1C1917] mb-1">
                  {isArabic
                    ? 'البريد الإلكتروني (لإرسال الإيصالات):'
                    : 'Email Address (for receipts):'}
                </label>
                <div className="relative">
                  <input
                    type="email"
                    maxLength={200}
                    placeholder="name@example.com"
                    value={emailAddress}
                    onChange={(e) => setEmailAddress(e.target.value)}
                    className="w-full h-11 ps-9 pe-3 bg-[#FAF7F2] border border-[#EAE4DC] rounded-xl text-xs text-[#1C1917] focus:outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
                  />
                  <Mail className="w-4 h-4 text-stone-400 absolute start-3 top-3.5" />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-600 hover:from-amber-600 hover:via-orange-600 hover:to-rose-700 text-white font-headline font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20 active:scale-95 transition-all cursor-pointer"
              >
                {isLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Gift className="w-4 h-4 text-amber-200" />
                    <span>
                      {isArabic ? 'حفظ الملف وتفعيل العضوية' : 'Save Profile & Activate Account'}
                    </span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 4: Welcome Confirmation */}
          {step === 'welcome' && (
            <div className="py-4 text-center space-y-3 animate-in zoom-in-95">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                <CheckCircle2 className="w-10 h-10 animate-bounce" />
              </div>
              <h4 className="font-headline font-black text-xl text-[#0F172A]">
                {isArabic ? `أهلاً بك، ${fullName}!` : `Welcome, ${fullName}!`}
              </h4>
              <div className="p-4 bg-gradient-to-r from-amber-50 to-amber-100 rounded-2xl border border-amber-300 text-amber-950 font-metric space-y-1">
                <span className="text-lg font-black text-amber-700 block">
                  {isArabic ? '🎁 هدية 500 نقطة جاهزة للتفعيل' : '🎁 500 Welcome Points Ready'}
                </span>
                <span className="text-[11px] text-amber-800 block">
                  {isArabic
                    ? 'ستُضاف 500 نقطة ترحيبية (بقيمة 5 دراهم) تلقائياً إلى محفظتك فور إتمام استلام طلبك الأول!'
                    : '500 welcome points (worth AED 5.00) will be credited automatically right after your first completed order!'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Footer Guarantee */}
        <div className="px-6 py-3 bg-[#FAF8F5] border-t border-[#EAE4DC] flex items-center justify-between text-[11px] text-[#64748B]">
          <span className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            {isArabic ? 'بياناتك مشفرة ومحمية 100%' : 'Encrypted & Secure'}
          </span>
          <span className="font-semibold text-amber-800">Flaster UAE</span>
        </div>
      </div>
    </div>
  );
};
