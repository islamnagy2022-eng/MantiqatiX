-- Backend-only configuration: deny direct API access even if table grants are changed later.
create policy "mantigo_financial_config_deny_authenticated"
on public.mantigo_financial_config
as restrictive
for all
to authenticated
using (false)
with check (false);

create policy "mantigo_financial_config_deny_anon"
on public.mantigo_financial_config
as restrictive
for all
to anon
using (false)
with check (false);
