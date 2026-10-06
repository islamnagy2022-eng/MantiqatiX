import fs from "node:fs";
const p = "supabase/migrations/20261007010000_mantigo_legacy_rpc_boundary_hardening_v1.sql";
if (!fs.existsSync(p)) throw new Error("Missing legacy SECURITY DEFINER hardening migration");
const sql = fs.readFileSync(p,"utf8");
const expected = [
"mantigo_accept_bid(text,text)",
"mantigo_cancel_ride(text)",
"mantigo_create_ride(text,text,text,text,numeric,text)",
"mantigo_submit_bid(text,numeric,text,text,text,text)",
"mantigo_update_proposed_price(text,numeric)"
];
for (const fn of expected) {
  if (!sql.includes("set search_path = public, pg_temp")) throw new Error("Missing hardened search_path");
}
if ((sql.match(/revoke execute on function/g) || []).length !== 5) throw new Error("Expected five legacy RPC execute revocations");
console.log("Public SECURITY DEFINER search_path contract: PASS");
