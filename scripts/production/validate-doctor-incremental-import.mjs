import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const edgePath = "supabase/functions/directory-listings/index.ts";
const frontendPath = "apps/catalog-frontend/src/lib/directoryListings.ts";
const adminPath = "apps/catalog-frontend/src/components/admin/DirectoryListingsAdmin.tsx";
const evidenceMigrationPath = "supabase/migrations/20261101150000_directory_source_permission_evidence.sql";
const importContractPath = "supabase/functions/directory-listings/doctor-import-contract.mjs";

const edge = readFileSync(edgePath, "utf8");
const frontend = readFileSync(frontendPath, "utf8");
const admin = readFileSync(adminPath, "utf8");
const evidenceMigration = readFileSync(evidenceMigrationPath, "utf8");
const importContract = readFileSync(importContractPath, "utf8");

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
assert.match(action, /\.eq\("phone", candidatePhone\)/, "Deduplication must check each incoming phone against the saved primary phone");
assert.match(action, /\.eq\("secondary_phone", candidatePhone\)/, "Deduplication must check each incoming phone against the saved secondary phone");
assert.match(action, /for \(const candidatePhone of phoneCandidates\)/, "Deduplication must compare both incoming numbers across both saved phone fields");
assert.match(action, /\.eq\("display_name", displayName\)/, "Deduplication must check exact doctor name");
assert.match(action, /\.eq\("governorate", governorate\)/, "Name deduplication must include governorate");
assert.match(action, /\.eq\("district", district\)/, "Name deduplication must include district");

assert.match(action, /sourcePermissionEvidenceId/, "Each import row must reference an approved permission evidence record");
assert.match(action, /isCurrentDoctorRepublicationEvidence\(approvedEvidence, sourceUrl, sourceName\)/, "Import must call the tested source-evidence validator");
assert.match(importContract, /evidence.status === "APPROVED"/, "Only approved evidence may be used");
assert.match(importContract, /!evidence.revoked_at/, "Revoked evidence must be rejected");
assert.match(importContract, /expiresAt > currentTime/, "Expired evidence must be rejected");
assert.match(importContract, /sourceHost === evidence.source_host/, "Source host must match approved evidence");
assert.match(importContract, /allows_doctor_profile_republication === true/, "Doctor republication scope must be true");
assert.match(importContract, /allows_commercial_republication === true/, "Commercial republication scope must be true");
assert.match(action, /resolveDoctorImportStatus\(row, hasPhone\)/, "Import must call tested publication-state validation");
assert.match(action, /sanitizeDoctorImportMetadata\(row.metadata\)/, "Import must sanitize caller metadata");
assert.match(action, /directory_source_permission_evidence/, "Import must validate against the private evidence registry");
assert.match(edge, /allowsDoctorProfileRepublication === true/, "Evidence registration must require explicit doctor profile republication scope");
assert.match(edge, /allowsCommercialRepublication === true/, "Evidence registration must require explicit commercial republication scope");
assert.match(edge, /allows_doctor_profile_republication: allowsDoctorProfileRepublication/, "Doctor profile scope must be stored from explicit input");
assert.match(edge, /allows_commercial_republication: allowsCommercialRepublication/, "Commercial scope must be stored from explicit input");
assert.match(admin, /allowsDoctorProfileRepublication: false/, "UI must default doctor republication permission to unchecked");
assert.match(admin, /allowsCommercialRepublication: false/, "UI must default commercial republication permission to unchecked");
assert.match(admin, /إعادة نشر ملفات الأطباء/, "UI must ask for explicit doctor profile republication scope");
assert.match(admin, /الاستخدام التجاري/, "UI must ask for explicit commercial republication scope");
assert.match(action, /approvedEvidence\.status === "APPROVED"/, "Only approved source permission evidence may be used");
assert.match(action, /!approvedEvidence\.revoked_at/, "Revoked source evidence must be rejected");
assert.match(action, /approvedEvidence\.expires_at/, "Expired source evidence must be rejected");
assert.match(action, /sourceHost !== approvedEvidence\.source_host/, "Source host must match the approved evidence scope");
assert.match(action, /sourceName\.toLocaleLowerCase\(\) !== String\(approvedEvidence\.source_name/, "Source name must match the approved evidence");
assert.match(evidenceMigration, /approved_by <> created_by/, "Evidence registry must enforce two-person approval");
assert.match(edge, /String\(evidence\.created_by\) === String\(user\.id\)/, "The evidence creator cannot approve their own evidence");
assert.match(action, /parsedSourceUrl\.protocol === "https:" \|\| parsedSourceUrl\.protocol === "http:"/, "Source URL must be HTTP or HTTPS");
assert.match(action, /INVALID_SOURCE_CHECKED_AT/, "Invalid source timestamps must be rejected");
assert.match(action, /PHONE_REQUIRED_FOR_PUBLICATION/, "Publication without a valid phone must be rejected when explicitly requested");
assert.match(action, /rawPhone\.replace\(\/\\D\/g, ""\)\.length >= 7/, "Primary phone must be validated");
assert.match(action, /rawSecondaryPhone\.replace\(\/\\D\/g, ""\)\.length >= 7/, "Secondary phone must be validated");

assert.match(action, /if \(!row\.slug\) delete patch\.slug/, "Existing slug must survive imports that omit a new slug");
assert.match(action, /if \(!row\.sourceCheckedAt && !row\.source_checked_at\) delete patch\.source_checked_at/, "Source checked date must not be refreshed without a new observation date");
assert.match(action, /if \(!hasRequestedStatus\) delete patch\.listing_status/, "Existing DRAFT/HIDDEN/PUBLISHED status must be preserved unless explicitly changed");
assert.match(action, /requestedStatus === "PUBLISHED" && !hasPhone \? "DRAFT" : requestedStatus/, "Explicit HIDDEN status must not be downgraded to DRAFT when phone is absent");
assert.match(action, /"updated_" \+ String\(saved\.data\.listing_status\)\.toLowerCase\(\)/, "Update result must preserve the actual saved status label");
assert.match(action, /"inserted_" \+ String\(saved\.data\.listing_status\)\.toLowerCase\(\)/, "Insert result must preserve the actual saved status label");
assert.match(action, /delete patch\.claim_status/, "Import must not reset claim/ownership state");
assert.match(action, /if \(!phone\) delete patch\.phone/, "Missing phone in a partial snapshot must not erase a saved phone");
assert.match(action, /if \(!secondaryPhone\) delete patch\.secondary_phone/, "Missing secondary phone in a partial snapshot must not erase a saved phone");
assert.match(action, /source_phone_verified: false/, "New imports must not be labeled as phone-verified");
assert.match(action, /professional_registration_verified: false/, "New imports must not be labeled as registration-verified");
assert.match(action, /owner_confirmation_required: true/, "New imports must require provider/owner confirmation");

assert.match(frontend, /export async function importDoctorDirectoryBatch/, "Authenticated frontend importer must exist");
assert.match(frontend, /rows\.length > 20/, "Frontend must enforce the same batch maximum");
assert.match(frontend, /sourcePermissionEvidenceId: string/, "Typed import row must require a permission evidence ID");
assert.doesNotMatch(frontend, /sourcePermissionStatus:/, "Free-text permission declarations must not authorize imports");
assert.match(frontend, /ADMIN_REGISTER_SOURCE_PERMISSION_EVIDENCE/, "Admin UI must be able to register permission evidence");
assert.match(frontend, /ADMIN_APPROVE_SOURCE_PERMISSION_EVIDENCE/, "Admin UI must support second-person approval");
assert.match(admin, /importDoctorDirectoryBatch\(rows\)/, "Admin screen must call the incremental batch importer");
assert.match(admin, /استيراد دفعة أطباء/, "Admin screen must expose the batch import panel");

assert.match(evidenceMigration, /create table if not exists public\.directory_source_permission_evidence/, "Private source permission evidence table must exist");
assert.match(evidenceMigration, /enable row level security/i, "Evidence registry must enable RLS");
assert.match(evidenceMigration, /force row level security/i, "Evidence registry must FORCE RLS");
assert.match(evidenceMigration, /revoke all on table public\.directory_source_permission_evidence from anon, authenticated/i, "Evidence registry must deny direct client access");
assert.match(evidenceMigration, /grant all on table public\.directory_source_permission_evidence to service_role/i, "Evidence registry must be service-role only");
assert.match(evidenceMigration, /approved_by <> created_by/, "Database must enforce two-person approval");
assert.match(evidenceMigration, /status in \('PENDING',\s*'APPROVED',\s*'REVOKED'\)/, "Evidence status must be constrained");

console.log("DOCTOR_INCREMENTAL_IMPORT_CONTRACT=PASS");
console.log("checks=platform_admin,20_row_cap,sequential_persistence,deduplication,approved_source_evidence,two_person_approval,source_scope,expiry_revocation,valid_source_url,phone_gate,state_preservation,ownership_preservation,verification_protection,admin_ui,private_rls_registry");
