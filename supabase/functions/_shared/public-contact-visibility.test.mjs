import test from "node:test";
import assert from "node:assert/strict";
import { getExplicitPublicContact } from "./public-contact-visibility.mjs";

const empty = { phoneDisplay: "", whatsappNumber: "", whatsappUrl: "", address: "", additionalContactPhones: [] };

test("hides all profile and operational branch contacts unless the owner opted in", () => {
  const contact = getExplicitPublicContact({
    phone_display: "+20 10 1111 2222", whatsapp_number: "01011112222",
    whatsapp_url: "https://wa.me/201011112222", address: "Legacy profile address",
    additional_contact_phones: ["01011112222"], phone: "+20 1000 PRIVATE", whatsapp_phone: "+20 1000 PRIVATE",
  }, { phone: "+20 10 3333 4444", address: "Private branch address" });
  assert.deepEqual(contact, empty);
});

test("projects selected branch contacts only after explicit owner consent", () => {
  const contact = getExplicitPublicContact({
    public_contact_enabled: true, phone_display: "+20 10 1111 2222",
    whatsapp_number: "01011112222", whatsapp_url: "https://example.com/unsafe",
    address: "Legacy profile address", additional_contact_phones: ["01011112222", "", 123, "  01033334444  "],
  }, { phone: "01055556666", address: "Tala, Menoufia, Egypt" });
  assert.equal(contact.phoneDisplay, "01055556666");
  assert.equal(contact.whatsappNumber, "201055556666");
  assert.equal(contact.whatsappUrl, "https://wa.me/201055556666");
  assert.equal(contact.address, "Tala, Menoufia, Egypt");
  assert.deepEqual(contact.additionalContactPhones, ["01011112222", "01033334444"]);
});

test("revoking owner consent immediately hides previously populated contact values", () => {
  assert.deepEqual(getExplicitPublicContact({
    public_contact_enabled: false, phone_display: "01011112222", whatsapp_number: "201011112222",
    address: "Public before revocation", additional_contact_phones: ["01011112222"],
  }, { phone: "01011112222", address: "Branch address" }), empty);
});

test("rejects invalid fallback numbers and unsafe WhatsApp URLs", () => {
  const contact = getExplicitPublicContact({ public_contact_enabled: true, whatsapp_number: "12", whatsapp_url: "https://example.com/contact" });
  assert.equal(contact.whatsappNumber, "");
  assert.equal(contact.whatsappUrl, "");
});

test("bounds public contact values and ignores malformed profile objects", () => {
  const contact = getExplicitPublicContact({
    public_contact_enabled: true, phone_display: "1".repeat(100),
    additional_contact_phones: Array.from({ length: 20 }, (_, i) => String(i).padStart(10, "0")),
  }, { address: "A".repeat(900) });
  assert.equal(contact.phoneDisplay.length, 40);
  assert.equal(contact.address.length, 500);
  assert.equal(contact.additionalContactPhones.length, 10);
  assert.deepEqual(getExplicitPublicContact(null), empty);
});
