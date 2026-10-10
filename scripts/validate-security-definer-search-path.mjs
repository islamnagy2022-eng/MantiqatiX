import fs from "node:fs";
const migration=fs.readFileSync("supabase/migrations/20261010020000_rc440_exposed_security_definer_search_path.sql","utf8");
const fixture=fs.readFileSync("supabase/tests/rc440_security_definer_fixture.sql","utf8");
const integration=fs.readFileSync("supabase/tests/rc440_security_definer_integration.sql","utf8");
const checks=[];
function check(name,ok){checks.push({name,ok:Boolean(ok)});if(!ok)console.error("FAIL "+name);}
check("RC440 only targets public SECURITY DEFINER functions",migration.includes("n.nspname='public'")&&migration.includes("p.prosecdef"));
check("RC440 targets only functions callable by anon/authenticated",migration.includes("has_function_privilege('anon'")&&migration.includes("has_function_privilege('authenticated'"));
check("RC440 only changes public-only function search paths",migration.includes("cfg='search_path=public'"));
check("RC440 fixes temp-schema shadowing without removing public schema",migration.includes("set search_path = public, pg_temp"));
check("integration covers anon, authenticated, already-hardened, and service-only functions",
  fixture.includes("rc440_exposed_probe")&&fixture.includes("rc440_authenticated_probe")&&fixture.includes("rc440_already_hardened_probe")&&fixture.includes("rc440_private_probe"));
check("integration asserts anon-exposed function hardened",integration.includes("anon-exposed SECURITY DEFINER function was not hardened"));
check("integration asserts authenticated-exposed function hardened",integration.includes("authenticated-exposed SECURITY DEFINER function was not hardened"));
check("integration asserts existing grants are preserved",integration.includes("RC440 must not alter grants"));
check("integration asserts already-hardened function remains unchanged",integration.includes("RC440 unexpectedly changed an already-hardened function"));
check("integration asserts service-only function remains untouched",integration.includes("must not change service-only function search_path"));
const failed=checks.filter(x=>!x.ok);if(failed.length)process.exit(1);
console.log("RC440 SECURITY DEFINER search path contract PASS: "+checks.length+"/"+checks.length+" checks.");
