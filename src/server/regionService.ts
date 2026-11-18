/**
 * A&M Tawfeer • SMART SAVING. LESS WASTE.
 * Dynamic Location & Region Service
 * 
 * Directive:
 * - No hardcoded city or region names in the user interface.
 * - All cities, regions, and neighborhoods are dynamically managed and served via API.
 * - Extensible for expanding to new emirates, cities, and zones dynamically.
 */

export interface DynamicRegion {
  id: string;
  name: string;        // English display name
  nameAr: string;      // Arabic display name
  city: string;        // Parent city / emirate
  cityAr: string;
  isPilotActive: boolean;
  activeMerchantsCount: number;
  deliveryAvailable: boolean;
  pickupAvailable: boolean;
  coordinates: {
    lat: number;
    lng: number;
  };
  displayOrder: number;
}

// In-memory persistent database of active service regions
const regionsDatabase: DynamicRegion[] = [
  {
    id: 'region-all',
    name: 'All RAK Service Zones',
    nameAr: 'جميع مناطق رأس الخيمة (الكل)',
    city: 'Ras Al Khaimah',
    cityAr: 'رأس الخيمة',
    isPilotActive: true,
    activeMerchantsCount: 25,
    deliveryAvailable: true,
    pickupAvailable: true,
    coordinates: { lat: 25.7895, lng: 55.9432 },
    displayOrder: 1
  },
  {
    id: 'region-sharisha',
    name: 'Al Sharisha',
    nameAr: 'الشريشة',
    city: 'Ras Al Khaimah',
    cityAr: 'رأس الخيمة',
    isPilotActive: true,
    activeMerchantsCount: 3,
    deliveryAvailable: true,
    pickupAvailable: true,
    coordinates: { lat: 25.7925, lng: 55.9555 },
    displayOrder: 2
  },
  {
    id: 'region-hamra',
    name: 'Al Hamra Village & Marina',
    nameAr: 'قرية ومارينا الحمراء',
    city: 'Ras Al Khaimah',
    cityAr: 'رأس الخيمة',
    isPilotActive: true,
    activeMerchantsCount: 3,
    deliveryAvailable: true,
    pickupAvailable: true,
    coordinates: { lat: 25.6882, lng: 55.7794 },
    displayOrder: 3
  },
  {
    id: 'region-khuzam',
    name: 'Khuzam & Al Dhait',
    nameAr: 'خزام والظيت',
    city: 'Ras Al Khaimah',
    cityAr: 'رأس الخيمة',
    isPilotActive: true,
    activeMerchantsCount: 4,
    deliveryAvailable: true,
    pickupAvailable: true,
    coordinates: { lat: 25.7602, lng: 55.9381 },
    displayOrder: 4
  },
  {
    id: 'region-nakheel',
    name: 'Al Nakheel Commercial Center',
    nameAr: 'النخيل',
    city: 'Ras Al Khaimah',
    cityAr: 'رأس الخيمة',
    isPilotActive: true,
    activeMerchantsCount: 3,
    deliveryAvailable: true,
    pickupAvailable: true,
    coordinates: { lat: 25.7981, lng: 55.9721 },
    displayOrder: 5
  },
  {
    id: 'region-mamourah',
    name: 'Al Mamourah',
    nameAr: 'المعمورة',
    city: 'Ras Al Khaimah',
    cityAr: 'رأس الخيمة',
    isPilotActive: true,
    activeMerchantsCount: 2,
    deliveryAvailable: true,
    pickupAvailable: true,
    coordinates: { lat: 25.8112, lng: 55.9612 },
    displayOrder: 6
  },
  {
    id: 'region-corniche',
    name: 'Old Corniche',
    nameAr: 'الكورنيش القديم',
    city: 'Ras Al Khaimah',
    cityAr: 'رأس الخيمة',
    isPilotActive: true,
    activeMerchantsCount: 2,
    deliveryAvailable: true,
    pickupAvailable: true,
    coordinates: { lat: 25.7885, lng: 55.9521 },
    displayOrder: 7
  },
  {
    id: 'region-julfar',
    name: 'Julfar & Old RAK',
    nameAr: 'جلفار ورأس الخيمة القديمة',
    city: 'Ras Al Khaimah',
    cityAr: 'رأس الخيمة',
    isPilotActive: true,
    activeMerchantsCount: 2,
    deliveryAvailable: true,
    pickupAvailable: true,
    coordinates: { lat: 25.7912, lng: 55.9685 },
    displayOrder: 8
  },
  {
    id: 'region-marjan',
    name: 'Al Marjan Island',
    nameAr: 'جزيرة المرجان',
    city: 'Ras Al Khaimah',
    cityAr: 'رأس الخيمة',
    isPilotActive: true,
    activeMerchantsCount: 2,
    deliveryAvailable: true,
    pickupAvailable: true,
    coordinates: { lat: 25.6805, lng: 55.7421 },
    displayOrder: 9
  },
  {
    id: 'region-minarab',
    name: 'Mina Al Arab',
    nameAr: 'ميناء العرب',
    city: 'Ras Al Khaimah',
    cityAr: 'رأس الخيمة',
    isPilotActive: true,
    activeMerchantsCount: 2,
    deliveryAvailable: true,
    pickupAvailable: true,
    coordinates: { lat: 25.7012, lng: 55.8012 },
    displayOrder: 10
  },
  {
    id: 'region-qusaidat',
    name: 'Al Qusaidat',
    nameAr: 'القصيدات',
    city: 'Ras Al Khaimah',
    cityAr: 'رأس الخيمة',
    isPilotActive: true,
    activeMerchantsCount: 2,
    deliveryAvailable: true,
    pickupAvailable: true,
    coordinates: { lat: 25.7721, lng: 55.9182 },
    displayOrder: 11
  },
  {
    id: 'region-kharran',
    name: 'Al Kharran',
    nameAr: 'الخران',
    city: 'Ras Al Khaimah',
    cityAr: 'رأس الخيمة',
    isPilotActive: true,
    activeMerchantsCount: 1,
    deliveryAvailable: true,
    pickupAvailable: true,
    coordinates: { lat: 25.8341, lng: 55.9123 },
    displayOrder: 12
  },
  {
    id: 'region-rams',
    name: 'Al Rams',
    nameAr: 'الرمس',
    city: 'Ras Al Khaimah',
    cityAr: 'رأس الخيمة',
    isPilotActive: true,
    activeMerchantsCount: 1,
    deliveryAvailable: true,
    pickupAvailable: true,
    coordinates: { lat: 25.8821, lng: 56.0123 },
    displayOrder: 13
  },
  {
    id: 'region-shaam',
    name: 'Shaam',
    nameAr: 'شعم',
    city: 'Ras Al Khaimah',
    cityAr: 'رأس الخيمة',
    isPilotActive: true,
    activeMerchantsCount: 1,
    deliveryAvailable: true,
    pickupAvailable: true,
    coordinates: { lat: 26.0112, lng: 56.0912 },
    displayOrder: 14
  },
  {
    id: 'region-digdaga',
    name: 'Digdaga',
    nameAr: 'الدقداقة',
    city: 'Ras Al Khaimah',
    cityAr: 'رأس الخيمة',
    isPilotActive: true,
    activeMerchantsCount: 1,
    deliveryAvailable: true,
    pickupAvailable: true,
    coordinates: { lat: 25.6812, lng: 55.9712 },
    displayOrder: 15
  },
  {
    id: 'region-ghail',
    name: 'Al Ghail',
    nameAr: 'الغيل',
    city: 'Ras Al Khaimah',
    cityAr: 'رأس الخيمة',
    isPilotActive: true,
    activeMerchantsCount: 1,
    deliveryAvailable: true,
    pickupAvailable: true,
    coordinates: { lat: 25.5212, lng: 55.9812 },
    displayOrder: 16
  }
];

export function getAllRegions(): DynamicRegion[] {
  return [...regionsDatabase].sort((a, b) => a.displayOrder - b.displayOrder);
}

export function getActiveRegions(): DynamicRegion[] {
  return regionsDatabase.filter(r => r.isPilotActive).sort((a, b) => a.displayOrder - b.displayOrder);
}

export function getRegionById(id: string): DynamicRegion | undefined {
  return regionsDatabase.find(r => r.id === id);
}

export function addOrUpdateRegion(region: DynamicRegion): DynamicRegion {
  const index = regionsDatabase.findIndex(r => r.id === region.id);
  if (index >= 0) {
    regionsDatabase[index] = region;
  } else {
    regionsDatabase.push(region);
  }
  return region;
}
