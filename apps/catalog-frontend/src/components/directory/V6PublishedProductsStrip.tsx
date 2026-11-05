import React, { useMemo, useRef } from 'react';
import type { Business, Product } from '../../types';
import { ChevronLeft, ChevronRight, Package, ShoppingBag } from 'lucide-react';
import { resolveDefaultImage } from '../../utils/defaultImages';

interface V6PublishedProductsStripProps {
  products: Product[];
  businesses: Business[];
  onOpenStorefront: (businessId: string) => void;
}

interface PublishedProductCard {
  product: Product;
  business: Business;
}

const MAX_VISIBLE_PRODUCTS = 12;

/**
 * V6-inspired horizontal product shelf, intentionally powered only by the
 * primary catalog's public, persisted directory payload. No seeded templates,
 * synthetic ranking, sales counters, or invented discount claims are allowed.
 */
export const V6PublishedProductsStrip: React.FC<V6PublishedProductsStripProps> = ({
  products,
  businesses,
  onOpenStorefront,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);

  const items = useMemo<PublishedProductCard[]>(() => {
    const publicBusinesses = new Map(
      businesses
        .filter((business) =>
          business.publicEnabled === true &&
          business.catalogPublished === true &&
          business.operationalStatus === 'ACTIVE' &&
          !business.isFrozen &&
          Boolean(business.name.trim())
        )
        .map((business) => [business.id, business] as const)
    );

    const seenProductIds = new Set<string>();
    const visible: PublishedProductCard[] = [];

    for (const product of products) {
      const business = publicBusinesses.get(product.businessId);
      const price = Number(product.price);

      if (
        !business ||
        product.type !== 'product' ||
        product.isAvailable !== true ||
        product.requiresQuote === true ||
        !Number.isFinite(price) ||
        price <= 0 ||
        !product.id.trim() ||
        !product.name.trim() ||
        seenProductIds.has(product.id)
      ) {
        continue;
      }

      seenProductIds.add(product.id);
      visible.push({ product, business });
      if (visible.length >= MAX_VISIBLE_PRODUCTS) break;
    }

    return visible;
  }, [products, businesses]);

  const scrollTrack = (direction: 'next' | 'previous') => {
    const element = trackRef.current;
    if (!element) return;

    const reducedMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const distance = Math.max(220, Math.min(element.clientWidth * 0.8, 520));

    element.scrollBy({
      left: direction === 'next' ? -distance : distance,
      behavior: reducedMotion ? 'auto' : 'smooth',
    });
  };

  if (items.length === 0) return null;

  return (
    <section
      data-testid="published-products-strip"
      aria-label="منتجات متاحة من كتالوجات منشورة"
      dir="rtl"
      className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
            <ShoppingBag aria-hidden="true" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="truncate text-base font-black text-slate-900 sm:text-lg">منتجات من كتالوجات منشورة</h2>
            <p className="mt-0.5 text-[11px] text-slate-500">منتجات متاحة بأسعار نشطة من الأنشطة التي تتيح الكتالوج العام</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="hidden rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-800 sm:inline-flex">
            {items.length.toLocaleString('ar-EG')} منتج
          </span>
          {items.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => scrollTrack('previous')}
                aria-label="المنتجات السابقة"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <ChevronRight aria-hidden="true" className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollTrack('next')}
                aria-label="المنتجات التالية"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                <ChevronLeft aria-hidden="true" className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>

      <div
        id="published-products-track"
        ref={trackRef}
        role="region"
        aria-label="قائمة المنتجات المنشورة"
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x snap-mandatory"
      >
        {items.map(({ product, business }) => {
          const fallbackImage = resolveDefaultImage({
            name: product.name,
            description: product.description,
            category: product.category,
            kind: 'product',
          });

          return (
            <article
              key={product.id}
              data-testid="published-products-strip-card"
              className="w-44 shrink-0 snap-start overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md sm:w-48"
            >
              <button
                type="button"
                onClick={() => onOpenStorefront(business.id)}
                aria-label={`افتح منتج ${product.name} من نشاط ${business.name}`}
                className="block w-full text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                      onError={(event) => {
                        const image = event.currentTarget;
                        if (image.dataset.fallbackApplied !== 'true') {
                          image.dataset.fallbackApplied = 'true';
                          image.src = fallbackImage;
                        }
                      }}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      <Package aria-hidden="true" className="h-9 w-9" />
                    </div>
                  )}
                </div>
                <div className="space-y-2 p-3">
                  <h3 className="line-clamp-2 min-h-9 text-xs font-black leading-5 text-slate-900">{product.name}</h3>
                  <p className="truncate text-[10px] font-bold text-slate-500">{business.name}</p>
                  <p className="text-sm font-black text-emerald-700">
                    {product.price.toLocaleString('ar-EG')} ج.م
                  </p>
                  <span className="inline-flex min-h-8 w-full items-center justify-center rounded-lg bg-slate-900 px-2 py-2 text-[10px] font-black text-white transition hover:bg-emerald-700">
                    عرض الكتالوج
                  </span>
                </div>
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
};
