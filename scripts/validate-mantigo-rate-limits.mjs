import fs from "node:fs";

const migration = "supabase/migrations/20261007001000_mantigo_abuse_rate_limits_v1.sql";
if (!fs.existsSync(migration)) throw new Error("Missing MantiGO abuse rate-limit migration");

const sql = fs.readFileSync(migration, "utf8");
const required = [
  "mantigo_rate_limit_config",
  "mantigo_rate_limit_check",
  "pg_advisory_xact_lock",
  "mantigo_ride_rate_limit_guard",
  "mantigo_bid_rate_limit_guard",
  "CREATE_RIDE",
  "CREATE_BID",
  "revoke all on table public.mantigo_rate_limit_config from anon, authenticated",
  "revoke all on function public.mantigo_rate_limit_check(text,uuid) from public, anon, authenticated"
];

for (const marker of required) {
  if (!sql.includes(marker)) throw new Error("MantiGO rate-limit contract missing: " + marker);
}

console.log("MantiGO abuse rate-limit contract: PASS");
