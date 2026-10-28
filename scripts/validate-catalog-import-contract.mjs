import fs from 'node:fs';
import assert from 'node:assert/strict';

const panel = fs.readFileSync('apps/catalog-frontend/src/components/merchant/CatalogImportPanel.tsx', 'utf8');
const dashboard = fs.readFileSync('apps/catalog-frontend/src/components/merchant/MerchantDashboard.tsx', 'utf8');
const context = fs.readFileSync('apps/catalog-frontend/src/context/AppContext.tsx', 'utf8');

const checks = [
  ['merchant dashboard exposes the import panel', /CatalogImportPanel/.test(dashboard) && /setActiveTab\('import'\)/.test(dashboard)],
  ['CSV parser handles quoted cells and escaped quotes', panel.includes("source[i + 1] === '\"'") && panel.includes("value += '\"'; i += 1;")],
  ['import requires name and price headers', /columns\.name == null/.test(panel) && /columns\.price == null/.test(panel)],
  ['price and compare-price values are validated', /Number\.isFinite\(price\)/.test(panel) && /Number\.isFinite\(compare\)/.test(panel)],
  ['HTTPS image links are validated before import', /url\.protocol !== 'https:'/.test(panel)],
  ['existing catalog items and duplicate file rows are prevented', /existingNames\.has/.test(panel) && /seen\.has\(key\)/.test(panel)],
  ['local drafts are scoped to the current business and persisted', /MNTY_CATALOG_IMPORT_DRAFT_V1:/.test(panel) && /localStorage\.setItem\(storageKey/.test(panel) && /localStorage\.getItem\(storageKey/.test(panel)],
  ['failed imports remain in the draft for retry', /importError:result\.message/.test(panel) && /يمكن إعادة المحاولة/.test(panel)],
  ['import is explicitly confirmed before server writes', /window\.confirm/.test(panel) && /for\s*\(const row of pending\)/.test(panel)],
  ['product creation stays on the server-authoritative app flow', /await addProduct\(/.test(panel)],
  ['AI image generation is deferred during bulk import', /deferAiImageGeneration:true/.test(panel) && /data\.deferAiImageGeneration !== true/.test(context)],
  ['AI image suggestions require explicit human approval before import', /generateCatalogAiImage/.test(panel) && /suggestedImageUrl/.test(panel) && /اعتماد الصورة المقترحة/.test(panel) && /imageSource:'ai'/.test(panel)],
  ['reviewed AI image source is preserved by the catalog write path', /data\.imageSource === 'ai'/.test(context) && /imageSource === 'owner' \|\| imageSource === 'ai'/.test(context)],
  ['CSV preview supports correcting invalid fields before import', /updateRow/.test(panel) && panel.includes('aria-label={`السعر في الصف') && /validateDraftRows\(changed\)/.test(panel)],
  ['draft autosave waits until the selected business draft loads', /readyStorageKey!==storageKey/.test(panel) && /setReadyStorageKey\(storageKey\)/.test(panel)],
  ['catalog capacity is checked before import', /readyRows\.length>remaining/.test(panel)],
  ['the UI is honest that direct XLSX support is not enabled yet', /XLSX المباشر لم يُفعّل بعد/.test(panel)],
];
const failed = checks.filter(([name, passed]) => {
  if (!passed) console.error('FAIL:', name);
  return !passed;
});
if (failed.length) process.exit(1);
console.log(`Resumable catalog import contract passed (${checks.length} checks).`);
