import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Save, RotateCcw, ShieldCheck } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { ActivityCategory } from '../../types';
import { resolveActivityModuleConfig } from '../../modules/activities/activityModuleRegistry';

type CapabilityDraft = { id: string; title: string; description: string };
type EditorDraft = {
  objective: string;
  audience: string;
  positioning: string;
  contentPillars: string;
  campaignIdeas: string;
  requiredAssets: string;
  capabilities: CapabilityDraft[];
};
type Feedback = { type: 'success' | 'error'; message: string } | null;

const toLines = (value: string) => value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-indigo-500';
const labelClass = 'mb-1.5 block text-xs font-black text-slate-700';

const toDraft = (category: ActivityCategory, overrides: ReturnType<typeof useApp>['adminSettings']['activityModuleOverrides']): EditorDraft => {
  const config = resolveActivityModuleConfig(category, overrides);
  return {
    objective: config.marketing.objective,
    audience: config.marketing.audience,
    positioning: config.marketing.positioning,
    contentPillars: config.marketing.contentPillars.join('\n'),
    campaignIdeas: config.marketing.campaignIdeas.join('\n'),
    requiredAssets: config.marketing.requiredAssets.join('\n'),
    capabilities: config.capabilities.map(({ id, title, description }) => ({ id, title, description })),
  };
};

export const ActivityModulesAdmin: React.FC = () => {
  const { categories, adminSettings, updateAdminSettings } = useApp();
  const activityCategories = useMemo(
    () => categories.filter((category) => category.id.startsWith('cat_') && category.classificationType !== 'profession')
      .sort((a, b) => a.name.localeCompare(b.name, 'ar')),
    [categories],
  );
  const [selectedActivityId, setSelectedActivityId] = useState('');
  const [draft, setDraft] = useState<EditorDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const overrides = adminSettings.activityModuleOverrides || {};
  const selectedCategory = activityCategories.find((category) => category.id === selectedActivityId);

  useEffect(() => {
    if (!activityCategories.length) return;
    if (!activityCategories.some((category) => category.id === selectedActivityId)) {
      setSelectedActivityId(activityCategories[0].id);
    }
  }, [activityCategories, selectedActivityId]);

  useEffect(() => {
    if (!selectedCategory) {
      setDraft(null);
      return;
    }
    setDraft(toDraft(selectedCategory, overrides));
    setFeedback(null);
  }, [selectedActivityId, selectedCategory?.name, adminSettings.activityModuleOverrides]);

  const updateMarketing = (field: keyof Omit<EditorDraft, 'capabilities'>, value: string) => {
    setDraft((current) => current ? { ...current, [field]: value } : current);
  };

  const updateCapability = (id: string, field: 'title' | 'description', value: string) => {
    setDraft((current) => current ? {
      ...current,
      capabilities: current.capabilities.map((item) => item.id === id ? { ...item, [field]: value } : item),
    } : current);
  };

  const save = async () => {
    if (!selectedCategory || !draft || saving) return;
    if (!draft.objective.trim() || !draft.audience.trim() || !draft.positioning.trim()) {
      setFeedback({ type: 'error', message: 'أكمل الهدف والجمهور والتموضع التسويقي قبل الحفظ.' });
      return;
    }
    if (draft.capabilities.length !== 3 || draft.capabilities.some((item) => !item.title.trim() || !item.description.trim())) {
      setFeedback({ type: 'error', message: 'يجب الاحتفاظ بالقدرات التشغيلية الثلاث لكل نشاط، مع عنوان ووصف لكل قدرة.' });
      return;
    }

    const nextOverrides = {
      ...overrides,
      [selectedCategory.id]: {
        marketing: {
          objective: draft.objective.trim(),
          audience: draft.audience.trim(),
          positioning: draft.positioning.trim(),
          contentPillars: toLines(draft.contentPillars),
          campaignIdeas: toLines(draft.campaignIdeas),
          requiredAssets: toLines(draft.requiredAssets),
        },
        capabilities: draft.capabilities.map(({ id, title, description }) => ({ id, title: title.trim(), description: description.trim() })),
      },
    };

    setSaving(true);
    setFeedback(null);
    try {
      await updateAdminSettings({ activityModuleOverrides: nextOverrides });
      setFeedback({ type: 'success', message: 'تم حفظ إعدادات النشاط من خلال خدمة الإدارة المركزية.' });
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'تعذر تأكيد حفظ إعدادات النشاط وسجل التدقيق.',
      });
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!selectedCategory || saving || !overrides[selectedCategory.id]) return;
    if (!window.confirm('سيتم حذف التخصيص الإداري لهذا النشاط والعودة إلى إعداداته الأساسية. هل تريد المتابعة؟')) return;
    const nextOverrides = { ...overrides };
    delete nextOverrides[selectedCategory.id];
    setSaving(true);
    setFeedback(null);
    try {
      await updateAdminSettings({ activityModuleOverrides: nextOverrides });
      setFeedback({ type: 'success', message: 'تم حذف التخصيص والعودة إلى إعدادات النشاط الأساسية.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'تعذر إعادة إعدادات النشاط.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section dir="rtl" className="space-y-5">
      <header className="rounded-3xl bg-gradient-to-l from-slate-950 to-indigo-950 p-5 text-white shadow-lg sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-200"><ShieldCheck className="h-5 w-5" /><span className="text-xs font-black">Super Admin · Activity Modules</span></div>
            <h2 className="mt-2 text-2xl font-black">إعدادات وحدات الأنشطة</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">تحرير المحتوى التسويقي والقدرات التعريفية لكل نشاط على حدة. الحفظ يمر عبر خدمة الإدارة المركزية ويُسجل محاولة التعديل في سجل العمليات.</p>
          </div>
          <div className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-bold">أنشطة مخصصة: {Object.keys(overrides).length} / {activityCategories.length}</div>
        </div>
      </header>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <label className={labelClass} htmlFor="activity-module-select">اختر النشاط</label>
        <select id="activity-module-select" value={selectedActivityId} onChange={(event) => setSelectedActivityId(event.target.value)} className={inputClass}>
          {activityCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        {selectedCategory && <p className="mt-2 break-all text-[11px] text-slate-400">المعرف الثابت: {selectedCategory.id}</p>}
      </div>

      {!selectedCategory || !draft ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">لا توجد أنشطة أساسية متاحة للتحرير.</div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <article className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
              <div><h3 className="text-lg font-black text-slate-900">الهوية والتسويق</h3><p className="mt-1 text-xs text-slate-500">هذه البيانات إرشادات تخطيطية، ولا تنشئ حملات أو تنشر إعلانات.</p></div>
              <label className={labelClass}>الهدف التسويقي<textarea maxLength={500} rows={3} value={draft.objective} onChange={(event) => updateMarketing('objective', event.target.value)} className={inputClass} /></label>
              <label className={labelClass}>الجمهور المستهدف<textarea maxLength={500} rows={3} value={draft.audience} onChange={(event) => updateMarketing('audience', event.target.value)} className={inputClass} /></label>
              <label className={labelClass}>التموضع والرسالة<textarea maxLength={500} rows={3} value={draft.positioning} onChange={(event) => updateMarketing('positioning', event.target.value)} className={inputClass} /></label>
              <label className={labelClass}>محاور المحتوى — كل محور في سطر<textarea maxLength={1600} rows={4} value={draft.contentPillars} onChange={(event) => updateMarketing('contentPillars', event.target.value)} className={inputClass} /></label>
              <label className={labelClass}>أفكار الحملات — كل فكرة في سطر<textarea maxLength={1600} rows={4} value={draft.campaignIdeas} onChange={(event) => updateMarketing('campaignIdeas', event.target.value)} className={inputClass} /></label>
              <label className={labelClass}>الأصول المطلوبة — كل عنصر في سطر<textarea maxLength={1600} rows={4} value={draft.requiredAssets} onChange={(event) => updateMarketing('requiredAssets', event.target.value)} className={inputClass} /></label>
            </article>

            <article className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5">
              <div><h3 className="text-lg font-black text-slate-900">القدرات التشغيلية الخاصة بالنشاط</h3><p className="mt-1 text-xs leading-6 text-slate-500">يمكن تعديل العنوان والوصف فقط. لا يمكن تفعيل حالة «متاح» من لوحة الإعدادات؛ تظل كل وظيفة قيد التجهيز حتى اعتماد تكاملها الخلفي واختبارات الصلاحيات.</p></div>
              {draft.capabilities.map((capability, index) => (
                <div key={capability.id} className="space-y-3 rounded-2xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between gap-2"><h4 className="font-black text-slate-800">القدرة {index + 1}</h4><span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-black text-amber-800">قيد التجهيز</span></div>
                  <label className={labelClass}>عنوان القدرة<input maxLength={120} value={capability.title} onChange={(event) => updateCapability(capability.id, 'title', event.target.value)} className={inputClass} /></label>
                  <label className={labelClass}>وصف القدرة<textarea maxLength={300} rows={3} value={capability.description} onChange={(event) => updateCapability(capability.id, 'description', event.target.value)} className={inputClass} /></label>
                  <p className="break-all font-mono text-[10px] text-slate-400">ID: {capability.id}</p>
                </div>
              ))}
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">لا توجد هنا أزرار لتشغيل الطلبات أو الحجوزات أو المخزون أو الحملات. التفعيل يحتاج API/RPC معتمدًا، ونطاق tenant/business/branch، وسجل تدقيق واختبارات رفض الوصول غير المصرح.</div>
            </article>
          </div>

          {feedback && <div role="status" className={'rounded-xl border p-3 text-sm font-bold ' + (feedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800')}>{feedback.message}</div>}
          <div className="flex flex-wrap justify-between gap-3">
            <button type="button" disabled={saving || !overrides[selectedCategory.id]} onClick={() => void reset()} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-40"><RotateCcw className="h-4 w-4" />العودة للإعدادات الأساسية</button>
            <button type="button" disabled={saving} onClick={() => void save()} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? 'جارٍ الحفظ...' : 'حفظ إعدادات النشاط'}</button>
          </div>
        </>
      )}
    </section>
  );
};
