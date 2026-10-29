import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Business } from '../types';
import {
  Store,
  Wrench,
  Search,
  MapPin,
  Sparkles,
  Layers,
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
import { fetchPublicDirectoryListings, type PublicDirectoryListing } from '../lib/directoryListings';

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



export const DirectoryView: React.FC = () => {
  const {
    directoryBusinesses,
    directoryLoading,
    functionalGroups,
    categories,
    setSelectedBusinessId,
    setCurrentView,
    adminSettings,
  } = useApp();
  const businesses = directoryBusinesses;

  const [searchQuery, setSearchQuery] = useState('');
  const [unconfirmedListings, setUnconfirmedListings] = useState<PublicDirectoryListing[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetchPublicDirectoryListings().then((rows) => {
      if (!cancelled && Array.isArray(rows)) setUnconfirmedListings(rows.filter((row) => row.listing_status === 'PUBLISHED' && row.claim_status !== 'CLAIMED'));
    }).catch(() => { if (!cancelled) setUnconfirmedListings([]); });
    return () => { cancelled = true; };
  }, []);
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [selectedCategoryKind, setSelectedCategoryKind] = useState<'all' | 'activity' | 'profession'>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('all');
  const [selectedGovFilter, setSelectedGovFilter] = useState<string>('all');
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

  // The directory uses the same canonical taxonomy as the administration forms.
  const selectGroup = (groupId: string) => {
    setSelectedGroupFilter(groupId);
    setSelectedCategoryKind('all');
    setSelectedCategoryId('all');
    setSelectedSpecialty('all');
  };
  const availableCategories = categories.filter((category) =>
    (selectedGroupFilter === 'all' || category.functionalGroupId === selectedGroupFilter) &&
    (selectedCategoryKind === 'all' || (category.classificationType || 'activity') === selectedCategoryKind)
  );
  const selectedTaxonomyCategory = categories.find((category) => category.id === selectedCategoryId);
  const selectedTaxonomyCategoryCode = selectedTaxonomyCategory?.id.startsWith(`cat_${selectedTaxonomyCategory.functionalGroupId}_`)
    ? selectedTaxonomyCategory.id.slice(`cat_${selectedTaxonomyCategory.functionalGroupId}_`.length) : '';
  const categoryForBusiness = (business: Business) =>
    categories.find((category) => business.category === category.name || business.category.startsWith(category.name + ' — ') || (category.classificationType === 'profession' && business.category.startsWith(category.name + ' ')));

  // Governorate filtering is applied to real published business records.
  const [currentCoverIndex, setCurrentCoverIndex] = useState(0);
  // Keep one stable responsive frame for every carousel slide; never size the frame from image dimensions.

  // Filter slides based on selected governorate
  const activeCoverSlides = selectedGovFilter === 'all'
    ? coverSlides
    : coverSlides.filter((slide) => slide.governorates.includes(selectedGovFilter));

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

  const filteredBusinesses = businesses.filter((biz) => {
    // Fail closed: the directory must never expose unpublished or frozen businesses,
    // even when the viewer is a platform administrator with a broader bootstrap scope.
    if ((!biz.publicEnabled && !biz.isOfficialShowcase) || biz.operationalStatus !== 'ACTIVE' || biz.isFrozen) return false;
    const matchesSearch =
      biz.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      biz.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      biz.bio.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesGroup =
      selectedGroupFilter === 'all' || biz.functionalGroupId === selectedGroupFilter;
    const matchedCategory = categoryForBusiness(biz);
    const matchesCategoryKind = selectedCategoryKind === 'all' ||
      (matchedCategory?.classificationType || biz.categoryClassificationType || 'activity') === selectedCategoryKind;
    const matchesCategory = selectedCategoryId === 'all' ||
      Boolean(matchedCategory && selectedTaxonomyCategory && matchedCategory.name === selectedTaxonomyCategory.name);
    const storedSpecialty = String(biz.activitySpecialty || '');
    const categorySuffix = matchedCategory ? biz.category.slice(matchedCategory.name.length).replace(/^\s*—\s*/, '') : '';
    const matchesSpecialty = selectedSpecialty === 'all' ||
      storedSpecialty === selectedSpecialty || categorySuffix === selectedSpecialty;

    const matchesGov =
      selectedGovFilter === 'all' || biz.governorate === selectedGovFilter;

    return matchesSearch && matchesGroup && matchesCategoryKind && matchesCategory && matchesSpecialty && matchesGov;
  }).sort((a, b) => {
    const targetGov = selectedGovFilter === 'all' ? 'الدقهلية' : selectedGovFilter;
    const aProx = a.governorate === targetGov ? 0 : 1;
    const bProx = b.governorate === targetGov ? 0 : 1;
    return aProx - bProx;
  });

  const uniqueGovernorships = Array.from(new Set(businesses.map((b) => b.governorate).filter(Boolean)));

  if (listingSlug) return <DirectoryListingsView detailSlug={listingSlug} onOpen={openDirectoryListing} onBack={closeDirectoryListing} />;

  return (
    <div className="space-y-8 pb-20">
      {/* 1. Full-Width Horizontal Title Bar right under header */}
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

        {/* Functional Groups Filter Row */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-black text-lg text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              <span>التصنيفات والمجموعات الوظيفية</span>
            </h2>
            <span className="text-xs text-slate-500 font-medium">
              اختر قطاعاً لاستعراض الأنشطة التابعة له
            </span>
          </div>

          <div className="grid grid-cols-5 sm:grid-cols-5 lg:grid-cols-5 xl:grid-cols-10 gap-1.5 sm:gap-2">
            <button
              onClick={() => selectGroup('all')}
              aria-pressed={selectedGroupFilter === 'all'}
              className={`group relative flex min-h-28 sm:min-h-36 flex-col items-center justify-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border bg-white p-1.5 sm:p-3 text-center transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${selectedGroupFilter === 'all' ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500' : 'border-slate-200 hover:border-emerald-200'}`}
            >
              <span className={`flex h-9 w-9 sm:h-14 sm:w-14 items-center justify-center rounded-xl sm:rounded-2xl ${selectedGroupFilter === 'all' ? 'bg-emerald-100' : 'bg-slate-100 group-hover:bg-emerald-50'}`}>
                <Store className={`h-7 w-7 ${selectedGroupFilter === 'all' ? 'text-emerald-700' : 'text-slate-600'}`} strokeWidth={1.8} />
              </span>
              <span className="space-y-1">
                <span className="block text-[10px] sm:text-sm font-black leading-tight text-slate-900">كافة الأنشطة</span>
                <span className="block text-[8px] sm:text-[11px] leading-tight text-slate-500 line-clamp-2">جميع القطاعات والمهن</span>
              </span>
              <span className="absolute right-2 top-2 flex items-center gap-1.5" dir="ltr"><span title="أنشطة مؤكدة" className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-100 px-2 text-[10px] font-bold text-emerald-800">{businesses.filter((b) => Boolean(b.publicEnabled || b.isOfficialShowcase) && b.operationalStatus === 'ACTIVE' && !b.isFrozen).length}</span><span title="صفحات دليل غير مؤكدة" className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-100 px-2 text-[10px] font-bold text-emerald-800">{unconfirmedListings.length}</span></span>
            </button>

            {functionalGroups.map((group) => {
              const count = businesses.filter((b) => b.functionalGroupId === group.id && Boolean(b.publicEnabled || b.isOfficialShowcase) && b.operationalStatus === 'ACTIVE' && !b.isFrozen).length;
              const unconfirmedCount = unconfirmedListings.filter((listing) => listing.functional_group_id === group.id).length;
              const isSelected = selectedGroupFilter === group.id;
              return (
                <button
                  key={group.id}
                  onClick={() => selectGroup(group.id)}
                  aria-pressed={isSelected}
                  className={`group relative flex min-h-28 sm:min-h-36 flex-col items-center justify-center gap-2 sm:gap-3 rounded-xl sm:rounded-2xl border bg-white p-1.5 sm:p-3 text-center transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${isSelected ? 'border-emerald-500 bg-emerald-50/70 ring-2 ring-emerald-500' : 'border-slate-200 hover:border-emerald-200'}`}
                >
                  <span className={`flex h-9 w-9 sm:h-14 sm:w-14 items-center justify-center rounded-xl sm:rounded-2xl transition-colors ${isSelected ? 'bg-emerald-100' : 'bg-slate-100 group-hover:bg-emerald-50'}`}>
                    {ICONS_MAP[group.id] || <Layers className="h-5 w-5 sm:h-7 sm:w-7 text-slate-600" strokeWidth={1.8} />}
                  </span>
                  <span className="space-y-1">
                    <span className="block text-[10px] sm:text-sm font-black leading-tight text-slate-900">{group.shortName}</span>
                    <span className="block text-[8px] sm:text-[11px] leading-tight text-slate-500 line-clamp-2">{group.name}</span>
                  </span>
                  <span className="absolute right-2 top-2 flex items-center gap-1.5" dir="ltr"><span title="أنشطة مؤكدة" className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-[10px] font-bold ${isSelected ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{count}</span>{unconfirmedCount > 0 && <span title="صفحات دليل غير مؤكدة" className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-100 px-2 text-[10px] font-bold text-emerald-800">{unconfirmedCount}</span>}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Hierarchical taxonomy navigation: group -> activity/profession -> specialty -> matching businesses */}
        <section aria-label="تصفح التصنيفات والتخصصات" className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900">تصفح حسب التصنيف والتخصص</h2>
              <p className="mt-1 text-xs text-slate-500">افتح المجموعة ثم النشاط أو المهنة، وبعدها اختر التخصص لعرض الجهات المطابقة فقط.</p>
            </div>
            {(selectedGroupFilter !== 'all' || selectedCategoryId !== 'all' || selectedSpecialty !== 'all') && (
              <button type="button" onClick={() => { selectGroup('all'); setSelectedGovFilter('all'); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                عرض كل التصنيفات
              </button>
            )}
          </div>

          <nav aria-label="مسار التصنيف" className="flex flex-wrap items-center gap-2 text-xs font-bold">
            <button type="button" onClick={() => selectGroup('all')} className={`rounded-lg px-3 py-2 ${selectedGroupFilter === 'all' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>كل المجموعات</button>
            {selectedGroupFilter !== 'all' && (
              <>
                <ArrowRight className="h-3.5 w-3.5 rotate-180 text-slate-400" />
                <button type="button" onClick={() => { setSelectedCategoryId('all'); setSelectedSpecialty('all'); }} className={`rounded-lg px-3 py-2 ${selectedCategoryId === 'all' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>
                  {functionalGroups.find((group) => group.id === selectedGroupFilter)?.name || 'المجموعة'}
                </button>
              </>
            )}
            {selectedTaxonomyCategory && (
              <>
                <ArrowRight className="h-3.5 w-3.5 rotate-180 text-slate-400" />
                <button type="button" onClick={() => setSelectedSpecialty('all')} className={`rounded-lg px-3 py-2 ${selectedSpecialty === 'all' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}>{selectedTaxonomyCategory.name}</button>
              </>
            )}
            {selectedSpecialty !== 'all' && (
              <>
                <ArrowRight className="h-3.5 w-3.5 rotate-180 text-slate-400" />
                <span className="rounded-lg bg-emerald-100 px-3 py-2 text-emerald-800">{selectedSpecialty}</span>
              </>
            )}
          </nav>

          {selectedCategoryId === 'all' ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {availableCategories
                .filter((category) => selectedGroupFilter === 'all' || category.functionalGroupId === selectedGroupFilter)
                .filter((category) => (selectedCategoryKind === 'all' || category.classificationType === selectedCategoryKind))
                .map((category) => {
                  const count = businesses.filter((business) => {
                    if ((!business.publicEnabled && !business.isOfficialShowcase) || business.operationalStatus !== 'ACTIVE' || business.isFrozen) return false;
                    return categoryForBusiness(business)?.id === category.id;
                  }).length;
                  const unconfirmedCount = unconfirmedListings.filter((listing) => listing.taxonomy_category_id === category.id).length;
                  return (
                    <button key={category.id} type="button" onClick={() => { setSelectedCategoryId(category.id); setSelectedSpecialty('all'); }} className="flex min-h-20 items-center justify-between gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-right transition hover:border-emerald-400 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                      <span className="min-w-0">
                        <span className="block text-sm font-black text-slate-900">{category.name}</span>
                        <span className="mt-1 block text-[11px] text-slate-500">{category.classificationType === 'profession' ? 'مهنة' : 'نشاط'}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5" dir="ltr">
                        <span title="أنشطة مؤكدة" className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-100 px-2 text-xs font-black text-emerald-800">{count}</span>
                        {unconfirmedCount > 0 && <span title="صفحات دليل غير مؤكدة" className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-100 px-2 text-xs font-black text-emerald-800">{unconfirmedCount}</span>}
                      </span>
                    </button>
                  );
                })}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-black text-slate-900">{selectedTaxonomyCategory?.classificationType === 'profession' ? 'تخصصات المهنة' : 'أنواع النشاط'}: {selectedTaxonomyCategory?.name}</h3>
                <button type="button" onClick={() => { setSelectedCategoryId('all'); setSelectedSpecialty('all'); }} className="text-xs font-bold text-emerald-800 underline">رجوع لقائمة التصنيفات</button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                <button type="button" onClick={() => setSelectedSpecialty('all')} aria-pressed={selectedSpecialty === 'all'} className={`rounded-xl border p-3 text-right text-sm font-black transition ${selectedSpecialty === 'all' ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-800 hover:border-emerald-300'}`}>
                  كل {selectedTaxonomyCategory?.classificationType === 'profession' ? 'التخصصات' : 'الأنواع'}
                </button>
                {(selectedTaxonomyCategory?.specialties || []).map((specialty) => {
                  const confirmedSpecialtyCount = businesses.filter((business) => {
                    if ((!business.publicEnabled && !business.isOfficialShowcase) || business.operationalStatus !== 'ACTIVE' || business.isFrozen) return false;
                    if (categoryForBusiness(business)?.id !== selectedTaxonomyCategory?.id) return false;
                    const suffix = business.category.slice(categoryForBusiness(business)?.name.length || 0).replace(/^\\s*—\\s*/, '');
                    return String(business.activitySpecialty || '') === specialty || suffix === specialty;
                  }).length;
                  const unconfirmedSpecialtyCount = unconfirmedListings.filter((listing) =>
                    listing.taxonomy_category_id === selectedTaxonomyCategory?.id && listing.taxonomy_specialty === specialty
                  ).length;
                  return (
                    <button key={specialty} type="button" onClick={() => setSelectedSpecialty(specialty)} aria-pressed={selectedSpecialty === specialty} className={`flex items-center justify-between gap-2 rounded-xl border p-3 text-right text-sm font-bold transition ${selectedSpecialty === specialty ? 'border-emerald-500 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-800 hover:border-emerald-300'}`}>
                      <span>{specialty}</span>
                      <span className="flex shrink-0 items-center gap-1.5" dir="ltr">
                        <span title="أنشطة مؤكدة" className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-100 px-2 text-xs font-black text-emerald-800">{confirmedSpecialtyCount}</span>
                        {unconfirmedSpecialtyCount > 0 && <span title="صفحات دليل غير مؤكدة" className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-100 px-2 text-xs font-black text-emerald-800">{unconfirmedSpecialtyCount}</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500">عدد الجهات المطابقة للاختيار الحالي: <strong className="text-slate-900">{filteredBusinesses.length}</strong></p>
            </div>
          )}
        </section>

        {/* Activity / profession / specialty filters driven by the canonical taxonomy */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="block text-xs font-bold text-slate-700">
            نوع التصنيف
            <select
              value={selectedCategoryKind}
              onChange={(e) => {
                setSelectedCategoryKind(e.target.value as 'all' | 'activity' | 'profession');
                setSelectedCategoryId('all');
                setSelectedSpecialty('all');
              }}
              className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-xs font-bold"
            >
              <option value="all">الأنشطة والمهن</option>
              <option value="activity">الأنشطة</option>
              <option value="profession">المهن</option>
            </select>
          </label>
          <label className="block text-xs font-bold text-slate-700">
            النشاط أو المهنة
            <select
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                setSelectedSpecialty('all');
              }}
              className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-xs font-bold"
            >
              <option value="all">كل الأنشطة والمهن</option>
              {functionalGroups
                .filter((group) => selectedGroupFilter === 'all' || group.id === selectedGroupFilter)
                .map((group) => {
                  const groupCategories = availableCategories.filter((category) => category.functionalGroupId === group.id);
                  if (!groupCategories.length) return null;
                  return (
                    <optgroup key={group.id} label={group.name}>
                      {groupCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {(category.classificationType === 'profession' ? 'مهنة: ' : 'نشاط: ') + category.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
            </select>
          </label>
          <label className="block text-xs font-bold text-slate-700">
            التخصص الدقيق
            <select
              value={selectedSpecialty}
              disabled={!selectedTaxonomyCategory?.specialties?.length}
              onChange={(e) => setSelectedSpecialty(e.target.value)}
              className="mt-1 w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-xs font-bold disabled:opacity-50"
            >
              <option value="all">كل التخصصات</option>
              {(selectedTaxonomyCategory?.specialties || []).map((specialty) => (
                <option key={specialty} value={specialty}>{specialty}</option>
              ))}
            </select>
          </label>
        </div>

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

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="flex items-center gap-1.5 text-xs text-slate-600 font-bold whitespace-nowrap">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span>المحافظة (تصفية الإعلانات والأنشطة):</span>
            </div>
            <select
              value={selectedGovFilter}
              onChange={(e) => setSelectedGovFilter(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-xs sm:text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden"
            >
              <option value="all">كافة المحافظات المصرية (إعلانات عامة)</option>
              {uniqueGovernorships.map((gov) => (
                <option key={gov} value={gov}>
                  محافظة {gov}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Businesses Grid (Sorted by Proximity) */}
        <div className="space-y-6">
          <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="font-black text-lg text-slate-900 flex items-center gap-2">
              <Store className="w-5 h-5 text-emerald-600" />
              <span>الأنشطة والخدمات المتاحة ({filteredBusinesses.length})</span>
            </h2>
          </div>

          {filteredBusinesses.length === 0 ? (
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
                  : 'جرب تغيير كلمات البحث أو تصنيف القطاع أو المحافظة.'}
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
                const group = functionalGroups.find((g) => g.id === biz.functionalGroupId);

                return (
                  <div
                    key={biz.id}
                    className="min-w-0 bg-white rounded-xl sm:rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-md sm:hover:shadow-xl transition-all group"
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
                            <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>موثّق</span>
                            </span>
                          )}
                          {group && (
                            <span className={`hidden sm:inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${group.badgeColor}`}>
                              {group.shortName}
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
            </div>
          )}
        </div>
        {(searchQuery.trim() || selectedGroupFilter !== 'all' || selectedCategoryId !== 'all') && (
          <DirectoryListingsView
            onOpen={openDirectoryListing}
            onBack={closeDirectoryListing}
            functionalGroupId={selectedGroupFilter === 'all' ? null : selectedGroupFilter}
            searchQuery={searchQuery}
            taxonomyCategoryId={selectedCategoryId === 'all' ? null : selectedTaxonomyCategory?.id || null}
            taxonomySpecialty={selectedSpecialty === 'all' ? null : selectedSpecialty}
          />
        )}
      </div>
    </div>
  );
};
