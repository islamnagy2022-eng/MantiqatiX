import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Megaphone,
  Package,
  Search,
  ShieldCheck,
  Store,
  Target,
  Users,
} from 'lucide-react';
import type { ActivityCategory } from '../types';

type ModuleSection = 'overview' | 'specialties' | 'marketing' | 'operations';

interface ActivityModuleViewProps {
  category: ActivityCategory;
  confirmedListingsCount: number;
  unconfirmedListingsCount: number;
  onBack: () => void;
  onSelectSpecialty: (specialty: string) => void;
}

const MODULE_SECTIONS: { id: ModuleSection; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'الرئيسية', icon: <Store className="h-4 w-4" /> },
  { id: 'specialties', label: 'التخصصات', icon: <Package className="h-4 w-4" /> },
  { id: 'marketing', label: 'التسويق والإعلان', icon: <Megaphone className="h-4 w-4" /> },
  { id: 'operations', label: 'إدارة المجال', icon: <BriefcaseBusiness className="h-4 w-4" /> },
];

const normalize = (value: string) => value.toLocaleLowerCase('ar-EG')
  .normalize('NFKC')
  .replace(/[أإآ]/g, 'ا')
  .replace(/[ىي]/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/[\u064B-\u065F\u0670]/g, '');

function getMarketingFocus(categoryName: string): { audience: string; content: string[]; campaigns: string[] } {
  const value = normalize(categoryName);
  if (/مطعم|مقهي|كافيه|حلويات|مخبز|اطعمه|اغذيه/.test(value)) {
    return {
      audience: 'العملاء القريبون جغرافيًا، العائلات، والباحثون عن وجبات أو أماكن جديدة.',
      content: ['تصوير المنتجات والأطباق الفعلية', 'قوائم وأسعار واضحة وعروض محددة المدة', 'آراء العملاء وساعات العمل والتوصيل'],
      campaigns: ['عرض وجبة أو قائمة موسمية', 'حملة افتتاح أو إعادة تنشيط', 'حملة استهداف داخل نطاق التوصيل'],
    };
  }
  if (/طب|صحه|عياد|مستشفي|صيدلي|تحاليل|اشعه/.test(value)) {
    return {
      audience: 'الأشخاص الباحثون عن خدمة صحية موثوقة بالقرب من موقعهم.',
      content: ['تعريف واضح بالتخصص والخدمات ومواعيد العمل', 'محتوى توعوي يراجعه مختص', 'بيانات التواصل والحجز والموقع'],
      campaigns: ['حملة تعريف بالخدمة والتخصص', 'حملة توعية موسمية غير مضللة', 'حملة تذكير بالمواعيد والخدمات المتاحة'],
    };
  }
  if (/عقار|اسكان|تشطيب|مقاول|ديكور/.test(value)) {
    return {
      audience: 'الأفراد والشركات الباحثون عن عقارات أو تنفيذ وتشطيب داخل نطاق جغرافي محدد.',
      content: ['صور ومشروعات حقيقية مع تفاصيل واضحة', 'شرح نطاق العمل والخامات والضمان', 'نماذج أعمال قبل وبعد بموافقة أصحابها'],
      campaigns: ['حملة عرض مشروع أو وحدة', 'حملة طلب معاينة أو عرض سعر', 'حملة إبراز الأعمال السابقة'],
    };
  }
  if (/سيار|نقل|مواصل|قطع غيار/.test(value)) {
    return {
      audience: 'أصحاب المركبات والباحثون عن خدمة أو منتج في محيطهم.',
      content: ['الخدمات والماركات التي يتم التعامل معها', 'صور حقيقية ومعلومات الضمان', 'مواعيد الاستقبال وخدمة الطوارئ إن وجدت'],
      campaigns: ['حملة خدمة موسمية', 'حملة صيانة وفحص', 'حملة قطع غيار أو عروض خدمة'],
    };
  }
  return {
    audience: 'العملاء المحليون الذين يبحثون عن النشاط أو التخصص ضمن نطاقهم الجغرافي.',
    content: ['تعريف بالخدمات والتخصصات بوضوح', 'صور وأعمال حقيقية ومعلومات اتصال دقيقة', 'تقييمات وتجارب موثوقة بموافقة أصحابها'],
    campaigns: ['حملة تعريف بالنشاط', 'حملة إبراز تخصص أو خدمة', 'حملة عرض موسمي أو مناسبة محلية'],
  };
}

const Metric: React.FC<{ label: string; value: number; tone: 'green' | 'red' | 'slate' }> = ({ label, value, tone }) => {
  const colors = tone === 'green'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : tone === 'red'
      ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-slate-200 bg-slate-50 text-slate-800';
  return <article className={`rounded-2xl border p-4 ${colors}`}><p className="text-xs font-bold opacity-80">{label}</p><p className="mt-2 text-2xl font-black">{value.toLocaleString('ar-EG')}</p></article>;
};

export const ActivityModuleView: React.FC<ActivityModuleViewProps> = ({
  category,
  confirmedListingsCount,
  unconfirmedListingsCount,
  onBack,
  onSelectSpecialty,
}) => {
  const [section, setSection] = useState<ModuleSection>('overview');
  const specialties = useMemo(() => category.specialties || [], [category.specialties]);
  const marketing = useMemo(() => getMarketingFocus(category.name), [category.name]);

  return (
    <main className="mx-auto min-h-[70vh] max-w-7xl space-y-5 px-3 py-5 sm:px-6 sm:py-8" dir="rtl">
      <header className="overflow-hidden rounded-3xl bg-gradient-to-l from-slate-950 via-emerald-950 to-slate-900 text-white shadow-lg">
        <div className="p-5 sm:p-8">
          <button type="button" onClick={onBack} className="mb-5 inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/15">
            <ArrowRight className="h-4 w-4" /> العودة إلى كل الأنشطة
          </button>
          <p className="text-xs font-bold text-emerald-300">MantiqatiX / وحدة النشاط</p>
          <h1 className="mt-2 text-2xl font-black sm:text-4xl">{category.name}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-white/75">
            {category.description || `الوحدة المتخصصة لنشاط ${category.name}، وتضم التخصصات والجهات والخدمات المرتبطة به.`}
          </p>
          <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-white/10 px-3 py-2">عدد التخصصات: {specialties.length.toLocaleString('ar-EG')}</span>
            <span className="rounded-full bg-emerald-400/15 px-3 py-2 text-emerald-100">موثق: {confirmedListingsCount.toLocaleString('ar-EG')}</span>
            <span className="rounded-full bg-red-400/15 px-3 py-2 text-red-100">غير موثق: {unconfirmedListingsCount.toLocaleString('ar-EG')}</span>
          </div>
        </div>
      </header>

      <nav aria-label="أقسام وحدة النشاط" className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {MODULE_SECTIONS.map((item) => (
          <button key={item.id} type="button" onClick={() => setSection(item.id)} aria-current={section === item.id ? 'page' : undefined}
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-black transition sm:px-4 ${section === item.id ? 'bg-emerald-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}>
            {item.icon}{item.label}
          </button>
        ))}
      </nav>

      {section === 'overview' && (
        <section className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric label="الأنشطة الموثقة" value={confirmedListingsCount} tone="green" />
            <Metric label="صفحات غير موثقة" value={unconfirmedListingsCount} tone="red" />
            <Metric label="التخصصات" value={specialties.length} tone="slate" />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <button type="button" onClick={() => setSection('specialties')} className="rounded-2xl border border-slate-200 bg-white p-5 text-right transition hover:border-emerald-300 hover:bg-emerald-50/50">
              <Package className="h-6 w-6 text-emerald-700" /><h2 className="mt-3 font-black text-slate-900">التخصصات والجهات</h2><p className="mt-1 text-xs leading-6 text-slate-500">افتح التخصصات ثم استعرض الجهات المسجلة في هذا النشاط.</p>
            </button>
            <button type="button" onClick={() => setSection('marketing')} className="rounded-2xl border border-slate-200 bg-white p-5 text-right transition hover:border-emerald-300 hover:bg-emerald-50/50">
              <Megaphone className="h-6 w-6 text-emerald-700" /><h2 className="mt-3 font-black text-slate-900">التسويق والإعلان</h2><p className="mt-1 text-xs leading-6 text-slate-500">استراتيجية تسويق مهيأة لطبيعة النشاط وقنواته وجمهوره.</p>
            </button>
            <button type="button" onClick={() => setSection('operations')} className="rounded-2xl border border-slate-200 bg-white p-5 text-right transition hover:border-emerald-300 hover:bg-emerald-50/50">
              <BriefcaseBusiness className="h-6 w-6 text-emerald-700" /><h2 className="mt-3 font-black text-slate-900">إدارة المجال</h2><p className="mt-1 text-xs leading-6 text-slate-500">مساحة ربط وظائف التشغيل المناسبة لهذا النشاط.</p>
            </button>
          </div>
        </section>
      )}

      {section === 'specialties' && (
        <section className="space-y-3">
          <div><h2 className="text-lg font-black text-slate-900">تخصصات {category.name}</h2><p className="mt-1 text-xs text-slate-500">اختر تخصصًا لعرض الجهات التابعة له داخل الدليل.</p></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
            <button type="button" onClick={() => onSelectSpecialty('all')} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-right font-black text-emerald-900">كل التخصصات</button>
            {specialties.map((specialty) => <button key={specialty} type="button" onClick={() => onSelectSpecialty(specialty)} className="rounded-2xl border border-slate-200 bg-white p-4 text-right font-bold text-slate-800 transition hover:border-emerald-300 hover:bg-emerald-50/50">{specialty}</button>)}
            {!specialties.length && <p className="col-span-full rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">لم تُسجل تخصصات لهذا النشاط بعد.</p>}
          </div>
        </section>
      )}

      {section === 'marketing' && (
        <section className="space-y-4">
          <header><h2 className="text-lg font-black text-slate-900">مركز تسويق {category.name}</h2><p className="mt-1 text-xs leading-6 text-slate-500">توجيهات تسويقية مرتبطة بطبيعة المجال. إنشاء الحملات ونشرها وقياس نتائجها يحتاج ربطًا بصلاحيات وواجهات التسويق المعتمدة.</p></header>
          <div className="grid gap-3 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2"><Target className="h-5 w-5 text-emerald-700" /><h3 className="font-black text-slate-900">الجمهور المستهدف</h3></div>
              <p className="mt-3 text-sm leading-7 text-slate-600">{marketing.audience}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5">
              <div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-emerald-700" /><h3 className="font-black text-slate-900">أفكار الحملات</h3></div>
              <ul className="mt-3 space-y-2">{marketing.campaigns.map((item) => <li key={item} className="flex items-start gap-2 text-sm text-slate-600"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />{item}</li>)}</ul>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2">
              <div className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-emerald-700" /><h3 className="font-black text-slate-900">محاور المحتوى</h3></div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">{marketing.content.map((item) => <div key={item} className="rounded-xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700">{item}</div>)}</div>
            </article>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">
            هذه صفحة تخطيط أولية خاصة بالمجال وليست أداة نشر حملات. لن يتم إنشاء حملة أو خصم ميزانية أو نشر إعلان حتى يتم ربطها بعقود التسويق الخلفية والتحقق من صلاحيات النشاط.
          </div>
        </section>
      )}

      {section === 'operations' && (
        <section className="space-y-4">
          <div><h2 className="text-lg font-black text-slate-900">تشغيل وإدارة {category.name}</h2><p className="mt-1 text-xs leading-6 text-slate-500">تتحدد وظائف التشغيل بحسب المجال، وتُفعّل فقط عند وجود مصدر بيانات وصلاحية معتمدة.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { title: 'إدارة الجهات والملفات', detail: 'ملفات النشاط وبيانات التواصل والاعتماد.', icon: <Store className="h-5 w-5" /> },
              { title: 'الخدمات والمنتجات', detail: 'كتالوج الخدمات أو المنتجات وفق نوع النشاط.', icon: <Package className="h-5 w-5" /> },
              { title: 'العملاء وطلبات الخدمة', detail: 'طلبات واستفسارات المجال عند توافر تكاملها.', icon: <Users className="h-5 w-5" /> },
              { title: 'التقارير والتحليلات', detail: 'مؤشرات من السجلات الفعلية فقط، دون أرقام تجريبية.', icon: <BarChart3 className="h-5 w-5" /> },
              { title: 'البحث الجغرافي', detail: 'القرية والمنطقة والمركز والمحافظة ومصر.', icon: <Search className="h-5 w-5" /> },
              { title: 'الصلاحيات والاعتماد', detail: 'صلاحيات مستقلة بحسب المستخدم والنشاط والفرع.', icon: <ShieldCheck className="h-5 w-5" /> },
            ].map((item) => <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-emerald-700">{item.icon}<h3 className="font-black text-slate-900">{item.title}</h3></div><p className="mt-2 text-xs leading-6 text-slate-500">{item.detail}</p></article>)}
          </div>
        </section>
      )}
    </main>
  );
};
