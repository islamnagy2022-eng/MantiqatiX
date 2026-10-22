/* MantiqatiX shared cart — demo product data only; never store customer or payment details. */
(()=>{'use strict';
const KEY='mantiqatix.demo.cart.v1',MAX_LINES=100;
const safeRead=()=>{try{const v=JSON.parse(sessionStorage.getItem(KEY)||'[]');return Array.isArray(v)?v.filter(x=>x&&typeof x==='object'&&typeof x.id==='string'&&typeof x.name==='string'&&Number.isFinite(x.unit)&&x.unit>=0&&Number.isInteger(x.qty)&&x.qty>0).slice(0,MAX_LINES):[]}catch{return []}};
const safeWrite=items=>{try{sessionStorage.setItem(KEY,JSON.stringify(items.slice(0,MAX_LINES)));return true}catch{return false}};
const clean=x=>({id:String(x.id||crypto.randomUUID()),merchantId:String(x.merchantId||'unknown').slice(0,80),merchantName:String(x.merchantName||'بائع').slice(0,100),module:String(x.module||'products').slice(0,40),name:String(x.name||'منتج').slice(0,140),icon:String(x.icon||'🛍️').slice(0,8),size:String(x.size||'').slice(0,80),extras:Array.isArray(x.extras)?x.extras.slice(0,20).map(v=>String(v).slice(0,80)):[],note:String(x.note||'').slice(0,100),unit:Math.round(Number(x.unit)||0),qty:Math.max(1,Math.min(20,Math.trunc(Number(x.qty)||1)),),total:Math.round(Number(x.unit)||0)*Math.max(1,Math.min(20,Math.trunc(Number(x.qty)||1)))});
window.MXCart={
list(){return safeRead()},
add(line){const items=safeRead(),item=clean(line);if(items.length>=MAX_LINES)return {ok:false,reason:'limit'};items.push(item);return {ok:safeWrite(items),item}},
update(id,qty){const items=safeRead(),x=items.find(v=>v.id===String(id));if(!x)return false;const n=Math.trunc(Number(qty));if(n<1)return this.remove(id);x.qty=Math.min(20,n);x.total=x.qty*x.unit;return safeWrite(items)},
remove(id){return safeWrite(safeRead().filter(x=>x.id!==String(id)))},
removeMerchant(id){return safeWrite(safeRead().filter(x=>x.merchantId!==String(id)))},
clear(){try{sessionStorage.removeItem(KEY);return true}catch{return false}},
count(){return safeRead().reduce((n,x)=>n+x.qty,0)},
total(){return safeRead().reduce((n,x)=>n+x.total,0)}
};
})();