-- Disposable-only stubs for the four helper-dependent SECURITY DEFINER callers.
-- Their signatures mirror live Production; bodies only exercise the shared guard.
-- The test fixture must never be deployed or run against Production.

CREATE OR REPLACE FUNCTION public.admin_create_global_ad(
  p_title character varying,
  p_creative_url text,
  p_target_url text DEFAULT NULL,
  p_start_at timestamp with time zone DEFAULT NULL,
  p_end_at timestamp with time zone DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF NOT public.mnty_can_platform_admin() THEN RAISE EXCEPTION 'PLATFORM_ADMIN_REQUIRED'; END IF;
  RETURN gen_random_uuid();
END
$function$;

CREATE OR REPLACE FUNCTION public.fulfill_digital_page_publish(
  p_actor_user_id uuid,p_order_id uuid,p_page_id uuid
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'USER_CONTEXT_MISMATCH';
  END IF;
  IF NOT public.mnty_can_platform_admin() THEN RAISE EXCEPTION 'PLATFORM_ADMIN_REQUIRED'; END IF;
  RETURN jsonb_build_object('order_id',p_order_id,'page_id',p_page_id,'status','TEST_ONLY');
END
$function$;

CREATE OR REPLACE FUNCTION public.review_mantigo_captain_application(
  p_admin_user_id uuid,p_captain_id uuid,p_decision text,
  p_vehicle_category text DEFAULT NULL,p_vehicle_model text DEFAULT NULL,
  p_vehicle_plate text DEFAULT NULL,p_service_areas jsonb DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF p_admin_user_id IS NULL OR p_admin_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'USER_CONTEXT_MISMATCH';
  END IF;
  IF NOT public.mnty_can_platform_admin() THEN RAISE EXCEPTION 'PLATFORM_ADMIN_REQUIRED'; END IF;
  RETURN jsonb_build_object('captain_id',p_captain_id,'decision',p_decision,'test_only',true);
END
$function$;

CREATE OR REPLACE FUNCTION public.set_mantigo_financial_config_backend(
  p_admin_user_id uuid,p_commission_rate numeric,p_currency text DEFAULT 'EGP'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
BEGIN
  IF p_admin_user_id IS NULL OR p_admin_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'USER_CONTEXT_MISMATCH';
  END IF;
  IF NOT public.mnty_can_platform_admin() THEN RAISE EXCEPTION 'PLATFORM_ADMIN_REQUIRED'; END IF;
  RETURN jsonb_build_object('commission_rate',p_commission_rate,'currency',p_currency,'test_only',true);
END
$function$;

REVOKE ALL ON FUNCTION public.admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone) TO authenticated;
REVOKE ALL ON FUNCTION public.fulfill_digital_page_publish(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fulfill_digital_page_publish(uuid,uuid,uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.review_mantigo_captain_application(uuid,uuid,text,text,text,text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.set_mantigo_financial_config_backend(uuid,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.set_mantigo_financial_config_backend(uuid,numeric,text) TO authenticated;
