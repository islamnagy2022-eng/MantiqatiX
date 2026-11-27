import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const directory = readFileSync("apps/catalog-frontend/src/components/DirectoryView.tsx", "utf8");
const admin = readFileSync("apps/catalog-frontend/src/components/admin/DirectoryListingsAdmin.tsx", "utf8");
const workflow = readFileSync(".github/workflows/pages.yml", "utf8");

// Menoufia is a normal geographic filter, not a separate catalog or special intake template.
assert.match(directory, /availableCategories\.map\(\(category\)/, "Use the platform's existing activity taxonomy");
assert.match(directory, /filteredBusinesses\.filter\(\(business\) => categoryForBusiness\(business\)\?\.id === category\.id\)/, "Category counts must respect the active geographic filter");
assert.match(directory, /filteredUnconfirmedListings\.filter\(\(listing\) => listing\.taxonomy_category_id === category\.id\)/, "Unverified listing counts must respect the active geographic filter");
assert.match(directory, /!business\.isVerified/, "Existing unverified businesses remain counted in their current sections");
assert.match(directory, /غير موثق/, "Unverified entries retain their visible status label");
assert.doesNotMatch(directory, /كتالوج المنوفية|كتالوج محافظة المنوفية|menoufia-directory-scope/, "Do not create a separate Menoufia catalog entry point");
assert.doesNotMatch(admin, /menoufia-activity-intake-template|تحديد محافظة المنوفية/, "Do not expose a Menoufia-specific intake catalog or preset");
assert.match(admin, /categories\.filter\(\(item\) => item\.functionalGroupId === form\.functionalGroupId\)/, "Admin intake must use existing functional groups and activity categories");
assert.match(workflow, /validate-existing-sections-unverified-directory\.mjs/, "CI must run the existing-sections behavior validator");
assert.doesNotMatch(workflow, /validate-menoufia-activity-(catalog|intake-template)/, "CI must not require separate Menoufia catalog/template validators");

console.log("Existing-section directory and unverified-status contract passed.");
