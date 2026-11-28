-- Disposable CI replay fixture only. Never use Production Vault values here.
-- The migration creates an hourly pg_cron job that reads these names at execution
-- time. Local replay has no Production secrets, so use harmless placeholders.
do $fixture$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'mnty_catalog_media_cleanup_token') then
    perform vault.create_secret(
      repeat('c', 64),
      'mnty_catalog_media_cleanup_token',
      'Disposable CI-only placeholder for scheduled media cleanup',
      null
    );
  end if;

  if not exists (select 1 from vault.decrypted_secrets where name = 'mnty_media_cleanup_project_url') then
    perform vault.create_secret(
      'https://example.invalid',
      'mnty_media_cleanup_project_url',
      'Disposable CI-only project URL placeholder',
      null
    );
  end if;

  if not exists (select 1 from vault.decrypted_secrets where name = 'mnty_media_cleanup_apikey') then
    perform vault.create_secret(
      'ci-placeholder-public-api-key',
      'mnty_media_cleanup_apikey',
      'Disposable CI-only API key placeholder',
      null
    );
  end if;
end;
$fixture$;
