import React, { useState } from 'react';
import { Business } from '../../types';
import { Smartphone, Bell, X, Check, Download, Sparkles, Heart } from 'lucide-react';

interface FloatingAppInstallButtonProps {
  currentBusiness?: Business;
}

export const FloatingAppInstallButton: React.FC<FloatingAppInstallButtonProps> = ({ currentBusiness }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleToggleNotifications = () => {
    setNotificationsEnabled(!notificationsEnabled);
    if (!notificationsEnabled) {
      if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
      }
    }
  };

  const handleSaveApp = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-6 left-6 z-40">
        <button
          onClick={() => setIsOpen(true)}
          className="bg-slate-900 hover:bg-emerald-600 text-white font-black text-xs sm:text-sm py-3 px-4 rounded-2xl shadow-2xl flex items-center gap-2.5 transition-all transform hover:scale-105 active:scale-95 cursor-pointer ring-4 ring-emerald-500/20"
          title="حفظ صفحة النشاط كتطبيق جوال"
        >
          <div className="w-7 h-7 bg-emerald-500 text-slate-950 rounded-xl flex items-center justify-center font-black shadow-sm">
            <Smartphone className="w-4 h-4" />
          </div>
          <span>حفظ النشاط كتطبيق</span>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
        </button>
      </div>

      {/* Modal for App Save & Notifications */}
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative text-right animate-in fade-in zoom-in duration-200">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-5 left-5 p-2 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full transition-colors cursor-pointer"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-200 shadow-xs">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
                  تطبيق ويب تقدمي (PWA)
                </span>
                <h3 className="text-xl font-black text-slate-900 mt-0.5">
                  {currentBusiness ? currentBusiness.name : 'منصة MantiqatiX'}
                </h3>
              </div>
            </div>

            <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed">
              يمكنك إضافة هذه الصفحة مباشرة إلى شاشة هاتفك الرئيسية كـ تطبيق (App) وتفعيل الإشعارات ليصلك كل جديد من عروض ومنتجات هذا النشاط فوراً.
            </p>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-4 mb-6">
              {/* Step 1: Add to Home Screen */}
              <div>
                <h4 className="font-extrabold text-xs text-slate-900 mb-1 flex items-center gap-1.5">
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>خطوات تثبيت النشاط على شاشة الموبايل:</span>
                </h4>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  1. افتح قائمة المتصفح (في السفاري أو الكروم).<br />
                  2. اختر <strong>"إضافة إلى الشاشة الرئيسية"</strong> (Add to Home Screen).<br />
                  3. سيظهر أيقونة التطبيق على شاشتك للوصول الفوري بلمسة واحدة!
                </p>
              </div>

              {/* Step 2: Notifications Toggle */}
              <div className="pt-3 border-t border-slate-200/60 flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-amber-500" />
                    <span>تنبيهات وإشعارات النشاط الجديد</span>
                  </h4>
                  <p className="text-[10px] text-slate-400">تلقي إشعارات فورية عند إضافة منتجات أو عروض جديدة</p>
                </div>
                <button
                  onClick={handleToggleNotifications}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    notificationsEnabled
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                >
                  {notificationsEnabled ? 'مفعّلة ✓' : 'تفعيل الإشعارات'}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={handleSaveApp}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-3 px-4 rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                {savedSuccess ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>تم حفظ إعدادات التطبيق بنجاح!</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>تأكيد وحفظ التطبيق على الجوال</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setIsOpen(false)}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs py-2.5 px-4 rounded-xl transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
