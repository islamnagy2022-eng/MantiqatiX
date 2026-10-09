import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const allowedOrigin = "https://islamnagy2022-eng.github.io";
const maxBodyBytes = 65536;
const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-request-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const out = (body: unknown, status = 200, requestId?: string) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store", ...(requestId ? { "X-Request-Id": requestId } : {}) },
  });

Deno.serve(async (req: Request) => {
  const requestId = req.headers.get("x-request-id") || crypto.randomUUID();
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") {
    if (origin && origin !== allowedOrigin) return out({ error: "ORIGIN_NOT_ALLOWED", requestId }, 403, requestId);
    return new Response("ok", { status: 200, headers: corsHeaders });
  }
  if (origin && origin !== allowedOrigin) return out({ error: "ORIGIN_NOT_ALLOWED", requestId }, 403, requestId);
  if (req.method !== "POST") return out({ error: "METHOD_NOT_ALLOWED", requestId }, 405, requestId);

  const authorization = req.headers.get("Authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return out({ error: "AUTH_REQUIRED", requestId }, 401, requestId);
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return out({ error: "SERVER_CONFIGURATION_ERROR", requestId }, 503, requestId);

  try {
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: auth, error: authError } = await admin.auth.getUser(authorization.slice(7).trim());
    if (authError || !auth.user || auth.user.is_anonymous) return out({ error: "AUTH_REQUIRED", requestId }, 401, requestId);

    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > maxBodyBytes) return out({ error: "PAYLOAD_TOO_LARGE", requestId }, 413, requestId);
    let body: unknown;
    try { body = JSON.parse(raw); } catch { return out({ error: "INVALID_JSON", requestId }, 400, requestId); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return out({ error: "INVALID_JSON", requestId }, 400, requestId);
    const b = body as Record<string, unknown>;
    const tenantId = String(b.tenantId ?? "").trim();
    if (!tenantId || tenantId.length > 128 || !b.entry || typeof b.entry !== "object" || Array.isArray(b.entry) || !Array.isArray(b.lines)) {
      return out({ error: "MISSING_FIELD", requestId }, 400, requestId);
    }
    if (b.lines.length < 1 || b.lines.length > 500) return out({ error: "JOURNAL_LINES_REQUIRED", requestId }, 400, requestId);
    const sourceEntry = b.entry as Record<string, unknown>;
    const entryId = String(sourceEntry.id ?? "").trim();
    if (!entryId || entryId.length > 180) return out({ error: "JOURNAL_ID_REQUIRED", requestId }, 400, requestId);
    const entry = { ...sourceEntry, id: entryId, tenant_id: tenantId, status: "POSTED" };

    const { data: result, error } = await admin.rpc("post_financial_journal_atomic_backend", {
      p_user_id: auth.user.id,
      p_entry: entry,
      p_lines: b.lines,
    });
    if (error) {
      const code = String(error.message ?? "");
      const safeCode = [
        "FINANCIAL_MEMBERSHIP_REQUIRED", "JOURNAL_IDEMPOTENCY_CONFLICT", "JOURNAL_LEDGER_INCONSISTENT",
        "JOURNAL_ENTRY_NUMBER_CONFLICT", "UNBALANCED_JOURNAL", "JOURNAL_LINE_TOTAL_MISMATCH",
        "ACCOUNT_NOT_ACTIVE_FOR_TENANT", "ACCOUNT_REQUIRED", "INVALID_LINE_AMOUNT", "INVALID_LINE_SIDE",
        "JOURNAL_LINES_REQUIRED", "JOURNAL_ID_REQUIRED", "TENANT_REQUIRED", "JOURNAL_ENTRY_REQUIRED",
        "DUPLICATE_JOURNAL_LINE_ID", "ONLY_POSTED_JOURNALS_SUPPORTED",
      ].find(x => code.includes(x));
      const status = code.includes("FINANCIAL_MEMBERSHIP_REQUIRED") ? 403
        : code.includes("IDEMPOTENCY_CONFLICT") || code.includes("LEDGER_INCONSISTENT") || error.code === "23505" ? 409
        : code.includes("NOT_ACTIVE") || code.includes("REQUIRED") || code.includes("UNBALANCED") || code.includes("INVALID") || code.includes("MISMATCH") ? 400 : 500;
      console.error(JSON.stringify({ requestId, stage: "post_financial_journal_atomic_backend", code: error.code }));
      return out({ error: safeCode ?? "JOURNAL_POST_FAILED", requestId }, status, requestId);
    }
    return out({ ...(result && typeof result === "object" ? result as Record<string, unknown> : {}), requestId }, 200, requestId);
  } catch {
    console.error(JSON.stringify({ requestId, stage: "unhandled" }));
    return out({ error: "JOURNAL_POST_FAILED", requestId }, 500, requestId);
  }
});
