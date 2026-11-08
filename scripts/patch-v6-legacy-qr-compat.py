#!/usr/bin/env python3
"""Preserve legacy ?businessId= QR links when V6 becomes the public root."""
from __future__ import annotations
import sys
from pathlib import Path

TARGET = Path("src/context/PublicAppContext.tsx")

HELPER = """const getPublicBusinessReferenceFromUrl = (): string => {
  try {
    const params = new URLSearchParams(window.location.search);
    return (params.get('store') || params.get('businessId') || '').trim();
  } catch {
    return '';
  }
};

"""

def replace_once(source: str, old: str, new: str, label: str) -> str:
    if new in source:
        return source
    count = source.count(old)
    if count != 1:
        raise ValueError(f"{label}: expected one anchor; found {count}")
    return source.replace(old, new, 1)

def patch(source: str) -> str:
    source = replace_once(
        source,
        "const PublicAppContext = createContext<PublicAppContextType | null>(null);",
        HELPER + "const PublicAppContext = createContext<PublicAppContextType | null>(null);",
        "URL compatibility helper",
    )
    source = replace_once(
        source,
        "return new URLSearchParams(window.location.search).get('store') || '';",
        "return getPublicBusinessReferenceFromUrl();",
        "initial selected business",
    )
    source = replace_once(
        source,
        "return new URLSearchParams(window.location.search).has('store') ? 'public_storefront' : 'directory';",
        "return getPublicBusinessReferenceFromUrl() ? 'public_storefront' : 'directory';",
        "initial public view",
    )
    source = replace_once(
        source,
        "const store = new URLSearchParams(window.location.search).get('store');",
        "const store = getPublicBusinessReferenceFromUrl();",
        "async directory URL resolution",
    )
    if source.count("getPublicBusinessReferenceFromUrl()") != 3:
        raise ValueError("expected exactly three compatibility-helper call sites")
    return source

def self_test() -> None:
    fixture = """const PublicAppContext = createContext<PublicAppContextType | null>(null);
const a = () => {
  try {
    return new URLSearchParams(window.location.search).get('store') || '';
  } catch { return ''; }
};
const b = () => {
  try {
    return new URLSearchParams(window.location.search).has('store') ? 'public_storefront' : 'directory';
  } catch { return 'directory'; }
};
const c = () => {
  const store = new URLSearchParams(window.location.search).get('store');
  if (store) return store;
};
"""
    result = patch(fixture)
    assert "params.get('store') || params.get('businessId')" in result
    assert result.count("getPublicBusinessReferenceFromUrl()") == 3
    assert "params.has('store')" not in result
    assert patch(result) == result

def main() -> None:
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        self_test()
        print("V6_LEGACY_QR_COMPAT_SELF_TEST=PASS")
        return
    if len(sys.argv) != 2:
        raise SystemExit("Usage: patch-v6-legacy-qr-compat.py <v6-worktree>")
    root = Path(sys.argv[1]).resolve()
    target = root / TARGET
    if not target.is_file():
        raise SystemExit("V6_PUBLIC_APP_CONTEXT_MISSING")
    original = target.read_text(encoding="utf-8")
    updated = patch(original)
    target.write_text(updated, encoding="utf-8")
    if patch(target.read_text(encoding="utf-8")) != updated:
        raise SystemExit("V6_LEGACY_QR_COMPAT_VERIFY_FAILED")
    print("V6_LEGACY_QR_COMPAT=PASS store_and_businessId=true")

if __name__ == "__main__":
    main()
