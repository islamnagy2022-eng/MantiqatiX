import fs from "node:fs";
import assert from "node:assert/strict";

const migration = fs.readFileSync("supabase/migrations/20261010090000_rc567_approval_action_write_boundary.sql", "utf8");
const fixture = fs.readFileSync("supabase/tests/rc567_approval_action_write_fixture.sql", "utf8");
const test = fs.readFileSync("supabase/tests/rc567_approval_action_write_integration.sql", "utf8");
assert.ok(migration.includes("REVOKE INSERT ON TABLE public.approval_actions FROM authenticated"), "authenticated INSERT must be revoked");
assert.ok(migration.includes("DROP POLICY IF EXISTS approval_actions_member_insert"), "legacy permissive member INSERT policy must be removed");
assert.ok(!/GRANT\s+INSERT[^;]*authenticated/i.test(migration), "migration must not re-grant direct authenticated INSERT");
assert.ok(fixture.includes("GRANT SELECT, INSERT, UPDATE, DELETE ON public.approval_actions TO service_role"), "fixture must model the trusted writer privilege");
assert.ok(test.includes("ordinary authenticated member inserted an approval action"), "negative insert assertion missing");
assert.ok(test.includes("trusted service_role write privilege must be preserved"), "trusted writer privilege assertion missing");
assert.ok(test.includes("unauthorized approval action row persisted"), "persistence post-check missing");
console.log("RC567 approval action write-boundary source contract: PASS");
