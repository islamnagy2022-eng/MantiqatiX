#!/usr/bin/env python3
"""Restore the safe public r5-style brand and navigation shell in the isolated V6 Preview."""
from __future__ import annotations

import sys
from pathlib import Path

TARGET = Path("src/components/Navbar.tsx")

NAVBAR_SOURCE = """import React from 'react';
import { usePublicApp } from '../context/PublicAppContext';
import { LogIn, LogOut, MessageCircle, Store, HeartPulse, Sparkles, ExternalLink } from 'lucide-react';

export const Navbar: React.FC = () => {
  const {
    currentView,
    setCurrentView,
    authSession,
    logout,
    setIsLoginModalOpen,
  } = usePublicApp();

  const navItems = [
    { id: 'directory' as const, label: 'دليل الأنشطة', icon: Store },
    { id: 'medical_directory' as const, label: 'الدليل الطبي', icon: HeartPulse },
    { id: 'contact_us' as const, label: 'تواصل معنا', icon: MessageCircle },
  ];

  const directoryIsActive = currentView === 'directory' || currentView === 'public_storefront';
  // Both the production root and the V6 preview alias must lead to the same retained workspace.
  // V6 auth is intentionally memory-only; the legacy app must re-authenticate and re-check membership.
  const configuredBasePath = import.meta.env.BASE_URL || '/';
  const publicRootPath = configuredBasePath.replace(/v6-preview\/?$/, '');
  const normalizedRootPath = publicRootPath.endsWith('/') ? publicRootPath : `${publicRootPath}/`;
  const legacyManagementHref = `${normalizedRootPath}legacy/?view=merchant_admin`;

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 shadow-sm backdrop-blur-xl" dir="rtl">
      <div className="bg-slate-950 px-3 py-2 text-white sm:px-6">
        <div className="mx-auto flex max-w-[1720px] flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-black text-emerald-200 sm:text-[11px]">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              MantiqatiX
            </span>
            <span className="hidden truncate text-[11px] text-slate-300 sm:inline">
              دليل الأنشطة والكتالوجات حسب التخصص والموقع
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <a
              href={legacyManagementHref}
              aria-label="إدارة النشاط في النسخة المحفوظة — يتطلب تسجيل دخول منفصل"
              title="يفتح مساحة الإدارة المحفوظة. جلسة V6 لا تنتقل تلقائيًا؛ سجّل الدخول هناك وأعد التحقق من العضوية."
              className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 font-bold text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              <span>لوحة الإدارة</span>
              <span className="hidden sm:inline text-[10px] text-slate-400">(دخول منفصل)</span>
            </a>
            {authSession.role === 'guest' ? (
              <button
                type="button"
                onClick={() => setIsLoginModalOpen(true)}
                className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 font-black text-white transition-colors hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                <span>دخول الحساب</span>
              </button>
            ) : (
              <>
                <span className="hidden max-w-[35vw] truncate text-[11px] text-slate-200 sm:inline" title={authSession.userEmail || undefined}>
                  حساب موثق
                </span>
                <button
                  type="button"
                  onClick={logout}
                  className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 font-bold text-slate-200 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                  title="تسجيل الخروج"
                >
                  <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>خروج</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[1720px] flex-wrap items-center justify-between gap-3 px-3 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => setCurrentView('directory')}
          className="group flex shrink-0 items-center gap-2.5 rounded-xl text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
          title="الرئيسية والدليل الشامل"
          aria-label="العودة إلى دليل منطقتي X"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 via-teal-600 to-indigo-700 text-sm font-black text-white shadow-md shadow-emerald-700/20 transition-transform group-hover:scale-105" aria-hidden="true">
            MX
          </span>
          <span className="text-right">
            <span className="flex items-baseline gap-1 font-black leading-tight tracking-tight text-slate-950">
              <span className="text-lg sm:text-xl">منطقتي</span>
              <span className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-sm font-black text-emerald-700">X</span>
            </span>
            <span className="mt-0.5 block text-[10px] font-bold text-slate-400 sm:text-[11px]">MantiqatiX Business &amp; Catalogs</span>
          </span>
        </button>

        <div className="hidden items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-right md:flex">
          <Store className="h-4 w-4 text-emerald-700" aria-hidden="true" />
          <span className="text-xs font-bold text-slate-600">اكتشف الأنشطة والخدمات والمنتجات المنشورة</span>
        </div>
      </div>

      <nav
        aria-label="التنقل الرئيسي"
        className="mx-auto flex max-w-[1720px] items-center gap-1 overflow-x-auto border-t border-slate-100 px-3 py-2 sm:px-6 lg:px-8"
      >
        {navItems.map(({ id, label, icon: Icon }) => {
          const isActive = id === 'directory' ? directoryIsActive : currentView === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setCurrentView(id)}
              aria-current={isActive ? 'page' : undefined}
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-black transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1 sm:px-4 ${
                isActive
                  ? 'bg-emerald-700 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-emerald-800'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>
    </header>
  );
};
"""

def self_test() -> None:
    required = [
        "aria-label=\"التنقل الرئيسي\"",
        "directoryIsActive = currentView === 'directory' || currentView === 'public_storefront'",
        "authSession.role === 'guest'",
        "aria-current={isActive ? 'page' : undefined}",
        "setCurrentView('directory')",
        "MantiqatiX Business &amp; Catalogs",
        "const legacyManagementHref = `${normalizedRootPath}legacy/?view=merchant_admin`;",
        'aria-label="إدارة النشاط في النسخة المحفوظة — يتطلب تسجيل دخول منفصل"',
        "جلسة V6 لا تنتقل تلقائيًا",
    ]
    for marker in required:
        assert marker in NAVBAR_SOURCE, f"missing navbar marker: {marker}"
    assert "super_admin" not in NAVBAR_SOURCE and "merchant_admin" not in NAVBAR_SOURCE
    assert "setIsWallet" not in NAVBAR_SOURCE and "setIsCart" not in NAVBAR_SOURCE
    print("V6_PUBLIC_R5_NAVBAR_SELF_TEST=PASS")

def main() -> None:
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        self_test()
        return
    if len(sys.argv) != 2:
        raise SystemExit("Usage: patch-v6-public-r5-navbar.py <extracted-v6-root>")
    root = Path(sys.argv[1]).resolve()
    target = root / TARGET
    if not target.is_file():
        raise SystemExit("V6_PUBLIC_R5_NAVBAR_TARGET_MISSING")
    current = target.read_text(encoding="utf-8")
    if current != NAVBAR_SOURCE:
        if "usePublicApp" not in current or "export const Navbar" not in current:
            raise SystemExit("V6_PUBLIC_R5_NAVBAR_UNEXPECTED_SOURCE")
        target.write_text(NAVBAR_SOURCE, encoding="utf-8")
    if target.read_text(encoding="utf-8") != NAVBAR_SOURCE:
        raise SystemExit("V6_PUBLIC_R5_NAVBAR_VERIFY_FAILED")
    print("V6_PUBLIC_R5_NAVBAR=PASS")

if __name__ == "__main__":
    main()
