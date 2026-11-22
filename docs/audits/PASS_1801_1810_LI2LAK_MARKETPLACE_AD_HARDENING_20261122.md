# PASS 1801–1810 — Li2Lak marketplace ad hardening — 2026-11-22

## Scope

Source-level security hardening for the existing Marketplace Home ad delivery path. This pass does not rebuild the marketplace or alter public ad RPC behavior. The existing public RPC remains the approved, active, date-valid and bounded ad source.

## Changes committed to PR #969

1. `6b3386bd140471b4e3f67b120780f3db15257ae3` — reject nonstandard HTTPS ports and local hostname destinations in ad creative/target URLs.
2. `f2411ee059efc0c58c9d4319104e3c39523eec49` — regression coverage for custom ports, localhost and `.local` destinations.
3. `9316c5ddfc7fda4ebe71a998b7dd4d865e5482c4` — correct trailing-dot hostname normalization and reject IP-literal destinations (IPv4/IPv6) for ad creative/target URLs.
4. `820778afa3cf3aae24f9fb3b1f73b608a24cda4a` — regression coverage for IPv4/IPv6 literals and trailing-dot hostnames.

## Current behavior after source changes

- HTTPS is required.
- Embedded username/password, non-default explicit ports, localhost, `.localhost`, `.local`, and IP-literal hosts are rejected.
- Invalid creative URLs discard the ad; invalid target URLs leave a non-clickable creative.
- Existing placement isolation, deduplication and sanitized output behavior remain.
- The trailing-dot hostname normalization now removes a single terminal dot before local-host classification; the returned URL retains the original canonical URL serialization.

## Validation state

- Source regression tests were added.
- Latest PR head after these changes: `820778afa3cf3aae24f9fb3b1f73b608a24cda4a`.
- GitHub exact-head CI had not yet returned completed results at the last check; do not claim test pass until the workflows finish.
- No Production deployment or database mutation occurred.

## Product scope retained

Marketplace Home, verified-first business cards, approved ads and catalog-backed offers already exist. This pass only hardens ad URL handling. General business reviews and video/reels remain separate future product work requiring dedicated provenance/moderation and owner-scoped media architecture. MantiGO ride ratings must not be reused as business reviews.

## Release decision

**PRODUCTION BLOCKED / NOT CERTIFIED.** Existing privacy, authorization, migration, backup/restore and coordinated Edge release gates remain open.
