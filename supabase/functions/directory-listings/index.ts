import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const productionOrigin = "https://islamnagy2022-eng.github.io";
const allowedOrigins = new Set([
  productionOrigin,
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

const cors = (origin: string | null) => ({
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : productionOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Vary": "Origin",
  "Cache-Control": "no-store",
});

const out = (origin: string | null, body: unknown, status = 503) =>
  new Response(JSON.stringify(body), { status, headers: cors(origin) });

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");

  if (req.method === "OPTIONS") {
    if (origin && !allowedOrigins.has(origin)) {
      return out(origin, { error: "ORIGIN_NOT_ALLOWED" }, 403);
    }
    return new Response("ok", { status: 200, headers: cors(origin) });
  }

  if (origin && !allowedOrigins.has(origin)) {
    return out(origin, { error: "ORIGIN_NOT_ALLOWED" }, 403);
  }

  if (req.method === "GET") {
    // Preserve the existing public page contract while returning no unconsented records.
    // This prevents the already-published frontend from showing a false network error.
    return out(origin, {
      listings: [],
      pageSize: 0,
      hasMore: false,
      nextCursor: null,
      directoryDisabled: true,
    }, 200);
  }

  if (req.method === "POST") {
    // All unclaimed listing claims and mutations remain disabled until RC472/RC473
    // and the owner contact-consent/source-rights release gate are complete.
    return out(origin, {
      error: "DIRECTORY_LISTINGS_DISABLED_FOR_V1",
      message: "This directory is temporarily unavailable while owner contact permissions are being verified.",
    }, 503);
  }

  return out(origin, { error: "METHOD_NOT_ALLOWED" }, 405);
});
