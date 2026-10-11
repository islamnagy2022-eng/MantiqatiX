import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const gateway = readFileSync("supabase/functions/smm-gateway/index.ts", "utf8");
const page = readFileSync("web/smm.html", "utf8");
const handlerStart = gateway.indexOf("Deno.serve(async(req)=>{");
assert.notEqual(handlerStart, -1, "SMM gateway handler must exist");
const handler = gateway.slice(handlerStart);
const options = handler.indexOf('if(req.method==="OPTIONS")');
const gate = handler.indexOf('if (Deno.env.get("MNTY_SMM_ENABLED") !== "true") return json({error:"SMM_POST_LAUNCH_DEFERRED"},503);');
const auth = handler.indexOf("const user=await getUser(req)");
assert.ok(options >= 0 && gate > options && auth > gate, "SMM deny gate must run after OPTIONS and before authentication/actions");
assert.ok(!page.includes("<script"), "Deferred SMM page must not load scripts");
assert.ok(!page.includes("supabase"), "Deferred SMM page must not initialize Supabase");
assert.match(page, /قيد التطوير/);
assert.match(page, /noindex,nofollow/);
console.log("PASS: SMM server gate precedes all actions; deferred page is static and does not initialize Supabase.");
