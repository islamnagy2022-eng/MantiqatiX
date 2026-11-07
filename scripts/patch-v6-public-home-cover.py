#!/usr/bin/env python3
"""Restore the canonical r5 public homepage cover shell in the sanitized V6 Preview."""
from __future__ import annotations

import sys
from pathlib import Path

TARGET = Path("src/components/DirectoryView.tsx")

OLD_VERIFICATION = """const isBusinessVerified = (business: Business) => business.isVerified && (!business.verificationStatus || business.verificationStatus === 'verified');

export const DirectoryView: React.FC = () => {"""
NEW_VERIFICATION = """const isBusinessVerified = (business: Business) => business.isVerified && (!business.verificationStatus || business.verificationStatus === 'verified');

const PUBLIC_HOME_COVER_SLIDES = [
  {
    image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1600&auto=format&fit=crop&q=80',
    badge: 'MantiqaTix • دليل الأنشطة',
    title: 'اكتشف الأنشطة والخدمات المتاحة',
    subtitle: 'استخدم البحث للوصول إلى النشاط المناسب حسب التخصص والموقع.',
    alt: 'مساحة عمل رقمية حديثة',
  },
  {
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1600&auto=format&fit=crop&q=80',
    badge: 'MantiqaTix • الكتالوجات',
    title: 'تصفح صفحات الأنشطة والكتالوجات',
    subtitle: 'راجع المنتجات والخدمات المنشورة والأسعار الفعلية داخل صفحات الأنشطة.',
    alt: 'لوحة بيانات وأعمال رقمية',
  },
  {
    image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1600&auto=format&fit=crop&q=80',
    badge: 'MantiqaTix • بحث حسب الموقع',
    title: 'ابحث حسب المحافظة والتخصص',
    subtitle: 'حدد المحافظة والتخصص لتضييق النتائج والوصول إلى الأنشطة ذات الصلة.',
    alt: 'فريق عمل يتعاون في مساحة مهنية',
  },
] as const;

export const DirectoryView: React.FC = () => {"""
OLD_VISIBLE = """  const [visibleCount, setVisibleCount] = useState(DIRECTORY_PAGE_SIZE);

  const activityOptions"""
NEW_VISIBLE = """  const [visibleCount, setVisibleCount] = useState(DIRECTORY_PAGE_SIZE);
  const [coverIndex, setCoverIndex] = useState(0);
  const currentCover = PUBLIC_HOME_COVER_SLIDES[coverIndex];

  const activityOptions"""
OLD_HERO_END = """        </div>
      </section>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">"""
NEW_HERO_END = """        </div>
      </section>

      <section data-testid="r5-public-home-cover" aria-label="غلاف الصفحة الرئيسية" className="relative isolate mx-auto mt-5 h-[230px] w-[calc(100%-2rem)] max-w-7xl overflow-hidden rounded-3xl border border-slate-200 bg-slate-950 shadow-xl sm:h-[280px] lg:h-[320px]">
        <img
          src={currentCover.image}
          alt={currentCover.alt}
          className="absolute inset-0 h-full w-full object-cover"
          loading="eager"
          decoding="async"
        />
        <div className="absolute inset-0 bg-gradient-to-l from-slate-950/95 via-slate-950/65 to-slate-950/15" />
        <div className="relative z-10 flex h-full flex-col items-start justify-between p-5 text-right text-white sm:p-8 lg:p-10">
          <div className="max-w-2xl space-y-3">
            <span className="inline-flex rounded-full border border-emerald-300/40 bg-emerald-400/15 px-3 py-1 text-[11px] font-black text-emerald-100">{currentCover.badge}</span>
            <h2 className="text-2xl font-black leading-tight sm:text-3xl lg:text-4xl">{currentCover.title}</h2>
            <p className="max-w-xl text-xs leading-6 text-slate-200 sm:text-sm sm:leading-7">{currentCover.subtitle}</p>
          </div>
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => document.getElementById('available-activities')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-black text-slate-950 shadow-lg transition hover:bg-emerald-400">استكشف الأنشطة</button>
              <button type="button" onClick={() => setCurrentView('medical_directory')} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white/95 px-4 py-2 text-xs font-black text-slate-900 shadow-lg transition hover:bg-white">الدليل الطبي</button>
              <button type="button" onClick={() => setCurrentView('contact_us')} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-white/40 bg-slate-900/50 px-4 py-2 text-xs font-black text-white backdrop-blur-sm transition hover:bg-slate-900/75">تواصل معنا</button>
            </div>
            <div className="flex items-center gap-2" aria-label="التحكم في صور الغلاف">
              <button type="button" aria-label="الشريحة السابقة" onClick={() => setCoverIndex((index) => (index + PUBLIC_HOME_COVER_SLIDES.length - 1) % PUBLIC_HOME_COVER_SLIDES.length)} className="grid h-9 w-9 place-items-center rounded-full border border-white/40 bg-slate-950/45 text-white hover:bg-slate-950/75">‹</button>
              <span className="min-w-10 text-center text-[11px] font-bold text-white">{coverIndex + 1} / {PUBLIC_HOME_COVER_SLIDES.length}</span>
              <button type="button" aria-label="الشريحة التالية" onClick={() => setCoverIndex((index) => (index + 1) % PUBLIC_HOME_COVER_SLIDES.length)} className="grid h-9 w-9 place-items-center rounded-full border border-white/40 bg-slate-950/45 text-white hover:bg-slate-950/75">›</button>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">"""
OLD_RESULTS = """        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">"""
NEW_RESULTS = """        <section id="available-activities" className="scroll-mt-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">"""


def replace_once(text: str, old: str, new: str, label: str) -> tuple[str, bool]:
    old_count = text.count(old)
    new_count = text.count(new)
    if new_count == 1:
        return text, False
    if old_count != 1 or new_count:
        raise ValueError(f"{label}: expected one source anchor; old={old_count}; new={new_count}")
    patched = text.replace(old, new, 1)
    if patched.count(new) != 1:
        raise ValueError(f"{label}: replacement verification failed")
    return patched, True


def patch(source: str) -> tuple[str, bool]:
    changed = False
    for old, new, label in [
        (OLD_VERIFICATION, NEW_VERIFICATION, "canonical r5 cover definition"),
        (OLD_VISIBLE, NEW_VISIBLE, "cover slide state"),
        (OLD_HERO_END, NEW_HERO_END, "r5 public hero markup"),
        (OLD_RESULTS, NEW_RESULTS, "activity results scroll target"),
    ]:
        source, did_change = replace_once(source, old, new, label)
        changed = changed or did_change
    required = [
        'data-testid="r5-public-home-cover"',
        "استكشف الأنشطة",
        "الدليل الطبي",
        "تواصل معنا",
        "id=\"available-activities\"",
    ]
    if any(marker not in source for marker in required):
        raise ValueError("V6 r5 public-home cover acceptance markers are incomplete")
    return source, changed


def self_test() -> None:
    fixture = OLD_VERIFICATION + "\n" + OLD_VISIBLE + "\n" + OLD_HERO_END + "\n" + OLD_RESULTS
    updated, changed = patch(fixture)
    assert changed is True
    assert 'data-testid="r5-public-home-cover"' in updated
    again, changed_again = patch(updated)
    assert changed_again is False and again == updated


def main() -> None:
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        self_test()
        print("V6_R5_PUBLIC_HOME_COVER_OVERLAY_SELF_TEST=PASS")
        return
    if len(sys.argv) != 2:
        raise SystemExit("Usage: patch-v6-r5-public-home-cover.py <extracted-v6-root>")

    root = Path(sys.argv[1]).resolve()
    target = root / TARGET
    if not target.is_file():
        raise SystemExit("V6_R5_PUBLIC_HOME_COVER_TARGET_MISSING")
    updated, changed = patch(target.read_text(encoding="utf-8"))
    if changed:
        target.write_text(updated, encoding="utf-8")
    verified, changed_again = patch(target.read_text(encoding="utf-8"))
    if changed_again:
        raise SystemExit("V6_R5_PUBLIC_HOME_COVER_NOT_IDEMPOTENT")
    print(f"V6_R5_PUBLIC_HOME_COVER=PASS changed={int(changed)}")


if __name__ == "__main__":
    main()
