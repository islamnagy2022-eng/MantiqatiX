import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PUSH_BODY_BYTES,
  constantTimeSecretEquals,
  normalizePushNotification,
  readBoundedJson,
} from "../functions/_shared/push-dispatch-security.mjs";

test("shared-secret comparison accepts only exact non-empty values", () => {
  assert.equal(constantTimeSecretEquals("secret-value", "secret-value"), true);
  assert.equal(constantTimeSecretEquals("secret-value", "secret-valUe"), false);
  assert.equal(constantTimeSecretEquals("secret", "secret-long"), false);
  assert.equal(constantTimeSecretEquals("", "secret"), false);
  assert.equal(constantTimeSecretEquals("secret", ""), false);
});

test("bounded JSON reader accepts valid payloads", async () => {
  const request = new Request("https://example.test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ok: true }),
  });
  assert.deepEqual(await readBoundedJson(request), { ok: true, value: { ok: true } });
});

test("bounded JSON reader rejects oversized declared and streamed bodies", async () => {
  const declared = new Request("https://example.test", {
    method: "POST",
    headers: { "content-length": String(MAX_PUSH_BODY_BYTES + 1) },
    body: "{}",
  });
  assert.deepEqual(await readBoundedJson(declared), { ok: false, reason: "TOO_LARGE" });
  const streamed = new Request("https://example.test", {
    method: "POST",
    body: "x".repeat(MAX_PUSH_BODY_BYTES + 1),
  });
  assert.deepEqual(await readBoundedJson(streamed), { ok: false, reason: "TOO_LARGE" });
});

test("bounded JSON reader rejects malformed JSON", async () => {
  const malformed = new Request("https://example.test", { method: "POST", body: "{" });
  assert.deepEqual(await readBoundedJson(malformed), { ok: false, reason: "INVALID_JSON" });
});

test("notification validation constrains recipient and payload fields", () => {
  const valid = normalizePushNotification({ user_id: "11111111-1111-1111-1111-111111111111", title: "Hello", body: "World" });
  assert.deepEqual(valid, { user_id: "11111111-1111-1111-1111-111111111111", title: "Hello", body: "World", type: "GENERAL", id: null });
  assert.equal(normalizePushNotification({ user_id: "not-a-uuid" }), null);
  assert.equal(normalizePushNotification({ user_id: "11111111-1111-1111-1111-111111111111", title: "x".repeat(121) }), null);
  assert.equal(normalizePushNotification({ user_id: "11111111-1111-1111-1111-111111111111", body: "x".repeat(2001) }), null);
  assert.equal(normalizePushNotification({ user_id: "11111111-1111-1111-1111-111111111111", type: "INVALID TYPE" }), null);
});