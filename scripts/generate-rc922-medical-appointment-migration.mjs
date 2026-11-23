import fs from "node:fs";
import path from "node:path";

const migrationDir = "supabase/migrations";
const sourcePath = path.join(migrationDir, "20261123010000_rc921_medical_appointment_provider_state_machine.sql");
const source = fs.readFileSync(sourcePath, "utf8");

const membershipPredicate = `    and um.business_id = v_appointment.business_id
`;
const scopedTenantWideProviderPredicate = `    and (
      um.business_id = v_appointment.business_id
      or (
        um.business_id is null
        and upper(um.role) = 'SERVICE_PROVIDER'
      )
    )
`;

if (source.split(membershipPredicate).length !== 2) {
  throw new Error("RC921 source anchor must occur exactly once; refusing to generate a migration from an unexpected source.");
}

const generatedSql = source
  .replace("-- RC921: bind provider status changes to the assigned provider and enforce a forward-only state machine.",
    "-- RC922: allow tenant-wide SERVICE_PROVIDER membership only for its own active provider profile in the appointment business.")
  .replace(membershipPredicate, scopedTenantWideProviderPredicate);

if (!generatedSql.includes("mp.owner_user_id = v_uid")
  || !generatedSql.includes("mp.business_id = v_appointment.business_id")
  || !generatedSql.includes("b.tenant_id = v_appointment.tenant_id")
  || !generatedSql.includes("upper(mp.status) = 'ACTIVE'")
  || !generatedSql.includes("for update")
  || !generatedSql.includes("set search_path to ''")) {
  throw new Error("Generated RC922 must preserve owner/profile/tenant checks, row locking and empty search_path.");
}

if (/or\s+um\.business_id\s+is\s+null\s*(?:\n|$)/i.test(generatedSql)) {
  throw new Error("Generated RC922 contains an unscoped NULL-business membership exception.");
}

const generatedFiles = fs.readdirSync(migrationDir)
  .filter(name => /^\d{14}_rc922_medical_appointment_tenant_wide_provider_scope\.sql$/.test(name));

if (generatedFiles.length !== 1) {
  throw new Error(`Expected exactly one CLI-generated RC922 filename, found ${generatedFiles.length}. Run supabase migration new first; do not hand-name a migration file.`);
}

const destination = path.join(migrationDir, generatedFiles[0]);
fs.writeFileSync(destination, generatedSql, { encoding: "utf8", flag: "w" });
console.log(`RC922_CLI_GENERATED_MIGRATION=${destination}`);
