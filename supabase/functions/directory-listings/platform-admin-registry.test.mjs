import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveDirectoryPlatformAdmin } from "./platform-admin-registry.mjs";

test("only an exact true registry result authorizes platform administration", () => {
  assert.equal(resolveDirectoryPlatformAdmin(true, null), true);
});

test("false registry result denies platform administration", () => {
  assert.equal(resolveDirectoryPlatformAdmin(false, null), false);
});

test("registry errors fail closed", () => {
  assert.equal(resolveDirectoryPlatformAdmin(true, new Error("registry unavailable")), false);
});

test("truthy non-boolean and missing results fail closed", () => {
  assert.equal(resolveDirectoryPlatformAdmin("true", null), false);
  assert.equal(resolveDirectoryPlatformAdmin(1, null), false);
  assert.equal(resolveDirectoryPlatformAdmin(undefined, null), false);
});
