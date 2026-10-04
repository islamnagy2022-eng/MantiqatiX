// MantiqatiX canonical sector registry — public contract + backend boundary.
// Keep legacy/internal identifiers unchanged elsewhere; this file defines the canonical mapping.
export const CANONICAL_SECTORS = Object.freeze([
  ['FOOD','مطاعم وكافيهات','FOOD'],
  ['HEALTH','أطباء وعيادات','HEALTH'],
  ['PHARMACY','صيدليات','PHARMACY'],
  ['LABS','معامل تحاليل','LABS'],
  ['RADIOLOGY','مراكز الأشعة','RADIOLOGY'],
  ['DENTAL','أطباء الأسنان','DENTAL'],
  ['HOSPITAL','المستشفيات','HOSPITAL'],
  ['MEDICAL','مراكز طبية','MEDICAL'],
  ['REAL_ESTATE','عقارات','REAL_ESTATE'],
  ['AUTO','سيارات ونقل','AUTO'],
  ['MAINTENANCE','الصيانة والخدمات المنزلية','MAINTENANCE'],
  ['ACCOUNTING','المحاسبة ومكاتب المحاسبة','ACCOUNTING'],
  ['LEGAL','المحاماة والخدمات القانونية','LEGAL'],
  ['COMPANIES','الشركات والموردون','COMPANIES'],
  ['EDU','تعليم وتدريب','EDUCATION'],
  ['DIGITAL','تسويق وإعلان','MARKETING'],
  ['TECH','البرمجيات والخدمات الرقمية','ERP'],
  ['FITNESS','رياضة ولياقة','SPORTS'],
  ['TRAVEL','سياحة وسفر','TRIPS'],
  ['MANTIGO','MantiGO والنقل عند الطلب','MANTIGO'],
  ['JOBS','الوظائف والتوظيف','JOBS'],
  ['MATRIMONY','الزواج والخدمات المرتبطة','MATRIMONY'],
  ['USED_ITEMS','المستعمل','USED_ITEMS'],
  ['FASHION','الأزياء والخياطة','FASHION'],
  ['GROCERY','البقالة والسوبر ماركت','GROCERY'],
  ['VETERINARY','العيادات والخدمات البيطرية','VETERINARY'],
  ['FREELANCER','المستقلون ومقدمو الخدمات','FREELANCER']
].map(([code,label,backend])=>Object.freeze({code,label,backend})));

export const CANONICAL_SECTOR_CODES = Object.freeze(CANONICAL_SECTORS.map(s=>s.code));
export const PUBLIC_TO_BACKEND_SECTOR = Object.freeze(Object.fromEntries(CANONICAL_SECTORS.map(s=>[s.code,s.backend])));
export const BACKEND_TO_PUBLIC_SECTOR = Object.freeze(Object.fromEntries(CANONICAL_SECTORS.map(s=>[s.backend,s.code])));
