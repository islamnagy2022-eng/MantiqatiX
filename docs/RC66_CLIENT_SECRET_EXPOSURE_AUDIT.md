# RC66 — Client Secret Exposure & Public Web Configuration Audit

Date: 2026-09-28

## Verified from tracked source

- `web/config.js` exposes the Supabase project URL and an `anon` JWT-format client key. This is a public client credential class and is expected to be used by browser clients; it is not a service-role key.
- The public-web secret validator scans the entire `web` tree for service-role markers, Supabase secret keys, live/test payment secret-key markers, private keys, AWS access-key markers, and GitHub personal-token markers.
- The web configuration validator requires the approved production Supabase URL, an accepted public client-key format, and the `WEBSITE_SUPABASE` data-source marker.
- No service-role key, Paymob secret, webhook secret, private key, or other server credential was found by the tracked-source search used in this checkpoint.

## Important limitation

The validator source is evidence of the intended CI check; this checkpoint does not claim that the validator executed successfully on the current release commit because current GitHub workflow evidence remains unavailable.

## Decision

No client configuration was changed. The current public anon key remains in browser configuration as the intended public credential. Server secrets remain Edge Function environment variables and are not placed in `web/config.js`.

## Remaining release gate

CI execution evidence and repository-history secret scanning still require a verified release environment before final certification.
