#!/usr/bin/env python3
"""Remove the dedicated medical directory from the public V6 website build."""
from __future__ import annotations
import re
import sys
import tempfile
from pathlib import Path


def replace_required(path: Path, old: str, new: str, label: str) -> None:
    body = path.read_text(encoding="utf-8")
    if old in body:
        path.write_text(body.replace(old, new, 1), encoding="utf-8")
        return
    if new in body:
        return
    raise SystemExit(f"V6_MEDICAL_DIRECTORY_PATCH_FAILED missing={label} file={path}")


def remove_required_line(path: Path, pattern: str, label: str) -> None:
    body = path.read_text(encoding="utf-8")
    updated, count = re.subn(pattern, "", body, count=1, flags=re.MULTILINE)
    if count:
        path.write_text(updated, encoding="utf-8")
        return
    if label in body:
        raise SystemExit(f"V6_MEDICAL_DIRECTORY_PATCH_FAILED line_not_removed={label} file={path}")


def verify(root: Path) -> None:
    checks = {
        "src/App.tsx": ["MedicalDirectoryView", "medical_directory"],
        "src/context/PublicAppContext.tsx": ["medical_directory"],
        "src/components/Navbar.tsx": ["medical_directory", "الدليل الطبي", "HeartPulse"],
        "src/components/DirectoryView.tsx": ["setCurrentView('medical_directory')", "الدليل الطبي"],
    }
    for rel, markers in checks.items():
        body = (root / rel).read_text(encoding="utf-8")
        for marker in markers:
            if marker in body:
                raise SystemExit(f"V6_MEDICAL_DIRECTORY_VERIFY_FAILED file={rel} marker={marker}")
    for rel in ["src/components/medical/MedicalDirectoryView.tsx", "src/data/medicalSpecialties.ts"]:
        if (root / rel).exists():
            raise SystemExit(f"V6_MEDICAL_DIRECTORY_VERIFY_FAILED file_still_exists={rel}")
    app = (root / "src/App.tsx").read_text(encoding="utf-8")
    if "currentView === 'contact_us'" not in app or "<DirectoryView />" not in app:
        raise SystemExit("V6_MEDICAL_DIRECTORY_VERIFY_FAILED non_medical_routes_damaged")


def apply(root: Path) -> None:
    app = root / "src/App.tsx"
    context = root / "src/context/PublicAppContext.tsx"
    navbar = root / "src/components/Navbar.tsx"
    directory = root / "src/components/DirectoryView.tsx"
    replace_required(app,
        "import { MedicalDirectoryView } from './components/medical/MedicalDirectoryView';\n",
        "", "medical_component_import")
    replace_required(app,
        "        {currentView === 'medical_directory' ? (\n"
        "          <MedicalDirectoryView />\n"
        "        ) : currentView === 'contact_us' ? (",
        "        {currentView === 'contact_us' ? (", "medical_view_route")
    replace_required(context,
        "export type PublicViewMode = 'public_storefront' | 'directory' | 'medical_directory' | 'contact_us';",
        "export type PublicViewMode = 'public_storefront' | 'directory' | 'contact_us';",
        "public_view_mode")
    replace_required(navbar,
        "import { LogIn, LogOut, MessageCircle, Store, HeartPulse, Sparkles, ExternalLink } from 'lucide-react';",
        "import { LogIn, LogOut, MessageCircle, Store, Sparkles, ExternalLink } from 'lucide-react';",
        "medical_nav_icon_import")
    remove_required_line(navbar,
        r"^\s*\{ id: 'medical_directory' as const, label: 'الدليل الطبي', icon: HeartPulse \},\s*\n",
        "medical_nav_item")
    remove_required_line(directory,
        r"^\s*<button type=\"button\" onClick=\{\(\) => setCurrentView\('medical_directory'\)\}.*>الدليل الطبي</button>\s*\n",
        "medical_directory_cta")
    # Keep the canonical archive intact; strip medical-only files from the generated website worktree.
    for rel in ["src/components/medical/MedicalDirectoryView.tsx", "src/data/medicalSpecialties.ts"]:
        target = root / rel
        if target.exists():
            target.unlink()
    medical_dir = root / "src/components/medical"
    if medical_dir.exists() and not any(medical_dir.iterdir()):
        medical_dir.rmdir()
    verify(root)


def self_test() -> None:
    with tempfile.TemporaryDirectory(prefix="v6-medical-directory-test-") as tmp:
        root = Path(tmp)
        fixtures = {
            "src/App.tsx": (
                "import { MedicalDirectoryView } from './components/medical/MedicalDirectoryView';\n"
                "export default () => <>\n"
                "        {currentView === 'medical_directory' ? (\n"
                "          <MedicalDirectoryView />\n"
                "        ) : currentView === 'contact_us' ? (\n"
                "          <ContactUsView />\n"
                "        ) : <DirectoryView />}\n"
                "</>;\n"
            ),
            "src/context/PublicAppContext.tsx":
                "export type PublicViewMode = 'public_storefront' | 'directory' | 'medical_directory' | 'contact_us';\n",
            "src/components/Navbar.tsx": (
                "import { LogIn, LogOut, MessageCircle, Store, HeartPulse, Sparkles, ExternalLink } from 'lucide-react';\n"
                "const navItems = [\n"
                "    { id: 'directory' as const, label: 'دليل الأنشطة', icon: Store },\n"
                "    { id: 'medical_directory' as const, label: 'الدليل الطبي', icon: HeartPulse },\n"
                "    { id: 'contact_us' as const, label: 'تواصل معنا', icon: MessageCircle },\n"
                "  ];\n"
            ),
            "src/components/DirectoryView.tsx": (
                "<button type=\"button\" onClick={() => setCurrentView('medical_directory')} className=\"btn\">الدليل الطبي</button>\n"
                "<button type=\"button\" onClick={() => setCurrentView('contact_us')}>تواصل معنا</button>\n"
            ),
            "src/components/medical/MedicalDirectoryView.tsx": "export const MedicalDirectoryView = () => null;\n",
            "src/data/medicalSpecialties.ts": "export const DEFAULT_MEDICAL_SPECIALTIES = [];\n",
        }
        for rel, body in fixtures.items():
            target = root / rel
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(body, encoding="utf-8")
        apply(root)
        verify(root)
        apply(root)
        verify(root)


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        self_test()
        print("V6_MEDICAL_DIRECTORY_PATCH_SELF_TEST=PASS")
    elif len(sys.argv) == 2:
        apply(Path(sys.argv[1]).resolve())
        print("V6_MEDICAL_DIRECTORY_DISABLED=PASS")
    else:
        raise SystemExit("Usage: disable-v6-medical-directory.py WORKTREE | --self-test")
