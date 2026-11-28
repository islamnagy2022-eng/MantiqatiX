import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Search, Save, PauseCircle, RotateCcw, Users, Store, PencilLine, X, Globe } from 'lucide-react';
import { supabase } from '../../lib/production';
import { resolveDefaultActivityImages } from '../../utils/defaultImages';

type Membership = { id:string; user_id:string; role:string; status:string; email:string; full_name:string; branch_id?:string|null; is_platform_account?:boolean };
const membershipRoleOptions = [
  { value: 'CUSTOMER', label: 'عميل' },
  { value: 'OWNER', label: 'مالك' },
  { value: 'BUSINESS_OWNER', label: 'مالك النشاط' },
  { value: 'ADMIN', label: 'مدير' },
  { value: 'MANAGER', label: 'مدير تشغيلي' },
  { value: 'FINANCE', label: 'مسؤول مالية' },
  { value: 'SALES', label: 'مسؤول مبيعات' },
  { value: 'MARKETING', label: 'مسؤول تسويق' },
  { value: 'SUPPORT', label: 'دعم فني' },
  { value: 'SUPPORT_MANAGER', label: 'مشرف الدعم' },
  { value: 'EMPLOYEE', label: 'موظف' },
  { value: 'STAFF', label: 'فريق العمل' },
  { value: 'SERVICE_PROVIDER', label: 'مقدم خدمة' },
  { value: 'PROVIDER_OWNER', label: 'مالك مقدم الخدمة' },
  { value: 'PROVIDER_ADMIN', label: 'مدير مقدم الخدمة' },
  { value: 'BRANCH_MANAGER', label: 'مدير فرع' },
  { value: 'PROVIDER_FINANCE', label: 'مسؤول مالية مقدم الخدمة' },
  { value: 'PROVIDER_MARKETING', label: 'مسؤول تسويق مقدم الخدمة' },
  { value: 'PROVIDER_OPERATIONS', label: 'مشرف عمليات مقدم الخدمة' },
  { value: 'PROVIDER_SUPPORT', label: 'دعم مقدمي الخدمة' },
] as const;
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
  const [roleEdit,setRoleEdit]=useState<{membership:Membership;role:string}|null>(null);
  const load=useCallback(async()=>{
    setLoading(true);setNotice(null);
    const {data,error}=await supabase.functions.invoke('catalog-platform-admin',{body:{action:'LIST_BUSINESSES',search:search.trim()}});
    setLoading(false);
    if(error||!Array.isArray(data?.businesses)){setNotice({error:true,text:data?.message||error?.message||'تعذر تحميل الأنشطة والمشتركين. تحقق من صلاحيات مالك المنصة.'});return;}
    const next=data.businesses as BusinessRow[];
    setRows(next);
    setDrafts(Object.fromEntries(next.map((b)=>[b.id,draftFor(b)])));
  },[search]);
  useEffect(()=>{void load();},[]);
  const manageBusiness=async(b:BusinessRow,action:'UPDATE'|'DEACTIVATE'|'RESTORE')=>{
    if(action!=='UPDATE'&&!window.confirm(action==='DEACTIVATE'?'سيتم إيقاف ظهور النشاط ومنع استخدامه عبر الشاشات التي تتحقق من حالة النشاط. ستظل السجلات التاريخية محفوظة. متابعة؟':'إعادة تنشيط النشاط؟'))return;
    const draft=drafts[b.id]||draftFor(b);
    const profile=b.settings?.catalog_profile||{};
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
        logo_url:draft.logoSource==='auto'?(profile.logo_url||undefined):draft.logoUrl,
        cover_url:draft.coverSource==='auto'?(profile.cover_url||undefined):draft.coverUrl,
        logo_image_source:draft.logoSource,
        cover_image_source:draft.coverSource,
      },
    }:null;
    setSaving(b.id);setNotice(null);
    const {data,error}=await supabase.functions.invoke('catalog-platform-admin',{body:{
      action:'BUSINESS_MANAGE',tenantId:b.tenant_id,businessId:b.id,operation:action,name:draft.name,settings
    }});
    setSaving('');
    if(error||!data?.success){setNotice({error:true,text:data?.message||error?.message||data?.error||'تعذر حفظ النشاط.'});return;}
    setNotice({error:false,text:action==='UPDATE'?'تم تحديث بيانات النشاط وتصنيفاته وصوره.':action==='DEACTIVATE'?'تم إيقاف النشاط مع الاحتفاظ بسجلاته.':'تمت إعادة تنشيط النشاط.'});
    if(action==='UPDATE')setEditingId(null);
    await load();
  };
  const updateDraft=(id:string,key:keyof BusinessDraft,value:string)=>{
    const row=rows.find(x=>x.id===id);
    if(!row)return;
    setDrafts(prev=>({...prev,[id]:{...(prev[id]||draftFor(row)),[key]:value}}));
  };
  const managePublication=async(b:BusinessRow)=>{
    const published=b.settings?.catalog_public_enabled===true||String(b.settings?.bizcatalog?.publicationStatus||'').toUpperCase()==='PUBLISHED';
    const decision=published?'REJECT':'APPROVE';
    const prompt=published?'إلغاء نشر النشاط وإيقافه عن الظهور العام؟':'نشر النشاط وتفعيله للعامة؟ يجب أن يكون له مالك نشط وأن تكون متطلبات التفعيل مستوفاة.';
    if(!window.confirm(prompt))return;
    setSaving(b.id);setNotice(null);
    const {data,error}=await supabase.functions.invoke('catalog-platform-admin',{body:{
      action:'BUSINESS_PUBLICATION_REVIEW',tenantId:b.tenant_id,businessId:b.id,
      decision,reason:published?'تم إلغاء النشر من إدارة المنصة':''
    }});
    setSaving('');
    if(error||!data?.success){setNotice({error:true,text:data?.message||error?.message||data?.error||'تعذر تحديث حالة النشر.'});return;}
    setNotice({error:false,text:published?'تم إلغاء النشر وإيقاف النشاط.':'تم نشر النشاط وتفعيله.'});
    await load();
  };
  const manageMembership=async(m:Membership,action:'SUSPEND'|'RESTORE'|'CHANGE_ROLE',nextRole?:string)=>{
    let role:string|undefined;
    if(action==='CHANGE_ROLE'){
      role=String(nextRole||'').trim().toUpperCase();
      const allowedRoles=membershipRoleOptions.map((option)=>option.value as string);
      if(!allowedRoles.includes(role)){setNotice({error:true,text:'اختر دورًا من القائمة المعتمدة.'});return;}
      if(role===String(m.role||'').toUpperCase()){setNotice({error:true,text:'الدور المختار مطابق للدور الحالي.'});return;}
      if(!window.confirm(`تأكيد تغيير دور ${m.full_name||m.email} من ${m.role} إلى ${role}؟ سيتم الحفاظ على نطاق الفرع وتسجيل العملية.`))return;
    } else if(!window.confirm(action==='SUSPEND'?'إنهاء عضوية هذا المشترك مع الاحتفاظ بسجلاته؟':'إعادة تفعيل عضوية هذا المشترك؟'))return;
    const parent=rows.find((row)=>row.memberships?.some((membership)=>membership.id===m.id));
    if(!parent){setNotice({error:true,text:'تعذر تحديد النشاط المرتبط بهذه العضوية.'});return;}
    setSaving(m.id);setNotice(null);
    let data:any=null; let error:any=null;
    if(action==='CHANGE_ROLE'){
      const result=await supabase.functions.invoke('catalog-platform-admin',{body:{
        action:'SAVE_MEMBERSHIP',tenantId:parent.tenant_id,businessId:parent.id,branchId:m.branch_id||'',
        membershipId:m.id,userId:m.user_id,role,status:['ACTIVE','INACTIVE','SUSPENDED'].includes(String(m.status||'').toUpperCase())?String(m.status).toUpperCase():'INACTIVE'
      }});
      data=result.data;error=result.error;
    }else{
      const result=await supabase.functions.invoke('catalog-platform-admin',{body:{
        action:'SUBSCRIBER_STATUS',membershipId:m.id,status:action==='SUSPEND'?'SUSPENDED':'ACTIVE'
      }});
      data=result.data;error=result.error;
    }
    setSaving('');
    if(error||data?.error){setNotice({error:true,text:data?.message||error?.message||data?.error||'تعذر تعديل العضوية.'});return;}
    setNotice({error:false,text:action==='SUSPEND'?'تم تعليق العضوية.':action==='RESTORE'?'تمت إعادة تفعيل العضوية.':'تم تغيير دور العضوية مع الحفاظ على نطاق النشاط والفرع.'});
    if(action==='CHANGE_ROLE')setRoleEdit(null);
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
          <img src={logo} alt={b.name} loading="lazy" className="h-16 w-16 shrink-0 rounded-xl border border-slate-200 object-cover" onError={e=>{const image=e.currentTarget;if(image.dataset.fallbackApplied!=='true'){image.dataset.fallbackApplied='true';image.src=images.logoUrl;}else{image.onerror=null;image.style.visibility='hidden';}}}/>
          <div className="min-w-0"><h3 className="font-black text-slate-900">{b.name}</h3><p className="text-xs text-slate-600">{d.category}</p><p className="font-mono text-[11px] text-slate-500">{b.code||b.id} · {b.tenant_id}</p></div>
        </div>
        <span className={'rounded-lg px-2 py-1 text-xs font-bold '+(b.status==='ACTIVE'?'bg-emerald-50 text-emerald-800':'bg-slate-100 text-slate-600')}>{b.status==='ACTIVE'?'نشط':'متوقف'}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!!saving} onClick={()=>setEditingId(editingId===b.id?null:b.id)} className={buttonClass}><PencilLine className="h-4 w-4"/>{editingId===b.id?'إغلاق التعديل':'تعديل النشاط'}</button>
        {b.status==='ACTIVE'?<button type="button" disabled={!!saving} onClick={()=>void manageBusiness(b,'DEACTIVATE')} className={buttonClass}><PauseCircle className="h-4 w-4"/>إيقاف النشاط</button>:<button type="button" disabled={!!saving} onClick={()=>void manageBusiness(b,'RESTORE')} className={buttonClass}><RotateCcw className="h-4 w-4"/>تفعيل النشاط</button>}
        <button type="button" disabled={!!saving} onClick={()=>void managePublication(b)} className={buttonClass}><Globe className="h-4 w-4"/>{(b.settings?.catalog_public_enabled===true||String(b.settings?.bizcatalog?.publicationStatus||'').toUpperCase()==='PUBLISHED')?'إلغاء النشر':'نشر النشاط'}</button>
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
            <img src={logo} alt="معاينة صورة النشاط" loading="lazy" className="h-32 w-full rounded-lg object-cover" onError={e=>{const image=e.currentTarget;if(image.dataset.fallbackApplied!=='true'){image.dataset.fallbackApplied='true';image.src=images.logoUrl;}else{image.onerror=null;image.style.visibility='hidden';}}}/>
            <input value={d.logoUrl} onChange={e=>setDrafts(prev=>({...prev,[b.id]:{...d,logoUrl:e.target.value,logoSource:'owner'}}))} className={inputClass} placeholder="رابط الصورة أو اتركها تلقائية"/>
            <p className="text-[11px] text-slate-500">{d.logoSource==='auto'?'تتغير تلقائياً حسب الاسم والتصنيف':'صورة مخصصة من الإدارة'}</p>
          </div>
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700"><span>صورة الغلاف</span><button type="button" onClick={()=>setDrafts(prev=>({...prev,[b.id]:{...d,coverSource:'auto'}}))} className="text-indigo-700 underline">غلاف تلقائي</button></div>
            <img src={cover} alt="معاينة غلاف النشاط" loading="lazy" className="h-32 w-full rounded-lg object-cover" onError={e=>{const image=e.currentTarget;if(image.dataset.fallbackApplied!=='true'){image.dataset.fallbackApplied='true';image.src=images.coverUrl;}else{image.onerror=null;image.style.visibility='hidden';}}}/>
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
          <div><div className="text-sm font-bold text-slate-800">{m.full_name||m.email||m.user_id}</div><div className="text-xs text-slate-500">{m.email} · {m.role} · {m.status}{m.branch_id?' · نطاق فرع':''}</div></div>
          <div className="flex flex-wrap gap-2">
            {m.is_platform_account?<span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">حساب منصة محمي · غير قابل للتعديل هنا</span>:<>
              <button type="button" disabled={!!saving} onClick={()=>setRoleEdit({membership:m,role:membershipRoleOptions.some((option)=>option.value===String(m.role||'').toUpperCase())?String(m.role).toUpperCase():'CUSTOMER'})} className={buttonClass}>تعديل الدور</button>
              {m.status==='ACTIVE'?<button type="button" disabled={!!saving} onClick={()=>void manageMembership(m,'SUSPEND')} className={buttonClass}>إنهاء العضوية</button>:<button type="button" disabled={!!saving} onClick={()=>void manageMembership(m,'RESTORE')} className={buttonClass}><RotateCcw className="h-3.5 w-3.5"/>إعادة التفعيل</button>}
            </>}
          </div>
        </div>)}</div>
      </div>
    </article>})}
    {roleEdit&&<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <form role="dialog" aria-modal="true" aria-labelledby="membership-role-editor-title" onSubmit={(event)=>{event.preventDefault();void manageMembership(roleEdit.membership,'CHANGE_ROLE',roleEdit.role);}} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div><h3 id="membership-role-editor-title" className="text-lg font-black text-slate-900">تعديل دور العضوية</h3><p className="mt-1 text-xs leading-5 text-slate-500">{roleEdit.membership.full_name||roleEdit.membership.email} · {roleEdit.membership.email}</p></div>
          <button type="button" onClick={()=>setRoleEdit(null)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600">إغلاق</button>
        </div>
        <label className="block space-y-1 text-xs font-bold text-slate-700"><span>الدور الجديد</span><select autoFocus required value={roleEdit.role} onChange={(event)=>setRoleEdit({...roleEdit,role:event.target.value})} className={inputClass}>{membershipRoleOptions.map((option)=><option key={option.value} value={option.value}>{option.label} ({option.value})</option>)}</select></label>
        <div className="rounded-xl border border-sky-100 bg-sky-50 p-3 text-xs leading-5 text-sky-900">سيظل الإسناد داخل النشاط الحالي{roleEdit.membership.branch_id?` والفرع ${roleEdit.membership.branch_id}`:' وعلى مستوى النشاط بالكامل'}. لا يمكن منح صلاحية مالك المنصة من هذه الشاشة.</div>
        <div className="flex flex-wrap justify-end gap-2"><button type="button" onClick={()=>setRoleEdit(null)} className={buttonClass}>إلغاء</button><button type="submit" disabled={!!saving||roleEdit.role===String(roleEdit.membership.role||'').toUpperCase()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"><Save className="h-4 w-4"/>حفظ الدور</button></div>
      </form>
    </div>}
  </section>;
};
