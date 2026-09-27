import fs from "node:fs";

const app = fs.readFileSync("web/app.js", "utf8");

const required = [
  ["Email OTP", "sb.auth.signInWithOtp({email,options:{shouldCreateUser:true}})"],
  ["OTP verification", "sb.auth.verifyOtp({email,token,type:'email'})"],
  ["Session verification", "session?.user"],
  ["Registration request path", "submitRegistrationRequest"],
  ["Membership gate", "if(!live.memberships.length){membershipRequiredView();return}"],
  ["Logout state reset", "live.memberships=[]"],
  ["Registration review Edge Function", "sb.functions.invoke('mnty-registration-review'"],
  ["Admin role guard", "['SUPER_ADMIN','ADMIN','OWNER'].includes(String(live.role||'').toUpperCase())"]
];

const failures = required.filter(([name, marker]) => !app.includes(marker));

if (failures.length) {
  console.error("Auth/registration production invariant check failed:");
  for (const [name] of failures) console.error(`- ${name}`);
  process.exit(1);
}

console.log(`Auth/registration production invariants passed: ${required.length} checks.`);
