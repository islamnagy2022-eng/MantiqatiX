import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { readBoundedJson } from "./request-validation.ts";

function jsonRequest(body: string, headers: Record<string, string> = { "content-type": "application/json" }) {
  return new Request("https://gateway.example.test", { method: "POST", headers, body });
}

Deno.test("S07_REQUEST_001: accepts JSON object and vendor +json media types", async () => {
  assertEquals(await readBoundedJson(jsonRequest('{"action":"catalog"}')), {
    ok: true, value: { action: "catalog" },
  });
  assertEquals((await readBoundedJson(jsonRequest('{"action":"catalog"}', {
    "content-type": "application/vnd.mantiqatix+json; charset=utf-8",
  }))).ok, true);
});

Deno.test("S07_REQUEST_002: rejects missing or unsupported content type", async () => {
  assertEquals(await readBoundedJson(jsonRequest("{}", {})), {
    ok: false, code: "UNSUPPORTED_MEDIA_TYPE", status: 415,
  });
  assertEquals((await readBoundedJson(jsonRequest("{}", { "content-type": "text/plain" }))).status, 415);
});

Deno.test("S07_REQUEST_003: enforces declared and streamed byte limits", async () => {
  assertEquals(await readBoundedJson(jsonRequest('{"long":"123456"}'), 8), {
    ok: false, code: "REQUEST_TOO_LARGE", status: 413,
  });
  assertEquals(await readBoundedJson(jsonRequest("{}", {
    "content-type": "application/json", "content-length": "999",
  }), 8), {
    ok: false, code: "REQUEST_TOO_LARGE", status: 413,
  });
  assertEquals((await readBoundedJson(jsonRequest("{}", {
    "content-type": "application/json", "content-length": "invalid",
  }), 8)).status, 400);
});

Deno.test("S07_REQUEST_004: rejects malformed JSON, invalid UTF-8, arrays, and primitives", async () => {
  assertEquals((await readBoundedJson(jsonRequest("{"))).code, "INVALID_JSON");
  const invalidUtf8 = new Request("https://gateway.example.test", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: new Uint8Array([0xff, 0xfe]),
  });
  assertEquals((await readBoundedJson(invalidUtf8)).code, "INVALID_JSON");
  for (const body of ["[]", "null", "true", "42", '"text"']) {
    assertEquals((await readBoundedJson(jsonRequest(body))).code, "INVALID_REQUEST");
  }
});

Deno.test("S07_REQUEST_005: missing body fails closed", async () => {
  const req = new Request("https://gateway.example.test", {
    method: "POST", headers: { "content-type": "application/json" },
  });
  assertEquals((await readBoundedJson(req)).code, "INVALID_JSON");
});
