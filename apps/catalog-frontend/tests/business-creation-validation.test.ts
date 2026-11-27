import assert from 'node:assert/strict';
import { validateBusinessCreationIdentity } from '../src/lib/businessCreationValidation';

const valid = validateBusinessCreationIdentity({
  name: '  صيدلية النور  ',
  governorate: '  الغربية ',
  markaz: '  طنطا ',
});
assert.deepEqual(valid, {
  ok: true,
  name: 'صيدلية النور',
  governorate: 'الغربية',
  markaz: 'طنطا',
});

assert.deepEqual(
  validateBusinessCreationIdentity({ name: 'م', governorate: 'الغربية', markaz: 'طنطا' }),
  { ok: false, message: 'اكتب اسم النشاط الحقيقي (حرفان على الأقل).' },
);
assert.equal(
  validateBusinessCreationIdentity({ name: '   ', governorate: 'الغربية', markaz: 'طنطا' }).ok,
  false,
);
assert.deepEqual(
  validateBusinessCreationIdentity({ name: '😀', governorate: 'الغربية', markaz: 'طنطا' }),
  { ok: false, message: 'اكتب اسم النشاط الحقيقي (حرفان على الأقل).' },
);
assert.deepEqual(
  validateBusinessCreationIdentity({ name: 'مطعم النيل', governorate: ' ', markaz: 'طنطا' }),
  { ok: false, message: 'حدد المحافظة الفعلية للنشاط.' },
);
assert.deepEqual(
  validateBusinessCreationIdentity({ name: 'مطعم النيل', governorate: 'الغربية', markaz: '\t ' }),
  { ok: false, message: 'حدد المركز أو القسم الفعلي للنشاط.' },
);

// Village and street are deliberately not part of the required identity.
assert.equal(
  validateBusinessCreationIdentity({ name: 'مكتبة الأمل', governorate: 'المنوفية', markaz: 'بركة السبع' }).ok,
  true,
);

console.log('BUSINESS_CREATION_IDENTITY_VALIDATION=PASS');
