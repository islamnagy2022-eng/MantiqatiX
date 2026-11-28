import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Boxes,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Database,
  Layers3,
  Settings2,
  ShieldCheck,
  Store,
  Tags,
  Users,
} from 'lucide-react';
import type { Business, Product, Subscriber } from '../../types';

export type AdminDashboardTab =
  | 'overview'
  | 'billing'
  | 'commissions'
  | 'taxonomy'
  | 'businesses'
  | 'subscribers'
  | 'directory_listings'
  | 'activity_modules'
  | 'settings'
  | 'control_center'
  | 'backup';

type Props = {
  businesses: Business[];
  subscribers: Subscriber[];
  subscribersLoading: boolean;
  subscriberDirectoryError?: string;
  refreshPlatformSubscribers: () => Promise<void>;
  products: Product[];
  onNavigate: (tab: AdminDashboardTab) => void;
};

const shortcuts: Array<{
  id: Exclude<AdminDashboardTab, 'overview'>;
  title: string;
  description: string;
  icon: React.ReactNode;
}> = [
  { id: 'businesses', title: 'إدارة الأنشطة', description: 'بيانات الأنشطة وحالات التشغيل والتوثيق', icon: <Building2 className="h-5 w-5" /> },
  { id: 'subscribers', title: 'المستخدمون والمشتركون', description: 'الحسابات والعضويات وحالات الوصول', icon: <Users className="h-5 w-5" /> },
  { id: 'billing', title: 'الاشتراكات والسداد', description: 'مراجعة الاستحقاقات وحالات السداد والتجميد', icon: <CircleDollarSign className="h-5 w-5" /> },
  { id: 'taxonomy', title: 'الأنشطة والتخصصات', description: 'تنظيم التصنيف الرئيسي والتخصصات', icon: <Tags className="h-5 w-5" /> },
  { id: 'directory_listings', title: 'دليل الأنشطة والمطالبات', description: 'مراجعة صفحات الدليل وطلبات الملكية', icon: <Store className="h-5 w-5" /> },
  { id: 'activity_modules', title: 'وحدات الأنشطة', description: 'إعداد وحدات وقدرات كل نشاط', icon: <Layers3 className="h-5 w-5" /> },
  { id: 'commissions', title: 'قواعد العمولات', description: 'مراجعة مسودات قواعد العمولات', icon: <FileText className="h-5 w-5" /> },
  { id: 'settings', title: 'إعدادات المنصة', description: 'إعدادات الإدارة ووسائل التواصل', icon: <Settings2 className="h-5 w-5" /> },
  { id: 'control_center', title: 'مركز التحكم والصلاحيات', description: 'الأدوار والإسناد والموظفون وسجل العمليات', icon: <ShieldCheck className="h-5 w-5" /> },
  { id: 'backup', title: 'التصدير المحدود والاستعادة', description: 'تصدير واستيراد البيانات المتاحة في لوحة الإدارة فقط', icon: <Database className="h-5 w-5" /> },
];

const MetricCard: React.FC<{
  label: string;
  value: number | string;
  hint: string;
  icon: React.ReactNode;
  tone: 'blue' | 'green' | 'amber' | 'rose';
  metricKey?: string;
}> = ({ label, value, hint, icon, tone, metricKey }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
  };
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-slate-500">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-slate-950" data-testid="admin-overview-metric" data-metric-key={metricKey} data-metric-value={String(value)}>{typeof value === 'number' ? value.toLocaleString('ar-EG') : value}</p>
        </div>
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</span>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-slate-500">{hint}</p>
    </article>
  );
};

export const AdminOverview: React.FC<Props> = ({ businesses, subscribers, subscribersLoading, subscriberDirectoryError, refreshPlatformSubscribers, products, onNavigate }) => {
  const activeSubscribers = subscribers.filter((subscriber) => subscriber.status === 'active').length;
  const publishedBusinesses = businesses.filter((business) =>
    business.catalogPublished === true &&
    business.publicEnabled === true &&
    business.operationalStatus === 'ACTIVE' &&
    !business.isFrozen
  ).length;
  const pendingPublication = businesses.filter((business) => business.publicationStatus === 'PENDING_PUBLICATION').length;
  const paymentAttention = businesses.filter((business) =>
    business.isFrozen || business.paymentStatus === 'overdue' || business.paymentStatus === 'frozen'
  ).length;

  const isFrozenBusiness = (business: Business) =>
    business.isFrozen === true ||
    business.operationalStatus === 'FROZEN' ||
    business.paymentStatus === 'frozen';
  const isUnspecifiedBusiness = (business: Business) =>
    business.operationalStatusUnspecified === true ||
    !['ACTIVE', 'INACTIVE', 'FROZEN'].includes(String(business.operationalStatus || '').toUpperCase());
  const activeBusinesses = businesses.filter((business) =>
    !isFrozenBusiness(business) && !isUnspecifiedBusiness(business) && business.operationalStatus === 'ACTIVE'
  ).length;
  const frozenBusinesses = businesses.filter(isFrozenBusiness).length;
  const inactiveBusinesses = businesses.filter((business) =>
    !isFrozenBusiness(business) && !isUnspecifiedBusiness(business) && business.operationalStatus === 'INACTIVE'
  ).length;
  // Missing or unrecognized operational states must remain visible as unknown, not silently become inactive.
  const unspecifiedBusinesses = Math.max(
    0,
    businesses.length - activeBusinesses - frozenBusinesses - inactiveBusinesses
  );
  const businessStatusRows = [
    { key: 'active', label: 'نشطة تشغيليًا', count: activeBusinesses, color: 'bg-emerald-500' },
    { key: 'frozen', label: 'مجمّدة', count: frozenBusinesses, color: 'bg-rose-500' },
    { key: 'inactive', label: 'غير نشطة', count: inactiveBusinesses, color: 'bg-slate-500' },
    { key: 'unspecified', label: 'غير محددة الحالة', count: unspecifiedBusinesses, color: 'bg-amber-500' },
  ];

  return (
    <section className="space-y-6" dir="rtl" data-testid="platform-admin-overview">
      <header className="rounded-3xl bg-gradient-to-l from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-lg sm:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-blue-200">
              <Activity className="h-4 w-4" />
              <span className="text-xs font-black">MantiqatiX · إدارة المنصة</span>
            </div>
            <h2 className="mt-3 text-2xl font-black sm:text-3xl">لوحة التحكم الرئيسية</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              نظرة تشغيلية مختصرة وروابط مباشرة إلى أدوات إدارة الأنشطة والمستخدمين والاشتراكات والصلاحيات.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('control_center')}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-900 hover:bg-blue-50"
          >
            <ShieldCheck className="h-4 w-4" />
            فتح مركز التحكم
            <ArrowLeft className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MetricCard label="الأنشطة المسجلة" value={businesses.length} hint="إجمالي سجلات الأنشطة المتاحة في جلسة الإدارة" tone="blue" icon={<Building2 className="h-5 w-5" />} />
        <MetricCard label="الكتالوجات المنشورة" value={publishedBusinesses} hint="نشر الكتالوج مؤكد وحالة النشاط نشطة وغير مجمدة ضمن البيانات المحمّلة" tone="green" icon={<Store className="h-5 w-5" />} metricKey="published-catalogs" />
        <MetricCard
          label="المشتركون النشطون"
          value={subscribersLoading ? 'جار التحميل' : subscriberDirectoryError ? 'غير متاح' : activeSubscribers}
          hint={subscribersLoading ? 'جار تحميل دليل المشتركين من الخادم' : subscriberDirectoryError ? 'تعذر تحميل الدليل؛ لم نعرض رقمًا تقديريًا' : `من إجمالي ${subscribers.length.toLocaleString('ar-EG')} حساب/عضوية محمّلة`}
          tone="blue"
          icon={<Users className="h-5 w-5" />}
        />
        <MetricCard label="منتجات وخدمات الكتالوج" value={products.length} hint="إجمالي عناصر الكتالوج المتاحة في جلسة الإدارة" tone="amber" icon={<Boxes className="h-5 w-5" />} />
      </div>

      {subscriberDirectoryError && !subscribersLoading && (
        <div role="status" className="flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <span>دليل المشتركين غير متاح حاليًا؛ لا تعتبر قيمة الصفر دليلًا على عدم وجود مشتركين.</span>
          <button type="button" onClick={() => void refreshPlatformSubscribers()} className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-2 font-black hover:bg-amber-100">
            إعادة تحميل المشتركين
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-indigo-700" />
            <h3 className="font-black text-slate-900">متابعة تحتاج مراجعة</h3>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button type="button" onClick={() => onNavigate('directory_listings')} className="rounded-xl border border-slate-200 p-3 text-right hover:border-indigo-300 hover:bg-indigo-50/50">
              <span className="block text-2xl font-black text-slate-900">{pendingPublication.toLocaleString('ar-EG')}</span>
              <span className="mt-1 block text-xs font-bold text-slate-600">طلبات نشر معلقة</span>
            </button>
            <button type="button" onClick={() => onNavigate('billing')} className="rounded-xl border border-slate-200 p-3 text-right hover:border-amber-300 hover:bg-amber-50/50">
              <span className="block text-2xl font-black text-slate-900">{paymentAttention.toLocaleString('ar-EG')}</span>
              <span className="mt-1 block text-xs font-bold text-slate-600">أنشطة عليها تنبيه سداد أو تجميد</span>
            </button>
          </div>
          <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-slate-500">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            الأرقام مؤشرات من البيانات المحمّلة فقط؛ لا تنفذ اللوحة تجميدًا آليًا أو قرار نشر تلقائيًا.
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-700" />
            <h3 className="font-black text-slate-900">حدود الإدارة الآمنة</h3>
          </div>
          <ul className="mt-3 space-y-2 text-xs leading-6 text-slate-600">
            <li>كل إجراء حساس يجب أن يمر عبر تحقق الصلاحيات في الخادم.</li>
            <li>الأدوار المفوضة لا تمنح صلاحية مالك المنصة.</li>
            <li>مؤشرات هذه الشاشة لا تعني اعتماد جاهزية الإنتاج أو اكتمال تكاملات الدفع.</li>
          </ul>
        </article>
      </div>

      <section
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        data-testid="admin-business-status-breakdown"
        aria-labelledby="admin-business-status-title"
      >
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 id="admin-business-status-title" className="text-lg font-black text-slate-900">التوزيع التشغيلي للأنشطة</h3>
            <p className="mt-1 text-xs text-slate-500">حالة الأنشطة ضمن السجلات المحمّلة في جلسة الإدارة الحالية.</p>
          </div>
          <span className="text-xs font-bold text-slate-600" data-testid="admin-business-status-total">
            {businesses.length.toLocaleString('ar-EG')} سجل
          </span>
        </header>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {businessStatusRows.map((row) => {
            const percent = businesses.length > 0 ? Math.round((row.count / businesses.length) * 100) : 0;
            return (
              <div
                key={row.key}
                className="rounded-xl border border-slate-100 p-3"
                data-testid={`admin-business-status-row-${row.key}`}
                data-count={row.count}
                data-percent={percent}
              >
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-bold text-slate-800">{row.label}</span>
                  <span className="shrink-0 text-xs font-black text-slate-700">
                    {row.count.toLocaleString('ar-EG')} · {percent}%
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    role="progressbar"
                    aria-label={row.label}
                    aria-valuemin={0}
                    aria-valuemax={Math.max(businesses.length, 1)}
                    aria-valuenow={row.count}
                    className={`h-full rounded-full ${row.color}`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[11px] leading-5 text-slate-500">
          السجلات التي لا تحتوي حالة تشغيل واضحة تظهر كـ «غير محددة» ولا تُحتسب تلقائيًا كنشطة أو غير نشطة. الأرقام ليست إحصاءً شاملًا خارج البيانات المحمّلة.
        </p>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-900">الوصول السريع للأقسام</h3>
            <p className="mt-1 text-xs text-slate-500">اختر القسم لفتح أدوات الإدارة الحالية.</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {shortcuts.map((item) => (
            <button
              key={item.id}
              type="button"
              data-testid={`admin-overview-shortcut-${item.id}`}
              onClick={() => onNavigate(item.id)}
              className="group flex min-h-28 items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 group-hover:bg-indigo-50 group-hover:text-indigo-700">{item.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-black text-slate-900">{item.title}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
              </span>
              <ArrowLeft className="mt-1 h-4 w-4 shrink-0 text-slate-400 group-hover:text-indigo-700" />
            </button>
          ))}
        </div>
      </section>

      <p className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[11px] leading-5 text-slate-600">
        تُحدَّث هذه المؤشرات عند تحميل بيانات إدارة المنصة أو إعادة تحديثها من الأقسام المختصة. لا تعرض هذه الشاشة بيانات مالية أو سجلات مستخدمين حساسة.
      </p>
    </section>
  );
};

export default AdminOverview;
