import React, { useMemo, useState } from 'react';
import { ArrowRight, BarChart3, BriefcaseBusiness, CalendarDays, Megaphone, Package, Search, ShieldCheck, Store, Target, Users } from 'lucide-react';
import type { ActivityCategory } from '../../types';
import { useApp } from '../../context/AppContext';
import { resolveActivityModuleConfig } from './activityModuleRegistry';

type Section = 'overview' | 'specialties' | 'marketing' | 'operations';
interface Props {
  category: ActivityCategory;
  confirmedCount: number;
  unconfirmedCount: number;
  onBack: () => void;
  onSelectSpecialty: (specialty: string) => void;
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

export const ActivityModuleView: React.FC<Props> = ({ category, confirmedCount, unconfirmedCount, onBack, onSelectSpecialty, parentGroupName }) => {
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [campaignGoal, setCampaignGoal] = useState('زيادة الطلبات والاستفسارات');
  const [campaignBudget, setCampaignBudget] = useState('3000');
  const [campaignDuration, setCampaignDuration] = useState('30');
  const [selectedChannels, setSelectedChannels] = useState<string[]>(['فيسبوك', 'واتساب', 'إنستجرام']);
  const [campaignPrepared, setCampaignPrepared] = useState(false);
  const { adminSettings } = useApp();
  const specialties = useMemo(() => category.specialties || [], [category.specialties]);
  const moduleConfig = useMemo(() => resolveActivityModuleConfig(category, adminSettings.activityModuleOverrides), [category, adminSettings.activityModuleOverrides]);
  const marketing = moduleConfig.marketing;

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

      {activeSection === 'specialties' && <section className="space-y-3">
        <div><h2 className="text-lg font-black text-slate-900">تخصصات {category.name}</h2><p className="mt-1 text-xs text-slate-500">اختر تخصصًا لعرض الجهات التابعة له في الدليل.</p></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <button type="button" onClick={() => onSelectSpecialty('all')} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-right font-black text-emerald-900">كل التخصصات</button>
          {specialties.map((specialty) => <button key={specialty} type="button" onClick={() => onSelectSpecialty(specialty)} className="rounded-2xl border border-slate-200 bg-white p-4 text-right font-bold text-slate-800 hover:border-emerald-300 hover:bg-emerald-50/40">{specialty}</button>)}
          {!specialties.length && <p className="col-span-full rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">لم تُسجل تخصصات لهذا النشاط بعد.</p>}
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
            <div><h5 className="text-sm font-black text-emerald-950">توزيع الميزانية المقترح</h5><div className="mt-2 space-y-2">{selectedChannels.map((channel, index) => { const shares = selectedChannels.map((_, position) => position === 0 ? 40 : position === 1 ? 25 : Math.floor(35 / Math.max(1, selectedChannels.length - 2))); const share = shares[index] ?? 0; return <div key={channel} className="flex items-center gap-2 text-xs"><span className="w-28 font-bold text-slate-700">{channel}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-emerald-600" style={{ width: share + '%' }} /></div><span className="w-20 text-left font-bold text-slate-700">{share}% · {Math.round(Number(campaignBudget) * share / 100).toLocaleString('ar-EG')} ج.م</span></div>; })}</div></div>
            <div><h5 className="text-sm font-black text-emerald-950">تقويم المحتوى المقترح</h5><div className="mt-2 grid gap-2 sm:grid-cols-2">{Array.from({ length: Math.min(6, Math.ceil(Number(campaignDuration) / 5)) }, (_, index) => <div key={index} className="rounded-xl bg-white p-3"><p className="text-[10px] font-black text-emerald-700">الأيام {index * 5 + 1} – {Math.min((index + 1) * 5, Number(campaignDuration))}</p><p className="mt-1 text-xs font-bold text-slate-800">{marketing.contentPillars[index % marketing.contentPillars.length] || 'محتوى تعريفي بالنشاط'}</p><p className="mt-1 text-[11px] leading-5 text-slate-500">{marketing.campaignIdeas[index % marketing.campaignIdeas.length] || 'منشور تعريفي ودعوة لاتخاذ إجراء'}</p></div>)}</div></div>
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
