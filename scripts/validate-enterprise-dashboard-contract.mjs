import fs from "node:fs";
import assert from "node:assert/strict";

const app = fs.readFileSync("web/app.js", "utf8");
const index = fs.readFileSync("web/index.html", "utf8");
const sw = fs.readFileSync("web/sw.js", "utf8");

assert.match(app, /function enterpriseCommandCenter\(\)/, "enterprise command center must be rendered");
assert.match(app, /function bindEnterpriseCommandCenter\(\)/, "enterprise command center must have an interaction binder");
assert.match(app, /data-ec-module=/, "enterprise dashboard actions must declare their navigation target");
assert.match(app, /document\.querySelectorAll\('\[data-ec-module\]'\)/, "the binder must attach navigation to command-center actions");
assert.match(app, /input\?\.addEventListener\('keydown',event=>\{if\(event\.key==='Enter'\)\{event\.preventDefault\(\);run\(\)\}\}\)/, "quick search must execute on Enter");
assert.match(app, /async function renderApp\([\s\S]*?bindRoleCommandCenter\(\);bindEnterpriseCommandCenter\(\);bindAttentionCenter\(\)/, "the binder must run after the authenticated workspace is rendered");
assert.equal((app.match(/bindEnterpriseCommandCenter\(\);/g) || []).length, 1, "the enterprise binder must not be called from the unauthenticated auth view");
const appAssetVersion = index.match(/app\.js\?v=([^'"]+)/)?.[1];
const swRegistrationVersion = index.match(/sw\.js\?v=([^'"]+)/)?.[1];
const cacheVersion = sw.match(/const CACHE='([^']+)'/)?.[1];
assert.ok(appAssetVersion, "HTML must version the app asset");
assert.ok(swRegistrationVersion, "HTML must version the service worker");
assert.match(cacheVersion || "", /^mnty-web-v\d+$/, "service-worker shell cache must use a versioned key");
assert.ok(sw.includes("./app.js?v=" + appAssetVersion), "service-worker precache must match the current app asset version");

assert.match(app, /async function loadSuperAdminActivityDirectory\(\)/, "Super Admin activity directory loader must exist");
assert.match(app, /id="sa-activity-directory-list"/, "Super Admin activity directory must have a render target");
assert.match(app, /loadSuperAdminActivityDirectory\(\);/, "Super Admin activity directory must load when the control workspace initializes");
assert.match(app, /sb\.from\('businesses'\)\.select\('id,name,code,status,updated_at'\)/, "activity directory must read an explicit business field allowlist");
const activityLoaderStart = app.indexOf("async function loadSuperAdminActivityDirectory()");
const activityLoaderEnd = app.indexOf("\nfunction loadOfficialShowcaseAdmin()", activityLoaderStart);
assert.ok(activityLoaderStart >= 0 && activityLoaderEnd > activityLoaderStart, "activity directory loader boundaries must be present");
const activityLoader = app.slice(activityLoaderStart, activityLoaderEnd);
assert.doesNotMatch(activityLoader, /\.insert\(|\.update\(|\.upsert\(|\.delete\(/, "activity directory must remain read-only");

console.log("Enterprise dashboard interaction source contract: PASS");
