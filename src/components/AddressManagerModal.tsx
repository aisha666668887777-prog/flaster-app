import React, { useState } from 'react';
import { 
  MapPin, 
  Home, 
  Briefcase, 
  Plus, 
  Trash2, 
  Check, 
  X, 
  Navigation, 
  Building, 
  Sparkles,
  Edit2
} from 'lucide-react';
import { UserAddress, Language, DynamicRegion } from '../types';

interface AddressManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  addresses: UserAddress[];
  onSaveAddresses: (addresses: UserAddress[]) => void;
  selectedAddressId?: string;
  onSelectAddress?: (address: UserAddress) => void;
  regions?: DynamicRegion[];
}

export const AddressManagerModal: React.FC<AddressManagerModalProps> = ({
  isOpen,
  onClose,
  lang,
  addresses,
  onSaveAddresses,
  selectedAddressId,
  onSelectAddress,
  regions = []
}) => {
  const isArabic = lang === 'ar';

  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [type, setType] = useState<'home' | 'work' | 'current'>('home');
  const [label, setLabel] = useState('');
  const [street, setStreet] = useState('');
  const [buildingOrVilla, setBuildingOrVilla] = useState('');
  const [city, setCity] = useState(regions[1]?.name || 'Ras Al Khaimah');
  const [details, setDetails] = useState('');
  const [isDefault, setIsDefault] = useState(false);

  if (!isOpen) return null;

  const handleOpenAdd = () => {
    setEditingId(null);
    setType('home');
    setLabel(isArabic ? 'البيت' : 'Home');
    setStreet('');
    setBuildingOrVilla('');
    setCity(regions[1]?.name || (isArabic ? 'رأس الخيمة' : 'Ras Al Khaimah'));
    setDetails('');
    setIsDefault(addresses.length === 0);
    setIsAddingNew(true);
  };

  const handleOpenEdit = (addr: UserAddress) => {
    setEditingId(addr.id);
    setType(addr.type);
    setLabel(addr.label);
    setStreet(addr.street);
    setBuildingOrVilla(addr.buildingOrVilla);
    setCity(addr.city);
    setDetails(addr.details || '');
    setIsDefault(Boolean(addr.isDefault));
    setIsAddingNew(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!street.trim() || !buildingOrVilla.trim()) return;

    let updatedList: UserAddress[];

    if (editingId) {
      updatedList = addresses.map((a) => {
        if (a.id === editingId) {
          return {
            ...a,
            type,
            label: label.trim() || (type === 'home' ? (isArabic ? 'البيت' : 'Home') : type === 'work' ? (isArabic ? 'العمل' : 'Work') : (isArabic ? 'موقع الاستلام' : 'Current Pickup')),
            street: street.trim(),
            buildingOrVilla: buildingOrVilla.trim(),
            city: city.trim(),
            details: details.trim(),
            isDefault
          };
        }
        return isDefault ? { ...a, isDefault: false } : a;
      });
    } else {
      const newAddr: UserAddress = {
        id: `addr-${Date.now()}`,
        type,
        label: label.trim() || (type === 'home' ? (isArabic ? 'البيت' : 'Home') : type === 'work' ? (isArabic ? 'العمل' : 'Work') : (isArabic ? 'موقع الاستلام' : 'Current Pickup')),
        street: street.trim(),
        buildingOrVilla: buildingOrVilla.trim(),
        city: city.trim(),
        details: details.trim(),
        isDefault: isDefault || addresses.length === 0
      };

      const baseList: UserAddress[] = isDefault
        ? addresses.map(a => ({ ...a, isDefault: false }))
        : [...addresses];
      updatedList = [...baseList, newAddr];
    }

    onSaveAddresses(updatedList);
    setIsAddingNew(false);
    setEditingId(null);
  };

  const handleDelete = (id: string) => {
    const next = addresses.filter(a => a.id !== id);
    onSaveAddresses(next);
  };

  const handleSetDefault = (id: string) => {
    const next = addresses.map(a => ({ ...a, isDefault: a.id === id }));
    onSaveAddresses(next);
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-elevation-4 border border-[#EAE4DC] overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#EAE4DC] bg-[#FAF8F5]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-sm">
              <MapPin className="w-5 h-5 text-amber-700" />
            </div>
            <div>
              <h3 className="font-headline font-bold text-base text-[#0F172A]">
                {isArabic ? 'إدارة عناوين التوصيل والاستلام' : 'Delivery Address Management'}
              </h3>
              <p className="text-xs text-[#64748B]">
                {isArabic ? 'احفظ عناوينك المفضلة لتوصيل واستلام وجبات الفائض بضغطة زر' : 'Save home, work, or pickup locations for 1-tap checkout'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          
          {!isAddingNew ? (
            <>
              {/* Add Address CTA */}
              <button
                onClick={handleOpenAdd}
                className="w-full py-3 px-4 rounded-xl border-2 border-dashed border-amber-400 bg-amber-50/60 hover:bg-amber-100/70 text-amber-950 text-xs font-bold flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4 text-amber-700" />
                <span>{isArabic ? 'إضافة عنوان جديد (البيت، العمل، أو موقعك الحالي)' : 'Add New Address (Home, Work, or Pickup)'}</span>
              </button>

              {/* Addresses List */}
              <div className="space-y-3">
                {addresses.length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <Building className="w-10 h-10 text-slate-300 mx-auto" />
                    <p className="text-xs text-[#64748B]">
                      {isArabic ? 'لم تقم بحفظ أي عنوان بعد. أضف عنوانك لتسريع طلبات التوصيل!' : 'No saved addresses yet. Add your address for faster delivery!'}
                    </p>
                  </div>
                ) : (
                  addresses.map((addr) => {
                    const isSelected = selectedAddressId === addr.id;
                    return (
                      <div
                        key={addr.id}
                        className={`p-4 rounded-xl border transition-all text-xs space-y-2.5 ${
                          isSelected
                            ? 'border-[#059669] bg-emerald-50/60 ring-2 ring-emerald-500/20 shadow-sm'
                            : 'border-[#EAE4DC] bg-white hover:border-amber-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {addr.type === 'home' ? (
                              <Home className="w-4 h-4 text-amber-700" />
                            ) : addr.type === 'work' ? (
                              <Briefcase className="w-4 h-4 text-sky-700" />
                            ) : (
                              <Navigation className="w-4 h-4 text-emerald-700" />
                            )}
                            <strong className="font-bold text-[#0F172A] text-sm">{addr.label}</strong>
                            {addr.isDefault && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-200">
                                {isArabic ? 'الافتراضي' : 'Default'}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(addr)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                              title={isArabic ? 'تعديل' : 'Edit'}
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {addresses.length > 1 && (
                              <button
                                onClick={() => handleDelete(addr.id)}
                                className="p-1.5 rounded-lg text-red-400 hover:text-red-700 hover:bg-red-50"
                                title={isArabic ? 'حذف' : 'Delete'}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="text-[#475569] leading-relaxed">
                          {addr.street}، {addr.buildingOrVilla} • {addr.city}
                          {addr.details && <span className="block text-[#64748B] text-[11px] mt-0.5">({addr.details})</span>}
                        </p>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                          {!addr.isDefault && (
                            <button
                              onClick={() => handleSetDefault(addr.id)}
                              className="text-[11px] text-[#64748B] hover:text-[#DC2626] font-semibold"
                            >
                              {isArabic ? 'تعيين كعنوان افتراضي' : 'Set as Default'}
                            </button>
                          )}
                          {onSelectAddress && (
                            <button
                              onClick={() => {
                                onSelectAddress(addr);
                                onClose();
                              }}
                              className={`ms-auto px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1 transition-all ${
                                isSelected
                                  ? 'bg-[#059669] text-white shadow'
                                  : 'bg-slate-900 text-white hover:bg-slate-800'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>{isSelected ? (isArabic ? 'العنوان المختار' : 'Selected') : (isArabic ? 'اختيار هذا العنوان' : 'Use Address')}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          ) : (
            /* Add / Edit Form */
            <form onSubmit={handleSaveForm} className="space-y-4 text-xs">
              
              {/* Type selector */}
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1.5">
                  {isArabic ? 'نوع العنوان:' : 'Address Type:'}
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { id: 'home', label: isArabic ? 'البيت' : 'Home', icon: Home },
                    { id: 'work', label: isArabic ? 'العمل' : 'Work', icon: Briefcase },
                    { id: 'current', label: isArabic ? 'موقع آخر' : 'Other', icon: Navigation }
                  ] as const).map((item) => {
                    const Icon = item.icon;
                    const isCur = type === item.id;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => {
                          setType(item.id);
                          if (!label || label === 'البيت' || label === 'Home' || label === 'العمل' || label === 'Work') {
                            setLabel(item.label);
                          }
                        }}
                        className={`p-2.5 rounded-xl border flex items-center justify-center gap-2 font-bold transition-all ${
                          isCur
                            ? 'bg-amber-100 text-amber-950 border-amber-400 shadow-sm'
                            : 'bg-[#FAF8F5] text-[#64748B] border-[#EAE4DC] hover:bg-white'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Label */}
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">
                  {isArabic ? 'اسم العنوان (مثال: فيلا رأس الخيمة أو مكتبي):' : 'Address Label:'}
                </label>
                <input
                  type="text"
                  required
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={isArabic ? 'مثال: البيت' : 'e.g. Home'}
                  className="w-full h-10 px-3 bg-[#FAF8F5] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#DC2626]"
                />
              </div>

              {/* Street */}
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">
                  {isArabic ? 'اسم الشارع أو الحي:' : 'Street / Neighborhood:'}
                </label>
                <input
                  type="text"
                  required
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder={isArabic ? 'مثال: شارع الخزام قرب مسجد الهدى' : 'e.g. Al Khuzam Street'}
                  className="w-full h-10 px-3 bg-[#FAF8F5] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#DC2626]"
                />
              </div>

              {/* Building or Villa */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">
                    {isArabic ? 'رقم الفيلا / البناية والشقة:' : 'Villa / Building & Flat:'}
                  </label>
                  <input
                    type="text"
                    required
                    value={buildingOrVilla}
                    onChange={(e) => setBuildingOrVilla(e.target.value)}
                    placeholder={isArabic ? 'فيلا 12 أو شقة 304' : 'Villa 12 or Flat 304'}
                    className="w-full h-10 px-3 bg-[#FAF8F5] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#DC2626]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-[#0F172A] mb-1">
                    {isArabic ? 'المدينة / المنطقة:' : 'City / Zone:'}
                  </label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full h-10 px-3 bg-[#FAF8F5] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#DC2626]"
                  >
                    {regions.length > 0 ? (
                      regions.filter(r => r.id !== 'region-all').map((r) => (
                        <option key={r.id} value={r.name}>
                          {isArabic ? `${r.nameAr} (${r.cityAr})` : `${r.name} (${r.city})`}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Ras Al Khaimah">Ras Al Khaimah (رأس الخيمة)</option>
                        <option value="Dubai">Dubai (دبي)</option>
                        <option value="Sharjah">Sharjah (الشارقة)</option>
                      </>
                    )}
                  </select>
                </div>
              </div>

              {/* Additional delivery instructions */}
              <div>
                <label className="block font-semibold text-[#0F172A] mb-1">
                  {isArabic ? 'تعليمات إضافية للمندوب (اختياري):' : 'Delivery Instructions (optional):'}
                </label>
                <input
                  type="text"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder={isArabic ? 'مثال: رن الجرس واتركه عند الباب' : 'e.g. Ring bell and leave at door'}
                  className="w-full h-10 px-3 bg-[#FAF8F5] border border-[#CBD5E1] rounded-xl text-xs text-[#0F172A] focus:outline-none focus:border-[#DC2626]"
                />
              </div>

              {/* Default checkbox */}
              <label className="flex items-center gap-2 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded text-[#DC2626] focus:ring-[#DC2626]"
                />
                <span className="text-xs font-semibold text-[#0F172A]">
                  {isArabic ? 'تعيين كعنواني المفضل الافتراضي' : 'Make this my default address'}
                </span>
              </label>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingNew(false)}
                  className="flex-1 py-2.5 rounded-xl border border-[#CBD5E1] text-[#64748B] font-bold text-xs hover:bg-slate-50"
                >
                  {isArabic ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#DC2626] to-[#B91C1C] text-white font-headline font-bold text-xs shadow-md shadow-red-500/20 active:scale-95"
                >
                  {isArabic ? 'حفظ العنوان' : 'Save Address'}
                </button>
              </div>

            </form>
          )}

        </div>
      </div>
    </div>
  );
};
