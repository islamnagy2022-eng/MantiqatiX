import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../apps/catalog-frontend/public/404.html', import.meta.url), 'utf8');
const scriptStart = html.indexOf('<script>');
const scriptEnd = html.indexOf('</script>', scriptStart);
const script = scriptStart >= 0 && scriptEnd > scriptStart
  ? html.slice(scriptStart + '<script>'.length, scriptEnd)
  : null;
assert.ok(script, '404.html must include its redirect handler');

function redirectDestination(input) {
  let destination = null;
  const location = {
    href: input,
    replace(value) { destination = value; },
  };
  vm.runInNewContext(script, { window: { location }, URL });
  return destination;
}

function redirectedPath(input) {
  const destination = redirectDestination(input);
  assert.ok(destination, `expected redirect for ${input}`);
  const resolved = new URL(destination, input);
  return resolved.pathname + resolved.search + resolved.hash;
}

assert.equal(
  redirectedPath('https://islamnagy2022-eng.github.io/mantiqatix/ABC?store=1#top'),
  '/MantiqatiX/abc?store=1#top',
  'mixed-case repository and nested segments must normalize without losing query/hash',
);
assert.equal(
  redirectedPath('https://islamnagy2022-eng.github.io/MANTIQATIX/'),
  '/MantiqatiX/',
  'uppercase repository path must normalize to the canonical Pages base',
);
assert.equal(
  redirectedPath('https://islamnagy2022-eng.github.io/elsewhere/?activity=cat_medical_health_medical_practices#specialty'),
  '/MantiqatiX/?activity=cat_medical_health_medical_practices#specialty',
  'unknown paths must fall back without dropping a direct activity route or hash',
);
assert.equal(
  redirectedPath('https://islamnagy2022-eng.github.io/MantiqatiX/unknown/?store=demo#item'),
  '/MantiqatiX/?store=demo#item',
  'already-normalized unknown nested routes must fall back without dropping query/hash',
);
assert.equal(
  redirectDestination('https://islamnagy2022-eng.github.io/MantiqatiX/'),
  null,
  'the canonical base route must not redirect to itself',
);
console.log('Pages case-redirect tests passed (5/5)');
