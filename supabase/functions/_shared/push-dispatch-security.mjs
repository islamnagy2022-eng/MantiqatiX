export const MAX_PUSH_BODY_BYTES = 16 * 1024;

export function constantTimeSecretEquals(candidate, expected) {
  if (typeof candidate !== "string" || typeof expected !== "string" || expected.length === 0) return false;
  let difference = candidate.length ^ expected.length;
  const length = Math.max(candidate.length, expected.length);
  for (let index = 0; index < length; index += 1) {
    difference |= (candidate.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export async function readBoundedJson(request, maxBytes = MAX_PUSH_BODY_BYTES) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) return { ok: false, reason: "TOO_LARGE" };
  if (!request.body) return { ok: false, reason: "INVALID_JSON" };
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel();
        return { ok: false, reason: "TOO_LARGE" };
      }
      chunks.push(value);
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
    return { ok: true, value: JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) };
  } catch {
    return { ok: false, reason: "INVALID_JSON" };
  }
}

export function normalizePushNotification(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value;
  const userId = typeof input.user_id === "string" ? input.user_id.trim() : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) return null;
  const title = input.title == null ? "Mantiqati X" : input.title;
  const body = input.body == null ? "" : input.body;
  const type = input.type == null ? "GENERAL" : input.type;
  const id = input.id == null ? null : input.id;
  if (typeof title !== "string" || title.trim().length === 0 || title.length > 120) return null;
  if (typeof body !== "string" || body.length > 2000) return null;
  if (typeof type !== "string" || !/^[A-Z0-9_:-]{1,48}$/i.test(type)) return null;
  if (id !== null && (typeof id !== "string" || id.length > 128)) return null;
  return { user_id: userId, title: title.trim(), body, type, id };
}
