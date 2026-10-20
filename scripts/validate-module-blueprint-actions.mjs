import fs from "node:fs";
import assert from "node:assert/strict";

const source=fs.readFileSync("web/module-blueprints.js","utf8");
assert.match(source,/data-blueprint-action-status/,"blueprint action must expose a status panel");
assert.match(source,/setAttribute\('role','status'\)/,"status panel must use a status role");
assert.match(source,/setAttribute\('aria-live','polite'\)/,"status updates must be announced accessibly");
assert.match(source,/لم يتم ربطه بمسار تشغيل مستقل بعد/,"must not claim a non-existent workflow is open");
assert.match(source,/لم يتم تنفيذ أي إجراء أو تغيير بيانات/,"must make clear no business mutation occurred");
assert.doesNotMatch(source,/window\.showToast\?\.\('تم فتح قسم/,"must not emit false success for a workflow that did not open");
assert.match(source,/وجود هذه الشاشة لا يثبت أن سياسات RLS أو صلاحيات RBAC أو مسارات الكتابة قد تم اختبارها/,"security panel must disclose missing verification evidence");
assert.match(source,/RLS<.{0,3}b><span>NOT VERIFIED/,"must not claim RLS enforcement without evidence");
assert.match(source,/RBAC<.{0,3}b><span>NOT VERIFIED/,"must not claim RBAC enforcement without evidence");
assert.doesNotMatch(source,/<span>ENFORCED<.{0,3}span>/,"must not display unverified security guarantees as enforced");
console.log("Module blueprint action contract PASS: honest accessible status; no fake success.");
