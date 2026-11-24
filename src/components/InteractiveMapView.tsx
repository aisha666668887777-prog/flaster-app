import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Navigation,
  Star,
  Clock,
  Heart,
  Plus,
  CheckCircle2,
  ZoomIn,
  ZoomOut,
  Crosshair,
  Compass,
  Store,
  Route,
  Car,
} from 'lucide-react';
import { SurplusItem, Language, DynamicRegion } from '../types';
import { translations } from '../translations';
import { getCustomerItemPriceAed } from '../config/platformConfig';

interface InteractiveMapViewProps {
  items: SurplusItem[];
  lang: Language;
  favorites: string[];
  regions?: DynamicRegion[];
  onToggleFavorite: (itemId: string) => void;
  onSelectItem: (item: SurplusItem) => void;
  onQuickAdd: (item: SurplusItem) => void;
  onDirectCheckout: (item: SurplusItem) => void;
  onOpenAdminAddStore?: () => void;
}

/**
 * Haversine formula to calculate exact distance in kilometers between two GPS coordinates
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

export const InteractiveMapView: React.FC<InteractiveMapViewProps> = ({
  items,
  lang,
  favorites,
  onToggleFavorite,
  onSelectItem,
  onQuickAdd,
  onOpenAdminAddStore,
}) => {
  const t = translations[lang];
  const isRtl = lang === 'ar' || lang === 'ur';

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);

  const [selectedPinId, setSelectedPinId] = useState<string | null>(items[0]?.id || null);
  const [activeZone, setActiveZone] = useState<string>('all');
  const [mapStyle, setMapStyle] = useState<'streets' | 'dark' | 'satellite'>('streets');
  const [isLocating, setIsLocating] = useState<boolean>(false);

  // User's current location (starts at Ras Al Khaimah Corniche/Center so it doesn't sit right on top of a restaurant pin, and updates via GPS or dragging)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number; isLiveGps: boolean }>({
    lat: 25.7785,
    lng: 55.9365,
    isLiveGps: false,
  });

  // Default Ras Al Khaimah overview center
  const defaultCenter: [number, number] = [25.765, 55.915];
  const defaultZoom = 12;

  // Multi-language helper for map labels
  const ml = (ar: string, en: string, ur: string, hi: string, tl: string) => {
    if (lang === 'ar') return ar;
    if (lang === 'ur') return ur;
    if (lang === 'hi') return hi;
    if (lang === 'tl') return tl;
    return en;
  };

  // Predefined Ras Al Khaimah Zones with clean keywords so filtering never returns 0 accidentally
  const RAK_ZONES = [
    {
      id: 'الشريشة',
      keywords: ['الشريشة', 'sharisha'],
      label: ml('الشريشة', 'Al Sharisha', 'الشریشہ', 'अल शरीशा', 'Al Sharisha'),
      coords: { lat: 25.7925, lng: 55.9555 },
    },
    {
      id: 'الحمراء',
      keywords: ['الحمراء', 'hamra'],
      label: ml('قرية الحمراء', 'Al Hamra', 'الحمراء', 'अल हमरा', 'Al Hamra'),
      coords: { lat: 25.6882, lng: 55.7794 },
    },
    {
      id: 'المرجان',
      keywords: ['المرجان', 'marjan'],
      label: ml('جزيرة المرجان', 'Al Marjan', 'المرجان', 'अल मरजान', 'Al Marjan'),
      coords: { lat: 25.6698, lng: 55.7423 },
    },
    {
      id: 'الظيت',
      keywords: ['الظيت', 'خزام', 'dhait', 'khuzam'],
      label: ml('خزام والظيت', 'Khuzam & Al Dhait', 'خزام و الظیت', 'खुज़ाम और अल धैत', 'Khuzam & Al Dhait'),
      coords: { lat: 25.755, lng: 55.932 },
    },
    {
      id: 'النخيل',
      keywords: ['النخيل', 'nakheel', 'المنار', 'manar'],
      label: ml('النخيل والمنار', 'Al Nakheel & Manar', 'النخیل', 'अल नखील', 'Al Nakheel'),
      coords: { lat: 25.785, lng: 55.961 },
    },
  ];

  // Filter items by zone (if a zone has matches, show them; otherwise keep all items visible while panning the map)
  const zoneMatchedItems =
    activeZone === 'all'
      ? items
      : items.filter((item) => {
          const zoneDef = RAK_ZONES.find((z) => z.id === activeZone);
          const keys = zoneDef ? zoneDef.keywords : [activeZone.toLowerCase()];
          const hay = `${item.merchant.neighborhood} ${item.merchant.neighborhoodAr} ${item.merchant.address || ''} ${item.merchant.addressAr || ''}`.toLowerCase();
          return keys.some((k) => hay.includes(k.toLowerCase()));
        });

  const filteredItems = zoneMatchedItems.length > 0 ? zoneMatchedItems : items;
  const selectedItem =
    filteredItems.find((i) => i.id === selectedPinId) ||
    items.find((i) => i.id === selectedPinId) ||
    filteredItems[0] ||
    items[0];

  // Calculate distance & estimated drive minutes from user's current location to any item
  const getItemDistanceInfo = (item: SurplusItem) => {
    const mLat = item.merchant?.lat || 25.7925;
    const mLng = item.merchant?.lng || 55.9555;
    const distKm = calculateDistanceKm(userCoords.lat, userCoords.lng, mLat, mLng);
    const driveMins = Math.max(2, Math.round(distKm * 1.8));
    return { distKm, driveMins };
  };

  const selectedDistance = selectedItem ? getItemDistanceInfo(selectedItem) : null;

  // 100% Free, Keyless Tile Servers (OpenStreetMap + Esri Satellite — NEVER CartoDB!)
  const getTileUrl = (style: 'streets' | 'dark' | 'satellite') => {
    if (style === 'satellite') {
      return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    }
    // Both 'streets' and 'dark' use Official OpenStreetMap (no API key required ever!)
    // 'dark' applies the CSS filter .map-tiles-dark on the tile pane
    return 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  };

  // Rich Circular Avatar Marker with Discount Badge, Price Tag & Distance
  const createCustomMarkerIcon = (item: SurplusItem, isSelected: boolean) => {
    const { distKm } = getItemDistanceInfo(item);
    const borderColor = isSelected ? '#F59E0B' : '#DC2626';
    const scale = isSelected ? 'scale(1.1)' : 'scale(1)';

    return L.divIcon({
      className: 'custom-flaster-pin-wrapper',
      html: `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;transform:${scale};transition:all 0.2s ease;cursor:pointer;">
          <!-- Discount & Distance Top Pill -->
          <div style="margin-bottom:-5px;z-index:20;padding:1px 7px;border-radius:9999px;font-size:10px;font-weight:900;background:#DC2626;color:#FFFFFF;border:1.5px solid #FDE68A;box-shadow:0 2px 6px rgba(0,0,0,0.3);white-space:nowrap;">
            -${item.discountPercent}% • ${distKm} ${ml('كم', 'km', 'کلومیٹر', 'किमी', 'km')}
          </div>

          <!-- Circular Avatar Pin -->
          <div style="width:44px;height:44px;border-radius:9999px;padding:2.5px;background:linear-gradient(135deg,${borderColor},#DC2626);box-shadow:0 6px 14px rgba(220,38,38,0.4);position:relative;z-index:10;">
            <img 
              src="${item.merchant.avatar || item.imageUrl}" 
              style="width:100%;height:100%;border-radius:9999px;object-fit:cover;border:2px solid #FFFFFF;background:#FFF;"
              alt=""
            />
          </div>

          <!-- Pointer Triangle -->
          <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid #DC2626;margin-top:-2px;z-index:5;"></div>

          <!-- Price Tag Pill Below Pin -->
          <div style="margin-top:2px;padding:1px 8px;border-radius:8px;font-size:10px;font-weight:800;white-space:nowrap;box-shadow:0 3px 8px rgba(0,0,0,0.25);background:${
            isSelected ? '#F59E0B' : '#1C1917'
          };color:${isSelected ? '#1C1917' : '#FDE68A'};border:1px solid #F59E0B;">
            ${getCustomerItemPriceAed(item.discountedPrice).toFixed(2)} ${t.currency}
          </div>
        </div>
      `,
      iconSize: [90, 82],
      iconAnchor: [45, 62],
      popupAnchor: [0, -58],
    });
  };

  // User Location Radar Marker Icon
  const createUserLocationIcon = () =>
    L.divIcon({
      className: 'user-location-pin',
      html: `
        <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
          <div style="background:#2563EB;color:#FFFFFF;font-size:10px;font-weight:800;padding:2px 8px;border-radius:9999px;border:1.5px solid #FFFFFF;box-shadow:0 2px 6px rgba(0,0,0,0.3);white-space:nowrap;margin-bottom:4px;">
            📍 ${ml('موقعك الحالي', 'Your Location', 'آپ کا مقام', 'आपका स्थान', 'Lokasyon Mo')}
          </div>
          <div style="width:18px;height:18px;border-radius:9999px;background:#2563EB;border:3px solid #FFFFFF;box-shadow:0 0 0 6px rgba(37,99,235,0.28),0 2px 8px rgba(0,0,0,0.4);"></div>
        </div>
      `,
      iconSize: [110, 44],
      iconAnchor: [55, 35],
    });

  // Initialize Leaflet Map & Auto-Detect User GPS Location
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: defaultCenter,
        zoom: defaultZoom,
        minZoom: 10,
        maxZoom: 17,
        zoomControl: false,
        attributionControl: false,
      });

      const layer = L.tileLayer(getTileUrl(mapStyle), {
        maxZoom: 17,
      }).addTo(map);

      const routeGroup = L.layerGroup().addTo(map);
      const markersGroup = L.layerGroup().addTo(map);

      tileLayerRef.current = layer;
      routeLayerRef.current = routeGroup;
      markersLayerRef.current = markersGroup;
      mapInstanceRef.current = map;

      setTimeout(() => {
        map.invalidateSize();
      }, 150);
    }

    // Attempt silent GPS detection on mount so distance is accurate immediately
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            isLiveGps: true,
          });
        },
        () => {
          // Keep default RAK coordinates if user denies or is inside preview
        },
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Switch Map Tile Style (Streets / Dark / Satellite)
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    tileLayerRef.current.setUrl(getTileUrl(mapStyle));
  }, [mapStyle]);

  // Render User Location Pin & Dashed Distance Route Line to Selected Restaurant
  useEffect(() => {
    if (!mapInstanceRef.current || !routeLayerRef.current) return;

    routeLayerRef.current.clearLayers();

    // 1. Place or update draggable User Location Marker
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userCoords.lat, userCoords.lng]);
      userMarkerRef.current.setIcon(createUserLocationIcon());
    } else {
      const uMarker = L.marker([userCoords.lat, userCoords.lng], {
        icon: createUserLocationIcon(),
        draggable: true,
        zIndexOffset: 900,
      }).addTo(mapInstanceRef.current);

      uMarker.on('dragend', () => {
        const pos = uMarker.getLatLng();
        setUserCoords({
          lat: Number(pos.lat.toFixed(5)),
          lng: Number(pos.lng.toFixed(5)),
          isLiveGps: true,
        });
      });

      userMarkerRef.current = uMarker;
    }

    // 2. Draw Dashed Distance Line between User Location and Selected Restaurant
    if (selectedItem?.merchant?.lat && selectedItem?.merchant?.lng) {
      const mLat = selectedItem.merchant.lat;
      const mLng = selectedItem.merchant.lng;
      const { distKm, driveMins } = getItemDistanceInfo(selectedItem);

      const polyline = L.polyline(
        [
          [userCoords.lat, userCoords.lng],
          [mLat, mLng],
        ],
        {
          color: '#DC2626',
          weight: 3.5,
          dashArray: '8, 8',
          opacity: 0.9,
        }
      );
      routeLayerRef.current.addLayer(polyline);

      // Only place midpoint badge if distance > 0.6 km so it never overlaps with the user pin
      if (distKm >= 0.6) {
        const midLat = (userCoords.lat + mLat) / 2;
        const midLng = (userCoords.lng + mLng) / 2;
        const midIcon = L.divIcon({
          className: 'distance-midpoint-badge',
          html: `
            <div style="background:#FFFDF9;color:#1C1917;border:2px solid #059669;border-radius:9999px;padding:2px 9px;font-size:10px;font-weight:900;white-space:nowrap;box-shadow:0 4px 10px rgba(0,0,0,0.2);display:inline-flex;align-items:center;gap:4px;">
              <span style="color:#059669;">📏 ${distKm} ${ml('كم', 'km', 'کلومیٹر', 'किमी', 'km')}</span>
              <span style="color:#A8A29E;">•</span>
              <span style="color:#DC2626;">🚗 ~${driveMins} ${ml('د', 'min', 'منٹ', 'मिनट', 'min')}</span>
            </div>
          `,
          iconSize: [120, 24],
          iconAnchor: [60, 12],
        });
        const midMarker = L.marker([midLat, midLng], {
          icon: midIcon,
          interactive: false,
        });
        routeLayerRef.current.addLayer(midMarker);
      }
    }
  }, [userCoords, selectedItem, lang]);

  // Render Restaurant Markers
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    filteredItems.forEach((item) => {
      if (!item.merchant?.lat || !item.merchant?.lng) return;

      const isSelected = item.id === selectedPinId;
      const { distKm, driveMins } = getItemDistanceInfo(item);

      const marker = L.marker([item.merchant.lat, item.merchant.lng], {
        icon: createCustomMarkerIcon(item, isSelected),
        title: isRtl ? item.merchant.nameAr : item.merchant.name,
        zIndexOffset: isSelected ? 1000 : 100,
      });

      marker.on('click', () => {
        setSelectedPinId(item.id);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([item.merchant.lat, item.merchant.lng], 13, {
            duration: 0.7,
          });
        }
      });

      const popupContent = `
        <div style="font-family:inherit;direction:${isRtl ? 'rtl' : 'ltr'};text-align:${
        isRtl ? 'right' : 'left'
      };min-width:190px;">
          <div style="font-weight:800;font-size:13px;color:#1C1917;margin-bottom:2px;">
            ${isRtl ? item.merchant.nameAr : item.merchant.name}
          </div>
          <div style="font-size:11px;color:#059669;font-weight:800;margin-bottom:4px;">
            📏 ${ml(
              `المسافة من موقعك: ${distKm} كم (~${driveMins} دقائق)`,
              `Distance: ${distKm} km (~${driveMins} min)`,
              `آپ سے فاصلہ: ${distKm} کلومیٹر (~${driveMins} منٹ)`,
              `आपसे दूरी: ${distKm} किमी (~${driveMins} मिनट)`,
              `Distansya: ${distKm} km (~${driveMins} min)`
            )}
          </div>
          <div style="font-size:11px;color:#57534E;margin-bottom:6px;">
            📍 ${isRtl ? item.merchant.addressAr || item.merchant.neighborhoodAr : item.merchant.address || item.merchant.neighborhood}
          </div>
          <a 
            href="https://www.google.com/maps/dir/?api=1&origin=${userCoords.lat},${userCoords.lng}&destination=${item.merchant.lat},${item.merchant.lng}" 
            target="_blank" 
            rel="noopener noreferrer"
            style="display:inline-block;background:linear-gradient(90deg,#DC2626,#F59E0B);color:#FFFFFF;font-size:11px;font-weight:800;padding:5px 10px;border-radius:8px;text-decoration:none;"
          >
            ${ml(
              'ابدأ الملاحة في خرائط جوجل ↗',
              'Start Google Maps Navigation ↗',
              'گوگل میپس میں راستہ کھولیں ↗',
              'गूगल मैप्स में रास्ता खोलें ↗',
              'Buksan sa Google Maps ↗'
            )}
          </a>
        </div>
      `;
      marker.bindPopup(popupContent);

      markersLayerRef.current?.addLayer(marker);
    });
  }, [filteredItems, selectedPinId, favorites, userCoords, lang]);

  // Active Locate Me Handler
  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      if (mapInstanceRef.current && selectedItem?.merchant?.lat && selectedItem?.merchant?.lng) {
        const bounds = L.latLngBounds(
          [userCoords.lat, userCoords.lng],
          [selectedItem.merchant.lat, selectedItem.merchant.lng]
        );
        mapInstanceRef.current.flyToBounds(bounds, { padding: [60, 60], maxZoom: 14 });
      }
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setIsLocating(false);
        setUserCoords({
          lat: Number(latitude.toFixed(5)),
          lng: Number(longitude.toFixed(5)),
          isLiveGps: true,
        });

        if (mapInstanceRef.current && selectedItem?.merchant?.lat && selectedItem?.merchant?.lng) {
          const bounds = L.latLngBounds(
            [latitude, longitude],
            [selectedItem.merchant.lat, selectedItem.merchant.lng]
          );
          mapInstanceRef.current.flyToBounds(bounds, { padding: [60, 60], maxZoom: 14 });
        } else if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([latitude, longitude], 13);
        }
      },
      () => {
        setIsLocating(false);
        if (mapInstanceRef.current && selectedItem?.merchant?.lat && selectedItem?.merchant?.lng) {
          const bounds = L.latLngBounds(
            [userCoords.lat, userCoords.lng],
            [selectedItem.merchant.lat, selectedItem.merchant.lng]
          );
          mapInstanceRef.current.flyToBounds(bounds, { padding: [60, 60], maxZoom: 14 });
        }
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left/Main Column: Rich Interactive Map Canvas (8 Cols) */}
        <div className="lg:col-span-8 rounded-2xl border-2 border-amber-300 bg-[#FAF7F2] overflow-hidden shadow-xl flex flex-col">
          {/* Clean Top Control Bar Outside Map Canvas so it never blocks pins */}
          <div className="bg-stone-950 p-3 space-y-2.5 border-b border-stone-800">
            <div className="flex flex-wrap items-center justify-between gap-2">
              {/* Live Store Count & Locate Me Distance Button */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="px-3 py-1.5 rounded-xl bg-stone-900 border border-amber-400/50 text-white text-xs font-bold flex items-center gap-2">
                  <Compass className="w-4 h-4 text-amber-400" />
                  <span>{t.mapView}</span>
                  <span className="px-2 py-0.5 rounded-full bg-[#DC2626] text-white font-metric text-[10px] font-extrabold">
                    {filteredItems.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleLocateMe}
                  disabled={isLocating}
                  className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#059669] to-emerald-600 hover:from-[#047857] hover:to-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md border border-emerald-300/40 cursor-pointer transition-all active:scale-95"
                >
                  <Navigation className={`w-3.5 h-3.5 ${isLocating ? 'animate-spin' : ''}`} />
                  <span>
                    {ml(
                      'تحديد موقعي وحساب المسافة',
                      'My Location & Distance',
                      'میرا مقام اور فاصلہ',
                      'मेरा स्थान और दूरी',
                      'Lokasyon Ko at Distansya'
                    )}
                  </span>
                </button>
              </div>

              {/* Map Style Switcher (Streets / Dark / Satellite) */}
              <div className="flex items-center gap-1 bg-stone-900 p-1 rounded-xl border border-stone-700 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setMapStyle('streets')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    mapStyle === 'streets'
                      ? 'bg-amber-400 text-stone-950 font-extrabold'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  {ml('شوارع', 'Streets', 'سڑکیں', 'सड़कें', 'Kalye')}
                </button>
                <button
                  type="button"
                  onClick={() => setMapStyle('dark')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    mapStyle === 'dark'
                      ? 'bg-amber-400 text-stone-950 font-extrabold'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  {ml('ليلي', 'Dark', 'ڈارک', 'डार्क', 'Madilim')}
                </button>
                <button
                  type="button"
                  onClick={() => setMapStyle('satellite')}
                  className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                    mapStyle === 'satellite'
                      ? 'bg-amber-400 text-stone-950 font-extrabold'
                      : 'text-stone-300 hover:text-white'
                  }`}
                >
                  {ml('قمر صناعي', 'Satellite', 'سیٹلائٹ', 'सैटेलाइट', 'Satellite')}
                </button>
              </div>
            </div>

            {/* Zone Quick Filter Pills */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setActiveZone('all');
                  mapInstanceRef.current?.flyTo(defaultCenter, defaultZoom, { duration: 0.7 });
                }}
                className={`px-3 py-1 rounded-full text-[11px] font-extrabold transition-all cursor-pointer ${
                  activeZone === 'all'
                    ? 'bg-[#DC2626] text-white border border-amber-300'
                    : 'bg-stone-900 text-stone-200 hover:bg-stone-800 border border-stone-700'
                }`}
              >
                {ml('كل مناطق رأس الخيمة', 'All RAK Zones', 'تمام علاقے', 'सभी क्षेत्र', 'Lahat ng Lugar')}
              </button>
              {RAK_ZONES.map((zone) => (
                <button
                  key={zone.id}
                  type="button"
                  onClick={() => {
                    setActiveZone(zone.id);
                    if (mapInstanceRef.current) {
                      mapInstanceRef.current.flyTo([zone.coords.lat, zone.coords.lng], 13, {
                        duration: 0.7,
                      });
                    }
                  }}
                  className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
                    activeZone === zone.id
                      ? 'bg-amber-400 text-stone-950 border border-white'
                      : 'bg-stone-900 text-stone-200 hover:bg-stone-800 border border-stone-700'
                  }`}
                >
                  {zone.label}
                </button>
              ))}
            </div>
          </div>

          {/* Map Canvas Wrapper */}
          <div
            className={`relative w-full h-[380px] sm:h-[420px] bg-[#EAE4DC] ${
              mapStyle === 'dark' ? 'map-tiles-dark' : ''
            }`}
          >
            <div ref={mapContainerRef} className="w-full h-full z-[1]" />

            {/* Floating Zoom & Fit Route Controls */}
            <div className="absolute top-3 end-3 z-[400] flex flex-col gap-1.5 bg-stone-950/90 backdrop-blur-md p-1.5 rounded-xl shadow-lg border border-stone-700">
              <button
                type="button"
                onClick={() => mapInstanceRef.current?.zoomIn()}
                className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => mapInstanceRef.current?.zoomOut()}
                className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-white flex items-center justify-center transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (
                    mapInstanceRef.current &&
                    selectedItem?.merchant?.lat &&
                    selectedItem?.merchant?.lng
                  ) {
                    const bounds = L.latLngBounds(
                      [userCoords.lat, userCoords.lng],
                      [selectedItem.merchant.lat, selectedItem.merchant.lng]
                    );
                    mapInstanceRef.current.flyToBounds(bounds, { padding: [60, 60], maxZoom: 14 });
                  } else {
                    mapInstanceRef.current?.flyTo(defaultCenter, defaultZoom);
                  }
                }}
                className="w-8 h-8 rounded-lg bg-amber-400 hover:bg-amber-300 text-stone-950 flex items-center justify-center transition-colors cursor-pointer"
                title={ml(
                  'إظهار المسار بين موقعك والمطعم',
                  'Show Route Between You & Restaurant',
                  'اپنے اور ریسٹورنٹ کے درمیان راستہ دکھائیں',
                  'अपने और रेस्तरां के बीच का रास्ता दिखाएं',
                  'Ipakita ang Ruta sa Pagitan Mo at ng Restawran'
                )}
              >
                <Route className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveZone('all');
                  mapInstanceRef.current?.flyTo(defaultCenter, defaultZoom);
                }}
                className="w-8 h-8 rounded-lg bg-stone-800 hover:bg-stone-700 text-emerald-400 flex items-center justify-center transition-colors cursor-pointer"
                title="Reset Map"
              >
                <Crosshair className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Selected Restaurant Card & Live Distance Banner at Bottom of Map */}
          {selectedItem && selectedDistance && (
            <div className="bg-[#FFFDF9] border-t border-[#EAE4DC] p-4 space-y-3">
              {/* Highlighted Distance Calculation Bar between User's Current Location & Restaurant */}
              <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs">
                <div className="flex items-center gap-2 font-extrabold text-[#1C1917]">
                  <span className="w-6 h-6 rounded-lg bg-[#059669] text-white flex items-center justify-center shrink-0">
                    <Route className="w-3.5 h-3.5" />
                  </span>
                  <span>
                    {ml(
                      `المسافة الفاصلة بين موقعك الحالي ومطعم ${selectedItem.merchant.nameAr}:`,
                      `Distance from your current location to ${selectedItem.merchant.name}:`,
                      `آپ کے موجودہ مقام سے ${selectedItem.merchant.nameAr} تک کا فاصلہ:`,
                      `आपके वर्तमान स्थान से ${selectedItem.merchant.name} की दूरी:`,
                      `Distansya mula sa iyong lokasyon papuntang ${selectedItem.merchant.name}:`
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2 font-metric">
                  <span className="px-2.5 py-1 rounded-lg bg-[#059669] text-white font-black text-xs shadow-xs">
                    📏 {selectedDistance.distKm}{' '}
                    {ml('كم', 'km', 'کلومیٹر', 'किमी', 'km')}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-amber-300 text-stone-950 font-extrabold text-xs flex items-center gap-1">
                    <Car className="w-3.5 h-3.5 text-[#DC2626]" />
                    <span>
                      ~{selectedDistance.driveMins}{' '}
                      {ml(
                        'دقائق بالسيارة',
                        'min drive',
                        'منٹ ڈرائیو',
                        'मिनट ड्राइव',
                        'min biyahe'
                      )}
                    </span>
                  </span>
                </div>
              </div>

              {/* Selected Restaurant Details & Actions */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div
                  onClick={() => onSelectItem(selectedItem)}
                  className="flex items-center gap-3.5 w-full sm:w-auto cursor-pointer group flex-1"
                >
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 border-2 border-amber-400 bg-amber-50">
                    <img
                      src={selectedItem.imageUrl}
                      alt={isRtl ? selectedItem.title.ar : selectedItem.title.en}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className="absolute top-1 start-1 px-1.5 py-0.5 rounded-full bg-[#DC2626] text-white font-metric font-extrabold text-[10px] shadow">
                      -{selectedItem.discountPercent}%
                    </span>
                  </div>

                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-xs text-[#78716C]">
                      <span className="font-extrabold text-[#1C1917] truncate">
                        {isRtl ? selectedItem.merchant.nameAr : selectedItem.merchant.name}
                      </span>
                      {selectedItem.merchant.verified && (
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#059669] shrink-0" />
                      )}
                      <span>•</span>
                      <span className="font-metric text-amber-600 font-bold flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {selectedItem.merchant.rating}
                      </span>
                    </div>

                    <h4 className="font-headline font-bold text-sm sm:text-base text-[#1C1917] line-clamp-1 group-hover:text-[#DC2626] transition-colors">
                      {isRtl ? selectedItem.title.ar : selectedItem.title.en}
                    </h4>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#57534E]">
                      <span className="inline-flex items-center gap-1 font-bold text-[#DC2626]">
                        <MapPin className="w-3.5 h-3.5 text-[#DC2626]" />
                        <span>
                          {isRtl
                            ? selectedItem.merchant.addressAr ||
                              selectedItem.merchant.neighborhoodAr
                            : selectedItem.merchant.address || selectedItem.merchant.neighborhood}
                        </span>
                      </span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-1 text-amber-950 bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-300 font-semibold">
                        <Clock className="w-3 h-3 text-amber-700" />
                        <span>
                          {selectedItem.pickupStart} - {selectedItem.pickupEnd}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#EAE4DC]">
                  <div className="text-start sm:text-end font-metric pe-2">
                    <span className="text-[11px] text-[#A8A29E] line-through block">
                      {selectedItem.originalPrice} {t.currency}
                    </span>
                    <span className="font-headline font-extrabold text-xl text-[#059669] tabular-nums">
                      {getCustomerItemPriceAed(selectedItem.discountedPrice).toFixed(2)}{' '}
                      <span className="text-xs text-[#DC2626] font-bold">{t.currency}</span>
                    </span>
                  </div>

                  {selectedItem.merchant?.lat && selectedItem.merchant?.lng && (
                    <a
                      href={`https://www.google.com/maps/dir/?api=1&origin=${userCoords.lat},${userCoords.lng}&destination=${selectedItem.merchant.lat},${selectedItem.merchant.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-10 px-3 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-[#059669] text-xs font-extrabold flex items-center gap-1.5 transition-colors"
                    >
                      <Navigation className="w-3.5 h-3.5 text-[#059669]" />
                      <span>
                        {ml('الاتجاهات', 'Directions', 'راستہ', 'दिशा-निर्देश', 'Direksyon')}
                      </span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => onToggleFavorite(selectedItem.id)}
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer ${
                      favorites.includes(selectedItem.id)
                        ? 'bg-rose-50 border-rose-300 text-[#DC2626]'
                        : 'bg-[#FFFDF9] border-[#EAE4DC] text-stone-400 hover:text-[#DC2626]'
                    }`}
                  >
                    <Heart
                      className={`w-5 h-5 ${
                        favorites.includes(selectedItem.id)
                          ? 'fill-[#DC2626] text-[#DC2626]'
                          : ''
                      }`}
                    />
                  </button>

                  <button
                    type="button"
                    onClick={() => onQuickAdd(selectedItem)}
                    className="h-10 px-4 rounded-xl bg-[#DC2626] hover:bg-[#B91C1C] text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{t.quickAdd}</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right/Side Column: Interactive Restaurant List with Live Distance from User (4 Cols) */}
        <div className="lg:col-span-4 bg-[#FFFDF9] rounded-2xl border border-[#EAE4DC] shadow-md flex flex-col overflow-hidden max-h-[640px]">
          <div className="p-4 bg-[#DC2626] text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-amber-200" />
              <h3 className="font-headline font-extrabold text-xs sm:text-sm">
                {ml(
                  'قائمة المطاعم والمسافة من موقعك',
                  'Restaurants & Distance From You',
                  'ریسٹورنٹس اور آپ سے فاصلہ',
                  'रेस्तरां और आपसे दूरी',
                  'Mga Restawran at Distansya Mula sa Iyo'
                )}
              </h3>
            </div>
            <span className="bg-black/25 text-white font-metric text-[11px] font-bold px-2 py-0.5 rounded-full">
              {filteredItems.length}
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-[#EAE4DC] p-2.5 space-y-2">
            {filteredItems.map((item) => {
              const isSelected = item.id === selectedPinId;
              const { distKm, driveMins } = getItemDistanceInfo(item);

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedPinId(item.id);
                    if (mapInstanceRef.current && item.merchant?.lat && item.merchant?.lng) {
                      mapInstanceRef.current.flyTo([item.merchant.lat, item.merchant.lng], 13, {
                        duration: 0.7,
                      });
                    }
                  }}
                  className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center gap-3 ${
                    isSelected
                      ? 'bg-amber-50/90 border-[#DC2626] ring-2 ring-red-500/15 shadow-sm'
                      : 'bg-white hover:bg-[#FAF7F2] border-[#EAE4DC]'
                  }`}
                >
                  <img
                    src={item.merchant.avatar || item.imageUrl}
                    alt={isRtl ? item.merchant.nameAr : item.merchant.name}
                    className="w-13 h-13 rounded-xl object-cover border border-amber-300 shrink-0"
                  />

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="font-headline font-extrabold text-xs text-[#1C1917] truncate">
                        {isRtl ? item.merchant.nameAr : item.merchant.name}
                      </h4>
                      <span className="font-metric font-extrabold text-xs text-[#059669] shrink-0 tabular-nums">
                        {getCustomerItemPriceAed(item.discountedPrice).toFixed(2)} {t.currency}
                      </span>
                    </div>

                    <p className="text-[11px] text-[#57534E] truncate">
                      {isRtl ? item.title.ar : item.title.en}
                    </p>

                    {/* Live Distance & Drive Time Pill */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-[#059669] border border-emerald-200 font-metric font-extrabold text-[10px]">
                        📏 {distKm} {ml('كم من موقعك', 'km away', 'کلومیٹر دور', 'किमी दूर', 'km mula sa iyo')}
                      </span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100/80 text-amber-950 font-metric font-bold text-[10px]">
                        🚗 ~{driveMins} {ml('دقيقة', 'min', 'منٹ', 'मिनट', 'min')}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {onOpenAdminAddStore && (
            <div className="p-3 bg-[#FAF7F2] border-t border-[#EAE4DC] flex items-center justify-between text-xs">
              <span className="text-[#57534E] font-semibold">
                {ml(
                  'إضافة مطعم جديد على الخريطة؟',
                  'Add new store to map?',
                  'نقشے پر نیا ریسٹورنٹ شامل کریں؟',
                  'मानचित्र पर नया रेस्तरां जोड़ें?',
                  'Magdagdag ng restawran sa mapa?'
                )}
              </span>
              <button
                type="button"
                onClick={onOpenAdminAddStore}
                className="px-3 py-1.5 bg-amber-400 hover:bg-amber-500 text-stone-950 font-extrabold rounded-lg text-[11px] cursor-pointer"
              >
                + {ml('إضافة متجر', 'Add Store', 'اسٹور شامل کریں', 'स्टोर जोड़ें', 'Idagdag')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
