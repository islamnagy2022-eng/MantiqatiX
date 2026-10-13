create unique index if not exists uq_commission_transactions_order_id
on public.commission_transactions(order_id);

create or replace function public.preview_commission_backend(
 p_tenant_id varchar,p_business_id uuid,p_module_id varchar,p_gross_amount numeric
) returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.commission_rules%rowtype; v_commission numeric; v_net numeric;
begin
 perform public.assert_financial_membership(p_tenant_id);
 if p_gross_amount is null or p_gross_amount<0 then raise exception 'INVALID_GROSS_AMOUNT'; end if;
 select * into r from public.commission_rules
 where tenant_id=p_tenant_id and active=true
 and (business_id=p_business_id or business_id is null)
 and (module_id=p_module_id or module_id is null)
 order by case when business_id=p_business_id then 0 else 1 end,
          case when module_id=p_module_id then 0 else 1 end,
          updated_at desc limit 1;
 if not found then raise exception 'COMMISSION_RULE_NOT_CONFIGURED'; end if;
 if upper(coalesce(r.rule_type,'PERCENTAGE'))<>'PERCENTAGE' then raise exception 'COMMISSION_RULE_TYPE_UNSUPPORTED_FOR_ORDER_FLOW'; end if;
 if coalesce(r.percentage,0)<0 or coalesce(r.percentage,0)>100 then raise exception 'COMMISSION_RULE_INVALID'; end if;
 v_commission=round(p_gross_amount*coalesce(r.percentage,0)/100,2); v_net=round(p_gross_amount-v_commission,2);
 return jsonb_build_object('rule_id',r.id,'module_id',r.module_id,'rate_percent',r.percentage,'gross_amount',p_gross_amount,'commission_amount',v_commission,'provider_net_amount',v_net);
end $$;
revoke all on function public.preview_commission_backend(varchar,uuid,varchar,numeric) from public,anon;
grant execute on function public.preview_commission_backend(varchar,uuid,varchar,numeric) to authenticated;