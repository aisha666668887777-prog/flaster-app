import { FulfillmentType, Order, OrderWorkflowStatus, RefundAuditLog, SurplusItem } from '../types';
import { getAuthHeaders } from './authHeaders';

export interface SubmitOrderPayload {
  customerId: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress?: string;
  merchantId: string;
  items: { itemId: string; quantity: number }[];
  fulfillmentType: FulfillmentType;
  paymentMethod: 'apple_pay' | 'credit_card' | 'pickup_cash';
  paymentStatus?: Order['paymentStatus'];
  paymentTransactionId?: string;
  paymentGateway?: string;
  idempotencyKey?: string;
  pointsToRedeem?: number;
}

export interface SubmitOrderResponse {
  success: boolean;
  serverRejected?: boolean;
  statusCode?: number;
  orderId?: string;
  invoiceNumber?: string;
  code?: string;
  pickupCode?: string;
  totalFils?: number;
  vatFils?: number;
  deliveryFeeFils?: number;
  subtotalFils?: number;
  pointsRedeemed?: number;
  pointsDiscountFils?: number;
  order?: Order;
  error?: string;
}

export interface UpdateOrderStatusPayload {
  orderId: string;
  newStatus: OrderWorkflowStatus | 'ready_for_pickup';
  customerId?: string;
  merchantNotes?: string;
  cancellationReason?: string;
  updatedBy?: string;
}

export interface UpdateOrderStatusResponse {
  success: boolean;
  serverRejected?: boolean;
  orderId?: string;
  previousStatus?: string;
  newStatus?: string;
  rewardInfo?: {
    success: boolean;
    pointsAwarded: number;
    welcomeBonusUnlocked: boolean;
    welcomePointsAwarded: number;
    message: string;
  };
  updatedAt?: string;
  error?: string;
}

export interface RefundOrderPayload {
  orderId: string;
  customerId?: string;
  requestedBy: string;
  reason: string;
}

export interface RefundOrderResponse {
  success: boolean;
  allowed?: boolean;
  orderId: string;
  refundStatus: 'refunded' | 'rejected';
  auditLog?: RefundAuditLog;
  messageAr?: string;
  messageEn?: string;
  error?: string;
}

export interface VerifyPickupPayload {
  orderId: string;
  pickupCode: string;
  customerId?: string;
  verifiedBy?: string;
}

export interface VerifyPickupResponse {
  success: boolean;
  serverRejected?: boolean;
  orderId?: string;
  status?: string;
  completedAt?: string;
  message?: string;
  welcomeBonusAwarded?: boolean;
  newPointsBalance?: number;
  rewardInfo?: {
    success: boolean;
    pointsAwarded: number;
    welcomeBonusUnlocked: boolean;
    welcomePointsAwarded: number;
    message: string;
  };
  error?: string;
}

/**
 * Registers a newly broadcasted SurplusItem on the authoritative server catalog (Merchant/Admin only).
 */
export async function registerCatalogItemOnBackend(item: SurplusItem): Promise<boolean> {
  try {
    const headers = await getAuthHeaders();
    const res = await fetch('/api/orders/catalog', {
      method: 'POST',
      headers,
      body: JSON.stringify({ item }),
    });
    return res.ok;
  } catch (err) {
    console.warn('[Catalog] Network error registering item on backend:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Submits an order authoritatively to the server API (/api/orders/create).
 */
export async function submitOrderToBackend(
  payload: SubmitOrderPayload
): Promise<SubmitOrderResponse> {
  try {
    const headers = await getAuthHeaders(payload.customerId);
    const res = await fetch('/api/orders/create', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ...payload,
        idempotencyKey: payload.idempotencyKey || `IDEM-${payload.customerId}-${Date.now()}`,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as SubmitOrderResponse;
    if (!res.ok || !data.success) {
      return {
        ...data,
        success: false,
        serverRejected: res.status >= 400 && res.status < 500,
        statusCode: res.status,
      };
    }
    return data;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      serverRejected: false,
      error: errorMsg,
    };
  }
}

/**
 * Fetches synchronized orders from the backend (/api/orders) scoped to caller credentials.
 */
export async function fetchOrdersFromBackend(customerId?: string): Promise<Order[]> {
  try {
    const headers = await getAuthHeaders(customerId);
    const res = await fetch('/api/orders', { headers });
    if (!res.ok) return [];
    const data = (await res.json().catch(() => ({}))) as { orders?: Order[] };
    return Array.isArray(data.orders) ? data.orders : [];
  } catch {
    return [];
  }
}

/**
 * Updates order workflow status on the server (/api/orders/update-status).
 */
export async function updateOrderStatusOnBackend(
  payload: UpdateOrderStatusPayload
): Promise<UpdateOrderStatusResponse> {
  try {
    const headers = await getAuthHeaders(payload.customerId);
    const res = await fetch('/api/orders/update-status', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as UpdateOrderStatusResponse;
    if (!res.ok || !data.success) {
      return {
        ...data,
        success: false,
        serverRejected: res.status >= 400 && res.status < 500,
        orderId: payload.orderId,
        newStatus: payload.newStatus,
      };
    }
    return data;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      serverRejected: false,
      orderId: payload.orderId,
      newStatus: payload.newStatus,
      error: errorMsg,
    };
  }
}

/**
 * Validates and processes a refund/cancel request on the server (/api/orders/refund).
 */
export async function requestOrderRefundOnBackend(
  payload: RefundOrderPayload
): Promise<RefundOrderResponse> {
  try {
    const customerKey = payload.customerId || payload.requestedBy;
    const headers = await getAuthHeaders(customerKey);
    const res = await fetch('/api/orders/refund', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        orderId: payload.orderId,
        customerId: customerKey,
        requestedBy: payload.requestedBy,
        reason: payload.reason,
      }),
    });

    const data = (await res.json().catch(() => ({}))) as RefundOrderResponse;
    return {
      ...data,
      orderId: payload.orderId,
      refundStatus: data.refundStatus || 'rejected',
      allowed: Boolean(res.ok && data.success && data.refundStatus === 'refunded'),
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      allowed: false,
      orderId: payload.orderId,
      refundStatus: 'rejected',
      error: errorMsg,
      messageAr: 'تعذر الاتصال بالخادم للتحقق من طلب الاسترداد.',
      messageEn: 'Failed to reach server to validate refund request.',
    };
  }
}

/**
 * Cryptographically verifies 6-digit pickup code via HMAC-SHA256 (/api/orders/verify-pickup).
 */
export async function verifyPickupOnBackend(
  payload: VerifyPickupPayload
): Promise<VerifyPickupResponse> {
  try {
    const headers = await getAuthHeaders(payload.customerId);
    const res = await fetch('/api/orders/verify-pickup', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    const data = (await res.json().catch(() => ({}))) as VerifyPickupResponse;
    if (!res.ok || !data.success) {
      return {
        ...data,
        success: false,
        serverRejected: res.status >= 400 && res.status < 500,
        orderId: payload.orderId,
      };
    }
    return data;
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      serverRejected: false,
      orderId: payload.orderId,
      error: errorMsg,
    };
  }
}
