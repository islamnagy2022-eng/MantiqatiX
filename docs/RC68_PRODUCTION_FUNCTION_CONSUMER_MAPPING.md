# RC68 — Production Function Consumer Mapping

Date: 2026-09-28

## Consumer evidence

Current tracked web source directly references these production functions:

- `order-create` — customer order submission path in `web/app.js`.
- `order-status-update` — order status transition path in `web/app.js`.
- `mnty-registration-review` — administrative registration approval/rejection path in `web/app.js`.
- `smm-gateway` — SMM application path in `web/smm.js`.

`payment-intent` is present in tracked source and is part of the production payment architecture, but the current direct string scan of the selected web files did not establish a browser consumer in the inspected files. This is not evidence that it is unused; it only means the inspected consumer mapping is incomplete.

## Unmapped/production-only surface

The current production inventory contains additional ACTIVE functions that do not appear as direct function names in the inspected tracked web files, including `paymob-webhook`, `payment-webhook`, business/approval functions, legal functions, subscription functions, AI proxy, ERP functions, and others.

These may be invoked by external systems, server-side workflows, or other clients. No deletion or disablement was performed.

## Release implication

A function being absent from the current browser source is not sufficient evidence that it is safe to remove. Production dependencies must be mapped before retirement.

## Required closure matrix

For each ACTIVE function: consumer class (browser/server/provider), invocation URL/path, source commit, production version/hash, authentication model, required secrets, DB/RPC dependencies, and rollback target.

## Status

Consumer mapping is partially established. Production source convergence remains open. No runtime behavior was changed by this checkpoint.
