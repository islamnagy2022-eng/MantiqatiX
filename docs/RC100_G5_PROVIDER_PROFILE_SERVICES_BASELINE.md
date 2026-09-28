# RC100 — G5 Provider Profile, Services & Location Baseline

## Verified existing model
The production schema already contains:
- `marketing_provider_profiles`
- `marketing_services`
- `marketing_provider_services`

The provider profile contains:
- owner
- business
- Arabic/English name
- slug
- description
- specialties
- `service_areas`
- portfolio
- status
- verification state
- featured/ranking fields
- profile image path.

There is no dedicated generic provider-availability/location table in the current public schema review. Therefore G5 does **not** invent a parallel location/schedule model.

## Implemented
### Provider services security hardening
The previous RLS state allowed broad authenticated `ALL` access on `marketing_provider_services`. This was narrowed to provider ownership:
- provider service writes are allowed only when the authenticated user owns the referenced `marketing_provider_profiles` row;
- active provider services remain publicly readable.

The `marketing_services` master catalog remains publicly readable for ACTIVE rows, while mutation is restricted to active `SUPER_ADMIN/ADMIN/OWNER` memberships.

### Provider workspace data
The authenticated provider workspace now loads its existing `marketing_provider_services` rows through the provider profile ownership path. No second service catalog was introduced.

### Location boundary
Current provider location/service-area data uses the existing `service_areas` profile field. No continuous tracking was added. No coordinates were treated as verified merely because they exist.

## Security verification
Production DB policy review confirms:
- provider-service public SELECT is limited to ACTIVE;
- provider-service ALL is owner-scoped through provider profile ownership;
- master service catalog mutation is restricted to SUPER_ADMIN/ADMIN/OWNER;
- provider profile mutation remains owner-scoped.

## Not yet verified
- Real provider browser E2E for adding/editing/removing a service.
- Real provider browser E2E for service-area editing.
- Dedicated availability/schedule workflow, because no dedicated generic availability table was found in the reviewed schema.
- Location permission/device E2E.
- Cross-provider service isolation with two real accounts.
- Full production release gate.

## Release status
**G5 = security implementation + production database verification completed.**
**G5 is not fully E2E verified.**

## Commits
- `fa1433e370e2f2f323b5edc834d98cdbb4a5890b` — RLS hardening
- `f7ad54a508269008739b4a587fd66aff072b0c7c` — provider service data loading
