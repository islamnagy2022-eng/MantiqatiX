#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(sys.argv[1]).resolve()
if not ROOT.is_dir():
    raise SystemExit(f"V6_WORKTREE_MISSING={ROOT}")

PUBLIC_CONTEXT = r'''import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { AuthSession, Business, Product } from '../types';
import { getAuthMembershipApiConfig } from '../services/authMembershipApi';
import { fetchAuthenticatedMembershipChoices } from '../services/authMembershipWorkflow';
import { toV6AuthSession, type ActiveMembershipCandidate } from '../services/authMembership';
import {
  getAuthenticatedUser,
  refreshAuthSession,
  requestEmailOtp,
  revokeAuthSession,
  verifyEmailOtp,
  type SupabaseAuthSession,
} from '../services/supabaseAuthRest';
import { fetchPublicCatalogDirectory, getPublicCatalogDirectoryConfig } from '../services/publicCatalogDirectory';

export type PublicViewMode = 'public_storefront' | 'directory' | 'medical_directory' | 'contact_us';
type AuthStatus = 'idle' | 'sending_otp' | 'otp_sent' | 'verifying_otp' | 'select_membership' | 'no_membership' | 'authenticated' | 'error';

interface PublicAdminSettings {
  adminWhatsApp: string;
  currency: string;
  platformEmail: string;
}

interface PublicAppContextType {
  currentView: PublicViewMode;
  setCurrentView: (view: PublicViewMode) => void;
  selectedBusinessId: string;
  setSelectedBusinessId: (id: string) => void;
  currentBusiness: Business | undefined;
  directoryBusinesses: Business[];
  directoryProducts: Product[];
  businessProducts: Product[];
  directoryStatus: 'loading' | 'ready' | 'empty' | 'not_configured' | 'error';
  directoryError: string;
  refreshPublicDirectory: () => void;
  authSession: AuthSession;
  authStatus: AuthStatus;
  authEmail: string;
  authError: string;
  authCandidates: ActiveMembershipCandidate[];
  authBusinessSelectionRequired: number;
  requestLoginOtp: (email: string) => Promise<boolean>;
  verifyLoginOtp: (code: string) => Promise<boolean>;
  selectAuthMembership: (membershipId: string) => boolean;
  logout: () => void;
  isLoginModalOpen: boolean;
  setIsLoginModalOpen: (open: boolean) => void;
  adminSettings: PublicAdminSettings;
}

const PublicAppContext = createContext<PublicAppContextType | null>(null);

const PUBLIC_ADMIN_SETTINGS: PublicAdminSettings = {
  adminWhatsApp: '201010171770',
  currency: 'ج.م',
  platformEmail: 'admin@mantiqatix.com',
};

const authMessage = (error: unknown): string => {
  const code = error instanceof Error ? error.message : 'AUTH_UNAVAILABLE';
  const messages: Record<string, string> = {
    AUTH_API_CONFIG_REQUIRED: 'إعدادات تسجيل الدخول غير متاحة حاليًا.',
    AUTH_EMAIL_INVALID: 'أدخل بريدًا إلكترونيًا صحيحًا.',
    AUTH_OTP_INVALID: 'رمز التحقق يجب أن يتكون من 6 أرقام.',
    AUTH_SESSION_REJECTED: 'انتهت صلاحية جلسة الدخول. اطلب رمزًا جديدًا.',
    AUTH_MEMBERSHIP_FORBIDDEN: 'لا توجد صلاحية خادمية لقراءة عضويات هذا الحساب.',
    AUTH_BUSINESS_SELECTION_FORBIDDEN: 'الخادم لم يسمح بتحميل أنشطة هذا المالك. لا يمكن فتح لوحة النشاط دون نطاق معتمد.',
    AUTHENTICATED_USER_MISMATCH: 'تعذر مطابقة هوية الحساب مع العضويات المسجلة.',
    AUTH_REFRESH_USER_MISMATCH: 'تغيرت هوية جلسة الدخول. تم إيقاف الوصول.',
    AUTH_MEMBERSHIP_REVOKED: 'تم إلغاء العضوية المختارة أو لم تعد نشطة.',
    AUTH_ANONYMOUS_USER_NOT_ALLOWED: 'الحسابات المجهولة غير مسموح لها بدخول لوحات الإدارة.',
  };
  if (messages[code]) return messages[code];
  if (/rate|limit|too many/i.test(code)) return 'تم طلب رموز كثيرة خلال وقت قصير. انتظر قليلًا ثم حاول مرة أخرى.';
  if (/invalid.*(otp|token)|otp.*expired/i.test(code)) return 'رمز الدخول غير صحيح أو انتهت صلاحيته.';
  return 'تعذر إكمال تسجيل الدخول. راجع البريد والاتصال ثم حاول مرة أخرى.';
};

export const PublicAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [directory, setDirectory] = useState<{
    businesses: Business[];
    products: Product[];
    status: PublicAppContextType['directoryStatus'];
    error: string;
  }>({ businesses: [], products: [], status: 'loading', error: '' });
  const [directoryRevision, setDirectoryRevision] = useState(0);
  const refreshPublicDirectory = () => setDirectoryRevision((value) => value + 1);

  const [selectedBusinessId, setSelectedBusinessId] = useState(() => {
    try {
      return new URLSearchParams(window.location.search).get('store') || '';
    } catch {
      return '';
    }
  });
  const [currentView, setCurrentViewRaw] = useState<PublicViewMode>(() => {
    try {
      return new URLSearchParams(window.location.search).has('store') ? 'public_storefront' : 'directory';
    } catch {
      return 'directory';
    }
  });
  const setCurrentView = (view: PublicViewMode) => setCurrentViewRaw(view);

  const currentBusiness = useMemo(
    () => directory.businesses.find((business) => business.id === selectedBusinessId),
    [directory.businesses, selectedBusinessId],
  );
  const businessProducts = useMemo(
    () => currentBusiness ? directory.products.filter((product) => product.businessId === currentBusiness.id) : [],
    [currentBusiness, directory.products],
  );

  useEffect(() => {
    const controller = new AbortController();
    const config = getPublicCatalogDirectoryConfig();
    if (!config) {
      setDirectory({ businesses: [], products: [], status: 'not_configured', error: 'PUBLIC_DIRECTORY_CONFIG_MISSING' });
      return () => controller.abort();
    }
    setDirectory((value) => ({ ...value, status: 'loading', error: '' }));
    fetchPublicCatalogDirectory(config, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setDirectory({
          businesses: data.businesses,
          products: data.products,
          status: data.businesses.length ? 'ready' : 'empty',
          error: '',
        });
        const store = new URLSearchParams(window.location.search).get('store');
        if (store) {
          const matched = data.businesses.find((business) => business.slug === store || business.id === store);
          if (matched) setSelectedBusinessId(matched.id);
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setDirectory({
          businesses: [],
          products: [],
          status: 'error',
          error: error instanceof Error ? error.message : 'PUBLIC_DIRECTORY_UNAVAILABLE',
        });
      });
    return () => controller.abort();
  }, [directoryRevision]);

  const [authSession, setAuthSession] = useState<AuthSession>({ role: 'guest' });
  const [authTokens, setAuthTokens] = useState<SupabaseAuthSession | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('idle');
  const [authEmail, setAuthEmail] = useState('');
  const [authError, setAuthError] = useState('');
  const [authCandidates, setAuthCandidates] = useState<ActiveMembershipCandidate[]>([]);
  const [authBusinessSelectionRequired, setAuthBusinessSelectionRequired] = useState(0);
  const [selectedAuthMembershipId, setSelectedAuthMembershipId] = useState<string | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const requestLoginOtp = async (email: string): Promise<boolean> => {
    setAuthStatus('sending_otp');
    setAuthError('');
    const config = getAuthMembershipApiConfig();
    if (!config) {
      setAuthStatus('error');
      setAuthError('إعدادات Supabase Auth غير مكتملة في نسخة الموقع.');
      return false;
    }
    try {
      await requestEmailOtp(config, email);
      setAuthEmail(email.trim().toLowerCase());
      setAuthStatus('otp_sent');
      return true;
    } catch (error) {
      setAuthStatus('error');
      setAuthError(authMessage(error));
      return false;
    }
  };

  const verifyLoginOtp = async (code: string): Promise<boolean> => {
    setAuthStatus('verifying_otp');
    setAuthError('');
    const config = getAuthMembershipApiConfig();
    if (!config || !authEmail) {
      setAuthStatus('error');
      setAuthError('ابدأ بطلب رمز الدخول إلى بريدك الإلكتروني أولًا.');
      return false;
    }
    let pendingSession: SupabaseAuthSession | null = null;
    let otpVerified = false;
    try {
      const session = await verifyEmailOtp(config, authEmail, code);
      pendingSession = session;
      otpVerified = true;
      const choices = await fetchAuthenticatedMembershipChoices(config, session.accessToken, session.user.id);
      setAuthCandidates(choices.candidates);
      setAuthBusinessSelectionRequired(choices.unresolvedBusinessSelectionCount);
      setSelectedAuthMembershipId(null);
      setAuthSession({ role: 'guest' });
      if (choices.candidates.length > 0) {
        setAuthTokens(session);
        setAuthStatus('select_membership');
      } else {
        setAuthTokens(null);
        void revokeAuthSession(config, session.accessToken).catch(() => undefined);
        setAuthStatus('no_membership');
        setAuthError(choices.unresolvedBusinessSelectionCount > 0
          ? 'تم التحقق من الحساب، لكن لم يُرجع الخادم نشاطًا نشطًا ومصرحًا به لهذه العضوية. لا يمكن فتح لوحة النشاط قبل ربط نشاط محدد.'
          : 'تم التحقق من البريد، لكن لا توجد عضوية نشطة تمنح هذا الحساب صلاحية دخول إلى لوحة المنصة.');
      }
      return choices.candidates.length > 0;
    } catch (error) {
      if (pendingSession) void revokeAuthSession(config, pendingSession.accessToken).catch(() => undefined);
      setAuthTokens(null);
      setAuthCandidates([]);
      setAuthBusinessSelectionRequired(0);
      const codeValue = error instanceof Error ? error.message : '';
      setAuthStatus(!otpVerified && /otp|token|invalid_credentials/i.test(codeValue) ? 'otp_sent' : 'error');
      setAuthError(authMessage(error));
      return false;
    }
  };

  const selectAuthMembership = (membershipId: string): boolean => {
    const candidate = authCandidates.find((entry) => entry.selectionKey === membershipId);
    if (!candidate || !authTokens || candidate.userId !== authTokens.user.id) {
      setAuthError('اختيار العضوية غير صالح. أعد تسجيل الدخول وحاول مرة أخرى.');
      return false;
    }
    const session = toV6AuthSession(candidate);
    session.userEmail = authTokens.user.email;
    setAuthSession(session);
    setSelectedAuthMembershipId(candidate.selectionKey);
    if (candidate.businessId) setSelectedBusinessId(candidate.businessId);
    setAuthStatus('authenticated');
    setAuthError('');
    setIsLoginModalOpen(false);
    return true;
  };

  const logout = () => {
    const previousToken = authTokens?.accessToken;
    const config = getAuthMembershipApiConfig();
    setAuthTokens(null);
    setAuthSession({ role: 'guest' });
    setAuthCandidates([]);
    setAuthBusinessSelectionRequired(0);
    setSelectedAuthMembershipId(null);
    setAuthStatus('idle');
    setAuthEmail('');
    setAuthError('');
    setCurrentViewRaw('directory');
    if (config && previousToken) void revokeAuthSession(config, previousToken).catch(() => undefined);
  };

  useEffect(() => {
    if (!authTokens) return;
    let cancelled = false;
    const delay = Math.max(5000, authTokens.expiresAt - Date.now() - 60_000);
    const timer = window.setTimeout(async () => {
      const config = getAuthMembershipApiConfig();
      if (!config) {
        setAuthTokens(null);
        setAuthSession({ role: 'guest' });
        setAuthCandidates([]);
        setAuthBusinessSelectionRequired(0);
        setSelectedAuthMembershipId(null);
        setAuthStatus('error');
        setAuthError('إعدادات Auth غير متاحة؛ تم إغلاق الجلسة محليًا.');
        setCurrentViewRaw('directory');
        return;
      }
      let tokenToRevoke = authTokens.accessToken;
      try {
        const refreshed = await refreshAuthSession(config, authTokens.refreshToken);
        tokenToRevoke = refreshed.accessToken;
        const verifiedUser = await getAuthenticatedUser(config, refreshed.accessToken);
        if (verifiedUser.id !== authTokens.user.id || verifiedUser.is_anonymous) throw new Error('AUTH_REFRESH_USER_MISMATCH');
        const choices = await fetchAuthenticatedMembershipChoices(config, refreshed.accessToken, verifiedUser.id);
        if (cancelled) return;
        setAuthTokens({ ...refreshed, user: verifiedUser });
        setAuthCandidates(choices.candidates);
        setAuthBusinessSelectionRequired(choices.unresolvedBusinessSelectionCount);
        if (selectedAuthMembershipId) {
          const selected = choices.candidates.find((entry) => entry.selectionKey === selectedAuthMembershipId);
          if (!selected) throw new Error('AUTH_MEMBERSHIP_REVOKED');
          const nextSession = toV6AuthSession(selected);
          nextSession.userEmail = verifiedUser.email;
          setAuthSession(nextSession);
        }
      } catch (error) {
        if (cancelled) return;
        setAuthTokens(null);
        setAuthSession({ role: 'guest' });
        setAuthCandidates([]);
        setAuthBusinessSelectionRequired(0);
        setSelectedAuthMembershipId(null);
        setAuthStatus('error');
        setAuthError(authMessage(error));
        setCurrentViewRaw('directory');
        void revokeAuthSession(config, tokenToRevoke).catch(() => undefined);
      }
    }, delay);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [authTokens, selectedAuthMembershipId]);

  const value: PublicAppContextType = {
    currentView,
    setCurrentView,
    selectedBusinessId,
    setSelectedBusinessId,
    currentBusiness,
    directoryBusinesses: directory.businesses,
    directoryProducts: directory.products,
    businessProducts,
    directoryStatus: directory.status,
    directoryError: directory.error,
    refreshPublicDirectory,
    authSession,
    authStatus,
    authEmail,
    authError,
    authCandidates,
    authBusinessSelectionRequired,
    requestLoginOtp,
    verifyLoginOtp,
    selectAuthMembership,
    logout,
    isLoginModalOpen,
    setIsLoginModalOpen,
    adminSettings: PUBLIC_ADMIN_SETTINGS,
  };

  return <PublicAppContext.Provider value={value}>{children}</PublicAppContext.Provider>;
};

export const usePublicApp = (): PublicAppContextType => {
  const context = useContext(PublicAppContext);
  if (!context) throw new Error('usePublicApp must be used within a PublicAppProvider');
  return context;
};
'''

PUBLIC_CONTACT = r'''import type { ContactMessageType } from '../types';

export function generateContactUsWhatsAppUrl(
  adminPhone: string,
  data: {
    senderName: string;
    senderPhone: string;
    messageType: ContactMessageType;
    subject: string;
    content: string;
    relatedBusinessName?: string;
  },
): string {
  const cleanAdmin = adminPhone.replace(/[^\d]/g, '');
  const typeLabels: Record<ContactMessageType, string> = {
    message: 'رسالة عامة',
    request: 'طلب خدمة أو اشتراك',
    complaint: 'شكوى أو بلاغ',
    inquiry: 'استفسار فني أو تجاري',
  };
  const lines = [
    'تواصل جديد عبر منصة MantiqatiX',
    'نوع المراسلة: ' + (typeLabels[data.messageType] || 'رسالة'),
    'الاسم: ' + data.senderName.trim(),
    'الهاتف / الواتساب: ' + data.senderPhone.trim(),
    data.relatedBusinessName?.trim() ? 'النشاط المرتبط: ' + data.relatedBusinessName.trim() : '',
    'الموضوع: ' + data.subject.trim(),
    'التفاصيل: ' + data.content.trim(),
    'التاريخ: ' + new Date().toLocaleDateString('ar-EG'),
  ].filter(Boolean);
  return 'https://wa.me/' + cleanAdmin + '?text=' + encodeURIComponent(lines.join('\n'));
}
'''

PUBLIC_CATALOG = r'''import type { Product } from '../types';
export { resolveProductImage } from '../data/imageAssets';

export function filterProducts(products: Product[], searchTerm: string, selectedCategory: string): Product[] {
  const query = searchTerm.trim().toLocaleLowerCase();
  return products.filter((product) => {
    const matchesSearch = !query ||
      product.name.toLocaleLowerCase().includes(query) ||
      product.description.toLocaleLowerCase().includes(query);
    const matchesCategory = !selectedCategory || selectedCategory === 'all' || product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
}
'''

PUBLIC_MEDICAL = r'''import type { MedicalSpecialty } from '../types';

export const DEFAULT_MEDICAL_SPECIALTIES: MedicalSpecialty[] = [
  { id: 'spec_internal', name: 'أمراض الباطنة والسكر والغدد', icon: 'Stethoscope', description: 'تشخيص وعلاج أمراض الباطنة، السكري، الجهاز الهضمي وارتفاع ضغط الدم', doctorCount: 34 },
  { id: 'spec_pedia', name: 'طب الأطفال وحديثي الولادة', icon: 'Baby', description: 'متابعة نمو الرضع، تطعيمات الأطفال، علاج النزلات المعوية وحساسية الصدر', doctorCount: 28 },
  { id: 'spec_ortho', name: 'جراحة العظام والمفاصل والعمود الفقري', icon: 'Activity', description: 'علاج خشونة المفاصل، جراحات الرباط الصليبي، كسور العظام والانزلاق الغضروفي', doctorCount: 22 },
  { id: 'spec_cardio', name: 'أمراض القلب والأوعية الدموية والقسطرة', icon: 'HeartPulse', description: 'رسم قلب بالمجهود، قسطرة تشخيصية وعلاجية، ومتابعة قصور الشريان التاجي', doctorCount: 19 },
  { id: 'spec_derma', name: 'الجلدية والتناسلية والليزر', icon: 'Sparkles', description: 'علاج حب الشباب، الصدفية، الإكزيما، تساقط الشعر، وإجراءات الليزر العلاجي', doctorCount: 25 },
  { id: 'spec_surgery', name: 'الجراحة العامة وجراحة المناظير', icon: 'Scissors', description: 'جراحات الفتق، استئصال المرارة بالمنظار، وجراحات الشرج والغدة الدرقية', doctorCount: 16 },
  { id: 'spec_obgyn', name: 'النساء والتوليد وتأخر الإنجاب', icon: 'Heart', description: 'متابعة الحمل الحرج، سونار 4D، الولادة الطبيعية والقيصرية، وعلاج العقم', doctorCount: 31 },
  { id: 'spec_dental', name: 'طب وجراحة وتجميل الأسنان', icon: 'Smile', description: 'زراعة الأسنان، التقويم الشفاف، فينير وهوليوود سمايل، وحشو العصب الدقيق', doctorCount: 42 },
  { id: 'spec_ophtha', name: 'طب وجراحة العيون والليزر', icon: 'Eye', description: 'جراحات الفاكو، المياه البيضاء، تصحيح الإبصار بالليزر والليزك، وفحص قاع العين', doctorCount: 18 },
  { id: 'spec_ent', name: 'الأنف والأذن والحنجرة', icon: 'Ear', description: 'جراحات اللحمية واللوزتين، ترقيع طبلة الأذن، وعلاج الجيوب الأنفية ومشاكل السمع', doctorCount: 15 },
  { id: 'spec_labs', name: 'معامل التحاليل الطبية والجينات', icon: 'FlaskConical', description: 'تحاليل الدم الشاملة، وظائف الكبد والكلى، دلالات الأورام والتحاليل الوراثية', doctorCount: 38 },
  { id: 'spec_radiology', name: 'مراكز الأشعة التشخيصية والتصوير', icon: 'Radio', description: 'أشعة رنين مغناطيسي MRI، مقطعية CT، موجات صوتية وسونار، وتصوير الثدي', doctorCount: 12 },
];
'''
def write_exact(path: Path, value: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(value, encoding="utf-8")

write_exact(ROOT / "src/context/PublicAppContext.tsx", PUBLIC_CONTEXT)
write_exact(ROOT / "src/utils/publicContact.ts", PUBLIC_CONTACT)
write_exact(ROOT / "src/utils/publicCatalog.ts", PUBLIC_CATALOG)
write_exact(ROOT / "src/data/medicalSpecialties.ts", PUBLIC_MEDICAL)

replacements = {
    "src/App.tsx": [
        ("import { AppProvider, useApp } from './context/AppContext';",
         "import { PublicAppProvider, usePublicApp } from './context/PublicAppContext';"),
        ("useApp()", "usePublicApp()"),
        ("<AppProvider>", "<PublicAppProvider>"),
        ("</AppProvider>", "</PublicAppProvider>"),
    ],
    "src/components/DirectoryView.tsx": [
        ("../context/AppContext", "../context/PublicAppContext"),
        ("useApp", "usePublicApp"),
    ],
    "src/components/Navbar.tsx": [
        ("../context/AppContext", "../context/PublicAppContext"),
        ("useApp", "usePublicApp"),
    ],
    "src/components/medical/MedicalDirectoryView.tsx": [
        ("../../context/AppContext", "../../context/PublicAppContext"),
        ("useApp", "usePublicApp"),
        ("../../data/seedData", "../../data/medicalSpecialties"),
    ],
    "src/components/ContactUsView.tsx": [
        ("../context/AppContext", "../context/PublicAppContext"),
        ("useApp", "usePublicApp"),
        ("../utils/rules", "../utils/publicContact"),
    ],
    "src/components/storefront/BusinessProfileHeader.tsx": [
        ("../../context/AppContext", "../../context/PublicAppContext"),
        ("useApp", "usePublicApp"),
    ],
    "src/components/storefront/CatalogSection.tsx": [
        ("../../context/AppContext", "../../context/PublicAppContext"),
        ("useApp", "usePublicApp"),
        ("../../utils/rules", "../../utils/publicCatalog"),
    ],
    "src/components/auth/LoginModal.tsx": [
        ("../../context/AppContext", "../../context/PublicAppContext"),
        ("useApp", "usePublicApp"),
    ],
}


seed_source_path = ROOT / "src/data/seedData.ts"
seed_source = seed_source_path.read_text(encoding="utf-8")
medical_match = re.search(r"export const DEFAULT_MEDICAL_SPECIALTIES: MedicalSpecialty\[\] = \[.*?^\];", seed_source, re.MULTILINE | re.DOTALL)
if not medical_match:
    raise SystemExit("V6_MEDICAL_SPECIALTY_SOURCE_NOT_FOUND")
medical_source = "import type { MedicalSpecialty } from '../types';" + chr(10) * 2 + medical_match.group(0) + chr(10)
write_exact(ROOT / "src/data/medicalSpecialties.ts", medical_source)

for relative, pairs in replacements.items():
    path = ROOT / relative
    if not path.exists():
        raise SystemExit(f"V6_PUBLIC_CONTEXT_REQUIRED_FILE_MISSING={relative}")
    text = path.read_text(encoding="utf-8")
    for old, new in pairs:
        if old in text:
            text = text.replace(old, new)
    path.write_text(text, encoding="utf-8")

# Fail closed if a public entry component still reaches the monolithic provider
# or the legacy enterprise rules module.
for relative in replacements:
    text = (ROOT / relative).read_text(encoding="utf-8")
    if "context/AppContext" in text or "useApp" in text:
        raise SystemExit(f"V6_PUBLIC_CONTEXT_LEGACY_IMPORT_REMAINS={relative}")
for relative in ["src/components/ContactUsView.tsx", "src/components/storefront/CatalogSection.tsx"]:
    text = (ROOT / relative).read_text(encoding="utf-8")
    if "utils/rules" in text:
        raise SystemExit(f"V6_PUBLIC_RULES_IMPORT_REMAINS={relative}")

context = (ROOT / "src/context/PublicAppContext.tsx").read_text(encoding="utf-8")
for forbidden in ["../context/AppContext", "../utils/rules", "../data/seedData", "../utils/accessPolicy", "localStorage"]:
    if forbidden in context:
        raise SystemExit(f"V6_PUBLIC_CONTEXT_FORBIDDEN_DEPENDENCY={forbidden}")

print("V6_PUBLIC_CONTEXT_SEPARATION=PASS")
