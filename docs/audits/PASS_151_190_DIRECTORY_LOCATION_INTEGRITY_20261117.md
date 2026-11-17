# Pass 151–190 — Directory location integrity
Date: 2026-11-17
Branch: `security/public-contact-consent-current-main-20261117`
PR: #756

## Pass ledger

### 151–160 — Reproduction and impact
- Pass 151: re-opened the current-main directory admin form and identified its initial location values.
- Pass 152: confirmed new entries defaulted to `المنوفية`.
- Pass 153: confirmed new entries defaulted to `بركة السبع`.
- Pass 154: confirmed editing records with missing locality also injected those same defaults.
- Pass 155: confirmed the two fields were not marked required in the admin form.
- Pass 156: traced the values into the authenticated `saveDirectoryListing` request.
- Pass 157: confirmed the Edge Function independently repeated the same governorate fallback.
- Pass 158: confirmed the Edge Function independently repeated the same district fallback.
- Pass 159: checked the original table migration: both columns are NOT NULL and have the same historical defaults.
- Pass 160: determined the safe API behavior is to reject missing location rather than silently assign a different real place.

### 161–170 — Frontend correction
- Pass 161: changed the new-entry governorate default to an empty value.
- Pass 162: changed the new-entry district default to an empty value.
- Pass 163: removed the fallback governorate when loading an existing record into the form.
- Pass 164: removed the fallback district when loading an existing record into the form.
- Pass 165: made governorate a required browser form field.
- Pass 166: made district/city a required browser form field.
- Pass 167: retained village/neighborhood as optional.
- Pass 168: retained the existing category, taxonomy and listing-status controls.
- Pass 169: retained the current save action and error handling.
- Pass 170: confirmed no existing directory rows were rewritten by this frontend change.

### 171–180 — Backend correction and regression guard
- Pass 171: normalized the submitted governorate using the existing bounded `clean` helper.
- Pass 172: normalized the submitted district/city using the same helper.
- Pass 173: added a server-side missing-location rejection with `LOCATION_REQUIRED`.
- Pass 174: changed the persistence patch to use only the validated location values.
- Pass 175: removed the Monufia fallback from the API write path.
- Pass 176: removed the Berket El-Sabaa fallback from the API write path.
- Pass 177: preserved the existing NOT NULL schema contract by rejecting blanks before database writes.
- Pass 178: added static regression assertions for backend location validation.
- Pass 179: added static regression assertions for blank UI defaults and required fields.
- Pass 180: confirmed the existing doctor source-permission publication gate remains present and unchanged.

### 181–190 — Scope and release verification
- Pass 181: confirmed the batch doctor-import action remains staging-only.
- Pass 182: confirmed the phone-required publication guard remains unchanged.
- Pass 183: confirmed the source-evidence approval and expiry checks remain unchanged.
- Pass 184: confirmed claim and ownership fields were not modified.
- Pass 185: confirmed no migration or schema change was introduced.
- Pass 186: confirmed no RLS policy or GRANT/REVOKE change was introduced.
- Pass 187: confirmed no production data mutation was performed.
- Pass 188: confirmed no Supabase Edge Function was deployed.
- Pass 189: confirmed the doctor incremental-import workflow already watches the modified Edge Function, admin component and validator paths.
- Pass 190: committed the source correction and regression assertions; exact-head CI is pending and must pass before merge.

## Changed files
- `supabase/functions/directory-listings/index.ts`
- `apps/catalog-frontend/src/components/admin/DirectoryListingsAdmin.tsx`
- `scripts/production/validate-doctor-incremental-import.mjs`

## Release boundary
This is source-only work in PR #756. Do not merge or deploy until exact-head required CI passes and the PR is reviewed. No production database, listing rows, Edge Function, Auth, payment, wallet, settlement or Pages deployment was changed.


## Supplemental surface check within Pass 151–190
A broader code search found the same fallback in the owner-managed public listing edit screen. That surface is now covered too:
- Owner edit state and detail hydration use blank values rather than Monufia / Berket El-Sabaa fallbacks.
- Owner edit form requires governorate and district/city.
- `UPDATE_OWNED_LISTING` returns `LOCATION_REQUIRED` if the submitted values and saved values do not provide both fields.
- The existing claimed-owner authorization check and private metadata allowlist remain unchanged.
- The static validator now checks both admin and owner edit paths.
