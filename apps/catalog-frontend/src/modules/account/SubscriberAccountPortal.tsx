import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { canAccessMerchantDashboard, canAccessProfessionalDashboard, hasBusinessModulePermission } from '../../utils/dashboardAccess';
import { AdminDashboard } from '../../components/admin/AdminDashboard';
import { MerchantDashboard } from '../../components/merchant/MerchantDashboard';
import { ProfessionalDashboard } from '../dashboard/ProfessionalDashboard';
import { BadgeCheck, Building2, CheckCircle2, CircleAlert, CreditCard, Eye, LayoutDashboard, LockKeyhole, LogOut, Package, ShieldCheck, Store, UserRound } from 'lucide-react';

type Section = 'overview' | 'subscription' | 'permissions' | 'activities' | 'manage';
const dateText = (value?: string) => value ? (Number.isNaN(new Date(value).getTime()) ? value : new Intl.DateTimeFormat('ar-EG',{dateStyle:'medium'}).format(new Date(value))) : 'غير مسجل';
const amountText = (value: unknown, currency: string) => Number.isFinite(Number(value)) ? new Intl.NumberFormat('ar-EG',{maximumFractionDigits:2}).format(Number(value))+' '+currency : 'غير محدد';

export const SubscriberAccountPortal: React.FC = () => {
  const { authSession, authLoading, currentBusiness, businesses, businessProducts, adminSettings, setCurrentView, logout } = useApp();
  const [section,setSection] = useState<Section>('overview');
  const isAdmin = authSession.role === 'admin';
  const business = isAdmin ? undefined : currentBusiness;
  const accountBusinesses = isAdmin ? [] : businesses;
  const currency = adminSettings.currency || 'ج.م';
  const canMerchant = !isAdmin && canAccessMerchantDashboard(authSession);
  const canProfessional = !isAdmin && canAccessProfessionalDashboard(authSession);
  const getSubscriptionStatus = (item: NonNullable<typeof business>) =>
    item.isFrozen || item.paymentStatus === 'frozen' ? 'مجمّد' :
    item.paymentStatus === 'paid' && item.paymentConfirmedByAdmin ? 'مدفوع ومؤكد' :
    item.subscriptionMode === 'FREE' && item.freeActivationApprovedByAdmin ? 'مجاني معتمد' :
    item.paymentStatus === 'overdue' ? 'متأخر' :
    item.paymentStatus === 'pending' ? 'بانتظار تأكيد السداد' :
    item.paymentStatus === 'free' ? 'مجاني' : 'غير مؤكد';
  const subscriptionStatus = business ? getSubscriptionStatus(business) : 'لا يوجد نشاط مرتبط';
  const permissions = useMemo(() => [
    ['HOME','الرئيسية وملخص النشاط'],['CATALOG','المنتجات والخدمات والكتالوج'],['ORDERS','الطلبات'],
    ['CUSTOMERS','العملاء'],['EMPLOYEES','الفريق والموظفون'],['SETTINGS','إعدادات النشاط'],
    ['REPORTS','التقارير'],['ANALYTICS','التحليلات'],['FINANCE','المالية'],
  ].map(([key,label])=>({key,label,allowed:!isAdmin && hasBusinessModulePermission(authSession,key,['view','manage'])})),[authSession,isAdmin]);
  const nav: {id:Section;label:string;icon:React.ReactNode}[] = [
    {id:'overview',label:'نظرة عامة',icon:<LayoutDashboard className="h-4 w-4"/>},
    {id:'subscription',label:'اشتراكاتي',icon:<CreditCard className="h-4 w-4"/>},
    {id:'permissions',label:'صلاحياتي',icon:<ShieldCheck className="h-4 w-4"/>},
    {id:'activities',label:'أنشطتي',icon:<Store className="h-4 w-4"/>},
    ...((isAdmin || canMerchant || canProfessional) ? [{id:'manage' as const,label:isAdmin?'إدارة المنصة':'إدارة النشاط',icon:<Package className="h-4 w-4"/>}] : []),
  ];
  if(authLoading) return <div role="status" className="mx-auto max-w-6xl p-10 text-center">جارٍ التحقق من الحساب والاشتراك والصلاحيات…</div>;
  if(!authSession.isAuthenticated) return <div dir="rtl" className="mx-auto max-w-3xl p-10 text-center"><h1 className="text-2xl font-black">يلزم تسجيل الدخول</h1><p className="mt-2 text-slate-600">سجّل الدخول لعرض حسابك واشتراكاتك.</p><button onClick={()=>setCurrentView('directory')} className="mt-5 rounded-xl bg-emerald-700 px-5 py-3 font-bold text-white">العودة إلى الدليل</button></div>;

  return <section dir="rtl" className="min-h-[calc(100vh-150px)] bg-slate-50 px-3 py-5 sm:px-6 sm:py-8">
    <div className="mx-auto max-w-7xl">
      <header className="rounded-3xl bg-slate-950 p-5 text-white shadow-xl sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="flex items-center gap-2 text-xs font-black text-emerald-300"><UserRound className="h-4 w-4"/> مساحة الحساب والاشتراك</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">حسابي واشتراكاتي</h1><p className="mt-2 text-sm text-slate-300">{authSession.subscriberName || authSession.email}</p><p className="mt-1 text-xs text-slate-400">{authSession.email} {authSession.membershipRole ? ' • '+authSession.membershipRole : ''}</p></div>
          <div className="flex flex-wrap gap-2"><span className="rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-black text-white">{isAdmin ? 'وضع إدارة المنصة' : canMerchant ? 'وضع صاحب النشاط' : canProfessional ? 'وضع الموظف' : 'وضع المشترك'}</span><button onClick={()=>setCurrentView('directory')} className="rounded-xl border border-white/20 px-4 py-3 text-sm font-bold hover:bg-white/10"><Eye className="ml-1 inline h-4 w-4"/> وضع الزائر</button><button onClick={logout} className="rounded-xl border border-white/20 px-3 py-3 text-sm font-bold hover:bg-white/10"><LogOut className="ml-1 inline h-4 w-4"/> خروج</button></div>
        </div>
      </header>
      {isAdmin && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><b>حساب إدارة المنصة — صلاحيات المنصة مستقلة عن عضويات التجار ولا تنتحل دور المالك.</b><button onClick={()=>setSection('manage')} className="rounded-lg bg-amber-800 px-4 py-2 font-bold text-white">فتح مركز تحكم المنصة</button></div>}
      <div className="mt-5 grid gap-5 lg:grid-cols-[235px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><p className="px-3 py-2 text-xs font-black text-slate-400">أقسام حسابي</p><nav aria-label="أقسام حساب المشترك" className="space-y-1">{nav.map(item=><button key={item.id} onClick={()=>setSection(item.id)} aria-current={section===item.id?'page':undefined} className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-right text-sm font-bold ${section===item.id?'bg-emerald-50 text-emerald-800':'text-slate-600 hover:bg-slate-50'}`}>{item.icon}{item.label}</button>)}</nav></aside>
        <main className="min-w-0">
          {section==='overview' && <><div className="mb-5"><h2 className="text-xl font-black">ملخص الحساب</h2><p className="mt-1 text-sm text-slate-500">البيانات المعروضة مأخوذة من جلسة العضوية وبيانات النشاط المحملة.</p></div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
              ['الأنشطة المرتبطة',String(accountBusinesses.length),<Building2 className="h-5 w-5"/>],
              ['حالة الاشتراك',subscriptionStatus,<CreditCard className="h-5 w-5"/>],
              ['حالة التوثيق',business?(business.isVerified?'موثق':'غير موثق'):'—',<BadgeCheck className="h-5 w-5"/>],
              ['المنتجات والخدمات',business?String(businessProducts.length):'—',<Package className="h-5 w-5"/>],
            ].map(([label,value,icon])=><article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center justify-between text-xs font-bold text-slate-400"><span>{label}</span>{icon}</div><p className="mt-3 break-words text-lg font-black text-slate-900">{value}</p></article>)}</div>
            {accountBusinesses.length===0 && <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5"><p className="font-black text-amber-950"><CircleAlert className="ml-1 inline h-5 w-5"/> لا توجد عضوية نشاط مرتبطة بهذا الحساب</p><p className="mt-2 text-sm text-amber-900">يمكنك استخدام الموقع كزائر. تسجيل الدخول وحده لا يمنح صلاحيات إدارة نشاط.</p></div>}
            {business && <div className="mt-5 grid gap-4 md:grid-cols-2"><article className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-black">ملخص الاشتراك</h3><p className="mt-3 text-sm text-slate-600">نوع الباقة: {business.subscriptionMode==='FREE'?'مجانية':'مدفوعة / حسب إعداد النشاط'}</p><p className="mt-2 text-sm text-slate-600">القيمة: {amountText(business.subscriptionAmount,currency)}</p><p className="mt-2 text-sm text-slate-600">موعد الاستحقاق: {dateText(business.paymentDueDate)}</p></article><article className="rounded-2xl border border-slate-200 bg-white p-5"><h3 className="font-black">إدارة نشاطك</h3><p className="mt-2 text-sm text-slate-500">افتح أدوات الإدارة المتاحة حسب عضويتك الحالية.</p><button disabled={!canMerchant&&!canProfessional} onClick={()=>setSection('manage')} className="mt-4 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-black text-white disabled:opacity-40">فتح أدوات النشاط</button></article></div>}
          </>}
          {section==='subscription' && <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"><h2 className="text-xl font-black">اشتراكاتي</h2>{accountBusinesses.length===0?<p className="mt-4 text-sm text-slate-500">لا توجد اشتراكات نشاط مرتبطة بعضويتك الحالية.</p>:<div className="mt-5 space-y-4">{accountBusinesses.map(item=><section key={item.id} className="rounded-xl border border-slate-200 p-4"><h3 className="font-black">{item.name}</h3><div className="mt-3 grid gap-3 sm:grid-cols-2">{[['حالة الاشتراك',getSubscriptionStatus(item)],['قيمة الاشتراك',amountText(item.subscriptionAmount,currency)],['تاريخ الاستحقاق',dateText(item.paymentDueDate)],['آخر سداد',dateText(item.lastPaymentDate)],['تأكيد الإدارة',item.paymentConfirmedByAdmin?'مؤكد':'لم يتم التأكيد']].map(([k,v])=><div key={k} className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-bold text-slate-500">{k}</p><p className="mt-1 font-black">{v}</p></div>)}</div></section>)}</div>}<p className="mt-5 text-xs text-slate-500">عرض فقط: لا تنشئ هذه الشاشة مدفوعات ولا تغير حالة الاشتراك.</p></article>}
          {section==='permissions' && <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"><h2 className="text-xl font-black">صلاحياتي</h2><p className="mt-2 text-sm text-slate-500">عرض الصلاحيات وفق العضوية الحالية. يظل التحقق النهائي على الخادم.</p><div className="mt-4 divide-y divide-slate-100">{permissions.map(item=><div key={item.key} className="flex items-center justify-between gap-3 py-3"><span className="font-bold">{item.label}</span><span className={`rounded-full px-3 py-1 text-xs font-black ${item.allowed?'bg-emerald-50 text-emerald-800':'bg-slate-100 text-slate-500'}`}>{item.allowed?<><CheckCircle2 className="ml-1 inline h-3.5 w-3.5"/> متاح</>:<><LockKeyhole className="ml-1 inline h-3.5 w-3.5"/> غير متاح</>}</span></div>)}</div></article>}
          {section==='activities' && <article className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7"><h2 className="text-xl font-black">أنشطتي</h2>{accountBusinesses.length===0?<p className="mt-4 text-sm text-slate-500">لا يوجد نشاط مرتبط بحسابك حاليًا.</p>:<div className="mt-4 space-y-3">{accountBusinesses.map(item=><div key={item.id} className="flex flex-col gap-4 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-3"><img src={item.logoUrl} alt="" className="h-14 w-14 rounded-xl bg-slate-100 object-cover"/><div><h3 className="font-black">{item.name}</h3><p className="mt-1 text-xs text-slate-500">{item.category}</p><p className="mt-1 text-xs text-slate-500">{item.publicationStatus==='PUBLISHED'||item.publicEnabled?'منشور':'غير منشور'} • {item.isVerified?'موثق':'غير موثق'}</p></div></div>{item.id===business?.id?<button disabled={!canMerchant&&!canProfessional} onClick={()=>setSection('manage')} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40">إدارة العضوية الحالية</button>:<span className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-500">عضوية أخرى — يلزم اختيار العضوية من الخادم قبل إدارتها</span>}</div>)}</div>}</article>}
          {section==='manage' && <div className="space-y-4"><div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><h2 className="font-black text-emerald-950">أدوات إدارة النشاط</h2><p className="mt-1 text-xs text-emerald-800">الأدوات الحالية معاد استخدامها داخل بوابة الحساب دون حذف النظام القديم أو توسيع الصلاحيات.</p></div>{isAdmin?<AdminDashboard/>:canMerchant?<MerchantDashboard/>:canProfessional?<ProfessionalDashboard/>:<p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">لا تتوفر صلاحية إدارة نشاط لهذا الحساب.</p>}</div>}
        </main>
      </div>
    </div>
  </section>;
};
