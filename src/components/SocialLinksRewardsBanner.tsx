import React from 'react';
import { ExternalLink, Coins, Share2 } from 'lucide-react';
import { Language } from '../types';
import { SOCIAL_LINKTREE_URL } from '../config/platformConfig';

interface SocialLinksRewardsBannerProps {
  lang: Language;
  onOpenLoyalty?: () => void;
}

export const SocialLinksRewardsBanner: React.FC<SocialLinksRewardsBannerProps> = ({
  lang,
  onOpenLoyalty,
}) => {
  const isArabic = lang === 'ar';

  return (
    <section className="bg-[#FFFDF9] rounded-2xl border border-[#EAE4DC] p-4 sm:p-5 shadow-xs">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-bold text-[#DC2626]">
            {isArabic ? 'صفحات فلاستر الرسمية' : 'Official Flaster Channels'}
          </p>
          <h2 className="font-headline font-extrabold text-base sm:text-lg text-[#1C1917]">
            {isArabic
              ? 'جميع حسابات فلاستر الرسمية في رابط واحد'
              : 'All Official Flaster Pages in One Link'}
          </h2>
          <p className="text-xs text-[#57534E] leading-relaxed">
            {isArabic
              ? 'تصفّح حساباتنا الرسمية وتابعنا، ثم افتح «نقاطي» لتوثيق متابعتك وكسب 5 نقاط على كل منصة.'
              : 'Visit our official channels, then open "My Points" to verify your follow and earn 5 points per platform.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {onOpenLoyalty && (
            <button
              type="button"
              onClick={onOpenLoyalty}
              className="h-10 px-4 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Coins className="w-4 h-4 text-amber-600" />
              <span>{isArabic ? 'نقاطي ومكافآت المتابعة (+5 نقاط)' : 'My Points & Follow Rewards (+5 pts)'}</span>
            </button>
          )}

          <a
            href={SOCIAL_LINKTREE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="h-10 px-4 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-bold text-xs flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap"
          >
            <Share2 className="w-4 h-4" />
            <span dir="ltr">linktr.ee/flaster</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </section>
  );
};
