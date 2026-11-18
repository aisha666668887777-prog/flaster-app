import { auth } from './config';

const PORTAL_TOKEN_STORAGE_KEY = 'flaster_portal_token';
let inMemoryPortalToken: string | null = null;

export function setPortalSessionToken(token: string | null): void {
  inMemoryPortalToken = token;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (token) {
        window.sessionStorage.setItem(PORTAL_TOKEN_STORAGE_KEY, token);
      } else {
        window.sessionStorage.removeItem(PORTAL_TOKEN_STORAGE_KEY);
      }
    }
  } catch {
    // Ignore sessionStorage restrictions in sandboxed iframes
  }
}

export function getPortalSessionToken(): string | null {
  if (inMemoryPortalToken) return inMemoryPortalToken;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const stored = window.sessionStorage.getItem(PORTAL_TOKEN_STORAGE_KEY);
      if (stored) {
        inMemoryPortalToken = stored;
        return stored;
      }
    }
  } catch {
    // Ignore storage read failure
  }
  return null;
}

export async function getAuthHeaders(customerId?: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    const token = await auth.currentUser?.getIdToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  } catch (err) {
    console.warn('[AuthHeaders] Failed to read Firebase ID token:', err instanceof Error ? err.message : err);
  }

  const portalToken = getPortalSessionToken();
  if (portalToken) {
    headers['x-portal-token'] = portalToken;
  }

  if (customerId) {
    headers['x-customer-id'] = customerId;
  }

  return headers;
}
