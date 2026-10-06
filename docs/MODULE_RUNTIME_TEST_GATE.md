# Module Runtime Test Gate

This gate connects every registered module to an existing website runtime surface and declared authoritative data contracts.

## What is automated

CI verifies all 28 registered catalog modules have:
- a unified catalog entry;
- an existing runtime surface;
- all declared authoritative table names represented in the catalog contract.

This is a build/runtime contract test. It does not create production records and does not bypass authentication.

## What remains external

For each transactional module, real isolated testing remains required for:
- Auth/Authz and tenant/business isolation;
- create/read/update lifecycle;
- state transitions and concurrency;
- notifications;
- payment/webhook/settlement where applicable;
- browser/PWA/device/offline behavior.

Those states remain **NOT VERIFIED** until real isolated test identities and runtime/device evidence exist.

## Principle

A new module without a runtime/data contract must fail CI rather than silently becoming a catalog-only feature.
