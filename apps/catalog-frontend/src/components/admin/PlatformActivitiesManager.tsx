import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Check, ExternalLink, Loader2, Pencil, RefreshCw, Search, ShieldCheck, Store, X } from 'lucide-react';
import { supabase } from '../../lib/production';
import { useApp } from '../../context/AppContext';

type Activity = {
  id: string; tenantId: string; organizationId?: string | null; name: string; code: string;
  status: string; category: string; phone: string; governorate: string; markaz: string; village: string;
  address: string; bio: string; workingHours: string; logoUrl: string; coverUrl: string;
  published: boolean; frozen: boolean; paymentStatus: string; publicationStatus: string;
};
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500';
const btnClass = 'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-bold disabled:opacity-50';

export const PlatformActivitiesManager: React.FC = () => {
  const { setSelectedBusinessId, setCurrentView } = useApp();
  const [rows, setRows] = useState<Activity[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{type:'success'|'error';text:string}|null>(null);
  const [draft, setDraft] = useState<Activity|null>(null);

  const load = useCallback(async () => {
    setLoading(true); setNotice(null);
    const { data, error } = await supabase.functions.invoke('business-admin', { body: { action: 'LIST' } });
    setLoading(false);
    if (error || !Array.isArray(data?.activities)) {
      setNotice({type:'error',text:data?.message || error?.message || 'تعذر تحميل الأنشطة. تأكد من نشر وظيفة business-admin وأن حسابك مالك المنصة.'});
      return;
    }
    setRows(data.activities);
    setSelectedId((current) => data.activities.some((a:Activity)=>a.id===current) ? current : data.activities[0]?.id || '');
  }, []);

  useEffect(()=>{ void load(); },[load]);
  const filtered = useMemo(()=>rows.filter(a=>[a.name,a.code,a.category,a.phone,a.governorate].join(' ').toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())),[rows,search]);
  const selected = rows.find(a=>a.id===selectedId)||filtered[0]||null;
  const edit = (activity:Activity) => setDraft({...activity});
  const setField = (key:keyof Activity,value:string|boolean) => setDraft(current=>current?({...current,[key]:value} as Activity):current);

  const save = async () => {
    if(!draft) return;
    if(!draft.name.trim() || draft.name.trim().length<2) { setNotice({type:'error',text:'اسم النشاط مطلوب ويجب ألا يقل عن حرفين.'}); return; }
    if(!window.confirm('تأكيد حفظ بيانات النشاط وإعدادات النشر؟ سيتم تسجيل التغييرات في سجل العمليات.')) return;
    setSaving(true);setNotice(null);
    const {data,error}=await supabase.functions.invoke('business-admin',{body:{
      action:'UPDATE_ACTIVITY', businessId:draft.id, tenantId:draft.tenantId,
      name:draft.name.trim(), category:draft.category.trim(), phone:draft.phone.trim(),
      governorate:draft.governorate.trim(), markaz:draft.markaz.trim(), village:draft.village.trim(),
      address:draft.address.trim(), bio:draft.bio.trim(), workingHours:draft.workingHours.trim(),
      logoUrl:draft.logoUrl.trim(), coverUrl:draft.coverUrl.trim(), published:draft.published,
    }});
    setSaving(false);
    if(error||!data?.success){setNotice({type:'error',text:data?.message||error?.message||'تعذر حفظ النشاط.'});return;}
    setNotice({type:'success',text:'تم حفظ بيانات النشاط.'});setDraft(null);await load();
  };

  const setStatus = async (activity:Activity,status:'ACTIVE'|'INACTIVE'|'SUSPENDED') => {
    const label=status==='SUSPENDED'?'إيقاف النشاط وتعطيل نشره':status==='INACTIVE'?'إلغاء تنشيط النشاط':'إعادة تنشيط النشاط';
    if(!window.confirm(`هل تريد ${label} للنشاط «${activity.name}»؟`)) return;
    setSaving(true);setNotice(null);
    const {data,error}=await supabase.functions.invoke('business-admin',{body:{action:'SET_STATUS',businessId:activity.id,tenantId:activity.tenantId,status}});
    setSaving(false);
    if(error||!data?.success){setNotice({type:'error',text:data?.message||error?.message||'تعذر تغيير حالة النشاط.'});return;}
    setNotice({type:'success',text:data.message||'تم تحديث حالة النشاط.'});await load();
  };

  const openCatalog = (activity:Activity) => { setSelectedBusinessId(activity.id); setCurrentView('merchant_admin'); };

  return <div dir="rtl" className="space-y-5">
    <header className="rounded-3xl bg-gradient-to-l from-slate-950 to-indigo-950 p-5 text-white">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><div className="flex items-center gap-2 text-indigo-200"><ShieldCheck className="h-5 w-5"/><span className="text-xs font-black">إدارة المنصة</span></div><h3 className="mt-2 text-2xl font-black">إدارة الأنشطة التجارية</h3><p className="mt-1 text-sm leading-6 text-slate-300">تعديل بيانات النشاط، نشر أو إلغاء نشر كتالوجه، وإيقاف النشاط أو إعادة تنشيطه من مكان واحد.</p></div>
        <button onClick={()=>void load()} disabled={loading||saving} className={btnClass+' bg-white/10 text-white hover:bg-white/20'}><RefreshCw className={'h-4 w-4 '+(loading?'animate-spin':'')}/>تحديث القائمة</button>
      </div>
    </header>
    {notice&&<div role="status" className={'rounded-xl border p-3 text-sm '+(notice.type==='error'?'border-rose-200 bg-rose-50 text-rose-800':'border-emerald-200 bg-emerald-50 text-emerald-800')}>{notice.text}</div>}
    <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <section className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex gap-2"><div className="relative flex-1"><Search className="absolute right-3 top-3 h-4 w-4 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} className={inputClass+' pr-9'} placeholder="ابحث بالاسم أو الكود أو التصنيف"/></div><span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black">{filtered.length}</span></div>
        {loading&&<div className="flex items-center justify-center gap-2 p-6 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>تحميل الأنشطة…</div>}
        {!loading&&filtered.length===0&&<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">لا توجد أنشطة مطابقة.</p>}
        {filtered.map(activity=><button key={activity.id} onClick={()=>{setSelectedId(activity.id);setDraft(null);}} className={'w-full rounded-2xl border p-4 text-right transition '+(selected?.id===activity.id?'border-indigo-300 bg-indigo-50':'border-slate-100 hover:bg-slate-50')}>
          <div className="flex items-start justify-between gap-2"><div className="flex items-center gap-2"><Store className="h-5 w-5 text-indigo-700"/><span className="font-black text-slate-900">{activity.name}</span></div><span className={'rounded-lg px-2 py-1 text-[10px] font-black '+(activity.status==='ACTIVE'?'bg-emerald-100 text-emerald-800':activity.status==='SUSPENDED'?'bg-rose-100 text-rose-800':'bg-slate-100 text-slate-600')}>{activity.status==='ACTIVE'?'نشط':activity.status==='SUSPENDED'?'موقوف':'غير نشط'}</span></div>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500"><span>{activity.code}</span><span>•</span><span>{activity.category||'بدون تصنيف'}</span><span>•</span><span>{activity.published?'منشور':'غير منشور'}</span></div>
        </button>)}
      </section>
      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        {!selected?<p className="text-sm text-slate-500">اختر نشاطًا من القائمة.</p>:draft?<>
          <div className="flex items-center justify-between"><h4 className="text-lg font-black">تعديل بيانات النشاط</h4><button onClick={()=>setDraft(null)} className={btnClass+' border border-slate-200 text-slate-600'}><X className="h-4 w-4"/>إلغاء</button></div>
          <label className="block text-xs font-bold text-slate-600">اسم النشاط<input maxLength={200} value={draft.name} onChange={e=>setField('name',e.target.value)} className={inputClass+' mt-1'}/></label>
          <label className="block text-xs font-bold text-slate-600">التصنيف<input maxLength={100} value={draft.category} onChange={e=>setField('category',e.target.value)} className={inputClass+' mt-1'}/></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="block text-xs font-bold text-slate-600">الهاتف / واتساب<input maxLength={40} value={draft.phone} onChange={e=>setField('phone',e.target.value)} className={inputClass+' mt-1'}/></label><label className="block text-xs font-bold text-slate-600">المحافظة<input maxLength={100} value={draft.governorate} onChange={e=>setField('governorate',e.target.value)} className={inputClass+' mt-1'}/></label><label className="block text-xs font-bold text-slate-600">المركز<input maxLength={100} value={draft.markaz} onChange={e=>setField('markaz',e.target.value)} className={inputClass+' mt-1'}/></label><label className="block text-xs font-bold text-slate-600">القرية / المنطقة<input maxLength={100} value={draft.village} onChange={e=>setField('village',e.target.value)} className={inputClass+' mt-1'}/></label></div>
          <label className="block text-xs font-bold text-slate-600">العنوان<textarea maxLength={500} value={draft.address} onChange={e=>setField('address',e.target.value)} className={inputClass+' mt-1'} rows={2}/></label>
          <label className="block text-xs font-bold text-slate-600">نبذة النشاط<textarea maxLength={3000} value={draft.bio} onChange={e=>setField('bio',e.target.value)} className={inputClass+' mt-1'} rows={3}/></label>
          <label className="block text-xs font-bold text-slate-600">مواعيد العمل<input maxLength={300} value={draft.workingHours} onChange={e=>setField('workingHours',e.target.value)} className={inputClass+' mt-1'}/></label>
          <label className="block text-xs font-bold text-slate-600">رابط الشعار<input maxLength={1500} type="url" value={draft.logoUrl} onChange={e=>setField('logoUrl',e.target.value)} className={inputClass+' mt-1'} placeholder="https://…"/></label>
          <label className="block text-xs font-bold text-slate-600">رابط صورة الغلاف<input maxLength={1500} type="url" value={draft.coverUrl} onChange={e=>setField('coverUrl',e.target.value)} className={inputClass+' mt-1'} placeholder="https://…"/></label>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 text-sm font-bold"><input type="checkbox" checked={draft.published} onChange={e=>setField('published',e.target.checked)}/>نشر كتالوج النشاط للعامة</label>
          <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">النشر لا يتجاوز بوابة التفعيل أو الاشتراك. إذا كان النشاط غير نشط أو اشتراكه غير مؤكد، سترفض الخوادم النشر.</p>
          <button onClick={()=>void save()} disabled={saving} className={btnClass+' bg-indigo-700 text-white hover:bg-indigo-800'}><Check className="h-4 w-4"/>{saving?'جار الحفظ…':'حفظ التعديلات'}</button>
        </>:<>
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="text-xl font-black text-slate-900">{selected.name}</h4><p className="mt-1 text-xs text-slate-500">{selected.code} · {selected.category||'بدون تصنيف'}</p></div><button onClick={()=>edit(selected)} className={btnClass+' border border-slate-200 text-slate-700'}><Pencil className="h-4 w-4"/>تعديل كل البيانات</button></div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">حالة النشاط</div><div className="mt-1 font-black">{selected.status==='ACTIVE'?'نشط':selected.status==='SUSPENDED'?'موقوف':'غير نشط'}</div></div><div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">الاشتراك</div><div className="mt-1 font-black">{selected.paymentStatus||'غير محدد'}</div></div><div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">نشر الكتالوج</div><div className="mt-1 font-black">{selected.published?'منشور':'غير منشور'}</div></div><div className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">المدينة / المنطقة</div><div className="mt-1 font-black">{[selected.governorate,selected.markaz,selected.village].filter(Boolean).join(' / ')||'غير محدد'}</div></div></div>
          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            <button onClick={()=>openCatalog(selected)} className={btnClass+' bg-slate-900 text-white'}><ExternalLink className="h-4 w-4"/>إدارة المنتجات والخدمات</button>
            {selected.status==='SUSPENDED'?<button disabled={saving} onClick={()=>void setStatus(selected,'ACTIVE')} className={btnClass+' bg-emerald-700 text-white'}><Check className="h-4 w-4"/>إعادة التنشيط</button>:<button disabled={saving} onClick={()=>void setStatus(selected,'SUSPENDED')} className={btnClass+' bg-rose-700 text-white'}><AlertTriangle className="h-4 w-4"/>إيقاف النشاط</button>}
            {selected.status==='ACTIVE'&&<button disabled={saving} onClick={()=>void setStatus(selected,'INACTIVE')} className={btnClass+' border border-amber-300 text-amber-800'}>إلغاء التنشيط</button>}
          </div>
        </>}
      </section>
    </div>
  </div>;
};
