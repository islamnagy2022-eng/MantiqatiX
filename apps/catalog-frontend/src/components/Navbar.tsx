import React from 'react';
import { useApp } from '../context/AppContext';
import { FloatingAppInstallButton } from './common/FloatingAppInstallButton';
import {
  Store,
  ShoppingBag,
  Sparkles,
  LogIn,
  LogOut,
  UserCheck,
  Crown,
  FileText,
  ExternalLink,
  Layers,
  Megaphone,
} from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    businesses,
    selectedBusinessId,
    setSelectedBusinessId,
    currentBusiness,
    cartItems,
    setIsCartOpen,
    authSession,
    authLoading,
    authBootstrapError,
    adminSettings,
    logout,
    setIsLoginModalOpen,
    requestCatalogViaAdminWhatsApp,
  } = useApp();

  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const catalogRequestUrl = requestCatalogViaAdminWhatsApp(currentBusiness);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      {/* Top Banner with Platform Context */}
      <div className="bg-slate-900 text-slate-300 text-xs py-1.5 px-2 sm:px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <Sparkles className="w-3 h-3 ml-1 text-emerald-400" />
              منصة MantiqatiX الذكية
            </span>
            <div
              className="mantiqati-ticker min-w-0 flex-1 overflow-hidden text-slate-300"
              aria-label="رسائل تعريفية وتسويقية عن منصة منطقتي X"
            >
              <style>{`
                @keyframes mantiqati-ticker-ltr {
                  from { transform: translateX(-50%); }
                  to { transform: translateX(0); }
                }
                .mantiqati-ticker-track {
                  display: flex;
                  width: max-content;
                  animation: mantiqati-ticker-ltr 36s linear infinite;
                }
                .mantiqati-ticker:hover .mantiqati-ticker-track {
                  animation-play-state: paused;
                }
                @media (prefers-reduced-motion: reduce) {
                  .mantiqati-ticker-track { animation: none; }
                }
              `}</style>
              <div className="mantiqati-ticker-track w-max">
                <div className="flex shrink-0 items-center gap-8 whitespace-nowrap pl-8" dir="rtl">
                  <span className="text-emerald-300 font-bold">صاحب نشاط؟ اطلب تفعيل اشتراكك من إدارة منطقتي X وابدأ عرض منتجاتك وخدماتك</span>
                  <span>قرّب عملاء منطقتك منك بكتالوج رقمي واضح وأسعار محدثة</span>
                  <span className="text-amber-300 font-bold">تابع منطقتي X لاكتشاف الأنشطة والخدمات والعروض الجديدة</span>
                  <span>ساعد مشروعك على الوصول لعملاء جدد واطلب مساعدة الإدارة في الانضمام</span>
                  <span className="text-emerald-300 font-bold">تابع الموقع وشارك رابطه مع أصدقائك لدعم الأنشطة المحلية</span>
                </div>
                <div className="flex shrink-0 items-center gap-8 whitespace-nowrap pl-8" dir="rtl" aria-hidden="true">
                  <span className="text-emerald-300 font-bold">صاحب نشاط؟ اطلب تفعيل اشتراكك من إدارة منطقتي X وابدأ عرض منتجاتك وخدماتك</span>
                  <span>قرّب عملاء منطقتك منك بكتالوج رقمي واضح وأسعار محدثة</span>
                  <span className="text-amber-300 font-bold">تابع منطقتي X لاكتشاف الأنشطة والخدمات والعروض الجديدة</span>
                  <span>ساعد مشروعك على الوصول لعملاء جدد واطلب مساعدة الإدارة في الانضمام</span>
                  <span className="text-emerald-300 font-bold">تابع الموقع وشارك رابطه مع أصدقائك لدعم الأنشطة المحلية</span>
                </div>
              </div>
            </div>
            <div className="shrink-0">
              <FloatingAppInstallButton currentBusiness={currentBusiness} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Show the Google identity separately from any business subscription. */}
            {authLoading ? (
              <span className="text-slate-300 text-[11px] font-bold">جارٍ التحقق من جلسة Google...</span>
            ) : authSession.isAuthenticated ? (
              <div className="flex items-center gap-2 text-[11px]">
                {authSession.role === 'admin' ? (
                  <span className="text-amber-300 font-bold flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    جلسة إدارة MantiqatiX
                  </span>
                ) : authSession.role === 'subscriber' ? (
                  <span className="text-emerald-300 font-bold flex items-center gap-1">
                    <UserCheck className="w-3 h-3" />
                    المشترك: {authSession.subscriberName || authSession.email}
                  </span>
                ) : (
                  <span className="text-sky-200 font-bold" title={authSession.email || ''}>
                    حساب Google: {authSession.email || 'تم تسجيل الدخول'}
                  </span>
                )}
                <button
                  onClick={logout}
                  className="text-slate-400 hover:text-rose-400 flex items-center gap-0.5 transition-colors cursor-pointer"
                  title="تسجيل الخروج"
                >
                  <LogOut className="w-3 h-3" />
                  <span>خروج</span>
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {authBootstrapError && (
        <div role="alert" className="bg-rose-50 border-b border-rose-200 px-3 py-2 text-xs font-bold text-rose-800 text-right" dir="rtl">
          تم تسجيل الدخول لكن تعذر تحميل صلاحيات الحساب: {authBootstrapError} — حدّث الصفحة، وإذا استمرت المشكلة أرسل هذه الرسالة للدعم.
        </div>
      )}

      {authSession.isAuthenticated && authSession.role === 'guest' && !authBootstrapError && !authLoading && (
        <div role="status" className="bg-amber-50 border-b border-amber-200 px-3 py-2 text-xs text-amber-950 text-right flex flex-wrap items-center justify-between gap-2" dir="rtl">
          <span>
            تم تسجيل الدخول بحساب Google{authSession.email ? ` (${authSession.email})` : ''}، لكن لا توجد عضوية نشاط نشطة مرتبطة بهذا الحساب. لن تُمنح صلاحيات صاحب النشاط تلقائيًا.
          </span>
          {String(adminSettings.adminWhatsApp || '').replace(/\D/g, '') && (
            <a
              href={`https://wa.me/${String(adminSettings.adminWhatsApp).replace(/\D/g, '')}?text=${encodeURIComponent(`أرجو مراجعة ربط اشتراك MantiqatiX بحساب Google: ${authSession.email || 'الحساب الحالي'}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-black text-amber-900 underline underline-offset-2"
            >
              مراجعة ربط الاشتراك مع الإدارة
            </a>
          )}
        </div>
      )}

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-2 sm:px-6 py-2.5">
        <div className="flex flex-col gap-2.5">
          {/* Top Line: Logo, Context, Cart */}
          <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2">
            <div
              onClick={() => setCurrentView('directory')}
              className="flex items-center gap-2 cursor-pointer group flex-shrink-0 min-w-0"
              title="الرئيسية والدليل الشامل"
            >
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform font-black text-sm">
                MX
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <h1 className="font-black text-base sm:text-lg text-slate-900 tracking-tight leading-tight">
                    منطقتي <span className="text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200 text-xs sm:text-sm font-black">X</span>
                  </h1>
                </div>
                <p className="text-[10px] text-slate-400 font-bold -mt-0.5 hidden sm:block">
                  MantiqatiX Business & Catalogs
                </p>
              </div>
            </div>

            {/* ONLY ADMIN sees the global switcher dropdown! */}
            {authSession.role === 'admin' && (currentView === 'account_portal' || currentView === 'super_admin') ? (
              <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200/80 rounded-xl px-2 py-1 max-w-[240px] sm:max-w-xs flex-1 sm:flex-initial">
                <span className="text-[10px] text-amber-800 font-bold whitespace-nowrap hidden sm:inline">
                  عرض كإدارة:
                </span>
                <select
                  id="biz-selector"
                  value={selectedBusinessId}
                  onChange={(e) => setSelectedBusinessId(e.target.value)}
                  className="bg-transparent text-xs font-black text-amber-950 focus:outline-hidden cursor-pointer w-full truncate"
                >
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.category})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="text-[11px] sm:text-xs font-bold text-slate-800 truncate max-w-[100px] sm:max-w-xs bg-slate-100 px-2 sm:px-3 py-1 rounded-xl border border-slate-200">
                <span className="truncate">{currentBusiness?.name || (authSession.isAuthenticated ? 'حساب Google' : 'تصفح عام')}</span>
              </div>
            )}

            {/* Top Left Actions: Request Catalog Button + Shopping Cart */}
            <div className="flex items-center gap-1 sm:gap-2 min-w-0">
              {/* Mandatory Requirement:
                  "زر طلب كتالوج النشاط يكون بالاعلي على الشمال بجوار السلة" */}
              {catalogRequestUrl && (
                <a
                  href={catalogRequestUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 px-3 py-1.5 rounded-xl text-xs font-black shadow-md shadow-amber-500/25 border border-amber-300 transition-all hover:scale-102 active:scale-98 cursor-pointer flex-shrink-0"
                  title="طلب الكتالوج الرسمي للنشاط عبر واتساب إدارة MantiqatiX"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-950" />
                  <span className="hidden sm:inline">طلب كتالوج النشاط</span>
                  <ExternalLink className="w-3 h-3 opacity-75 hidden sm:inline" />
                </a>
              )}

              <div className="shrink-0"><FloatingAppInstallButton currentBusiness={currentBusiness} /></div>

              {/* Marketing Project Button */}
              <button
                onClick={() => {
                  setSelectedBusinessId('biz_mantiqatix_marketing');
                  setCurrentView('public_storefront');
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-3 py-1.5 rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition-all cursor-pointer flex-shrink-0"
                title="فتح مشروع MantiqatiX للتسويق الإلكتروني"
              >
                <Megaphone className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden sm:inline">تسويق</span>
              </button>

              {/* Shopping Cart Button */}
              <button
                onClick={() => setIsCartOpen(true)}
                className="relative flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 flex-shrink-0 cursor-pointer active:scale-95"
                aria-label="فتح سلة الطلبات"
              >
                <ShoppingBag className="w-4 h-4" />
                <span className="hidden sm:inline">السلة</span>
                {totalCartCount > 0 && (
                  <span className="w-4 h-4 bg-amber-400 text-slate-950 font-black rounded-full flex items-center justify-center text-[10px]">
                    {totalCartCount}
                  </span>
                )}
              </button>

              {authSession.isAuthenticated ? (
                <button
                  onClick={() => setCurrentView('account_portal')}
                  aria-current={currentView === 'account_portal' ? 'page' : undefined}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>حسابي / اشتراكي</span>
                </button>
              ) : null}

              {authSession.role === 'guest' && !authSession.isAuthenticated && !authLoading && (
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">دخول / إنشاء حساب</span>
                </button>
              )}
            </div>
          </div>

          {/* Bottom Line: Accessible View Mode Tabs */}
          <div className="flex items-center justify-start overflow-x-auto pb-0.5 no-scrollbar">
            <nav className="flex min-w-max items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-medium w-full sm:w-auto">
              {/* Directory Home Tab */}
              <button
                onClick={() => setCurrentView('directory')}
                className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                  currentView === 'directory'
                    ? 'bg-white text-emerald-700 font-bold shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>الرئيسية والدليل الشامل</span>
              </button>

              {/* Public storefront preview is a subscriber/admin navigation item.
                  Guests still access a public catalog through its direct shared link. */}
              {authSession.role !== 'guest' && (
                <button
                  onClick={() => setCurrentView('public_storefront')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                    currentView === 'public_storefront'
                      ? 'bg-white text-emerald-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>
                    {authSession.role === 'subscriber'
                      ? 'معاينة صفحة نشاطي'
                      : 'صفحة النشاط والكتالوج'}
                  </span>
                </button>
              )}




            </nav>
          </div>
        </div>
      </div>
    </header>
  );
};
