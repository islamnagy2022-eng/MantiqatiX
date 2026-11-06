#!/usr/bin/env python3
"""Apply V6 verification red-dot status and stable activity-card test hooks."""
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

OLD_CARD_MARKUP = """                  key={biz.id}
                  className={`bg-white rounded-3xl border shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-xl transition-all group relative ${"""
NEW_CARD_MARKUP = """                  key={biz.id}
                  data-testid="directory-activity-card"
                  className={`bg-white rounded-3xl border shadow-xs overflow-hidden flex flex-col justify-between hover:shadow-xl transition-all group relative ${"""


def replace_once(source: str, old: str, new: str, label: str) -> tuple[str, bool]:
    old_count = source.count(old)
    new_count = source.count(new)
    if old_count == 0 and new_count == 1:
        return source, False
    if old_count != 1 or new_count:
        raise ValueError(
            f"Expected exactly one canonical {label} markup; old={old_count}, new={new_count}"
        )
    updated = source.replace(old, new, 1)
    if updated.count(new) != 1:
        raise ValueError(f"{label} markup replacement verification failed")
    return updated, True


def patch(source: str) -> tuple[str, bool]:
    updated, badge_changed = replace_once(source, OLD_MARKUP, NEW_MARKUP, "unverified badge")
    updated, card_changed = replace_once(updated, OLD_CARD_MARKUP, NEW_CARD_MARKUP, "activity card test id")
    if 'aria-hidden="true"' not in NEW_MARKUP or "غير موثق" not in NEW_MARKUP:
        raise ValueError("Unverified status must keep an accessible text label and decorative dot")
    if 'data-testid="directory-activity-card"' not in updated:
        raise ValueError("Activity card test hook is missing")
    return updated, badge_changed or card_changed


def self_test() -> None:
    fixture = "prefix\n" + OLD_CARD_MARKUP + "\n" + OLD_MARKUP + "\nsuffix\n"
    updated, changed = patch(fixture)
    assert changed is True
    assert 'data-testid="unverified-status-dot"' in updated
    assert 'data-testid="directory-activity-card"' in updated
    assert 'bg-red-600' in updated and 'غير موثق' in updated
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
    if changed_again:
        raise SystemExit("V6_UNVERIFIED_RED_DOT_OVERLAY_NOT_IDEMPOTENT")
    for marker in ('data-testid="unverified-status-dot"', 'data-testid="directory-activity-card"'):
        if marker not in verified:
            raise SystemExit(f"V6_VERIFICATION_INDICATOR_VERIFY_FAILED={marker}")
    print(f"V6_UNVERIFIED_RED_DOT_OVERLAY=PASS changed={int(changed)}")


if __name__ == "__main__":
    main()
