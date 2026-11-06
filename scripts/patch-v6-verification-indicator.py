#!/usr/bin/env python3
"""Apply V6 verification red-dot status and activity-card test hooks."""
from __future__ import annotations

import re
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
CARD_KEY_PATTERN = re.compile(r"(?m)^(?P<indent>[ \t]*)key=\{biz\.id\}[ \t]*\r?\n")
CARD_TEST_ID = 'data-testid="directory-activity-card"'


def replace_badge(source: str) -> tuple[str, bool]:
    old_count = source.count(OLD_MARKUP)
    new_count = source.count(NEW_MARKUP)
    if new_count == 1:
        return source, False
    if old_count != 1 or new_count:
        raise ValueError(f"Expected one canonical unverified badge; old={old_count}, new={new_count}")
    updated = source.replace(OLD_MARKUP, NEW_MARKUP, 1)
    if updated.count(NEW_MARKUP) != 1:
        raise ValueError("Unverified badge replacement verification failed")
    return updated, True


def add_activity_card_test_id(source: str) -> tuple[str, bool]:
    matches = list(CARD_KEY_PATTERN.finditer(source))
    if len(matches) != 1:
        raise ValueError(f"Expected one business card key anchor; found={len(matches)}")
    match = matches[0]
    line_end = source.find("\n", match.end())
    next_line = source[match.end():] if line_end < 0 else source[match.end():line_end]
    if CARD_TEST_ID in next_line:
        return source, False

    newline = "\r\n" if match.group(0).endswith("\r\n") else "\n"
    insertion = match.group("indent") + CARD_TEST_ID + newline
    updated = source[:match.end()] + insertion + source[match.end():]
    if updated.count(CARD_TEST_ID) != 1:
        raise ValueError("Activity card test id insertion verification failed")
    return updated, True


def patch(source: str) -> tuple[str, bool]:
    updated, badge_changed = replace_badge(source)
    updated, card_changed = add_activity_card_test_id(updated)
    if 'aria-hidden="true"' not in NEW_MARKUP or "غير موثق" not in NEW_MARKUP:
        raise ValueError("Unverified status must keep an accessible text label and decorative dot")
    return updated, badge_changed or card_changed


def self_test() -> None:
    fixture = (
        "prefix\n"
        "    <div\n"
        "      key={biz.id}\n"
        "      className={cardClass}\n"
        "    >\n"
        + OLD_MARKUP
        + "\n"
        "    </div>\n"
    )
    updated, changed = patch(fixture)
    assert changed is True
    assert 'data-testid="unverified-status-dot"' in updated
    assert CARD_TEST_ID in updated
    assert 'bg-red-600' in updated and "غير موثق" in updated
    again, changed_again = patch(updated)
    assert changed_again is False and again == updated

    alternate_spacing = fixture.replace("      key={biz.id}\n", "\tkey={biz.id}\r\n")
    alternate, alternate_changed = patch(alternate_spacing)
    assert alternate_changed is True and CARD_TEST_ID in alternate
    alternate_again, alternate_changed_again = patch(alternate)
    assert alternate_changed_again is False and alternate_again == alternate


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
    for marker in ('data-testid="unverified-status-dot"', CARD_TEST_ID):
        if marker not in verified:
            raise SystemExit(f"V6_VERIFICATION_INDICATOR_VERIFY_FAILED={marker}")
    print(f"V6_UNVERIFIED_RED_DOT_OVERLAY=PASS changed={int(changed)}")


if __name__ == "__main__":
    main()
