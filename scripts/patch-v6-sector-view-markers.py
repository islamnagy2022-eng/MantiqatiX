#!/usr/bin/env python3
"""Expose stable browser-test hooks for the canonical r5 sector grid and quick-tabs UI."""
from __future__ import annotations
import sys
from pathlib import Path

TARGET = Path("src/components/DirectoryView.tsx")
REPLACEMENTS = [
    ("onClick={() => setSectorViewStyle('cards')}", 'data-testid="sector-view-cards"\n                      onClick={() => setSectorViewStyle(\'cards\')}', "cards toggle"),
    ("onClick={() => setSectorViewStyle('tabs')}", 'data-testid="sector-view-tabs"\n                      onClick={() => setSectorViewStyle(\'tabs\')}', "tabs toggle"),
    ('<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">', '<div data-testid="sector-filter-list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">', "cards grid"),
    ('<div className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 scrollbar-none">', '<div data-testid="sector-filter-list" className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 scrollbar-none">', "quick tabs rail"),
]
def patch(source: str) -> tuple[str, bool]:
    changed = False
    for old, new, label in REPLACEMENTS:
        if new in source:
            continue
        count = source.count(old)
        if count != 1:
            raise ValueError(f"{label}: expected one anchor, found {count}")
        source = source.replace(old, new, 1)
        changed = True
    if 'data-testid="sector-view-cards"' not in source or 'data-testid="sector-view-tabs"' not in source or source.count('data-testid="sector-filter-list"') != 2:
        raise ValueError("V6 sector mode acceptance markers are incomplete")
    return source, changed
def self_test() -> None:
    fixture = "\n".join(old for old, _, _ in REPLACEMENTS)
    updated, changed = patch(fixture)
    assert changed
    again, changed_again = patch(updated)
    assert not changed_again and again == updated
def main() -> None:
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        self_test()
        print("V6_R5_SECTOR_VIEW_OVERLAY_SELF_TEST=PASS")
        return
    if len(sys.argv) != 2:
        raise SystemExit("Usage: patch-v6-sector-view-markers.py <extracted-v6-root>")
    target = Path(sys.argv[1]).resolve() / TARGET
    if not target.is_file():
        raise SystemExit("V6_R5_SECTOR_VIEW_TARGET_MISSING")
    updated, changed = patch(target.read_text(encoding="utf-8"))
    if changed:
        target.write_text(updated, encoding="utf-8")
    verified, changed_again = patch(target.read_text(encoding="utf-8"))
    if changed_again or verified != updated:
        raise SystemExit("V6_R5_SECTOR_VIEW_OVERLAY_NOT_IDEMPOTENT")
    print(f"V6_R5_SECTOR_VIEW_OVERLAY=PASS changed={int(changed)}")
if __name__ == "__main__":
    main()
