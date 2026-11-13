// Public contact data is opt-in by field: only explicitly published catalog_profile
// keys are exposed. Operational branches.phone/address and legacy profile.phone/
// profile.whatsapp_phone are intentionally not accepted here.
const safeText = (value: unknown, maxLength: number): string =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const normalizeWhatsAppNumber = (value: unknown): string => {
  let digits = safeText(value, 40).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = "20" + digits.slice(1);
  else if (digits.startsWith("1") && digits.length === 10) digits = "20" + digits;
  return digits.length >= 8 && digits.length <= 15 ? digits : "";
};

const safeWhatsAppUrl = (value: unknown): string => {
  const raw = safeText(value, 500);
  if (!raw) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "https:" || !["wa.me", "api.whatsapp.com", "web.whatsapp.com"].includes(url.hostname.toLowerCase())) {
      return "";
    }
    return url.toString();
  } catch {
    return "";
  }
};

export const getExplicitPublicContact = (value: unknown) => {
  const profile = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const additionalContactPhones = Array.isArray(profile.additional_contact_phones)
    ? profile.additional_contact_phones
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim().slice(0, 40))
      .filter(Boolean)
      .slice(0, 10)
    : [];

  return {
    phoneDisplay: safeText(profile.phone_display, 40),
    whatsappNumber: normalizeWhatsAppNumber(profile.whatsapp_number),
    whatsappUrl: safeWhatsAppUrl(profile.whatsapp_url),
    address: safeText(profile.address, 500),
    additionalContactPhones,
  };
};
