import fs from "node:fs";
const operations=fs.readFileSync("web/operations-modules.js","utf8");
const forbidden=["sb.from('education_requests').insert","sb.from('education_requests').update","sb.from('education_requests').delete"];
const failures=forbidden.filter(x=>operations.includes(x));
if(failures.length){console.error("Sensitive module write boundary FAILED:",failures.join(", "));process.exit(1);}
if(!operations.includes("sb.rpc('create_education_request_backend'")){console.error("Education backend RPC boundary missing");process.exit(1);}
console.log("Sensitive module write boundary PASS");
