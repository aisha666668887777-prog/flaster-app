import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  SlidersHorizontal,
  X,
  ChevronDown,
  LayoutGrid,
  Check,
  MapPin,
} from 'lucide-react';
import { Category, Language, DynamicCategory, DynamicRegion } from '../types';
import { translations } from '../translations';

interface CategoryFilterProps {
  lang: Language;
  selectedCategory: Category;
  onSelectCategory: (category: Category) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterExpiringOnly: boolean;
  onToggleExpiringOnly: () => void;
  showFavoritesOnly: boolean;
  onToggleFavoritesOnly: () => void;
  isMapView: boolean;
  onToggleMapView: () => void;
  favoritesCount: number;
  categoriesList?: DynamicCategory[];
  regions?: DynamicRegion[];
  selectedLocation?: string;
  onLocationChange?: (locId: string) => void;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  lang,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  filterExpiringOnly,
  onToggleExpiringOnly,
  showFavoritesOnly,
  onToggleFavoritesOnly,
  isMapView,
  onToggleMapView,
  favoritesCount,
  regions = [],
  selectedLocation = 'region-all',
  onLocationChange,
}) => {
  const t = translations[lang];
  const isArabic = lang === 'ar';
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [regionDropdownOpen, setRegionDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const regionDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
      if (regionDropdownRef.current && !regionDropdownRef.current.contains(e.target as Node)) {
        setRegionDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unifiedCategories: { id: Category; label: string }[] = [
    { id: 'all', label: t.allCategories },
    { id: 'restaurants_cafeterias', label: t.restaurants_cafeterias },
    { id: 'bakeries_coffeeshops', label: t.bakeries_coffeeshops },
    { id: 'supermarkets_groceries', label: t.supermarkets_groceries },
    { id: 'home_businesses', label: t.home_businesses },
  ];

  const activeCategoryObj =
    unifiedCategories.find((c) => c.id === selectedCategory) || unifiedCategories[0];

  const activeRegionObj =
    regions.find((r) => r.id === selectedLocation) || regions[0] || { nameAr: 'جميع مناطق رأس الخيمة', name: 'All RAK Regions' };

  return (
    <div className="space-y-3">
      {/* Search Bar, Region Dropdown («المنطقة»), and Quick Action Tools */}
      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        
        {/* Search Bar */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 start-0 ps-3.5 flex items-center pointer-events-none text-[#64748B]">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full ps-10 pe-10 h-11 bg-[#FFFDF9] border border-[#EAE4DC] rounded-xl text-sm text-[#1C1917] placeholder-[#A8A29E] focus:outline-none focus:border-[#DC2626] focus:ring-3 focus:ring-red-600/15 shadow-2xs transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 end-0 pe-3 flex items-center text-[#A8A29E] hover:text-[#1C1917]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Tools, Region Dropdown («المنطقة») & Categories */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Region Dropdown («المنطقة») with all RAK regions */}
          <div className="relative" ref={regionDropdownRef}>
            <button
              type="button"
              onClick={() => setRegionDropdownOpen(!regionDropdownOpen)}
              className={`flex items-center justify-between gap-2 px-4 h-11 rounded-xl text-xs font-extrabold transition-all border cursor-pointer shrink-0 ${
                selectedLocation && selectedLocation !== 'region-all'
                  ? 'bg-[#6E8462] text-white border-[#6E8462] shadow-sm'
                  : 'bg-[#FFFDF9] text-[#1C1917] border-[#E8E3D8] hover:border-[#6E8462] hover:bg-[#EFF4EC]/60'
              }`}
            >
              <MapPin className={`w-4 h-4 shrink-0 ${selectedLocation && selectedLocation !== 'region-all' ? 'text-[#F4C430]' : 'text-[#6E8462]'}`} />
              <span>
                {isArabic ? 'المنطقة: ' : 'Region: '}
                <strong className="font-extrabold truncate max-w-[120px] inline-block align-bottom">
                  {isArabic ? activeRegionObj.nameAr : activeRegionObj.name}
                </strong>
              </span>
              <ChevronDown
                className={`w-4 h-4 transition-transform duration-200 ${
                  regionDropdownOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {regionDropdownOpen && (
              <div className="absolute start-0 mt-2 w-72 rounded-2xl bg-[#FFFDF9] border-2 border-[#6E8462]/40 shadow-2xl py-2 z-[70] max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3.5 py-2 text-[11px] font-extrabold text-[#78716C] border-b border-[#E8E3D8]/70 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#9E1B28]" />
                  <span>{isArabic ? 'اختر منطقة التوصيل في رأس الخيمة:' : 'Select RAK Delivery Region:'}</span>
                </div>
                <div className="py-1">
                  {regions.map((reg) => {
                    const isSelected = selectedLocation === reg.id;
                    return (
                      <button
                        key={reg.id}
                        type="button"
                        onClick={() => {
                          onLocationChange?.(reg.id);
                          setRegionDropdownOpen(false);
                        }}
                        className={`w-full text-start px-4 py-2.5 text-xs flex items-center justify-between transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#FEF9E1] text-[#9E1B28] font-extrabold'
                            : 'text-[#1C1917] font-semibold hover:bg-[#FAF8F2]'
                        }`}
                      >
                        <span className="truncate">{isArabic ? reg.nameAr : reg.name}</span>
                        {isSelected && <Check className="w-4 h-4 text-[#6E8462] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Restaurant Map Button («خريطة المطاعم») */}
          <button
            type="button"
            onClick={onToggleMapView}
            className={`flex items-center justify-center gap-1.5 px-3.5 h-11 rounded-xl text-xs font-bold transition-all border shrink-0 cursor-pointer ${
              isMapView
                ? 'bg-[#6E8462] text-white border-[#4F6345] shadow-md'
                : 'bg-[#EFF4EC] text-[#3F5136] border-[#6E8462]/40 hover:bg-[#E1ECDB]'
            }`}
          >
            <span>{isMapView ? '📋' : '🗺️'}</span>
            <span>{isMapView ? t.listView : t.mapView}</span>
          </button>

          {/* Favorites Filter */}
          <button
            type="button"
            onClick={onToggleFavoritesOnly}
            className={`flex items-center justify-center gap-1.5 px-3.5 h-11 rounded-xl text-xs font-bold transition-all border shrink-0 cursor-pointer ${
              showFavoritesOnly
                ? 'bg-[#9E1B28] text-white border-[#9E1B28] shadow-xs'
                : 'bg-[#FDF2F3] text-[#9E1B28] border-[#9E1B28]/25 hover:bg-[#FCE5E7]'
            }`}
          >
            <span>{t.favoritesOnly}</span>
            <span className="font-metric font-extrabold">({favoritesCount})</span>
          </button>

          {/* Expiring Soon */}
          <button
            type="button"
            onClick={onToggleExpiringOnly}
            className={`flex items-center justify-center gap-2 px-3.5 h-11 rounded-xl text-xs font-bold transition-all border shrink-0 cursor-pointer ${
              filterExpiringOnly
                ? 'bg-[#F4C430] text-[#2D2200] border-[#D4A017] shadow-xs'
                : 'bg-[#FEF9E1] text-[#3B2800] border-[#F4C430]/70 hover:bg-[#FDF0B8]'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#9E1B28]" />
            <span>{t.expiringSoonBtn}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
