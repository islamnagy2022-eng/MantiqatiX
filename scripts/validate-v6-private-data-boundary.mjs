import fs from "node:fs";
import path from "node:path";

const candidateRoot = path.resolve(process.argv[2] || "apps/catalog-frontend");
const ignorePath = path.join(candidateRoot, ".gitignore");
const failures = [];

if (!fs.existsSync(ignorePath)) {
  failures.push("candidate .gitignore is missing");
} else {
  const rules = fs.readFileSync(ignorePath, "utf8").split(/\r?\n/).map((line) => line.trim());
  for (const required of [".data/", "node_modules/", "dist/"]) {
    if (!rules.includes(required)) failures.push(`.gitignore must contain the exact rule: ${required}`);
  }
  if (!rules.includes(".env*") && !(rules.includes(".env") && rules.includes(".env.*"))) {
    failures.push(".gitignore must exclude environment files with .env* or both .env and .env.*");
  }
}

for (const outputDir of ["public", "dist", "build"]) {
  const root = path.join(candidateRoot, outputDir);
  if (!fs.existsSync(root)) continue;
  const stack = [root];
  while (stack.length) {
    const current = stack.pop();
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (/production-live-db\.json$/i.test(entry.name)) {
        failures.push(`private production snapshot found inside public/build output: ${path.relative(candidateRoot, full)}`);
      }
    }
  }
}

const privateSnapshot = path.join(candidateRoot, ".data", "production-live-db.json");
if (fs.existsSync(privateSnapshot)) {
  console.log("PRIVATE_SNAPSHOT_PRESENT=YES; it must remain local and ignored, never copied to Git or build output.");
}

if (failures.length) {
  console.error("V6_PRIVATE_DATA_BOUNDARY=FAIL");
  for (const failure of failures) console.error("- " + failure);
  process.exit(1);
}

console.log("V6_PRIVATE_DATA_BOUNDARY=PASS");
console.log("Candidate ignore rules and public/build output boundary are valid.");
