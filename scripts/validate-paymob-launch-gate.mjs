import fs from 'node:fs';
import assert from 'node:assert/strict';

const sources = {
  order: fs.readFileSync('supabase/functions/payment-intent/index.ts', 'utf8'),
  digital: fs.readFileSync('supabase/functions/digital-page-payment-intent/index.ts', 'utf8'),
  mantigo: fs.readFileSync('supabase/functions/mantigo-payment-intent/index.ts', 'utf8'),
  subscription: fs.readFileSync('supabase/functions/subscription-payment-intent/index.ts', 'utf8'),
  app: fs.readFileSync('web/app.js', 'utf8'),
  home: fs.readFileSync('web/home.js', 'utf8'),
  operations: fs.readFileSync('web/operations-modules.js', 'utf8')
};

for (const [name, source] of Object.entries({
  digital: sources.digital,
  subscription: sources.subscription
})) {
  assert.match(source, /const PAYMOB_CHECKOUT_ENABLED\\s*=\\s*false/, name + ': catalog/subscription checkout must remain disabled for first launch');
  assert.match(source, /PAYMOB_CHECKOUT_UNDER_CONSTRUCTION/, name + ': disabled checkout must fail closed with a clear status');
  const gate = source.indexOf('PAYMOB_CHECKOUT_UNDER_CONSTRUCTION');
  const firstProviderCall = [
    source.indexOf('claim_digital_page_payment_intent_backend'),
    source.indexOf('create_subscription_payment_intent_claimable_backend'),
    source.indexOf('https://accept.paymob.com/v1/intention/')
  ].filter(i => i >= 0).sort((a,b)=>a-b)[0];
  assert.ok(firstProviderCall === undefined || gate < firstProviderCall, name + ': gate must run before database/provider intent creation');
}

for (const [name, source] of Object.entries({ order: sources.order, mantigo: sources.mantigo })) {
  assert.doesNotMatch(source, /PAYMOB_CHECKOUT_ENABLED|PAYMOB_CHECKOUT_UNDER_CONSTRUCTION/, name + ': existing payment flow must not be globally disabled by catalog launch policy');
}

assert.doesNotMatch(sources.app, /sb\.functions\.invoke\(['"]digital-page-payment-intent['"]/, 'browser account flow must not invoke digital-page Paymob checkout');
assert.doesNotMatch(sources.home, /\/functions\/v1\/mantigo-payment-intent/, 'public MantiGO UI must not call the Paymob intent endpoint');
assert.doesNotMatch(sources.operations, /\/functions\/v1\/mantigo-payment-intent/, 'operations module must not call the Paymob intent endpoint');
assert.match(sources.home, /الدفع الإلكتروني — تحت الإنشاء/, 'MantiGO card payment must be labeled under construction');
assert.match(sources.operations, /الدفع الإلكتروني — تحت الإنشاء/, 'operations card payment must be labeled under construction');
console.log('Paymob first-launch fail-closed contract: PASS');
