import React, { useEffect, useState } from 'react';
import { Download, Smartphone } from 'lucide-react';
import { Business } from '../../types';

interface FloatingAppInstallButtonProps {
  currentBusiness?: Business;
}

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

export const FloatingAppInstallButton: React.FC<FloatingAppInstallButtonProps> = () => {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const checkInstalled = () => {
      setIsInstalled(
        window.matchMedia('(display-mode: standalone)').matches ||
        Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
      );
    };
    const handleBeforeInstall = (event: Event) => {
      // Keep the native browser install prompt for the button click.
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setInstallPrompt(null);
      setStatusMessage('تم تثبيت التطبيق');
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
    if (isInstalled) {
      setStatusMessage('التطبيق مثبت بالفعل');
      window.setTimeout(() => setStatusMessage(''), 2500);
      return;
    }

    if (!installPrompt) {
      // Browsers that support programmatic PWA installation will fire
      // beforeinstallprompt. Other browsers do not expose a direct install API.
      setStatusMessage('التثبيت المباشر غير متاح في هذا المتصفح');
      window.setTimeout(() => setStatusMessage(''), 3500);
      return;
    }

    try {
      const promptEvent = installPrompt;
      setInstallPrompt(null);
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        setStatusMessage('جارٍ تثبيت التطبيق');
      }
      window.setTimeout(() => setStatusMessage(''), 3000);
    } catch (error) {
      console.error('PWA installation prompt failed:', error);
      setStatusMessage('تعذر بدء التثبيت، حاول مرة أخرى');
      window.setTimeout(() => setStatusMessage(''), 3500);
    }
  };

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        onClick={handleInstall}
        disabled={isInstalled}
        className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/50 bg-emerald-500 px-2 py-1.5 text-[10px] sm:text-xs font-black text-slate-950 shadow-sm transition-colors hover:bg-emerald-400 active:scale-95 whitespace-nowrap disabled:cursor-default disabled:opacity-80"
        aria-label={isInstalled ? 'التطبيق مثبت بالفعل' : 'تثبيت منطقتي X على الهاتف'}
        title={isInstalled ? 'التطبيق مثبت بالفعل' : 'تثبيت الموقع كتطبيق على الموبايل'}
      >
        {isInstalled ? <Smartphone className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
        <span>{isInstalled ? 'مثبت' : 'تثبيت التطبيق'}</span>
      </button>
      {statusMessage && (
        <div role="status" aria-live="polite" className="absolute left-0 top-full z-[100] mt-2 w-max max-w-[240px] rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-bold text-white shadow-xl">
          {statusMessage}
        </div>
      )}
    </div>
  );
};
