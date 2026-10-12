export function assertSafeProviderEndpoint(value: unknown, allowlistCsv: string | undefined): URL {
  let endpoint: URL;
  try { endpoint = new URL(String(value ?? "")); }
  catch { throw new Error("Invalid provider endpoint"); }

  const host = endpoint.hostname.toLowerCase().replace(/\.$/, "");
  const allowed = new Set((allowlistCsv ?? "").split(",").map((item) => item.trim().toLowerCase().replace(/\.$/, "")).filter(Boolean));
  if (allowed.size === 0 || !allowed.has(host)) {
    throw new Error("Provider hostname is not in SMM_PROVIDER_HOSTS allowlist");
  }
  if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password ||
      (endpoint.port !== "" && endpoint.port !== "443") ||
      !host.includes(".") || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      host.endsWith(".internal") || host.endsWith(".test") || host.endsWith(".invalid") || host.endsWith(".example") || host.endsWith(".onion") ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
    throw new Error("Provider endpoint rejected by outbound URL policy");
  }
  return endpoint;
}

export async function readProviderJson(response: Response, maxBytes = 1_048_576): Promise<unknown> {
  if (!response.ok) throw new Error("Provider HTTP " + response.status);
  const contentType = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json" && !contentType.endsWith("+json")) throw new Error("Provider response is not JSON");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Provider returned an empty response");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        throw new Error("Provider response exceeded size limit");
      }
      chunks.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error("Provider returned invalid JSON");
  }
}


export type ProviderBalance = { balance: number; currency: string | null };

export function normalizeProviderBalance(value: unknown): ProviderBalance | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if ((typeof row.balance !== "number" && typeof row.balance !== "string") ||
      (typeof row.balance === "string" && row.balance.trim() === "")) return null;
  const balance = Number(row.balance);
  if (!Number.isFinite(balance) || balance < 0) return null;
  const rawCurrency = typeof row.currency === "string" ? row.currency.trim().toUpperCase() : "";
  const currency = /^[A-Z]{3,8}$/.test(rawCurrency) ? rawCurrency : null;
  return { balance: Math.round((balance + Number.EPSILON) * 100) / 100, currency };
}
