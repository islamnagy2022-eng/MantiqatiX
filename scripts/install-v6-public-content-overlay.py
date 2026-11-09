#!/usr/bin/env python3
from __future__ import annotations
import base64, hashlib, subprocess, sys, zipfile, io
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = ROOT / 'scripts' / 'v6-public-content-overlay.zip.b64'
DEST = ROOT / 'scripts' / 'v6-public-content-overlay'
EXPECTED_SHA256 = 'e62ebc812a77b1fed75aa328f4b7725fe8e39b04680fb1cec7738c49d441731e'
WORKTREE = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else None

def fail(message: str) -> None:
    raise SystemExit(f'V6_PUBLIC_CONTENT_INSTALL=FAIL {message}')

if WORKTREE is None or not WORKTREE.is_dir():
    fail('WORKTREE_ARGUMENT_REQUIRED')
try:
    payload = base64.b64decode(BUNDLE.read_text(encoding='ascii').strip(), validate=True)
except Exception as exc:
    fail(f'BUNDLE_DECODE_ERROR={exc}')
actual = hashlib.sha256(payload).hexdigest()
if actual != EXPECTED_SHA256:
    fail(f'BUNDLE_SHA256_MISMATCH expected={EXPECTED_SHA256} actual={actual}')
DEST.mkdir(parents=True, exist_ok=True)
try:
    with zipfile.ZipFile(io.BytesIO(payload)) as archive:
        names = archive.namelist()
        allowed = {'googleOAuth.ts','googleOAuth.test.mjs','publicDirectoryListings.ts','publicDirectoryListings.test.mjs',
                   'patch-v6-public-content-overlay.py','test-v6-google-oauth-ui.mjs','test-v6-public-directory-listings-ui.mjs','patches'}
        if not names or any(n.startswith('/') or '..' in Path(n).parts for n in names):
            fail('UNSAFE_BUNDLE_PATH')
        if any(Path(n).parts[0] not in allowed for n in names):
            fail('UNEXPECTED_BUNDLE_CONTENT')
        archive.extractall(DEST)
except zipfile.BadZipFile:
    fail('BUNDLE_ZIP_INVALID')
patcher = DEST / 'patch-v6-public-content-overlay.py'
if not patcher.is_file():
    fail('PATCHER_NOT_FOUND')
result = subprocess.run([sys.executable, str(patcher), str(WORKTREE)], text=True)
if result.returncode:
    fail(f'PATCHER_EXITED_{result.returncode}')
for name in ('test-v6-google-oauth-ui.mjs','test-v6-public-directory-listings-ui.mjs'):
    result = subprocess.run(['node', str(DEST / name), str(WORKTREE)], text=True)
    if result.returncode:
        fail(f'CONTRACT_TEST_FAILED={name}')
print(f'V6_PUBLIC_CONTENT_INSTALL=PASS sha256={actual}')
