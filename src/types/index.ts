export type Language = 'ar' | 'en' | 'ur' | 'hi' | 'tl';

export type Category =
  | 'all'
  | 'restaurants_cafeterias'
  | 'bakeries_coffeeshops'
  | 'supermarkets_groceries'
  | 'home_businesses'
  | 'bakery'
  | 'buffet'
  | 'gourmet'
  | 'cafe'
  | 'grocery';

export type FulfillmentType = 'pickup' | 'delivery';

export type OrderWorkflowStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'out_for_delivery'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'new'
  | 'collected';

export interface DynamicRegion {
  id: string;
  name: string;
  nameAr: string;
  city: string;
  cityAr: string;
  isPilotActive: boolean;
  activeMerchantsCount: number;
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  coordinates?: { lat: number; lng: number };
  displayOrder?: number;
}

export interface DynamicCategory {
  id: Category;
  name: string;
  nameAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
  icon?: string;
  displayOrder?: number;
  isActive?: boolean;
  merchantCount?: number;
}

export interface SurplusItem {
  id: string;
  title: {
    en: string;
    ar: string;
  };
  merchant: {
    id?: string;
    name: string;
    nameAr: string;
    verified: boolean;
    rating: number;
    reviewsCount: number;
    neighborhood: string;
    neighborhoodAr: string;
    distanceKm: number;
    avatar: string;
    address: string;
    addressAr: string;
    lat: number;
    lng: number;
  };
  category: Category;
  imageUrl: string;
  discountPercent: number;
  originalPrice: number; // Display AED
  discountedPrice: number; // Display AED
  originalPriceFils?: number; // Integer UAE Fils (1 AED = 100 Fils)
  discountedPriceFils?: number; // Integer UAE Fils (1 AED = 100 Fils)
  stockRemaining: number;
  pickupStart: string; // e.g. "18:30"
  pickupEnd: string; // e.g. "20:30"
  pickupDate: 'today' | 'tomorrow';
  expiryTime?: string; // ISO string or "HH:MM" best-before/expiry timestamp
  co2SavedKg: number;
  description: {
    en: string;
    ar: string;
  };
  possibleContents: {
    en: string[];
    ar: string[];
  };
  allergens: string[];
  ingredients?: string | { en: string; ar: string };
  isHalal: boolean;
  tags: string[];
}

export interface CartItem {
  item: SurplusItem;
  quantity: number;
}

export interface UserAddress {
  id: string;
  label: string;
  type: 'home' | 'work' | 'current';
  street: string;
  buildingOrVilla: string;
  city: string;
  details?: string;
  isDefault?: boolean;
}

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  savedAddresses: UserAddress[];
  loyaltyPoints: number;
  welcomeBonusClaimed?: boolean;
  completedOrdersCount?: number;
  joinedAt: string;
}

export interface Order {
  id: string;
  code: string;
  invoiceNumber?: string;
  invoiceSequence?: number;
  item: SurplusItem;
  quantity: number;
  // Integer UAE Fils (authoritative)
  subtotalFils?: number;
  serviceFeeFils?: number;
  deliveryFeeFils?: number;
  pointsDiscountFils?: number;
  vatFils?: number;
  totalFils?: number;
  // Display AED fields
  totalAed: number;
  serviceFeeAed?: number;
  deliveryFeeAed?: number;
  pointsDiscountAed?: number;
  pointsRedeemed?: number;
  receiptNumber?: string;
  vatAed?: number;
  trn?: string;
  refundStatus?: 'none' | 'requested' | 'refunded' | 'rejected';
  refundReason?: string;
  refundedAt?: string;
  co2SavedKg: number;
  createdAt: string;
  pickupStart: string;
  pickupEnd: string;
  pickupDate: 'today' | 'tomorrow';
  status: 'active' | 'collected' | 'cancelled';
  workflowStatus?: OrderWorkflowStatus;
  fulfillmentType: FulfillmentType;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  paymentMethod?: 'apple_pay' | 'credit_card' | 'pickup_cash';
  paymentStatus?: 'paid' | 'pending_cash' | 'pending' | 'sandbox_paid' | 'failed' | 'refunded';
  paymentTransactionId?: string;
  paymentGateway?: string;
  pickupCode?: string;
}

export interface MerchantListing {
  id: string;
  title: string;
  titleAr: string;
  merchantName?: string;
  merchantNameAr?: string;
  neighborhood?: string;
  category: Category;
  imageUrl?: string;
  stock: number;
  initialStock: number;
  originalPrice: number;
  discountedPrice: number;
  originalPriceFils?: number;
  discountedPriceFils?: number;
  pickupWindow: string;
  expiryTime?: string; // e.g. "22:30" or ISO timestamp
  allergens?: string[];
  ingredients?: string;
  ingredientsAr?: string;
  status: 'active' | 'sold_out' | 'paused' | 'expired';
  revenueAed: number;
  revenueFils?: number;
}

export interface MerchantPartner {
  id: string;
  username?: string;
  disabled?: boolean;
  name: string;
  nameAr: string;
  category: Category;
  neighborhood: string;
  neighborhoodAr: string;
  commissionPercent: number; // Validated 0–50%
  isVerified: boolean;
  totalSalesAed: number;
  totalSalesFils?: number;
  activeListingsCount: number;
  rating: number;
  phone?: string;
  iban?: string;
  lat?: number;
  lng?: number;
  address?: string;
  addressAr?: string;
  avatar?: string;
}

export interface MerchantAccountPublicInfo {
  merchantId: string;
  username: string;
  name: string;
  nameAr: string;
  phone: string;
  disabled: boolean;
  failedAttempts: number;
  lockedUntil: number;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionAuditLog {
  id: string;
  merchantId: string;
  merchantName?: string;
  changedBy: string;
  oldValue: number;
  newValue: number;
  timestamp?: string;
  changedAt?: string;
}

export interface RefundAuditLog {
  id: string;
  orderId: string;
  customerId: string;
  requestedBy: string;
  amountFils: number;
  orderStatusAtRequest: string;
  outcome: 'APPROVED' | 'REJECTED';
  reason: string;
  rejectionReason?: string;
  timestamp: string;
}

export type UserRole = 'customer' | 'merchant' | 'ops_admin' | 'super_admin' | 'founder_admin';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  phone?: string | null;
  isAnonymous: boolean;
  role: UserRole;
  isAdmin?: boolean;
  merchantId?: string;
}

export interface FirestoreMerchant {
  id: string;
  name: string;
  nameAr: string;
  verified: boolean;
  rating: number;
  reviewsCount: number;
  neighborhood: string;
  neighborhoodAr: string;
  address: string;
  addressAr: string;
  lat: number;
  lng: number;
  avatar: string;
  coverImageUrl?: string;
  category: Category;
  commissionPercent?: number;
  status: 'active' | 'suspended' | 'pending_verification';
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreMerchantPrivate {
  merchantId: string;
  ownerUid: string;
  contactPhone: string;
  notificationEmail?: string;
  tradeLicenseNumber?: string;
  bankIban?: string;
  commissionRatePercent: number;
  createdAt: string;
  updatedAt: string;
}

export interface FirestoreSurplusItem {
  id: string;
  merchantId: string;
  merchantName: string;
  merchantNameAr: string;
  titleEn: string;
  titleAr: string;
  descriptionEn?: string;
  descriptionAr?: string;
  category: Category;
  imageUrl?: string;
  originalPriceFils: number;
  discountedPriceFils: number;
  initialStock: number;
  stockRemaining: number;
  status: 'active' | 'sold_out' | 'paused' | 'archived' | 'expired';
  pickupStart: string;
  pickupEnd: string;
  pickupDate: 'today' | 'tomorrow';
  expiryTime?: string;
  co2SavedKg?: number;
  allergens?: string[] | string | null;
  ingredients?: string | null;
  tags?: string[] | null;
  isHalal: boolean;
  createdAt: string;
  updatedAt: string;
}
