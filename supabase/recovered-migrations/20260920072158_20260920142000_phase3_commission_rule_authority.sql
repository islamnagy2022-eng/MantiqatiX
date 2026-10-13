
create or replace function public.resolve_commission_rule_backend(
  p_tenant_id varchar,
  p_business_id uuid,
  p_module_id varchar
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r public.commission_rules%rowtype;
begin
  perform public.assert_financial_membership(p_tenant_id);

  select * into r from public.commission_rules
  where tenant_id=p_tenant_id and active=true
    and (business_id=p_business_id or business_id is null)
    and (module_id=p_module_id or module_id is null)
  order by
    case when business_id=p_business_id then 0 else 1 end,
    case when module_id=p_module_id then 0 else 1 end,
    updated_at desc
  limit 1;

  if not found then raise exception 'COMMISSION_RULE_NOT_CONFIGURED'; end if;
  if upper(coalesce(r.rule_type,'PERCENTAGE')) <> 'PERCENTAGE' then
    raise exception 'COMMISSION_RULE_TYPE_UNSUPPORTED_FOR_ORDER_FLOW';
  end if;
  if coalesce(r.percentage,0) < 0 or coalesce(r.percentage,0) > 100 then
    raise exception 'COMMISSION_RULE_INVALID';
  end if;

  return jsonb_build_object('rule_id',r.id,'rate_percent',r.percentage,'rule_type',r.rule_type);
end;
$$;

revoke all on function public.resolve_commission_rule_backend(varchar,uuid,varchar) from public;
grant execute on function public.resolve_commission_rule_backend(varchar,uuid,varchar) to authenticated;
