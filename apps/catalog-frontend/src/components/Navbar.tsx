import React from 'react';
import { useApp } from '../context/AppContext';
import {
  Store,
  LayoutDashboard,
  ShieldCheck,
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
    logout,
    setIsLoginModalOpen,
    requestCatalogViaAdminWhatsApp,
  } = useApp();

  const totalCartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      {/* Top Banner with Platform Context */}
      <div className="bg-slate-900 text-slate-300 text-xs py-1.5 px-3 sm:px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <Sparkles className="w-3 h-3 ml-1 text-emerald-400" />
              منصة MantiqatiX الذكية
            </span>
            <span className="hidden md:inline text-slate-400">
              دعم الجنيه المصري (ج.م) • تصنيف وظيفي للأغذية والتجزئة والخدمات والصحة
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Auth Session Status or Login Trigger */}
            {authSession.role === 'guest' ? (
              authSession.authenticated ? (
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-amber-300 font-bold" role="status">
                    لا توجد عضوية نشطة — التصفح العام فقط
                  </span>
                  <button
                    onClick={logout}
                    className="text-slate-400 hover:text-rose-400 flex items-center gap-0.5 transition-colors cursor-pointer"
                    title="تسجيل الخروج"
                  >
                    <LogOut className="w-3 h-3" />
                    <span>خروج</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-0.5 rounded-md text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <LogIn className="w-3 h-3" />
                  <span>دخول المشتركين / الإدارة</span>
                </button>
              )
            ) : (
              <div className="flex items-center gap-2 text-[11px]">
                {authSession.role === 'admin' ? (
                  <span className="text-amber-300 font-bold flex items-center gap-1">
                    <Crown className="w-3 h-3" />
                    جلسة إدارة MantiqatiX
                  </span>
                ) : (
                  <span className="text-emerald-300 font-bold flex items-center gap-1">
                    <UserCheck className="w-3 h-3" />
                    المشترك: {authSession.subscriberName}
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
            )}

          </div>
        </div>
      </div>

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5">
        <div className="flex flex-col gap-2.5">
          {/* Top Line: Logo, Context, Cart */}
          <div className="flex items-center justify-between gap-2">
            <div
              onClick={() => {
                if (authSession.role === 'subscriber') {
                  setCurrentView('merchant_admin');
                } else {
                  setCurrentView('directory');
                }
              }}
              className="flex items-center gap-2.5 cursor-pointer group flex-shrink-0"
              title={authSession.role === 'subscriber' ? 'الملف الشخصي التعريفي للمشترك' : 'الرئيسية والدليل الشامل'}
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
            {authSession.role === 'admin' ? (
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
              <div className="text-xs font-bold text-slate-800 truncate max-w-[200px] sm:max-w-xs bg-slate-100 px-3 py-1 rounded-xl border border-slate-200">
                <span className="truncate">{currentBusiness?.name}</span>
              </div>
            )}

            {/* Top Left Actions: Request Catalog Button + Shopping Cart */}
            <div className="flex items-center gap-2">
              {/* Mandatory Requirement:
                  "زر طلب كتالوج النشاط يكون بالاعلي على الشمال بجوار السلة" */}
              <a
                href={requestCatalogViaAdminWhatsApp(currentBusiness)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 px-3 py-1.5 rounded-xl text-xs font-black shadow-md shadow-amber-500/25 border border-amber-300 transition-all hover:scale-102 active:scale-98 cursor-pointer flex-shrink-0"
                title="طلب الكتالوج الرسمي للنشاط عبر واتساب إدارة MantiqatiX"
              >
                <FileText className="w-3.5 h-3.5 text-slate-950" />
                <span>طلب كتالوج النشاط</span>
                <ExternalLink className="w-3 h-3 opacity-75 hidden sm:inline" />
              </a>

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
                <span>تسويق</span>
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

              {authSession.role === 'guest' && !authSession.authenticated && (
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1 cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">دخول الحساب</span>
                </button>
              )}
            </div>
          </div>

          {/* Bottom Line: Accessible View Mode Tabs */}
          <div className="flex items-center justify-start overflow-x-auto pb-0.5 no-scrollbar">
            <nav className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-medium w-full sm:w-auto">
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

              {/* Public Storefront Tab */}
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

              {/* Merchant Dashboard Tab */}
              {(authSession.role === 'subscriber' || authSession.role === 'admin') && (
                <button
                  onClick={() => setCurrentView('merchant_admin')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                    currentView === 'merchant_admin'
                      ? 'bg-white text-emerald-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" />
                  <span>
                    {authSession.role === 'subscriber'
                      ? 'لوحة تحكم نشاطي'
                      : 'لوحة صاحب النشاط'}
                  </span>
                </button>
              )}

              {/* Super Admin Dashboard Tab */}
              {authSession.role === 'admin' && (
                <button
                  onClick={() => setCurrentView('super_admin')}
                  className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg whitespace-nowrap transition-all cursor-pointer ${
                    currentView === 'super_admin'
                      ? 'bg-white text-emerald-700 font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                  <span>لوحة الإدارة والعمولات</span>
                </button>
              )}

              {/* If Guest clicks dashboard */}
              {authSession.role === 'guest' && !authSession.authenticated && (
                <button
                  onClick={() => setIsLoginModalOpen(true)}
                  className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5 text-slate-400" />
                  <span>دخول صاحب النشاط</span>
                </button>
              )}
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
};
