import fs from "node:fs";
import assert from "node:assert/strict";

const app = fs.readFileSync("web/app.js", "utf8");
const index = fs.readFileSync("web/index.html", "utf8");

assert.match(app, /case'التسويق والإعلان':return marketingAgencyWorkspace\(\)/);
assert.match(app, /function marketingAgencyWorkspace\(\)/);
assert.match(app, /live\.records\.leads/);
assert.match(app, /live\.records\.providers/);
assert.match(app, /live\.records\.projects/);
assert.match(app, /live\.records\.ads/);
assert.match(app, /function bindMarketingAgencyWorkspace\(\)/);
assert.match(app, /bindMarketingAgencyWorkspace\(\);/);
assert.match(app, /data-marketing-tab-go/);
assert.match(app, /ADS API/);
assert.match(app, /NOT CONNECTED/);
assert.match(index, /app\.js\?v=rc454-marketing-workspace-20261010/);

console.log("Marketing agency workspace contract: PASS (12 assertions)");
