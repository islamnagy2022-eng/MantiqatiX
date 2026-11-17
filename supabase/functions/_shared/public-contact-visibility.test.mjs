import test from "node:test";
import assert from "node:assert/strict";
import { emptyPublicContact, getExplicitPublicContact } from "./public-contact-visibility.mjs";

test("hides legacy profile and branch contact data without explicit audited consent", () => {
  assert.deepEqual(getExplicitPublicContact({
    phone_display: "+20 10 1111 2222",
    whatsapp_number: "01011112222",
    whatsapp_url: "https://wa.me/201011112222",
    address: "Legacy address",
    additional_contact_phones: ["01011112222"],
    google_maps_url: "https://www.google.com/maps/place/Private+Location",
  }, { phone: "01033334444", address: "Private branch address" }), emptyPublicContact());
});

test("returns only bounded contact values for an explicit audited owner consent", () => {
  const contact = getExplicitPublicContact({
    public_contact_enabled: true,
    public_contact_consent_audit_verified: true,
    phone_display: "01011112222",
    whatsapp_number: "01011112222",
    whatsapp_url: "https://example.com/unsafe",
    address: "Legacy address",
    additional_contact_phones: ["01011112222", "", 5, " 01033334444 "],
    google_maps_url: "https://www.google.com/maps/place/Private+Location",
  }, { phone: "+20 10 5555 6666", address: "Tala, Menoufia, Egypt" });
  assert.equal(contact.phoneDisplay, "+20 10 5555 6666");
  assert.equal(contact.whatsappNumber, "201055556666");
  assert.equal(contact.whatsappUrl, "https://wa.me/201055556666");
  assert.equal(contact.address, "Tala, Menoufia, Egypt");
  assert.deepEqual(contact.additionalContactPhones, ["01011112222", "01033334444"]);
  assert.equal(contact.googleMapsUrl, "https://www.google.com/maps/place/Private+Location");
});

test("affirmative checkbox is not enough until the audit event is verified", () => {
  assert.deepEqual(getExplicitPublicContact({
    public_contact_enabled: true,
    public_contact_consent_audit_verified: false,
    phone_display: "01011112222",
  }, { phone: "01011112222" }), emptyPublicContact());
});

test("revoking consent immediately hides all public contact fields", () => {
  assert.deepEqual(getExplicitPublicContact({
    public_contact_enabled: false,
    public_contact_consent_audit_verified: true,
    phone_display: "01011112222",
    additional_contact_phones: ["01011112222"],
  }, { phone: "01011112222", address: "Previously public" }), emptyPublicContact());
});

test("rejects unsafe WhatsApp URLs and malformed numbers", () => {
  const invalid = getExplicitPublicContact({
    public_contact_enabled: true,
    public_contact_consent_audit_verified: true,
    whatsapp_number: "12",
    whatsapp_url: "https://example.com/contact",
  });
  assert.equal(invalid.whatsappNumber, "");
  assert.equal(invalid.whatsappUrl, "");
  const credentialUrl = getExplicitPublicContact({
    public_contact_enabled: true,
    public_contact_consent_audit_verified: true,
    whatsapp_url: "https://user:pass@wa.me/201011112222",
  });
  assert.equal(credentialUrl.whatsappUrl, "");
});

test("bounds public contact fields and rejects malformed profiles", () => {
  const contact = getExplicitPublicContact({
    public_contact_enabled: true,
    public_contact_consent_audit_verified: true,
    phone_display: "1".repeat(100),
    additional_contact_phones: Array.from({ length: 20 }, (_, index) => String(index).padStart(10, "0")),
  }, { address: "A".repeat(900) });
  assert.equal(contact.phoneDisplay.length, 40);
  assert.equal(contact.address.length, 500);
  assert.equal(contact.additionalContactPhones.length, 10);
  assert.deepEqual(getExplicitPublicContact(null), emptyPublicContact());
});

test("hides precise map links without audited consent and rejects unsafe map destinations", () => {
  const privateContact = getExplicitPublicContact({
    public_contact_enabled: false,
    public_contact_consent_audit_verified: true,
    google_maps_url: "https://maps.app.goo.gl/private",
  });
  assert.equal(privateContact.googleMapsUrl, "");
  const safe = getExplicitPublicContact({
    public_contact_enabled: true,
    public_contact_consent_audit_verified: true,
    google_maps_url: "https://www.google.com/maps/place/Tala",
  });
  assert.equal(safe.googleMapsUrl, "https://www.google.com/maps/place/Tala");
  const unsafe = getExplicitPublicContact({
    public_contact_enabled: true,
    public_contact_consent_audit_verified: true,
    google_maps_url: "https://evil.example/maps/place/Tala",
  });
  assert.equal(unsafe.googleMapsUrl, "");
});
