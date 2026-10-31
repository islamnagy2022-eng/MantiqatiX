import React, { lazy, Suspense } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { DirectoryView } from './components/DirectoryView';
import { MessageCircle } from 'lucide-react';
import { canAccessMerchantDashboard, canAccessProfessionalDashboard } from './utils/dashboardAccess';

// Keep the public directory in the initial bundle. Load less frequently used
// screens only when requested, so dashboard and modal code do not delay first paint.
const BusinessProfileHeader = lazy(() => import('./components/storefront/BusinessProfileHeader').then((module) => ({ default: module.BusinessProfileHeader })));
const CatalogSection = lazy(() => import('./components/storefront/CatalogSection').then((module) => ({ default: module.CatalogSection })));
const MerchantDashboard = lazy(() => import('./components/merchant/MerchantDashboard').then((module) => ({ default: module.MerchantDashboard })));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard').then((module) => ({ default: module.AdminDashboard })));
const ProfessionalDashboard = lazy(() => import('./modules/dashboard/ProfessionalDashboard').then((module) => ({ default: module.ProfessionalDashboard })));
const SubscriberAccountPortal = lazy(() => import('./modules/account/SubscriberAccountPortal').then((module) => ({ default: module.SubscriberAccountPortal })));
const CartDrawer = lazy(() => import('./components/cart/CartDrawer').then((module) => ({ default: module.CartDrawer })));
const LoginModal = lazy(() => import('./components/auth/LoginModal').then((module) => ({ default: module.LoginModal })));

const ScreenFallback = () => (
  <div role="status" aria-live="polite" className="mx-auto mt-4 w-[calc(100%-2rem)] max-w-7xl rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
    جارٍ تجهيز الشاشة…
  </div>
);

const MainContent: React.FC = () => {
  const {
    currentView, adminSettings, currentBusiness, requestCatalogViaAdminWhatsApp,
    authSession, authLoading, isCartOpen, isLoginModalOpen,
  } = useApp();
  const params = new URLSearchParams(window.location.search);
  const hasDirectPublicCatalogLink = params.has('store') || params.has('businessId');
  const catalogRequestUrl = requestCatalogViaAdminWhatsApp(currentBusiness);

  // Never expose a dashboard without a production role. Guests may view a
  // storefront only through its direct share link, never through a generic tab.
  const visibleView = authLoading
    ? (currentView === 'public_storefront' && hasDirectPublicCatalogLink ? 'public_storefront' : 'directory')
    : currentView === 'super_admin' && authSession.role !== 'admin'
      ? 'directory'
      : currentView === 'merchant_admin' &&
          (!canAccessMerchantDashboard(authSession) || !currentBusiness)
        ? 'directory'
        : currentView === 'professional_dashboard' &&
          !canAccessProfessionalDashboard(authSession)
        ? 'directory'
        : currentView === 'account_portal' && !authSession.isAuthenticated
          ? 'directory'
        : currentView === 'public_storefront' &&
            authSession.role === 'guest' && !hasDirectPublicCatalogLink
          ? 'directory'
          : currentView;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/70 text-slate-800">
      <Navbar />

      {authLoading && !hasDirectPublicCatalogLink && (
        <div role="status" aria-live="polite" className="mx-auto mt-3 w-[calc(100%-2rem)] max-w-7xl rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900">
          جارٍ التحقق من تسجيل الدخول وتجهيز الصلاحيات… يمكنك تصفح الأنشطة المنشورة أثناء ذلك.
        </div>
      )}

      <main className="flex-1">
        {visibleView === 'directory' && <DirectoryView />}

        {visibleView === 'public_storefront' && (
          <Suspense fallback={<ScreenFallback />}>
            <div>
              <BusinessProfileHeader />
              <CatalogSection />
            </div>
          </Suspense>
        )}

        {visibleView === 'merchant_admin' && (
          <Suspense fallback={<ScreenFallback />}><MerchantDashboard /></Suspense>
        )}

        {visibleView === 'super_admin' && (
          <Suspense fallback={<ScreenFallback />}><AdminDashboard /></Suspense>
        )}

        {visibleView === 'professional_dashboard' && (
          <Suspense fallback={<ScreenFallback />}><ProfessionalDashboard /></Suspense>
        )}

        {visibleView === 'account_portal' && (
          <Suspense fallback={<ScreenFallback />}><SubscriberAccountPortal /></Suspense>
        )}
      </main>

      {isCartOpen && <Suspense fallback={null}><CartDrawer /></Suspense>}
      {isLoginModalOpen && <Suspense fallback={null}><LoginModal /></Suspense>}

      <footer className="bg-white border-t border-slate-200 mt-auto py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-2">
              <span className="font-black text-slate-900 text-sm">منصة MantiqatiX</span>
              <span>•</span>
              <span>كتالوج إلكتروني متصل بالواتساب ومستقل لكل نشاط</span>
            </div>

            <div className="flex items-center gap-4 flex-wrap justify-center">
              <span>حد المنتجات: 150 منتج/خدمة لكل مشترك</span>
              <span>•</span>
              <span>العملة: الجنيه المصري ({adminSettings.currency || 'ج.م'})</span>
              <span>•</span>
              {catalogRequestUrl && (
                <a
                  href={catalogRequestUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-700 hover:text-emerald-800 font-bold flex items-center gap-1"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>واتساب إدارة MantiqatiX ({adminSettings.adminWhatsApp})</span>
                </a>
              )}
            </div>

            <div className="text-slate-400">جميع الحقوق محفوظة © {new Date().getFullYear()} MantiqatiX</div>
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
