import React from 'react';
import { ArrowRight, HeartPulse, LayoutDashboard, Map, MessageCircle, Search, ShieldCheck, Store } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { canAccessMerchantDashboard, canAccessProfessionalDashboard } from '../utils/dashboardAccess';

type SiteEntry = { title: string; description: string; icon: React.ReactNode; onOpen: () => void };

export const SiteMapView: React.FC = () => {
  const { authSession, currentBusiness, setCurrentView, setIsLoginModalOpen } = useApp();
  const isAdmin = authSession.role === 'admin';
  const entries: SiteEntry[] = [
    { title: 'دليل الأنشطة والبحث', description: 'تصفح الأنشطة الحقيقية المنشورة وابحث حسب النشاط والتخصص والموقع.', icon: <Search className="h-5 w-5" />, onOpen: () => setCurrentView('directory') },
    { title: 'الدليل الطبي', description: 'ابحث في الأنشطة الطبية المنشورة حسب النوع والتخصص والمحافظة والمركز.', icon: <HeartPulse className="h-5 w-5" />, onOpen: () => setCurrentView('medical_directory') },
    { title: 'سوق الأنشطة والعروض', description: 'اكتشف الأنشطة الموثقة والإعلانات والعروض المسجلة فعليًا في الكتالوج.', icon: <Store className="h-5 w-5" />, onOpen: () => setCurrentView('marketplace_home') },
    { title: 'تواصل معنا', description: 'جهّز استفسارك أو طلبك وأرسله مباشرة إلى واتساب إدارة المنصة.', icon: <MessageCircle className="h-5 w-5" />, onOpen: () => setCurrentView('contact_us') },
  ];
  if (authSession.role !== 'guest' && currentBusiness) {
    entries.push({ title: 'صفحة النشاط والكتالوج', description: 'معاينة صفحة النشاط ومنتجاته وخدماته المنشورة.', icon: <Store className="h-5 w-5" />, onOpen: () => setCurrentView('public_storefront') });
  }
  if (canAccessMerchantDashboard(authSession)) {
    entries.push({ title: 'لوحة صاحب النشاط', description: 'إدارة الكتالوج وبيانات النشاط والموظفين.', icon: <LayoutDashboard className="h-5 w-5" />, onOpen: () => setCurrentView('merchant_admin') });
  }
  if (canAccessProfessionalDashboard(authSession)) {
    entries.push({ title: 'الداشبورد الاحترافية', description: 'مساحة تشغيل النشاط حسب الصلاحيات والعضوية الحالية.', icon: <LayoutDashboard className="h-5 w-5" />, onOpen: () => setCurrentView('professional_dashboard') });
  }
  if (isAdmin) {
    entries.push({ title: 'مركز إدارة المنصة', description: 'إدارة الأنشطة والمشتركين والإعدادات والصلاحيات وفق صلاحيات الإدارة.', icon: <ShieldCheck className="h-5 w-5" />, onOpen: () => setCurrentView('super_admin') });
  }

  return (
    <div dir="rtl" className="mx-auto w-full max-w-7xl space-y-7 px-4 py-7 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-indigo-900/20 bg-gradient-to-l from-slate-950 via-indigo-950 to-emerald-950 p-6 text-white shadow-xl sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-400/10 px-3 py-1 text-xs font-black text-emerald-200"><Map className="h-4 w-4" /> خريطة الموقع</span>
        <h1 className="mt-3 text-2xl font-black sm:text-3xl">كل أقسام MantiqatiX في مكان واحد</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-300">روابط الشاشات المتاحة حاليًا بحسب نوع الحساب والصلاحيات الفعلية. لا تظهر هنا أدوات لا يملك حسابك صلاحية فتحها.</p>
        <button type="button" onClick={() => setCurrentView('directory')} className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-black text-white hover:bg-white/15"><ArrowRight className="h-4 w-4" /> العودة للدليل</button>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((entry) => (
          <button key={entry.title} type="button" onClick={entry.onOpen} className="group flex min-h-36 items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-800 group-hover:bg-emerald-100">{entry.icon}</span>
            <span className="min-w-0"><strong className="block text-sm font-black text-slate-900">{entry.title}</strong><span className="mt-2 block text-xs leading-6 text-slate-500">{entry.description}</span></span>
          </button>
        ))}
      </section>

      {!authSession.isAuthenticated && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 text-center">
          <p className="text-sm font-bold text-slate-800">تحتاج إلى تسجيل الدخول للوصول إلى أدوات إدارة النشاط.</p>
          <button type="button" onClick={() => setIsLoginModalOpen(true)} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2 text-xs font-black text-white hover:bg-emerald-800">تسجيل الدخول</button>
        </section>
      )}
    </div>
  );
};
