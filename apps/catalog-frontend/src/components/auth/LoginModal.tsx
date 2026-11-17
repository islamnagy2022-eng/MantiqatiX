import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, AlertCircle, LoaderCircle, LogIn, ShieldCheck } from 'lucide-react';

type LoginMode = 'customer' | 'admin';

export const LoginModal: React.FC = () => {
  const {
    isLoginModalOpen,
    setIsLoginModalOpen,
    loginWithGoogle,
    adminSettings,
  } = useApp();
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<LoginMode>('customer');

  if (!isLoginModalOpen) return null;

  const adminPhone = String(adminSettings.adminWhatsApp || '').replace(/\D/g, '');
  const subscriptionRequestUrl = adminPhone
    ? `https://wa.me/${adminPhone}?text=${encodeURIComponent('أرغب في الاشتراك وتفعيل نشاطي على منصة منطقتي X')}`
    : '';

  const handleGoogle = async (nextMode: LoginMode) => {
    setMode(nextMode);
    setErrorMsg('');
    setBusy(true);
    try {
      const result = await loginWithGoogle();
      if (!result.success) {
        setErrorMsg(result.error || (nextMode === 'admin'
          ? 'تعذر بدء دخول الإدارة باستخدام حساب Google المعتمد.'
          : 'تعذر بدء تسجيل الدخول باستخدام Google.'));
      }
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'تعذر الاتصال بخدمة Google.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="login-title">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5 text-right" dir="rtl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 id="login-title" className="font-black text-lg text-slate-900">الدخول إلى منطقتي X</h3>
            <p className="text-[11px] text-slate-500 mt-1">اختر حساب Google للمتابعة دون إدخال بريد أو كلمة مرور داخل الموقع.</p>
          </div>
          <button type="button" onClick={() => setIsLoginModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center" aria-label="إغلاق">
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{errorMsg}</span></div>}

        <button
          type="button"
          data-testid="google-signin-button"
          disabled={busy}
          aria-busy={busy && mode === 'customer'}
          onClick={() => void handleGoogle('customer')}
          className="w-full min-h-12 py-3 px-4 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-900 font-black text-sm rounded-2xl border-2 border-slate-200 hover:border-emerald-500 shadow-xs transition-all flex items-center justify-center gap-3"
        >
          {busy && mode === 'customer' ? <LoaderCircle className="w-5 h-5 animate-spin" /> : <GoogleMark />}
          <span>{busy && mode === 'customer' ? 'جارٍ الاتصال بـ Google...' : 'المتابعة باستخدام Google'}</span>
        </button>

        <div className="border-t border-slate-100 pt-4 space-y-2">
          <button
            type="button"
            data-testid="admin-google-signin-button"
            disabled={busy}
            aria-busy={busy && mode === 'admin'}
            onClick={() => void handleGoogle('admin')}
            className="w-full min-h-11 rounded-xl border border-slate-300 bg-slate-50 px-4 py-2.5 text-xs font-black text-slate-800 hover:border-amber-400 hover:bg-amber-50 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {busy && mode === 'admin' ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            <span>{busy && mode === 'admin' ? 'جارٍ التحقق...' : 'دخول الإدارة بحساب Google المعتمد'}</span>
          </button>
          <p className="text-center text-[11px] leading-5 text-slate-500">دخول الإدارة منفصل في الواجهة، لكن صلاحيات الإدارة لا تُمنح إلا للحساب الذي يحمل عضوية SUPER_ADMIN فعّالة ومتحققًا منها من الخادم.</p>
        </div>

        {subscriptionRequestUrl && (
          <a href={subscriptionRequestUrl} target="_blank" rel="noopener noreferrer" className="block text-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-black text-emerald-800 hover:bg-emerald-100">
            صاحب نشاط؟ اطلب تفعيل اشتراكك عبر واتساب الإدارة
          </a>
        )}

        <div className="pt-3 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400 leading-relaxed">التصفح والشراء عبر واتساب والدفع النقدي متاح دون حساب. إنشاء الحساب لا يعني الاشتراك المدفوع؛ تفعيل النشاط يتم بعد اعتماد الإدارة.</p>
        </div>
      </div>
    </div>
  );
};

const GoogleMark: React.FC = () => (
  <svg aria-hidden="true" className="h-5 w-5 shrink-0" viewBox="0 0 48 48">
    <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5.1h6.7c3.9-3.6 6-8.9 6-15z" />
    <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.9l-6.7-5.1c-1.8 1.2-4.1 2-6.8 2-5.2 0-9.6-3.5-11.2-8.2H5.9v5.2A20 20 0 0 0 24 44z" />
    <path fill="#FBBC05" d="M12.8 27.8a12 12 0 0 1 0-7.6V15H5.9a20 20 0 0 0 0 18z" />
    <path fill="#EA4335" d="M24 12.1c3 0 5.7 1 7.8 3.1l5.8-5.8A19.5 19.5 0 0 0 24 4 20 20 0 0 0 5.9 15l6.9 5.2c1.6-4.7 6-8.1 11.2-8.1z" />
  </svg>
);
