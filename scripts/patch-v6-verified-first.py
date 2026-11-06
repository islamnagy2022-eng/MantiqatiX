#!/usr/bin/env python3
"""Apply verified-first stable ordering in the public V6 directory adapter."""
from __future__ import annotations

import sys
from pathlib import Path

SOURCE_REL = Path("src/services/publicCatalogDirectory.ts")
TEST_REL = Path("src/services/publicCatalogDirectory.test.mjs")

OLD_BLOCK = """  const businesses = payload.businesses
    .map(mapPublicBusiness)
    .filter((business): business is Business => business !== null);
"""
NEW_BLOCK = """  const businesses = payload.businesses
    .map(mapPublicBusiness)
    .filter((business): business is Business => business !== null)
    // Stable sort: verified activities first; retain server ranking within each status group.
    .sort((left, right) => Number(right.isVerified) - Number(left.isVerified));
"""
TEST_MARKER = "test('orders verified businesses before unverified listings while preserving each group\'s source order'"
TEST_BLOCK = """
test('orders verified businesses before unverified listings while preserving each group\'s source order', async () => {
  const makeBusiness = (id, name, verified) => ({
    id,
    name,
    slug: id,
    category: 'متاجر',
    provider: { verified, description: 'fixture' },
    profile: {},
    branches: [],
    items: [],
    prices: [],
  });
  const result = await fetchPublicCatalogDirectory(
    { supabaseUrl: 'https://project.example.test', publishableKey: 'sb_publishable_test' },
    {
      fetchImpl: async () => makeResponse({
        accessMode: 'PUBLIC_DIRECTORY_READ_ONLY',
        businesses: [
          makeBusiness('unverified-first', 'نشاط غير موثق وصل أولًا', false),
          makeBusiness('verified-a', 'نشاط موثق أ', true),
          makeBusiness('verified-b', 'نشاط موثق ب', true),
          makeBusiness('unverified-second', 'نشاط غير موثق ثاني', false),
        ],
      }),
    },
  );

  assert.deepEqual(
    result.businesses.map((business) => business.id),
    ['verified-a', 'verified-b', 'unverified-first', 'unverified-second'],
    'Verified activities must precede unverified listings and both groups must retain source order',
  );
});
"""


def patch_source(source: str) -> tuple[str, bool]:
    old_count = source.count(OLD_BLOCK)
    new_count = source.count(NEW_BLOCK)
    if old_count == 0 and new_count == 1:
        return source, False
    if old_count != 1 or new_count:
        raise ValueError(f"Expected one original public business mapper block; old={old_count}, new={new_count}")
    patched = source.replace(OLD_BLOCK, NEW_BLOCK, 1)
    if patched.count(NEW_BLOCK) != 1:
        raise ValueError("Verified-first ordering source patch verification failed")
    return patched, True


def patch_test(source: str) -> tuple[str, bool]:
    if TEST_MARKER in source:
        return source, False
    patched = source.rstrip() + "\n" + TEST_BLOCK
    if TEST_MARKER not in patched:
        raise ValueError("Verified-first ordering unit-test insertion failed")
    return patched + ("\n" if not patched.endswith("\n") else ""), True


def self_test() -> None:
    patched, changed = patch_source(OLD_BLOCK)
    assert changed is True and NEW_BLOCK in patched
    again, changed_again = patch_source(patched)
    assert changed_again is False and again == patched

    test_source, test_changed = patch_test("import test from 'node:test';\n")
    assert test_changed is True and TEST_MARKER in test_source
    test_again, test_changed_again = patch_test(test_source)
    assert test_changed_again is False and test_again == test_source


def main() -> None:
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        self_test()
        print("V6_VERIFIED_FIRST_OVERLAY_SELF_TEST=PASS")
        return
    if len(sys.argv) != 2:
        raise SystemExit("Usage: patch-v6-verified-first.py <extracted-v6-root>")

    root = Path(sys.argv[1]).resolve()
    source_path = root / SOURCE_REL
    test_path = root / TEST_REL
    if not source_path.is_file() or not test_path.is_file():
        raise SystemExit("V6_VERIFIED_FIRST_TARGET_MISSING")

    source, source_changed = patch_source(source_path.read_text(encoding="utf-8"))
    test_source, test_changed = patch_test(test_path.read_text(encoding="utf-8"))
    if source_changed:
        source_path.write_text(source, encoding="utf-8")
    if test_changed:
        test_path.write_text(test_source, encoding="utf-8")

    verified_source, source_changed_again = patch_source(source_path.read_text(encoding="utf-8"))
    verified_test, test_changed_again = patch_test(test_path.read_text(encoding="utf-8"))
    if source_changed_again or test_changed_again or TEST_MARKER not in verified_test:
        raise SystemExit("V6_VERIFIED_FIRST_OVERLAY_NOT_IDEMPOTENT")
    if NEW_BLOCK not in verified_source:
        raise SystemExit("V6_VERIFIED_FIRST_SOURCE_VERIFY_FAILED")

    print(f"V6_VERIFIED_FIRST_OVERLAY=PASS source_changed={int(source_changed)} test_changed={int(test_changed)}")


if __name__ == "__main__":
    main()
