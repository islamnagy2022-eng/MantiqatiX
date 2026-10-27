import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search, Save, PauseCircle, RotateCcw, Users, Store, PencilLine, X } from 'lucide-react';
import { supabase } from '../../lib/production';
import { resolveDefaultActivityImages } from '../../utils/defaultImages';

type Membership = { id:string; user_id:string; role:string; status:string; email:string; full_name:string };
type BusinessRow = { id:string; tenant_id:string; name:string; code:string; status:string; settings:any; memberships:Membership[] };
type BusinessDraft = { name:string; category:string; description:string; logoUrl:string; coverUrl:string; logoSource:'auto'|'owner'; coverSource:'auto'|'owner' };
const inputClass='w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500';
const buttonClass='inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-50';
const draftFor=(b:BusinessRow):BusinessDraft=>{
  const settings=b.settings||{};
  const profile=settings.catalog_profile||{};
  const category=String(profile.category||settings.headline||settings.category_code||settings.activity_code||'خدمات عامة');
  const description=String(profile.bio||settings.description||'');
  const defaults=resolveDefaultActivityImages({name:b.name,description,category});
  return {
    name:String(b.name||''),
    category,
    description,
    logoUrl:String(profile.logo_url||defaults.logoUrl),
    coverUrl:String(profile.cover_url||defaults.coverUrl),
    logoSource:profile.logo_image_source==='auto'||!profile.logo_url?'auto':'owner',
    coverSource:profile.cover_image_source==='auto'||!profile.cover_url?'auto':'owner',
  };
};

export const BusinessSubscriberAdmin: React.FC = () => {
  const [rows,setRows]=useState<BusinessRow[]>([]);
  const [drafts,setDrafts]=useState<Record<string,BusinessDraft>>({});
  const [editingId,setEditingId]=useState<string|null>(null);
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState('');
  const [notice,setNotice]=useState<{error:boolean;text:string}|null>(null);
  const load=useCallback(async()=>{
    setLoading(true);setNotice(null);
    const {data,error}=await supabase.rpc('mnty_platform_admin_list_businesses',{p_search:search.trim()||undefined});
    setLoading(false);
    if(error){setNotice({error:true,text:error.message||'تعذر تحميل الأنشطة والمشتركين. تحقق من نشر RC116 في بيئة الاختبار.'});return;}
    const next=Array.isArray(data)?data as BusinessRow[]:[];
    setRows(next);
    setDrafts(Object.fromEntries(next.map((b)=>[b.id,draftFor(b)])));
  },[search]);
  useEffect(()=>{void load();},[]);
  const manageBusiness=async(b:BusinessRow,action:'UPDATE'|'DEACTIVATE'|'RESTORE')=>{
    if(action!=='UPDATE'&&!window.confirm(action==='DEACTIVATE'?'سيتم إيقاف ظهور النشاط ومنع استخدامه عبر الشاشات التي تتحقق من حالة النشاط. ستظل السجلات التاريخية محفوظة. متابعة؟':'إعادة تنشيط النشاط؟'))return;
    const draft=drafts[b.id]||draftFor(b);
    const profile=b.settings?.catalog_profile||{};
    const defaults=resolveDefaultActivityImages({name:draft.name,description:draft.description,category:draft.category});
    const settings=action==='UPDATE'?{
      ...(b.settings||{}),
      display_name_ar:draft.name,
      headline:draft.category||b.settings?.headline||'',
      category_code:b.settings?.category_code||b.settings?.activity_code||'SERVICES',
      activity_code:b.settings?.activity_code||b.settings?.category_code||'SERVICES',
      catalog_profile:{
        ...profile,
        category:draft.category,
        bio:draft.description,
        logo_url:draft.logoSource==='auto'?defaults.logoUrl:draft.logoUrl,
        cover_url:draft.coverSource==='auto'?defaults.coverUrl:draft.coverUrl,
        logo_image_source:draft.logoSource,
        cover_image_source:draft.coverSource,
      },
    }:null;
    setSaving(b.id);setNotice(null);
    const {error}=await supabase.rpc('mnty_platform_admin_manage_business',{
      p_business_id:b.id,p_name:draft.name,p_settings:settings,p_action:action
    });
    setSaving('');
    if(error){setNotice({error:true,text:error.message||'تعذر حفظ النشاط.'});return;}
    setNotice({error:false,text:action==='UPDATE'?'تم تحديث بيانات النشاط وتصنيفاته وصوره.':action==='DEACTIVATE'?'تم إيقاف النشاط مع الاحتفاظ بسجلاته.':'تمت إعادة تنشيط النشاط.'});
    if(action==='UPDATE')setEditingId(null);
    await load();
  };
  const updateDraft=(id:string,key:keyof BusinessDraft,value:string)=>{
    const row=rows.find(x=>x.id===id);
    if(!row)return;
    setDrafts(prev=>({...prev,[id]:{...(prev[id]||draftFor(row)),[key]:value}}));
  };
  const manageMembership=async(m:Membership,action:'SUSPEND'|'RESTORE'|'CHANGE_ROLE')=>{
    let role:string|undefined;
    if(action==='CHANGE_ROLE'){
      const requestedRole=window.prompt('اكتب الدور الجديد للمشترك (مثال: CUSTOMER أو OWNER أو EMPLOYEE)',m.role);
      if(requestedRole===null||!requestedRole.trim())return;
      role=requestedRole.trim();
      if(!window.confirm('تأكيد تغيير الدور؟ سيتم تسجيل العملية في سجل التدقيق.'))return;
    } else if(!window.confirm(action==='SUSPEND'?'إنهاء عضوية هذا المشترك مع الاحتفاظ بسجلاته؟':'إعادة تفعيل عضوية هذا المشترك؟'))return;
    setSaving(m.id);setNotice(null);
    const {error}=await supabase.rpc('mnty_platform_admin_manage_membership',{
      p_membership_id:m.id,p_action:action,p_role:role||null
    });
    setSaving('');
    if(error){setNotice({error:true,text:error.message||'تعذر تعديل العضوية.'});return;}
    setNotice({error:false,text:action==='SUSPEND'?'تم تعليق العضوية.':action==='RESTORE'?'تمت إعادة تفعيل العضوية.':'تم تغيير دور العضوية.'});
    await load();
  };
  return <section dir="rtl" className="space-y-4">
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();void load();}}} className={inputClass} placeholder="ابحث باسم النشاط أو الكود"/>
        <button type="button" onClick={()=>void load()} disabled={loading} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Search className="h-4 w-4"/>بحث</button>
        <button type="button" onClick={()=>void load()} disabled={loading} className={buttonClass}><RefreshCw className={'h-4 w-4 '+(loading?'animate-spin':'')}/>تحديث</button>
      </div>
    </div>
    {notice&&<div role="status" className={'rounded-xl border p-3 text-sm '+(notice.error?'border-rose-200 bg-rose-50 text-rose-800':'border-emerald-200 bg-emerald-50 text-emerald-800')}>{notice.text}</div>}
    {rows.length===0&&!loading&&<div className="rounded-2xl bg-white p-6 text-sm text-slate-500">لا توجد نتائج مطابقة.</div>}
    {rows.map(b=>{
      const d=drafts[b.id]||draftFor(b);
      const images=resolveDefaultActivityImages({name:d.name,description:d.description,category:d.category});
      const logo=d.logoSource==='auto'?images.logoUrl:d.logoUrl;
      const cover=d.coverSource==='auto'?images.coverUrl:d.coverUrl;
      return <article key={b.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <img src={logo} alt={b.name} className="h-16 w-16 shrink-0 rounded-xl border border-slate-200 object-cover" onError={e=>{(e.currentTarget as HTMLImageElement).src=resolveDefaultActivityImages({name:b.name,category:d.category}).logoUrl;}}/>
          <div className="min-w-0"><h3 className="font-black text-slate-900">{b.name}</h3><p className="text-xs text-slate-600">{d.category}</p><p className="font-mono text-[11px] text-slate-500">{b.code||b.id} · {b.tenant_id}</p></div>
        </div>
        <span className={'rounded-lg px-2 py-1 text-xs font-bold '+(b.status==='ACTIVE'?'bg-emerald-50 text-emerald-800':'bg-slate-100 text-slate-600')}>{b.status==='ACTIVE'?'نشط':'متوقف'}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!!saving} onClick={()=>setEditingId(editingId===b.id?null:b.id)} className={buttonClass}><PencilLine className="h-4 w-4"/>{editingId===b.id?'إغلاق التعديل':'تعديل النشاط'}</button>
        {b.status==='ACTIVE'?<button type="button" disabled={!!saving} onClick={()=>void manageBusiness(b,'DEACTIVATE')} className={buttonClass}><PauseCircle className="h-4 w-4"/>إيقاف النشاط</button>:<button type="button" disabled={!!saving} onClick={()=>void manageBusiness(b,'RESTORE')} className={buttonClass}><RotateCcw className="h-4 w-4"/>تفعيل النشاط</button>}
      </div>
      {editingId===b.id&&<div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-xs font-bold text-slate-700"><span>اسم النشاط</span><input value={d.name} onChange={e=>updateDraft(b.id,'name',e.target.value)} maxLength={160} className={inputClass}/></label>
          <label className="space-y-1 text-xs font-bold text-slate-700"><span>تصنيف النشاط</span><input value={d.category} onChange={e=>updateDraft(b.id,'category',e.target.value)} maxLength={100} className={inputClass}/></label>
        </div>
        <label className="block space-y-1 text-xs font-bold text-slate-700"><span>وصف النشاط</span><textarea value={d.description} onChange={e=>updateDraft(b.id,'description',e.target.value)} maxLength={1500} rows={3} className={inputClass}/></label>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700"><span>صورة النشاط</span><button type="button" onClick={()=>setDrafts(prev=>({...prev,[b.id]:{...d,logoSource:'auto'}}))} className="text-indigo-700 underline">صورة تلقائية</button></div>
            <img src={logo} alt="معاينة صورة النشاط" className="h-32 w-full rounded-lg object-cover"/>
            <input value={d.logoUrl} onChange={e=>setDrafts(prev=>({...prev,[b.id]:{...d,logoUrl:e.target.value,logoSource:'owner'}}))} className={inputClass} placeholder="رابط الصورة أو اتركها تلقائية"/>
            <p className="text-[11px] text-slate-500">{d.logoSource==='auto'?'تتغير تلقائياً حسب الاسم والتصنيف':'صورة مخصصة من الإدارة'}</p>
          </div>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700"><span>صورة الغلاف</span><button type="button" onClick={()=>setDrafts(prev=>({...prev,[b.id]:{...d,coverSource:'auto'}}))} className="text-indigo-700 underline">غلاف تلقائي</button></div>
            <img src={cover} alt="معاينة غلاف النشاط" className="h-32 w-full rounded-lg object-cover"/>
            <input value={d.coverUrl} onChange={e=>setDrafts(prev=>({...prev,[b.id]:{...d,coverUrl:e.target.value,coverSource:'owner'}}))} className={inputClass} placeholder="رابط الغلاف أو اتركه تلقائياً"/>
            <p className="text-[11px] text-slate-500">{d.coverSource==='auto'?'يتغير تلقائياً حسب الاسم والتصنيف':'غلاف مخصص من الإدارة'}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={!!saving||!d.name.trim()} onClick={()=>void manageBusiness(b,'UPDATE')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Save className="h-4 w-4"/>حفظ التعديلات</button>
          <button type="button" disabled={!!saving} onClick={()=>{setDrafts(prev=>({...prev,[b.id]:draftFor(b)}));setEditingId(null);}} className={buttonClass}><X className="h-4 w-4"/>إلغاء</button>
        </div>
      </div>}
      <div className="border-t border-slate-100 pt-3">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800"><Users className="h-4 w-4"/>المشتركون والعضويات ({b.memberships?.length||0})</h4>
        {!b.memberships?.length&&<p className="text-xs text-slate-500">لا توجد عضويات مرتبطة بهذا النشاط.</p>}
        <div className="space-y-2">{(b.memberships||[]).map(m=><div key={m.id} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="text-sm font-bold text-slate-800">{m.full_name||m.email||m.user_id}</div><div className="text-xs text-slate-500">{m.email} · {m.role} · {m.status}</div></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!!saving} onClick={()=>void manageMembership(m,'CHANGE_ROLE')} className={buttonClass}>تعديل الدور</button>
            {m.status==='ACTIVE'?<button type="button" disabled={!!saving} onClick={()=>void manageMembership(m,'SUSPEND')} className={buttonClass}>إنهاء العضوية</button>:<button type="button" disabled={!!saving} onClick={()=>void manageMembership(m,'RESTORE')} className={buttonClass}><RotateCcw className="h-3.5 w-3.5"/>إعادة التفعيل</button>}
          </div>
        </div>)}</div>
      </div>
    </article>})}
  </section>;
};
