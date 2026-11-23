#!/usr/bin/env python3
"""Decode and validate the approved MantiqatiX brand image and its SVG wrapper."""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMAGE = ROOT / "apps/catalog-frontend/public/brand/mantiqatix-approved-logo.jpg"
SVG = ROOT / "apps/catalog-frontend/public/icons/mantiqatix-approved.svg"

if not IMAGE.is_file() or IMAGE.stat().st_size < 1024:
    raise SystemExit("Approved logo file is missing or unexpectedly small")

try:
    with Image.open(IMAGE) as image:
        if image.format != "JPEG":
            raise SystemExit(f"Approved logo must be JPEG, got {image.format!r}")
        image.verify()
    with Image.open(IMAGE) as image:
        if image.size != (200, 200):
            raise SystemExit(f"Approved logo must be 200x200, got {image.size}")
        image.load()
except Exception as exc:
    raise SystemExit(f"Approved logo failed full image decode: {exc}") from exc

svg = SVG.read_text(encoding="utf-8")
expected = "../brand/mantiqatix-approved-logo.jpg"
if expected not in svg:
    raise SystemExit("Approved-logo SVG does not reference the canonical JPEG asset")

resolved = (SVG.parent / expected).resolve()
if resolved != IMAGE.resolve():
    raise SystemExit("Approved-logo SVG resolves outside the canonical brand asset")

print("APPROVED_BRAND_IMAGE_DECODE=PASS (JPEG, 200x200)")
