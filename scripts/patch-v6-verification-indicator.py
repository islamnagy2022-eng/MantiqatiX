#!/usr/bin/env python3
"""Apply an accessible red status dot to unverified public V6 directory listings."""
from __future__ import annotations

import sys
from pathlib import Path

TARGET_REL = Path("src/components/DirectoryView.tsx")
OLD_MARKUP = (
    '{!verified && <span className="rounded-full bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-800">'
    'غير موثق</span>}'
)
NEW_MARKUP = """{!verified && (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold text-red-700">
                            <span data-testid="unverified-status-dot" aria-hidden="true" className="h-2 w-2 rounded-full bg-red-600" />
                            غير موثق
                          </span>
                        )}"""


def patch(source: str) -> tuple[str, bool]:
    old_count = source.count(OLD_MARKUP)
    new_count = source.count(NEW_MARKUP)
    if new_count == 1:
        return source, False
    if old_count != 1 or new_count:
        raise ValueError(f"Expected exactly one unverified status badge; old={old_count}, new={new_count}")
    updated = source.replace(OLD_MARKUP, NEW_MARKUP, 1)
    if updated.count(NEW_MARKUP) != 1:
        raise ValueError("Unverified badge replacement verification failed")
    if 'aria-hidden="true"' not in NEW_MARKUP or "غير موثق" not in NEW_MARKUP:
        raise ValueError("Unverified status must keep accessible text and a decorative dot")
    return updated, True


def self_test() -> None:
    fixture = "prefix\n" + OLD_MARKUP + "\nsuffix\n"
    updated, changed = patch(fixture)
    assert changed is True
    assert 'data-testid="unverified-status-dot"' in updated
    assert 'bg-red-600' in updated and "غير موثق" in updated
    again, changed_again = patch(updated)
    assert changed_again is False and again == updated


def main() -> None:
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        self_test()
        print("V6_UNVERIFIED_RED_DOT_OVERLAY_SELF_TEST=PASS")
        return
    if len(sys.argv) != 2:
        raise SystemExit("Usage: patch-v6-verification-indicator.py <extracted-v6-root>")

    root = Path(sys.argv[1]).resolve()
    target = root / TARGET_REL
    if not target.is_file():
        raise SystemExit(f"V6_VERIFICATION_INDICATOR_TARGET_MISSING={target}")

    updated, changed = patch(target.read_text(encoding="utf-8"))
    if changed:
        target.write_text(updated, encoding="utf-8")

    verified, changed_again = patch(target.read_text(encoding="utf-8"))
    if changed_again or 'data-testid="unverified-status-dot"' not in verified:
        raise SystemExit("V6_UNVERIFIED_RED_DOT_OVERLAY_NOT_IDEMPOTENT")
    print(f"V6_UNVERIFIED_RED_DOT_OVERLAY=PASS changed={int(changed)}")


if __name__ == "__main__":
    main()
