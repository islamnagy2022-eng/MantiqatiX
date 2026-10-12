#!/usr/bin/env node
import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("web/module-blueprints.js", "utf8");

// Table-count readability is not proof of a complete, live business workflow.
assert.match(source, /READABLE:\['مصدر قابل للقراءة','pending'\]/, "readable sources must use a non-success status label");
assert.doesNotMatch(source, /\bLIVE\b/, "blueprint must not claim modules are LIVE based only on table counts");
assert.doesNotMatch(source, /<span>ENFORCED<\/span>/, "blueprint must not make blanket unverified RLS/RBAC claims");
assert.match(source, /SECURITY VERIFICATION/, "security panel must explicitly communicate verification requirements");
assert.match(source, /RLS<\/b><span>CHECK REQUIRED<\/span>/, "RLS must be marked for independent verification");
assert.match(source, /RBAC<\/b><span>CHECK REQUIRED<\/span>/, "RBAC must be marked for independent verification");

// The section action must select its corresponding tab; a success toast alone is not an action.
assert.match(source, /const tab=tabs\[idx\];if\(tab\)\{tab\.click\(\);root\.scrollIntoView/, "section button must navigate to the matching tab");
assert.doesNotMatch(source, /تم فتح قسم.*success/, "do not show a success toast without opening the section");

console.log("MODULE_BLUEPRINT_EVIDENCE=PASS");
