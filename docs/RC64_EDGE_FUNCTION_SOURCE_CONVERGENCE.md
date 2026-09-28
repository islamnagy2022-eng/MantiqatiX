# RC64 — Production Edge Function Source Convergence Audit

Date: 2026-09-28

## Live vs tracked result

Production currently has more ACTIVE Edge Functions than the tracked `supabase/functions` tree. The tracked tree currently contains six directories:

- api
- mnty-registration-review
- order-create
- order-status-update
- payment-intent
- settlement-create

Production also contains active functions for payment-webhook, paymob-webhook, business lifecycle, catalog administration, approvals/onboarding, financial journal/settlement, legal services, subscriptions, AI proxy, ERP, SMM gateway, and others.

## Security significance

This is not automatically a vulnerability. Some functions may be legacy, intentionally production-only, generated/deployed from historical sources, or not currently invoked. However, an untracked ACTIVE endpoint cannot be treated as part of a reproducible release until its source and ownership are known.

The previously identified `payment-webhook` is one such endpoint. `paymob-webhook` is also ACTIVE in production but is not currently present in the tracked GitHub tree. The same source-convergence issue applies to several other production functions.

## Decision

No bulk import, deletion, or redeployment was performed. Reconstructing production Edge Function source from partial live snapshots would create the same class of migration/source drift already documented for the database.

The release evidence now explicitly includes **Edge Function source convergence** as a controlled blocker.

## Required closure evidence

For every ACTIVE production function:
1. authoritative source location;
2. exact source version/hash;
3. owner and invocation path;
4. required secrets/configuration;
5. authentication model;
6. dependency on database RPCs/tables;
7. rollback version;
8. tracked release reference.

No production endpoint was removed and no speculative source was committed.
