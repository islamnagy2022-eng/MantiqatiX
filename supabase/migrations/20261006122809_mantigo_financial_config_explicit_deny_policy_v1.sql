
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
