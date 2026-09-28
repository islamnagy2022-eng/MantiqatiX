# RC65 — Secrets & Production Configuration Drift Audit

Date: 2026-09-28

## Source review

Tracked payment/settlement source references the following runtime configuration names:

- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY
- PAYMOB_SECRET_KEY
- PAYMOB_INTEGRATION_ID
- PAYMOB_CALLBACK_URL

The payment source defaults the Paymob callback URL to the canonical `paymob-webhook` endpoint when an explicit callback URL is not configured.

The tracked source search does not expose secret values, which is expected. No secret value was read, printed, committed, or changed during this audit.

## Drift finding

`paymob-webhook` is ACTIVE in production but is not present in the current tracked GitHub function tree. Therefore the production Paymob callback implementation cannot yet be matched to a tracked source commit from the current repository evidence.

The same source-convergence limitation applies to other ACTIVE production functions outside the tracked tree.

## Security decision

No secret rotation or configuration mutation was performed. Rotating an unknown production secret without a controlled dependency inventory could break provider callbacks or service authentication.

## Required closure

Before final release certification, each production function must have:
1. tracked authoritative source;
2. documented required environment-variable names;
3. secret ownership and rotation procedure;
4. callback/webhook URL mapping;
5. production version/hash;
6. rollback reference;
7. evidence that no secret is exposed in client source or repository history.

RC65 therefore remains an evidence/convergence gate, not a runtime failure finding.
