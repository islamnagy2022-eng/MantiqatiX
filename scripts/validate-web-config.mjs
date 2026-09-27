import fs from 'node:fs';

const file='web/config.js';
const text=fs.readFileSync(file,'utf8');

if(/DISCONNECTED|blockedQuery|فصل التطبيق عن مصدر البيانات/.test(text)){
  throw new Error('Production web config is disconnected or contains the disabled-data stub.');
}

const urlMatch=text.match(/supabaseUrl\s*:\s*['"]([^'"]+)['"]/);
const keyMatch=text.match(/supabaseKey\s*:\s*['"]([^'"]+)['"]/);

if(!urlMatch || urlMatch[1] !== 'https://moyhiluyhjsujhwlyeuu.supabase.co'){
  throw new Error('Production Supabase URL is missing or does not match the approved project.');
}

if(!keyMatch || !keyMatch[1] || !/^(sb_publishable_[A-Za-z0-9_-]+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.test(keyMatch[1])){
  throw new Error('Production Supabase client key is missing or has an invalid public-key format.');
}

if(!/MNTY_DATA_SOURCE\s*=\s*['"]WEBSITE_SUPABASE['"]/.test(text)){
  throw new Error('Production data source marker is not WEBSITE_SUPABASE.');
}

console.log('Production web config: PASS (approved Supabase endpoint, public client key format, connected data-source marker)');
