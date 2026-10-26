import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { X, AlertCircle, LoaderCircle, CheckCircle2 } from 'lucide-react';

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

  if (!isLoginModalOpen) return null;

  const adminPhone = String(adminSettings.adminWhatsApp || '').replace(/\\D/g, '');
  const subscriptionRequestUrl = adminPhone
    ? `https://wa.me/${adminPhone}?text=${encodeURIComponent('أرغب في الاشتراك وتفعيل نشاطي على منصة منطقتي X')}`
    : '';

  const handleGoogle = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setBusy(true);
    try {
      const result = await loginWithGoogle();
      if (!result.success) setErrorMsg(result.error || 'تعذر بدء تسجيل الدخول باستخدام Google.');
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : 'تعذر بدء تسجيل الدخول باستخدام Google.');
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
            <p className="text-[11px] text-slate-500 mt-1">سجّل الدخول باستخدام حساب Google فقط دون اسم مستخدم أو كلمة مرور داخل المنصة.</p>
          </div>
          <button onClick={() => setIsLoginModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center" aria-label="إغلاق">
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{errorMsg}</span></div>}
        {successMsg && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2"><CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{successMsg}</span></div>}

        <button type="button" disabled={busy} onClick={() => void handleGoogle()} className="w-full py-3 px-4 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-800 font-bold text-sm rounded-2xl border-2 border-slate-200 hover:border-emerald-500 shadow-xs transition-all flex items-center justify-center gap-3">
          {busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <span className="w-6 h-6 rounded-full border border-slate-200 text-red-600 font-black flex items-center justify-center text-sm">G</span>}
          <span>{busy ? 'جارٍ التحويل إلى Google...' : 'المتابعة باستخدام Google'}</span>
        </button>
        <p className="text-center text-[11px] text-slate-400">اختر حساب Gmail من صفحة Google. يمكن للحساب المعتمد الدخول إلى لوحة الإدارة أو النشاط حسب صلاحياته.</p>

        {subscriptionRequestUrl && (
          <a href={subscriptionRequestUrl} target="_blank" rel="noopener noreferrer" className="block text-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs font-black text-emerald-800 hover:bg-emerald-100">
            صاحب نشاط؟ اطلب تفعيل اشتراكك عبر واتساب الإدارة
          </a>
        )}

        <div className="pt-3 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400 leading-relaxed">التصفح والشراء عبر واتساب والدفع النقدي متاح دون حساب. تسجيل الدخول بحساب Google لا يمنح صلاحيات إدارة أو اشتراك نشاط تلقائيًا؛ تفعيل النشاط يتم بعد اعتماد الإدارة.</p>
        </div>
      </div>
    </div>
  );
};
