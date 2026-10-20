import fs from "node:fs";
import assert from "node:assert/strict";

const source=fs.readFileSync("web/module-blueprints.js","utf8");
assert.match(source,/data-blueprint-action-status/,"blueprint action must expose a status panel");
assert.match(source,/setAttribute\('role','status'\)/,"status panel must use a status role");
assert.match(source,/setAttribute\('aria-live','polite'\)/,"status updates must be announced accessibly");
assert.match(source,/لم يتم ربطه بمسار تشغيل مستقل بعد/,"must not claim a non-existent workflow is open");
assert.match(source,/لم يتم تنفيذ أي إجراء أو تغيير بيانات/,"must make clear no business mutation occurred");
assert.doesNotMatch(source,/window\.showToast\?\.\('تم فتح قسم/,"must not emit false success for a workflow that did not open");
console.log("Module blueprint action contract PASS: honest accessible status; no fake success.");
