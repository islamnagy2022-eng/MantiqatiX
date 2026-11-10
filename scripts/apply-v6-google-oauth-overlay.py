#!/usr/bin/env python3
from __future__ import annotations

import base64
import hashlib
import io
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WORKTREE = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else None
BUNDLE = ROOT / "scripts" / "v6-google-oauth-overlay.zip.b64"
EXPECTED_SHA256 = "36a01ce1265fada358ba14a34c56519ada78403df708993ac224b9cd43f8b32b"
ALLOWED = {
    "src/services/googleOAuth.ts",
    "src/services/googleOAuth.test.mjs",
    "src/components/auth/LoginModal.tsx",
    "scripts/test-v6-google-oauth-ui.mjs",
    "patches/src/context/PublicAppContext.tsx.patch",
    "patches/src/components/Navbar.tsx.patch",
    "patches/src/services/supabaseAuthRest.ts.patch",
}

def fail(message: str) -> None:
    raise SystemExit(f"V6_GOOGLE_OAUTH_OVERLAY=FAIL {message}")

if WORKTREE is None or not WORKTREE.is_dir():
    fail("WORKTREE_ARGUMENT_REQUIRED")

try:
    encoded = BUNDLE.read_text(encoding="ascii").strip()
    archive_bytes = base64.b64decode(encoded, validate=True)
except Exception as exc:
    fail(f"BUNDLE_DECODE_ERROR: {exc}")

actual = hashlib.sha256(archive_bytes).hexdigest()
if actual != EXPECTED_SHA256:
    fail(f"BUNDLE_SHA256_MISMATCH expected={EXPECTED_SHA256} actual={actual}")

try:
    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
        names = set(archive.namelist())
        if names != ALLOWED:
            fail(f"BUNDLE_CONTENTS_MISMATCH names={sorted(names)}")
        for name in sorted(names):
            if name.startswith("patches/"):
                continue
            destination = WORKTREE / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(archive.read(name))

        with tempfile.TemporaryDirectory(prefix="mantiqatix-google-oauth-") as tmp:
            temp_root = Path(tmp)
            for name in sorted(n for n in names if n.startswith("patches/")):
                patch_file = temp_root / Path(name).name
                patch_file.write_bytes(archive.read(name))
                result = subprocess.run(
                    ["patch", "--batch", "--forward", "--fuzz=0", "-p1", "-i", str(patch_file)],
                    cwd=WORKTREE,
                    text=True,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT,
                )
                if result.returncode:
                    fail(f"PATCH_FAILED {name}\n{result.stdout}")
except zipfile.BadZipFile:
    fail("BUNDLE_ZIP_INVALID")

rest_file = WORKTREE / "src/services/supabaseAuthRest.ts"
if not rest_file.is_file() or "export async function parseSession" not in rest_file.read_text(encoding="utf-8"):
    fail("SUPABASE_AUTH_REST_PARSE_SESSION_NOT_EXPORTED")

print(f"V6_GOOGLE_OAUTH_OVERLAY=PASS sha256={actual}")
