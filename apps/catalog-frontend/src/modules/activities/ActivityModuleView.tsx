import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRight, BarChart3, BriefcaseBusiness, CalendarDays, Megaphone, Package, Search, ShieldCheck, Store, Target, Users } from 'lucide-react';
import type { ActivityCategory, Business } from '../../types';
import type { PublicDirectoryListing } from '../../lib/directoryListings';
import { useApp } from '../../context/AppContext';
import { resolveActivityModuleConfig } from './activityModuleRegistry';
import { resolveCanonicalSpecialty } from '../../data/productionDefaults';

type Section = 'overview' | 'specialties' | 'marketing' | 'operations';
interface Props {
  category: ActivityCategory;
  confirmedCount: number;
  unconfirmedCount: number;
  onBack: () => void;
  businesses: Business[];
  listings: PublicDirectoryListing[];
  onOpenListing: (slug: string) => void;
  onOpenBusiness: (businessId: string) => void;
  onDirectoryListingFiltersChange: (query: string, specialty: string) => void;
  onLoadMoreListings: () => void;
  hasMoreListings: boolean;
  loadingMoreListings: boolean;
  listingsLoading: boolean;
  parentGroupName?: string;
}

const sections: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'الرئيسية', icon: <Store className="h-4 w-4" /> },
  { id: 'specialties', label: 'التخصصات', icon: <Package className="h-4 w-4" /> },
  { id: 'marketing', label: 'التسويق والإعلان', icon: <Megaphone className="h-4 w-4" /> },
  { id: 'operations', label: 'إدارة المجال', icon: <BriefcaseBusiness className="h-4 w-4" /> },
];

const Metric: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <article className={`rounded-2xl border p-4 ${color}`}><p className="text-xs font-bold">{label}</p><p className="mt-2 text-2xl font-black">{value.toLocaleString('ar-EG')}</p></article>
);

export const ActivityModuleView: React.FC<Props> = ({ category, confirmedCount, unconfirmedCount, onBack, businesses, listings, onOpenListing, onOpenBusiness, onDirectoryListingFiltersChange, onLoadMoreListings, hasMoreListings, loadingMoreListings, listingsLoading, parentGroupName }) => {
  const [activeSection, setActiveSection] = useState<Section>('specialties');
  const specialtyFromUrl = new URLSearchParams(window.location.search).get('specialty');
  const [selectedSpecialty, setSelectedSpecialty] = useState<string | null>(specialtyFromUrl);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleActivityCount, setVisibleActivityCount] = useState(20);
  const [campaignGoal, setCampaignGoal] = useState('زيادة الطلبات والاستفسارات');
  const [campaignBudget, setCampaignBudget] = useState('3000');
  const [campaignDuration, setCampaignDuration] = useState('30');
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['فيسبوك', 'واتساب', 'إنستجرام']);
  const [campaignPrepared, setCampaignPrepared] = useState(false);
  const { adminSettings } = useApp();
  useEffect(() => {
    setVisibleActivityCount(20);
    onDirectoryListingFiltersChange(searchQuery, selectedSpecialty || 'all');
  }, [searchQuery, selectedSpecialty, onDirectoryListingFiltersChange]);
  const specialties = useMemo(() => category.specialties || [], [category.specialties]);
  const moduleConfig = useMemo(() => resolveActivityModuleConfig(category, adminSettings.activityModuleOverrides), [category, adminSettings.activityModuleOverrides]);
  const marketing = moduleConfig.marketing;
  const normalizeDirectorySearch = (value: unknown) => String(value || '').toLocaleLowerCase('ar-EG')
    .normalize('NFKC').replace(/[أإآ]/g, 'ا').replace(/[ىي]/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[\u064B-\u065F\u0670]/g, '').replace(/\s+/g, ' ').trim();
  const matchesSpecialty = (value: string) => Boolean(selectedSpecialty) &&
    resolveCanonicalSpecialty(value, category.id) === resolveCanonicalSpecialty(selectedSpecialty || '', category.id);
  const matchesBusinessSpecialty = (business: Business, specialty = selectedSpecialty) => {
    if (!specialty) return true;
    const categorySuffix = business.category.startsWith(category.name)
      ? business.category.slice(category.name.length).replace(/^\s*—\s*/, '')
      : business.category;
    const target = resolveCanonicalSpecialty(specialty, category.id);
    return resolveCanonicalSpecialty(business.activitySpecialty || '', category.id) === target ||
      resolveCanonicalSpecialty(categorySuffix, category.id) === target;
  };
  const normalizedQuery = normalizeDirectorySearch(searchQuery);
  const matchesSearch = (values: Array<string | null | undefined>) => !normalizedQuery ||
    normalizeDirectorySearch(values.filter(Boolean).join(' ')).includes(normalizedQuery);
  const verifiedBusinesses = businesses.filter((business) => business.isVerified &&
    matchesBusinessSpecialty(business) &&
    matchesSearch([business.name, business.activitySpecialty, business.category, business.phone, business.ownerWhatsApp, business.village, business.markaz, business.governorate]));
  const unverifiedBusinesses = businesses.filter((business) => !business.isVerified &&
    matchesBusinessSpecialty(business) &&
    matchesSearch([business.name, business.activitySpecialty, business.category, business.phone, business.ownerWhatsApp, business.village, business.markaz, business.governorate]));
  const visibleListings = listings.filter((listing) =>
    (!selectedSpecialty || matchesSpecialty(listing.taxonomy_specialty || listing.specialty || '')) &&
    matchesSearch([listing.display_name, listing.taxonomy_specialty, listing.specialty, listing.phone, listing.secondary_phone, listing.village, listing.district, listing.governorate]));
    const allVisibleBusinesses = [...verifiedBusinesses, ...unverifiedBusinesses];
  const visibleBusinesses = allVisibleBusinesses.slice(0, visibleActivityCount);
  const renderedListings = visibleListings.slice(0, Math.max(0, visibleActivityCount - visibleBusinesses.length));
  const hasMoreActivityResults = allVisibleBusinesses.length + visibleListings.length > visibleActivityCount || hasMoreListings;
  const countForSpecialty = (specialty: string) => businesses.filter((business) =>
    matchesBusinessSpecialty(business, specialty)).length +
    listings.filter((listing) => resolveCanonicalSpecialty(listing.taxonomy_specialty || listing.specialty || '', category.id) === resolveCanonicalSpecialty(specialty, category.id)).length;
  const openSpecialtyFolder = (specialty: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('specialty', specialty);
    window.history.pushState({ mantiqatixSpecialty: specialty }, '', url.pathname + url.search + url.hash);
    setSelectedSpecialty(specialty);
    setSearchQuery('');
  };
  const closeSpecialtyFolder = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('specialty');
    window.history.pushState({ mantiqatixSpecialty: null }, '', url.pathname + url.search + url.hash);
    setSelectedSpecialty(null);
    setSearchQuery('');
  };
  useEffect(() => {
    const syncSpecialtyRoute = () => {
      const requested = new URLSearchParams(window.location.search).get('specialty');
      setSelectedSpecialty(requested && specialties.includes(requested) ? requested : null);
      setSearchQuery('');
    };
    const requested = new URLSearchParams(window.location.search).get('specialty');
    if (requested && !specialties.includes(requested)) {
      const url = new URL(window.location.href);
      url.searchParams.delete('specialty');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
      setSelectedSpecialty(null);
    }
    window.addEventListener('popstate', syncSpecialtyRoute);
    return () => window.removeEventListener('popstate', syncSpecialtyRoute);
  }, [specialties]);
  const campaignPeriodCount = Math.min(6, Math.max(1, Math.ceil(Number(campaignDuration) / 5)));
  const campaignPeriodLength = Math.ceil(Number(campaignDuration) / campaignPeriodCount);
  const getChannelShare = (index: number) => {
    if (selectedChannels.length === 1) return 100;
    if (selectedChannels.length === 2) return index === 0 ? 60 : 40;
    if (index === 0) return 40;
    if (index === 1) return 25;
    const remaining = selectedChannels.length - 2;
    const base = Math.floor(35 / remaining);
    return index === selectedChannels.length - 1 ? 35 - base * (remaining - 1) : base;
  };

  return (
    <main dir="rtl" className="mx-auto min-h-[70vh] max-w-7xl space-y-5 px-3 py-5 sm:px-6 sm:py-8">
      <header className="rounded-3xl bg-gradient-to-l from-slate-950 via-emerald-950 to-slate-900 p-5 text-white shadow-lg sm:p-8">
        <button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/15"><ArrowRight className="h-4 w-4" /> {parentGroupName ? 'العودة إلى ' + parentGroupName : 'العودة إلى الأنشطة'}</button>
        <p className="text-xs font-bold text-emerald-300">MantiqatiX / وحدة النشاط</p>
        <h1 className="mt-2 text-2xl font-black sm:text-4xl">{category.name}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-white/75">{category.description || `الوحدة المستقلة لنشاط ${category.name} وتخصصاته والجهات العاملة فيه.`}</p>
        <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
          <span className="rounded-full bg-white/10 px-3 py-2">التخصصات: {specialties.length.toLocaleString('ar-EG')}</span>
          <span className="rounded-full bg-emerald-400/15 px-3 py-2 text-emerald-100">موثق: {confirmedCount.toLocaleString('ar-EG')}</span>
          <span className="rounded-full bg-red-400/15 px-3 py-2 text-red-100">غير موثق: {unconfirmedCount.toLocaleString('ar-EG')}</span>
        </div>
      </header>

      <nav aria-label="أقسام وحدة النشاط" className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {sections.map((item) => <button key={item.id} type="button" onClick={() => setActiveSection(item.id)} aria-current={activeSection === item.id ? 'page' : undefined}
          className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black transition sm:px-4 ${activeSection === item.id ? 'bg-emerald-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{item.icon}{item.label}</button>)}
      </nav>

      {activeSection === 'overview' && <section className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Metric label="الأنشطة الموثقة" value={confirmedCount} color="border-emerald-200 bg-emerald-50 text-emerald-800" />
          <Metric label="صفحات غير موثقة" value={unconfirmedCount} color="border-red-200 bg-red-50 text-red-700" />
          <Metric label="التخصصات" value={specialties.length} color="border-slate-200 bg-slate-50 text-slate-800" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { id: 'specialties' as const, title: 'التخصصات والجهات', description: 'افتح تخصصًا لاستعراض الجهات التابعة له.', icon: <Package className="h-6 w-6" /> },
            { id: 'marketing' as const, title: 'التسويق والإعلان', description: 'خطة تسويق موجهة لطبيعة المجال وجمهوره.', icon: <Megaphone className="h-6 w-6" /> },
            { id: 'operations' as const, title: 'إدارة المجال', description: 'وظائف التشغيل المرتبطة بطبيعة النشاط.', icon: <BriefcaseBusiness className="h-6 w-6" /> },
          ].map((item) => <button key={item.id} type="button" onClick={() => setActiveSection(item.id)} className="rounded-2xl border border-slate-200 bg-white p-5 text-right transition hover:border-emerald-300 hover:bg-emerald-50/40"><span className="text-emerald-700">{item.icon}</span><span className="mt-3 block font-black text-slate-900">{item.title}</span><span className="mt-1 block text-xs leading-6 text-slate-500">{item.description}</span></button>)}
        </div>
      </section>}

      {activeSection === 'specialties' && <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">{selectedSpecialty ? selectedSpecialty : `كل ${category.name}`}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {selectedSpecialty
              ? 'هذا مجلد مستقل يعرض الجهات التابعة لهذا التخصص فقط.'
              : `تظهر هنا جميع ${category.name} أولًا، ثم يمكنك استخدام التصنيفات الفرعية لتضييق النتائج.`}
          </p>
        </div>

        {selectedSpecialty && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="text-xs font-bold text-emerald-950">{parentGroupName ? parentGroupName + ' / ' : ''}{category.name} / {selectedSpecialty}</div>
          <button type="button" onClick={closeSpecialtyFolder} className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-black text-emerald-900 hover:bg-emerald-100">العودة إلى التخصصات</button>
        </div>}

        {!selectedSpecialty && specialties.length > 0 && <div className="order-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {specialties.map((specialty) => {
            const total = countForSpecialty(specialty);
            return <button key={specialty} type="button" onClick={() => openSpecialtyFolder(specialty)}
              className="group flex min-h-32 flex-col items-start justify-between rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50/50">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Package className="h-6 w-6" /></span>
              <span className="mt-3 block w-full font-black text-slate-900">{specialty}</span>
              <span className="mt-1 text-xs font-bold text-slate-500">{total.toLocaleString('ar-EG')} جهة ضمن النتائج المحمّلة</span>
            </button>;
          })}
        </div>}

        <div className="order-2 space-y-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={`ابحث داخل ${selectedSpecialty || `كل ${category.name}`} بالاسم أو الهاتف أو المنطقة`}
              aria-label={`البحث داخل ${selectedSpecialty || `كل ${category.name}`}`}
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white py-3 pr-12 pl-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
          </label>
          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-800">موثق: {verifiedBusinesses.length.toLocaleString('ar-EG')}</span>
            <span className="rounded-full bg-red-50 px-3 py-2 text-red-700">غير موثق: {(unverifiedBusinesses.length + visibleListings.length).toLocaleString('ar-EG')}</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleBusinesses.map((business) => <article key={business.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${business.isVerified ? 'border-emerald-200' : 'border-red-200'}`}>
              <div className="relative h-28 bg-slate-100">
                {business.coverUrl && <img src={business.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
                <span className={`absolute right-2 top-2 rounded-full px-2 py-1 text-[10px] font-black text-white ${business.isVerified ? 'bg-emerald-700' : 'bg-red-700'}`}>{business.isVerified ? 'موثق' : 'غير موثق'}</span>
              </div>
              <div className="flex items-center gap-3 p-3">
                {business.logoUrl ? <img src={business.logoUrl} alt="" className="h-12 w-12 rounded-xl border object-cover" /> : <Store className="h-10 w-10 text-slate-400" />}
                <div className="min-w-0"><h3 className="font-black text-slate-900">{business.name}</h3><p className="text-xs text-slate-500">{business.activitySpecialty || business.category}</p>
                  <p className="text-xs text-slate-500">{[business.village, business.markaz, business.governorate].filter(Boolean).join('، ')}</p></div>
              </div>
              <div className="flex gap-2 border-t p-3">
                <a href={`tel:${business.phone || business.ownerWhatsApp}`} className="min-w-0 flex-1 truncate text-xs font-bold text-slate-700">{business.phone || business.ownerWhatsApp}</a>
                {business.publicEnabled ? <button type="button" onClick={() => onOpenBusiness(business.id)} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white">عرض الكتالوج</button> : <span className="rounded-lg bg-slate-50 px-3 py-2 text-[10px] font-bold text-slate-500">ضمن الدليل</span>}
              </div>
            </article>)}
            {renderedListings.map((listing) => <button key={listing.id} type="button" onClick={() => onOpenListing(listing.slug)} className="overflow-hidden rounded-2xl border border-red-200 bg-white text-right shadow-sm">
              <div className="relative flex h-28 items-center justify-center bg-slate-100"><Store className="h-10 w-10 text-slate-400" /><span className="absolute right-2 top-2 rounded-full bg-red-700 px-2 py-1 text-[10px] font-black text-white">غير موثق</span></div>
              <div className="p-3"><h3 className="font-black text-slate-900">{listing.display_name}</h3><p className="mt-1 text-xs text-slate-500">{listing.taxonomy_specialty || listing.specialty || category.name}</p>
                <p className="mt-1 text-xs text-slate-500">{[listing.village, listing.district, listing.governorate].filter(Boolean).join('، ')}</p><p className="mt-2 text-xs font-bold text-red-700">{listing.phone || listing.secondary_phone}</p></div>
            </button>)}
            {listingsLoading && <p role="status" className="col-span-full rounded-xl bg-slate-50 p-4 text-center text-xs font-bold text-slate-600">جارٍ تحميل نتائج الدليل لهذا النشاط…</p>}
            {!listingsLoading && verifiedBusinesses.length + unverifiedBusinesses.length + visibleListings.length === 0 &&
              <p className="col-span-full rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">لا توجد نتائج مطابقة داخل هذا النشاط والنطاق الجغرافي المحدد.</p>}
          </div>
          {hasMoreActivityResults && (
            <div className="flex justify-center pt-2">
              <button type="button" onClick={() => {
                setVisibleActivityCount((current) => current + 20);
                if (hasMoreListings) onLoadMoreListings();
              }} disabled={loadingMoreListings}
                className="min-h-11 rounded-xl border border-emerald-200 bg-white px-6 py-3 text-xs font-black text-emerald-800 shadow-sm transition hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60">
                {loadingMoreListings ? 'جارٍ تحميل المزيد…' : selectedSpecialty ? 'رؤية المزيد من هذا التخصص' : 'رؤية المزيد من النتائج'}
              </button>
            </div>
          )}
        </div>
      </section>}

      {activeSection === 'marketing' && <section className="space-y-5">
        <header className="rounded-2xl border border-emerald-200 bg-gradient-to-l from-emerald-950 to-slate-900 p-5 text-white">
          <div className="flex items-center gap-2"><Megaphone className="h-6 w-6 text-emerald-300" /><span className="text-xs font-black text-emerald-200">ADVANCED MARKETING WORKSPACE</span></div>
          <h2 className="mt-2 text-xl font-black">مركز التسويق المتقدم — {category.name}</h2>
          <p className="mt-2 text-sm leading-7 text-white/75">أنشئ خطة تسويقية مخصصة للنشاط، وحدد هدف الحملة وميزانيتها وقنواتها، ثم جهّز تقويم المحتوى ومؤشرات القياس.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-white/10 px-3 py-2">خطة خاصة بالنشاط</span><span className="rounded-full bg-white/10 px-3 py-2">تسويق محلي وجغرافي</span><span className="rounded-full bg-white/10 px-3 py-2">قمع تحويل ومؤشرات أداء</span></div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Metric label="الجهات الموثقة" value={confirmedCount} color="border-emerald-200 bg-emerald-50 text-emerald-800" />
          <Metric label="الجهات غير الموثقة" value={unconfirmedCount} color="border-red-200 bg-red-50 text-red-700" />
          <Metric label="محاور المحتوى" value={marketing.contentPillars.length} color="border-slate-200 bg-slate-50 text-slate-800" />
          <Metric label="أفكار الحملات" value={marketing.campaignIdeas.length} color="border-blue-200 bg-blue-50 text-blue-800" />
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
            <h3 className="font-black text-slate-900">الاستراتيجية التسويقية للنشاط</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{marketing.objective}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-black text-slate-500">الجمهور المستهدف</p><p className="mt-2 text-sm leading-7 text-slate-700">{marketing.audience}</p></div>
              <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-black text-slate-500">التموضع والقيمة المقترحة</p><p className="mt-2 text-sm leading-7 text-slate-700">{marketing.positioning}</p></div>
            </div>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2"><Target className="h-5 w-5 text-emerald-700" /><h3 className="font-black text-slate-900">أفكار الحملات المقترحة</h3></div>
            <ul className="mt-3 space-y-2">{marketing.campaignIdeas.map((item) => <li key={item} className="rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-700">{item}</li>)}</ul>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2"><Package className="h-5 w-5 text-emerald-700" /><h3 className="font-black text-slate-900">أعمدة المحتوى</h3></div>
            <div className="mt-3 space-y-2">{marketing.contentPillars.map((item, index) => <div key={item} className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-xs font-black text-emerald-800">{index + 1}</span><span className="text-sm leading-6 text-slate-700">{item}</span></div>)}</div>
          </article>
        </div>

        <article className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-emerald-700" /><div><h3 className="font-black text-slate-900">منشئ الحملة التسويقية</h3><p className="mt-1 text-xs text-slate-500">كوّن مسودة خطة قابلة للمراجعة قبل اعتمادها.</p></div></div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs font-bold text-slate-600">هدف الحملة<select value={campaignGoal} onChange={(event) => { setCampaignGoal(event.target.value); setCampaignPrepared(false); }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900"><option>زيادة الطلبات والاستفسارات</option><option>زيادة الزيارات للمقر أو الفرع</option><option>إطلاق منتج أو خدمة جديدة</option><option>زيادة الوعي والانتشار المحلي</option><option>استعادة العملاء الحاليين</option><option>جمع عملاء محتملين</option></select></label>
            <label className="text-xs font-bold text-slate-600">الميزانية التقديرية بالجنيه المصري<input type="number" min="0" value={campaignBudget} onChange={(event) => { setCampaignBudget(event.target.value); setCampaignPrepared(false); }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900" /></label>
            <label className="text-xs font-bold text-slate-600">مدة الحملة<select value={campaignDuration} onChange={(event) => { setCampaignDuration(event.target.value); setCampaignPrepared(false); }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-900"><option value="7">7 أيام</option><option value="14">14 يومًا</option><option value="30">30 يومًا</option><option value="60">60 يومًا</option><option value="90">90 يومًا</option></select></label>
          </div>
          <div><p className="mb-2 text-xs font-black text-slate-700">قنوات التسويق</p><div className="flex flex-wrap gap-2">{['فيسبوك', 'إنستجرام', 'واتساب', 'تيك توك', 'Google', 'موقع النشاط', 'التسويق الميداني'].map((channel) => <button key={channel} type="button" aria-pressed={selectedChannels.includes(channel)} onClick={() => { setSelectedChannels((current) => current.includes(channel) ? current.filter((item) => item !== channel) : [...current, channel]); setCampaignPrepared(false); }} className={`rounded-xl border px-3 py-2 text-xs font-bold ${selectedChannels.includes(channel) ? 'border-emerald-700 bg-emerald-700 text-white' : 'border-slate-200 bg-white text-slate-700'}`}>{channel}</button>)}</div></div>
          <button type="button" disabled={selectedChannels.length === 0 || !campaignBudget || Number(campaignBudget) < 0} onClick={() => setCampaignPrepared(true)} className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40">إعداد الخطة التسويقية</button>
          {campaignPrepared && <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="font-black text-emerald-950">مسودة خطة {category.name}</h4><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-800">غير منشورة — للمراجعة</span></div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4"><div className="rounded-xl bg-white p-3"><p className="text-[10px] text-slate-500">الهدف</p><p className="mt-1 text-xs font-black text-slate-800">{campaignGoal}</p></div><div className="rounded-xl bg-white p-3"><p className="text-[10px] text-slate-500">الميزانية</p><p className="mt-1 text-sm font-black text-slate-800">{Number(campaignBudget).toLocaleString('ar-EG')} ج.م</p></div><div className="rounded-xl bg-white p-3"><p className="text-[10px] text-slate-500">المدة</p><p className="mt-1 text-sm font-black text-slate-800">{campaignDuration} يوم</p></div><div className="rounded-xl bg-white p-3"><p className="text-[10px] text-slate-500">القنوات</p><p className="mt-1 text-sm font-black text-slate-800">{selectedChannels.length} قنوات</p></div></div>
            <div><h5 className="text-sm font-black text-emerald-950">توزيع الميزانية المقترح</h5><div className="mt-2 space-y-2">{selectedChannels.map((channel, index) => { const share = getChannelShare(index); return <div key={channel} className="flex items-center gap-2 text-xs"><span className="w-28 font-bold text-slate-700">{channel}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-emerald-600" style={{ width: share + '%' }} /></div><span className="w-20 text-left font-bold text-slate-700">{share}% · {Math.round(Number(campaignBudget) * share / 100).toLocaleString('ar-EG')} ج.م</span></div>; })}</div></div>
            <div><h5 className="text-sm font-black text-emerald-950">تقويم المحتوى المقترح</h5><div className="mt-2 grid gap-2 sm:grid-cols-2">{Array.from({ length: campaignPeriodCount }, (_, index) => <div key={index} className="rounded-xl bg-white p-3"><p className="text-[10px] font-black text-emerald-700">الأيام {index * campaignPeriodLength + 1} – {Math.min((index + 1) * campaignPeriodLength, Number(campaignDuration))}</p><p className="mt-1 text-xs font-bold text-slate-800">{marketing.contentPillars[index % marketing.contentPillars.length] || 'محتوى تعريفي بالنشاط'}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{marketing.campaignIdeas[index % marketing.campaignIdeas.length] || 'منشور تعريفي ودعوة لاتخاذ إجراء'}</p></div>)}</div></div>
            <div><h5 className="text-sm font-black text-emerald-950">قمع التحويل ومؤشرات الأداء</h5><div className="mt-2 grid gap-2 sm:grid-cols-4">{[{ label: 'الوصول', metric: 'عدد الأشخاص الذين شاهدوا المحتوى' }, { label: 'التفاعل', metric: 'النقرات والحفظ والرسائل' }, { label: 'العملاء المحتملون', metric: 'استفسارات مؤهلة ومكالمات' }, { label: 'التحويل', metric: 'طلبات أو حجوزات أو زيارات فعلية' }].map((item) => <div key={item.label} className="rounded-xl bg-white p-3"><p className="text-xs font-black text-emerald-800">{item.label}</p><p className="mt-1 text-[11px] leading-5 text-slate-600">{item.metric}</p></div>)}</div></div>
            <div className="rounded-xl border border-emerald-200 bg-white p-3"><p className="text-xs font-black text-slate-800">مسودة رسالة إعلانية</p><p className="mt-2 text-sm leading-7 text-slate-700">بتدور على {category.name} في منطقتك؟ تعرّف على خدماتنا وتفاصيلنا، وتواصل معنا لمعرفة الخيارات المتاحة والعرض المناسب ليك.</p></div>
          </div>}
        </article>

        <div className="grid gap-3 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><BarChart3 className="h-5 w-5 text-emerald-700" /><h3 className="font-black text-slate-900">لوحة مؤشرات الأداء</h3></div><div className="mt-3 grid grid-cols-2 gap-2">{['الوصول والانطباعات','معدل التفاعل','تكلفة العميل المحتمل','معدل التحويل','الطلبات الناتجة','العائد على الإنفاق'].map((item) => <div key={item} className="rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-700">{item}<p className="mt-1 text-[10px] font-normal text-slate-400">بانتظار ربط مصدر بيانات</p></div>)}</div></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-700" /><h3 className="font-black text-slate-900">متطلبات الجاهزية التسويقية</h3></div><div className="mt-3 space-y-2">{marketing.requiredAssets.map((item) => <div key={item} className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-xs leading-6 text-slate-700"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-500" />{item}</div>)}</div></article>
        </div>
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">هذه أداة إعداد وتخطيط داخلية. لا يتم نشر إعلانات أو إرسال رسائل أو صرف ميزانيات، ولا تُعرض نتائج أداء فعلية قبل ربط حسابات القنوات ومصادر القياس ومنح الصلاحيات اللازمة.</p>
      </section>}

      {activeSection === 'operations' && <section className="space-y-4">
        <div><h2 className="text-lg font-black text-slate-900">إدارة {category.name}</h2><p className="mt-1 text-xs leading-6 text-slate-500">ستُفعّل أدوات التشغيل بحسب طبيعة المجال ومصدر البيانات وصلاحيات المستخدم.</p></div>
        <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 text-slate-700"><strong>نطاق التشغيل:</strong> {moduleConfig.operationalFocus}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {moduleConfig.capabilities.map((item) => <article key={item.id} aria-label={`${item.title}: ${item.state === 'available' ? 'متاح' : 'قيد التجهيز'}`} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-2"><div className="flex items-center gap-2 text-emerald-700"><BriefcaseBusiness className="h-5 w-5" /><h3 className="font-black text-slate-900">{item.title}</h3></div><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${item.state === 'available' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{item.state === 'available' ? 'متاح' : 'قيد التجهيز'}</span></div>
            <p className="mt-2 text-xs leading-6 text-slate-500">{item.description}</p>
          </article>)}
        </div>
      </section>}
    </main>
  );
};
