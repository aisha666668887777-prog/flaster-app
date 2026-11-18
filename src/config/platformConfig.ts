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
  welcomeBonusPoints: number; // 500 points awarded after first completed order
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
  welcomeBonusPoints: 500,
  pointsPerAed: 100,
  sequentialInvoiceCounter: 1001,
};

export const REFUND_POLICY_TEXT = {
  ar: 'سياسة الإلغاء والاسترداد: يُسمح بإلغاء الطلب واسترداد المبلغ كاملاً فقط طالما أن الطلب في حالة "تم الإرسال" (قبل قيام المتجر بقبول الطلب أو البدء في تحضيره). لا يُسمح بالإلغاء أو الاسترداد بعد قبول المتجر للطلب أو تحضيره أو استلامه.',
  en: 'Cancellation & Refund Policy: Full order cancellation and refund are permitted strictly while the order is in "Placed" status (before the merchant accepts or starts preparing the order). Refunds are blocked once accepted, prepared, picked up, or delivered.',
};

// Bootstrapped Admin Emails (Server & Client RBAC guard)
export const ADMIN_EMAIL_ALLOWLIST: string[] = [
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
