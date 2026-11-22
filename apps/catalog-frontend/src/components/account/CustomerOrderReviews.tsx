import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock3, LoaderCircle, MessageSquareText, PackageCheck, Star } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/production';

type CustomerOrder = {
  id: string;
  status: string;
  created_at: string;
  total_amount: number | string | null;
  items_json: unknown;
};

type ReviewStatus = {
  hasReview: boolean;
  reviewId?: string;
  status?: string;
  rating?: number;
  reviewText?: string | null;
  createdAt?: string;
};

type OrderWithReview = CustomerOrder & {
  reviewStatus: ReviewStatus | null;
};

const orderItemsSummary = (value: unknown): string => {
  if (!Array.isArray(value)) return 'تفاصيل المنتجات غير متاحة';
  const names = value.slice(0, 3).map((item) => {
    if (!item || typeof item !== 'object') return '';
    const row = item as Record<string, unknown>;
    return String(row.name || row.productName || row.title || '').trim();
  }).filter(Boolean);
  return names.length ? names.join('، ') : 'طلب مشتريات';
};

const dateLabel = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'تاريخ غير متاح'
    : new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(date);
};

const amountLabel = (value: number | string | null): string => {
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 2 }).format(amount) + ' ج.م'
    : '—';
};

const statusLabel = (value: string): string => {
  const status = value.toUpperCase();
  if (status === 'DELIVERED') return 'تم التسليم';
  if (status === 'CANCELLED' || status === 'CANCELED') return 'ملغي';
  if (status === 'PENDING') return 'قيد التأكيد';
  if (status === 'PROCESSING') return 'قيد التجهيز';
  if (status === 'SHIPPED' || status === 'OUT_FOR_DELIVERY') return 'خرج للتوصيل';
  return value || 'غير محدد';
};

export const CustomerOrderReviews: React.FC = () => {
  const { authSession } = useApp();
  const userId = authSession.userId;
  const [orders, setOrders] = useState<OrderWithReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [drafts, setDrafts] = useState<Record<string, { rating: number; text: string }>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [success, setSuccess] = useState('');

  const loadOrders = useCallback(async () => {
    if (!userId || !authSession.isAuthenticated) {
      setOrders([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: orderError } = await supabase
        .from('orders')
        .select('id,status,created_at,total_amount,items_json')
        .eq('customer_id', userId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (orderError) throw orderError;

      const ownedOrders = (Array.isArray(data) ? data : []) as CustomerOrder[];
      const withReviewStatus = await Promise.all(ownedOrders.map(async (order): Promise<OrderWithReview> => {
        if (order.status.toUpperCase() !== 'DELIVERED') {
          return { ...order, reviewStatus: { hasReview: false } };
        }
        const { data: reviewData, error: reviewError } = await supabase.rpc('get_customer_business_review_status', {
          p_order_id: order.id,
        });
        if (reviewError) throw reviewError;
        const raw = reviewData && typeof reviewData === 'object' ? reviewData as Record<string, unknown> : {};
        const reviewStatus: ReviewStatus = raw.hasReview === true
          ? {
              hasReview: true,
              reviewId: typeof raw.reviewId === 'string' ? raw.reviewId : undefined,
              status: typeof raw.status === 'string' ? raw.status : undefined,
              rating: Number(raw.rating),
              reviewText: typeof raw.reviewText === 'string' ? raw.reviewText : null,
              createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
            }
          : { hasReview: false };
        return { ...order, reviewStatus };
      }));
      setOrders(withReviewStatus);
    } catch (cause) {
      setOrders([]);
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل سجل الطلبات');
    } finally {
      setLoading(false);
    }
  }, [userId, authSession.isAuthenticated]);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const submitReview = async (order: OrderWithReview) => {
    const draft = drafts[order.id] || { rating: 5, text: '' };
    if (submitting) return;
    setSubmitting(order.id);
    setError('');
    setSuccess('');
    try {
      const { data, error: submitError } = await supabase.rpc('submit_business_review', {
        p_order_id: order.id,
        p_rating: draft.rating,
        p_review_text: draft.text.trim() || null,
      });
      if (submitError) throw submitError;
      const result = data && typeof data === 'object' ? data as Record<string, unknown> : {};
      if (typeof result.reviewId !== 'string') throw new Error('لم يتم تأكيد حفظ التقييم');
      setSuccess('تم إرسال تقييمك بنجاح وسيظهر بعد مراجعة الإدارة');
      await loadOrders();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر إرسال التقييم');
    } finally {
      setSubmitting(null);
    }
  };

  if (!authSession.isAuthenticated || !userId || authSession.role === 'admin') return null;

  return (
    <section dir="rtl" aria-label="طلباتي وتقييماتي" className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-slate-900">
            <PackageCheck className="h-5 w-5 text-emerald-700" />
            <h2 className="text-lg font-black">طلباتي وتقييماتي</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">يمكنك تقييم الطلب بعد تأكيد تسليمه فقط. التقييم لا يظهر للجمهور قبل المراجعة.</p>
        </div>
        <button type="button" onClick={() => void loadOrders()} disabled={loading} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
          تحديث الطلبات
        </button>
      </div>

      {error && <p role="alert" className="mb-3 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      {success && <p role="status" className="mb-3 flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{success}</p>}

      {loading ? (
        <p role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />جارٍ تحميل الطلبات…</p>
      ) : orders.length === 0 ? (
        <div className="rounded-xl bg-slate-50 px-4 py-7 text-center">
          <MessageSquareText className="mx-auto mb-2 h-7 w-7 text-slate-400" />
          <p className="text-sm font-bold text-slate-700">لا توجد طلبات مرتبطة بحسابك حتى الآن</p>
          <p className="mt-1 text-xs text-slate-500">الطلبات المرسلة عبر واتساب فقط لا تظهر هنا ما لم تُسجّل في حسابك.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const delivered = order.status.toUpperCase() === 'DELIVERED';
            const review = order.reviewStatus;
            const draft = drafts[order.id] || { rating: 5, text: '' };
            return (
              <article key={order.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{orderItemsSummary(order.items_json)}</p>
                    <p className="mt-1 text-xs text-slate-500">{dateLabel(order.created_at)} • رقم الطلب {order.id.slice(0, 8)}</p>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-black text-slate-900">{amountLabel(order.total_amount)}</p>
                    <span className={delivered ? 'mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800' : 'mt-1 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600'}>
                      {statusLabel(order.status)}
                    </span>
                  </div>
                </div>

                {review?.hasReview ? (
                  <div className="mt-3 rounded-xl bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-slate-800">تم إرسال تقييمك</span>
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-600"><Star className="h-3.5 w-3.5 fill-current" />{review.rating || '—'} / 5</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{review.status === 'PUBLISHED' ? 'تم نشر التقييم' : review.status === 'REJECTED' ? 'لم تتم الموافقة على التقييم' : review.status === 'HIDDEN' ? 'التقييم غير منشور' : 'بانتظار مراجعة الإدارة'}</p>
                    {review.reviewText && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{review.reviewText}</p>}
                  </div>
                ) : delivered ? (
                  <div className="mt-4 border-t border-slate-100 pt-4">
                    <p className="mb-2 text-sm font-bold text-slate-800">قيّم تجربتك مع هذا الطلب</p>
                    <div className="mb-3 flex items-center gap-1" role="group" aria-label="اختر التقييم من نجمة إلى خمس نجوم">
                      {Array.from({ length: 5 }, (_, index) => {
                        const value = index + 1;
                        return (
                          <button key={value} type="button" onClick={() => setDrafts((prev) => ({ ...prev, [order.id]: { ...draft, rating: value } }))} aria-label={`${value} من 5`} aria-pressed={draft.rating === value} className="rounded p-1">
                            <Star className={draft.rating >= value ? 'h-6 w-6 fill-amber-400 text-amber-400' : 'h-6 w-6 text-slate-300'} />
                          </button>
                        );
                      })}
                    </div>
                    <textarea value={draft.text} onChange={(event) => setDrafts((prev) => ({ ...prev, [order.id]: { ...draft, text: event.target.value.slice(0, 2000) } }))} rows={3} maxLength={2000} placeholder="اكتب رأيك في تجربتك (اختياري)" className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-emerald-600" />
                    <button type="button" onClick={() => void submitReview(order)} disabled={submitting !== null} className="mt-3 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                      {submitting === order.id ? 'جارٍ إرسال التقييم…' : 'إرسال التقييم'}
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-4 w-4" />يمكنك التقييم بعد تأكيد حالة التسليم.</p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
