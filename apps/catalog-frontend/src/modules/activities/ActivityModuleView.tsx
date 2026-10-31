import React, { useMemo, useState } from 'react';
import { ArrowRight, BarChart3, BriefcaseBusiness, CalendarDays, Megaphone, Package, Search, ShieldCheck, Store, Target, Users } from 'lucide-react';
import type { ActivityCategory } from '../../types';

type Section = 'overview' | 'specialties' | 'marketing' | 'operations';
interface Props {
  category: ActivityCategory;
  confirmedCount: number;
  unconfirmedCount: number;
  onBack: () => void;
  onSelectSpecialty: (specialty: string) => void;
}

const sections: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'الرئيسية', icon: <Store className="h-4 w-4" /> },
  { id: 'specialties', label: 'التخصصات', icon: <Package className="h-4 w-4" /> },
  { id: 'marketing', label: 'التسويق والإعلان', icon: <Megaphone className="h-4 w-4" /> },
  { id: 'operations', label: 'إدارة المجال', icon: <BriefcaseBusiness className="h-4 w-4" /> },
];

const normalize = (value: string) => value.toLocaleLowerCase('ar-EG').normalize('NFKC')
  .replace(/[أإآ]/g, 'ا').replace(/[ىي]/g, 'ي').replace(/ة/g, 'ه').replace(/[\u064B-\u065F\u0670]/g, '');

function marketingProfile(name: string) {
  const value = normalize(name);
  if (/مطعم|مقهي|كافيه|حلويات|مخبز|اطعمه|اغذيه/.test(value)) return {
    audience: 'العملاء القريبون جغرافيًا، العائلات، والباحثون عن وجبات أو أماكن جديدة.',
    content: ['صور فعلية للمنتجات والأطباق', 'قائمة وأسعار وعروض واضحة', 'آراء العملاء وساعات العمل والتوصيل'],
    campaigns: ['عرض وجبة أو قائمة موسمية', 'حملة افتتاح أو إعادة تنشيط', 'حملة داخل نطاق التوصيل'],
  };
  if (/طب|صحه|عياد|مستشفي|صيدلي|تحاليل|اشعه/.test(value)) return {
    audience: 'الأشخاص الباحثون عن خدمة صحية موثوقة بالقرب من موقعهم.',
    content: ['تعريف التخصص والخدمات ومواعيد العمل', 'محتوى توعوي يراجعه مختص', 'بيانات التواصل والحجز والموقع'],
    campaigns: ['حملة تعريف بالخدمة والتخصص', 'حملة توعية موسمية مسؤولة', 'حملة إبراز المواعيد والخدمات المتاحة'],
  };
  if (/عقار|اسكان|تشطيب|مقاول|ديكور/.test(value)) return {
    audience: 'الأفراد والشركات الباحثون عن عقارات أو تنفيذ وتشطيب في نطاق محدد.',
    content: ['صور ومشروعات حقيقية وتفاصيلها', 'شرح نطاق العمل والخامات والضمان', 'نماذج أعمال بموافقة أصحابها'],
    campaigns: ['حملة عرض مشروع أو وحدة', 'حملة طلب معاينة أو عرض سعر', 'حملة إبراز الأعمال السابقة'],
  };
  return {
    audience: 'العملاء المحليون الذين يبحثون عن النشاط أو التخصص ضمن نطاقهم الجغرافي.',
    content: ['تعريف واضح بالخدمات والتخصصات', 'صور وأعمال حقيقية وبيانات اتصال دقيقة', 'تقييمات وتجارب موثوقة بموافقة أصحابها'],
    campaigns: ['حملة تعريف بالنشاط', 'حملة إبراز تخصص أو خدمة', 'حملة عرض موسمي أو مناسبة محلية'],
  };
}

const Metric: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <article className={`rounded-2xl border p-4 ${color}`}><p className="text-xs font-bold">{label}</p><p className="mt-2 text-2xl font-black">{value.toLocaleString('ar-EG')}</p></article>
);

export const ActivityModuleView: React.FC<Props> = ({ category, confirmedCount, unconfirmedCount, onBack, onSelectSpecialty }) => {
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const specialties = useMemo(() => category.specialties || [], [category.specialties]);
  const marketing = useMemo(() => marketingProfile(category.name), [category.name]);

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

      {activeSection === 'specialties' && <section className="space-y-3">
        <div><h2 className="text-lg font-black text-slate-900">تخصصات {category.name}</h2><p className="mt-1 text-xs text-slate-500">اختر تخصصًا لعرض الجهات التابعة له في الدليل.</p></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <button type="button" onClick={() => onSelectSpecialty('all')} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-right font-black text-emerald-900">كل التخصصات</button>
          {specialties.map((specialty) => <button key={specialty} type="button" onClick={() => onSelectSpecialty(specialty)} className="rounded-2xl border border-slate-200 bg-white p-4 text-right font-bold text-slate-800 hover:border-emerald-300 hover:bg-emerald-50/40">{specialty}</button>)}
          {!specialties.length && <p className="col-span-full rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">لم تُسجل تخصصات لهذا النشاط بعد.</p>}
        </div>
      </section>}

      {activeSection === 'marketing' && <section className="space-y-4">
        <header><h2 className="text-lg font-black text-slate-900">مركز تسويق {category.name}</h2><p className="mt-1 text-xs leading-6 text-slate-500">توجيهات تسويقية مبدئية مرتبطة بطبيعة المجال؛ أدوات إنشاء الحملات ونشرها وقياسها تُربط بعد استكمال عقود التسويق الخلفية والصلاحيات.</p></header>
        <div className="grid gap-3 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><Target className="h-5 w-5 text-emerald-700" /><h3 className="font-black text-slate-900">الجمهور المستهدف</h3></div><p className="mt-3 text-sm leading-7 text-slate-600">{marketing.audience}</p></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-center gap-2"><CalendarDays className="h-5 w-5 text-emerald-700" /><h3 className="font-black text-slate-900">أفكار الحملات</h3></div><ul className="mt-3 space-y-2">{marketing.campaigns.map((item) => <li key={item} className="flex items-start gap-2 text-sm text-slate-600"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />{item}</li>)}</ul></article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5 lg:col-span-2"><div className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-emerald-700" /><h3 className="font-black text-slate-900">محاور المحتوى</h3></div><div className="mt-3 grid gap-2 sm:grid-cols-3">{marketing.content.map((item) => <div key={item} className="rounded-xl bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700">{item}</div>)}</div></article>
        </div>
        <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">هذه إرشادات تخطيطية وليست حملة منشورة. لن يتم إنشاء حملات أو صرف ميزانيات أو نشر إعلانات من هذه الصفحة قبل ربط واجهات التسويق المعتمدة والتحقق من صلاحيات كل نشاط.</p>
      </section>}

      {activeSection === 'operations' && <section className="space-y-4">
        <div><h2 className="text-lg font-black text-slate-900">إدارة {category.name}</h2><p className="mt-1 text-xs leading-6 text-slate-500">ستُفعّل أدوات التشغيل بحسب طبيعة المجال ومصدر البيانات وصلاحيات المستخدم.</p></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { title: 'ملفات الجهات والفروع', detail: 'بيانات النشاط والتوثيق ونطاق الفروع.', icon: <Store className="h-5 w-5" /> },
            { title: 'الخدمات والمنتجات', detail: 'كتالوج خاص بما يقدمه النشاط.', icon: <Package className="h-5 w-5" /> },
            { title: 'العملاء والطلبات', detail: 'الاستفسارات والطلبات المناسبة لطبيعة المجال.', icon: <Users className="h-5 w-5" /> },
            { title: 'التقارير والتحليلات', detail: 'تعتمد على السجلات الفعلية فقط.', icon: <BarChart3 className="h-5 w-5" /> },
            { title: 'البحث الجغرافي', detail: 'القرية والمنطقة والمركز والمحافظة ومصر.', icon: <Search className="h-5 w-5" /> },
            { title: 'الصلاحيات والاعتماد', detail: 'حسب المستخدم والنشاط والفرع.', icon: <ShieldCheck className="h-5 w-5" /> },
          ].map((item) => <article key={item.title} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center gap-2 text-emerald-700">{item.icon}<h3 className="font-black text-slate-900">{item.title}</h3></div><p className="mt-2 text-xs leading-6 text-slate-500">{item.detail}</p></article>)}
        </div>
      </section>}
    </main>
  );
};
