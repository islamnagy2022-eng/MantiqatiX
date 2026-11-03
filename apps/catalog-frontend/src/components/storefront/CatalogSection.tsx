import React, { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Product } from '../../types';

const CATALOG_ITEM_PLACEHOLDER = `${import.meta.env.BASE_URL || '/'}catalog-item-placeholder.svg`;
import { filterProducts, formatPrice } from '../../utils/rules';
import {
  Search,
  Plus,
  ShoppingBag,
  Sparkles,
  Layers,
  Check,
  Tag,
  Briefcase,
  Package,
  Ban,
  AlertTriangle,
  MessageCircle,
  X,
} from 'lucide-react';

export const CatalogSection: React.FC = () => {
  const { currentBusiness, businessProducts, addToCart, cartItems, setIsCartOpen, adminSettings } =
    useApp();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState<'all' | 'product' | 'service'>('all');
  const [addedItemEffect, setAddedItemEffect] = useState<string | null>(null);

  // Extract distinct categories from current products
  const categories = useMemo(() => {
    const set = new Set<string>();
    businessProducts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [businessProducts]);

  // Filter products by search, category, and type
  const filteredItems = useMemo(() => {
    let result = filterProducts(businessProducts, searchTerm, selectedCategory);
    if (selectedType !== 'all') {
      result = result.filter((item) => item.type === selectedType);
    }
    return result;
  }, [businessProducts, searchTerm, selectedCategory, selectedType]);

  const handleAddToCart = (product: Product) => {
    addToCart(product, 1);
    setAddedItemEffect(product.id);
    setTimeout(() => {
      setAddedItemEffect(null);
    }, 1500);
  };

  const getItemCartQuantity = (productId: string) => {
    const found = cartItems.find((item) => item.product.id === productId);
    return found ? found.quantity : 0;
  };

  const isFrozen = currentBusiness?.operationalStatus === 'FROZEN' || Boolean(currentBusiness?.isFrozen);
  const isOperationallyHidden = currentBusiness?.operationalStatus !== 'ACTIVE' || Boolean(currentBusiness?.isFrozen);

  const buildQuoteUrl = (product: Product): string | null => {
    let digits = String(currentBusiness?.ownerWhatsApp || currentBusiness?.phone || adminSettings.adminWhatsApp || '')
      .replace(/\D/g, '');
    digits = digits.startsWith('00') ? digits.slice(2)
      : digits.startsWith('0') ? '20' + digits.slice(1)
      : digits.startsWith('1') && digits.length === 10 ? '20' + digits : digits;
    if (digits.length < 10 || digits.length > 15) return null;
    const message = `مرحبًا، أريد طلب عرض سعر لخدمة ${product.name} من ${currentBusiness?.name || 'MantiqatiX'}.`;
    return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
  };

  return (
    <section data-testid="storefront-catalog" aria-label={`كتالوج منتجات وخدمات ${currentBusiness?.name || ""}`} className="mx-v4-catalog-section max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
      {!isOperationallyHidden && null}
      {isOperationallyHidden && !isFrozen && (
        <div className="bg-slate-50 border border-slate-300 rounded-2xl p-5 mb-6 text-slate-800">
          <h3 className="font-black text-base">الكتالوج غير متاح حاليًا</h3>
          <p className="text-sm mt-1">تم إيقاف النشاط مؤقتًا من إدارة المنصة. المنتجات والخدمات غير معروضة حاليًا.</p>
        </div>
      )}
      {/* Frozen Alert Banner */}
      {isFrozen && (
        <div className="bg-rose-50 border-2 border-rose-400 rounded-3xl p-4 sm:p-5 mb-6 flex items-center justify-between gap-3 text-rose-950">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-rose-600 text-white rounded-2xl flex-shrink-0">
              <Ban className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm">صفحة الكتالوج معطلة والطلبات معلقة مؤقتاً</h3>
              <p className="text-xs text-rose-800 mt-0.5">
                هذا النشاط التجاري مجمد مؤقتاً لعدم سداد المستحقات المالية بعد انقضاء مهلة الـ 5 أيام. يرجى مراجعة إدارة المنصة.
              </p>
            </div>
          </div>
          <span className="text-[11px] font-black text-rose-700 bg-rose-100 px-3 py-1 rounded-xl flex-shrink-0">
            الطلب غير متاح
          </span>
        </div>
      )}

      {/* Section Header & Subtitle */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <div className="mx-v4-catalog-label inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold mb-2">
            <Layers className="w-3.5 h-3.5" />
            <span>كتالوج المنتجات والخدمات</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
            قائمة عروض وكتالوج {currentBusiness?.name}
          </h2>
          <p className="text-slate-500 text-xs sm:text-sm mt-1">
            اختر ما يناسبك وأضفه للسلة؛ سيتم تحويل الطلب فوراً إلى واتساب صاحب النشاط مباشرة.
          </p>
        </div>

        {/* Counter Badge */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <div className="mx-v4-catalog-counter flex items-center gap-2 rounded-2xl border px-3.5 py-2 text-xs font-semibold">
            <span aria-hidden="true" className="w-2 h-2 rounded-full bg-sky-500"></span>
            <span>
              المعروض: <strong className="mx-v4-catalog-count font-extrabold">{filteredItems.length}</strong> من إجمالي {businessProducts.length}
            </span>
            <span className="text-slate-400 text-[11px]">(الحد: 150)</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div data-testid="storefront-catalog-filters" className="mx-v4-catalog-filter-surface mb-8 space-y-4 rounded-2xl border p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="mx-v4-catalog-search-icon absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2" />
            <input
              type="text"
              aria-label="ابحث عن منتج أو خدمة داخل النشاط"
              data-testid="storefront-catalog-search"
              placeholder="ابحث عن منتج أو خدمة داخل النشاط..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="mx-v4-catalog-search-input w-full rounded-xl border bg-slate-50 py-2.5 pl-10 pr-10 text-sm font-semibold placeholder:text-slate-400 outline-none transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 bg-slate-200/60 hover:bg-slate-200 rounded-full transition-colors cursor-pointer"
                title="مسح البحث"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Type Filter: Products vs Services */}
          <div role="group" aria-label="نوع عناصر الكتالوج" data-testid="storefront-catalog-type-filter" className="flex items-center self-start rounded-xl bg-slate-100 p-1 text-xs font-medium sm:self-auto">
            <button
              type="button"
              aria-pressed={selectedType === 'all'}
              onClick={() => setSelectedType('all')}
              className={`px-3 py-2 rounded-lg transition-all ${
                selectedType === 'all'
                  ? 'mx-v4-catalog-type-active font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الكل ({businessProducts.length})
            </button>
            <button
              type="button"
              aria-pressed={selectedType === 'product'}
              onClick={() => setSelectedType('product')}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-all ${
                selectedType === 'product'
                  ? 'mx-v4-catalog-type-active font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>منتجات</span>
            </button>
            <button
              type="button"
              aria-pressed={selectedType === 'service'}
              onClick={() => setSelectedType('service')}
              className={`flex items-center gap-1 px-3 py-2 rounded-lg transition-all ${
                selectedType === 'service'
                  ? 'mx-v4-catalog-type-active font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" />
              <span>خدمات</span>
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div role="group" aria-label="تصنيفات الكتالوج" data-testid="storefront-catalog-categories" className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 no-scrollbar">
          <button
            type="button"
            aria-pressed={selectedCategory === 'all'}
            onClick={() => setSelectedCategory('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === 'all'
                ? 'mx-v4-catalog-category-active'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            جميع الأقسام ({businessProducts.length})
          </button>
          {categories.map((cat) => {
            const count = businessProducts.filter((p) => p.category === cat).length;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                aria-pressed={isSelected}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  isSelected
                    ? 'mx-v4-catalog-category-active'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{cat}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Product Grid */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
            <Package className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 mb-1">لا توجد منتجات أو خدمات مطابقة</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            جرب تغيير معايير البحث أو اختيار قسم آخر لعرض منتجات هذا النشاط.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredItems.map((product) => {
            const inCartQty = getItemCartQuantity(product.id);
            const isRecentlyAdded = addedItemEffect === product.id;
            const hasDiscount = product.comparePrice && product.comparePrice > product.price;
            const discountPercent = hasDiscount
              ? Math.round(((product.comparePrice! - product.price) / product.comparePrice!) * 100)
              : 0;

            return (
              <div
                key={product.id}
                data-testid="storefront-catalog-card"
                className="mx-v4-catalog-card group flex flex-col overflow-hidden rounded-3xl border bg-white transition-all duration-300 hover:-translate-y-1"
              >
                {/* Product Image & Badges */}
                <div className="relative aspect-4/3 w-full bg-slate-100 overflow-hidden">
                  <img
                    src={product.imageUrl}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      const image = e.currentTarget;
                      if (!image.src.endsWith('/catalog-item-placeholder.svg')) image.src = CATALOG_ITEM_PLACEHOLDER;
                    }}
                  />

                  {/* Gradient bottom overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-60" />

                  {/* Type Badge (Top Right) */}
                  <div className="absolute top-3 right-3 flex flex-col gap-1.5">
                    <span
                      className={`text-[11px] font-bold px-2.5 py-1 rounded-full backdrop-blur-md shadow-xs ${
                        product.type === 'service'
                          ? 'bg-blue-600/90 text-white'
                          : 'bg-slate-900/80 text-white'
                      }`}
                    >
                      {product.type === 'service' ? 'خدمة' : 'منتج'}
                    </span>
                    {hasDiscount && (
                      <span className="bg-rose-500 text-white text-[11px] font-extrabold px-2.5 py-1 rounded-full shadow-md animate-pulse">
                        خصم {discountPercent}%
                      </span>
                    )}
                  </div>

                  {/* Category Pill (Bottom Right) */}
                  <div className="absolute bottom-3 right-3">
                    <span className="text-[11px] font-medium bg-black/60 text-white/90 backdrop-blur-sm px-2.5 py-0.5 rounded-md">
                      {product.category}
                    </span>
                  </div>

                  {/* In Cart Indicator (Top Left) */}
                  {inCartQty > 0 && (
                    <div className="absolute top-3 left-3 bg-emerald-600 text-white font-extrabold text-xs px-2.5 py-1 rounded-xl shadow-lg flex items-center gap-1">
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>{inCartQty} بالسلة</span>
                    </div>
                  )}
                </div>

                {/* Product Content Details */}
                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="mx-v4-catalog-card-title font-extrabold text-slate-900 text-base leading-snug transition-colors line-clamp-1">
                      {product.name}
                    </h3>

                    <p className="text-slate-500 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                      {product.description}
                    </p>
                  </div>

                  {/* Price & Add to Cart Action */}
                  <div className="mt-5 pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2">
                    <div>
                      {product.requiresQuote ? (
                        <>
                          <div className="mx-v4-catalog-price-label text-sm font-black">السعر حسب الاتفاق</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">تواصل لطلب عرض سعر</div>
                        </>
                      ) : (
                        <>
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-lg font-black text-slate-900">{product.price}</span>
                            <span className="text-xs font-bold text-slate-500">{adminSettings.currency}</span>
                          </div>
                          {hasDiscount && (
                            <div className="text-[11px] text-slate-400 line-through">
                              {product.comparePrice} {adminSettings.currency}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Request a quote for unpriced services; only priced items go to cart. */}
                    {isFrozen ? (
                      <button
                        disabled
                        aria-label="النشاط مجمد مؤقتاً"
                        className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                      >
                        <Ban className="w-4 h-4 text-rose-500" />
                        <span>النشاط مجمد</span>
                      </button>
                    ) : product.requiresQuote ? (
                      buildQuoteUrl(product) ? (
                        <a
                          href={buildQuoteUrl(product) || undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`اطلب عرض سعر لخدمة ${product.name}`}
                          className="mx-v4-catalog-primary-action whitespace-nowrap flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-all"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>اطلب عرض سعر</span>
                        </a>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title="لم يضف النشاط رقم تواصل صالحًا بعد"
                          aria-label="بيانات التواصل غير متاحة لطلب عرض السعر"
                          className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-slate-100 text-slate-500 cursor-not-allowed whitespace-nowrap"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>التواصل غير متاح</span>
                        </button>
                      )
                    ) : (
                      <button
                        onClick={() => handleAddToCart(product)}
                        disabled={!product.isAvailable}
                        aria-label={`أضف ${product.name} إلى السلة`}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-xs ${
                          !product.isAvailable
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : isRecentlyAdded
                            ? 'bg-emerald-700 text-white shadow-emerald-700/30'
                            : 'mx-v4-catalog-primary-action'
                        }`}
                      >
                        {isRecentlyAdded ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>تمت الإضافة!</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            <span>أضف للسلة</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
