import React, { useEffect, useState } from 'react';
import { Download, Smartphone, X, ExternalLink } from 'lucide-react';
import { Business } from '../../types';

interface FloatingAppInstallButtonProps {
  currentBusiness?: Business;
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export const FloatingAppInstallButton: React.FC<FloatingAppInstallButtonProps> = ({ currentBusiness }) => {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const checkInstalled = () =>
      setIsInstalled(
        window.matchMedia('(display-mode: standalone)').matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
      );
    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setIsOpen(false);
    };
    checkInstalled();
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) {
      setIsOpen(true);
      return;
    }
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === 'accepted') setIsOpen(false);
    setInstallPrompt(null);
  };

  return (
    <>
      <button
        type="button"
        onClick={handleInstall}
        className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/50 bg-emerald-500 px-2 py-1.5 text-[10px] sm:text-xs font-black text-slate-950 shadow-sm transition-colors hover:bg-emerald-400 active:scale-95 whitespace-nowrap"
        aria-label={isInstalled ? 'التطبيق مثبت بالفعل' : 'تثبيت منطقتي X على الهاتف'}
        title={isInstalled ? 'التطبيق مثبت بالفعل' : 'تثبيت الموقع كتطبيق على الموبايل'}
      >
        {isInstalled ? <Smartphone className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
        <span>{isInstalled ? 'مثبت' : 'تثبيت التطبيق'}</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="install-app-title">
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 text-right shadow-2xl sm:p-6">
            <button type="button" onClick={() => setIsOpen(false)} className="absolute left-3 top-3 rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200" aria-label="إغلاق">
              <X className="h-4 w-4" />
            </button>
            <div className="mb-4 flex items-center gap-3">
              <div className="rounded-xl bg-emerald-100 p-3 text-emerald-700"><Smartphone className="h-6 w-6" /></div>
              <div>
                <h2 id="install-app-title" className="text-lg font-black text-slate-900">تثبيت {currentBusiness?.name || 'منطقتي X'}</h2>
                <p className="text-xs text-slate-500">أضف الموقع إلى الشاشة الرئيسية</p>
              </div>
            </div>
            <p className="mb-4 text-sm leading-7 text-slate-600">
              {installPrompt
                ? 'اضغط تثبيت لإضافة الموقع كتطبيق على هاتفك.'
                : 'لو لم تظهر نافذة التثبيت تلقائيا، اتبع الخطوات المناسبة للمتصفح:'}
            </p>
            <div className="space-y-3 rounded-xl bg-slate-50 p-4 text-sm leading-7 text-slate-700">
              <div><strong>Android / Chrome:</strong> افتح قائمة ⋮ ثم اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».</div>
              <div><strong>iPhone / Safari:</strong> اضغط زر المشاركة ثم اختر «إضافة إلى الشاشة الرئيسية».</div>
            </div>
            <div className="mt-4 flex gap-2">
              {installPrompt && <button type="button" onClick={handleInstall} className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700">تثبيت الآن</button>}
              <button type="button" onClick={() => setIsOpen(false)} className="flex-1 rounded-xl bg-slate-100 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200">إغلاق</button>
            </div>
            <p className="mt-3 flex items-center justify-center gap-1 text-[10px] text-slate-400"><ExternalLink className="h-3 w-3" /> قد تختلف أسماء الخيارات حسب نوع الهاتف والمتصفح</p>
          </div>
        </div>
      )}
    </>
  );
};
