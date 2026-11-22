import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { QRCodeModal } from '../common/QRCodeModal';
import { normalizeDialPhone, normalizeSocialUrl, normalizeWhatsAppPhone } from '../../utils/socialLinks';
import { isMantiqatiXBrandName, resolveDefaultImage } from '../../utils/defaultImages';
import {
  MessageCircle,
  MapPin,
  Clock,
  Phone,
  Facebook,
  Instagram,
  Music2,
  CheckCircle2,
  Share2,
  Building2,
  Check,
  AlertTriangle,
  Ban,
  QrCode,
} from 'lucide-react';

const isMantiqatiXBrandProfile = (name?: string | null): boolean =>
  /^mantiqatix$/i.test(String(name || '').replace(/\s+/g, '').trim());

const BUSINESS_PLACEHOLDER = `${import.meta.env.BASE_URL || '/'}business-placeholder.svg`;

export const BusinessProfileHeader: React.FC = () => {
  const { currentBusiness, getStorePublicLink } = useApp();
  const [copied, setCopied] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const isPlatformBrandProfile = isMantiqatiXBrandName(currentBusiness?.name);
  const defaultLogo = currentBusiness ? resolveDefaultImage({
    name: currentBusiness.name, description: currentBusiness.bio, category: currentBusiness.category, kind: 'activity',
  }) : BUSINESS_PLACEHOLDER;
  const defaultCover = currentBusiness ? resolveDefaultImage({
    name: currentBusiness.name, description: currentBusiness.bio, category: currentBusiness.category, kind: 'cover',
  }) : BUSINESS_PLACEHOLDER;
  // A storefront has one fixed cover. Promotional imagery is rendered in its own gallery below.
  // The official platform profile must use first-party brand media, not expiring social-CDN URLs.
  const coverImage = isPlatformBrandProfile ? defaultCover : currentBusiness?.coverUrl || defaultCover;
  const promotionalImages = Array.isArray(currentBusiness?.promotionalImages)
    ? currentBusiness.promotionalImages.filter((url) => typeof url === 'string' && url.startsWith('https://')).slice(0, 10)
    : [];

  if (!currentBusiness) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center text-slate-500">
        لم يتم العثور على نشاط تجاري محدد.
      </div>
    );
  }

  const handleShare = async () => {
    setShareFailed(false);
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(getStorePublicLink(currentBusiness));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setShareFailed(true);
      window.setTimeout(() => setShareFailed(false), 3500);
    }
  };

  const dialPhone = normalizeDialPhone(currentBusiness.phone || currentBusiness.ownerWhatsApp);
  const whatsappPhone = normalizeWhatsAppPhone(currentBusiness.ownerWhatsApp);
  const merchantWhatsAppUrl = whatsappPhone
    ? `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(`مرحباً، أود الاستفسار والطلب من نشاطكم: ${currentBusiness.name}`)}`
    : '';
  const additionalContactPhones = (currentBusiness.additionalContactPhones || []).map(normalizeDialPhone).filter(Boolean);
  const facebookUrl = normalizeSocialUrl(currentBusiness.facebookUrl, 'facebook');
  const instagramUrl = normalizeSocialUrl(currentBusiness.instagramUrl, 'instagram');
  const tiktokUrl = normalizeSocialUrl(currentBusiness.tiktokUrl, 'tiktok');
  const isFrozen = Boolean(currentBusiness.isFrozen);

  return (
    <div className="mx-v4-storefront-shell relative mb-8 border-b bg-white shadow-xs">
      {/* Urgent Frozen Notice Banner if activity is frozen past 5 days */}
      {isFrozen && (
        <div className="bg-rose-600 text-white p-3.5 sm:p-4 text-center text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-md">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 animate-bounce" />
          <span>⚠️ هذا النشاط التجاري مجمد مؤقتاً لعدم سداد المستحقات المالية - يرجى مراجعة إدارة المنصة للتفعيل</span>
        </div>
      )}

      {/* One fixed cover image; promotional images are displayed in a separate gallery. */}
      <div className="w-full px-0 py-0">
        <section aria-label={`غلاف نشاط ${currentBusiness.name}`} data-testid="storefront-cover-hero" className="mx-v4-storefront-cover relative w-full aspect-[16/9] sm:aspect-[1440/390] overflow-hidden group">
          <img
            src={coverImage}
            alt={`غلاف ${currentBusiness.name}`}
            className={`w-full h-full object-cover object-center transform transition-transform duration-700 ${
              isFrozen ? 'grayscale contrast-125 opacity-75' : ''
            }`}
            onError={(e) => {
              const image = e.currentTarget;
              if (image.dataset.defaultFallbackApplied !== 'true') {
                image.dataset.defaultFallbackApplied = 'true';
                image.src = defaultCover;
              }
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-black/30 opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-within:opacity-100" aria-hidden="true" />

        {/* Top Floating Badge: Verification & Status */}
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex max-w-[calc(100%-1.5rem)] items-center gap-2">
          {isFrozen ? (
            <span className="bg-rose-600/95 backdrop-blur-md text-white text-xs font-black px-3 py-1.5 rounded-full border border-rose-400 shadow-md flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5" />
              <span>نشاط مجمد مؤقتاً</span>
            </span>
          ) : currentBusiness.isVerified ? (
              <>
                <span className="bg-emerald-500/90 backdrop-blur-md text-white text-xs font-semibold px-2.5 py-1.5 rounded-full border border-emerald-400/30 shadow-md flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>موثّق رسمياً</span>
                </span>
                {currentBusiness.externalLogoUrl && (
                  <a href={currentBusiness.externalLogoUrl} target="_blank" rel="noopener noreferrer" title="فتح رابط اللوجو الخارجي" className="bg-white/95 text-slate-800 text-[11px] font-bold px-2.5 py-1.5 rounded-full shadow-md hover:bg-white">
                    اللوجو
                  </a>
                )}
                {currentBusiness.externalCoverUrl && (
                  <a href={currentBusiness.externalCoverUrl} target="_blank" rel="noopener noreferrer" title="فتح رابط الغلاف الخارجي" className="bg-white/95 text-slate-800 text-[11px] font-bold px-2.5 py-1.5 rounded-full shadow-md hover:bg-white">
                    الغلاف
                  </a>
                )}
              </>
          ) : (
            <span className="bg-slate-900/85 backdrop-blur-md text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/20 shadow-md">
              نشاط غير موثّق
            </span>
          )}
        </div>

        {/* Share Button top left */}
        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-20 max-w-[calc(100%-1.5rem)]">
          <button
            type="button"
            onClick={handleShare}
            aria-label={`مشاركة رابط نشاط ${currentBusiness.name}`}
            className="mx-v4-storefront-share flex cursor-pointer items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold backdrop-blur-md transition-all active:scale-95 focus-visible:outline"
          >
            <span className="sr-only" aria-live="polite">
              {copied ? 'تم نسخ رابط النشاط' : shareFailed ? 'تعذر نسخ الرابط' : ''}
            </span>
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">تم نسخ الرابط!</span>
              </>
            ) : shareFailed ? (
              <span className="text-rose-700">تعذر نسخ الرابط</span>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-slate-600" />
                <span>مشاركة النشاط</span>
              </>
            )}
          </button>
        </div>
        </section>
      </div>

      {/* 2. Profile Details Bar */}
      <section aria-label={`بيانات نشاط ${currentBusiness.name}`} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative pb-6 border-b border-slate-100">
          <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-6 pt-3">
            {/* Logo & Core Identity */}
            <div className="flex min-w-0 flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-right">
              {/* Business Logo */}
              <div className="relative -mt-16 sm:-mt-20 md:-mt-24 w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-3xl bg-white p-1.5 shadow-2xl ring-4 ring-white flex-shrink-0 overflow-hidden z-20">
                <img
                  src={isPlatformBrandProfile ? defaultLogo : currentBusiness.logoUrl || defaultLogo}
                  alt={`شعار ${currentBusiness.name}`}
                  className={`w-full h-full object-cover rounded-2xl bg-slate-100 ${
                    isFrozen ? 'grayscale opacity-80' : ''
                  }`}
                  onError={(e) => {
                    const image = e.currentTarget;
                    if (image.dataset.defaultFallbackApplied !== 'true') {
                      image.dataset.defaultFallbackApplied = 'true';
                      image.src = defaultLogo;
                    }
                  }}
                />
                <div
                  data-testid="business-verification-indicator"
                  aria-label={isFrozen ? 'حالة النشاط: مجمد مؤقتاً' : currentBusiness.isVerified ? 'حالة النشاط: موثّق رسمياً' : 'حالة النشاط: غير موثّق'}
                  title={isFrozen ? 'مجمد مؤقتاً' : currentBusiness.isVerified ? 'موثّق رسمياً' : 'غير موثّق'}
                  className={`absolute bottom-2.5 left-2.5 text-white rounded-full p-1 shadow-md border-2 border-white ${
                    isFrozen ? 'bg-rose-600' : currentBusiness.isVerified ? 'bg-emerald-500' : 'bg-slate-500'
                  }`}
                >
                  {isFrozen ? <Ban className="w-4 h-4" /> : currentBusiness.isVerified ? <CheckCircle2 className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                </div>
              </div>

              {/* Business Titles & Meta */}
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {currentBusiness.name}
                  </h1>
                  <span className="mx-v4-storefront-category rounded-full border px-3 py-0.5 text-xs font-black">
                    {currentBusiness.category}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                  {currentBusiness.bio}
                </p>

                {/* Location & Working Hours metadata */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-500 pt-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    <MapPin className="w-4 h-4 text-[var(--mx-blue-700)] flex-shrink-0" />
                    <span>{currentBusiness.address}</span>
                  </div>
                  {currentBusiness.workingHours && (
                    <div className="flex items-center gap-1.5 font-medium">
                      <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span>{currentBusiness.workingHours}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Quick Actions: phone, messaging, social profiles, and QR code */}
            <div className="flex w-full min-w-0 max-w-full items-center justify-center sm:justify-start gap-2.5 flex-wrap pt-2 md:pt-4 xl:w-[56%]">
              {dialPhone && (
                <a href={`tel:${dialPhone}`} className="mx-v4-storefront-primary flex cursor-pointer items-center gap-2 rounded-2xl px-4 py-3 text-xs font-black transition-all sm:text-sm" aria-label={`اتصال هاتفي بـ ${currentBusiness.name}`}>
                  <Phone className="w-4 h-4" />
                  <span>اتصال هاتفي</span>
                </a>
              )}
              {facebookUrl && (
                <a href={facebookUrl} target="_blank" rel="noopener noreferrer" className="bg-[#1877F2] hover:bg-[#1666cf] text-white font-black text-xs sm:text-sm py-3 px-4 rounded-2xl shadow-md flex items-center gap-2 transition-all cursor-pointer" aria-label={`صفحة فيسبوك ${currentBusiness.name}`}>
                  <Facebook className="w-4 h-4" />
                  <span>فيسبوك</span>
                </a>
              )}
              {tiktokUrl && (
                <a href={tiktokUrl} target="_blank" rel="noopener noreferrer" className="bg-slate-950 hover:bg-black text-white font-black text-xs sm:text-sm py-3 px-4 rounded-2xl shadow-md flex items-center gap-2 transition-all cursor-pointer" aria-label={`تيك توك ${currentBusiness.name}`}>
                  <Music2 className="w-4 h-4" />
                  <span>تيك توك</span>
                </a>
              )}
              {instagramUrl && (
                <a href={instagramUrl} target="_blank" rel="noopener noreferrer" className="bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:opacity-90 text-white font-black text-xs sm:text-sm py-3 px-4 rounded-2xl shadow-md flex items-center gap-2 transition-all cursor-pointer" aria-label={`إنستجرام ${currentBusiness.name}`}>
                  <Instagram className="w-4 h-4" />
                  <span>إنستجرام</span>
                </a>
              )}
              {additionalContactPhones.map((phone, index) => (
                <a key={`${phone}-${index}`} href={`tel:${phone}`} className="bg-slate-700 hover:bg-slate-800 text-white font-black text-xs sm:text-sm py-3 px-4 rounded-2xl shadow-md flex items-center gap-2 transition-all cursor-pointer" aria-label={`اتصال هاتفي إضافي رقم ${index + 1} بـ ${currentBusiness.name}`}>
                  <Phone className="w-4 h-4" />
                  <span>اتصال إضافي {index + 1}</span>
                </a>
              ))}
              {merchantWhatsAppUrl && (
                <a
                  href={merchantWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm py-3 px-5 rounded-2xl shadow-lg shadow-emerald-600/25 flex items-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>مراسلة صاحب النشاط (واتساب)</span>
                </a>
              )}

              <a
                href={currentBusiness.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(currentBusiness.name + ' ' + currentBusiness.governorate + ' ' + currentBusiness.markaz + ' ' + currentBusiness.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mx-v4-storefront-secondary flex cursor-pointer items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-bold transition-all sm:text-sm"
                title="عرض موقع النشاط على خرائط جوجل"
              >
                <MapPin className="w-4 h-4 text-[var(--mx-blue-700)]" />
                <span>موقع النشاط (خرائط جوجل)</span>
              </a>

              <button
                onClick={() => setIsQrModalOpen(true)}
                className="mx-v4-storefront-secondary flex cursor-pointer items-center gap-2 rounded-2xl border px-4 py-3 text-xs font-bold transition-all sm:text-sm"
                title="عرض QR كود النشاط الدائم"
              >
                <QrCode className="w-4 h-4 text-[var(--mx-blue-700)]" />
                <span>عرض QR كود النشاط</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {promotionalImages.length > 0 && (
        <section
          aria-label={`الصور الترويجية لنشاط ${currentBusiness.name}`}
          data-testid="storefront-promotional-gallery"
          className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8"
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-slate-900">صور وأعمال النشاط</h2>
              <p className="mt-1 text-xs text-slate-500">معرض الصور الترويجية</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600">
              {promotionalImages.length} صور
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {promotionalImages.map((image, index) => (
              <a
                key={image}
                href={image}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`فتح الصورة الترويجية رقم ${index + 1}`}
                className="group overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <img
                  src={image}
                  alt={`صورة ترويجية ${index + 1} لنشاط ${currentBusiness.name}`}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition duration-300 group-hover:scale-105"
                />
              </a>
            ))}
          </div>
        </section>
      )}

      <QRCodeModal
        business={currentBusiness}
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
      />
    </div>
  );
};
