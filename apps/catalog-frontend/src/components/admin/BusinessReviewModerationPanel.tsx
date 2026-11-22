import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, LoaderCircle, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { supabase } from '../../lib/production';

type ModerationReview = {
  reviewId: string;
  businessId: string;
  businessName: string;
  rating: number;
  review: string | null;
  createdAt: string;
  status: 'PENDING';
};

const isModerationReview = (value: unknown): value is ModerationReview => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.reviewId === 'string'
    && typeof row.businessId === 'string'
    && typeof row.businessName === 'string'
    && Number.isInteger(row.rating)
    && Number(row.rating) >= 1
    && Number(row.rating) <= 5
    && (row.review === null || typeof row.review === 'string')
    && typeof row.createdAt === 'string'
    && row.status === 'PENDING';
};

const dateLabel = (value: string): string => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'تاريخ غير متاح'
    : new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
};

export const BusinessReviewModerationPanel: React.FC = () => {
  const [reviews, setReviews] = useState<ModerationReview[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [nextOffset, setNextOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async (offset = 0, append = false) => {
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('get_platform_business_review_moderation_queue', {
        p_limit: 50,
        p_offset: offset,
      });
      if (rpcError) throw rpcError;
      if (!data || typeof data !== 'object') throw new Error('استجابة قائمة المراجعة غير صالحة');
      const result = data as Record<string, unknown>;
      const rows = Array.isArray(result.reviews) ? result.reviews.filter(isModerationReview) : [];
      setReviews((current) => append
        ? [...current, ...rows.filter((row) => !current.some((existing) => existing.reviewId === row.reviewId))]
        : rows);
      setTotalCount(Number.isFinite(Number(result.totalCount)) ? Number(result.totalCount) : rows.length);
      setNextOffset(Number.isFinite(Number(result.nextOffset)) ? Number(result.nextOffset) : offset + rows.length);
    } catch (cause) {
      if (!append) {
        setReviews([]);
        setTotalCount(0);
        setNextOffset(0);
      }
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل قائمة مراجعة التقييمات');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMore = async () => {
    if (loading || loadingMore || nextOffset >= totalCount) return;
    setLoadingMore(true);
    await load(nextOffset, true);
    setLoadingMore(false);
  };

  useEffect(() => { void load(); }, [load]);

  const moderate = async (review: ModerationReview, decision: 'PUBLISHED' | 'REJECTED') => {
    const reason = decision === 'PUBLISHED'
      ? 'تمت مراجعة المحتوى والموافقة على النشر'
      : (reasons[review.reviewId] || '').trim();
    if (decision === 'REJECTED' && !reason) {
      setError('اكتب سبب الرفض قبل تنفيذ القرار');
      return;
    }
    setBusyId(review.reviewId);
    setError('');
    setNotice('');
    try {
      const { error: rpcError } = await supabase.rpc('moderate_business_review', {
        p_review_id: review.reviewId,
        p_decision: decision,
        p_reason: reason,
      });
      if (rpcError) throw rpcError;
      setReviews((current) => current.filter((item) => item.reviewId !== review.reviewId));
      setTotalCount((current) => Math.max(0, current - 1));
      setNextOffset((current) => Math.max(0, current - 1));
      setNotice(decision === 'PUBLISHED' ? 'تم اعتماد التقييم ونشره' : 'تم رفض التقييم مع حفظ سبب القرار');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر حفظ قرار المراجعة');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section dir="rtl" className="space-y-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-slate-900">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            <h2 className="text-lg font-black">مراجعة تقييمات الأنشطة</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">لا يظهر أي تقييم للزوار قبل اعتماده من مدير المنصة.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          تحديث القائمة
        </button>
      </header>

      {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-bold text-rose-800"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
      {notice && <div role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4" />{notice}</div>}

      {loading && reviews.length === 0 ? (
        <div role="status" className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-sm font-bold text-slate-500">
          <LoaderCircle className="h-5 w-5 animate-spin" /> جاري تحميل التقييمات
        </div>
      ) : reviews.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
          <p className="mt-3 text-sm font-black text-slate-800">لا توجد تقييمات في انتظار المراجعة</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <article key={review.reviewId} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-black text-slate-900">{review.businessName}</h3>
                  <p className="mt-1 text-[11px] text-slate-500">{dateLabel(review.createdAt)} · نشاط موثق بالتعامل</p>
                </div>
                <div className="flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-sm font-black text-amber-700">
                  <span>{review.rating}/5</span>
                  <span aria-hidden="true">★</span>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{review.review || 'تقييم بالنجوم دون تعليق نصي'}</p>
              <label className="mt-4 block text-[11px] font-bold text-slate-600">
                سبب الرفض (مطلوب عند الرفض)
                <textarea
                  value={reasons[review.reviewId] || ''}
                  onChange={(event) => setReasons((current) => ({ ...current, [review.reviewId]: event.target.value }))}
                  maxLength={1000}
                  rows={2}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-normal text-slate-800 outline-none focus:border-indigo-400"
                  placeholder="اكتب سببًا واضحًا ومختصرًا عند رفض التقييم"
                />
              </label>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button type="button" disabled={busyId === review.reviewId} onClick={() => void moderate(review, 'REJECTED')} className="inline-flex items-center gap-2 rounded-xl border border-rose-200 px-4 py-2 text-xs font-black text-rose-700 disabled:opacity-50">
                  <XCircle className="h-4 w-4" /> رفض
                </button>
                <button type="button" disabled={busyId === review.reviewId} onClick={() => void moderate(review, 'PUBLISHED')} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50">
                  {busyId === review.reviewId ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} اعتماد ونشر
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {reviews.length > 0 && nextOffset < totalCount && (
        <div className="flex justify-center">
          <button type="button" onClick={() => void loadMore()} disabled={loading || loadingMore} className="rounded-xl border border-slate-200 px-5 py-2.5 text-xs font-black text-slate-700 disabled:opacity-50">
            {loadingMore ? 'جاري تحميل المزيد...' : 'تحميل تقييمات أقدم'}
          </button>
        </div>
      )}
      <p className="flex items-center gap-2 text-[10px] text-slate-400"><Clock3 className="h-3.5 w-3.5" /> يتم الاحتفاظ بسجل قرارات المراجعة داخل سجل التدقيق.</p>
    </section>
  );
};
