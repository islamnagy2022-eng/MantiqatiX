// Public contact fields are private by default. Public disclosure requires an explicit
// owner choice plus a server-verified audit record written by catalog-admin.
const safeText = (value, maxLength) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const normalizeWhatsAppNumber = (value) => {
  let digits = safeText(value, 40).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = "20" + digits.slice(1);
  else if (digits.startsWith("1") && digits.length === 10) digits = "20" + digits;
  return digits.length >= 8 && digits.length <= 15 ? digits : "";
};

const safeWhatsAppUrl = (value) => {
  const raw = safeText(value, 500);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || url.username || url.password || url.port ||
        !["wa.me", "api.whatsapp.com", "web.whatsapp.com"].includes(url.hostname.toLowerCase())) return "";
    return url.toString();
  } catch {
    return "";
  }
};

const safeGoogleMapsUrl = (value) => {
  const raw = safeText(value, 1000);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    const allowedHosts = ["google.com", "www.google.com", "maps.google.com", "maps.app.goo.gl", "goo.gl"];
    if (url.protocol !== "https:" || url.username || url.password || url.port || !allowedHosts.includes(host)) return "";
    if ((host === "google.com" || host === "www.google.com") && !url.pathname.startsWith("/maps")) return "";
    if (host === "goo.gl" && !url.pathname.startsWith("/maps")) return "";
    return url.toString();
  } catch {
    return "";
  }
};

export const emptyPublicContact = () => ({
  phoneDisplay: "",
  whatsappNumber: "",
  whatsappUrl: "",
  address: "",
  additionalContactPhones: [],
  googleMapsUrl: "",
});

/**
 * @param {unknown} value
 * @param {unknown} [branchValue]
 * @returns {{ phoneDisplay: string, whatsappNumber: string, whatsappUrl: string, address: string, additionalContactPhones: string[], googleMapsUrl: string }}
 */
export const getExplicitPublicContact = (value, branchValue = null) => {
  const profile = value && typeof value === "object" && !Array.isArray(value) ? /** @type {Record<string, unknown>} */ (value) : {};
  if (profile.public_contact_enabled !== true || profile.public_contact_consent_audit_verified !== true) {
    return emptyPublicContact();
  }
  const branch = branchValue && typeof branchValue === "object" && !Array.isArray(branchValue) ? /** @type {Record<string, unknown>} */ (branchValue) : {};
  const phoneSource = branch.phone || profile.phone_display || profile.phone || profile.whatsapp_phone || profile.whatsapp_number;
  const whatsappNumber = normalizeWhatsAppNumber(
    branch.phone || profile.whatsapp_number || profile.whatsapp_phone || profile.phone_display || profile.phone,
  );
  const additionalContactPhones = Array.isArray(profile.additional_contact_phones)
    ? profile.additional_contact_phones
      .filter((entry) => typeof entry === "string")
      .map((entry) => entry.trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 10)
    : [];
  return {
    phoneDisplay: safeText(phoneSource, 40),
    whatsappNumber,
    whatsappUrl: whatsappNumber ? "https://wa.me/" + whatsappNumber : safeWhatsAppUrl(profile.whatsapp_url),
    address: safeText(branch.address || profile.address, 500),
    additionalContactPhones,
    googleMapsUrl: safeGoogleMapsUrl(profile.google_maps_url),
  };
};
