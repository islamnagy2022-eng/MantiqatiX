import fs from "node:fs";
import assert from "node:assert/strict";
const read=(p)=>fs.readFileSync(new URL(p,import.meta.url),"utf8");
const html=read("./index.html"), css=read("./styles.css"), js=read("./app.js"), docs=read("./README.md"), blueprint=read("./SCREEN_BLUEPRINT_AR.md");
for(const [text,marker,label] of [
 [html,'<html lang="ar" dir="rtl">',"Arabic RTL document"],
 [html,'name="robots" content="noindex,nofollow"',"no-index preview"],
 [html,'./styles.css',"stylesheet reference"],
 [html,'./app.js',"application script reference"],
 [html,"MANTYX DEMO","demo identity"],
 [js,'const orders =',"synthetic orders fixture"],
 [js,'const customers =',"synthetic CRM fixture"],
 [js,'const campaigns =',"synthetic SMM fixture"],
 [js,'const sectors =',"synthetic catalog fixture"],
 [js,'function render()',"interactive view renderer"],
 [js,'if(view==="fashion")',"fashion workspace screen"],
 [js,'if(view==="restaurants")',"restaurant workspace screen"],
 [js,'if(view==="medical")',"medical workspace screen"],
 [js,'if(view==="marketing")',"marketing agency workspace screen"],
 [js,'if(view==="registrations")',"registration review screen"],
 [js,'state.statusFilter',"functional status filter"],
 [js,'state.extras.filter',"session-created item list"],
 [html,'data-view="modules"',"module directory navigation"],
 [docs,"no Supabase client","backend isolation documentation"],
 [docs,"SCREEN_BLUEPRINT_AR.md","screen blueprint documentation"],
 [docs,"synthetic","synthetic data policy"],
 [blueprint,"## 2) خريطة الشاشات المستهدفة","screen inventory"],
 [blueprint,"## 4) المتطلبات المشتركة لكل شاشة","cross-screen acceptance contract"],
 [blueprint,"## 5) فجوات إطلاق معروفة","release blockers retained"]
]) assert.ok(text.includes(marker),`Missing ${label}: ${marker}`);
assert.ok(!/supabase\.co|functions\/v1|SUPABASE_SERVICE_ROLE_KEY|PAYMOB_SECRET|service_role/i.test(html+js+css),"Demo must not contain production endpoints or privileged secret markers");
assert.ok(!/fetch\s*\(|createClient\s*\(|localStorage|sessionStorage/i.test(js),"Demo JS must not call APIs or persist data");
assert.ok(html.includes('id="action-dialog"')&&js.includes('$("#action-dialog").showModal()')&&js.includes('$("#dialog-title").textContent'),"Dialog markup and script contract");
assert.ok(css.includes("@media(max-width:560px)"),"Mobile responsive rules required");
console.log("Mantyx demo safety/static contract: PASS");
console.log("Domain workspaces and screen blueprint contract: PASS");
