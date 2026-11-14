// Public contact fields are hidden by default. The owner must explicitly enable
// public_contact_enabled through the authenticated catalog profile write path.
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
    if (url.protocol !== "https:" || url.username || url.password || url.port || !["wa.me", "api.whatsapp.com", "web.whatsapp.com"].includes(url.hostname.toLowerCase())) return "";
    return url.toString();
  } catch {
    return "";
  }
};

const emptyPublicContact = () => ({
  phoneDisplay: "",
  whatsappNumber: "",
  whatsappUrl: "",
  address: "",
  additionalContactPhones: [],
});

export const getExplicitPublicContact = (value, branchValue = null) => {
  const profile = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  // Legacy profile keys and operational branch fields are never consent by themselves.
  if (profile.public_contact_enabled !== true) return emptyPublicContact();
  const branch = branchValue && typeof branchValue === "object" && !Array.isArray(branchValue) ? branchValue : {};
  const phoneSource = branch.phone || profile.phone_display || profile.phone || profile.whatsapp_phone || profile.whatsapp_number;
  const whatsappNumber = normalizeWhatsAppNumber(branch.phone || profile.whatsapp_number || profile.whatsapp_phone || profile.phone_display || profile.phone);
  const additionalContactPhones = Array.isArray(profile.additional_contact_phones)
    ? profile.additional_contact_phones.filter((entry) => typeof entry === "string")
      .map((entry) => entry.trim().slice(0, 40)).filter(Boolean).slice(0, 10)
    : [];
  return {
    phoneDisplay: safeText(phoneSource, 40),
    whatsappNumber,
    whatsappUrl: whatsappNumber ? "https://wa.me/" + whatsappNumber : safeWhatsAppUrl(profile.whatsapp_url),
    address: safeText(branch.address || profile.address, 500),
    additionalContactPhones,
  };
};
