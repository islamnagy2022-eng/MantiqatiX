import React, { useCallback, useEffect, useState } from 'react';
import { BriefcaseBusiness, Plus, RefreshCw, Save, Users, X, UserRoundCheck, ShieldCheck, AlertTriangle } from 'lucide-react';
import type { Business } from '../../types';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/production';

type Position = {
  id: string; title: string; department: string; description: string; employment_type: string;
  permission_template: { modules?: Record<string, string[]> }; is_hiring: boolean; is_active: boolean;
};
type Employee = {
  id: string; job_position_id: string; position_title: string; full_name: string; email: string;
  phone: string; status: 'INVITED'|'ACTIVE'|'SUSPENDED'|'ENDED'; user_id?: string | null;
};
const actionChoices = [
  { key: 'view', label: 'عرض' }, { key: 'create', label: 'إضافة' },
  { key: 'update', label: 'تعديل' }, { key: 'delete', label: 'حذف' },
  { key: 'manage', label: 'إدارة' },
];
const moduleChoices = [
  { key: 'HOME', label: 'الرئيسية' }, { key: 'CATALOG', label: 'المنتجات والكتالوج' },
  { key: 'ORDERS', label: 'الطلبات' }, { key: 'CUSTOMERS', label: 'العملاء' },
  { key: 'EMPLOYEES', label: 'الموظفون والتوظيف' }, { key: 'SETTINGS', label: 'إعدادات النشاط' },
];
const fieldClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100';
const buttonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50';

export const BusinessEmployeeManager: React.FC<{ business?: Business; readOnly?: boolean }> = ({ business, readOnly = false }) => {
  const { authSession } = useApp();
  const membershipBranchId = authSession.role === 'subscriber' ? authSession.membershipBranchId || null : null;
  const [positions, setPositions] = useState<Position[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success'|'error'; text: string } | null>(null);
  const [positionEditId, setPositionEditId] = useState('');
  const [employeeEditId, setEmployeeEditId] = useState('');
  const [title, setTitle] = useState('');
  const [department, setDepartment] = useState('');
  const [description, setDescription] = useState('');
  const [employmentType, setEmploymentType] = useState('FULL_TIME');
  const [isHiring, setIsHiring] = useState(true);
  const [isPositionActive, setIsPositionActive] = useState(true);
  const [permissionModules, setPermissionModules] = useState<Record<string, string[]>>({ HOME: ['view'] });
  const [employeeName, setEmployeeName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');
  const [employeePhone, setEmployeePhone] = useState('');
  const [employeePosition, setEmployeePosition] = useState('');
  const [employeeStatus, setEmployeeStatus] = useState<Employee['status']>('INVITED');

  const loadData = useCallback(async () => {
    if (!business?.id || !business.tenantId) {
      setPositions([]); setEmployees([]);
      return;
    }
    setLoading(true); setNotice(null);
    const { data, error } = await supabase.rpc('mnty_business_employee_list_scoped', {
      p_tenant_id: business.tenantId, p_business_id: business.id, p_branch_id: membershipBranchId,
    });
    setLoading(false);
    if (error || data?.error) {
      setNotice({ type: 'error', text: 'تعذر تحميل الموظفين والوظائف. تحقق من نطاق العضوية وصلاحياتها وتطبيق ترحيل RC457.' });
      return;
    }
    setPositions(Array.isArray(data?.positions) ? data.positions : []);
    setEmployees(Array.isArray(data?.employees) ? data.employees : []);
    setEmployeePosition((previous) => previous || data?.positions?.find((p: Position) => p.is_active)?.id || '');
  }, [business?.id, business?.tenantId, membershipBranchId]);

  useEffect(() => { void loadData(); }, [loadData]);

  const resetPosition = () => {
    setPositionEditId(''); setTitle(''); setDepartment(''); setDescription('');
    setEmploymentType('FULL_TIME'); setIsHiring(true); setIsPositionActive(true);
    setPermissionModules({ HOME: ['view'] });
  };
  const editPosition = (position: Position) => {
    setPositionEditId(position.id); setTitle(position.title); setDepartment(position.department || '');
    setDescription(position.description || ''); setEmploymentType(position.employment_type || 'FULL_TIME');
    setIsHiring(Boolean(position.is_hiring)); setIsPositionActive(Boolean(position.is_active));
    setPermissionModules(position.permission_template?.modules || { HOME: ['view'] });
  };
  const togglePermission = (module: string, action: string) => setPermissionModules((previous) => {
    const actions = new Set(previous[module] || []);
    if (actions.has(action)) actions.delete(action); else actions.add(action);
    const next = { ...previous };
    if (actions.size) next[module] = [...actions]; else delete next[module];
    return next;
  });

  const savePosition = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!business?.id || !business.tenantId || title.trim().length < 2) return;
    setSaving(true); setNotice(null);
    const { error } = await supabase.rpc('mnty_business_employee_position_upsert', {
      p_tenant_id: business.tenantId, p_business_id: business.id, p_title: title.trim(),
      p_description: description.trim(), p_department: department.trim(), p_employment_type: employmentType,
      p_permission_template: { modules: permissionModules }, p_is_hiring: isHiring,
      p_is_active: isPositionActive, p_branch_id: membershipBranchId, p_position_id: positionEditId || null,
    });
    setSaving(false);
    if (error) { setNotice({ type: 'error', text: error.message || 'تعذر حفظ الوظيفة.' }); return; }
    setNotice({ type: 'success', text: positionEditId ? 'تم تحديث الوظيفة.' : 'تم إنشاء الوظيفة.' });
    resetPosition(); await loadData();
  };

  const editEmployee = (employee: Employee) => {
    setEmployeeEditId(employee.id); setEmployeeName(employee.full_name); setEmployeeEmail(employee.email);
    setEmployeePhone(employee.phone || ''); setEmployeePosition(employee.job_position_id); setEmployeeStatus(employee.status);
  };
  const resetEmployee = () => {
    setEmployeeEditId(''); setEmployeeName(''); setEmployeeEmail(''); setEmployeePhone('');
    setEmployeeStatus('INVITED');
    setEmployeePosition(positions.find((p) => p.is_active)?.id || '');
  };
  const saveEmployee = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!business?.id || !business.tenantId || !employeeName.trim() || !employeeEmail.includes('@') || !employeePosition) return;
    if (employeeStatus === 'ACTIVE' && !window.confirm('تفعيل الموظف سيمنحه عضوية EMPLOYEE بالنطاق والصلاحيات المحددة للوظيفة. هل تريد المتابعة؟')) return;
    if (employeeStatus === 'SUSPENDED' || employeeStatus === 'ENDED') {
      if (!window.confirm('سيتم تعليق أو إنهاء وصول الموظف للنشاط. هل تريد المتابعة؟')) return;
    }
    setSaving(true); setNotice(null);
    const { error } = await supabase.rpc('mnty_business_employee_upsert', {
      p_tenant_id: business.tenantId, p_business_id: business.id, p_job_position_id: employeePosition,
      p_full_name: employeeName.trim(), p_email: employeeEmail.trim().toLowerCase(), p_phone: employeePhone.trim(),
      p_user_id: null, p_status: employeeStatus, p_permission_overrides: {}, p_branch_id: membershipBranchId,
      p_employee_id: employeeEditId || null,
    });
    setSaving(false);
    if (error) {
      const message = error.message || 'تعذر حفظ الموظف.';
      setNotice({ type: 'error', text: message.includes('ACTIVE_EMPLOYEE_REQUIRES_CONFIRMED_AUTH_USER')
        ? 'لا يمكن تفعيل الموظف قبل وجود حساب Supabase مؤكد بنفس البريد الإلكتروني. اطلب منه تأكيد البريد ثم أعد المحاولة.'
        : message });
      return;
    }
    setNotice({ type: 'success', text: employeeEditId ? 'تم تحديث سجل الموظف وصلاحيات عضويته.' : 'تم حفظ الموظف. إذا كان حسابه موجودًا فتم ربطه بالبريد، وإلا يظل في حالة دعوة.' });
    resetEmployee(); await loadData();
  };

  if (!business) return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
      اختر نشاطًا أولًا لعرض وظائفه وموظفيه.
    </div>
  );

  return (
    <section className="space-y-6" dir="rtl">
      <header className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-800"><BriefcaseBusiness className="h-5 w-5" /><span className="text-xs font-black">إدارة موارد النشاط</span></div>
          <h2 className="mt-1 text-xl font-black text-slate-900">الوظائف والموظفون — {business.name}</h2>
          <p className="mt-1 text-xs leading-6 text-slate-500">تُحفظ الوظائف والعضويات في Supabase. التفعيل يتطلب حسابًا قائمًا بنفس البريد، ولا يمنح دور مالك أو مدير.</p>
        </div>
        <button type="button" onClick={() => void loadData()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-700">
          <RefreshCw className={'h-4 w-4 '+(loading?'animate-spin':'')} /> تحديث البيانات
        </button>
      </header>

      {notice && <div role="status" className={'rounded-xl border p-3 text-sm '+(notice.type==='error'?'border-rose-200 bg-rose-50 text-rose-800':'border-emerald-200 bg-emerald-50 text-emerald-800')}>{notice.text}</div>}
      {readOnly && <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm leading-6 text-sky-900">وضع عرض فقط: يمكنك مشاهدة الوظائف والموظفين المسموح بهم. التعديل والتفعيل يتطلبان صلاحيات مستقلة.</p>}

      <div className={readOnly ? 'grid gap-6' : 'grid gap-6 xl:grid-cols-2'}>
        {!readOnly && <form onSubmit={savePosition} className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-lg font-black text-slate-900"><BriefcaseBusiness className="h-5 w-5 text-emerald-700" />{positionEditId?'تعديل وظيفة':'إنشاء وظيفة'}</h3>
            {positionEditId && <button type="button" onClick={resetPosition} className="text-xs font-bold text-slate-500">إلغاء التعديل</button>}
          </div>
          <label className="block text-xs font-bold text-slate-600">اسم الوظيفة<input required minLength={2} maxLength={120} value={title} onChange={(e)=>setTitle(e.target.value)} className={'mt-1 '+fieldClass} placeholder="مثل: مدير فرع أو مسؤول طلبات" /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-bold text-slate-600">القسم<input value={department} onChange={(e)=>setDepartment(e.target.value)} className={'mt-1 '+fieldClass} placeholder="المبيعات أو المخزن" /></label>
            <label className="block text-xs font-bold text-slate-600">نوع التوظيف<select value={employmentType} onChange={(e)=>setEmploymentType(e.target.value)} className={'mt-1 '+fieldClass}><option value="FULL_TIME">دوام كامل</option><option value="PART_TIME">دوام جزئي</option><option value="CONTRACT">تعاقد</option><option value="TEMPORARY">مؤقت</option><option value="INTERN">تدريب</option></select></label>
          </div>
          <label className="block text-xs font-bold text-slate-600">وصف الوظيفة<textarea value={description} onChange={(e)=>setDescription(e.target.value)} className={'mt-1 '+fieldClass} rows={2} maxLength={2000} /></label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-700"><input type="checkbox" checked={isHiring} onChange={(e)=>setIsHiring(e.target.checked)} /> التوظيف مفتوح</label>
            <label className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-xs font-bold text-slate-700"><input type="checkbox" checked={isPositionActive} onChange={(e)=>setIsPositionActive(e.target.checked)} /> الوظيفة نشطة</label>
          </div>
          <div className="space-y-3 rounded-2xl border border-slate-100 p-4">
            <div className="flex items-center gap-2 text-sm font-black text-slate-800"><ShieldCheck className="h-4 w-4 text-emerald-700" /> قالب صلاحيات الوظيفة</div>
            <p className="text-[11px] leading-5 text-slate-500">هذه الصلاحيات تُحفظ مع عضوية الموظف. تأثيرها على أي موديول يتطلب أن يستخدم الموديول بوابة التحقق المركزية.</p>
            {moduleChoices.map((module) => (
              <div key={module.key} className="flex flex-col gap-2 border-b border-slate-100 py-2 last:border-0 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs font-bold text-slate-700">{module.label}</span>
                <div className="flex flex-wrap gap-3">
                  {actionChoices.map((action) => <label key={action.key} className="flex items-center gap-1 text-[11px] text-slate-600"><input type="checkbox" checked={(permissionModules[module.key]||[]).includes(action.key)} onChange={()=>togglePermission(module.key,action.key)} />{action.label}</label>)}
                </div>
              </div>
            ))}
          </div>
          <button disabled={saving || loading || !title.trim()} className={buttonClass}><Save className="h-4 w-4" />{saving?'جار الحفظ…':'حفظ الوظيفة'}</button>
        </form>}

        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-lg font-black text-slate-900"><BriefcaseBusiness className="h-5 w-5 text-emerald-700" />الوظائف المسجلة ({positions.length})</h3>
          {positions.length===0 && <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">لا توجد وظائف بعد. أنشئ وظيفة لتبدأ بإضافة الموظفين.</p>}
          {positions.map((position)=><div key={position.id} className="flex flex-col gap-3 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div><div className="font-black text-slate-900">{position.title}</div><div className="mt-1 text-xs text-slate-500">{position.department||'بدون قسم'} · {position.employment_type} · {position.is_hiring?'التوظيف مفتوح':'التوظيف مغلق'}</div><div className="mt-1 text-[11px] text-slate-500">{position.is_active?'نشطة':'غير نشطة'} · {(Object.keys(position.permission_template?.modules||{})).length} موديول بصلاحيات معرفة</div></div>
            {!readOnly && <button type="button" onClick={()=>editPosition(position)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700">تعديل</button>}
          </div>)}
        </div>
      </div>

      <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div><h3 className="flex items-center gap-2 text-lg font-black text-slate-900"><Users className="h-5 w-5 text-indigo-700" />سجل الموظفين ({employees.length})</h3><p className="mt-1 text-xs leading-5 text-slate-500">الحالات: دعوة، نشط، موقوف، منتهٍ. تفعيل الموظف يتطلب حساب Supabase مؤكدًا بنفس البريد الإلكتروني.</p></div>
          {!readOnly && <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800"><AlertTriangle className="h-4 w-4 shrink-0" />التغيير يسجل في سجل العمليات</div>}
        </div>
        {!readOnly && <form onSubmit={saveEmployee} className="grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-5">
          <input required maxLength={160} value={employeeName} onChange={(e)=>setEmployeeName(e.target.value)} className={fieldClass} placeholder="اسم الموظف" aria-label="اسم الموظف" />
          <input required type="email" maxLength={254} value={employeeEmail} onChange={(e)=>setEmployeeEmail(e.target.value)} className={fieldClass} placeholder="بريد حساب Google" aria-label="بريد حساب Google" />
          <input value={employeePhone} onChange={(e)=>setEmployeePhone(e.target.value)} className={fieldClass} placeholder="رقم الهاتف" aria-label="رقم الهاتف" />
          <select required value={employeePosition} onChange={(e)=>setEmployeePosition(e.target.value)} className={fieldClass} aria-label="الوظيفة">{positions.filter(p=>p.is_active).map(p=><option key={p.id} value={p.id}>{p.title}</option>)}</select>
          <select value={employeeStatus} onChange={(e)=>setEmployeeStatus(e.target.value as Employee['status'])} className={fieldClass} aria-label="حالة الموظف"><option value="INVITED">دعوة / انتظار التسجيل</option><option value="ACTIVE">نشط</option><option value="SUSPENDED">موقوف</option><option value="ENDED">انتهى العمل</option></select>
          <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-5">
            <button disabled={saving||loading||positions.filter(p=>p.is_active).length===0} className={buttonClass}><UserRoundCheck className="h-4 w-4" />{saving?'جار الحفظ…':employeeEditId?'تحديث الموظف':'إضافة الموظف'}</button>
            {employeeEditId && <button type="button" onClick={resetEmployee} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700"><X className="h-4 w-4" />إلغاء</button>}
          </div>
        </form>}
        {employees.length===0 ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">لا يوجد موظفون مسجلون لهذا النشاط.</p> :
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-right text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3">الموظف</th><th className="p-3">الوظيفة</th><th className="p-3">الحالة</th><th className="p-3">الحساب</th>{!readOnly && <th className="p-3">الإجراء</th>}</tr></thead><tbody>{employees.map((employee)=><tr key={employee.id} className="border-t border-slate-100"><td className="p-3"><div className="font-bold text-slate-900">{employee.full_name}</div><div className="text-xs text-slate-500">{employee.email}</div></td><td className="p-3">{employee.position_title}</td><td className="p-3"><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-bold">{({INVITED:'بانتظار التفعيل',ACTIVE:'نشط',SUSPENDED:'موقوف',ENDED:'منتهٍ'} as Record<string,string>)[employee.status]||employee.status}</span></td><td className="p-3 text-xs text-slate-500">{employee.user_id?'مرتبط بحساب':'غير مرتبط'}</td>{!readOnly && <td className="p-3"><button type="button" onClick={()=>editEmployee(employee)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold">تعديل الحالة</button></td>}</tr>)}</tbody></table></div>}
      </section>
      <p className="text-[11px] leading-5 text-slate-500">ملاحظة أمنية: وضع العرض فقط يخفي أدوات التغيير في هذه الواجهة. تبقى صلاحيات القراءة والكتابة الفعلية مسؤولية RPC وقاعدة البيانات، ويجب اختبارها مستقلاً لكل دور.</p>
    </section>
  );
};
