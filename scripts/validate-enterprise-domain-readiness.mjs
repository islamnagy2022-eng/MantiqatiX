#!/usr/bin/env node
import fs from "node:fs";
import assert from "node:assert/strict";

const app = fs.readFileSync("web/app.js", "utf8");
const loaderStart = app.indexOf("async function loadEnterpriseDomainData(m)");
assert.notEqual(loaderStart, -1, "enterprise domain loader must exist");
const loaderEnd = app.indexOf("\n}", loaderStart);
assert.notEqual(loaderEnd, -1, "enterprise domain loader must terminate");
const loader = app.slice(loaderStart, loaderEnd);

assert.match(loader, /const rows=\{\},errors=\{\}/, "loader must track rows and read errors separately");
assert.match(loader, /if\(result\.error\)\{rows\[table\]=\[\];errors\[table\]=result\.error\.message\|\|'READ_UNAVAILABLE'\}/, "failed reads must preserve an error marker");
assert.match(loader, /cache\.rows=rows;cache\.errors=errors;cache\.rowsReady=true/, "cache must retain read errors");
assert.match(app, /\['ACCOUNTING','ERP','FACTORIES','TRIPS','MATRIMONY','MEDICAL'\]\.includes\(m\.key\)/, "medical module must reach its dedicated workspace");
assert.match(app, /Object\.keys\(d\.errors\|\|\{\}\)\.length[\s\S]{0,250}لا تُعامل هذه المصادر كسجلات فارغة/, "workspace must explicitly surface denied reads");
assert.match(app, /d\.errors\?\.\[t\]\?'غير متاح'/, "failed sources must not display a numeric zero as if readable");

console.log("ENTERPRISE_DOMAIN_READINESS=PASS");
