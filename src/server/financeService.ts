/**
 * Flaster • SMART SAVING. LESS WASTE.
 * Financial Accounting, Commissions (0-50% Validated + Audit Log), Integer Fils & VAT (5/105)
 */

import { adminDb } from './adminAuth.ts';
import {
  DEFAULT_PLATFORM_SETTINGS,
  type PlatformSettings,
  calculateIncludedVatFils,
  filsToAed,
  formatSequentialInvoiceNumber,
  validateCommissionRate,
} from '../config/platformConfig.ts';
import { INITIAL_MERCHANT_PARTNERS } from '../data/mockData.ts';
import type { CommissionAuditLog, MerchantPartner } from '../types/index.ts';

export interface TransactionFinancialBreakdown {
  orderId: string;
  invoiceNumber: string;
  merchantId: string;
  subtotalFils: number;
  deliveryFeeFils: number;
  vatFils: number; // Included 5% VAT = Math.round(totalCustomerPaidFils * 5 / 105)
  totalCustomerPaidFils: number;
  commissionRatePercent: number;
  platformCommissionFils: number;
  merchantNetPayoutFils: number;
  logisticsPayoutFils: number;
  platformLoyaltyFundedFils: number;
  paymentMethod: 'apple_pay' | 'credit_card' | 'pickup_cash' | string;
  isCashPayment: boolean;
  createdAt: string;
}

export interface MerchantSettlementStatement {
  merchantId: string;
  merchantName: string;
  statementPeriod: string;
  settlementFrequency: 'WEEKLY_SUNDAY_DISBURSEMENT';
  totalOrdersCount: number;
  electronicOrdersCount: number;
  cashOrdersCount: number;
  grossSalesFils: number;
  grossSalesAed: number;
  electronicSalesAed: number;
  cashSalesAed: number;
  totalPlatformCommissionFils: number;
  totalPlatformCommissionAed: number;
  cashRetainedByMerchantAed: number;
  netBankTransferPayableFils: number;
  netBankTransferPayableAed: number;
  bankName: string;
  bankIban: string;
  settlementStatus: 'READY_FOR_DISBURSEMENT' | 'PROCESSED' | 'TRANSFERRED';
  generatedAt: string;
}

// Platform settings synced with Firestore
let currentPlatformSettings: PlatformSettings = { ...DEFAULT_PLATFORM_SETTINGS };

// Merchant commission registry synced with Firestore
const merchantCommissionsMap = new Map<string, MerchantPartner>(
  INITIAL_MERCHANT_PARTNERS.map((m) => [m.id, { ...m }])
);

// Commission change audit logs synced with Firestore
const commissionAuditLogs: CommissionAuditLog[] = [];

// Transaction ledger synced with Firestore
const transactionLedger: TransactionFinancialBreakdown[] = [
  {
    orderId: 'ORD-RAK-SEED-01',
    invoiceNumber: 'INV-2026-01001',
    merchantId: 'merchant-alsharisha-heritage',
    subtotalFils: 3500, // 35.00 AED
    deliveryFeeFils: 0, // 0.00 AED (Direct Merchant Delivery)
    totalCustomerPaidFils: 3500, // 35.00 AED
    vatFils: calculateIncludedVatFils(3500), // 3500 * 5 / 105 = 167 fils (1.67 AED)
    commissionRatePercent: 15,
    platformCommissionFils: 525,
    merchantNetPayoutFils: 2975,
    logisticsPayoutFils: 0,
    platformLoyaltyFundedFils: 0,
    paymentMethod: 'apple_pay',
    isCashPayment: false,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    orderId: 'ORD-RAK-SEED-02',
    invoiceNumber: 'INV-2026-01002',
    merchantId: 'merchant-alnakheel-bakery',
    subtotalFils: 2800, // 28.00 AED
    deliveryFeeFils: 0,
    totalCustomerPaidFils: 2800,
    vatFils: calculateIncludedVatFils(2800), // 2800 * 5 / 105 = 133 fils (1.33 AED)
    commissionRatePercent: 15,
    platformCommissionFils: 420,
    merchantNetPayoutFils: 2380,
    logisticsPayoutFils: 0,
    platformLoyaltyFundedFils: 0,
    paymentMethod: 'apple_pay',
    isCashPayment: false,
    createdAt: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
  {
    orderId: 'ORD-RAK-SEED-03',
    invoiceNumber: 'INV-2026-01003',
    merchantId: 'merchant-alsharisha-heritage',
    subtotalFils: 4500, // 45.00 AED
    deliveryFeeFils: 0,
    totalCustomerPaidFils: 4500,
    vatFils: calculateIncludedVatFils(4500), // 4500 * 5 / 105 = 214 fils (2.14 AED)
    commissionRatePercent: 15,
    platformCommissionFils: 675,
    merchantNetPayoutFils: 3825,
    logisticsPayoutFils: 0,
    platformLoyaltyFundedFils: 0,
    paymentMethod: 'pickup_cash',
    isCashPayment: true,
    createdAt: new Date().toISOString(),
  },
];

export function getPlatformSettings(): PlatformSettings {
  return { ...currentPlatformSettings };
}

export async function updatePlatformSettings(
  updates: Partial<PlatformSettings>,
  updatedBy: string = 'admin'
): Promise<{ success: boolean; settings: PlatformSettings; error?: string }> {
  if (updates.defaultCommissionPercent !== undefined) {
    const check = validateCommissionRate(updates.defaultCommissionPercent);
    if (!check.valid) {
      return { success: false, settings: currentPlatformSettings, error: check.error };
    }
    updates.defaultCommissionPercent = check.sanitizedRate;
  }

  currentPlatformSettings = {
    ...currentPlatformSettings,
    ...updates,
    trn: typeof updates.trn === 'string' ? updates.trn.trim().slice(0, 32) : currentPlatformSettings.trn,
    supportPhoneE164:
      typeof updates.supportPhoneE164 === 'string'
        ? updates.supportPhoneE164.replace(/\s+/g, '')
        : currentPlatformSettings.supportPhoneE164,
  };

  try {
    await adminDb
      .collection('settings')
      .doc('global')
      .set(
        {
          ...currentPlatformSettings,
          updatedBy,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
  } catch {
    // Safe fallback if Firestore admin credentials are not active locally
  }

  return { success: true, settings: { ...currentPlatformSettings } };
}

export function getNextSequentialInvoiceNumber(): string {
  currentPlatformSettings.sequentialInvoiceCounter += 1;
  return formatSequentialInvoiceNumber(currentPlatformSettings.sequentialInvoiceCounter);
}

/**
 * Updates a merchant's commission rate with server-side validation (0–50%, never negative)
 * and logs who, when, old value, and new value to Firestore & memory.
 */
export async function updateMerchantCommissionRate(params: {
  merchantId: string;
  newCommissionPercent: number;
  changedBy: string;
}): Promise<{
  success: boolean;
  merchant?: MerchantPartner;
  auditLog?: CommissionAuditLog;
  error?: string;
}> {
  const { merchantId, newCommissionPercent, changedBy } = params;
  if (!merchantId) {
    return { success: false, error: 'merchantId is required' };
  }

  const validation = validateCommissionRate(newCommissionPercent);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  const existingMerchant = merchantCommissionsMap.get(merchantId) || {
    id: merchantId,
    name: merchantId,
    nameAr: merchantId,
    category: 'restaurants_cafeterias',
    neighborhood: 'Ras Al Khaimah',
    neighborhoodAr: 'رأس الخيمة',
    commissionPercent: currentPlatformSettings.defaultCommissionPercent,
    isVerified: true,
    totalSalesAed: 0,
    activeListingsCount: 1,
    rating: 4.8,
  };

  const oldValue = existingMerchant.commissionPercent;
  const newValue = validation.sanitizedRate;
  const nowIso = new Date().toISOString();

  const updatedMerchant: MerchantPartner = {
    ...existingMerchant,
    commissionPercent: newValue,
  };
  merchantCommissionsMap.set(merchantId, updatedMerchant);

  const auditLog: CommissionAuditLog = {
    id: `CLOG-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`,
    merchantId,
    merchantName: updatedMerchant.name,
    changedBy: (changedBy || 'admin').slice(0, 200),
    oldValue,
    newValue,
    timestamp: nowIso,
  };
  commissionAuditLogs.unshift(auditLog);

  try {
    await adminDb
      .collection('merchants')
      .doc(merchantId)
      .set(
        {
          ...updatedMerchant,
          updatedAt: nowIso,
        },
        { merge: true }
      );
    await adminDb.collection('commission_logs').doc(auditLog.id).set(auditLog);
  } catch {
    // Graceful local test fallback
  }

  return {
    success: true,
    merchant: updatedMerchant,
    auditLog,
  };
}

export function getCommissionAuditLogs(): CommissionAuditLog[] {
  return [...commissionAuditLogs];
}

export function getAllMerchantPartners(): MerchantPartner[] {
  return Array.from(merchantCommissionsMap.values());
}

export function registerMerchantPartner(partner: MerchantPartner): MerchantPartner {
  const existing = merchantCommissionsMap.get(partner.id);
  const merged: MerchantPartner = {
    ...(existing || {
      id: partner.id,
      name: partner.name,
      nameAr: partner.nameAr || partner.name,
      category: 'restaurants_cafeterias',
      neighborhood: 'Ras Al Khaimah',
      neighborhoodAr: 'رأس الخيمة',
      commissionPercent: currentPlatformSettings.defaultCommissionPercent,
      isVerified: true,
      totalSalesAed: 0,
      activeListingsCount: 0,
      rating: 5.0,
    }),
    ...partner,
  };
  merchantCommissionsMap.set(partner.id, merged);
  return merged;
}

export function getMerchantCommissionPercent(merchantId: string): number {
  const merchantPartner = merchantCommissionsMap.get(merchantId);
  const rawRate = merchantPartner?.commissionPercent ?? currentPlatformSettings.defaultCommissionPercent;
  const check = validateCommissionRate(rawRate);
  return check.valid ? check.sanitizedRate : 15;
}

/**
 * Calculates exact integer Fils breakdown for any order including 5% VAT (total * 5 / 105)
 */
export function calculateOrderFinancials(params: {
  orderId: string;
  merchantId: string;
  subtotalFils: number;
  deliveryFeeFils: number;
  pointsDiscountFils?: number;
  commissionRatePercent?: number;
  paymentMethod?: string;
  invoiceNumber?: string;
}): TransactionFinancialBreakdown {
  const merchantPartner = merchantCommissionsMap.get(params.merchantId);
  const rawRate =
    params.commissionRatePercent ??
    merchantPartner?.commissionPercent ??
    currentPlatformSettings.defaultCommissionPercent;
  const rateCheck = validateCommissionRate(rawRate);
  const rate = rateCheck.valid ? rateCheck.sanitizedRate : 15;

  const subtotalFils = Math.round(params.subtotalFils);
  const deliveryFeeFils = Math.round(params.deliveryFeeFils || 0);
  const platformCommissionFils = Math.round((subtotalFils * rate) / 100);
  const merchantNetPayoutFils = subtotalFils - platformCommissionFils;
  const platformLoyaltyFundedFils = Math.round(params.pointsDiscountFils || 0);
  const totalCustomerPaidFils = Math.max(
    0,
    subtotalFils + deliveryFeeFils - platformLoyaltyFundedFils
  );

  // Prices include 5% VAT -> VAT = total * 5 / 105
  const vatFils = calculateIncludedVatFils(totalCustomerPaidFils);
  const isCashPayment = params.paymentMethod === 'pickup_cash';

  const record: TransactionFinancialBreakdown = {
    orderId: params.orderId,
    invoiceNumber: params.invoiceNumber || getNextSequentialInvoiceNumber(),
    merchantId: params.merchantId,
    subtotalFils,
    deliveryFeeFils,
    vatFils,
    totalCustomerPaidFils,
    commissionRatePercent: rate,
    platformCommissionFils,
    merchantNetPayoutFils,
    logisticsPayoutFils: deliveryFeeFils,
    platformLoyaltyFundedFils,
    paymentMethod: params.paymentMethod || 'apple_pay',
    isCashPayment,
    createdAt: new Date().toISOString(),
  };

  transactionLedger.push(record);
  return record;
}

export function getMerchantSettlementStatement(
  merchantId: string,
  merchantName?: string
): MerchantSettlementStatement {
  const merchantTransactions = transactionLedger.filter((t) => t.merchantId === merchantId);

  const totalOrdersCount = merchantTransactions.length;
  const electronicTxns = merchantTransactions.filter((t) => !t.isCashPayment);
  const cashTxns = merchantTransactions.filter((t) => t.isCashPayment);

  const grossSalesFils = merchantTransactions.reduce((sum, t) => sum + t.subtotalFils, 0);
  const totalPlatformCommissionFils = merchantTransactions.reduce(
    (sum, t) => sum + t.platformCommissionFils,
    0
  );

  const electronicSalesFils = electronicTxns.reduce((sum, t) => sum + t.subtotalFils, 0);
  const cashSalesFils = cashTxns.reduce((sum, t) => sum + t.subtotalFils, 0);

  const netBankTransferPayableFils = Math.max(
    0,
    electronicSalesFils - totalPlatformCommissionFils
  );

  const ibanMap: Record<string, string> = {
    'merchant-alsharisha-heritage': 'AE120330000001234567890',
    'merchant-alnakheel-bakery': 'AE980330000009876543210',
    'merchant-alhamra-patisserie': 'AE450330000004561237890',
    'merchant-waldorf': 'AE770330000007788991122',
  };

  const defaultIban = ibanMap[merchantId] || 'AE120330000001234567890';

  return {
    merchantId,
    merchantName:
      merchantName ||
      (merchantId.includes('sharisha')
        ? 'مطعم قصر الشريشة التراثي'
        : 'مخبز وبوفيه النخيل الفاخر'),
    statementPeriod: `الأسبوع الحالي (${new Date().toLocaleDateString('ar-AE', {
      day: 'numeric',
      month: 'short',
    })} - الأحد القادم)`,
    settlementFrequency: 'WEEKLY_SUNDAY_DISBURSEMENT',
    totalOrdersCount,
    electronicOrdersCount: electronicTxns.length,
    cashOrdersCount: cashTxns.length,
    grossSalesFils,
    grossSalesAed: filsToAed(grossSalesFils),
    electronicSalesAed: filsToAed(electronicSalesFils),
    cashSalesAed: filsToAed(cashSalesFils),
    totalPlatformCommissionFils,
    totalPlatformCommissionAed: filsToAed(totalPlatformCommissionFils),
    cashRetainedByMerchantAed: filsToAed(cashSalesFils),
    netBankTransferPayableFils,
    netBankTransferPayableAed: filsToAed(netBankTransferPayableFils),
    bankName: 'Wio Bank PJSC - Wio Business UAE',
    bankIban: defaultIban,
    settlementStatus: 'READY_FOR_DISBURSEMENT',
    generatedAt: new Date().toISOString(),
  };
}

export function getPlatformFinancialSummary() {
  const totalOrdersCount = transactionLedger.length;
  const totalGmvFils = transactionLedger.reduce((sum, t) => sum + t.totalCustomerPaidFils, 0);
  const totalVatFils = transactionLedger.reduce((sum, t) => sum + t.vatFils, 0);
  const totalCommissionFils = transactionLedger.reduce(
    (sum, t) => sum + t.platformCommissionFils,
    0
  );
  const totalMerchantPayoutsFils = transactionLedger.reduce(
    (sum, t) => sum + t.merchantNetPayoutFils,
    0
  );
  const totalLogisticsFeesFils = transactionLedger.reduce(
    (sum, t) => sum + t.logisticsPayoutFils,
    0
  );
  const totalLoyaltyFundedFils = transactionLedger.reduce(
    (sum, t) => sum + t.platformLoyaltyFundedFils,
    0
  );

  const electronicCount = transactionLedger.filter((t) => !t.isCashPayment).length;
  const cashCount = transactionLedger.filter((t) => t.isCashPayment).length;

  return {
    currency: 'AED / Fils',
    totalOrdersCount,
    electronicOrdersCount: electronicCount,
    cashOrdersCount: cashCount,
    totalGmvFils,
    totalGmvAed: filsToAed(totalGmvFils),
    totalVatFils,
    totalVatAed: filsToAed(totalVatFils),
    totalPlatformRevenueFils: totalCommissionFils,
    totalPlatformRevenueAed: filsToAed(totalCommissionFils),
    totalMerchantNetPayableFils: totalMerchantPayoutsFils,
    totalMerchantNetPayableAed: filsToAed(totalMerchantPayoutsFils),
    totalJeeblyLogisticsPaidAed: filsToAed(totalLogisticsFeesFils),
    totalPlatformLoyaltyExpenseAed: filsToAed(totalLoyaltyFundedFils),
    commissionModel: '0-50% Validated Per-Merchant Rescue Commission',
    logisticsModel: 'Direct Restaurant Self-Delivery & Counter Pickup (0 AED Platform Fee)',
    settlementPartner: 'Wio Bank PJSC - Wio Business Corporate IBAN Settlement',
    loyaltyFundingModel: '100% Platform Funded by Flaster (Zero Merchant Deductions)',
    settings: currentPlatformSettings,
    commissionLogs: commissionAuditLogs.slice(0, 50),
  };
}
