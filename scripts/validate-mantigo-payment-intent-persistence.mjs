#!/usr/bin/env node
import fs from 'node:fs';

const sourcePath = 'supabase/functions/mantigo-payment-intent/index.ts';
const source = fs.readFileSync(sourcePath, 'utf8');
const checks = [
  ['reuses only a complete persisted Paymob intent', /ledger\.provider==="PAYMOB"&&ledger\.provider_intent_id&&metadata\.paymob_client_secret/],
  ['fails closed for incomplete PENDING intent before provider request', /PAYMENT_INTENT_STATE_REQUIRES_RECONCILIATION[\s\S]*?https:\/\/accept\.paymob\.com\/v1\/intention/],
  ['rejects partial provider state before provider request', /PAYMENT_INTENT_STATE_INCONSISTENT[\s\S]*?https:\/\/accept\.paymob\.com\/v1\/intention/],
  ['conditional persistence checks current REQUIRED state', /\.eq\("payment_status","REQUIRED"\)/],
  ['conditional persistence prevents overwrite of existing provider intent', /\.is\("provider_intent_id",null\)/],
  ['persistence returns selected row identity', /\.select\("id"\)/],
  ['persistence requires exactly one updated row before success', /if\(!updatedRows\|\|updatedRows\.length!==1\)[\s\S]*?PAYMENT_INTENT_STATE_CHANGED/],
  ['database update errors fail closed', /if\(updateError\)[\s\S]*?PAYMENT_INTENT_PERSISTENCE_FAILED/],
  ['checkout secret response occurs after row-count check', /PAYMENT_INTENT_STATE_CHANGED[\s\S]*?return json\(\{id:ledger\.id,provider:"PAYMOB",status:"PENDING",amount,currency,clientSecret/],
];
for (const [label, pattern] of checks) {
  if (!pattern.test(source)) throw new Error('MantiGO payment-intent persistence contract missing: ' + label);
}
console.log('MantiGO payment-intent persistence source contract: PASS (' + checks.length + '/' + checks.length + ')');
console.log('Scope: source contract only; not a live Paymob, concurrency, or production test.');
