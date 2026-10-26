import fs from 'node:fs';

const html = fs.readFileSync('web/demo/index.html', 'utf8');
const js = fs.readFileSync('web/demo/demo.js', 'utf8');
const css = fs.readFileSync('web/demo/demo.css', 'utf8');

const required = [
  ['standalone HTML entrypoint', html.includes('<title>MantiqatiX | نسخة DEMO معزولة</title>')],
  ['local-only CSS and JavaScript entrypoints', html.includes('href="demo.css?v=demo-20261026"') && html.includes('src="demo.js?v=demo-20261026"')],
  ['no production config import', !/(?:src|href)=["'][^"']*(?:config\.js|\/app\.js|\/home\.js|supabase\.js)/i.test(html)],
  ['local storage namespace is unique', js.includes("'MANTIQATIX_DEMO_DB_V1'") && js.includes("'MANTIQATIX_DEMO_SESSION_V1'")],
  ['four-sector scope only', ["FOOD", "PHARMACY", "DOCTOR", "STORE"].every(x => js.includes(x)) && !/^\s{4}[A-Z_]+:\s*\{\s*label:/m.test(js.replace(/^\s{4}(FOOD|PHARMACY|DOCTOR|STORE):/gm, ''))],
  ['account creation is local', js.includes('function register(form)') && js.includes('db.users.push(user)') && js.includes('localStorage')],
  ['activity creation assigns an owner membership', js.includes('function createBusiness(form)') && js.includes("role: 'OWNER'")],
  ['catalog price and stock edits exist', js.includes('function createProduct(form)') && js.includes('function updateProduct(form)')],
  ['order and booking lifecycle is implemented', js.includes('function placeOrder(') && js.includes('appointmentDate') && js.includes('ALLOWED_TRANSITIONS')],
  ['role checks for catalog, orders, and team', js.includes('function canManageCatalog(') && js.includes('function canUpdateOrders(') && js.includes('function canManageTeam(')],
  ['payments are marked demo-only', js.includes("paymentMode: 'DEMO_ONLY'") && js.includes('لا يوجد دفع حقيقي')],
  ['reset only clears demo namespace/session', js.includes('function resetDemo()') && js.includes('localStorage.removeItem(SESSION_KEY)')],
  ['no network APIs or remote provider endpoints', !/\b(fetch|XMLHttpRequest|WebSocket|EventSource)\s*\(/.test(js) && !/https?:\/\/[^'"\s]+/.test(js)],
  ['styles are self-contained', css.includes('.safety-banner') && css.includes('.workspace-grid') && css.includes('@media(max-width:850px)')]
];

const failed = required.filter(([, ok]) => !ok).map(([name]) => name);
if (failed.length) {
  console.error('DEMO isolation validation FAILED');
  failed.forEach(name => console.error('- ' + name));
  process.exit(1);
}
console.log('DEMO isolation validation PASS (' + required.length + ' assertions).');
console.log('Scope: restaurants, pharmacies, doctors/clinics, stores only.');
console.log('Data boundary: browser localStorage only; no Supabase or production configuration.');
console.log('Limit: this validates a local workflow simulator, not server-side Auth/RLS isolation.');
