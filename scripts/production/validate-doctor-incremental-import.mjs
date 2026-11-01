import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const edgePath = "supabase/functions/directory-listings/index.ts";
const frontendPath = "apps/catalog-frontend/src/lib/directoryListings.ts";
const adminPath = "apps/catalog-frontend/src/components/admin/DirectoryListingsAdmin.tsx";

const edge = readFileSync(edgePath, "utf8");
const frontend = readFileSync(frontendPath, "utf8");
const admin = readFileSync(adminPath, "utf8");

const actionStart = edge.indexOf('if (action === "IMPORT_DOCTOR_BATCH")');
assert.notEqual(actionStart, -1, "IMPORT_DOCTOR_BATCH action must exist");

const upsertStart = edge.indexOf('if (action === "UPSERT_LISTING")', actionStart);
assert.notEqual(upsertStart, -1, "Existing UPSERT_LISTING handler must remain after import action");

const action = edge.slice(actionStart, upsertStart);
const adminGate = edge.indexOf('if (!(memberships || []).some(platformAdmin))');
assert.notEqual(adminGate, -1, "Platform-admin authorization gate must exist");
assert.ok(adminGate < actionStart, "Batch import must be protected by the platform-admin gate");

assert.match(action, /rows\.length > 20/, "Batch size must be capped at 20");
assert.match(action, /for \(let index = 0; index < rows\.length; index \+= 1\)/, "Rows must be processed sequentially");
assert.match(action, /select\("id,slug,listing_status,metadata,source_checked_at,completeness"\)/, "Existing row state must be loaded before updates");
assert.match(action, /\.eq\("phone", phone\)/, "Deduplication must check the primary phone");
assert.match(action, /\.eq\("secondary_phone", secondaryPhone\)/, "Deduplication must check the secondary phone");
assert.match(action, /\.eq\("display_name", displayName\)/, "Deduplication must check exact doctor name");
assert.match(action, /\.eq\("governorate", governorate\)/, "Name deduplication must include governorate");
assert.match(action, /\.eq\("district", district\)/, "Name deduplication must include district");

assert.match(action, /allowedSourcePermissionStatuses = new Set\(\["LICENSED", "OWNER_PROVIDED", "PUBLIC_PERMISSION_CONFIRMED"\]\)/, "Each new batch row must declare its republication basis");
assert.match(action, /parsedSourceUrl\.protocol === "https:" \|\| parsedSourceUrl\.protocol === "http:"/, "Source URL must be HTTP or HTTPS");
assert.match(action, /PHONE_REQUIRED_FOR_PUBLICATION/, "Publication without a valid phone must be rejected when explicitly requested");
assert.match(action, /phone\.replace\(\/\\D\/g, ""\)\.length >= 7/, "Primary phone must be validated");
assert.match(action, /secondaryPhone\.replace\(\/\\D\/g, ""\)\.length >= 7/, "Secondary phone must be validated");

assert.match(action, /if \(!row\.slug\) delete patch\.slug/, "Existing slug must survive imports that omit a new slug");
assert.match(action, /if \(!row\.sourceCheckedAt && !row\.source_checked_at\) delete patch\.source_checked_at/, "Source checked date must not be refreshed without a new observation date");
assert.match(action, /if \(!hasRequestedStatus\) delete patch\.listing_status/, "Existing DRAFT/HIDDEN/PUBLISHED status must be preserved unless explicitly changed");
assert.match(action, /delete patch\.claim_status/, "Import must not reset claim/ownership state");
assert.match(action, /if \(!phone\) delete patch\.phone/, "Missing phone in a partial snapshot must not erase a saved phone");
assert.match(action, /if \(!secondaryPhone\) delete patch\.secondary_phone/, "Missing secondary phone in a partial snapshot must not erase a saved phone");
assert.match(action, /source_phone_verified: false/, "New imports must not be labeled as phone-verified");
assert.match(action, /professional_registration_verified: false/, "New imports must not be labeled as registration-verified");
assert.match(action, /owner_confirmation_required: true/, "New imports must require provider/owner confirmation");

assert.match(frontend, /export async function importDoctorDirectoryBatch/, "Authenticated frontend importer must exist");
assert.match(frontend, /rows\.length > 20/, "Frontend must enforce the same batch maximum");
assert.match(frontend, /sourcePermissionStatus:/, "Typed import row must require a source republication basis");
assert.match(admin, /importDoctorDirectoryBatch\(rows\)/, "Admin screen must call the incremental batch importer");
assert.match(admin, /استيراد دفعة أطباء/, "Admin screen must expose the batch import panel");

console.log("DOCTOR_INCREMENTAL_IMPORT_CONTRACT=PASS");
console.log("checks=platform_admin,20_row_cap,sequential_persistence,deduplication,source_rights,valid_source_url,phone_gate,state_preservation,ownership_preservation,verification_protection,admin_ui");
