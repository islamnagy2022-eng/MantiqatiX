import fs from "node:fs";
const path = "supabase/tests/mantigo_production_security_contract.sql";
if (!fs.existsSync(path)) throw new Error("Missing MantiGO production security regression contract");
const sql = fs.readFileSync(path,"utf8");
for (const marker of [
  "MANTIGO_RLS_CONTRACT_FAILED",
  "MANTIGO_RPC_BOUNDARY_FAILED",
  "MANTIGO_RATE_LIMIT_FAILED",
  "create_mantigo_ride_backend_v2",
  "update_mantigo_trip_status_backend",
  "mantigo_ride_rate_limit_guard",
  "mantigo_bid_rate_limit_guard"
]) {
  if (!sql.includes(marker)) throw new Error("Missing security test marker: " + marker);
}
console.log("MantiGO production security test contract: PASS");
