#!/usr/bin/env python3
"""Apply an immutable-source overlay for the V6 governorate filter accessible name.

The JSX opening-tag scanner accounts for quoted values and brace expressions so
an arrow-function token (=>) inside a prop cannot be mistaken for the tag terminator.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

LABEL = "تصفية الأنشطة حسب المحافظة"
SELECT_START = re.compile(r"<select\b")
ARIA_LABEL = re.compile(r"""\baria-label\s*=\s*(["']).*?\1""", re.IGNORECASE)
CLOSE_SELECT = "</select>"


def governorate_select_span(source: str) -> tuple[int, int]:
    candidates: list[tuple[int, int]] = []
    for match in SELECT_START.finditer(source):
        start = match.start()
        index = match.end()
        quote: str | None = None
        brace_depth = 0
        tag_end: int | None = None

        while index < len(source):
            char = source[index]
            if quote is not None:
                if char == chr(92):
                    index += 2
                    continue
                if char == quote:
                    quote = None
            else:
                if char in ("'", '"', "`"):
                    quote = char
                elif char == "{":
                    brace_depth += 1
                elif char == "}" and brace_depth:
                    brace_depth -= 1
                elif char == ">" and brace_depth == 0:
                    tag_end = index + 1
                    break
            index += 1

        if tag_end is None:
            raise ValueError("Unterminated JSX <select> opening tag")

        close_start = source.find(CLOSE_SELECT, tag_end)
        if close_start < 0:
            raise ValueError("Missing closing </select> for a JSX <select>")
        if "كل المحافظات" in source[tag_end:close_start]:
            candidates.append((start, tag_end))

    if len(candidates) != 1:
        raise ValueError(
            "Expected exactly one select containing option text 'كل المحافظات'; "
            f"found {len(candidates)}"
        )
    return candidates[0]


def patch_text(source: str) -> tuple[str, int]:
    start, end = governorate_select_span(source)
    opening = source[start:end]
    expected_attr = f'aria-label="{LABEL}"'
    existing = ARIA_LABEL.search(opening)
    if existing:
        patched_opening = ARIA_LABEL.sub(expected_attr, opening, count=1)
    else:
        patched_opening = opening[:-1] + " " + expected_attr + ">"

    patched = source[:start] + patched_opening + source[end:]
    verify_start, verify_end = governorate_select_span(patched)
    verified_opening = patched[verify_start:verify_end]
    if expected_attr not in verified_opening:
        raise ValueError("Governorate select does not have the expected Arabic accessible name")
    return patched, int(patched != source)


def self_test() -> None:
    fixture = (
        '<div><select className="geo-filter" '
        'onChange={(event) => updateGovernorate(event.target.value)}>'
        '<option value="all">كل المحافظات</option>'
        '<option value="القاهرة">القاهرة</option></select>'
        '<select><option>كل التخصصات</option></select></div>'
    )
    patched, changed = patch_text(fixture)
    assert changed == 1
    assert (
        f'<select className="geo-filter" '
        f'onChange={{(event) => updateGovernorate(event.target.value)}} '
        f'aria-label="{LABEL}">'
    ) in patched
    again, changed_again = patch_text(patched)
    assert changed_again == 0
    assert again == patched
    assert 'كل التخصصات</option></select>' in patched


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
