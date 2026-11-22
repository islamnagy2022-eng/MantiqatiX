import React, { useEffect, useState } from 'react';
import { MessageSquareText, Star } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/production';

type PublicBusinessReview = {
  reviewId: string;
  rating: number;
  review: string | null;
  createdAt: string;
  businessResponse: string | null;
  respondedAt: string | null;
  verifiedInteraction: true;
};

type PublicReviewSummary = {
  averageRating: number | null;
  reviewCount: number;
  reviews: PublicBusinessReview[];
};

const isPublicReview = (value: unknown): value is PublicBusinessReview => {
  if (!value || typeof value !== 'object') return false;
  const review = value as Record<string, unknown>;
  return typeof review.reviewId === 'string'
    && Number.isInteger(review.rating)
    && Number(review.rating) >= 1
    && Number(review.rating) <= 5
    && typeof review.createdAt === 'string'
    && review.verifiedInteraction === true
    && (review.review === null || typeof review.review === 'string')
    && (review.businessResponse === null || typeof review.businessResponse === 'string')
    && (review.respondedAt === null || typeof review.respondedAt === 'string');
};

const formatReviewDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(date);
};

export const BusinessReviewsPanel: React.FC = () => {
  const { currentBusiness } = useApp();
  const [summary, setSummary] = useState<PublicReviewSummary | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    const businessId = currentBusiness?.id;
    if (!businessId || !currentBusiness?.isVerified || currentBusiness.operationalStatus !== 'ACTIVE' || currentBusiness.isFrozen) {
      setSummary(null);
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);
    setSummary(null);
    void supabase.rpc('get_public_business_review_summary', {
      p_business_id: businessId,
      p_limit: 10,
      p_offset: 0,
    }).then(({ data, error }) => {
      if (!active) return;
      if (error || !data || typeof data !== 'object') {
        setSummary(null);
        return;
      }
      const raw = data as Record<string, unknown>;
      const reviews = Array.isArray(raw.reviews) ? raw.reviews.filter(isPublicReview) : [];
      const reviewCount = Number(raw.reviewCount);
      const averageRating = raw.averageRating === null ? null : Number(raw.averageRating);
      if (!Number.isFinite(reviewCount) || reviewCount < 0
        || (averageRating !== null && (!Number.isFinite(averageRating) || averageRating < 1 || averageRating > 5))) {
        setSummary(null);
        return;
      }
      setSummary({ reviewCount, averageRating, reviews });
    }).catch(() => {
      if (active) setSummary(null);
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => { active = false; };
  }, [currentBusiness?.id, currentBusiness?.isVerified, currentBusiness?.operationalStatus, currentBusiness?.isFrozen]);

  if (!currentBusiness?.isVerified || currentBusiness.operationalStatus !== 'ACTIVE' || currentBusiness.isFrozen || (!summary && !loading)) {
    return null;
  }

  return (
    <section aria-label="تقييمات العملاء الموثقة" data-testid="business-reviews-panel" className="mx-auto mb-10 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="mb-1 flex items-center gap-2 text-slate-900">
              <MessageSquareText className="h-5 w-5 text-emerald-700" />
              <h2 className="text-xl font-black">تقييمات العملاء</h2>
            </div>
            <p className="text-xs text-slate-500">التقييمات المعروضة مرتبطة بطلبات تم تسليمها والتحقق منها</p>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2 text-emerald-900">
            <Star className="h-5 w-5 fill-current" />
            <strong className="text-xl">{summary?.averageRating === null || summary?.averageRating === undefined ? '—' : summary.averageRating.toFixed(1)}</strong>
            <span className="text-xs">({summary?.reviewCount ?? 0} تقييم)</span>
          </div>
        </div>

        {loading || !summary ? (
          <p role="status" className="py-5 text-center text-sm text-slate-500">جارٍ تحميل التقييمات…</p>
        ) : summary.reviews.length === 0 ? (
          <p className="rounded-2xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">لا توجد تقييمات منشورة وموثقة حتى الآن.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {summary.reviews.map((review) => (
              <article key={review.reviewId} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1 text-amber-500" aria-label={`التقييم ${review.rating} من 5`}>
                    {Array.from({ length: 5 }, (_, index) => (
                      <Star key={index} className={`h-4 w-4 ${index < review.rating ? 'fill-current' : 'text-slate-300'}`} />
                    ))}
                  </div>
                  <time dateTime={review.createdAt} className="text-[11px] text-slate-400">{formatReviewDate(review.createdAt)}</time>
                </div>
                {review.review && <p className="whitespace-pre-wrap break-words text-sm leading-7 text-slate-700">{review.review}</p>}
                {review.businessResponse && (
                  <div className="mt-4 rounded-xl border-r-2 border-emerald-500 bg-white p-3">
                    <p className="mb-1 text-xs font-black text-emerald-800">رد النشاط التجاري</p>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{review.businessResponse}</p>
                  </div>
                )}
                <span className="mt-3 inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-800">طلب تم تسليمه</span>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
