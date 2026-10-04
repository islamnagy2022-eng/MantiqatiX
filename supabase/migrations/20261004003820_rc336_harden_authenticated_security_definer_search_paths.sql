-- RC336: harden all authenticated-callable SECURITY DEFINER boundaries.
-- Preserve caller grants and behavior; only pin the execution search path.
alter function public.admin_create_global_ad(varchar,text,text,timestamptz,timestamptz) set search_path=public,pg_temp;
alter function public.create_job_backend(uuid,text,varchar,uuid,text,text,text,text,text,text,text,text) set search_path=public,pg_temp;
alter function public.create_medical_appointment_backend(uuid,text,uuid,text,bigint,text) set search_path=public,pg_temp;
alter function public.create_payment_intent_backend(varchar,uuid,numeric,varchar,varchar,varchar,varchar) set search_path=public,pg_temp;
alter function public.mnty_active_membership(varchar,uuid,varchar) set search_path=public,pg_temp;
alter function public.mnty_can(text,varchar,uuid,varchar) set search_path=public,pg_temp;
alter function public.mnty_can_platform_admin() set search_path=public,pg_temp;
alter function public.update_medical_appointment_status_backend(uuid,text,text) set search_path=public,pg_temp;
