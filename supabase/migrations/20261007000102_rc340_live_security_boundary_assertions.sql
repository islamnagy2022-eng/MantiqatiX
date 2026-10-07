-- RC340: live production security-boundary assertions.
-- No data mutation. This migration fails closed if critical security contracts drift.

do $$
declare
  v record;
  v_rls boolean;
  v_policies integer;
  v_oid oid;
  v_definer boolean;
  v_anon boolean;
  v_auth boolean;
  v_config text;
begin
  for v in
    select table_name from (values
      ('orders'),('payment_intents'),('user_memberships'),
      ('support_tickets'),('ticket_messages'),('notifications'),
      ('financial_obligations'),('settlement_transactions'),
      ('general_ledger')
    ) x(table_name)
  loop
    select c.relrowsecurity into v_rls
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=v.table_name and c.relkind='r';
    if coalesce(v_rls,false) is not true then
      raise exception 'RC340_RLS_DISABLED:%',v.table_name;
    end if;
    select count(*) into v_policies
    from pg_policy p join pg_class c on c.oid=p.polrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=v.table_name;
    if coalesce(v_policies,0)<1 then
      raise exception 'RC340_RLS_NO_POLICY:%',v.table_name;
    end if;
  end loop;

  for v in
    select * from (values
      ('public.admin_create_global_ad(character varying,text,text,timestamp with time zone,timestamp with time zone)',false,true),
      ('public.create_job_backend(uuid,text,character varying,uuid,text,text,text,text,text,text,text,text)',false,true),
      ('public.create_medical_appointment_backend(uuid,text,uuid,text,bigint,text)',false,true),
      ('public.create_payment_intent_backend(character varying,uuid,numeric,character varying,character varying,character varying,character varying)',false,true),
      ('public.get_mnty_targeted_advertisements(character varying,character varying,character varying,double precision,double precision,character varying,integer)',true,true),
      ('public.mnty_active_membership(character varying,uuid,character varying)',false,true),
      ('public.mnty_can(text,character varying,uuid,character varying)',false,true),
      ('public.mnty_can_platform_admin()',false,true),
      ('public.update_medical_appointment_status_backend(uuid,text,text)',false,true)
    ) x(signature,expected_anon,expected_auth)
  loop
    v_oid:=to_regprocedure(v.signature);
    if v_oid is null then raise exception 'RC340_FUNCTION_MISSING:%',v.signature; end if;
    select p.prosecdef,
           has_function_privilege('anon',p.oid,'EXECUTE'),
           has_function_privilege('authenticated',p.oid,'EXECUTE'),
           coalesce(array_to_string(p.proconfig,','),'')
      into v_definer,v_anon,v_auth,v_config
    from pg_proc p where p.oid=v_oid;
    if v_definer is not true then raise exception 'RC340_NOT_SECURITY_DEFINER:%',v.signature; end if;
    if v_anon is distinct from v.expected_anon then raise exception 'RC340_ANON_GRANT_DRIFT:%',v.signature; end if;
    if v_auth is distinct from v.expected_auth then raise exception 'RC340_AUTH_GRANT_DRIFT:%',v.signature; end if;
    if position('search_path=public, pg_temp' in v_config)=0 then raise exception 'RC340_SEARCH_PATH_DRIFT:%:%',v.signature,v_config; end if;
  end loop;

  select c.relrowsecurity into v_rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='digital_page_payment_events' and c.relkind='r';
  if v_rls is not true then raise exception 'RC340_PAYMENT_EVENTS_RLS_DISABLED'; end if;

  select count(*) into v_policies
  from pg_policy p join pg_class c on c.oid=p.polrelid
  join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='digital_page_payment_events';
  if v_policies<>0 then raise exception 'RC340_PAYMENT_EVENTS_POLICY_DRIFT:%',v_policies; end if;
end
$$;