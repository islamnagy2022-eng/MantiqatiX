import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve('web');
const htmlFiles=['index.html','smm.html'];
const refs=new Set();

for(const file of htmlFiles){
  const html=fs.readFileSync(path.join(root,file),'utf8');
  for(const m of html.matchAll(/(?:src|href)\s*=\s*["']([^"'#?]+)(?:[?#][^"']*)?["']/gi)){
    const ref=m[1];
    if(/^(?:https?:|mailto:|tel:|data:|javascript:)/i.test(ref)) continue;
    refs.add(ref);
  }
}

const missing=[];
for(const ref of refs){
  const normalized=path.normalize(ref.replace(/^\.\//,''));
  const target=path.resolve(root,normalized);
  if(!target.startsWith(root+path.sep) && target!==root){ missing.push(ref); continue; }
  if(!fs.existsSync(target)) missing.push(ref);
}
if(missing.length){console.error('Missing local web assets:',missing);process.exit(1);}
console.log(`Web asset smoke: PASS (${refs.size} local references checked)`);