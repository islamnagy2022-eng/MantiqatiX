export function parseBearerToken(authorization) {
  if (typeof authorization !== "string") return null;
  const match = /^Bearer[ \t]+([A-Za-z0-9._~+/-]+=*)$/i.exec(authorization.trim());
  return match?.[1] || null;
}
