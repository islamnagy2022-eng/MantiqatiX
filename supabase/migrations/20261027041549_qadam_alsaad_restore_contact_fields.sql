-- Restore Qadam Al-Saad production contact fields without touching catalog items, prices, subscriptions, or orders.
update public.businesses
set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object(
  'phone', '+201011145124',
  'phone_display', '01011145124',
  'whatsapp_number', '201011145124',
  'whatsapp_url', 'https://wa.me/201011145124',
  'address', 'تلا، محافظة المنوفية، مصر',
  'location_label', 'تلا – المنوفية',
  'contact', jsonb_build_object(
    'phone', '+201011145124',
    'whatsapp', '201011145124',
    'address', 'تلا، محافظة المنوفية، مصر'
  ),
  'catalog_profile',
    coalesce(settings->'catalog_profile', '{}'::jsonb) || jsonb_build_object(
      'phone', '+201011145124',
      'phone_display', '01011145124',
      'whatsapp_number', '201011145124',
      'whatsapp_url', 'https://wa.me/201011145124',
      'address', 'تلا، محافظة المنوفية، مصر',
      'location_label', 'تلا – المنوفية',
      'show_prices', true,
      'pricing_display', 'STARTING_PRICE'
    )
),
updated_at = now()
where tenant_id = 'MNTY-PLATFORM'
  and code = 'MNTY-HOMEWARES-QADAM-ALSAAD';