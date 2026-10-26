import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Lock, Mail, ShieldCheck, Store, X, AlertCircle, ArrowRight, LoaderCircle } from 'lucide-react';

export const LoginModal: React.FC = () => {
  const {
    isLoginModalOpen, setIsLoginModalOpen,
    loginAsSubscriber, loginAsAdmin, loginWithGoogle,
  } = useApp();
  const [activeTab, setActiveTab] = useState<'subscriber' | 'admin'>('subscriber');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isLoginModalOpen) return null;

  const run = async (action: () => Promise<{ success: boolean; error?: string }>, fallback: string) => {
    setErrorMsg('');
    setBusy(true);
    try {
      const result = await action();
      if (!result.success) setErrorMsg(result.error || fallback);
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  const handleSubscriberSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void run(() => loginAsSubscriber(identifier, password), 'تعذر تسجيل الدخول ببيانات المشترك.');
  };

  const handleGoogleLogin = () => {
    if (activeTab === 'admin') {
      void run(() => loginAsAdmin(), 'تعذر تسجيل الدخول إلى إدارة المنصة بحساب Google.');
    } else {
      void run(() => loginWithGoogle(), 'تعذر بدء تسجيل الدخول بحساب Google.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="login-title">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-5 text-right">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
              {activeTab === 'admin' ? <ShieldCheck className="w-4 h-4" /> : <Store className="w-4 h-4" />}
            </div>
            <div>
              <h3 id="login-title" className="font-black text-base text-slate-900">تسجيل الدخول إلى MantiqatiX</h3>
              <p className="text-[10px] text-slate-400 font-bold">صلاحيات الحساب تُحدد من عضويته الفعلية في المنصة</p>
            </div>
          </div>
          <button onClick={() => setIsLoginModalOpen(false)} className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 hover:text-slate-800 flex items-center justify-center" aria-label="إغلاق">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center bg-slate-100 p-1 rounded-2xl text-xs font-bold">
          <button type="button" onClick={() => { setActiveTab('subscriber'); setErrorMsg(''); }} className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${activeTab === 'subscriber' ? 'bg-white text-emerald-800 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>
            <Store className="w-3.5 h-3.5" /><span>صاحب النشاط</span>
          </button>
          <button type="button" onClick={() => { setActiveTab('admin'); setErrorMsg(''); }} className={`flex-1 py-2.5 rounded-xl transition-all flex items-center justify-center gap-1.5 ${activeTab === 'admin' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600" /><span>إدارة المنصة</span>
          </button>
        </div>

        {errorMsg && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2"><AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{errorMsg}</span></div>}

        <button type="button" disabled={busy} onClick={handleGoogleLogin} className="w-full py-3 px-4 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-800 font-bold text-xs rounded-2xl border-2 border-slate-200 hover:border-emerald-500 shadow-xs transition-all flex items-center justify-center gap-3">
          {busy ? <LoaderCircle className="w-4 h-4 animate-spin" /> : <span className="w-5 h-5 rounded-full bg-red-500 text-white font-black flex items-center justify-center text-[10px]">G</span>}
          <span>{activeTab === 'admin' ? 'متابعة بحساب Google لإدارة المنصة' : 'المتابعة باستخدام حساب Google'}</span>
        </button>

        {activeTab === 'subscriber' ? (
          <form onSubmit={handleSubscriberSubmit} className="space-y-4">
            <div className="relative">
              <label htmlFor="subscriber-email" className="block text-xs font-black text-slate-700 mb-1">البريد الإلكتروني الذي سلمته لك الإدارة</label>
              <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-9" />
              <input id="subscriber-email" type="email" required autoComplete="username" dir="ltr" placeholder="merchant@gmail.com" value={identifier} onChange={(e) => setIdentifier(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-3 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden" />
            </div>
            <div className="relative">
              <label htmlFor="subscriber-password" className="block text-xs font-black text-slate-700 mb-1">كلمة المرور الممنوحة من الإدارة</label>
              <Lock className="w-4 h-4 text-slate-400 absolute right-3.5 top-9" />
              <input id="subscriber-password" type="password" required autoComplete="current-password" dir="ltr" placeholder="••••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-3 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden" />
            </div>
            <button type="submit" disabled={busy} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5">
              {busy && <LoaderCircle className="w-4 h-4 animate-spin" />}<span>تسجيل الدخول كصاحب نشاط</span><ArrowRight className="w-3.5 h-3.5 rotate-180" />
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-[11px] text-amber-900 leading-relaxed">
              دخول الإدارة العليا يتم بحساب Google المعتمد الذي يحمل صلاحية <strong>SUPER_ADMIN</strong> داخل قاعدة الإنتاج. لا توجد كلمة مرور إدارية ثابتة داخل الواجهة.
            </div>
            <button type="button" disabled={busy} onClick={handleGoogleLogin} className="w-full py-3 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-black text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" /><span>دخول لوحة إدارة المنصة</span>
            </button>
          </div>
        )}

        <div className="text-center pt-2 border-t border-slate-100">
          <p className="text-[11px] text-slate-400 font-medium">تظل تجربة التصفح العامة متاحة دون تسجيل دخول، وتظهر لوحات الإدارة وفق صلاحيات الحساب النشطة.</p>
        </div>
      </div>
    </div>
  );
};
