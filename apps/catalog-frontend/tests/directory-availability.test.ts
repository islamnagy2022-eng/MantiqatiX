import assert from "node:assert/strict";
import test from "node:test";
import { getDirectoryDisabledMessage } from "../src/lib/directoryAvailability";

test("shows a clear privacy notice when the server explicitly disables the directory", () => {
  const message = getDirectoryDisabledMessage({
    listings: [],
    pageSize: 0,
    hasMore: false,
    nextCursor: null,
    directoryDisabled: true,
  });
  assert.ok(message);
  assert.match(message, /متوقف مؤقتًا/);
  assert.match(message, /موافقات أصحاب الصفحات/);
});

test("does not mark an enabled directory as disabled", () => {
  assert.equal(getDirectoryDisabledMessage({ listings: [], directoryDisabled: false }), null);
  assert.equal(getDirectoryDisabledMessage({ listings: [{ id: "public-row" }] }), null);
});

test("fails closed only on the explicit server disable signal, not malformed response shapes", () => {
  assert.equal(getDirectoryDisabledMessage(null), null);
  assert.equal(getDirectoryDisabledMessage([]), null);
  assert.equal(getDirectoryDisabledMessage("directoryDisabled"), null);
  assert.equal(getDirectoryDisabledMessage({ directoryDisabled: "true" }), null);
});
