-- Preserve existing marketing-service images when their provenance was not recorded.
-- Only generate an automatic image for rows that genuinely have no image.
-- This is intentionally additive and does not overwrite owner-provided URLs.

update public.marketing_services
set image_source = 'owner'
where nullif(trim(coalesce(image_url,'')),'') is not null
  and nullif(trim(coalesce(image_source,'')),'') is null;

update public.marketing_services
set image_url = public.mnty_default_image_url(
      name_ar,
      coalesce(description,name_en),
      category_code,
      'service'
    ),
    image_source = 'auto'
where nullif(trim(coalesce(image_url,'')),'') is null;
