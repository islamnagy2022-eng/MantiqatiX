import React from 'react';
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

const MainContent: React.FC = () => {
  const { currentView, adminSettings, currentBusiness, requestCatalogViaAdminWhatsApp, authSession, authLoading } = useApp();
  const params = new URLSearchParams(window.location.search);
  const hasDirectPublicCatalogLink = params.has('store') || params.has('businessId');

  // Never expose a dashboard without a production role. Guests may view a
  // storefront only through its direct share link, never through a generic tab.
  const visibleView = authLoading
    ? (currentView === 'public_storefront' && hasDirectPublicCatalogLink ? 'public_storefront' : 'directory')
    : currentView === 'super_admin' && authSession.role !== 'admin'
      ? 'directory'
      : currentView === 'merchant_admin' &&
          (!['subscriber', 'admin'].includes(authSession.role) || !currentBusiness)
        ? 'directory'
        : currentView === 'public_storefront' &&
            authSession.role === 'guest' && !hasDirectPublicCatalogLink
          ? 'directory'
          : currentView;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/70 text-slate-800">
      <Navbar />

      <main className="flex-1">
        {/* Isolated Business Storefront: Opens directly for the specific business without seeing other businesses or external taxonomy bars */}
        {visibleView === 'directory' && <DirectoryView />}

        {visibleView === 'public_storefront' && (
          <div>
            <BusinessProfileHeader />
            <CatalogSection />
          </div>
        )}

        {visibleView === 'merchant_admin' && <MerchantDashboard />}

        {visibleView === 'super_admin' && <AdminDashboard />}
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
