import { adminDb } from './adminAuth.ts';
import { INITIAL_SURPLUS_ITEMS, INITIAL_MERCHANT_LISTINGS } from '../data/mockData.ts';
import type { FirestoreMerchant, FirestoreMerchantPrivate, FirestoreSurplusItem } from '../types/index.ts';

export interface SeedResult {
  success: boolean;
  merchantsCount: number;
  surplusItemsCount: number;
  merchantListingsCount: number;
  errors: string[];
}

/**
 * Normalizes an AED price to UAE Fils (Integer representation: 1 AED = 100 Fils)
 */
function aedToFils(aed: number): number {
  return Math.round(aed * 100);
}

/**
 * Seeds initial Ras Al Khaimah merchants and surplus surplus inventory into Firestore
 * Uses server-side adminDb (bypasses rules safely in server context)
 * Guarantees idempotency (uses fixed document IDs)
 */
export async function seedInitialDatabase(): Promise<SeedResult> {
  const errors: string[] = [];
  let merchantsCount = 0;
  let surplusItemsCount = 0;
  let merchantListingsCount = 0;

  const nowIso = new Date().toISOString();

  // 1. Extract and seed distinct merchants from mock data
  const merchantsMap = new Map<string, FirestoreMerchant>();
  const merchantsPrivateMap = new Map<string, FirestoreMerchantPrivate>();

  // Fixed merchant IDs derived from items
  const merchantConfigs = [
    {
      id: 'merchant-waldorf',
      name: 'Waldorf Astoria Ras Al Khaimah',
      nameAr: 'فندق والドルف أستوريا رأس الخيمة',
      category: 'buffet' as const,
      neighborhood: 'Al Hamra Village',
      neighborhoodAr: 'قرية الحمراء',
      address: 'Vienna St, Al Hamra Village, Ras Al Khaimah',
      addressAr: 'شارع فيينا، قرية الحمراء، رأس الخيمة',
      lat: 25.6882,
      lng: 55.7794,
      avatar: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=120&auto=format&fit=crop&q=80',
      ownerUid: 'system_seed_merchant_1',
      contactPhone: '+971 7 249 5555'
    },
    {
      id: 'merchant-alhamra-patisserie',
      name: 'Al Hamra Artisan Patisserie',
      nameAr: 'مخبوزات الحمراء الحرفية',
      category: 'bakery' as const,
      neighborhood: 'Al Hamra Mall Promenade',
      neighborhoodAr: 'ممشى الحمراء مول',
      address: 'Promenade Level 1, Al Hamra Mall, RAK',
      addressAr: 'مستوى الممشى الأول، الحمراء مول، رأس الخيمة',
      lat: 25.6945,
      lng: 55.7871,
      avatar: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=120&auto=format&fit=crop&q=80',
      ownerUid: 'system_seed_merchant_2',
      contactPhone: '+971 7 243 1122'
    },
    {
      id: 'merchant-sharisha-bakeries',
      name: 'Al Sharisha Gourmet Bakery',
      nameAr: 'مخبز ومطعم الشريشة الفاخر',
      category: 'bakery' as const,
      neighborhood: 'Al Sharisha (الشريشة)',
      neighborhoodAr: 'الشريشة',
      address: 'Al Sharisha Commercial St, Ras Al Khaimah',
      addressAr: 'شارع الشريشة التجاري، رأس الخيمة',
      lat: 25.7942,
      lng: 55.9754,
      avatar: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=120&auto=format&fit=crop&q=80',
      ownerUid: 'system_seed_merchant_3',
      contactPhone: '+971 50 123 4567'
    }
  ];

  // Write Merchants to Firestore
  for (const m of merchantConfigs) {
    try {
      const publicDoc: FirestoreMerchant = {
        id: m.id,
        name: m.name,
        nameAr: m.nameAr,
        verified: true,
        rating: 4.9,
        reviewsCount: 180,
        neighborhood: m.neighborhood,
        neighborhoodAr: m.neighborhoodAr,
        address: m.address,
        addressAr: m.addressAr,
        lat: m.lat,
        lng: m.lng,
        avatar: m.avatar,
        category: m.category,
        status: 'active',
        createdAt: nowIso,
        updatedAt: nowIso
      };

      const privateDoc: FirestoreMerchantPrivate = {
        merchantId: m.id,
        ownerUid: m.ownerUid,
        contactPhone: m.contactPhone,
        notificationEmail: `orders@${m.id}.ae`,
        tradeLicenseNumber: `RAK-DED-${Math.floor(100000 + Math.random() * 900000)}`,
        commissionRatePercent: 15,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      await adminDb.collection('merchants').doc(m.id).set(publicDoc, { merge: true });
      await adminDb.collection('merchants_private').doc(m.id).set(privateDoc, { merge: true });
      merchantsCount++;
    } catch (err) {
      errors.push(`Failed to seed merchant ${m.id}: ${String(err)}`);
    }
  }

  // 2. Seed Initial Surplus Items (with currency converted to Fils)
  for (const item of INITIAL_SURPLUS_ITEMS) {
    try {
      // Map to correct merchant ID
      let merchantId = 'merchant-waldorf';
      if (item.id === 'item-2') merchantId = 'merchant-alhamra-patisserie';
      if (item.category === 'bakery' && item.id !== 'item-2') merchantId = 'merchant-sharisha-bakeries';

      const surplusDoc: FirestoreSurplusItem = {
        id: item.id,
        merchantId,
        merchantName: item.merchant.name,
        merchantNameAr: item.merchant.nameAr,
        titleEn: item.title.en,
        titleAr: item.title.ar,
        descriptionEn: item.description.en,
        descriptionAr: item.description.ar,
        category: item.category,
        imageUrl: item.imageUrl,
        originalPriceFils: aedToFils(item.originalPrice),
        discountedPriceFils: aedToFils(item.discountedPrice),
        initialStock: item.stockRemaining + 2, // e.g. initial 4 if 2 remaining
        stockRemaining: item.stockRemaining,
        status: item.stockRemaining > 0 ? 'active' : 'sold_out',
        pickupStart: item.pickupStart,
        pickupEnd: item.pickupEnd,
        pickupDate: item.pickupDate,
        co2SavedKg: item.co2SavedKg,
        allergens: item.allergens || [],
        tags: item.tags || [],
        isHalal: item.isHalal,
        createdAt: nowIso,
        updatedAt: nowIso
      };

      await adminDb.collection('surplus_items').doc(item.id).set(surplusDoc, { merge: true });
      surplusItemsCount++;
    } catch (err) {
      errors.push(`Failed to seed surplus item ${item.id}: ${String(err)}`);
    }
  }

  // 3. Seed Merchant Listings (Back-office catalog)
  for (const listing of INITIAL_MERCHANT_LISTINGS) {
    try {
      const listingData = {
        ...listing,
        originalPriceFils: aedToFils(listing.originalPrice),
        discountedPriceFils: aedToFils(listing.discountedPrice),
        revenueFils: aedToFils(listing.revenueAed),
        createdAt: nowIso,
        updatedAt: nowIso
      };

      await adminDb.collection('merchant_listings').doc(listing.id).set(listingData, { merge: true });
      merchantListingsCount++;
    } catch (err) {
      errors.push(`Failed to seed merchant listing ${listing.id}: ${String(err)}`);
    }
  }

  return {
    success: errors.length === 0,
    merchantsCount,
    surplusItemsCount,
    merchantListingsCount,
    errors
  };
}
