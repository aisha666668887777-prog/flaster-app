import express from 'express';
import crypto from 'crypto';
import {
  verifyAuthToken,
  assignSuperAdminClaim,
  issuePortalSessionToken,
  timingSafeStringEqual,
  requireAdminAuth,
  createMerchantAccount,
  resetMerchantSecret,
  setMerchantAccountDisabled,
  deleteMerchantAccount,
  listMerchantAccountsPublic,
  authenticateMerchantLogin,
} from './adminAuth.ts';
import { registerMerchantPartner, removeMerchantPartner } from './financeService.ts';
import { getOpsDashboardData } from './opsService.ts';

const router = express.Router();

// Server-side brute-force rate-limit & lockout trackers (Admin PIN & WhatsApp OTP)
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
const pinAttemptsByIp = new Map<string, { failedCount: number; lockedUntil: number }>();

const MAX_OTP_SEND_PER_HOUR = 6;
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
const otpSendByPhone = new Map<string, { lastSentAt: number; hourlyCount: number; windowStart: number }>();

const MAX_OTP_VERIFY_ATTEMPTS = 5;
const whatsappOtpStore = new Map<string, { code: string; expiresAt: number; failedAttempts: number }>();

function getClientIp(req: express.Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || '127.0.0.1';
}

export function resetAuthRateLimitsForTest(): void {
  pinAttemptsByIp.clear();
  otpSendByPhone.clear();
  whatsappOtpStore.clear();
}

/**
 * Verify Admin Portal PIN strictly server-side with lockout.
 * Unified Merchant PIN has been REMOVED: merchants must authenticate via /api/auth/merchant-login
 * with their dedicated per-restaurant username and 8-digit secret code.
 */
router.post('/verify-portal-pin', (req, res) => {
  const { pin, portalType } = req.body || {};

  if (portalType === 'merchant') {
    return res.status(403).json({
      success: false,
      error:
        'تم إلغاء الرمز الموحد للمطاعم. يرجى تسجيل الدخول باستخدام اسم المستخدم والرمز السري الخاص بمطعمك.',
    });
  }

  const ip = getClientIp(req);
  const now = Date.now();
  const attemptRecord = pinAttemptsByIp.get(ip);

  if (attemptRecord && attemptRecord.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((attemptRecord.lockedUntil - now) / 1000);
    return res.status(429).json({
      success: false,
      locked: true,
      retryAfterSeconds,
      error: `تم تجاوز عدد محاولات الدخول. يرجى الانتظار ${Math.ceil(retryAfterSeconds / 60)} دقيقة.`,
    });
  }

  const expectedPin = (process.env.PORTAL_ACCESS_PIN || '').trim();
  if (!expectedPin) {
    return res.status(503).json({
      success: false,
      notConfigured: true,
      error:
        'رمز دخول الأدمن الاحتياطي غير مضبوط في متغيرات البيئة (PORTAL_ACCESS_PIN). يرجى تسجيل الدخول عبر حساب Google للمشرف.',
    });
  }

  const provided = typeof pin === 'string' ? pin.trim() : '';

  if (!provided || provided.length > 64) {
    return res.status(400).json({ success: false, error: 'PIN is required' });
  }

  const valid = timingSafeStringEqual(provided, expectedPin);

  if (!valid) {
    const prevCount =
      attemptRecord && attemptRecord.lockedUntil <= now && attemptRecord.failedCount >= MAX_PIN_ATTEMPTS
        ? 0
        : attemptRecord?.failedCount || 0;
    const nextCount = prevCount + 1;
    const lockedUntil = nextCount >= MAX_PIN_ATTEMPTS ? now + PIN_LOCKOUT_MS : 0;
    pinAttemptsByIp.set(ip, { failedCount: nextCount, lockedUntil });

    if (lockedUntil > 0) {
      return res.status(429).json({
        success: false,
        locked: true,
        retryAfterSeconds: Math.ceil(PIN_LOCKOUT_MS / 1000),
        error: 'تم قفل محاولات الدخول مؤقتاً لمدة 15 دقيقة بسبب تكرار المحاولات الخاطئة.',
      });
    }

    return res.status(401).json({
      success: false,
      attemptsRemaining: MAX_PIN_ATTEMPTS - nextCount,
      error: 'Invalid admin portal access PIN',
    });
  }

  // Successful Admin PIN login resets brute-force counter and issues signed admin token
  pinAttemptsByIp.delete(ip);
  const portalToken = issuePortalSessionToken('admin');

  return res.status(200).json({
    success: true,
    portalToken,
    scope: 'admin',
  });
});

/**
 * Per-Restaurant Login Endpoint (Username + 8-digit Secret Code)
 * - Verifies strictly on the server using scrypt + per-merchant salt + crypto.timingSafeEqual.
 * - Independent lockout per restaurant: 5 failed attempts = 15-minute lockout for that restaurant only.
 * - Generic error message that never reveals whether username exists.
 * - Issues HMAC-SHA256 portalToken containing authoritative merchantId and short expiration.
 */
router.post('/merchant-login', async (req, res) => {
  try {
    const { username, secretCode } = req.body || {};
    const result = await authenticateMerchantLogin(
      typeof username === 'string' ? username : '',
      typeof secretCode === 'string' ? secretCode : ''
    );
    return res.status(result.statusCode).json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

/**
 * Admin-only: List all restaurant accounts (public info only; never returns secretHash or salt)
 */
router.get('/merchants', requireAdminAuth, (_req, res) => {
  const accounts = listMerchantAccountsPublic();
  return res.status(200).json({
    success: true,
    accounts,
  });
});

/**
 * Admin-only: Create a new restaurant account with unique username & random 8-digit secret code
 * Secret code is returned ONCE to the Admin and never stored in plaintext.
 */
router.post('/merchants/create', requireAdminAuth, async (req, res) => {
  try {
    const { merchantId, name, nameAr, phone, category, neighborhood, neighborhoodAr } = req.body || {};
    const created = await createMerchantAccount({
      merchantId: typeof merchantId === 'string' ? merchantId : undefined,
      name: typeof name === 'string' && name.trim() ? name : String(nameAr || ''),
      nameAr: typeof nameAr === 'string' && nameAr.trim() ? nameAr : String(name || ''),
      phone: typeof phone === 'string' ? phone : '',
    });

    const partner = registerMerchantPartner({
      id: created.account.merchantId,
      username: created.account.username,
      name: created.account.name,
      nameAr: created.account.nameAr,
      phone: created.account.phone,
      disabled: false,
      category: category || 'restaurants_cafeterias',
      neighborhood: neighborhood || 'Ras Al Khaimah',
      neighborhoodAr: neighborhoodAr || 'رأس الخيمة',
      commissionPercent: 15,
      isVerified: true,
      totalSalesAed: 0,
      activeListingsCount: 0,
      rating: 5.0,
    });

    return res.status(201).json({
      success: true,
      account: created.account,
      partner,
      oneTimeSecretCode: created.oneTimeSecretCode,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(400).json({ success: false, error: msg });
  }
});

/**
 * Admin-only: Reset a restaurant's 8-digit secret code (returns new code ONCE, revokes active tokens)
 */
router.post('/merchants/:merchantId/reset-secret', requireAdminAuth, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const result = await resetMerchantSecret(merchantId);
    return res.status(200).json({
      success: true,
      account: result.account,
      oneTimeSecretCode: result.oneTimeSecretCode,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes('MERCHANT_NOT_FOUND') ? 404 : 400;
    return res.status(status).json({ success: false, error: msg });
  }
});

/**
 * Admin-only: Suspend or Reactivate a restaurant account (immediately invalidates active sessions when disabled)
 */
router.post('/merchants/:merchantId/status', requireAdminAuth, async (req, res) => {
  try {
    const { merchantId } = req.params;
    const { disabled } = req.body || {};
    const account = await setMerchantAccountDisabled(merchantId, Boolean(disabled));
    registerMerchantPartner({
      id: account.merchantId,
      username: account.username,
      name: account.name,
      nameAr: account.nameAr,
      phone: account.phone,
      disabled: account.disabled,
      category: 'restaurants_cafeterias',
      neighborhood: 'Ras Al Khaimah',
      neighborhoodAr: 'رأس الخيمة',
      commissionPercent: 15,
      isVerified: !account.disabled,
      totalSalesAed: 0,
      activeListingsCount: 0,
      rating: 4.9,
    });
    return res.status(200).json({
      success: true,
      account,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const status = msg.includes('MERCHANT_NOT_FOUND') ? 404 : 400;
    return res.status(status).json({ success: false, error: msg });
  }
});

/**
 * Admin-only: Permanently delete a restaurant account from server memory and Firestore
 */
router.delete('/merchants/:merchantId', requireAdminAuth, async (req, res) => {
  try {
    const { merchantId } = req.params;
    await deleteMerchantAccount(merchantId);
    removeMerchantPartner(merchantId);
    return res.status(200).json({
      success: true,
      deletedMerchantId: merchantId,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ success: false, error: msg });
  }
});

/**
 * Endpoint to verify any Firebase ID Token with revocation check
 */
router.post('/verify-token', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ valid: false, error: 'Missing Authorization header' });
  }

  const result = await verifyAuthToken(authHeader, true);
  if (!result.valid) {
    return res.status(401).json(result);
  }

  return res.status(200).json(result);
});

/**
 * Protected Admin Endpoint: Only accessible by users with super_admin role
 */
router.get('/admin-protected-resource', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const result = await verifyAuthToken(authHeader, true);
  if (!result.valid) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or revoked token', details: result.error });
  }

  if (result.role !== 'super_admin') {
    return res.status(403).json({
      error: 'Forbidden: Super Admin privilege required',
      currentRole: result.role,
      uid: result.uid,
    });
  }

  return res.status(200).json({
    success: true,
    message: 'مرحباً بكِ في البوابة الإدارية العليا لـ فلاستر Flaster',
    adminUid: result.uid,
    role: result.role,
    verifiedAt: new Date().toISOString(),
  });
});

/**
 * Protected Endpoint: Assign Admin Role (Only accessible by authenticated super_admin)
 */
router.post('/assign-admin', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const caller = await verifyAuthToken(authHeader, true);
  if (!caller.valid || !caller.uid) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or revoked token', details: caller.error });
  }

  if (caller.role !== 'super_admin') {
    return res.status(403).json({
      error: 'Forbidden: Only an existing Super Admin can assign administrative privileges',
      callerRole: caller.role,
    });
  }

  const { targetUid } = req.body || {};
  if (!targetUid || typeof targetUid !== 'string') {
    return res.status(400).json({ error: 'Bad Request: targetUid is required' });
  }

  try {
    const result = await assignSuperAdminClaim(targetUid, caller.uid);
    return res.status(200).json({
      success: true,
      message: 'Admin role assigned successfully',
      result,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: msg });
  }
});

/**
 * Endpoint: Send Official WhatsApp OTP (with per-phone cooldown & hourly rate limiting)
 */
router.post('/send-whatsapp-otp', async (req, res) => {
  try {
    const { phone } = req.body || {};
    if (!phone || typeof phone !== 'string') {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 7 || cleanPhone.length > 15) {
      return res.status(400).json({ success: false, error: 'رقم الهاتف غير صالح' });
    }
    const e164 = cleanPhone.startsWith('971') ? `+${cleanPhone}` : `+971${cleanPhone.replace(/^0+/, '')}`;

    const now = Date.now();
    const rateEntry = otpSendByPhone.get(e164);
    if (rateEntry) {
      if (now - rateEntry.lastSentAt < OTP_RESEND_COOLDOWN_MS) {
        const waitSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - rateEntry.lastSentAt)) / 1000);
        return res.status(429).json({
          success: false,
          error: `يرجى الانتظار ${waitSec} ثانية قبل طلب رمز جديد.`,
        });
      }
      if (now - rateEntry.windowStart < 60 * 60 * 1000) {
        if (rateEntry.hourlyCount >= MAX_OTP_SEND_PER_HOUR) {
          return res.status(429).json({
            success: false,
            error: 'تم تجاوز الحد الأقصى لطلبات رمز التحقق خلال الساعة. يرجى المحاولة لاحقاً.',
          });
        }
        rateEntry.hourlyCount += 1;
        rateEntry.lastSentAt = now;
      } else {
        otpSendByPhone.set(e164, { lastSentAt: now, hourlyCount: 1, windowStart: now });
      }
    } else {
      otpSendByPhone.set(e164, { lastSentAt: now, hourlyCount: 1, windowStart: now });
    }

    // Generate cryptographically random 6-digit code
    const code = String(crypto.randomInt(100000, 1000000));
    const expiresAt = now + 10 * 60 * 1000; // 10 minutes

    whatsappOtpStore.set(e164, { code, expiresAt, failedAttempts: 0 });

    const whatsappToken = (process.env.META_WHATSAPP_TOKEN || process.env.WHATSAPP_API_TOKEN || '').trim();
    const whatsappPhoneId = (process.env.META_WHATSAPP_PHONE_ID || process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim();

    let sentViaMetaCloud = false;

    if (whatsappToken && whatsappPhoneId) {
      try {
        const metaRes = await fetch(`https://graph.facebook.com/v19.0/${whatsappPhoneId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${whatsappToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            to: e164.replace('+', ''),
            type: 'text',
            text: {
              preview_url: false,
              body: `رمز التحقق الخاص بك لتسجيل الدخول في منصة فلاستر (Flaster) هو: ${code}\n\nصالح لمدة 10 دقائق. أهلاً بك في منصة حفظ النعمة في الإمارات! 🇦🇪`,
            },
          }),
        });

        if (metaRes.ok) {
          sentViaMetaCloud = true;
        } else {
          const metaData = await metaRes.json().catch(() => ({}));
          console.warn(`[WhatsApp OTP] Meta Cloud API status ${metaRes.status}:`, JSON.stringify(metaData));
        }
      } catch (metaErr) {
        console.error('[WhatsApp OTP] Meta Cloud API request failed:', metaErr);
      }
    }

    const messageText = `مرحباً فلاستر Flaster، رمز التحقق لتسجيل دخولي هو: ${code}`;
    const directWhatsAppUrl = `https://wa.me/971504116994?text=${encodeURIComponent(messageText)}`;
    const isProd = process.env.NODE_ENV === 'production';

    return res.status(200).json({
      success: true,
      phone: e164,
      // Only expose preview OTP code in non-production when Meta Cloud API is unconfigured
      ...(!sentViaMetaCloud && !isProd ? { code } : {}),
      sentViaMetaCloud,
      directWhatsAppUrl,
      messageAr: sentViaMetaCloud
        ? 'تم إرسال رمز التحقق الرسمي عبر واتساب بنجاح.'
        : 'تم تجهيز رمز التحقق للمعاينة.',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({ success: false, error: msg });
  }
});

/**
 * Endpoint: Verify WhatsApp OTP with timingSafeEqual and brute-force attempt limit
 */
router.post('/verify-whatsapp-otp', async (req, res) => {
  try {
    const { phone, code } = req.body || {};
    if (!phone || !code || typeof phone !== 'string' || typeof code !== 'string') {
      return res.status(400).json({ success: false, error: 'Phone and code are required' });
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const e164 = cleanPhone.startsWith('971') ? `+${cleanPhone}` : `+971${cleanPhone.replace(/^0+/, '')}`;

    const record = whatsappOtpStore.get(e164);
    if (!record) {
      return res.status(400).json({
        success: false,
        error: 'لم يتم العثور على طلب تحقق لهذا الرقم أو انتهت صلاحيته. يرجى طلب رمز جديد.',
      });
    }

    if (Date.now() > record.expiresAt) {
      whatsappOtpStore.delete(e164);
      return res.status(400).json({
        success: false,
        error: 'انتهت صلاحية رمز التحقق (أكثر من 10 دقائق). يرجى طلب رمز جديد.',
      });
    }

    if (!timingSafeStringEqual(record.code, code.trim())) {
      record.failedAttempts += 1;
      if (record.failedAttempts >= MAX_OTP_VERIFY_ATTEMPTS) {
        whatsappOtpStore.delete(e164);
        return res.status(429).json({
          success: false,
          error: 'تم تجاوز الحد الأقصى لمحاولات التحقق من الرمز. يرجى طلب رمز جديد.',
        });
      }
      whatsappOtpStore.set(e164, record);
      return res.status(400).json({
        success: false,
        attemptsRemaining: MAX_OTP_VERIFY_ATTEMPTS - record.failedAttempts,
        error: 'رمز التحقق غير صحيح، يرجى التأكد من الرمز وإعادة المحاولة.',
      });
    }

    // Code is verified: consume it immediately (single-use)
    whatsappOtpStore.delete(e164);

    return res.status(200).json({
      success: true,
      verifiedPhone: e164,
      message: 'تم توثيق رقم الهاتف عبر واتساب بنجاح.',
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return res.status(500).json({ success: false, error: msg });
  }
});

/**
 * Admin-Only Operational Readiness, Security Logs & Service Status
 */
router.get('/ops-status', requireAdminAuth, (_req, res) => {
  return res.status(200).json({
    success: true,
    ops: getOpsDashboardData(),
  });
});

export default router;
