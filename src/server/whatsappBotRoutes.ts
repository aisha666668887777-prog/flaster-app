import express from 'express';
import crypto from 'crypto';
import { timingSafeStringEqual } from './adminAuth.ts';
import type { RequestWithRawBody } from './app.ts';

const router = express.Router();

const APP_URL = process.env.APP_URL || 'https://flaster.ae';

/**
 * 1. Meta Webhook Verification Handshake (GET)
 * Strictly reads META_WEBHOOK_VERIFY_TOKEN from env (never hardcoded fallback, never logs expected secret).
 */
router.get('/whatsapp', (req, res) => {
  const expectedVerifyToken = (process.env.META_WEBHOOK_VERIFY_TOKEN || '').trim();
  if (!expectedVerifyToken) {
    return res.status(503).json({ success: false, error: 'Webhook verification token not configured' });
  }

  const mode = typeof req.query['hub.mode'] === 'string' ? req.query['hub.mode'] : '';
  const token = typeof req.query['hub.verify_token'] === 'string' ? req.query['hub.verify_token'] : '';
  const challenge = typeof req.query['hub.challenge'] === 'string' ? req.query['hub.challenge'] : '';

  if (mode === 'subscribe' && token && timingSafeStringEqual(token, expectedVerifyToken)) {
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
});

/**
 * 2. Meta Webhook Incoming Messages & Auto-Reply Bot (POST)
 * Verifies X-Hub-Signature-256 HMAC signature when META_APP_SECRET is configured (mandatory in production).
 */
router.post('/whatsapp', async (req, res) => {
  try {
    const appSecret = (process.env.META_APP_SECRET || '').trim();
    if (appSecret || process.env.NODE_ENV === 'production') {
      if (!appSecret) {
        return res.status(503).json({ success: false, error: 'META_APP_SECRET not configured' });
      }
      const sigHeader = req.headers['x-hub-signature-256'];
      const sigStr = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader || '';
      const rawBody = (req as RequestWithRawBody).rawBody ?? JSON.stringify(req.body || {});
      const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody, 'utf8').digest('hex');
      if (!sigStr || !timingSafeStringEqual(sigStr, expected)) {
        return res.status(401).json({ success: false, error: 'Invalid Meta webhook signature' });
      }
    }

    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (!message || message.type !== 'text') {
      return res.status(200).json({ status: 'ignored_non_text' });
    }

    const customerPhone = String(message.from || '');
    const userText = String(message.text?.body || '').trim().toLowerCase();

    let replyText = '';

    if (
      userText.includes('مرحبا') ||
      userText.includes('هلا') ||
      userText.includes('سلام') ||
      userText.includes('السلام') ||
      userText.includes('hello') ||
      userText.includes('hi')
    ) {
      replyText =
        `مرحباً بك في منصة فلاستر (Flaster) لحفظ النعمة في الإمارات! 🥐🇦🇪\n\n` +
        `نحن نوفر لك وجبات طازجة وفائضة من أرقى المخابز والمطاعم بخصم 50% إلى 70%.\n\n` +
        `📱 لتصفح وجبات اليوم والطلب فوراً:\n${APP_URL}\n\n` +
        `للتحدث مع فريق الدعم: 971504116994+`;
    } else if (
      userText.includes('طلب') ||
      userText.includes('طلبي') ||
      userText.includes('كود') ||
      userText.includes('تتبع') ||
      userText.includes('order')
    ) {
      replyText =
        `أهلاً بك! لتتبع طلبك أو إظهار كود الاستلام للمتجر، يرجى فتح خانة 'طلباتي' في التطبيق:\n` +
        `${APP_URL}\n\n` +
        `كود الاستلام يتكون من 6 أرقام تبرزها للمتجر لاستلام وجبتك طازجة! 🍱`;
    } else if (
      userText.includes('متجر') ||
      userText.includes('مطعم') ||
      userText.includes('مخبز') ||
      userText.includes('تسجيل') ||
      userText.includes('شريك') ||
      userText.includes('merchant')
    ) {
      replyText =
        `أهلاً بشركاء حفظ النعمة! 🤝\n` +
        `يسعدنا انضمام متجرك إلى شبكة فلاستر لبيع فائض الطعام اليومي وزيادة أرباحك.\n\n` +
        `يمكنك الدخول إلى بوابة المتاجر عبر:\n` +
        `${APP_URL}\n` +
        `أو التواصل المباشر مع إدارة العمليات: 971504116994+`;
    } else {
      replyText =
        `شكراً لتواصلك مع منصة فلاستر (Flaster) 🥐\n\n` +
        `🤖 أنا المساعد الآلي الذكي لفلاستر.\n\n` +
        `• يمكنك استكشاف عروض حفظ النعمة وطلب الوجبات الآن:\n` +
        `${APP_URL}\n\n` +
        `• لأي استفسار أو مساعدة مباشرة من فريق العمل، يرجى الاتصال بنا على: 971504116994+`;
    }

    const whatsappToken = (process.env.META_WHATSAPP_TOKEN || process.env.WHATSAPP_API_TOKEN || '').trim();
    const whatsappPhoneId = (process.env.META_WHATSAPP_PHONE_ID || process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();

    if (whatsappToken && whatsappPhoneId) {
      const sendRes = await fetch(`https://graph.facebook.com/v19.0/${whatsappPhoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${whatsappToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: customerPhone,
          type: 'text',
          text: {
            preview_url: false,
            body: replyText,
          },
        }),
      });

      if (!sendRes.ok) {
        console.warn(`[WhatsApp Bot] Meta API status ${sendRes.status}`);
      }
    }

    return res.status(200).json({ success: true, replySent: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[WhatsApp Bot] Webhook error:', msg);
    return res.status(500).json({ success: false, error: msg });
  }
});

export default router;
