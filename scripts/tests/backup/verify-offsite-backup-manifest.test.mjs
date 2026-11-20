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
  const identityDir=fs.mkdtempSync(path.join(os.tmpdir(),"mnty-backup-key-"));
  t.after(()=>{
    fs.rmSync(root,{recursive:true,force:true});
    fs.rmSync(identityDir,{recursive:true,force:true});
  });
  const identity=path.join(identityDir,"age-identity.txt");
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
    backup_destination:"s3://offsite-bucket/mantiqatix/2026-11-19",
    offsite_destination_outside_supabase_org:true,
    offsite_retrieval_verified:true,
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
    env:{...process.env,AGE_IDENTITY_FILE:f.identity,BACKUP_GATE_DEBUG_PATHS:"1"}
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
  const encryptedPath=path.join(f.root,item.path);
  const corrupted=fs.readFileSync(encryptedPath);
  corrupted[corrupted.length-1]^=1;
  fs.writeFileSync(encryptedPath,corrupted);
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


test("plaintext database exports are blocked after encryption",t=>{
  const f=fixture(t);
  fs.mkdirSync(path.join(f.root,"database"));
  fs.writeFileSync(path.join(f.root,"database","roles.sql"),"plaintext must not remain");
  const r=invoke(f);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/plaintext database or Storage archive remains/);
});

test("recovery identity must stay outside the backup artifact directory",t=>{
  const f=fixture(t);
  const localIdentity=path.join(f.root,"local-age-identity.txt");
  fs.copyFileSync(f.identity,localIdentity);
  fs.chmodSync(localIdentity,0o600);
  const r=spawnSync(process.execPath,[script,f.manifestPath],{
    encoding:"utf8",
    env:{...process.env,AGE_IDENTITY_FILE:localIdentity}
  });
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/stored separately/);
});

test("credential-bearing or signed backup URLs are blocked",t=>{
  const f=fixture(t);
  f.manifest.backup_destination="https://bucket.example/path?token=private";
  fs.writeFileSync(f.manifestPath,JSON.stringify(f.manifest));
  const r=invoke(f);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/non-secret off-site URI/);
});

test("unverified off-site separation is blocked",t=>{
  const f=fixture(t);
  f.manifest.offsite_destination_outside_supabase_org=false;
  fs.writeFileSync(f.manifestPath,JSON.stringify(f.manifest));
  const r=invoke(f);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/second-environment retrieval/);
});


test("backup manifest and encrypted artifacts cannot be stored in the repository",t=>{
  const root=fs.mkdtempSync(path.join(process.cwd(),"backup-gate-inside-repo-"));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const outside=fixture(t);
  const insideManifest=path.join(root,"manifest.json");
  fs.copyFileSync(outside.manifestPath,insideManifest);
  const r=spawnSync(process.execPath,[script,insideManifest],{
    encoding:"utf8",
    env:{...process.env,AGE_IDENTITY_FILE:outside.identity}
  });
  assert.notEqual(r.status,0,r.stdout+r.stderr);
  assert.match(r.stderr,/stored outside the Git repository/);
});


test("repository backup restriction cannot be bypassed through a symlinked manifest directory",t=>{
  const f=fixture(t);
  const repositoryTarget=fs.mkdtempSync(path.join(process.cwd(),"backup-gate-symlink-target-"));
  const expectedRepositoryRoot=fs.realpathSync.native(path.resolve(path.dirname(script),"../.."));
  const realRepositoryTarget=fs.realpathSync.native(repositoryTarget);
  assert.ok(realRepositoryTarget.startsWith(expectedRepositoryRoot+path.sep),
    "symlink target fixture must resolve inside the repository root");
  const symlinkParent=fs.mkdtempSync(path.join(os.tmpdir(),"mnty-backup-symlink-parent-"));
  const alias=path.join(symlinkParent,"linked-backup");
  t.after(()=>{
    fs.rmSync(repositoryTarget,{recursive:true,force:true});
    fs.rmSync(symlinkParent,{recursive:true,force:true});
  });
  for(const artifact of f.manifest.artifacts) {
    fs.copyFileSync(path.join(f.root,artifact.path),path.join(repositoryTarget,artifact.path));
  }
  fs.copyFileSync(f.manifestPath,path.join(repositoryTarget,"manifest.json"));
  try {
    fs.symlinkSync(repositoryTarget,alias,"dir");
  } catch(error) {
    if(["EPERM","EACCES","ENOTSUP"].includes(error.code)) return t.skip("directory symlinks are unavailable");
    throw error;
  }
  const r=spawnSync(process.execPath,[path.join(alias,"manifest.json")],{
    encoding:"utf8",
    env:{...process.env,AGE_IDENTITY_FILE:f.identity}
  });
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/stored outside the Git repository/);
});

test("recovery identity cannot be hidden inside the repository through a symlinked parent",t=>{
  const f=fixture(t);
  const repositoryKeyDir=fs.mkdtempSync(path.join(process.cwd(),"backup-gate-key-symlink-target-"));
  const expectedRepositoryRoot=fs.realpathSync.native(path.resolve(path.dirname(script),"../.."));
  const realRepositoryKeyDir=fs.realpathSync.native(repositoryKeyDir);
  assert.ok(realRepositoryKeyDir.startsWith(expectedRepositoryRoot+path.sep),
    "symlink target fixture must resolve inside the repository root");
  const symlinkParent=fs.mkdtempSync(path.join(os.tmpdir(),"mnty-key-symlink-parent-"));
  const alias=path.join(symlinkParent,"linked-key");
  t.after(()=>{
    fs.rmSync(repositoryKeyDir,{recursive:true,force:true});
    fs.rmSync(symlinkParent,{recursive:true,force:true});
  });
  const repositoryIdentity=path.join(repositoryKeyDir,"age-identity.txt");
  fs.copyFileSync(f.identity,repositoryIdentity);
  fs.chmodSync(repositoryIdentity,0o600);
  try {
    fs.symlinkSync(repositoryKeyDir,alias,"dir");
  } catch(error) {
    if(["EPERM","EACCES","ENOTSUP"].includes(error.code)) return t.skip("directory symlinks are unavailable");
    throw error;
  }
  const r=spawnSync(process.execPath,[f.manifestPath],{
    encoding:"utf8",
    env:{...process.env,AGE_IDENTITY_FILE:path.join(alias,"age-identity.txt"),BACKUP_GATE_DEBUG_PATHS:"1"}
  });
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/stored outside the Git repository/);
});

test("restore reviewer cannot be the backup operator",t=>{
  const f=fixture(t);
  f.manifest.restore_rehearsal.reviewer=f.manifest.backup_operator;
  fs.writeFileSync(f.manifestPath,JSON.stringify(f.manifest));
  const r=invoke(f);
  assert.notEqual(r.status,0);
  assert.match(r.stderr,/separate from the backup operator/);
});
