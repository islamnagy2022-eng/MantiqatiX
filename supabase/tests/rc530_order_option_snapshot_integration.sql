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
insert into catalog_items(id,tenant_id,business_id,status,branch_id,legacy_ref,name_ar,tax_rate)
values('30000000-0000-4000-8000-000000000002','tenant-rc530','20000000-0000-4000-8000-000000000001','ACTIVE',null,'tea-rc530','شاي اختبار',0);
insert into catalog_item_prices(catalog_item_id,tenant_id,status,effective_from,effective_to,branch_id,unit_price,version)
values('30000000-0000-4000-8000-000000000002','tenant-rc530','ACTIVE',now()-interval '1 hour',null,null,30,1);
insert into catalog_item_options(id,catalog_item_id,status,price_delta,name_ar)
values
 ('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','ACTIVE',4,'إضافة تخص الشاي'),
 ('40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001','INACTIVE',99,'إضافة متوقفة');

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
declare v_snapshot jsonb; v_total numeric; v_hash text; v_retry jsonb; v_duplicate_rejected boolean:=false;
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
 select public.create_order_backend(
  '50000000-0000-4000-8000-000000000002',
  'tenant-rc530',
  '20000000-0000-4000-8000-000000000001',
  null,
  '10000000-0000-4000-8000-000000000001',
  'rc530-option-snapshot-test-0001',
  0,0,0,0,0,'EGP','عميل اختبار','01000000000','عنوان اختبار',
  '[{"catalogItemId":"30000000-0000-4000-8000-000000000001","quantity":1,"selectedOptionIds":[]}]'::jsonb,
  'RC530 retry','{}'::jsonb
 ) into v_retry;
 if coalesce((v_retry->>'idempotent')::boolean,false) is not true
    or v_retry->>'id' <> '50000000-0000-4000-8000-000000000001'
    or v_retry->'pricing_snapshot' <> v_snapshot then
   raise exception 'RC530 retry must return the original order and original snapshot: %',v_retry;
 end if;

 begin
  perform public.create_order_backend(
   '50000000-0000-4000-8000-000000000003',
   'tenant-rc530',
   '20000000-0000-4000-8000-000000000001',
   null,
   '10000000-0000-4000-8000-000000000001',
   'rc530-option-snapshot-duplicate-0001',
   0,0,0,0,0,'EGP','عميل اختبار','01000000000','عنوان اختبار',
   '[{"catalogItemId":"30000000-0000-4000-8000-000000000001","quantity":1,"selectedOptionIds":["40000000-0000-4000-8000-000000000001","40000000-0000-4000-8000-000000000001"]}]'::jsonb,
   'RC530 duplicate option','{}'::jsonb
  );
 exception when others then
  if position('INVALID_ITEM_OPTIONS' in sqlerrm)>0 then
   v_duplicate_rejected:=true;
  else
   raise;
  end if;
 end;
 if not v_duplicate_rejected then raise exception 'RC530 duplicate option IDs must be rejected'; end if;

 -- Options belonging to a different item or inactive options must never be priced or persisted.
 begin
  perform public.create_order_backend(
   '50000000-0000-4000-8000-000000000004',
   'tenant-rc530',
   '20000000-0000-4000-8000-000000000001',
   null,
   '10000000-0000-4000-8000-000000000001',
   'rc530-option-cross-item-0001',
   0,0,0,0,0,'EGP','عميل اختبار','01000000000','عنوان اختبار',
   '[{"catalogItemId":"30000000-0000-4000-8000-000000000001","quantity":1,"selectedOptionIds":["40000000-0000-4000-8000-000000000002"]}]'::jsonb,
   'RC530 cross-item option','{}'::jsonb
  );
  raise exception 'RC530 must reject an option belonging to another catalog item';
 exception when others then
  if position('INVALID_ITEM_OPTIONS' in sqlerrm)=0 then raise; end if;
 end;

 begin
  perform public.create_order_backend(
   '50000000-0000-4000-8000-000000000005',
   'tenant-rc530',
   '20000000-0000-4000-8000-000000000001',
   null,
   '10000000-0000-4000-8000-000000000001',
   'rc530-option-inactive-0001',
   0,0,0,0,0,'EGP','عميل اختبار','01000000000','عنوان اختبار',
   '[{"catalogItemId":"30000000-0000-4000-8000-000000000001","quantity":1,"selectedOptionIds":["40000000-0000-4000-8000-000000000003"]}]'::jsonb,
   'RC530 inactive option','{}'::jsonb
  );
  raise exception 'RC530 must reject inactive options';
 exception when others then
  if position('INVALID_ITEM_OPTIONS' in sqlerrm)=0 then raise; end if;
 end;
end $;
rollback;
