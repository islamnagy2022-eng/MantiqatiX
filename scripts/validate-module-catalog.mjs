import fs from "node:fs";

const source=fs.readFileSync("web/app.js","utf8");
const expected=[
  ["FASHION","التجارة والأزياء"],
  ["GROCERY","البقالة والسوبر ماركت"],
  ["ACCOUNTING","المزايدات — المحاسبة"],
  ["COMPANIES","المزايدات — الشركات"],
  ["MARKETING","المزايدات — التسويق"],
  ["FACTORIES","المزايدات — المصانع"],
  ["TRIPS","المزايدات — الرحلات"],
  ["MAINTENANCE","المزايدات — الصيانة"],
  ["LEGAL","المزايدات — الخدمات القانونية"],
  ["ERP","المزايدات — البرمجيات ERP"],
  ["MATRIMONY","الزواج"],
  ["JOBS","الوظائف"],
  ["MEDICAL","المنظومة الطبية"],
  ["RESTAURANTS","المطاعم والمطابخ"],
  ["EDUCATION","المدارس والتدريب"],
  ["USED_ITEMS","المستعمل"]
];

const missing=[];
for(const [key,name] of expected){
  if(!source.includes("key:'"+key+"'") || !source.includes("name:'"+name+"'")){
    missing.push(key+" / "+name);
  }
}
if(!source.includes("const domainModules=[")) missing.push("domainModules catalog");
const keyMatches=source.match(/key:'[A-Z0-9_]+'/g)||[];
const uniqueKeys=new Set(keyMatches);
if(expected.some(([key])=>!uniqueKeys.has("key:'"+key+"'"))) missing.push("one or more domain module keys");

if(missing.length){
  console.error("Module catalog validation failed:");
  for(const item of [...new Set(missing)]) console.error("- "+item);
  process.exit(1);
}
console.log("Module catalog validation passed: 16/16 documented domain modules present.");
