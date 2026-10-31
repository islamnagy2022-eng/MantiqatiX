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
  Product,
  Subscriber,
} from '../types';
import {
  DEFAULT_CATEGORIES,
  DEFAULT_FUNCTIONAL_GROUPS,
  INITIAL_ADMIN_SETTINGS,
  normalizeCanonicalTaxonomySettings,
} from '../data/productionDefaults';
import {
  createBackupPayload,
  generateAdminCatalogRequestWhatsAppUrl,
  generateGmailInviteUrl,
  generateStorePublicUrl,
  getCurrentAppBasePath,
  generateWhatsAppOrderUrl,
} from '../utils/rules';
import { bootstrapProductionUser, callCatalogAdmin, callPlatformAdmin, fetchPlatformSubscribers, fetchPublicCatalog, fetchPublicDirectory, generateCatalogAiImage, mapBusiness, mapProducts, supabase } from '../lib/production';
import { resolveDefaultImage } from '../utils/defaultImages';
import { canAccessMerchantDashboard, canAccessProfessionalDashboard } from '../utils/dashboardAccess';

export type ViewMode = 'public_storefront' | 'merchant_admin' | 'super_admin' | 'professional_dashboard' | 'account_portal' | 'login' | 'directory';

interface AppContextType {
  currentView: ViewMode;
  setCurrentView: (view: ViewMode) => void;
  selectedBusinessId: string;
  setSelectedBusinessId: (id: string) => void;
  currentBusiness: Business | undefined;
  functionalGroups: FunctionalGroup[];
  categories: ActivityCategory[];
  addCategory: (cat: { name: string; functionalGroupId: FunctionalGroupId; description?: string; classificationType?: 'activity' | 'profession'; specialties?: string[] }) => Promise<ActivityCategory>;
  updateCategory: (cat: ActivityCategory) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  selectedFunctionalGroupFilter: string;
  setSelectedFunctionalGroupFilter: (id: string) => void;
  selectedCategoryFilter: string;
  setSelectedCategoryFilter: (id: string) => void;
  authSession: AuthSession;
  switchAccountMembership: (membershipId: string, businessId: string) => Promise<boolean>;
  switchToPlatformAdminMode: () => boolean;
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
  directoryBusinesses: Business[];
  directoryLoading: boolean;
  products: Product[];
  subscribers: Subscriber[];
  subscribersLoading: boolean;
  refreshPlatformSubscribers: () => Promise<void>;
  adminSettings: AdminSettings;
  updateBusiness: (business: Business) => Promise<void>;
  addBusiness: (business: Omit<Business, 'id' | 'createdAt'>) => Promise<string>;
  deleteBusiness: (id: string) => Promise<void>;
  getStorePublicLink: (business: Business) => string;
  updateBusinessLocation: (businessId: string, loc: { governorate: string; markaz: string; village: string; address?: string }) => Promise<void>;
  confirmAdminPayment: (businessId: string) => Promise<void>;
  updateBillingSetting: (businessId: string, settings: Record<string, unknown>) => Promise<void>;
  toggleBusinessFreeze: (businessId: string) => Promise<void>;
  businessProducts: Product[];
  addProduct: (product: Omit<Product, 'id'> & { deferAiImageGeneration?: boolean }) => Promise<{ success: boolean; message?: string }>;
  updateProduct: (product: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addSubscriber: (sub: { fullName: string; email: string; phone: string; businessId: string; username?: string; password?: string; authMethod: 'direct_password' | 'gmail_invite'; notes?: string; }) => Promise<Subscriber>;
  saveSubscriberMembership: (input: { subscriber: Subscriber; tenantId: string; businessId?: string; branchId?: string; role: string; status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'; catalogEnabled: boolean; catalogWrite: boolean; accountRestricted: boolean; }) => Promise<Subscriber>;
  updateSubscriber: (sub: Subscriber) => Promise<void>;
  deleteSubscriber: (id: string) => Promise<void>;
  sendGmailInvite: (subscriberId: string) => string;
  getSubscriberCredentialsText: (subscriberId: string) => string;
  updateAdminSettings: (settings: Partial<AdminSettings>) => Promise<void>;
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
  const [directoryBusinesses, setDirectoryBusinesses] = useState<Business[]>([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [subscribersLoading, setSubscribersLoading] = useState(false);
  const [adminSettings, setAdminSettings] = useState<AdminSettings>({ ...INITIAL_ADMIN_SETTINGS, adminPassword: '', platformName: 'MantiqatiX', currency: 'ج.م' });
  const [authSession, setAuthSession] = useState<AuthSession>({ role: 'guest', isAuthenticated: false });
  const [authLoading, setAuthLoading] = useState(true);
  const [authBootstrapError, setAuthBootstrapError] = useState('');
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [selectedFunctionalGroupFilter, setSelectedFunctionalGroupFilter] = useState('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const addBusinessInFlightRef = useRef<Map<string, Promise<string>>>(new Map());
  const initialRouteParams = new URLSearchParams(window.location.search);
  const [selectedBusinessId, setSelectedBusinessIdState] = useState(initialRouteParams.get('manage') || '');
  const routeBusinessIdRef = useRef(initialRouteParams.get('store') || initialRouteParams.get('businessId') || initialRouteParams.get('manage') || '');
  const [currentView, setCurrentViewState] = useState<ViewMode>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('store') || params.has('businessId')) return 'public_storefront';
    const requestedView = params.get('view');
    return requestedView === 'super_admin' || requestedView === 'merchant_admin' || requestedView === 'professional_dashboard' || requestedView === 'account_portal' || requestedView === 'directory'
      ? requestedView
      : 'directory';
  });

  // Keep the SPA's visible view in the URL so refreshes and copied links reopen
  // the same screen. Public storefronts use the existing stable ?store=<businessId> link.
  const updateBrowserRoute = (view: ViewMode, businessId = routeBusinessIdRef.current) => {
    const url = new URL(window.location.href);
    url.searchParams.delete('store');
    url.searchParams.delete('businessId');
    url.searchParams.delete('manage');
    if (view !== 'merchant_admin') url.searchParams.delete('merchantTab');
    if (view !== 'super_admin') url.searchParams.delete('controlTab');
    if (view === 'public_storefront') {
      url.searchParams.delete('view');
      url.searchParams.delete('tab');
      if (businessId) url.searchParams.set('store', businessId);
    } else {
      url.searchParams.delete('view');
      if (view !== 'super_admin') url.searchParams.delete('tab');
      if (view !== 'directory' && view !== 'login') url.searchParams.set('view', view);
      if ((view === 'super_admin' || view === 'merchant_admin') && businessId) {
        url.searchParams.set('manage', businessId);
      }
    }
    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) window.history.pushState({ mantiqatixView: view }, '', nextUrl);
  };

  const loadPublicCatalogForRoute = (businessId: string) => {
    // Public directory data is intentionally separate from authenticated workspace data.
    // Fetch only the selected public business on demand so signed-out visitors can open
    // a shared catalogue without duplicating the full public-directory bootstrap.
    if (!businessId || !/^[0-9a-f-]{36}$/i.test(businessId)) return;
    if (businesses.some((business) => business.id === businessId)) return;
    void fetchPublicCatalog(businessId).then((catalog) => {
      if (!catalog || routeBusinessIdRef.current !== businessId) return;
      setBusinesses((previous) => [
        catalog.business,
        ...previous.filter((business) => business.id !== catalog.business.id),
      ]);
      setProducts((previous) => [
        ...previous.filter((product) => product.businessId !== catalog.business.id),
        ...catalog.products,
      ]);
    }).catch((error) => {
      console.warn('[MantiqaTix public catalogue]', error);
    });
  };

  const setCurrentView = (view: ViewMode) => {
    setCurrentViewState(view);
    updateBrowserRoute(view);
  };

  // Direct shared catalogue links and in-app selection use the same single-item loader.
  // The full public directory remains a separate, single request owned by AppContext.
  useEffect(() => {
    if (currentView !== 'public_storefront') return;
    loadPublicCatalogForRoute(routeBusinessIdRef.current || selectedBusinessId);
  }, [currentView, selectedBusinessId, businesses]);

  const commitSelectedBusinessId = (id: string) => {
    routeBusinessIdRef.current = id;
    setSelectedBusinessIdState(id);
  };

  // Switch only to an exact active membership returned by authenticated bootstrap.
  // Reload the catalog with that membership's branch scope before exposing its workspace.
  // This prevents a tenant-wide owner dataset from leaking into a weaker employee view.
  const switchAccountMembership = async (membershipId: string, businessId: string): Promise<boolean> => {
    const userId = authSession.userId;
    if (!authSession.isAuthenticated || !userId || !membershipId || !businessId || authUserIdRef.current !== userId) return false;
    const mode = authSession.availableMemberships?.find((candidate) =>
      candidate.membershipId === membershipId && candidate.businessId === businessId
    );
    if (!mode) return false;
    const existingBusiness = businesses.find((candidate) =>
      candidate.id === mode.businessId && String(candidate.tenantId || '') === mode.tenantId
    );
    if (!existingBusiness) return false;

    const catalog: any = await callCatalogAdmin({
      action: 'CATALOG_READ',
      tenantId: mode.tenantId,
      businessId: mode.businessId,
      membershipId: mode.membershipId,
      ...(mode.branchId ? { branchId: mode.branchId } : {}),
    });
    if (authUserIdRef.current !== userId || authSession.userId !== userId) return false;
    if (!catalog?.business) throw new Error('تعذر تحميل بيانات النشاط بالنطاق المحدد؛ لم يتم تغيير وضع الحساب.');

    const mappedBusiness = mapBusiness({
      ...existingBusiness,
      ...catalog.business,
      id: mode.businessId,
      tenantId: mode.tenantId,
      organizationId: existingBusiness.organizationId || catalog.business?.organizationId,
      branchId: catalog.selectedBranchId || mode.branchId || '',
      branches: Array.isArray(catalog.branches) ? catalog.branches : [],
    }, catalog.provider);
    const mappedProducts = mapProducts(
      mode.businessId,
      mode.tenantId,
      catalog.selectedBranchId || mode.branchId || '',
      catalog.items || [],
      catalog.prices || [],
    );

    setAuthSession((previous) => {
      if (previous.userId !== userId || !previous.isAuthenticated) return previous;
      const authorizedMode = previous.availableMemberships?.find((candidate) =>
        candidate.membershipId === membershipId &&
        candidate.businessId === mode.businessId &&
        candidate.tenantId === mode.tenantId &&
        String(candidate.role).toUpperCase() === String(mode.role).toUpperCase() &&
        String(candidate.branchId || '') === String(mode.branchId || '')
      );
      if (!authorizedMode) return previous;
      return {
        ...previous,
        role: 'subscriber',
        businessId: authorizedMode.businessId,
        subscriberId: authorizedMode.membershipId,
        membershipRole: authorizedMode.role,
        membershipBranchId: authorizedMode.branchId,
        membershipPermissions: authorizedMode.permissions,
        activeMembershipId: authorizedMode.membershipId,
      };
    });

    setBusinesses((previous) => {
      if (authUserIdRef.current !== userId) return previous;
      return previous.map((business) =>
        business.id === mappedBusiness.id ? mappedBusiness : business
      );
    });
    setProducts((previous) => {
      if (authUserIdRef.current !== userId) return previous;
      return [
        ...previous.filter((product) => product.businessId !== mode.businessId),
        ...mappedProducts,
      ];
    });
    if (authUserIdRef.current !== userId) return false;
    commitSelectedBusinessId(mode.businessId);
    setCartItems([]);
    setIsCartOpen(false);
    return true;
  };

  const switchToPlatformAdminMode = (): boolean => {
    const userId = authSession.userId;
    if (!authSession.isAuthenticated || !authSession.isPlatformAdmin || !userId || authUserIdRef.current !== userId) return false;
    setAuthSession((previous) => {
      if (previous.userId !== userId || !previous.isAuthenticated || !previous.isPlatformAdmin) return previous;
      return {
        ...previous,
        role: 'admin',
        businessId: undefined,
        subscriberId: undefined,
        membershipRole: undefined,
        membershipBranchId: undefined,
        membershipPermissions: undefined,
        activeMembershipId: undefined,
      };
    });
    setCartItems([]);
    setIsCartOpen(false);
    return true;
  };

  // Prevent overlapping auth events and duplicate INITIAL_SESSION/getSession hydration.
  const authLoadSequence = useRef(0);
  const authUserIdRef = useRef<string | null | undefined>(undefined);
  const lastAuthLoadKeyRef = useRef<string | null>(null);

  // Manual retry is admin-only and bound to the exact authenticated identity and
  // auth-load sequence. A late response must never repopulate a newer session.
  const refreshPlatformSubscribers = async (): Promise<void> => {
    const userId = authSession.userId;
    if (
      authSession.role !== 'admin' ||
      !userId ||
      authUserIdRef.current !== userId ||
      subscribersLoading
    ) return;

    const sequence = authLoadSequence.current;
    setSubscribersLoading(true);
    try {
      const result = await fetchPlatformSubscribers();
      if (sequence !== authLoadSequence.current || authUserIdRef.current !== userId) return;
      if (!result.error) setSubscribers(result.subscribers);
      setAuthSession((previous) => previous.userId === userId && previous.role === 'admin'
        ? {
            ...previous,
            subscriberDirectoryError: result.error,
            ignoredOrphanMemberships: result.ignoredOrphanMemberships,
          }
        : previous);
    } finally {
      if (sequence === authLoadSequence.current && authUserIdRef.current === userId) {
        setSubscribersLoading(false);
      }
    }
  };

  const functionalGroups = adminSettings.functionalGroups || DEFAULT_FUNCTIONAL_GROUPS;
  const categories = adminSettings.categories || DEFAULT_CATEGORIES;
  const currentBusiness = (() => {
    if (authSession.role === 'subscriber' && (currentView === 'account_portal' || currentView === 'merchant_admin' || currentView === 'professional_dashboard')) {
      // Never fall back to another public business if the subscriber's authorized
      // business is missing from the current production bootstrap.
      return businesses.find((b) => b.id === authSession.businessId);
    }
    const selected = businesses.find((b) => b.id === selectedBusinessId);
    if (selected) return selected;
    return authSession.role === 'admin' ? businesses[0] : undefined;
  })();
  const businessProducts = products.filter((p) => p.businessId === currentBusiness?.id && currentBusiness?.operationalStatus === 'ACTIVE' && !currentBusiness?.isFrozen);

  const applyUser = async (user: any, isCurrent: () => boolean = () => true) => {
    const boot = await bootstrapProductionUser(user || null);
    if (!isCurrent()) return;
    setAuthBootstrapError('');
    setAuthSession(boot.authSession);
    setBusinesses(boot.businesses);
    setProducts(boot.products);
    setSubscribers(boot.subscribers);
    setSubscribersLoading(boot.authSession.role === 'admin');
    setAdminSettings({ ...boot.adminSettings, adminPassword: '' });

    // The complete platform subscriber directory can be large. It is not needed
    // to establish the Google session or authorize the user, so fetch it after
    // the main workspace is ready and keep failures separate from auth bootstrap.
    if (boot.authSession.role === 'admin') {
      void fetchPlatformSubscribers().then((result) => {
        if (!isCurrent()) return;
        if (!result.error) setSubscribers(result.subscribers);
        setAuthSession((previous) => previous.userId === boot.authSession.userId
          ? {
              ...previous,
              subscriberDirectoryError: result.error,
              ignoredOrphanMemberships: result.ignoredOrphanMemberships,
            }
          : previous);
      }).finally(() => {
        if (isCurrent()) setSubscribersLoading(false);
      });
    }

    const params = new URLSearchParams(window.location.search);
    const requestedId = params.get('store') || params.get('businessId') || '';
    const requestedView = params.get('view');
    // A newly signed-in account always lands on the public home directory.
    // Explicit, role-authorized dashboard routes are still restorable on refresh.
    const defaultView: ViewMode = 'directory';

    // A share URL must continue to open its public catalog for signed-in and guest
    // users alike, but it must never bypass the public-catalog API's publication gate.
    if (requestedId) {
      const byId = boot.businesses.find((b) =>
        (b.id === requestedId || b.slug === requestedId) &&
        (b.publicEnabled || b.isOfficialShowcase) &&
        !b.isFrozen
      );
      if (byId) {
        commitSelectedBusinessId(byId.id);
        setCurrentView('public_storefront');
        return;
      }
      if (/^[0-9a-f-]{36}$/i.test(requestedId)) {
        const publicCatalog = await fetchPublicCatalog(requestedId).catch(() => null);
        if (!isCurrent()) return;
        if (publicCatalog) {
          setBusinesses((prev) => [publicCatalog.business, ...prev.filter((b) => b.id !== publicCatalog.business.id)]);
          setProducts((prev) => [...prev.filter((p) => p.businessId !== publicCatalog.business.id), ...publicCatalog.products]);
          commitSelectedBusinessId(publicCatalog.business.id);
          setCurrentView('public_storefront');
          return;
        }
      }
      commitSelectedBusinessId('');
      setCurrentView(defaultView);
      return;
    }

    const safeRequestedView: ViewMode = requestedView === 'directory'
      ? 'directory'
      : requestedView === 'account_portal' && boot.authSession.isAuthenticated
        ? 'account_portal'
        : requestedView === 'super_admin' && boot.authSession.role === 'admin'
        ? 'super_admin'
        : requestedView === 'merchant_admin' && canAccessMerchantDashboard(boot.authSession)
          ? 'merchant_admin'
          : requestedView === 'professional_dashboard' && canAccessProfessionalDashboard(boot.authSession)
            ? 'professional_dashboard'
            : 'directory';

    const requestedManagedId = params.get('manage') || '';
    const requestedManagedBusiness = boot.businesses.find((business) => business.id === requestedManagedId);
    const preferred = boot.authSession.role === 'admin' && requestedManagedBusiness
      ? requestedManagedId
      : boot.authSession.businessId || boot.businesses[0]?.id || '';
    commitSelectedBusinessId(preferred);
    setCurrentView(safeRequestedView);
  };

  // Load the public directory independently from authentication so visitors see published activities immediately.
  useEffect(() => {
    let active = true;
    fetchPublicDirectory()
      .then((directory) => { if (active) setDirectoryBusinesses(directory.businesses); })
      .catch((error) => { console.warn('[MantiqatiX public directory]', error); })
      .finally(() => { if (active) setDirectoryLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const loadSession = async (session: any, force = false) => {
      const incomingUserId = session?.user?.id || null;
      // A token refresh does not change the signed-in identity or its memberships.
      // Key the bootstrap by user ID so rotating access tokens cannot reload every
      // business catalog and subscription in the background.
      const sessionKey = incomingUserId || 'signed-out';
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
        setSubscribersLoading(false);
        setSelectedBusinessIdState('');
        setCartItems([]);
        // Hide any privileged view while the new identity is loading without
        // rewriting the URL; applyUser must inspect the original requested route
        // after the role has been resolved and authorize or reject it.
        setCurrentViewState('directory');
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

  const setSelectedBusinessId = (id: string) => {
    commitSelectedBusinessId(id);
    setCartItems([]);
    if (currentView === 'public_storefront') updateBrowserRoute('public_storefront', id);
    else if (currentView === 'merchant_admin' || currentView === 'super_admin') updateBrowserRoute(currentView, id);
  };

  // Restore the in-app view when the user navigates with browser back/forward.
  useEffect(() => {
    const restoreRouteFromLocation = () => {
      const params = new URLSearchParams(window.location.search);
      const requestedId = params.get('store') || params.get('businessId') || '';
      if (requestedId) {
        routeBusinessIdRef.current = requestedId;
        setSelectedBusinessIdState(requestedId);
        setCurrentViewState('public_storefront');
        const known = businesses.some((business) => business.id === requestedId || business.slug === requestedId);
        if (!known && /^[0-9a-f-]{36}$/i.test(requestedId)) {
          void fetchPublicCatalog(requestedId).then((catalog) => {
            if (!catalog) return;
            routeBusinessIdRef.current = catalog.business.id;
            setBusinesses((prev) => [catalog.business, ...prev.filter((business) => business.id !== catalog.business.id)]);
            setProducts((prev) => [...prev.filter((product) => product.businessId !== catalog.business.id), ...catalog.products]);
            setSelectedBusinessIdState(catalog.business.id);
          }).catch(() => undefined);
        }
        return;
      }
      const requestedView = params.get('view');
      const requestedManagedId = requestedView === 'super_admin' || requestedView === 'merchant_admin'
        ? params.get('manage') || ''
        : '';
      routeBusinessIdRef.current = requestedManagedId;
      setSelectedBusinessIdState(requestedManagedId);
      setCurrentViewState(
        requestedView === 'account_portal' && authSession.isAuthenticated
          ? 'account_portal'
          : requestedView === 'super_admin' && authSession.role === 'admin'
            ? 'super_admin'
            : requestedView === 'merchant_admin' && canAccessMerchantDashboard(authSession)
              ? 'merchant_admin'
              : requestedView === 'professional_dashboard' && canAccessProfessionalDashboard(authSession)
                ? 'professional_dashboard'
                : 'directory'
      );
    };
    window.addEventListener('popstate', restoreRouteFromLocation);
    return () => window.removeEventListener('popstate', restoreRouteFromLocation);
  }, [businesses]);

  const loginWithGoogle = async (): Promise<{ success: boolean; error?: string }> => {
    try {
      // Always return OAuth to the canonical GitHub Pages app root.
      // Carrying arbitrary query/hash state into Supabase redirect allowlists can
      // cause a successful Google consent flow to return without hydrating the app.
      // Supabase currently allowlists the platform root. The root shell relays
      // only OAuth callback parameters to /catalog-app/ before loading its own app.
      const redirectTo = new URL('/MantiqatiX/', window.location.origin).toString();
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
        setCurrentView('directory');
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
    // Invalidate in-flight bootstrap and subscriber-directory requests immediately;
    // do not wait for the asynchronous SIGNED_OUT event to protect local state.
    authLoadSequence.current += 1;
    lastAuthLoadKeyRef.current = null;
    authUserIdRef.current = null;
    setSubscribersLoading(false);
    void supabase.auth.signOut();
    setAuthSession({ role: 'guest', isAuthenticated: false }); setBusinesses([]); setProducts([]); setSubscribers([]);
    setSelectedBusinessIdState(''); setCurrentView('directory'); setCartItems([]);
  };

  const addCategory = async (data: { name: string; functionalGroupId: FunctionalGroupId; description?: string; classificationType?: 'activity' | 'profession'; specialties?: string[] }): Promise<ActivityCategory> => {
    const name = data.name.trim();
    if (name.length < 2 || name.length > 120) throw new Error('اسم النشاط أو المهنة يجب أن يكون من حرفين إلى 120 حرفًا.');
    const normalized = normalizeCanonicalTaxonomySettings(adminSettings);
    if (data.classificationType === 'profession') {
      throw new Error('لا تُنشأ المهن كتصنيفات مستقلة؛ أضف المهنة كتخصص داخل النشاط المناسب.');
    }
    const classificationType = 'activity';
    const groupCategories = normalized.categories.filter((category) => category.functionalGroupId === data.functionalGroupId);
    if (groupCategories.length >= 5) {
      throw new Error('وصلت هذه المجموعة إلى الحد الأقصى: 5 أنشطة. أضف التخصص المناسب داخل أحد الأنشطة الحالية بدلاً من إنشاء تصنيف جديد.');
    }
    const duplicate = normalized.categories.some((category) =>
      category.classificationType === 'activity' &&
      category.name.trim().toLocaleLowerCase('ar') === name.toLocaleLowerCase('ar'));
    if (duplicate) throw new Error('هذا النشاط موجود بالفعل ضمن التصنيف المختار.');
    const newCat: ActivityCategory = {
      id: `cat_custom_${crypto.randomUUID()}`,
      name,
      functionalGroupId: data.functionalGroupId,
      description: data.description?.trim(),
      classificationType,
      specialties: (data.specialties || []).map((item) => String(item).trim()).filter(Boolean).slice(0, 100),
      isCustom: true,
    };
    const categories = [...normalized.categories, newCat];
    const saved = normalizeCanonicalTaxonomySettings({ ...adminSettings, categories, defaultCategories: categories.map((category) => category.name) });
    await updateAdminSettings({ functionalGroups: saved.functionalGroups, categories: saved.categories, defaultCategories: saved.defaultCategories });
    return newCat;
  };
  const updateCategory = async (updated: ActivityCategory): Promise<void> => {
    const normalized = normalizeCanonicalTaxonomySettings(adminSettings);
    const categories = normalized.categories.map((category) => category.id === updated.id
      ? { ...updated, name: updated.name.trim(), specialties: (updated.specialties || []).map((item) => String(item).trim()).filter(Boolean).slice(0, 100) }
      : category);
    const saved = normalizeCanonicalTaxonomySettings({ ...adminSettings, categories, defaultCategories: categories.map((category) => category.name) });
    await updateAdminSettings({ functionalGroups: saved.functionalGroups, categories: saved.categories, defaultCategories: saved.defaultCategories });
  };
  const deleteCategory = async (id: string): Promise<void> => {
    const normalized = normalizeCanonicalTaxonomySettings(adminSettings);
    const existing = normalized.categories.find((category) => category.id === id);
    if (!existing) return;
    if (!existing.isCustom) throw new Error('لا يمكن حذف التصنيفات الأساسية من الدليل المعتمد.');
    const categories = normalized.categories.filter((category) => category.id !== id);
    const saved = normalizeCanonicalTaxonomySettings({ ...adminSettings, categories, defaultCategories: categories.map((category) => category.name) });
    await updateAdminSettings({ functionalGroups: saved.functionalGroups, categories: saved.categories, defaultCategories: saved.defaultCategories });
  };

  const refreshBusinessCatalog = async (businessId: string) => {
    const business = businesses.find((b) => b.id === businessId);
    if (!business?.tenantId) return;
    const result: any = await callCatalogAdmin({ action: 'CATALOG_READ', tenantId: business.tenantId, businessId, ...(business.branchId ? { branchId: business.branchId } : {}) });
    const mapped = mapBusiness({ ...result.business, tenantId: business.tenantId, organizationId: business.organizationId, branchId: result.selectedBranchId, branches: result.branches, profile: result.business?.profile }, result.provider);
    setBusinesses((prev) => prev.map((b) => b.id === businessId ? mapped : b));
    const mappedProducts = mapProducts(businessId, business.tenantId, result.selectedBranchId, result.items || [], result.prices || []);
    setProducts((prev) => [...prev.filter((p) => p.businessId !== businessId), ...mappedProducts]);
  };

  const updateBusiness = async (updated: Business): Promise<void> => {
    if (!updated.tenantId || !updated.branchId) {
      throw new Error('لا يوجد نطاق إنتاجي صالح لهذا النشاط أو الفرع.');
    }

    const defaultCover = !updated.coverUrl?.trim() ||
      /(?:business-placeholder\.svg|catalog-item-placeholder\.svg|\/legacy\/activity\/|\/legacy\/mnty-cover-ad-)/i.test(updated.coverUrl);
    let coverUrl = updated.coverUrl?.trim() || '';
    if (defaultCover) {
      const generated = await generateCatalogAiImage({
        businessId: updated.id,
        branchId: updated.branchId,
        kind: 'cover',
        name: updated.name,
        category: updated.category,
        description: updated.bio,
      });
      coverUrl = generated || resolveDefaultImage({
        name: updated.name, description: updated.bio, category: updated.category, kind: 'cover',
      });
    }

    const logoUrl = updated.logoUrl?.trim() || resolveDefaultImage({
      name: updated.name, description: updated.bio, category: updated.category, kind: 'activity',
    });

    await callCatalogAdmin({
      action: 'BUSINESS_PROFILE_UPSERT',
      tenantId: updated.tenantId,
      businessId: updated.id,
      branchId: updated.branchId,
      name: updated.name,
      bio: updated.bio || '',
      phone: updated.ownerWhatsApp || updated.phone || '',
      additionalContactPhones: updated.additionalContactPhones || [],
      facebookUrl: updated.facebookUrl || '',
      instagramUrl: updated.instagramUrl || '',
      tiktokUrl: updated.tiktokUrl || '',
      address: updated.address || '',
      governorate: updated.governorate || '',
      markaz: updated.markaz || '',
      village: updated.village || '',
      workingHours: updated.workingHours || '',
      logoUrl,
      coverUrl,
      publicEnabled: Boolean(updated.publicEnabled),
    });
    // Profile edits must not rewrite billing metadata from a potentially stale client snapshot.
    // Billing updates use dedicated admin actions and remain independent from contact/branding edits.
    await refreshBusinessCatalog(updated.id);
  };

  const addBusiness = async (data: Omit<Business, 'id' | 'createdAt'>): Promise<string> => {
    if (authSession.role !== 'admin') throw new Error('إضافة الأنشطة متاحة لإدارة المنصة فقط.');
    // Use exactly the payload sent to the server as the in-flight identity. Rapid
    // repeated submissions of the same form share one Promise; different payloads
    // remain independent and are never merged by name/phone heuristics here.
    const createBusinessPayload = {
      name: data.name, category: data.category, activityGroupCode: data.functionalGroupId,
      activityClassificationType: data.categoryClassificationType || 'activity',
      activitySpecialty: data.activitySpecialty || '', bio: data.bio,
      phone: data.ownerWhatsApp || data.phone || '', address: data.address || '',
      governorate: data.governorate || '', markaz: data.markaz || '', village: data.village || '',
      workingHours: data.workingHours || '', logoUrl: data.logoUrl || '', coverUrl: data.coverUrl || '',
      slug: data.slug || '', publishNow: Boolean(data.publicEnabled),
      subscriptionMode: data.subscriptionMode || 'PAID', subscriptionAmount: data.subscriptionAmount ?? 0,
      paymentDueDate: data.paymentDueDate, paymentGracePeriodDays: data.paymentGracePeriodDays ?? 7,
    };
    const requestKey = JSON.stringify(createBusinessPayload);
    const inFlightRequest = addBusinessInFlightRef.current.get(requestKey);
    if (inFlightRequest) return inFlightRequest;

    const request = (async (): Promise<string> => {
      const result: any = await callPlatformAdmin({ action: 'CREATE_BUSINESS', business: createBusinessPayload });
      if (!result?.business?.id) throw new Error('لم يرجع الخادم معرف النشاط المنشأ.');
      const createdBusiness = result.business as { id: string; tenantId: string; branchId: string };
      const needsLogo = !data.logoUrl?.trim();
      const needsCover = !data.coverUrl?.trim();
      if (needsLogo || needsCover) {
        const [generatedLogo, generatedCover] = await Promise.all([
          needsLogo ? generateCatalogAiImage({
            businessId: createdBusiness.id,
            branchId: createdBusiness.branchId,
            kind: 'activity',
            name: data.name,
            category: data.category,
            description: data.bio || '',
          }) : Promise.resolve(null),
          needsCover ? generateCatalogAiImage({
            businessId: createdBusiness.id,
            branchId: createdBusiness.branchId,
            kind: 'cover',
            name: data.name,
            category: data.category,
            description: data.bio || '',
          }) : Promise.resolve(null),
        ]);
        if (generatedLogo || generatedCover) {
          const profileImageSettings: Record<string, string> = {};
          if (needsLogo) {
            if (generatedLogo) profileImageSettings.logo_url = generatedLogo;
            profileImageSettings.logo_image_source = generatedLogo ? 'ai' : 'auto';
          }
          if (needsCover) {
            if (generatedCover) profileImageSettings.cover_url = generatedCover;
            profileImageSettings.cover_image_source = generatedCover ? 'ai' : 'auto';
          }
          try {
            await callPlatformAdmin({
              action: 'BUSINESS_MANAGE',
              tenantId: createdBusiness.tenantId,
              businessId: createdBusiness.id,
              operation: 'UPDATE',
              name: data.name,
              settings: { catalog_profile: profileImageSettings },
            });
          } catch (imageSaveError) {
            // Creation remains successful; missing imagery falls back to the category artwork.
            console.warn('The new activity was created, but its AI images could not be linked to the profile.', imageSaveError);
          }
        }
      }
      await applyUser((await supabase.auth.getUser()).data.user);
      setSelectedBusinessIdState(result.business.id);
      return result.business.id;
    })();

    addBusinessInFlightRef.current.set(requestKey, request);
    try {
      return await request;
    } finally {
      if (addBusinessInFlightRef.current.get(requestKey) === request) {
        addBusinessInFlightRef.current.delete(requestKey);
      }
    }
  };

  const updateBusinessLocation = async (businessId: string, loc: { governorate: string; markaz: string; village: string; address?: string }): Promise<void> => {
    const business = businesses.find((b) => b.id === businessId);
    if (!business) throw new Error('النشاط المطلوب غير موجود في بيانات الإنتاج الحالية.');
    await updateBusiness({ ...business, governorate: loc.governorate, markaz: loc.markaz, village: loc.village, address: loc.address ?? business.address });
  };
  const updateBillingSetting = async (businessId: string, settings: Record<string, unknown>): Promise<void> => {
    const business = businesses.find((item) => item.id === businessId);
    if (!business?.tenantId) throw new Error('النشاط غير مرتبط ببيانات الإنتاج.');
    if (authSession.role !== 'admin') throw new Error('تعديل حالة السداد متاح لمالك المنصة فقط.');
    await callPlatformAdmin({ action: 'BUSINESS_SETTINGS_UPDATE', businessId, tenantId: business.tenantId, settings });
    setBusinesses((prev) => prev.map((item) => item.id === businessId ? { ...item, ...settings } as Business : item));
  };
  const confirmAdminPayment = async (businessId: string): Promise<void> => {
    const business = businesses.find((item) => item.id === businessId);
    if (!business?.tenantId || authSession.role !== 'admin') throw new Error('تأكيد السداد متاح لمالك المنصة بعد التحقق من الحساب.');
    const today = new Date().toISOString().slice(0, 10);
    await updateBillingSetting(businessId, {
      paymentConfirmedByAdmin: true, paymentStatus: 'paid', overdueDaysCount: 0,
      isFrozen: false, lastPaymentDate: today,
    });
    setBusinesses((prev) => prev.map((item) => item.id === businessId
      ? { ...item, paymentConfirmedByAdmin: true, paymentStatus: 'paid', overdueDaysCount: 0, isFrozen: false, lastPaymentDate: today }
      : item));
    const pending = subscribers.filter((subscriber) => subscriber.businessId === businessId && subscriber.status === 'pending');
    for (const subscriber of pending) {
      await callPlatformAdmin({ action: 'SUBSCRIBER_STATUS', membershipId: subscriber.id, status: 'ACTIVE' });
      setSubscribers((prev) => prev.map((item) => item.id === subscriber.id ? { ...item, status: 'active' } : item));
    }
  };
  const toggleBusinessFreeze = async (businessId: string): Promise<void> => {
    const business = businesses.find((item) => item.id === businessId);
    if (!business) throw new Error('النشاط المطلوب غير موجود.');
    const frozen = !business.isFrozen;
    // Freeze is an independent operational flag. Do not overwrite the underlying
    // payment status: doing so loses whether the account was paid or overdue.
    await updateBillingSetting(businessId, { isFrozen: frozen });
    setBusinesses((prev) => prev.map((item) => item.id === businessId ? { ...item, isFrozen: frozen } : item));
  };
  const deleteBusiness = async (id: string) => {
    const business = businesses.find((b) => b.id === id); if (!business?.tenantId) throw new Error('النشاط غير مرتبط بقاعدة الإنتاج.');
    if (authSession.role !== 'admin') throw new Error('تعطيل الأنشطة من اختصاص إدارة المنصة.');
    await callPlatformAdmin({ action: 'DELETE_BUSINESS', businessId: id, tenantId: business.tenantId });
    setBusinesses((prev) => prev.filter((b) => b.id !== id)); setProducts((prev) => prev.filter((p) => p.businessId !== id));
    if (selectedBusinessId === id) setSelectedBusinessIdState('');
  };

  const getStorePublicLink = (business: Business) =>
    generateStorePublicUrl(window.location.origin, business.id, getCurrentAppBasePath(window.location.pathname));
  const addProduct = async (data: Omit<Product, 'id'> & { deferAiImageGeneration?: boolean }): Promise<{ success: boolean; message?: string }> => {
    const business = businesses.find((b) => b.id === data.businessId);
    if (!business?.tenantId || !business.branchId) return { success: false, message: 'النشاط أو الفرع غير مرتبط ببيانات الإنتاج.' };
    // Preserve a user-reviewed AI suggestion or an owner-supplied image URL.
    // Bulk import can defer automatic generation without discarding an explicitly approved suggestion.
    let imageSource: 'auto' | 'owner' | 'ai' =
      (data.imageSource === 'owner' || data.imageSource === 'ai') && Boolean(data.imageUrl?.trim())
        ? data.imageSource
        : 'auto';
    let imageUrl = imageSource === 'owner' || imageSource === 'ai'
      ? data.imageUrl.trim()
      : resolveDefaultImage({ name: data.name, description: data.description, category: data.category, kind: data.type === 'service' ? 'service' : 'product' });
    if (imageSource === 'auto' && data.deferAiImageGeneration !== true) {
      const generated = await generateCatalogAiImage({
        businessId: business.id,
        branchId: business.branchId,
        kind: data.type,
        name: data.name,
        category: data.category,
        description: data.description,
      });
      if (generated) {
        imageUrl = generated;
        imageSource = 'ai';
      }
    }
    const metadata = { catalog_public: { category: data.category, unit: data.unit || '', image_url: imageUrl, image_source: imageSource, compare_price: data.comparePrice ?? null, is_available: data.isAvailable, track_stock: false, ...(data.requiresQuote ? { show_price: false } : {}) } };
    try {
      if (data.requiresQuote) {
        await callCatalogAdmin({ action: 'ITEM_UPSERT', tenantId: business.tenantId, businessId: business.id, branchId: business.branchId, nameAr: data.name, itemType: 'SERVICE', description: data.description, taxRate: 0, metadata });
      } else {
        await callCatalogAdmin({ action: 'ITEM_PRICE_UPSERT', tenantId: business.tenantId, businessId: business.id, branchId: business.branchId, nameAr: data.name, itemType: data.type === 'service' ? 'SERVICE' : 'PRODUCT', description: data.description, unitPrice: data.price, currency: 'EGP', metadata });
      }
      await refreshBusinessCatalog(data.businessId); return { success: true };
    } catch (e: any) { return { success: false, message: e?.message || 'تعذر حفظ المنتج في قاعدة الإنتاج.' }; }
  };
  const updateProduct = async (updated: Product) => {
    const business = businesses.find((b) => b.id === updated.businessId);
    if (!business?.tenantId || !business.branchId) throw new Error('النشاط أو الفرع غير مرتبط ببيانات الإنتاج.');
    const previous = products.find((product) => product.id === updated.id);
    let imageSource: 'auto' | 'owner' | 'ai' = updated.imageSource === 'ai' && Boolean(updated.imageUrl?.trim())
      ? 'ai'
      : updated.imageSource === 'owner' && Boolean(updated.imageUrl?.trim()) ? 'owner' : 'auto';
    let imageUrl = imageSource === 'owner' || imageSource === 'ai'
      ? updated.imageUrl.trim()
      : resolveDefaultImage({ name: updated.name, description: updated.description, category: updated.category, kind: updated.type === 'service' ? 'service' : 'product' });
    // Don't spend another image-generation request for price/availability-only edits.
    // Regenerate only for a new auto image or when its descriptive context changes.
    const shouldGenerate = imageSource === 'auto' && (
      !previous ||
      previous.imageSource !== 'auto' ||
      previous.name !== updated.name ||
      previous.description !== updated.description ||
      previous.category !== updated.category ||
      previous.type !== updated.type
    );
    if (shouldGenerate) {
      const generated = await generateCatalogAiImage({
        businessId: business.id,
        branchId: business.branchId,
        kind: updated.type,
        name: updated.name,
        category: updated.category,
        description: updated.description,
      });
      if (generated) {
        imageUrl = generated;
        imageSource = 'ai';
      }
    }
    const metadata = { catalog_public: { category: updated.category, unit: updated.unit || '', image_url: imageUrl, image_source: imageSource, compare_price: updated.comparePrice ?? null, is_available: updated.isAvailable, track_stock: false, ...(updated.requiresQuote ? { show_price: false } : {}) } };
    if (updated.requiresQuote) {
      await callCatalogAdmin({ action: 'ITEM_UPSERT', tenantId: business.tenantId, businessId: business.id, branchId: business.branchId, id: updated.id, nameAr: updated.name, itemType: 'SERVICE', description: updated.description, taxRate: 0, metadata });
    } else {
      await callCatalogAdmin({ action: 'ITEM_PRICE_UPSERT', tenantId: business.tenantId, businessId: business.id, branchId: business.branchId, id: updated.id, nameAr: updated.name, itemType: updated.type === 'service' ? 'SERVICE' : 'PRODUCT', description: updated.description, unitPrice: updated.price, currency: 'EGP', metadata });
    }
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
    const backendStatus = String(result.status || 'INACTIVE').toUpperCase();
    const created: Subscriber = {
      id,
      fullName: data.fullName.trim(),
      email,
      phone: data.phone,
      businessId: business.id,
      status: backendStatus === 'ACTIVE' ? 'active' : backendStatus === 'SUSPENDED' ? 'suspended' : 'pending',
      username: email,
      authMethod: 'gmail_invite',
      inviteStatus: 'pending',
      notes: data.notes,
      joinedDate: new Date().toISOString().slice(0, 10),
    };
    setSubscribers((prev) => [created, ...prev.filter((s) => s.id !== id)]);
    return created;
  };
  const saveSubscriberMembership = async (input: {
    subscriber: Subscriber;
    tenantId: string;
    businessId?: string;
    branchId?: string;
    role: string;
    status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    catalogEnabled: boolean;
    catalogWrite: boolean;
    accountRestricted: boolean;
  }): Promise<Subscriber> => {
    if (authSession.role !== 'admin') throw new Error('إدارة أدوار الحسابات والصلاحيات متاحة لمالك المنصة فقط.');
    const source = input.subscriber;
    if (!source.userId) throw new Error('هذا الصف لا يحتوي على معرّف حساب Supabase صالح.');
    const result: any = await callPlatformAdmin({
      action: 'SAVE_MEMBERSHIP',
      ...(source.isAccountOnly ? {} : { membershipId: source.id }),
      userId: source.userId,
      tenantId: input.tenantId,
      businessId: input.businessId || '',
      branchId: input.branchId || '',
      role: input.role,
      status: input.status,
      catalogEnabled: input.catalogEnabled,
      catalogWrite: input.catalogWrite,
      accountRestricted: input.accountRestricted,
    });
    const membership = result?.membership;
    if (result?.success !== true || !membership?.id) throw new Error('لم يؤكد الخادم حفظ تعيين الدور والصلاحيات.');
    const mapped: Subscriber = {
      ...source,
      id: String(membership.id),
      userId: String(membership.userId || source.userId),
      tenantId: String(membership.tenantId || input.tenantId),
      organizationId: String(membership.organizationId || ''),
      businessId: String(membership.businessId || ''),
      businessName: String(membership.businessName || businesses.find((b) => b.id === String(membership.businessId || ''))?.name || ''),
      branchId: String(membership.branchId || ''),
      role: String(membership.role || input.role),
      membershipStatus: String(membership.status || input.status),
      permissions: membership.permissions && typeof membership.permissions === 'object' ? membership.permissions : {},
      status: String(membership.status || input.status) === 'ACTIVE' ? 'active' : String(membership.status || input.status) === 'SUSPENDED' ? 'suspended' : 'pending',
      isAccountOnly: false,
      password: undefined,
    };
    setSubscribers((prev) => [
      mapped,
      ...prev.filter((item) => item.id !== source.id && !(item.isAccountOnly && item.userId === mapped.userId)),
    ]);
    return mapped;
  };

  const updateSubscriber = async (updated: Subscriber) => {
    if (updated.status === 'active') {
      const business = businesses.find((item) => item.id === updated.businessId);
      const freeActivation = business?.subscriptionMode === 'FREE' && business.subscriptionAmount === 0
        && business.freeActivationApprovedByAdmin === true && String(business.paymentStatus || '').toLowerCase() === 'free';
      const paidAndConfirmed = String(business?.paymentStatus || '').toLowerCase() === 'paid' && business?.paymentConfirmedByAdmin === true;
      if (!business || (!freeActivation && !paidAndConfirmed)) {
        throw new Error('لا يمكن تفعيل الاشتراك قبل تأكيد السداد أو اعتماد التفعيل المجاني من إدارة المنصة.');
      }
    }
    await callPlatformAdmin({ action: 'SUBSCRIBER_STATUS', membershipId: updated.id, status: updated.status === 'active' ? 'ACTIVE' : updated.status === 'suspended' ? 'SUSPENDED' : 'INACTIVE' });
    setSubscribers((prev) => prev.map((s) => s.id === updated.id ? { ...updated, password: undefined } : s));
  };
  const deleteSubscriber = async (id: string) => {
    const target = subscribers.find((s) => s.id === id);
    if (!target || target.isAccountOnly || id.startsWith('ACCOUNT:')) {
      throw new Error('هذا حساب Google لم يُسند إلى عضوية بعد. استخدم إدارة الدور لتعيينه أو تقييده.');
    }
    await callPlatformAdmin({ action: 'SUBSCRIBER_STATUS', membershipId: id, status: 'INACTIVE' });
    setSubscribers((prev) => prev.map((s) => s.id === id
      ? { ...s, status: 'pending', membershipStatus: 'INACTIVE', password: undefined }
      : s));
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
حالة الاشتراك: ${sub.status === 'active' ? 'نشط' : sub.status === 'pending' ? 'بانتظار تأكيد السداد' : 'موقوف'}.
لا تُفعّل صلاحيات إدارة النشاط إلا بعد تأكيد السداد من إدارة المنصة.`;
  };
  const updateAdminSettings = async (settings: Partial<AdminSettings>): Promise<void> => {
    if (authSession.role !== 'admin') throw new Error('حفظ إعدادات المنصة متاح لمالك المنصة بعد التحقق من Google فقط.');
    const safe = { ...settings };
    delete (safe as any).adminPassword;
    const result: any = await callPlatformAdmin({ action: 'SAVE_SETTINGS', settings: safe });
    if (result?.success !== true) throw new Error('لم يؤكد الخادم حفظ إعدادات المنصة.');
    setAdminSettings((prev) => ({ ...prev, ...safe, adminPassword: '' }));
  };
  const addBusinessCategory = (category: string) => { const name = category.trim(); if (!name || adminSettings.defaultCategories.includes(name)) return; setAdminSettings((prev) => ({ ...prev, defaultCategories: [...prev.defaultCategories, name] })); };

  const addToCart = (product: Product, quantity = 1) => {
    if (currentBusiness?.operationalStatus !== 'ACTIVE' || currentBusiness?.isFrozen) { window.alert('هذا النشاط موقوف أو مجمّد ولا يستقبل طلبات جديدة.'); return; }
    setCartItems((prev) => { const match = prev.find((item) => item.product.id === product.id); return match ? prev.map((item) => item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item) : [...prev, { product, quantity }]; });
    setIsCartOpen(true);
  };
  const removeFromCart = (id: string) => setCartItems((prev) => prev.filter((item) => item.product.id !== id));
  const updateCartQuantity = (id: string, quantity: number) => { if (quantity <= 0) { removeFromCart(id); return; } setCartItems((prev) => prev.map((item) => item.product.id === id ? { ...item, quantity } : item)); };
  const clearCart = () => setCartItems([]);
  const submitOrderViaWhatsApp = (customer: CustomerOrderData): { success: boolean; url?: string; error?: string } => {
    if (!cartItems.length) return { success: false, error: 'السلة فارغة، يرجى إضافة منتجات أولا.' };
    if (!currentBusiness) return { success: false, error: 'النشاط الحالي غير محدد.' };
    const ownerPhoneDigits = String(currentBusiness.ownerWhatsApp || '').replace(/\D/g, '');
    if (ownerPhoneDigits.length < 10 || ownerPhoneDigits.length > 15) return { success: false, error: 'رقم واتساب صاحب النشاط غير متوفر أو غير صالح.' };
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
    authSession, switchAccountMembership, switchToPlatformAdminMode, authLoading, loginWithGoogle, registerWithEmail, loginAsSubscriber, loginAsAdmin, logout, isLoginModalOpen, setIsLoginModalOpen,
    businesses, directoryBusinesses, directoryLoading, products, subscribers, subscribersLoading, refreshPlatformSubscribers, adminSettings, updateBusiness, addBusiness, deleteBusiness, getStorePublicLink, updateBusinessLocation,
    confirmAdminPayment, updateBillingSetting, toggleBusinessFreeze,
    businessProducts, addProduct, updateProduct, deleteProduct, addSubscriber, saveSubscriberMembership, updateSubscriber, deleteSubscriber, sendGmailInvite, getSubscriberCredentialsText, updateAdminSettings, addBusinessCategory,
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
