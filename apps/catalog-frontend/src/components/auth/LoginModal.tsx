import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Mail, UserRound, X, AlertCircle, ArrowRight, LoaderCircle, CheckCircle2, Lock } from 'lucide-react';

export const LoginModal: React.FC = () => {
  const {
    isLoginModalOpen,
    setIsLoginModalOpen,
    loginAsSubscriber,
    loginWithGoogle,
    registerWithEmail,
  } = useApp();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isLoginModalOpen) return null;

  const run = async (action: () => Promise<{ success: boolean; error?: string; message?: string }>, fallback: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    setBusy(true);
    try {
      const result = await action();
      if (!result.success) setErrorMsg(result.error || fallback);
      else if (result.message) setSuccessMsg(result.message);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (mode === 'signup') {
      void run(() => registerWithEmail(fullName, email, password), 'تعذر إنشاء الحساب.');
    } else {
      void run(() => loginAsSubscriber(email, password), 'تعذر تسجيل الدخول. راجع البريد الإلكتروني وكلمة المرور.');
    }
  };

  const handleGoogle = () => {
    void run(() => loginWithGoogle(), 'تعذر بدء تسجيل الدخول باستخدام Google.');
  };

  const changeMode = (nextMode: 'login' | 'signup') => {
    setMode(nextMode);
    setErrorMsg('');
    setSuccessMsg('');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="login-title">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5 text-right" dir="rtl">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 id="login-title" className="font-black text-lg text-slate-900">
              {mode === 'signup' ? 'إنشاء حساب جديد' : 'تسجيل الدخول إلى منطقتي X'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-1">طريقة واحدة للدخول لجميع المستخدمين؛ الصلاحيات تحددها عضوية الحساب المعتمدة.</p>
          </div>
          <button onClick={() => setIsLoginModalOpen(false)} className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center" aria-label="إغلاق">
            <X className="w-4 h-4" />
          </button>
        </div>

        <button type="button" disabled={busy} onClick={handleGoogle} className="w-full py-3 px-4 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-800 font-bold text-sm rounded-2xl border-2 border-slate-200 hover:border-emerald-500 shadow-xs transition-all flex items-center justify-center gap-3">
          {busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <span className="w-6 h-6 rounded-full border border-slate-200 text-red-600 font-black flex items-center justify-center text-sm">G</span>}
          <span>المتابعة باستخدام Google</span>
        </button>
        <p className="text-center text-[11px] text-slate-400 -mt-2">يمكن استخدام حساب Google الحالي أو إنشاء حساب جديد من خلاله.</p>

        <div className="relative flex items-center">
          <div className="flex-1 border-t border-slate-200" />
          <span className="px-3 text-[11px] text-slate-400">أو باستخدام البريد الإلكتروني</span>
          <div className="flex-1 border-t border-slate-200" />
        </div>

        {errorMsg && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{errorMsg}</span></div>}
        {successMsg && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2"><CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" /><span>{successMsg}</span></div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'signup' && (
            <div className="relative">
              <label htmlFor="account-full-name" className="block text-xs font-black text-slate-700 mb-1">الاسم الكامل</label>
              <UserRound className="w-4 h-4 text-slate-400 absolute right-3.5 top-9" />
              <input id="account-full-name" type="text" required autoComplete="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden" placeholder="الاسم الكامل" />
            </div>
          )}
          <div className="relative">
            <label htmlFor="account-email" className="block text-xs font-black text-slate-700 mb-1">البريد الإلكتروني</label>
            <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-9" />
            <input id="account-email" type="email" required autoComplete="email" dir="ltr" placeholder="name@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden" />
          </div>
          <div className="relative">
            <label htmlFor="account-password" className="block text-xs font-black text-slate-700 mb-1">{mode === 'signup' ? 'إنشاء كلمة مرور (8 أحرف على الأقل)' : 'كلمة المرور'}</label>
            <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-9" />
            <input id="account-password" type="password" required minLength={mode === 'signup' ? 8 : undefined} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} dir="ltr" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-3 text-sm text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden" />
          </div>
          <button type="submit" disabled={busy} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2">
            {busy && <LoaderCircle className="w-4 h-4 animate-spin" />}
            <span>{mode === 'signup' ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}</span>
            {!busy && <ArrowRight className="w-4 h-4 rotate-180" />}
          </button>
        </form>

        <div className="text-center text-xs text-slate-500">
          {mode === 'login' ? (
            <span>ليس لديك حساب؟{' '}
              <button type="button" onClick={() => changeMode('signup')} className="font-black text-emerald-700 hover:text-emerald-900">إنشاء حساب جديد</button>
            </span>
          ) : (
            <span>لديك حساب بالفعل؟{' '}
              <button type="button" onClick={() => changeMode('login')} className="font-black text-emerald-700 hover:text-emerald-900">تسجيل الدخول</button>
            </span>
          )}
        </div>

        <div className="pt-3 border-t border-slate-100 text-center">
          <p className="text-[11px] text-slate-400 leading-relaxed">التصفح والشراء عبر واتساب والدفع النقدي متاح دون حساب. إنشاء الحساب لا يمنح صلاحيات إدارة أو اشتراك نشاط تلقائيًا؛ تفعيل النشاط يتم بعد اعتماد الإدارة.</p>
        </div>
      </div>
    </div>
  );
};
