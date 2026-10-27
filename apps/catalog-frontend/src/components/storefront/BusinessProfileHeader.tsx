import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { QRCodeModal } from '../common/QRCodeModal';
import {
  MessageCircle,
  MapPin,
  Clock,
  Phone,
  CheckCircle2,
  Share2,
  Building2,
  Check,
  AlertTriangle,
  Ban,
  Sparkles,
  QrCode,
} from 'lucide-react';

const BUSINESS_PLACEHOLDER = `${import.meta.env.BASE_URL || '/'}business-placeholder.svg`;

export const BusinessProfileHeader: React.FC = () => {
  const { currentBusiness, adminSettings, setCurrentView } = useApp();
  const [copied, setCopied] = useState(false);
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Platform Ad banner image for registering new business in MantiqatiX
  const platformAdCover = 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1600&auto=format&fit=crop&q=80';

  // Build the 3 slides for the Cover slider (3 seconds rotation)
  // Slide 1: Primary merchant cover (or default)
  // Slide 2: Second merchant cover (if provided) OR platform ad banner
  // Slide 3: Platform ad banner for registering new business in MantiqatiX
  const slides = React.useMemo(() => {
    if (!currentBusiness) return [platformAdCover];
    const merchantCovers = currentBusiness.coverImages && currentBusiness.coverImages.length > 0
      ? currentBusiness.coverImages
      : [currentBusiness.coverUrl || BUSINESS_PLACEHOLDER];

    if (merchantCovers.length === 1) {
      return [merchantCovers[0], platformAdCover, platformAdCover];
    } else if (merchantCovers.length >= 2) {
      return [merchantCovers[0], merchantCovers[1], platformAdCover];
    }
    return [currentBusiness.coverUrl, platformAdCover, platformAdCover];
  }, [currentBusiness]);

  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlideIndex((prev) => (prev + 1) % slides.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (!currentBusiness) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 text-center text-slate-500">
        لم يتم العثور على نشاط تجاري محدد.
      </div>
    );
  }

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const cleanOwnerPhone = String(currentBusiness.ownerWhatsApp || '').replace(/[^\d]/g, '');
  const hasOwnerPhone = cleanOwnerPhone.length >= 10 && cleanOwnerPhone.length <= 15;
  const merchantWhatsAppUrl = `https://wa.me/${cleanOwnerPhone}?text=${encodeURIComponent(
    `مرحباً، أود الاستفسار والطلب من نشاطكم: ${currentBusiness.name}`
  )}`;

  const isFrozen = currentBusiness.isFrozen || currentBusiness.paymentStatus === 'frozen';
  const isCurrentSlideAd = currentSlideIndex === 2 || (currentSlideIndex === 1 && (!currentBusiness.coverImages || currentBusiness.coverImages.length < 2));

  return (
    <div className="relative bg-white border-b border-slate-200/80 shadow-xs mb-8">
      {/* Urgent Frozen Notice Banner if activity is frozen past 5 days */}
      {isFrozen && (
        <div className="bg-rose-600 text-white p-3.5 sm:p-4 text-center text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-md">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 animate-bounce" />
          <span>⚠️ هذا النشاط التجاري مجمد مؤقتاً لعدم سداد المستحقات المالية - يرجى مراجعة إدارة المنصة للتفعيل</span>
        </div>
      )}

      {/* 1. Rotating Cover Photo Slider (Changes every 3 seconds) */}
      <div className="relative w-full h-56 sm:h-72 md:h-84 lg:h-96 bg-slate-900 overflow-hidden group">
        {slides.map((imgUrl, idx) => (
          <div
            key={idx}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${
              idx === currentSlideIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
          >
            <img
              src={imgUrl}
              alt={`غلاف ${currentBusiness.name} - شريحة ${idx + 1}`}
              className={`w-full h-full object-cover object-center transform transition-transform duration-700 ${
                isFrozen ? 'grayscale contrast-125 opacity-75' : ''
              }`}
              onError={(e) => {
                const image = e.currentTarget;
                if (!image.src.endsWith('/business-placeholder.svg')) image.src = BUSINESS_PLACEHOLDER;
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-black/30" />
          </div>
        ))}

        {/* Platform Advertisement Overlay when Ad slide is active */}
        {isCurrentSlideAd && (
          <div className="absolute inset-x-0 bottom-16 sm:bottom-20 z-20 flex justify-center px-4 pointer-events-none">
            <div className="bg-slate-900/90 backdrop-blur-md border border-amber-400/50 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 pointer-events-auto max-w-lg text-center sm:text-right">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center flex-shrink-0 shadow-md">
                <Sparkles className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-black text-amber-300">إعلان منصة MantiqatiX</div>
                <div className="text-[11px] text-slate-200 truncate">هل تمتلك نشاطاً تجارياً؟ أنشئ كتالوجك الفوري الآن</div>
              </div>
              <button
                onClick={() => setCurrentView('directory')}
                className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs px-3 py-2 rounded-xl shadow-md transition-colors whitespace-nowrap cursor-pointer"
              >
                سجل نشاطك
              </button>
            </div>
          </div>
        )}

        {/* Slider Indicators (Dots) */}
        <div className="absolute bottom-4 right-1/2 translate-x-1/2 z-20 flex items-center gap-1.5 bg-black/40 backdrop-blur-xs px-3 py-1.5 rounded-full border border-white/15">
          {slides.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentSlideIndex(idx)}
              className={`h-2 rounded-full transition-all cursor-pointer ${
                idx === currentSlideIndex ? 'w-6 bg-emerald-400' : 'w-2 bg-white/50 hover:bg-white'
              }`}
              aria-label={`انتقل للشريحة ${idx + 1}`}
            />
          ))}
        </div>

        {/* Top Floating Badge: Verification & Status */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {isFrozen ? (
            <span className="bg-rose-600/95 backdrop-blur-md text-white text-xs font-black px-3 py-1.5 rounded-full border border-rose-400 shadow-md flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5" />
              <span>نشاط مجمد مؤقتاً</span>
            </span>
          ) : (
            currentBusiness.isVerified && (
              <span className="bg-emerald-500/90 backdrop-blur-md text-white text-xs font-semibold px-2.5 py-1.5 rounded-full border border-emerald-400/30 shadow-md flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>موثّق رسمياً</span>
              </span>
            )
          )}
        </div>

        {/* Share Button top left */}
        <div className="absolute top-4 left-4 z-20">
          <button
            onClick={handleShare}
            className="bg-white/90 hover:bg-white text-slate-800 text-xs font-bold px-3 py-1.5 rounded-full shadow-md backdrop-blur-md flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">تم نسخ الرابط!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-slate-600" />
                <span>مشاركة النشاط</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2. Profile Details Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative pb-6 border-b border-slate-100">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 pt-3">
            {/* Logo & Core Identity */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-right">
              {/* Business Logo */}
              <div className="relative -mt-16 sm:-mt-20 md:-mt-24 w-32 h-32 sm:w-36 sm:h-36 md:w-40 md:h-40 rounded-3xl bg-white p-1.5 shadow-2xl ring-4 ring-white flex-shrink-0 overflow-hidden z-20">
                <img
                  src={currentBusiness.logoUrl || BUSINESS_PLACEHOLDER}
                  alt={`شعار ${currentBusiness.name}`}
                  className={`w-full h-full object-cover rounded-2xl bg-slate-100 ${
                    isFrozen ? 'grayscale opacity-80' : ''
                  }`}
                  onError={(e) => {
                    const image = e.currentTarget;
                    if (!image.src.endsWith('/business-placeholder.svg')) image.src = BUSINESS_PLACEHOLDER;
                  }}
                />
                <div
                  className={`absolute bottom-2.5 left-2.5 text-white rounded-full p-1 shadow-md border-2 border-white ${
                    isFrozen ? 'bg-rose-600' : 'bg-emerald-500'
                  }`}
                >
                  {isFrozen ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                </div>
              </div>

              {/* Business Titles & Meta */}
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    {currentBusiness.name}
                  </h1>
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-black px-3 py-0.5 rounded-full">
                    {currentBusiness.category}
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
                  {currentBusiness.bio}
                </p>

                {/* Location & Working Hours metadata */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-xs text-slate-500 pt-1">
                  <div className="flex items-center gap-1.5 font-medium">
                    <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>{[currentBusiness.address, currentBusiness.governorate, currentBusiness.markaz, currentBusiness.village].filter(Boolean).join('، ') || 'الموقع غير مسجل'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 font-medium">
                    <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>{currentBusiness.workingHours || 'ساعات العمل غير مسجلة'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions (WhatsApp & QR Code) */}
            <div className="flex items-center justify-center sm:justify-start gap-2.5 flex-wrap flex-shrink-0 pt-2 md:pt-4">
              {hasOwnerPhone ? (
                <a
                  href={merchantWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs sm:text-sm py-3 px-5 rounded-2xl shadow-lg shadow-emerald-600/25 flex items-center gap-2 transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>مراسلة صاحب النشاط (واتساب)</span>
                </a>
              ) : (
                <span className="bg-slate-100 text-slate-600 text-xs font-bold py-3 px-4 rounded-2xl border border-slate-200" role="status">
                  رقم واتساب النشاط غير مسجل
                </span>
              )}

              <a
                href={currentBusiness.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(currentBusiness.name + ' ' + currentBusiness.governorate + ' ' + currentBusiness.markaz + ' ' + currentBusiness.address)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm py-3 px-4 rounded-2xl shadow-xs flex items-center gap-2 transition-all cursor-pointer border border-slate-200"
                title="عرض موقع النشاط على خرائط جوجل"
              >
                <MapPin className="w-4 h-4 text-emerald-600" />
                <span>موقع النشاط (خرائط جوجل)</span>
              </a>

              <button
                onClick={() => setIsQrModalOpen(true)}
                className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm py-3 px-4 rounded-2xl shadow-xs flex items-center gap-2 transition-all cursor-pointer border border-slate-200"
                title="عرض QR كود النشاط الدائم"
              >
                <QrCode className="w-4 h-4 text-emerald-600" />
                <span>عرض QR كود النشاط</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <QRCodeModal
        business={currentBusiness}
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
      />
    </div>
  );
};
