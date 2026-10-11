import fs from "node:fs";
import path from "node:path";

const directory = "supabase/migrations";
const files = fs.readdirSync(directory)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const migrations = files.map((name) => ({
  name,
  sql: fs.readFileSync(path.join(directory, name), "utf8"),
}));
const createsCredentialsTable = migrations.filter(({ sql }) =>
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?:"?public"?)\s*\.\s*)?"?smm_provider_credentials"?\b/i.test(sql)
);
const historicalPrivilegeMigration = migrations.find(({ name }) =>
  name.includes("20260927074200_harden_smm_table_api_privileges")
);
const referencesCredentials = historicalPrivilegeMigration?.sql.includes("smm_provider_credentials") ?? false;

if (referencesCredentials && createsCredentialsTable.length === 0) {
  console.error("P0 BLOCKED: historical migration 20260927074200_harden_smm_table_api_privileges.sql references public.smm_provider_credentials, but no committed migration creates that table.");
  console.error("Recover the authoritative original DDL from repository history or an owner-approved schema baseline. Do not invent a backdated migration, rewrite applied history, or seed the table only in the replay fixture.");
  process.exit(1);
}
if (createsCredentialsTable.length === 0) {
  console.error("P0 BLOCKED: no committed migration defines public.smm_provider_credentials; migration replay cannot certify an empty-database install.");
  process.exit(1);
}
console.log("Historical schema baseline preflight PASS: smm_provider_credentials creation source found.");
