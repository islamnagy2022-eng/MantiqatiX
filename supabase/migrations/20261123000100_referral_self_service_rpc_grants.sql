-- MantiqaTix personal referral foundation.
-- Idempotent so the source migration chain can build this feature even when
-- historical Production referral objects are absent from the current source chain.
CREATE TABLE IF NOT EXISTS public.referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code varchar(32) NOT NULL UNIQUE,
  status varchar(16) NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','SUSPENDED','REVOKED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referral_codes_user_id_key UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS public.referral_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code_id uuid NOT NULL REFERENCES public.referral_codes(id) ON DELETE RESTRICT,
  referral_code varchar(32) NOT NULL,
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  referred_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  status varchar(16) NOT NULL DEFAULT 'REGISTERED'
    CHECK (status IN ('REGISTERED','QUALIFIED','REWARDED','REJECTED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  qualified_at timestamptz,
  rewarded_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT referral_events_referred_user_id_key UNIQUE (referred_user_id),
  CONSTRAINT referral_events_not_self CHECK (referrer_user_id <> referred_user_id)
);

CREATE INDEX IF NOT EXISTS idx_referral_events_referrer_created
  ON public.referral_events(referrer_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_events_code_created
  ON public.referral_events(referral_code_id, created_at DESC);

ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='referral_codes'
      AND policyname='referral_codes_self_read'
  ) THEN
    CREATE POLICY referral_codes_self_read ON public.referral_codes
      FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='referral_events'
      AND policyname='referral_events_self_read'
  ) THEN
    CREATE POLICY referral_events_self_read ON public.referral_events
      FOR SELECT TO authenticated
      USING (
        referrer_user_id = (SELECT auth.uid())
        OR referred_user_id = (SELECT auth.uid())
      );
  END IF;
END
$$;

-- No direct browser-role table access. All writes pass through the two scoped RPCs.
REVOKE ALL ON TABLE public.referral_codes FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.referral_events FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_or_create_my_referral_profile()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_code varchar(32);
  v_status varchar(16);
  v_count bigint;
BEGIN
  IF v_uid IS NULL OR COALESCE(auth.jwt()->>'is_anonymous','false') = 'true' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT code, status INTO v_code, v_status
  FROM public.referral_codes
  WHERE user_id = v_uid
  LIMIT 1;

  IF v_code IS NULL THEN
    v_code := upper(substr(md5(gen_random_uuid()::text || v_uid::text), 1, 16));
    INSERT INTO public.referral_codes(user_id, code)
    VALUES (v_uid, v_code)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT code, status INTO v_code, v_status
    FROM public.referral_codes
    WHERE user_id = v_uid
    LIMIT 1;
  END IF;

  IF v_status <> 'ACTIVE' THEN
    RAISE EXCEPTION 'REFERRAL_CODE_NOT_ACTIVE';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.referral_events
  WHERE referrer_user_id = v_uid AND status <> 'REJECTED';

  RETURN jsonb_build_object(
    'code', v_code,
    'inviteUrl', 'https://mantiqatix.com/join/' || v_code,
    'referralsCount', COALESCE(v_count, 0)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_referral(p_code varchar)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_ref public.referral_codes%rowtype;
  v_event_id uuid;
BEGIN
  IF v_uid IS NULL OR COALESCE(auth.jwt()->>'is_anonymous','false') = 'true' THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;

  SELECT * INTO v_ref
  FROM public.referral_codes
  WHERE code = upper(trim(p_code)) AND status = 'ACTIVE'
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'INVALID_REFERRAL_CODE';
  END IF;

  IF v_ref.user_id = v_uid THEN
    RAISE EXCEPTION 'SELF_REFERRAL_NOT_ALLOWED';
  END IF;

  INSERT INTO public.referral_events(
    referral_code_id, referral_code, referrer_user_id, referred_user_id
  )
  VALUES (v_ref.id, v_ref.code, v_ref.user_id, v_uid)
  ON CONFLICT (referred_user_id) DO NOTHING
  RETURNING id INTO v_event_id;

  IF v_event_id IS NULL THEN
    RETURN jsonb_build_object('accepted', false, 'reason', 'ALREADY_CLAIMED');
  END IF;

  RETURN jsonb_build_object('accepted', true, 'code', v_ref.code);
END;
$function$;

-- SECURITY DEFINER functions are not public endpoints. Explicitly scope execution.
REVOKE ALL ON FUNCTION public.get_or_create_my_referral_profile() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_referral(varchar) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_my_referral_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_referral(varchar) TO authenticated;
