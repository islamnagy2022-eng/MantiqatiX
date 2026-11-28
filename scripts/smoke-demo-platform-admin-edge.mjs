const baseUrl = process.env.DEMO_SUPABASE_URL;
const apiKey = process.env.DEMO_SUPABASE_ANON_KEY;
const allowedOrigin = "https://islamnagy2022-eng.github.io";
const disallowedOrigin = "https://not-allowed.example";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(label + " did not return JSON");
  }
}

async function request(url, init, label) {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(20000),
  });
  const body = await response.text();
  return { response, body, label };
}

async function main() {
  assert(baseUrl, "DEMO_SUPABASE_URL is required");
  assert(apiKey, "DEMO_SUPABASE_ANON_KEY is required");
  assert(/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(baseUrl), "DEMO_SUPABASE_URL must be a Supabase HTTPS project URL");

  const endpoint = baseUrl.replace(/\/$/, "") + "/functions/v1/catalog-platform-admin";

  // Browser preflight must be reachable without a bearer token.
  const preflight = await request(endpoint, {
    method: "OPTIONS",
    headers: {
      Origin: allowedOrigin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization, apikey, content-type",
    },
  }, "allowed-origin-preflight");

  assert(
    preflight.response.status === 200 || preflight.response.status === 204,
    "Allowed-origin preflight failed: HTTP " + preflight.response.status,
  );
  assert(
    preflight.response.headers.get("access-control-allow-origin") === allowedOrigin,
    "Allowed-origin preflight did not echo the approved site origin",
  );
  const allowMethods = (preflight.response.headers.get("access-control-allow-methods") || "").toUpperCase();
  assert(allowMethods.includes("POST") && allowMethods.includes("OPTIONS"), "Preflight methods do not include POST and OPTIONS");
  const allowHeaders = (preflight.response.headers.get("access-control-allow-headers") || "").toLowerCase();
  for (const header of ["authorization", "apikey", "content-type"]) {
    assert(allowHeaders.includes(header), "Preflight does not allow required header: " + header);
  }
  console.log("DEMO_PLATFORM_ADMIN_CORS_PREFLIGHT=PASS");

  // An anonymous POST must stop before request parsing or any privileged action.
  const unauthenticated = await request(endpoint, {
    method: "POST",
    headers: {
      Origin: allowedOrigin,
      apikey: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "TENANT_LIST" }),
  }, "unauthenticated-post");

  assert(unauthenticated.response.status === 401, "Unauthenticated POST must return HTTP 401; got " + unauthenticated.response.status);
  const unauthenticatedJson = parseJson(unauthenticated.body, unauthenticated.label);
  assert(unauthenticatedJson.error === "AUTH_REQUIRED", "Unauthenticated POST returned an unexpected error contract");
  console.log("DEMO_PLATFORM_ADMIN_ANONYMOUS_DENIED=PASS");

  // A non-allowlisted origin must be rejected before authentication or data access.
  const foreignOrigin = await request(endpoint, {
    method: "POST",
    headers: {
      Origin: disallowedOrigin,
      apikey: apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "TENANT_LIST" }),
  }, "disallowed-origin-post");

  assert(foreignOrigin.response.status === 403, "Disallowed origin must return HTTP 403; got " + foreignOrigin.response.status);
  const foreignJson = parseJson(foreignOrigin.body, foreignOrigin.label);
  assert(foreignJson.error === "ORIGIN_NOT_ALLOWED", "Disallowed origin returned an unexpected error contract");
  assert(
    foreignOrigin.response.headers.get("access-control-allow-origin") !== disallowedOrigin,
    "Function must not grant CORS access to a disallowed origin",
  );
  console.log("DEMO_PLATFORM_ADMIN_ORIGIN_REJECTED=PASS");
}

main().catch((error) => {
  console.error("DEMO_PLATFORM_ADMIN_HTTP_SMOKE=FAIL", error?.message || String(error));
  process.exitCode = 1;
});
