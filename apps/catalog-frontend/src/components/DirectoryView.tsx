import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Business } from '../types';
import {
  Store,
  ExternalLink,
  Wrench,
  Search,
  MapPin,
  Sparkles,
  ChevronLeft,
  ArrowRight,
  CheckCircle2,
  MessageCircle,
  Stethoscope,
  Shirt,
  Car,
  Building2,
  Cpu,
  Megaphone,
  ShoppingCart,
  Sprout,
  Dumbbell,
  Plane,
  Navigation,
  Landmark,
  Factory,
  Users,
  BriefcaseBusiness,
  Palette,
  GraduationCap,
  Utensils,
} from 'lucide-react';
import { formatEgyptianLocation } from '../utils/rules';
import { resolveDefaultImage } from '../utils/defaultImages';
import { DirectoryListingsView } from './DirectoryListingsView';
import { ActivityModuleView } from '../modules/activities/ActivityModuleView';
import { fetchPublicDirectoryListings, type PublicDirectoryListing } from '../lib/directoryListings';
import { resolveCanonicalSpecialty } from '../data/productionDefaults';
import { EGYPT_GEO_DISTRICTS, EGYPT_GEO_GOVERNORATES, loadEgyptDistrictShiyakhas, resolveEgyptAdministrativeLocation, type EgyptGeoShiyakha } from '../data/egyptGeoDiscovery';

const whatsappDigits = (value: unknown): string => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = '20' + digits.slice(1);
  else if (digits.startsWith('1') && digits.length === 10) digits = '20' + digits;
  return digits.length >= 10 && digits.length <= 15 ? digits : '';
};

const ICONS_MAP: Record<string, React.ReactNode> = {
  medical_health: <Stethoscope className="h-7 w-7 text-emerald-600" strokeWidth={1.8} />,
  food_grocery: <Utensils className="h-7 w-7 text-amber-600" strokeWidth={1.8} />,
  fashion_beauty: <Shirt className="h-7 w-7 text-pink-600" strokeWidth={1.8} />,
  home_maintenance: <Wrench className="h-7 w-7 text-orange-600" strokeWidth={1.8} />,
  construction_decor: <Palette className="h-7 w-7 text-stone-600" strokeWidth={1.8} />,
  auto_transport: <Car className="h-7 w-7 text-sky-600" strokeWidth={1.8} />,
  real_estate: <Building2 className="h-7 w-7 text-teal-600" strokeWidth={1.8} />,
  education_training: <GraduationCap className="h-7 w-7 text-indigo-600" strokeWidth={1.8} />,
  technology_communications: <Cpu className="h-7 w-7 text-cyan-600" strokeWidth={1.8} />,
  professional_services: <BriefcaseBusiness className="h-7 w-7 text-violet-600" strokeWidth={1.8} />,
  marketing_media: <Megaphone className="h-7 w-7 text-fuchsia-600" strokeWidth={1.8} />,
  trade_ecommerce: <ShoppingCart className="h-7 w-7 text-blue-600" strokeWidth={1.8} />,
  agriculture_animals: <Sprout className="h-7 w-7 text-lime-700" strokeWidth={1.8} />,
  sports_fitness: <Dumbbell className="h-7 w-7 text-red-600" strokeWidth={1.8} />,
  tourism_events: <Plane className="h-7 w-7 text-purple-600" strokeWidth={1.8} />,
  finance_insurance: <Landmark className="h-5 w-5 sm:h-7 sm:w-7 text-emerald-700" strokeWidth={1.8} />,
  industry_workshops: <Factory className="h-5 w-5 sm:h-7 sm:w-7 text-slate-600" strokeWidth={1.8} />,
  public_community: <Users className="h-7 w-7 text-rose-600" strokeWidth={1.8} />,
};

interface CoverSlide {
  image: string;
  badge: string;
  title: string;
  subtitle: string;
  governorates: string[];
  businessId?: string;
}
const BUSINESS_PLACEHOLDER = `${import.meta.env.BASE_URL || '/'}business-placeholder.svg`;
const GEO_DISCOVERY_STORAGE_KEY = 'mantiqatix.geo-discovery.v1';

const normalizeGeoName = (value: unknown) => String(value || '').toLocaleLowerCase('ar-EG')
  .normalize('NFKC').replace(/[أإآ]/g, 'ا').replace(/[ىي]/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[\u064B-\u065F\u0670]/g, '').replace(/\s+/g, ' ').trim()
  .replace(/^(?:محافظة|مركز|مدينة|قسم|قرية|شياخة|حي|نجع)\s*/, '').trim();

const normalizeGeoExactName = (value: unknown) => String(value || '').toLocaleLowerCase('ar-EG')
  .normalize('NFKC').replace(/[أإآ]/g, 'ا').replace(/[ىي]/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[\u064B-\u065F\u0670]/g, '').replace(/\s+/g, ' ').trim();

type StoredGeoPreference = {
  completed: true;
  mode: 'auto' | 'manual';
  governorate: string;
  markaz: string;
  village: string;
  area: string;
};

const readStoredGeoPreference = (): StoredGeoPreference | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(GEO_DISCOVERY_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<StoredGeoPreference>;
    if (value.completed !== true || (value.mode !== 'auto' && value.mode !== 'manual')) return null;
    return {
      completed: true,
      mode: value.mode,
      governorate: typeof value.governorate === 'string' ? value.governorate : 'all',
      markaz: typeof value.markaz === 'string' ? value.markaz : 'all',
      village: typeof value.village === 'string' ? value.village : 'all',
      area: typeof value.area === 'string' ? value.area : 'all',
    };
  } catch {
    return null;
  }
};

const writeStoredGeoPreference = (preference: StoredGeoPreference) => {
  if (typeof window === 'undefined') return;
  try {
    // Deliberately persist administrative choices only. Precise GPS coordinates stay in memory.
    window.localStorage.setItem(GEO_DISCOVERY_STORAGE_KEY, JSON.stringify(preference));
  } catch {
    // Storage may be disabled by browser privacy settings; the directory remains usable.
  }
};

export const DirectoryView: React.FC = () => {
  const {
    directoryBusinesses,
    directoryLoading,
    categories,
    setSelectedBusinessId,
    setCurrentView,
    adminSettings,
    products,
  } = useApp();
  const businesses = directoryBusinesses;
  const [initialGeoPreference] = useState<StoredGeoPreference | null>(() => readStoredGeoPreference());
  const [geoSetupCompleted, setGeoSetupCompleted] = useState(Boolean(initialGeoPreference?.completed));
  const [geoPreferenceMode, setGeoPreferenceMode] = useState<'auto' | 'manual'>(initialGeoPreference?.mode || 'manual');
  const [showLocationWelcome, setShowLocationWelcome] = useState(!initialGeoPreference?.completed);

  const [searchQuery, setSearchQuery] = useState('');
  const [userCoordinates, setUserCoordinates] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [unconfirmedListings, setUnconfirmedListings] = useState<PublicDirectoryListing[]>([]);
  const [directoryListingsLoaded, setDirectoryListingsLoaded] = useState(false);

  const completeGeoSetup = (mode: 'auto' | 'manual') => {
    // Persist completion synchronously before hiding the first-visit dialog,
    // so an immediate navigation/reload cannot cause the consent screen to repeat.
    writeStoredGeoPreference({
      completed: true,
      mode,
      governorate: selectedGovFilter,
      markaz: selectedMarkazFilter,
      village: selectedVillageFilter,
      area: selectedAreaFilter,
    });
    setGeoSetupCompleted(true);
    setGeoPreferenceMode(mode);
    setShowLocationWelcome(false);
  };

  const requestUserLocation = () => {
    if (!('geolocation' in navigator)) {
      completeGeoSetup('manual');
      setLocationMessage('تحديد الموقع غير مدعوم على هذا المتصفح؛ يمكنك متابعة البحث بالموقع اليدوي.');
      return;
    }
    if (!window.isSecureContext) {
      completeGeoSetup('manual');
      setLocationMessage('تحديد الموقع يحتاج إلى اتصال آمن HTTPS؛ افتح الكتالوج من رابط آمن ثم أعد المحاولة.');
      return;
    }
    setLocationBusy(true);
    setLocationMessage('');
    try {
      navigator.geolocation.getCurrentPosition(
        async ({ coords }) => {
          const latitude = Number(coords.latitude);
          const longitude = Number(coords.longitude);
          const accuracy = Number(coords.accuracy);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
              Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
            completeGeoSetup('manual');
            setLocationMessage('أعاد الجهاز إحداثيات غير صالحة؛ جرّب تحديد الموقع مرة أخرى.');
            setLocationBusy(false);
            return;
          }
          if (latitude < 21.5 || latitude > 32.2 || longitude < 24 || longitude > 37.5) {
            setUserCoordinates(null);
            setSelectedGovFilter('all');
            setSelectedMarkazFilter('all');
            setSelectedVillageFilter('all');
            setSelectedAreaFilter('all');
            completeGeoSetup('manual');
            setLocationMessage('الكتالوج يغطي مصر حاليًا فقط. تم تجاهل إحداثيات خارج النطاق المصري، ويمكنك تصفح مصر بالكامل أو اختيار محافظة يدويًا.');
            setLocationBusy(false);
            return;
          }
          setUserCoordinates({ latitude, longitude });
          completeGeoSetup('auto');
          setLocationMessage('تم تحديد موقعك، جارٍ مطابقة أقرب نطاق إداري…');
          try {
            const match = await resolveEgyptAdministrativeLocation(latitude, longitude);
            if (match) {
              setSelectedGovFilter(match.governorate.name);
              setSelectedMarkazFilter(match.district?.name || 'all');
              setSelectedVillageFilter(match.shiyakha?.name || 'all');
              setSelectedAreaFilter('all');
              const levelLabel = match.level === 'SHIYAKHA'
                ? 'أقرب قرية/شياخة'
                : match.level === 'DISTRICT' ? 'أقرب مركز/قسم' : 'أقرب محافظة';
              const matchedName = match.shiyakha?.name || match.district?.name || match.governorate.name;
              setLocationMessage('تم تقدير ' + levelLabel + ': ' + matchedName +
                ' (أقرب نقطة بيانات تبعد نحو ' + match.distanceKm.toFixed(1) +
                ' كم). هذا ترشيح تقريبي من نقاط إدارية وليس إثباتًا بحدود القرية؛ يمكنك تعديله يدويًا.');
            } else {
              setSelectedGovFilter('all');
              setSelectedMarkazFilter('all');
              setSelectedVillageFilter('all');
              setSelectedAreaFilter('all');
              setLocationMessage('تم تحديد موقعك، لكن لم تتوفر نقطة إدارية قريبة بدرجة كافية. يعرض الموقع مصر بالكامل؛ اختر نطاقك يدويًا.');
            }
          } catch {
            setSelectedGovFilter('all');
            setSelectedMarkazFilter('all');
            setSelectedVillageFilter('all');
            setSelectedAreaFilter('all');
            setLocationMessage('تم تحديد موقعك وترتيب الأنشطة ذات الإحداثيات، لكن تعذر تحميل أسماء المناطق الإدارية. يمكنك اختيار النطاق يدويًا.');
          } finally {
            if (Number.isFinite(accuracy) && accuracy > 1000) {
              setLocationMessage((current) => current + ' دقة GPS منخفضة نسبيًا؛ أعد المحاولة في مكان مفتوح لتحسين الترشيح.');
            }
            setLocationBusy(false);
          }
        },
        (error) => {
          const message = error.code === error.PERMISSION_DENIED
            ? 'لم تسمح بالوصول إلى الموقع؛ يمكنك استخدام الاختيار الإداري اليدوي.'
            : error.code === error.TIMEOUT
              ? 'انتهت مهلة تحديد الموقع؛ تأكد من تشغيل خدمة الموقع ثم جرّب مرة أخرى.'
              : error.code === error.POSITION_UNAVAILABLE
                ? 'الموقع الحالي غير متاح من الجهاز الآن؛ تحقق من تشغيل GPS ثم أعد المحاولة.'
                : 'تعذر تحديد موقعك؛ يمكنك متابعة البحث بالموقع اليدوي.';
          completeGeoSetup('manual');
          setLocationMessage(message);
          setLocationBusy(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
      );
    } catch {
      completeGeoSetup('manual');
      setLocationMessage('تعذر بدء طلب تحديد الموقع؛ تحقق من إعدادات المتصفح ثم أعد المحاولة.');
      setLocationBusy(false);
    }
  };

  // First visits keep the in-page explanation visible until the visitor explicitly consents.
  // Declined or manually selected visits are saved and will not trigger repeated prompts.
  // Returning visitors get a silent refresh only after a previous explicit grant.
  useEffect(() => {
    if (!initialGeoPreference?.completed || initialGeoPreference.mode !== 'auto') return;
    if (!navigator.permissions?.query) return;
    let cancelled = false;
    navigator.permissions.query({ name: 'geolocation' }).then((permission) => {
      if (!cancelled && permission.state === 'granted') requestUserLocation();
    }).catch(() => {
      // Permission API is optional; the manual "use my location" action remains available.
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchPublicDirectoryListings().then((rows) => {
      if (!cancelled && Array.isArray(rows)) setUnconfirmedListings(rows.filter((row) => row.listing_status === 'PUBLISHED' && row.claim_status !== 'CLAIMED'));
      if (!cancelled) setDirectoryListingsLoaded(true);
    }).catch(() => {
      if (!cancelled) {
        setUnconfirmedListings([]);
        setDirectoryListingsLoaded(true);
      }
    });
    return () => { cancelled = true; };
  }, []);
  const [activityModuleId, setActivityModuleId] = useState<string>(() => new URLSearchParams(window.location.search).get('activity') || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const openActivityModule = (activityId: string) => {
    const url = new URL(window.location.href);
    url.searchParams.delete('listing');
    url.searchParams.delete('specialty');
    url.searchParams.set('activity', activityId);
    window.history.pushState({ mantiqatixActivityModule: activityId }, '', url.pathname + url.search + url.hash);
    setActivityModuleId(activityId);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };
  const closeActivityModule = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('activity');
    url.searchParams.delete('specialty');
    window.history.pushState({ mantiqatixActivityModule: null }, '', url.pathname + url.search + url.hash);
    setActivityModuleId('');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };
  useEffect(() => {
    const syncActivityModuleRoute = () => setActivityModuleId(new URLSearchParams(window.location.search).get('activity') || '');
    window.addEventListener('popstate', syncActivityModuleRoute);
    return () => window.removeEventListener('popstate', syncActivityModuleRoute);
  }, []);
  const [selectedGovFilter, setSelectedGovFilter] = useState<string>(initialGeoPreference?.governorate || 'all');
  const [selectedMarkazFilter, setSelectedMarkazFilter] = useState<string>(initialGeoPreference?.markaz || 'all');
  const [selectedVillageFilter, setSelectedVillageFilter] = useState<string>(initialGeoPreference?.village || 'all');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>(initialGeoPreference?.area || 'all');
  const [administrativeShiyakhas, setAdministrativeShiyakhas] = useState<EgyptGeoShiyakha[]>([]);
  const [shiyakhaLoadStatus, setShiyakhaLoadStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  useEffect(() => {
    if (!geoSetupCompleted) return;
    writeStoredGeoPreference({
      completed: true,
      mode: geoPreferenceMode,
      governorate: selectedGovFilter,
      markaz: selectedMarkazFilter,
      village: selectedVillageFilter,
      area: selectedAreaFilter,
    });
  }, [geoSetupCompleted, geoPreferenceMode, selectedGovFilter, selectedMarkazFilter, selectedVillageFilter, selectedAreaFilter]);

  const selectedAdministrativeDistrict =
    EGYPT_GEO_DISTRICTS.find((district) =>
      normalizeGeoExactName(district.name) === normalizeGeoExactName(selectedMarkazFilter) &&
      (selectedGovFilter === 'all' || normalizeGeoName(district.governorateName) === normalizeGeoName(selectedGovFilter))
    ) ||
    EGYPT_GEO_DISTRICTS.find((district) =>
      normalizeGeoName(district.name) === normalizeGeoName(selectedMarkazFilter) &&
      (selectedGovFilter === 'all' || normalizeGeoName(district.governorateName) === normalizeGeoName(selectedGovFilter))
    );

  useEffect(() => {
    let cancelled = false;
    if (!selectedAdministrativeDistrict) {
      setAdministrativeShiyakhas([]);
      setShiyakhaLoadStatus('idle');
      return () => { cancelled = true; };
    }
    setAdministrativeShiyakhas([]);
    setShiyakhaLoadStatus('loading');
    loadEgyptDistrictShiyakhas(selectedAdministrativeDistrict).then((rows) => {
      if (cancelled) return;
      setAdministrativeShiyakhas(rows);
      setShiyakhaLoadStatus('ready');
    }).catch(() => {
      if (cancelled) return;
      setAdministrativeShiyakhas([]);
      setShiyakhaLoadStatus('error');
    });
    return () => { cancelled = true; };
  }, [selectedAdministrativeDistrict?.id]);

  const [listingSlug, setListingSlug] = useState<string>(() => new URLSearchParams(window.location.search).get('listing') || '');
  const openDirectoryListing = (slug: string) => {
    const url = new URL(window.location.href);
    url.searchParams.delete('store');
    url.searchParams.delete('businessId');
    url.searchParams.delete('view');
    url.searchParams.set('listing', slug);
    window.history.pushState({ mantiqatixDirectoryListing: slug }, '', url.pathname + url.search + url.hash);
    setListingSlug(slug);
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };
  const closeDirectoryListing = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('listing');
    window.history.pushState({ mantiqatixDirectoryListing: null }, '', url.pathname + url.search + url.hash);
    setListingSlug('');
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  };
  useEffect(() => {
    const syncListingRoute = () => setListingSlug(new URLSearchParams(window.location.search).get('listing') || '');
    window.addEventListener('popstate', syncListingRoute);
    return () => window.removeEventListener('popstate', syncListingRoute);
  }, []);
  const catalogRequestPhone = whatsappDigits(
    adminSettings.adminWhatsApp || (window as any).MNTY_SUPPORT?.whatsapp || ''
  );

  // Published catalogues and platform-owned showcase activities receive directory cards.
  // This does not activate a module or expose products for an unpublished catalogue.
  const liveFeaturedBusinesses = businesses
    .filter((business) => Boolean(business.publicEnabled || business.isOfficialShowcase) && business.operationalStatus === 'ACTIVE' && !business.isFrozen && Boolean(business.name.trim()))
    .slice(0, 30);
  const coverSlides: CoverSlide[] = liveFeaturedBusinesses.map((business) => ({
      image: business.coverUrl || resolveDefaultImage({ name: business.name, description: business.bio, category: business.category, kind: 'cover' }),
      badge: business.category || 'نشاط محلي',
      title: business.name,
      subtitle: business.bio || (business.catalogPublished ? 'تعرّف على بيانات النشاط وكتالوجه المنشور.' : 'تعرّف على هذا النشاط ضمن دليل MantiqatiX.'),
      governorates: [business.governorate || 'all'],
      businessId: business.id,
    }));

  // Visitor discovery uses the direct activity -> specialty model. Functional groups remain internal administration metadata.
  const availableCategories = categories.filter((category) => (category.classificationType || 'activity') === 'activity');
  const selectedActivityCategory = availableCategories.find((category) => category.id === selectedCategoryId);
  const categoryForBusiness = (business: Business) =>
    categories.find((category) => business.categoryId === category.id) ||
    categories.find((category) => business.category === category.name || business.category.startsWith(category.name + ' — ') || (category.classificationType === 'profession' && business.category.startsWith(category.name + ' ')));

  // Governorate filtering is applied to real published business records.
  const [currentCoverIndex, setCurrentCoverIndex] = useState(0);
  // Keep one stable responsive frame for every carousel slide; never size the frame from image dimensions.

  // Filter slides based on selected governorate
  const activeCoverSlides = selectedGovFilter === 'all'
    ? coverSlides
    : coverSlides.filter((slide) => normalizeGeoName(slide.governorates[0]) === normalizeGeoName(selectedGovFilter));

  useEffect(() => {
    setCurrentCoverIndex(0);
  }, [selectedGovFilter, activeCoverSlides.length]);

  useEffect(() => {
    if (activeCoverSlides.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentCoverIndex((prev) => (prev + 1) % activeCoverSlides.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [activeCoverSlides.length]);

  const normalizeSearch = (value: unknown) => String(value || '').toLocaleLowerCase('ar-EG')
    .normalize('NFKC').replace(/[أإآ]/g, 'ا').replace(/[ىي]/g, 'ي').replace(/ة/g, 'ه').replace(/[\u064B-\u065F\u0670]/g, '').replace(/\s+/g, ' ').trim();
  const normalizeAdministrativeName = normalizeGeoName;

  // Only use explicit, valid coordinates. Never infer a distance from a text address or map URL.
  const getCoordinates = (value: unknown): { latitude: number; longitude: number } | null => {
    if (!value || typeof value !== 'object') return null;
    const row = value as Record<string, any>;
    const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
    const location = row.location && typeof row.location === 'object' ? row.location : {};
    const rawLat = row.latitude ?? row.lat ?? row.latitude_deg ?? metadata.latitude ?? metadata.lat ?? location.latitude ?? location.lat;
    const rawLng = row.longitude ?? row.lng ?? row.lon ?? row.longitude_deg ?? metadata.longitude ?? metadata.lng ?? metadata.lon ?? location.longitude ?? location.lng ?? location.lon;
    if (rawLat == null || rawLng == null) return null;
    const latitude = Number(rawLat);
    const longitude = Number(rawLng);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
    return { latitude, longitude };
  };
  const distanceKm = (from: { latitude: number; longitude: number } | null, to: { latitude: number; longitude: number } | null): number | null => {
    if (!from || !to) return null;
    const radians = (degrees: number) => degrees * Math.PI / 180;
    const dLat = radians(to.latitude - from.latitude);
    const dLon = radians(to.longitude - from.longitude);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  };
  const queryTokens = normalizeSearch(searchQuery).split(' ').filter(Boolean);
  // Rank only configured image URLs; placeholders do not count as real assets.
  const hasConfiguredImage = (value: unknown) => {
    const url = String(value || '').trim().toLowerCase();
    return Boolean(url) && !['business-placeholder.svg', 'product-placeholder.svg', 'default-image', 'placeholder'].some((token) => url.includes(token));
  };
  const productPhotoCounts = new Map<string, number>();
  products.forEach((product) => {
    if (!hasConfiguredImage(product.imageUrl)) return;
    productPhotoCounts.set(product.businessId, (productPhotoCounts.get(product.businessId) || 0) + 1);
  });
  const completenessScore = (business: Business) =>
    (hasConfiguredImage(business.logoUrl) ? 100 : 0) +
    (hasConfiguredImage(business.coverUrl) ? 100 : 0) +
    Math.min(productPhotoCounts.get(business.id) || 0, 10) * 10;

  const filteredBusinesses = businesses.filter((biz) => {
    // Public safety: never expose unpublished, inactive, or frozen registered businesses.
    if ((!biz.publicEnabled && !biz.isOfficialShowcase) || biz.operationalStatus !== 'ACTIVE' || biz.isFrozen) return false;
    const haystack = normalizeSearch([
      biz.name, biz.category, biz.bio, biz.address, biz.governorate, biz.markaz, biz.village,
      biz.phone, biz.ownerWhatsApp, biz.activitySpecialty,
    ].join(' '));
    const matchesSearch = queryTokens.every((token) => haystack.includes(token));
    const matchedCategory = categoryForBusiness(biz);
    const matchesCategory = selectedCategoryId === 'all' ||
      Boolean(matchedCategory && selectedActivityCategory && matchedCategory.id === selectedActivityCategory.id);
    const storedSpecialty = String(biz.activitySpecialty || '');
    const categorySuffix = matchedCategory ? biz.category.slice(matchedCategory.name.length).replace(/^\s*—\s*/, '') : '';
    const requestedSpecialty = resolveCanonicalSpecialty(selectedSpecialty, matchedCategory?.id);
    const matchesSpecialty = selectedSpecialty === 'all' ||
      resolveCanonicalSpecialty(storedSpecialty, matchedCategory?.id) === requestedSpecialty ||
      resolveCanonicalSpecialty(categorySuffix, matchedCategory?.id) === requestedSpecialty;
    const matchesGov = selectedGovFilter === 'all' || normalizeAdministrativeName(biz.governorate) === normalizeAdministrativeName(selectedGovFilter);
    const matchesMarkaz = selectedMarkazFilter === 'all' || normalizeAdministrativeName(biz.markaz) === normalizeAdministrativeName(selectedMarkazFilter);
    const matchesVillage = selectedVillageFilter === 'all' || normalizeAdministrativeName(biz.village) === normalizeAdministrativeName(selectedVillageFilter);
    const matchesArea = selectedAreaFilter === 'all' || normalizeSearch(biz.address).includes(normalizeSearch(selectedAreaFilter));
    return matchesSearch && matchesCategory && matchesSpecialty && matchesGov && matchesMarkaz && matchesVillage && matchesArea;
  }).sort((a, b) => {
    // Verified activities always lead; visual completeness breaks ties within each tier.
    if (a.isVerified !== b.isVerified) return a.isVerified ? -1 : 1;
    if (userCoordinates) {
      const aDistance = distanceKm(userCoordinates, getCoordinates(a));
      const bDistance = distanceKm(userCoordinates, getCoordinates(b));
      if (aDistance !== null && bDistance !== null && aDistance !== bDistance) return aDistance - bDistance;
      if (aDistance !== null && bDistance === null) return -1;
      if (aDistance === null && bDistance !== null) return 1;
    }
    const completenessDifference = completenessScore(b) - completenessScore(a);
    if (completenessDifference !== 0) return completenessDifference;
    const targetGov = selectedGovFilter === 'all' ? '' : normalizeAdministrativeName(selectedGovFilter);
    return Number(Boolean(targetGov) && normalizeAdministrativeName(b.governorate) === targetGov) -
      Number(Boolean(targetGov) && normalizeAdministrativeName(a.governorate) === targetGov);
  });

  // Public-directory entries and registered businesses share one result stream.
  // Registered/verified businesses are always rendered first; unclaimed records follow.
  const filteredUnconfirmedListings = unconfirmedListings.filter((listing) => {
    if (listing.claim_status === 'CLAIMED' || listing.listing_status !== 'PUBLISHED') return false;
    const haystack = normalizeSearch([
      listing.display_name, listing.specialty, listing.taxonomy_specialty, listing.phone,
      listing.secondary_phone, listing.address, listing.village, listing.district, listing.governorate,
    ].join(' '));
    const matchesSearch = queryTokens.every((token) => haystack.includes(token));
    const matchesCategory = selectedCategoryId === 'all' || listing.taxonomy_category_id === selectedCategoryId;
    const matchesSpecialty = selectedSpecialty === 'all' ||
      resolveCanonicalSpecialty(listing.taxonomy_specialty || listing.specialty || '', listing.taxonomy_category_id) ===
      resolveCanonicalSpecialty(selectedSpecialty, listing.taxonomy_category_id);
    const matchesGov = selectedGovFilter === 'all' || normalizeAdministrativeName(listing.governorate) === normalizeAdministrativeName(selectedGovFilter);
    const matchesMarkaz = selectedMarkazFilter === 'all' || normalizeAdministrativeName(listing.district) === normalizeAdministrativeName(selectedMarkazFilter);
    const matchesVillage = selectedVillageFilter === 'all' || normalizeAdministrativeName(listing.village) === normalizeAdministrativeName(selectedVillageFilter);
    const matchesArea = selectedAreaFilter === 'all' || normalizeSearch(listing.address).includes(normalizeSearch(selectedAreaFilter));
    return matchesSearch && matchesCategory && matchesSpecialty && matchesGov && matchesMarkaz && matchesVillage && matchesArea;
  }).sort((a, b) => {
    if (userCoordinates) {
      const aDistance = distanceKm(userCoordinates, getCoordinates(a));
      const bDistance = distanceKm(userCoordinates, getCoordinates(b));
      if (aDistance !== null && bDistance !== null && aDistance !== bDistance) return aDistance - bDistance;
      if (aDistance !== null && bDistance === null) return -1;
      if (aDistance === null && bDistance !== null) return 1;
    }
    return normalizeSearch(a.display_name).localeCompare(normalizeSearch(b.display_name), 'ar');
  });

  // Keep the selected geographic scope stable. Widening is always an explicit visitor action.
  const hasNoSearchResults = !directoryLoading && directoryListingsLoaded &&
    filteredBusinesses.length + filteredUnconfirmedListings.length === 0;
  const canWidenGeographicSearch = selectedAreaFilter !== 'all' ||
    selectedVillageFilter !== 'all' || selectedMarkazFilter !== 'all' || selectedGovFilter !== 'all';
  const widenGeographicSearch = () => {
    if (selectedAreaFilter !== 'all') {
      setSelectedAreaFilter('all');
      setLocationMessage('تم توسيع البحث من المنطقة إلى القرية أو الحي. النتائج ستظل مطابقة للنطاق الإداري المحدد.');
    } else if (selectedVillageFilter !== 'all') {
      setSelectedVillageFilter('all');
      setLocationMessage('تم توسيع البحث من القرية أو الحي إلى المركز أو المدينة.');
    } else if (selectedMarkazFilter !== 'all') {
      setSelectedMarkazFilter('all');
      setLocationMessage('تم توسيع البحث من المركز أو المدينة إلى المحافظة.');
    } else if (selectedGovFilter !== 'all') {
      setSelectedGovFilter('all');
      setLocationMessage(userCoordinates
        ? 'تم توسيع البحث إلى جميع المحافظات؛ ستُعرض الأنشطة ذات الإحداثيات الموثوقة حسب القرب.'
        : 'تم توسيع البحث إلى جميع المحافظات.');
    }
  };

  const locationRecords = [
    ...businesses.filter((b) => Boolean(b.publicEnabled || b.isOfficialShowcase) && b.operationalStatus === 'ACTIVE' && !b.isFrozen)
      .map((b) => ({ governorate: b.governorate, markaz: b.markaz, village: b.village, address: b.address })),
    ...unconfirmedListings.filter((l) => l.listing_status === 'PUBLISHED' && l.claim_status !== 'CLAIMED')
      .map((l) => ({ governorate: l.governorate, markaz: l.district, village: l.village || '', address: l.address || '' })),
  ];
  const uniqueGovernorships = Array.from(new Map([
    ...EGYPT_GEO_GOVERNORATES.map((area) => [normalizeAdministrativeName(area.name), area.name] as const),
    ...locationRecords.map((record) => [normalizeAdministrativeName(record.governorate), String(record.governorate)] as const).filter(([key]) => Boolean(key)),
  ]).values()).sort((a, b) => a.localeCompare(b, 'ar'));
  const listedCenters = locationRecords
    .filter((record) => selectedGovFilter === 'all' || normalizeAdministrativeName(record.governorate) === normalizeAdministrativeName(selectedGovFilter))
    .map((record) => String(record.markaz || '').trim()).filter(Boolean);
  const scopedAdministrativeDistricts = EGYPT_GEO_DISTRICTS
    .filter((district) => selectedGovFilter === 'all' || normalizeAdministrativeName(district.governorateName) === normalizeAdministrativeName(selectedGovFilter));
  const knownCenters = scopedAdministrativeDistricts.map((district) => {
    const sameBaseDistricts = scopedAdministrativeDistricts.filter((candidate) =>
      normalizeAdministrativeName(candidate.name) === normalizeAdministrativeName(district.name)
    );
    const listedAlias = listedCenters.find((name) =>
      normalizeAdministrativeName(name) === normalizeAdministrativeName(district.name)
    );
    // Prefer the directory's familiar label only when it identifies one administrative district unambiguously.
    return sameBaseDistricts.length === 1 && listedAlias ? listedAlias : district.name;
  });
  const uniqueMarkaz = Array.from(new Map([
    ...knownCenters.map((name) => [normalizeGeoExactName(name), name] as const),
    ...listedCenters
      .filter((name) => !knownCenters.some((known) => normalizeAdministrativeName(known) === normalizeAdministrativeName(name)))
      .map((name) => [normalizeGeoExactName(name), name] as const),
  ]).values()).sort((a, b) => a.localeCompare(b, 'ar'));
  const uniqueVillages = Array.from(new Map([
    ...administrativeShiyakhas.map((row) => [normalizeAdministrativeName(row.name), row.name] as const),
    ...locationRecords.filter((record) =>
      (selectedGovFilter === 'all' || normalizeAdministrativeName(record.governorate) === normalizeAdministrativeName(selectedGovFilter)) &&
      (selectedMarkazFilter === 'all' || normalizeAdministrativeName(record.markaz) === normalizeAdministrativeName(selectedMarkazFilter)))
      .map((record) => [normalizeAdministrativeName(record.village), String(record.village)] as const).filter(([key]) => Boolean(key)),
  ]).values()).sort((a, b) => a.localeCompare(b, 'ar'));
  const uniqueAreas = Array.from(new Set(locationRecords.filter((record) => (selectedGovFilter === 'all' || normalizeAdministrativeName(record.governorate) === normalizeAdministrativeName(selectedGovFilter)) && (selectedMarkazFilter === 'all' || normalizeAdministrativeName(record.markaz) === normalizeAdministrativeName(selectedMarkazFilter)) && (selectedVillageFilter === 'all' || normalizeSearch(record.village) === normalizeSearch(selectedVillageFilter))).map((record) => String(record.address || '').trim()).filter((address) => address.length >= 3))).sort((a, b) => a.localeCompare(b, 'ar'));

  const locationWelcomeDialog = showLocationWelcome ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="geo-discovery-title">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 text-right shadow-2xl" dir="rtl">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Navigation className="h-6 w-6" />
            </div>
            <h2 id="geo-discovery-title" className="text-lg font-black text-slate-950">اكتشف الأنشطة الأقرب إليك</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              اسمح للموقع باستخدام إحداثيات جهازك داخل المتصفح لاختيار أقرب نطاق إداري وترتيب الأنشطة التي لها إحداثيات موثوقة. لا نرسل إحداثيات GPS نفسها ولا نحفظها؛ نحمّل أسماء الشياخات لعدد محدود من المراكز الأقرب باستخدام أكوادها الإدارية فقط.
            </p>
            <div className="mt-5 grid gap-2">
              <button type="button" onClick={requestUserLocation} disabled={locationBusy} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:opacity-60">
                <Navigation className="h-4 w-4" /> {locationBusy ? 'جارٍ طلب إذن الموقع…' : 'السماح باستخدام موقعي'}
              </button>
              <button type="button" onClick={() => { completeGeoSetup('manual'); setLocationMessage('يمكنك اختيار مصر بالكامل أو المحافظة والمركز والقرية من أدوات تحديد النطاق.'); }} className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-800 hover:bg-slate-50">
                اختيار الموقع يدويًا
              </button>
              <button type="button" onClick={() => { completeGeoSetup('manual'); setSelectedGovFilter('all'); setSelectedMarkazFilter('all'); setSelectedVillageFilter('all'); setSelectedAreaFilter('all'); setUserCoordinates(null); setLocationMessage('يتم الآن عرض الأنشطة والخدمات المنشورة في مصر بالكامل.'); }} className="min-h-10 text-xs font-bold text-emerald-800 underline">
                عرض مصر بالكامل
              </button>
            </div>
            <p className="mt-4 text-[11px] leading-5 text-slate-500">بعد الضغط على «السماح باستخدام موقعي» سيظهر طلب الإذن الأصلي من المتصفح. يمكنك الرفض ومتابعة التصفح اليدوي في أي وقت.</p>
          </div>
        </div>

  ) : null;

  if (listingSlug) return <>
    <DirectoryListingsView detailSlug={listingSlug} onOpen={openDirectoryListing} onBack={closeDirectoryListing} />
    {locationWelcomeDialog}
  </>;

  if (activityModuleId) {
    const activityCategory = availableCategories.find((category) => category.id === activityModuleId);
    if (activityCategory) {
      const activityBusinesses = filteredBusinesses.filter((business) => categoryForBusiness(business)?.id === activityCategory.id && Boolean(business.phone || business.ownerWhatsApp));
      const activityListings = filteredUnconfirmedListings.filter((listing) => listing.taxonomy_category_id === activityCategory.id && Boolean(listing.phone || listing.secondary_phone));
      const confirmedCount = activityBusinesses.filter((business) => business.isVerified).length;
      const unconfirmedCount = activityBusinesses.filter((business) => !business.isVerified).length + activityListings.length;
      return <ActivityModuleView
        category={activityCategory}
        confirmedCount={confirmedCount}
        unconfirmedCount={unconfirmedCount}
        onBack={closeActivityModule}
        businesses={activityBusinesses}
        listings={activityListings}
        onOpenListing={openDirectoryListing}
        onOpenBusiness={(businessId) => { setSelectedBusinessId(businessId); setCurrentView('public_storefront'); }}
      />;
    }
  }

  return (
    <div className="space-y-8 pb-20">
      {/* 1. Full-Width Horizontal Title Bar right under header */}
      {locationWelcomeDialog}

      <div className="w-full bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 text-white py-6 px-4 sm:px-8 shadow-md border-y border-emerald-500/20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-right">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[11px] font-black px-3 py-0.5 rounded-full mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>الدليل الشامل للأنشطة والخدمات في مصر • MantiqatiX</span>
            </div>
            <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
              اكتشف كافة المشاريع والخدمات في <span className="text-emerald-400">منطقتي X</span>
              {selectedGovFilter !== 'all' && <span className="text-amber-300 text-lg mr-2 font-bold">({selectedGovFilter})</span>}
            </h1>
          </div>

          {catalogRequestPhone && (
            <a
              href={`https://wa.me/${catalogRequestPhone}?text=${encodeURIComponent('مرحبًا، أريد طلب كتالوج لنشاطي على MantiqatiX.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs py-3 px-6 rounded-2xl shadow-lg flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
            >
              <MessageCircle className="w-4 h-4" />
              <span>اطلب كتالوج لنشاطك</span>
            </a>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* 2. One full-width cover carousel showing only currently available activities. */}
        <section aria-label="الأنشطة المتاحة حاليًا" className="space-y-3">
          {activeCoverSlides.length > 0 ? (
            <div className="relative aspect-[4/3] sm:aspect-[650/228] w-full rounded-3xl overflow-hidden shadow-2xl bg-slate-900 group">
              {activeCoverSlides.map((slide, idx) => (
                <div
                  key={slide.businessId || `${slide.title}-${idx}`}
                  aria-hidden={idx !== currentCoverIndex}
                  className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
                    idx === currentCoverIndex ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'
                  }`}
                >
                  {(idx === currentCoverIndex || idx === (currentCoverIndex + 1) % activeCoverSlides.length) && (
                  <button
                    type="button"
                    onClick={() => {
                      if (!slide.businessId) return;
                      setSelectedBusinessId(slide.businessId);
                      setCurrentView('public_storefront');
                    }}
                    aria-label={`افتح صفحة نشاط ${slide.title}`}
                    tabIndex={idx === currentCoverIndex ? 0 : -1}
                    className="absolute inset-0 block h-full w-full cursor-pointer text-left focus-visible:ring-4 focus-visible:ring-emerald-400"
                  >
                    <img
                      src={slide.image || resolveDefaultImage({ name: slide.title, category: slide.badge, kind: 'cover' })}
                      alt={slide.title}
                      className="h-full w-full object-contain sm:object-cover object-center transition-transform duration-700 group-hover:scale-[1.01]"
                      loading={idx === currentCoverIndex ? 'eager' : 'lazy'}
                      onError={(event) => {
                        const image = event.currentTarget;
                        const fallback = resolveDefaultImage({ name: slide.title, category: slide.badge, kind: 'cover' });
                        if (!image.src.endsWith(fallback.replace(/^.*\//, ''))) image.src = fallback;
                      }}
                    />

                  </button>
                  )}
                </div>
              ))}

              {activeCoverSlides.length > 1 && (
                <div className="absolute bottom-3 right-1/2 translate-x-1/2 z-30 flex items-center gap-1.5 bg-black/50 backdrop-blur-xs px-3 py-1.5 rounded-full border border-white/20 max-w-[90%] overflow-x-auto no-scrollbar">
                  {activeCoverSlides.map((slide, idx) => (
                    <button
                      key={slide.businessId || `${slide.title}-${idx}`}
                      type="button"
                      onClick={() => setCurrentCoverIndex(idx)}
                      className={`h-2 rounded-full transition-all cursor-pointer ${
                        idx === currentCoverIndex ? 'w-5 bg-amber-400' : 'w-1.5 bg-white/50 hover:bg-white'
                      }`}
                      aria-label={`اعرض نشاط ${slide.title}`}
                      aria-pressed={idx === currentCoverIndex}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex min-h-64 sm:min-h-80 md:min-h-96 w-full items-center justify-center rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 px-6 py-12 text-center text-white shadow-xl">
              <div className="max-w-xl space-y-3">
                <Store className="mx-auto h-10 w-10 text-emerald-300" />
                <h2 className="text-xl sm:text-2xl font-black">لا توجد أنشطة متاحة حاليًا</h2>
                <p className="text-sm leading-relaxed text-white/75">ستظهر هنا تلقائيًا صور الأنشطة المنشورة والمتاحة للزوار.</p>
              </div>
            </div>
          )}
        </section>

        <section aria-label="الأنشطة" className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><h2 className="flex items-center gap-2 text-lg font-black text-slate-900"><Store className="h-5 w-5 text-emerald-600" />الأنشطة</h2><p className="mt-1 text-xs text-slate-500">اختر النشاط مباشرة لفتح وحدته وصفحته المتخصصة.</p></div>
            <span className="text-xs font-bold text-slate-500">{availableCategories.length.toLocaleString('ar-EG')} نشاط</span>
          </div>
          {selectedActivityCategory && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <p className="text-xs font-bold text-emerald-950">تصفية النتائج حسب: {selectedActivityCategory.name}{selectedSpecialty !== 'all' ? ` — ${selectedSpecialty}` : ''}</p>
              <button type="button" onClick={() => { setSelectedCategoryId('all'); setSelectedSpecialty('all'); }} className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-black text-emerald-800 hover:bg-emerald-100">عرض كل الأنشطة</button>
            </div>
          )}
          <div className="grid grid-cols-8 gap-1">
            {availableCategories.map((category) => {
              const confirmedCount = businesses.filter((business) => Boolean(business.publicEnabled || business.isOfficialShowcase) && business.operationalStatus === 'ACTIVE' && !business.isFrozen && categoryForBusiness(business)?.id === category.id).length;
              const unconfirmedCount = unconfirmedListings.filter((listing) => listing.taxonomy_category_id === category.id && listing.listing_status === 'PUBLISHED' && listing.claim_status !== 'CLAIMED').length;
              const totalCount = confirmedCount + unconfirmedCount;
              return <button
                key={category.id}
                type="button"
                onClick={() => openActivityModule(category.id)}
                aria-label={`فتح نشاط ${category.name} — إجمالي ${totalCount}، موثق ${confirmedCount}، غير موثق ${unconfirmedCount}`}
                className="group relative flex min-h-20 min-w-0 flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white px-0 py-2 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:bg-emerald-50/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 sm:min-h-28 sm:gap-1.5 sm:rounded-xl sm:px-1 sm:py-3"
              >
                <span className="absolute left-0.5 top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-0.5 text-[8px] font-black tabular-nums text-emerald-800 shadow-sm sm:left-1 sm:top-1 sm:h-5 sm:min-w-5 sm:text-[10px]" title={`إجمالي الأنشطة: ${totalCount}`}>
                  {totalCount.toLocaleString('ar-EG')}
                </span>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-700 transition group-hover:bg-emerald-100 group-hover:text-emerald-800 sm:h-9 sm:w-9 sm:rounded-xl">
                  {ICONS_MAP[category.functionalGroupId] || <Store className="h-4 w-4 sm:h-5 sm:w-5" />}
                </span>
                <span className="line-clamp-2 min-h-0 w-full break-words text-[7px] font-black leading-[9px] text-slate-900 sm:min-h-8 sm:text-[10px] sm:leading-4">{category.name}</span>
                <span className="hidden flex-wrap items-center justify-center gap-x-1 gap-y-0.5 text-[8px] font-bold sm:flex sm:text-[9px]">
                  <span className="text-emerald-800">موثق {confirmedCount.toLocaleString('ar-EG')}</span>
                  <span className="text-red-700">غير موثق {unconfirmedCount.toLocaleString('ar-EG')}</span>
                </span>
                <ChevronLeft className="absolute bottom-0.5 right-0.5 h-2.5 w-2.5 text-slate-300 transition group-hover:text-emerald-700 sm:bottom-1 sm:right-1 sm:h-3 sm:w-3" />
              </button>;
            })}
            {availableCategories.length === 0 && <p className="col-span-full rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">لا توجد أنشطة مسجلة حاليًا.</p>}
          </div>
        </section>

        {/* Search & Location Filter Bar */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="بحث عن اسم نشاط، مطعم، خدمة، أو منتج..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl pr-10 pl-4 py-3 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden"
            />
          </div>

          <div className="flex w-full flex-col gap-2 md:w-auto md:min-w-[560px]">
            <button type="button" onClick={requestUserLocation} disabled={locationBusy} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-900 transition hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60">
              <Navigation className="h-4 w-4" />
              {locationBusy ? 'جارٍ تحديد الموقع…' : userCoordinates ? 'تحديث موقعي' : 'حدد موقعي'}
            </button>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setShowLocationWelcome(true)} className="text-xs font-bold text-emerald-800 underline">إعدادات الموقع</button>
              <button type="button" onClick={() => { completeGeoSetup('manual'); setSelectedGovFilter('all'); setSelectedMarkazFilter('all'); setSelectedVillageFilter('all'); setSelectedAreaFilter('all'); setUserCoordinates(null); setLocationMessage('يتم الآن عرض مصر بالكامل.'); }} className="text-xs font-bold text-slate-600 underline">مصر بالكامل</button>
            </div>
            {locationMessage && <p role="status" aria-live="polite" className="max-w-xl text-xs leading-5 text-slate-600">{locationMessage}</p>}
            <p className="text-[10px] leading-4 text-slate-400">مصدر بيانات التقسيم الإداري وإحداثياته: <a href="https://github.com/open-admin-data/egypt-administrative-divisions" target="_blank" rel="noreferrer" className="underline">Open Admin Data Egypt 2026.09</a>، تم تكييفها داخل MantiqatiX. الترخيص: <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="underline">CC BY 4.0</a>. اختيار أقرب نقطة تقديري وليس إثباتًا بحدود قانونية.</p>
            {hasNoSearchResults && canWidenGeographicSearch && (
              <button type="button" onClick={widenGeographicSearch} className="inline-flex min-h-9 items-center justify-center self-start rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900 transition hover:bg-amber-100">
                لا توجد نتائج — توسيع النطاق الجغرافي
              </button>
            )}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            <label className="text-[10px] font-bold text-slate-600 sm:text-xs">المحافظة
              <select value={selectedGovFilter} onChange={(e) => { completeGeoSetup('manual'); setSelectedGovFilter(e.target.value); setSelectedMarkazFilter('all'); setSelectedVillageFilter('all'); setSelectedAreaFilter('all'); }} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-3 text-xs font-bold text-slate-800">
                <option value="all">مصر بالكامل — كل المحافظات</option>
                {uniqueGovernorships.map((gov) => <option key={gov} value={gov}>{gov}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-bold text-slate-600 sm:text-xs">المركز / المدينة
              <select value={selectedMarkazFilter} onChange={(e) => { completeGeoSetup('manual'); setSelectedMarkazFilter(e.target.value); setSelectedVillageFilter('all'); setSelectedAreaFilter('all'); }} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-3 text-xs font-bold text-slate-800">
                <option value="all">كل المراكز</option>
                {uniqueMarkaz.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-bold text-slate-600 sm:text-xs">القرية / الحي
              <select value={selectedVillageFilter} onChange={(e) => { completeGeoSetup('manual'); setSelectedVillageFilter(e.target.value); setSelectedAreaFilter('all'); }} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-3 text-xs font-bold text-slate-800">
                <option value="all">كل القرى والشياخات والأحياء</option>{shiyakhaLoadStatus === 'loading' && <option disabled value="__loading">جارٍ تحميل القرى والشياخات…</option>}
                {uniqueVillages.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <label className="text-[10px] font-bold text-slate-600 sm:text-xs">المنطقة / العنوان
              <select value={selectedAreaFilter} onChange={(e) => { completeGeoSetup('manual'); setSelectedAreaFilter(e.target.value); }} className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-2 py-3 text-xs font-bold text-slate-800">
                <option value="all">كل المناطق</option>
                {uniqueAreas.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            </div>
          </div>
        </div>

        {/* Businesses Grid (verified first; distance only when trusted coordinates exist) */}
        <div className="space-y-6">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-black text-lg text-slate-900 flex items-center gap-2">
              <Store className="w-5 h-5 text-emerald-600" />
              <span>نتائج البحث الموحدة ({filteredBusinesses.length + filteredUnconfirmedListings.length})</span>
            </h2>
            <div
              aria-label="ملخص حالة توثيق النتائج"
              className="flex flex-wrap items-center gap-2 text-[10px] font-bold sm:text-xs"
            >
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-800">
                <CheckCircle2 className="h-3.5 w-3.5" />
                موثقة: {filteredBusinesses.filter((business) => business.isVerified).length}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-red-700">
                غير موثقة: {filteredBusinesses.filter((business) => !business.isVerified).length + filteredUnconfirmedListings.length}
              </span>
            </div>
          </div>

          {filteredBusinesses.length + filteredUnconfirmedListings.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center space-y-3">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
                <Store className="w-8 h-8" />
              </div>
              <h3 className="font-bold text-slate-800 text-base">
                {directoryLoading ? 'جارٍ تحميل الأنشطة المنشورة' : businesses.length === 0 ? 'لا توجد أنشطة متاحة للعرض حاليا' : 'لا توجد أنشطة مطابقة للبحث'}
              </h3>
              <p className="text-xs text-slate-500 max-w-lg mx-auto">
                {directoryLoading
                  ? 'يتم الآن تحميل الأنشطة المنشورة من المنصة، وستظهر هنا تلقائيًا.'
                  : businesses.length === 0
                  ? 'ستظهر هنا الأنشطة النشطة المتاحة للزوار. تواصل مع إدارة المنصة إذا كنت تبحث عن نشاط غير موجود.'
                  : 'جرب تغيير كلمات البحث أو القطاع أو المحافظة أو ابحث باسم المركز أو القرية أو المنطقة.'}
              </p>
              {!directoryLoading && businesses.length === 0 && catalogRequestPhone && (
                <a
                  href={`https://wa.me/${catalogRequestPhone}?text=${encodeURIComponent('مرحبًا، أريد تفعيل كتالوج لنشاطي على MantiqatiX')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-xs font-bold text-white hover:bg-emerald-700 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  تواصل مع إدارة المنصة
                </a>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-6">
              {filteredBusinesses.map((biz) => {
                return (
                  <div
                    key={biz.id}
                    className={`min-w-0 bg-white rounded-xl sm:rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-md sm:hover:shadow-xl transition-all group ${biz.isVerified ? 'order-1' : 'order-3'}`}
                  >
                    <div>
                      {/* Cover Photo & Badges */}
                      <div className="relative h-20 sm:h-36 bg-slate-800 overflow-hidden">
                        <img
                          src={biz.coverUrl || BUSINESS_PLACEHOLDER}
                          alt={biz.name}
                          loading="lazy"
                          decoding="async"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            const image = e.currentTarget;
                            if (!image.src.endsWith('/business-placeholder.svg')) image.src = BUSINESS_PLACEHOLDER;
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                        {/* Top Badges */}
                        <div className="absolute top-1 right-1 sm:top-3 sm:right-3 flex flex-wrap items-center gap-1">
                          {biz.isVerified && (
                            <>
                              <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>موثّق</span>
                              </span>
                              {biz.externalLogoUrl && (
                                <a href={biz.externalLogoUrl} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} title="فتح الرابط الخارجي للصورة التعريفية" aria-label="فتح الرابط الخارجي للصورة التعريفية" className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-xs hover:bg-white">
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                              {biz.externalCoverUrl && (
                                <a href={biz.externalCoverUrl} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} title="فتح الرابط الخارجي لصورة الغلاف" aria-label="فتح الرابط الخارجي لصورة الغلاف" className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-slate-700 shadow-xs hover:bg-white">
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </>
                          )}
                          {!biz.isVerified && (
                            <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                              <span>غير موثق</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Logo & Basic Info */}
                      <div className="p-2 sm:p-5 relative">
                        <div className="absolute -top-5 right-2 sm:-top-10 sm:right-5 w-8 h-8 sm:w-16 sm:h-16 rounded-lg sm:rounded-2xl bg-white p-0.5 sm:p-1 shadow-sm sm:shadow-md ring-1 sm:ring-2 ring-white overflow-hidden">
                          <img
                            src={biz.logoUrl || resolveDefaultImage({ name: biz.name, description: biz.bio, category: biz.category, kind: 'activity' })}
                            alt={biz.name}
                            loading="lazy"
                            decoding="async"
                            className="w-full h-full object-cover rounded-xl bg-slate-100"
                            onError={(e) => {
                              const image = e.currentTarget;
                              const fallback = resolveDefaultImage({ name: biz.name, description: biz.bio, category: biz.category, kind: 'cover' });
                        if (!image.src.endsWith(fallback.replace(/^.*\//, ''))) image.src = fallback;
                            }}
                          />
                        </div>

                        <div className="pt-4 sm:pt-4 space-y-1 sm:space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="w-full break-words font-black text-xs sm:text-base text-slate-900 group-hover:text-emerald-700 transition-colors line-clamp-2">
                              {biz.name}
                            </h3>
                            <span className="hidden sm:inline-block text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              {biz.category}
                            </span>
                          </div>

                          <p className="hidden sm:block text-xs text-slate-500 line-clamp-2 leading-relaxed">
                            {biz.bio}
                          </p>

                          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 font-medium pt-1">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            <span>{formatEgyptianLocation(biz.governorate, biz.markaz, biz.village)}</span>
                          </div>
                          {userCoordinates && distanceKm(userCoordinates, getCoordinates(biz)) !== null && (
                            <p className="hidden sm:block text-[11px] font-bold text-emerald-800">
                              على بُعد {distanceKm(userCoordinates, getCoordinates(biz))!.toFixed(1)} كم
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Footer */}
                    <div className="p-1.5 sm:p-5 sm:pt-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-1 sm:gap-3 border-t border-slate-100 mt-1 sm:mt-2">
                      {whatsappDigits(biz.ownerWhatsApp) ? (
                        <a
                          href={`https://wa.me/${whatsappDigits(biz.ownerWhatsApp)}?text=${encodeURIComponent(
                            `مرحباً، أود الاستفسار عن نشاطكم: ${biz.name}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black text-[10px] sm:text-xs py-2 sm:py-2.5 px-1 sm:px-3 rounded-lg sm:rounded-xl flex items-center justify-center gap-1 transition-colors"
                        >
                          <MessageCircle className="hidden sm:block w-4 h-4 text-emerald-600" />
                          <span>واتساب</span>
                        </a>
                      ) : (
                        <span className="flex-1 text-center text-xs text-slate-400 py-2.5">رقم التواصل غير متاح</span>
                      )}

                      {biz.publicEnabled ? (
                        <button
                          onClick={() => {
                            setSelectedBusinessId(biz.id);
                            setCurrentView('public_storefront');
                          }}
                          className="flex-1 bg-slate-900 hover:bg-emerald-600 text-white font-black text-[10px] sm:text-xs py-2 sm:py-2.5 px-1 sm:px-3 rounded-lg sm:rounded-xl flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-xs"
                        >
                          <span>الكتالوج</span>
                          <ArrowRight className="w-3.5 h-3.5 rotate-180" />
                        </button>
                      ) : (
                        <span className="flex-1 text-center text-xs text-slate-500 bg-slate-50 rounded-xl py-2.5">قسم ضمن دليل المنصة</span>
                      )}
                    </div>
                  </div>
                );
              })}
              {filteredUnconfirmedListings.map((listing) => (
                <button
                  key={`directory-${listing.id}`}
                  type="button"
                  onClick={() => openDirectoryListing(listing.slug)}
                  className="order-2 min-w-0 overflow-hidden rounded-xl sm:rounded-3xl border border-amber-200 bg-white text-right shadow-xs transition hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
                  aria-label={`فتح صفحة ${listing.display_name} — بيانات تحتاج إلى تأكيد`}
                >
                  <div className="relative flex h-20 sm:h-36 items-center justify-center bg-gradient-to-br from-amber-50 via-white to-slate-100">
                    <Store className="h-8 w-8 text-amber-700 sm:h-12 sm:w-12" />
                    <span className="absolute right-1 top-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-black text-amber-900 sm:right-3 sm:top-3 sm:text-[11px]">غير موثق</span>
                  </div>
                  <div className="p-2 sm:p-5">
                    <h3 className="line-clamp-2 break-words text-xs font-black text-slate-900 sm:text-base">{listing.display_name}</h3>
                    <p className="mt-1 line-clamp-2 text-[10px] text-slate-600 sm:text-xs">{listing.taxonomy_specialty || listing.specialty || 'نشاط محلي'}</p>
                    <p className="mt-2 line-clamp-2 text-[10px] text-slate-500 sm:text-xs">{[listing.village, listing.district, listing.governorate].filter(Boolean).join('، ') || listing.address || 'الموقع غير مكتمل'}</p>
                    {userCoordinates && distanceKm(userCoordinates, getCoordinates(listing)) !== null && <p className="mt-2 text-[10px] font-bold text-emerald-800 sm:text-xs">على بُعد {distanceKm(userCoordinates, getCoordinates(listing))!.toFixed(1)} كم</p>}
                    <span className="mt-3 inline-flex rounded-lg bg-slate-900 px-3 py-2 text-[10px] font-black text-white sm:text-xs">عرض التفاصيل <ArrowRight className="mr-1 inline h-3 w-3" /></span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
