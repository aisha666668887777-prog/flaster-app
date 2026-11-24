import React, { useState, useEffect } from 'react';
import {
  Headphones,
  MessageSquare,
  Phone,
  Clock,
  X,
  Send,
  CheckCircle2,
  Globe,
  Instagram,
} from 'lucide-react';
import { Language } from '../types';
import { DEFAULT_PLATFORM_SETTINGS, PlatformSettings } from '../config/platformConfig';

interface CustomerSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  supportPhoneE164?: string;
  platformSettings?: PlatformSettings;
}

export const CustomerSupportModal: React.FC<CustomerSupportModalProps> = ({
  isOpen,
  onClose,
  lang,
  supportPhoneE164,
  platformSettings,
}) => {
  const isArabic = lang === 'ar';

  const [message, setMessage] = useState('');
  const [ticketSubject, setTicketSubject] = useState('استفسار حول طلب');
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const phoneNoSpaces = (
    supportPhoneE164 || DEFAULT_PLATFORM_SETTINGS.supportPhoneE164
  ).replace(/\s+/g, '');
  const whatsappDigits = phoneNoSpaces.replace(/[^0-9]/g, '');

  const handleSendInApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmittedSuccess(true);
    setTimeout(() => {
      setSubmittedSuccess(false);
      setMessage('');
      onClose();
    }, 2500);
  };

  const whatsappUrl = `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
    isArabic
      ? 'مرحباً خدمة عملاء فلاستر Flaster، أود الاستفسار بخصوص طلبي في التطبيق.'
      : 'Hello Flaster Customer Support, I would like assistance regarding my order.'
  )}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-elevation-4 border border-[#EAE4DC] overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#FAF8F5] p-5 border-b border-[#EAE4DC] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shadow-sm">
              <Headphones className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-base text-[#0F172A]">
                {isArabic ? 'خدمة العملاء والدعم الفني المباشر' : 'Customer Support & Care'}
              </h3>
              <p className="text-xs text-[#64748B]">
                {isArabic
                  ? 'فريق خدمة عملاء فلاستر Flaster في خدمتك يومياً'
                  : 'Flaster support team is here to assist you daily'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800"
            title={isArabic ? 'إغلاق' : 'Close'}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {/* Quick Contact Buttons & Social Links */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* WhatsApp Direct */}
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100/90 text-emerald-950 flex items-center gap-3 shadow-sm transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div className="text-start">
                <strong className="block text-xs font-bold text-emerald-950 group-hover:underline">
                  {isArabic ? 'محادثة واتساب فورية' : 'Live WhatsApp Chat'}
                </strong>
                <span className="text-[11px] text-emerald-800 block">
                  {isArabic ? 'رد سريع خلال دقائق' : 'Replies in minutes'}
                </span>
              </div>
            </a>

            {/* Direct Phone Call */}
            <a
              href={`tel:${phoneNoSpaces}`}
              className="p-4 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100/90 text-amber-950 flex items-center gap-3 shadow-sm transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0 shadow">
                <Phone className="w-5 h-5" />
              </div>
              <div className="text-start">
                <strong className="block text-xs font-bold text-amber-950 group-hover:underline">
                  {isArabic ? 'اتصال هاتفي مباشر' : 'Direct Call'}
                </strong>
                <span className="text-[11px] text-amber-800 font-metric block" dir="ltr">
                  {phoneNoSpaces}
                </span>
              </div>
            </a>

            {/* Official Website */}
            <a
              href="https://flaster.ae"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100/90 text-blue-950 flex items-center gap-3 shadow-sm transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow">
                <Globe className="w-5 h-5" />
              </div>
              <div className="text-start">
                <strong className="block text-xs font-bold text-blue-950 group-hover:underline">
                  {isArabic ? 'الموقع الرسمي للشركة' : 'Official Website'}
                </strong>
                <span className="text-[11px] text-blue-800 font-metric block" dir="ltr">
                  flaster.ae
                </span>
              </div>
            </a>

            {/* Instagram / Social Media */}
            <a
              href="https://instagram.com/flaster.ae"
              target="_blank"
              rel="noopener noreferrer"
              className="p-4 rounded-xl border border-rose-300 bg-rose-50 hover:bg-rose-100/90 text-rose-950 flex items-center gap-3 shadow-sm transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-amber-500 via-rose-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow">
                <Instagram className="w-5 h-5" />
              </div>
              <div className="text-start">
                <strong className="block text-xs font-bold text-rose-950 group-hover:underline">
                  {isArabic ? 'صفحة إنستغرام السوشيال' : 'Instagram Social'}
                </strong>
                <span className="text-[11px] text-rose-800 font-metric block" dir="ltr">
                  @flaster.ae
                </span>
              </div>
            </a>
          </div>

          {/* Working hours badge */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-[11px] text-[#475569]">
            <span className="flex items-center gap-1.5 font-semibold">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              {isArabic ? 'ساعات العمل الرسمية للدعم:' : 'Support Working Hours:'}
            </span>
            <span className="font-bold text-[#0F172A]">
              {isArabic
                ? 'يومياً 10:00 ص – 11:30 م (بتوقيت الإمارات)'
                : 'Daily 10:00 AM – 11:30 PM GST'}
            </span>
          </div>

          {/* In-App Direct Message Form */}
          <form onSubmit={handleSendInApp} className="space-y-3 pt-2 border-t border-slate-100">
            <span className="font-headline font-bold text-xs text-[#0F172A] block">
              {isArabic
                ? 'أو أرسل رسالة مباشرة لفريق الدعم:'
                : 'Or Send In-App Support Message:'}
            </span>

            <div>
              <label className="block text-[11px] font-semibold text-[#0F172A] mb-1">
                {isArabic ? 'موضوع الاستفسار:' : 'Subject:'}
              </label>
              <select
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
                className="w-full h-10 px-3 bg-[#FAF8F5] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none"
              >
                <option value="استفسار حول طلب">
                  {isArabic ? 'استفسار حول طلب حالي أو سابق' : 'Order inquiry'}
                </option>
                <option value="مشكلة في الاستلام">
                  {isArabic ? 'مشكلة في كود الاستلام أو المحل' : 'Pickup code issue'}
                </option>
                <option value="استفسار عن رصيد نقاط الولاء">
                  {isArabic ? 'استفسار عن رصيد نقاط المكافآت' : 'Loyalty points inquiry'}
                </option>
                <option value="تسجيل متجر جديد">
                  {isArabic ? 'انضمام مطعم أو متجر جديد للمنصة' : 'Partner merchant registration'}
                </option>
                <option value="اقتراح أو ملاحظة">
                  {isArabic ? 'اقتراح أو ملاحظة' : 'Feedback / Suggestion'}
                </option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#0F172A] mb-1">
                {isArabic ? 'نص الرسالة أو الاستفسار:' : 'Message details:'}
              </label>
              <textarea
                rows={3}
                required
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={
                  isArabic
                    ? 'اكتب تفاصيل استفسارك أو رقم الطلب هنا وسنرد عليك فوراً...'
                    : 'Write your details or order number here...'
                }
                className="w-full p-3 bg-[#FAF8F5] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none resize-none"
              />
            </div>

            {submittedSuccess ? (
              <div className="p-3 bg-emerald-100 text-emerald-900 rounded-xl font-bold text-center flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <span>
                  {isArabic
                    ? '✓ تم إرسال رسالتك لفريق الدعم وسيتواصلون معك فوراً!'
                    : '✓ Message sent! We will reach out shortly.'}
                </span>
              </div>
            ) : (
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#DC2626] to-[#B91C1C] text-white font-headline font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-red-500/20 active:scale-95"
              >
                <Send className="w-3.5 h-3.5 rtl:rotate-180" />
                <span>{isArabic ? 'إرسال الرسالة لخدمة العملاء' : 'Submit Message'}</span>
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};
