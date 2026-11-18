import express from 'express';
import {
  createJeeblyDeliveryTask,
  getJeeblyTracking,
  updateJeeblyWebhookStatus,
} from './jeeblyService.ts';
import type { JeeblyDeliveryStatus } from './jeeblyService.ts';
import { timingSafeStringEqual } from './adminAuth.ts';

const router = express.Router();

/**
 * 1. POST /api/delivery/dispatch
 * Logs a Direct Restaurant Self-Delivery task (0 AED platform delivery fee)
 */
router.post('/dispatch', async (req, res) => {
  try {
    const {
      orderId,
      merchantId,
      merchantName,
      merchantPhone,
      pickupNeighborhood = 'الشريشة - رأس الخيمة',
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryNeighborhood = 'الشريشة / رأس الخيمة',
      itemsCount = 1,
      declaredValueFils = 2800,
    } = req.body || {};

    if (!orderId || !merchantId || !customerName || !customerPhone || !deliveryAddress) {
      return res.status(400).json({
        success: false,
        error: 'بيانات طلب التوصيل غير مكتملة (orderId, merchantId, customerName, deliveryAddress مطلوبة)',
      });
    }

    const taskResult = await createJeeblyDeliveryTask({
      orderId,
      merchantId,
      merchantName: merchantName || 'متجر معتمد - رأس الخيمة',
      merchantPhone: merchantPhone || '+971 7 233 4455',
      pickupAddress: {
        street: 'شارع الحصن',
        neighborhood: pickupNeighborhood,
        emirate: 'Ras Al Khaimah',
      },
      customerName,
      customerPhone,
      deliveryAddress: {
        addressText: deliveryAddress,
        neighborhood: deliveryNeighborhood,
        emirate: 'Ras Al Khaimah',
      },
      packageDetails: {
        itemsCount: typeof itemsCount === 'number' && Number.isInteger(itemsCount) && itemsCount > 0 ? itemsCount : 1,
        isPerishableFood: true,
        requiresThermalBag: true,
        declaredValueFils: typeof declaredValueFils === 'number' && Number.isInteger(declaredValueFils) ? declaredValueFils : 0,
      },
      deliveryFeeFils: 0,
    });

    return res.status(201).json(taskResult);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

/**
 * 2. GET /api/delivery/tracking/:orderId
 */
router.get('/tracking/:orderId', (req, res) => {
  const { orderId } = req.params;
  const tracking = getJeeblyTracking(orderId);

  if (!tracking) {
    return res.status(404).json({
      success: false,
      error: 'لا توجد شحنة توصيل مسجلة لهذا الطلب حالياً',
    });
  }

  return res.json({ success: true, tracking });
});

/**
 * 3. POST /api/delivery/jeebly/webhook
 * Mandatory JEEBLY_WEBHOOK_SECRET check (fail-closed if unset) with timingSafeStringEqual
 */
router.post('/jeebly/webhook', (req, res) => {
  try {
    const { orderId, status, driver, token } = req.body || {};

    const expectedToken = (process.env.JEEBLY_WEBHOOK_SECRET || '').trim();
    if (!expectedToken) {
      return res.status(503).json({
        success: false,
        error: 'JEEBLY_WEBHOOK_SECRET is not configured on server',
      });
    }

    const headerToken = req.headers['x-webhook-secret'];
    const providedToken =
      typeof token === 'string'
        ? token
        : Array.isArray(headerToken)
          ? headerToken[0]
          : headerToken || '';

    if (!providedToken || !timingSafeStringEqual(providedToken, expectedToken)) {
      return res.status(401).json({ success: false, error: 'غير مصرح بالوصول إلى Webhook' });
    }

    if (!orderId || !status) {
      return res.status(400).json({ success: false, error: 'orderId و status مطلوبة' });
    }

    const updated = updateJeeblyWebhookStatus(orderId, status as JeeblyDeliveryStatus, driver);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'الطلب غير موجود في نظام التوصيل' });
    }

    return res.json({
      success: true,
      message: `تم تحديث حالة توصيل الطلب بنجاح إلى: ${status}`,
      tracking: updated,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

export default router;
