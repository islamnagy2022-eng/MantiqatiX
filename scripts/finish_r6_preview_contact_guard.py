#!/usr/bin/env python3
"""Disable unverified contact/payment destinations in the public R6 Preview."""
from pathlib import Path
import sys

if len(sys.argv) != 2:
    raise SystemExit("usage: finish_r6_preview_contact_guard.py <extracted-app-directory>")
root = Path(sys.argv[1]).resolve()

def read(rel: str) -> str:
    p = root / rel
    if not p.is_file():
        raise SystemExit(f"Required file missing: {rel}")
    return p.read_text(encoding="utf-8")

def write(rel: str, value: str) -> None:
    (root / rel).write_text(value, encoding="utf-8")

def once(src: str, old: str, new: str, label: str) -> str:
    count = src.count(old)
    if count != 1:
        raise SystemExit(f"Expected one {label} anchor; found {count}.")
    return src.replace(old, new, 1)

def all_occurrences(src: str, old: str, new: str, label: str, minimum: int = 1) -> str:
    count = src.count(old)
    if count < minimum:
        raise SystemExit(f"Expected at least {minimum} {label} anchors; found {count}.")
    return src.replace(old, new)

path = "src/utils/productionEnterpriseEngine.ts"
s = once(read(path), "  if (!digits) return '201010171770';",
         "  if (!digits) return import.meta.env.VITE_PREVIEW_MODE === 'true' ? '' : '201010171770';",
         "empty WhatsApp normalization fallback")
write(path, s)

path = "src/utils/mantygoBiddingEngine.ts"
s = once(read(path), "  const cleanPhone = (bid.businessPhone || '201010171770').replace(/[^0-9]/g, '');",
         "  const cleanPhone = (import.meta.env.VITE_PREVIEW_MODE === 'true' ? '' : (bid.businessPhone || '201010171770')).replace(/[^0-9]/g, '');",
         "MantyGo destination fallback")
write(path, s)

path = "src/utils/rules.ts"
s = once(read(path), "  const cleanPhone = business.phone || business.ownerWhatsApp || '01010171770';",
         "  const cleanPhone = import.meta.env.VITE_PREVIEW_MODE === 'true' ? '' : (business.phone || business.ownerWhatsApp || '01010171770');",
         "marketing campaign phone fallback")
s = once(s, "  const cleanPhone = cleanPhoneNumber(business.ownerWhatsApp || business.phone || '201010171770');",
         "  const cleanPhone = cleanPhoneNumber(import.meta.env.VITE_PREVIEW_MODE === 'true' ? '' : (business.ownerWhatsApp || business.phone || '201010171770'));",
         "sector WhatsApp fallback")
write(path, s)

path = "src/utils/bookingPaymentEngine.ts"
s = once(read(path), "  const cleanOwnerPhone = cleanPhoneNumber(params.business.ownerWhatsApp || '201010171770');",
         "  const cleanOwnerPhone = cleanPhoneNumber(import.meta.env.VITE_PREVIEW_MODE === 'true' ? '' : (params.business.ownerWhatsApp || '201010171770'));",
         "booking owner WhatsApp fallback")
write(path, s)

path = "src/utils/merchantIndispensableSuite.ts"
s = all_occurrences(read(path), "contactWhatsApp: '201010171770',", "contactWhatsApp: '',",
                    "B2B fixture contact destinations", minimum=4)
write(path, s)

path = "src/components/common/MarketingServicesModal.tsx"
s = once(read(path),
         "  const handleRequestService = (service: MarketingServiceItem) => {\n    const adminPhone = cleanPhoneNumber(adminSettings.adminWhatsApp || '+201012345678');",
         "  const handleRequestService = (service: MarketingServiceItem) => {\n    if (import.meta.env.VITE_PREVIEW_MODE === 'true') return;\n    const adminPhone = cleanPhoneNumber(adminSettings.adminWhatsApp || '+201012345678');",
         "marketing service inquiry handler")
write(path, s)

# The dedicated MedicalDirectoryView is explicitly out of website scope.
# Do not import or patch it; fail closed if the source archive still contains it.
medical_page = root / "src/components/medical/MedicalDirectoryView.tsx"
if medical_page.exists():
    raise SystemExit(
        "Dedicated medical directory is excluded from the website. "
        "Remove its page and route from the staged source before import."
    )
src_root = root / "src"
for source_path in src_root.rglob("*"):
    if source_path.is_file() and source_path.suffix in {".ts", ".tsx", ".js", ".jsx"}:
        try:
            source_text = source_path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        if "MedicalDirectoryView" in source_text or "medical_directory" in source_text:
            raise SystemExit(
                f"Dedicated medical directory page/route reference remains in {source_path.relative_to(root)}"
            )

path = "src/components/common/ProductionPhasesControlPanel.tsx"
s = once(read(path), "  const [waPhone, setWaPhone] = useState<string>(activeBiz?.ownerWhatsApp || '01010171770');",
         "  const [waPhone, setWaPhone] = useState<string>(activeBiz?.ownerWhatsApp || (import.meta.env.VITE_PREVIEW_MODE === 'true' ? '' : '01010171770'));",
         "production phases WhatsApp recipient")
write(path, s)

path = "src/components/admin/UnifiedEnterpriseDashboard.tsx"
s = once(read(path), "  const [adminBizWhatsApp, setAdminBizWhatsApp] = useState('201010171770');",
         "  const [adminBizWhatsApp, setAdminBizWhatsApp] = useState(import.meta.env.VITE_PREVIEW_MODE === 'true' ? '' : '201010171770');",
         "admin business WhatsApp default")
write(path, s)

path = "src/components/admin/AdminDashboard.tsx"
s = read(path)
s = once(s, "      ownerWhatsApp: newBizOwnerWhatsApp || '+201000000000',",
         "      ownerWhatsApp: newBizOwnerWhatsApp || (import.meta.env.VITE_PREVIEW_MODE === 'true' ? '' : '+201000000000'),",
         "new business WhatsApp default")
s = s.replace("توجيه طلبات الواتساب مباشرة لصاحب النشاط، وخدمة العملاء على 201010171770.",
              "توجيه طلبات الواتساب مباشرة لصاحب النشاط، وخدمة العملاء عبر القناة المعتمدة.")
write(path, s)

for path, pairs in {
    "src/context/AppContext.tsx": [
        ("customerPhone: '01012345678',", "customerPhone: import.meta.env.VITE_PREVIEW_MODE === 'true' ? '' : '01012345678',"),
        ("senderPhone: '01065432198',", "senderPhone: import.meta.env.VITE_PREVIEW_MODE === 'true' ? '' : '01065432198',"),
        ("contactPhone: targetBiz?.phone || targetBiz?.ownerWhatsApp || '01010171770',", "contactPhone: targetBiz?.phone || targetBiz?.ownerWhatsApp || (import.meta.env.VITE_PREVIEW_MODE === 'true' ? '' : '01010171770'),"),
        ("contactWhatsApp: targetBiz?.ownerWhatsApp || targetBiz?.phone || '01010171770',", "contactWhatsApp: targetBiz?.ownerWhatsApp || targetBiz?.phone || (import.meta.env.VITE_PREVIEW_MODE === 'true' ? '' : '01010171770'),"),
    ],
    "src/components/MantyGoBiddingView.tsx": [
        ("customerPhone: '01065432198',", "customerPhone: import.meta.env.VITE_PREVIEW_MODE === 'true' ? '' : '01065432198',"),
    ],
    "src/components/common/WalletModal.tsx": [
        ("customerPhone: '01010171770',", "customerPhone: import.meta.env.VITE_PREVIEW_MODE === 'true' ? '' : '01010171770',"),
    ],
    "src/components/merchant/MerchantDashboard.tsx": [
        ("customerPhone: saleCustomerPhone || '01000000000',", "customerPhone: saleCustomerPhone || (import.meta.env.VITE_PREVIEW_MODE === 'true' ? '' : '01000000000'),"),
    ],
    "src/components/MemberMessagesView.tsx": [
        ("senderPhone: senderPhone.trim() || '01000000000',", "senderPhone: senderPhone.trim() || (import.meta.env.VITE_PREVIEW_MODE === 'true' ? '' : '01000000000'),"),
    ],
}.items():
    s = read(path)
    for old, new in pairs:
        s = once(s, old, new, f"preview contact fixture in {path}")
    write(path, s)

path = "src/main.tsx"
s = read(path)
marker = "import './index.css';\n"
block = r'''import './index.css';

if (import.meta.env.VITE_PREVIEW_MODE === 'true') {
  const isBlockedPreviewAction = (value: string) => {
    const target = value.trim().toLowerCase();
    return /^(tel:|sms:)/.test(target) ||
      /(?:wa\.me|api\.whatsapp\.com|web\.whatsapp\.com|paymob|fawry|instapay)/.test(target);
  };

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest<HTMLAnchorElement>('a[href]');
    if (!anchor || !isBlockedPreviewAction(anchor.href)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  }, true);

  const originalWindowOpen = window.open.bind(window);
  window.open = ((url?: string | URL, target?: string, features?: string) => {
    if (url != null && isBlockedPreviewAction(String(url))) return null;
    return originalWindowOpen(url, target, features);
  }) as typeof window.open;
}
'''
if "isBlockedPreviewAction" not in s:
    s = once(s, marker, block, "Preview outbound action guard")
write(path, s)

assertions = {
    "Preview browser click guard": "isBlockedPreviewAction" in read("src/main.tsx"),
    "Preview window.open guard": "originalWindowOpen" in read("src/main.tsx"),
    "No fallback for empty WhatsApp phone": "VITE_PREVIEW_MODE === 'true' ? '' : '201010171770'" in read("src/utils/productionEnterpriseEngine.ts"),
    "MantyGo fallback neutralized": "VITE_PREVIEW_MODE === 'true' ? '' : (bid.businessPhone || '201010171770')" in read("src/utils/mantygoBiddingEngine.ts"),
    "Rules sector fallback neutralized": "VITE_PREVIEW_MODE === 'true' ? '' : (business.ownerWhatsApp || business.phone || '201010171770')" in read("src/utils/rules.ts"),
    "Booking fallback neutralized": "VITE_PREVIEW_MODE === 'true' ? '' : (params.business.ownerWhatsApp || '201010171770')" in read("src/utils/bookingPaymentEngine.ts"),
    "B2B sample contact numbers removed": "contactWhatsApp: '201010171770'" not in read("src/utils/merchantIndispensableSuite.ts"),
    "Marketing request gated": "if (import.meta.env.VITE_PREVIEW_MODE === 'true') return;" in read("src/components/common/MarketingServicesModal.tsx"),
}
failed = [name for name, ok in assertions.items() if not ok]
if failed:
    raise SystemExit("Preview contact hardening failed: " + "; ".join(failed))
print("R6 Preview contact hardening completed: sample destinations neutralized and unverified phone/WhatsApp/payment navigation blocked.")
