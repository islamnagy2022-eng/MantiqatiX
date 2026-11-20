#!/usr/bin/env python3
"""Apply first-party MantiqatiX brand media to the generated V6 public source."""
from __future__ import annotations

import sys
from pathlib import Path

TARGET = Path("src/data/imageAssets.ts")
OLD_LOGO = """export function resolveBusinessLogo(
  business?: { logoUrl?: string | null; functionalGroupId?: FunctionalGroupId | string | null } | null
): string {
  const raw = business?.logoUrl?.trim() || '';
  if (raw && !LEGACY_GENERIC_URLS.has(raw)) {
    return raw;
  }
  return getSectorDefaultLogo(business?.functionalGroupId);
}"""
NEW_LOGO = r"""const isMantiqatiXBrandBusiness = (business?: { name?: string | null } | null): boolean =>
  /^mantiqatix$/i.test(String(business?.name || '').replace(/\s+/g, '').trim());

const resolveV6PublicAsset = (fileName: string): string => {
  const base = (import.meta as ImportMeta & { env?: { BASE_URL?: string } }).env?.BASE_URL || '/';
  return `${base.endsWith('/') ? base : `${base}/`}${fileName}`;
};

export function resolveBusinessLogo(
  business?: { name?: string | null; logoUrl?: string | null; functionalGroupId?: FunctionalGroupId | string | null } | null
): string {
  if (isMantiqatiXBrandBusiness(business)) {
    return resolveV6PublicAsset('mantiqatix-brand-logo.svg');
  }
  const raw = business?.logoUrl?.trim() || '';
  if (raw && !LEGACY_GENERIC_URLS.has(raw)) {
    return raw;
  }
  return getSectorDefaultLogo(business?.functionalGroupId);
}"""
OLD_COVER = """export function resolveBusinessCover(
  business?: { coverUrl?: string | null; functionalGroupId?: FunctionalGroupId | string | null } | null
): string {
  const raw = business?.coverUrl?.trim() || '';
  if (raw && !LEGACY_GENERIC_URLS.has(raw)) {
    return raw;
  }
  return getSectorDefaultCover(business?.functionalGroupId);
}"""
NEW_COVER = """export function resolveBusinessCover(
  business?: { name?: string | null; coverUrl?: string | null; functionalGroupId?: FunctionalGroupId | string | null } | null
): string {
  if (isMantiqatiXBrandBusiness(business)) {
    return resolveV6PublicAsset('mantiqatix-brand-cover.svg');
  }
  const raw = business?.coverUrl?.trim() || '';
  if (raw && !LEGACY_GENERIC_URLS.has(raw)) {
    return raw;
  }
  return getSectorDefaultCover(business?.functionalGroupId);
}"""

def replace_once(source: str, old: str, new: str, label: str) -> tuple[str, bool]:
    new_count = source.count(new)
    if new_count == 1:
        return source, False
    old_count = source.count(old)
    if old_count != 1 or new_count:
        raise ValueError(f"{label}: expected one source anchor; old={old_count}; new={new_count}")
    updated = source.replace(old, new, 1)
    if updated.count(new) != 1:
        raise ValueError(f"{label}: replacement verification failed")
    return updated, True

def patch(source: str) -> tuple[str, bool]:
    original = source
    source, logo_changed = replace_once(source, OLD_LOGO, NEW_LOGO, "business logo resolver")
    source, cover_changed = replace_once(source, OLD_COVER, NEW_COVER, "business cover resolver")
    for marker in ["isMantiqatiXBrandBusiness", "mantiqatix-brand-logo.svg", "mantiqatix-brand-cover.svg"]:
        if marker not in source:
            raise ValueError(f"V6 brand resolver marker missing: {marker}")
    return source, logo_changed or cover_changed or source != original

def self_test() -> None:
    fixture = OLD_LOGO + "\n\n" + OLD_COVER
    updated, changed = patch(fixture)
    assert changed
    assert "mantiqatix-brand-logo.svg" in updated
    assert "mantiqatix-brand-cover.svg" in updated
    again, changed_again = patch(updated)
    assert not changed_again and again == updated
    assert "replace(/\\s+/g" in NEW_LOGO

def main() -> None:
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        self_test()
        print("V6_MANTIQATIX_BRANDING_OVERLAY_SELF_TEST=PASS")
        return
    if len(sys.argv) != 3:
        raise SystemExit("Usage: patch-v6-mantiqatix-branding.py <v6-worktree> <catalog-public-assets>")
    root = Path(sys.argv[1]).resolve()
    assets = Path(sys.argv[2]).resolve()
    target = root / TARGET
    if not target.is_file():
        raise SystemExit("V6_MANTIQATIX_BRANDING_TARGET_MISSING")
    updated, changed = patch(target.read_text(encoding="utf-8"))
    if changed:
        target.write_text(updated, encoding="utf-8")
    public = root / "public"
    public.mkdir(parents=True, exist_ok=True)
    for name in ["mantiqatix-brand-logo.svg", "mantiqatix-brand-cover.svg"]:
        source = assets / name
        destination = public / name
        if not source.is_file() or source.stat().st_size < 100:
            raise SystemExit(f"V6_MANTIQATIX_BRAND_SOURCE_ASSET_MISSING={name}")
        if not destination.exists() or destination.read_bytes() != source.read_bytes():
            destination.write_bytes(source.read_bytes())
        if destination.read_bytes() != source.read_bytes():
            raise SystemExit(f"V6_MANTIQATIX_BRAND_ASSET_COPY_FAILED={name}")
    verify, changed_again = patch(target.read_text(encoding="utf-8"))
    if changed_again:
        raise SystemExit("V6_MANTIQATIX_BRANDING_PATCH_NOT_IDEMPOTENT")
    print("V6_MANTIQATIX_BRANDING=PASS logo=first_party cover=first_party merchant_media=preserved")

if __name__ == "__main__":
    main()
