#!/usr/bin/env python3
"""Add a live-data-only public catalog strip to the sanitized V6 r5 Preview."""
from __future__ import annotations

import sys
from pathlib import Path

DIRECTORY = Path("src/components/DirectoryView.tsx")
STRIP = Path("src/components/common/LivePublishedCatalogStrip.tsx")

STRIP_SOURCE = """import React from 'react';
import type { Business, Product } from '../../types';

export interface LivePublishedCatalogItem {
  product: Product;
  business: Business;
}

interface LivePublishedCatalogStripProps {
  items: LivePublishedCatalogItem[];
  currency: string;
  onOpenBusiness: (business: Business) => void;
}

export const LivePublishedCatalogStrip: React.FC<LivePublishedCatalogStripProps> = ({
  items,
  currency,
  onOpenBusiness,
}) => {
  if (items.length === 0) return null;

  const formatPrice = (price: number) => new Intl.NumberFormat('ar-EG', {
    maximumFractionDigits: 2,
  }).format(price);

  return (
    <section
      data-testid="live-published-catalog-strip"
      aria-label="منتجات وخدمات منشورة من كتالوجات الأنشطة الموثقة"
      dir="rtl"
      className="mx-auto mt-5 w-[calc(100%-2rem)] max-w-7xl rounded-3xl border border-emerald-200 bg-gradient-to-l from-emerald-50/80 via-white to-teal-50/70 p-4 shadow-sm sm:p-5"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 pb-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">منتجات وخدمات من الكتالوجات المنشورة</h2>
          <p className="mt-1 text-xs text-slate-500">عناصر متاحة بأسعارها المسجلة من أنشطة موثقة فقط.</p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 text-[11px] font-bold text-emerald-800">
          {items.length} عنصر منشور
        </span>
      </div>
      <div className="flex snap-x snap-mandatory items-stretch gap-3 overflow-x-auto pb-2" aria-label="شريط المنتجات والخدمات المنشورة">
        {items.map(({ product, business }) => {
          const hasComparePrice = typeof product.comparePrice === 'number'
            && Number.isFinite(product.comparePrice)
            && product.comparePrice > product.price;
          return (
            <article
              data-testid="live-published-catalog-card"
              key={business.id + ':' + product.id}
              className="flex w-52 shrink-0 snap-start flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="relative h-28 bg-slate-100">
                {product.imageUrl ? (
                  <img src={product.imageUrl} alt={product.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-xs font-bold text-slate-400">صورة غير متاحة</div>
                )}
                <span className="absolute right-2 top-2 rounded-lg bg-slate-950/85 px-2 py-1 text-[10px] font-bold text-white">
                  {product.type === 'service' ? 'خدمة' : 'منتج'}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2 p-3">
                <p className="truncate text-[10px] font-bold text-emerald-800">{business.name}</p>
                <h3 className="line-clamp-2 min-h-9 text-xs font-black leading-5 text-slate-900">{product.name}</h3>
                <div className="mt-auto flex flex-wrap items-baseline gap-1.5 border-t border-slate-100 pt-2">
                  <strong className="text-sm font-black text-slate-900">{formatPrice(product.price)} {currency}</strong>
                  {hasComparePrice && (
                    <span className="text-[10px] text-slate-400 line-through">{formatPrice(product.comparePrice!)} {currency}</span>
                  )}
                  {product.unit && <span className="text-[10px] text-slate-500">/ {product.unit}</span>}
                </div>
                <button
                  type="button"
                  onClick={() => onOpenBusiness(business)}
                  className="mt-1 min-h-9 rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-black text-white transition hover:bg-emerald-700"
                >
                  عرض النشاط
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
};
"""

OLD_IMPORT = "import { resolveBusinessLogo } from '../data/imageAssets';"
NEW_IMPORT = OLD_IMPORT + "\nimport { LivePublishedCatalogStrip } from './common/LivePublishedCatalogStrip';"
OLD_CONTEXT = """    directoryBusinesses: businesses,
    directoryStatus,"""
NEW_CONTEXT = """    directoryBusinesses: businesses,
    directoryProducts,
    directoryStatus,"""
OLD_COVER = """  const [coverIndex, setCoverIndex] = useState(0);
  const currentCover = PUBLIC_HOME_COVER_SLIDES[coverIndex];

  const activityOptions"""
NEW_COVER = """  const [coverIndex, setCoverIndex] = useState(0);
  const currentCover = PUBLIC_HOME_COVER_SLIDES[coverIndex];
  const liveCatalogItems = useMemo(() => {
    const businessById = new Map(businesses.map((business) => [business.id, business]));
    return directoryProducts.flatMap((product) => {
      const business = businessById.get(product.businessId);
      if (!business || !isBusinessVerified(business)) return [];
      if (!product.isAvailable || !Number.isFinite(product.price) || product.price < 0) return [];
      return [{ product, business }];
    });
  }, [businesses, directoryProducts]);

  const activityOptions"""
OLD_MAIN = """      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">"""
NEW_MAIN = """      <LivePublishedCatalogStrip items={liveCatalogItems} currency="ج.م" onOpenBusiness={openBusiness} />

      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">"""
OLD_GRID = """                  key={biz.id}
                  className={`bg-white rounded-3xl border shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-xl transition-all group relative ${"""
NEW_GRID = """                  key={biz.id}
                  data-testid="directory-activity-card"
                  className={`bg-white rounded-3xl border shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-xl transition-all group relative ${"""


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


def patch_directory(source: str) -> tuple[str, bool]:
    changed = False
    for old, new, label in [
        (OLD_IMPORT, NEW_IMPORT, "live catalog import"),
        (OLD_CONTEXT, NEW_CONTEXT, "public product context"),
        (OLD_COVER, NEW_COVER, "live published product selection"),
        (OLD_MAIN, NEW_MAIN, "live product strip placement"),
        (OLD_GRID, NEW_GRID, "directory activity grid test scope"),
    ]:
        source, did_change = replace_once(source, old, new, label)
        changed = changed or did_change
    required = [
        "directoryProducts,",
        "isBusinessVerified(business)",
        "Number.isFinite(product.price)",
        "<LivePublishedCatalogStrip",
        'data-testid="directory-activity-card"',
    ]
    if any(marker not in source for marker in required):
        raise ValueError("Live published catalog overlay acceptance markers are incomplete")
    return source, changed


def self_test() -> None:
    fixture = "\n".join([OLD_IMPORT, OLD_CONTEXT, OLD_COVER, OLD_MAIN, OLD_GRID])
    patched, changed = patch_directory(fixture)
    assert changed is True
    assert "isBusinessVerified(business)" in patched
    assert "Number.isFinite(product.price)" in patched
    again, changed_again = patch_directory(patched)
    assert changed_again is False and again == patched


def main() -> None:
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        self_test()
        print("V6_LIVE_PUBLISHED_CATALOG_OVERLAY_SELF_TEST=PASS")
        return
    if len(sys.argv) != 2:
        raise SystemExit("Usage: patch-v6-live-published-catalog.py <extracted-v6-root>")

    root = Path(sys.argv[1]).resolve()
    directory_path = root / DIRECTORY
    strip_path = root / STRIP
    if not directory_path.is_file():
        raise SystemExit("V6_LIVE_PUBLISHED_CATALOG_DIRECTORY_TARGET_MISSING")
    strip_path.parent.mkdir(parents=True, exist_ok=True)
    strip_path.write_text(STRIP_SOURCE, encoding="utf-8")

    updated, changed = patch_directory(directory_path.read_text(encoding="utf-8"))
    if changed:
        directory_path.write_text(updated, encoding="utf-8")
    verified, changed_again = patch_directory(directory_path.read_text(encoding="utf-8"))
    if changed_again or "<LivePublishedCatalogStrip" not in verified:
        raise SystemExit("V6_LIVE_PUBLISHED_CATALOG_OVERLAY_NOT_IDEMPOTENT")
    if strip_path.read_text(encoding="utf-8") != STRIP_SOURCE:
        raise SystemExit("V6_LIVE_PUBLISHED_CATALOG_COMPONENT_VERIFY_FAILED")
    print(f"V6_LIVE_PUBLISHED_CATALOG=PASS changed={int(changed)}")


if __name__ == "__main__":
    main()
