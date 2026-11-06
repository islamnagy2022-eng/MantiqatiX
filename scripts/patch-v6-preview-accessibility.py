#!/usr/bin/env python3
"""Apply the public-directory governorate select accessibility fix to extracted V6 r5.

The source archive is kept immutable. This deterministic overlay patches only the
<select> containing the "كل المحافظات" option and verifies the final accessible name.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

LABEL = "تصفية الأنشطة حسب المحافظة"
SELECT_WITH_GOVERNORATE_OPTION = re.compile(
    r"(<select\\b[^>]*>)(?:(?!</select>).)*?كل المحافظات(?:(?!</select>).)*?</select>",
    re.IGNORECASE | re.DOTALL,
)
ARIA_LABEL = re.compile(r"""\\baria-label\\s*=\\s*(["']).*?\\1""", re.IGNORECASE)


def patch_text(source: str) -> tuple[str, int]:
    matches = list(SELECT_WITH_GOVERNORATE_OPTION.finditer(source))
    if len(matches) != 1:
        raise ValueError(
            "Expected exactly one select containing option text 'كل المحافظات'; "
            f"found {len(matches)}"
        )

    match = matches[0]
    opening = match.group(1)
    existing = ARIA_LABEL.search(opening)
    expected_attr = f'aria-label="{LABEL}"'
    if existing:
        patched_opening = ARIA_LABEL.sub(expected_attr, opening, count=1)
    else:
        patched_opening = opening[:-1] + " " + expected_attr + ">"

    patched = source[: match.start(1)] + patched_opening + source[match.end(1) :]
    verify_matches = list(SELECT_WITH_GOVERNORATE_OPTION.finditer(patched))
    if len(verify_matches) != 1:
        raise ValueError("Accessibility overlay changed the governorate select boundary")
    if ARIA_LABEL.search(verify_matches[0].group(1)) is None:
        raise ValueError("Governorate select is still missing aria-label")
    if expected_attr not in verify_matches[0].group(1):
        raise ValueError("Governorate select does not have the expected Arabic accessible name")
    return patched, int(patched != source)


def self_test() -> None:
    fixture = (
        '<div><select class="geo-filter"><option value="all">كل المحافظات</option>'
        '<option value="القاهرة">القاهرة</option></select>'
        '<select><option>كل التخصصات</option></select></div>'
    )
    patched, changed = patch_text(fixture)
    assert changed == 1
    assert f'<select class="geo-filter" {expected_label()}>' in patched
    again, changed_again = patch_text(patched)
    assert changed_again == 0
    assert again == patched
    assert 'كل التخصصات</option></select>' in patched


def expected_label() -> str:
    return f'aria-label="{LABEL}"'


def main() -> None:
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        self_test()
        print("V6_ACCESSIBILITY_OVERLAY_SELF_TEST=PASS")
        return
    if len(sys.argv) != 2:
        raise SystemExit("Usage: patch-v6-preview-accessibility.py <extracted-v6-root>")

    root = Path(sys.argv[1]).resolve()
    target = root / "src/components/DirectoryView.tsx"
    if not target.is_file():
        raise SystemExit(f"V6_ACCESSIBILITY_TARGET_MISSING={target}")

    source = target.read_text(encoding="utf-8")
    try:
        patched, changed = patch_text(source)
    except ValueError as error:
        raise SystemExit(f"V6_ACCESSIBILITY_OVERLAY_FAILED: {error}") from error

    if changed:
        target.write_text(patched, encoding="utf-8")
    print(f"V6_ACCESSIBILITY_OVERLAY=PASS changed={changed} target=src/components/DirectoryView.tsx")


if __name__ == "__main__":
    main()
