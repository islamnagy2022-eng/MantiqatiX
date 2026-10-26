import fs from 'node:fs';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync('web/demo/connected.html', 'utf8');
const source = fs.readFileSync('web/demo/connected.js', 'utf8');
const dom = new JSDOM(html, {
  url: 'https://islamnagy2022-eng.github.io/MantiqatiX/demo/connected.html',
  runScripts: 'outside-only',
  pretendToBeVisual: true
});
const { window } = dom;
const calls = { signup: null, login: null };
window.MANTIQATIX_DEMO_CONFIG = {
  supabaseUrl: 'https://lkijdgqanbqjudiducjt.supabase.co',
  supabaseKey: 'sb_publishable_demo_test_key',
  tenantId: 'MNTY-PLATFORM',
  organizationId: 'MNTY-MAIN',
  environment: 'DEMO',
  paymentsEnabled: false
};
window.supabase = {
  createClient(url, key, options) {
    assert.match(url, /lkijdgqanbqjudiducjt/);
    assert.equal(options.auth.persistSession, true);
    return {
      auth: {
        async getSession() { return { data: { session: null }, error: null }; },
        async signUp(args) {
          calls.signup = args;
          return { data: { user: { id: 'test-user', email: args.email }, session: null }, error: null };
        },
        async signInWithPassword(args) {
          calls.login = args;
          return { data: { user: null, session: null }, error: { message: 'INVALID_CREDENTIALS_TEST' } };
        },
        async signOut() { return { error: null }; }
      },
      functions: { async invoke() { throw new Error('No server function should be called before successful login.'); } },
      from() { throw new Error('No database query should run before successful login.'); }
    };
  }
};
window.eval(source);
await new Promise(resolve => window.setTimeout(resolve, 25));
assert.ok(window.document.querySelector('#auth-form'), 'password login form renders');
assert.ok(window.document.querySelector('#auth-email'), 'email username field renders');
assert.ok(window.document.querySelector('#auth-password'), 'password field renders');
assert.ok(!window.document.querySelector('#google-auth'), 'DEMO login does not depend on Google OAuth');
window.document.querySelector('[data-action="auth-mode"][data-mode="signup"]').click();
await new Promise(resolve => window.setTimeout(resolve, 5));
assert.equal(window.document.querySelector('#auth-form').dataset.mode, 'signup');
window.document.querySelector('#auth-name').value = 'Demo Test Owner';
window.document.querySelector('#auth-email').value = 'test-owner@example.com';
window.document.querySelector('#auth-password').value = 'DemoPass123!';
window.document.querySelector('#auth-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await new Promise(resolve => window.setTimeout(resolve, 25));
assert.equal(calls.signup.email, 'test-owner@example.com');
assert.equal(calls.signup.password, 'DemoPass123!');
assert.equal(calls.signup.options.data.full_name, 'Demo Test Owner');
assert.match(window.document.querySelector('#app').textContent, /تم إنشاء الحساب/);
window.document.querySelector('#auth-email').value = 'test-owner@example.com';
window.document.querySelector('#auth-password').value = 'WrongPass123!';
window.document.querySelector('#auth-form').dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
await new Promise(resolve => window.setTimeout(resolve, 25));
assert.equal(calls.login.email, 'test-owner@example.com');
assert.equal(calls.login.password, 'WrongPass123!');
assert.match(window.document.querySelector('#app').textContent, /INVALID_CREDENTIALS_TEST/);
window.close();
console.log('Connected DEMO password-auth tests PASS: signup request, email confirmation messaging, password sign-in, and no Google dependency.');
