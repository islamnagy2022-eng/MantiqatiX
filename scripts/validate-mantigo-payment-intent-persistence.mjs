#!/usr/bin/env node
import fs from 'node:fs';

const sourcePath = 'supabase/functions/mantigo-payment-intent/index.ts';
const source = fs.readFileSync(sourcePath, 'utf8');
const checks = [
  ['reuses only a complete persisted Paymob intent', /ledger\.provider==="PAYMOB"&&ledger\.provider_intent_id&&metadata\.paymob_client_secret/],
  ['fails closed for incomplete PENDING intent before provider request', /PAYMENT_INTENT_STATE_REQUIRES_RECONCILIATION[\s\S]*?https:\/\/accept\.paymob\.com\/v1\/intention/],
  ['rejects partial provider state before provider request', /PAYMENT_INTENT_STATE_INCONSISTENT[\s\S]*?https:\/\/accept\.paymob\.com\/v1\/intention/],
  ['conditional persistence checks current REQUIRED state', /\.eq\("payment_status","REQUIRED"\)/],
  ['conditional persistence preserves null provider state', /\.is\("provider",null\)/],
  ['conditional persistence prevents overwrite of existing provider intent', /\.is\("provider_intent_id",null\)/],
  ['persistence returns selected row identity', /\.select\("id"\)/],
  ['persistence requires exactly one updated row before success', /if\(!updatedRows\|\|updatedRows\.length!==1\)[\s\S]*?PAYMENT_INTENT_STATE_CHANGED/],
  ['database update errors fail closed', /if\(updateError\)[\s\S]*?PAYMENT_INTENT_PERSISTENCE_FAILED/],
  ['checkout secret response occurs after row-count check', /PAYMENT_INTENT_STATE_CHANGED[\s\S]*?return json\(\{id:ledger\.id,provider:"PAYMOB",status:"PENDING",amount,currency,clientSecret/],
  ['ambiguous reconciliation marker blocks later intention creation', /paymob_intent_reconciliation_required===true[\\s\\S]*?https:\\/\\/accept\\.paymob\\.com\\/v1\\/intention/],
  ['network exception is quarantined for reconciliation', /markReconciliationRequired\\("NETWORK_OUTCOME_AMBIGUOUS"\\)[\\s\\S]*?PAYMENT_INTENT_REQUIRES_PROVIDER_RECONCILIATION/],
  ['provider 5xx and incomplete success response are quarantined', /providerResponse\\.status>=500[\\s\\S]*?markReconciliationRequired[\\s\\S]*?PROVIDER_RESPONSE_INCOMPLETE/],
  ['reconciliation marker persistence is conditional and row-count checked', /markReconciliationRequired[\\s\\S]*?\\.eq\\("payment_status","REQUIRED"\\)[\\s\\S]*?\\.select\\("id"\\)[\\s\\S]*?markedRows\\.length!==1/],
];
for (const [label, pattern] of checks) {
  if (!pattern.test(source)) throw new Error('MantiGO payment-intent persistence contract missing: ' + label);
}

const providerRequest = source.indexOf('fetch("https://accept.paymob.com/v1/intention/"');
const pendingGuard = source.indexOf('PAYMENT_INTENT_STATE_REQUIRES_RECONCILIATION');
const partialStateGuard = source.indexOf('PAYMENT_INTENT_STATE_INCONSISTENT');
const persistenceUpdate = source.indexOf('const {data:updatedRows,error:updateError}');
const zeroRowGuard = source.indexOf('if(!updatedRows||updatedRows.length!==1)');
const successResponse = source.lastIndexOf('return json({id:ledger.id,provider:"PAYMOB",status:"PENDING",amount,currency,clientSecret');
if (providerRequest < 0 || pendingGuard < 0 || partialStateGuard < 0 ||
    pendingGuard >= providerRequest || partialStateGuard >= providerRequest) {
  throw new Error('MantiGO payment-intent state guards must execute before the Paymob request');
}
if (persistenceUpdate < 0 || zeroRowGuard < persistenceUpdate ||
    successResponse < zeroRowGuard) {
  throw new Error('MantiGO checkout credentials must only be returned after confirmed persistence');
}
const reconcileMarker = source.indexOf('const markReconciliationRequired=');
const networkAmbiguity = source.indexOf('markReconciliationRequired("NETWORK_OUTCOME_AMBIGUOUS")');
if (reconcileMarker < 0 || networkAmbiguity < providerRequest ||
    source.indexOf('paymob_intent_reconciliation_required===true') > providerRequest) {
  throw new Error('Ambiguous Paymob outcomes must be quarantined and future creation blocked');
}
console.log('MantiGO payment-intent persistence source contract: PASS (' + checks.length + '/' + checks.length + ' patterns + 3 order checks)');
console.log('Scope: source contract only; not a live Paymob, concurrency, or production test.');
