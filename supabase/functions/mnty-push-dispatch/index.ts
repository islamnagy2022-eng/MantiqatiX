import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  constantTimeSecretEquals,
  normalizePushNotification,
  readBoundedJson,
} from "../_shared/push-dispatch-security.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY = "BPLMpu7NvGMROu3CfsZdieVBgKrXI3u8o6m1COq24RHigGlZN60MakIvaiHmqU8CdcWDCM_F6IQgep4ok6DmUTg";
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

const cors = {
  "Access-Control-Allow-Origin": "https://islamnagy2022-eng.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-mnty-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: cors });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  try {
    const { data: secrets, error: secretError } = await supabaseAdmin.rpc("get_mnty_push_secrets").single();
    if (secretError || !secrets?.webhook_secret || !secrets?.vapid_private_key) {
      console.error("push secrets unavailable", secretError?.message);
      return json({ error: "PUSH_NOT_CONFIGURED" }, 503);
    }

    const suppliedSecret = req.headers.get("x-mnty-push-secret") || "";
    if (!constantTimeSecretEquals(suppliedSecret, secrets.webhook_secret)) {
      return json({ error: "UNAUTHORIZED" }, 401);
    }

    const parsed = await readBoundedJson(req);
    if (!parsed.ok) {
      return json({ error: parsed.reason === "TOO_LARGE" ? "PAYLOAD_TOO_LARGE" : "INVALID_JSON" }, parsed.reason === "TOO_LARGE" ? 413 : 400);
    }
    const notification = normalizePushNotification(parsed.value);
    if (!notification) return json({ error: "INVALID_NOTIFICATION" }, 400);

    webpush.setVapidDetails("mailto:admin@mantiqatix.com", VAPID_PUBLIC_KEY, secrets.vapid_private_key);

    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id,endpoint,p256dh,auth")
      .eq("user_id", notification.user_id)
      .eq("enabled", true);

    if (subError) {
      console.error("subscription query failed", subError.message);
      return json({ error: "SUBSCRIPTION_QUERY_FAILED" }, 500);
    }

    let delivered = 0;
    let removed = 0;
    const failed: string[] = [];

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      url: "./",
      notificationId: notification.id,
      type: notification.type,
    });

    for (const sub of subscriptions || []) {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        }, payload, { TTL: 3600 });
        delivered++;
        await supabaseAdmin.from("push_subscriptions")
          .update({ last_success_at: new Date().toISOString(), last_error_at: null, updated_at: new Date().toISOString() })
          .eq("id", sub.id);
      } catch (error) {
        const statusCode = Number((error as { statusCode?: number })?.statusCode || 0);
        if (statusCode === 404 || statusCode === 410) {
          await supabaseAdmin.from("push_subscriptions").delete().eq("id", sub.id);
          removed++;
        } else {
          failed.push(sub.id);
          await supabaseAdmin.from("push_subscriptions")
            .update({ last_error_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq("id", sub.id);
        }
        console.error("push send failed", sub.id, statusCode);
      }
    }

    return json({ ok: true, user_id: notification.user_id, subscriptions: subscriptions?.length || 0, delivered, removed, failed: failed.length });
  } catch (error) {
    console.error("push dispatch error", error instanceof Error ? error.name : "unknown");
    return json({ error: "PUSH_DISPATCH_FAILED" }, 500);
  }
});
