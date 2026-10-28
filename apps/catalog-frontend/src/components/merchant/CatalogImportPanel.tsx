import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, FileUp, Loader2, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { resolveDefaultImage } from '../../utils/defaultImages';
import { generateCatalogAiImage } from '../../lib/production';

type CatalogDraftRow = {
  rowNumber: number;
  name: string;
  type: 'product' | 'service';
  category: string;
  priceText: string;
  comparePriceText: string;
  description: string;
  unit: string;
  imageUrl: string;
  imageSource?: 'auto' | 'owner' | 'ai';
  suggestedImageUrl?: string;
  suggestionError?: string;
  errors: string[];
  importError?: string;
};
type SavedDraft = { version: 1; filename: string; savedAt: string; rows: CatalogDraftRow[] };
const STORAGE_PREFIX = 'MNTY_CATALOG_IMPORT_DRAFT_V1:';
const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-indigo-500';
const headerAliases: Record<string, string[]> = {
  name: ['name','name_ar','product','product_name','service_name','اسم','الاسم','اسم المنتج','اسم الخدمة','اسم الصنف'],
  type: ['type','item_type','النوع','نوع الصنف'],
  category: ['category','التصنيف','الفئة','القسم'],
  price: ['price','unit_price','السعر','سعر','السعر بالجنيه','السعر ج.م'],
  compare: ['compare_price','old_price','السعر قبل الخصم','السعر السابق'],
  description: ['description','الوصف','تفاصيل'],
  unit: ['unit','الوحدة','وحدة القياس'],
  image: ['image_url','image','رابط الصورة','رابط صورة','الصورة'],
};
const normalizeHeader = (value: string) => value.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, ' ');
function parseCsv(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [], value = '', quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '"') {
      if (quoted && source[i + 1] === '"') { value += '"'; i += 1; }
      else quoted = !quoted;
    } else if (ch === ',' && !quoted) {
      row.push(value.trim()); value = '';
    } else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && source[i + 1] === '\n') i += 1;
      row.push(value.trim());
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = []; value = '';
    } else value += ch;
  }
  if (quoted) throw new Error('ملف CSV يحتوي على حقل نصي لم تُغلق علامتا الاقتباس فيه.');
  row.push(value.trim());
  if (row.some((cell) => cell.length > 0)) rows.push(row);
  if (rows.length < 2) throw new Error('الملف لا يحتوي على صفوف أصناف بعد صف العناوين.');
  return rows;
} 
function validateDraftRows(rows: CatalogDraftRow[]): CatalogDraftRow[] {
  const seen = new Set<string>();
  return rows.map((row) => {
    const errors: string[] = [];
    if (row.name.trim().length < 2) errors.push('اسم الصنف مطلوب (حرفان على الأقل).');
    const priceText = row.priceText.trim();
    const price = priceText === '' ? Number.NaN : Number(priceText.replace(/٬/g,'').replace(/,/g,''));
    if (!Number.isFinite(price) || price < 0) errors.push('السعر مفقود أو غير صالح.');
    if (row.comparePriceText.trim() !== '') {
      const compare = Number(row.comparePriceText.replace(/٬/g,'').replace(/,/g,''));
      if (!Number.isFinite(compare) || compare < 0) errors.push('السعر السابق غير صالح.');
    }
    if (row.imageUrl.trim()) {
      try {
        const url = new URL(row.imageUrl.trim());
        if (url.protocol !== 'https:' || url.username || url.password) errors.push('رابط الصورة يجب أن يكون HTTPS صالحًا.');
      } catch { errors.push('رابط الصورة غير صالح.'); }
    }
    const key = row.name.trim().toLocaleLowerCase();
    if (key && seen.has(key)) errors.push('اسم مكرر داخل ملف الاستيراد.');
    if (key) seen.add(key);
    return { ...row, errors };
  });
}

function createDraftRows(text: string): CatalogDraftRow[] {
  const table = parseCsv(text);
  const headers = table[0].map(normalizeHeader);
  const columns: Record<string, number> = {};
  for (const [key, aliases] of Object.entries(headerAliases)) {
    const found = headers.findIndex((h) => aliases.some((alias) => normalizeHeader(alias) === h));
    if (found >= 0) columns[key] = found;
  }
  if (columns.name == null) throw new Error('يجب أن يحتوي صف العناوين على name أو name_ar أو «اسم المنتج».');
  if (columns.price == null) throw new Error('يجب أن يحتوي صف العناوين على price أو unit_price أو «السعر».');
  return validateDraftRows(table.slice(1).map((cells, index) => {
    const read = (key: string, fallback = '') => columns[key] == null ? fallback : String(cells[columns[key]] ?? '').trim();
    const name = read('name'), rawType = read('type').toLowerCase();
    const type: 'product'|'service' = /service|خدمة|خدمات/.test(rawType) ? 'service' : 'product';
    const category = read('category','عام') || 'عام';
    const priceText = read('price'), comparePriceText = read('compare'), imageUrl = read('image');
    const description = read('description'), unit = read('unit', type === 'service' ? 'جلسة' : 'قطعة');
    return { rowNumber:index+2,name,type,category,priceText,comparePriceText,description,unit,imageUrl,imageSource:imageUrl?'owner':'auto',errors:[] };
  }));
}
function downloadTemplate() {
  const csv = '\uFEFFname,type,category,price,compare_price,description,unit,image_url\r\nمثال منتج,product,عام,100,,وصف المنتج,قطعة,\r\nمثال خدمة,service,خدمات,250,,وصف الخدمة,جلسة,';
  const url = URL.createObjectURL(new Blob([csv], {type:'text/csv;charset=utf-8;'}));
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = 'mantiqatix-catalog-template.csv'; anchor.click();
  URL.revokeObjectURL(url);
}

export const CatalogImportPanel: React.FC = () => {
  const { currentBusiness, businessProducts, addProduct } = useApp();
  const storageKey = currentBusiness?.id ? STORAGE_PREFIX + currentBusiness.id : '';
  const [filename,setFilename] = useState('');
  const [rows,setRows] = useState<CatalogDraftRow[]>([]);
  const [savedAt,setSavedAt] = useState('');
  const [readyStorageKey,setReadyStorageKey] = useState('');
  const [suggestingRows,setSuggestingRows] = useState<number[]>([]);
  const [working,setWorking] = useState(false);
  const [progress,setProgress] = useState({done:0,total:0,failed:0});
  const [notice,setNotice] = useState<{type:'success'|'error'|'info';text:string}|null>(null);
  const remaining = Math.max(0,(currentBusiness?.maxProductsLimit || 150) - businessProducts.length);
  const existingNames = useMemo(()=>new Set(businessProducts.map(p=>p.name.trim().toLocaleLowerCase())),[businessProducts]);
  const readyRows = useMemo(()=>rows.filter((row)=>row.errors.length===0&&!existingNames.has(row.name.trim().toLocaleLowerCase())),[rows,existingNames]);
  const invalidCount = rows.length - readyRows.length;

  useEffect(()=>{
    if(!storageKey){setReadyStorageKey('');setRows([]);setFilename('');setSavedAt('');return;}
    // Keep autosave disabled until this business's draft has been loaded into state.
    setReadyStorageKey('');
    try {
      const raw=localStorage.getItem(storageKey);
      if(!raw){
        setRows([]);setFilename('');setSavedAt('');setReadyStorageKey(storageKey);
        return;
      }
      const saved=JSON.parse(raw) as SavedDraft;
      if(saved?.version!==1||!Array.isArray(saved.rows)){
        setRows([]);setFilename('');setSavedAt('');setReadyStorageKey(storageKey);
        setNotice({type:'error',text:'صيغة المسودة المحلية غير معروفة؛ تم إيقاف استعادتها دون تغيير بيانات الكتالوج.'});
        return;
      }
      setFilename(saved.filename||'');
      setRows(validateDraftRows(saved.rows));
      setSavedAt(saved.savedAt||'');
      setReadyStorageKey(storageKey);
      setNotice({type:'info',text:'استُعيدت المسودة المحفوظة محليًا. راجع الصفوف قبل الاستيراد.'});
    } catch {
      setRows([]);setFilename('');setSavedAt('');setReadyStorageKey(storageKey);
      setNotice({type:'error',text:'تعذر قراءة المسودة السابقة؛ لم يتم تغيير أي بيانات في الكتالوج.'});
    }
  // Deliberately load only when the selected business changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[storageKey]);

  useEffect(()=>{
    if(!storageKey||readyStorageKey!==storageKey)return;
    if(!rows.length){if(filename)localStorage.removeItem(storageKey);return;}
    const draft:SavedDraft={version:1,filename,savedAt:new Date().toISOString(),rows};
    try { localStorage.setItem(storageKey,JSON.stringify(draft)); setSavedAt(draft.savedAt); }
    catch { setNotice({type:'error',text:'تعذر حفظ المسودة محليًا؛ قد تكون مساحة تخزين المتصفح ممتلئة.'}); }
  },[storageKey,readyStorageKey,filename,rows]);

  const updateRow=(rowNumber:number,patch:Partial<CatalogDraftRow>)=>{
    setRows(current=>{
      const changed=current.map(row=>row.rowNumber===rowNumber?{...row,...patch,importError:undefined,suggestionError:undefined}:row);
      return validateDraftRows(changed);
    });
  };

  const suggestImage=async(row:CatalogDraftRow)=>{
    if(!currentBusiness?.id||!row.name.trim()){setNotice({type:'error',text:'أدخل اسم الصنف قبل طلب اقتراح صورة.'});return;}
    setSuggestingRows(current=>current.includes(row.rowNumber)?current:[...current,row.rowNumber]);
    setNotice({type:'info',text:`جارٍ إنشاء اقتراح صورة لـ «${row.name}». لن يُعتمد قبل مراجعتك.`});
    const url=await generateCatalogAiImage({businessId:currentBusiness.id,kind:row.type,name:row.name.trim(),category:row.category,description:row.description});
    setSuggestingRows(current=>current.filter(number=>number!==row.rowNumber));
    if(!url){
      setRows(current=>current.map(item=>item.rowNumber===row.rowNumber?{...item,suggestionError:'تعذر إنشاء صورة مقترحة الآن. يمكنك المحاولة مرة أخرى أو استخدام صورة النشاط الافتراضية.'}:item));
      setNotice({type:'error',text:'تعذر إنشاء اقتراح الصورة. لم يتم تغيير صورة الصنف.'});
      return;
    }
    setRows(current=>current.map(item=>item.rowNumber===row.rowNumber?{...item,suggestedImageUrl:url,suggestionError:undefined}:item));
    setNotice({type:'info',text:'ظهر اقتراح الصورة للمعاينة فقط؛ اختر «اعتماد الصورة المقترحة» لاستخدامه في الاستيراد.'});
  };

  const clearDraft=()=>{
    if(working)return;
    if(storageKey)localStorage.removeItem(storageKey);
    setRows([]);setFilename('');setSavedAt('');setProgress({done:0,total:0,failed:0});
    setNotice({type:'info',text:'تم مسح مسودة الاستيراد المحلية. لم تُحذف أي أصناف محفوظة في الكتالوج.'});
  };

  const onFile=async(event:React.ChangeEvent<HTMLInputElement>)=>{
    const file=event.target.files?.[0];
    event.target.value='';
    if(!file)return;
    if(!/\.csv$/i.test(file.name)&&file.type!=='text/csv'&&file.type!=='application/vnd.ms-excel'){
      setNotice({type:'error',text:'النسخة الحالية تقبل CSV فقط. حوّل ملف Excel إلى CSV UTF-8 ثم استورده؛ دعم XLSX المباشر لم يُفعّل بعد.'});return;
    }
    if(file.size>2*1024*1024){setNotice({type:'error',text:'الحد الأقصى لملف CSV هو 2 ميجابايت.'});return;}
    try{
      const parsed=createDraftRows(await file.text());
      setRows(parsed);setFilename(file.name);setSavedAt(new Date().toISOString());
      setNotice({type:'info',text:`تمت قراءة ${parsed.length} صفًا للمعاينة فقط؛ لم يُحفظ أي صنف في الكتالوج بعد.`});
      setProgress({done:0,total:0,failed:0});
    }catch(error){setNotice({type:'error',text:error instanceof Error?error.message:'تعذر قراءة ملف CSV.'});}
  };

  const startImport=async()=>{
    if(working||!currentBusiness)return;
    if(!readyRows.length){setNotice({type:'error',text:'لا توجد صفوف صالحة للاستيراد بعد المراجعة.'});return;}
    if(readyRows.length>remaining){setNotice({type:'error',text:`عدد الصفوف الصالحة (${readyRows.length}) يتجاوز السعة المتبقية (${remaining}). قلل الصفوف ثم حاول.`});return;}
    if(!window.confirm(`سيُحفظ ${readyRows.length} منتج/خدمة في نشاط «${currentBusiness.name}» عبر مسار الخادم المعتمد. الصفوف المكررة أو غير الصالحة ستُتخطى. متابعة؟`))return;
    setWorking(true);setNotice({type:'info',text:'بدأ الاستيراد بالتتابع لتجنب ضغط متزامن على الكتالوج.'});
    const pending=readyRows.slice();setProgress({done:0,total:pending.length,failed:0});
    let succeeded=0,failed=0;
    for(const row of pending){
      const price=Number(row.priceText.replace(/٬/g,'').replace(/,/g,''));
      const compare=row.comparePriceText.trim()?Number(row.comparePriceText.replace(/٬/g,'').replace(/,/g,'')):undefined;
      const fallback=resolveDefaultImage({name:row.name,description:row.description,category:row.category,kind:row.type==='service'?'service':'product'});
      const image=row.imageUrl||fallback;
      const result=await addProduct({
        businessId:currentBusiness.id,name:row.name.trim(),type:row.type,category:row.category.trim()||'عام',
        price,comparePrice:compare,description:row.description.trim(),unit:row.unit.trim()||(row.type==='service'?'جلسة':'قطعة'),
        imageUrl:image,imageSource:row.imageSource || (row.imageUrl?'owner':'auto'),deferAiImageGeneration:true,isAvailable:true,
      });
      if(result.success){succeeded++;setRows(current=>current.filter(x=>x.rowNumber!==row.rowNumber));}
      else {failed++;setRows(current=>current.map(x=>x.rowNumber===row.rowNumber?{...x,importError:result.message||'فشل الحفظ في الخادم.'}:x));}
      setProgress({done:succeeded+failed,total:pending.length,failed});
    }
    setWorking(false);
    if(storageKey&&succeeded===0)setNotice({type:'error',text:`لم يُحفظ أي صف. اطلع على أخطاء الصفوف ثم أعد المحاولة. (${failed} فشل)`});
    else if(succeeded>0)setNotice({type:failed?'info':'success',text:`انتهى الاستيراد: تم حفظ ${succeeded} صفًا بنجاح، وفشل ${failed}. الصفوف الفاشلة بقيت في المسودة لإعادة المحاولة.`});
    setProgress({done:succeeded+failed,total:pending.length,failed});
  };

  return <section dir="rtl" className="space-y-5">
    <header className="rounded-3xl bg-slate-950 p-6 text-white">
      <div className="flex items-center gap-3"><div className="rounded-2xl bg-white/10 p-3"><FileSpreadsheet className="h-6 w-6"/></div><div><p className="text-xs font-bold text-emerald-200">إدارة الكتالوج · {currentBusiness?.name||'النشاط'}</p><h2 className="mt-1 text-2xl font-black">استيراد المنتجات والخدمات</h2></div></div>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">استيراد CSV مع معاينة والتحقق من السعر والأسماء المكررة. تُحفظ المسودة في هذا المتصفح حتى تستكمل لاحقًا؛ لا يُنشر أي شيء حتى تعتمده عبر زر الاستيراد.</p>
    </header>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">الأصناف الحالية</p><p className="mt-1 text-2xl font-black">{businessProducts.length}</p></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">السعة المتبقية</p><p className="mt-1 text-2xl font-black">{remaining}</p></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">صفوف قابلة للاستيراد</p><p className="mt-1 text-2xl font-black text-emerald-700">{readyRows.length}</p></div>
    </div>
    {notice&&<div role="status" className={`rounded-xl border p-3 text-sm leading-6 ${notice.type==='error'?'border-rose-200 bg-rose-50 text-rose-800':notice.type==='success'?'border-emerald-200 bg-emerald-50 text-emerald-800':'border-slate-200 bg-slate-50 text-slate-700'}`}>{notice.text}</div>}
    <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-slate-900">1 — اختر ملف CSV</h3><p className="mt-1 text-xs leading-5 text-slate-500">UTF-8، بحد أقصى 2 ميجابايت. يدعم أسماء الأعمدة العربية أو الإنجليزية.</p></div><button type="button" onClick={downloadTemplate} disabled={working} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4"/>تنزيل نموذج CSV</button></div>
      <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-indigo-400 hover:bg-indigo-50/30"><FileUp className="h-6 w-6 text-indigo-600"/><span><strong className="block text-sm">اختيار ملف CSV</strong><span className="mt-1 block text-xs text-slate-500">لن يتم الحفظ في قاعدة البيانات عند الاختيار</span></span><input type="file" accept=".csv,text/csv" disabled={working} onChange={onFile} className="sr-only"/></label>
      {filename&&<div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-xs"><span>المسودة: <strong>{filename}</strong></span><span className="text-slate-500">آخر حفظ: {savedAt?new Date(savedAt).toLocaleString('ar-EG'):'—'}</span></div>}
    </div>
    {!!rows.length&&<div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black">2 — راجع الصفوف قبل الحفظ</h3><p className="mt-1 text-xs text-slate-500">{rows.length} صف في المسودة، {invalidCount} يحتاج مراجعة أو مكرر.</p></div><button type="button" onClick={clearDraft} disabled={working} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700"><Trash2 className="h-4 w-4"/>مسح المسودة</button></div>
      <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[1250px] text-right text-xs"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">صف</th><th className="p-3">اسم الصنف *</th><th className="p-3">النوع</th><th className="p-3">التصنيف</th><th className="p-3">السعر *</th><th className="p-3">قبل الخصم</th><th className="p-3">الوحدة</th><th className="p-3">الوصف</th><th className="p-3">الصورة</th><th className="p-3">الحالة</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(row=>{const duplicate=existingNames.has(row.name.trim().toLocaleLowerCase());const issues=[...row.errors,...(duplicate?['الاسم موجود بالفعل في كتالوج النشاط.']:[])];return <tr key={row.rowNumber} className={issues.length?'bg-rose-50/50':''}><td className="p-3">{row.rowNumber}</td><td className="p-2"><input aria-label={`اسم الصنف في الصف ${row.rowNumber}`} value={row.name} onChange={e=>updateRow(row.rowNumber,{name:e.target.value})} className={inputClass}/></td><td className="p-2"><select aria-label={`نوع الصنف في الصف ${row.rowNumber}`} value={row.type} onChange={e=>updateRow(row.rowNumber,{type:e.target.value as 'product'|'service',unit:e.target.value==='service'?'جلسة':'قطعة'})} className={inputClass}><option value="product">منتج</option><option value="service">خدمة</option></select></td><td className="p-2"><input aria-label={`التصنيف في الصف ${row.rowNumber}`} value={row.category} onChange={e=>updateRow(row.rowNumber,{category:e.target.value})} className={inputClass}/></td><td className="p-2"><input aria-label={`السعر في الصف ${row.rowNumber}`} type="number" min="0" step="0.01" value={row.priceText} onChange={e=>updateRow(row.rowNumber,{priceText:e.target.value})} className={inputClass}/></td><td className="p-2"><input aria-label={`السعر السابق في الصف ${row.rowNumber}`} type="number" min="0" step="0.01" value={row.comparePriceText} onChange={e=>updateRow(row.rowNumber,{comparePriceText:e.target.value})} className={inputClass}/></td><td className="p-2"><input aria-label={`الوحدة في الصف ${row.rowNumber}`} value={row.unit} onChange={e=>updateRow(row.rowNumber,{unit:e.target.value})} className={inputClass}/></td><td className="p-2"><textarea aria-label={`الوصف في الصف ${row.rowNumber}`} value={row.description} rows={2} onChange={e=>updateRow(row.rowNumber,{description:e.target.value})} className={inputClass}/></td><td className="p-2"><div className="min-w-[180px] space-y-2">{row.imageUrl&&<a className="block text-indigo-700 underline" href={row.imageUrl} target="_blank" rel="noreferrer">فتح الصورة المستخدمة</a>}<input aria-label={`رابط الصورة في الصف ${row.rowNumber}`} value={row.imageUrl} onChange={e=>updateRow(row.rowNumber,{imageUrl:e.target.value,imageSource:e.target.value.trim()?'owner':'auto'})} placeholder="رابط HTTPS أو اتركه فارغًا" className={inputClass}/>{row.suggestedImageUrl&&<div className="rounded-xl border border-indigo-200 bg-indigo-50 p-2"><img src={row.suggestedImageUrl} alt={`اقتراح صورة مولّد بالذكاء الاصطناعي لـ ${row.name}`} loading="lazy" className="h-24 w-full rounded-lg object-cover bg-white"/><p className="mt-1 text-[10px] text-indigo-900">اقتراح AI — غير معتمد</p><button type="button" onClick={()=>updateRow(row.rowNumber,{imageUrl:row.suggestedImageUrl||'',imageSource:'ai',suggestedImageUrl:undefined})} className="mt-2 w-full rounded-lg bg-indigo-700 px-2 py-2 text-[11px] font-bold text-white">اعتماد الصورة المقترحة</button></div>}<button type="button" onClick={()=>void suggestImage(row)} disabled={working||suggestingRows.includes(row.rowNumber)} className="w-full rounded-lg border border-indigo-200 px-2 py-2 text-[11px] font-bold text-indigo-800 disabled:opacity-50">{suggestingRows.includes(row.rowNumber)?'جارٍ إنشاء الاقتراح…':row.suggestedImageUrl?'إنشاء اقتراح آخر':'اقتراح صورة بالذكاء الاصطناعي'}</button>{row.suggestionError&&<p className="text-[10px] text-rose-700">{row.suggestionError}</p>}{!row.imageUrl&&!row.suggestedImageUrl&&<p className="text-[10px] leading-4 text-slate-500">سيُستخدم رسم افتراضي مناسب للمجال حتى ترفع صورة.</p>}</div></td><td className="p-3"><div>{issues.length?<span className="font-bold text-rose-700">مراجعة مطلوبة</span>:<span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5"/>جاهز</span>}{issues.map((issue,i)=><div key={i} className="mt-1 max-w-[220px] text-[11px] text-rose-700">{issue}</div>)}{row.importError&&<div className="mt-1 max-w-[220px] text-[11px] font-bold text-amber-800">تعذر الحفظ: {row.importError} — يمكن إعادة المحاولة.</div>}</div></td></tr>;})}</tbody></table></div>
      {progress.total>0&&<div className="rounded-xl bg-slate-50 p-3"><div className="flex items-center justify-between text-xs"><span>تقدم الاستيراد</span><strong>{progress.done} / {progress.total}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{width:`${progress.total?progress.done/progress.total*100:0}%`}}/></div><p className="mt-2 text-xs text-slate-500">نجح {progress.done-progress.failed} · فشل {progress.failed}</p></div>}
      <button type="button" onClick={()=>void startImport()} disabled={working||!readyRows.length||readyRows.length>remaining} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{working?<Loader2 className="h-4 w-4 animate-spin"/>:<CheckCircle2 className="h-4 w-4"/>}{working?'جارٍ حفظ الصفوف بالتتابع…':`3 — اعتماد واستيراد ${readyRows.length} صفًا`}</button>
      {!!(readyRows.length>remaining)&&<p className="text-xs text-rose-700">عدد الصفوف يتجاوز السعة المتبقية؛ لن يبدأ الاستيراد قبل حل ذلك.</p>}
    </div>}
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-950"><strong className="flex items-center gap-2"><AlertTriangle className="h-4 w-4"/>تنبيه</strong><p className="mt-1">المسودة محفوظة محليًا على هذا المتصفح وليست متزامنة مع أجهزة أخرى. النسخة الحالية تستورد CSV فقط؛ دعم XLSX المباشر لم يُفعّل بعد. اقتراحات الصور أصبحت متاحة هنا، وتحتاج اعتمادًا يدويًا قبل استخدامها. الحفظ الفعلي يمر عبر واجهة الخادم المحمية؛ عند تعذر صف تبقى تفاصيل الخطأ في المسودة لإعادة المحاولة.</p></div>
  </section>;
};
