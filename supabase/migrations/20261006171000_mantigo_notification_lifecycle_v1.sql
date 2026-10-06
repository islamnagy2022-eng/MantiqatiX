-- MantiGO notification lifecycle hardening v1
create or replace function public.confirm_mantigo_cash_payment_backend(p_user_id uuid,p_ride_id text)
returns jsonb language plpgsql security definer set search_path=public as $function$
declare v_f public.mantigo_financial_ledger%rowtype; v_rate numeric; v_commission numeric; v_net numeric;
begin
 if p_user_id is null or p_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
 select * into v_f from public.mantigo_financial_ledger where ride_id=p_ride_id for update;
 if not found then raise exception 'FINANCIAL_RECORD_NOT_FOUND'; end if;
 if v_f.customer_id<>p_user_id then raise exception 'CUSTOMER_REQUIRED'; end if;
 if v_f.payment_status in ('PAID','CASH_CONFIRMED') then return jsonb_build_object('ride_id',p_ride_id,'payment_status',v_f.payment_status,'idempotent',true); end if;
 if v_f.payment_status<>'REQUIRED' then raise exception 'INVALID_PAYMENT_STATE'; end if;
 select commission_rate into v_rate from public.mantigo_financial_config where id=true;
 if v_rate is null then raise exception 'MANTIGO_COMMISSION_NOT_CONFIGURED'; end if;
 v_commission:=round(v_f.gross_amount*v_rate/100,2); v_net:=round(v_f.gross_amount-v_commission,2);
 update public.mantigo_financial_ledger set payment_method='CASH',payment_status='CASH_CONFIRMED',commission_rate=v_rate,commission_amount=v_commission,captain_net_amount=v_net,settlement_status='READY',payment_reference='CASH-'||p_ride_id,payment_confirmed_at=now(),updated_at=now() where ride_id=p_ride_id;
 insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result) values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,'MANTIGO_CASH_PAYMENT_CONFIRMED','MANTIGO_FINANCIAL',v_f.id,jsonb_build_object('payment_status','REQUIRED'),jsonb_build_object('payment_status','CASH_CONFIRMED','commission_rate',v_rate,'commission_amount',v_commission,'captain_net_amount',v_net,'settlement_status','READY'),'SUCCESS');
 begin
  insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id) values('NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_f.captain_id,'MANTIGO_PAYMENT','تم تأكيد الدفع','تم تأكيد الدفع النقدي للرحلة ويمكن متابعة التنفيذ.','MANTIGO_RIDE',p_ride_id);
 exception when others then
  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result) values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_user_id,'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',p_ride_id,'{}'::jsonb,jsonb_build_object('notification_type','MANTIGO_PAYMENT','error',sqlerrm),'PARTIAL');
 end;
 return jsonb_build_object('ride_id',p_ride_id,'payment_status','CASH_CONFIRMED','settlement_status','READY','idempotent',false);
end $function$;

create or replace function public.settle_mantigo_captain_backend(p_admin_user_id uuid,p_ride_id text,p_channel text default 'BANK_TRANSFER')
returns jsonb language plpgsql security definer set search_path=public as $function$
declare v_f public.mantigo_financial_ledger%rowtype; v_ride_status text; v_result jsonb;
begin
 if p_admin_user_id is null or p_admin_user_id<>auth.uid() then raise exception 'USER_CONTEXT_MISMATCH'; end if;
 if not exists(select 1 from public.user_memberships where user_id=p_admin_user_id and status='ACTIVE' and upper(role) in ('ADMIN','SUPER_ADMIN','OWNER','BUSINESS_OWNER','ACCOUNTANT','FINANCE_MANAGER','FINANCE')) then raise exception 'FINANCE_ROLE_REQUIRED'; end if;
 select status into v_ride_status from public.mantigo_rides where id=p_ride_id;
 if v_ride_status is null then raise exception 'RIDE_NOT_FOUND'; end if;
 if v_ride_status<>'COMPLETED' then raise exception 'RIDE_NOT_COMPLETED'; end if;
 select * into v_f from public.mantigo_financial_ledger where ride_id=p_ride_id for update;
 if not found then raise exception 'FINANCIAL_RECORD_NOT_FOUND'; end if;
 if v_f.payment_status not in ('PAID','CASH_CONFIRMED') then raise exception 'PAYMENT_NOT_CONFIRMED'; end if;
 if v_f.settlement_status='SETTLED' then return jsonb_build_object('ride_id',p_ride_id,'settlement_status','SETTLED','settlement_reference',v_f.settlement_reference,'idempotent',true); end if;
 if v_f.commission_rate is null then raise exception 'COMMISSION_NOT_LOCKED'; end if;
 v_result:=public.create_settlement_and_post_journal('MGO-SET-'||p_ride_id,'MNTY-PLATFORM','PARTNER',v_f.captain_id::text,v_f.gross_amount,v_f.commission_amount,v_f.captain_net_amount,0,coalesce(nullif(trim(p_channel),''),'BANK_TRANSFER'),p_ride_id,null,'MantiGO captain settlement for ride '||p_ride_id,p_admin_user_id);
 update public.mantigo_financial_ledger set settlement_status='SETTLED',settlement_reference='MGO-SET-'||p_ride_id,updated_at=now() where ride_id=p_ride_id;
 insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result) values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,'MANTIGO_CAPTAIN_SETTLED','MANTIGO_FINANCIAL',v_f.id,jsonb_build_object('settlement_status',v_f.settlement_status),jsonb_build_object('settlement_status','SETTLED','settlement_reference','MGO-SET-'||p_ride_id,'provider_result',v_result),'SUCCESS');
 begin
  insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id) values('NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_f.captain_id,'MANTIGO_SETTLEMENT','تمت التسوية','تمت تسوية مستحقاتك عن رحلة MantiGO بنجاح.','MANTIGO_RIDE',p_ride_id);
 exception when others then
  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result) values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',p_admin_user_id,'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',p_ride_id,'{}'::jsonb,jsonb_build_object('notification_type','MANTIGO_SETTLEMENT','error',sqlerrm),'PARTIAL');
 end;
 return jsonb_build_object('ride_id',p_ride_id,'settlement_status','SETTLED','settlement_reference','MGO-SET-'||p_ride_id,'provider_result',v_result,'idempotent',false);
end $function$;

create or replace function public.mantigo_rate_ride(p_ride_id text,p_rating integer,p_comment text default '')
returns uuid language plpgsql security definer set search_path=public as $function$
declare v_uid uuid:=auth.uid(); v_captain uuid; v_rating_id uuid;
begin
 if v_uid is null then raise exception 'UNAUTHENTICATED'; end if;
 if p_rating not between 1 and 5 then raise exception 'INVALID_RATING'; end if;
 select b.captain_id into v_captain from public.mantigo_rides r join public.mantigo_bids b on b.id=r.accepted_bid_id where r.id=p_ride_id and r.customer_id=v_uid and r.status='COMPLETED';
 if v_captain is null then raise exception 'RIDE_NOT_COMPLETED_OR_NOT_OWNER'; end if;
 insert into public.mantigo_ride_ratings(ride_id,customer_id,captain_id,rating,comment) values(p_ride_id,v_uid,v_captain,p_rating,coalesce(p_comment,'')) on conflict(ride_id,customer_id) do update set rating=excluded.rating,comment=excluded.comment returning id into v_rating_id;
 insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result) values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_uid,'MANTIGO_RIDE_RATED','MANTIGO_RIDE',p_ride_id,'{}'::jsonb,jsonb_build_object('rating',p_rating,'comment',coalesce(p_comment,'')),'SUCCESS');
 begin
  insert into public.notifications(id,tenant_id,user_id,type,title,body,entity_type,entity_id) values('NTF-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_captain,'MANTIGO_RATING','تقييم جديد','تم استلام تقييم جديد لرحلتك على MantiGO.','MANTIGO_RIDE',p_ride_id);
 exception when others then
  insert into public.audit_logs(id,tenant_id,actor_user_id,action,entity_type,entity_id,old_values,new_values,result) values('AUD-MG-'||replace(gen_random_uuid()::text,'-',''),'MNTY-PLATFORM',v_uid,'MANTIGO_NOTIFICATION_FAILED','MANTIGO_RIDE',p_ride_id,'{}'::jsonb,jsonb_build_object('notification_type','MANTIGO_RATING','error',sqlerrm),'PARTIAL');
 end;
 return v_rating_id;
end $function$;