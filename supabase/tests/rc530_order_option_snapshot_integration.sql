begin;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
insert into user_memberships(user_id,tenant_id,status,role)
values('10000000-0000-4000-8000-000000000001','tenant-rc530','ACTIVE','CUSTOMER');
insert into businesses(id,tenant_id,status)
values('20000000-0000-4000-8000-000000000001','tenant-rc530','ACTIVE');
insert into marketing_provider_profiles(business_id,status)
values('20000000-0000-4000-8000-000000000001','ACTIVE');
insert into catalog_business_settings(business_id,tenant_id,currency,delivery_fee,tax_inclusive)
values('20000000-0000-4000-8000-000000000001','tenant-rc530','EGP',0,false);
insert into catalog_items(id,tenant_id,business_id,status,branch_id,legacy_ref,name_ar,tax_rate)
values('30000000-0000-4000-8000-000000000001','tenant-rc530','20000000-0000-4000-8000-000000000001','ACTIVE',null,'coffee-rc530','قهوة اختبار',0);
insert into catalog_item_prices(catalog_item_id,tenant_id,status,effective_from,effective_to,branch_id,unit_price,version)
values('30000000-0000-4000-8000-000000000001','tenant-rc530','ACTIVE',now()-interval '1 hour',null,null,50,1);
insert into catalog_item_options(id,catalog_item_id,status,price_delta,name_ar)
values('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','ACTIVE',7.5,'إضافة شوت');

select public.create_order_backend(
 '50000000-0000-4000-8000-000000000001',
 'tenant-rc530',
 '20000000-0000-4000-8000-000000000001',
 null,
 '10000000-0000-4000-8000-000000000001',
 'rc530-option-snapshot-test-0001',
 0,0,0,0,0,'EGP','عميل اختبار','01000000000','عنوان اختبار',
 '[{"catalogItemId":"30000000-0000-4000-8000-000000000001","quantity":2,"selectedOptionIds":["40000000-0000-4000-8000-000000000001"]}]'::jsonb,
 'RC530 test','{}'::jsonb
);

do $$
declare v_snapshot jsonb; v_total numeric; v_hash text;
begin
 select pricing_snapshot,total_amount,pricing_hash into v_snapshot,v_total,v_hash
 from orders where id='50000000-0000-4000-8000-000000000001';
 if v_snapshot->0->'selected_options'->0->>'name' <> 'إضافة شوت' then
   raise exception 'RC530 option label was not preserved in pricing snapshot: %',v_snapshot;
 end if;
 if (v_snapshot->0->'selected_options'->0->>'price_delta')::numeric <> 7.5 then
   raise exception 'RC530 option price delta was not preserved: %',v_snapshot;
 end if;
 if v_total <> 115 then raise exception 'RC530 expected server total 115, got %',v_total; end if;
 if v_hash is null or length(v_hash)<>64 then raise exception 'RC530 expected SHA-256 pricing hash'; end if;
 if (select items_json from orders where id='50000000-0000-4000-8000-000000000001') <> v_snapshot then
   raise exception 'RC530 items_json must match the immutable pricing snapshot';
 end if;
end $$;
rollback;
