import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, LoaderCircle, MessageSquareText, Send, Star } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/production';

type ReviewRow = {
  reviewId: string;
  rating: number;
  review: string | null;
  createdAt: string;
  businessResponse: string | null;
  respondedAt: string | null;
  verifiedInteraction: true;
};

const isReviewRow = (value: unknown): value is ReviewRow => {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.reviewId === 'string'
    && Number.isInteger(row.rating)
    && Number(row.rating) >= 1
    && Number(row.rating) <= 5
    && typeof row.createdAt === 'string'
    && row.verifiedInteraction === true
    && (row.review === null || typeof row.review === 'string')
    && (row.businessResponse === null || typeof row.businessResponse === 'string')
    && (row.respondedAt === null || typeof row.respondedAt === 'string');
};

export const BusinessReviewManagementPanel: React.FC = () => {
  const { currentBusiness } = useApp();
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [average, setAverage] = useState<number | null>(null);
  const [count, setCount] = useState(0);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!currentBusiness?.id || !currentBusiness.isVerified || currentBusiness.operationalStatus !== 'ACTIVE' || currentBusiness.isFrozen) {
      setReviews([]);
      setAverage(null);
      setCount(0);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data, error: rpcError } = await supabase.rpc('get_public_business_review_summary', {
        p_business_id: currentBusiness.id,
        p_limit: 20,
        p_offset: 0,
      });
      if (rpcError) throw rpcError;
      if (!data || typeof data !== 'object') throw new Error('استجابة التقييمات غير صالحة');
      const result = data as Record<string, unknown>;
      const rows = Array.isArray(result.reviews) ? result.reviews.filter(isReviewRow) : [];
      const reviewCount = Number(result.reviewCount);
      const averageRating = result.averageRating === null ? null : Number(result.averageRating);
      if (!Number.isFinite(reviewCount) || reviewCount < 0
        || (averageRating !== null && (!Number.isFinite(averageRating) || averageRating < 1 || averageRating > 5))) {
        throw new Error('بيانات ملخص التقييمات غير صالحة');
      }
      setReviews(rows);
      setCount(reviewCount);
      setAverage(averageRating);
    } catch (cause) {
      setReviews([]);
      setCount(0);
      setAverage(null);
      setError(cause instanceof Error ? cause.message : 'تعذر تحميل التقييمات');
    } finally {
      setLoading(false);
    }
  }, [currentBusiness?.id, currentBusiness?.isVerified, currentBusiness?.operationalStatus, currentBusiness?.isFrozen]);

  useEffect(() => { void load(); }, [load]);

  const respond = async (reviewId: string) => {
    const response = (drafts[reviewId] || '').trim();
    if (!response || response.length > 1000 || saving) return;
    setSaving(reviewId);
    setError('');
    setNotice('');
    try {
      const { error: rpcError } = await supabase.rpc('respond_to_business_review', {
        p_review_id: reviewId,
        p_response: response,
      });
      if (rpcError) throw rpcError;
      setNotice('تم نشر رد النشاط بنجاح');
      setDrafts((previous) => ({ ...previous, [reviewId]: '' }));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'تعذر نشر الرد');
    } finally {
      setSaving(null);
    }
  };

  if (!currentBusiness?.isVerified || currentBusiness.operationalStatus !== 'ACTIVE' || currentBusiness.isFrozen) {
    return (
      <section dir="rtl" className="rounded-2xl border border-slate-200 bg-white p-6">
        <h3 className="font-black text-slate-900">تقييمات العملاء</h3>
        <p className="mt-2 text-sm text-slate-500">تظهر إدارة الردود بعد توثيق النشاط وتفعيله ونشر التقييمات المعتمدة.</p>
      </section>
    );
  }

  return (
    <section dir="rtl" aria-label="إدارة تقييمات النشاط" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><MessageSquareText className="h-5 w-5 text-emerald-700" /><h3 className="text-lg font-black">تقييمات العملاء والردود</h3></div>
          <p className="mt-1 text-xs text-slate-500">يمكنك الرد مرة واحدة على كل تقييم منشور. لا تظهر بيانات هوية العميل.</p>
        </div>
        <div className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-900">
          <Star className="ml-1 inline h-4 w-4 fill-current" />{average === null ? '—' : average.toFixed(1)} • {count} تقييم
        </div>
      </div>

      {error && <p role="alert" className="mb-3 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      {notice && <p role="status" className="mb-3 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      {loading ? (
        <p role="status" className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />جارٍ تحميل التقييمات…</p>
      ) : reviews.length === 0 ? (
        <p className="rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">لا توجد تقييمات منشورة للنشاط حتى الآن.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <article key={review.reviewId} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1 text-amber-500" aria-label={`التقييم ${review.rating} من 5`}>
                  {Array.from({ length: 5 }, (_, index) => <Star key={index} className={index < review.rating ? 'h-4 w-4 fill-current' : 'h-4 w-4 text-slate-300'} />)}
                </div>
                <time dateTime={review.createdAt} className="text-[11px] text-slate-400">{new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date(review.createdAt))}</time>
              </div>
              {review.review && <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{review.review}</p>}
              {review.businessResponse ? (
                <div className="mt-3 rounded-xl border-r-2 border-emerald-500 bg-emerald-50/50 p-3">
                  <p className="text-xs font-black text-emerald-800">رد النشاط</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{review.businessResponse}</p>
                </div>
              ) : (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <label className="mb-2 block text-xs font-bold text-slate-700" htmlFor={`business-review-response-${review.reviewId}`}>اكتب رد النشاط</label>
                  <textarea id={`business-review-response-${review.reviewId}`} rows={3} maxLength={1000} value={drafts[review.reviewId] || ''} onChange={(event) => setDrafts((previous) => ({ ...previous, [review.reviewId]: event.target.value.slice(0, 1000) }))} className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-emerald-600" placeholder="اكتب ردًا مهنيًا على التقييم" />
                  <button type="button" onClick={() => void respond(review.reviewId)} disabled={saving !== null || !(drafts[review.reviewId] || '').trim()} className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                    {saving === review.reviewId ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    {saving === review.reviewId ? 'جارٍ النشر…' : 'نشر الرد'}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
      <p className="mt-4 text-[11px] text-slate-400">يتم التحقق من صلاحية الرد داخل قاعدة البيانات عند كل إرسال؛ إخفاء عناصر الواجهة ليس وسيلة تفويض.</p>
    </section>
  );
};
