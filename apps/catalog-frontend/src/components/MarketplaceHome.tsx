import React, { useEffect, useMemo } from 'react';
import {
  ArrowLeft, BadgeCheck, BadgePercent, Gift, HeartPulse, MapPin, Megaphone,
  Search, ShieldCheck, Sparkles, Store, Utensils, Wallet, ChevronLeft,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { Business, Product } from '../types';
import { resolveDefaultImage } from '../utils/defaultImages';
import { supabase } from '../lib/production';

type TargetedAdvertisement = {
  advertisement_id: string;
  title: string;
  creative_url: string;
  target_url?: string | null;
  ad_space_id?: string;
  match_level?: string;
};

const isSafeHttpUrl = (value?: string | null): string => {
  if (!value) return '';
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : '';
  } catch {
    return '';
  }
};

const currency = (value: number): string =>
  Number(value || 0).toLocaleString('ar-EG', { maximumFractionDigits: 2 }) + ' ج.م';

const BusinessCard: React.FC<{ business: Business; onOpen: (business: Business) => void }> = ({ business, onOpen }) => {
  const logo = business.logoUrl || resolveDefaultImage({
    name: business.name, description: business.bio, category: business.category, kind: 'activity',
  });
  const cover = business.coverUrl || logo;
  return (
    <article className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
      <button type="button" onClick={() => onOpen(business)} className="block w-full text-right" aria-label={'فتح كتالوج ' + business.name}>
        <div className="relative h-28 overflow-hidden bg-slate-100 sm:h-32">
          <img src={cover} alt="" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2.5 py-1 text-[10px] font-black text-white shadow">
            <ShieldCheck className="h-3 w-3" /> موثّق
          </span>
        </div>
        <div className="relative px-3 pb-3 pt-9">
          <img src={logo} alt="" className="absolute -top-7 right-3 h-14 w-14 rounded-2xl border-2 border-white bg-white object-cover shadow" loading="lazy" />
          <div className="min-h-12">
            <h3 className="line-clamp-1 text-sm font-black text-slate-900">{business.name}</h3>
            <p className="mt-1 line-clamp-1 text-xs text-slate-500">{business.category}</p>
          </div>
          <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-slate-500">
            <span className="flex min-w-0 items-center gap-1 truncate"><MapPin className="h-3.5 w-3.5 shrink-0" />{[business.village, business.markaz, business.governorate].filter(Boolean).join('، ') || 'مصر'}</span>
            <span className="shrink-0 font-bold text-emerald-700">عرض النشاط <ChevronLeft className="inline h-3.5 w-3.5" /></span>
          </div>
        </div>
      </button>
    </article>
  );
};

const ProductCard: React.FC<{
  product: Product;
  businessName: string;
  onOpen: () => void;
  onAdd: () => void;
}> = ({ product, businessName, onOpen, onAdd }) => {
  const image = product.imageUrl || resolveDefaultImage({
    name: product.name, description: product.description, category: product.category,
    kind: product.type === 'service' ? 'service' : 'product',
  });
  const hasDiscount = Number(product.comparePrice || 0) > Number(product.price || 0);
  const discount = hasDiscount ? Math.round((1 - product.price / Number(product.comparePrice)) * 100) : 0;
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button type="button" onClick={onOpen} className="block w-full text-right">
        <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
          <img src={image} alt={product.name} className="h-full w-full object-cover" loading="lazy" />
          {hasDiscount && <span className="absolute right-2 top-2 rounded-full bg-rose-600 px-2.5 py-1 text-[10px] font-black text-white">خصم {discount}%</span>}
        </div>
        <div className="p-3">
          <h3 className="line-clamp-1 text-sm font-black text-slate-900">{product.name}</h3>
          <p className="mt-1 line-clamp-1 text-[11px] text-slate-500">{businessName}</p>
          <div className="mt-2 flex items-center gap-2">
            <strong className="text-sm text-emerald-800">{product.requiresQuote ? 'السعر عند الطلب' : currency(product.price)}</strong>
            {hasDiscount && <span className="text-xs text-slate-400 line-through">{currency(Number(product.comparePrice))}</span>}
          </div>
        </div>
      </button>
      <button type="button" onClick={product.requiresQuote ? onOpen : onAdd} className="mx-3 mb-3 inline-flex min-h-10 w-[calc(100%-1.5rem)] items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-bold text-white transition hover:bg-emerald-800">
        {product.requiresQuote ? 'اطلب عرض سعر' : 'أضف إلى السلة'}
      </button>
    </article>
  );
};

const SectionHeading: React.FC<{ title: string; subtitle?: string; icon: React.ReactNode; action?: () => void; actionLabel?: string }> =
  ({ title, subtitle, icon, action, actionLabel = 'عرض الكل' }) => (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800">{icon}</span>
        <div className="min-w-0">
          <h2 className="text-lg font-black text-slate-950 sm:text-xl">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs leading-5 text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action && <button type="button" onClick={action} className="shrink-0 text-xs font-black text-emerald-800 hover:text-emerald-950">{actionLabel} <ArrowLeft className="inline h-3.5 w-3.5" /></button>}
    </div>
  );

export const MarketplaceHome: React.FC = () => {
  const {
    directoryBusinesses, directoryLoading, products, businesses,
    authSession, adminSettings, setCurrentView, setSelectedBusinessId,
    setIsLoginModalOpen, addToCart,
  } = useApp();
  const [advertisements, setAdvertisements] = useState<TargetedAdvertisement[]>([]);
  const [adsLoading, setAdsLoading] = useState(true);

  const openSearch = () => setCurrentView('directory');
  const openBusiness = (business: Business) => {
    setSelectedBusinessId(business.id);
    setCurrentView('public_storefront');
  };
  const businessById = useMemo(() => new Map<string, Business>(directoryBusinesses.map((business) => [business.id, business] as const)), [directoryBusinesses]);
  const eligibleBusinesses = useMemo(() => directoryBusinesses.filter((business) =>
    Boolean(business.publicEnabled || business.isOfficialShowcase) &&
    business.operationalStatus === 'ACTIVE' && !business.isFrozen && Boolean(business.name.trim())
  ), [directoryBusinesses]);
  const verifiedBusinesses = useMemo(() => eligibleBusinesses.filter((business) => business.isVerified), [eligibleBusinesses]);
  const medicalBusinesses = useMemo(() => verifiedBusinesses.filter((business) =>
    business.functionalGroupId === 'medical_health' || /طب|طبي|صحي|صيدل|مستشفى|عياد|معمل|مركز طبي/.test(business.category)
  ).slice(0, 8), [verifiedBusinesses]);
  const foodBusinesses = useMemo(() => verifiedBusinesses.filter((business) =>
    business.functionalGroupId === 'food_grocery' || /مطعم|مأكولات|مشروبات|كافيه|قهو|حلوان|مخبز|بقالة|سوبر ماركت/.test(business.category)
  ).slice(0, 8), [verifiedBusinesses]);
  const publishedProducts = useMemo(() => products.filter((product) =>
    product.isAvailable && businessById.has(product.businessId)
  ), [products, businessById]);
  const productOffers = useMemo(() => publishedProducts.filter((product) =>
    product.type === 'product' && Number(product.comparePrice || 0) > Number(product.price || 0)
  ).slice(0, 8), [publishedProducts]);
  const serviceOffers = useMemo(() => publishedProducts.filter((product) =>
    product.type === 'service' && Number(product.comparePrice || 0) > Number(product.price || 0)
  ).slice(0, 8), [publishedProducts]);
  const smartPicks = useMemo(() => verifiedBusinesses.slice(0, 6), [verifiedBusinesses]);
  const personalBusiness = businesses.find((business) => business.id === authSession.businessId);

  useEffect(() => {
    let active = true;
    const loadAdvertisements = async () => {
      setAdsLoading(true);
      try {
        const spaces = ['HOME_HERO', 'HOME_SPONSORED'];
        const responses = await Promise.all(spaces.map((space) => supabase.rpc('get_mnty_targeted_advertisements', {
          p_country_code: 'EG',
          p_governorate_code: null,
          p_center_code: null,
          p_lat: null,
          p_lon: null,
          p_ad_space_id: space,
          p_limit: 4,
        })));
        const rows = responses.flatMap((response) => Array.isArray(response.data) ? response.data : []) as TargetedAdvertisement[];
        const unique = Array.from(new Map(rows.filter((row) => row && row.advertisement_id && row.creative_url)
          .map((row) => [row.advertisement_id, row])).values());
        if (active) setAdvertisements(unique);
      } catch {
        if (active) setAdvertisements([]);
      } finally {
        if (active) setAdsLoading(false);
      }
    };
    void loadAdvertisements();
    return () => { active = false; };
  }, []);

  const adminPhone = String(adminSettings.adminWhatsApp || '').replace(/\D/g, '');
  const joinUrl = adminPhone
    ? 'https://wa.me/' + (adminPhone.startsWith('0') ? '20' + adminPhone.slice(1) : adminPhone) +
      '?text=' + encodeURIComponent('مرحبًا، أريد تسجيل نشاطي والانضمام إلى منصة MantiqatiX.')
    : '';

  return (
    <div data-testid="marketplace-home" dir="rtl" className="min-h-screen bg-[#f5f7f6] pb-16 text-slate-800">
      <section className="relative isolate overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'radial-gradient(circle at 15% 20%, #10b981 0, transparent 32%), radial-gradient(circle at 90% 80%, #0f766e 0, transparent 30%)' }} />
        <div className="relative mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.15fr_.85fr] lg:items-center lg:px-8">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold text-emerald-200">
              <Sparkles className="h-4 w-4" /> اكتشف منطقتك… واختصر طريقك
            </div>
            <h1 className="max-w-3xl text-3xl font-black leading-tight sm:text-5xl">
              كل الأنشطة والخدمات والعروض <span className="text-emerald-300">في مكان واحد</span>
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
              اكتشف المشروعات الموثقة، قارن المنتجات والخدمات، وتعرّف على اختيارات جديدة في محافظات مصر.
            </p>
            <div className="flex flex-wrap gap-3">
              <button type="button" data-testid="home-search-button" onClick={openSearch} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-300">
                <Search className="h-4 w-4" /> ابحث عن نشاط أو خدمة
              </button>
              {joinUrl && <a href={joinUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10">
                <Store className="h-4 w-4" /> أضف نشاطك للمنصة
              </a>}
            </div>
            <div className="flex flex-wrap gap-2 pt-1 text-[11px] font-bold text-slate-300">
              <span className="rounded-full bg-white/10 px-3 py-1.5">أنشطة موثقة</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">عروض حقيقية</span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">بحث على مستوى مصر</span>
            </div>
          </div>
          <div className="relative min-h-64 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-900 via-slate-900 to-slate-800 p-5 shadow-2xl sm:min-h-80">
            {verifiedBusinesses[0]?.coverUrl && <img src={verifiedBusinesses[0].coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />}
            <div className="absolute -left-10 -top-10 h-44 w-44 rounded-full border border-emerald-300/20" />
            <div className="absolute -bottom-20 -right-8 h-64 w-64 rounded-full border border-emerald-300/20" />
            <div className="relative flex h-full min-h-64 flex-col justify-between sm:min-h-72">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-emerald-200">دليل موثوق ومتجدد</p>
                  <p className="mt-2 text-2xl font-black">{verifiedBusinesses.length.toLocaleString('ar-EG')}</p>
                  <p className="text-xs text-slate-300">نشاط موثق ظاهر حاليًا</p>
                </div>
                <span className="rounded-2xl border border-white/15 bg-white/10 p-3"><BadgeCheck className="h-7 w-7 text-emerald-300" /></span>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/65 p-4 backdrop-blur">
                <p className="text-sm font-black">ابحث بذكاء… واكتشف الأقرب والأنسب</p>
                <p className="mt-1 text-xs leading-5 text-slate-300">يظل البحث شاملًا لمصر، مع إبراز الأنشطة الموثقة وترتيب الأقرب عند السماح بالموقع.</p>
                <button type="button" onClick={openSearch} className="mt-3 inline-flex items-center gap-1 text-xs font-black text-emerald-300">افتح محرك البحث <ArrowLeft className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl space-y-10 px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <button type="button" onClick={openSearch} className="flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-sm transition hover:border-emerald-300 hover:shadow">
            <span className="rounded-xl bg-emerald-50 p-2.5 text-emerald-800"><Search className="h-5 w-5" /></span><span className="text-sm font-black">ابحث عن نشاط</span>
          </button>
          <button type="button" onClick={openSearch} className="flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-sm transition hover:border-emerald-300 hover:shadow">
            <span className="rounded-xl bg-amber-50 p-2.5 text-amber-800"><Utensils className="h-5 w-5" /></span><span className="text-sm font-black">مطاعم ومشروبات</span>
          </button>
          <button type="button" onClick={openSearch} className="flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-sm transition hover:border-emerald-300 hover:shadow">
            <span className="rounded-xl bg-rose-50 p-2.5 text-rose-800"><HeartPulse className="h-5 w-5" /></span><span className="text-sm font-black">خدمات طبية</span>
          </button>
          <button type="button" onClick={openSearch} className="flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-sm transition hover:border-emerald-300 hover:shadow">
            <span className="rounded-xl bg-violet-50 p-2.5 text-violet-800"><BadgePercent className="h-5 w-5" /></span><span className="text-sm font-black">العروض والخصومات</span>
          </button>
        </div>

        <section aria-label="الأنشطة الموثقة">
          <SectionHeading title="أنشطة موثقة تستحق الاكتشاف" subtitle="أنشطة منشورة ونشطة، مع أولوية واضحة للأنشطة المعتمدة." icon={<ShieldCheck className="h-5 w-5" />} action={openSearch} />
          {directoryLoading ? <p className="rounded-2xl bg-white p-6 text-center text-sm text-slate-500">جارٍ تحميل الأنشطة الموثقة…</p> :
            verifiedBusinesses.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{verifiedBusinesses.slice(0, 8).map((business) => <BusinessCard key={business.id} business={business} onOpen={openBusiness} />)}</div> :
              <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500">لا توجد أنشطة موثقة متاحة للعرض حاليًا.</p>}
        </section>

        <section aria-label="إعلانات المنصة">
          <SectionHeading title="إعلانات وشراكات المنصة" subtitle="تظهر الإعلانات المعتمدة والنشطة فقط." icon={<Megaphone className="h-5 w-5" />} />
          {advertisements.length ? <div className="grid gap-4 md:grid-cols-2">
            {advertisements.slice(0, 4).map((ad) => {
              const href = isSafeHttpUrl(ad.target_url);
              const card = <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <img src={ad.creative_url} alt={ad.title || 'إعلان'} className="max-h-64 min-h-40 w-full object-cover" loading="lazy" />
                <div className="flex items-center justify-between gap-3 p-3"><p className="line-clamp-1 text-sm font-black">{ad.title}</p><span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">إعلان معتمد</span></div>
              </div>;
              return href ? <a key={ad.advertisement_id} href={href} target="_blank" rel="noopener noreferrer">{card}</a> : <div key={ad.advertisement_id}>{card}</div>;
            })}
          </div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-6 text-center">
            <Megaphone className="mx-auto h-7 w-7 text-slate-400" />
            <p className="mt-2 text-sm font-bold text-slate-700">{adsLoading ? 'جارٍ تحميل الإعلانات المعتمدة…' : 'لا توجد إعلانات معتمدة متاحة الآن'}</p>
            <p className="mt-1 text-xs text-slate-500">تظهر هنا الحملات بعد اعتمادها وتحديد موعد عرضها من إدارة المنصة.</p>
          </div>}
        </section>

        <section aria-label="مقترحات الطعام والمشروبات">
          <SectionHeading title="أماكن للأكل والقهوة والمشروبات" subtitle="اقتراحات من الأنشطة الموثقة في قطاع الأغذية والضيافة." icon={<Utensils className="h-5 w-5" />} action={openSearch} />
          {foodBusinesses.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{foodBusinesses.map((business) => <BusinessCard key={business.id} business={business} onOpen={openBusiness} />)}</div> : <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">ستظهر هنا المطاعم والمقاهي ومقدمو الأغذية الموثقون عند توافرهم.</p>}
        </section>

        <section aria-label="مقترحات طبية">
          <SectionHeading title="مقترحات طبية وخدمات صحية" subtitle="اكتشف مقدمي الخدمات الطبية والأنشطة الصحية الموثقة." icon={<HeartPulse className="h-5 w-5" />} action={openSearch} />
          {medicalBusinesses.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{medicalBusinesses.map((business) => <BusinessCard key={business.id} business={business} onOpen={openBusiness} />)}</div> : <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">ستظهر هنا الجهات الطبية والصحية الموثقة عند توافرها.</p>}
        </section>

        <section aria-label="عروض المنتجات">
          <SectionHeading title="عروض المنتجات" subtitle="نعرض الخصومات المسجلة فعليًا في الكتالوج فقط." icon={<BadgePercent className="h-5 w-5" />} action={openSearch} />
          {productOffers.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{productOffers.map((product) => <ProductCard key={product.id} product={product} businessName={businessById.get(product.businessId)?.name || ''} onOpen={() => openBusiness(businessById.get(product.businessId)!)} onAdd={() => addToCart(product)} />)}</div> : <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">لا توجد خصومات منتجات منشورة حاليًا. أي عرض سيظهر هنا عند تسجيل سعره الأصلي وسعره المخفض في الكتالوج.</p>}
        </section>

        <section aria-label="عروض الخدمات">
          <SectionHeading title="عروض الخدمات" subtitle="خصومات الخدمات المعروضة من الأنشطة المنشورة." icon={<Store className="h-5 w-5" />} action={openSearch} />
          {serviceOffers.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{serviceOffers.map((product) => <ProductCard key={product.id} product={product} businessName={businessById.get(product.businessId)?.name || ''} onOpen={() => openBusiness(businessById.get(product.businessId)!)} onAdd={() => addToCart(product)} />)}</div> : <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">لا توجد خصومات خدمات منشورة حاليًا. ستظهر العروض الفعلية هنا عند إضافتها من أصحاب الأنشطة.</p>}
        </section>

        <section aria-label="اقتراحات ذكية">
          <SectionHeading title="اقتراحات ذكية لاكتشاف أنشطة جديدة" subtitle="اختيارات أولية تعتمد على التصنيفات والأنشطة الموثقة المتاحة، ويمكن تطويرها لاحقًا إلى توصيات شخصية بالذكاء الاصطناعي." icon={<Sparkles className="h-5 w-5" />} action={openSearch} />
          {smartPicks.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{smartPicks.map((business) => <BusinessCard key={business.id} business={business} onOpen={openBusiness} />)}</div> : <p className="rounded-2xl bg-white p-5 text-sm text-slate-500">تظهر الاقتراحات عند توفر أنشطة موثقة منشورة.</p>}
        </section>

        <section aria-label="برنامج المكافآت والاشتراكات" className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-950 to-slate-900 p-6 text-white shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-bold text-emerald-200">MantiqatiX Rewards</p><h2 className="mt-1 text-xl font-black">نقاط وهدايا المنصة</h2></div>
              <span className="rounded-2xl bg-white/10 p-3 text-emerald-200"><Gift className="h-7 w-7" /></span>
            </div>
            <p className="mt-3 text-sm leading-6 text-slate-200">برنامج النقاط المجانية قيد التجهيز. ستكون النقاط غير قابلة للسحب أو التحويل، ومخصصة لشراء خدمات المنصة والاشتراكات المؤهلة فقط.</p>
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs leading-5 text-slate-300">لن يظهر رصيد أو كوبون قبل ربطه بسجل مكافآت موثوق حتى لا يتم عرض قيمة غير حقيقية.</div>
            {!authSession.isAuthenticated && <button type="button" onClick={() => setIsLoginModalOpen(true)} className="mt-4 rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-black text-slate-950">سجّل الدخول</button>}
          </div>
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-bold text-emerald-700">لأصحاب المشروعات</p><h2 className="mt-1 text-xl font-black text-slate-950">اشتراكك ومزايا نشاطك</h2></div>
              <span className="rounded-2xl bg-amber-50 p-3 text-amber-700"><Wallet className="h-7 w-7" /></span>
            </div>
            {personalBusiness ? <>
              <p className="mt-3 text-sm text-slate-600">النشاط المرتبط بحسابك: <strong className="text-slate-900">{personalBusiness.name}</strong></p>
              <p className="mt-2 text-sm text-slate-600">حالة الاشتراك: <strong className="text-emerald-800">{personalBusiness.paymentStatus === 'paid' ? 'مدفوع' : personalBusiness.paymentStatus === 'free' ? 'مجاني معتمد' : personalBusiness.paymentStatus === 'overdue' ? 'متأخر' : personalBusiness.paymentStatus === 'frozen' ? 'مجمّد' : 'قيد المراجعة / السداد'}</strong></p>
            </> : <p className="mt-3 text-sm leading-6 text-slate-600">تابع حالة اشتراك نشاطك ومزاياه من حساب صاحب النشاط بعد تسجيل الدخول وربط العضوية.</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {personalBusiness && <button type="button" onClick={() => setCurrentView('merchant_admin')} className="rounded-xl bg-slate-900 px-4 py-2.5 text-xs font-black text-white">لوحة نشاطي</button>}
              {joinUrl && <a href={joinUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-black text-emerald-900">اطلب الانضمام والاشتراك</a>}
              <span className="inline-flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2.5 text-[11px] font-bold text-slate-600"><Gift className="h-3.5 w-3.5" /> كوبونات الاشتراك ستظهر بعد تفعيل نظام المكافآت</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
