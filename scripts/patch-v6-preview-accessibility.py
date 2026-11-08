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
LOGIN_BUTTON_OLD = "inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 font-bold text-white transition-colors hover:bg-emerald-500"
LOGIN_BUTTON_NEW = "inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-emerald-700 px-3 py-2 font-bold text-white transition-colors hover:bg-emerald-600"


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


def patch_login_button_text(source: str) -> tuple[str, int]:
    old_count = source.count(LOGIN_BUTTON_OLD)
    new_count = source.count(LOGIN_BUTTON_NEW)
    if old_count + new_count != 1:
        raise ValueError(
            "Expected exactly one guest login button class (old or already patched); "
            f"found {old_count + new_count}"
        )
    if old_count:
        return source.replace(LOGIN_BUTTON_OLD, LOGIN_BUTTON_NEW, 1), 1
    return source, 0


def patch_login_button(root: Path) -> int:
    source_root = root / "src"
    files = sorted(source_root.rglob("*.tsx"))
    matches = [path for path in files if LOGIN_BUTTON_OLD in path.read_text(encoding="utf-8") or LOGIN_BUTTON_NEW in path.read_text(encoding="utf-8")]
    if len(matches) != 1:
        raise ValueError(
            "Expected exactly one V6 guest login button source file; "
            f"found {len(matches)}"
        )
    target = matches[0]
    source = target.read_text(encoding="utf-8")
    patched, changed = patch_login_button_text(source)
    if changed:
        target.write_text(patched, encoding="utf-8")
    return changed


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

    login_fixture = (
        '<button className="' + LOGIN_BUTTON_OLD + '">'
        '<span>دخول الحساب</span></button>'
    )
    login_patched, login_changed = patch_login_button_text(login_fixture)
    assert login_changed == 1
    assert LOGIN_BUTTON_NEW in login_patched
    login_again, login_changed_again = patch_login_button_text(login_patched)
    assert login_changed_again == 0
    assert login_again == login_patched


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
    try:
        login_changed = patch_login_button(root)
    except ValueError as error:
        raise SystemExit(f"V6_LOGIN_BUTTON_CONTRAST_OVERLAY_FAILED: {error}") from error
    print(
        "V6_ACCESSIBILITY_OVERLAY=PASS "
        f"governorate_changed={changed} login_button_contrast_changed={login_changed}"
    )


if __name__ == "__main__":
    main()
