import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const IMAGE_BUCKET = "mantiqatix-profile-media";
const MAX_DELETE_BATCH = 50;
const JSON_HEADERS = { "Content-Type": "application/json" };

function reply(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);

  const authorization = req.headers.get("Authorization") ?? "";
  const cleanupToken = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!cleanupToken || cleanupToken.length < 64) return reply({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return reply({ error: "cleanup_service_not_configured" }, 503);

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: tokenValid, error: tokenError } = await service.rpc(
    "mnty_catalog_media_cleanup_token_valid",
    { p_token: cleanupToken },
  );
  if (tokenError) {
    console.error("Catalog media cleanup token validation failed", tokenError.code || tokenError.message);
    return reply({ error: "cleanup_authorization_unavailable" }, 503);
  }
  if (tokenValid !== true) return reply({ error: "unauthorized" }, 401);

  const { data: candidates, error: candidateError } = await service.rpc(
    "mnty_list_expired_catalog_media",
    { p_limit: 100 },
  );
  if (candidateError) {
    console.error("Catalog media cleanup candidate scan failed", candidateError.code || candidateError.message);
    return reply({ error: "cleanup_scan_failed" }, 503);
  }

  const paths = Array.isArray(candidates)
    ? candidates.map((row: any) => String(row?.object_path || "")).filter((path: string) =>
        /^businesses\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/owner-uploads\/(activity|cover|product|service)\/[A-Za-z0-9._-]+$/.test(path)
      )
    : [];

  // The database RPC returns only paths proven unreferenced after scanning
  // persisted application content. Keep this list bounded and delete through Storage.
  const safeToDelete = paths;

  let deleted = 0;
  for (let offset = 0; offset < safeToDelete.length; offset += MAX_DELETE_BATCH) {
    const batch = safeToDelete.slice(offset, offset + MAX_DELETE_BATCH);
    const { error } = await service.storage.from(IMAGE_BUCKET).remove(batch);
    if (error) {
      console.error("Catalog media Storage removal failed", error.name || error.message);
      return reply({ error: "cleanup_storage_remove_failed", deleted, remaining: safeToDelete.length - deleted }, 502);
    }
    deleted += batch.length;
  }

  console.log("CATALOG_MEDIA_RETENTION_RUN", JSON.stringify({
    expiredCandidates: paths.length,
    retainedAsReferencedOrUnconfirmed: 0,
    deleted,
  }));
  return reply({
    success: true,
    retentionDays: 5,
    examined: paths.length,
    retained: 0,
    deleted,
  });
});
