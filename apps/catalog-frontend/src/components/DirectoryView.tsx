import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Business, FunctionalGroup, ActivityCategory } from '../types';
import {
  Store,
  UtensilsCrossed,
  ShoppingBag,
  CalendarCheck2,
  HeartPulse,
  Wrench,
  Search,
  MapPin,
  ExternalLink,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Phone,
  MessageCircle,
} from 'lucide-react';
import { formatEgyptianLocation } from '../utils/rules';
import { resolveDefaultImage } from '../utils/defaultImages';

const whatsappDigits = (value: unknown): string => {
  let digits = String(value || '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0')) digits = '20' + digits.slice(1);
  else if (digits.startsWith('1') && digits.length === 10) digits = '20' + digits;
  return digits.length >= 10 && digits.length <= 15 ? digits : '';
};

const ICONS_MAP: Record<string, React.ReactNode> = {
  dining: <UtensilsCrossed className="w-5 h-5 text-amber-500" />,
  retail: <ShoppingBag className="w-5 h-5 text-blue-500" />,
  services: <CalendarCheck2 className="w-5 h-5 text-purple-500" />,
  healthcare: <HeartPulse className="w-5 h-5 text-emerald-500" />,
  crafts_maintenance: <Wrench className="w-5 h-5 text-orange-500" />,
};

interface CoverSlide {
  image: string;
  badge: string;
  title: string;
  subtitle: string;
  governorates: string[];
  businessId?: string;
  marketingCreative?: boolean;
}
const BUSINESS_PLACEHOLDER = `${import.meta.env.BASE_URL || '/'}business-placeholder.svg`;

export const DirectoryView: React.FC = () => {
  const {
    businesses,
    functionalGroups,
    categories,
    setSelectedBusinessId,
    setCurrentView,
    adminSettings,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all');
  const [selectedGovFilter, setSelectedGovFilter] = useState<string>('all');
  const catalogRequestPhone = whatsappDigits(
    adminSettings.adminWhatsApp || (window as any).MNTY_SUPPORT?.whatsapp || ''
  );

  // Published catalogues and platform-owned showcase activities receive directory cards.
  // This does not activate a module or expose products for an unpublished catalogue.
  const liveFeaturedBusinesses = businesses
    .filter((business) => Boolean(business.publicEnabled || business.isOfficialShowcase) && !business.isFrozen && Boolean(business.name.trim()))
    .slice(0, 30);
  const advertisingSlides: CoverSlide[] = [
    {
      image: `${import.meta.env.BASE_URL || '/'}legacy/mnty-cover-ad-1.svg`,
      badge: '', title: '', subtitle: '', governorates: ['all'], marketingCreative: true,
    },
    {
      image: `${import.meta.env.BASE_URL || '/'}legacy/mnty-cover-ad-2.svg`,
      badge: '', title: '', subtitle: '', governorates: ['all'], marketingCreative: true,
    },
    {
      image: `${import.meta.env.BASE_URL || '/'}legacy/mnty-cover-ad-3.svg`,
      badge: '', title: '', subtitle: '', governorates: ['all'], marketingCreative: true,
    },
  ];
  const coverSlides: CoverSlide[] = [
    ...advertisingSlides,
    ...liveFeaturedBusinesses.map((business) => ({
      image: business.coverUrl || resolveDefaultImage({ name: business.name, description: business.bio, category: business.category, kind: 'cover' }),
      badge: business.category || 'نشاط محلي',
      title: business.name,
      subtitle: business.bio || (business.catalogPublished ? 'تعرّف على بيانات النشاط وكتالوجه المنشور.' : 'تعرّف على هذا النشاط ضمن دليل MantiqatiX.'),
      governorates: [business.governorate || 'all'],
      businessId: business.id,
    })),
  ];

  // Governorate filtering is applied to real published business records.
  const [currentCoverIndex, setCurrentCoverIndex] = useState(0);

  // Filter slides based on selected governorate
  const activeCoverSlides = selectedGovFilter === 'all'
    ? coverSlides
    : (() => {
        const matched = coverSlides.filter(
          (slide) => slide.governorates.includes('all') || slide.governorates.includes(selectedGovFilter)
        );
        return matched.length > 0 ? matched : coverSlides;
      })();

  useEffect(() => {
    setCurrentCoverIndex(0);
  }, [selectedGovFilter]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentCoverIndex((prev) => (prev + 1) % activeCoverSlides.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [activeCoverSlides.length]);

  const filteredBusinesses = businesses.filter((biz) => {
    // Fail closed: the directory must never expose unpublished or frozen businesses,
    // even when the viewer is a platform administrator with a broader bootstrap scope.
    if ((!biz.publicEnabled && !biz.isOfficialShowcase) || biz.isFrozen) return false;
    const matchesSearch =
      biz.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      biz.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      biz.bio.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesGroup =
      selectedGroupFilter === 'all' || biz.functionalGroupId === selectedGroupFilter;

    const matchesGov =
      selectedGovFilter === 'all' || biz.governorate === selectedGovFilter;

    return matchesSearch && matchesGroup && matchesGov;
  }).sort((a, b) => {
    const targetGov = selectedGovFilter === 'all' ? 'الدقهلية' : selectedGovFilter;
    const aProx = a.governorate === targetGov ? 0 : 1;
    const bProx = b.governorate === targetGov ? 0 : 1;
    return aProx - bProx;
  });

  const uniqueGovernorships = Array.from(new Set(businesses.map((b) => b.governorate).filter(Boolean)));
  const currentSlide = activeCoverSlides[currentCoverIndex] || activeCoverSlides[0];

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
        {/* 2. Restored cover advertising carousel with a permanent side ad rail */}
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-5 items-stretch">
        <div className="relative w-full h-64 sm:h-80 md:h-96 rounded-3xl overflow-hidden shadow-2xl bg-slate-900 group">
          {activeCoverSlides.map((slide, idx) => (
            <div
              key={idx}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                idx === currentCoverIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            >
              <img
                src={slide.image || resolveDefaultImage({ name: slide.title, category: slide.badge, kind: 'cover' })}
                alt={slide.title}
                className="w-full h-full object-cover object-center"
                onError={(event) => {
                  const image = event.currentTarget;
                  const fallback = resolveDefaultImage({ name: slide.title, category: slide.badge, kind: 'cover' });
                  if (!image.src.endsWith(fallback.replace(/^.*\//, ''))) image.src = fallback;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-black/30" />
            </div>
          ))}

          {!currentSlide?.marketingCreative && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center text-center p-6 sm:p-10 text-white space-y-3 pointer-events-none">
              <span className="bg-amber-400 text-slate-950 text-xs font-black px-4 py-1.5 rounded-full shadow-lg">
                {currentSlide?.badge}
              </span>
              <h2 className="text-xl sm:text-3xl md:text-4xl font-black max-w-3xl leading-tight">
                {currentSlide?.title}
              </h2>
              <p className="text-xs sm:text-sm text-slate-200 max-w-2xl leading-relaxed">
                {currentSlide?.subtitle}
              </p>
              {currentSlide?.businessId && (
                <span className="pointer-events-auto mt-2 bg-white/15 border border-white/30 text-white font-bold text-xs py-2.5 px-6 rounded-xl">
                  {businesses.find((business) => business.id === currentSlide.businessId)?.catalogPublished ? 'كتالوج منشور للزوار' : 'نشاط ضمن دليل المنصة'}
                </span>
              )}
              {!currentSlide?.businessId && catalogRequestPhone && (
                <a
                  href={`https://wa.me/${catalogRequestPhone}?text=${encodeURIComponent('مرحبًا، أريد طلب كتالوج لنشاطي على MantiqatiX.')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pointer-events-auto mt-2 bg-red-600 hover:bg-red-700 text-white font-black text-xs py-2.5 px-6 rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer"
                >
                  <span>اطلب كتالوج لنشاطك</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}
          {currentSlide?.marketingCreative && catalogRequestPhone && (
            <a
              href={`https://wa.me/${catalogRequestPhone}?text=${encodeURIComponent('مرحبًا، أريد طلب كتالوج لنشاطي على MantiqatiX.')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-4 left-4 z-30 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-black px-4 py-2.5 shadow-xl"
            >
              اطلب كتالوج لنشاطك
            </a>
          )}

          {/* Slider Dots */}
          <div className="absolute bottom-3 right-1/2 translate-x-1/2 z-30 flex items-center gap-1.5 bg-black/50 backdrop-blur-xs px-3 py-1.5 rounded-full border border-white/20 max-w-[90%] overflow-x-auto no-scrollbar">
            {activeCoverSlides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentCoverIndex(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === currentCoverIndex ? 'w-5 bg-amber-400' : 'w-1.5 bg-white/50 hover:bg-white'
                }`}
                aria-label={`انتقل إلى النشاط ${idx + 1}`}
              />
            ))}
          </div>
        </div>

        <aside className="relative min-h-[245px] sm:min-h-[290px] lg:min-h-0 rounded-3xl overflow-hidden border border-red-100 bg-slate-950 shadow-xl isolate">
          <img
            src={`${import.meta.env.BASE_URL || '/'}legacy/mnty-ad-space-booking-banner.svg`}
            alt="مساحة إعلانية على MantiqatiX"
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
            onError={(event) => { event.currentTarget.style.display = 'none'; }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/65 to-red-950/20" />
          <div className="relative z-10 flex h-full min-h-[245px] sm:min-h-[290px] lg:min-h-[384px] flex-col justify-end p-5 sm:p-7 text-white">
            <span className="mb-3 inline-flex w-fit items-center rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-black tracking-wide">مساحة إعلانية</span>
            <h2 className="text-2xl sm:text-3xl font-black leading-tight">أعلن معنا هنا</h2>
            <p className="mt-2 max-w-sm text-xs sm:text-sm leading-relaxed text-white/85">اعرض نشاطك أمام زوار MantiqatiX واحصل على مساحة مميزة في واجهة الدليل.</p>
            {catalogRequestPhone ? (
              <a
                href={`https://wa.me/${catalogRequestPhone}?text=${encodeURIComponent('مرحبًا، أريد حجز مساحة إعلانية على MantiqatiX.')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 text-xs sm:text-sm font-black text-white shadow-lg transition-colors hover:bg-red-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <MessageCircle className="h-4 w-4" />
                أعلن معنا هنا
              </a>
            ) : (
              <div className="mt-5 rounded-xl border border-white/20 bg-white/10 px-3 py-3 text-xs font-bold text-white/80">تواصل مع إدارة المنصة لحجز إعلانك</div>
            )}
            <span className="mt-3 text-[10px] text-white/60">الإعلانات المدفوعة تُعرض بوضوح داخل المنصة</span>
          </div>
        </aside>
        </div>

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

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <button
              onClick={() => setSelectedGroupFilter('all')}
              className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                selectedGroupFilter === 'all'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                  : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <Store className={`w-5 h-5 ${selectedGroupFilter === 'all' ? 'text-emerald-400' : 'text-slate-600'}`} />
                <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${selectedGroupFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                  {businesses.length}
                </span>
              </div>
              <div>
                <div className="font-extrabold text-xs sm:text-sm">كافة الأنشطة</div>
                <div className={`text-[10px] mt-0.5 ${selectedGroupFilter === 'all' ? 'text-slate-300' : 'text-slate-500'}`}>
                  جميع القطاعات
                </div>
              </div>
            </button>

            {functionalGroups.map((group) => {
              const count = businesses.filter((b) => b.functionalGroupId === group.id).length;
              const isSelected = selectedGroupFilter === group.id;

              return (
                <button
                  key={group.id}
                  onClick={() => setSelectedGroupFilter(group.id)}
                  className={`p-4 rounded-2xl border text-right transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                    isSelected
                      ? 'bg-emerald-700 text-white border-emerald-700 shadow-md'
                      : 'bg-white border-slate-200 text-slate-800 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    {ICONS_MAP[group.id]}
                    <span className={`text-xs font-black px-2 py-0.5 rounded-lg ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                      {count}
                    </span>
                  </div>
                  <div>
                    <div className="font-extrabold text-xs sm:text-sm truncate">{group.shortName}</div>
                    <div className={`text-[10px] mt-0.5 truncate ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                      {group.name}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
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
          <div className="flex items-center justify-between">
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
                {businesses.length === 0 ? 'لا توجد أنشطة متاحة للعرض حاليا' : 'لا توجد أنشطة مطابقة للبحث'}
              </h3>
              <p className="text-xs text-slate-500 max-w-lg mx-auto">
                {businesses.length === 0
                  ? 'ستظهر هنا الأنشطة النشطة المتاحة للزوار. تواصل مع إدارة المنصة إذا كنت تبحث عن نشاط غير موجود.'
                  : 'جرب تغيير كلمات البحث أو تصنيف القطاع أو المحافظة.'}
              </p>
              {businesses.length === 0 && catalogRequestPhone && (
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBusinesses.map((biz) => {
                const group = functionalGroups.find((g) => g.id === biz.functionalGroupId);

                return (
                  <div
                    key={biz.id}
                    className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-xl transition-all group"
                  >
                    <div>
                      {/* Cover Photo & Badges */}
                      <div className="relative h-36 bg-slate-800 overflow-hidden">
                        <img
                          src={biz.coverUrl || BUSINESS_PLACEHOLDER}
                          alt={biz.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            const image = e.currentTarget;
                            if (!image.src.endsWith('/business-placeholder.svg')) image.src = BUSINESS_PLACEHOLDER;
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                        {/* Top Badges */}
                        <div className="absolute top-3 right-3 flex items-center gap-1.5">
                          {biz.isVerified && (
                            <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>موثّق</span>
                            </span>
                          )}
                          {group && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${group.badgeColor}`}>
                              {group.shortName}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Logo & Basic Info */}
                      <div className="p-5 relative">
                        <div className="absolute -top-10 right-5 w-16 h-16 rounded-2xl bg-white p-1 shadow-md ring-2 ring-white overflow-hidden">
                          <img
                            src={biz.logoUrl || BUSINESS_PLACEHOLDER}
                            alt={biz.name}
                            className="w-full h-full object-cover rounded-xl bg-slate-100"
                            onError={(e) => {
                              const image = e.currentTarget;
                              const fallback = resolveDefaultImage({ name: biz.name, description: biz.bio, category: biz.category, kind: 'cover' });
                             if (!image.src.endsWith(fallback.replace(/^.*\//, ''))) image.src = fallback;
                            }}
                          />
                        </div>

                        <div className="pt-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="font-black text-base text-slate-900 group-hover:text-emerald-700 transition-colors">
                              {biz.name}
                            </h3>
                            <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                              {biz.category}
                            </span>
                          </div>

                          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                            {biz.bio}
                          </p>

                          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-medium pt-1">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                            <span>{formatEgyptianLocation(biz.governorate, biz.markaz, biz.village)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Footer */}
                    <div className="p-5 pt-0 flex items-center justify-between gap-3 border-t border-slate-100 mt-2">
                      {whatsappDigits(biz.ownerWhatsApp) ? (
                        <a
                          href={`https://wa.me/${whatsappDigits(biz.ownerWhatsApp)}?text=${encodeURIComponent(
                            `مرحباً، أود الاستفسار عن نشاطكم: ${biz.name}`
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <MessageCircle className="w-4 h-4 text-emerald-600" />
                          <span>مراسلة واتساب</span>
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
                          className="flex-1 bg-slate-900 hover:bg-emerald-600 text-white font-black text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                        >
                          <span>عرض الكتالوج</span>
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
      </div>
    </div>
  );
};
