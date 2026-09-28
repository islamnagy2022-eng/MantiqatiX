import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {"Content-Type":"application/json","Cache-Control":"no-store"},
  })

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2,"0")).join("")
}

async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    {name:"HMAC",hash:"SHA-256"}, false, ["sign"]
  )
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value)))
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let x = 0
  for (let i=0;i<a.length;i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return x === 0
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({error:"Method Not Allowed"},405)

  const secret = Deno.env.get("MANTIQATIX_WEBHOOK_SECRET")
  if (!secret) return json({error:"Payment webhook is not configured"},503)

  const signature = req.headers.get("x-mantiqatix-signature") ?? ""
  const timestamp = req.headers.get("x-mantiqatix-timestamp") ?? ""
  if (!/^\d+$/.test(timestamp)) return json({error:"Missing or invalid webhook timestamp"},401)

  const ts = Number(timestamp)
  if (!Number.isSafeInteger(ts) || Math.abs(Date.now()/1000-ts) > 300) {
    return json({error:"Webhook timestamp outside allowed window"},401)
  }

  const body = await req.text()
  const expected = await hmac(secret, timestamp + "." + body)
  if (!safeEqual(signature.toLowerCase(), expected.toLowerCase())) {
    return json({error:"Invalid webhook signature"},401)
  }

  let event: any
  try { event = JSON.parse(body) } catch { return json({error:"Invalid JSON"},400) }

  const required = ["tenantId","provider","externalEventId","paymentIntentId","eventType","confirmedAmount","currency","signatureVerified"]
  for (const k of required) if (event[k] === undefined || event[k] === null) return json({error:"Missing field: "+k},400)

  if (event.signatureVerified !== true) return json({error:"Provider signature must be verified before settlement"},400)
  if (Number(event.confirmedAmount) <= 0) return json({error:"confirmedAmount must be positive"},400)

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    {auth:{persistSession:false,autoRefreshToken:false}}
  )

  const {data, error} = await supabaseAdmin.rpc("process_verified_provider_payment", {
    p_event_id: String(event.eventId ?? ("webhook:"+event.externalEventId)),
    p_tenant_id: String(event.tenantId),
    p_provider: String(event.provider),
    p_external_event_id: String(event.externalEventId),
    p_payment_intent_id: String(event.paymentIntentId),
    p_event_type: String(event.eventType),
    p_signature_verified: true,
    p_provider_confirmed_amount: Number(event.confirmedAmount),
    p_provider_confirmed_currency: String(event.currency),
    p_platform_received_amount: event.platformReceivedAmount == null ? null : Number(event.platformReceivedAmount),
  })

  if (error) {
    console.error("provider settlement error", error)
    return json({error:"Payment event could not be processed"},400)
  }

  return json(data)
})
