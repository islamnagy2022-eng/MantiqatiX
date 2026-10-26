import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  ActivityCategory,
  AdminSettings,
  AuthSession,
  Business,
  CartItem,
  CustomerOrderData,
  FunctionalGroup,
  FunctionalGroupId,
  PaymobConfig,
  Product,
  Subscriber,
} from '../types';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_FUNCTIONAL_GROUPS,
  DEFAULT_PAYMOB_CONFIG,
  INITIAL_ADMIN_SETTINGS,
} from '../data/productionDefaults';
import {
  createBackupPayload,
  generateAdminCatalogRequestWhatsAppUrl,
  generateGmailInviteUrl,
  generateWhatsAppOrderUrl,
} from '../utils/rules';
import { bootstrapProductionUser, callCatalogAdmin, callPlatformAdmin, fetchPublicCatalog, mapBusiness, mapProducts, supabase } from '../lib/production';

export type ViewMode = 'public_storefront' | 'merchant_admin' | 'super_admin' | 'login' | 'directory';

interface AppContextType {
  currentView: ViewMode;
  setCurrentView: (view: ViewMode) => void;
  selectedBusinessId: string;
  setSelectedBusinessId: (id: string) => void;
  currentBusiness: Business | undefined;
  functionalGroups: FunctionalGroup[];
  categories: ActivityCategory[];
  addCategory: (cat: { name: string; functionalGroupId: FunctionalGroupId; description?: string }) => ActivityCategory;
  updateCategory: (cat: ActivityCategory) => void;
  deleteCategory: (id: string) => void;
  selectedFunctionalGroupFilter: string;
  setSelectedFunctionalGroupFilter: (id: string) => void;
  selectedCategoryFilter: string;
  setSelectedCategoryFilter: (id: string) => void;
  authSession: AuthSession;
  loginAsSubscriber: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginAsAdmin: (password?: string) => Promise<{ success: boolean; error?: string }>;
  loginWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  registerWithEmail: (fullName: string, email: string, password: string) => Promise<{ success: boolean; error?: string; message?: string; needsConfirmation?: boolean }>;
  authLoading: boolean;
  authBootstrapError: string;
  logout: () => void;
  isLoginModalOpen: boolean;
  setIsLoginModalOpen: (open: boolean) => void;
  businesses: Business[];
  products: Product[];
  subscribers: Subscriber[];
  adminSettings: AdminSettings;
  updateBusiness: (business: Business) => void;
  addBusiness: (business: Omit<Business, 'id' | 'createdAt'>) => Promise<string>;
  deleteBusiness: (id: string) => Promise<void>;
  getStorePublicLink: (business: Business) => string;
  updateBusinessLocation: (businessId: string, loc: { governorate: string; markaz: string; village: string; address?: string }) => void;
  confirmAdminPayment: (businessId: string) => void;
  advanceBusinessOverdueDay: (businessId: string) => void;
  toggleBusinessFreeze: (businessId: string) => void;
  updateBusinessCommissionRate: (businessId: string, rate: number) => void;
  updateBusinessPaymobConfig: (businessId: string, config: Partial<PaymobConfig>) => void;
  businessProducts: Product[];
  addProduct: (product: Omit<Product, 'id'>) => Promise<{ success: boolean; message?: string }>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addSubscriber: (sub: { fullName: string; email: string; phone: string; businessId: string; username?: string; password?: string; authMethod: 'direct_password' | 'gmail_invite'; notes?: string; }) => Promise<Subscriber>;
  updateSubscriber: (sub: Subscriber) => Promise<void>;
  deleteSubscriber: (id: string) => Promise<void>;
  sendGmailInvite: (subscriberId: string) => string;
  getSubscriberCredentialsText: (subscriberId: string) => string;
  updateAdminSettings: (settings: Partial<AdminSettings>) => void;
  addBusinessCategory: (category: string) => void;
  cartItems: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  submitOrderViaWhatsApp: (customer: CustomerOrderData) => { success: boolean; url?: string; error?: string };
  requestCatalogViaAdminWhatsApp: (business?: Business) => string;
  exportBackupJSON: () => string;
  downloadBackupFile: () => void;
  importBackupJSON: (jsonString: string) => { success: boolean; error?: string; counts?: { businesses: number; products: number; subscribers: number } };
}
const AppContext = createContext<AppContextType | null>(null);

const baseUrl = import.meta.env.BASE_URL || '/';
const publicBaseUrl = () => `${window.location.origin}${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}`;

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [adminSettings, setAdminSettings] = useState<AdminSettings>({ ...INITIAL_ADMIN_SETTINGS, adminPassword: '', platformName: 'MantiqatiX', currency: 'ج.م' });
  const [authSession, setAuthSession] = useState<AuthSession>({ role: 'guest', isAuthenticated: false });
  const [authLoading, setAuthLoading] = useState(true);
  const [authBootstrapError, setAuthBootstrapError] = useState('');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [selectedFunctionalGroupFilter, setSelectedFunctionalGroupFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedBusinessId, setSelectedBusinessIdState] = useState('');
  const [currentView, setCurrentView] = useState<ViewMode>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.has('store') || params.has('businessId') ? 'public_storefront' : 'directory';
  });
  // Prevent overlapping auth events and duplicate INITIAL_SESSION/getSession hydration.
  const authLoadSequence = useRef(0);
  const authUserIdRef = useRef<string | null | undefined>(undefined);
  const lastAuthLoadKeyRef = useRef<string | null>(null);
  const functionalGroups = adminSettings.functionalGroups || DEFAULT_FUNCTIONAL_GROUPS;
  const categories = adminSettings.categories || DEFAULT_CATEGORIES;
  const currentBusiness = (() => {
    if (authSession.role === 'subscriber' && currentView === 'merchant_admin') {
      // Never fall back to another public business if the subscriber's authorized
      // business is missing from the current production bootstrap.
      return businesses.find((b) => b.id === authSession.businessId);
    }
    const selected = businesses.find((b) => b.id === selectedBusinessId);
    if (selected) return selected;
    return authSession.role === 'admin' ? businesses[0] : undefined;
  })();
  const businessProducts = products.filter((p) => p.businessId === currentBusiness?.id);

  const applyUser = async (user: any, isCurrent: () => boolean = () => true) => {
    const boot = await bootstrapProductionUser(user || null);
    if (!isCurrent()) return;
    setAuthBootstrapError('');
    setAuthSession(boot.authSession);
    setBusinesses(boot.businesses);
    setProducts(boot.products);
    setSubscribers(boot.subscribers);
    setAdminSettings({ ...boot.adminSettings, adminPassword: '' });
    const params = new URLSearchParams(window.location.search);
    const requestedId = params.get('businessId') || params.get('store') || '';
    if (boot.authSession.role === 'guest' && requestedId) {
      const byId = boot.businesses.find((b) => b.id === requestedId || b.slug === requestedId);
      if (byId) { setSelectedBusinessIdState(byId.id); setCurrentView('public_storefront'); }
      else if (/^[0-9a-f-]{36}$/i.test(requestedId)) {
        const publicCatalog = await fetchPublicCatalog(requestedId).catch(() => null);
        if (!isCurrent()) return;
        if (publicCatalog) {
          setBusinesses([publicCatalog.business, ...boot.businesses.filter((b) => b.id !== publicCatalog.business.id)]);
          setProducts([...publicCatalog.products, ...boot.products.filter((p) => p.businessId !== publicCatalog.business.id)]);
          setSelectedBusinessIdState(publicCatalog.business.id);
          setCurrentView('public_storefront');
        } else { setSelectedBusinessIdState(''); setCurrentView('directory'); }
      } else { setSelectedBusinessIdState(''); setCurrentView('directory'); }
    } else {
      const preferred = boot.authSession.businessId || boot.businesses[0]?.id || '';
      setSelectedBusinessIdState(preferred);
      if (boot.authSession.role === 'admin') setCurrentView('super_admin');
      else if (boot.authSession.role === 'subscriber') setCurrentView('merchant_admin');
      else setCurrentView('directory');
    }
  };

  useEffect(() => {
    let active = true;
    const loadSession = async (session: any, force = false) => {
      const incomingUserId = session?.user?.id || null;
      const sessionKey = incomingUserId
        ? `${incomingUserId}:${String(session?.access_token || 'no-token')}`
        : 'signed-out';
      if (!force && lastAuthLoadKeyRef.current === sessionKey) return;
      lastAuthLoadKeyRef.current = sessionKey;

      const identityChanged = authUserIdRef.current !== incomingUserId;
      if (identityChanged) {
        authUserIdRef.current = incomingUserId;
        // Drop the previous identity's data before the next identity is hydrated.
        // A valid Google session without a business membership is still a signed-in user,
        // but it does not receive owner/admin permissions.
        setAuthSession({
          role: 'guest',
          isAuthenticated: Boolean(session?.user),
          userId: incomingUserId || undefined,
          email: session?.user?.email || undefined,
        });
        setBusinesses([]);
        setProducts([]);
        setSubscribers([]);
        setSelectedBusinessIdState('');
        setCartItems([]);
        setCurrentView('directory');
        setAuthBootstrapError('');
        setAuthLoading(true);
      } else if (force) {
        setAuthBootstrapError('');
        setAuthLoading(true);
      }

      const sequence = ++authLoadSequence.current;
      const isCurrent = () => active && sequence === authLoadSequence.current;
      try {
        if (isCurrent()) await applyUser(session?.user || null, isCurrent);
      } catch (error) {
        console.error('[MantiqatiX production bootstrap]', error);
        if (isCurrent()) {
          setAuthBootstrapError(error instanceof Error ? error.message : 'تعذر تحميل صلاحيات الحساب من قاعدة الإنتاج.');
          // Allow another auth event or a fresh page load to retry the same session.
          if (lastAuthLoadKeyRef.current === sessionKey) lastAuthLoadKeyRef.current = null;
          if (session?.user) {
            setAuthSession((previous) => previous.userId === incomingUserId
              ? { ...previous, role: previous.role === 'admin' || previous.role === 'subscriber' ? previous.role : 'guest', isAuthenticated: true, userId: incomingUserId, email: session.user.email || previous.email }
              : previous);
          }
        }
      } finally {
        if (isCurrent()) setAuthLoading(false);
      }
    };

    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) throw error;
        return loadSession(data.session);
      })
      .catch((error) => {
        if (!active) return;
        console.error('[MantiqatiX getSession]', error);
        setAuthBootstrapError(error instanceof Error ? error.message : 'تعذر قراءة جلسة Google الحالية.');
        setAuthLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === 'INITIAL_SESSION' ||
        event === 'SIGNED_IN' ||
        event === 'SIGNED_OUT' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'USER_UPDATED' ||
        event === 'PASSWORD_RECOVERY'
      ) {
        queueMicrotask(() => {
          if (active) void loadSession(session, event === 'USER_UPDATED' || event === 'PASSWORD_RECOVERY');
        });
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);

  const setSelectedBusinessId = (id: string) => { setSelectedBusinessIdState(id); setCartItems([]); };

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      // Always return OAuth to the canonical GitHub Pages app root.
      // Carrying arbitrary query/hash state into Supabase redirect allowlists can
      // cause a successful Google consent flow to return without hydrating the app.
      const basePath = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
      const redirectTo = new URL(basePath, window.location.origin).toString();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, queryParams: { prompt: 'select_account' } },
      });
      if (error) return { success: false, error: error.message || 'تعذر تسجيل الدخول بحساب Google.' };
      return { success: true };
    } catch (error: any) { return { success: false, error: error?.message || 'تعذر بدء تسجيل الدخول بحساب Google.' }; }
  };

  const registerWithEmail = async (fullName: string, identifier: string, password: string): Promise<{ success: boolean; error?: string; message?: string; needsConfirmation?: boolean }> => {
    const email = identifier.trim().toLowerCase();
    if (!fullName.trim()) return { success: false, error: 'اكتب الاسم الكامل.' };
    if (!email.includes('@')) return { success: false, error: 'اكتب بريدًا إلكترونيًا صالحًا.' };
    if (password.length < 8) return { success: false, error: 'كلمة المرور يجب ألا تقل عن 8 أحرف.' };
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName.trim(), name: fullName.trim() },
          emailRedirectTo: redirectTo,
        },
      });
      if (error) return { success: false, error: error.message || 'تعذر إنشاء الحساب.' };
      if (!data.user) return { success: false, error: 'لم يتم إنشاء الحساب. حاول مرة أخرى.' };
      if (data.session) {
        const boot = await bootstrapProductionUser(data.user);
        setAuthSession(boot.authSession);
        setBusinesses(boot.businesses);
        setProducts(boot.products);
        setSubscribers(boot.subscribers);
        setAdminSettings({ ...boot.adminSettings, adminPassword: '' });
        setSelectedBusinessIdState(boot.authSession.businessId || boot.businesses[0]?.id || '');
        setCurrentView(boot.authSession.role === 'admin' ? 'super_admin' : boot.authSession.role === 'subscriber' ? 'merchant_admin' : 'directory');
        return { success: true, message: 'تم إنشاء الحساب. تفعيل صلاحيات صاحب النشاط يحتاج اعتماد إدارة المنصة.' };
      }
      return {
        success: true,
        needsConfirmation: true,
        message: 'تم تسجيل طلب إنشاء الحساب. افتح رسالة التأكيد المرسلة إلى بريدك الإلكتروني، وبعدها يمكنك تسجيل الدخول. اشتراك النشاط يحتاج اعتماد الإدارة.',
      };
    } catch (error: any) {
      return { success: false, error: error?.message || 'تعذر إنشاء الحساب حاليًا.' };
    }
  };

  const loginAsSubscriber = async (identifier: string, password: string): Promise<{ success: boolean; error?: string }> => {
    const email = identifier.trim().toLowerCase();
    if (!email.includes('@')) return { success: false, error: 'استخدم البريد الإلكتروني الذي سلمته لك إدارة المنصة وليس اسم مستخدم تجريبيا.' };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) return { success: false, error: 'بيانات البريد الإلكتروني أو كلمة المرور غير صحيحة.' };
    try {
      const boot = await bootstrapProductionUser(data.user);
      setAuthSession(boot.authSession); setBusinesses(boot.businesses); setProducts(boot.products); setSubscribers(boot.subscribers);
      setAdminSettings({ ...boot.adminSettings, adminPassword: '' });
      setSelectedBusinessIdState(boot.authSession.businessId || boot.businesses[0]?.id || '');
      setCurrentView(boot.authSession.role === 'admin' ? 'super_admin' : boot.authSession.role === 'subscriber' ? 'merchant_admin' : 'directory');
      setIsLoginModalOpen(false);
      return { success: true };
    } catch (e: any) {
      // Do not sign out a valid user just because the production-role bootstrap failed.
      // Preserve the Supabase session so the problem can be diagnosed and retried safely.
      return { success: false, error: e?.message || 'تم تسجيل الدخول لكن تعذر تحميل صلاحيات الحساب. حاول تحديث الصفحة، ولن يتم حذف الجلسة.' };
    }
  };

  const loginAsAdmin = async (_password?: string) => loginWithGoogle();
  const logout = () => {
    void supabase.auth.signOut();
    setAuthSession({ role: 'guest', isAuthenticated: false }); setBusinesses([]); setProducts([]); setSubscribers([]);
    setSelectedBusinessIdState(''); setCurrentView('directory'); setCartItems([]);
  };

  const addCategory = (data: { name: string; functionalGroupId: FunctionalGroupId; description?: string }): ActivityCategory => {
    const newCat: ActivityCategory = { id: `cat_custom_${crypto.randomUUID()}`, name: data.name.trim(), functionalGroupId: data.functionalGroupId, description: data.description?.trim(), isCustom: true };
    setAdminSettings((prev) => ({ ...prev, categories: [...(prev.categories || DEFAULT_CATEGORIES), newCat], defaultCategories: Array.from(new Set([...(prev.defaultCategories || []), newCat.name])) }));
    return newCat;
  };
  const updateCategory = (updated: ActivityCategory) => setAdminSettings((prev) => ({ ...prev, categories: (prev.categories || DEFAULT_CATEGORIES).map((c) => c.id === updated.id ? updated : c) }));
  const deleteCategory = (id: string) => setAdminSettings((prev) => { const rest = (prev.categories || DEFAULT_CATEGORIES).filter((c) => c.id !== id); return { ...prev, categories: rest, defaultCategories: rest.map((c) => c.name) }; });

  const refreshBusinessCatalog = async (businessId: string) => {
    const business = businesses.find((b) => b.id === businessId);
    if (!business?.tenantId) return;
    const result: any = await callCatalogAdmin({ action: 'CATALOG_READ', tenantId: business.tenantId, businessId, ...(business.branchId ? { branchId: business.branchId } : {}) });
    const mapped = mapBusiness({ ...result.business, tenantId: business.tenantId, organizationId: business.organizationId, branchId: result.selectedBranchId, branches: result.branches, profile: result.business?.profile }, result.provider);
    setBusinesses((prev) => prev.map((b) => b.id === businessId ? mapped : b));
    const mappedProducts = mapProducts(businessId, business.tenantId, result.selectedBranchId, result.items || [], result.prices || []);
    setProducts((prev) => [...prev.filter((p) => p.businessId !== businessId), ...mappedProducts]);
  };

  const updateBusiness = (updated: Business) => {
    void (async () => {
      try {
        if (!updated.tenantId || !updated.branchId) throw new Error('لا يوجد نطاق إنتاجي صالح لهذا النشاط أو الفرع.');
        await callCatalogAdmin({ action: 'BUSINESS_PROFILE_UPSERT', tenantId: updated.tenantId, businessId: updated.id, branchId: updated.branchId, name: updated.name, bio: updated.bio || '', phone: updated.ownerWhatsApp || updated.phone || '', address: updated.address || '', governorate: updated.governorate || '', markaz: updated.markaz || '', village: updated.village || '', workingHours: updated.workingHours || '', logoUrl: updated.logoUrl || '', coverUrl: updated.coverUrl || '', publicEnabled: Boolean(updated.publicEnabled) });
        if (authSession.role === 'admin') await callPlatformAdmin({ action: 'BUSINESS_SETTINGS_UPDATE', businessId: updated.id, tenantId: updated.tenantId, settings: { commissionPerOrder: updated.commissionPerOrder, totalOrdersCount: updated.totalOrdersCount, paymentStatus: updated.paymentStatus, overdueDaysCount: updated.overdueDaysCount, isFrozen: updated.isFrozen, lastPaymentDate: updated.lastPaymentDate, paymentConfirmedByAdmin: updated.paymentConfirmedByAdmin, paymentDueDay: updated.paymentDueDay, paymentDueDate: updated.paymentDueDate } });
        await refreshBusinessCatalog(updated.id);
      } catch (e: any) { window.alert(e?.message || 'تعذر حفظ بيانات النشاط في قاعدة الإنتاج.'); }
    })();
  };

  const addBusiness = async (data: Omit<Business, 'id' | 'createdAt'>): Promise<string> => {
    if (authSession.role !== 'admin') throw new Error('إضافة الأنشطة متاحة لإدارة المنصة فقط.');
    const result: any = await callPlatformAdmin({ action: 'CREATE_BUSINESS', business: { name: data.name, category: data.category, bio: data.bio, phone: data.ownerWhatsApp || data.phone || '', address: data.address || '', governorate: data.governorate || '', markaz: data.markaz || '', village: data.village || '', workingHours: data.workingHours || '', logoUrl: data.logoUrl || '', coverUrl: data.coverUrl || '', slug: data.slug || '' } });
    if (!result?.business?.id) throw new Error('لم يرجع الخادم معرف النشاط المنشأ.');
    await applyUser((await supabase.auth.getUser()).data.user);
    setSelectedBusinessIdState(result.business.id);
    return result.business.id;
  };

  const updateBusinessPaymobConfig = (_businessId: string, config: Partial<PaymobConfig>) => {
    if (config.enabled) window.alert('الدفع الإلكتروني غير مفعّل في هذا الإصدار. لن يتم تحصيل أموال من خلال الكتالوج.');
  };
  const updateBusinessLocation = (businessId: string, loc: { governorate: string; markaz: string; village: string; address?: string }) => {
    const business = businesses.find((b) => b.id === businessId); if (business) updateBusiness({ ...business, governorate: loc.governorate, markaz: loc.markaz, village: loc.village, address: loc.address ?? business.address });
  };
  const updateBillingSetting = (businessId: string, settings: Record<string, unknown>) => {
    const business = businesses.find((b) => b.id === businessId);
    if (!business?.tenantId || authSession.role !== 'admin') return;
    void callPlatformAdmin({ action: 'BUSINESS_SETTINGS_UPDATE', businessId, tenantId: business.tenantId, settings }).catch((e: any) => window.alert(e?.message || 'تعذر حفظ إعدادات النشاط.'));
  };
  const confirmAdminPayment = (businessId: string) => { const today = new Date().toISOString().slice(0, 10); updateBillingSetting(businessId, { paymentConfirmedByAdmin: true, paymentStatus: 'paid', overdueDaysCount: 0, isFrozen: false, lastPaymentDate: today }); setBusinesses((prev) => prev.map((b) => b.id === businessId ? { ...b, paymentConfirmedByAdmin: true, paymentStatus: 'paid', overdueDaysCount: 0, isFrozen: false, lastPaymentDate: today } : b)); };
  const advanceBusinessOverdueDay = (businessId: string) => { const b = businesses.find((x) => x.id === businessId); if (!b) return; const days = Number(b.overdueDaysCount || 0) + 1; const frozen = days > adminSettings.overdueGracePeriodDays; const paymentStatus = frozen ? 'frozen' : 'overdue'; updateBillingSetting(businessId, { overdueDaysCount: days, paymentStatus, isFrozen: frozen }); setBusinesses((prev) => prev.map((x) => x.id === businessId ? { ...x, overdueDaysCount: days, paymentStatus, isFrozen: frozen } : x)); };
  const toggleBusinessFreeze = (businessId: string) => { const b = businesses.find((x) => x.id === businessId); if (!b) return; const frozen = !b.isFrozen; const paymentStatus = frozen ? 'frozen' : 'pending'; updateBillingSetting(businessId, { isFrozen: frozen, paymentStatus }); setBusinesses((prev) => prev.map((x) => x.id === businessId ? { ...x, isFrozen: frozen, paymentStatus } : x)); };
  const updateBusinessCommissionRate = (businessId: string, rate: number) => updateBillingSetting(businessId, { commissionPerOrder: rate });
  const deleteBusiness = async (id: string) => {
    const business = businesses.find((b) => b.id === id); if (!business?.tenantId) throw new Error('النشاط غير مرتبط بقاعدة الإنتاج.');
    if (authSession.role !== 'admin') throw new Error('تعطيل الأنشطة من اختصاص إدارة المنصة.');
    await callPlatformAdmin({ action: 'DEACTIVATE_BUSINESS', businessId: id, tenantId: business.tenantId });
    setBusinesses((prev) => prev.filter((b) => b.id !== id)); setProducts((prev) => prev.filter((p) => p.businessId !== id));
    if (selectedBusinessId === id) setSelectedBusinessIdState('');
  };

  const getStorePublicLink = (business: Business) => `${publicBaseUrl()}?store=${encodeURIComponent(business.id)}`;
  const addProduct = async (data: Omit<Product, 'id'>): Promise<{ success: boolean; message?: string }> => {
    const business = businesses.find((b) => b.id === data.businessId);
    if (!business?.tenantId || !business.branchId) return { success: false, message: 'النشاط أو الفرع غير مرتبط ببيانات الإنتاج.' };
    try {
      await callCatalogAdmin({ action: 'ITEM_PRICE_UPSERT', tenantId: business.tenantId, businessId: business.id, branchId: business.branchId, nameAr: data.name, itemType: data.type === 'service' ? 'SERVICE' : 'PRODUCT', description: data.description, unitPrice: data.price, currency: 'EGP', metadata: { catalog_public: { category: data.category, unit: data.unit || '', image_url: data.imageUrl || '', compare_price: data.comparePrice ?? null, is_available: data.isAvailable, track_stock: false } } });
      await refreshBusinessCatalog(data.businessId); return { success: true };
    } catch (e: any) { return { success: false, message: e?.message || 'تعذر حفظ المنتج في قاعدة الإنتاج.' }; }
  };
  const updateProduct = async (updated: Product) => {
    const business = businesses.find((b) => b.id === updated.businessId); if (!business?.tenantId || !business.branchId) throw new Error('النشاط أو الفرع غير مرتبط ببيانات الإنتاج.');
    await callCatalogAdmin({ action: 'ITEM_PRICE_UPSERT', tenantId: business.tenantId, businessId: business.id, branchId: business.branchId, id: updated.id, nameAr: updated.name, itemType: updated.type === 'service' ? 'SERVICE' : 'PRODUCT', description: updated.description, unitPrice: updated.price, currency: 'EGP', metadata: { catalog_public: { category: updated.category, unit: updated.unit || '', image_url: updated.imageUrl || '', compare_price: updated.comparePrice ?? null, is_available: updated.isAvailable, track_stock: false } } });
    await refreshBusinessCatalog(updated.businessId);
  };
  const deleteProduct = async (id: string) => {
    const product = products.find((p) => p.id === id); const business = product && businesses.find((b) => b.id === product.businessId);
    if (!product || !business?.tenantId || !business.branchId) throw new Error('العنصر أو نطاقه الإنتاجي غير موجود.');
    await callCatalogAdmin({ action: 'ITEM_STATUS_UPDATE', tenantId: business.tenantId, businessId: business.id, branchId: business.branchId, catalogItemId: id, status: 'INACTIVE' });
    setCartItems((prev) => prev.filter((x) => x.product.id !== id)); await refreshBusinessCatalog(product.businessId);
  };

  const addSubscriber = async (data: { fullName: string; email: string; phone: string; businessId: string; username?: string; password?: string; authMethod: 'direct_password' | 'gmail_invite'; notes?: string }): Promise<Subscriber> => {
    if (authSession.role !== 'admin') throw new Error('إضافة المشتركين متاحة لإدارة المنصة فقط.');
    const business = businesses.find((b) => b.id === data.businessId);
    if (!business?.tenantId) throw new Error('اختر نشاطا مرتبطا بقاعدة الإنتاج.');
    const email = data.email.trim().toLowerCase();
    const result: any = await callPlatformAdmin({
      action: 'CREATE_SUBSCRIBER',
      businessId: business.id,
      tenantId: business.tenantId,
      email,
      fullName: data.fullName.trim(),
      phone: data.phone || '',
    });
    const id = String(result.membershipId || result.id || result.userId);
    const created: Subscriber = {
      id,
      fullName: data.fullName.trim(),
      email,
      phone: data.phone,
      businessId: business.id,
      status: 'active',
      username: email,
      authMethod: 'gmail_invite',
      inviteStatus: 'direct_created',
      notes: data.notes,
      joinedDate: new Date().toISOString().slice(0, 10),
    };
    setSubscribers((prev) => [created, ...prev.filter((s) => s.id !== id)]);
    return created;
  };
  const updateSubscriber = async (updated: Subscriber) => {
    await callPlatformAdmin({ action: 'SUBSCRIBER_STATUS', membershipId: updated.id, status: updated.status === 'active' ? 'ACTIVE' : updated.status === 'suspended' ? 'SUSPENDED' : 'INACTIVE' });
    setSubscribers((prev) => prev.map((s) => s.id === updated.id ? { ...updated, password: undefined } : s));
  };
  const deleteSubscriber = async (id: string) => {
    await callPlatformAdmin({ action: 'SUBSCRIBER_STATUS', membershipId: id, status: 'INACTIVE' });
    setSubscribers((prev) => prev.filter((s) => s.id !== id));
  };
  const sendGmailInvite = (id: string) => {
    const sub = subscribers.find((s) => s.id === id);
    if (!sub) return '';
    const biz = businesses.find((b) => b.id === sub.businessId);
    return generateGmailInviteUrl(sub.email, sub.fullName, biz?.name || 'نشاطك التجاري', publicBaseUrl(), sub.email, undefined);
  };
  const getSubscriberCredentialsText = (id: string) => {
    const sub = subscribers.find((s) => s.id === id);
    if (!sub) return '';
    return `منطقتي X | MantiqatiX
اسم المشترك: ${sub.fullName}
النشاط: ${businesses.find((b) => b.id === sub.businessId)?.name || 'النشاط'}
البريد المرتبط بحساب Google: ${sub.email}

طريقة الدخول: اضغط "المتابعة باستخدام Google" واختر نفس حساب Google أعلاه.
تم حفظ ربط الاشتراك وصلاحيات النشاط في Supabase.`;
  };
  const updateAdminSettings = (settings: Partial<AdminSettings>) => { const safe = { ...settings }; delete (safe as any).adminPassword; setAdminSettings((prev) => ({ ...prev, ...safe, adminPassword: '' })); if (authSession.role === 'admin') void callPlatformAdmin({ action: 'SAVE_SETTINGS', settings: safe }).catch((e: any) => window.alert(e?.message || 'تعذر حفظ إعدادات المنصة.')); };
  const addBusinessCategory = (category: string) => { const name = category.trim(); if (!name || adminSettings.defaultCategories.includes(name)) return; setAdminSettings((prev) => ({ ...prev, defaultCategories: [...prev.defaultCategories, name] })); };

  const addToCart = (product: Product, quantity = 1) => {
    if (currentBusiness?.isFrozen) { window.alert('هذا النشاط موقوف مؤقتا ولا يستقبل طلبات جديدة.'); return; }
    setCartItems((prev) => { const match = prev.find((item) => item.product.id === product.id); return match ? prev.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item) : [...prev, { product, quantity }]; });
    setIsCartOpen(true);
  };
  const removeFromCart = (id: string) => setCartItems((prev) => prev.filter((item) => item.product.id !== id));
  const updateCartQuantity = (id: string, quantity: number) => { if (quantity <= 0) { removeFromCart(id); return; } setCartItems((prev) => prev.map((item) => item.product.id === id ? { ...item, quantity } : item)); };
  const clearCart = () => setCartItems([]);
  const submitOrderViaWhatsApp = (customer: CustomerOrderData): { success: boolean; url?: string; error?: string } => {
    if (!cartItems.length) return { success: false, error: 'السلة فارغة، يرجى إضافة منتجات أولا.' };
    if (!currentBusiness?.ownerWhatsApp) return { success: false, error: 'رقم واتساب صاحب النشاط غير متوفر.' };
    if (!customer.customerName.trim() || !customer.customerPhone.trim()) return { success: false, error: 'يرجى كتابة الاسم ورقم الهاتف للطلب.' };
    return { success: true, url: generateWhatsAppOrderUrl(currentBusiness.ownerWhatsApp, currentBusiness.name, cartItems, customer, adminSettings.currency || 'ج.م') };
  };
  const requestCatalogViaAdminWhatsApp = (business = currentBusiness) => business ? generateAdminCatalogRequestWhatsAppUrl(adminSettings.adminWhatsApp, business.name, business.category) : '';
  const exportBackupJSON = () => createBackupPayload(businesses, products, subscribers, adminSettings);
  const downloadBackupFile = () => { const blob = new Blob([exportBackupJSON()], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `mantiqatix-backup-${new Date().toISOString().slice(0,10)}.json`; link.click(); URL.revokeObjectURL(url); };
  const importBackupJSON = (_jsonString: string) => ({ success: false, error: 'استيراد البيانات إلى الإنتاج متوقف حتى تتم مراجعة الملف ومخطط قاعدة البيانات. لم يتم تغيير أي بيانات.' });

  return <AppContext.Provider value={{
    currentView, setCurrentView, selectedBusinessId, setSelectedBusinessId, currentBusiness,
    functionalGroups, categories, addCategory, updateCategory, deleteCategory, selectedFunctionalGroupFilter, setSelectedFunctionalGroupFilter, selectedCategoryFilter, setSelectedCategoryFilter,
    authSession, authLoading, loginWithGoogle, registerWithEmail, loginAsSubscriber, loginAsAdmin, logout, isLoginModalOpen, setIsLoginModalOpen,
    businesses, products, subscribers, adminSettings, updateBusiness, addBusiness, deleteBusiness, getStorePublicLink, updateBusinessLocation,
    confirmAdminPayment, advanceBusinessOverdueDay, toggleBusinessFreeze, updateBusinessCommissionRate, updateBusinessPaymobConfig,
    businessProducts, addProduct, updateProduct, deleteProduct, addSubscriber, updateSubscriber, deleteSubscriber, sendGmailInvite, getSubscriberCredentialsText, updateAdminSettings, addBusinessCategory,
    cartItems, addToCart, removeFromCart, updateCartQuantity, clearCart, isCartOpen, setIsCartOpen, submitOrderViaWhatsApp, requestCatalogViaAdminWhatsApp,
    exportBackupJSON, downloadBackupFile, importBackupJSON,
    authBootstrapError,
  }}> {children} </AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
