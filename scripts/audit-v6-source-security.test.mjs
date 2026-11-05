import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "audit-v6-source-security.mjs");
const writeTree = (root, files) => {
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
};

test("reports candidate blockers without printing credential literals", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "v6-audit-blocked-"));
  try {
    const sentinel = "DO_NOT_LEAK_THIS_SECRET_123456789";
    writeTree(root, {
      "src/data/seedData.ts": `const config = { apiKey: "${sentinel}", adminPassword: "unsafe" }; const DEFAULT_PAYMOB_CONFIG = { enabled: true };`,
      "server.ts": `app.get("/api/production-state", handler); app.post("/api/production-state", handler); app.listen(3000, "0.0.0.0");`,
      "src/context/AppContext.tsx": `const commitCurrentDataAsOfficialLive = async () => { localStorage.setItem(STORAGE_KEYS.ADOPTED_BASELINE, "x"); return { success: true }; };`,
      "src/App.tsx": `const visitorCount = state.visitors || 1200;`,
      "src/utils/loadTestingEngine.ts": `const load = Math.random(); // concurrent users simulation`,
    });
    const result = spawnSync(process.execPath, [script, root], { encoding: "utf8" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /V6_SOURCE_SECURITY_AUDIT=BLOCKED/);
    for (const id of ["V6-SEC-001", "V6-SEC-002", "V6-PAY-001", "V6-SEC-003", "V6-SEC-004", "V6-DATA-001", "V6-METRIC-001", "V6-METRIC-002"]) {
      assert.match(result.stderr, new RegExp(id));
    }
    assert.equal(result.stderr.includes(sentinel), false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("passes when no configured static blockers exist", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "v6-audit-clean-"));
  try {
    writeTree(root, {
      "src/data/seedData.ts": "export const defaults = {};",
      "server.ts": "export const serverMode = 'development-only';",
      "src/context/AppContext.tsx": "export const appState = {};",
      "src/App.tsx": "export const visitorCount = null;",
      "src/utils/loadTestingEngine.ts": "export const measured = true;",
    });
    const result = spawnSync(process.execPath, [script, root], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /V6_SOURCE_SECURITY_AUDIT=PASS/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
