import { recordOpsLog } from './opsService.ts';

const RESEND_API_ENDPOINT = 'https://api.resend.com/emails';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Throttle admin alerts to avoid flooding the founder's inbox (max 1 alert per 5 min per key)
const lastAlertSentAt = new Map<string, number>();
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getEmailServiceStatus() {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  const fromAddress = (process.env.EMAIL_FROM || '').trim();
  const adminAlertEmail = (process.env.ADMIN_ALERT_EMAIL || '').trim();

  return {
    configured: Boolean(apiKey && fromAddress),
    provider: apiKey && fromAddress ? ('Resend' as const) : ('unconfigured' as const),
    hasAdminAlertEmail: Boolean(adminAlertEmail && EMAIL_REGEX.test(adminAlertEmail)),
  };
}

async function sendViaResend(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  const fromAddress = (process.env.EMAIL_FROM || '').trim();

  if (!apiKey || !fromAddress) {
    return { sent: false, reason: 'Email service not configured' };
  }

  const recipient = params.to.trim();
  if (!EMAIL_REGEX.test(recipient)) {
    return { sent: false, reason: 'Invalid recipient email' };
  }

  try {
    const response = await fetch(RESEND_API_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [recipient],
        subject: params.subject.slice(0, 160),
        html: params.html,
      }),
    });

    if (!response.ok) {
      recordOpsLog({
        level: 'warn',
        category: 'email',
        message: `Email provider returned status ${response.status}`,
        statusCode: response.status,
      });
      return { sent: false, reason: `HTTP ${response.status}` };
    }

    recordOpsLog({
      level: 'info',
      category: 'email',
      message: 'Transactional email delivered',
      statusCode: 200,
    });
    return { sent: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    recordOpsLog({
      level: 'error',
      category: 'email',
      message: `Email delivery failed: ${msg.slice(0, 120)}`,
    });
    return { sent: false, reason: msg };
  }
}

export async function sendOrderConfirmationEmail(params: {
  toEmail?: string;
  customerName: string;
  orderId: string;
  merchantName: string;
  totalAed: number;
  pickupCode: string;
  paymentMethod: string;
}): Promise<void> {
  if (!params.toEmail || !EMAIL_REGEX.test(params.toEmail.trim())) return;

  const safeName = escapeHtml(params.customerName || 'عميل فليستر');
  const safeOrderId = escapeHtml(params.orderId);
  const safeMerchant = escapeHtml(params.merchantName || 'مطعم شريك');
  const safePickupCode = escapeHtml(params.pickupCode);
  const safeTotal = escapeHtml(params.totalAed.toFixed(2));
  const safePayment =
    params.paymentMethod === 'pickup_cash'
      ? 'الدفع نقداً عند الاستلام (Cash on Pickup)'
      : 'مدفوع إلكترونياً (Paid Online)';

  const html = `
    <div dir="rtl" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
      <div style="background: #DC2626; color: #ffffff; padding: 20px 24px;">
        <h1 style="margin: 0; font-size: 20px;">فليستر • تأكيد الحجز</h1>
        <p style="margin: 4px 0 0; font-size: 13px; opacity: 0.9;">Flaster UAE — Order Confirmation</p>
      </div>
      <div style="padding: 24px; color: #0f172a; line-height: 1.7; font-size: 14px;">
        <p style="margin-top: 0;">مرحباً <strong>${safeName}</strong>،</p>
        <p>تم تأكيد حجزك بنجاح من <strong>${safeMerchant}</strong>. يرجى إبراز رمز الاستلام التالي عند الوصول إلى الفرع:</p>
        <div style="background: #f8fafc; border: 2px dashed #dc2626; border-radius: 12px; padding: 16px; text-align: center; margin: 18px 0;">
          <div style="font-size: 12px; color: #64748b;">رمز الاستلام (Pickup Code)</div>
          <div style="font-size: 28px; font-weight: 800; letter-spacing: 4px; color: #0f172a; margin-top: 4px;">${safePickupCode}</div>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 12px;">
          <tr><td style="padding: 6px 0; color: #64748b;">رقم الطلب:</td><td style="padding: 6px 0; font-weight: 700; text-align: left;">${safeOrderId}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">الإجمالي:</td><td style="padding: 6px 0; font-weight: 700; text-align: left;">${safeTotal} د.إ</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">طريقة الدفع:</td><td style="padding: 6px 0; font-weight: 700; text-align: left;">${safePayment}</td></tr>
        </table>
      </div>
    </div>
  `;

  await sendViaResend({
    to: params.toEmail,
    subject: `تأكيد طلبك من فليستر #${params.orderId}`,
    html,
  });
}

export async function sendAdminAlertEmail(alertKey: string, subject: string, details: string): Promise<void> {
  const adminEmail = (process.env.ADMIN_ALERT_EMAIL || '').trim();
  if (!adminEmail || !EMAIL_REGEX.test(adminEmail)) return;

  const now = Date.now();
  const prev = lastAlertSentAt.get(alertKey) || 0;
  if (now - prev < ALERT_COOLDOWN_MS) return;
  lastAlertSentAt.set(alertKey, now);

  const safeSubject = escapeHtml(subject);
  const safeDetails = escapeHtml(details);

  await sendViaResend({
    to: adminEmail,
    subject: `[Flaster Alert] ${subject}`,
    html: `
      <div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #fecaca; border-radius: 12px; background: #fff5f5; color: #0f172a;">
        <h2 style="margin-top: 0; color: #b91c1c;">تنبيه من منصة فليستر</h2>
        <p style="font-weight: 700;">${safeSubject}</p>
        <p style="font-size: 13px; color: #334155;">${safeDetails}</p>
        <p style="font-size: 11px; color: #64748b;">${new Date().toISOString()}</p>
      </div>
    `,
  });
}
