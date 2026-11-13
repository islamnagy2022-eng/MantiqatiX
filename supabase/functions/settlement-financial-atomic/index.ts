import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { hasSettlementAuthority } from "./authorization.mjs";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
});

const text = (value: unknown): string => value === null || value === undefined ? "" : String(value).trim();
const optionalText = (value: unknown): string | null => text(value) || null;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type SettlementMembership = {
  tenant_id: string;
  business_id: string | null;
  branch_id: string | null;
  role: string;
  status: string;
  created_at: string;
  permissions: Record<string, unknown> | null;
};

const SAFE_SETTLEMENT_ERRORS = new Set([
  "INVALID_BENEFICIARY_TYPE",
  "BENEFICIARY_REQUIRED",
  "INVALID_SETTLEMENT_AMOUNT",
  "SETTLEMENT_BREAKDOWN_MISMATCH",
  "PARTNER_SETTLEMENT_MUST_EQUAL_GROSS",
  "MERCHANT_VOUCHER_MUST_BE_ZERO",
  "COA_1020_MISSING",
  "COA_2010_MISSING",
  "COA_PARTNER_ACCOUNTS_MISSING",
  "SETTLEMENT_TOTAL_MUST_BE_POSITIVE",
  "GENERAL_LEDGER_POSTING_FAILED",
]);

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "METHOD_NOT_ALLOWED" }, 405);

  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "AUTH_REQUIRED" }, 401);

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authorization } } },
  );
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user || user.is_anonymous) return json({ error: "AUTH_REQUIRED" }, 401);

  try {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "INVALID_REQUEST" }, 400);

    const id = text(body.id);
    const tenantId = text(body.tenantId);
    const beneficiaryType = text(body.beneficiaryType).toUpperCase();
    const beneficiaryId = text(body.beneficiaryId);
    const businessId = optionalText(body.businessId);
    const numericFields = ["gross", "platformFee", "net", "voucher"] as const;
    const amounts = Object.fromEntries(numericFields.map((key) => [key, Number(body[key])])) as Record<typeof numericFields[number], number>;

    if (!id || id.length > 160 || !tenantId || tenantId.length > 80 || !beneficiaryId || beneficiaryId.length > 160) {
      return json({ error: "INVALID_REQUEST" }, 400);
    }
    if (!new Set(["PARTNER", "MERCHANT"]).has(beneficiaryType)) return json({ error: "INVALID_BENEFICIARY_TYPE" }, 400);
    if (businessId && !UUID_RE.test(businessId)) return json({ error: "INVALID_BUSINESS_SCOPE" }, 400);
    if (beneficiaryType === "MERCHANT" && !businessId) return json({ error: "BUSINESS_SCOPE_REQUIRED" }, 400);
    if (numericFields.some((key) => !Number.isFinite(amounts[key]) || amounts[key] < 0)) {
      return json({ error: "INVALID_SETTLEMENT_AMOUNT" }, 400);
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Authorization is bound to the verified Auth user and the exact requested scope.
    // Business-level or branch-level membership must never imply tenant-wide authority.
    const { data: memberships, error: membershipError } = await serviceClient
      .from("user_memberships")
      .select("tenant_id,business_id,branch_id,role,status,permissions,created_at")
      .eq("user_id", user.id)
      .eq("tenant_id", tenantId)
      .eq("status", "ACTIVE")
      .order("created_at", { ascending: true });

    if (membershipError) {
      console.error("settlement membership lookup failed", membershipError);
      return json({ error: "AUTHORIZATION_CHECK_FAILED" }, 503);
    }

    const authorizedMemberships = (memberships ?? []) as unknown as SettlementMembership[];
    if (!hasSettlementAuthority({ tenantId, businessId, memberships: authorizedMemberships })) {
      return json({ error: "SETTLEMENT_FORBIDDEN" }, 403);
    }

    if (businessId) {
      const { data: business, error: businessError } = await serviceClient
        .from("businesses")
        .select("id")
        .eq("id", businessId)
        .eq("tenant_id", tenantId)
        .eq("status", "ACTIVE")
        .maybeSingle();
      if (businessError) {
        console.error("settlement business lookup failed", businessError);
        return json({ error: "BUSINESS_SCOPE_CHECK_FAILED" }, 503);
      }
      if (!business) return json({ error: "BUSINESS_SCOPE_INVALID" }, 403);
    }

    const { data, error } = await serviceClient.rpc("create_settlement_and_post_journal", {
      p_id: id,
      p_tenant_id: tenantId,
      p_beneficiary_type: beneficiaryType,
      p_beneficiary_id: beneficiaryId,
      p_gross: amounts.gross,
      p_platform_fee: amounts.platformFee,
      p_net: amounts.net,
      p_voucher: amounts.voucher,
      p_channel: optionalText(body.channel),
      p_reference_id: optionalText(body.referenceId),
      p_business_id: businessId,
      p_description: optionalText(body.description),
      p_actor_user_id: user.id,
    });

    if (error) {
      console.error("settlement RPC failed", { code: error.code, message: error.message });
      const code = String(error.message ?? "").trim();
      return json({ error: SAFE_SETTLEMENT_ERRORS.has(code) ? code : "SETTLEMENT_FAILED" }, SAFE_SETTLEMENT_ERRORS.has(code) ? 409 : 500);
    }

    return json(data, 200);
  } catch (error) {
    console.error("settlement request failed", error);
    return json({ error: "SETTLEMENT_FAILED" }, 400);
  }
});
