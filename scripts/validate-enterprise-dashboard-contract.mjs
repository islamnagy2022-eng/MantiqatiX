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
assert.match(index, /app\.js\?v=enterprise-command-center-binding-20261127/, "HTML must request the refreshed app asset");
assert.match(index, /sw\.js\?v=enterprise-command-center-binding-20261127/, "HTML must request the refreshed service worker");
assert.match(sw, /const CACHE='mnty-web-v150'/, "service-worker shell cache must rotate");
assert.match(sw, /\.\/app\.js\?v=enterprise-command-center-binding-20261127/, "service-worker precache must match the app asset version");

console.log("Enterprise dashboard interaction source contract: PASS");
