export type OpsLogLevel = 'info' | 'warn' | 'error';
export type OpsLogCategory = 'auth' | 'rate_limit' | 'order' | 'payment' | 'email' | 'system';

export interface OpsLogEntry {
  id: string;
  timestamp: string;
  level: OpsLogLevel;
  category: OpsLogCategory;
  message: string;
  method?: string;
  path?: string;
  statusCode?: number;
}

const MAX_LOG_ENTRIES = 150;
const serverStartedAt = Date.now();
const opsLogs: OpsLogEntry[] = [];

const counters = {
  totalApiRequests: 0,
  rateLimitedRequests: 0,
  authFailures: 0,
  serverErrors: 0,
};

function sanitizePath(rawPath?: string): string | undefined {
  if (!rawPath) return undefined;
  // Strip query string so tokens/codes in query params are never logged
  return rawPath.split('?')[0].slice(0, 140);
}

export function recordOpsLog(entry: Omit<OpsLogEntry, 'id' | 'timestamp'>): void {
  const safeEntry: OpsLogEntry = {
    id: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
    level: entry.level,
    category: entry.category,
    message: String(entry.message || '').slice(0, 240),
    method: entry.method ? String(entry.method).slice(0, 12) : undefined,
    path: sanitizePath(entry.path),
    statusCode: typeof entry.statusCode === 'number' ? entry.statusCode : undefined,
  };

  opsLogs.unshift(safeEntry);
  if (opsLogs.length > MAX_LOG_ENTRIES) {
    opsLogs.length = MAX_LOG_ENTRIES;
  }

  if (safeEntry.category === 'rate_limit') counters.rateLimitedRequests += 1;
  if (safeEntry.statusCode === 401 || safeEntry.statusCode === 403) counters.authFailures += 1;
  if (safeEntry.statusCode && safeEntry.statusCode >= 500) counters.serverErrors += 1;

  const prefix = `[OPS:${safeEntry.category.toUpperCase()}]`;
  if (safeEntry.level === 'error') {
    console.error(prefix, safeEntry.message, safeEntry.path || '');
  } else if (safeEntry.level === 'warn') {
    console.warn(prefix, safeEntry.message, safeEntry.path || '');
  }
}

export function trackApiRequest(): void {
  counters.totalApiRequests += 1;
}

export function getHealthSnapshot() {
  return {
    status: 'ok' as const,
    uptimeSec: Math.floor((Date.now() - serverStartedAt) / 1000),
    timestamp: new Date().toISOString(),
  };
}

export function getOpsDashboardData() {
  return {
    uptimeSec: Math.floor((Date.now() - serverStartedAt) / 1000),
    counters: { ...counters },
    logs: opsLogs.slice(0, 60),
    services: {
      emailConfigured: Boolean(
        (process.env.RESEND_API_KEY || '').trim() && (process.env.EMAIL_FROM || '').trim()
      ),
      adminAlertEmailConfigured: Boolean((process.env.ADMIN_ALERT_EMAIL || '').trim()),
      whatsappConfigured: Boolean(
        (process.env.META_WHATSAPP_TOKEN || process.env.WHATSAPP_API_TOKEN || '').trim() &&
          (process.env.META_WHATSAPP_PHONE_ID || process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim()
      ),
      portalSecretConfigured: Boolean((process.env.PORTAL_SESSION_SECRET || '').trim()),
      pickupPepperConfigured: Boolean((process.env.PICKUP_SECRET_PEPPER || '').trim()),
      appUrlConfigured: Boolean((process.env.APP_URL || '').trim()),
    },
  };
}
