#!/usr/bin/env bash
set -euo pipefail

ARCHIVE="${1:-bizcatalog-manager-6-preview-clean.zip}"
DEST="apps/bizcatalog-manager-6-preview"
EXPECTED_BRANCH="preview/bizcatalog-manager-6-isolated"

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

ARCHIVE_LIST="$(unzip -Z1 "$ARCHIVE")"
if printf '%s\n' "$ARCHIVE_LIST" | grep -Eq '(^|/)\.data/|(^|/)\.aistudio/|(^|/)\.env($|/)|(^|/)\.env\.(local|production)'; then
  echo "Unsafe archive contents detected (.data/.aistudio/local env). Import cancelled." >&2
  exit 1
fi

mkdir -p "$DEST"
unzip -q "$ARCHIVE" -d "$DEST"

test -f "$DEST/package.json"
test -f "$DEST/server.ts"
test -f "$DEST/Dockerfile"
test ! -e "$DEST/.data"
test ! -e "$DEST/.data-preview"

git add "$DEST"
git commit -m "Import sanitized BizCatalog Manager R6 preview source"
echo "Import committed. Push this preview branch to GitHub to start the R6 Preview CI workflow."
