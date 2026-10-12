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
      host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") ||
      /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")) {
    throw new Error("Provider endpoint rejected by outbound URL policy");
  }
  return endpoint;
}

export async function readProviderJson(response: Response, maxBytes = 1_048_576): Promise<unknown> {
  if (!response.ok) throw new Error("Provider HTTP " + response.status);
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
