import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search, Save, PauseCircle, RotateCcw, Users, Store } from 'lucide-react';
import { supabase } from '../../lib/production';

type Membership = { id:string; user_id:string; role:string; status:string; email:string; full_name:string };
type BusinessRow = { id:string; tenant_id:string; name:string; code:string; status:string; settings:any; memberships:Membership[] };
const inputClass='w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500';
const buttonClass='inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-50';

export const BusinessSubscriberAdmin: React.FC = () => {
  const [rows,setRows]=useState<BusinessRow[]>([]);
  const [search,setSearch]=useState('');
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState('');
  const [notice,setNotice]=useState<{error:boolean;text:string}|null>(null);
  const [names,setNames]=useState<Record<string,string>>({});
  const load=useCallback(async()=>{
    setLoading(true);setNotice(null);
    const {data,error}=await supabase.rpc('mnty_platform_admin_list_businesses',{p_search:search.trim()||null});
    setLoading(false);
    if(error){setNotice({error:true,text:error.message||'تعذر تحميل الأنشطة والمشتركين. تحقق من نشر RC116 في بيئة الاختبار.'});return;}
    const next=Array.isArray(data)?data as BusinessRow[]:[];
    setRows(next);setNames(Object.fromEntries(next.map((b)=>[b.id,b.name||''])));
  },[search]);
  useEffect(()=>{void load();},[]);
  const manageBusiness=async(b:BusinessRow,action:'UPDATE'|'DEACTIVATE'|'RESTORE')=>{
    if(action!=='UPDATE'&&!window.confirm(action==='DEACTIVATE'?'سيتم إيقاف ظهور النشاط ومنع استخدامه عبر الشاشات التي تتحقق من حالة النشاط. ستظل السجلات التاريخية محفوظة. متابعة؟':'إعادة تنشيط النشاط؟'))return;
    setSaving(b.id);setNotice(null);
    const {error}=await supabase.rpc('mnty_platform_admin_manage_business',{
      p_business_id:b.id,p_name:names[b.id]||b.name,p_settings:null,p_action:action
    });
    setSaving('');
    if(error){setNotice({error:true,text:error.message||'تعذر حفظ النشاط.'});return;}
    setNotice({error:false,text:action==='UPDATE'?'تم تحديث بيانات النشاط.':action==='DEACTIVATE'?'تم إيقاف النشاط مع الاحتفاظ بسجلاته.':'تمت إعادة تنشيط النشاط.'});
    await load();
  };
  const manageMembership=async(m:Membership,action:'SUSPEND'|'RESTORE'|'CHANGE_ROLE')=>{
    let role:string|undefined;
    if(action==='CHANGE_ROLE'){
      role=window.prompt('اكتب الدور الجديد للمشترك (مثال: CUSTOMER أو OWNER أو EMPLOYEE)',m.role);
      if(!role)return;
      if(!window.confirm('تأكيد تغيير الدور؟ سيتم تسجيل العملية في سجل التدقيق.'))return;
    } else if(!window.confirm(action==='SUSPEND'?'تعليق عضوية هذا المشترك؟':'إعادة تفعيل عضوية هذا المشترك؟'))return;
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
    {rows.map(b=><article key={b.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2"><Store className="h-5 w-5 text-indigo-700"/><div><h3 className="font-black text-slate-900">{b.name}</h3><p className="font-mono text-[11px] text-slate-500">{b.code||b.id} · {b.tenant_id}</p></div></div>
        <span className={'rounded-lg px-2 py-1 text-xs font-bold '+(b.status==='ACTIVE'?'bg-emerald-50 text-emerald-800':'bg-slate-100 text-slate-600')}>{b.status}</span>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input value={names[b.id]??b.name} onChange={e=>setNames(v=>({...v,[b.id]:e.target.value}))} maxLength={160} className={inputClass} aria-label="اسم النشاط"/>
        <button type="button" disabled={!!saving} onClick={()=>void manageBusiness(b,'UPDATE')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Save className="h-4 w-4"/>حفظ التعديل</button>
        {b.status==='ACTIVE'?<button type="button" disabled={!!saving} onClick={()=>void manageBusiness(b,'DEACTIVATE')} className={buttonClass}><PauseCircle className="h-4 w-4"/>إيقاف النشاط</button>:<button type="button" disabled={!!saving} onClick={()=>void manageBusiness(b,'RESTORE')} className={buttonClass}><RotateCcw className="h-4 w-4"/>إعادة تنشيط</button>}
      </div>
      <div className="border-t border-slate-100 pt-3">
        <h4 className="mb-3 flex items-center gap-2 text-sm font-black text-slate-800"><Users className="h-4 w-4"/>المشتركون والعضويات ({b.memberships?.length||0})</h4>
        {!b.memberships?.length&&<p className="text-xs text-slate-500">لا توجد عضويات مرتبطة بهذا النشاط.</p>}
        <div className="space-y-2">{(b.memberships||[]).map(m=><div key={m.id} className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div><div className="text-sm font-bold text-slate-800">{m.full_name||m.email||m.user_id}</div><div className="text-xs text-slate-500">{m.email} · {m.role} · {m.status}</div></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!!saving} onClick={()=>void manageMembership(m,'CHANGE_ROLE')} className={buttonClass}>تعديل الدور</button>
            {m.status==='ACTIVE'?<button type="button" disabled={!!saving} onClick={()=>void manageMembership(m,'SUSPEND')} className={buttonClass}>تعليق العضوية</button>:<button type="button" disabled={!!saving} onClick={()=>void manageMembership(m,'RESTORE')} className={buttonClass}><RotateCcw className="h-3.5 w-3.5"/>إعادة التفعيل</button>}
          </div>
        </div>)}</div>
      </div>
    </article>)}
  </section>;
};
