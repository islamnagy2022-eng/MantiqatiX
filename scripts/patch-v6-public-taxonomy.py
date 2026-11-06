#!/usr/bin/env python3
"""Apply the public V6 Arabic healthcare-category mapping overlay.

The canonical AI Studio r5 archive stays immutable. This deterministic,
idempotent overlay is applied only to the extracted public Preview worktree.
"""
from __future__ import annotations

import sys
from pathlib import Path

SOURCE_REL = Path("src/services/publicCatalogDirectory.ts")
TEST_REL = Path("src/services/publicCatalogDirectory.test.mjs")

OLD_HEALTHCARE_RULE = (
    "if (/صيدل|طبي|عياد|مستشفى|معمل|تحاليل|health|medical|pharmacy|clinic|hospital|laborator|lab/.test(value)) "
    "return 'healthcare';"
)
NEW_HEALTHCARE_RULE = (
    "if (/صحة|صحى|صحي|صيدل|طبي|عياد|مستشفى|معمل|تحاليل|health|medical|pharmacy|clinic|hospital|laborator|lab/.test(value)) "
    "return 'healthcare';"
)
PHARMACY_ASSERTION = "  assert.equal(resolvePublicFunctionalGroup('صيدلية'), 'healthcare');"
HEALTHCARE_ASSERTIONS = (
    "  assert.equal(resolvePublicFunctionalGroup('صحة'), 'healthcare');\n"
    "  assert.equal(resolvePublicFunctionalGroup('الرعاية الصحية والطبية'), 'healthcare');"
)


def patch_source(source: str) -> tuple[str, bool]:
    old_count = source.count(OLD_HEALTHCARE_RULE)
    new_count = source.count(NEW_HEALTHCARE_RULE)
    if new_count == 1 and old_count == 0:
        return source, False
    if old_count != 1 or new_count:
        raise ValueError(
            "Expected exactly one canonical healthcare resolver rule; "
            f"old={old_count}, already_patched={new_count}"
        )
    patched = source.replace(OLD_HEALTHCARE_RULE, NEW_HEALTHCARE_RULE, 1)
    if patched.count(NEW_HEALTHCARE_RULE) != 1:
        raise ValueError("Healthcare resolver patch verification failed")
    return patched, True


def patch_test(test_source: str) -> tuple[str, bool]:
    if HEALTHCARE_ASSERTIONS in test_source:
        return test_source, False
    if test_source.count(PHARMACY_ASSERTION) != 1:
        raise ValueError("Expected one existing pharmacy taxonomy assertion")
    insertion = PHARMACY_ASSERTION + "\n" + HEALTHCARE_ASSERTIONS
    patched = test_source.replace(PHARMACY_ASSERTION, insertion, 1)
    if HEALTHCARE_ASSERTIONS not in patched:
        raise ValueError("Healthcare taxonomy test insertion verification failed")
    return patched, True


def self_test() -> None:
    source_fixture = "before\n" + OLD_HEALTHCARE_RULE + "\nafter\n"
    patched_source, source_changed = patch_source(source_fixture)
    assert source_changed is True
    assert NEW_HEALTHCARE_RULE in patched_source
    same_source, source_changed_again = patch_source(patched_source)
    assert source_changed_again is False
    assert same_source == patched_source

    test_fixture = PHARMACY_ASSERTION + "\n"
    patched_test, test_changed = patch_test(test_fixture)
    assert test_changed is True
    assert HEALTHCARE_ASSERTIONS in patched_test
    same_test, test_changed_again = patch_test(patched_test)
    assert test_changed_again is False
    assert same_test == patched_test


def main() -> None:
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        self_test()
        print("V6_PUBLIC_TAXONOMY_OVERLAY_SELF_TEST=PASS")
        return
    if len(sys.argv) != 2:
        raise SystemExit("Usage: patch-v6-public-taxonomy.py <extracted-v6-root>")

    root = Path(sys.argv[1]).resolve()
    source_path = root / SOURCE_REL
    test_path = root / TEST_REL
    if not source_path.is_file() or not test_path.is_file():
        raise SystemExit("V6_PUBLIC_TAXONOMY_TARGET_MISSING")

    source, source_changed = patch_source(source_path.read_text(encoding="utf-8"))
    test_source, test_changed = patch_test(test_path.read_text(encoding="utf-8"))

    if source_changed:
        source_path.write_text(source, encoding="utf-8")
    if test_changed:
        test_path.write_text(test_source, encoding="utf-8")

    # Read-after-write verification makes repeated source preparation deterministic.
    verified_source, source_changed_again = patch_source(source_path.read_text(encoding="utf-8"))
    verified_test, test_changed_again = patch_test(test_path.read_text(encoding="utf-8"))
    if source_changed_again or test_changed_again:
        raise SystemExit("V6_PUBLIC_TAXONOMY_OVERLAY_NOT_IDEMPOTENT")
    if NEW_HEALTHCARE_RULE not in verified_source or HEALTHCARE_ASSERTIONS not in verified_test:
        raise SystemExit("V6_PUBLIC_TAXONOMY_OVERLAY_VERIFY_FAILED")

    print(
        "V6_PUBLIC_TAXONOMY_OVERLAY=PASS "
        f"source_changed={int(source_changed)} test_changed={int(test_changed)}"
    )


if __name__ == "__main__":
    main()
