import test from "node:test";
import assert from "node:assert/strict";
import { getExplicitPublicContact } from "./public-contact-visibility.mjs";

test("exposes only explicit catalog_profile contact fields", () => {
  const contact = getExplicitPublicContact({
    phone_display: "+20 10 1111 2222",
    whatsapp_number: "01011112222",
    whatsapp_url: "https://wa.me/201011112222",
    address: "Tala, Menoufia, Egypt",
    additional_contact_phones: ["01011112222", "", 123, "  01033334444  "],
    phone: "+20 1000 PRIVATE",
    whatsapp_phone: "+20 1000 PRIVATE",
  });

  assert.equal(contact.phoneDisplay, "+20 10 1111 2222");
  assert.equal(contact.whatsappNumber, "201011112222");
  assert.equal(contact.whatsappUrl, "https://wa.me/201011112222");
  assert.equal(contact.address, "Tala, Menoufia, Egypt");
  assert.deepEqual(contact.additionalContactPhones, ["01011112222", "01033334444"]);
});

test("does not treat legacy or operational contact fields as public consent", () => {
  const contact = getExplicitPublicContact({
    phone: "+20 1000 PRIVATE",
    whatsapp_phone: "201000000000",
  });

  assert.deepEqual(contact, {
    phoneDisplay: "",
    whatsappNumber: "",
    whatsappUrl: "",
    address: "",
    additionalContactPhones: [],
  });
});

test("rejects non-WhatsApp URLs and invalid phone lengths", () => {
  const contact = getExplicitPublicContact({
    whatsapp_number: "12",
    whatsapp_url: "https://example.com/contact",
  });
  assert.equal(contact.whatsappNumber, "");
  assert.equal(contact.whatsappUrl, "");
});

test("bounds public contact values and ignores malformed profile objects", () => {
  const contact = getExplicitPublicContact({
    phone_display: "1".repeat(100),
    address: "A".repeat(900),
    additional_contact_phones: Array.from({ length: 20 }, (_, i) => String(i).padStart(10, "0")),
  });
  assert.equal(contact.phoneDisplay.length, 40);
  assert.equal(contact.address.length, 500);
  assert.equal(contact.additionalContactPhones.length, 10);
  assert.deepEqual(getExplicitPublicContact(null), {
    phoneDisplay: "",
    whatsappNumber: "",
    whatsappUrl: "",
    address: "",
    additionalContactPhones: [],
  });
});
