#!/usr/bin/env python3
"""Apply deterministic Arabic public-directory taxonomy overlays to extracted V6 r5.

The canonical AI Studio archive remains immutable. Only the extracted Preview
worktree is patched, and every transformation is idempotent.
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
SERVICES_RULE = (
    "if (/خدمات|خدمة|service|services|booking|consult|استشار/.test(value)) return 'services';"
)
PHARMACY_ASSERTION = "  assert.equal(resolvePublicFunctionalGroup('صيدلية'), 'healthcare');"
REQUIRED_TEST_ASSERTIONS = (
    "  assert.equal(resolvePublicFunctionalGroup('صحة'), 'healthcare');",
    "  assert.equal(resolvePublicFunctionalGroup('الرعاية الصحية والطبية'), 'healthcare');",
    "  assert.equal(resolvePublicFunctionalGroup('خدمات'), 'services');",
    "  assert.equal(resolvePublicFunctionalGroup('خدمات صحية'), 'healthcare');",
)


def patch_source(source: str) -> tuple[str, bool]:
    old_count = source.count(OLD_HEALTHCARE_RULE)
    healthcare_count = source.count(NEW_HEALTHCARE_RULE)
    services_count = source.count(SERVICES_RULE)

    if old_count == 0 and healthcare_count == 1 and services_count == 1:
        if source.index(NEW_HEALTHCARE_RULE) >= source.index(SERVICES_RULE):
            raise ValueError("Healthcare mapping must precede general services mapping")
        return source, False

    if old_count != 1 or healthcare_count or services_count:
        raise ValueError(
            "Expected one unpatched canonical healthcare rule; "
            f"old={old_count}, healthcare={healthcare_count}, services={services_count}"
        )

    replacement = NEW_HEALTHCARE_RULE + "\n  " + SERVICES_RULE
    patched = source.replace(OLD_HEALTHCARE_RULE, replacement, 1)
    if patched.count(NEW_HEALTHCARE_RULE) != 1 or patched.count(SERVICES_RULE) != 1:
        raise ValueError("Arabic public taxonomy replacement verification failed")
    if patched.index(NEW_HEALTHCARE_RULE) >= patched.index(SERVICES_RULE):
        raise ValueError("Healthcare mapping must precede general services mapping")
    return patched, True


def patch_test(test_source: str) -> tuple[str, bool]:
    if test_source.count(PHARMACY_ASSERTION) != 1:
        raise ValueError("Expected one existing pharmacy taxonomy assertion")

    patched = test_source
    changed = False
    anchor = PHARMACY_ASSERTION
    for assertion in REQUIRED_TEST_ASSERTIONS:
        if assertion not in patched:
            patched = patched.replace(anchor, anchor + "\n" + assertion, 1)
            anchor = assertion
            changed = True
        else:
            anchor = assertion

    if any(assertion not in patched for assertion in REQUIRED_TEST_ASSERTIONS):
        raise ValueError("Arabic public taxonomy regression assertions are incomplete")
    return patched, changed


def self_test() -> None:
    source_fixture = "before\n" + OLD_HEALTHCARE_RULE + "\nafter\n"
    patched_source, source_changed = patch_source(source_fixture)
    assert source_changed is True
    assert NEW_HEALTHCARE_RULE in patched_source
    assert SERVICES_RULE in patched_source
    assert patched_source.index(NEW_HEALTHCARE_RULE) < patched_source.index(SERVICES_RULE)
    same_source, changed_again = patch_source(patched_source)
    assert changed_again is False and same_source == patched_source

    test_fixture = PHARMACY_ASSERTION + "\n"
    patched_test, test_changed = patch_test(test_fixture)
    assert test_changed is True
    assert all(assertion in patched_test for assertion in REQUIRED_TEST_ASSERTIONS)
    same_test, test_changed_again = patch_test(patched_test)
    assert test_changed_again is False and same_test == patched_test


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
    tests, tests_changed = patch_test(test_path.read_text(encoding="utf-8"))

    if source_changed:
        source_path.write_text(source, encoding="utf-8")
    if tests_changed:
        test_path.write_text(tests, encoding="utf-8")

    verified_source, source_changed_again = patch_source(source_path.read_text(encoding="utf-8"))
    verified_tests, tests_changed_again = patch_test(test_path.read_text(encoding="utf-8"))
    if source_changed_again or tests_changed_again:
        raise SystemExit("V6_PUBLIC_TAXONOMY_OVERLAY_NOT_IDEMPOTENT")
    if (
        NEW_HEALTHCARE_RULE not in verified_source
        or SERVICES_RULE not in verified_source
        or not all(assertion in verified_tests for assertion in REQUIRED_TEST_ASSERTIONS)
    ):
        raise SystemExit("V6_PUBLIC_TAXONOMY_OVERLAY_VERIFY_FAILED")

    print(
        "V6_PUBLIC_TAXONOMY_OVERLAY=PASS "
        f"source_changed={int(source_changed)} test_changed={int(tests_changed)}"
    )


if __name__ == "__main__":
    main()
