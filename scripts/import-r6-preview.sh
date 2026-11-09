#!/usr/bin/env bash
set -euo pipefail

ARCHIVE="${1:-bizcatalog-manager-6-preview-clean.zip}"
DEST="apps/bizcatalog-manager-6-preview"
EXPECTED_BRANCH="preview/bizcatalog-manager-6-isolated"
EXPECTED_SHA256="a5d765120363747b46432d482f159e9f3dce9e2e809d818b58dd495bcdf0e4d5"

if [[ ! -f "$ARCHIVE" ]]; then
  echo "Archive not found: $ARCHIVE" >&2
  exit 1
fi
CURRENT_BRANCH="$(git branch --show-current)"
if [[ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]]; then
  echo "Refusing import on '$CURRENT_BRANCH'; switch to '$EXPECTED_BRANCH' first." >&2
  exit 1
fi
if [[ -e "$DEST" ]]; then
  echo "Destination already exists; refusing to overwrite: $DEST" >&2
  exit 1
fi

ACTUAL_SHA256="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
if [[ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]]; then
  echo "Unexpected archive checksum; refusing import." >&2
  exit 1
fi
ARCHIVE_LIST="$(unzip -Z1 "$ARCHIVE")"
if printf '%s\n' "$ARCHIVE_LIST" | grep -Eq '(^|/)\.data/|(^|/)\.data-preview/|(^|/)\.aistudio/|(^|/)\.env($|/)|(^|/)\.env\.(local|production)'; then
  echo "Unsafe archive contents detected; import cancelled." >&2
  exit 1
fi

mkdir -p "$DEST"
unzip -q "$ARCHIVE" -d "$DEST"
python3 scripts/harden_r6_preview.py "$DEST"

test -f "$DEST/package.json"
test -f "$DEST/server.ts"
test -f "$DEST/Dockerfile"
test ! -e "$DEST/.data"
test ! -e "$DEST/.data-preview"
grep -q 'PREVIEW_ALLOWED_API_PATHS' "$DEST/server.ts"
grep -q 'MANTIQATIX_PREVIEW_NOTICE' "$DEST/src/App.tsx"
git add "$DEST"
git commit -m "Import sanitized and hardened BizCatalog Manager R6 preview source"
echo "Import committed. Push this preview branch to GitHub to start the R6 Preview CI workflow."
