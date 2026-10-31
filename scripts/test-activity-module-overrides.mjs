import assert from 'node:assert/strict';
import { sanitizeActivityModuleOverrides } from '../supabase/functions/_shared/activity-module-overrides.mjs';

const valid = {
  cat_medical_health_pharmacies: {
    marketing: {
      objective: 'زيادة الوعي بالصيدلية',
      audience: 'السكان القريبون',
      positioning: 'خدمة واضحة ومعلومات دقيقة',
      contentPillars: ['الخدمات المتاحة', 'مواعيد العمل'],
      campaignIdeas: ['تعريف بخدمة التوصيل'],
      requiredAssets: ['رقم اتصال صحيح'],
      ignoredField: 'must not persist',
    },
    capabilities: [
      { id: 'pharmacy-products', title: 'الأدوية والمستلزمات', description: 'عرض الأصناف المتاحة', state: 'available' },
      { id: 'pharmacy-hours', title: 'المناوبات وساعات العمل', description: 'تحديث مواعيد العمل' },
      { id: 'pharmacy-delivery', title: 'طلبات التوصيل', description: 'تنظيم طلبات التوصيل' },
    ],
    ignoredField: true,
  },
};

const sanitized = sanitizeActivityModuleOverrides(valid);
assert.equal(Object.keys(sanitized).length, 1);
assert.equal(sanitized.cat_medical_health_pharmacies.marketing.ignoredField, undefined);
assert.equal(sanitized.cat_medical_health_pharmacies.ignoredField, undefined);
assert.equal(sanitized.cat_medical_health_pharmacies.capabilities[0].state, undefined);
assert.equal(sanitized.cat_medical_health_pharmacies.capabilities.length, 3);
assert.deepEqual(sanitizeActivityModuleOverrides({}), {});

assert.throws(() => sanitizeActivityModuleOverrides(null), /INVALID_ACTIVITY_MODULE_OVERRIDES/);
assert.throws(() => sanitizeActivityModuleOverrides([]), /INVALID_ACTIVITY_MODULE_OVERRIDES/);
assert.throws(() => sanitizeActivityModuleOverrides({ invalid_id: valid.cat_medical_health_pharmacies }), /INVALID_ACTIVITY_MODULE_OVERRIDES/);
assert.throws(() => sanitizeActivityModuleOverrides({ cat_medical_health_pharmacies: { marketing: {} } }), /INVALID_ACTIVITY_MODULE_OVERRIDES/);
assert.throws(() => sanitizeActivityModuleOverrides({ cat_medical_health_pharmacies: { marketing: { objective: 'x'.repeat(501) } } }), /INVALID_ACTIVITY_MODULE_OVERRIDES/);
assert.throws(() => sanitizeActivityModuleOverrides({ cat_medical_health_pharmacies: { marketing: { contentPillars: Array.from({ length: 11 }, () => 'محور') } } }), /INVALID_ACTIVITY_MODULE_OVERRIDES/);
assert.throws(() => sanitizeActivityModuleOverrides({ cat_medical_health_pharmacies: { capabilities: valid.cat_medical_health_pharmacies.capabilities.slice(0, 2) } }), /INVALID_ACTIVITY_MODULE_OVERRIDES/);
assert.throws(() => sanitizeActivityModuleOverrides({
  cat_medical_health_pharmacies: {
    capabilities: [
      { id: 'duplicate', title: 'واحد', description: 'وصف' },
      { id: 'duplicate', title: 'اثنان', description: 'وصف' },
      { id: 'three', title: 'ثلاثة', description: 'وصف' },
    ],
  },
}), /INVALID_ACTIVITY_MODULE_OVERRIDES/);

const tooMany = Object.fromEntries(Array.from({ length: 51 }, (_, index) => [
  `cat_test_activity_${index}`,
  { marketing: { objective: 'هدف' } },
]));
assert.throws(() => sanitizeActivityModuleOverrides(tooMany), /INVALID_ACTIVITY_MODULE_OVERRIDES/);

const tooLarge = Object.fromEntries(Array.from({ length: 50 }, (_, index) => [
  `cat_test_activity_${index}`,
  {
    marketing: {
      objective: 'ا'.repeat(500),
      audience: 'ب'.repeat(500),
      positioning: 'ج'.repeat(500),
      contentPillars: Array.from({ length: 10 }, () => 'د'.repeat(180)),
      campaignIdeas: Array.from({ length: 10 }, () => 'هـ'.repeat(180)),
      requiredAssets: Array.from({ length: 10 }, () => 'و'.repeat(180)),
    },
  },
]));
assert.throws(() => sanitizeActivityModuleOverrides(tooLarge), /INVALID_ACTIVITY_MODULE_OVERRIDES/);

console.log('Activity module override sanitizer tests: PASS');
