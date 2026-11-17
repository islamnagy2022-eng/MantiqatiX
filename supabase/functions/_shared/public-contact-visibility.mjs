// Public contact fields are private by default. Public disclosure requires an explicit
// owner choice plus a server-verified audit record written by catalog-admin.
const safeText = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const normalizeWhatsAppNumber = (value: unknown) => {
  let digits = safeText(value, 40).replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = "20" + digits.slice(1);
  else if (digits.startsWith("1") && digits.length === 10) digits = "20" + digits;
  return digits.length >= 8 && digits.length <= 15 ? digits : "";
};

const safeWhatsAppUrl = (value: unknown) => {
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

export const emptyPublicContact = () => ({
  phoneDisplay: "",
  whatsappNumber: "",
  whatsappUrl: "",
  address: "",
  additionalContactPhones: [] as string[],
});

export const getExplicitPublicContact = (
  value: unknown,
  branchValue: unknown = null,
) => {
  const profile = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  if (profile.public_contact_enabled !== true || profile.public_contact_consent_audit_verified !== true) {
    return emptyPublicContact();
  }
  const branch = branchValue && typeof branchValue === "object" && !Array.isArray(branchValue)
    ? branchValue as Record<string, unknown> : {};
  const phoneSource = branch.phone || profile.phone_display || profile.phone || profile.whatsapp_phone || profile.whatsapp_number;
  const whatsappNumber = normalizeWhatsAppNumber(
    branch.phone || profile.whatsapp_number || profile.whatsapp_phone || profile.phone_display || profile.phone,
  );
  const additionalContactPhones = Array.isArray(profile.additional_contact_phones)
    ? profile.additional_contact_phones
      .filter((entry): entry is string => typeof entry === "string")
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
  };
};
