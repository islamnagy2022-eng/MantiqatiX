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
} from 'lucide-react';
import {
  formatEgyptianLocation,
} from '../../utils/rules';

import { SuperAdminControlCenter } from './SuperAdminControlCenter';

const BUSINESS_PLACEHOLDER = `${import.meta.env.BASE_URL || '/'}business-placeholder.svg`;

const ICONS_MAP: Record<string, React.ReactNode> = {
  dining: <UtensilsCrossed className="w-4 h-4 text-amber-500" />,
  retail: <ShoppingBag className="w-4 h-4 text-blue-500" />,
  services: <CalendarCheck2 className="w-4 h-4 text-purple-500" />,
  healthcare: <HeartPulse className="w-4 h-4 text-emerald-500" />,
  crafts_maintenance: <Wrench className="w-4 h-4 text-orange-500" />,
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
  } = useApp();

  const [activeAdminTab, setActiveAdminTab] = useState<
    'billing' | 'taxonomy' | 'businesses' | 'subscribers' | 'settings' | 'backup' | 'control_center'
  >('billing');

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
    setSubAccessCatalogEnabled(subscriber.permissions?.catalog !== false && subscriber.permissions?.account_restricted !== true);
    setSubAccessCatalogWrite(subscriber.permissions?.catalog_write !== false && subscriber.permissions?.catalog_read_only !== true);
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
  const [newBizCategory, setNewBizCategory] = useState(categories[0]?.name || 'مطاعم ومقاهي');
  const [newBizFunctionalGroup, setNewBizFunctionalGroup] = useState<FunctionalGroupId>('dining');
  const [newBizOwnerWhatsApp, setNewBizOwnerWhatsApp] = useState('');
  const [newBizBio, setNewBizBio] = useState('');
  // Egyptian Location Fields
  const [newBizGov, setNewBizGov] = useState('');
  const [newBizMarkaz, setNewBizMarkaz] = useState('');
  const [newBizVillage, setNewBizVillage] = useState('');
  const [newBizAddress, setNewBizAddress] = useState('');

  // New Category Creation state
  const [isNewCatModalOpen, setIsNewCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatGroup, setNewCatGroup] = useState<FunctionalGroupId>('dining');
  const [newCatDesc, setNewCatDesc] = useState('');

  // Billing tab filters & feedback
  const [billingGovFilter, setBillingGovFilter] = useState('all');
  const [billingStatusFilter, setBillingStatusFilter] = useState('all');
  const [billingActionMsg, setBillingActionMsg] = useState<string | null>(null);
  const [billingActionBusyId, setBillingActionBusyId] = useState<string | null>(null);

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

    const matchedCat = categories.find((c) => c.name === newBizCategory);
    const resolvedGroup = newBizFunctionalGroup || matchedCat?.functionalGroupId || 'dining';

    const slug = newBizName
      .trim()
      .toLowerCase()
      .replace(/[\s\W-]+/g, '-');

    try {
    const createdBizId = await addBusiness({
      name: newBizName,
      slug: `${slug}-${Date.now().toString().slice(-4)}`,
      category: newBizCategory,
      categoryId: matchedCat?.id,
      functionalGroupId: resolvedGroup,
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
      paymentDueDate: '',
      commissionPerOrder: 0,
      totalOrdersCount: 0,
      paymentStatus: 'pending',
      overdueDaysCount: 0,
      isFrozen: false,
      paymentConfirmedByAdmin: false,
    });

    setNewBizName('');
    setNewBizBio('');
    setNewBizOwnerWhatsApp('');
    setNewBizGov('');
    setNewBizMarkaz('');
    setNewBizVillage('');
    setNewBizAddress('');
    setIsBizModalOpen(false);
    setSelectedBusinessId(createdBizId);
    } catch (error) { window.alert(error instanceof Error ? error.message : 'تعذر إنشاء النشاط في قاعدة الإنتاج.'); }
  };

  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;

    addCategory({
      name: newCatName.trim(),
      functionalGroupId: newCatGroup,
      description: newCatDesc.trim() || undefined,
    });

    setNewCatName('');
    setNewCatDesc('');
    setIsNewCatModalOpen(false);
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
              <span>إضافة تصنيف تجاري جديد</span>
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
                  جدول التصنيفات التجارية ومجموعاتها الوظيفية
                </h3>
                <p className="text-xs text-slate-500">
                  يمكنك مراجعة جميع التصنيفات وتعديل المجموعات الوظيفية المقترنة بها أو إضافة تصنيفات جديدة.
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
                    <th className="py-3 px-4">التصنيف الوظيفي التابع له</th>
                    <th className="py-3 px-4">الوصف</th>
                    <th className="py-3 px-4">الأنشطة المرتبطة</th>
                    <th className="py-3 px-4 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {categories.map((cat) => {
                    const group = functionalGroups.find((g) => g.id === cat.functionalGroupId);
                    const bizCount = businesses.filter(
                      (b) => b.categoryId === cat.id || b.category === cat.name
                    ).length;

                    return (
                      <tr key={cat.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-bold text-slate-900">{cat.name}</td>
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
                                  deleteCategory(cat.id);
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
                        src={b.coverUrl}
                        alt={b.name}
                        className="w-full h-full object-cover"
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
                          src={b.logoUrl || BUSINESS_PLACEHOLDER}
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

          <div className="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                    <th className="py-3.5 px-4">المشترك</th>
                    <th className="py-3.5 px-4">النشاط المخصص</th>
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
                            onClick={() => {
                              if (window.confirm(`هل أنت متأكد من حذف المشترك (${sub.fullName})؟`)) {
                                void deleteSubscriber(sub.id).catch((error) => window.alert(error instanceof Error ? error.message : 'تعذر تعطيل حساب المشترك.'));
                              }
                            }}
                            className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
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
                    التصنيف التجاري للنشاط
                  </label>
                  <select
                    value={newBizCategory}
                    onChange={(e) => {
                      setNewBizCategory(e.target.value);
                      const matched = categories.find((c) => c.name === e.target.value);
                      if (matched) setNewBizFunctionalGroup(matched.functionalGroupId);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-black text-slate-700 mb-1">
                    المجموعة الوظيفية المخصصة
                  </label>
                  <select
                    value={newBizFunctionalGroup}
                    onChange={(e) => setNewBizFunctionalGroup(e.target.value as FunctionalGroupId)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    {functionalGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

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

              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">لا يتم تسجيل رسوم أو تفعيل اشتراك من هذا النموذج. يتم حفظ النشاط كغير مدفوع وغير منشور إلى أن تؤكد الإدارة السداد الفعلي.</div>

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
                  اسم التصنيف التجاري <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="مثال: مخابز وحلويات أو عيادات أسنان"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 mb-1">
                  المجموعة الوظيفية التي ينتمي إليها <span className="text-rose-500">*</span>
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
                  سيتم تمكين الخصائص والموديلات التخصصية لهذا القطاع تلقائياً على هذا التصنيف.
                </p>
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
