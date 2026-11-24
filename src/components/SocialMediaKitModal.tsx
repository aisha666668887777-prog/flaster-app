import React, { useState } from 'react';
import {
  X,
  Download,
  Share2,
  Copy,
  Check,
  Smartphone,
  Sparkles,
  Instagram,
  MessageCircle,
} from 'lucide-react';
import { Language } from '../types';
import socialPostImg from '../assets/images/flaster_social_post_1794327885263.jpg';
import storyPosterImg from '../assets/images/flaster_story_poster_1794327885702.jpg';
import brandLogoImg from '../assets/images/flaster_brand_logo_1794321576013.jpg';

interface SocialMediaKitModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const SocialMediaKitModal: React.FC<SocialMediaKitModalProps> = ({
  isOpen,
  onClose,
  lang,
}) => {
  const isArabic = lang === 'ar';
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const shareUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://flaster.ae';

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareUrl).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 3000);
  };

  const whatsappShareText = isArabic
    ? `جربوا تطبيقنا الجديد Flaster (فلاستر) لإنقاذ الطعام وتوفير الفائض في الإمارات بخصومات تصل إلى 50%! 🥐✨\nافتحوا الرابط وثبتوه على الشاشة الرئيسية:\n${shareUrl}`
    : `Check out our new Flaster food-rescue app in the UAE with up to 50% off fresh surplus meals! 🥐✨\nOpen and add to your home screen:\n${shareUrl}`;

  const whatsappShareHref = `https://wa.me/?text=${encodeURIComponent(whatsappShareText)}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-200"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <div className="bg-[#FAF8F5] border-2 border-[#F59E0B]/40 rounded-3xl max-w-4xl w-full max-h-[92vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-gradient-to-r from-[#DC2626] via-[#EA580C] to-[#F59E0B] text-white px-5 py-4 flex items-center justify-between rounded-t-3xl shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Instagram className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-extrabold">
                {isArabic
                  ? 'صور السوشيال ميديا ومشاركة التطبيق (Flaster Kit)'
                  : 'Flaster Social Media Images & App Share Kit'}
              </h2>
              <p className="text-xs text-white/90">
                {isArabic
                  ? 'حمّلي صور السوشيال ميديا الجاهزة أو شاركي رابط التطبيق مع إخوانك بضغطة زر'
                  : 'Download official social media graphics or share the app link on WhatsApp'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-white/15 hover:bg-white/25 text-white transition-colors"
            title={isArabic ? 'إغلاق' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {/* 1. Share App Link with Brothers / Family */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 border border-emerald-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold text-[#15803D] bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>
                    {isArabic
                      ? 'لتجربة التطبيق على جوالات إخوانك والعائلة'
                      : 'Test the App on Family Phones'}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-extrabold text-slate-900">
                  {isArabic
                    ? 'انسخي الرابط أو أرسليه مباشرة عبر واتساب'
                    : 'Copy the App Link or Send Directly via WhatsApp'}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {isArabic
                    ? 'عندما يفتحون الرابط في Safari (للآيفون) أو Chrome (للأندرويد)، يضغطون "إضافة إلى الشاشة الرئيسية / Add to Home Screen" ليظهر تطبيق Flaster على جوالاتهم فوراً!'
                    : 'Open the link in Safari (iPhone) or Chrome (Android) and tap "Add to Home Screen" to install Flaster!'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  onClick={handleCopyLink}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-slate-900 hover:bg-slate-800 text-white transition-all shadow-sm cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>{isArabic ? 'تم نسخ الرابط!' : 'Link Copied!'}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>{isArabic ? 'نسخ رابط التطبيق' : 'Copy App Link'}</span>
                    </>
                  )}
                </button>

                <a
                  href={whatsappShareHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[#16A34A] hover:bg-[#15803D] text-white transition-all shadow-sm"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>{isArabic ? 'إرسال لإخواني واتساب' : 'Send via WhatsApp'}</span>
                </a>
              </div>
            </div>
          </div>

          {/* 2. Generated Social Media Images Grid */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-[#DC2626]" />
              <h3 className="text-base font-extrabold text-slate-900">
                {isArabic
                  ? 'تصاميم السوشيال ميديا الرسمية لتطبيق Flaster (جاهزة للتحميل)'
                  : 'Official Flaster Social Media Designs (Ready to Download)'}
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: 1:1 Instagram Post */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-between">
                <div>
                  <div className="aspect-square bg-[#FAF8F5] overflow-hidden border-b border-slate-100">
                    <img
                      src={socialPostImg}
                      alt="Flaster 1:1 Social Media Post"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <span className="inline-block text-[11px] font-bold text-[#DC2626] bg-red-50 px-2 py-0.5 rounded mb-1">
                      {isArabic ? 'مقاس مربع 1:1 (بوست / بروفايل)' : '1:1 Square Post'}
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      {isArabic
                        ? 'بوست السوشيال ميديا الرسمي (إنستغرام / إكس)'
                        : 'Official Instagram & Social Launch Post'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {isArabic
                        ? 'شعار Flaster النظيف بدون علامات الجوال مع أصناف الطعام وهوية التطبيق.'
                        : 'Clean Flaster emblem with fresh food items and tagline.'}
                    </p>
                  </div>
                </div>
                <div className="p-4 pt-0">
                  <a
                    href={socialPostImg}
                    download="Flaster-Social-Post-1x1.jpg"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[#DC2626] hover:bg-[#B91C1C] text-white transition-all shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isArabic ? 'تحميل صورة البوست (1:1)' : 'Download 1:1 Post'}</span>
                  </a>
                </div>
              </div>

              {/* Card 2: 9:16 Story / TikTok Poster */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-between">
                <div>
                  <div className="aspect-square bg-[#FAF8F5] overflow-hidden border-b border-slate-100 flex items-center justify-center p-2">
                    <img
                      src={storyPosterImg}
                      alt="Flaster 9:16 Story Poster"
                      referrerPolicy="no-referrer"
                      className="h-full w-auto object-contain rounded-xl shadow"
                    />
                  </div>
                  <div className="p-4">
                    <span className="inline-block text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded mb-1">
                      {isArabic ? 'مقاس طولي 9:16 (ستوري / تيك توك / سناب)' : '9:16 Story & Reels'}
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      {isArabic
                        ? 'تصميم الستوري الإعلاني (Save up to 50%)'
                        : 'Vertical Story & TikTok Launch Poster'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {isArabic
                        ? 'مصمم بمقاس شاشة الجوال الكاملة لنشره في ستوري إنستغرام وسناب شات وتيك توك.'
                        : 'Full-screen vertical story poster for Instagram, Snapchat, and TikTok.'}
                    </p>
                  </div>
                </div>
                <div className="p-4 pt-0">
                  <a
                    href={storyPosterImg}
                    download="Flaster-Story-Poster-9x16.jpg"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[#F59E0B] hover:bg-[#D97706] text-slate-950 transition-all shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isArabic ? 'تحميل صورة الستوري (9:16)' : 'Download 9:16 Story'}</span>
                  </a>
                </div>
              </div>

              {/* Card 3: Clean Brand Logo Icon */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm flex flex-col justify-between">
                <div>
                  <div className="aspect-square bg-[#FAF8F5] overflow-hidden border-b border-slate-100">
                    <img
                      src={brandLogoImg}
                      alt="Flaster Brand Emblem"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="p-4">
                    <span className="inline-block text-[11px] font-bold text-[#15803D] bg-emerald-50 px-2 py-0.5 rounded mb-1">
                      {isArabic ? 'صورة الحساب الرسمية (Avatar)' : 'Profile Picture / Avatar'}
                    </span>
                    <h4 className="text-sm font-extrabold text-slate-900">
                      {isArabic
                        ? 'شعار البروفايل الرسمي (Flaster Logo)'
                        : 'Official Profile Emblem'}
                    </h4>
                    <p className="text-xs text-slate-500 mt-1">
                      {isArabic
                        ? 'مناسب لوضعه كصورة شخصية (Profile Picture) لحسابات Flaster على جميع المنصات.'
                        : 'Ideal as the profile picture across Instagram, TikTok, and WhatsApp Business.'}
                    </p>
                  </div>
                </div>
                <div className="p-4 pt-0">
                  <a
                    href={brandLogoImg}
                    download="Flaster-Brand-Logo.jpg"
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold bg-[#15803D] hover:bg-[#166534] text-white transition-all shadow-sm"
                  >
                    <Download className="w-4 h-4" />
                    <span>{isArabic ? 'تحميل شعار البروفايل' : 'Download Logo'}</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
