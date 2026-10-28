import React, { useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/production';
import { Product } from '../../types';
import { generateStorePublicUrl, MAX_PRODUCTS_PER_BUSINESS } from '../../utils/rules';
import { resolveDefaultImage } from '../../utils/defaultImages';
import {
  Package,
  Plus,
  Image as ImageIcon,
  Edit,
  Trash2,
  Save,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  Phone,
  Layers,
  Tag,
  AlertCircle,
  Briefcase,
  Store,
  Upload,
  MapPin,
  BellRing,
  Ban,
  MessageCircle,
  Calendar,
  UtensilsCrossed,
  ShoppingBag,
  CalendarCheck2,
  HeartPulse,
  Wrench,
  ChevronRight,
  ShieldAlert,
  QrCode,
} from 'lucide-react';
import { QRCodeModal } from '../common/QRCodeModal';
import { BusinessEmployeeManager } from './BusinessEmployeeManager';
import { CatalogImportPanel } from './CatalogImportPanel';
import { normalizeSocialUrl } from '../../utils/socialLinks';


type FacebookPageOption = { id: string; name: string; link?: string; category?: string };
type FacebookPageProfile = {
  pageId: string;
  pageUrl: string;
  name: string;
  category: string;
  logoUrl: string;
  coverUrl: string;
  bio: string;
  address: string;
  workingHours: string;
};

let facebookSdkPromise: Promise<any> | null = null;
let facebookSdkAppId = '';

function getConfiguredFacebookAppId(): string {
  const config = (window as any).MANTIQATIX_CONFIG || (window as any).MNTY_CONFIG || {};
  return String(config.facebookAppId || '').trim();
}

function loadFacebookSdk(appId: string): Promise<any> {
  const win = window as any;
  if (win.FB && facebookSdkAppId === appId) return Promise.resolve(win.FB);
  if (facebookSdkPromise) return facebookSdkPromise;

  facebookSdkPromise = new Promise((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      facebookSdkPromise = null;
      reject(new Error('تعذر تحميل أداة الاتصال الآمن بفيسبوك. تحقق من اتصال الإنترنت وإعدادات المتصفح.'));
    }, 15000);
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      if (error) {
        facebookSdkPromise = null;
        reject(error);
        return;
      }
      if (!win.FB) {
        facebookSdkPromise = null;
        reject(new Error('لم يتم تحميل أداة فيسبوك بشكل صحيح.'));
        return;
      }
      try {
        win.FB.init({ appId, cookie: false, xfbml: false, version: 'v26.0' });
        facebookSdkAppId = appId;
        resolve(win.FB);
      } catch {
        facebookSdkPromise = null;
        reject(new Error('تعذر تهيئة تطبيق فيسبوك.'));
      }
    };
    win.fbAsyncInit = () => finish();
    const existing = document.getElementById('facebook-jssdk') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => finish(), { once: true });
      existing.addEventListener('error', () => finish(new Error('تعذر تحميل أداة فيسبوك.')), { once: true });
      if (win.FB) finish();
      return;
    }
    const script = document.createElement('script');
    script.id = 'facebook-jssdk';
    script.src = 'https://connect.facebook.net/en_US/sdk.js';
    script.async = true;
    script.defer = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => { if (win.FB) finish(); };
    script.onerror = () => finish(new Error('تعذر تحميل أداة فيسبوك.'));
    document.head.appendChild(script);
  });
  return facebookSdkPromise;
}

async function invokeFacebookPageImport(body: Record<string, unknown>): Promise<any> {
  const { data, error } = await supabase.functions.invoke('facebook-page-import', { body });
  if (error) {
    let payload: any = null;
    try { payload = await (error as any).context?.json?.(); } catch { /* Network errors may have no JSON body. */ }
    throw new Error(String(payload?.message || payload?.error || error.message || 'تعذر الاتصال بفيسبوك.'));
  }
  if (data?.error) throw new Error(String(data.message || data.error || 'تعذر استيراد بيانات صفحة فيسبوك.'));
  return data;
}

const ICONS_MAP: Record<string, React.ReactNode> = {
  dining: <UtensilsCrossed className="w-5 h-5 text-amber-500" />,
  retail: <ShoppingBag className="w-5 h-5 text-blue-500" />,
  services: <CalendarCheck2 className="w-5 h-5 text-purple-500" />,
  healthcare: <HeartPulse className="w-5 h-5 text-emerald-500" />,
  crafts_maintenance: <Wrench className="w-5 h-5 text-orange-500" />,
};

export const MerchantDashboard: React.FC = () => {
  const {
    currentBusiness,
    updateBusiness,
    businessProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    adminSettings,
    functionalGroups,
    setCurrentView,
  } = useApp();

  const permanentStoreUrl = currentBusiness
    ? generateStorePublicUrl(
        typeof window !== 'undefined' ? window.location.origin : 'https://mantiqatix.com',
        currentBusiness.id,
        import.meta.env.BASE_URL || '/'
      )
    : '';
  const permanentQrCodeImageUrl = permanentStoreUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(permanentStoreUrl)}`
    : '';

  const [activeTab, setActiveTab] = useState<'products' | 'import' | 'branding' | 'profile' | 'functional_engine' | 'qr' | 'employees'>('products');
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Business Profile & Branding state
  const [bizName, setBizName] = useState(currentBusiness?.name || '');
  const [bizBio, setBizBio] = useState(currentBusiness?.bio || '');
  const [bizLogoUrl, setBizLogoUrl] = useState(currentBusiness?.logoUrl || '');
  const [bizCoverUrl, setBizCoverUrl] = useState(currentBusiness?.coverUrl || '');
  const [bizOwnerWhatsApp, setBizOwnerWhatsApp] = useState(currentBusiness?.ownerWhatsApp || '');
  const [bizFacebookUrl, setBizFacebookUrl] = useState(currentBusiness?.facebookUrl || '');
  const [bizInstagramUrl, setBizInstagramUrl] = useState(currentBusiness?.instagramUrl || '');
  const [bizTikTokUrl, setBizTikTokUrl] = useState(currentBusiness?.tiktokUrl || '');
  const [bizAddress, setBizAddress] = useState(currentBusiness?.address || '');
  const [bizGov, setBizGov] = useState(currentBusiness?.governorate || '');
  const [bizMarkaz, setBizMarkaz] = useState(currentBusiness?.markaz || '');
  const [bizVillage, setBizVillage] = useState(currentBusiness?.village || '');
  const [bizWorkingHours, setBizWorkingHours] = useState(currentBusiness?.workingHours || '');
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaveError, setProfileSaveError] = useState('');
  const facebookAppId = getConfiguredFacebookAppId();
  const [facebookBusy, setFacebookBusy] = useState(false);
  const [facebookStatus, setFacebookStatus] = useState('');
  const [facebookError, setFacebookError] = useState('');
  const [facebookUserAccessToken, setFacebookUserAccessToken] = useState('');
  const [facebookPages, setFacebookPages] = useState<FacebookPageOption[]>([]);
  const [facebookSelectedPageId, setFacebookSelectedPageId] = useState('');
  const [facebookPreview, setFacebookPreview] = useState<FacebookPageProfile | null>(null);


  // New / Edit Product Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('');
  const [formType, setFormType] = useState<'product' | 'service'>('product');
  const [formPrice, setFormPrice] = useState<string>('');
  const [formComparePrice, setFormComparePrice] = useState<string>('');
  const [formDescription, setFormDescription] = useState('');
  const [formImageUrl, setFormImageUrl] = useState('');
  const [formImageSource, setFormImageSource] = useState<'auto' | 'owner' | 'ai'>('auto');
  const [formUnit, setFormUnit] = useState('قطعة');
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (formImageSource !== 'auto') return;
    setFormImageUrl(resolveDefaultImage({
      name: formName,
      description: formDescription,
      category: formCategory,
      kind: formType === 'service' ? 'service' : 'product',
    }));
  }, [formName, formDescription, formCategory, formType, formImageSource]);

  useEffect(() => {
    setBizName(currentBusiness?.name || '');
    setBizBio(currentBusiness?.bio || '');
    setBizLogoUrl(currentBusiness?.logoUrl || '');
    setBizCoverUrl(currentBusiness?.coverUrl || '');
    setBizOwnerWhatsApp(currentBusiness?.ownerWhatsApp || '');
    setBizFacebookUrl(currentBusiness?.facebookUrl || '');
    setBizInstagramUrl(currentBusiness?.instagramUrl || '');
    setBizTikTokUrl(currentBusiness?.tiktokUrl || '');
    setBizAddress(currentBusiness?.address || '');
    setBizGov(currentBusiness?.governorate || '');
    setBizMarkaz(currentBusiness?.markaz || '');
    setBizVillage(currentBusiness?.village || '');
    setBizWorkingHours(currentBusiness?.workingHours || '');
    setSaveSuccess(false);
    setProfileSaveError('');
  }, [currentBusiness?.id]);
  

  useEffect(() => {
    if (!facebookAppId) return;
    void loadFacebookSdk(facebookAppId).catch((error) => {
      setFacebookError(error instanceof Error ? error.message : 'تعذر تحميل أداة فيسبوك.');
    });
  }, [facebookAppId]);

  useEffect(() => {
    setFacebookUserAccessToken('');
    setFacebookPages([]);
    setFacebookSelectedPageId('');
    setFacebookPreview(null);
    setFacebookStatus('');
    setFacebookError('');
  }, [currentBusiness?.id]);

  const handleConnectFacebook = async (): Promise<void> => {
    setFacebookError('');
    setFacebookStatus('');
    setFacebookPreview(null);
    if (!currentBusiness?.id) {
      setFacebookError('اختر نشاطاً تجارياً أولاً.');
      return;
    }
    if (!facebookAppId) {
      setFacebookError('تكامل فيسبوك غير مهيأ بعد. يلزم إعداد تطبيق Meta من إدارة المنصة قبل تفعيل الاتصال.');
      return;
    }
    setFacebookBusy(true);
    try {
      const sdk = await loadFacebookSdk(facebookAppId);
      const response = await new Promise<any>((resolve) => {
        sdk.login(resolve, {
          scope: 'pages_show_list,pages_read_engagement',
          return_scopes: true,
          auth_type: 'rerequest',
        });
      });
      const token = String(response?.authResponse?.accessToken || '');
      if (!token) throw new Error('لم يتم منح صلاحية الاتصال. وافق على صلاحيات الصفحة ثم حاول مجدداً.');
      const result = await invokeFacebookPageImport({
        action: 'LIST_PAGES',
        businessId: currentBusiness.id,
        facebookUserAccessToken: token,
      });
      const pages = (Array.isArray(result?.pages) ? result.pages : []) as FacebookPageOption[];
      setFacebookUserAccessToken(token);
      setFacebookPages(pages);
      setFacebookSelectedPageId(pages[0]?.id || '');
      if (!pages.length) {
        setFacebookStatus('');
        throw new Error('لم يعثر فيسبوك على صفحات تديرها بهذا الحساب. استخدم حساباً لديه صلاحية إدارة الصفحة.');
      }
      setFacebookStatus(`تم الاتصال. عثرنا على ${pages.length} صفحة يمكنك إدارتها. اختر الصفحة المطلوبة.`);
    } catch (error) {
      setFacebookError(error instanceof Error ? error.message : 'تعذر الاتصال بفيسبوك.');
      setFacebookUserAccessToken('');
      setFacebookPages([]);
    } finally {
      setFacebookBusy(false);
    }
  };

  const handleReadFacebookPage = async (): Promise<void> => {
    setFacebookError('');
    setFacebookStatus('');
    setFacebookPreview(null);
    if (!facebookUserAccessToken || !facebookSelectedPageId || !currentBusiness?.id) {
      setFacebookError('اتصل بفيسبوك واختر الصفحة المطلوب استيراد بياناتها أولاً.');
      return;
    }
    setFacebookBusy(true);
    try {
      const result = await invokeFacebookPageImport({
        action: 'IMPORT_PAGE',
        businessId: currentBusiness.id,
        facebookUserAccessToken,
        pageId: facebookSelectedPageId,
      });
      setFacebookPreview(result.profile as FacebookPageProfile);
      setFacebookStatus('تمت قراءة بيانات الصفحة. راجع المعاينة ثم اختر استخدام البيانات لنقلها إلى نموذج النشاط.');
    } catch (error) {
      setFacebookError(error instanceof Error ? error.message : 'تعذر قراءة بيانات صفحة فيسبوك.');
    } finally {
      setFacebookBusy(false);
    }
  };

  const handleApplyFacebookProfile = (): void => {
    if (!facebookPreview) return;
    const profile = facebookPreview;
    if (profile.name) setBizName(profile.name);
    if (profile.logoUrl) setBizLogoUrl(profile.logoUrl);
    if (profile.coverUrl) setBizCoverUrl(profile.coverUrl);
    if (profile.bio) setBizBio(profile.bio);
    if (profile.address) setBizAddress(profile.address);
    if (profile.workingHours) setBizWorkingHours(profile.workingHours);
    setFacebookUserAccessToken('');
    setFacebookPages([]);
    setFacebookSelectedPageId('');
    setFacebookPreview(null);
    setFacebookStatus('نُقلت البيانات المتاحة إلى نموذج النشاط. راجع الحقول واضغط «حفظ التغييرات» لحفظها في الكتالوج.');
  };

  // On first owner visit, persist a category-matched local cover when no real cover photo is available.
  // This is a fallback until the owner uploads a photograph.
  const autoCoverAttempted = useRef<Set<string>>(new Set());
  useEffect(() => {
    const business = currentBusiness;
    if (!business?.id || !business.tenantId || !business.branchId) return;
    const needsDefaultCover = !business.coverUrl?.trim() ||
      /(?:business-placeholder\.svg|catalog-item-placeholder\.svg|\/legacy\/activity\/|\/legacy\/mnty-cover-ad-)/i.test(business.coverUrl);
    if (!needsDefaultCover || autoCoverAttempted.current.has(business.id)) return;
    autoCoverAttempted.current.add(business.id);
    void updateBusiness({
      ...business,
      coverUrl: resolveDefaultImage({
        name: business.name, description: business.bio, category: business.category, kind: 'cover',
      }),
      logoUrl: business.logoUrl?.trim() || resolveDefaultImage({
        name: business.name, description: business.bio, category: business.category, kind: 'activity',
      }),
    }).catch((error) => {
      console.warn('Automatic activity cover generation deferred; contextual fallback remains available.', error);
    });
  }, [currentBusiness?.id, currentBusiness?.coverUrl, currentBusiness?.tenantId, currentBusiness?.branchId]);


  if (!currentBusiness) {
    return <div className="p-8 text-center text-slate-500">يرجى اختيار نشاط أولاً.</div>;
  }

  const productsCount = businessProducts.length;
  const maxLimit = currentBusiness.maxProductsLimit || MAX_PRODUCTS_PER_BUSINESS;
  const remainingQuota = Math.max(0, maxLimit - productsCount);
  const quotaPercent = Math.min(100, Math.round((productsCount / maxLimit) * 100));

  const currentGroupInfo = functionalGroups.find(
    (g) => g.id === currentBusiness.functionalGroupId
  );

  const handleSaveBusiness = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    setSaveSuccess(false);
    setProfileSaveError('');

    const phoneDigits = bizOwnerWhatsApp.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      setProfileSaveError('أدخل رقم واتساب صحيحًا لصاحب النشاط من 10 إلى 15 رقمًا.');
      return;
    }
    if (![bizGov, bizMarkaz, bizVillage].every((value) => value.trim())) {
      setProfileSaveError('أدخل المحافظة والمركز أو القسم والقرية أو الحي الفعلي للنشاط.');
      return;
    }
    if (bizName.trim().length < 2) {
      setProfileSaveError('اسم النشاط يجب ألا يقل عن حرفين.');
      return;
    }
    const facebookUrl = normalizeSocialUrl(bizFacebookUrl, 'facebook');
    const instagramUrl = normalizeSocialUrl(bizInstagramUrl, 'instagram');
    const tiktokUrl = normalizeSocialUrl(bizTikTokUrl, 'tiktok');
    if (bizFacebookUrl.trim() && !facebookUrl) {
      setProfileSaveError('رابط فيسبوك غير صحيح. أدخل رابطًا آمنًا من نطاق Facebook.');
      return;
    }
    if (bizInstagramUrl.trim() && !instagramUrl) {
      setProfileSaveError('رابط إنستجرام غير صحيح. أدخل رابطًا آمنًا من نطاق Instagram.');
      return;
    }
    if (bizTikTokUrl.trim() && !tiktokUrl) {
      setProfileSaveError('رابط تيك توك غير صحيح. أدخل رابطًا آمنًا من نطاق TikTok.');
      return;
    }

    setProfileSaving(true);
    try {
      await updateBusiness({
        ...currentBusiness,
        name: bizName.trim(),
        bio: bizBio.trim(),
        logoUrl: bizLogoUrl.trim(),
        coverUrl: bizCoverUrl.trim(),
        ownerWhatsApp: bizOwnerWhatsApp.trim(),
        facebookUrl,
        instagramUrl,
        tiktokUrl,
        address: bizAddress.trim(),
        governorate: bizGov.trim(),
        markaz: bizMarkaz.trim(),
        village: bizVillage.trim(),
        workingHours: bizWorkingHours.trim(),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (error) {
      setProfileSaveError(error instanceof Error ? error.message : 'تعذر حفظ بيانات النشاط في قاعدة الإنتاج.');
    } finally {
      setProfileSaving(false);
    }
  };

  const openAddModal = () => {
    setEditingProduct(null);
    setFormName('');
    setFormCategory(businessProducts[0]?.category || 'عام');
    setFormType('product');
    setFormPrice('');
    setFormComparePrice('');
    setFormDescription('');
    setFormImageSource('auto');
    setFormImageUrl(resolveDefaultImage({ name: '', category: businessProducts[0]?.category, kind: 'product' }));
    setFormUnit('قطعة');
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setEditingProduct(p);
    setFormName(p.name);
    setFormCategory(p.category);
    setFormType(p.type);
    setFormPrice(String(p.price));
    setFormComparePrice(p.comparePrice ? String(p.comparePrice) : '');
    setFormDescription(p.description);
    setFormImageSource(p.imageSource === 'auto' ? 'auto' : p.imageSource === 'ai' ? 'ai' : 'owner');
    setFormImageUrl(p.imageUrl || resolveDefaultImage({ name: p.name, description: p.description, category: p.category, kind: p.type === 'service' ? 'service' : 'product' }));
    setFormUnit(p.unit || (p.type === 'service' ? 'جلسة' : 'قطعة'));
    setFormError('');
    setIsModalOpen(true);
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formName.trim()) {
      setFormError('يرجى إدخال اسم المنتج أو الخدمة.');
      return;
    }
    const priceValue = formPrice.trim() === '' ? Number.NaN : Number(formPrice);
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      setFormError('أدخل السعر الحقيقي للمنتج أو الخدمة بالجنيه المصري. اتركه دون حفظ حتى تعرف السعر الصحيح.');
      return;
    }

    const comparePriceVal = formComparePrice.trim() ? Number(formComparePrice) : undefined;
    if (comparePriceVal !== undefined && (!Number.isFinite(comparePriceVal) || comparePriceVal < 0)) {
      setFormError('السعر قبل الخصم يجب أن يكون رقمًا صالحًا غير سالب.');
      return;
    }

    if (editingProduct) {
      try {
      await updateProduct({
        ...editingProduct,
        name: formName,
        category: formCategory || 'عام',
        type: formType,
        price: priceValue,
        comparePrice: comparePriceVal,
        description: formDescription,
        imageUrl: formImageUrl || resolveDefaultImage({ name: formName, description: formDescription, category: formCategory, kind: formType === 'service' ? 'service' : 'product' }),
        imageSource: formImageUrl.trim() ? formImageSource : 'auto',
        unit: formUnit,
      });
      setIsModalOpen(false);
      } catch (error) { setFormError(error instanceof Error ? error.message : 'تعذر حفظ التعديلات.'); }
    } else {
      const res = await addProduct({
        businessId: currentBusiness.id,
        name: formName,
        category: formCategory || 'عام',
        type: formType,
        price: priceValue,
        comparePrice: comparePriceVal,
        description: formDescription,
        imageUrl: formImageUrl || resolveDefaultImage({ name: formName, description: formDescription, category: formCategory, kind: formType === 'service' ? 'service' : 'product' }),
        imageSource: formImageUrl.trim() ? formImageSource : 'auto',
        isAvailable: true,
        unit: formUnit,
      });

      if (res.success) {
        setIsModalOpen(false);
      } else {
        setFormError(res.message || 'تعذر إضافة المنتج.');
      }
    }
  };

  const isFrozen = currentBusiness.isFrozen || (currentBusiness.overdueDaysCount && currentBusiness.overdueDaysCount > 5);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Page Freeze Warning Banner */}
      {isFrozen && (
        <div className="bg-rose-600 text-white p-4 sm:p-5 rounded-3xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-2xl">
              <Ban className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-black text-sm sm:text-base">
                صفحة الكتالوج مجمدة مؤقتاً لعدم سداد المستحقات
              </h3>
              <p className="text-xs text-rose-100 mt-0.5">
                انقضت مهلة الـ 5 أيام للسداد الدوري. تم تجميد صفحة نشاطك مؤقتاً ولن تتمكن من تلقي طلبات جديدة لحين قيام الإدارة بتأكيد السداد.
              </p>
            </div>
          </div>
          <span className="text-xs font-bold bg-white text-rose-700 px-4 py-2 rounded-xl flex-shrink-0">
            تواصل مع إدارة MantiqatiX
          </span>
        </div>
      )}

      {!currentBusiness.branchId && (
        <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-right text-amber-950" dir="rtl">
          <h3 className="font-black text-sm">تم التعرف على نشاطك لكن الفرع غير مهيأ بعد</h3>
          <p className="mt-1 text-xs leading-6">
            عضوية الحساب محفوظة، لكن لا يوجد فرع نشط مرتبط بالنشاط في قاعدة الإنتاج. تواصل مع إدارة MantiqatiX لإعداد الفرع قبل تعديل المنتجات والأسعار. لن ننشئ فرعًا أو نغير بيانات الإنتاج تلقائيًا.
          </p>
        </div>
      )}

      {/* Header with Title and Quick Quota indicator */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              لوحة تحكم صاحب النشاط
            </span>
            <span className="text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1 rounded-full">
              النشاط: {currentBusiness.name}
            </span>
            {currentGroupInfo && (
              <span className={`text-xs font-bold px-3 py-1 rounded-full border ${currentGroupInfo.badgeColor}`}>
                {currentGroupInfo.shortName}
              </span>
            )}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            إدارة منتجات وكتالوج نشاطك
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            جميع الأسعار بالجنيه المصري (ج.م) • سعة الكتالوج حتى 150 منتج/خدمة • متصل بواتسابك مباشرة
          </p>
        </div>

        {/* 150 Quota Widget */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 sm:min-w-[280px]">
          <div className="flex items-center justify-between text-xs font-black text-slate-700 mb-2">
            <span>حد المنتجات المستهلك:</span>
            <span className="text-emerald-700">
              {productsCount} من {maxLimit}
            </span>
          </div>

          <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                quotaPercent >= 90
                  ? 'bg-rose-500'
                  : quotaPercent >= 75
                  ? 'bg-amber-500'
                  : 'bg-emerald-600'
              }`}
              style={{ width: `${quotaPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 font-medium">
            <span>المتبقي للإضافة: {remainingQuota} صنف</span>
            <span>{quotaPercent}% مستخدم</span>
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveTab('products')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'products'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>قائمة المنتجات والخدمات ({productsCount})</span>
        </button>

        <button
          onClick={() => setActiveTab('import')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${activeTab === 'import'
            ? 'bg-indigo-600 text-white shadow-md'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Upload className="w-4 h-4" />
          <span>استيراد كتالوج من CSV</span>
        </button>

        <button
          onClick={() => setActiveTab('branding')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'branding'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <ImageIcon className="w-4 h-4" />
          <span>تخصيص الغلاف والشعار (Cover & Logo)</span>
        </button>

        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'profile'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Phone className="w-4 h-4" />
          <span>بيانات النشاط وعنوان القرية / المركز</span>
        </button>

        <button
          onClick={() => setActiveTab('functional_engine')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'functional_engine'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>التصنيف الوظيفي ومسار التطوير</span>
          {currentGroupInfo && (
            <span className="text-[10px] bg-emerald-700 text-white px-2 py-0.5 rounded-full font-bold">
              {currentGroupInfo.shortName}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('qr')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'qr'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <QrCode className="w-4 h-4" />
          <span>QR كود النشاط الدائم</span>
        </button>

        <button
          onClick={() => setActiveTab('employees')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'employees'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>الموظفون والتوظيف</span>
        </button>
      </div>

      {activeTab === 'employees' && <BusinessEmployeeManager business={currentBusiness} />}
      {activeTab === 'import' && <CatalogImportPanel />}

      {/* Tab 1: Products and Catalog Management */}
      {activeTab === 'products' && (
        <div className="space-y-6">
          {/* Action Row */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-2xl border border-slate-200/80">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-700">إجمالي الأصناف المعروضة:</span>
              <span className="text-sm font-black text-slate-900">{productsCount}</span>
              <span className="text-xs text-slate-400">/ {maxLimit} كحد أقصى</span>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                disabled={productsCount >= maxLimit}
                onClick={openAddModal}
                className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة منتج أو خدمة جديدة</span>
              </button>
            </div>
          </div>

          {/* Products Table / List */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">الصورة</th>
                    <th className="py-3 px-4">اسم المنتج / الخدمة</th>
                    <th className="py-3 px-4">النوع</th>
                    <th className="py-3 px-4">التصنيف</th>
                    <th className="py-3 px-4">السعر (ج.م)</th>
                    <th className="py-3 px-4">الوحدة</th>
                    <th className="py-3 px-4 text-center">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {businessProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-slate-400">
                        لا توجد منتجات أو خدمات مضافة بعد. اضغط على "إضافة منتج أو خدمة جديدة" للبدء.
                      </td>
                    </tr>
                  ) : (
                    businessProducts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-12 h-12 rounded-xl object-cover bg-slate-100 border border-slate-200"
                            onError={(e) => {
                              const image = e.currentTarget;
                              if (!image.src.endsWith('/catalog-item-placeholder.svg')) image.src = resolveDefaultImage({ kind: 'product' });
                            }}
                          />
                        </td>
                        <td className="py-3 px-4 font-extrabold text-slate-900 max-w-[200px]">
                          <div>{p.name}</div>
                          {p.description && (
                            <p className="text-[11px] text-slate-400 truncate max-w-xs font-normal">
                              {p.description}
                            </p>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${
                              p.type === 'service'
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {p.type === 'service' ? 'خدمة' : 'منتج'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 font-semibold">{p.category}</td>
                        <td className="py-3 px-4 font-black text-slate-900">
                          <span>{p.price.toLocaleString('ar-EG')} ج.م</span>
                          {p.comparePrice && (
                            <span className="block text-[10px] text-slate-400 line-through">
                              {p.comparePrice.toLocaleString('ar-EG')} ج.م
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500">{p.unit || '—'}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => openEditModal(p)}
                              className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-emerald-700 rounded-lg transition-colors cursor-pointer"
                              title="تعديل المنتج"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (window.confirm(`هل أنت متأكد من حذف (${p.name})؟`)) {
                                  void deleteProduct(p.id).catch((error) => window.alert(error instanceof Error ? error.message : 'تعذر حذف المنتج.'));
                                }
                              }}
                              className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                              title="حذف المنتج"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Branding (Cover & Logo) */}
      {activeTab === 'branding' && (
        <form onSubmit={handleSaveBusiness} className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-900 mb-1">
                تخصيص غلاف وشعار النشاط التجاري على MantiqatiX
              </h3>
              <p className="text-xs text-slate-500">
                يظهر الغلاف والشعار في أعلى صفحة الكتالوج التعريفية لمنح الزوار انطباعاً رسمياً واحترافياً.
              </p>
            </div>


            {/* Facebook Page profile import — read-only until the owner applies the preview. */}
            <section className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4 sm:p-5 space-y-4" aria-labelledby="facebook-import-heading">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h4 id="facebook-import-heading" className="font-black text-sm text-slate-900">استيراد بيانات النشاط من فيسبوك</h4>
                  <p className="text-xs text-slate-600 leading-relaxed mt-1">
                    اقرأ صورة الصفحة الشخصية والغلاف والنبذة والعنوان ومواعيد العمل من صفحة تديرها، ثم راجع البيانات قبل نقلها إلى نموذج النشاط.
                  </p>
                </div>
                <div className="shrink-0 rounded-xl bg-white p-2 border border-blue-100 text-blue-700">
                  <ExternalLink className="w-5 h-5" />
                </div>
              </div>

              {!facebookAppId && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900" role="note">
                  الربط غير مهيأ بعد: يجب إعداد تطبيق Meta وإضافة App ID إلى إعدادات الواجهة وحفظ App Secret في أسرار Supabase من جهة الخادم. لن تُطلب كلمة مرور فيسبوك داخل المنصة.
                </div>
              )}

              {facebookError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800" role="alert">
                  {facebookError}
                </div>
              )}
              {facebookStatus && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800" role="status">
                  {facebookStatus}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  disabled={!facebookAppId || facebookBusy || !currentBusiness?.id}
                  onClick={() => void handleConnectFacebook()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-xs font-black text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ExternalLink className="w-4 h-4" />
                  {facebookBusy ? 'جارٍ الاتصال...' : 'الاتصال بحساب فيسبوك وقراءة الصفحات'}
                </button>
                {facebookPages.length > 0 && (
                  <>
                    <select
                      value={facebookSelectedPageId}
                      onChange={(e) => {
                        setFacebookSelectedPageId(e.target.value);
                        setFacebookPreview(null);
                        setFacebookError('');
                      }}
                      disabled={facebookBusy}
                      aria-label="اختر صفحة فيسبوك"
                      className="min-w-0 flex-1 rounded-xl border border-blue-200 bg-white px-3 py-2 text-xs text-slate-900"
                    >
                      {facebookPages.map((page) => (
                        <option key={page.id} value={page.id}>
                          {page.name}{page.category ? ` — ${page.category}` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={facebookBusy || !facebookSelectedPageId}
                      onClick={() => void handleReadFacebookPage()}
                      className="rounded-xl border border-blue-300 bg-white px-4 py-2.5 text-xs font-black text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {facebookBusy ? 'جارٍ القراءة...' : 'قراءة بيانات الصفحة'}
                    </button>
                  </>
                )}
              </div>

              {facebookPreview && (
                <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-black text-sm text-slate-900">معاينة بيانات فيسبوك</div>
                    {facebookPreview.pageUrl && (
                      <a href={facebookPreview.pageUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-700 hover:underline">
                        فتح الصفحة <ExternalLink className="inline w-3 h-3" />
                      </a>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-14 h-14 shrink-0 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                        {facebookPreview.logoUrl ? <img src={facebookPreview.logoUrl} alt="صورة الصفحة الشخصية" className="w-full h-full object-cover" /> : <div className="h-full flex items-center justify-center text-[10px] text-slate-500">لا توجد صورة</div>}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] text-slate-500">صورة الصفحة الشخصية / الشعار</div>
                        <div className="text-xs font-bold text-slate-900 truncate">{facebookPreview.name}</div>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] text-slate-500 mb-1">صورة الغلاف</div>
                      <div className="aspect-[16/9] sm:aspect-[851/315] max-h-24 overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                        {facebookPreview.coverUrl ? <img src={facebookPreview.coverUrl} alt="غلاف صفحة فيسبوك" className="w-full h-full object-cover" /> : <div className="h-full flex items-center justify-center text-[10px] text-slate-500">لا يوجد غلاف متاح</div>}
                      </div>
                    </div>
                  </div>
                  {facebookPreview.bio && <p className="text-xs text-slate-700"><strong>نبذة الصفحة:</strong> {facebookPreview.bio}</p>}
                  {facebookPreview.address && <p className="text-xs text-slate-700"><strong>العنوان:</strong> {facebookPreview.address}</p>}
                  {facebookPreview.workingHours && <p className="text-xs text-slate-700"><strong>مواعيد العمل:</strong> {facebookPreview.workingHours}</p>}
                  <p className="text-[11px] leading-relaxed text-slate-500">لن تتغير بيانات النشاط المحفوظة حتى تستخدم البيانات المعروضة ثم تضغط زر حفظ التغييرات في نهاية النموذج.</p>
                  <button
                    type="button"
                    onClick={handleApplyFacebookProfile}
                    className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2.5"
                  >
                    استخدام البيانات في نموذج النشاط
                  </button>
                </div>
              )}
            </section>

            {/* Live Preview */}
            <div className="rounded-2xl border border-slate-200 overflow-hidden bg-slate-50">
              <div className="relative aspect-[16/9] sm:aspect-[851/315] bg-slate-700">
                <img
                  src={bizCoverUrl}
                  alt="معاينة الغلاف"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute top-3 right-3 bg-black/60 text-white text-[11px] font-bold px-3 py-1 rounded-full">
                  معاينة مباشرة للغلاف
                </div>
              </div>
              <div className="p-4 relative -mt-10 flex items-center gap-4">
                <img
                  src={bizLogoUrl}
                  alt="شعار النشاط"
                  className="w-20 h-20 rounded-2xl ring-4 ring-white object-cover bg-white shadow-md"
                />
                <div className="pt-8">
                  <h4 className="font-extrabold text-base text-slate-900">{bizName}</h4>
                  <p className="text-xs text-slate-500">{currentBusiness.category || 'التصنيف غير مسجل'}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-black text-slate-800 mb-1.5">
                  رابط صورة الغلاف (Cover Banner URL)
                </label>
                <input
                  type="url"
                  required
                  value={bizCoverUrl}
                  onChange={(e) => setBizCoverUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 mb-1.5">
                  رابط صورة الشعار (Logo URL)
                </label>
                <input
                  type="url"
                  required
                  value={bizLogoUrl}
                  onChange={(e) => setBizLogoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>
            </div>

            <div className="pt-4 space-y-2">
              {profileSaveError && (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">
                  {profileSaveError}
                </div>
              )}
              {saveSuccess && (
                <span role="status" className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  تأكد حفظ هوية النشاط في قاعدة الإنتاج.
                </span>
              )}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs px-6 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{profileSaving ? 'جارٍ حفظ الهوية...' : 'حفظ هوية النشاط'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Tab 3: Profile & Egyptian Administrative Location */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveBusiness} className="space-y-6">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
            <div>
              <h3 className="text-lg font-black text-slate-900 mb-1">
                بيانات النشاط التجاري وتحديد الموقع في مصر
              </h3>
              <p className="text-xs text-slate-500">
                تحديد مكان النشاط بدقة (قرية أو مركز أو محافظة) ورقم الواتساب الخاص باستقبال طلبات الكتالوج.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-black text-slate-800 mb-1.5">
                  اسم النشاط التجاري
                </label>
                <input
                  type="text"
                  required
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 mb-1.5">
                  رقم واتساب صاحب النشاط (لاستقبال الطلبات) <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-emerald-600 absolute right-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    required
                    dir="ltr"
                    value={bizOwnerWhatsApp}
                    onChange={(e) => setBizOwnerWhatsApp(e.target.value)}
                    placeholder="+201012345678"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-2.5 text-xs text-slate-900 text-right font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Taxonomy is managed centrally until a dedicated production write contract exists. */}
              <div>
                <label className="block text-xs font-black text-slate-800 mb-1.5">التصنيف التجاري الحالي</label>
                <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-bold" aria-readonly="true">
                  {currentBusiness.category || 'التصنيف غير مسجل'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 mb-1.5">المجموعة الوظيفية الحالية</label>
                <div className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-800 font-bold" aria-readonly="true">
                  {currentGroupInfo?.name || 'المجموعة الوظيفية غير محددة'}
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  تعديل التصنيف أو المجموعة الوظيفية يحتاج اعتماد إدارة المنصة؛ هذه الشاشة تعرض القيم المسجلة فقط.
                </p>
              </div>

              {/* Egyptian Location Administrative Breakdown */}
              <div className="md:col-span-2 p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-3">
                <span className="block text-xs font-black text-slate-800 flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <span>تحديد مكان النشاط وعنوانه (قرية أو مركز أو محافظة في مصر):</span>
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">المحافظة</label>
                    <input
                      type="text"
                      required
                      value={bizGov}
                      onChange={(e) => setBizGov(e.target.value)}
                      placeholder="مثال: الدقهلية أو القاهرة أو الجيزة"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">المركز / القسم</label>
                    <input
                      type="text"
                      required
                      value={bizMarkaz}
                      onChange={(e) => setBizMarkaz(e.target.value)}
                      placeholder="مثال: المنصورة أو طنطا أو المعادي"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">القرية / الحي / البلدة</label>
                    <input
                      type="text"
                      required
                      value={bizVillage}
                      onChange={(e) => setBizVillage(e.target.value)}
                      placeholder="مثال: حي الجامعة أو ميت علي أو دجلة"
                      className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">العنوان التفصيلي / الشارع والمعلم الرئيسي</label>
                  <input
                    type="text"
                    value={bizAddress}
                    onChange={(e) => setBizAddress(e.target.value)}
                    placeholder="شارع المشاية السفلية، بجوار حديقة شجرة الدر"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>

                <div className="mt-3 pt-3 border-t border-slate-200/60 text-xs text-slate-600">
                  <span className="block text-[11px] font-bold text-slate-700 mb-1">موقع النشاط على خرائط Google</span>
                  {currentBusiness.googleMapsUrl ? (
                    <a href={currentBusiness.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="font-bold text-emerald-700 underline" dir="ltr">
                      فتح رابط الخرائط المحفوظ
                    </a>
                  ) : (
                    <p>لا يوجد رابط مخصص محفوظ. تستخدم صفحة الكتالوج الاسم والعنوان المسجلين لفتح بحث على خرائط Google؛ لا نعرض حقل تعديل غير مرتبط بالحفظ في هذا الإصدار.</p>
                  )}
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-black text-slate-800 mb-1.5">
                  ساعات وأيام العمل
                </label>
                <input
                  type="text"
                  value={bizWorkingHours}
                  onChange={(e) => setBizWorkingHours(e.target.value)}
                  placeholder="يومياً من 9 صباحاً حتى 11 مساءً"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900">روابط التواصل الاجتماعي</h3>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">أدخل روابط صفحات النشاط فقط. ستظهر كأزرار مباشرة في صفحة الكتالوج، وكل حقل اختياري.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-slate-700">رابط فيسبوك</span>
                    <input type="url" value={bizFacebookUrl} onChange={(event) => setBizFacebookUrl(event.target.value)} placeholder="https://facebook.com/yourpage" className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs" dir="ltr" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-slate-700">رابط إنستجرام</span>
                    <input type="url" value={bizInstagramUrl} onChange={(event) => setBizInstagramUrl(event.target.value)} placeholder="https://instagram.com/yourpage" className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs" dir="ltr" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-slate-700">رابط تيك توك</span>
                    <input type="url" value={bizTikTokUrl} onChange={(event) => setBizTikTokUrl(event.target.value)} placeholder="https://tiktok.com/@yourpage" className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs" dir="ltr" />
                  </label>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-black text-slate-800 mb-1.5">
                  نبذة تعريفية عن النشاط
                </label>
                <textarea
                  rows={3}
                  value={bizBio}
                  onChange={(e) => setBizBio(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 focus:outline-hidden resize-none"
                />
              </div>
            </div>

            <div className="pt-4 space-y-2">
              {profileSaveError && (
                <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800">
                  {profileSaveError}
                </div>
              )}
              {saveSuccess && (
                <span role="status" className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" />
                  تأكد حفظ بيانات النشاط في قاعدة الإنتاج.
                </span>
              )}
              <div className="flex items-center justify-end gap-3">
                <button
                  type="submit"
                  disabled={profileSaving}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black text-xs px-6 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{profileSaving ? 'جارٍ حفظ التعديلات...' : 'حفظ التعديلات'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Tab 4: Functional Engine & Future Roadmap */}
      {activeTab === 'functional_engine' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  MantiqatiX Modular Engine
                </span>
                <span className="text-xs text-slate-400">نظام التصنيف الوظيفي القابل للتطوير المستقبلي</span>
              </div>
              <h3 className="text-xl font-black text-slate-900">
                محرك التطوير الوظيفي لنشاط: {currentBusiness.name}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                تم تصنيف نشاطك ضمن: <strong>{currentGroupInfo?.name}</strong> لتمكين الميزات التخصصية تلقائياً.
              </p>
            </div>

            {currentGroupInfo && (
              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                <div className="p-3 bg-white rounded-xl shadow-xs">
                  {ICONS_MAP[currentGroupInfo.id]}
                </div>
                <div>
                  <h4 className="font-black text-xs text-slate-900">{currentGroupInfo.name}</h4>
                  <p className="text-[11px] text-slate-500">{currentGroupInfo.englishName}</p>
                </div>
              </div>
            )}
          </div>

          {/* Group Description and tailored capabilities */}
          <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200 space-y-3">
            <h4 className="text-xs font-black text-slate-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>نبذة عن التصنيف الوظيفي وكيف يخدم نشاطك:</span>
            </h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              {currentGroupInfo?.description}
            </p>
          </div>

          {/* Roadmap of Specialized Modules for this Functional Group */}
          <div>
            <h4 className="text-xs font-black text-slate-900 mb-3">
              الميزات التخصصية المتاحة ومسار التطوير لهذا القطاع:
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {currentGroupInfo?.futureFeatures.map((feat, idx) => (
                <div
                  key={idx}
                  className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between space-y-3"
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-bold text-slate-400">خاصية #{idx + 1}</span>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          feat.status === 'active'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : feat.status === 'in_development'
                            ? 'bg-amber-100 text-amber-800 border border-amber-300'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {feat.status === 'active'
                          ? 'مفعّلة بالمنصة'
                          : feat.status === 'in_development'
                          ? 'قيد التطوير'
                          : 'مجدولة قريباً'}
                      </span>
                    </div>
                    <h5 className="font-extrabold text-xs text-slate-900 mb-1">{feat.title}</h5>
                    <p className="text-[11px] text-slate-500 leading-relaxed">{feat.description}</p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-emerald-700 font-bold">
                    <span>MantiqatiX Modular</span>
                    <ChevronRight className="w-3 h-3 rotate-180" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tab: QR Code Permanent */}
      {activeTab === 'qr' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                  رمز الاستجابة السريعة (QR Code)
                </span>
                <span className="text-xs text-slate-400">دائم وثابت لا يتغير بتغير نطاق الموقع</span>
              </div>
              <h3 className="text-xl font-black text-slate-900">
                QR كود نشاط: {currentBusiness.name}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                استخدم هذا الرمز على مطبوعاتك، لافتات المحل، أو وسائل التواصل الاجتماعي لتمكين العملاء من الوصول الفوري لكتالوجك.
              </p>
            </div>

            <button
              onClick={() => setIsQrModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-3 rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer transition-all"
            >
              <QrCode className="w-4 h-4" />
              <span>عرض و طباعة الكود بالكامل</span>
            </button>
          </div>

          <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-2xl border border-slate-200 text-center space-y-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
              <img
                src={permanentQrCodeImageUrl}
                alt={`QR Code for ${currentBusiness.name}`}
                className="w-56 h-56 object-contain mx-auto rounded-xl"
              />
            </div>
            <a
              href={permanentStoreUrl}
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
              className="block max-w-full break-all rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 hover:text-emerald-700"
            >
              {permanentStoreUrl}
            </a>
            <p className="text-xs text-slate-600 max-w-md">
              هذا الرابط الثابت والرمز يفتحان صفحة النشاط نفسها، ويستخدمان معرّف النشاط الدائم لا الاسم القابل للتغيير.
            </p>
          </div>
        </div>
      )}

      {/* Product Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 relative">
            <h3 className="text-lg font-black text-slate-900 mb-1">
              {editingProduct ? 'تعديل صنف في الكتالوج' : 'إضافة منتج أو خدمة جديدة'}
            </h3>
            <p className="text-xs text-slate-500 mb-5">
              السعر بالجنيه المصري (ج.م) • يتم إدراجه في الكتالوج وإتاحته لطلبات الواتساب فوراً.
            </p>

            {formError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleProductSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-800 mb-1">
                  الاسم <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="مثال: فلات وايت أرتيزان أو شال حرير طبيعي"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-800 mb-1">النوع</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as 'product' | 'service')}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-hidden"
                  >
                    <option value="product">منتج مادي</option>
                    <option value="service">خدمة / حجز</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 mb-1">
                    التصنيف الداخلي
                  </label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="مثال: قهوة ساخنة أو فساتين"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black text-slate-800 mb-1">
                    السعر الحالي بالجنيه المصري (ج.م) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-bold focus:outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-800 mb-1">
                    السعر قبل الخصم (اختياري ج.م)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={formComparePrice}
                    onChange={(e) => setFormComparePrice(e.target.value)}
                    placeholder="مثال: 65"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 mb-1">
                  الوحدة (مثال: قطعة، كوب، وجبة، ساعة، شيكارة، كجم)
                </label>
                <input
                  type="text"
                  value={formUnit}
                  onChange={(e) => setFormUnit(e.target.value)}
                  placeholder="مثال: كوب أو قطعة أو كجم"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 mb-1">
                  رابط صورة الصنف (URL)
                </label>
                <input
                  type="url"
                  value={formImageUrl}
                  onChange={(e) => { setFormImageSource('owner'); setFormImageUrl(e.target.value); }}
                  placeholder="الصورة الافتراضية ستتغير تلقائياً حسب الاسم والوصف"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-hidden"
                />
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <img src={formImageUrl || resolveDefaultImage({ name: formName, description: formDescription, category: formCategory, kind: formType === 'service' ? 'service' : 'product' })} alt="معاينة الصورة" className="h-16 w-20 rounded-lg border border-slate-200 bg-white object-cover" />
                  <button type="button" onClick={() => setFormImageSource('auto')} className="text-xs font-bold text-emerald-700 underline">استخدام الصورة التلقائية المناسبة للاسم والوصف</button>
                  <span className="text-[11px] text-slate-500">{formImageSource === 'auto' ? 'صورة تلقائية حسب المجال' : formImageSource === 'ai' ? 'صورة مولدة بالذكاء الاصطناعي' : 'صورة مخصصة'}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-slate-800 mb-1">
                  الوصف والمواصفات
                </label>
                <textarea
                  rows={2}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="أدخل وصفاً تفصيلياً يوضح مكونات أو ميزات الصنف للعميل..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-hidden resize-none"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-5 py-2.5 rounded-xl shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  {editingProduct ? 'حفظ التعديلات' : 'إضافة للكتالوج'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <QRCodeModal
        business={currentBusiness}
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
      />
    </div>
  );
};
