# RC214 Marketing Security Verification

## Verified against
- Supabase project: moyhiluyhjsujhwlyeuu
- Verification date: 2026-10-02
- Web continuation branch: web-continuation-rc214-marketing
- Edge Function `marketing-lead-create`: deployed and ACTIVE, version 4, JWT verification enabled

## Database findings

The following marketing tables were checked directly in the active Supabase database:

| Table | RLS | FORCE RLS | Policies |
|---|---:|---:|---:|
| marketing_leads | YES | YES | 3 |
| marketing_projects | YES | YES | 1 |
| marketing_provider_profiles | YES | YES | 3 |
| marketing_services | YES | YES | 2 |

Observed policy boundaries:
- marketing_leads: users can create with their own requester_user_id; users can read their own leads; CRM-management roles can read leads.
- marketing_projects: client-side read is limited through the user's active business membership.
- marketing_provider_profiles: active providers are publicly readable; owner/admin boundaries exist for management.
- marketing_services: active services are publicly readable; management is limited to active privileged memberships.

## Lead creation authority

The Web UI no longer inserts marketing_leads directly.

The flow is:
1. authenticated session
2. Edge Function `marketing-lead-create`
3. JWT user resolution on the server
4. input validation
5. active membership lookup
6. explicit business authorization when a business is supplied
7. rejection when multiple active businesses exist without an explicit business selection
8. server-side insert

The backend does not trust a client-supplied business_id without checking it against the actor's active memberships.

## Security Advisor

The current Supabase Security Advisor still reports existing project-level warnings, including intentionally public read-only SECURITY DEFINER delivery functions and leaked-password protection being disabled.

These findings are not silently reclassified as resolved. The public advertisement delivery function is intentionally used by the public homepage and was previously documented as a sanitized public read path.

## Release decision

This verification does NOT certify Production Ready.

## Contract reconciliation
The database check constraint for `marketing_leads.source` accepts `PLATFORM`, `OFFICIAL_MANTIQATIX`, `PARTNER_REFERRAL`, and `OTHER`. The deployed creator now writes `PLATFORM`, matching the existing production contract.

Remaining release evidence still required:
- CI run on the exact candidate
- browser smoke on the candidate
- authenticated customer/provider E2E
- cross-tenant negative tests
- payment/refund E2E
- backup/restore rehearsal
- monitoring/alert delivery verification
- rollback rehearsal
- final production configuration verification
