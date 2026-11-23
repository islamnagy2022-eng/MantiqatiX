import React, { lazy, Suspense, useEffect } from 'react';
import { resolveRouteSeoMetadata, applyRouteSeoMetadata } from './utils/seoMetadata';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { DirectoryView } from './components/DirectoryView';
import { MessageCircle } from 'lucide-react';
import { canAccessMerchantDashboard, canAccessProfessionalDashboard } from './utils/dashboardAccess';

const MarketplaceHome = lazy(() => import('./components/MarketplaceHome').then((module) => ({ default: module.MarketplaceHome })));
const BusinessProfileHeader = lazy(() => import('./components/storefront/BusinessProfileHeader').then((module) => ({ default: module.BusinessProfileHeader })));
const CatalogSection = lazy(() => import('./components/storefront/CatalogSection').then((module) => ({ default: module.CatalogSection })));
const MerchantDashboard = lazy(() => import('./components/merchant/MerchantDashboard').then((module) => ({ default: module.MerchantDashboard })));
const AdminDashboard = lazy(() => import('./components/admin/AdminDashboard').then((module) => ({ default: module.AdminDashboard })));
const ProfessionalDashboard = lazy(() => import('./modules/dashboard/ProfessionalDashboard').then((module) => ({ default: module.ProfessionalDashboard })));
const ContactUsView = lazy(() => import('./components/ContactUsView').then((module) => ({ default: module.ContactUsView })));
const SiteMapView = lazy(() => import('./components/SiteMapView').then((module) => ({ default: module.SiteMapView })));
const CartDrawer = lazy(() => import('./components/cart/CartDrawer').then((module) => ({ default: module.CartDrawer })));
const LoginModal = lazy(() => import('./components/auth/LoginModal').then((module) => ({ default: module.LoginModal })));
const SubscriberAccountPortal = lazy(() => import('./modules/account/SubscriberAccountPortal').then((module) => ({ default: module.SubscriberAccountPortal })));
const SupportAssistant = lazy(() => import('./components/SupportAssistant').then((module) => ({ default: module.SupportAssistant })));

const ScreenFallback = () => (
  <div role="status" aria-live="polite" className="mx-auto mt-4 w-[calc(100%-2rem)] max-w-7xl rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
    جارٍ تجهيز الشاشة…
  </div>
);

const MainContent: React.FC = () => {
  const { currentView, setCurrentView, adminSettings, currentBusiness, categories, requestCatalogViaAdminWhatsApp, authSession, authLoading, isCartOpen, isLoginModalOpen } = useApp();
  const params = new URLSearchParams(window.location.search);
  const hasDirectPublicCatalogLink = params.has('store') || params.has('businessId');
  const catalogRequestUrl = requestCatalogViaAdminWhatsApp(currentBusiness);
  const useFooterNavigate = (view: 'contact_us' | 'site_map') => setCurrentView(view);
  // Keep the AI support entry point hidden until the server-side rate limit and deployed Edge contract are released.
  const isAiSupportEnabled = import.meta.env.VITE_AI_SUPPORT_ENABLED === 'true';

  useEffect(() => {
    const applyCurrentRouteSeo = () => {
      const canonicalOrigin = String(import.meta.env.VITE_CANONICAL_ORIGIN || 'https://islamnagy2022-eng.github.io').replace(/\/$/, '');
      const basePath = import.meta.env.BASE_URL || '/';
      const normalizedBasePath = basePath.endsWith('/') ? basePath : basePath + '/';
      const isCanonicalProductionRoute = import.meta.env.PROD && window.location.origin === canonicalOrigin && window.location.pathname === normalizedBasePath;
      const params = new URLSearchParams(window.location.search);
      const activityId = params.get('activity') || undefined;
      const activityCategory = activityId ? categories.find((category) => category.id === activityId) : undefined;
      const requestedSpecialty = params.get('specialty') || '';
      const specialtyName = activityCategory?.specialties?.find((specialty) => specialty === requestedSpecialty);
      const metadata = resolveRouteSeoMetadata({
        view: visibleView, business: currentBusiness, origin: canonicalOrigin, basePath: normalizedBasePath,
        allowIndexing: isCanonicalProductionRoute, activityId: activityCategory?.id, activityName: activityCategory?.name, specialtyName,
      });
      applyRouteSeoMetadata(metadata);
    };
    applyCurrentRouteSeo();
    window.addEventListener('popstate', applyCurrentRouteSeo);
    window.addEventListener('mantiqatix:routechange', applyCurrentRouteSeo);
    return () => {
      window.removeEventListener('popstate', applyCurrentRouteSeo);
      window.removeEventListener('mantiqatix:routechange', applyCurrentRouteSeo);
    };
  }, [visibleView, currentBusiness?.id, currentBusiness?.name, currentBusiness?.bio, currentBusiness?.category, currentBusiness?.governorate, currentBusiness?.markaz, currentBusiness?.isVerified, currentBusiness?.isFrozen, currentBusiness?.publicationStatus, categories]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/70 text-slate-800">
      <Navbar />

      {authLoading && !hasDirectPublicCatalogLink && (
        <div role="status" aria-live="polite" className="mx-auto mt-3 w-[calc(100%-2rem)] max-w-7xl rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900">
          جارٍ التحقق من تسجيل الدخول وتجهيز الصلاحيات… يمكنك تصفح الأنشطة المنشورة أثناء ذلك.
        </div>
      )}

      <main className="flex-1">
        {/* Isolated Business Storefront: Opens directly for the specific business without seeing other businesses or external taxonomy bars */}
        {visibleView === 'directory' && <DirectoryView />}

        {visibleView === 'marketplace_home' && (
          <Suspense fallback={<ScreenFallback />}><MarketplaceHome /></Suspense>
        )}

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

        {visibleView === 'contact_us' && (
          <Suspense fallback={<ScreenFallback />}><ContactUsView /></Suspense>
        )}

        {visibleView === 'site_map' && (
          <Suspense fallback={<ScreenFallback />}><SiteMapView /></Suspense>
        )}
      </main>

      {isCartOpen && (
        <Suspense fallback={null}><CartDrawer /></Suspense>
      )}
      {isLoginModalOpen && (
        <Suspense fallback={null}><LoginModal /></Suspense>
      )}

      <Suspense fallback={null}>{isAiSupportEnabled ? <SupportAssistant /> : null}</Suspense>

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
              <button type="button" onClick={() => useFooterNavigate('site_map')} className="font-bold text-slate-600 hover:text-emerald-700">خريطة الموقع</button>
              <span>•</span>
              <button type="button" onClick={() => useFooterNavigate('contact_us')} className="font-bold text-slate-600 hover:text-emerald-700">تواصل معنا</button>
              <span>•</span>
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
