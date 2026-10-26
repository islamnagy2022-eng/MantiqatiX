import React, { useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { BusinessProfileHeader } from './components/storefront/BusinessProfileHeader';
import { CatalogSection } from './components/storefront/CatalogSection';
import { MerchantDashboard } from './components/merchant/MerchantDashboard';
import { AdminDashboard } from './components/admin/AdminDashboard';
import { DirectoryView } from './components/DirectoryView';
import { CartDrawer } from './components/cart/CartDrawer';
import { LoginModal } from './components/auth/LoginModal';
import { FloatingAppInstallButton } from './components/common/FloatingAppInstallButton';
import { MessageCircle } from 'lucide-react';
import { canAccessView, defaultViewForRole } from './lib/access';

const MainContent: React.FC = () => {
  const { currentView, setCurrentView, authSession, adminSettings, currentBusiness, requestCatalogViaAdminWhatsApp } = useApp();
  const screenView = canAccessView(authSession.role, currentView) ? currentView : defaultViewForRole(authSession.role);

  useEffect(() => {
    if (screenView !== currentView) setCurrentView(screenView);
  }, [currentView, screenView, setCurrentView]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/70 text-slate-800">
      <Navbar />

      {(authSession.role === 'guest' && authSession.accessState === 'no_active_subscription') && (
        <section className="mx-auto mt-4 w-full max-w-7xl px-4 sm:px-6 lg:px-8" role="status" aria-live="polite">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
            <strong>لا توجد عضوية نشاط نشطة على حسابك.</strong>
            <span className="mr-1">يمكنك استكشاف الدليل والكتالوجات العامة. لا تظهر لوحة إدارة النشاط حتى يتم ربط عضوية نشطة ومعتمدة بحسابك.</span>
          </div>
        </section>
      )}
      {(authSession.role === 'guest' && authSession.accessState === 'verification_error') && (
        <section className="mx-auto mt-4 w-full max-w-7xl px-4 sm:px-6 lg:px-8" role="alert" aria-live="assertive">
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-900">
            <strong>تعذر التحقق من صلاحيات حسابك.</strong>
            <span className="mr-1">أبقينا لوحة النشاط والإدارة مغلقتين حتى لا تظهر بيانات غير مؤكدة. أعد تحميل الصفحة أو سجّل الخروج ثم حاول مرة أخرى.</span>
          </div>
        </section>
      )}
      <main className="flex-1">
        {/* Isolated Business Storefront: Opens directly for the specific business without seeing other businesses or external taxonomy bars */}
        {screenView === 'directory' && <DirectoryView />}

        {screenView === 'public_storefront' && (
          <div>
            <BusinessProfileHeader />
            <CatalogSection />
          </div>
        )}

        {screenView === 'merchant_admin' && (authSession.role === 'subscriber' || authSession.role === 'admin') && <MerchantDashboard />}

        {screenView === 'super_admin' && authSession.role === 'admin' && <AdminDashboard />}
      </main>

      <CartDrawer />
      <LoginModal />
      <FloatingAppInstallButton currentBusiness={currentBusiness} />

      {/* Modern MantiqatiX Footer */}
      <footer className="bg-white border-t border-slate-200 mt-auto py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-900 text-sm">
                منصة MantiqatiX
              </span>
              <span>•</span>
              <span>كتالوج إلكتروني متصل بالواتساب ومستقل لكل نشاط</span>
            </div>

            <div className="flex items-center gap-4 flex-wrap justify-center">
              <span>حد المنتجات: 150 منتج/خدمة لكل مشترك</span>
              <span>•</span>
              <span>العملة: الجنيه المصري ({adminSettings.currency || 'ج.م'})</span>
              <span>•</span>
              <a
                href={requestCatalogViaAdminWhatsApp(currentBusiness)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1"
              >
                <MessageCircle className="w-3.5 h-3.5" />
                <span>واتساب إدارة MantiqatiX ({adminSettings.adminWhatsApp})</span>
              </a>
            </div>

            <div className="text-slate-400">
              جميع الحقوق محفوظة © {new Date().getFullYear()} MantiqatiX
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  );
}
