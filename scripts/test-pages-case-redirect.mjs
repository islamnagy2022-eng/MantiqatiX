import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../apps/catalog-frontend/public/404.html', import.meta.url), 'utf8');
const script = html.match(/<script>([\\s\\S]*?)<\\/script>/i)?.[1];
assert.ok(script, '404.html must include its redirect handler');

function redirectedPath(input) {
  let destination = null;
  const location = {
    href: input,
    replace(value) { destination = value; },
  };
  vm.runInNewContext(script, { window: { location }, URL });
  assert.ok(destination, `expected redirect for ${input}`);
  const resolved = new URL(destination, input);
  return resolved.pathname + resolved.search + resolved.hash;
}

assert.equal(redirectedPath('https://islamnagy2022-eng.github.io/mantiqatix/ABC?store=1#top'), '/MantiqatiX/abc?store=1#top');
assert.equal(redirectedPath('https://islamnagy2022-eng.github.io/MANTIQATIX/'), '/MantiqatiX/');
assert.equal(redirectedPath('https://islamnagy2022-eng.github.io/elsewhere/'), '/MantiqatiX/');
console.log('Pages case-redirect tests passed (3/3)');
