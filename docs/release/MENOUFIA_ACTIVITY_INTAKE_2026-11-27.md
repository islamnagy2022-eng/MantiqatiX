# Menoufia activity intake template — 27 November 2026

## What was added

A blank CSV workbook is available at:

`apps/catalog-frontend/public/templates/menoufia-activity-intake-template.csv`

It contains **600 blank intake rows**: the 50 canonical activity categories crossed with the 12 Menoufia administrative district/city records in the platform's geographic dataset. Each row carries the canonical group/category IDs and the specialty options for that activity.

The admin directory screen exposes the download. New directory entry forms default to Menoufia and use the canonical governorate/district lists rather than free-typed geographic names. Activity modules preserve the governorate label and give an explicit empty state where no listing is available.

## CSV fields

The template carries the governorate and district IDs, functional group, activity category, specialty options, entity name, listing type, specialty, contact fields, address, source name and URL, source-check date, permission basis, internal permission-evidence reference, owner submission consent, contact-publication consent, publication status, and verification status.

Only taxonomy and administrative geography fields are prefilled. Business names, phone numbers, addresses, source details, and evidence references remain blank. Every row defaults to:

- `listing_status = DRAFT`
- `verification_status = UNVERIFIED`
- `owner_submission_consent = NOT_GIVEN`
- `contact_public_consent = NOT_GIVEN`

This file is a collection/review template, **not a live bulk-import endpoint** and not a set of real business records.

## Geographic data attribution

Administrative geography comes from the platform's pinned Open Admin Data Egypt Administrative Divisions release (`2026.09`, source commit `76b47b22872288c0d8b0c757975980e6986945e8`), marked `CC-BY-4.0`. Its representative points are not legal boundaries. Source metadata remains in `apps/catalog-frontend/src/data/egyptGeoDiscovery.ts`.

## Source rights and current publication gate

Do not copy records, contact data, descriptions, or photographs from third-party directories unless their license or written permission explicitly permits the intended reuse. Owner-provided records must carry the owner's submission/republication permission; public contact fields require their own recorded consent.

The public unclaimed directory remains disabled. The production contact-consent registry migration is not yet applied, and there are no approved commercial-republication evidence records for the discovered third-party directories. Do not enable `DIRECTORY_LISTINGS_ENABLED`, deploy a new directory Edge bundle, import scraped rows, or publish entries as a shortcut. The template is ready for lawful owner-provided/licensed data while those release requirements are resolved.

## Validation

`scripts/validate-menoufia-activity-intake-template.mjs` verifies:
- 10 canonical functional groups and 50 canonical activity categories;
- 12 Menoufia district/city records and 600 unique category/district combinations;
- blank business/source/contact values, draft/unverified defaults, and no fabricated entries;
- the admin download link and governorate selector;
- continued closed public-listing release gates.
