import React, { useMemo, useState } from 'react';
import { ArrowRight, BarChart3, BriefcaseBusiness, CalendarDays, Megaphone, Package, Search, ShieldCheck, Store, Target, Users } from 'lucide-react';
import type { ActivityCategory, Business } from '../../types';
import type { PublicDirectoryListing } from '../../lib/directoryListings';
import { resolveCanonicalSpecialty } from '../../data/productionDefaults';
import { useApp } from '../../context/AppContext';
import { resolveActivityModuleConfig } from './activityModuleRegistry';

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
}

const sections: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'الرئيسية', icon: <Store className="h-4 w-4" /> },
  { id: 'specialties', label: 'التخصصات', icon: <Package className="h-4 w-4" /> },
  { id: 'marketing', label: 'التسويق والإعلان', icon: <Megaphone className="h-4 w-4" /> },
  { id: 'operations', label: 'إدارة المجال', icon: <BriefcaseBusiness className="h-4 w-4" /> },
];

const matchesSelectedSpecialtyFor = (selected: string, value: string, activityId: string) =>
  selected === 'all' || resolveCanonicalSpecialty(value, activityId) === resolveCanonicalSpecialty(selected, activityId);

const Metric: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <article className={`rounded-2xl border p-4 ${color}`}><p className="text-xs font-bold">{label}</p><p className="mt-2 text-2xl font-black">{value.toLocaleString('ar-EG')}</p></article>
);

export const ActivityModuleView: React.FC<Props> = ({ category, confirmedCount, unconfirmedCount, onBack, businesses, listings, onOpenListing, onOpenBusiness }) => {
  const [activeSection, setActiveSection] = useState<Section>('specialties');
  const specialtyFromUrl = new URLSearchParams(window.location.search).get('specialty') || 'all';
  const [selectedSpecialty, setSelectedSpecialty] = useState(specialtyFromUrl);
  const [searchQuery, setSearchQuery] = useState('');

  const { adminSettings } = useApp();
  const specialties = useMemo(() => category.specialties || [], [category.specialties]);
  const moduleConfig = useMemo(() => resolveActivityModuleConfig(category, adminSettings.activityModuleOverrides), [category, adminSettings.activityModuleOverrides]);
  const marketing = moduleConfig.marketing;
  const normalizeSearch = (value: string) => value.toLocaleLowerCase('ar-EG').normalize('NFKC')
    .replace(/[أإآ]/g, 'ا').replace(/[ىي]/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[\\u064B-\\u065F\\u0670]/g, '').replace(/\\s+/g, ' ').trim();
  const matchesSelectedSpecialty = (value: string) => selectedSpecialty === 'all' ||
    resolveCanonicalSpecialty(value, category.id) === resolveCanonicalSpecialty(selectedSpecialty, category.id);
  const matchesQuery = (values: Array<string | null | undefined>) => {
    const query = normalizeSearch(searchQuery);
    if (!query) return true;
    return normalizeSearch(values.filter(Boolean).join(' ')).includes(query);
  };
  const openSpecialty = (specialty: string) => {
    const url = new URL(window.location.href);
    if (specialty === 'all') url.searchParams.delete('specialty');
    else url.searchParams.set('specialty', specialty);
    window.history.pushState({ mantiqatixSpecialty: specialty }, '', url.pathname + url.search + url.hash);
    setSelectedSpecialty(specialty);
    setSearchQuery('');
  };
  const verifiedBusinesses = businesses.filter((business) => business.isVerified && matchesSelectedSpecialty(business.activitySpecialty || business.category || ''));
  const unverifiedBusinesses = businesses.filter((business) => !business.isVerified && matchesSelectedSpecialty(business.activitySpecialty || business.category || ''));
  const visibleListings = listings.filter((listing) => matchesSelectedSpecialty(listing.taxonomy_specialty || listing.specialty || ''));
  const matchingVerifiedBusinesses = verifiedBusinesses.filter((business) => matchesQuery([
    business.name, business.activitySpecialty, business.category, business.phone, business.ownerWhatsApp,
    business.village, business.markaz, business.governorate,
  ]));
  const matchingUnverifiedBusinesses = unverifiedBusinesses.filter((business) => matchesQuery([
    business.name, business.activitySpecialty, business.category, business.phone, business.ownerWhatsApp,
    business.village, business.markaz, business.governorate,
  ]));
  const matchingListings = visibleListings.filter((listing) => matchesQuery([
    listing.display_name, listing.taxonomy_specialty, listing.specialty, listing.phone, listing.secondary_phone,
    listing.village, listing.district, listing.governorate,
  ]));
  const countForSpecialty = (specialty: string) => businesses.filter((business) =>
    matchesSelectedSpecialtyFor(specialty, business.activitySpecialty || business.category || '', category.id)).length +
    listings.filter((listing) => matchesSelectedSpecialtyFor(specialty, listing.taxonomy_specialty || listing.specialty || '', category.id)).length;
  useEffect(() => {
    const syncSpecialtyRoute = () => {
      const requested = new URLSearchParams(window.location.search).get('specialty') || 'all';
      setSelectedSpecialty(requested === 'all' || specialties.includes(requested) ? requested : 'all');
      setSearchQuery('');
    };
    window.addEventListener('popstate', syncSpecialtyRoute);
    return () => window.removeEventListener('popstate', syncSpecialtyRoute);
  }, [specialties]);

  return (
    <main dir="rtl" className="mx-auto min-h-[70vh] max-w-7xl space-y-5 px-3 py-5 sm:px-6 sm:py-8">
      <header className="rounded-3xl bg-gradient-to-l from-slate-950 via-emerald-950 to-slate-900 p-5 text-white shadow-lg sm:p-8">
        <button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/15"><ArrowRight className="h-4 w-4" /> العودة إلى الأنشطة</button>
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

      {activeSection === 'specialties' && <section className="space-y-4">
        <div>
          <h2 className="text-lg font-black text-slate-900">{selectedSpecialty === 'all' ? `تخصصات ${category.name}` : selectedSpecialty}</h2>
          <p className="mt-1 text-xs text-slate-500">
            {selectedSpecialty === 'all'
              ? 'افتح مجلد التخصص لعرض الجهات التابعة له فقط.'
              : 'نتائج هذا التخصص فقط؛ البحث هنا لا يشمل أي تخصص آخر.'}
          </p>
        </div>

        {selectedSpecialty !== 'all' && <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="text-xs font-bold text-emerald-950">المجموعة / {category.name} / {selectedSpecialty}</div>
          <button type="button" onClick={() => openSpecialty('all')} className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-black text-emerald-900 hover:bg-emerald-100">العودة إلى التخصصات</button>
        </div>}

        {selectedSpecialty === 'all' && specialties.length > 0 && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {specialties.map((specialty) => {
            const total = countForSpecialty(specialty);
            return <button key={specialty} type="button" onClick={() => openSpecialty(specialty)}
              className="group flex min-h-32 flex-col items-start justify-between rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50/50">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Package className="h-6 w-6" /></span>
              <span className="mt-3 block w-full font-black text-slate-900">{specialty}</span>
              <span className="mt-1 text-xs font-bold text-slate-500">{total.toLocaleString('ar-EG')} جهة</span>
            </button>;
          })}
        </div>}

        {(selectedSpecialty !== 'all' || specialties.length === 0) && <div className="space-y-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={`ابحث داخل ${selectedSpecialty === 'all' ? category.name : selectedSpecialty} بالاسم أو الهاتف أو المنطقة`}
              aria-label={`البحث داخل ${selectedSpecialty === 'all' ? category.name : selectedSpecialty}`}
              className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white py-3 pr-12 pl-4 text-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
          </label>

          <div className="flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-emerald-50 px-3 py-2 text-emerald-800">موثق: {matchingVerifiedBusinesses.length.toLocaleString('ar-EG')}</span>
            <span className="rounded-full bg-red-50 px-3 py-2 text-red-700">غير موثق: {(matchingUnverifiedBusinesses.length + matchingListings.length).toLocaleString('ar-EG')}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[...matchingVerifiedBusinesses, ...matchingUnverifiedBusinesses].map((business) => <article key={business.id} className={`overflow-hidden rounded-2xl border bg-white shadow-sm ${business.isVerified ? 'border-emerald-200' : 'border-red-200'}`}>
              <div className="relative h-28 bg-slate-100">{business.coverUrl && <img src={business.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
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
            {matchingListings.map((listing) => <button key={listing.id} type="button" onClick={() => onOpenListing(listing.slug)} className="overflow-hidden rounded-2xl border border-red-200 bg-white text-right shadow-sm">
              <div className="relative flex h-28 items-center justify-center bg-slate-100"><Store className="h-10 w-10 text-slate-400" /><span className="absolute right-2 top-2 rounded-full bg-red-700 px-2 py-1 text-[10px] font-black text-white">غير موثق</span></div>
              <div className="p-3"><h3 className="font-black text-slate-900">{listing.display_name}</h3><p className="mt-1 text-xs text-slate-500">{listing.taxonomy_specialty || listing.specialty || category.name}</p>
                <p className="mt-1 text-xs text-slate-500">{[listing.village, listing.district, listing.governorate].filter(Boolean).join('، ')}</p><p className="mt-2 text-xs font-bold text-red-700">{listing.phone || listing.secondary_phone}</p></div>
            </button>)}
            {matchingVerifiedBusinesses.length + matchingUnverifiedBusinesses.length + matchingListings.length === 0 &&
              <p className="col-span-full rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">لا توجد نتائج مطابقة داخل هذا التخصص والنطاق الجغرافي المحدد.</p>}
          </div>
        </div>}
      </section>}

      {activeSection === 'marketing' && <section className="space-y-4">
        <header><h2 className="text-lg font-black text-slate-900">مركز تسويق {category.name}</h2><p className="mt-1 text-xs leading-6 text-slate-500">توجيهات تسويقية مبدئية مرتبطة بطبيعة المجال؛ أدوات إنشاء الحملات ونشرها وقياسها تُربط بعد استكمال عقود التسويق الخلفية والصلاحيات.</p></header>
        <div className="grid gap-3 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2"><h3 className="font-black text-slate-900">الهدف التسويقي للمجال</h3><p className="mt-2 text-sm leading-7 text-slate-600">{marketing.objective}</p><p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm leading-7 text-slate-700"><strong>التموضع المقترح:</strong> {marketing.positioning}</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><Target className="h-5 w-5 text-emerald-700" /><h3 className="font-black text-slate-900">الجمهور المستهدف</h3></div><p className="mt-3 text-sm leading-7 text-slate-600">{marketing.audience}</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-emerald-700" /><h3 className="font-black text-slate-900">أفكار الحملات</h3></div><ul className="mt-3 space-y-2">{marketing.campaignIdeas.map((item) => <li key={item} className="flex items-start gap-2 text-sm text-slate-600"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />{item}</li>)}</ul></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2"><div className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-emerald-700" /><h3 className="font-black text-slate-900">محاور المحتوى</h3></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{marketing.contentPillars.map((item) => <div key={item} className="rounded-xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700">{item}</div>)}</div></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2"><div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-700" /><h3 className="font-black text-slate-900">الأصول المطلوبة قبل إطلاق الحملات</h3></div><div className="mt-3 grid gap-2 sm:grid-cols-2">{marketing.requiredAssets.map((item) => <div key={item} className="rounded-xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700">{item}</div>)}</div></article>
        </div>
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">هذه إرشادات تخطيطية وليست حملة منشورة. لن يتم إنشاء حملات أو صرف ميزانيات أو نشر إعلانات من هذه الصفحة قبل ربط واجهات التسويق المعتمدة والتحقق من صلاحيات كل نشاط.</p>
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
