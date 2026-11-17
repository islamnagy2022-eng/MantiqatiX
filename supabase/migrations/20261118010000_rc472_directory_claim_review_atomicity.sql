-- RC472: make public-directory claim review a single transaction.
-- Production preflight (2026-11-18): zero duplicate business-wide membership groups.
-- RC113 source migration is absent from the live migration ledger, so this forward
-- repair installs the null-safe uniqueness invariant without replaying RC113.

CREATE UNIQUE INDEX IF NOT EXISTS ux_user_memberships_user_business_branch_nullsafe
  ON public.user_memberships (user_id, business_id, (COALESCE(branch_id, '')))
  WHERE business_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.review_directory_listing_claim_atomic(
  p_claim_id uuid,
  p_decision text,
  p_actor_id uuid,
  p_review_note text DEFAULT NULL,
  p_business_id uuid DEFAULT NULL,
  p_ownership_verified boolean DEFAULT false,
  p_subscription_paid boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_claim public.directory_listing_claim_requests%ROWTYPE;
  v_listing public.public_directory_listings%ROWTYPE;
  v_business public.businesses%ROWTYPE;
  v_membership public.user_memberships%ROWTYPE;
  v_membership_id text;
  v_permissions jsonb;
  v_decision text := upper(coalesce(p_decision, ''));
  v_rows integer;
BEGIN
  IF p_claim_id IS NULL OR p_actor_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_REVIEW_ARGUMENT';
  END IF;

  SELECT * INTO v_claim
  FROM public.directory_listing_claim_requests
  WHERE id = p_claim_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CLAIM_NOT_FOUND';
  END IF;
  IF v_claim.status NOT IN ('PENDING', 'REVIEWING') THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CLAIM_NOT_PENDING';
  END IF;

  SELECT * INTO v_listing
  FROM public.public_directory_listings
  WHERE id = v_claim.listing_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LISTING_NOT_FOUND';
  END IF;

  IF v_decision = 'REVIEWING' THEN
    UPDATE public.directory_listing_claim_requests
    SET status = 'REVIEWING',
        review_note = nullif(btrim(p_review_note), ''),
        reviewed_by = p_actor_id,
        reviewed_at = pg_catalog.clock_timestamp()
    WHERE id = p_claim_id
      AND status IN ('PENDING', 'REVIEWING');
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CLAIM_STATE_CONFLICT';
    END IF;
    RETURN pg_catalog.jsonb_build_object('success', true, 'status', 'REVIEWING');
  END IF;

  IF v_decision = 'REJECTED' THEN
    UPDATE public.public_directory_listings
    SET claim_status = 'UNCLAIMED',
        claimed_user_id = NULL,
        claimed_business_id = NULL,
        claimed_at = NULL
    WHERE id = v_claim.listing_id
      AND claim_status = 'CLAIM_PENDING'
      AND claimed_user_id = v_claim.user_id;
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LISTING_CLAIM_LOCK_CONFLICT';
    END IF;

    UPDATE public.directory_listing_claim_requests
    SET status = 'REJECTED',
        review_note = nullif(btrim(p_review_note), ''),
        reviewed_by = p_actor_id,
        reviewed_at = pg_catalog.clock_timestamp()
    WHERE id = p_claim_id
      AND status IN ('PENDING', 'REVIEWING');
    GET DIAGNOSTICS v_rows = ROW_COUNT;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CLAIM_STATE_CONFLICT';
    END IF;
    RETURN pg_catalog.jsonb_build_object('success', true, 'status', 'REJECTED');
  END IF;

  IF v_decision <> 'APPROVED' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'INVALID_CLAIM_DECISION';
  END IF;
  IF p_ownership_verified IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'OWNERSHIP_NOT_VERIFIED';
  END IF;
  IF p_subscription_paid IS DISTINCT FROM true THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PAID_SUBSCRIPTION_REQUIRED';
  END IF;
  IF p_business_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BUSINESS_NOT_ACTIVE';
  END IF;

  -- Serialize all claim approvals targeting the same business.
  SELECT * INTO v_business
  FROM public.businesses
  WHERE id = p_business_id
  FOR UPDATE;

  IF NOT FOUND OR v_business.status <> 'ACTIVE' THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BUSINESS_NOT_ACTIVE';
  END IF;
  IF lower(coalesce(v_business.settings -> 'bizcatalog' ->> 'paymentStatus', '')) <> 'paid'
     OR (v_business.settings -> 'bizcatalog' -> 'paymentConfirmedByAdmin') IS DISTINCT FROM 'true'::jsonb THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'PAID_SUBSCRIPTION_REQUIRED';
  END IF;

  IF v_listing.claim_status <> 'CLAIM_PENDING'
     OR v_listing.claimed_user_id IS DISTINCT FROM v_claim.user_id THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LISTING_CLAIM_LOCK_CONFLICT';
  END IF;

  -- Lock current owner rows before evaluating the ownership conflict.
  PERFORM 1
  FROM public.user_memberships
  WHERE business_id = p_business_id
    AND status = 'ACTIVE'
    AND upper(role) IN ('BUSINESS_OWNER', 'OWNER')
  FOR UPDATE;

  IF EXISTS (
    SELECT 1
    FROM public.user_memberships m
    WHERE m.business_id = p_business_id
      AND m.status = 'ACTIVE'
      AND upper(m.role) IN ('BUSINESS_OWNER', 'OWNER')
      AND m.user_id <> v_claim.user_id
      AND coalesce(m.permissions ->> 'auto_assigned_default_owner', 'false') <> 'true'
  ) THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'BUSINESS_ALREADY_HAS_OWNER';
  END IF;

  SELECT * INTO v_membership
  FROM public.user_memberships
  WHERE user_id = v_claim.user_id
    AND business_id = p_business_id
    AND branch_id IS NULL
  FOR UPDATE;

  v_permissions :=
    CASE WHEN pg_catalog.jsonb_typeof(v_membership.permissions) = 'object'
      THEN v_membership.permissions ELSE '{}'::jsonb END
    || pg_catalog.jsonb_build_object(
      'owner', true,
      'catalog', true,
      'catalog_write', true,
      'profile_manage', true,
      'subscription_status', 'PAID',
      'claimed_directory_listing_id', v_claim.listing_id
    );

  IF FOUND THEN
    v_membership_id := v_membership.id;
    UPDATE public.user_memberships
    SET tenant_id = v_business.tenant_id,
        organization_id = v_business.organization_id,
        role = 'BUSINESS_OWNER',
        status = 'ACTIVE',
        permissions = v_permissions
    WHERE id = v_membership_id;
  ELSE
    v_membership_id := 'DIR-CLAIM-' || replace(pg_catalog.gen_random_uuid()::text, '-', '');
    INSERT INTO public.user_memberships
      (id, user_id, tenant_id, organization_id, business_id, branch_id, role, status, permissions)
    VALUES
      (v_membership_id, v_claim.user_id, v_business.tenant_id, v_business.organization_id,
       p_business_id, NULL, 'BUSINESS_OWNER', 'ACTIVE', v_permissions);
  END IF;

  UPDATE public.user_memberships
  SET status = 'INACTIVE'
  WHERE business_id = p_business_id
    AND status = 'ACTIVE'
    AND upper(role) IN ('BUSINESS_OWNER', 'OWNER')
    AND user_id <> v_claim.user_id
    AND permissions ->> 'auto_assigned_default_owner' = 'true';

  UPDATE public.public_directory_listings
  SET claim_status = 'CLAIMED',
      claimed_user_id = v_claim.user_id,
      claimed_business_id = p_business_id,
      claimed_at = pg_catalog.clock_timestamp(),
      last_verified_at = pg_catalog.clock_timestamp(),
      verified_by = p_actor_id,
      outreach_status = 'SUBSCRIBED'
  WHERE id = v_claim.listing_id
    AND claim_status = 'CLAIM_PENDING'
    AND claimed_user_id = v_claim.user_id;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'LISTING_CLAIM_LOCK_CONFLICT';
  END IF;

  UPDATE public.directory_listing_claim_requests
  SET status = 'APPROVED',
      reviewed_by = p_actor_id,
      reviewed_at = pg_catalog.clock_timestamp(),
      review_note = nullif(btrim(p_review_note), ''),
      linked_business_id = p_business_id,
      linked_membership_id = v_membership_id
  WHERE id = p_claim_id
    AND status IN ('PENDING', 'REVIEWING');
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows <> 1 THEN
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'CLAIM_STATE_CONFLICT';
  END IF;

  RETURN pg_catalog.jsonb_build_object(
    'success', true,
    'status', 'APPROVED',
    'membershipId', v_membership_id,
    'businessId', p_business_id
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.review_directory_listing_claim_atomic(uuid,text,uuid,text,uuid,boolean,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_directory_listing_claim_atomic(uuid,text,uuid,text,uuid,boolean,boolean) TO service_role;
