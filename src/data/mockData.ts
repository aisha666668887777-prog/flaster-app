import type { SurplusItem, MerchantListing, MerchantPartner } from '../types/index.ts';

/**
 * Production clean slate: zero hardcoded demo/mock food items, listings, or partners.
 * All real stores and food surplus items are managed dynamically via the Admin / Partner Portal
 * and persisted in Firestore.
 */
export const INITIAL_SURPLUS_ITEMS: SurplusItem[] = [];

export const INITIAL_MERCHANT_LISTINGS: MerchantListing[] = [];

export const INITIAL_MERCHANT_PARTNERS: MerchantPartner[] = [];

export const UAE_LOCATIONS = [
  { id: 'rak_all', name: 'All Ras Al Khaimah', nameAr: 'كل مناطق رأس الخيمة' },
  { id: 'rak_sharisha', name: 'Al Sharisha', nameAr: 'الشريشة' },
  { id: 'rak_hamra', name: 'Al Hamra Village', nameAr: 'قرية الحمراء' },
  { id: 'rak_marjan', name: 'Al Marjan Island', nameAr: 'جزيرة المرجان' },
  { id: 'rak_mina', name: 'Mina Al Arab', nameAr: 'ميناء العرب' },
  { id: 'rak_khuzam', name: 'Khuzam & Dhait', nameAr: 'خزام والظيت' },
  { id: 'rak_corniche', name: 'Old Corniche', nameAr: 'الكورنيش القديم' },
  { id: 'rak_nakheel', name: 'Al Nakheel Center', nameAr: 'مركز النخيل' },
];
