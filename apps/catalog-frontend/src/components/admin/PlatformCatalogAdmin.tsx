import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Building2, Package, RefreshCw, Search, ShieldCheck, Store } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { callCatalogAdmin } from '../../lib/production';
import type { Business } from '../../types';

type CatalogItemRow = {
  id: string;
  tenant_id: string;
  business_id: string;
  branch_id?: string | null;
  item_type?: string | null;
  name_ar?: string | null;
  name_en?: string | null;
  description?: string | null;
  sku?: string | null;
  status?: string | null;
  metadata?: Record<string, any> | null;
  updated_at?: string | null;
};

type CatalogPriceRow = {
  id?: string;
  catalog_item_id: string;
  branch_id?: string | null;
  currency?: string | null;
  unit_price: number | string;
  version?: number | null;
};

type CatalogReadResult = {
  business?: { id: string; name?: string; status?: string };
  branches?: Array<{ id: string; name?: string; code?: string }>;
  selectedBranchId?: string | null;
  items?: CatalogItemRow[];
  prices?: CatalogPriceRow[];
  catalogReadiness?: string;
  message?: string;
};

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500';
const formatPrice = (value: unknown, currency = 'EGP') => {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  try {
    return new Intl.NumberFormat('ar-EG', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
  } catch {
    return amount.toLocaleString('ar-EG') + ' ' + currency;
  }
};

export const PlatformCatalogAdmin: React.FC = () => {
  const { businesses, currentBusiness } = useApp();
  const availableBusinesses = useMemo(
    () => businesses.filter((business) => Boolean(business.tenantId)),
    [businesses],
  );
  const [selectedBusinessId, setSelectedBusinessId] = useState(
    currentBusiness?.tenantId ? currentBusiness.id : availableBusinesses[0]?.id || '',
  );
  const [selectedBranchId, setSelectedBranchId] = useState('');
  const [snapshot, setSnapshot] = useState<CatalogReadResult | null>(null);
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(20);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestSequence = useRef(0);

  useEffect(() => {
    if (!selectedBusinessId && availableBusinesses.length) {
      setSelectedBusinessId(availableBusinesses[0].id);
    }
  }, [availableBusinesses, selectedBusinessId]);

  const selectedBusiness = availableBusinesses.find((business) => business.id === selectedBusinessId);

  const loadCatalog = useCallback(async (businessId: string, branchId?: string) => {
    const business: Business | undefined = availableBusinesses.find((row) => row.id === businessId);
    if (!business?.tenantId) {
      setSnapshot(null);
      setError('لا يوجد نشاط بنطاق مؤسسة موثوق لعرض كتالوجه.');
      return;
    }
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError('');
    try {
      const result = await callCatalogAdmin<CatalogReadResult>({
        action: 'CATALOG_READ',
        tenantId: business.tenantId,
        businessId: business.id,
        ...(branchId ? { branchId } : {}),
      });
      if (sequence !== requestSequence.current) return;
      setSnapshot({
        ...result,
        branches: Array.isArray(result.branches) ? result.branches : [],
        items: Array.isArray(result.items) ? result.items : [],
        prices: Array.isArray(result.prices) ? result.prices : [],
      });
      setSelectedBranchId(String(result.selectedBranchId || branchId || ''));
    } catch (caught) {
      if (sequence !== requestSequence.current) return;
      setSnapshot(null);
      setError(caught instanceof Error ? caught.message : 'تعذر قراءة كتالوج النشاط.');
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [availableBusinesses]);

  useEffect(() => {
    if (selectedBusinessId) void loadCatalog(selectedBusinessId);
    return () => { requestSequence.current += 1; };
  }, [selectedBusinessId, loadCatalog]);

  const items = snapshot?.items || [];
  const prices = snapshot?.prices || [];
  const filteredItems = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return items;
    return items.filter((item) => [
      item.name_ar, item.name_en, item.sku, item.description,
    ].some((value) => String(value || '').toLocaleLowerCase().includes(query)));
  }, [items, search]);
  const visibleItems = filteredItems.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(20);
  }, [search, selectedBusinessId, selectedBranchId]);

  const priceForItem = (itemId: string) => {
    const matches = prices.filter((price) => price.catalog_item_id === itemId);
    matches.sort((left, right) => {
      const leftBranch = left.branch_id && left.branch_id === snapshot?.selectedBranchId ? 1 : 0;
      const rightBranch = right.branch_id && right.branch_id === snapshot?.selectedBranchId ? 1 : 0;
      return rightBranch - leftBranch || Number(right.version || 0) - Number(left.version || 0);
    });
    return matches[0];
  };

  const handleBusinessChange = (businessId: string) => {
    setSnapshot(null);
    setSelectedBranchId('');
    setSelectedBusinessId(businessId);
  };

  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId);
    if (selectedBusinessId) void loadCatalog(selectedBusinessId, branchId);
  };

  return (
    <section dir="rtl" className="space-y-5" data-testid="platform-catalog-admin">
      <header className="rounded-3xl bg-gradient-to-l from-slate-950 to-indigo-950 p-6 text-white shadow-lg">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-indigo-200">
              <Package className="h-5 w-5" />
              <span className="text-xs font-black">إدارة المنصة · الكتالوج</span>
            </div>
            <h3 className="mt-2 text-2xl font-black">إدارة الكتالوج والمنتجات</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              مراجعة منتجات وخدمات الأنشطة وأسعارها المسجلة، مع اختيار النشاط والفرع. هذه المرحلة للقراءة والمراجعة فقط.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-black">
            <ShieldCheck className="h-4 w-4 text-emerald-300" />
            قراءة فقط
          </div>
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <label className="block text-xs font-bold text-slate-600">
          النشاط
          <select value={selectedBusinessId} onChange={(event) => handleBusinessChange(event.target.value)} className={'mt-1 ' + inputClass}>
            <option value="">اختر نشاطًا</option>
            {availableBusinesses.map((business) => (
              <option key={business.id} value={business.id}>{business.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-bold text-slate-600">
          الفرع
          <select
            value={selectedBranchId}
            onChange={(event) => handleBranchChange(event.target.value)}
            disabled={!snapshot?.branches?.length || loading}
            className={'mt-1 ' + inputClass}
          >
            {snapshot?.branches?.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name || branch.code || branch.id}</option>
            ))}
            {!snapshot?.branches?.length && <option value="">لا يوجد فرع نشط</option>}
          </select>
        </label>
        <button
          type="button"
          data-testid="platform-catalog-refresh"
          onClick={() => selectedBusinessId && void loadCatalog(selectedBusinessId, selectedBranchId || undefined)}
          disabled={!selectedBusinessId || loading}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} />
          تحديث
        </button>
      </div>

      {availableBusinesses.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-center gap-2 font-black"><AlertCircle className="h-4 w-4" />لا توجد أنشطة مؤسسية محملة</div>
          <p className="mt-1 text-xs leading-5">تعذر عرض المنتجات لأن قائمة الأنشطة المصرح بها غير متاحة في جلسة الإدارة الحالية.</p>
        </div>
      )}

      {error && (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <div className="flex items-center gap-2 font-black"><AlertCircle className="h-4 w-4" />تعذر قراءة الكتالوج</div>
          <p className="mt-1 break-words text-xs leading-5">{error}</p>
        </div>
      )}

      {loading && (
        <div role="status" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm font-bold text-slate-500">
          جارٍ تحميل بيانات الكتالوج من الخادم...
        </div>
      )}

      {!loading && snapshot?.catalogReadiness === 'BRANCH_REQUIRED' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-center gap-2 font-black"><Store className="h-4 w-4" />النشاط يحتاج إلى فرع نشط</div>
          <p className="mt-1 text-xs leading-5">{snapshot.message || 'لا يمكن عرض منتجات قبل إعداد فرع نشط للنشاط.'}</p>
        </div>
      )}

      {!loading && snapshot && snapshot.catalogReadiness !== 'BRANCH_REQUIRED' && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold text-slate-500">إجمالي العناصر</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{items.length.toLocaleString('ar-EG')}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold text-slate-500">منتجات</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{items.filter((item) => String(item.item_type).toUpperCase() !== 'SERVICE').length.toLocaleString('ar-EG')}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold text-slate-500">خدمات</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{items.filter((item) => String(item.item_type).toUpperCase() === 'SERVICE').length.toLocaleString('ar-EG')}</p>
            </article>
            <article className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-bold text-slate-500">نشطة</p>
              <p className="mt-2 text-2xl font-black text-slate-950">{items.filter((item) => String(item.status).toUpperCase() === 'ACTIVE').length.toLocaleString('ar-EG')}</p>
            </article>
          </div>

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h4 className="flex items-center gap-2 font-black text-slate-900"><Building2 className="h-4 w-4 text-indigo-700" />{selectedBusiness?.name || snapshot.business?.name || 'كتالوج النشاط'}</h4>
              <p className="mt-1 text-[11px] text-slate-500">تم تحميل {items.length.toLocaleString('ar-EG')} عنصر كحد الصفحة الحالية من الخادم.</p>
            </div>
            <label className="relative block w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} className={'pr-9 ' + inputClass} placeholder="بحث بالاسم أو الكود" aria-label="بحث في الكتالوج" />
            </label>
          </div>

          {filteredItems.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
              لا توجد منتجات أو خدمات مطابقة للبحث في هذا الفرع.
            </div>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {visibleItems.map((item) => {
                const price = priceForItem(item.id);
                const name = item.name_ar || item.name_en || 'عنصر بدون اسم';
                const kind = String(item.item_type || '').toUpperCase() === 'SERVICE' ? 'خدمة' : 'منتج';
                const status = String(item.status || '').toUpperCase();
                const currency = price?.currency || 'EGP';
                return (
                  <article key={item.id} data-testid="platform-catalog-item-row" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h5 className="break-words font-black text-slate-900">{name}</h5>
                        {item.name_en && item.name_en !== name && <p className="mt-1 text-xs text-slate-500">{item.name_en}</p>}
                        <p className="mt-1 text-[11px] text-slate-500">{kind}{item.sku ? ' · ' + item.sku : ''}</p>
                      </div>
                      <span className={'shrink-0 rounded-lg px-2 py-1 text-[10px] font-black ' + (status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600')}>
                        {status === 'ACTIVE' ? 'نشط' : status === 'INACTIVE' ? 'موقوف' : status || 'غير محدد'}
                      </span>
                    </div>
                    {item.description && <p className="mt-3 line-clamp-2 text-xs leading-5 text-slate-600">{item.description}</p>}
                    <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                      <span className="text-[11px] text-slate-500">السعر الفعال المسجل</span>
                      <strong className="text-sm font-black text-slate-900">{price ? formatPrice(price.unit_price, currency) : 'لا يوجد سعر فعال'}</strong>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          {visibleItems.length < filteredItems.length && (
            <div className="flex justify-center">
              <button
                type="button"
                data-testid="platform-catalog-see-more"
                onClick={() => setVisibleCount((current) => Math.min(filteredItems.length, current + 20))}
                className="rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-black text-slate-800 hover:bg-slate-50"
              >
                رؤية المزيد ({Math.min(filteredItems.length - visibleItems.length, 20).toLocaleString('ar-EG')})
              </button>
            </div>
          )}
        </>
      )}

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-5 text-amber-900">
        تعديل الأسعار وإدارة حالة المنتج غير متاحين من هذا القسم حاليًا. خدمة الخادم توقف تحديث الأسعار لحين إكمال تحقق RC486، كما أن تحقق RPC تغيير حالة المنتج يحتاج مواءمة مصدر صلاحية مالك المنصة قبل فتح أي إجراء كتابي.
      </div>
    </section>
  );
};

export default PlatformCatalogAdmin;
