import React, { useState } from 'react';
import { Business } from '../../types';
import { generateStorePublicUrl } from '../../utils/rules';
import { QrCode, Download, Copy, Check, Printer, X, Sparkles } from 'lucide-react';

interface QRCodeModalProps {
  business: Business;
  isOpen: boolean;
  onClose: () => void;
}

export const QRCodeModal: React.FC<QRCodeModalProps> = ({ business, isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Generate permanent store public URL
  // Uses window.location.origin or a stable base fallback, with the business slug (or id)
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://mantiqatix.com';
  const storeUrl = generateStorePublicUrl(origin, business.slug || business.id);

  // QR Code image URL using qrserver API
  const qrCodeImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(storeUrl)}`;

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html dir="rtl" lang="ar">
        <head>
          <title>QR كود النشاط - ${business.name}</title>
          <style>
            body { font-family: Tahoma, Arial, sans-serif; text-align: center; padding: 40px; background: #fff; color: #1e293b; }
            .card { border: 3px solid #059669; border-radius: 24px; padding: 32px; max-width: 450px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
            h1 { font-size: 24px; color: #065f46; margin-bottom: 8px; }
            p { font-size: 14px; color: #475569; margin-bottom: 20px; }
            .qr-img { width: 260px; height: 260px; border: 2px solid #e2e8f0; border-radius: 16px; padding: 10px; margin: 0 auto 20px; display: block; }
            .footer { font-size: 12px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 15px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="card">
            <h1>${business.name}</h1>
            <p>${business.category} • ${business.governorate} - ${business.markaz}</p>
            <img src="${qrCodeImageUrl}" alt="QR Code" class="qr-img" />
            <p>امسح الكود بكاميرا هاتفك للوصول المباشر للكتالوج وطلب المنتجات والخدمات فوراً عبر MantiqatiX</p>
            <div class="footer">منصة MantiqatiX الذكية للأنشطة والكتالوجات</div>
          </div>
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative text-right animate-in fade-in zoom-in duration-200">
        <button
          onClick={onClose}
          className="absolute top-5 left-5 p-2 text-slate-400 hover:text-slate-700 bg-slate-100 rounded-full transition-colors cursor-pointer"
          aria-label="إغلاق النافذة"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-200">
            <QrCode className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
              QR كود دائم ومستقر
            </span>
            <h3 className="text-xl font-black text-slate-900 mt-0.5">{business.name}</h3>
          </div>
        </div>

        <p className="text-xs text-slate-500 mb-6 leading-relaxed">
          هذا الرمز (QR Code) دائم ولا يتغير حتى عند تغيير نطاق الموقع (Domain). يمكن لصاحب النشاط والعملاء استخدامه للوصول المباشر لصفحة الكتالوج وطلب المنتجات والخدمات عبر الواتساب.
        </p>

        {/* QR Code Card Preview */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 text-center mb-6 space-y-4">
          <div className="bg-white p-3 rounded-2xl shadow-xs inline-block border border-slate-200">
            <img
              src={qrCodeImageUrl}
              alt={`QR Code for ${business.name}`}
              className="w-48 h-48 sm:w-56 sm:h-56 object-contain mx-auto rounded-xl"
            />
          </div>

          <div className="text-[11px] font-semibold text-slate-600 bg-white px-3 py-2 rounded-xl border border-slate-200 truncate" dir="ltr">
            {storeUrl}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleCopyLink}
            className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs py-3 px-4 rounded-xl transition-colors cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">تم النسخ!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-600" />
                <span>نسخ الرابط الدائم</span>
              </>
            )}
          </button>

          <a
            href={qrCodeImageUrl}
            download={`${business.slug}-qrcode.png`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs py-3 px-4 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>تحميل QR كود</span>
          </a>
        </div>

        <div className="mt-3">
          <button
            onClick={handlePrint}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-3 px-4 rounded-xl transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>طباعة بوستر QR للنشاط (مطبعة / لافتة)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
