import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, AlertCircle, LoaderCircle, CheckCircle2, UserRoundPlus, LogIn } from 'lucide-react';

type AuthIntent = 'login' | 'signup';

export const LoginModal: React.FC = () => {
  const {
    isLoginModalOpen,
    setIsLoginModalOpen,
    loginWithGoogle,
    adminSettings,
  } = useApp();
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [intent, setIntent] = useState<AuthIntent>('login');

  if (!isLoginModalOpen) return null;

  const adminPhone = String(adminSettings.adminWhatsApp || '').replace(/\D/g, '');
  const subscriptionRequestUrl = adminPhone
    ? `https://wa.me/${adminPhone}?text=${encodeURIComponent('أرغب في الاشتراك وتفعيل نشاطي على منصة منطقتي X')}`
    : '';

  const handleGoogle = async (nextIntent: AuthIntent) => {
    setIntent(nextIntent);
    setErrorMsg('');
    setSuccessMsg('');
    setBusy(true);
    try {
      const result = await loginWithGoogle();
      if (!result.success) setErrorMsg(result.error || (nextIntent === 'signup'
        ? 'تعذر بدء إنشاء الحساب باستخدام Google.'
        : 'تعذر بدء تسجيل الدخول باستخدام Google.'));
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
            <p className="text-[11px] text-slate-500 mt-1">لديك حساب؟ ادخل به. أول مرة هنا؟ أنشئ حسابًا جديدًا باستخدام Google.</p>
          </div>
          <button onClick={() => setIsLoginModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center" aria-label="إغلاق">
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{errorMsg}</span></div>}
        {successMsg && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2"><CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{successMsg}</span></div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button type="button" disabled={busy} onClick={() => void handleGoogle('login')} className="w-full py-3 px-3 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-800 font-bold text-sm rounded-2xl border-2 border-slate-200 hover:border-emerald-500 shadow-xs transition-all flex items-center justify-center gap-2">
            {busy && intent === 'login' ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
            <span>{busy && intent === 'login' ? 'جارٍ التحويل...' : 'تسجيل الدخول'}</span>
          </button>
          <button type="button" disabled={busy} onClick={() => void handleGoogle('signup')} className="w-full py-3 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold text-sm rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2">
            {busy && intent === 'signup' ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <UserRoundPlus className="w-4 h-4" />}
            <span>{busy && intent === 'signup' ? 'جارٍ إنشاء الحساب...' : 'تسجيل جديد'}</span>
          </button>
        </div>

        <button type="button" disabled={busy} onClick={() => void handleGoogle(intent)} className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-2">
          <span className="w-5 h-5 rounded-full border border-slate-200 text-red-600 font-black flex items-center justify-center text-xs">G</span>
          <span>{busy ? 'جارٍ التحويل إلى Google...' : 'المتابعة باستخدام Google'}</span>
        </button>
        <p className="text-center text-[11px] text-slate-500 leading-relaxed">في التسجيل الجديد اختر حساب Google الذي تريد استخدامه. إذا كان الحساب جديدًا فسيُنشأ تلقائيًا بعد موافقة Google، لكن صلاحيات إدارة النشاط لا تُمنح تلقائيًا.</p>

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
