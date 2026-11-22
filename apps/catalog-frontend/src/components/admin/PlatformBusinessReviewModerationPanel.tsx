import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, LoaderCircle, ShieldCheck, Star } from 'lucide-react';
import { supabase } from '../../lib/production';

type PendingReview = {
  reviewId: string;
  businessId: string;
  businessName: string;
  rating: number;
  review: string | null;
  createdAt: string;
  status: 'PENDING';
};

const isPendingReview = (value: unknown): value is PendingReview => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.reviewId === 'string'
    && typeof row.businessId === 'string'
    && typeof row.businessName === 'string'
    && Number.isInteger(row.rating)
    && Number(row.rating) >= 1
    && Number(row.rating) <= 5
    && typeof row.createdAt === 'string'
    && row.status === 'PENDING'
    && (row.review === null || typeof row.review === 'string');
};

export const PlatformBusinessReviewModerationPanel: React.FC = () => {
  const [reviews, setReviews] = useState<PendingReview[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('get_platform_business_review_moderation_queue', {
        p_limit: 50,
      });
      if (rpcError) throw rpcError;
      if (!data || typeof data !== 'object') throw new Error('استجابة قائمة المراجعة غير صالحة');
      const raw = data as Record<string, unknown>;
      const rows = Array.isArray(raw.reviews) ? raw.reviews.filter(isPendingReview) : [];
      setReviews(rows);
    } catch (cause) {
      setReviews([]);
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل قائمة التقييمات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const moderate = async (review: PendingReview, decision: 'PUBLISHED' | 'REJECTED' | 'HIDDEN') => {
    const reason = (reasons[review.reviewId] || '').trim();
    if ((decision === 'REJECTED' || decision === 'HIDDEN') && !reason) {
      setError('اكتب سبب الرفض أو الإخفاء أولاً');
      return;
    }
    if (acting) return;
    setActing(review.reviewId);
    setError('');
    setNotice('');
    try {
      const { error: rpcError } = await supabase.rpc('moderate_business_review', {
        p_review_id: review.reviewId,
        p_decision: decision,
        p_reason: reason || null,
      });
      if (rpcError) throw rpcError;
      setNotice(decision === 'PUBLISHED' ? 'تم اعتماد التقييم للنشر' : decision === 'REJECTED' ? 'تم رفض التقييم مع حفظ السبب' : 'تم إخفاء التقييم مع حفظ السبب');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر تنفيذ قرار المراجعة');
    } finally {
      setActing(null);
    }
  };

  return (
    <section dir="rtl" aria-label="مراجعة تقييمات الأنشطة" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-700" /><h3 className="text-lg font-black">مراجعة تقييمات الأنشطة</h3></div>
          <p className="mt-1 text-xs text-slate-500">القائمة تعرض التقييمات المنتظرة فقط دون بيانات تعريف العميل. صلاحية الاعتماد تُراجع في قاعدة البيانات.</p>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-50">تحديث القائمة</button>
      </div>
      {error && <p role="alert" className="mb-3 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      {notice && <p role="status" className="mb-3 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="h-4 w-4" />{notice}</p>}
      {loading ? (
        <p role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />جارٍ تحميل قائمة المراجعة…</p>
      ) : reviews.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">لا توجد تقييمات بانتظار المراجعة.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <article key={review.reviewId} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="font-black text-slate-900">{review.businessName}</p><p className="mt-1 text-[11px] text-slate-500">نشاط {review.businessId.slice(0, 8)} • {new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date(review.createdAt))}</p></div>
                <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-600"><Star className="h-4 w-4 fill-current" />{review.rating} / 5</span>
              </div>
              {review.review && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{review.review}</p>}
              <label htmlFor={`review-moderation-reason-${review.reviewId}`} className="mt-4 block text-xs font-bold text-slate-700">سبب الرفض أو الإخفاء (مطلوب عند اختيار أي منهما)</label>
              <textarea id={`review-moderation-reason-${review.reviewId}`} rows={2} maxLength={1000} value={reasons[review.reviewId] || ''} onChange={(event) => setReasons((previous) => ({ ...previous, [review.reviewId]: event.target.value.slice(0, 1000) }))} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-emerald-600" placeholder="يُحفظ السبب في سجل المراجعة عند الرفض أو الإخفاء" />
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" disabled={acting !== null} onClick={() => void moderate(review, 'PUBLISHED')} className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{acting === review.reviewId ? 'جارٍ التنفيذ…' : 'اعتماد ونشر'}</button>
                <button type="button" disabled={acting !== null} onClick={() => void moderate(review, 'REJECTED')} className="rounded-xl border border-rose-200 px-4 py-2 text-xs font-bold text-rose-700 disabled:opacity-50">رفض</button>
                <button type="button" disabled={acting !== null} onClick={() => void moderate(review, 'HIDDEN')} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">إخفاء</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
