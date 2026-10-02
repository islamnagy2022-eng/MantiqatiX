import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  const auth = req.headers.get("Authorization");
  if (!auth) return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), { status: 401, headers: {"Content-Type":"application/json"} });

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } }
  );
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user || user.is_anonymous) {
    return new Response(JSON.stringify({ error: "AUTH_REQUIRED" }), { status: 401, headers: {"Content-Type":"application/json"} });
  }

  try {
    const body = await req.json();
    const required = ["id","tenantId","beneficiaryType","beneficiaryId","gross","platformFee","net","voucher"];
    for (const key of required) if (body[key] === undefined || body[key] === null || body[key] === "") throw new Error(`MISSING_${key}`);

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await serviceClient.rpc("create_settlement_and_post_journal", {
      p_id: String(body.id),
      p_tenant_id: String(body.tenantId),
      p_beneficiary_type: String(body.beneficiaryType),
      p_beneficiary_id: String(body.beneficiaryId),
      p_gross: Number(body.gross),
      p_platform_fee: Number(body.platformFee),
      p_net: Number(body.net),
      p_voucher: Number(body.voucher),
      p_channel: body.channel ? String(body.channel) : null,
      p_reference_id: body.referenceId ? String(body.referenceId) : null,
      p_business_id: body.businessId ? String(body.businessId) : null,
      p_description: body.description ? String(body.description) : null,
      p_actor_user_id: user.id
    });
    if (error) throw error;
    return new Response(JSON.stringify(data), { status: 200, headers: {"Content-Type":"application/json"} });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "SETTLEMENT_FAILED" }), { status: 400, headers: {"Content-Type":"application/json"} });
  }
});