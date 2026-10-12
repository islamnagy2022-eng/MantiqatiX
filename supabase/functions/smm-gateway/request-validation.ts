export type BoundedJsonResult =
  | { ok: true; value: any }
  | { ok: false; code: "REQUEST_TOO_LARGE" | "INVALID_JSON" | "INVALID_REQUEST" | "UNSUPPORTED_MEDIA_TYPE"; status: 400 | 413 | 415 };

export async function readBoundedJson(req: Request, maxBytes = 65_536): Promise<BoundedJsonResult> {
  const contentType = (req.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json" && !contentType.endsWith("+json")) {
    return { ok: false, code: "UNSUPPORTED_MEDIA_TYPE", status: 415 };
  }
  const contentLength = req.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maxBytes) {
    return { ok: false, code: "REQUEST_TOO_LARGE", status: 413 };
  }
  const reader = req.body?.getReader();
  if (!reader) return { ok: false, code: "INVALID_JSON", status: 400 };
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > maxBytes) {
        try { await reader.cancel(); } catch { /* the size limit still wins */ }
        return { ok: false, code: "REQUEST_TOO_LARGE", status: 413 };
      }
      chunks.push(part.value);
    }
  } catch {
    return { ok: false, code: "INVALID_JSON", status: 400 };
  } finally {
    try { reader.releaseLock(); } catch { /* stream may already be released */ }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  let value: unknown;
  try { value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { return { ok: false, code: "INVALID_JSON", status: 400 }; }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "INVALID_REQUEST", status: 400 };
  }
  return { ok: true, value };
}
