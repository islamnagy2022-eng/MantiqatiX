#!/usr/bin/env node
import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("web/sector-modules.js", "utf8");
assert.match(source, /sb\.rpc\('create_education_request_backend',\{p_target_id:targetId,p_target_type:targetType,p_student_name:student,p_subject_or_grade:subject\}\)/);
assert.doesNotMatch(source, /sb\.from\('education_requests'\)\.insert\s*\(/);
console.log("EDUCATION_REQUEST_BACKEND_BOUNDARY=PASS");
