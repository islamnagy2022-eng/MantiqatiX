import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('web');
const forbidden=[
  /service_role/i,
  /sb_secret_[A-Za-z0-9_-]+/i,
  /sk_live_[A-Za-z0-9_-]+/i,
  /sk_test_[A-Za-z0-9_-]+/i,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i,
  /AKIA[0-9A-Z]{16}/,
  /ghp_[A-Za-z0-9]{20,}/
];

const files=[];
function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory()) walk(full);
    else files.push(full);
  }
}
walk(root);

const hits=[];
for(const file of files){
  const text=fs.readFileSync(file,'utf8');
  for(const pattern of forbidden){
    if(pattern.test(text)) hits.push({file:path.relative(process.cwd(),file),pattern:String(pattern)});
  }
}
if(hits.length){
  console.error('Potential public-web secret markers detected:');
  for(const hit of hits) console.error('-',hit.file,hit.pattern);
  process.exit(1);
}
console.log(`Public web secret scan: PASS (${files.length} files checked)`);
