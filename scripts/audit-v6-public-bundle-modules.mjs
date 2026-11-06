#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.css'];
const MARKERS = [
  'wallet_admin_main',
  'wallet_biz_',
  'wallet_sub_',
  'prod_demo_',
  'admin_root',
  'mockAdminBalance',
  'محفظة الإدارة العامة',
];

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') files.push(...walkFiles(target));
    } else if (entry.isFile()) {
      files.push(target);
    }
  }
  return files;
}

function sourceImports(source) {
  const imports = new Set();
  const staticPattern = /\b(?:import|export)\s+(?:type\s+)?(?:[^'";]*?\s+from\s*)?['"]([^'"]+)['"]/g;
  const dynamicPattern = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  for (const pattern of [staticPattern, dynamicPattern]) {
    for (const match of source.matchAll(pattern)) imports.add(match[1]);
  }
  return [...imports];
}

function resolveLocalImport(specifier, importer, srcRoot) {
  let base;
  if (specifier.startsWith('.')) {
    base = path.resolve(path.dirname(importer), specifier);
  } else if (specifier.startsWith('@/')) {
    base = path.resolve(srcRoot, specifier.slice(2));
  } else if (specifier.startsWith('~/')) {
    base = path.resolve(srcRoot, specifier.slice(2));
  } else {
    return null;
  }

  const candidates = [base];
  for (const extension of EXTENSIONS) candidates.push(base + extension);
  for (const extension of EXTENSIONS) candidates.push(path.join(base, 'index' + extension));
  return candidates.find((candidate) => {
    try { return fs.statSync(candidate).isFile(); } catch { return false; }
  }) ?? null;
}

function shortestPath(graph, start, target) {
  const queue = [start];
  const parent = new Map([[start, null]]);
  while (queue.length) {
    const current = queue.shift();
    if (current === target) {
      const route = [];
      let cursor = target;
      while (cursor !== null) {
        route.push(cursor);
        cursor = parent.get(cursor);
      }
      return route.reverse();
    }
    for (const child of graph.get(current) ?? []) {
      if (!parent.has(child)) {
        parent.set(child, current);
        queue.push(child);
      }
    }
  }
  return null;
}

function relative(root, absolute) {
  return path.relative(root, absolute).split(path.sep).join('/');
}

export function inspectV6PublicBundle(root) {
  const resolvedRoot = path.resolve(root);
  const srcRoot = path.join(resolvedRoot, 'src');
  if (!fs.existsSync(srcRoot)) throw new Error('V6_SOURCE_DIRECTORY_MISSING=' + srcRoot);

  const sourceFiles = walkFiles(srcRoot).filter((file) => /\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(file));
  const graph = new Map();
  const unresolved = [];

  for (const file of sourceFiles) {
    const source = fs.readFileSync(file, 'utf8');
    const dependencies = [];
    for (const specifier of sourceImports(source)) {
      const local = resolveLocalImport(specifier, file, srcRoot);
      if (local) dependencies.push(local);
      else if (specifier.startsWith('.') || specifier.startsWith('@/') || specifier.startsWith('~/')) {
        unresolved.push({ importer: relative(srcRoot, file), specifier });
      }
    }
    graph.set(file, dependencies);
  }

  const entrypoints = ['main.tsx', 'main.ts', 'index.tsx', 'index.ts']
    .map((name) => path.join(srcRoot, name))
    .filter((file) => fs.existsSync(file));
  if (!entrypoints.length) throw new Error('V6_PUBLIC_ENTRYPOINT_NOT_FOUND');

  const sourceHits = [];
  for (const file of sourceFiles) {
    const source = fs.readFileSync(file, 'utf8');
    const markers = MARKERS.filter((marker) => source.includes(marker));
    if (!markers.length) continue;
    const paths = entrypoints.map((entrypoint) => ({
      entrypoint: relative(srcRoot, entrypoint),
      importPath: shortestPath(graph, entrypoint, file)?.map((item) => relative(srcRoot, item)) ?? null,
    }));
    sourceHits.push({
      file: relative(srcRoot, file),
      markers,
      reachable: paths.some((item) => item.importPath !== null),
      paths,
    });
  }

  const jsAssets = walkFiles(path.join(resolvedRoot, 'dist', 'assets')).filter((file) => file.endsWith('.js'));
  const bundleHits = jsAssets.map((file) => {
    const source = fs.readFileSync(file, 'utf8');
    return {
      file: relative(path.join(resolvedRoot, 'dist'), file),
      bytes: Buffer.byteLength(source),
      markers: MARKERS.filter((marker) => source.includes(marker)),
    };
  }).filter((item) => item.markers.length);

  return {
    schemaVersion: 1,
    sourceFileCount: sourceFiles.length,
    reachableSourceFileCount: new Set(entrypoints.flatMap((entrypoint) => {
      const found = new Set([entrypoint]);
      const queue = [entrypoint];
      while (queue.length) {
        for (const child of graph.get(queue.shift()) ?? []) {
          if (!found.has(child)) { found.add(child); queue.push(child); }
        }
      }
      return [...found];
    })).size,
    entrypoints: entrypoints.map((file) => relative(srcRoot, file)),
    suspiciousSourceModules: sourceHits,
    suspiciousBundleAssets: bundleHits,
    unresolvedLocalImports: unresolved,
    status: bundleHits.length === 0 && !sourceHits.some((item) => item.reachable) ? 'CLEAN' : 'FOLLOW_UP_REQUIRED',
  };
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v6-bundle-audit-'));
  try {
    const src = path.join(root, 'src');
    fs.mkdirSync(path.join(src, 'public'), { recursive: true });
    fs.mkdirSync(path.join(src, 'modules'), { recursive: true });
    fs.mkdirSync(path.join(root, 'dist', 'assets'), { recursive: true });
    fs.writeFileSync(path.join(src, 'main.tsx'), "import './public/App';\n");
    fs.writeFileSync(path.join(src, 'public', 'App.tsx'), "import '../modules/AdminWallet';\n");
    fs.writeFileSync(path.join(src, 'modules', 'AdminWallet.ts'), "export const fixture = 'wallet_admin_main';\n");
    fs.writeFileSync(path.join(root, 'dist', 'assets', 'index.js'), "const id='wallet_admin_main';");
    const result = inspectV6PublicBundle(root);
    assert.equal(result.status, 'FOLLOW_UP_REQUIRED');
    assert.equal(result.suspiciousSourceModules.length, 1);
    assert.equal(result.suspiciousSourceModules[0].reachable, true);
    assert.deepEqual(result.suspiciousSourceModules[0].paths[0].importPath, [
      'main.tsx', 'public/App.tsx', 'modules/AdminWallet.ts',
    ]);
    assert.equal(result.suspiciousBundleAssets.length, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
  console.log('V6_PUBLIC_BUNDLE_MODULE_AUDIT_SELF_TEST=PASS');
}

function main() {
  if (process.argv[2] === '--self-test') return selfTest();
  const root = process.argv[2];
  if (!root) throw new Error('Usage: node audit-v6-public-bundle-modules.mjs <v6-worktree> [--output <json-path>]');
  const report = inspectV6PublicBundle(root);
  const outputIndex = process.argv.indexOf('--output');
  if (outputIndex >= 0) {
    const target = process.argv[outputIndex + 1];
    if (!target) throw new Error('--output requires a path');
    fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(report, null, 2) + '\n');
  }
  console.log('V6_PUBLIC_BUNDLE_MODULE_AUDIT=' + JSON.stringify(report));
}

main();
