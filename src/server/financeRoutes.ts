import express from 'express';
import {
  getPlatformFinancialSummary,
  getMerchantSettlementStatement,
  calculateOrderFinancials,
  updateMerchantCommissionRate,
  getCommissionAuditLogs,
  getPlatformSettings,
  updatePlatformSettings,
  getAllMerchantPartners,
} from './financeService.ts';
import { requireAdminAuth, requireMerchantOrAdminAuth } from './adminAuth.ts';

const router = express.Router();

/**
 * 1. GET /api/finance/summary (Admin only)
 */
router.get('/summary', requireAdminAuth, (_req, res) => {
  const summary = getPlatformFinancialSummary();
  return res.json({ success: true, summary });
});

/**
 * 2. GET /api/finance/settlements/me (Merchant or Admin)
 * Reads merchantId strictly from the verified portal token.
 */
router.get('/settlements/me', requireMerchantOrAdminAuth, (req, res) => {
  const caller = (req as express.Request & { caller?: { role: string; merchantId?: string } }).caller;
  if (!caller?.merchantId) {
    return res.status(400).json({
      success: false,
      error: 'merchantId is required in session token',
    });
  }
  const statement = getMerchantSettlementStatement(caller.merchantId);
  return res.json({ success: true, statement });
});

/**
 * 2b. GET /api/finance/settlements/merchants/:merchantId (Merchant or Admin)
 * Strictly enforces that a merchant can ONLY view their own settlement statement (403 otherwise).
 */
router.get('/settlements/merchants/:merchantId', requireMerchantOrAdminAuth, (req, res) => {
  const { merchantId } = req.params;
  const caller = (req as express.Request & { caller?: { role: string; merchantId?: string } }).caller;
  if (caller?.role === 'merchant') {
    if (!caller.merchantId || caller.merchantId !== merchantId) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: لا يمكنك الاطلاع على التقارير المالية لمطعم آخر',
      });
    }
  }
  const statement = getMerchantSettlementStatement(
    caller?.role === 'merchant' ? caller.merchantId! : merchantId
  );
  return res.json({ success: true, statement });
});

/**
 * 3. POST /api/finance/calculate-breakdown
 * For merchants, always reads merchantId from the verified token and rejects mismatched merchantId (403).
 */
router.post('/calculate-breakdown', requireMerchantOrAdminAuth, (req, res) => {
  const caller = (req as express.Request & { caller?: { role: string; merchantId?: string } }).caller;
  const {
    orderId,
    merchantId: bodyMerchantId,
    subtotalFils,
    deliveryFeeFils,
    commissionRatePercent,
    paymentMethod,
  } = req.body || {};

  if (caller?.role === 'merchant') {
    if (!caller.merchantId || (bodyMerchantId && bodyMerchantId !== caller.merchantId)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: لا يمكن للمتجر إجراء حساب مالي لمطعم آخر',
      });
    }
  }

  const authoritativeMerchantId =
    caller?.role === 'merchant' ? caller.merchantId : bodyMerchantId;

  if (
    !orderId ||
    !authoritativeMerchantId ||
    typeof subtotalFils !== 'number' ||
    !Number.isInteger(subtotalFils) ||
    subtotalFils < 0
  ) {
    return res.status(400).json({
      success: false,
      error: 'بيانات الحساب غير مكتملة أو المبلغ بالفلس غير صحيح',
    });
  }

  const breakdown = calculateOrderFinancials({
    orderId,
    merchantId: authoritativeMerchantId,
    subtotalFils,
    deliveryFeeFils: typeof deliveryFeeFils === 'number' && Number.isInteger(deliveryFeeFils) ? deliveryFeeFils : 0,
    commissionRatePercent: caller?.role === 'merchant' ? undefined : commissionRatePercent,
    paymentMethod,
  });

  return res.json({ success: true, breakdown });
});

/**
 * 4. POST /api/finance/commissions/update (Admin only)
 * Validates 0–50% range (never negative) and logs who, when, oldValue, newValue.
 */
router.post('/commissions/update', requireAdminAuth, async (req, res) => {
  try {
    const { merchantId, newCommissionPercent, newRate, changedBy } = req.body || {};
    const caller = (req as express.Request & { caller?: { email?: string; uid?: string } }).caller;
    const rawRate = newCommissionPercent !== undefined ? newCommissionPercent : newRate;
    const result = await updateMerchantCommissionRate({
      merchantId,
      newCommissionPercent: Number(rawRate),
      changedBy: caller?.email || caller?.uid || String(changedBy || 'admin'),
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: errorMsg });
  }
});

/**
 * 5. GET /api/finance/commissions/logs (Admin only)
 */
router.get('/commissions/logs', requireAdminAuth, (_req, res) => {
  return res.json({
    success: true,
    logs: getCommissionAuditLogs(),
    merchants: getAllMerchantPartners(),
  });
});

/**
 * 6. GET /api/finance/settings (Public read-only non-secret platform info)
 */
router.get('/settings', (_req, res) => {
  return res.json({
    success: true,
    settings: getPlatformSettings(),
  });
});

/**
 * 7. POST /api/finance/settings (Admin only)
 */
router.post('/settings', requireAdminAuth, async (req, res) => {
  try {
    const { trn, supportPhoneE164, defaultCommissionPercent, businessName, updatedBy } = req.body || {};
    const caller = (req as express.Request & { caller?: { email?: string; uid?: string } }).caller;
    const result = await updatePlatformSettings(
      {
        trn,
        supportPhoneE164,
        defaultCommissionPercent:
          defaultCommissionPercent !== undefined ? Number(defaultCommissionPercent) : undefined,
        businessName,
      },
      caller?.email || caller?.uid || updatedBy || 'admin'
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: errorMsg });
  }
});

export default router;
