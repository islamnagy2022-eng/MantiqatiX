import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

const script = path.resolve("scripts/backup/verify-offsite-backup-manifest.mjs");
const requiredKinds = ["database_roles","database_schema","database_data","storage_objects"];
const requiredChecks = [
  "postgres_version","schema_inventory","critical_row_counts","auth_records",
  "rls_policies_and_acl","security_definer_owners_and_grants","financial_invariants",
  "storage_inventory","vault_recovery","edge_auth_smoke","rollback_rehearsal"
];

function run(command,args,options={}) {
  const r=spawnSync(command,args,{encoding:"utf8",...options});
  if(r.error) throw r.error;
  assert.equal(r.status,0,`${command} failed: ${r.stderr}`);
  return r.stdout.trim();
}

function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"mnty-backup-gate-"));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const identity=path.join(root,"age-identity.txt");
  run("age-keygen",["-o",identity]);
  fs.chmodSync(identity,0o600);
  const recipient=run("age-keygen",["-y",identity]);
  const artifacts=[];
  for(const kind of requiredKinds) {
    const plain=path.join(root,`${kind}.plain`);
    const data=Buffer.from(`disposable test artifact: ${kind}:${crypto.randomUUID()}`);
    fs.writeFileSync(plain,data,{mode:0o600});
    const encrypted=path.join(root,`${kind}.sql.age`);
    run("age",["-r",recipient,"-o",encrypted,plain]);
    fs.rmSync(plain);
    const content=fs.readFileSync(encrypted);
    artifacts.push({
      kind,
      path:path.basename(encrypted),
      bytes:content.length,
      sha256:crypto.createHash("sha256").update(content).digest("hex")
    });
  }
  const manifest={
    schema_version:1,
    production_project_ref:"moyhiluyhjsujhwlyeuu",
    source_commit_sha:"1234567890abcdef1234567890abcdef12345678",
    source_postgres_version:"17.6.1.155",
    backup_started_at:"2026-11-19T18:00:00.000Z",
    backup_finished_at:"2026-11-19T18:05:00.000Z",
    backup_destination:"s3://offsite-backups/mantiqatix/2026-11-19",
    backup_operator:"operator-id",
    retention_until:"2027-01-19T00:00:00.000Z",
    encryption:{algorithm:"age",recipient_id:"recovery-key-2026"},
    artifacts,
    storage_buckets:[
      {name:"mantiqatix-media",object_count:0,total_bytes:0,inventory_match:true},
      {name:"mantiqatix-private",object_count:0,total_bytes:0,inventory_match:true}
    ],
    restore_rehearsal:{
      status:"PASS",
      target_project_ref:"mnty-disposable-restore",
      postgres_major_version:17,
      started_at:"2026-11-19T19:00:00.000Z",
      finished_at:"2026-11-19T19:10:00.000Z",
      rpo_seconds:300,
      rto_seconds:600,
      evidence_ref:"https://example.invalid/restore-evidence",
      reviewer:"independent-reviewer",
      acceptance:Object.fromEntries(requiredChecks.map(k=>[k,true]))
    }
  };
  const manifestPath=path.join(root,"manifest.json");
  fs.writeFileSync(manifestPath,JSON.stringify(manifest,null,2),{mode:0o600});
  return {root,identity,manifest,manifestPath};
}

function invoke(f) {
  return spawnSync(process.execPath,[script,f.manifestPath],{
    encoding:"utf8",
    env:{...process.env,AGE_IDENTITY_FILE:f.identity}
  });
}

test("complete encrypted backup with a separate PostgreSQL 17 restore passes",t=>{
  const f=fixture(t);
  const r=invoke(f);
  assert.equal(r.status,0,r.stderr+r.stdout);
  assert.match(r.stdout,/BACKUP_MANIFEST=PASS/);
});

test("tampered encrypted artifact is blocked by checksum verification",t=>{
  const f=fixture(t);
  const item=f.manifest.artifacts[0];
  fs.appendFileSync(path.join(f.root,item.path),"tamper");
  fs.writeFileSync(f.manifestPath,JSON.stringify(f.manifest));
  const r=invoke(f);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/SHA-256 mismatch/);
});

test("path traversal in an artifact path is blocked",t=>{
  const f=fixture(t);
  f.manifest.artifacts[0].path="../outside.age";
  fs.writeFileSync(f.manifestPath,JSON.stringify(f.manifest));
  const r=invoke(f);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/safe relative path/);
});

test("restore targeting the Production project is blocked",t=>{
  const f=fixture(t);
  f.manifest.restore_rehearsal.target_project_ref=f.manifest.production_project_ref;
  fs.writeFileSync(f.manifestPath,JSON.stringify(f.manifest));
  const r=invoke(f);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/separate project/);
});

test("missing restore acceptance evidence is blocked",t=>{
  const f=fixture(t);
  f.manifest.restore_rehearsal.acceptance.vault_recovery=false;
  fs.writeFileSync(f.manifestPath,JSON.stringify(f.manifest));
  const r=invoke(f);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/vault_recovery/);
});

test("secret-bearing fields are blocked before artifact processing",t=>{
  const f=fixture(t);
  f.manifest.database_url="postgres://must-not-be-recorded";
  fs.writeFileSync(f.manifestPath,JSON.stringify(f.manifest));
  const r=invoke(f);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/sensitive field name is prohibited/);
});
