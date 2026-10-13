alter table public.platform_brand_identity
    add column if not exists customer_service_phone varchar(30),
    add column if not exists social_marketing jsonb not null default '{}'::jsonb;

  update public.platform_brand_identity
  set
    customer_service_phone = '01010171770',
    social_marketing = jsonb_build_object(
      'facebook','approved',
      'instagram','approved',
      'whatsapp','approved',
      'campaign_style','MANTIQATIX official visual identity',
      'headline_style','bold Arabic headlines with concise CTAs',
      'cta_primary','ابدأ الآن',
      'cta_secondary','تواصل معنا',
      'support_label','خدمة العملاء',
      'contact_number','01010171770'
    ),
    version = '1.1.0',
    updated_at = now()
  where brand_key = 'MANTIQATIX';
