#!/usr/bin/env python3
"""Regression tests for scripts/import-r6-cleanroom.py."""
from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path

SCRIPT = Path(__file__).with_name("import-r6-cleanroom.py")


class R6ImporterTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory(prefix="r6-import-tests-")
        self.root = Path(self.tmp.name)
        self.repo = self.root / "repo"
        self.repo.mkdir()

    def tearDown(self) -> None:
        self.tmp.cleanup()

    def make_archive(self, name: str, entries: dict[str, str]) -> tuple[Path, str]:
        archive = self.root / name
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zf:
            for path, content in entries.items():
                zf.writestr(path, content)
        digest = hashlib.sha256(archive.read_bytes()).hexdigest()
        return archive, digest

    @staticmethod
    def valid_entries() -> dict[str, str]:
        entries = {"package.json": '{"name":"r6-fixture"}'}
        entries.update({f"src/component_{i}.tsx": "export const value = 1;" for i in range(51)})
        entries["src/components/mobile/index.tsx"] = "export const Mobile = true;"
        entries[".data/production-live-db.json"] = '{"must_not_import":true}'
        entries[".env"] = "SECRET=must-not-import"
        return entries

    def run_import(self, archive: Path, digest: str, target: str = "apps/aistudio-v6", *extra: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                sys.executable, str(SCRIPT), str(archive),
                "--repo-root", str(self.repo), "--target", target,
                "--expected-sha256", digest, "--report", str(self.root / "report.json"),
                *extra,
            ],
            text=True, capture_output=True, check=False,
        )

    def test_stages_source_preserves_mobile_and_excludes_local_state(self) -> None:
        archive, digest = self.make_archive("clean.zip", self.valid_entries())
        result = self.run_import(archive, digest, "apps/aistudio-v6", "--stage")
        self.assertEqual(result.returncode, 0, result.stderr)
        target = self.repo / "apps/aistudio-v6"
        manifest = json.loads((target / "R6_IMPORT_MANIFEST.json").read_text())
        self.assertEqual(manifest["status"], "SOURCE_STAGED_NOT_PRODUCTION_READY")
        self.assertTrue((target / "src/components/mobile/index.tsx").is_file())
        self.assertFalse((target / ".data").exists())
        self.assertFalse((target / ".env").exists())
        self.assertFalse(manifest["production_data_imported"])
        self.assertFalse(manifest["production_deployment_performed"])

    def test_rejects_checksum_mismatch(self) -> None:
        archive, _ = self.make_archive("wrong-hash.zip", self.valid_entries())
        result = self.run_import(archive, "0" * 64, "apps/hash-test", "--stage")
        self.assertEqual(result.returncode, 2)
        self.assertIn("SHA-256 mismatch", result.stderr)
        self.assertFalse((self.repo / "apps/hash-test").exists())

    def test_rejects_path_traversal(self) -> None:
        entries = self.valid_entries()
        entries["../outside.txt"] = "not allowed"
        archive, digest = self.make_archive("traversal.zip", entries)
        result = self.run_import(archive, digest, "apps/traversal", "--stage")
        self.assertEqual(result.returncode, 2)
        self.assertIn("Unsafe archive path", result.stderr)
        self.assertFalse((self.root / "outside.txt").exists())

    def test_rejects_detected_embedded_secret(self) -> None:
        entries = self.valid_entries()
        entries["src/secrets.ts"] = 'const SUPABASE_SERVICE_ROLE_KEY = "' + ("A" * 40) + '";'
        archive, digest = self.make_archive("secret.zip", entries)
        result = self.run_import(archive, digest, "apps/secret", "--stage")
        self.assertEqual(result.returncode, 2)
        self.assertIn("Potential hard-coded secrets", result.stderr)
        self.assertFalse((self.repo / "apps/secret").exists())

    def test_refuses_to_overwrite_existing_target(self) -> None:
        target = self.repo / "apps/existing"
        target.mkdir(parents=True)
        marker = target / "owner-file.txt"
        marker.write_text("preserve")
        archive, digest = self.make_archive("existing.zip", self.valid_entries())
        result = self.run_import(archive, digest, "apps/existing", "--stage")
        self.assertEqual(result.returncode, 2)
        self.assertIn("Target already exists", result.stderr)
        self.assertEqual(marker.read_text(), "preserve")


if __name__ == "__main__":
    unittest.main(verbosity=2)
