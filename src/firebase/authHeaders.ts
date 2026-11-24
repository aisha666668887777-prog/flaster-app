import { auth } from './config';

// Keep portal session tokens strictly in memory (avoid persisting stale tokens in browser storage)
let inMemoryPortalToken: string | null = null;

export function setPortalSessionToken(token: string | null): void {
  inMemoryPortalToken = token;
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem('flaster_portal_token');
    }
  } catch {
    // Ignore storage cleanup restrictions
  }
}

export function getPortalSessionToken(): string | null {
  return inMemoryPortalToken;
}

export async function getAuthHeaders(customerId?: string): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    if (auth.currentUser) {
      const token = await auth.currentUser.getIdToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch (err) {
    console.warn(
      '[AuthHeaders] Failed to read Firebase ID token:',
      err instanceof Error ? err.message : err
    );
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
