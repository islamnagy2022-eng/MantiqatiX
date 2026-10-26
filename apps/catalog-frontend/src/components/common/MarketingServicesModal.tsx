import React, { useState } from 'react';
import { Business } from '../../types';
import { useApp } from '../../context/AppContext';
import { cleanPhoneNumber } from '../../utils/rules';
import {
  Megaphone,
  Palette,
  Target,
  Share2,
  Camera,
  Video,
  Sparkles,
  X,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';

interface MarketingServicesModalProps {
  business: Business;
  isOpen: boolean;
  onClose: () => void;
}

interface MarketingServiceItem {
  id: string;
  title: string;
  englishTitle: string;
  description: string;
  icon: React.ReactNode;
  badge: string;
}

export const MarketingServicesModal: React.FC<MarketingServicesModalProps> = ({
  business,
  isOpen,
  onClose,
}) => {
  const { adminSettings } = useApp();
  const [customNote, setCustomNote] = useState('');

  if (!isOpen) return null;

  const marketingServices: MarketingServiceItem[] = [
    {
      id: 'design',
      title: 'طلب تصميم',
      englishTitle: 'Graphic Design & Visual Identity',
      description: 'تصميم شعارات، هويات بصرية متكاملة، بوسترات إعلانية، ومنشورات سوشيال ميديا احترافية تليق بنشاطك.',
      icon: <Palette className="w-6 h-6 text-indigo-600" />,
      badge: 'هويات وبوسترات',
    },
    {
      id: 'sponsored_ad',
      title: 'طلب اعلان ممول',
      englishTitle: 'Sponsored Ads Campaign Management',
      description: 'إدارة حملات إعلانية ممولة دقيقة وموجهة لجمهورك المستهدف على فيسبوك، إنستجرام، وتيك توك لتحقيق أعلى مبيعات.',
      icon: <Megaphone className="w-6 h-6 text-emerald-600" />,
      badge: 'حملات ممولة دقيقة',
    },
    {
      id: 'marketing_plan',
      title: 'طلب خطة تسويقية',
      englishTitle: 'Strategic Marketing Plan',
      description: 'إعداد استراتيجية وخطة تسويقية شاملة لتحليل السوق والمنافسين وزيادة الحصة السوقية لنشاطك التجاري.',
      icon: <Target className="w-6 h-6 text-amber-600" />,
      badge: 'استراتيجية نمو',
    },
    {
      id: 'social_media',
      title: 'طلب إدارة صفحات السوشيال ميديا',
      englishTitle: 'Social Media Pages Management',
      description: 'إدارة كاملة لصفحاتك (النشر المنتظم، الرد على العملاء، كتابة المحتوى الجذاب، وزيادة التفاعل والعملاء المهتمين).',
      icon: <Share2 className="w-6 h-6 text-blue-600" />,
      badge: 'إدارة وتفاعل',
    },
    {
      id: 'photography',
      title: 'طلب تصوير',
      englishTitle: 'Professional Commercial Photography',
      description: 'جلسات تصوير احترافية للمنتجات والأطباق أو مقر النشاط التجاري لإبراز الجودة وجذب انتباه العملاء.',
      icon: <Camera className="w-6 h-6 text-purple-600" />,
      badge: 'تصوير تجاري',
    },
    {
      id: 'ai_video',
      title: 'طلب فيديو ذكاء اصطناعي',
      englishTitle: 'AI Commercial Video Production',
      description: 'إنتاج فيديوهات إعلانية مبتكرة ومتحركة بالاعتماد على أدوات الذكاء الاصطناعي لعروض المنتجات والخدمات.',
      icon: <Video className="w-6 h-6 text-rose-600" />,
      badge: 'فيديوهات ذكية',
    },
    {
      id: 'presence_package',
      title: 'طلب باقة الانتشار و التواجد',
      englishTitle: 'Presence & Expansion Package',
      description: 'الباقة الشاملة للسيطرة والتواجد الرقمي القوي (تصميم + إدارة سوشيال + حملات ممولة + فيديو ترويجي + كتالوج ذكي).',
      icon: <Sparkles className="w-6 h-6 text-amber-700" />,
      badge: 'الباقة الشاملة',
    },
  ];

  const handleRequestService = (service: MarketingServiceItem) => {
    const adminPhone = cleanPhoneNumber(adminSettings.adminWhatsApp || '+201012345678');
    
    let message = `مرحباً إدارة MantiqatiX 👋\n\n`;
    message += `أرغب في طلب خدمة تسويقية من إدارة الموقع لنشاطي التجاري:\n`;
    message += `🏢 *اسم النشاط:* ${business.name}\n`;
    message += `🏷️ *التصنيف:* ${business.category} (${business.governorate} - ${business.markaz})\n`;
    message += `🎯 *الخدمة المطلوبة:* ${service.title} [${service.englishTitle}]\n`;
    
    if (customNote.trim()) {
      message += `📝 *ملاحظات وتفاصيل إضافية:* ${customNote.trim()}\n`;
    }

    message += `\nيرجى التواصل معي لتنسيق التفاصيل وتحديد التكلفة المناسبة لنشاطنا. شكراً لكم!`;

    const whatsappUrl = `https://wa.me/${adminPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white rounded-3xl w-full max-w-4xl p-5 sm:p-8 shadow-2xl border border-slate-100 relative text-right animate-in fade-in zoom-in duration-200 my-auto">
        <button
          onClick={onClose}
          className="absolute top-4 left-4 sm:top-6 sm:left-6 p-2.5 text-slate-400 hover:text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-full transition-colors cursor-pointer z-10"
          aria-label="إغلاق النافذة"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3.5 mb-5 pr-1">
          <div className="p-3.5 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-200 shadow-xs flex-shrink-0">
            <Megaphone className="w-7 h-7" />
          </div>
          <div className="min-w-0 pr-1">
            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 inline-block mb-1">
              خدمات التسويق وإدارة النمو • MantiqatiX
            </span>
            <h3 className="text-lg sm:text-2xl font-black text-slate-900 truncate">
              طلب خدمات تسويقية لنشاط: {business.name}
            </h3>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 mb-6 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
          اختر الخدمة التسويقية المطلوبة لنشاطك التجاري؛ جميع الخدمات تديرها إدارة المنصة مباشرة <strong>بدون تحديد سعر ثابت</strong>، حيث يتم دراسة حالة نشاطك وتحديد السعر الأنسب عبر التواصل المباشر مع إدارة المنصة.
        </p>

        {/* Optional Custom Note Input */}
        <div className="mb-6">
          <label className="block text-xs font-black text-slate-800 mb-1.5">
            ملاحظات أو تفاصيل إضافية حول طلبك (اختياري):
          </label>
          <input
            type="text"
            value={customNote}
            onChange={(e) => setCustomNote(e.target.value)}
            placeholder="مثال: أرغب في تركيز الحملة على منطقة المنصورة لزيادة مبيعات المنتجات الشتوية..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
          />
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[55vh] overflow-y-auto pr-1">
          {marketingServices.map((service) => (
            <div
              key={service.id}
              className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3"
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-100">
                    {service.icon}
                  </div>
                  <span className="text-[10px] font-black bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full border border-indigo-100">
                    {service.badge}
                  </span>
                </div>
                <h4 className="font-extrabold text-sm sm:text-base text-slate-900 mb-1">
                  {service.title}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed">
                  {service.description}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400">بدون سعر ثابت (إدارة المنصة)</span>
                <button
                  onClick={() => handleRequestService(service)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span>اطلب الخدمة</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>ضمان جودة الخدمات ودعم مستمر من إدارة MantiqatiX</span>
          </span>
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors cursor-pointer"
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};
