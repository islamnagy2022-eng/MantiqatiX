#!/usr/bin/env python3
"""Verify and stage the canonical MantiqaTix R6 source archive safely.

This imports source code only. It never migrates application data, identities,
subscriptions, payment records, or any live database state.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import stat
import sys
import tempfile
import zipfile
from pathlib import Path, PurePosixPath

EXPECTED_SHA256 = "c7623e2741d34ac5c58ba2c2c8f9286116e7adc6f5e214955c5c67d050c15447"
DEFAULT_TARGET = "apps/aistudio-v6"
MAX_UNCOMPRESSED = 1_000_000_000
MAX_RATIO = 250
EXCLUDED_DIRS = {
    ".git", ".data", ".aistudio", "node_modules", "dist", "build",
    "coverage", ".next", ".nuxt", ".vercel", ".turbo", ".cache",
    ".gradle", "DerivedData", "Pods",
}
EXCLUDED_NAMES = {
    "production-live-db.json", "local-live-db.json", "database.sqlite",
    "database.db", "backup.sql", "dump.sql",
}
TEXT_SUFFIXES = {".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".json", ".html", ".css", ".yml", ".yaml", ".toml", ".properties", ".xml", ".gradle", ".kts"}
SECRET_PATTERNS = [
    ("PRIVATE_KEY", re.compile(rb"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----")),
    ("SERVICE_ROLE_KEY_LITERAL", re.compile(rb"(?i)(?:SUPABASE_SERVICE_ROLE_KEY|service_role_key)\s*[:=]\s*['\"][^'\"]{20,}['\"]")),
    ("PAYMENT_SECRET_LITERAL", re.compile(rb"(?i)(?:PAYMOB_HMAC_SECRET|PAYMOB_SECRET_KEY|JWT_SECRET)\s*[:=]\s*['\"][^'\"]{12,}['\"]")),
]


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_member_name(raw: str) -> str:
    name = raw.replace("\\", "/")
    p = PurePosixPath(name)
    if not name or p.is_absolute() or any(part in ("..", "") for part in p.parts):
        raise ValueError(f"Unsafe archive path: {raw!r}")
    if p.parts and ":" in p.parts[0]:
        raise ValueError(f"Drive-qualified archive path: {raw!r}")
    return str(p)


def is_excluded(rel: PurePosixPath) -> str | None:
    parts = [part.lower() for part in rel.parts]
    base = rel.name.lower()
    if any(part in EXCLUDED_DIRS for part in parts):
        return "generated_or_local_directory"
    if base == ".env" or base.startswith(".env.") or base.startswith(".env.local"):
        return "environment_secret_file"
    if base in EXCLUDED_NAMES:
        return "local_database_or_backup"
    if base.endswith((".sqlite", ".sqlite3", ".db", ".dump", ".bak")):
        return "local_database_or_backup"
    if "backup" in base and base.endswith((".zip", ".tar", ".gz", ".sql", ".json")):
        return "backup_archive_or_snapshot"
    if rel.as_posix() == "server.ts":
        return "local_development_server"
    return None


def find_project_root(names: list[str]) -> str:
    candidates = []
    name_set = set(names)
    for name in names:
        if PurePosixPath(name).name != "package.json":
            continue
        parent = PurePosixPath(name).parent
        prefix = "" if str(parent) == "." else parent.as_posix() + "/"
        has_src = any(n.startswith(prefix + "src/") for n in name_set)
        has_mobile = any(n.startswith(prefix + "src/components/mobile/") for n in name_set)
        if has_src and has_mobile:
            candidates.append(str(parent))
    if len(candidates) != 1:
        raise ValueError(f"Expected exactly one app root containing package.json, src/, and src/components/mobile/; found {candidates}")
    return "" if candidates[0] == "." else candidates[0] + "/"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("archive", type=Path, help="path to bizcatalog-manager (6).zip")
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--target", default=DEFAULT_TARGET)
    parser.add_argument("--expected-sha256", default=EXPECTED_SHA256, help=argparse.SUPPRESS)
    parser.add_argument("--stage", action="store_true", help="stage sanitized source under the target path")
    parser.add_argument("--report", type=Path, default=Path("r6-import-audit.json"))
    args = parser.parse_args()

    archive = args.archive.resolve()
    repo = args.repo_root.resolve()
    target_rel = PurePosixPath(args.target.replace("\\", "/"))
    if target_rel.is_absolute() or any(part in ("..", "") for part in target_rel.parts):
        raise SystemExit("Unsafe target path; use a repository-relative path without '..'.")
    target = repo.joinpath(*target_rel.parts).resolve()
    if repo not in target.parents:
        raise SystemExit("Target must remain inside the repository root.")
    report_path = args.report.resolve()
    report = {
        "source_archive": archive.name,
        "expected_sha256": args.expected_sha256,
        "actual_sha256": None,
        "integrity": "NOT_CHECKED",
        "project_root_in_archive": None,
        "source_files": 0,
        "mobile_files": 0,
        "native_android_files": 0,
        "excluded_files": [],
        "sensitive_findings": [],
        "medical_scope_candidates": [],
        "stage": "NOT_REQUESTED",
        "production_data_imported": False,
        "production_deployment_performed": False,
    }

    try:
        if not archive.is_file():
            raise ValueError(f"Archive not found: {archive}")
        if not repo.is_dir():
            raise ValueError(f"Repository root not found: {repo}")
        actual = sha256_file(archive)
        report["actual_sha256"] = actual
        if actual.lower() != args.expected_sha256.lower():
            raise ValueError("SHA-256 mismatch; refusing to inspect as canonical R6 or stage any files.")
        report["integrity"] = "SHA256_MATCH"

        with zipfile.ZipFile(archive) as zf:
            bad = zf.testzip()
            if bad:
                raise ValueError(f"ZIP CRC check failed at {bad}")
            infos = [i for i in zf.infolist() if not i.is_dir()]
            names = []
            total = 0
            for info in infos:
                name = safe_member_name(info.filename)
                mode = (info.external_attr >> 16) & 0o170000
                if mode == stat.S_IFLNK:
                    raise ValueError(f"Symlink entry is not allowed: {name}")
                total += info.file_size
                if total > MAX_UNCOMPRESSED:
                    raise ValueError("Archive exceeds the 1 GB uncompressed safety limit")
                if info.compress_size and info.file_size / info.compress_size > MAX_RATIO:
                    raise ValueError(f"Suspicious compression ratio: {name}")
                names.append(name)
            if len(set(names)) != len(names):
                raise ValueError("Duplicate file paths found in archive")
            root_prefix = find_project_root(names)
            report["project_root_in_archive"] = root_prefix or "."

            eligible = []
            for info, name in zip(infos, names):
                if root_prefix and not name.startswith(root_prefix):
                    report["excluded_files"].append({"path": name, "reason": "outside_application_root"})
                    continue
                rel_text = name[len(root_prefix):] if root_prefix else name
                rel = PurePosixPath(rel_text)
                reason = is_excluded(rel)
                if reason:
                    report["excluded_files"].append({"path": rel_text, "reason": reason})
                    continue
                eligible.append((info, rel_text, rel))
                if rel_text.startswith("src/"):
                    report["source_files"] += 1
                if rel_text.startswith("src/components/mobile/"):
                    report["mobile_files"] += 1
                if rel.parts and rel.parts[0].lower() in ("android", "app"):
                    if rel.suffix.lower() in (".kt", ".kts", ".java", ".xml") or rel.name == "gradlew":
                        report["native_android_files"] += 1
                if "medical" in rel_text.lower() or "healthcare" in rel_text.lower():
                    report["medical_scope_candidates"].append(rel_text)
                if rel.suffix.lower() in TEXT_SUFFIXES and info.file_size <= 2_000_000:
                    blob = zf.read(info)
                    for code, pattern in SECRET_PATTERNS:
                        if pattern.search(blob):
                            report["sensitive_findings"].append({"path": rel_text, "type": code})

            if report["source_files"] < 50:
                raise ValueError(f"Unexpectedly small src tree ({report['source_files']} files); expected the canonical R6 app source")
            if report["mobile_files"] < 1:
                raise ValueError("R6 mobile web UI not found; refusing import")
            if report["sensitive_findings"]:
                raise ValueError("Potential hard-coded secrets detected; refusing stage until reviewed and removed")

            if args.stage:
                if target.exists():
                    raise ValueError(f"Target already exists; refusing to overwrite or merge: {target}")
                target.parent.mkdir(parents=True, exist_ok=True)
                staging = Path(tempfile.mkdtemp(prefix=".r6-import-staging-", dir=str(target.parent)))
                try:
                    for info, rel_text, rel in eligible:
                        destination = staging.joinpath(*rel.parts)
                        destination.parent.mkdir(parents=True, exist_ok=True)
                        with zf.open(info, "r") as src, destination.open("wb") as dst:
                            shutil.copyfileobj(src, dst)
                        executable = bool((info.external_attr >> 16) & 0o111)
                        destination.chmod(0o755 if executable else 0o644)
                    manifest = {
                        "source": archive.name,
                        "sha256": actual,
                        "target": args.target,
                        "files_imported": len(eligible),
                        "mobile_files_preserved": report["mobile_files"],
                        "excluded_files": report["excluded_files"],
                        "medical_scope_candidates_require_review": report["medical_scope_candidates"],
                        "production_data_imported": False,
                        "production_deployment_performed": False,
                        "status": "SOURCE_STAGED_NOT_PRODUCTION_READY",
                    }
                    (staging / "R6_IMPORT_MANIFEST.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
                    staging.rename(target)
                    report["stage"] = "STAGED_FOR_REVIEW_NOT_PRODUCTION_READY"
                    report["files_imported"] = len(eligible)
                except Exception:
                    shutil.rmtree(staging, ignore_errors=True)
                    raise

        report["integrity"] = "PASS"
    except Exception as exc:
        report["error"] = str(exc)
        report["stage"] = "REFUSED" if args.stage else "AUDIT_BLOCKED"
        try:
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
        except Exception:
            pass
        print(json.dumps(report, indent=2, ensure_ascii=False))
        print(f"R6_IMPORT=BLOCKED: {exc}", file=sys.stderr)
        return 2

    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(report, indent=2, ensure_ascii=False))
    print("R6_IMPORT=" + (report["stage"] if args.stage else "SOURCE_VERIFIED_NO_IMPORT"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
