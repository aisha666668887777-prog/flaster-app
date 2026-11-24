import type express from 'express';
import { recordOpsLog } from './opsService.ts';

interface RateBucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  name: string;
  windowMs: number;
  maxRequests: number;
  skip?: (req: express.Request) => boolean;
}

const MAX_BUCKETS_PER_LIMITER = 10_000;

/**
 * Resolves the client IP safely. Requires `app.set('trust proxy', 1)` in Express
 * so Render / Cloud Run proxy headers are trusted only for the single edge hop.
 */
function resolveClientIp(req: express.Request): string {
  const raw = req.ip || req.socket?.remoteAddress || 'unknown';
  return raw.replace(/^::ffff:/, '').slice(0, 64);
}

export function createRateLimiter(options: RateLimitOptions): express.RequestHandler {
  const buckets = new Map<string, RateBucket>();

  const pruneExpired = (now: number) => {
    if (buckets.size < MAX_BUCKETS_PER_LIMITER / 2) return;
    for (const [key, bucket] of buckets.entries()) {
      if (bucket.resetAt <= now) {
        buckets.delete(key);
      }
    }
    if (buckets.size >= MAX_BUCKETS_PER_LIMITER) {
      // Drop oldest entries to guarantee bounded memory
      const excess = buckets.size - Math.floor(MAX_BUCKETS_PER_LIMITER * 0.75);
      let dropped = 0;
      for (const key of buckets.keys()) {
        buckets.delete(key);
        dropped++;
        if (dropped >= excess) break;
      }
    }
  };

  return (req, res, next) => {
    if (req.method === 'OPTIONS' || options.skip?.(req)) {
      return next();
    }

    const now = Date.now();
    pruneExpired(now);

    const ip = resolveClientIp(req);
    const existing = buckets.get(ip);

    if (!existing || existing.resetAt <= now) {
      const resetAt = now + options.windowMs;
      buckets.set(ip, { count: 1, resetAt });
      res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, options.maxRequests - 1)));
      return next();
    }

    existing.count += 1;
    const remaining = Math.max(0, options.maxRequests - existing.count);
    res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (existing.count > options.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));

      recordOpsLog({
        level: 'warn',
        category: 'rate_limit',
        message: `Rate limit exceeded (${options.name})`,
        method: req.method,
        path: req.path,
        statusCode: 429,
      });

      return res.status(429).json({
        success: false,
        rateLimited: true,
        retryAfterSeconds: retryAfterSec,
        error: `تم تجاوز الحد المسموح للطلبات. يرجى المحاولة بعد ${retryAfterSec} ثانية. / Too many requests, please retry in ${retryAfterSec}s.`,
      });
    }

    return next();
  };
}

/** Global protection for all /api/* endpoints (skips health check & HMAC-signed webhooks) */
export const globalApiRateLimiter = createRateLimiter({
  name: 'global-api',
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 180,
  skip: (req) => {
    const p = req.path || '';
    return (
      p === '/health' ||
      p === '/ziina/webhook' ||
      p === '/payments/ziina-webhook' ||
      p === '/payments/stripe-webhook' ||
      p.startsWith('/webhook/whatsapp')
    );
  },
});

/** Stricter protection on login / credential verification routes */
export const authSensitiveRateLimiter = createRateLimiter({
  name: 'auth-login',
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 25,
});

/** Protection on order creation & payment intent creation routes */
export const transactionRateLimiter = createRateLimiter({
  name: 'order-payment',
  windowMs: 5 * 60 * 1000, // 5 minutes
  maxRequests: 40,
});
