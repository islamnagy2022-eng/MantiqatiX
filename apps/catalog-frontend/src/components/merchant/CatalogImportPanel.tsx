import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, FileUp, Loader2, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { resolveDefaultImage } from '../../utils/defaultImages';
import { generateCatalogAiImage } from '../../lib/production';

type CatalogDraftRow = {
  rowNumber: number;
  name: string;
  variant: string;
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
  variant: ['variant','size','variant_name','حجم','المقاس','الحجم','النوع الفرعي'],
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

type ZipEntryInfo = { method: number; compressedSize: number; uncompressedSize: number; localHeaderOffset: number; flags: number };
const MAX_XLSX_UNCOMPRESSED_ENTRY = 12 * 1024 * 1024;
const MAX_XLSX_TOTAL_UNCOMPRESSED = 24 * 1024 * 1024;
const MAX_XLSX_TOTAL_ENTRIES = 512;
const XLSX_REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
function columnIndexFromReference(reference: string): number {
  const match = /^([A-Z]+)\d+$/i.exec(reference);
  if (!match) return -1;
  let result = 0;
  for (const letter of match[1].toUpperCase()) result = result * 26 + letter.charCodeAt(0) - 64;
  return result - 1;
}
function parseXml(source: string, label: string): Document {
  const documentXml = new DOMParser().parseFromString(source, 'application/xml');
  if (documentXml.getElementsByTagName('parsererror').length) throw new Error('تعذر قراءة ملف Excel (' + label + ').');
  return documentXml;
}
async function inflateZipEntry(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') throw new Error('المتصفح لا يدعم فك ضغط XLSX؛ استخدم CSV UTF-8 بدلًا منه.');
  try {
    const compression = new DecompressionStream('deflate-raw' as CompressionFormat);
    const input = new Blob([data.slice().buffer as ArrayBuffer]).stream();
    return new Uint8Array(await new Response(input.pipeThrough(compression)).arrayBuffer());
  } catch {
    throw new Error('تعذر فك ضغط إحدى أوراق ملف Excel. احفظ الملف بصيغة XLSX قياسية أو استخدم CSV UTF-8.');
  }
}
/** Reads the first worksheet's XML only. Workbook code/macros are never executed. */
async function parseXlsx(arrayBuffer: ArrayBuffer): Promise<string[][]> {
  const bytes = new Uint8Array(arrayBuffer);
  const view = new DataView(arrayBuffer);
  if (bytes.length < 22) throw new Error('ملف XLSX أصغر من الحجم المتوقع أو غير صالح.');
  const minEocd = Math.max(0, bytes.length - 65557);
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= minEocd; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) throw new Error('الملف ليس XLSX قياسيًا أو أن الأرشيف تالف.');
  const diskNo = view.getUint16(eocd + 4, true);
  const centralDisk = view.getUint16(eocd + 6, true);
  const diskEntries = view.getUint16(eocd + 8, true);
  const entryCount = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (diskNo !== 0 || centralDisk !== 0 || diskEntries !== entryCount || entryCount === 0 || entryCount > MAX_XLSX_TOTAL_ENTRIES) {
    throw new Error('ملف Excel متعدد الأجزاء أو يحتوي على عدد غير مدعوم من المكونات.');
  }
  if (centralOffset + centralSize > bytes.length || centralOffset >= eocd) throw new Error('فهرس ملف Excel غير صالح.');
  const decoder = new TextDecoder('utf-8');
  const entries = new Map<string, ZipEntryInfo>();
  let declaredTotalUncompressed = 0;
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) throw new Error('فهرس ZIP داخل ملف Excel غير صالح.');
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localHeaderOffset = view.getUint32(cursor + 42, true);
    const nameStart = cursor + 46;
    const nextCursor = nameStart + nameLength + extraLength + commentLength;
    if (nextCursor > bytes.length) throw new Error('اسم أحد مكونات ملف Excel غير مكتمل.');
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength)).replace(/\\/g, '/');
    if (name.startsWith('/') || name.split('/').includes('..')) throw new Error('مسارات مكونات ملف Excel غير صالحة.');
    if ((flags & 0x0001) !== 0) throw new Error('ملف Excel محمي بكلمة مرور؛ أزل الحماية قبل الاستيراد.');
    if (method !== 0 && method !== 8) throw new Error('طريقة ضغط داخل ملف Excel غير مدعومة.');
    if (uncompressedSize > MAX_XLSX_UNCOMPRESSED_ENTRY || compressedSize > bytes.length) throw new Error('أحد مكونات Excel يتجاوز حدود الحجم الآمن.');
    declaredTotalUncompressed += uncompressedSize;
    if (declaredTotalUncompressed > MAX_XLSX_TOTAL_UNCOMPRESSED) throw new Error('الحجم الإجمالي غير المضغوط لملف Excel يتجاوز الحد الآمن (24 ميجابايت).');
    if (entries.has(name)) throw new Error('ملف Excel يحتوي على مكوّن مكرر في الأرشيف.');
    entries.set(name, { method, compressedSize, uncompressedSize, localHeaderOffset, flags });
    cursor = nextCursor;
  }
  const readEntry = async (name: string): Promise<Uint8Array> => {
    const entry = entries.get(name);
    if (!entry) throw new Error('ملف Excel لا يحتوي على المكوّن المطلوب: ' + name + '.');
    const start = entry.localHeaderOffset;
    if (start + 30 > bytes.length || view.getUint32(start, true) !== 0x04034b50) throw new Error('رأس مكوّن Excel غير صالح.');
    const nameLength = view.getUint16(start + 26, true);
    const extraLength = view.getUint16(start + 28, true);
    const dataStart = start + 30 + nameLength + extraLength;
    const dataEnd = dataStart + entry.compressedSize;
    if (dataStart < 0 || dataEnd > bytes.length || dataEnd < dataStart) throw new Error('بيانات مكوّن Excel خارج حدود الملف.');
    const compressed = bytes.slice(dataStart, dataEnd);
    const result = entry.method === 0 ? compressed : await inflateZipEntry(compressed);
    if (result.length !== entry.uncompressedSize) throw new Error('الحجم الفعلي لمكوّن Excel لا يطابق فهرس الملف.');
    return result;
  };
  const readText = async (name: string) => decoder.decode(await readEntry(name));
  const workbook = parseXml(await readText('xl/workbook.xml'), 'workbook.xml');
  const firstSheet = workbook.getElementsByTagNameNS('*', 'sheet').item(0);
  if (!firstSheet) throw new Error('ملف Excel لا يحتوي على ورقة عمل.');
  const relationId = firstSheet.getAttributeNS(XLSX_REL_NS, 'id') || firstSheet.getAttribute('r:id') || '';
  if (!relationId) throw new Error('تعذر تحديد أول ورقة عمل في ملف Excel.');
  const relationships = parseXml(await readText('xl/_rels/workbook.xml.rels'), 'workbook.xml.rels');
  const relationship = Array.from(relationships.getElementsByTagNameNS('*', 'Relationship')).find(item => item.getAttribute('Id') === relationId);
  const target = relationship?.getAttribute('Target') || '';
  if (!target || target.startsWith('/') || target.split('/').includes('..')) throw new Error('مسار ورقة العمل غير صالح.');
  const sheetPath = ('xl/' + target).replace(/\\/g, '/').replace(/\/+/g, '/');
  const worksheet = parseXml(await readText(sheetPath), 'worksheet');
  let sharedStrings: string[] = [];
  if (entries.has('xl/sharedStrings.xml')) {
    const shared = parseXml(await readText('xl/sharedStrings.xml'), 'sharedStrings.xml');
    sharedStrings = Array.from(shared.getElementsByTagNameNS('*', 'si')).map(item =>
      Array.from(item.getElementsByTagNameNS('*', 't')).map(t => t.textContent || '').join('')
    );
  }
  const sheetData = worksheet.getElementsByTagNameNS('*', 'sheetData').item(0);
  if (!sheetData) throw new Error('ورقة Excel الأولى لا تحتوي على بيانات صفوف.');
  const sourceRows = Array.from(sheetData.getElementsByTagNameNS('*', 'row'));
  if (sourceRows.length > 5001) throw new Error('ملف Excel يحتوي على أكثر من 5000 صف؛ قسّم الملف ثم أعد الاستيراد.');
  const rows: string[][] = [];
  for (const sourceRow of sourceRows) {
    const cells = Array.from(sourceRow.getElementsByTagNameNS('*', 'c'));
    const row: string[] = [];
    for (const cell of cells) {
      const column = columnIndexFromReference(cell.getAttribute('r') || '');
      if (column < 0 || column > 100) continue;
      const type = cell.getAttribute('t') || '';
      let value = '';
      if (type === 'inlineStr') {
        const inline = cell.getElementsByTagNameNS('*', 'is').item(0);
        value = inline ? Array.from(inline.getElementsByTagNameNS('*', 't')).map(t => t.textContent || '').join('') : '';
      } else {
        value = cell.getElementsByTagNameNS('*', 'v').item(0)?.textContent || '';
        if (type === 's') {
          const sharedIndex = Number(value);
          value = Number.isInteger(sharedIndex) && sharedIndex >= 0 ? sharedStrings[sharedIndex] || '' : '';
        } else if (type === 'b') value = value === '1' ? 'TRUE' : 'FALSE';
      }
      row[column] = value;
    }
    const normalized = row.map(value => value || '');
    if (normalized.some(value => value.trim() !== '')) rows.push(normalized);
  }
  if (rows.length < 2) throw new Error('الورقة الأولى لا تحتوي على صف عناوين وصف بيانات على الأقل.');
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
    const key = `${row.name.trim()}::${(row.variant||'').trim()}`.toLocaleLowerCase();
    if (row.name.trim() && seen.has(key)) errors.push('اسم وحجم مكرران داخل ملف الاستيراد.');
    if (row.name.trim()) seen.add(key);
    return { ...row, errors };
  });
}

function createDraftRowsFromTable(table: string[][]): CatalogDraftRow[] {
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
    const description = read('description'), unit = read('unit', type === 'service' ? 'جلسة' : 'قطعة'), variant = read('variant');
    return { rowNumber:index+2,name,variant,type,category,priceText,comparePriceText,description,unit,imageUrl,imageSource:imageUrl?'owner':'auto',errors:[] };
  }));
}
function createDraftRows(text: string): CatalogDraftRow[] {
  return createDraftRowsFromTable(parseCsv(text));
}

function downloadTemplate() {
  const csv = '\uFEFFname,variant,type,category,price,compare_price,description,unit,image_url\r\nبرجر,سنجل,product,وجبات,100,,برجر سنجل,قطعة,\r\nبرجر,دبل,product,وجبات,150,,برجر دبل,قطعة,\r\nمثال خدمة,,service,خدمات,250,,وصف الخدمة,جلسة,';
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
  const productNameForRow=(row:CatalogDraftRow)=>(row.variant||'').trim()?`${row.name.trim()} - ${(row.variant||'').trim()}`:row.name.trim();
  const existingNames = useMemo(()=>new Set(businessProducts.map(p=>p.name.trim().toLocaleLowerCase())),[businessProducts]);
  const readyRows = useMemo(()=>rows.filter((row)=>row.errors.length===0&&!existingNames.has(productNameForRow(row).toLocaleLowerCase())),[rows,existingNames]);
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
    const url=await generateCatalogAiImage({businessId:currentBusiness.id,branchId:currentBusiness.branchId,kind:row.type,name:productNameForRow(row),category:row.category,description:row.description});
    setSuggestingRows(current=>current.filter(number=>number!==row.rowNumber));
    if(!url){
      setRows(current=>current.map(item=>item.rowNumber===row.rowNumber?{...item,suggestionError:'تعذر إنشاء صورة مقترحة الآن. يمكنك المحاولة مرة أخرى أو استخدام صورة النشاط الافتراضية.'}:item));
      setNotice({type:'error',text:'تعذر إنشاء الصورة من خدمة الذكاء الاصطناعي. تأكد من تسجيل الدخول وصلاحية تعديل الكتالوج وإعداد خدمة AI على الخادم، ثم أعد المحاولة. لم يتم تغيير صورة الصنف.'});
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
    const isXlsx = /\.xlsx$/i.test(file.name);
    const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv' || file.type === 'application/vnd.ms-excel';
    if (!isCsv && !isXlsx) {
      setNotice({ type: 'error', text: 'صيغة الملف غير مدعومة. ارفع CSV UTF-8 أو XLSX فقط؛ لن يتم تشغيل ماكرو أو كود داخل الملف.' });
      return;
    }
    const maxBytes = isXlsx ? 5 * 1024 * 1024 : 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      setNotice({ type: 'error', text: isXlsx ? 'الحد الأقصى لملف XLSX هو 5 ميجابايت.' : 'الحد الأقصى لملف CSV هو 2 ميجابايت.' });
      return;
    }
    try {
      const parsed = isXlsx
        ? createDraftRowsFromTable(await parseXlsx(await file.arrayBuffer()))
        : createDraftRows(await file.text());
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
        businessId:currentBusiness.id,name:productNameForRow(row),type:row.type,category:row.category.trim()||'عام',
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
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">استيراد CSV مع معاينة والتحقق من السعر والأسماء والأحجام المكررة. تُحفظ المسودة في هذا المتصفح حتى تستكمل لاحقًا؛ لا يُنشر أي شيء حتى تعتمده عبر زر الاستيراد.</p>
    </header>
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">الأصناف الحالية</p><p className="mt-1 text-2xl font-black">{businessProducts.length}</p></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">السعة المتبقية</p><p className="mt-1 text-2xl font-black">{remaining}</p></div>
      <div className="rounded-2xl border bg-white p-4"><p className="text-xs text-slate-500">صفوف قابلة للاستيراد</p><p className="mt-1 text-2xl font-black text-emerald-700">{readyRows.length}</p></div>
    </div>
    {notice&&<div role="status" className={`rounded-xl border p-3 text-sm leading-6 ${notice.type==='error'?'border-rose-200 bg-rose-50 text-rose-800':notice.type==='success'?'border-emerald-200 bg-emerald-50 text-emerald-800':'border-slate-200 bg-slate-50 text-slate-700'}`}>{notice.text}</div>}
    <div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black text-slate-900">1 — اختر ملف CSV</h3><p className="mt-1 text-xs leading-5 text-slate-500">CSV UTF-8 حتى 2 ميجابايت أو XLSX حتى 5 ميجابايت. تُقرأ أول ورقة فقط؛ يدعم أسماء الأعمدة العربية أو الإنجليزية. استخدم عمود variant أو الحجم لتسجيل السنجل والدبل والمقاسات دون اعتبارها أسماء مكررة.</p></div><button type="button" onClick={downloadTemplate} disabled={working} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"><Download className="h-4 w-4"/>تنزيل نموذج CSV</button></div>
      <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-indigo-400 hover:bg-indigo-50/30"><FileUp className="h-6 w-6 text-indigo-600"/><span><strong className="block text-sm">اختيار ملف CSV أو XLSX</strong><span className="mt-1 block text-xs text-slate-500">لن يتم الحفظ في قاعدة البيانات عند الاختيار</span></span><input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={working} onChange={onFile} className="sr-only"/></label>
      {filename&&<div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-xs"><span>المسودة: <strong>{filename}</strong></span><span className="text-slate-500">آخر حفظ: {savedAt?new Date(savedAt).toLocaleString('ar-EG'):'—'}</span></div>}
    </div>
    {!!rows.length&&<div className="rounded-3xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-black">2 — راجع الصفوف قبل الحفظ</h3><p className="mt-1 text-xs text-slate-500">{rows.length} صف في المسودة، {invalidCount} يحتاج مراجعة أو مكرر.</p></div><button type="button" onClick={clearDraft} disabled={working} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700"><Trash2 className="h-4 w-4"/>مسح المسودة</button></div>
      <div className="overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[1250px] text-right text-xs"><thead className="bg-slate-50 text-slate-600"><tr><th className="p-3">صف</th><th className="p-3">اسم الصنف *</th><th className="p-3">الحجم / النوع الفرعي</th><th className="p-3">نوع السجل</th><th className="p-3">التصنيف</th><th className="p-3">السعر *</th><th className="p-3">قبل الخصم</th><th className="p-3">الوحدة</th><th className="p-3">الوصف</th><th className="p-3">الصورة</th><th className="p-3">الحالة</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map(row=>{const duplicate=existingNames.has(row.name.trim().toLocaleLowerCase());const issues=[...row.errors,...(duplicate?['الاسم موجود بالفعل في كتالوج النشاط.']:[])];return <tr key={row.rowNumber} className={issues.length?'bg-rose-50/50':''}><td className="p-3">{row.rowNumber}</td><td className="p-2"><input aria-label={`اسم الصنف في الصف ${row.rowNumber}`} value={row.name} onChange={e=>updateRow(row.rowNumber,{name:e.target.value})} className={inputClass}/></td><td className="p-2"><input aria-label={`الحجم أو النوع الفرعي في الصف ${row.rowNumber}`} value={row.variant} onChange={e=>updateRow(row.rowNumber,{variant:e.target.value})} placeholder="سنجل / دبل / كبير" className={inputClass}/></td><td className="p-2"><select aria-label={`نوع الصنف في الصف ${row.rowNumber}`} value={row.type} onChange={e=>updateRow(row.rowNumber,{type:e.target.value as 'product'|'service',unit:e.target.value==='service'?'جلسة':'قطعة'})} className={inputClass}><option value="product">منتج</option><option value="service">خدمة</option></select></td><td className="p-2"><input aria-label={`التصنيف في الصف ${row.rowNumber}`} value={row.category} onChange={e=>updateRow(row.rowNumber,{category:e.target.value})} className={inputClass}/></td><td className="p-2"><input aria-label={`السعر في الصف ${row.rowNumber}`} type="number" min="0" step="0.01" value={row.priceText} onChange={e=>updateRow(row.rowNumber,{priceText:e.target.value})} className={inputClass}/></td><td className="p-2"><input aria-label={`السعر السابق في الصف ${row.rowNumber}`} type="number" min="0" step="0.01" value={row.comparePriceText} onChange={e=>updateRow(row.rowNumber,{comparePriceText:e.target.value})} className={inputClass}/></td><td className="p-2"><input aria-label={`الوحدة في الصف ${row.rowNumber}`} value={row.unit} onChange={e=>updateRow(row.rowNumber,{unit:e.target.value})} className={inputClass}/></td><td className="p-2"><textarea aria-label={`الوصف في الصف ${row.rowNumber}`} value={row.description} rows={2} onChange={e=>updateRow(row.rowNumber,{description:e.target.value})} className={inputClass}/></td><td className="p-2"><div className="min-w-[180px] space-y-2">{row.imageUrl&&<a className="block text-indigo-700 underline" href={row.imageUrl} target="_blank" rel="noreferrer">فتح الصورة المستخدمة</a>}<input aria-label={`رابط الصورة في الصف ${row.rowNumber}`} value={row.imageUrl} onChange={e=>updateRow(row.rowNumber,{imageUrl:e.target.value,imageSource:e.target.value.trim()?'owner':'auto'})} placeholder="رابط HTTPS أو اتركه فارغًا" className={inputClass}/>{row.suggestedImageUrl&&<div className="rounded-xl border border-indigo-200 bg-indigo-50 p-2"><img src={row.suggestedImageUrl} alt={`اقتراح صورة مولّد بالذكاء الاصطناعي لـ ${row.name}`} loading="lazy" className="h-24 w-full rounded-lg object-cover bg-white"/><p className="mt-1 text-[10px] text-indigo-900">اقتراح AI — غير معتمد</p><button type="button" onClick={()=>updateRow(row.rowNumber,{imageUrl:row.suggestedImageUrl||'',imageSource:'ai',suggestedImageUrl:undefined})} className="mt-2 w-full rounded-lg bg-indigo-700 px-2 py-2 text-[11px] font-bold text-white">اعتماد الصورة المقترحة</button></div>}<button type="button" onClick={()=>void suggestImage(row)} disabled={working||suggestingRows.includes(row.rowNumber)} className="w-full rounded-lg border border-indigo-200 px-2 py-2 text-[11px] font-bold text-indigo-800 disabled:opacity-50">{suggestingRows.includes(row.rowNumber)?'جارٍ إنشاء الاقتراح…':row.suggestedImageUrl?'إنشاء اقتراح آخر':'اقتراح صورة بالذكاء الاصطناعي'}</button>{row.suggestionError&&<p className="text-[10px] text-rose-700">{row.suggestionError}</p>}{!row.imageUrl&&!row.suggestedImageUrl&&<p className="text-[10px] leading-4 text-slate-500">سيُستخدم رسم افتراضي مناسب للمجال حتى ترفع صورة.</p>}</div></td><td className="p-3"><div>{issues.length?<span className="font-bold text-rose-700">مراجعة مطلوبة</span>:<span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5"/>جاهز</span>}{issues.map((issue,i)=><div key={i} className="mt-1 max-w-[220px] text-[11px] text-rose-700">{issue}</div>)}{row.importError&&<div className="mt-1 max-w-[220px] text-[11px] font-bold text-amber-800">تعذر الحفظ: {row.importError} — يمكن إعادة المحاولة.</div>}</div></td></tr>;})}</tbody></table></div>
      {progress.total>0&&<div className="rounded-xl bg-slate-50 p-3"><div className="flex items-center justify-between text-xs"><span>تقدم الاستيراد</span><strong>{progress.done} / {progress.total}</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-emerald-600 transition-all" style={{width:`${progress.total?progress.done/progress.total*100:0}%`}}/></div><p className="mt-2 text-xs text-slate-500">نجح {progress.done-progress.failed} · فشل {progress.failed}</p></div>}
      <button type="button" onClick={()=>void startImport()} disabled={working||!readyRows.length||readyRows.length>remaining} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50">{working?<Loader2 className="h-4 w-4 animate-spin"/>:<CheckCircle2 className="h-4 w-4"/>}{working?'جارٍ حفظ الصفوف بالتتابع…':`3 — اعتماد واستيراد ${readyRows.length} صفًا`}</button>
      {!!(readyRows.length>remaining)&&<p className="text-xs text-rose-700">عدد الصفوف يتجاوز السعة المتبقية؛ لن يبدأ الاستيراد قبل حل ذلك.</p>}
    </div>}
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-950"><strong className="flex items-center gap-2"><AlertTriangle className="h-4 w-4"/>تنبيه</strong><p className="mt-1">المسودة محفوظة محليًا على هذا المتصفح وليست متزامنة مع أجهزة أخرى. يدعم الاستيراد CSV وXLSX (الورقة الأولى فقط)؛ لا يتم تشغيل الماكرو أو الصيغ داخل الملف. اقتراحات الصور أصبحت متاحة هنا، وتحتاج اعتمادًا يدويًا قبل استخدامها. الحفظ الفعلي يمر عبر واجهة الخادم المحمية؛ عند تعذر صف تبقى تفاصيل الخطأ في المسودة لإعادة المحاولة.</p></div>
  </section>;
};
