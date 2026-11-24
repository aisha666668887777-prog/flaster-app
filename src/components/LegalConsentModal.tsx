import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { Language } from '../types';

interface LegalConsentModalProps {
  isOpen: boolean;
  onAccept: () => void;
  lang: Language;
  onOpenLegalTab?: (tab: 'terms' | 'privacy') => void;
}

export const LegalConsentModal: React.FC<LegalConsentModalProps> = ({
  isOpen,
  onAccept,
  lang,
  onOpenLegalTab,
}) => {
  const isArabic = lang === 'ar';
  const [agreed, setAgreed] = useState(false);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-md mx-auto p-6 bg-white rounded-2xl shadow-xl border border-gray-100 text-right animate-in zoom-in-95 duration-200 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* عنوان صغير وهادئ يوضح الالتزام بالقانون دون إزعاج */}
        <div className="flex items-center justify-end gap-2 mb-2 text-gray-500 text-xs">
          <span>{isArabic ? 'متوافق مع معايير حماية البيانات في دولة الإمارات (UAE PDPL)' : 'Compliant with UAE Data Protection (PDPL)'}</span>
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
        </div>

        {/* خانة الموافقة السريعة المختصرة */}
        <div className="flex items-start gap-3 mb-4">
          <input 
            type="checkbox" 
            id="terms-consent" 
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 w-4 h-4 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer" 
          />
          <label htmlFor="terms-consent" className="text-xs text-gray-600 leading-relaxed select-none">
            {isArabic ? (
              <>
                أقر بأنني قرأت وفهمت <button type="button" onClick={() => onOpenLegalTab?.('privacy')} className="text-emerald-700 underline font-medium hover:text-emerald-800 cursor-pointer">سياسة الخصوصية</button> و<button type="button" onClick={() => onOpenLegalTab?.('terms')} className="text-emerald-700 underline font-medium hover:text-emerald-800 cursor-pointer">شروط الاستخدام</button> الخاصة بمنصة فليستر.
              </>
            ) : (
              <>
                I confirm I have read and understand the <button type="button" onClick={() => onOpenLegalTab?.('privacy')} className="text-emerald-700 underline font-medium hover:text-emerald-800 cursor-pointer">Privacy Policy</button> and <button type="button" onClick={() => onOpenLegalTab?.('terms')} className="text-emerald-700 underline font-medium hover:text-emerald-800 cursor-pointer">Terms of Use</button> of Flaster.
              </>
            )}
          </label>
        </div>

        {/* زر المتابعة الرئيسي بلون الهوية الأخضر الأنيق */}
        <button
          type="button"
          disabled={!agreed}
          onClick={onAccept}
          className="w-full py-3 px-4 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-semibold rounded-xl transition duration-200 flex items-center justify-center gap-2 shadow-md shadow-emerald-700/10 cursor-pointer"
        >
          <span>{isArabic ? 'موافق ومتابعة إلى المنصة' : 'Agree & Continue to Platform'}</span>
          <svg className="w-4 h-4 rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
          </svg>
        </button>
      </div>
    </div>
  );
};
