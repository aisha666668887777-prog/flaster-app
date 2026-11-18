/**
 * A&M Tawfeer • SMART SAVING. LESS WASTE.
 * Dynamic Core Application Categories Service
 * 
 * Supports the 4 Primary Business Categories:
 * 1. Restaurants & Cafeterias (مطاعم وكفتيريات)
 * 2. Bakeries & Coffee Shops (مخابز وكوفي شوب)
 * 3. Supermarkets & Grocery Stores (أسواق ومواد غذائية)
 * 4. Home-Based Businesses (مشاريع منزلية)
 * + 'all' (جميع العروض / All Surplus)
 */

export interface DynamicCategory {
  id: string;
  name: string;             // English title
  nameAr: string;           // Arabic title
  descriptionEn: string;
  descriptionAr: string;
  icon: 'utensils' | 'coffee' | 'store' | 'home' | 'sparkles' | string;
  displayOrder: number;
  isActive: boolean;
  merchantCount: number;
}

// In-memory persistent database of core business categories
const categoriesDatabase: DynamicCategory[] = [
  {
    id: 'all',
    name: 'All Surplus Deals',
    nameAr: 'جميع العروض الفائضة',
    descriptionEn: 'Browse all verified culinary and grocery rescue deals',
    descriptionAr: 'استكشف كافة عروض إنقاذ الأطعمة الفائضة المعتمدة',
    icon: 'sparkles',
    displayOrder: 1,
    isActive: true,
    merchantCount: 8
  },
  {
    id: 'restaurants_cafeterias',
    name: 'Restaurants & Cafeterias',
    nameAr: 'مطاعم وكفتيريات',
    descriptionEn: 'Gourmet daily lunch & dinner surplus, grills, and traditional Emirati platters',
    descriptionAr: 'وجبات الغداء والعشاء الفاخرة، المشاوي والمأكولات التراثية اليومية',
    icon: 'utensils',
    displayOrder: 2,
    isActive: true,
    merchantCount: 3
  },
  {
    id: 'bakeries_coffeeshops',
    name: 'Bakeries & Coffee Shops',
    nameAr: 'مخابز وكوفي شوب',
    descriptionEn: 'Artisanal croissants, sourdough breads, French pastries, and premium coffee batches',
    descriptionAr: 'كرواسون حرفي، مخبوزات فرنسية، حلويات طازجة ومحاصيل قهوة مختصة',
    icon: 'coffee',
    displayOrder: 3,
    isActive: true,
    merchantCount: 3
  },
  {
    id: 'supermarkets_groceries',
    name: 'Supermarkets & Grocery Stores',
    nameAr: 'أسواق ومواد غذائية',
    descriptionEn: 'Fresh dairy, organic fruits, pantry essentials, and packaged food bargains',
    descriptionAr: 'منتجات الألبان، الفواكه والخضار العضوية، والمواد التموينية الاستهلاكية',
    icon: 'store',
    displayOrder: 4,
    isActive: true,
    merchantCount: 1
  },
  {
    id: 'home_businesses',
    name: 'Home-Based Businesses',
    nameAr: 'مشاريع منزلية',
    descriptionEn: 'Licensed home bakers, traditional sweets, catering boxes, and kitchen makers',
    descriptionAr: 'مشاريع المطبخ المنزلي المرخصة، الحلويات التراثية وبوكسات التوفير المنزلية',
    icon: 'home',
    displayOrder: 5,
    isActive: true,
    merchantCount: 1
  }
];

export function getAllCategories(): DynamicCategory[] {
  return [...categoriesDatabase].sort((a, b) => a.displayOrder - b.displayOrder);
}

export function getActiveCategories(): DynamicCategory[] {
  return categoriesDatabase.filter(c => c.isActive).sort((a, b) => a.displayOrder - b.displayOrder);
}

export function getCategoryById(id: string): DynamicCategory | undefined {
  return categoriesDatabase.find(c => c.id === id);
}

export function addOrUpdateCategory(cat: DynamicCategory): DynamicCategory {
  const index = categoriesDatabase.findIndex(c => c.id === cat.id);
  if (index >= 0) {
    categoriesDatabase[index] = cat;
  } else {
    categoriesDatabase.push(cat);
  }
  return cat;
}

/**
 * Normalizes legacy category IDs to the new standard 4 core categories
 */
export function normalizeCategoryId(catId: string): string {
  switch (catId) {
    case 'bakery':
    case 'cafe':
      return 'bakeries_coffeeshops';
    case 'buffet':
    case 'gourmet':
      return 'restaurants_cafeterias';
    case 'grocery':
      return 'supermarkets_groceries';
    case 'home':
      return 'home_businesses';
    default:
      return catId;
  }
}
