import fs from "node:fs";
import { createHash } from "node:crypto";

const expected = new Map([
  ["supabase/migrations/20260927065218_mnty_platform_admin_authority.sql", "3412d8d7c239c2eeb3d453ce28eed3391a8bdf43b18c9f8ad6c1b096deb5096d"],
  ["supabase/migrations/20260927065247_mnty_atomic_registration_review.sql", "272445a4f4eadcdd6e27ee4abaff3fcb144cf437717f9c774b299ee67cb0aad3"],
  ["supabase/migrations/20260927065347_mnty_platform_bootstrap_authority.sql", "dadf47ca682c6f42013263321814d8592b10d4776bbd358148256c5842908180"],
  ["supabase/migrations/20260927140200_lock_platform_admins_rls.sql", "15efd7c4c69ae573b33e576c683222f6dc8db9abf16131893517466befbf64ef"],
]);

let failed = false;
for (const [path, wanted] of expected) {
  if (!fs.existsSync(path)) {
    console.error("FAIL missing recovered source: " + path);
    failed = true;
    continue;
  }
  const actual = createHash("sha256").update(fs.readFileSync(path)).digest("hex");
  if (actual !== wanted) {
    console.error("FAIL ledger SHA-256 mismatch: " + path + " expected=" + wanted + " actual=" + actual);
    failed = true;
  } else {
    console.log("PASS exact applied-ledger source: " + path);
  }
}
if (failed) process.exit(1);
console.log("Recovered platform-admin migration source parity PASS: " + expected.size + "/" + expected.size);
