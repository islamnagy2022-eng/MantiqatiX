-- Publish contact details for the platform-managed MantiqatiX marketing page.
-- Safe to replay; does not create prices or alter subscription/payment state.
update public.businesses
set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
  'phone', '+201010171770',
  'phone_display', '01010171770',
  'whatsapp_number', '201010171770',
  'whatsapp_url', 'https://wa.me/201010171770',
  'manager_email', 'islam.nagy2022@gmail.com',
  'contact', jsonb_build_object(
    'phone', '+201010171770',
    'whatsapp', '201010171770',
    'manager_email', 'islam.nagy2022@gmail.com'
  ),
  'catalog_profile',
    coalesce(settings->'catalog_profile', '{}'::jsonb) || jsonb_build_object(
      'phone', '+201010171770',
      'phone_display', '01010171770',
      'whatsapp_number', '201010171770',
      'whatsapp_url', 'https://wa.me/201010171770',
      'manager_email', 'islam.nagy2022@gmail.com',
      'show_prices', false,
      'pricing_display', 'CONTACT_FOR_QUOTE',
      'services_without_pricing', true
    )
),
updated_at = now()
where tenant_id = 'MNTY-PLATFORM'
  and code = 'MNTY-MARKETING';
