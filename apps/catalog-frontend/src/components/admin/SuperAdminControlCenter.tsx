import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BadgeCheck, Check, ClipboardList, KeyRound, Plus, RefreshCw, Save, Search, ShieldCheck, UserCog, Users, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/production';
import { BusinessEmployeeManager } from '../merchant/BusinessEmployeeManager';

type Scope = 'TENANT'|'BUSINESS'|'BRANCH'|'PROVIDER';
type CustomRole = {
  id: string; role_key: string; display_name: string; description: string; scope: Scope;
  permissions: { modules?: Record<string,string[]> }; is_system: boolean; is_active: boolean;
};
type PlatformPerson = {
  id: string; email: string; full_name: string; phone: string; email_confirmed: boolean;
  created_at: string; last_sign_in_at?: string; memberships?: any[];
};
type Assignment = {
  id: string; user_id: string; email: string; full_name: string; role_id: string; role_key: string;
  role_name: string; scope: Scope; tenant_id?: string; business_id?: string; branch_id?: string; is_active: boolean;
};
type AuditRow = {
  id?: string; actor_user_id?: string; actor_email?: string; action?: string; entity_type?: string;
  entity_id?: string; tenant_id?: string; old_values?: any; new_values?: any; result?: string; created_at?: string;
};
const modules = [
  { key:'HOME',label:'لوحة التحكم' },{ key:'PEOPLE',label:'الأشخاص' },{ key:'BUSINESSES',label:'الأنشطة' },
  { key:'SUBSCRIPTIONS',label:'الاشتراكات' },{ key:'CATALOG',label:'المنتجات والكتالوج' },
  { key:'ORDERS',label:'الطلبات' },{ key:'FINANCE',label:'المالية' },{ key:'MODULES',label:'الشاشات والوحدات' },
  { key:'EMPLOYEES',label:'الموظفون والتوظيف' },{ key:'AUDIT',label:'سجل العمليات' },{ key:'SETTINGS',label:'الإعدادات' },
];
const actions = [
  { key:'view',label:'عرض' },{ key:'create',label:'إضافة' },{ key:'update',label:'تعديل' },
  { key:'delete',label:'حذف' },{ key:'suspend',label:'تعليق' },{ key:'restore',label:'استعادة' },
  { key:'manage',label:'إدارة' },{ key:'export',label:'تصدير' },
];
const inputClass='w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500';
const primaryClass='inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50';

export const SuperAdminControlCenter: React.FC = () => {
  const { businesses, currentBusiness, setSelectedBusinessId } = useApp();
  const [tab,setTab]=useState<'roles'|'assignments'|'employees'|'audit'>('roles');
  const [roles,setRoles]=useState<CustomRole[]>([]);
  const [people,setPeople]=useState<PlatformPerson[]>([]);
  const [assignments,setAssignments]=useState<Assignment[]>([]);
  const [auditRows,setAuditRows]=useState<AuditRow[]>([]);
  const [loading,setLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState<{type:'success'|'error';text:string}|null>(null);
  const [personSearch,setPersonSearch]=useState('');
  const [selectedPersonId,setSelectedPersonId]=useState('');
  const [roleId,setRoleId]=useState('');
  const [assignmentBusinessId,setAssignmentBusinessId]=useState(currentBusiness?.id||businesses[0]?.id||'');
  const [branchId,setBranchId]=useState('');
  const [roleEditId,setRoleEditId]=useState('');
  const [roleKey,setRoleKey]=useState('');
  const [roleName,setRoleName]=useState('');
  const [roleDescription,setRoleDescription]=useState('');
  const [roleScope,setRoleScope]=useState<Scope>('BUSINESS');
  const [roleActive,setRoleActive]=useState(true);
  const [permissionMap,setPermissionMap]=useState<Record<string,string[]>>({HOME:['view']});
  const [auditSearch,setAuditSearch]=useState('');

  const selectedRole=useMemo(()=>roles.find((r)=>r.id===roleId),[roles,roleId]);
  const selectedBusiness=useMemo(()=>businesses.find((b)=>b.id===assignmentBusinessId)||businesses[0],[businesses,assignmentBusinessId]);

  const loadAll=useCallback(async()=>{
    setLoading(true); setNotice(null);
    const [rolesResult,peopleResult,assignmentsResult]=await Promise.all([
      supabase.rpc('mnty_platform_admin_list_custom_roles'),
      supabase.rpc('mnty_platform_admin_list_people',{p_search:personSearch.trim()||null}),
      supabase.rpc('mnty_platform_admin_list_role_assignments'),
    ]);
    setLoading(false);
    const firstError=rolesResult.error||peopleResult.error||assignmentsResult.error;
    if(firstError){
      setNotice({type:'error',text:'تعذر تحميل مركز التحكم. تأكد من نشر ترحيل RC115 على بيئة الاختبار أولًا، وأن الحساب مسجل في private.platform_admins.'});
      return;
    }
    setRoles(Array.isArray(rolesResult.data)?rolesResult.data:[]);
    setPeople(Array.isArray(peopleResult.data)?peopleResult.data:[]);
    setAssignments(Array.isArray(assignmentsResult.data)?assignmentsResult.data:[]);
    setRoleId((current)=>current||(Array.isArray(rolesResult.data)?rolesResult.data.find((r:any)=>r.is_active)?.id||'':''));
    setSelectedPersonId((current)=>current||(Array.isArray(peopleResult.data)?peopleResult.data[0]?.id||'':''));
  },[personSearch]);

  const loadAudit=useCallback(async()=>{
    const {data,error}=await supabase.rpc('mnty_platform_admin_list_audit',{p_search:auditSearch.trim()||null});
    if(error){setNotice({type:'error',text:'تعذر تحميل سجل العمليات؛ تحقق من وجود دالة سجل التدقيق في ترحيل RC115.'});return;}
    setAuditRows(Array.isArray(data)?data:[]);
  },[auditSearch]);

  useEffect(()=>{void loadAll();},[loadAll]);
  useEffect(()=>{if(tab==='audit')void loadAudit();},[tab,loadAudit]);

  const resetRole=()=>{setRoleEditId('');setRoleKey('');setRoleName('');setRoleDescription('');setRoleScope('BUSINESS');setRoleActive(true);setPermissionMap({HOME:['view']});};
  const editRole=(role:CustomRole)=>{setRoleEditId(role.id);setRoleKey(role.role_key);setRoleName(role.display_name);setRoleDescription(role.description||'');setRoleScope(role.scope);setRoleActive(Boolean(role.is_active));setPermissionMap(role.permissions?.modules||{HOME:['view']});};
  const togglePermission=(module:string,action:string)=>setPermissionMap((current)=>{
    const next={...current};const values=new Set(next[module]||[]);
    if(values.has(action))values.delete(action);else values.add(action);
    if(values.size)next[module]=[...values];else delete next[module];return next;
  });
  const saveRole=async(event:React.FormEvent)=>{
    event.preventDefault();
    const cleanKey=roleKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g,'_');
    if(cleanKey.length<2||!roleName.trim()){setNotice({type:'error',text:'أدخل مفتاح دور صحيحًا واسمًا للدور.'});return;}
    setSaving(true);setNotice(null);
    const {error}=await supabase.rpc('mnty_platform_admin_upsert_custom_role',{
      p_role_key:cleanKey,p_display_name:roleName.trim(),p_description:roleDescription.trim(),
      p_scope:roleScope,p_permissions:{modules:permissionMap},p_role_id:roleEditId||null,p_is_active:roleActive,
    });
    setSaving(false);
    if(error){setNotice({type:'error',text:error.message||'تعذر حفظ الدور.'});return;}
    setNotice({type:'success',text:roleEditId?'تم تحديث الدور وحفظ صلاحياته.':'تم إنشاء الدور وحفظ صلاحياته.'});
    resetRole();await loadAll();
  };
  const assignRole=async(event:React.FormEvent)=>{
    event.preventDefault();
    if(!selectedPersonId||!selectedRole?.is_active||!selectedBusiness?.tenantId){setNotice({type:'error',text:'اختر حسابًا ودورًا نشطًا ونشاطًا لتحديد نطاق الإسناد.'});return;}
    if(selectedRole.scope==='BRANCH'&&!branchId.trim()){setNotice({type:'error',text:'أدخل معرف الفرع عند إسناد دور بنطاق فرع.'});return;}
    if(!window.confirm('تأكيد إسناد الدور ضمن النطاق المحدد؟ هذا لا يمنح صلاحيات مالك المنصة.'))return;
    setSaving(true);setNotice(null);
    const tenantId=selectedBusiness.tenantId;
    const {error}=await supabase.rpc('mnty_platform_admin_assign_custom_role',{
      p_user_id:selectedPersonId,p_role_id:selectedRole.id,
      p_tenant_id:selectedRole.scope==='TENANT'||selectedRole.scope==='BUSINESS'||selectedRole.scope==='BRANCH'||selectedRole.scope==='PROVIDER'?tenantId:null,
      p_business_id:selectedRole.scope==='BUSINESS'||selectedRole.scope==='BRANCH'?selectedBusiness.id:null,
      p_branch_id:selectedRole.scope==='BRANCH'?branchId.trim():null,
      p_is_active:true,p_assignment_id:null,
    });
    setSaving(false);
    if(error){setNotice({type:'error',text:error.message||'تعذر إسناد الدور.'});return;}
    setNotice({type:'success',text:'تم إسناد الدور وتسجيل العملية في سجل التدقيق.'});setBranchId('');await loadAll();
  };
  const revokeAssignment=async(assignment:Assignment)=>{
    if(!window.confirm('سيتم سحب هذا الدور فورًا. هل تريد المتابعة؟'))return;
    setSaving(true);setNotice(null);
    const {error}=await supabase.rpc('mnty_platform_admin_assign_custom_role',{
      p_user_id:assignment.user_id,p_role_id:assignment.role_id,p_tenant_id:assignment.tenant_id||null,
      p_business_id:assignment.business_id||null,p_branch_id:assignment.branch_id||null,
      p_is_active:false,p_assignment_id:assignment.id,
    });
    setSaving(false);
    if(error){setNotice({type:'error',text:error.message||'تعذر سحب الدور.'});return;}
    setNotice({type:'success',text:'تم سحب الدور. أي API تستخدم بوابة الصلاحيات المركزية ستتحقق من الحالة الجديدة.'});await loadAll();
  };
  const doSearchPeople=async(event:React.FormEvent)=>{event.preventDefault();await loadAll();};
  const statusText=(row:AuditRow)=>row.result||'—';
  const chosenPerson=people.find((p)=>p.id===selectedPersonId);

  return <div dir="rtl" className="space-y-6">
    <header className="rounded-3xl bg-gradient-to-l from-slate-950 to-indigo-950 p-6 text-white shadow-lg">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div><div className="flex items-center gap-2 text-indigo-200"><ShieldCheck className="h-5 w-5"/><span className="text-xs font-black">MantiqatiX · Super Admin</span></div><h2 className="mt-2 text-2xl font-black sm:text-3xl">مركز التحكم في المنصة</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">إدارة الأدوار المخصصة ونطاقها وإسنادها، وإدارة التوظيف لكل نشاط ومراجعة أثر العمليات. صلاحية مالك المنصة المحمية لا يمكن تعريفها كدور مخصص.</p></div>
        <button onClick={()=>void loadAll()} disabled={loading||saving} className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-bold hover:bg-white/20"><RefreshCw className={'h-4 w-4 '+(loading?'animate-spin':'')}/>تحديث المركز</button>
      </div>
    </header>
    {notice&&<div role="status" className={'rounded-xl border p-3 text-sm '+(notice.type==='error'?'border-rose-200 bg-rose-50 text-rose-800':'border-emerald-200 bg-emerald-50 text-emerald-800')}>{notice.text}</div>}
    <nav className="flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
      {[{id:'roles',label:'الأدوار والصلاحيات',icon:<KeyRound className="h-4 w-4"/>},{id:'assignments',label:'إسناد الصلاحيات',icon:<UserCog className="h-4 w-4"/>},{id:'employees',label:'توظيف وموظفو الأنشطة',icon:<Users className="h-4 w-4"/>},{id:'audit',label:'سجل العمليات',icon:<ClipboardList className="h-4 w-4"/>}].map((item)=> <button key={item.id} onClick={()=>setTab(item.id as typeof tab)} className={'inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-3 text-sm font-black '+(tab===item.id?'bg-indigo-700 text-white':'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50')}>{item.icon}{item.label}</button>)}
    </nav>

    {tab==='roles'&&<div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <form onSubmit={saveRole} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between"><h3 className="flex items-center gap-2 text-lg font-black text-slate-900"><KeyRound className="h-5 w-5 text-indigo-700"/>{roleEditId?'تعديل دور مخصص':'إنشاء دور مخصص'}</h3>{roleEditId&&<button type="button" onClick={resetRole} className="text-xs font-bold text-slate-500">إلغاء</button>}</div>
        <label className="block text-xs font-bold text-slate-600">مفتاح الدور<input required minLength={2} maxLength={64} pattern="[A-Za-z][A-Za-z0-9_]*" value={roleKey} onChange={(e)=>setRoleKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g,'_'))} className={'mt-1 '+inputClass} placeholder="مثال: ORDERS_MANAGER"/></label>
        <label className="block text-xs font-bold text-slate-600">اسم الدور<input required maxLength={120} value={roleName} onChange={(e)=>setRoleName(e.target.value)} className={'mt-1 '+inputClass} placeholder="مدير الطلبات"/></label>
        <label className="block text-xs font-bold text-slate-600">وصف الدور<textarea value={roleDescription} onChange={(e)=>setRoleDescription(e.target.value)} className={'mt-1 '+inputClass} rows={2}/></label>
        <label className="block text-xs font-bold text-slate-600">نطاق الدور<select value={roleScope} onChange={(e)=>setRoleScope(e.target.value as Scope)} className={'mt-1 '+inputClass}><option value="TENANT">مستوى المؤسسة / Tenant</option><option value="BUSINESS">نشاط محدد</option><option value="BRANCH">فرع محدد</option><option value="PROVIDER">مزود داخل المؤسسة</option></select></label>
        <div className="space-y-3 rounded-2xl border border-slate-100 p-4">
          <h4 className="text-sm font-black text-slate-800">صلاحيات الشاشات والإجراءات</h4>
          {modules.map((module)=><div key={module.key} className="border-b border-slate-100 py-2 last:border-0"><div className="mb-2 text-xs font-black text-slate-700">{module.label}</div><div className="flex flex-wrap gap-x-4 gap-y-2">{actions.map((action)=><label key={action.key} className="flex items-center gap-1 text-[11px] text-slate-600"><input type="checkbox" checked={(permissionMap[module.key]||[]).includes(action.key)} onChange={()=>togglePermission(module.key,action.key)}/>{action.label}</label>)}</div></div>)}
        </div>
        <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-700"><input type="checkbox" checked={roleActive} onChange={(e)=>setRoleActive(e.target.checked)}/>الدور نشط</label>
        <p className="text-[11px] leading-5 text-amber-800">حفظ وصف الصلاحيات لا يُفعّل وحده صلاحية أي موديول؛ كل API أو RPC حساس يجب أن يستدعي mnty_platform_has_permission للتحقق من النطاق والإجراء.</p>
        <button disabled={saving||loading} className={primaryClass}><Save className="h-4 w-4"/>{saving?'جار الحفظ…':'حفظ الدور'}</button>
      </form>
      <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3"><h3 className="text-lg font-black text-slate-900">الأدوار المعرفة ({roles.length})</h3><span className="text-[11px] text-slate-500">الأدوار النظامية المحمية لا يمكن تعديلها</span></div>
        {roles.length===0&&<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">لا توجد أدوار مخصصة بعد.</p>}
        {roles.map((role)=><div key={role.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="font-black text-slate-900">{role.display_name}</span>{role.is_system&&<BadgeCheck className="h-4 w-4 text-indigo-700"/>}<span className={'rounded-lg px-2 py-1 text-[10px] font-black '+(role.is_active?'bg-emerald-50 text-emerald-800':'bg-slate-100 text-slate-500')}>{role.is_active?'نشط':'موقوف'}</span></div><div className="mt-1 font-mono text-[11px] text-slate-500">{role.role_key} · {role.scope} · {Object.keys(role.permissions?.modules||{}).length} شاشة</div><p className="mt-1 text-xs text-slate-500">{role.description||'لا يوجد وصف'}</p></div><button disabled={role.is_system} onClick={()=>editRole(role)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40">تعديل</button></div>)}
      </div>
    </div>}

    {tab==='assignments'&&<div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <form onSubmit={assignRole} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="flex items-center gap-2 text-lg font-black text-slate-900"><UserCog className="h-5 w-5 text-indigo-700"/>إسناد دور إلى حساب</h3>
        <form onSubmit={doSearchPeople} className="flex gap-2"><input value={personSearch} onChange={(e)=>setPersonSearch(e.target.value)} className={inputClass} placeholder="ابحث بالاسم أو البريد"/><button className="rounded-xl border border-slate-200 px-3" type="button" onClick={()=>void loadAll()}><Search className="h-4 w-4"/></button></form>
        <label className="block text-xs font-bold text-slate-600">حساب Supabase<select required value={selectedPersonId} onChange={(e)=>setSelectedPersonId(e.target.value)} className={'mt-1 '+inputClass}><option value="">اختر حسابًا</option>{people.map((person)=><option key={person.id} value={person.id}>{person.full_name||person.email} — {person.email}</option>)}</select></label>
        {chosenPerson&&<p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">الحساب: {chosenPerson.email} · {chosenPerson.email_confirmed?'البريد مؤكد':'البريد غير مؤكد'} · {chosenPerson.memberships?.length||0} عضوية</p>}
        <label className="block text-xs font-bold text-slate-600">الدور المخصص<select required value={roleId} onChange={(e)=>setRoleId(e.target.value)} className={'mt-1 '+inputClass}><option value="">اختر دورًا</option>{roles.filter(r=>r.is_active).map((role)=><option key={role.id} value={role.id}>{role.display_name} ({role.scope})</option>)}</select></label>
        <label className="block text-xs font-bold text-slate-600">النشاط المرجعي للنطاق<select required value={selectedBusiness?.id||''} onChange={(e)=>setAssignmentBusinessId(e.target.value)} className={'mt-1 '+inputClass}>{businesses.map((business)=><option key={business.id} value={business.id}>{business.name}</option>)}</select></label>
        {selectedRole?.scope==='BRANCH'&&<label className="block text-xs font-bold text-slate-600">معرف الفرع<input required value={branchId} onChange={(e)=>setBranchId(e.target.value)} className={'mt-1 '+inputClass}/></label>}
        {selectedRole?.scope==='TENANT'&&<p className="text-xs text-slate-500">سيُسند الدور إلى المؤسسة التابعة للنشاط المختار، وليس إلى نشاط واحد فقط.</p>}
        <button disabled={saving||loading||!selectedPersonId||!selectedRole} className={primaryClass}><Check className="h-4 w-4"/>تأكيد إسناد الدور</button>
      </form>
      <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black text-slate-900">تعيينات الأدوار ({assignments.filter(a=>a.is_active).length} نشطة)</h3>
        {assignments.length===0&&<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">لا توجد تعيينات أدوار مخصصة.</p>}
        {assignments.map((assignment)=><div key={assignment.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="font-black text-slate-900">{assignment.full_name||assignment.email}</div><div className="text-xs text-slate-500">{assignment.email} · {assignment.role_name} ({assignment.scope})</div><div className="mt-1 font-mono text-[10px] text-slate-400">{assignment.tenant_id||'كل المؤسسات'} / {assignment.business_id||'كل الأنشطة'} / {assignment.branch_id||'كل الفروع'}</div></div>{assignment.is_active?<button disabled={saving} onClick={()=>void revokeAssignment(assignment)} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">سحب الصلاحية</button>:<span className="rounded-lg bg-slate-100 px-2 py-1 text-xs text-slate-500">مسحوب</span>}</div>)}
      </div>
    </div>}

    {tab==='employees'&&<div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4"><label className="block text-xs font-bold text-slate-600">اختر النشاط لإدارة وظائفه وموظفيه<select value={selectedBusiness?.id||''} onChange={(e)=>{setAssignmentBusinessId(e.target.value);setSelectedBusinessId(e.target.value);}} className={'mt-1 '+inputClass}>{businesses.map((business)=><option key={business.id} value={business.id}>{business.name}</option>)}</select></label></div>
      <BusinessEmployeeManager business={selectedBusiness}/>
    </div>}

    {tab==='audit'&&<div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h3 className="flex items-center gap-2 text-lg font-black text-slate-900"><ClipboardList className="h-5 w-5 text-indigo-700"/>سجل العمليات الإدارية</h3><p className="mt-1 text-xs text-slate-500">يعرض آخر السجلات المتاحة من قاعدة البيانات؛ لا يغيّر السجلات الأصلية.</p></div><form onSubmit={(e)=>{e.preventDefault();void loadAudit();}} className="flex gap-2"><input value={auditSearch} onChange={(e)=>setAuditSearch(e.target.value)} className={inputClass} placeholder="بحث بالإجراء أو الكيان"/><button className={primaryClass}><Search className="h-4 w-4"/>بحث</button></form></div>
      {auditRows.length===0?<p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">لا توجد سجلات مطابقة أو أن دالة سجل العمليات لم تُفعّل بعد.</p>:<div className="overflow-x-auto"><table className="w-full min-w-[850px] text-right text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-3">الوقت</th><th className="p-3">المنفذ</th><th className="p-3">الإجراء</th><th className="p-3">الكيان</th><th className="p-3">النتيجة</th><th className="p-3">القيم السابقة والجديدة</th></tr></thead><tbody>{auditRows.map((row,index)=><tr key={row.id||index} className="border-t border-slate-100"><td className="p-3 whitespace-nowrap">{row.created_at?new Date(row.created_at).toLocaleString('ar-EG'):'—'}</td><td className="p-3">{row.actor_email||row.actor_user_id||'—'}</td><td className="p-3 font-bold">{row.action||'—'}</td><td className="p-3">{row.entity_type||'—'} / {row.entity_id||'—'}</td><td className="p-3">{statusText(row)}</td><td className="max-w-sm whitespace-pre-wrap break-words p-3">{JSON.stringify({old:row.old_values??null,new:row.new_values??null})}</td></tr>)}</tbody></table></div>}
    </div>}
  </div>;
};
