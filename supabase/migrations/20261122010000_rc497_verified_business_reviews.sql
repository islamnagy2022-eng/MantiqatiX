-- RC497 — verified-interaction business reviews with moderation and business responses.
-- Reviews are backed by a delivered, authenticated customer order. This does not
-- reuse MantiGO ride ratings and does not expose customer identity publicly.

BEGIN;

CREATE TABLE public.business_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id varchar NOT NULL,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE RESTRICT,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE RESTRICT,
  customer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  review_text text,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','PUBLISHED','REJECTED','HIDDEN')),
  moderation_reason text,
  moderated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  moderated_at timestamptz,
  business_response text,
  responded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT business_reviews_one_per_order UNIQUE (order_id),
  CONSTRAINT business_reviews_text_length CHECK (review_text IS NULL OR length(review_text) <= 2000),
  CONSTRAINT business_reviews_moderation_reason_length CHECK (moderation_reason IS NULL OR length(moderation_reason) <= 1000),
  CONSTRAINT business_reviews_response_length CHECK (business_response IS NULL OR length(business_response) <= 1000)
);

CREATE INDEX business_reviews_public_business_created_idx
  ON public.business_reviews (business_id, created_at DESC, id DESC)
  WHERE status = 'PUBLISHED';

CREATE INDEX business_reviews_customer_created_idx
  ON public.business_reviews (customer_id, created_at DESC);

CREATE TABLE public.business_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.business_reviews(id) ON DELETE RESTRICT,
  actor_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  event_type text NOT NULL CHECK (event_type IN ('SUBMITTED','MODERATED','BUSINESS_RESPONDED')),
  previous_status text,
  new_status text,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX business_review_events_review_created_idx
  ON public.business_review_events (review_id, created_at, id);

ALTER TABLE public.business_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_reviews FORCE ROW LEVEL SECURITY;
ALTER TABLE public.business_review_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_review_events FORCE ROW LEVEL SECURITY;

-- Browser roles must use the narrow RPCs below. The event ledger is never
-- directly readable or writable by anon/authenticated/service_role.
REVOKE ALL ON TABLE public.business_reviews FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON TABLE public.business_review_events FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON TABLE public.business_reviews IS
  'RC497: one append-only verified-interaction review per delivered customer order; public output is moderation-gated and identity-free.';
COMMENT ON TABLE public.business_review_events IS
  'RC497: internal append-only audit trail for review submission, moderation and business response.';

CREATE OR REPLACE FUNCTION public.submit_business_review(
  p_order_id uuid,
  p_rating integer,
  p_review_text text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_order public.orders%rowtype;
  v_existing public.business_reviews%rowtype;
  v_review public.business_reviews%rowtype;
  v_text text := nullif(btrim(coalesce(p_review_text, '')), '');
BEGIN
  IF v_actor IS NULL OR coalesce(auth.jwt()->>'is_anonymous', 'false') = 'true' THEN
    RAISE EXCEPTION 'AUTHENTICATED_CUSTOMER_REQUIRED';
  END IF;
  IF p_order_id IS NULL OR p_rating IS NULL OR p_rating < 1 OR p_rating > 5
     OR length(coalesce(p_review_text, '')) > 2000 THEN
    RAISE EXCEPTION 'INVALID_BUSINESS_REVIEW';
  END IF;

  SELECT o.* INTO v_order
    FROM public.orders o
   WHERE o.id = p_order_id
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;
  IF v_order.customer_id IS DISTINCT FROM v_actor THEN
    RAISE EXCEPTION 'BUSINESS_REVIEW_FORBIDDEN';
  END IF;
  IF upper(coalesce(v_order.status, '')) <> 'DELIVERED' THEN
    RAISE EXCEPTION 'ORDER_NOT_DELIVERED';
  END IF;
  IF v_order.business_id IS NULL OR v_order.tenant_id IS NULL
     OR coalesce(v_order.total_amount, 0) <= 0
     OR jsonb_typeof(v_order.items_json) <> 'array'
     OR jsonb_array_length(v_order.items_json) = 0 THEN
    RAISE EXCEPTION 'ORDER_NOT_REVIEWABLE';
  END IF;

  SELECT r.* INTO v_existing
    FROM public.business_reviews r
   WHERE r.order_id = v_order.id
   FOR UPDATE;

  IF FOUND THEN
    IF v_existing.customer_id IS DISTINCT FROM v_actor THEN
      RAISE EXCEPTION 'BUSINESS_REVIEW_FORBIDDEN';
    END IF;
    IF v_existing.rating = p_rating AND v_existing.review_text IS NOT DISTINCT FROM v_text THEN
      RETURN jsonb_build_object(
        'reviewId', v_existing.id,
        'status', v_existing.status,
        'idempotent', true
      );
    END IF;
    RAISE EXCEPTION 'REVIEW_ALREADY_SUBMITTED';
  END IF;

  INSERT INTO public.business_reviews (
    tenant_id, business_id, order_id, customer_id, rating, review_text
  ) VALUES (
    v_order.tenant_id, v_order.business_id, v_order.id, v_actor, p_rating, v_text
  )
  RETURNING * INTO v_review;

  INSERT INTO public.business_review_events (
    review_id, actor_user_id, event_type, new_status
  ) VALUES (
    v_review.id, v_actor, 'SUBMITTED', 'PENDING'
  );

  RETURN jsonb_build_object(
    'reviewId', v_review.id,
    'status', v_review.status,
    'idempotent', false
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.moderate_business_review(
  p_review_id uuid,
  p_decision text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_review public.business_reviews%rowtype;
  v_decision text := upper(btrim(coalesce(p_decision, '')));
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF v_actor IS NULL OR coalesce(auth.jwt()->>'is_anonymous', 'false') = 'true' THEN
    RAISE EXCEPTION 'AUTHENTICATED_PLATFORM_ADMIN_REQUIRED';
  END IF;
  IF v_decision NOT IN ('PUBLISHED','REJECTED','HIDDEN')
     OR length(coalesce(p_reason, '')) > 1000 THEN
    RAISE EXCEPTION 'INVALID_REVIEW_MODERATION';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM private.platform_admins pa WHERE pa.user_id = v_actor
  ) THEN
    RAISE EXCEPTION 'PLATFORM_ADMIN_REQUIRED';
  END IF;

  SELECT r.* INTO v_review
    FROM public.business_reviews r
   WHERE r.id = p_review_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BUSINESS_REVIEW_NOT_FOUND'; END IF;

  UPDATE public.business_reviews
     SET status = v_decision,
         moderation_reason = v_reason,
         moderated_by = v_actor,
         moderated_at = now(),
         updated_at = now()
   WHERE id = v_review.id
  RETURNING * INTO v_review;

  INSERT INTO public.business_review_events (
    review_id, actor_user_id, event_type, previous_status, new_status, reason
  ) VALUES (
    v_review.id, v_actor, 'MODERATED', v_review.status, v_decision, v_reason
  );

  RETURN jsonb_build_object('reviewId', v_review.id, 'status', v_review.status);
END;
$function$;

CREATE OR REPLACE FUNCTION public.respond_to_business_review(
  p_review_id uuid,
  p_response text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_actor uuid := auth.uid();
  v_review public.business_reviews%rowtype;
  v_response text := nullif(btrim(coalesce(p_response, '')), '');
BEGIN
  IF v_actor IS NULL OR coalesce(auth.jwt()->>'is_anonymous', 'false') = 'true' THEN
    RAISE EXCEPTION 'AUTHENTICATED_BUSINESS_MEMBER_REQUIRED';
  END IF;
  IF p_review_id IS NULL OR v_response IS NULL OR length(v_response) > 1000 THEN
    RAISE EXCEPTION 'INVALID_BUSINESS_REVIEW_RESPONSE';
  END IF;

  SELECT r.* INTO v_review
    FROM public.business_reviews r
   WHERE r.id = p_review_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'BUSINESS_REVIEW_NOT_FOUND'; END IF;
  IF v_review.status <> 'PUBLISHED' THEN
    RAISE EXCEPTION 'REVIEW_NOT_PUBLIC';
  END IF;
  IF v_review.business_response IS NOT NULL THEN
    RAISE EXCEPTION 'BUSINESS_REVIEW_ALREADY_ANSWERED';
  END IF;
  IF NOT EXISTS (
    SELECT 1
      FROM public.user_memberships m
     WHERE m.user_id = v_actor
       AND m.tenant_id = v_review.tenant_id
       AND m.status = 'ACTIVE'
       AND (
         (m.business_id = v_review.business_id
          AND upper(m.role::text) IN ('OWNER','BUSINESS_OWNER','ADMIN','MANAGER'))
         OR
         (m.business_id IS NULL
          AND upper(m.role::text) = 'OWNER')
       )
  ) THEN
    RAISE EXCEPTION 'BUSINESS_REVIEW_RESPONSE_FORBIDDEN';
  END IF;

  UPDATE public.business_reviews
     SET business_response = v_response,
         responded_by = v_actor,
         responded_at = now(),
         updated_at = now()
   WHERE id = v_review.id
  RETURNING * INTO v_review;

  INSERT INTO public.business_review_events (
    review_id, actor_user_id, event_type
  ) VALUES (
    v_review.id, v_actor, 'BUSINESS_RESPONDED'
  );

  RETURN jsonb_build_object('reviewId', v_review.id, 'respondedAt', v_review.responded_at);
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_business_review_summary(
  p_business_id uuid,
  p_limit integer DEFAULT 10,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_count integer := 0;
  v_average numeric;
  v_reviews jsonb := '[]'::jsonb;
  v_limit integer := least(greatest(coalesce(p_limit, 10), 1), 20);
  v_offset integer := least(greatest(coalesce(p_offset, 0), 0), 500);
BEGIN
  IF p_business_id IS NULL THEN RAISE EXCEPTION 'BUSINESS_ID_REQUIRED'; END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.businesses b
      JOIN public.marketing_provider_profiles pp
        ON pp.business_id = b.id AND pp.status = 'ACTIVE' AND pp.is_verified = true
     WHERE b.id = p_business_id AND upper(coalesce(b.status, '')) = 'ACTIVE'
  ) THEN
    RETURN jsonb_build_object(
      'businessId', p_business_id,
      'averageRating', NULL,
      'reviewCount', 0,
      'reviews', '[]'::jsonb
    );
  END IF;

  SELECT count(*)::integer, round(avg(r.rating)::numeric, 2)
    INTO v_count, v_average
    FROM public.business_reviews r
   WHERE r.business_id = p_business_id
     AND r.status = 'PUBLISHED';

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'reviewId', page.id,
        'rating', page.rating,
        'review', page.review_text,
        'createdAt', page.created_at,
        'businessResponse', page.business_response,
        'respondedAt', page.responded_at,
        'verifiedInteraction', true
      )
      ORDER BY page.created_at DESC, page.id DESC
    ),
    '[]'::jsonb
  )
    INTO v_reviews
    FROM (
      SELECT r.id, r.rating, r.review_text, r.created_at,
             r.business_response, r.responded_at
        FROM public.business_reviews r
       WHERE r.business_id = p_business_id
         AND r.status = 'PUBLISHED'
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT v_limit OFFSET v_offset
    ) page;

  RETURN jsonb_build_object(
    'businessId', p_business_id,
    'averageRating', v_average,
    'reviewCount', v_count,
    'reviews', v_reviews
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_business_review(uuid, integer, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.moderate_business_review(uuid, text, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.respond_to_business_review(uuid, text) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.get_public_business_review_summary(uuid, integer, integer) FROM PUBLIC, service_role;

GRANT EXECUTE ON FUNCTION public.submit_business_review(uuid, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderate_business_review(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_business_review(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_business_review_summary(uuid, integer, integer) TO anon, authenticated;

COMMENT ON FUNCTION public.submit_business_review(uuid, integer, text) IS
  'RC497: authenticated customer may submit one immutable review only for their own DELIVERED order.';
COMMENT ON FUNCTION public.moderate_business_review(uuid, text, text) IS
  'RC497: moderation requires direct membership in private.platform_admins; tenant roles do not grant global moderation.';
COMMENT ON FUNCTION public.respond_to_business_review(uuid, text) IS
  'RC497: active owner/business-owner/admin/manager may post one response to a published review for their business.';
COMMENT ON FUNCTION public.get_public_business_review_summary(uuid, integer, integer) IS
  'RC497: public, bounded, identity-free summary and page of published reviews for active verified businesses only.';

COMMIT;
