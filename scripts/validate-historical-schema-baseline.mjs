import fs from "node:fs";
import path from "node:path";

const migrationDirectory = "supabase/migrations";
const providerBaselinePath = "supabase/tests/baselines/smm_providers.sql";
const credentialsBaselinePath = "supabase/tests/baselines/smm_provider_credentials.sql";
const files = fs.readdirSync(migrationDirectory)
  .filter((name) => name.endsWith(".sql"))
  .sort();
const migrations = files.map((name) => ({
  name,
  sql: fs.readFileSync(path.join(migrationDirectory, name), "utf8"),
}));
const firstCredentialReference = migrations.find(({ sql }) =>
  /smm_provider_credentials/i.test(sql)
);
const createsCredentialsTable = migrations.some(({ sql }) =>
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?:"?public"?)\s*\.\s*)?"?smm_provider_credentials"?\b/i.test(sql)
);
const createsProvidersTable = migrations.some(({ sql }) =>
  /\bcreate\s+table\s+(?:if\s+not\s+exists\s+)?(?:(?:"?public"?)\s*\.\s*)?"?smm_providers"?\b/i.test(sql)
);
const providerBaselineVersion = "20260927074158";
const credentialsBaselineVersion = "20260927074159";

for (const baselinePath of [providerBaselinePath, credentialsBaselinePath]) {
  if (!fs.existsSync(baselinePath)) {
    console.error("P0 BLOCKED: owner-approved test-only schema baseline is missing at " + baselinePath);
    process.exit(1);
  }
}

const providerBaseline = fs.readFileSync(providerBaselinePath, "utf8");
const providerChecks = [
  ["observed provider columns and defaults", /id\s+uuid\s+not\s+null\s+default\s+gen_random_uuid\(\)/i.test(providerBaseline) && /name\s+text\s+not\s+null/i.test(providerBaseline) && /api_url\s+text\s+not\s+null/i.test(providerBaseline) && /api_style\s+text\s+not\s+null\s+default\s+'generic'/i.test(providerBaseline) && /active\s+boolean\s+not\s+null\s+default\s+false/i.test(providerBaseline) && /priority\s+integer\s+not\s+null\s+default\s+100/i.test(providerBaseline) && /created_at\s+timestamptz\s+not\s+null\s+default\s+now\(\)/i.test(providerBaseline) && /updated_at\s+timestamptz\s+not\s+null\s+default\s+now\(\)/i.test(providerBaseline)],
  ["provider primary key and unique name", /primary\s+key\s*\(\s*id\s*\)/i.test(providerBaseline) && /unique\s*\(\s*name\s*\)/i.test(providerBaseline)],
  ["provider RLS and deny-authenticated policy", /enable\s+row\s+level\s+security/i.test(providerBaseline) && /deny_direct_access_authenticated[\s\S]*to\s+authenticated[\s\S]*using\s*\(\s*false\s*\)[\s\S]*with\s+check\s*\(\s*false\s*\)/i.test(providerBaseline)],
  ["provider service_role grants match observed snapshot", /grant\s+references\s*,\s*trigger\s*,\s*truncate[\s\S]*to\s+service_role/i.test(providerBaseline) && /revoke\s+all[\s\S]*from\s+public\s*,\s*anon\s*,\s*authenticated\s*,\s*service_role/i.test(providerBaseline)],
  ["provider baseline has production source provenance and is test-only", /moyhiluyhjsujhwlyeuu/i.test(providerBaseline) && /read-only PostgreSQL catalog introspection/i.test(providerBaseline) && /TEST-ONLY SCHEMA BASELINE/i.test(providerBaseline) && /Never apply this file to production/i.test(providerBaseline)],
];

const credentialsBaseline = fs.readFileSync(credentialsBaselinePath, "utf8");
const credentialsChecks = [
  ["provider_id UUID primary key", /provider_id\s+uuid\s+not\s+null/i.test(credentialsBaseline) && /primary\s+key\s*\(\s*provider_id\s*\)/i.test(credentialsBaseline)],
  ["encrypted key remains nullable text", /api_key_ciphertext\s+text\s*,/i.test(credentialsBaseline)],
  ["configured defaults false", /configured\s+boolean\s+not\s+null\s+default\s+false/i.test(credentialsBaseline)],
  ["updated_at defaults now", /updated_at\s+timestamptz\s+not\s+null\s+default\s+now\(\)/i.test(credentialsBaseline)],
  ["FK references smm_providers with cascade", /foreign\s+key\s*\(\s*provider_id\s*\)[\s\S]*references\s+public\.smm_providers\s*\(\s*id\s*\)[\s\S]*on\s+delete\s+cascade/i.test(credentialsBaseline)],
  ["credentials RLS is enabled", /enable\s+row\s+level\s+security/i.test(credentialsBaseline)],
  ["credentials client access is denied by policy", /to\s+anon\s*,\s*authenticated[\s\S]*using\s*\(\s*false\s*\)[\s\S]*with\s+check\s*\(\s*false\s*\)/i.test(credentialsBaseline)],
  ["credentials baseline is explicitly test-only", /TEST-ONLY SCHEMA BASELINE/i.test(credentialsBaseline) && /Never apply this file to production/i.test(credentialsBaseline)],
];

const failed = [...providerChecks, ...credentialsChecks].filter(([, ok]) => !ok);
if (failed.length) {
  for (const [name] of failed) console.error("P0 BLOCKED: test baseline validation failed: " + name);
  process.exit(1);
}
if (createsCredentialsTable || createsProvidersTable) {
  console.error("P0 BLOCKED: do not add guessed/backdated production migrations for the SMM baseline tables; reconcile any authoritative historical creation migration before replay.");
  process.exit(1);
}
if (!firstCredentialReference) {
  console.error("P0 BLOCKED: no migration references smm_provider_credentials; expected historical privilege migration was not found.");
  process.exit(1);
}
const legacyPrivilegeMigration = migrations.find(({ name }) =>
  name === "20260927095000_revoke_unused_security_definer_execute.sql"
);
if (!legacyPrivilegeMigration) {
  console.error("P0 BLOCKED: expected legacy SECURITY DEFINER privilege migration is missing.");
  process.exit(1);
}
const legacyFunctionSignatures = [
  { name: "counter_offer_indrive_bid", args: "uuid,uuid,numeric" },
  { name: "fashion_erp_mutate", args: "text,jsonb,text" },
  { name: "mantigo_accept_bid", args: "text,text" },
  { name: "mantigo_cancel_ride", args: "text" },
  { name: "mantigo_create_ride", args: "text,text,text,text,numeric,text" },
  { name: "mantigo_rate_ride", args: "text,integer,text" },
  { name: "mantigo_submit_bid", args: "text,numeric,text,text,text,text" },
  { name: "mantigo_update_proposed_price", args: "text,numeric" },
  { name: "restaurant_erp_mutate", args: "text,jsonb,text" },
  { name: "restaurant_table_mutate", args: "text,jsonb,text" },
];
const legacyFunctionNames = legacyFunctionSignatures.map(({ name }) => name);
const legacyBaselinePath = "supabase/tests/baselines/legacy_security_definer_functions.sql";
const legacyBaselineExists = fs.existsSync(legacyBaselinePath);
const legacyBaseline = legacyBaselineExists ? fs.readFileSync(legacyBaselinePath, "utf8") : "";
if (legacyBaselineExists) {
  const normalizedBaseline = legacyBaseline.toLowerCase().replace(/\s+/g, "");
  const baselineChecks = [];
  baselineChecks.push([
    "owner approval, test-only, source provenance, and production prohibition",
    /owner-approved test-only function baseline/i.test(legacyBaseline) &&
      /moyhiluyhjsujhwlyeuu/i.test(legacyBaseline) &&
      /read-only/i.test(legacyBaseline) &&
      /never apply this file to production/i.test(legacyBaseline),
  ]);
  for (const { name, args } of legacyFunctionSignatures) {
    const normalizedSignature = ("public." + name + "(" + args + ")").replace(/\s+/g, "").toLowerCase();
    baselineChecks.push(["exact signature for " + name, normalizedBaseline.includes(normalizedSignature)]);
    if (name === "mantigo_rate_ride") {
      baselineChecks.push([
        "observed authenticated EXECUTE exception for mantigo_rate_ride only",
        /revoke\s+all\s+on\s+function\s+public\.mantigo_rate_ride\s*\(text,integer,text\)\s+from\s+public\s*,\s*anon\s*,\s*service_role/i.test(legacyBaseline) &&
          /grant\s+execute\s+on\s+function\s+public\.mantigo_rate_ride\s*\(text,integer,text\)\s+to\s+authenticated/i.test(legacyBaseline),
      ]);
    } else {
      const revoke = legacyBaseline.match(new RegExp(
        "revoke\\s+(?:all|execute)\\s+on\\s+function\\s+public\\." + name +
        "\\s*\\([^)]*\\)\\s+from\\s+([^;]+);", "i"
      ));
      const revokedRoles = revoke ? revoke[1].toLowerCase().split(",").map((role) => role.trim()) : [];
      baselineChecks.push([
        "client/service-role EXECUTE revoked for " + name,
        Boolean(revoke) && ["public", "anon", "authenticated", "service_role"].every((role) => revokedRoles.includes(role)),
      ]);
    }
  }
  baselineChecks.push([
    "all ten functions are SECURITY DEFINER",
    (legacyBaseline.match(/\bsecurity\s+definer\b/gi) || []).length >= legacyFunctionSignatures.length,
  ]);
  baselineChecks.push([
    "all ten functions pin a function-level search_path",
    (legacyBaseline.match(/\bset\s+search_path\s*=/gi) || []).length >= legacyFunctionSignatures.length,
  ]);
  baselineChecks.push([
    "baseline ACL matches observed snapshot without PUBLIC, anon, or service_role grants",
    /grant\s+execute\s+on\s+function\s+public\.mantigo_rate_ride\s*\(text,integer,text\)\s+to\s+authenticated/i.test(legacyBaseline) &&
      !/\bgrant\s+(?:all|execute)\s+on\s+function\b[^;]*\bto\s+(?:public|anon|service_role)\b/i.test(legacyBaseline) &&
      (legacyBaseline.match(/\bgrant\s+execute\s+on\s+function\b[^;]*\bto\s+authenticated\b/gi) || []).length === 1,
  ]);
  const failedBaselineChecks = baselineChecks.filter(([, ok]) => !ok);
  if (failedBaselineChecks.length) {
    for (const [name] of failedBaselineChecks) console.error("P0 BLOCKED: legacy function baseline validation failed: " + name);
    process.exit(1);
  }
}
const unresolvedLegacyFunctions = legacyFunctionSignatures.filter(({ name, args }) => {
  const normalizedSignature = ("public." + name + "(" + args + ")").replace(/\s+/g, "").toLowerCase();
  const creation = migrations.find(({ name: migrationName, sql }) =>
    migrationName.slice(0, 14) < legacyPrivilegeMigration.name.slice(0, 14) &&
    new RegExp("\\bcreate\\s+(?:or\\s+replace\\s+)?function\\s+(?:public\\s*\\.\\s*)?" + name + "\\s*\\(", "i").test(sql) &&
    sql.replace(/\s+/g, "").toLowerCase().includes(normalizedSignature)
  );
  const inApprovedBaseline = legacyBaselineExists &&
    /OWNER-APPROVED TEST-ONLY FUNCTION BASELINE/i.test(legacyBaseline) &&
    new RegExp("\\bcreate\\s+(?:or\\s+replace\\s+)?function\\s+(?:public\\s*\\.\\s*)?" + name + "\\s*\\(", "i").test(legacyBaseline) &&
    legacyBaseline.replace(/\s+/g, "").toLowerCase().includes(normalizedSignature);
  return !creation && !inApprovedBaseline;
});
if (unresolvedLegacyFunctions.length) {
  console.error("P0 BLOCKED: the chronological replay reaches " + legacyPrivilegeMigration.name + " before these legacy SECURITY DEFINER functions are created by any earlier committed migration or approved test-only function baseline:");
  for (const { name, args } of unresolvedLegacyFunctions) console.error(" - public." + name + "(" + args + ")");
  console.error("Do not add placeholder functions or skip the historical privilege migration. Recover authoritative creation DDL/history or obtain explicit owner approval for a separate test-only baseline sourced from live definitions.");
  process.exit(1);
}
if (firstCredentialReference.name.slice(0, 14) <= credentialsBaselineVersion) {
  console.error("P0 BLOCKED: test-only provider and credentials baselines must sort before the first migration that references them.");
  process.exit(1);
}
for (const [version, temporaryName] of [
  [providerBaselineVersion, providerBaselineVersion + "_test_only_approved_smm_providers_baseline.sql"],
  [credentialsBaselineVersion, credentialsBaselineVersion + "_test_only_approved_smm_provider_credentials_baseline.sql"],
]) {
  if (fs.existsSync(path.join(migrationDirectory, temporaryName))) {
    console.error("P0 BLOCKED: temporary test-only migration filename already exists in repository: " + temporaryName);
    process.exit(1);
  }
}
console.log("Historical schema baseline preflight PASS: both owner-approved production-derived SMM schema baselines validated for isolated replay only.");
