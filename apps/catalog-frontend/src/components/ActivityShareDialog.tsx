import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Copy, ExternalLink, QrCode, Share2, X } from 'lucide-react';
import { getCurrentAppBasePath } from '../utils/rules';

interface ActivityShareDialogProps {
  activityId: string;
  activityName: string;
  onClose: () => void;
}

export const ActivityShareDialog: React.FC<ActivityShareDialogProps> = ({
  activityId,
  activityName,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const activityUrl = useMemo(() => {
    const basePath = getCurrentAppBasePath(window.location.pathname);
    const url = new URL(basePath, window.location.origin);
    url.searchParams.set('activity', activityId);
    return url.toString();
  }, [activityId]);

  const qrCodeImageUrl = useMemo(
    () => `https://api.qrserver.com/v1/create-qr-code/?size=360x360&data=${encodeURIComponent(activityUrl)}`,
    [activityUrl],
  );

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;
      const dialog = closeButtonRef.current?.closest('[role="dialog"]');
      if (!dialog) return;

      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )).filter((element) => element.getAttribute('aria-hidden') !== 'true');
      if (focusable.length === 0) {
        event.preventDefault();
        closeButtonRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialog.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialog.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (previouslyFocusedRef.current?.isConnected) previouslyFocusedRef.current.focus();
    };
  }, [onClose]);

  const copyLink = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(activityUrl);
      setCopied(true);
      setShareMessage('تم نسخ رابط النشاط. يمكنك إرساله لأي شخص.');
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setShareMessage('تعذر النسخ تلقائيًا. استخدم رابط النشاط الظاهر بالأسفل.');
    }
  };

  const shareLink = async () => {
    setShareMessage('');
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${activityName} | MantiqatiX`,
          text: `تصفح نشاط ${activityName} على MantiqatiX`,
          url: activityUrl,
        });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') return;
      }
    }
    await copyLink();
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-slate-950/70 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="activity-share-title"
        aria-describedby="activity-share-description"
        dir="rtl"
        className="relative my-auto w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 text-right shadow-2xl sm:p-7"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label="إغلاق نافذة مشاركة النشاط"
          className="absolute left-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-5 flex items-center gap-3 pl-12">
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700">
            <QrCode className="h-6 w-6" />
          </span>
          <div>
            <p className="text-[11px] font-black text-emerald-700">رابط مستقل للنشاط</p>
            <h2 id="activity-share-title" className="mt-1 text-lg font-black text-slate-950">{activityName}</h2>
          </div>
        </div>

        <p id="activity-share-description" className="mb-4 text-xs leading-6 text-slate-600">
          افتح الرابط مباشرة لعرض هذا النشاط وتخصصاته، أو شاركه أو اطبع رمز QR للوصول السريع.
        </p>

        <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-center">
          <img
            src={qrCodeImageUrl}
            alt={`رمز QR لفتح نشاط ${activityName} على MantiqatiX`}
            loading="lazy"
            className="mx-auto h-52 w-52 rounded-xl border border-slate-100 bg-white p-2 object-contain"
          />
          <a
            href={activityUrl}
            target="_blank"
            rel="noopener noreferrer"
            dir="ltr"
            className="mt-3 block break-all rounded-xl border border-slate-200 bg-white p-3 text-[11px] font-semibold text-slate-700 hover:text-emerald-700"
          >
            {activityUrl}
          </a>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={shareLink}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-3 text-xs font-black text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          >
            <Share2 className="h-4 w-4" />
            مشاركة الرابط
          </button>
          <button
            type="button"
            onClick={copyLink}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-black text-slate-800 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            {copied ? <Check className="h-4 w-4 text-emerald-700" /> : <Copy className="h-4 w-4" />}
            {copied ? 'تم النسخ' : 'نسخ الرابط'}
          </button>
        </div>

        <a
          href={qrCodeImageUrl}
          download={`mantiqatix-${activityId}-qr.png`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs font-black text-emerald-800 transition hover:bg-emerald-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
        >
          <ExternalLink className="h-4 w-4" />
          فتح / تحميل رمز QR
        </a>

        {shareMessage && <p role="status" aria-live="polite" className="mt-3 text-center text-xs font-bold text-emerald-800">{shareMessage}</p>}
        <p className="mt-3 text-center text-[10px] leading-5 text-slate-400">
          الرابط يستخدم معرّف النشاط الثابت ومسار الموقع الحالي، ولا يتضمن بيانات موقعك أو معلومات شخصية.
        </p>
      </section>
    </div>
  );
};
