# Pass 2061–2070 — Anonymous Auth policy matrix recheck
**Date:** 2026-11-24
**Production:** MANTIQATIX FINAL / moyhiluyhjsujhwlyeuu
**Evidence mode:** read-only Supabase Security Advisor + pg_policies + effective table privilege catalog
**Production mutations:** NONE
**Cost boundary:** no paid Supabase branch, no production write, no deployment

## Fresh Security Advisor snapshot
- Advisor observation: 2026-11-24 11:18 UTC.
- Exact findings extracted: 90 `auth_allow_anonymous_sign_ins` table findings across `public` and `storage`.
- This lint means policies apply to a role that may include anonymous Auth sessions; it does not prove that an anonymous user read or changed any row.

## Fresh metadata-only aggregate
The 90 Advisor table identities were joined to live `pg_policies`, `pg_class`, `pg_namespace` and effective ACL checks. No application row values were selected.

| Check | Live result |
|---|---:|
| Advisor-flagged tables | 90 |
| Tables with at least one permissive authenticated policy | 86 |
| Tables with an authenticated restrictive policy mentioning the `is_anonymous` JWT claim | 46 |
| Tables with authenticated permissive policies but no restrictive anonymous-claim policy | 40 |
| Tables with anon/public policy definitions | 8 |
| Tables with effective direct anon SELECT privilege | 5 |
| Tables with effective direct anon INSERT/UPDATE/DELETE privilege | 1 |
| Tables with effective authenticated SELECT privilege | 56 |
| Tables with effective authenticated INSERT/UPDATE/DELETE privilege | 18 |
| Tables without FORCE ROW LEVEL SECURITY | 16 |
| Tables with authenticated write privilege, a permissive authenticated policy, and no restrictive anonymous-claim policy | 7 |

The 90/90 count includes `storage.objects`; earlier public-schema-only counts are not directly comparable. The aggregate is an inventory, not a proof of exploitability.

## Seven priority tables for isolated adversarial tests
The metadata query identified the following seven tables with authenticated write grants and no table-wide restrictive anonymous-claim policy:
- `storage.objects`
- `public.digital_page_sections`
- `public.digital_pages`
- `public.indrive_requests`
- `public.marketing_leads`
- `public.marketing_provider_profiles`
- `public.notifications`

Interpretation must remain per-command and per-policy. Examples from the live definitions:
- `digital_pages` has owner-scoped write policies and a published-page public SELECT policy; it also has an admin policy dependent on the separate platform-admin helper.
- `indrive_requests` has an explicit anonymous-claim condition on its SELECT policy, while its owner INSERT/UPDATE/DELETE predicates are separate and require independent anonymous-session testing.
- `marketing_leads` has requester-bound create/read policies plus a broad CRM-manager SELECT predicate; tenant/business scope remains a distinct issue.
- `marketing_provider_profiles` still has ACTIVE-only public SELECT and a CRM manager SELECT predicate that is not tenant/business scoped. The 19-column base-table projection includes internal owner/settings/path columns. This is a confirmed policy/ACL exposure path, not proof that rows were downloaded.
- `notifications` predicates bind rows to `auth.uid()`; anonymous-session behavior still needs a disposable test.
- `storage.objects` has direct anon write privileges at the SQL grant layer, but the inspected write policies target `authenticated` and no matching anon/public write policy was found. Do not infer a successful anonymous write path from the grant alone.

## Important distinctions
- Direct `anon` role access is not the same as an anonymous Auth session whose JWT role is `authenticated` and `is_anonymous=true`.
- PostgreSQL combines permissive policies with OR and restrictive policies with AND. A policy name or the presence of any claim check is not sufficient; command, role, USING, WITH CHECK, grants and full composition must be reviewed.
- The `is_anonymous` text search is a screening aid, not a semantic proof. Each candidate requires exact expression review and isolated execution tests.
- The 16 tables without FORCE RLS are not automatically exposed; table ownership, service-role access and the API execution role must be accounted for.

## Next no-cost work
1. Keep Production read-only.
2. Continue source-level review and build exact disposable PostgreSQL fixtures/tests in GitHub Actions.
3. Preserve intentional public projections and self-service owner flows.
4. Keep provider-profile column privacy and tenant scoping tracked under issue #928.
5. Defer paid Supabase branch/restore rehearsal until the final release gate.

## Release status
**FULL PLATFORM: BLOCKED / NOT CERTIFIED.** This pass improves the live evidence inventory only. It does not close the 90-table anonymous-session test matrix, P0 Platform Admin, backup/restore, 79-version migration reconciliation, coordinated DB/Edge parity, payment/webhook, or deployed-origin adversarial release gates.
