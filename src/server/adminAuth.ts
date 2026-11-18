import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type express from 'express';
import { ADMIN_EMAIL_ALLOWLIST } from '../config/platformConfig.ts';
import { INITIAL_MERCHANT_PARTNERS } from '../data/mockData.ts';
import type { MerchantAccountPublicInfo } from '../types/index.ts';

let firebaseConfig = {
  projectId: 'inspiring-stack-w3rp2',
  firestoreDatabaseId: 'ai-studio-barakahbitesuaes-cceba63d-44f9-41e2-9a10-0a01f193ce19',
};

try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf8');
    firebaseConfig = JSON.parse(raw);
  }
} catch {
  // safe fallback
}

// Initialize Firebase Admin with designated cloud project ID
if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

export const adminAuth = getAuth();
// Designated named Firestore Database ID as provisioned
export const adminDb = getFirestore(firebaseConfig.firestoreDatabaseId);

// Ephemeral per-process CSPRNG secrets for local dev/test when env vars are unset
// Strictly NEVER static hardcoded literals in source code.
let ephemeralSessionSecret: string | null = null;
let ephemeralPickupPepper: string | null = null;

export function getPortalSessionSecret(): string {
  const configured = (process.env.PORTAL_SESSION_SECRET || '').trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CONFIGURATION_ERROR: PORTAL_SESSION_SECRET must be set in production');
  }
  if (!ephemeralSessionSecret) {
    ephemeralSessionSecret = crypto.randomBytes(32).toString('hex');
  }
  return ephemeralSessionSecret;
}

export function getPickupSecretPepper(): string {
  const configured = (process.env.PICKUP_SECRET_PEPPER || '').trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('CONFIGURATION_ERROR: PICKUP_SECRET_PEPPER must be set in production');
  }
  if (!ephemeralPickupPepper) {
    ephemeralPickupPepper = crypto.randomBytes(32).toString('hex');
  }
  return ephemeralPickupPepper;
}

export function timingSafeStringEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

// ============================================================================
// PER-MERCHANT CREDENTIALS VAULT (scrypt + per-merchant salt + timingSafeEqual)
// Strictly server-only; NEVER stores or logs plaintext secret codes.
// ============================================================================

export interface MerchantCredentialRecord {
  merchantId: string;
  username: string;
  name: string;
  nameAr: string;
  phone: string;
  salt: string; // 16 random bytes (32 hex chars) unique per merchant
  secretHash: string; // 64-byte scrypt key (128 hex chars)
  disabled: boolean;
  tokenVersion: number;
  failedAttempts: number;
  lockedUntil: number; // epoch ms
  createdAt: string;
  updatedAt: string;
}

const SCRYPT_KEYLEN = 64;
const MAX_MERCHANT_LOGIN_ATTEMPTS = 5;
const MERCHANT_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
export const GENERIC_MERCHANT_LOGIN_ERROR =
  'بيانات الدخول غير صحيحة. يرجى التأكد من اسم المستخدم والرمز السري.';

const merchantCredentialsById = new Map<string, MerchantCredentialRecord>();
const merchantIdByUsername = new Map<string, string>();

// Precomputed dummy salt & hash for constant-time non-existent username checks
const dummySalt = crypto.randomBytes(16).toString('hex');
const dummyHashBuf = crypto.scryptSync('00000000', dummySalt, SCRYPT_KEYLEN);

function deriveScryptBuffer(secretCode: string, salt: string): Buffer {
  return crypto.scryptSync(secretCode.trim(), salt, SCRYPT_KEYLEN);
}

function toPublicMerchantAccount(rec: MerchantCredentialRecord): MerchantAccountPublicInfo {
  return {
    merchantId: rec.merchantId,
    username: rec.username,
    name: rec.name,
    nameAr: rec.nameAr,
    phone: rec.phone,
    disabled: rec.disabled,
    failedAttempts: rec.failedAttempts,
    lockedUntil: rec.lockedUntil,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  };
}

function slugifyUsernameBase(input: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/^merchant-/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return cleaned || 'rak-partner';
}

function generateUniqueUsername(preferredBase: string): string {
  const base = slugifyUsernameBase(preferredBase);
  if (!merchantIdByUsername.has(base) && base.length >= 4) {
    return base;
  }
  for (let i = 0; i < 20; i += 1) {
    const candidate = `${base}-${crypto.randomInt(100, 1000)}`;
    if (!merchantIdByUsername.has(candidate)) {
      return candidate;
    }
  }
  return `${base}-${crypto.randomBytes(3).toString('hex')}`;
}

async function persistMerchantCredentialToFirestore(record: MerchantCredentialRecord): Promise<void> {
  try {
    await adminDb.collection('merchant_credentials').doc(record.merchantId).set({
      merchantId: record.merchantId,
      username: record.username,
      name: record.name,
      nameAr: record.nameAr,
      phone: record.phone,
      salt: record.salt,
      secretHash: record.secretHash,
      disabled: record.disabled,
      tokenVersion: record.tokenVersion,
      failedAttempts: record.failedAttempts,
      lockedUntil: record.lockedUntil,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  } catch {
    // Graceful fallback when Firestore Admin credentials are offline in local test mode
  }
}

// Seed initial partner restaurants with unguessable random 8-digit scrypt hashes (plaintext discarded immediately)
(function seedInitialMerchantCredentials() {
  const nowIso = new Date().toISOString();
  for (const partner of INITIAL_MERCHANT_PARTNERS) {
    const username = generateUniqueUsername(partner.id);
    const initialRandomSecret = String(crypto.randomInt(10000000, 100000000));
    const salt = crypto.randomBytes(16).toString('hex');
    const secretHash = deriveScryptBuffer(initialRandomSecret, salt).toString('hex');
    const record: MerchantCredentialRecord = {
      merchantId: partner.id,
      username,
      name: partner.name,
      nameAr: partner.nameAr,
      phone: partner.phone || '+971 50 000 0000',
      salt,
      secretHash,
      disabled: false,
      tokenVersion: 1,
      failedAttempts: 0,
      lockedUntil: 0,
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    merchantCredentialsById.set(record.merchantId, record);
    merchantIdByUsername.set(record.username, record.merchantId);
  }
})();

/**
 * Creates a new restaurant account with a unique username and random 8-digit secret code.
 * Plaintext secret code is returned ONCE to the caller and NEVER stored.
 */
export async function createMerchantAccount(params: {
  merchantId?: string;
  name: string;
  nameAr?: string;
  phone: string;
}): Promise<{
  account: MerchantAccountPublicInfo;
  oneTimeSecretCode: string;
}> {
  const cleanName = (params.name || params.nameAr || '').trim();
  const cleanNameAr = (params.nameAr || params.name || '').trim();
  const cleanPhone = (params.phone || '').trim();

  if (!cleanName) {
    throw new Error('اسم المطعم مطلوب');
  }
  if (!cleanPhone || cleanPhone.replace(/\D/g, '').length < 7) {
    throw new Error('رقم هاتف المطعم مطلوب ويجب أن يكون صحيحاً');
  }

  const rawId = (params.merchantId || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '');
  let merchantId = rawId
    ? rawId.startsWith('merchant-')
      ? rawId
      : `merchant-${rawId}`
    : `merchant-${slugifyUsernameBase(cleanName)}-${crypto.randomInt(100, 1000)}`;

  if (merchantCredentialsById.has(merchantId)) {
    merchantId = `${merchantId}-${crypto.randomInt(100, 1000)}`;
  }

  const username = generateUniqueUsername(rawId || cleanName);
  const oneTimeSecretCode = String(crypto.randomInt(10000000, 100000000)); // 8 digits
  const salt = crypto.randomBytes(16).toString('hex');
  const secretHash = deriveScryptBuffer(oneTimeSecretCode, salt).toString('hex');
  const nowIso = new Date().toISOString();

  const record: MerchantCredentialRecord = {
    merchantId,
    username,
    name: cleanName,
    nameAr: cleanNameAr,
    phone: cleanPhone,
    salt,
    secretHash,
    disabled: false,
    tokenVersion: 1,
    failedAttempts: 0,
    lockedUntil: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  merchantCredentialsById.set(merchantId, record);
  merchantIdByUsername.set(username, merchantId);
  await persistMerchantCredentialToFirestore(record);

  return {
    account: toPublicMerchantAccount(record),
    oneTimeSecretCode,
  };
}

/**
 * Resets a restaurant's 8-digit secret code, generates a new salt & scrypt hash,
 * increments tokenVersion to revoke active sessions, and returns the new code ONCE.
 */
export async function resetMerchantSecret(merchantId: string): Promise<{
  account: MerchantAccountPublicInfo;
  oneTimeSecretCode: string;
}> {
  const record = merchantCredentialsById.get(merchantId);
  if (!record) {
    throw new Error('MERCHANT_NOT_FOUND: حساب المطعم غير موجود');
  }

  const oneTimeSecretCode = String(crypto.randomInt(10000000, 100000000)); // 8 digits
  const newSalt = crypto.randomBytes(16).toString('hex');
  const newHash = deriveScryptBuffer(oneTimeSecretCode, newSalt).toString('hex');
  const nowIso = new Date().toISOString();

  record.salt = newSalt;
  record.secretHash = newHash;
  record.tokenVersion += 1;
  record.failedAttempts = 0;
  record.lockedUntil = 0;
  record.updatedAt = nowIso;

  merchantCredentialsById.set(merchantId, record);
  await persistMerchantCredentialToFirestore(record);

  return {
    account: toPublicMerchantAccount(record),
    oneTimeSecretCode,
  };
}

/**
 * Suspends or reactivates a restaurant account. Disabling immediately invalidates active sessions.
 */
export async function setMerchantAccountDisabled(
  merchantId: string,
  disabled: boolean
): Promise<MerchantAccountPublicInfo> {
  const record = merchantCredentialsById.get(merchantId);
  if (!record) {
    throw new Error('MERCHANT_NOT_FOUND: حساب المطعم غير موجود');
  }

  record.disabled = Boolean(disabled);
  record.tokenVersion += 1;
  record.updatedAt = new Date().toISOString();
  merchantCredentialsById.set(merchantId, record);
  await persistMerchantCredentialToFirestore(record);

  return toPublicMerchantAccount(record);
}

/**
 * Lists public metadata for all restaurant accounts (never includes secretHash or salt).
 */
export function listMerchantAccountsPublic(): MerchantAccountPublicInfo[] {
  return Array.from(merchantCredentialsById.values()).map(toPublicMerchantAccount);
}

/**
 * Exposes raw credential record strictly for automated security test assertions.
 */
export function getMerchantCredentialRecordForTest(
  merchantId: string
): Omit<MerchantCredentialRecord, 'name' | 'nameAr' | 'phone'> | undefined {
  const rec = merchantCredentialsById.get(merchantId);
  if (!rec) return undefined;
  return {
    merchantId: rec.merchantId,
    username: rec.username,
    salt: rec.salt,
    secretHash: rec.secretHash,
    disabled: rec.disabled,
    tokenVersion: rec.tokenVersion,
    failedAttempts: rec.failedAttempts,
    lockedUntil: rec.lockedUntil,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
  };
}

/**
 * Verifies restaurant username + 8-digit secret code on the server:
 * - Per-merchant lockout: 5 failed attempts = 15-minute lockout for that restaurant only.
 * - Constant-time comparison via crypto.scryptSync + crypto.timingSafeEqual.
 * - Generic error message that never reveals whether username exists.
 */
export async function authenticateMerchantLogin(
  usernameInput: string,
  secretCodeInput: string
): Promise<{
  success: boolean;
  statusCode: number;
  locked?: boolean;
  retryAfterSeconds?: number;
  portalToken?: string;
  merchant?: MerchantAccountPublicInfo;
  error?: string;
}> {
  const cleanUsername = (usernameInput || '').trim().toLowerCase();
  const cleanSecret = (secretCodeInput || '').trim();

  if (!cleanUsername || !cleanSecret || cleanUsername.length > 80 || cleanSecret.length > 64) {
    return {
      success: false,
      statusCode: 400,
      error: GENERIC_MERCHANT_LOGIN_ERROR,
    };
  }

  const merchantId = merchantIdByUsername.get(cleanUsername);
  const record = merchantId ? merchantCredentialsById.get(merchantId) : undefined;

  // If username does not exist, run constant-time dummy scrypt + timingSafeEqual and return generic 401
  if (!record) {
    const derivedDummy = deriveScryptBuffer(cleanSecret, dummySalt);
    crypto.timingSafeEqual(derivedDummy, dummyHashBuf);
    return {
      success: false,
      statusCode: 401,
      error: GENERIC_MERCHANT_LOGIN_ERROR,
    };
  }

  const now = Date.now();
  if (record.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return {
      success: false,
      statusCode: 429,
      locked: true,
      retryAfterSeconds,
      error: `تم حظر الدخول مؤقتاً لهذا المطعم لمدة 15 دقيقة بسبب 5 محاولات خاطئة. يرجى الانتظار ${Math.ceil(retryAfterSeconds / 60)} دقيقة.`,
    };
  }

  const derivedBuf = deriveScryptBuffer(cleanSecret, record.salt);
  const storedBuf = Buffer.from(record.secretHash, 'hex');
  const isSecretValid =
    storedBuf.length === derivedBuf.length && crypto.timingSafeEqual(derivedBuf, storedBuf);

  if (!isSecretValid) {
    const prevCount =
      record.lockedUntil <= now && record.failedAttempts >= MAX_MERCHANT_LOGIN_ATTEMPTS
        ? 0
        : record.failedAttempts;
    const nextCount = prevCount + 1;
    const lockedUntil = nextCount >= MAX_MERCHANT_LOGIN_ATTEMPTS ? now + MERCHANT_LOCKOUT_MS : 0;

    record.failedAttempts = nextCount;
    record.lockedUntil = lockedUntil;
    record.updatedAt = new Date().toISOString();
    merchantCredentialsById.set(record.merchantId, record);
    await persistMerchantCredentialToFirestore(record);

    if (lockedUntil > 0) {
      return {
        success: false,
        statusCode: 429,
        locked: true,
        retryAfterSeconds: Math.ceil(MERCHANT_LOCKOUT_MS / 1000),
        error: 'تم حظر الدخول مؤقتاً لهذا المطعم لمدة 15 دقيقة بسبب 5 محاولات خاطئة.',
      };
    }

    return {
      success: false,
      statusCode: 401,
      error: GENERIC_MERCHANT_LOGIN_ERROR,
    };
  }

  if (record.disabled) {
    return {
      success: false,
      statusCode: 401,
      error: GENERIC_MERCHANT_LOGIN_ERROR,
    };
  }

  // Successful login: reset brute-force counters and issue short-lived HMAC-SHA256 token with merchantId
  record.failedAttempts = 0;
  record.lockedUntil = 0;
  record.updatedAt = new Date().toISOString();
  merchantCredentialsById.set(record.merchantId, record);
  await persistMerchantCredentialToFirestore(record);

  const portalToken = issuePortalSessionToken('merchant', {
    merchantId: record.merchantId,
    username: record.username,
    tokenVersion: record.tokenVersion,
  });

  return {
    success: true,
    statusCode: 200,
    portalToken,
    merchant: toPublicMerchantAccount(record),
  };
}

// ============================================================================
// SIGNED PORTAL SESSION TOKENS (HMAC-SHA256 + merchantId + Short Expiration)
// ============================================================================

export interface PortalSessionClaims {
  scope: 'merchant' | 'admin';
  merchantId?: string;
  username?: string;
  ver?: number;
  iat: number;
  exp: number;
}

const DEFAULT_PORTAL_TOKEN_TTL_SECONDS = 2 * 60 * 60; // 2 hours short expiration

/**
 * Signs a short-lived HMAC-SHA256 portal session token.
 * For 'merchant' scope, merchantId is mandatory and embedded in the signed payload.
 */
export function issuePortalSessionToken(
  scope: 'merchant' | 'admin',
  options?: {
    merchantId?: string;
    username?: string;
    tokenVersion?: number;
    ttlSeconds?: number;
  }
): string {
  if (scope === 'merchant' && (!options?.merchantId || !options.merchantId.trim())) {
    throw new Error('merchantId is required when issuing a merchant portal session token');
  }

  const secret = getPortalSessionSecret();
  const nowSec = Math.floor(Date.now() / 1000);
  const ttl =
    options?.ttlSeconds !== undefined ? options.ttlSeconds : DEFAULT_PORTAL_TOKEN_TTL_SECONDS;

  const claims: PortalSessionClaims = {
    scope,
    ...(options?.merchantId ? { merchantId: options.merchantId.trim() } : {}),
    ...(options?.username ? { username: options.username.trim() } : {}),
    ...(options?.tokenVersion !== undefined ? { ver: options.tokenVersion } : {}),
    iat: nowSec,
    exp: nowSec + ttl,
  };
  const payloadB64 = Buffer.from(JSON.stringify(claims), 'utf8').toString('base64url');
  const sigHex = crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
  return `${payloadB64}.${sigHex}`;
}

/**
 * Verifies a portal session token via timingSafeEqual + expiration check + merchant revocation/suspension check.
 */
export function verifyPortalSessionToken(token: string | undefined): {
  valid: boolean;
  statusCode?: number;
  claims?: PortalSessionClaims;
  error?: string;
} {
  if (!token || typeof token !== 'string') {
    return { valid: false, statusCode: 401, error: 'Missing portal token' };
  }
  const parts = token.trim().split('.');
  if (parts.length !== 2) {
    return { valid: false, statusCode: 401, error: 'Malformed portal token' };
  }
  const [payloadB64, providedSig] = parts;
  if (!payloadB64 || !providedSig) {
    return { valid: false, statusCode: 401, error: 'Malformed portal token' };
  }

  try {
    const secret = getPortalSessionSecret();
    const expectedSig = crypto.createHmac('sha256', secret).update(payloadB64).digest('hex');
    if (!timingSafeStringEqual(providedSig, expectedSig)) {
      return { valid: false, statusCode: 401, error: 'Invalid portal token signature' };
    }
    const decoded = JSON.parse(
      Buffer.from(payloadB64, 'base64url').toString('utf8')
    ) as PortalSessionClaims;
    const nowSec = Math.floor(Date.now() / 1000);
    if (typeof decoded.exp !== 'number' || decoded.exp <= nowSec) {
      return { valid: false, statusCode: 401, error: 'Portal session expired' };
    }

    if (decoded.scope === 'merchant') {
      if (!decoded.merchantId || typeof decoded.merchantId !== 'string' || !decoded.merchantId.trim()) {
        return { valid: false, statusCode: 401, error: 'Merchant token missing merchantId' };
      }
      const record = merchantCredentialsById.get(decoded.merchantId);
      if (record) {
        if (record.disabled) {
          return {
            valid: false,
            statusCode: 403,
            error: 'Forbidden: تم إيقاف حساب هذا المطعم من قِبل الإدارة.',
          };
        }
        if (typeof decoded.ver === 'number' && decoded.ver !== record.tokenVersion) {
          return {
            valid: false,
            statusCode: 401,
            error: 'Unauthorized: تم إعادة تعيين الرمز السري للمطعم، يرجى تسجيل الدخول مجدداً.',
          };
        }
      }
    }

    return { valid: true, claims: decoded };
  } catch {
    return { valid: false, statusCode: 401, error: 'Failed to parse portal token' };
  }
}

/**
 * Assign Super Admin Custom Claim to a specific user (Server-authoritative only)
 */
export async function assignSuperAdminClaim(
  targetUid: string,
  callerUid: string
): Promise<{ success: boolean; uid: string; claims: object }> {
  if (!targetUid || typeof targetUid !== 'string' || !targetUid.trim()) {
    throw new Error('Target UID is required and must be a valid non-empty string');
  }
  if (!callerUid || typeof callerUid !== 'string' || !callerUid.trim()) {
    throw new Error('FORBIDDEN: callerUid is mandatory. Unauthenticated role assignment is prohibited');
  }

  const callerRecord = await adminAuth.getUser(callerUid);
  const callerRole = (callerRecord.customClaims as { role?: string } | undefined)?.role;
  if (callerRole !== 'super_admin') {
    throw new Error('FORBIDDEN: Only an authenticated user with super_admin role can assign administrative privileges');
  }

  const targetRecord = await adminAuth.getUser(targetUid);
  const existingClaims = targetRecord.customClaims || {};

  await adminAuth.setCustomUserClaims(targetUid, {
    ...existingClaims,
    role: 'super_admin',
  });

  const updatedRecord = await adminAuth.getUser(targetUid);
  return {
    success: true,
    uid: targetUid,
    claims: updatedRecord.customClaims || {},
  };
}

/**
 * Isolated Bootstrap Initial Admin Mechanism
 * Strictly requires ADMIN_BOOTSTRAP_SECRET from environment variables (zero hardcoded fallback)
 */
export async function bootstrapSuperAdmin(
  targetUid: string,
  bootstrapSecretKey: string
): Promise<{ success: boolean; uid: string; claims: object }> {
  const serverMasterSecret = (process.env.ADMIN_BOOTSTRAP_SECRET || '').trim();
  if (!serverMasterSecret) {
    throw new Error('CONFIGURATION_ERROR: ADMIN_BOOTSTRAP_SECRET environment variable is not set');
  }
  if (!bootstrapSecretKey || !timingSafeStringEqual(bootstrapSecretKey, serverMasterSecret)) {
    throw new Error('SECURITY VIOLATION: Invalid bootstrap master secret key');
  }
  if (!targetUid || typeof targetUid !== 'string' || !targetUid.trim()) {
    throw new Error('Target UID is required');
  }

  const targetRecord = await adminAuth.getUser(targetUid);
  const existingClaims = targetRecord.customClaims || {};

  await adminAuth.setCustomUserClaims(targetUid, {
    ...existingClaims,
    role: 'super_admin',
  });

  const updatedRecord = await adminAuth.getUser(targetUid);
  return {
    success: true,
    uid: targetUid,
    claims: updatedRecord.customClaims || {},
  };
}

/**
 * Assign Merchant Custom Claim scoped to their specific merchantId
 */
export async function assignMerchantClaim(
  targetUid: string,
  merchantId: string
): Promise<{ success: boolean; uid: string; claims: object }> {
  if (!targetUid || !merchantId) {
    throw new Error('Target UID and merchantId are required');
  }

  await adminAuth.setCustomUserClaims(targetUid, {
    role: 'merchant',
    merchantId,
  });

  const userRecord = await adminAuth.getUser(targetUid);
  return {
    success: true,
    uid: targetUid,
    claims: userRecord.customClaims || {},
  };
}

/**
 * Revoke Custom Claims and optionally revoke active refresh tokens
 */
export async function revokeUserClaims(
  targetUid: string,
  revokeTokens = true
): Promise<{ success: boolean; uid: string }> {
  if (!targetUid) throw new Error('Target UID is required');

  await adminAuth.setCustomUserClaims(targetUid, null);
  if (revokeTokens) {
    await adminAuth.revokeRefreshTokens(targetUid);
  }

  return {
    success: true,
    uid: targetUid,
  };
}

/**
 * Server-authoritative Firebase ID Token Verification with revocation check
 */
export async function verifyAuthToken(
  bearerToken: string,
  checkRevoked = true
): Promise<{
  valid: boolean;
  uid?: string;
  email?: string;
  emailVerified?: boolean;
  role?: string;
  merchantId?: string;
  error?: string;
}> {
  try {
    if (!bearerToken || typeof bearerToken !== 'string' || !bearerToken.trim()) {
      return { valid: false, error: 'Empty or missing token' };
    }
    const token = bearerToken.startsWith('Bearer ') ? bearerToken.slice(7).trim() : bearerToken.trim();
    if (!token) {
      return { valid: false, error: 'Empty or missing token' };
    }
    const decoded = await adminAuth.verifyIdToken(token, checkRevoked);
    const email = typeof decoded.email === 'string' ? decoded.email : undefined;
    const emailVerified = Boolean(decoded.email_verified);
    let role = (decoded.role as string) || 'customer';

    if (
      role === 'customer' &&
      email &&
      emailVerified &&
      ADMIN_EMAIL_ALLOWLIST.includes(email.toLowerCase())
    ) {
      role = 'super_admin';
    }

    return {
      valid: true,
      uid: decoded.uid,
      email,
      emailVerified,
      role,
      merchantId: decoded.merchantId as string | undefined,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return { valid: false, error: errorMsg };
  }
}

export interface ResolvedCaller {
  authenticated: boolean;
  role: 'super_admin' | 'ops_admin' | 'founder_admin' | 'merchant' | 'customer' | 'anonymous';
  uid?: string;
  email?: string;
  merchantId?: string;
  username?: string;
  viaPortalToken?: boolean;
  tokenError?: string;
  tokenStatusCode?: number;
}

/**
 * Resolves caller identity strictly from signed x-portal-token header or Firebase Bearer ID Token.
 * NEVER trusts merchantId from query, body, or unsigned headers.
 */
export async function resolveCallerIdentity(req: express.Request): Promise<ResolvedCaller> {
  const portalHeader = req.headers['x-portal-token'];
  const portalTokenStr = Array.isArray(portalHeader) ? portalHeader[0] : portalHeader;
  if (portalTokenStr) {
    const portalResult = verifyPortalSessionToken(portalTokenStr);
    if (portalResult.valid && portalResult.claims) {
      const isMerchant = portalResult.claims.scope === 'merchant';
      return {
        authenticated: true,
        role: isMerchant ? 'merchant' : 'super_admin',
        uid: isMerchant
          ? `merchant:${portalResult.claims.merchantId}`
          : 'portal:admin',
        merchantId: isMerchant ? portalResult.claims.merchantId : undefined,
        username: portalResult.claims.username,
        viaPortalToken: true,
      };
    }
    return {
      authenticated: false,
      role: 'anonymous',
      tokenError: portalResult.error || 'Invalid or expired portal token',
      tokenStatusCode: portalResult.statusCode || 401,
    };
  }

  const authHeader = req.headers.authorization;
  if (authHeader) {
    const fb = await verifyAuthToken(authHeader, true);
    if (fb.valid && fb.uid) {
      const normalizedRole =
        fb.role === 'super_admin' || fb.role === 'ops_admin' || fb.role === 'founder_admin'
          ? fb.role
          : fb.role === 'merchant'
            ? 'merchant'
            : 'customer';
      return {
        authenticated: true,
        role: normalizedRole,
        uid: fb.uid,
        email: fb.email,
        merchantId: fb.merchantId,
      };
    }
  }

  return { authenticated: false, role: 'anonymous' };
}

/**
 * Express middleware: Require verified Super Admin (Firebase Admin claim/allowlist OR Admin Portal Session Token)
 */
export async function requireAdminAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const caller = await resolveCallerIdentity(req);
  if (!caller.authenticated) {
    return res.status(caller.tokenStatusCode || 401).json({
      success: false,
      error: caller.tokenError || 'Unauthorized: Authentication required for executive admin access',
    });
  }
  if (
    caller.role !== 'super_admin' &&
    caller.role !== 'ops_admin' &&
    caller.role !== 'founder_admin'
  ) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Founders Admin privileges required',
    });
  }
  (req as express.Request & { caller?: ResolvedCaller }).caller = caller;
  return next();
}

/**
 * Express middleware: Require verified Merchant (with authoritative merchantId in token) or Admin
 */
export async function requireMerchantOrAdminAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const caller = await resolveCallerIdentity(req);
  if (!caller.authenticated) {
    return res.status(caller.tokenStatusCode || 401).json({
      success: false,
      error: caller.tokenError || 'Unauthorized: Merchant or Admin authentication required',
    });
  }
  if (
    caller.role !== 'merchant' &&
    caller.role !== 'super_admin' &&
    caller.role !== 'ops_admin' &&
    caller.role !== 'founder_admin'
  ) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Merchant or Admin privileges required',
    });
  }
  if (caller.role === 'merchant' && !caller.merchantId) {
    return res.status(403).json({
      success: false,
      error: 'Forbidden: Merchant token must include authoritative merchantId',
    });
  }
  (req as express.Request & { caller?: ResolvedCaller }).caller = caller;
  return next();
}
