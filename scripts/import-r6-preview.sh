#!/usr/bin/env bash
set -euo pipefail

ARCHIVE="${1:-bizcatalog-manager-6-preview-clean.zip}"
DEST="apps/bizcatalog-manager-6-preview"
EXPECTED_BRANCH="preview/bizcatalog-manager-6-isolated"
EXPECTED_SHA256="a87bfc9e80a155277e1f35d8fb29ccff159eba9c31a6f00ffc35eee555e36241"

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

mkdir -p "$(dirname "$DEST")"
TEMP_ROOT="$(mktemp -d "$(dirname "$DEST")/.r6-import.XXXXXX")"
TEMP_DEST="$TEMP_ROOT/app"
IMPORT_COMMITTED=0

cleanup_import() {
  local status=$?
  trap - EXIT
  if [[ "$status" -ne 0 && "$IMPORT_COMMITTED" -eq 0 && -d "$DEST" ]]; then
    git reset --quiet -- "$DEST" 2>/dev/null || true
    rm -rf -- "$DEST"
    echo "Removed only the incomplete import directory created by this run." >&2
  fi
  rm -rf -- "$TEMP_ROOT"
  exit "$status"
}
trap cleanup_import EXIT

ACTUAL_SHA256="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
if [[ "$ACTUAL_SHA256" != "$EXPECTED_SHA256" ]]; then
  echo "Unexpected archive checksum; refusing import." >&2
  exit 1
fi
python3 - "$ARCHIVE" <<'PY'
import stat
import sys
import zipfile
from pathlib import PurePosixPath

archive = sys.argv[1]
required = {
    "package.json", "bun.lock", "server.ts", "Dockerfile",
    "src/App.tsx", "src/context/AppContext.tsx",
}
blocked_dirs = {".data", ".data-preview", ".aistudio"}
blocked_env = {".env", ".env.local", ".env.production"}

with zipfile.ZipFile(archive) as z:
    infos = z.infolist()
    names = [i.filename for i in infos]
    if len(names) != len(set(names)):
        raise SystemExit("Duplicate ZIP paths detected; import cancelled.")

    total_size = 0
    files = set()
    for info in infos:
        name = info.filename
        path = PurePosixPath(name)
        if not name or path.is_absolute() or ".." in path.parts or "\\" in name:
            raise SystemExit(f"Unsafe ZIP path detected: {name!r}")
        parts = set(path.parts)
        if parts & blocked_dirs or parts & blocked_env:
            raise SystemExit(f"Data/secret path detected: {name!r}")
        if any(p.startswith(".env.") and p != ".env.example" for p in parts):
            raise SystemExit(f"Unexpected environment file detected: {name!r}")
        mode = (info.external_attr >> 16) & 0o170000
        if mode == stat.S_IFLNK:
            raise SystemExit(f"Symbolic links are not allowed in ZIP: {name!r}")
        if not info.is_dir():
            files.add(name)
            total_size += info.file_size
    if total_size > 100 * 1024 * 1024:
        raise SystemExit("Expanded archive exceeds the 100 MiB safety limit.")
    missing = required - files
    if missing:
        raise SystemExit("Required files missing: " + ", ".join(sorted(missing)))

print(f"Archive validation passed: {len(files)} files, {total_size} bytes expanded.")
PY

unzip -q "$ARCHIVE" -d "$TEMP_DEST"
python3 scripts/harden_r6_preview.py "$TEMP_DEST"
python3 scripts/finish_r6_preview_isolation.py "$TEMP_DEST"
python3 scripts/finish_r6_preview_core.py "$TEMP_DEST"
python3 scripts/finish_r6_preview_cleanups.py "$TEMP_DEST"

test -f "$TEMP_DEST/package.json"
test -f "$TEMP_DEST/server.ts"
test -f "$TEMP_DEST/Dockerfile"
test -f "$TEMP_DEST/bun.lock"
test ! -e "$TEMP_DEST/.data"
test ! -e "$TEMP_DEST/.data-preview"
test ! -e "$TEMP_DEST/.env"
grep -q 'PREVIEW_ALLOWED_API_PATHS' "$TEMP_DEST/server.ts"
grep -q 'MANTIQATIX_PREVIEW_NOTICE' "$TEMP_DEST/src/App.tsx"
grep -q 'if (IS_PREVIEW_MODE) return [];' "$TEMP_DEST/src/context/AppContext.tsx"
grep -q "VITE_PREVIEW_MODE !== 'true'" "$TEMP_DEST/src/main.tsx"

[[ ! -e "$DEST" ]] || { echo "Destination appeared during import; refusing overwrite." >&2; exit 1; }
mv "$TEMP_DEST" "$DEST"
if ! git config user.name >/dev/null 2>&1; then
  git config user.name "MantiqaTix R6 Import"
fi
if ! git config user.email >/dev/null 2>&1; then
  git config user.email "mantiqatix-r6-import@users.noreply.github.com"
fi
git add "$DEST"
git commit -m "Import sanitized and hardened BizCatalog Manager R6 preview source"
IMPORT_COMMITTED=1
echo "Import committed. Push this preview branch to GitHub to start the R6 Preview CI workflow."
