import fs from 'node:fs';

const source = fs.readFileSync('apps/catalog-frontend/src/components/merchant/MerchantDashboard.tsx', 'utf8');
const start = source.indexOf('const handleProductSubmit = async');
const end = source.indexOf('const isFrozen =', start);
if (start < 0 || end <= start) throw new Error('Product submit handler missing.');
const submit = source.slice(start, end);

for (const [pattern, label] of [
  [/useState<number>\(50\)/, 'product price must not start at a fabricated 50 EGP'],
  [/setFormPrice\(50\)/, 'opening the add-product form must not prefill a price'],
  [/parseFloat\(e\.target\.value\)\s*\|\|\s*0/, 'blank price input must not silently become zero'],
]) {
  if (pattern.test(source)) throw new Error('FAIL: ' + label);
}
if (!/const \[formPrice, setFormPrice\] = useState<string>\(''\)/.test(source) ||
    !/setFormPrice\(''\)/.test(source) ||
    !/setFormPrice\(String\(p\.price\)\)/.test(source)) {
  throw new Error('FAIL: add-product price must start empty while edit-product keeps its saved price.');
}
if (!/const priceValue = formPrice\.trim\(\) === '' \? Number\.NaN : Number\(formPrice\)/.test(submit) ||
    !/!Number\.isFinite\(priceValue\) \|\| priceValue < 0/.test(submit)) {
  throw new Error('FAIL: product save must reject empty, invalid, and negative prices.');
}
if ((submit.match(/price: priceValue,/g) || []).length !== 2) {
  throw new Error('FAIL: both product create and edit paths must use the validated numeric price.');
}
if (!/value=\{formPrice\}[\s\S]{0,100}onChange=\{\(e\) => setFormPrice\(e\.target\.value\)\}/.test(source)) {
  throw new Error('FAIL: the product price input must preserve a blank value until the owner enters it.');
}
if (!/أدخل السعر الحقيقي للمنتج أو الخدمة بالجنيه المصري/.test(submit)) {
  throw new Error('FAIL: missing helpful feedback for invalid or absent price.');
}

console.log('Real product price input contract: PASS');
