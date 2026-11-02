import React, { useMemo, useState } from 'react';
import {
  ArrowRight, BadgeCheck, ChevronLeft, Clock3, ExternalLink,
  HeartPulse, MapPin, Navigation, Phone, Search, Stethoscope,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Business } from '../types';
import { DEFAULT_CATEGORIES } from '../data/productionDefaults';
import { normalizeWhatsAppPhone } from '../utils/socialLinks';
import { resolveDefaultImage } from '../utils/defaultImages';

type MedicalType = 'all' | 'doctor' | 'pharmacy' | 'lab' | 'clinic';

const MEDICAL_CATEGORIES = DEFAULT_CATEGORIES.filter((category) => category.functionalGroupId === 'medical_health');
const SPECIALTY_OPTIONS = Array.from(new Set(MEDICAL_CATEGORIES.flatMap((category) => category.specialties || [])))
  .sort((a, b) => a.localeCompare(b, 'ar'));

const MEDICAL_TYPE_CATEGORY_IDS: Record<Exclude<MedicalType, 'all'>, string[]> = {
  doctor: ['cat_medical_health_medical_practices'],
  pharmacy: ['cat_medical_health_pharmacies'],
  lab: ['cat_medical_health_diagnostic_labs'],
  clinic: ['cat_medical_health_hospitals', 'cat_medical_health_rehabilitation'],
};

const normalizeArabic = (value: string): string => String(value || '')
  .toLocaleLowerCase('ar-EG')
  .normalize('NFKC')
  .replace(/[أإآ]/g, 'ا')
  .replace(/[ىي]/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/[\u064B-\u065F\u0670]/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const rad = (degrees: number) => degrees * Math.PI / 180;
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const isMedicalBusiness = (business: Business): boolean =>
  business.functionalGroupId === 'medical_health' ||
  Boolean(business.categoryId?.startsWith('cat_medical_health_'));

const matchesMedicalType = (business: Business, type: MedicalType): boolean =>
  type === 'all' || MEDICAL_TYPE_CATEGORY_IDS[type].includes(business.categoryId || '');

const MedicalBusinessCard: React.FC<{
  business: Business;
  onOpen: (business: Business) => void;
}> = ({ business, onOpen }) => {
  const image = business.logoUrl || resolveDefaultImage({
    name: business.name,
    description: business.bio,
    category: business.category,
    kind: 'activity',
  });
  const whatsapp = normalizeWhatsAppPhone(business.ownerWhatsApp || business.phone || '');
  const whatsappUrl = whatsapp
    ? 'https://wa.me/' + whatsapp + '?text=' + encodeURIComponent('مرحبًا، أود الاستفسار عن خدمات ' + business.name)
    : '';

  return (
    <article className="flex min-w-0 flex-col justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-5">
      <button type="button" onClick={() => onOpen(business)} className="flex min-w-0 items-start gap-3 text-right">
        <img src={image} alt="" loading="lazy" className="h-14 w-14 shrink-0 rounded-2xl border border-slate-200 bg-slate-50 object-cover" />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <strong className="max-w-full truncate text-sm font-black text-slate-950">{business.name}</strong>
            {business.isVerified ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-black text-emerald-800">
                <BadgeCheck className="h-3 w-3" /> موثّق
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-black text-rose-700">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-600" /> غير موثّق
              </span>
            )}
          </span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">{business.category}</span>
          {business.activitySpecialty && <span className="mt-1 block text-xs font-bold text-emerald-800">{business.activitySpecialty}</span>}
        </span>
        <ChevronLeft className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
      </button>

      <div className="space-y-2 border-t border-slate-100 pt-3 text-xs text-slate-600">
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
          <span className="min-w-0 break-words">{[business.address, business.village, business.markaz, business.governorate].filter(Boolean).join('، ') || 'الموقع غير محدد'}</span>
        </p>
        {business.workingHours && (
          <p className="flex items-center gap-2">
            <Clock3 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span>{business.workingHours}</span>
          </p>
        )}
        {(business.phone || business.ownerWhatsApp) && (
          <p className="flex items-center gap-2" dir="ltr">
            <Phone className="h-3.5 w-3.5 shrink-0 text-emerald-700" />
            <span className="font-semibold">{business.phone || business.ownerWhatsApp}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {whatsappUrl ? (
          <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-700 px-2 py-2 text-xs font-black text-white hover:bg-emerald-800">
            <Phone className="h-3.5 w-3.5" /> واتساب
          </a>
        ) : (
          <span className="inline-flex min-h-10 items-center justify-center rounded-xl bg-slate-100 px-2 py-2 text-[11px] font-bold text-slate-400">لا يوجد رقم معلن</span>
        )}
        <button type="button" onClick={() => onOpen(business)} className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-2 py-2 text-xs font-black text-slate-800 hover:bg-slate-100">
          <ExternalLink className="h-3.5 w-3.5" /> صفحة النشاط
        </button>
      </div>
    </article>
  );
};

export const MedicalDirectoryView: React.FC = () => {
  const { directoryBusinesses, directoryLoading, openPublicBusiness, setCurrentView } = useApp();
  const [query, setQuery] = useState('');
  const [selectedSpecialty, setSelectedSpecialty] = useState('all');
  const [selectedType, setSelectedType] = useState<MedicalType>('all');
  const [governorate, setGovernorate] = useState('all');
  const [markaz, setMarkaz] = useState('all');
  const [village, setVillage] = useState('all');
  const [visibleCount, setVisibleCount] = useState(20);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [openError, setOpenError] = useState('');

  const medicalBusinesses = useMemo(() => directoryBusinesses.filter((business) =>
    isMedicalBusiness(business) &&
    Boolean(business.publicEnabled || business.isOfficialShowcase) &&
    business.operationalStatus === 'ACTIVE' &&
    !business.isFrozen &&
    Boolean(business.name.trim())
  ), [directoryBusinesses]);

  const governorates = useMemo(() =>
    Array.from(new Set(medicalBusinesses.map((business) => business.governorate).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ar')),
  [medicalBusinesses]);
  const markazOptions = useMemo(() =>
    Array.from(new Set(medicalBusinesses
      .filter((business) => governorate === 'all' || business.governorate === governorate)
      .map((business) => business.markaz).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ar')),
  [medicalBusinesses, governorate]);
  const villageOptions = useMemo(() =>
    Array.from(new Set(medicalBusinesses
      .filter((business) => (governorate === 'all' || business.governorate === governorate) && (markaz === 'all' || business.markaz === markaz))
      .map((business) => business.village).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'ar')),
  [medicalBusinesses, governorate, markaz]);

  const results = useMemo(() => {
    const normalizedQuery = normalizeArabic(query);
    return medicalBusinesses.filter((business) => {
      if (!matchesMedicalType(business, selectedType)) return false;
      if (governorate !== 'all' && business.governorate !== governorate) return false;
      if (markaz !== 'all' && business.markaz !== markaz) return false;
      if (village !== 'all' && business.village !== village) return false;
      if (selectedSpecialty !== 'all' && normalizeArabic(business.activitySpecialty || '') !== normalizeArabic(selectedSpecialty)) return false;
      if (normalizedQuery) {
        const searchable = normalizeArabic([
          business.name,
          business.category,
          business.activitySpecialty || '',
          business.bio,
          business.address,
          business.governorate,
          business.markaz,
          business.village,
          business.phone || '',
          business.ownerWhatsApp,
        ].join(' '));
        if (!searchable.includes(normalizedQuery)) return false;
      }
      return true;
    }).sort((a, b) => {
      if (userLocation) {
        const distance = (business: Business) =>
          typeof business.latitude === 'number' && typeof business.longitude === 'number'
            ? haversineKm(userLocation.lat, userLocation.lon, business.latitude, business.longitude)
            : Number.POSITIVE_INFINITY;
        const delta = distance(a) - distance(b);
        if (!Number.isNaN(delta) && delta !== 0) return delta;
      }
      if (a.isVerified !== b.isVerified) return a.isVerified ? -1 : 1;
      return a.name.localeCompare(b.name, 'ar');
    });
  }, [medicalBusinesses, query, selectedType, governorate, markaz, village, selectedSpecialty, userLocation]);

  const handleLocationRequest = () => {
    if (!navigator.geolocation || !window.isSecureContext) {
      setLocationMessage('تحديد الموقع غير متاح في هذا المتصفح أو الاتصال؛ استخدم فلاتر المحافظة والمركز.');
      return;
    }
    setLocationBusy(true);
    setLocationMessage('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ lat: position.coords.latitude, lon: position.coords.longitude });
        setLocationBusy(false);
        setLocationMessage('تم تفعيل ترتيب الأقرب داخل هذه الصفحة فقط. لا نحفظ إحداثيات جهازك.');
      },
      () => {
        setLocationBusy(false);
        setLocationMessage('لم نتمكن من تحديد الموقع. يمكنك الاستمرار باستخدام فلاتر المحافظة والمركز.');
      },
      { timeout: 10000, maximumAge: 30000, enableHighAccuracy: false }
    );
  };

  const handleOpenBusiness = async (business: Business) => {
    setOpenError('');
    const opened = await openPublicBusiness(business.id);
    if (!opened) setOpenError('تعذر فتح صفحة النشاط حاليًا. حاول مرة أخرى.');
  };

  const visibleResults = results.slice(0, visibleCount);
  const verifiedCount = results.filter((business) => business.isVerified).length;

  return (
    <div dir="rtl" className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <section className="relative isolate overflow-hidden rounded-3xl border border-emerald-900/20 bg-gradient-to-l from-emerald-950 via-teal-900 to-slate-950 p-6 text-white shadow-xl sm:p-9">
        <div className="absolute -left-10 -top-12 h-48 w-48 rounded-full border border-emerald-300/20" />
        <div className="absolute -bottom-24 right-1/3 h-64 w-64 rounded-full border border-white/10" />
        <div className="relative max-w-4xl space-y-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-200">
            <HeartPulse className="h-4 w-4" /> دليل الأطباء والعيادات والصيدليات والخدمات الصحية
          </span>
          <h1 className="text-2xl font-black leading-tight sm:text-4xl">الدليل الطبي لمنطقتك في مكان واحد</h1>
          <p className="max-w-3xl text-xs leading-7 text-slate-300 sm:text-sm">
            ابحث داخل الأنشطة الطبية المنشورة فعليًا، وتصفح التخصصات والخدمات حسب المحافظة والمركز. تظهر حالة التوثيق كما هي مسجلة في المنصة.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" onClick={handleLocationRequest} disabled={locationBusy} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-black text-white hover:bg-white/15 disabled:opacity-60">
              <Navigation className={`h-4 w-4 ${locationBusy ? 'animate-pulse' : ''}`} />
              {locationBusy ? 'جارٍ تحديد الموقع…' : userLocation ? 'تم تفعيل ترتيب الأقرب' : 'ترتيب النتائج حسب موقعي'}
            </button>
            <button type="button" onClick={() => setCurrentView('directory')} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-black text-emerald-950 hover:bg-emerald-50">
              <ArrowRight className="h-4 w-4" /> العودة إلى الدليل العام
            </button>
          </div>
          {locationMessage && <p role="status" className="text-xs text-emerald-100">{locationMessage}</p>}
        </div>
      </section>

      <section className="grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-6">
        <label className="block text-xs font-bold text-slate-700 lg:col-span-2">
          ابحث باسم النشاط أو التخصص أو الخدمة
          <span className="relative mt-1.5 block">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(event) => { setQuery(event.target.value); setVisibleCount(20); }} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-3 pr-10 text-sm outline-none focus:border-emerald-600" placeholder="اسم الطبيب أو الصيدلية أو المعمل..." />
          </span>
        </label>
        <label className="block text-xs font-bold text-slate-700">
          نوع النشاط الطبي
          <select value={selectedType} onChange={(event) => { setSelectedType(event.target.value as MedicalType); setVisibleCount(20); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
            <option value="all">كل الأنشطة الطبية</option>
            <option value="doctor">أطباء وعيادات</option>
            <option value="pharmacy">صيدليات</option>
            <option value="lab">معامل ومراكز تشخيص</option>
            <option value="clinic">مستشفيات ومراكز طبية</option>
          </select>
        </label>
        <label className="block text-xs font-bold text-slate-700">
          التخصص
          <select value={selectedSpecialty} onChange={(event) => { setSelectedSpecialty(event.target.value); setVisibleCount(20); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
            <option value="all">كل التخصصات</option>
            {SPECIALTY_OPTIONS.map((specialty) => <option key={specialty} value={specialty}>{specialty}</option>)}
          </select>
        </label>
        <label className="block text-xs font-bold text-slate-700">
          المحافظة
          <select value={governorate} onChange={(event) => { setGovernorate(event.target.value); setMarkaz('all'); setVillage('all'); setVisibleCount(20); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
            <option value="all">كل المحافظات</option>
            {governorates.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="block text-xs font-bold text-slate-700">
          المركز / المدينة
          <select value={markaz} onChange={(event) => { setMarkaz(event.target.value); setVillage('all'); setVisibleCount(20); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
            <option value="all">كل المراكز</option>
            {markazOptions.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="block text-xs font-bold text-slate-700">
          القرية / الحي
          <select value={village} onChange={(event) => { setVillage(event.target.value); setVisibleCount(20); }} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm">
            <option value="all">كل القرى والأحياء</option>
            {villageOptions.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <div className="flex items-end lg:col-span-2">
          <button type="button" onClick={() => { setQuery(''); setSelectedType('all'); setSelectedSpecialty('all'); setGovernorate('all'); setMarkaz('all'); setVillage('all'); setVisibleCount(20); }} className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">
            إعادة ضبط البحث والفلاتر
          </button>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-slate-950">نتائج الدليل الطبي</h2>
            <p className="mt-1 text-xs text-slate-500">تظهر الأنشطة الموثقة أولًا، ثم غير الموثقة، مع الحفاظ على حالة كل نشاط.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] font-bold">
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">الإجمالي: {results.length.toLocaleString('ar-EG')}</span>
            <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-emerald-800">موثّق: {verifiedCount.toLocaleString('ar-EG')}</span>
            <span className="rounded-full bg-rose-50 px-3 py-1.5 text-rose-700">غير موثّق: {(results.length - verifiedCount).toLocaleString('ar-EG')}</span>
          </div>
        </div>

        {openError && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800">{openError}</p>}
        {directoryLoading ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">جارٍ تحميل الأنشطة الطبية المنشورة…</p>
        ) : results.length ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {visibleResults.map((business) => <MedicalBusinessCard key={business.id} business={business} onOpen={handleOpenBusiness} />)}
            </div>
            {visibleCount < results.length && (
              <div className="pt-2 text-center">
                <button type="button" onClick={() => setVisibleCount((current) => current + 20)} className="min-h-11 rounded-xl bg-emerald-700 px-6 py-3 text-xs font-black text-white hover:bg-emerald-800">
                  رؤية المزيد من الأنشطة الطبية ({(results.length - visibleCount).toLocaleString('ar-EG')} متبقي)
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <Stethoscope className="mx-auto h-10 w-10 text-slate-300" />
            <h3 className="mt-3 font-black text-slate-800">لا توجد نتائج طبية مطابقة</h3>
            <p className="mt-2 text-xs leading-6 text-slate-500">غيّر نوع النشاط أو التخصص أو النطاق الجغرافي. لا يتم إنشاء سجلات طبية تلقائيًا من البحث.</p>
          </div>
        )}
      </section>

      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 text-xs leading-6 text-emerald-950">
        <span className="font-black">تنبيه:</span> هذا الدليل يعرض بيانات الأنشطة العامة المنشورة في المنصة فقط. التوثيق المعروض يعكس حالة السجل ولا يُعد توصية طبية أو تحققًا مستقلًا من الترخيص.
      </div>
    </div>
  );
};
