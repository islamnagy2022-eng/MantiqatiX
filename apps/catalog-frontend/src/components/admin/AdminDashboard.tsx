import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ActivityCategory, Business, FunctionalGroupId, Subscriber } from '../../types';
import {
  ShieldCheck,
  UserPlus,
  Mail,
  Phone,
  Building2,
  ExternalLink,
  CheckCircle2,
  Clock,
  Settings,
  Plus,
  Trash2,
  Copy,
  Check,
  Sparkles,
  Layers,
  Store,
  Users,
  KeyRound,
  Share2,
  Download,
  Upload,
  Database,
  RefreshCw,
  FileJson,
  AlertTriangle,
  BadgeAlert,
  Coins,
  Calendar,
  MapPin,
  CheckCheck,
  Ban,
  BellRing,
  UtensilsCrossed,
  ShoppingBag,
  CalendarCheck2,
  HeartPulse,
  Wrench,
  Filter,
  ArrowRight,
  FolderPlus,
  UserCog,
} from 'lucide-react';
import {
  formatEgyptianLocation,
} from '../../utils/rules';

import { SuperAdminControlCenter } from './SuperAdminControlCenter';
import { resolveDefaultImage } from '../../utils/defaultImages';

const BUSINESS_PLACEHOLDER = `${import.meta.env.BASE_URL || '/'}business-placeholder.svg`;

const getDefaultBusinessPaymentDueDate = () => {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 7);
  return `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;
};

const ICONS_MAP: Record<string, React.ReactNode> = {
  medical_health: <HeartPulse className="w-4 h-4 text-emerald-500" />,
  food_grocery: <UtensilsCrossed className="w-4 h-4 text-amber-500" />,
  fashion_beauty: <ShoppingBag className="w-4 h-4 text-pink-500" />,
  home_maintenance: <Wrench className="w-4 h-4 text-orange-500" />,
  construction_decor: <Building2 className="w-4 h-4 text-stone-500" />,
  auto_transport: <Store className="w-4 h-4 text-sky-500" />,
  real_estate: <Store className="w-4 h-4 text-teal-500" />,
  education_training: <CalendarCheck2 className="w-4 h-4 text-indigo-500" />,
  technology_communications: <Layers className="w-4 h-4 text-cyan-500" />,
  professional_services: <CalendarCheck2 className="w-4 h-4 text-violet-500" />,
  marketing_media: <Store className="w-4 h-4 text-fuchsia-500" />,
  trade_ecommerce: <ShoppingBag className="w-4 h-4 text-blue-500" />,
  agriculture_animals: <Store className="w-4 h-4 text-lime-600" />,
  sports_fitness: <HeartPulse className="w-4 h-4 text-red-500" />,
  tourism_events: <CalendarCheck2 className="w-4 h-4 text-purple-500" />,
  finance_insurance: <Layers className="w-4 h-4 text-emerald-600" />,
  industry_workshops: <Wrench className="w-4 h-4 text-slate-500" />,
  public_community: <CalendarCheck2 className="w-4 h-4 text-rose-500" />,
};

export const AdminDashboard: React.FC = () => {
  const {
    subscribers,
    authSession,
    businesses,
    products,
    adminSettings,
    categories,
    functionalGroups,
    addCategory,
    deleteCategory,
    addSubscriber,
    saveSubscriberMembership,
    updateSubscriber,
    deleteSubscriber,
    sendGmailInvite,
    getSubscriberCredentialsText,
    updateAdminSettings,
    setSelectedBusinessId,
    setCurrentView,
    addBusiness,
    updateBusiness,
    getStorePublicLink,
    downloadBackupFile,
    exportBackupJSON,
    importBackupJSON,
    confirmAdminPayment,
    toggleBusinessFreeze,
    updateBusinessLocation,
    deleteBusiness,
  } = useApp();

  type AdminTab = 'billing' | 'taxonomy' | 'businesses' | 'subscribers' | 'settings' | 'backup' | 'control_center';
  const ADMIN_TABS: AdminTab[] = ['billing', 'taxonomy', 'businesses', 'subscribers', 'settings', 'backup', 'control_center'];
  const readAdminTabFromUrl = (): AdminTab => {
    const requested = new URLSearchParams(window.location.search).get('tab') as AdminTab | null;
    return requested && ADMIN_TABS.includes(requested) ? requested : 'billing';
  };
  const [activeAdminTab, setActiveAdminTabState] = useState<AdminTab>(readAdminTabFromUrl);
  const setActiveAdminTab = (tab: AdminTab) => {
    setActiveAdminTabState(tab);
    const url = new URL(window.location.href);
    if (tab === 'billing') url.searchParams.delete('tab');
    else url.searchParams.set('tab', tab);
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  };

  React.useEffect(() => {
    const restoreAdminTab = () => setActiveAdminTabState(readAdminTabFromUrl());
    window.addEventListener('popstate', restoreAdminTab);
    return () => window.removeEventListener('popstate', restoreAdminTab);
  }, []);

  // Backup & Restore State
  const [backupFeedback, setBackupFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [backupPasteText, setBackupPasteText] = useState('');
  const [isCopiedBackupJson, setIsCopiedBackupJson] = useState(false);
  const [showBackupPreview, setShowBackupPreview] = useState(false);

  // Subscriber Modal
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [subName, setSubName] = useState('');
  const [subEmail, setSubEmail] = useState('');
  const [subPhone, setSubPhone] = useState('');
  const [subBizId, setSubBizId] = useState(businesses[0]?.id || '');
  const [subNotes, setSubNotes] = useState('');

  // Live Supabase account role / business assignment controls.
  const [isSubscriberAccessModalOpen, setIsSubscriberAccessModalOpen] = useState(false);
  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);
  const [subAccessTenantId, setSubAccessTenantId] = useState('MNTY-PLATFORM');
  const [subAccessBusinessId, setSubAccessBusinessId] = useState('');
  const [subAccessBranchId, setSubAccessBranchId] = useState('');
  const [subAccessRole, setSubAccessRole] = useState('CUSTOMER');
  const [subAccessStatus, setSubAccessStatus] = useState<'ACTIVE' | 'INACTIVE' | 'SUSPENDED'>('INACTIVE');
  const [subAccessCatalogEnabled, setSubAccessCatalogEnabled] = useState(false);
  const [subAccessCatalogWrite, setSubAccessCatalogWrite] = useState(false);
  const [subAccessAccountRestricted, setSubAccessAccountRestricted] = useState(false);
  const [subAccessSaving, setSubAccessSaving] = useState(false);
  const [subAccessFeedback, setSubAccessFeedback] = useState<string | null>(null);

  const openSubscriberAccessEditor = (subscriber: Subscriber) => {
    const assignedBusiness = businesses.find((business) => business.id === subscriber.businessId);
    setEditingSubscriber(subscriber);
    setSubAccessTenantId(subscriber.tenantId || assignedBusiness?.tenantId || businesses[0]?.tenantId || 'MNTY-PLATFORM');
    setSubAccessBusinessId(subscriber.businessId || '');
    setSubAccessBranchId(subscriber.branchId || '');
    setSubAccessRole(String(subscriber.role || 'CUSTOMER').toUpperCase() === 'SUPER_ADMIN' ? 'CUSTOMER' : String(subscriber.role || 'CUSTOMER').toUpperCase());
    const status = String(subscriber.membershipStatus || (subscriber.status === 'active' ? 'ACTIVE' : subscriber.status === 'suspended' ? 'SUSPENDED' : 'INACTIVE')).toUpperCase();
    setSubAccessStatus(status === 'ACTIVE' || status === 'SUSPENDED' ? status : 'INACTIVE');
    setSubAccessCatalogEnabled(!subscriber.isAccountOnly && subscriber.permissions?.catalog !== false && subscriber.permissions?.account_restricted !== true);
    setSubAccessCatalogWrite(!subscriber.isAccountOnly && subscriber.permissions?.catalog_write !== false && subscriber.permissions?.catalog_read_only !== true);
    setSubAccessAccountRestricted(subscriber.permissions?.account_restricted === true);
    setSubAccessFeedback(null);
    setIsSubscriberAccessModalOpen(true);
  };

  // Credentials copied popup/feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [createdCredentialsCard, setCreatedCredentialsCard] = useState<{
    name: string;
    email: string;
    bizName: string;
    text: string;
  } | null>(null);

  // Business Modal
  const [isBizModalOpen, setIsBizModalOpen] = useState(false);
  const [newBizName, setNewBizName] = useState('');
  const [newBizCategory, setNewBizCategory] = useState(categories.find((c) => c.functionalGroupId === 'medical_health' && c.classificationType !== 'profession')?.name || categories[0]?.name || 'عيادات طبية');
  const [newBizSpecialty, setNewBizSpecialty] = useState('');
  const [newBizFunctionalGroup, setNewBizFunctionalGroup] = useState<FunctionalGroupId>('medical_health');
  const [newBizOwnerWhatsApp, setNewBizOwnerWhatsApp] = useState('');
  const [newBizBio, setNewBizBio] = useState('');
  // Egyptian Location Fields
  const [newBizGov, setNewBizGov] = useState('');
  const [newBizMarkaz, setNewBizMarkaz] = useState('');
  const [newBizVillage, setNewBizVillage] = useState('');
  const [newBizAddress, setNewBizAddress] = useState('');
  const [newBizActivationMode, setNewBizActivationMode] = useState<'activate_now' | 'wait_for_confirmation'>('wait_for_confirmation');
  const [newBizPaymentDueDate, setNewBizPaymentDueDate] = useState(getDefaultBusinessPaymentDueDate);
  const [newBizGracePeriodDays, setNewBizGracePeriodDays] = useState(7);

  // New Category Creation state
  const [isNewCatModalOpen, setIsNewCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatGroup, setNewCatGroup] = useState<FunctionalGroupId>('medical_health');
  const [newCatType, setNewCatType] = useState<'activity' | 'profession'>('activity');
  const [newCatSpecialties, setNewCatSpecialties] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  // Billing tab filters & feedback
  const [billingGovFilter, setBillingGovFilter] = useState('all');
  const [billingStatusFilter, setBillingStatusFilter] = useState('all');
  const [billingActionMsg, setBillingActionMsg] = useState<string | null>(null);
  const [billingActionBusyId, setBillingActionBusyId] = useState<string | null>(null);
  const [businessDeleteBusyId, setBusinessDeleteBusyId] = useState<string | null>(null);

  // Taxonomy tab filter
  const [taxonomyGroupFilter, setTaxonomyGroupFilter] = useState<string>('all');

  // Admin WhatsApp & Password Settings
  const [adminPhone, setAdminPhone] = useState(adminSettings.adminWhatsApp);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsFeedback, setSettingsFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Payment gateway configuration is intentionally unavailable in the catalog pilot.
  const [selectedPaymobBiz, setSelectedPaymobBiz] = useState<Business | null>(null);
  const openPaymobSettings = (biz: Business) => setSelectedPaymobBiz(biz);

  // Quick stats
  const totalSubscribers = subscribers.length;
  const activeSubscribers = subscribers.filter((s) => s.status === 'active').length;
  const totalBusinesses = businesses.length;
  const totalCatalogItems = products.length;

  const handleAddSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subName.trim() || !subEmail.trim()) return;

    const assignedBiz = businesses.find((b) => b.id === subBizId);
    const email = subEmail.trim().toLowerCase();
    try {
      const created = await addSubscriber({
        fullName: subName,
        email,
        phone: subPhone,
        businessId: subBizId,
        username: email,
        authMethod: 'gmail_invite',
        notes: subNotes,
      });

      const credText = getSubscriberCredentialsText(created.id);
      setCreatedCredentialsCard({
        name: subName,
        email,
        bizName: assignedBiz?.name || 'نشاط جديد',
        text: credText,
      });

      setSubName('');
      setSubEmail('');
      setSubPhone('');
      setSubNotes('');
      setIsSubModalOpen(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'تعذر حفظ اشتراك المشترك في Supabase.');
    }
  };

  const handleAddBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBizName.trim()) {
      window.alert('أدخل اسم النشاط التجاري.');
      return;
    }
    const phoneDigits = newBizOwnerWhatsApp.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 15) {
      window.alert('أدخل رقم واتساب حقيقيًا لصاحب النشاط من 10 إلى 15 رقمًا.');
      return;
    }
    if (!newBizGov.trim() || !newBizMarkaz.trim() || !newBizVillage.trim()) {
      window.alert('أدخل المحافظة والمركز/القسم والقرية/الحي الفعلي للنشاط.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(newBizPaymentDueDate) || Number.isNaN(new Date(`${newBizPaymentDueDate}T00:00:00`).getTime())) {
      window.alert('حدد تاريخًا صحيحًا لاستحقاق السداد.');
      return;
    }
    const gracePeriodDays = Number(newBizGracePeriodDays);
    if (!Number.isInteger(gracePeriodDays) || gracePeriodDays < 0 || gracePeriodDays > 90) {
      window.alert('مدة المهلة يجب أن تكون عددًا صحيحًا من 0 إلى 90 يومًا.');
      return;
    }

    const matchedCat = categories.find((c) => c.name === newBizCategory && c.functionalGroupId === newBizFunctionalGroup);
    const resolvedGroup = matchedCat?.functionalGroupId || newBizFunctionalGroup || 'medical_health';
    const selectedBusinessCategory = newBizSpecialty.trim()
      ? `${matchedCat?.name || newBizCategory} — ${newBizSpecialty.trim()}`
      : (matchedCat?.name || newBizCategory);

    const slug = newBizName
      .trim()
      .toLowerCase()
      .replace(/[\s\W-]+/g, '-');

    try {
    const createdBizId = await addBusiness({
      name: newBizName,
      slug: `${slug}-${Date.now().toString().slice(-4)}`,
      category: selectedBusinessCategory,
      categoryId: matchedCat?.id,
      functionalGroupId: resolvedGroup,
      categoryClassificationType: matchedCat?.classificationType || 'activity',
      activitySpecialty: newBizSpecialty.trim() || undefined,
      logoUrl: '',
      coverUrl: '',
      bio: newBizBio.trim(),
      ownerWhatsApp: newBizOwnerWhatsApp.trim(),
      address: newBizAddress,
      governorate: newBizGov,
      markaz: newBizMarkaz,
      village: newBizVillage,
      workingHours: '',
      isVerified: false,
      maxProductsLimit: 150,
      registrationDate: new Date().toISOString().split('T')[0],
      paymentDueDay: 0,
      paymentDueDate: newBizPaymentDueDate,
      paymentGracePeriodDays: gracePeriodDays,
      commissionPerOrder: 0,
      totalOrdersCount: 0,
      paymentStatus: 'pending',
      overdueDaysCount: 0,
      isFrozen: false,
      paymentConfirmedByAdmin: false,
      publicEnabled: newBizActivationMode === 'activate_now',
    });

    setNewBizName('');
    setNewBizCategory(categories.find((c) => c.functionalGroupId === 'medical_health' && c.classificationType !== 'profession')?.name || 'عيادات طبية');
    setNewBizFunctionalGroup('medical_health');
    setNewBizSpecialty('');
    setNewBizBio('');
    setNewBizOwnerWhatsApp('');
    setNewBizGov('');
    setNewBizMarkaz('');
    setNewBizVillage('');
    setNewBizAddress('');
    setNewBizActivationMode('wait_for_confirmation');
    setNewBizPaymentDueDate(getDefaultBusinessPaymentDueDate());
    setNewBizGracePeriodDays(7);
    setIsBizModalOpen(false);
    setSelectedBusinessId(createdBizId);
    } catch (error) { window.alert(error instanceof Error ? error.message : 'تعذر إنشاء النشاط في قاعدة الإنتاج.'); }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    const specialties = newCatSpecialties.split(/[،,]/).map((item) => item.trim()).filter(Boolean);
    try {
      await addCategory({
        name: newCatName.trim(),
        functionalGroupId: newCatGroup,
        classificationType: newCatType,
        specialties,
        description: newCatDesc.trim() || undefined,
      });
      setNewCatName('');
      setNewCatDesc('');
      setNewCatType('activity');
      setNewCatSpecialties('');
      setNewCatGroup('medical_health');
      setIsNewCatModalOpen(false);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : 'تعذر حفظ التصنيف في إعدادات المنصة.');
    }
  };

  const handleCopyCredentials = (subId: string) => {
    const text = getSubscriberCredentialsText(subId);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedId(subId);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const handleCopyStoreLink = (biz: any) => {
    const link = getStorePublicLink(biz);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link);
      setCopiedId(biz.id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  const handleDeleteBusiness = async (business: Business) => {
    if (!business.tenantId) {
      window.alert('لا يمكن حذف النشاط لأن معرّف المستأجر الإنتاجي غير متوفر.');
      return;
    }
    const confirmed = window.confirm(
      `سيتم حذف نشاط «${business.name}» نهائيًا مع إعداداته والكتالوج والتعيينات المرتبطة به. إذا كان له طلبات أو حركات مالية أو مخزون أو اتفاقيات محفوظة فسيمنع الخادم الحذف للحفاظ على السجلات. هل تريد المتابعة؟`
    );
    if (!confirmed || businessDeleteBusyId) return;
    setBusinessDeleteBusyId(business.id);
    try {
      await deleteBusiness(business.id);
      window.alert(`تم حذف نشاط «${business.name}» نهائيًا من قاعدة البيانات.`);
    } catch (error) {
      window.alert(error instanceof Error
        ? `تعذر حذف النشاط: ${error.message}`
        : 'تعذر حذف النشاط. لم يتم إزالة النشاط من القائمة المحلية.');
    } finally {
      setBusinessDeleteBusyId(null);
    }
  };

    return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Admin Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="bg-amber-400 text-slate-950 text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              لوحة الإدارة والتحكم الشاملة - MantiqatiX
            </span>
            <span className="text-slate-400 text-xs">
              العملة: الجنيه المصري (ج.م) • عمولة سرية 0.01 ج.م • تصنيف وظيفي للأغذية والتجزئة والخدمات
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            إدارة المشتركين، العمولات، والتصنيف الوظيفي
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
            إدارة حالات السداد والتجميد اليدوي والعمولات. التنبيهات اليومية والتجميد التلقائي غير معتمدين كوظيفة إنتاجية في هذا الإصدار.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={downloadBackupFile}
            className="bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-amber-400/20 cursor-pointer"
            title="تحميل نسخة احتياطية فورية لجميع البيانات"
          >
            <Download className="w-4 h-4" />
            <span>نسخ احتياطي فوري</span>
          </button>

          <button
            onClick={() => {
              setIsSubModalOpen(true);
            }}
            className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>تعيين مشترك</span>
          </button>

          <button
            onClick={() => setIsBizModalOpen(true)}
            className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 cursor-pointer"
          >
            <Building2 className="w-4 h-4 text-emerald-400" />
            <span>إضافة نشاط تجاري</span>
          </button>
        </div>
      </div>

      {/* Pop-up Card after Creating a Subscriber Directly */}
      {createdCredentialsCard && (
        <div className="bg-emerald-50 border-2 border-emerald-300 rounded-3xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-950 font-black text-base">
              <CheckCircle2 className="w-6 h-6 text-emerald-600" />
              <span>تم حفظ ربط المشترك بالنشاط في Supabase.</span>
            </div>
            <button
              onClick={() => setCreatedCredentialsCard(null)}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              إغلاق البطاقة
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-2xl border border-emerald-200">
            <div>
              <span className="text-[11px] text-slate-400 font-bold block">اسم المشترك والنشاط:</span>
              <span className="text-sm font-black text-slate-900">
                {createdCredentialsCard.name} ({createdCredentialsCard.bizName})
              </span>
            </div>

            <div>
              <span className="text-[11px] text-slate-400 font-bold block">حساب Google المرتبط:</span>
              <span className="text-sm font-mono font-black text-emerald-700">
                {createdCredentialsCard.email}
              </span>
            </div>

          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <p className="text-xs text-emerald-800">
              أرسل للمشترك رسالة الدخول؛ عليه اختيار المتابعة باستخدام Google بنفس البريد المرتبط بالاشتراك.
            </p>
            <button
              onClick={() => {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(createdCredentialsCard.text);
                  alert('تم نسخ تعليمات الدخول باستخدام Google!');
                }
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2 rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>نسخ تعليمات الدخول للواتساب</span>
            </button>
          </div>
        </div>
      )}

      {/* Quick KPI Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <Layers className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{functionalGroups.length}</div>
            <div className="text-xs text-slate-500 font-medium">مجموعات وظيفية مخصصة</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalBusinesses}</div>
            <div className="text-xs text-slate-500 font-medium">أنشطة تجارية مسجلة</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">{totalSubscribers}</div>
            <div className="text-xs text-slate-500 font-medium">مشتركين نشطين</div>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <div className="text-2xl font-black text-slate-900">
              {businesses.filter((business) => business.publicEnabled && !business.isFrozen).length}
            </div>
            <div className="text-xs text-slate-500 font-medium">كتالوجات منشورة وغير مجمدة</div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
        {/* Tab 1: Billing & Secret Commissions */}
        <button
          onClick={() => setActiveAdminTab('billing')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
            activeAdminTab === 'billing'
              ? 'bg-emerald-700 text-white shadow-md'
              : 'text-slate-700 hover:text-emerald-800 bg-white border border-slate-200'
          }`}
        >
          <Coins className="w-4 h-4 text-amber-400" />
          <span>نظام الاشتراك الشهري والسداد والتجميد</span>
          {businesses.filter((b) => b.isFrozen || b.overdueDaysCount > 0).length > 0 && (
            <span className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse" />
          )}
        </button>

        {/* Tab 2: Taxonomy & Functional Groups */}
        <button
          onClick={() => setActiveAdminTab('taxonomy')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
            activeAdminTab === 'taxonomy'
              ? 'bg-indigo-700 text-white shadow-md'
              : 'text-slate-700 hover:text-indigo-800 bg-white border border-slate-200'
          }`}
        >
          <Layers className="w-4 h-4 text-indigo-400" />
          <span>التصنيف الوظيفي والأنشطة ({functionalGroups.length} قطاعات)</span>
        </button>

        {/* Tab 3: Businesses */}
        <button
          onClick={() => setActiveAdminTab('businesses')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
            activeAdminTab === 'businesses'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>الأنشطة التجارية ({businesses.length})</span>
        </button>

        {/* Tab 4: Subscribers */}
        <button
          onClick={() => setActiveAdminTab('subscribers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
            activeAdminTab === 'subscribers'
              ? 'bg-emerald-600 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          <KeyRound className="w-4 h-4 text-amber-500" />
          <span>المشتركون وحسابات Google ({subscribers.length})</span>
        </button>

        {/* Tab 5: Settings */}
        <button
          onClick={() => setActiveAdminTab('settings')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer whitespace-nowrap ${
            activeAdminTab === 'settings'
              ? 'bg-slate-900 text-white shadow-md'
              : 'text-slate-600 hover:text-slate-900 bg-white border border-slate-200'
          }`}
        >
          <Settings className="w-4 h-4" />
          <span>إعدادات الإدارة وواتساب الكتالوج</span>
        </button>

        {/* Tab 6: Backup */}
        
        
      </div>

      {activeAdminTab === 'control_center' && <SuperAdminControlCenter />}

      {/* =========================================================================
          TAB: BILLING & COMMISSION (Mandatory Request Feature)
         ========================================================================= */}
      {activeAdminTab === 'billing' && (
        <div className="space-y-6">
          {billingActionMsg && (
            <div className={`text-xs p-3.5 rounded-2xl flex items-center justify-between shadow-xs border ${billingActionMsg.startsWith('تعذر') ? 'bg-rose-50 border-rose-300 text-rose-950' : 'bg-emerald-50 border-emerald-300 text-emerald-950'}`}>
              <div className="flex items-center gap-2 font-bold">
                {billingActionMsg.startsWith('تعذر') ? <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
                <span>{billingActionMsg}</span>
              </div>
              <button
                onClick={() => setBillingActionMsg(null)}
                className="text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                إغلاق
              </button>
            </div>
          )}

          {/* Explanation Banner */}
          <div className="bg-gradient-to-r from-amber-500/10 via-emerald-500/10 to-teal-500/10 border border-amber-300/80 rounded-3xl p-5 shadow-xs space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-amber-500 text-slate-950 rounded-2xl flex-shrink-0 mt-0.5">
                <Coins className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="font-black text-sm text-slate-900">
                  نظام الاشتراك الشهري، السداد، وتجميد الأنشطة (خاص بالإدارة)
                </h3>
                <p className="text-xs text-slate-700 leading-relaxed">
                  • <strong>الاشتراك الشهري:</strong> رسوم الاشتراك الشهري الثابتة للمنصة (بدون أي عمولات على الطلبات أو العمليات).
                  <br />
                  • <strong>مهلة السداد:</strong> في حال عدم سداد الاشتراك الشهري في موعده، يتلقى المشترك إشعاراً يومياً لمدة 5 أيام، وبعد اليوم الخامس يتم <strong>مراجعة حالة النشاط المسجلة</strong> لحين سداد الاشتراك وتأكيده من الإدارة.
                </p>
              </div>
            </div>

            {/* Legal Disclaimer Box */}
            <div className="p-3.5 bg-white/90 rounded-2xl border border-amber-200 text-xs text-slate-800 leading-relaxed font-bold shadow-xs">
              ⚖️ <strong>إخلاء المسؤولية القانونية:</strong> منصة MantiqatiX هي منصة تسويقية وتوفير المنتج الذي يساعد على الانتشار والتواجد الرقمي؛ المنصة ليست وسيطاً مادياً بين أي طرفين وليس لها أي تعاملات أو معرفة سابقة بمقدم الخدمة، ولا تقوم بتقديم خدمات لوجيستية أو غيرها، ودون أدنى مسئولية عليها.
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-bold">تصفية حسب المحافظة:</span>
                <select
                  value={billingGovFilter}
                  onChange={(e) => setBillingGovFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800"
                >
                  <option value="all">كافة المحافظات المصرية</option>
                  {Array.from(new Set(businesses.map((b) => b.governorate).filter(Boolean))).map((gov) => (
                    <option key={gov} value={gov}>
                      محافظة {gov}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <span className="font-bold">حالة السداد:</span>
                <select
                  value={billingStatusFilter}
                  onChange={(e) => setBillingStatusFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1 text-xs font-semibold text-slate-800"
                >
                  <option value="all">جميع الحالات</option>
                  <option value="paid">مسدد ومعتمد (ساري)</option>
                  <option value="overdue">متأخر (ضمن مهلة الـ 5 أيام)</option>
                  <option value="frozen">مجمد لعدم السداد (&gt; 5 أيام)</option>
                </select>
              </div>
            </div>

            <div className="text-xs text-slate-500 font-medium">
              الأنشطة المعروضة: {businesses.length} نشاط
            </div>
          </div>

          {/* Businesses Billing Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <th className="py-3.5 px-4">النشاط والموقع (مصر)</th>
                    <th className="py-3.5 px-4">التصنيف الوظيفي</th>
                    <th className="py-3.5 px-4">تاريخ التسجيل</th>
                    <th className="py-3.5 px-4">موعد السداد (إن وجد)</th>
                    <th className="py-3.5 px-4">خطة الاشتراك</th>
                    <th className="py-3.5 px-4">حالة السداد</th>
                    <th className="py-3.5 px-4">حالة السداد / المهلة</th>
                    <th className="py-3.5 px-4">الدفع الإلكتروني</th>
                    <th className="py-3.5 px-4 text-center">إجراءات الإدارة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {businesses
                    .filter((b) => {
                      const matchGov = billingGovFilter === 'all' || b.governorate === billingGovFilter;
                      const matchStatus =
                        billingStatusFilter === 'all' ||
                        (billingStatusFilter === 'frozen' && (b.isFrozen || b.paymentStatus === 'frozen')) ||
                        (billingStatusFilter === 'overdue' && b.paymentStatus === 'overdue') ||
                        (billingStatusFilter === 'paid' && b.paymentStatus === 'paid' && b.paymentConfirmedByAdmin);
                      return matchGov && matchStatus;
                    })
                    .map((biz) => {
                      const isOfficialShowcase = Boolean(biz.isOfficialShowcase);
                      const isPaidConfirmed = biz.paymentStatus === 'paid' && biz.paymentConfirmedByAdmin;
                      const isFrozen = biz.isFrozen || biz.paymentStatus === 'frozen';
                      const isOverdue = biz.paymentStatus === 'overdue';
                      const group = functionalGroups.find((g) => g.id === biz.functionalGroupId);

                      return (
                        <tr
                          key={biz.id}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isFrozen ? 'bg-rose-50/40' : ''
                          }`}
                        >
                          {/* Business Name and Egyptian Location */}
                          <td className="py-3.5 px-4 font-bold text-slate-900 max-w-[220px]">
                            <div className="flex items-center gap-2">
                              <img
                                src={biz.logoUrl || BUSINESS_PLACEHOLDER}
                                alt={biz.name}
                                className="w-8 h-8 rounded-lg object-cover bg-slate-100 flex-shrink-0"
                                onError={(event) => {
                                  const image = event.currentTarget;
                                  if (!image.src.endsWith('/business-placeholder.svg')) image.src = BUSINESS_PLACEHOLDER;
                                }}
                              />
                              <div className="truncate">
                                <div className="truncate">{biz.name}</div>
                                <div className="text-[10px] text-slate-500 font-normal truncate flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                                  <span>
                                    {formatEgyptianLocation(biz.governorate, biz.markaz, biz.village)}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Functional Group */}
                          <td className="py-3.5 px-4">
                            {group ? (
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${group.badgeColor}`}>
                                {ICONS_MAP[group.id]}
                                <span>{group.shortName}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">غير محدد</span>
                            )}
                          </td>

                          {/* Registration Date */}
                          <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                            {biz.registrationDate || biz.createdAt || 'غير محدد'}
                          </td>

                          {/* Show only saved due-date data; do not invent a billing schedule. */}
                          <td className="py-3.5 px-4 text-slate-800 font-black">
                            <span>{biz.paymentDueDay > 0 ? `يوم ${biz.paymentDueDay} من الشهر` : 'غير محدد'}</span>
                            <span className="block text-[10px] text-slate-400 font-normal">
                              {biz.paymentDueDate || 'لم يُحدد موعد سداد'}
                              <span className="block text-[10px] text-slate-400 font-normal">مهلة السداد: {biz.paymentGracePeriodDays ?? 0} يوم</span>
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 font-bold px-2.5 py-1 rounded-md text-[11px] border border-slate-200">
                              {isOfficialShowcase ? 'عرض رسمي معفى' : 'غير محددة'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <span className={isOfficialShowcase || isPaidConfirmed ? 'font-black block text-emerald-700' : isFrozen ? 'font-black block text-rose-700' : isOverdue ? 'font-black block text-amber-700' : 'font-black block text-slate-700'}>
                              {isOfficialShowcase ? 'عرض رسمي معفى من رسوم الاشتراك' : isPaidConfirmed ? 'مدفوع ومؤكد' : isFrozen ? 'مجمّد' : isOverdue ? 'متأخر' : 'بانتظار السداد'}
                            </span>
                            {isPaidConfirmed && biz.lastPaymentDate && (
                              <span className="text-[10px] text-slate-400 block">آخر سداد: {biz.lastPaymentDate}</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            {isFrozen ? (
                              <span className="inline-flex items-center gap-1 bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-md text-[10px]">
                                <Ban className="w-3 h-3" /> تجميد مسجل
                              </span>
                            ) : isOverdue ? (
                              <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-md text-[10px]">
                                <BellRing className="w-3 h-3" /> تأخير مسجل: {biz.overdueDaysCount} يوم
                              </span>
                            ) : biz.overdueDaysCount > 0 ? (
                              <span className="text-[10px] text-slate-600">عدد أيام التأخير المسجلة: {biz.overdueDaysCount}</span>
                            ) : (
                              <span className="text-[10px] text-slate-500">لا توجد بيانات تأخير مسجلة</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <span className="inline-flex items-center gap-1 bg-slate-100 text-slate-600 font-medium px-2 py-1 rounded-md text-[10px]">
                              غير متاح في الإصدار الحالي
                            </span>
                          </td>

                          {/* Admin Action Buttons */}
                          <td className="py-3.5 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              {/* Paymob Settings Quick Button */}
                              <button
                                onClick={() => openPaymobSettings(biz)}
                                className="bg-slate-100 text-slate-600 font-bold text-[10px] px-2 py-1 rounded-lg border border-slate-200 cursor-pointer"
                                title="بوابة الدفع الإلكتروني غير متاحة في الإصدار الحالي"
                              >
                                <span>تفاصيل الدفع الإلكتروني</span>
                              </button>

                              {/* 1. Confirm Payment Button */}
                              <button
                                disabled={Boolean(billingActionBusyId)}
                                onClick={async () => {
                                  if (billingActionBusyId) return;
                                  setBillingActionBusyId(biz.id);
                                  try {
                                    await confirmAdminPayment(biz.id);
                                    setBillingActionMsg(`تم حفظ تأكيد السداد للنشاط (${biz.name}) بعد تأكيد الخادم.`);
                                  } catch (error) {
                                    setBillingActionMsg(`تعذر حفظ تأكيد السداد للنشاط (${biz.name}): ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
                                  } finally { setBillingActionBusyId(null); }
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-xs transition-colors cursor-pointer"
                                title="تأكيد سداد المستحقات وتجديد النشاط لشهر قادم"
                              >
                                <CheckCheck className="w-3 h-3" />
                                <span>تأكيد السداد</span>
                              </button>

                              {/* 3. Manual Freeze/Unfreeze toggle */}
                              <button
                                disabled={Boolean(billingActionBusyId)}
                                onClick={async () => {
                                  if (billingActionBusyId) return;
                                  setBillingActionBusyId(biz.id);
                                  try {
                                    await toggleBusinessFreeze(biz.id);
                                    setBillingActionMsg(`تم حفظ تغيير حالة تجميد النشاط (${biz.name}) لدى الخادم.`);
                                  } catch (error) {
                                    setBillingActionMsg(`تعذر حفظ حالة النشاط (${biz.name}): ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
                                  } finally { setBillingActionBusyId(null); }
                                }}
                                className={`text-[10px] font-bold px-2 py-1 rounded-lg transition-colors cursor-pointer ${
                                  biz.isFrozen
                                    ? 'bg-slate-800 text-white hover:bg-slate-700'
                                    : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                                }`}
                                title="تجميد أو إلغاء تجميد صفحة النشاط يدوياً"
                              >
                                {biz.isFrozen ? 'فك التجميد' : 'تجميد فوري'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: TAXONOMY & FUNCTIONAL GROUPS (User Request Feature)
         ========================================================================= */}
      {activeAdminTab === 'taxonomy' && (
        <div className="space-y-6">
          <div className="bg-indigo-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="bg-indigo-400 text-indigo-950 text-xs font-black px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5" />
                  منظومة التصنيف الوظيفي (Functional Groups & Taxonomy)
                </span>
                <span className="text-indigo-200 text-xs">مهيأة للتطوير والتوسعة لكل قطاع</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black">
                تقسيم الأنشطة إلى مجموعات وظيفية متخصصة
              </h2>
              <p className="text-indigo-200 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
                تقوم هذه المنظومة بفصل وتجميع الأنشطة (مطاعم، سوبرماركت، صيدليات، أزياء، ورش صيانة...) في قطاعات وظيفية ذكية، لتسهيل إضافة خصائص برمجية متخصصة لكل قطاع في المستقبل (مثل إضافات الوجبات للمطاعم، الروشتات للصيدليات، حجز المواعيد للخدمات).
              </p>
            </div>

            <button
              onClick={() => setIsNewCatModalOpen(true)}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer self-start md:self-auto"
            >
              <FolderPlus className="w-4 h-4" />
              <span>إضافة تصنيف جديد</span>
            </button>
          </div>

          {/* Functional Groups Grid with Capabilities */}
          <div>
            <h3 className="font-extrabold text-base text-slate-900 mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600" />
              <span>المجموعات الوظيفية المعتمدة في MantiqatiX ({functionalGroups.length} مجموعات):</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {functionalGroups.map((group) => {
                const groupBizList = businesses.filter((b) => b.functionalGroupId === group.id);
                const groupCats = categories.filter((c) => c.functionalGroupId === group.id);

                return (
                  <div
                    key={group.id}
                    className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-5 flex flex-col justify-between space-y-4 hover:shadow-md transition-shadow"
                  >
                    <div>
                      {/* Top Header of Card */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="p-2.5 bg-slate-100 rounded-2xl">
                            {ICONS_MAP[group.id]}
                          </div>
                          <div>
                            <h4 className="font-black text-sm text-slate-900">{group.name}</h4>
                            <span className="text-[11px] text-slate-400 font-medium">
                              {group.englishName}
                            </span>
                          </div>
                        </div>

                        <span className="bg-slate-900 text-white font-black text-xs px-2.5 py-1 rounded-xl">
                          {groupBizList.length} أنشطة
                        </span>
                      </div>

                      {/* Description */}
                      <p className="text-xs text-slate-600 leading-relaxed mb-4">
                        {group.description}
                      </p>

                      {/* Associated Categories Pills */}
                      <div className="space-y-1.5 mb-4">
                        <span className="text-[11px] font-bold text-slate-400 block">
                          التصنيفات المندرجة تحت هذا القطاع ({groupCats.length}):
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {groupCats.map((c) => (
                            <span
                              key={c.id}
                              className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-lg border border-slate-200 font-semibold"
                            >
                              {c.name}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Specialized Roadmap Modules */}
                      <div className="pt-3 border-t border-slate-100 space-y-2">
                        <span className="text-[11px] font-black text-slate-800 block">
                          الخصائص التخصصية ومسار التطوير:
                        </span>
                        <div className="space-y-1.5">
                          {group.futureFeatures.map((feat, idx) => (
                            <div
                              key={idx}
                              className="bg-slate-50 p-2 rounded-xl border border-slate-200/70 text-[11px] flex items-center justify-between gap-2"
                            >
                              <span className="font-bold text-slate-800 truncate">{feat.title}</span>
                              <span
                                className={`text-[9px] font-black px-1.5 py-0.2 rounded-full flex-shrink-0 ${
                                  feat.status === 'active'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : feat.status === 'in_development'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {feat.status === 'active'
                                  ? 'جاهز'
                                  : feat.status === 'in_development'
                                  ? 'تطوير'
                                  : 'مخطط'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Footer Activity Count and Quick Switcher */}
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-medium">الأنشطة المسجلة:</span>
                      <span className="font-extrabold text-emerald-700">
                        {groupBizList.length} مشترك
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Categories Management List */}
          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-black text-base text-slate-900">
                  دليل الأنشطة والمهن ومجموعاتها الرئيسية
                </h3>
                <p className="text-xs text-slate-500">
                  يمكنك مراجعة الأنشطة والمهن وتخصصاتها، أو إضافة تصنيف جديد وربطه بإحدى المجموعات الرئيسية الـ18.
                </p>
              </div>

              <button
                onClick={() => setIsNewCatModalOpen(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer self-start sm:self-auto"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة تصنيف جديد</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <th className="py-3 px-4">اسم التصنيف</th>
                    <th className="py-3 px-4">المجموعة الرئيسية</th>
                    <th className="py-3 px-4">الوصف</th>
                    <th className="py-3 px-4">الأنشطة المرتبطة</th>
                    <th className="py-3 px-4 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categories.map((cat) => {
                    const group = functionalGroups.find((g) => g.id === cat.functionalGroupId);
                    const bizCount = businesses.filter(
                      (b) => b.categoryId === cat.id || b.category === cat.name || b.category.startsWith(cat.name + ' — ')
                    ).length;

                    return (
                      <tr key={cat.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-bold text-slate-900">
                          <div>{cat.name}</div>
                          <span className={`inline-flex mt-1 rounded-md px-2 py-0.5 text-[10px] font-black ${cat.classificationType === 'profession' ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'}`}>
                            {cat.classificationType === 'profession' ? 'مهنة' : 'نشاط'}
                          </span>
                          {cat.specialties?.length ? <small className="block mt-1 text-slate-400 font-normal">{cat.specialties.length} تخصصات دقيقة</small> : null}
                        </td>
                        <td className="py-3 px-4">
                          {group ? (
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${group.badgeColor}`}>
                              {ICONS_MAP[group.id]}
                              <span>{group.name}</span>
                            </span>
                          ) : (
                            <span className="text-slate-400">غير محدد</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                          {cat.description || '—'}
                        </td>
                        <td className="py-3 px-4 font-black text-slate-800">
                          {bizCount} نشاط
                        </td>
                        <td className="py-3 px-4 text-center">
                          {cat.isCustom ? (
                            <button
                              onClick={() => {
                                if (window.confirm(`هل أنت متأكد من حذف تصنيف (${cat.name})؟`)) {
                                  void deleteCategory(cat.id).catch((error) => window.alert(error instanceof Error ? error.message : 'تعذر حذف التصنيف من إعدادات المنصة.'));
                                }
                              }}
                              className="text-rose-500 hover:text-rose-700 font-bold p-1"
                              title="حذف هذا التصنيف المخصص"
                            >
                              <Trash2 className="w-4 h-4 inline" />
                            </button>
                          ) : (
                            <span className="text-slate-400 text-[10px]">نظام أساسي</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: BUSINESSES
         ========================================================================= */}
      {activeAdminTab === 'businesses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-lg text-slate-900">
                قائمة الأنشطة التجارية المسجلة في مصر ({businesses.length})
              </h3>
              <p className="text-xs text-slate-500">
                لكل نشاط صفحة تعريفية كاملة بغلاف وشعار، وتصنيف وظيفي، ورابط كتالوج مباشر للزبائن.
              </p>
            </div>
            <button
              onClick={() => setIsBizModalOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Building2 className="w-4 h-4" />
              <span>إضافة نشاط تجاري</span>
            </button>
          </div>

          {(() => {
            const businessesWithoutOwner = businesses.filter((business) =>
              !subscribers.some((subscriber) =>
                subscriber.businessId === business.id &&
                ['OWNER', 'BUSINESS_OWNER'].includes(String(subscriber.role || '').toUpperCase()) &&
                String(subscriber.membershipStatus || subscriber.status || '').toUpperCase() === 'ACTIVE'
              )
            );
            if (!businessesWithoutOwner.length) return null;
            return (
              <section className="rounded-2xl border border-amber-300 bg-amber-50 p-4 space-y-3" aria-labelledby="businesses-without-owner-heading">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
                  <div>
                    <h4 id="businesses-without-owner-heading" className="font-black text-sm text-amber-950">أنشطة بدون مالك معيّن ({businessesWithoutOwner.length})</h4>
                    <p className="mt-1 text-xs leading-relaxed text-amber-900">تظهر هنا الأنشطة التي لم يُعيَّن لها حساب مالك نشط. يمكن استكمال تعيين المالك من إدارة حسابات المشتركين، ولن يتم تفعيل النشاط تلقائيًا.</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {businessesWithoutOwner.map((business) => (
                    <div key={business.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-amber-200 bg-white p-3">
                      <div>
                        <p className="text-sm font-black text-slate-900">{business.name}</p>
                        <p className="mt-0.5 text-xs text-amber-800">لم يتم تعيين مالك للنشاط</p>
                      </div>
                      <button type="button" onClick={() => { setSubBizId(business.id); setActiveAdminTab('subscribers'); setIsSubModalOpen(true); }} className="shrink-0 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-700">
                        إدارة حساب المالك
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })()}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {businesses.map((b) => {
              const productCount = products.filter((p) => p.businessId === b.id).length;
              const sub = subscribers.find((s) => s.businessId === b.id);
              const group = functionalGroups.find((g) => g.id === b.functionalGroupId);

              return (
                <div
                  key={b.id}
                  className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow"
                >
                  <div>
                    {/* Cover Photo */}
                    <div className="relative h-28 bg-slate-800">
                      <img
                        src={b.coverUrl || resolveDefaultImage({ name: b.name, description: b.bio, category: b.category, kind: 'cover' })}
                        alt={b.name}
                        className="w-full h-full object-cover"
                        onError={(event) => {
                          const image = event.currentTarget;
                          image.src = resolveDefaultImage({ name: b.name, description: b.bio, category: b.category, kind: 'cover' });
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                        <span className="bg-slate-900/80 backdrop-blur-xs text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/20">
                          {b.category}
                        </span>
                        {group && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${group.badgeColor}`}>
                            {group.shortName}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Logo & Info */}
                    <div className="p-4 relative -mt-8">
                      <div className="flex items-start gap-3">
                        <img
                          src={b.logoUrl || resolveDefaultImage({ name: b.name, description: b.bio, category: b.category, kind: 'activity' })}
                          alt={b.name}
                          className="w-14 h-14 rounded-2xl ring-4 ring-white object-cover bg-white shadow-md flex-shrink-0"
                          onError={(event) => {
                            const image = event.currentTarget;
                            if (!image.src.endsWith('/business-placeholder.svg')) image.src = BUSINESS_PLACEHOLDER;
                          }}
                        />
                        <div className="pt-6 min-w-0 flex-1">
                          <h4 className="font-extrabold text-sm text-slate-900 truncate">
                            {b.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                            <span>{formatEgyptianLocation(b.governorate, b.markaz, b.village)}</span>
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-100 space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-600">
                          <span>سعة الكتالوج:</span>
                          <span className="font-bold text-emerald-700">
                            {productCount} من 150 صنف
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-600">
                          <span>المشترك المخصص:</span>
                          <span className="font-bold text-slate-800 truncate max-w-[140px]">
                            {sub ? sub.fullName : 'لم يحدد بعد'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-600">
                          <span>واتساب النشاط:</span>
                          <span dir="ltr" className="font-mono text-[11px] text-slate-800">
                            {b.ownerWhatsApp || 'غير مسجل'}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-100">
                          <span>الدفع الإلكتروني:</span>
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">غير متاح في الإصدار الحالي</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-1.5 flex-wrap">
                    <button
                      onClick={() => openPaymobSettings(b)}
                      className="text-xs font-bold px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200 cursor-pointer transition-colors"
                      title="بوابة الدفع الإلكتروني غير متاحة في الإصدار الحالي"
                    >
                      <span>حالة الدفع الإلكتروني</span>
                    </button>

                    <button
                      onClick={() => handleCopyStoreLink(b)}
                      className="text-xs text-slate-700 hover:text-emerald-700 font-bold flex items-center gap-1 cursor-pointer"
                    >
                      {copiedId === b.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span className="text-emerald-700">تم نسخ الرابط!</span>
                        </>
                      ) : (
                        <>
                          <Share2 className="w-3.5 h-3.5" />
                          <span>رابط الكتالوج</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => {
                        setSelectedBusinessId(b.id);
                        setCurrentView('public_storefront');
                      }}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-1.5 rounded-xl flex items-center gap-1 shadow-xs cursor-pointer"
                    >
                      <span>معاينة</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={businessDeleteBusyId === b.id}
                      onClick={() => { void handleDeleteBusiness(b); }}
                      className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      title="حذف النشاط وبياناته نهائيًا؛ تُحفظ السجلات المالية والتشغيلية"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {businessDeleteBusyId === b.id ? 'جارٍ الحذف...' : 'حذف النشاط'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: SUBSCRIBERS
         ========================================================================= */}
      {activeAdminTab === 'subscribers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-lg text-slate-900">
                قائمة المشتركين وربط حسابات Google
              </h3>
              <p className="text-xs text-slate-500">
                يتم ربط كل اشتراك بهوية Supabase وفق البريد الإلكتروني. تسجيل الدخول للمشتركين باستخدام Google فقط.
              </p>
            </div>
            <button
              onClick={() => {
                setIsSubModalOpen(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>تعيين مشترك جديد</span>
            </button>
          </div>

          {authSession.subscriberDirectoryError && (
            <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-bold text-rose-900">
              تعذر قراءة حسابات Supabase: {authSession.subscriberDirectoryError}
            </div>
          )}
          {(authSession.ignoredOrphanMemberships || 0) > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-900">
              تم تجاهل {authSession.ignoredOrphanMemberships} تعيين قديم لا يرتبط بحساب Auth موجود. لم يتم حذفها تلقائيًا.
            </div>
          )}
          <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <th className="py-3.5 px-4">المشترك</th>
                    <th className="py-3.5 px-4">النشاط المخصص</th>
                    <th className="py-3.5 px-4">الدور والصلاحيات</th>
                    <th className="py-3.5 px-4">حساب Google</th>
                    <th className="py-3.5 px-4">حالة الاشتراك</th>
                    <th className="py-3.5 px-4">طريقة التعيين</th>
                    <th className="py-3.5 px-4 text-center">نسخ البيانات</th>
                    <th className="py-3.5 px-4 text-center">دعوة Gmail</th>
                    <th className="py-3.5 px-4 text-center">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {subscribers.map((sub) => {
                    const assignedBiz = businesses.find((b) => b.id === sub.businessId);

                    return (
                      <tr key={sub.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900">{sub.fullName}</div>
                          <div className="text-[11px] text-slate-400">{sub.email}</div>
                        </td>

                        <td className="py-3.5 px-4">
                          {assignedBiz ? (
                            <span className="font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              {assignedBiz.name}
                            </span>
                          ) : (
                            <span className="text-slate-400">غير مخصص</span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-black text-slate-800">{sub.role || (sub.isAccountOnly ? 'بدون تعيين' : 'غير محدد')}</div>
                          {sub.isPlatformAccount || String(sub.role || '').toUpperCase() === 'SUPER_ADMIN' ? (
                            <span className="mt-1 inline-block rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900">حساب مالك المنصة — محمي</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => openSubscriberAccessEditor(sub)}
                              className="mt-1 inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-[10px] font-black text-indigo-800 hover:bg-indigo-100"
                            >
                              <UserCog className="h-3 w-3" />
                              <span>{sub.isAccountOnly ? 'تعيين دور ونشاط' : 'إدارة الصلاحيات'}</span>
                            </button>
                          )}
                        </td>

                        <td className="py-3.5 px-4 font-mono font-bold text-slate-700">
                          {sub.username || sub.email.split('@')[0]}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                            sub.status === 'active' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : sub.status === 'pending' ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}>
                            {sub.status === 'active' ? 'نشط' : sub.status === 'pending' ? 'بانتظار السداد' : 'موقوف'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
                              sub.authMethod === 'direct_password'
                                ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                : 'bg-blue-100 text-blue-900 border border-blue-200'
                            }`}
                          >
                            {sub.authMethod === 'direct_password'
                              ? 'تعيين مباشر (بدون إيميل)'
                              : 'دعوة Gmail'}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleCopyCredentials(sub.id)}
                            className="inline-flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-800 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                          >
                            {copiedId === sub.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-600" />
                                <span className="text-emerald-700">تم النسخ</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>نسخ للواتساب</span>
                              </>
                            )}
                          </button>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <a
                            href={sendGmailInvite(sub.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-700 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer border border-red-200"
                            title="فتح نافذة كتابة رسالة دعوة رسمية في Gmail"
                          >
                            <Mail className="w-3 h-3 text-red-600" />
                            <span>Gmail</span>
                          </a>
                        </td>

                        <td className="py-3.5 px-4 text-center">
                          <button
                            disabled={Boolean(sub.isAccountOnly || sub.isPlatformAccount || String(sub.role || '').toUpperCase() === 'SUPER_ADMIN')}
                            title={sub.isAccountOnly ? 'لا يوجد تعيين لتعطيله؛ استخدم إدارة الصلاحيات لتعيين الحساب' : 'تعطيل تعيين هذا الحساب بالنشاط'}
                            onClick={() => {
                              if (sub.isAccountOnly || sub.isPlatformAccount || String(sub.role || '').toUpperCase() === 'SUPER_ADMIN') return;
                              if (window.confirm(`هل تريد تعطيل تعيين (${sub.fullName}) بالنشاط؟ سيظل حساب Supabase موجودًا.`)) {
                                void deleteSubscriber(sub.id).catch((error) => window.alert(error instanceof Error ? error.message : 'تعذر تعطيل تعيين الحساب.'));
                              }
                            }}
                            className="text-slate-400 hover:text-rose-600 disabled:opacity-20 disabled:cursor-not-allowed p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {isSubscriberAccessModalOpen && editingSubscriber && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="subscriber-access-title">
              <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-2xl space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 id="subscriber-access-title" className="text-lg sm:text-xl font-black text-slate-900">إدارة الدور والصلاحيات</h3>
                    <p className="mt-1 text-xs text-slate-500">{editingSubscriber.fullName} · {editingSubscriber.email}</p>
                  </div>
                  <button type="button" onClick={() => { setIsSubscriberAccessModalOpen(false); setEditingSubscriber(null); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50">إغلاق</button>
                </div>

                {subAccessFeedback && (
                  <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-900">{subAccessFeedback}</div>
                )}

                <form className="space-y-5" onSubmit={async (event) => {
                  event.preventDefault();
                  if (subAccessSaving || !editingSubscriber) return;
                  setSubAccessSaving(true);
                  setSubAccessFeedback(null);
                  try {
                    const selectedBusiness = businesses.find((business) => business.id === subAccessBusinessId);
                    const tenantId = selectedBusiness?.tenantId || subAccessTenantId;
                    if (subAccessBusinessId && !selectedBusiness?.tenantId) throw new Error('النشاط المختار غير مرتبط بمستأجر إنتاج معروف.');
                    await saveSubscriberMembership({
                      subscriber: editingSubscriber,
                      tenantId,
                      businessId: subAccessBusinessId || undefined,
                      branchId: subAccessBranchId || undefined,
                      role: subAccessRole,
                      status: subAccessStatus,
                      catalogEnabled: subAccessCatalogEnabled,
                      catalogWrite: subAccessCatalogWrite,
                      accountRestricted: subAccessAccountRestricted,
                    });
                    setIsSubscriberAccessModalOpen(false);
                    setEditingSubscriber(null);
                  } catch (error) {
                    setSubAccessFeedback(error instanceof Error ? error.message : 'تعذر حفظ الدور والصلاحيات في Supabase.');
                  } finally {
                    setSubAccessSaving(false);
                  }
                }}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="block text-xs font-bold text-slate-700 space-y-1.5">
                      <span>الدور</span>
                      <select value={subAccessRole} onChange={(event) => setSubAccessRole(event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" required>
                        <option value="CUSTOMER">عميل (CUSTOMER)</option>
                        <option value="OWNER">مالك نطاق / منشأة (OWNER)</option>
                        <option value="BUSINESS_OWNER">صاحب نشاط (BUSINESS_OWNER)</option>
                        <option value="ADMIN">مدير نشاط (ADMIN)</option>
                        <option value="MANAGER">مدير فرع/تشغيل (MANAGER)</option>
                        <option value="FINANCE">المالية (FINANCE)</option>
                        <option value="SALES">المبيعات (SALES)</option>
                        <option value="MARKETING">التسويق (MARKETING)</option>
                        <option value="SUPPORT">الدعم (SUPPORT)</option>
                        <option value="SUPPORT_MANAGER">مدير الدعم (SUPPORT_MANAGER)</option>
                        <option value="EMPLOYEE">موظف (EMPLOYEE)</option>
                        <option value="STAFF">طاقم فرع (STAFF)</option>
                        <option value="SERVICE_PROVIDER">مقدم خدمة (SERVICE_PROVIDER)</option>
                        <option value="PROVIDER_OWNER">مالك مقدم خدمة (PROVIDER_OWNER)</option>
                        <option value="PROVIDER_ADMIN">مدير مقدم خدمة (PROVIDER_ADMIN)</option>
                        <option value="BRANCH_MANAGER">مدير فرع (BRANCH_MANAGER)</option>
                        <option value="PROVIDER_FINANCE">مالية مقدم خدمة (PROVIDER_FINANCE)</option>
                        <option value="PROVIDER_MARKETING">تسويق مقدم خدمة (PROVIDER_MARKETING)</option>
                        <option value="PROVIDER_OPERATIONS">تشغيل مقدم خدمة (PROVIDER_OPERATIONS)</option>
                        <option value="PROVIDER_SUPPORT">دعم مقدم خدمة (PROVIDER_SUPPORT)</option>
                      </select>
                      <span className="block text-[10px] font-normal text-slate-500">دور SUPER_ADMIN محمي ولا يمكن منحه أو تعديله من هذه الشاشة.</span>
                    </label>

                    <label className="block text-xs font-bold text-slate-700 space-y-1.5">
                      <span>حالة التعيين</span>
                      <select value={subAccessStatus} onChange={(event) => setSubAccessStatus(event.target.value as 'ACTIVE' | 'INACTIVE' | 'SUSPENDED')} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                        <option value="ACTIVE">نشط (ACTIVE)</option>
                        <option value="INACTIVE">غير نشط (INACTIVE)</option>
                        <option value="SUSPENDED">موقوف (SUSPENDED)</option>
                      </select>
                    </label>

                    <label className="block sm:col-span-2 text-xs font-bold text-slate-700 space-y-1.5">
                      <span>النشاط المخصص</span>
                      <select value={subAccessBusinessId} onChange={(event) => {
                        const nextId = event.target.value;
                        setSubAccessBusinessId(nextId);
                        const match = businesses.find((business) => business.id === nextId);
                        if (match?.tenantId) setSubAccessTenantId(match.tenantId);
                        setSubAccessBranchId('');
                      }} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                        <option value="">بدون نشاط مرتبط (حساب عام/عميل)</option>
                        {businesses.map((business) => (
                          <option key={business.id} value={business.id}>{business.name} · {business.category}</option>
                        ))}
                      </select>
                    </label>

                    <label className="block sm:col-span-2 text-xs font-bold text-slate-700 space-y-1.5">
                      <span>معرّف الفرع (اختياري)</span>
                      <input value={subAccessBranchId} onChange={(event) => setSubAccessBranchId(event.target.value.trim())} placeholder="اتركه فارغًا لتعيين الصلاحية على مستوى النشاط" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm" />
                    </label>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-4">
                    <div>
                      <h4 className="text-sm font-black text-slate-900">التحكم في الحساب والكتالوج</h4>
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">يطبّق الخادم القيود على طلبات قراءة الكتالوج وتعديله، وليس على مظهر الشاشة فقط.</p>
                    </div>
                    <label className="flex items-start gap-3 text-xs text-slate-800">
                      <input type="checkbox" checked={subAccessAccountRestricted} onChange={(event) => {
                        const restricted = event.target.checked;
                        setSubAccessAccountRestricted(restricted);
                        if (restricted) {
                          setSubAccessCatalogEnabled(false);
                          setSubAccessCatalogWrite(false);
                          setSubAccessStatus('SUSPENDED');
                        }
                      }} className="mt-0.5 h-4 w-4 accent-rose-600" />
                      <span><strong className="block text-rose-800">تقييد الحساب بالكامل على هذا التعيين</strong><span className="mt-0.5 block text-slate-500">يمنع الوصول إلى الكتالوج عبر هذا الدور. لا يحذف حساب Google من Supabase.</span></span>
                    </label>
                    <label className="flex items-start gap-3 text-xs text-slate-800">
                      <input type="checkbox" checked={subAccessCatalogEnabled} disabled={subAccessAccountRestricted} onChange={(event) => setSubAccessCatalogEnabled(event.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600 disabled:opacity-40" />
                      <span><strong className="block">السماح بدخول الكتالوج</strong><span className="mt-0.5 block text-slate-500">أوقف هذا الخيار لمنع الوصول إلى واجهات الكتالوج لهذا التعيين.</span></span>
                    </label>
                    <label className="flex items-start gap-3 text-xs text-slate-800">
                      <input type="checkbox" checked={subAccessCatalogWrite} disabled={!subAccessCatalogEnabled || subAccessAccountRestricted} onChange={(event) => setSubAccessCatalogWrite(event.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-600 disabled:opacity-40" />
                      <span><strong className="block">السماح بإضافة وتعديل عناصر الكتالوج</strong><span className="mt-0.5 block text-slate-500">عند إيقافه يحتفظ الحساب بقراءة الكتالوج فقط.</span></span>
                    </label>
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 border-t border-slate-100 pt-4">
                    <button type="button" onClick={() => { setIsSubscriberAccessModalOpen(false); setEditingSubscriber(null); }} className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50">إلغاء</button>
                    <button type="submit" disabled={subAccessSaving} className="rounded-xl bg-slate-900 px-6 py-2.5 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-50">
                      {subAccessSaving ? 'جارٍ حفظ الدور والصلاحيات...' : 'حفظ الصلاحيات والتعيين'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB: SETTINGS
         ========================================================================= */}
      {activeAdminTab === 'settings' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
          <div>
            <h3 className="font-extrabold text-lg text-slate-900">
              إعدادات إدارة منصة MantiqatiX والواتساب الرسمي
            </h3>
            <p className="text-xs text-slate-500">
              هذه الإعدادات تحدد رقم واتساب الإدارة لزر "طلب كتالوج النشاط". يتم تسجيل دخول مالك المنصة عبر Google.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-black text-slate-800 mb-1.5">
                رقم واتساب إدارة المنصة (المرتبط بزر طلب الكتالوج)
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-amber-600 absolute right-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  dir="ltr"
                  value={adminPhone}
                  onChange={(e) => setAdminPhone(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-10 pl-3 py-2.5 text-xs text-slate-900 text-right font-bold"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                الزبون عندما يضغط "طلب كتالوج النشاط" بالأعلى يتم توجيهه مباشرة لهذا الرقم.
              </p>
            </div>

            <div>
              <p className="text-xs text-slate-600">تسجيل دخول مالك المنصة يتم عبر Google. لا توجد كلمة مرور إدارية تقليدية في هذا الإصدار.</p>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-800 mb-1.5">
                العملة المعتمدة للمنصة
              </label>
              <input
                type="text"
                disabled
                value="الجنيه المصري (ج.م)"
                className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 font-bold cursor-not-allowed"
              />
            </div>
          </div>

          {settingsFeedback && (
            <div role="status" className={`rounded-xl border px-4 py-3 text-xs font-bold ${settingsFeedback.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-rose-200 bg-rose-50 text-rose-800'}`}>
              {settingsFeedback.message}
            </div>
          )}
          <div className="pt-4 flex justify-end">
            <button
              type="button"
              disabled={settingsSaving}
              onClick={async () => {
                if (settingsSaving) return;
                setSettingsFeedback(null);
                const phoneDigits = adminPhone.replace(/\D/g, '');
                if (phoneDigits.length < 10 || phoneDigits.length > 15) {
                  setSettingsFeedback({ type: 'error', message: 'أدخل رقم واتساب صحيحًا من 10 إلى 15 رقمًا.' });
                  return;
                }
                setSettingsSaving(true);
                try {
                  await updateAdminSettings({
                    adminWhatsApp: adminPhone.trim(),
                    currency: 'ج.م',
                    platformName: 'MantiqatiX',
                  });
                  setSettingsFeedback({ type: 'success', message: 'أكد الخادم حفظ إعدادات المنصة في قاعدة الإنتاج.' });
                } catch (error) {
                  setSettingsFeedback({ type: 'error', message: error instanceof Error ? error.message : 'تعذر حفظ الإعدادات لدى الخادم؛ لم يتم اعتماد التغيير.' });
                } finally {
                  setSettingsSaving(false);
                }
              }}
              className="bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white font-black text-xs px-6 py-2.5 rounded-xl shadow-md cursor-pointer"
            >
              {settingsSaving ? 'جارٍ حفظ الإعدادات...' : 'حفظ إعدادات المنصة'}
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB: BACKUP & RESTORE
         ========================================================================= */}
      {activeAdminTab === 'backup' && (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6">
          <div>
            <h3 className="font-extrabold text-lg text-slate-900">
              النسخ الاحتياطي واستعادة قاعدة بيانات MantiqatiX
            </h3>
            <p className="text-xs text-slate-500">
              تصدير واستيراد بيانات المشتركين والأنشطة، الكتالوجات (حتى 150 صنف)، والتصنيف الوظيفي.
            </p>
          </div>

          {backupFeedback && (
            <div
              className={`p-4 rounded-2xl text-xs font-bold ${
                backupFeedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                  : 'bg-rose-50 text-rose-800 border border-rose-300'
              }`}
            >
              {backupFeedback.message}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-5 rounded-2xl bg-amber-50/70 border border-amber-200 space-y-4">
              <h4 className="font-black text-sm text-amber-950 flex items-center gap-2">
                <Download className="w-4 h-4 text-amber-600" />
                <span>تصدير نسخة احتياطية (Export JSON)</span>
              </h4>
              <p className="text-xs text-amber-900 leading-relaxed">
                حفظ ملف JSON كامل على جهازك يشمل بيانات الأنشطة والمشتركين والعمولات.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={downloadBackupFile}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل ملف النسخة الاحتياطية (.json)</span>
                </button>
                <button
                  onClick={() => {
                    const text = exportBackupJSON();
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(text);
                      setIsCopiedBackupJson(true);
                      setTimeout(() => setIsCopiedBackupJson(false), 2000);
                    }
                  }}
                  className="bg-white hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold text-xs px-3 py-2.5 rounded-xl cursor-pointer"
                >
                  {isCopiedBackupJson ? 'تم النسخ!' : 'نسخ نص JSON'}
                </button>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <h4 className="font-black text-sm text-slate-900 flex items-center gap-2">
                <Upload className="w-4 h-4 text-emerald-600" />
                <span>استعادة نسخة احتياطية (Import JSON)</span>
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                الصق نص النسخة الاحتياطية أو اختر ملفاً لاسترجاع كافة الأنشطة والمشتركين بدقة.
              </p>
              <textarea
                rows={3}
                value={backupPasteText}
                onChange={(e) => setBackupPasteText(e.target.value)}
                placeholder="الصق محتوى ملف JSON هنا..."
                className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-[11px] font-mono"
              />
              <button
                onClick={() => {
                  if (!backupPasteText.trim()) {
                    setBackupFeedback({ type: 'error', message: 'يرجى لصق كود النسخة الاحتياطية أولاً.' });
                    return;
                  }
                  const res = importBackupJSON(backupPasteText);
                  if (res.success && res.counts) {
                    setBackupFeedback({
                      type: 'success',
                      message: `تمت الاستعادة بنجاح! (${res.counts.businesses} نشاط، ${res.counts.products} منتج، ${res.counts.subscribers} مشترك).`,
                    });
                    setBackupPasteText('');
                  } else {
                    setBackupFeedback({
                      type: 'error',
                      message: res.error || 'فشلت الاستعادة، الملف غير صالح.',
                    });
                  }
                }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs px-4 py-2.5 rounded-xl shadow-xs cursor-pointer"
              >
                تطبيق واستعادة البيانات
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ADD SUBSCRIBER
         ========================================================================= */}
      {isSubModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-base text-slate-900">ربط مشترك بحساب Google</h3>
              <button
                onClick={() => setIsSubModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                إلغاء
              </button>
            </div>

            <form onSubmit={handleAddSubscriber} className="space-y-3">
              <div>
                <label className="block text-[11px] font-black text-slate-700 mb-1">
                  الاسم الكامل للمشترك <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={subName}
                  onChange={(e) => setSubName(e.target.value)}
                  placeholder="مثال: أحمد محمود عبد الفتاح"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 mb-1">
                  البريد الإلكتروني <span className="text-rose-500">*</span>
                </label>
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={subEmail}
                  onChange={(e) => setSubEmail(e.target.value)}
                  placeholder="ahmed@example.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-right"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">
                    النشاط التجاري المخصص له
                  </label>
                  <select
                    value={subBizId}
                    onChange={(e) => setSubBizId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    {businesses.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.category})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">
                    رقم الجوال
                  </label>
                  <input
                    type="tel"
                    dir="ltr"
                    value={subPhone}
                    onChange={(e) => setSubPhone(e.target.value)}
                    placeholder="+201000000000"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-right"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSubModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  حفظ الاشتراك وربطه بحساب Google
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ADD BUSINESS
         ========================================================================= */}
      {isBizModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-base text-slate-900">إضافة نشاط تجاري جديد على MantiqatiX</h3>
              <button
                onClick={() => setIsBizModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                إلغاء
              </button>
            </div>

            <form onSubmit={handleAddBusiness} className="space-y-3">
              <div>
                <label className="block text-[11px] font-black text-slate-700 mb-1">
                  اسم النشاط التجاري <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newBizName}
                  onChange={(e) => setNewBizName(e.target.value)}
                  placeholder="مثال: مطعم شواية الديرة أو سوبرماركت الفلاح"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">
                    المجموعة الرئيسية
                  </label>
                  <select
                    value={newBizFunctionalGroup}
                    onChange={(e) => {
                      const groupId = e.target.value as FunctionalGroupId;
                      const nextCategory = categories.find((c) => c.functionalGroupId === groupId);
                      setNewBizFunctionalGroup(groupId);
                      setNewBizCategory(nextCategory?.name || '');
                      setNewBizSpecialty('');
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    {functionalGroups.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">
                    التصنيف — النشاط أو المهنة
                  </label>
                  <select
                    value={newBizCategory}
                    onChange={(e) => { setNewBizCategory(e.target.value); setNewBizSpecialty(''); }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    {categories.filter((c) => c.functionalGroupId === newBizFunctionalGroup).map((c) => (
                      <option key={c.id} value={c.name}>
                        {(c.classificationType === 'profession' ? 'مهنة: ' : 'نشاط: ') + c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {(() => {
                const selected = categories.find((c) => c.name === newBizCategory && c.functionalGroupId === newBizFunctionalGroup);
                if (!selected?.specialties?.length) return null;
                return (
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 mb-1">التخصص الدقيق (اختياري)</label>
                    <select value={newBizSpecialty} onChange={(e) => setNewBizSpecialty(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold">
                      <option value="">بدون تحديد تخصص دقيق</option>
                      {selected.specialties.map((specialty) => <option key={specialty} value={specialty}>{specialty}</option>)}
                    </select>
                  </div>
                );
              })()}

              <div>
                <label className="block text-[11px] font-black text-slate-700 mb-1">
                  رقم الواتساب الخاص بصاحب النشاط (لاستقبال الطلبات)
                </label>
                <input
                  type="tel"
                  dir="ltr"
                  value={newBizOwnerWhatsApp}
                  required
                  onChange={(e) => setNewBizOwnerWhatsApp(e.target.value)}
                  placeholder="+201012345678"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-right"
                />
              </div>

              {/* Egyptian Location Breakdown */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                <span className="block text-[11px] font-black text-slate-800 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                  <span>تحديد مكان النشاط (قرية أو مركز أو محافظة في مصر):</span>
                </span>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">المحافظة</label>
                    <input
                      type="text"
                      required
                      value={newBizGov}
                      onChange={(e) => setNewBizGov(e.target.value)}
                      placeholder="مثال: الدقهلية"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">المركز / القسم</label>
                    <input
                      type="text"
                      required
                      value={newBizMarkaz}
                      onChange={(e) => setNewBizMarkaz(e.target.value)}
                      placeholder="مثال: المنصورة"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-0.5">القرية / الحي</label>
                    <input
                      type="text"
                      required
                      value={newBizVillage}
                      onChange={(e) => setNewBizVillage(e.target.value)}
                      placeholder="مثال: ميت علي"
                      className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-600 mb-0.5">العنوان التفصيلي / الشارع</label>
                  <input
                    type="text"
                    value={newBizAddress}
                    onChange={(e) => setNewBizAddress(e.target.value)}
                    placeholder="شارع المشاية السفلية"
                    className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                  />
                </div>
              </div>

              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div>
                  <h4 className="text-sm font-black text-slate-800">طريقة التفعيل والنشر</h4>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">اختر هل يظهر الكتالوج للزوار فورًا أم ينتظر موافقة النشر من الإدارة.</p>
                </div>
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${newBizActivationMode === 'activate_now' ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
                  <input type="radio" name="newBizActivationMode" value="activate_now" checked={newBizActivationMode === 'activate_now'} onChange={() => setNewBizActivationMode('activate_now')} className="mt-1 accent-emerald-600" />
                  <span>
                    <span className="block text-xs font-black text-slate-800">التفعيل الفعلي الآن — نشر الكتالوج</span>
                    <span className="mt-1 block text-[11px] leading-5 text-slate-500">يظهر النشاط للزوار بعد الحفظ، مع بقائه غير مدفوع لحين تأكيد السداد.</span>
                  </span>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${newBizActivationMode === 'wait_for_confirmation' ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-white'}`}>
                  <input type="radio" name="newBizActivationMode" value="wait_for_confirmation" checked={newBizActivationMode === 'wait_for_confirmation'} onChange={() => setNewBizActivationMode('wait_for_confirmation')} className="mt-1 accent-blue-600" />
                  <span>
                    <span className="block text-xs font-black text-slate-800">انتظار تأكيد النشر من الإدارة</span>
                    <span className="mt-1 block text-[11px] leading-5 text-slate-500">يُحفظ النشاط غير منشور ويظل مخفيًا عن الزوار حتى تفعّله الإدارة لاحقًا.</span>
                  </span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-slate-700">موعد استحقاق السداد</span>
                    <input type="date" required value={newBizPaymentDueDate} onChange={(event) => setNewBizPaymentDueDate(event.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold" />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-bold text-slate-700">مدة المهلة بعد الاستحقاق (أيام)</span>
                    <input type="number" required min={0} max={90} step={1} value={newBizGracePeriodDays} onChange={(event) => setNewBizGracePeriodDays(Number(event.target.value))} className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold" />
                  </label>
                </div>
                <p className="text-[11px] leading-5 text-slate-500">المهلة تُحفظ كإعداد للسداد؛ ولا يعني تحديدها إنشاء فاتورة أو فرض رسوم أو تشغيل إيقاف تلقائي.</p>
              </section>

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900">لا يسجل هذا النموذج رسومًا ولا يؤكد السداد ولا يفعّل اشتراكًا مدفوعًا. ستظل حالة السداد «غير مدفوع» في الخيارين؛ الاختيار يحدد نشر الكتالوج فقط، مع حفظ تاريخ الاستحقاق ومدة المهلة.</div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBizModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md shadow-emerald-600/20 cursor-pointer"
                >
                  إضافة النشاط التجاري
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: ADD NEW CATEGORY
         ========================================================================= */}
      {isNewCatModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-base text-slate-900">إضافة تصنيف تجاري جديد</h3>
              <button
                onClick={() => setIsNewCatModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                إلغاء
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="space-y-3">
              <div>
                <label className="block text-[11px] font-black text-slate-700 mb-1">
                  اسم النشاط أو المهنة <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="مثال: صيدلية أو طبيب أو مطعم"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 mb-1">
                  نوع التصنيف <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newCatType}
                  onChange={(e) => setNewCatType(e.target.value as 'activity' | 'profession')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold cursor-pointer"
                >
                  <option value="activity">نشاط</option>
                  <option value="profession">مهنة</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 mb-1">
                  المجموعة الرئيسية <span className="text-rose-500">*</span>
                </label>
                <select
                  value={newCatGroup}
                  onChange={(e) => setNewCatGroup(e.target.value as FunctionalGroupId)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold cursor-pointer"
                >
                  {functionalGroups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name} ({g.englishName})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-400 mt-1">
                  هذا الاختيار يحدد مكان التصنيف في الدليل فقط؛ ولا يفعّل أي وحدة تشغيلية أو صلاحية تلقائيًا.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 mb-1">
                  التخصصات الدقيقة (اختياري)
                </label>
                <input
                  type="text"
                  value={newCatSpecialties}
                  onChange={(e) => setNewCatSpecialties(e.target.value)}
                  placeholder="افصل بين التخصصات بفاصلة، مثل: طبيب عيون، طبيب قلب"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 mb-1">
                  وصف مختصر للتصنيف
                </label>
                <input
                  type="text"
                  value={newCatDesc}
                  onChange={(e) => setNewCatDesc(e.target.value)}
                  placeholder="مثال: يختص بالوجبات والمشروبات الجاهزة"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewCatModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md cursor-pointer"
                >
                  حفظ التصنيف
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedPaymobBiz && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 p-5 text-white">
              <h3 className="font-black text-lg">الدفع الإلكتروني غير متاح</h3>
              <p className="text-xs text-slate-300 mt-1">النشاط: {selectedPaymobBiz.name}</p>
            </div>
            <div className="p-6 space-y-4 text-right">
              <p className="text-sm text-slate-700 leading-7">
                لم يتم اعتماد دورة الدفع الإلكتروني واختبارات الإنتاج بعد. لن تُحفظ مفاتيح Paymob من هذه الواجهة ولن يُفعّل التحصيل الإلكتروني في الإصدار الحالي.
              </p>
              <p className="text-xs text-slate-500">
                يمكن تأكيد الاشتراك يدويًا فقط بعد التحقق من السداد الفعلي خارج المنصة.
              </p>
              <div className="flex justify-end">
                <button type="button" onClick={() => setSelectedPaymobBiz(null)} className="px-5 py-2.5 text-xs font-bold text-white bg-slate-900 rounded-xl">
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
