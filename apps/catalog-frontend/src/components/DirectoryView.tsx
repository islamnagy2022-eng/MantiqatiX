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
  Megaphone,
} from 'lucide-react';
import { formatEgyptianLocation } from '../utils/rules';

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
  governorates: string[]; // ['all'] أو تحديد محافظة أو عدة محافظات
}

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
  const catalogRequestPhone = String(
    adminSettings.adminWhatsApp || (window as any).MNTY_SUPPORT?.whatsapp || '201010171770'
  ).replace(/\D/g, '');

  // 20 Professional Cover Slides with governorate targeting
  const coverSlides: CoverSlide[] = [
    {
      image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1600&auto=format&fit=crop&q=80',
      badge: 'إعلان عام #1 • احجز مساحتك الإعلانية',
      title: 'احجز مساحتك الإعلانية الأولى في منطقتك وضاعف أرباحك',
      subtitle: 'انضم لآلاف المشاريع الناجحة واجعل نشاطك الخيار الأول لعملائك بالقرى والمراكز.',
      governorates: ['all'],
    },
    {
      image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1600&auto=format&fit=crop&q=80',
      badge: 'إعلان عام #2 • سر نجاح مشروعك الرقمي',
      title: 'كتالوج رقمي فوري يضم 150 منتج وخدمة',
      subtitle: 'اعرض منتجاتك بأسعارك بالجنيه المصري واستقبل الطلبات مباشرة على الواتساب بدون عمولة.',
      governorates: ['all'],
    },
    {
      image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1600&auto=format&fit=crop&q=80',
      badge: 'إعلان عام #3 • احجز مساحتك الآن',
      title: 'سداد إلكتروني آمن معتمد من البنك المركزي عبر Paymob',
      subtitle: 'وفر لعميلك خيارات دفع متعددة (محافظ إلكترونية، بطاقات بنكية، ومنافذ الدفع).',
      governorates: ['all'],
    },
    {
      image: 'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=1600&auto=format&fit=crop&q=80',
      badge: 'إعلان عام #4 • دعاية ودعم احترافي',
      title: 'QR كود دائم ومستقر لمتجرك أو مطعمك',
      subtitle: 'رمز استجابة سريع لا يتغير أبداً ومقاوم لتغير نطاق الموقع لخدمة فورية لزبائنك.',
      governorates: ['all'],
    },
    {
      image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1600&auto=format&fit=crop&q=80',
      badge: 'إعلان إقليمي #5 • محافظة الدقهلية',
      title: 'باقات الانتشار والتواجد الرقمي في الدقهلية والمنصورة',
      subtitle: 'تصميم هويات بصرية، إدارة حملات ممولة، وفيديوهات ذكاء اصطناعي لرفع مبيعاتك.',
      governorates: ['الدقهلية'],
    },
    {
      image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1600&auto=format&fit=crop&q=80',
      badge: 'إعلان إقليمي #6 • محافظة الدقهلية',
      title: 'اجعل نشاطك يظهر في صدارة نتائج البحث المحلي بالمنصورة',
      subtitle: 'ترتيب تلقائي للأنشطة الأقرب لموقع الجغرافيا والخدمة للعميل.',
      governorates: ['الدقهلية'],
    },
    {
      image: 'https://images.unsplash.com/photo-1509785307050-d4066910ec1e?w=1600&auto=format&fit=crop&q=80',
      badge: 'إعلان إقليمي #7 • محافظة الدقهلية',
      title: 'دليل المطاعم والمتاجر الكبرى في الدقهلية',
      subtitle: 'نظام تشغيل مخصص للمطاعم، المتاجر، والصيدليات لتلقي طلبات الدليفري.',
      governorates: ['الدقهلية'],
    },
    {
      image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1600&auto=format&fit=crop&q=80',
      badge: 'إعلان إقليمي #8 • محافظة الدقهلية',
      title: 'احجز مساحتك الإعلانية المميزة لمدن ومراكز الدقهلية',
      subtitle: 'تواصل مع الإدارة الآن لتثبيت إعلانك في واجهة المنصة بالدقهلية.',
      governorates: ['الدقهلية'],
    },
    {
      image: 'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?w=1600&auto=format&fit=crop&q=80',
      badge: 'إعلان العاصمة #9 • القاهرة والجيزة',
      title: 'تغطية إعلانية كبرى لمحافظتي القاهرة والجيزة',
      subtitle: 'تكامل تام مع خرائط جوجل ومواقع النشاط التجاري للوصول لأكبر قاعدة عملاء.',
      governorates: ['القاهرة', 'الجيزة'],
    },
    {
      image: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=1600&auto=format&fit=crop&q=80',
      badge: 'إعلان العاصمة #10 • القاهرة والجيزة',
      title: 'احفظ صفحة نشاطك كتطبيق موبايل (PWA) بالقاهرة الكبرى',
      subtitle: 'يمكن عملاءك من تثبيت متجرك على هواتفهم وتلقي إشعارات عروضك الجديدة.',
      governorates: ['القاهرة', 'الجيزة'],
    },
    {
      image: 'https://images.unsplash.com/photo-1576602976047-174e57a47881?w=1600&auto=format&fit=crop&q=80',
      badge: 'إعلان العاصمة #11 • القاهرة والجيزة',
      title: 'منصة موثّقة لتعزيز الثقة مع زبائن القاهرة والجيزة',
      subtitle: 'علامة التوثيق الرسمية تزيد من مصداقية وطلب منتجاتك وخدماتك.',
      governorates: ['القاهرة', 'الجيزة'],
    },
    {
      image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=1600&auto=format&fit=crop&q=80',
      badge: 'إعلان العاصمة #12 • القاهرة والجيزة',
      title: 'احجز مساحتك الإعلانية الكبرى بالقاهرة والجيزة',
      subtitle: 'فريق محترف لدعم خططك التسويقية وزيادة مبيعاتك طوال العام.',
      governorates: ['القاهرة', 'الجيزة'],
    },
    {
      image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1600&auto=format&fit=crop&q=80',
      badge: 'إعلان الدلتا #13 • الشرقية والغربية',
      title: 'باقات انتشار واسعة لمحافظتي الشرقية والغربية',
      subtitle: 'أقل تكلفة وأعلى عائد إعلاني في الزقازيق وطنطا ومراكز الدلتا.',
      governorates: ['الشرقية', 'الغربية'],
    },
    {
      image: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=1600&auto=format&fit=crop&q=80',
      badge: 'إعلان الدلتا #14 • الشرقية والغربية',
      title: 'دعوة عامة لأصحاب الورش والمحلات بالشرقية والغربية',
      subtitle: 'ابدأ اليوم بإنشاء كتالوجك الرقمي وافتح باباً جديداً لطلبات الزبائن.',
      governorates: ['الشرقية', 'الغربية'],
    },
    {
      image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1600&auto=format&fit=crop&q=80',
      badge: 'إعلان الدلتا #15 • الشرقية والغربية',
      title: 'فيديوهات إعلانية مبهرة لمنتجاتك بالشرقية والغربية',
      subtitle: 'اجذب انتباه العملاء بمحتوى مرئي عالي الجودة ومصمم خصيصاً للتسويق.',
      governorates: ['الشرقية', 'الغربية'],
    },
    {
      image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1600&auto=format&fit=crop&q=80',
      badge: 'إعلان الدلتا #16 • الشرقية والغربية',
      title: 'احجز مساحتك الإعلانية المميزة بالدلتا الآن',
      subtitle: 'تواصل مع الإدارة عبر الواتساب لحجز إعلانك الإقليمي.',
      governorates: ['الشرقية', 'الغربية'],
    },
    {
      image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=1600&auto=format&fit=crop&q=80',
      badge: 'إعلان الساحل والقناة #17 • الإسكندرية والقليوبية',
      title: 'تغطية إعلانية في الإسكندرية والقليوبية',
      subtitle: 'نظام طلبات طعام سريعة وإضافات مخصصة للمطاعم والمتاجر.',
      governorates: ['الإسكندرية', 'القليوبية'],
    },
    {
      image: 'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1600&auto=format&fit=crop&q=80',
      badge: 'إعلان الساحل والقناة #18 • الإسكندرية والقليوبية',
      title: 'دعم فني ومتابعة يومية لتشغيل كتالوجك بالإسكندرية وبنها',
      subtitle: 'نحن معك خطوة بخطوة لضمان استمرارية نجاح وتطور مشروعك.',
      governorates: ['الإسكندرية', 'القليوبية'],
    },
    {
      image: 'https://images.unsplash.com/photo-1509785307050-d4066910ec1e?w=1600&auto=format&fit=crop&q=80',
      badge: 'إعلان الساحل والقناة #19 • الإسكندرية والقليوبية',
      title: 'حول متجرك التقليدي إلى متجر رقمي ذكي',
      subtitle: 'الزائرون يبحثون عنك الآن في منطقتك؛ كن أول من يصلون إليه.',
      governorates: ['الإسكندرية', 'القليوبية'],
    },
    {
      image: 'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=1600&auto=format&fit=crop&q=80',
      badge: 'إعلان الساحل والقناة #20 • الإسكندرية والقليوبية',
      title: 'احجز مساحتك الإعلانية الكبرى في الإسكندرية والقليوبية',
      subtitle: 'تواصل الآن عبر الواتساب مع الإدارة لتأمين موقع إعلانك الرئيسي!',
      governorates: ['الإسكندرية', 'القليوبية'],
    },
  ];

  const [currentCoverIndex, setCurrentCoverIndex] = useState(0);

  // Filter slides based on selected governorate
  const activeCoverSlides = React.useMemo(() => {
    if (selectedGovFilter === 'all') return coverSlides;
    const matched = coverSlides.filter(
      (slide) => slide.governorates.includes('all') || slide.governorates.includes(selectedGovFilter)
    );
    return matched.length > 0 ? matched : coverSlides.filter((slide) => slide.governorates.includes('all'));
  }, [selectedGovFilter]);

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

          <a
            href={`https://wa.me/${adminSettings.adminWhatsApp}?text=${encodeURIComponent(`أرغب في حجز مساحة إعلانية مميزة لمحافظة ${selectedGovFilter === 'all' ? 'عامة' : selectedGovFilter} في غلاف الصفحة الرئيسية لمنصة MantiqatiX.`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs py-3 px-6 rounded-2xl shadow-lg shadow-amber-400/25 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap"
          >
            <Megaphone className="w-4 h-4" />
            <span>احجز مساحتك الإعلانية ({selectedGovFilter === 'all' ? 'لكل المحافظات' : selectedGovFilter})</span>
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* 2. Page Cover Slider (COVER للبيدج) - Targeted Ads rotating every 3 seconds */}
        <div className="relative w-full h-64 sm:h-80 md:h-96 rounded-3xl overflow-hidden shadow-2xl bg-slate-900 group">
          {activeCoverSlides.map((slide, idx) => (
            <div
              key={idx}
              className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
                idx === currentCoverIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
              }`}
            >
              <img
                src={slide.image}
                alt={slide.title}
                className="w-full h-full object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-black/30" />
            </div>
          ))}

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
            <a
              href={`https://wa.me/${adminSettings.adminWhatsApp}?text=${encodeURIComponent(`أرغب في حجز المساحة الإعلانية المخصصة لمحافظة (${selectedGovFilter}) - ${currentSlide?.badge} في منصة MantiqatiX.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto mt-2 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs py-2.5 px-6 rounded-xl shadow-lg flex items-center gap-2 transition-all cursor-pointer"
            >
              <span>احجز هذه المساحة الإعلانية عبر الواتساب</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>

          {/* Slider Dots */}
          <div className="absolute bottom-3 right-1/2 translate-x-1/2 z-30 flex items-center gap-1.5 bg-black/50 backdrop-blur-xs px-3 py-1.5 rounded-full border border-white/20 max-w-[90%] overflow-x-auto no-scrollbar">
            {activeCoverSlides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentCoverIndex(idx)}
                className={`h-2 rounded-full transition-all cursor-pointer ${
                  idx === currentCoverIndex ? 'w-5 bg-amber-400' : 'w-1.5 bg-white/50 hover:bg-white'
                }`}
                aria-label={`انتقل للإعلان ${idx + 1}`}
              />
            ))}
          </div>
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
                {businesses.length === 0 ? 'لا توجد كتالوجات منشورة للعامة حاليا' : 'لا توجد أنشطة مطابقة للبحث'}
              </h3>
              <p className="text-xs text-slate-500 max-w-lg mx-auto">
                {businesses.length === 0
                  ? 'الأنشطة غير المنشورة لا تظهر للزوار حفاظا على بيانات أصحابها. تواصل مع إدارة المنصة لتفعيل كتالوج نشاطك.'
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
                          src={biz.coverUrl}
                          alt={biz.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1600&auto=format&fit=crop&q=80';
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
                            src={biz.logoUrl}
                            alt={biz.name}
                            className="w-full h-full object-cover rounded-xl bg-slate-100"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1509785307050-d4066910ec1e?w=240&auto=format&fit=crop&q=80';
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
                      <a
                        href={`https://wa.me/${biz.ownerWhatsApp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
                          `مرحباً، أود الاستفسار والطلب من نشاطكم: ${biz.name}`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-black text-xs py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <MessageCircle className="w-4 h-4 text-emerald-600" />
                        <span>مراسلة واتساب</span>
                      </a>

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
