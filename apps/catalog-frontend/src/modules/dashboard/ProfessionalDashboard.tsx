import React, { useMemo, useState } from 'react';
import {
  Activity,
  ArrowLeft,
  BarChart3,
  Bell,
  Building2,
  CheckCircle2,
  CircleAlert,
  ClipboardList,
  ExternalLink,
  LayoutDashboard,
  Package,
  Search,
  Settings2,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { Business } from '../../types';
import { BusinessEmployeeManager } from '../../components/merchant/BusinessEmployeeManager';
import { canAccessMerchantDashboard, canAccessProfessionalDashboard, hasBusinessModulePermission, isBusinessManagementRole } from '../../utils/dashboardAccess';

type DashboardSection = 'overview' | 'activities' | 'reports' | 'access' | 'settings';
type MetricCardProps = {
  label: string;
  value: number | string;
  detail: string;
  icon: React.ReactNode;
};

const MetricCard: React.FC<MetricCardProps> = ({ label, value, detail, icon }) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-500">{label}</p>
        <p className="mt-2 text-3xl font-black tracking-tight text-slate-900">{value}</p>
      </div>
      <div className="rounded-xl bg-slate-100 p-3 text-slate-700" aria-hidden="true">{icon}</div>
    </div>
    <p className="mt-3 text-xs leading-5 text-slate-500">{detail}</p>
  </article>
);

const SECTION_ITEMS: { id: DashboardSection; label: string; icon: React.ReactNode }[] = [
  { id: 'overview', label: 'نظرة عامة', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'activities', label: 'إدارة الأنشطة', icon: <Store className="h-4 w-4" /> },
  { id: 'reports', label: 'التقارير والمؤشرات', icon: <BarChart3 className="h-4 w-4" /> },
  { id: 'access', label: 'المستخدمون والصلاحيات', icon: <Users className="h-4 w-4" /> },
  { id: 'settings', label: 'الإعدادات والإدارة', icon: <Settings2 className="h-4 w-4" /> },
];

const businessState = (business: Business) => {
  if (business.isFrozen || business.operationalStatus === 'FROZEN' || business.paymentStatus === 'frozen') {
    return { key: 'frozen', label: 'مجمّد', className: 'border-rose-200 bg-rose-50 text-rose-800' };
  }
  if (business.operationalStatus === 'ACTIVE') {
    return { key: 'active', label: 'نشط', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' };
  }
  return { key: 'inactive', label: 'غير نشط', className: 'border-slate-200 bg-slate-100 text-slate-700' };
};

const paymentState = (business: Business) => {
  const value = String(business.paymentStatus || '').toLowerCase();
  if (value === 'overdue') return { label: 'متأخر وفق السجل', className: 'text-amber-800' };
  if (value === 'frozen') return { label: 'مجمّد وفق السجل', className: 'text-rose-800' };
  if (value === 'paid') return { label: 'مدفوع وفق السجل', className: 'text-emerald-800' };
  return { label: 'قيد المتابعة', className: 'text-slate-600' };
};

const publicationState = (business: Business) => {
  if (business.catalogPublished === true || business.publicEnabled === true || business.publicationStatus === 'PUBLISHED') {
    return { label: 'الكتالوج منشور', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' };
  }
  if (business.publicationStatus === 'PENDING_PUBLICATION') {
    return { label: 'بانتظار النشر', className: 'border-amber-200 bg-amber-50 text-amber-800' };
  }
  if (business.publicationStatus === 'REJECTED') {
    return { label: 'النشر مرفوض', className: 'border-rose-200 bg-rose-50 text-rose-800' };
  }
  return { label: 'حالة النشر غير محددة', className: 'border-slate-200 bg-slate-50 text-slate-600' };
};

export const ProfessionalDashboard: React.FC = () => {
  const {
    authSession,
    authLoading,
    authBootstrapError,
    currentBusiness,
    businesses,
    products,
    subscribers,
    setCurrentView,
    setSelectedBusinessId,
  } = useApp();
  const [section, setSection] = useState<DashboardSection>('overview');
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [governorateFilter, setGovernorateFilter] = useState('all');
  const [trendMonths, setTrendMonths] = useState<3 | 6 | 12>(6);

  const isPlatformAdmin = authSession.role === 'admin';
  const isBusinessMember = authSession.role === 'subscriber';
  const isBusinessManager = isBusinessManagementRole(authSession);
  const canViewCatalog = hasBusinessModulePermission(authSession, 'CATALOG', ['view', 'manage']);
  const canViewOrders = hasBusinessModulePermission(authSession, 'ORDERS', ['view', 'manage']);
  const canViewCustomers = hasBusinessModulePermission(authSession, 'CUSTOMERS', ['view', 'manage']);
  const canViewEmployees = hasBusinessModulePermission(authSession, 'EMPLOYEES', ['view', 'manage']);
  const canManageEmployees = hasBusinessModulePermission(authSession, 'EMPLOYEES', ['create', 'update', 'manage']);
  const canViewSettings = hasBusinessModulePermission(authSession, 'SETTINGS', ['view', 'manage']);
  const canViewReports = isPlatformAdmin || isBusinessManager ||
    hasBusinessModulePermission(authSession, 'REPORTS', ['view', 'manage']) ||
    hasBusinessModulePermission(authSession, 'ANALYTICS', ['view', 'manage']) ||
    hasBusinessModulePermission(authSession, 'FINANCE', ['view', 'manage']);
  const allowed = canAccessProfessionalDashboard(authSession) && (isPlatformAdmin || (isBusinessMember && Boolean(currentBusiness)));
  const visibleSectionItems = SECTION_ITEMS.filter((item) => {
    if (item.id === 'overview') return true;
    if (item.id === 'activities') return isPlatformAdmin || isBusinessManager || canViewCatalog;
    if (item.id === 'reports') return canViewReports;
    if (item.id === 'access') return isPlatformAdmin || isBusinessManager || canViewEmployees;
    return isPlatformAdmin || isBusinessManager || canViewSettings;
  });
  const activeSection = visibleSectionItems.some((item) => item.id === section)
    ? section
    : visibleSectionItems[0]?.id || 'overview';
  const canViewBusinessAdminScreens = canAccessMerchantDashboard(authSession);
  const visibleBusinesses = isPlatformAdmin ? businesses : currentBusiness ? [currentBusiness] : [];
  const visibleBusinessIds = useMemo(() => new Set(visibleBusinesses.map((business) => business.id)), [visibleBusinesses]);
  const visibleProducts = useMemo(
    () => products.filter((product) => visibleBusinessIds.has(product.businessId)),
    [products, visibleBusinessIds],
  );
  const activeBusinesses = visibleBusinesses.filter((business) => businessState(business).key === 'active');
  const frozenBusinesses = visibleBusinesses.filter((business) => businessState(business).key === 'frozen');
  const inactiveBusinesses = visibleBusinesses.filter((business) => businessState(business).key === 'inactive');
  const publishedBusinesses = visibleBusinesses.filter((business) => publicationState(business).label === 'الكتالوج منشور');
  const pendingPublicationBusinesses = visibleBusinesses.filter((business) => business.publicationStatus === 'PENDING_PUBLICATION');

  const categories = useMemo(
    () => [...new Set(visibleBusinesses.map((business) => business.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar')),
    [visibleBusinesses],
  );
  const governorates = useMemo(
    () => [...new Set(visibleBusinesses.map((business) => business.governorate).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ar')),
    [visibleBusinesses],
  );

  const filteredBusinesses = useMemo(() => visibleBusinesses.filter((business) => {
    const query = searchText.trim().toLocaleLowerCase('ar');
    const matchesQuery = !query || [business.name, business.category, business.governorate, business.markaz, business.village]
      .some((value) => String(value || '').toLocaleLowerCase('ar').includes(query));
    const matchesStatus = statusFilter === 'all' || businessState(business).key === statusFilter;
    const matchesCategory = categoryFilter === 'all' || business.category === categoryFilter;
    const matchesGovernorate = governorateFilter === 'all' || business.governorate === governorateFilter;
    return matchesQuery && matchesStatus && matchesCategory && matchesGovernorate;
  }), [visibleBusinesses, searchText, statusFilter, categoryFilter, governorateFilter]);

  const categoryDistribution = useMemo(() => {
    const counts = new Map<string, number>();
    visibleBusinesses.forEach((business) => {
      const category = business.category || 'غير مصنف';
      counts.set(category, (counts.get(category) || 0) + 1);
    });
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ar'))
      .slice(0, 6);
  }, [visibleBusinesses]);
  const activityTrend = useMemo(() => {
    const now = new Date();
    return Array.from({ length: trendMonths }, (_, index) => {
      const offset = index - (trendMonths - 1);
      const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
      const count = visibleBusinesses.filter((business) => {
        const created = Date.parse(business.createdAt || '');
        return Number.isFinite(created) && created >= start.getTime() && created < end.getTime();
      }).length;
      return {
        label: start.toLocaleDateString('ar-EG', { month: 'short', year: '2-digit' }),
        count,
      };
    });
  }, [visibleBusinesses, trendMonths]);

  const alerts = visibleBusinesses.filter((business) =>
    business.isFrozen ||
    business.operationalStatus === 'FROZEN' ||
    business.paymentStatus === 'frozen' ||
    business.paymentStatus === 'overdue' ||
    business.operationalStatus === 'INACTIVE'
  );

  const openBusinessAdmin = (
    business?: Business,
    adminTab: 'businesses' | 'subscribers' | 'settings' | 'control_center' = 'businesses',
    merchantTab: 'products' | 'import' | 'branding' | 'profile' | 'functional_engine' | 'qr' | 'employees' = 'products',
  ) => {
    if (!canViewBusinessAdminScreens) return;
    if (isPlatformAdmin) {
      if (business) setSelectedBusinessId(business.id);
      const url = new URL(window.location.href);
      url.searchParams.set('tab', adminTab);
      url.searchParams.delete('merchantTab');
      if (adminTab !== 'control_center') url.searchParams.delete('controlTab');
      window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      setCurrentView('super_admin');
      return;
    }
    const url = new URL(window.location.href);
    if (merchantTab === 'products') url.searchParams.delete('merchantTab');
    else url.searchParams.set('merchantTab', merchantTab);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    setCurrentView('merchant_admin');
  };

  const openPlatformControlTab = (controlTab: 'roles' | 'audit') => {
    if (!isPlatformAdmin) return;
    const url = new URL(window.location.href);
    url.searchParams.set('tab', 'control_center');
    if (controlTab === 'roles') url.searchParams.delete('controlTab');
    else url.searchParams.set('controlTab', controlTab);
    url.searchParams.delete('merchantTab');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    setCurrentView('super_admin');
  };

  if (authLoading) {
    return <section className="mx-auto max-w-7xl p-6" dir="rtl"><p role="status" aria-live="polite" className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">جارٍ التحقق من الجلسة والصلاحيات…</p></section>;
  }

  if (authBootstrapError) {
    return <section className="mx-auto max-w-3xl p-6" dir="rtl"><div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm leading-6 text-rose-900"><h2 className="font-black">تعذر تحميل صلاحيات وبيانات الحساب</h2><p className="mt-2">{authBootstrapError}</p><p className="mt-2">لم يتم عرض أرقام بديلة حتى لا تظهر بيانات غير مؤكدة.</p><button onClick={() => window.location.reload()} className="mt-4 rounded-lg border border-rose-300 bg-white px-4 py-2 font-bold">إعادة المحاولة</button></div></section>;
  }

  if (!allowed) {
    return <section className="mx-auto max-w-3xl p-6" dir="rtl"><div role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm font-bold text-amber-900">لا تملك صلاحية الوصول إلى لوحة التحكم الاحترافية.</div><button onClick={() => setCurrentView('directory')} className="mt-4 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700">العودة إلى الكتالوج</button></section>;
  }

  return (
    <main className="mx-auto w-full max-w-[1500px] px-3 py-5 sm:px-6 lg:px-8" dir="rtl">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[235px_minmax(0,1fr)]">
        <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-3 shadow-sm lg:sticky lg:top-28">
          <div className="rounded-2xl bg-slate-900 p-4 text-white">
            <p className="text-[11px] font-bold tracking-wide text-emerald-300">MantiqatiX</p>
            <h2 className="mt-1 text-lg font-black">مركز التحكم</h2>
            <p className="mt-1 text-xs leading-5 text-slate-300">{isPlatformAdmin ? 'إدارة المنصة' : currentBusiness?.name || 'إدارة النشاط'}</p>
          </div>
          <nav aria-label="أقسام الداشبورد" className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-1">
            {visibleSectionItems.map((item) => (
              <button key={item.id} type="button" onClick={() => setSection(item.id)} aria-current={section === item.id ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-2 rounded-xl px-3 py-2.5 text-right text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${section === item.id ? 'bg-emerald-50 text-emerald-800' : 'text-slate-600 hover:bg-slate-50'}`}>
                {item.icon}<span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="mt-3 border-t border-slate-100 pt-3">
            <button type="button" onClick={() => setCurrentView('directory')} className="flex min-h-11 w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600">
              <span>العودة إلى الكتالوج</span><ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="mb-5 flex flex-col justify-between gap-4 rounded-3xl bg-slate-900 p-5 text-white sm:flex-row sm:items-center sm:p-7">
            <div>
              <p className="text-xs font-bold tracking-wide text-emerald-300">WORKSPACE / {isPlatformAdmin ? 'PLATFORM' : 'BUSINESS'}</p>
              <h1 className="mt-2 text-2xl font-black sm:text-3xl">{visibleSectionItems.find((item) => item.id === activeSection)?.label || 'لوحة التحكم الاحترافية'}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                {isPlatformAdmin ? 'ملخص للبيانات المحملة من النظام وروابط إلى أدوات الإدارة الحالية.' : `مساحة ${currentBusiness?.name || 'نشاطك'}، مع حصر العرض في النشاط المرتبط بحسابك.`}
              </p>
            </div>
            {activeSection === 'activities' && isPlatformAdmin && <button onClick={() => openBusinessAdmin()} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-emerald-400"><Building2 className="h-4 w-4" /> إدارة / إضافة نشاط</button>}
          </header>

          {activeSection === 'overview' && (
            <>
              {(isPlatformAdmin || canViewBusinessAdminScreens) ? (
                <>
                                <section aria-label="مؤشرات لوحة التحكم" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                  <MetricCard label={isPlatformAdmin ? 'الأنشطة المسجلة' : 'نشاطك'} value={visibleBusinesses.length} detail="عدد سجلات الأنشطة ضمن نطاق العرض الحالي." icon={<Building2 className="h-5 w-5" />} />
                                  <MetricCard label="التشغيل النشط" value={activeBusinesses.length} detail="بحسب operationalStatus وحالة التجميد؛ لا يعني ذلك أن النشاط منشور للعامة." icon={<CheckCircle2 className="h-5 w-5" />} />
                                  <MetricCard label="غير النشطة" value={inactiveBusinesses.length} detail="أنشطة غير نشطة وفق حالة التشغيل المسجلة." icon={<CircleAlert className="h-5 w-5" />} />
                                  <MetricCard label="المجمّدة" value={frozenBusinesses.length} detail="وفق حالة التجميد المسجلة؛ لا يتم تعديل أي حالة من هنا." icon={<ShieldCheck className="h-5 w-5" />} />
                                  <MetricCard label="الكتالوجات المنشورة" value={publishedBusinesses.length} detail="بحسب أعلام النشر المسجلة فقط؛ لا يُستنتج النشر من حالة النشاط." icon={<Store className="h-5 w-5" />} />
                                  <MetricCard label="بانتظار النشر" value={pendingPublicationBusinesses.length} detail="الأنشطة التي تحمل حالة PENDING_PUBLICATION في السجل." icon={<CircleAlert className="h-5 w-5" />} />
                                  <MetricCard label="المنتجات والخدمات" value={visibleProducts.length} detail="عدد سجلات المنتجات والخدمات المحملة للأنشطة التي يحق للحساب رؤيتها." icon={<Package className="h-5 w-5" />} />
                                  {isPlatformAdmin && <MetricCard label="سجلات المشتركين" value={subscribers.length} detail="سجلات المشتركين المحملة، وقد لا تساوي عدد هويات Auth الفريدة." icon={<Users className="h-5 w-5" />} />}
                                </section>
                  
                                <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
                                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-2">
                                      <div><h3 className="font-black text-slate-900">توزيع الأنشطة حسب التصنيف</h3><p className="mt-1 text-xs text-slate-500">من سجلات الأنشطة المحملة حاليًا</p></div>
                                      <BarChart3 className="h-5 w-5 text-slate-500" />
                                    </div>
                                    {categoryDistribution.length ? <div className="mt-5 space-y-4">
                                      {categoryDistribution.map(([category, count]) => (
                                        <div key={category}>
                                          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm"><span className="truncate font-semibold text-slate-700">{category}</span><span className="shrink-0 font-black text-slate-900">{count}</span></div>
                                          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={`${category}: ${count} نشاط`}><div className="h-full rounded-full bg-emerald-600" style={{ width: `${Math.max(4, Math.round(count / Math.max(1, visibleBusinesses.length) * 100))}%` }} /></div>
                                        </div>
                                      ))}
                                    </div> : <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">لا توجد بيانات تصنيف لعرضها.</p>}
                                  </section>
                  
                                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-center justify-between gap-2"><div><h3 className="font-black text-slate-900">تنبيهات تحتاج متابعة</h3><p className="mt-1 text-xs text-slate-500">مبنية على حالات مسجلة، دون إنشاء تنبيهات وهمية</p></div><Bell className="h-5 w-5 text-slate-500" /></div>
                                    {alerts.length ? <ul className="mt-4 divide-y divide-slate-100">
                                      {alerts.slice(0, 5).map((business) => <li key={business.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" /><div className="min-w-0"><p className="font-bold text-slate-800">{business.name}</p><p className="mt-1 text-xs leading-5 text-slate-500">{business.isFrozen || business.operationalStatus === 'FROZEN' || business.paymentStatus === 'frozen' ? 'توجد حالة تجميد مسجلة.' : business.paymentStatus === 'overdue' ? 'حالة الدفع مسجلة كمتأخر؛ راجع السجل المعتمد.' : 'حالة التشغيل مسجلة كغير نشطة.'}</p></div></li>)}
                                    </ul> : <p className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900">لا توجد حالات تتطلب تنبيهًا ضمن البيانات المحملة.</p>}
                                  </section>
                                </div>
                  
                                <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                  <div className="flex items-start gap-3"><Activity className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" /><div><h3 className="font-black text-slate-900">سجل النشاط الأخير</h3><p className="mt-1 text-sm leading-6 text-slate-600">لم يتم تحميل سجل تدقيق موحد من مصدر خادمي في سياق هذه الشاشة؛ لذلك لا تُعرض عمليات تقديرية أو أحداث مصطنعة. ستظل سجلات الإدارة المعتمدة في وحداتها الحالية.</p></div></div>
                                </section>
                </>
              ) : (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="text-xs font-black text-emerald-700">مساحة عمل محدودة الصلاحيات</p>
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-xl font-black text-slate-900">{currentBusiness?.name || 'النشاط المرتبط بالحساب'}</h3>
                    <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">{authSession.membershipRole || 'عضوية نشاط'}</span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">تعرض هذه المساحة الوحدات المسموح بها في عضوية النشاط فقط. بيانات الدفع والاشتراكات وإدارة المنصة لا تظهر للعضويات المحدودة.</p>
                  {canViewCatalog && <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <MetricCard label="المنتجات والخدمات المحملة" value={visibleProducts.length} detail="عدد سجلات الكتالوج المحملة للنشاط المرتبط بالعضوية." icon={<Package className="h-5 w-5" />} />
                    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5"><h4 className="font-black text-slate-900">الكتالوج</h4><p className="mt-2 text-sm leading-6 text-slate-600">يمكنك استعراض بيانات الكتالوج التي تسمح بها عضويتك. لا تُتاح إجراءات التحرير من هذه الشاشة.</p></article>
                  </div>}
                  <div className="mt-5">
                    <h4 className="text-sm font-black text-slate-900">الوحدات المصرح بها</h4>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {canViewCatalog && <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">الكتالوج</span>}
                      {canViewOrders && <span className="rounded-full bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800">الطلبات</span>}
                      {canViewCustomers && <span className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-bold text-violet-800">العملاء</span>}
                      {canViewEmployees && <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">الموظفون</span>}
                      {canViewSettings && <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-800">الإعدادات</span>}
                      {canViewReports && <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-800">التقارير</span>}
                    </div>
                  </div>
                </section>
              )}
            </>
          )}

          {activeSection === 'activities' && (
            <>
              {(isPlatformAdmin || isBusinessManager) ? (
                <>
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                                  <label className="relative block"><span className="mb-1.5 block text-xs font-bold text-slate-600">بحث النشاط</span><Search className="pointer-events-none absolute right-3 top-10 h-4 w-4 text-slate-400" /><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="الاسم أو التصنيف أو المنطقة" className="min-h-11 w-full rounded-xl border border-slate-300 bg-white pr-9 pl-3 text-sm outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100" /></label>
                                  <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">حالة التشغيل</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-600"><option value="all">كل الحالات</option><option value="active">نشط</option><option value="inactive">غير نشط</option><option value="frozen">مجمّد</option></select></label>
                                  <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">التصنيف</span><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-600"><option value="all">كل التصنيفات</option>{categories.map((category) => <option value={category} key={category}>{category}</option>)}</select></label>
                                  <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600">المحافظة</span><select value={governorateFilter} onChange={(event) => setGovernorateFilter(event.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-600"><option value="all">كل المحافظات</option>{governorates.map((governorate) => <option value={governorate} key={governorate}>{governorate}</option>)}</select></label>
                                </div>
                                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><span>النتائج: {filteredBusinesses.length} من {visibleBusinesses.length}</span><button type="button" onClick={() => { setSearchText(''); setStatusFilter('all'); setCategoryFilter('all'); setGovernorateFilter('all'); }} className="min-h-9 rounded-lg border border-slate-300 px-3 font-bold text-slate-700 hover:bg-slate-50">مسح الفلاتر</button></div>
                                {filteredBusinesses.length ? <div className="mt-3 overflow-hidden rounded-xl border border-slate-200"><div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto_minmax(0,0.9fr)_auto] gap-3 bg-slate-50 px-4 py-3 text-xs font-black text-slate-500 md:grid"><span>النشاط</span><span>الموقع</span><span>حالة التشغيل والنشر</span><span>حالة الاشتراك</span><span>الإجراء</span></div><ul className="divide-y divide-slate-100">
                                  {filteredBusinesses.map((business) => { const state = businessState(business); const payment = paymentState(business); const publication = publicationState(business); return <li key={business.id} className="grid grid-cols-1 gap-3 p-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_auto_minmax(0,0.9fr)_auto] md:items-center">
                                    <div className="min-w-0"><p className="break-words font-black text-slate-900">{business.name}</p><p className="mt-1 break-words text-xs text-slate-500">{business.category || 'غير مصنف'}</p></div>
                                    <p className="break-words text-sm text-slate-600">{[business.governorate, business.markaz, business.village].filter(Boolean).join(' / ') || 'لم يحدد الموقع'}</p>
                                    <div className="flex flex-wrap items-center gap-2"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${state.className}`}>{state.label}</span><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${publication.className}`}>{publication.label}</span></div>
                                    <div className="text-xs font-bold"><span className={payment.className}>{payment.label}</span>{business.paymentDueDate && <p className="mt-1 font-normal text-slate-500">الاستحقاق: {business.paymentDueDate}</p>}</div>
                                    <button type="button" onClick={() => openBusinessAdmin(business)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-bold text-slate-700 hover:border-emerald-500 hover:text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-600"><ExternalLink className="h-4 w-4" /> فتح الإدارة</button>
                                  </li>; })}
                                </ul></div> : <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-8 text-center"><ClipboardList className="mx-auto h-7 w-7 text-slate-400" /><p className="mt-2 font-bold text-slate-700">لا توجد نتائج مطابقة</p><p className="mt-1 text-sm text-slate-500">غيّر البحث أو الفلاتر لعرض نتائج أخرى.</p></div>}
                              </section>
                </>
              ) : (
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div><h3 className="text-lg font-black text-slate-900">كتالوج النشاط</h3><p className="mt-1 text-sm text-slate-500">{currentBusiness?.name || 'النشاط المرتبط بالعضوية'} — عرض فقط</p></div>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700">{visibleProducts.length} منتج / خدمة</span>
                  </div>
                  {canViewCatalog ? (visibleProducts.length ? (
                    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
                      <ul className="divide-y divide-slate-100">
                        {visibleProducts.map((product) => <li key={product.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0"><p className="break-words font-bold text-slate-900">{product.name}</p><p className="mt-1 text-xs text-slate-500">{product.category || (product.type === 'service' ? 'خدمة' : 'منتج')}</p>{product.description && <p className="mt-1 text-sm leading-5 text-slate-600">{product.description}</p>}</div>
                          <div className="flex shrink-0 items-center gap-2 text-sm"><span className="font-black text-slate-900">{product.requiresQuote ? 'السعر عند الطلب' : `${Number(product.price || 0).toLocaleString('ar-EG')} ج.م`}</span><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${product.isAvailable ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{product.isAvailable ? 'متاح' : 'غير متاح'}</span></div>
                        </li>)}
                      </ul>
                    </div>
                  ) : <p className="mt-4 rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">لا توجد منتجات أو خدمات محملة لهذا النشاط.</p>) : <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">لا تتضمن عضويتك إذن عرض الكتالوج.</p>}
                </section>
              )}
            </>
          )}

          {activeSection === 'reports' && (
            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-black text-slate-900">ملخص الحالات</h3><p className="mt-1 text-sm text-slate-500">يعرض الحالة الحالية المسجلة فقط، ولا يستنتج تاريخيًا نموًا أو إيرادات.</p><div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"><div className="rounded-xl bg-emerald-50 p-4"><p className="text-xs font-bold text-emerald-900">نشطة</p><p className="mt-1 text-2xl font-black text-emerald-950">{activeBusinesses.length}</p></div><div className="rounded-xl bg-slate-100 p-4"><p className="text-xs font-bold text-slate-700">غير نشطة</p><p className="mt-1 text-2xl font-black text-slate-900">{inactiveBusinesses.length}</p></div><div className="rounded-xl bg-rose-50 p-4"><p className="text-xs font-bold text-rose-900">مجمّدة</p><p className="mt-1 text-2xl font-black text-rose-950">{frozenBusinesses.length}</p></div></div></section>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div><h3 className="font-black text-slate-900">تسجيل الأنشطة خلال آخر {trendMonths} أشهر</h3><p className="mt-1 text-sm text-slate-500">يعتمد على تاريخ إنشاء النشاط المسجل، ولا يقدّم تقديرًا للزيارات أو المبيعات.</p></div>
                  <label className="block min-w-40"><span className="mb-1.5 block text-xs font-bold text-slate-600">الفترة الزمنية</span><select value={trendMonths} onChange={(event) => setTrendMonths(Number(event.target.value) as 3 | 6 | 12)} className="min-h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold focus:border-emerald-600"><option value={3}>آخر 3 أشهر</option><option value={6}>آخر 6 أشهر</option><option value={12}>آخر 12 شهرًا</option></select></label>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                  {activityTrend.map((month) => {
                    const maxCount = Math.max(1, ...activityTrend.map((item) => item.count));
                    const width = month.count ? Math.max(5, Math.round((month.count / maxCount) * 100)) : 0;
                    return <div key={month.label} className="rounded-xl bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-2"><span className="text-xs font-bold text-slate-600">{month.label}</span><span className="text-sm font-black text-slate-900">{month.count}</span></div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" role="img" aria-label={`${month.label}: ${month.count} نشاط جديد`}><div className="h-full rounded-full bg-indigo-600" style={{ width: `${width}%` }} /></div>
                    </div>;
                  })}
                </div>
                {activityTrend.every((month) => month.count === 0) && <p className="mt-3 text-xs leading-5 text-slate-500">لا توجد سجلات بتواريخ إنشاء صالحة خلال الفترة المعروضة.</p>}
              </section>
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><h3 className="font-black text-slate-900">التوزيع حسب التصنيف</h3>{categoryDistribution.length ? <ul className="mt-3 divide-y divide-slate-100">{categoryDistribution.map(([category, count]) => <li key={category} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="font-semibold text-slate-700">{category}</span><span className="rounded-lg bg-slate-100 px-3 py-1 font-black text-slate-900">{count}</span></li>)}</ul> : <p className="mt-3 text-sm text-slate-500">لا توجد بيانات كافية.</p>}</section>
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">التقارير الزمنية وحركة المدفوعات وسجل التدقيق ليست متاحة هنا إلا بعد ربط مصدر موثوق واختبار نطاق الصلاحيات. لا تُعرض أرقام مالية أو أحداث غير مؤكدة.</p>
            </div>
          )}

          {activeSection === 'access' && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-slate-600" /><div><h3 className="font-black text-slate-900">إدارة المستخدمين والصلاحيات</h3><p className="mt-1 text-sm leading-6 text-slate-600">{isPlatformAdmin ? 'استخدم مركز التحكم الحالي لإدارة الأدوار المخصصة وإسناد الصلاحيات وسجل التدقيق، أو افتح إدارة المشتركين.' : 'إدارة الموظفين والصلاحيات تظل داخل وحدة موظفي نشاطك الحالية، ولا تُعرض لك بيانات أنشطة أخرى.'}</p></div></div>
              {isPlatformAdmin ? (
                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" onClick={() => openPlatformControlTab('roles')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800">إدارة الأدوار والصلاحيات <ExternalLink className="h-4 w-4" /></button>
                  <button type="button" onClick={() => openPlatformControlTab('audit')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:border-emerald-500">سجل التدقيق الفعلي <ClipboardList className="h-4 w-4" /></button>
                  <button type="button" onClick={() => openBusinessAdmin(undefined, 'subscribers')} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:border-emerald-500">إدارة المشتركين <Users className="h-4 w-4" /></button>
                </div>
              ) : canViewEmployees && currentBusiness ? (
                <div className="mt-5">
                  <p className="mb-3 text-sm leading-6 text-slate-600">{canManageEmployees ? 'يمكنك إدارة الوظائف والموظفين ضمن الصلاحيات الحالية.' : 'عرض فقط: لا تظهر أدوات إنشاء الوظائف أو تعديل الموظفين أو تغيير حالاتهم.'}</p>
                  <BusinessEmployeeManager business={currentBusiness} readOnly={!canManageEmployees} />
                </div>
              ) : (
                <p role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">لا تتضمن عضويتك صلاحية عرض وحدة الموظفين. لم يتم فتح لوحة الإدارة العامة.</p>
              )}
              <p className="mt-4 text-xs leading-5 text-slate-500">لا ينشئ هذا القسم نظام صلاحيات موازيًا؛ التحقق النهائي من حدود الخادم وRLS ما زال مطلوبًا.</p>
            </section>
          )}

          {activeSection === 'settings' && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3"><Settings2 className="mt-0.5 h-6 w-6 shrink-0 text-slate-600" /><div><h3 className="font-black text-slate-900">الإعدادات وإدارة النظام</h3><p className="mt-1 text-sm leading-6 text-slate-600">تُدار الإعدادات المعتمدة من شاشة الإدارة الحالية حتى لا يتم إنشاء إعدادات متوازية أو غير محفوظة.</p></div></div>
              {(isPlatformAdmin || isBusinessManager) ? (
                <button type="button" onClick={() => openBusinessAdmin(undefined, 'settings', 'profile')} className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white hover:bg-slate-800">{isPlatformAdmin ? 'فتح إعدادات المنصة الحالية' : 'فتح إعدادات النشاط الحالية'}<ExternalLink className="h-4 w-4" /></button>
              ) : canViewSettings && currentBusiness ? (
                <dl className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 sm:grid-cols-2">
                  <div><dt className="text-xs font-bold text-slate-500">اسم النشاط</dt><dd className="mt-1 break-words text-sm font-bold text-slate-900">{currentBusiness.name || 'غير مسجل'}</dd></div>
                  <div><dt className="text-xs font-bold text-slate-500">التصنيف</dt><dd className="mt-1 break-words text-sm font-bold text-slate-900">{currentBusiness.category || 'غير مسجل'}</dd></div>
                  <div><dt className="text-xs font-bold text-slate-500">الموقع</dt><dd className="mt-1 break-words text-sm font-bold text-slate-900">{[currentBusiness.governorate, currentBusiness.markaz, currentBusiness.village].filter(Boolean).join(' / ') || 'غير مسجل'}</dd></div>
                  <div><dt className="text-xs font-bold text-slate-500">ساعات العمل</dt><dd className="mt-1 break-words text-sm font-bold text-slate-900">{currentBusiness.workingHours || 'غير مسجلة'}</dd></div>
                </dl>
              ) : (
                <p role="status" className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">لا تتضمن عضويتك صلاحية عرض بيانات الإعدادات. لا يتم فتح لوحة الإدارة العامة.</p>
              )}
              {!isPlatformAdmin && !canViewBusinessAdminScreens && canViewSettings && <p className="mt-3 text-xs leading-5 text-slate-500">عرض فقط؛ تعديل إعدادات النشاط غير متاح من هذه الشاشة لأن وحدة الإعدادات القديمة لا تطبق بعد صلاحيات الموظفين تفصيليًا.</p>}
            </section>
          )}

          <footer className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs leading-6 text-slate-600"><strong>حدود التحقق:</strong> تعتمد هذه اللوحة على البيانات المحملة من التطبيق؛ لا تحل محل تفويض الخادم أو سياسات RLS. بيانات البناء والصلاحيات المتكاملة والنشر تُعتبر غير متحققة حتى تكتمل الاختبارات وتُراجع نتائجها.</footer>
        </div>
      </div>
    </main>
  );
};
