import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/components/SupportAssistant.tsx', import.meta.url), 'utf8');

test('AI support uses the authenticated server-side Gemini proxy, never a browser API key', () => {
  assert.match(source, /supabase\.functions\.invoke\('ai-gemini-proxy'/);
  assert.match(source, /action:\s*'assistant'/);
  assert.match(source, /authSession\.isAuthenticated/);
  assert.doesNotMatch(source, /GEMINI_API_KEY|AIza[0-9A-Za-z_-]{20,}/);
});

test('AI support bounds user input and warns against sending secrets', () => {
  assert.match(source, /MAX_QUESTION_LENGTH\s*=\s*1200/);
  assert.match(source, /maxLength=\{MAX_QUESTION_LENGTH\}/);
  assert.match(source, /لا ترسل كلمة المرور أو رمز التحقق أو بيانات البطاقة أو مفاتيح API/);
});

test('AI support does not claim to persist tickets or execute privileged actions', () => {
  assert.doesNotMatch(source, /SUPABASE_SERVICE_ROLE_KEY|service_role|payment_intent|updateBusiness\(/);
  assert.match(source, /لا يستطيع المساعد تنفيذ عمليات مالية أو تعديل صلاحيات الحساب/);
});
