/**
 * Flaster • SMART SAVING. LESS WASTE.
 * Central Platform Configuration, Money (Fils) Utilities & Support Settings
 */

export interface PlatformSettings {
  businessName: string;
  businessNameEn?: string;
  businessNameAr: string;
  trn: string; // UAE Tax Registration Number (15 digits). Empty string if not registered yet.
  supportPhoneE164: string; // e.g. "+971504116994" (no spaces for tel: links)
  supportWhatsappDigits: string; // e.g. "971504116994"
  supportEmail: string;
  vatRatePercent: number; // 5% UAE VAT included in prices
  defaultCommissionPercent: number; // 15% default
  minCommissionPercent: number; // 0%
  maxCommissionPercent: number; // 50%
  welcomeBonusPoints: number; // 90 points awarded upon signup
  pointsPerAed: number; // 100 points = 1 AED (1 point = 1 fil)
  sequentialInvoiceCounter: number;
}

export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  businessName: 'Flaster',
  businessNameEn: 'Flaster Smart Food Rescue LLC',
  businessNameAr: 'فلاستر',
  trn: '', // When empty -> label receipt as "Receipt" instead of "Tax Invoice"
  supportPhoneE164: '+971504116994',
  supportWhatsappDigits: '971504116994',
  supportEmail: 'support@flaster.ae',
  vatRatePercent: 5,
  defaultCommissionPercent: 15,
  minCommissionPercent: 0,
  maxCommissionPercent: 50,
  welcomeBonusPoints: 90,
  pointsPerAed: 100,
  sequentialInvoiceCounter: 1001,
};

// Platform Pricing & Fee Rules (Authoritative & Immutable)
export const MIN_MERCHANT_ITEM_PRICE_AED = 15;
export const MIN_MERCHANT_ITEM_PRICE_FILS = 1500; // 15.00 AED minimum merchant listing price
export const CUSTOMER_SERVICE_FEE_AED = 1.5;
export const CUSTOMER_SERVICE_FEE_FILS = 150; // 1.50 AED automatic platform fee blended silently into customer price
export const MIN_REDEMPTION_POINTS = 1000; // 1,000 points = 10.00 AED minimum redemption

// Official Flaster Social Hub (Linktree) & Follow-for-Points Rewards (5 platforms x 5 pts = 25 pts)
export const SOCIAL_LINKTREE_URL = 'https://linktr.ee/flaster';
export const SOCIAL_FOLLOW_POINTS_PER_PAGE = 5;
export const SOCIAL_FOLLOW_PAGES = [
  { id: 'instagram', nameAr: 'إنستغرام', nameEn: 'Instagram', url: SOCIAL_LINKTREE_URL },
  { id: 'tiktok', nameAr: 'تيك توك', nameEn: 'TikTok', url: SOCIAL_LINKTREE_URL },
  { id: 'snapchat', nameAr: 'سناب شات', nameEn: 'Snapchat', url: SOCIAL_LINKTREE_URL },
  { id: 'facebook', nameAr: 'فيسبوك', nameEn: 'Facebook', url: SOCIAL_LINKTREE_URL },
  { id: 'x', nameAr: 'إكس (تويتر)', nameEn: 'X (Twitter)', url: SOCIAL_LINKTREE_URL },
] as const;

export type SocialFollowPageId = (typeof SOCIAL_FOLLOW_PAGES)[number]['id'];

/**
 * Returns the final customer-facing item price in integer Fils (merchant price + fixed 1.50 AED platform fee).
 * Blended seamlessly so the customer sees a single clean price with no separate service-fee line.
 */
export function getCustomerItemPriceFils(merchantPriceFils: number): number {
  if (!Number.isFinite(merchantPriceFils) || merchantPriceFils <= 0) return CUSTOMER_SERVICE_FEE_FILS;
  return Math.round(merchantPriceFils) + CUSTOMER_SERVICE_FEE_FILS;
}

/**
 * Returns the final customer-facing item price in AED (merchant price + fixed 1.50 AED platform fee).
 */
export function getCustomerItemPriceAed(merchantPriceAed: number): number {
  if (!Number.isFinite(merchantPriceAed) || merchantPriceAed <= 0) return CUSTOMER_SERVICE_FEE_AED;
  return Number(((Math.round(merchantPriceAed * 100) + CUSTOMER_SERVICE_FEE_FILS) / 100).toFixed(2));
}

export const REFUND_POLICY_TEXT = {
  ar: 'سياسة الإلغاء والاسترداد: يُسمح بإلغاء الطلب واسترداد المبلغ كاملاً فقط طالما أن الطلب في حالة "تم الإرسال" (قبل قيام المتجر بقبول الطلب أو البدء في تحضيره). لا يُسمح بالإلغاء أو الاسترداد بعد قبول المتجر للطلب أو تحضيره أو استلامه.',
  en: 'Cancellation & Refund Policy: Full order cancellation and refund are permitted strictly while the order is in "Placed" status (before the merchant accepts or starts preparing the order). Refunds are blocked once accepted, prepared, or picked up.',
};

// Bootstrapped Admin Emails (Server & Client RBAC guard)
export const ADMIN_EMAIL_ALLOWLIST: string[] = [
  'flaster.ae@gmail.com',
  'aisha666668887777@gmail.com',
];

/**
 * Converts AED amount to integer UAE Fils (1 AED = 100 Fils).
 * Rounds safely to avoid floating-point drift.
 */
export function aedToFils(aed: number): number {
  if (!Number.isFinite(aed)) return 0;
  return Math.round(aed * 100);
}

/**
 * Converts integer UAE Fils to AED number for display only.
 */
export function filsToAed(fils: number): number {
  if (!Number.isFinite(fils)) return 0;
  return Number((Math.round(fils) / 100).toFixed(2));
}

/**
 * Formats integer UAE Fils as a two-decimal AED string (e.g., 3500 -> "35.00")
 */
export function formatFilsToAedString(fils: number): string {
  if (!Number.isFinite(fils)) return '0.00';
  return (Math.round(fils) / 100).toFixed(2);
}

/**
 * Prices include 5% UAE VAT:
 * VAT = totalFils * 5 / 105 (rounded to nearest integer fil)
 */
export function calculateIncludedVatFils(totalFils: number, vatRatePercent: number = 5): number {
  if (!Number.isFinite(totalFils) || totalFils <= 0) return 0;
  return Math.round((Math.round(totalFils) * vatRatePercent) / (100 + vatRatePercent));
}

/**
 * Net amount excluding 5% included VAT in integer fils
 */
export function calculateNetExclVatFils(totalFils: number): number {
  if (!Number.isFinite(totalFils) || totalFils <= 0) return 0;
  const roundedTotal = Math.round(totalFils);
  return roundedTotal - calculateIncludedVatFils(roundedTotal);
}

/**
 * Validates merchant commission rate: must be a number between 0 and 50 inclusive, never negative.
 */
export function validateCommissionRate(rate: number): { valid: boolean; sanitizedRate: number; error?: string } {
  if (typeof rate !== 'number' || Number.isNaN(rate) || !Number.isFinite(rate)) {
    return { valid: false, sanitizedRate: 15, error: 'Commission rate must be a valid number' };
  }
  if (rate < 0) {
    return { valid: false, sanitizedRate: 0, error: 'Commission rate cannot be negative (minimum 0%)' };
  }
  if (rate > 50) {
    return { valid: false, sanitizedRate: 50, error: 'Commission rate cannot exceed 50% (allowed range: 0–50%)' };
  }
  return { valid: true, sanitizedRate: Number(rate.toFixed(2)) };
}

/**
 * Generates a sequential invoice number formatted as INV-YYYY-XXXX
 */
export function formatSequentialInvoiceNumber(seq: number, date: Date = new Date()): string {
  const year = date.getUTCFullYear();
  const padded = String(Math.max(1, Math.floor(seq))).padStart(5, '0');
  return `INV-${year}-${padded}`;
}
