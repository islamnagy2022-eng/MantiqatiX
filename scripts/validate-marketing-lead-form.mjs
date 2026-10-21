import fs from "node:fs";
import assert from "node:assert/strict";

const source = fs.readFileSync("web/operations-modules.js", "utf8");
const edge = fs.readFileSync("supabase/functions/marketing-lead-create/index.ts", "utf8");
const paymentEdge = fs.readFileSync("supabase/functions/mantigo-payment-intent/index.ts", "utf8");
const form = source.slice(source.indexOf("function leadForm()"), source.indexOf("function educationWorkspace()"));
assert.match(form, /id="mlTitle"[^>]*maxlength="160"/, "lead title must have a bounded length");
assert.match(form, /id="mlDesc"[^>]*maxlength="5000"/, "lead description must have a bounded length");
assert.match(form, /id="mlStatus" role="status" aria-live="polite"/, "form status must be announced accessibly");
assert.match(form, /if\(!title\|\|!description\)/, "title and description must be required");
assert.match(form, /!Number\.isFinite\(min\)\|\|!Number\.isFinite\(max\)\|\|min<0\|\|max<0/, "budgets must be finite and nonnegative");
assert.match(form, /if\(max<min\)/, "minimum budget must not exceed the maximum, including an omitted maximum treated as zero");
assert.match(form, /الميزانية الدنيا لا يمكن أن تتجاوز الميزانية القصوى/, "budget range validation must have clear Arabic guidance");
assert.match(form, /id="mlServices"/, "marketing lead form must capture requested services");
assert.match(form, /servicesRaw\.split\(','\)/, "requested services must be parsed from the form");
assert.match(form, /requiredServices\.length>10/, "requested service count must respect backend limits");
assert.match(form, /required_services:requiredServices/, "requested services must be sent to the existing backend contract");
assert.match(source, /memberships=\[\]/, "active memberships must be retained for explicit business selection");
assert.match(form, /id="mlBusiness"/, "lead form must expose business selection when multiple businesses are available");
assert.match(form, /اختر النشاط التجاري الذي يخصه طلب التسويق/, "business selection must be required when multiple business memberships exist");
assert.match(form, /p\.business_id=businessId/, "selected business ID must be sent for server-side authorization");
assert.match(form, /if\(!button\|\|button\.disabled\)return/, "duplicate submissions must be blocked");
assert.match(form, /button\.disabled=true/, "submit button must disable during request");
assert.match(form, /finally\{button\.disabled=false/, "submit button must be restored after request");
assert.match(form, /marketing-lead-create/, "submission must continue through the existing backend function");
assert.match(form, /business_selection_required/, "business selection failures must be explained to the user");
assert.match(form, /business_not_authorized/, "unauthorized business scope must receive a safe user-facing message");
assert.match(form, /invalid_required_services/, "service validation failures must receive a useful message");
assert.match(form, /r\.data\?\.ok!==true\|\|!r\.data\?\.lead\?\.id/, "success must require a confirmed backend response and lead ID");
assert.match(form, /تعذر تأكيد إنشاء طلب التسويق/, "uncertain API responses must not be reported as success");
assert.match(source, /loadErrors=\{\}/, "table query failures must be tracked separately from empty results");
assert.match(source, /loadErrors\[t\]=r\.error/, "failed table reads must preserve failure state");
assert.match(source, /TENANT_SCOPE_UNAVAILABLE/, "catalog reads must fail closed without a verified tenant scope");
assert.match(source, /BUSINESS_SCOPE_UNAVAILABLE/, "marketing project reads must fail closed without a verified business scope");
assert.match(source, /q=q\.eq\('tenant_id',scope\(\)\.tenant_id\)/, "catalog reads must always be constrained to the active tenant");
assert.match(source, /q=q\.eq\('client_business_id',membership\.business_id\)/, "marketing project reads must always be constrained to the selected business");

assert.match(source, /if\(cp\.error\)loadErrors\.mantigo_captain_profile=cp\.error/, "captain profile read errors must not masquerade as a missing profile");
assert.match(source, /if\(r\.error\)\{rows\.mantigo_open=\[\];loadErrors\.mantigo_open=r\.error\}/, "open rides RPC failures must remain visible rather than appearing as an empty list");
assert.doesNotMatch(source, /if\(tab==='open'&&!rows\.mantigo_open\)\{sb\.rpc\('list_open_mantigo_rides_backend'/, "MantiGO open-tab rendering must not fire a second unhandled RPC");
assert.match(source, /if\(current==='MantiGO والنقل'&&nextTab==='open'\)\{const generation=loadGeneration;[\s\S]*?try\{const r=await sb\.rpc\('list_open_mantigo_rides_backend'[\s\S]*?loadErrors\.mantigo_open=r\.error/, "open-rides loading must use one error-aware request path with stale-response protection");


assert.match(source, /function marketingTableView\(d,key,content\)/, "marketing tables must share explicit query failure rendering");
assert.match(source, /aria-labelledby=\"'\+esc\(headingId\)\+'\"/, "module workspace sections must be associated with their visible heading");
assert.match(source, /aria-busy=\"'\+\(loading\?'true':'false'\)\+'\"/, "module workspace loading state must be exposed accessibly");
assert.match(source, /const headingId='op-heading-'\+String\(d\.key\|\|'module'\)\.toLowerCase\(\)\.replace\(\/\[\^a-z0-9_-\]\/g,'-'\)/, "module heading IDs must be deterministic and normalized");

assert.match(source, /function overview\(d\)\{[\s\S]*?loadErrors\[t\]\?[\s\S]*?تعذر التحميل[\s\S]*?لا يمكن عرض عدد السجلات بأمان/, "overview counts must distinguish failed reads from real zero counts");
assert.match(source, /data-op-reload/, "overview must expose a retry control after failed reads");
assert.match(source, /listenOnce\(document\.querySelector\('\[data-op-reload\]'\),'opReloadBound','click',\(\)=>\{if\(current&&defs\[current\]\)load\(defs\[current\]\)\}\)/, "retry control must reload the current module through the guarded one-time listener");
assert.match(source, /tab!=='overview'&&Object\.keys\(loadErrors\)\.length/, "detail tabs must expose retry when reads fail");
assert.match(source, /!page\.querySelector\('\[data-op-reload\]'\)[\s\S]*?page\.querySelector\('\[role="alert"\]'\)[\s\S]*?retryMarkup/, "detail tabs must retain retry controls even when a specific error alert already exists");
assert.match(source, /if\(error\)\{page\.innerHTML=shell\(d,tabs\(d\)\+'<div class="empty-state" role="alert">'[\s\S]*?data-op-reload/, "module-level RPC/load errors must expose retry unless authentication is required");
assert.match(source, /تعذر تحميل بعض البيانات في هذه الصفحة[\s\S]*إعادة تحميل البيانات/, "detail-tab failures must be visible with a retry action");
assert.match(source, /marketingTableView\(d,'marketing_services'/, "services tab must show load failures");
assert.match(source, /marketingTableView\(d,'marketing_plans'/, "plans tab must show load failures");
assert.match(source, /marketingTableView\(d,'marketing_projects'/, "projects tab must show load failures");
assert.match(source, /تعذر تحميل البيانات المطلوبة[\s\S]*لم نعتبر النتيجة فارغة/, "non-lead marketing query errors must not masquerade as empty tables");
assert.match(source, /membershipLoadError=!!r\.error/, "membership lookup failures must be tracked explicitly");
assert.match(source, /تم إيقاف إرسال الطلب مؤقتًا[\s\S]*عضويات الحساب/, "membership lookup failures must be explained to the user");
assert.match(source, /membershipLoadError\?'disabled aria-disabled="true"'/, "lead submission must be disabled if membership cannot be verified");
assert.match(source, /if\(membershipLoadError\)\{setStatus\(/, "lead submission handler must enforce the membership safety guard");
assert.match(source, /تعذر تحميل طلبات التسويق[\s\S]*لم نعتبر القائمة فارغة/, "lead query failure must not appear as an empty list");
assert.match(source, /required_services\|\|\[\]/, "lead list must display requested services when available");
assert.match(source, /money\(r\.budget_min\).*money\(r\.budget_max\)/, "lead list must show the full budget range");
assert.match(source, /toLocaleDateString\('ar-EG'\)/, "lead list must display localized request dates");
assert.match(source, /id="mlSearch"/, "marketing lead list must provide a search field");
assert.match(source, /function marketingLeadTable\(query='',status=''\)/, "lead search and status filters must filter the existing visible dataset");
assert.match(source, /const refreshMarketingLeads=\(\)=>\{const target=document\.getElementById\('mlLeadResults'\)[\s\S]*?listenOnce\(document\.getElementById\('mlSearch'\),'opLeadSearchBound','input',refreshMarketingLeads\)[\s\S]*?listenOnce\(document\.getElementById\('mlStatusFilter'\),'opLeadStatusBound','change',refreshMarketingLeads\)/, "lead search and status filter must refresh results through guarded one-time listeners");
assert.doesNotMatch(form, /messages\[code\]\|\|r\.error\?\.message/, "raw backend error messages must not be exposed to users");
assert.match(edge, /const rawBytes = await readLimitedBody\(req, maxBodyBytes\);[\s\S]*?JSON\.parse\(new TextDecoder\(\)\.decode\(rawBytes\)\)/, "lead API must enforce the request limit using its bounded byte stream before parsing JSON");
assert.match(edge, /typeof body\.title === "string"[\s\S]*?typeof body\.description === "string"/, "lead API must reject non-string title and description values");
assert.match(edge, /body\.service_area !== undefined[\s\S]*?typeof body\.service_area !== "string"[\s\S]*?invalid_service_area/, "lead API must reject non-string service-area values");
assert.match(edge, /rawRequiredServices\.some\(x => typeof x !== "string"\)/, "lead API must reject non-string requested service entries");
assert.match(edge, /typeof budgetMin !== "number" \|\| typeof budgetMax !== "number"/, "lead API must reject string-coerced budget values");
assert.match(edge, /async function readLimitedBody\(req: Request, limit: number\)[\s\S]*?totalBytes \+= value\.byteLength[\s\S]*?if \(totalBytes > limit\)[\s\S]*?await reader\.cancel\(\)[\s\S]*?return null/, "lead API must stop reading oversized request streams before allocating the full body");
assert.match(edge, /try \{\s*chunkResult = await reader\.read\(\);\s*\} catch \{[\s\S]*?await reader\.cancel\(\)[\s\S]*?return new Uint8Array\(\);/, "lead API must handle request stream read failures without an unhandled exception");
assert.match(source, /BACKEND_ONLY_TABLES\.has\(t\)[\s\S]*?عرض آمن عبر مسار خلفي[\s\S]*?لا يتم قراءة هذا الجدول مباشرة من المتصفح/, "overview must not report backend-only tables as empty");
assert.match(source, /function genericLiveView\(d\)[\s\S]*?BACKEND_ONLY_TABLES\.has\(t\)[\s\S]*?الوصول لهذا الجدول يتم عبر مسار خلفي مصرح به فقط[\s\S]*?if\(loadErrors\[t\]\)[\s\S]*?تعذر تحميل البيانات؛ لم يتم اعتبارها فارغة/, "live data view must distinguish backend-only tables and read failures from empty results");
assert.match(source, /الحقول العامة لا تعرض بيانات الاتصال أو الإحداثيات الدقيقة أو الحقول الشخصية الحساسة/, "generic live view must explain personal-data minimization to users");
assert.match(form, /invalid_service_area:\x27أدخل نطاق الخدمة كنص لا يتجاوز 200 حرف\.\x27/, "service-area backend validation errors must have safe Arabic guidance");
assert.match(form, /invalid_title:\x27أدخل عنوانًا صحيحًا لا يتجاوز 200 حرف\.\x27/, "title backend validation errors must have safe Arabic guidance");
assert.match(form, /invalid_description:\x27أدخل تفاصيل الطلب ولا تتجاوز 5000 حرف\.\x27/, "description backend validation errors must have safe Arabic guidance");
assert.doesNotMatch(source, /r\.error\.message|error\.message/, "module actions must not expose raw backend error messages to end users");
assert.match(source, /تعذر تنفيذ العملية بسبب الاتصال أو الصلاحيات\. تحقق من البيانات ثم حاول مرة أخرى/, "generic module failures must use safe actionable Arabic feedback");
assert.match(source, /تعذر إنشاء الطلب بسبب الاتصال أو الصلاحيات\. تحقق من البيانات ثم حاول مرة أخرى/, "education request failures must not leak backend internals");
assert.match(source, /تعذر إرسال الطلب بسبب الاتصال أو الصلاحيات\. تحقق من البيانات ثم حاول مرة أخرى/, "job application failures must not leak backend internals");
assert.match(source, /تعذر تأكيد نشر الطلب بسبب الاتصال أو الصلاحيات[\s\S]*?افتح رحلاتي للتأكد من الحالة قبل إعادة المحاولة/, "ride creation failures must use safe feedback and direct users to verify uncertain state");
assert.doesNotMatch(source, /alert\(data\.error/, "payment API failures must not expose raw server error strings");
assert.match(source, /تعذر بدء الدفع الإلكتروني\. تحقق من حالة الرحلة والاتصال ثم حاول مرة أخرى/, "payment failures must use safe actionable Arabic feedback");
assert.match(source, /async function mgCardPay\(ride\)\{try\{[\s\S]*?تعذر الاتصال بخدمة الدفع الإلكتروني\. لم يتم تأكيد بدء الدفع/, "payment intent network failures must be caught and reported safely");
assert.match(paymentEdge, /\.in\("payment_status",\["REQUIRED","PENDING"\]\)\.is\("provider_intent_id",null\)\.select\("id"\)\.maybeSingle\(\)/, "payment intent persistence must be conditional on an eligible ledger row without a provider intent");
assert.match(paymentEdge, /if\(!persistedIntent\?\.id\)[\s\S]*?Never return a checkout URL unless this exact provider intent was persisted[\s\S]*?PAYMENT_INTENT_STATE_CHANGED/, "checkout must not be returned when a concurrent state change prevented persistence");
assert.match(paymentEdge, /stage:"persist_paymob_intent"[\s\S]*?PAYMENT_INTENT_PERSISTENCE_FAILED/, "payment persistence failures must be logged with a request ID and returned as a safe error code");


assert.match(source, /data-job-form=/, "job applications must use an accessible in-page form rather than browser prompts");
assert.match(source, /aria-expanded="false" aria-controls="job-form-/, "job application toggles must expose their expanded state accessibly");
assert.match(source, /name="qualifications" maxlength="2000" required/, "job qualifications must be required and length-bounded");
assert.match(source, /name="summary" maxlength="5000" required/, "CV summary must be required and length-bounded");
assert.match(source, /role="status" aria-live="polite"/, "job submission feedback must be announced accessibly");
assert.match(source, /sb\.rpc\('submit_job_application_backend'/, "job application must use the existing authorized backend RPC");
assert.match(source, /async function applyJob\(jobId,form\)[\s\S]*?submit\.disabled=true[\s\S]*?submit\.disabled=false/, "job submission must prevent duplicate clicks and restore the button");
assert.doesNotMatch(source, /const qualifications=prompt\('اكتب مؤهلاتك/, "job application must not rely on blocking browser prompts");

assert.match(source, /data-edu-form=/, "education requests must use accessible inline forms rather than browser prompts");
assert.match(source, /aria-expanded="false" aria-controls="edu-form-/, "education request toggles must expose their expanded state");
assert.match(source, /name="studentName" maxlength="120" required/, "education student name must be required and bounded");
assert.match(source, /name="subject" maxlength="200" required/, "education subject or grade must be required and bounded");
assert.match(source, /async function createEducationRequest\(targetId,targetType,form\)[\s\S]*?submit\.disabled=true[\s\S]*?submit\.disabled=false/, "education submission must prevent duplicate clicks and restore the submit button");
assert.match(source, /sb\.rpc\('create_education_request_backend'/, "education form must use the existing authorized backend RPC");
assert.doesNotMatch(source, /const student=prompt\('اسم الطالب/, "education request flow must not rely on blocking browser prompts");

assert.match(source, /data-medical-form=/, "medical booking must use an accessible inline form rather than browser prompts");
assert.match(source, /type="datetime-local" required/, "medical booking must require a date and time");
assert.match(source, /name="reason" maxlength="1000"/, "medical booking reason must have a bounded length");
assert.match(source, /async function medicalBook\(providerId,form\)[\s\S]*?dt\.getTime\(\)<=Date\.now\(\)/, "medical booking must reject invalid or past appointments");
assert.match(source, /sb\.rpc\('create_medical_appointment_backend'/, "medical booking must use the existing authorized backend RPC");
assert.match(source, /async function medicalBook\(providerId,form\)[\s\S]*?submit\.disabled=true[\s\S]*?submit\.disabled=false/, "medical booking must prevent duplicate clicks and restore the submit button");
assert.doesNotMatch(source, /const raw=prompt\('موعد الحجز/, "medical booking flow must not rely on blocking browser prompts");

assert.match(source, /data-mg-bid-form=/, "MantiGO bid form must be identifiable by ride to prevent duplicate forms and duplicate element IDs");
assert.match(source, /const id=b\.dataset\.mgBid,existing=document\.querySelector\('\[data-mg-bid-form\]'\)/, "MantiGO must keep at most one bid form open because its form fields use shared IDs");
assert.match(source, /if\(existing\.dataset\.mgBidForm===id\)[\s\S]*?existing\.remove\(\)/, "repeated bid clicks must focus the existing form and switching rides must remove the previous form");
assert.match(source, /async function mgSubmitBid\(\)[\s\S]*?if\(!button\|\|button\.disabled\)return/, "MantiGO bid submission must ignore repeated clicks while a request is in flight");
assert.match(source, /async function mgSubmitBid\(\)[\s\S]*?button\.disabled=true;button\.textContent='جاري إرسال العرض…'[\s\S]*?finally\{[\s\S]*?button\.disabled=false/, "MantiGO bid submission must restore the submit control after failure while avoiding duplicate requests");
assert.match(source, /تعذر تأكيد إرسال العرض\. راجع قائمة عروضك قبل إعادة المحاولة لتجنب إرسال عرض مكرر/, "ambiguous MantiGO bid network failures must warn users to check existing bids before retrying");

assert.match(source, /function liveColumnLabel\(key\)/, "generic live tables must translate common database column keys for Arabic users");
assert.match(source, /name_ar:/, "live table column labels must include Arabic name fields");
assert.match(source, /payment_status:/, "live table column labels must localize payment status");
assert.match(source, /aria-label="سجلات /, "live data tables must expose an accessible table label");
assert.match(source, /function genericLiveTable\(t,query=''/, "generic module tables must share a reusable search renderer");
assert.match(source, /data-live-search=/, "generic module tables must expose a search field");
assert.match(source, /aria-describedby="live-search-help-\x27\+esc\(t\)\+\x27"/, "generic module search fields must reference contextual help");
assert.match(source, /data-live-clear=/, "generic module search must provide a dedicated clear-search control");
assert.match(source, /querySelectorAll\(\x27\[data-live-clear\]\x27\)[\s\S]*?input\.value=\x27\x27[\s\S]*?genericLiveTable\(t,\x27\x27\)[\s\S]*?input\?\.focus\(\)/, "clear-search controls must reset the input, restore the unfiltered table, and return focus accessibly");
assert.match(source, /data-live-results=/, "generic module search must have a dedicated results target");
assert.match(source, /visibleKeys\.some\(k=>String\(r\[k\]\?\?''\)\.toLocaleLowerCase\(\)\.includes\(needle\)\)/, "generic search must filter only the bounded safe fields rendered to the user");
assert.match(source, /لا توجد نتائج مطابقة للبحث/, "generic table search must distinguish no matches from an empty data source");
assert.match(source, /if\(BACKEND_ONLY_TABLES\.has\(t\)\)return head[\s\S]*?مسار خلفي مصرح به فقط/, "generic search must not bypass backend-only table boundaries");

assert.match(source, /function genericLiveTable\(t,query='',requestedPage=0\)/, "generic module tables must support requested pagination");
assert.match(source, /pageSize=25/, "generic module tables must render a bounded page size");
assert.match(source, /data-live-page=/, "paginated tables must expose previous/next controls");
assert.match(source, /data-live-table=/, "pagination controls must be bound to their own table");
assert.match(source, /aria-label="التنقل بين صفحات السجلات"/, "pagination navigation must have an accessible Arabic label");
assert.match(source, /\[data-live-page\]/, "pagination controls must be wired to update the visible table");

assert.match(source, /const labels=\{overview:'نظرة عامة'[\s\S]*?appointments:'المواعيد'\}/, "module tabs must provide Arabic labels for all shared navigation categories");
assert.match(source, /aria-label="أقسام الوحدة"/, "module navigation must expose an accessible Arabic label");
assert.match(source, /aria-current="[\s\S]*?labels\[x\]\|\|'عرض البيانات'/, "module tabs must expose current navigation state and avoid raw English tab keys");

assert.match(source, /async function loadInternal\(d,generation\)[\s\S]*?function load\(d\)\{const generation=\+\+loadGeneration;return loadInternal\(d,generation\)\.catch\(\(\)=>\{if\(generation!==loadGeneration\)return;loading=false;error='تعذر تحميل بيانات الوحدة بسبب مشكلة مؤقتة في الاتصال\. أعد المحاولة\.';render\(\)\}\)\}/, "unexpected module-load exceptions must be caught with safe retry guidance and stale requests must not overwrite newer module state");

assert.match(source, /loadGeneration=0/, "module loads must use a generation counter to prevent stale asynchronous responses");
assert.match(source, /async function loadInternal\(d,generation\)[\s\S]*?if\(generation!==loadGeneration\)return/, "module loads must discard stale results after asynchronous initialization");
assert.match(source, /function load\(d\)\{const generation=\+\+loadGeneration;return loadInternal\(d,generation\)\.catch\(\(\)=>\{if\(generation!==loadGeneration\)return;/, "stale module-load failures must not overwrite the currently selected module");

// UI data-integrity regression checks: never label failed reads as empty inventories.

assert.match(source, /loadErrors\.jobs\?'<div class="notice" role="alert">تعذر تحميل الوظائف؛ لم نعتبرها فارغة/, "job workspace must distinguish a read failure from an empty jobs list");
assert.match(source, /loadErrors\.school_profiles\|\|loadErrors\.teacher_profiles\?'<div class="notice" role="alert">تعذر تحميل الجهات التعليمية؛ لم نعتبرها فارغة/, "education workspace must distinguish read failures from no providers");
assert.match(source, /loadErrors\.marketing_provider_profiles\?'<div class="notice" role="alert">تعذر تحميل مقدمي الخدمة الطبية؛ لم نعتبر القائمة فارغة/, "medical provider workspace must distinguish read failures from no providers");

assert.match(source, /function marketingLeadTable\(query='',status=''\)/, "marketing lead list must support search and status filtering");
assert.match(source, /id="mlStatusFilter"/, "marketing leads must expose a status filter");
assert.match(source, /id="mlClearFilters"/, "marketing lead filters must be resettable");
assert.match(source, /لا توجد طلبات تطابق البحث والتصفية الحالية/, "filtered empty results must be explained clearly");
assert.match(source, /refreshMarketingLeads/, "search and status controls must refresh the same results view");

assert.match(source, /new Date\(r\.date_time\)\.toLocaleString\('ar-EG'\)/, "ISO appointment timestamps must be parsed as date strings rather than coerced to numbers");


assert.match(source, /const nextTab=b\.dataset\.opTab;tab=nextTab/, "MantiGO tab navigation must use the selected tab consistently");
assert.match(source, /b\.disabled=true;b\.setAttribute\('aria-busy','true'\)/, "open-rides loading must prevent duplicate requests and expose busy state");
assert.match(source, /catch\{if\(generation===loadGeneration&&current==='MantiGO والنقل'&&tab==='open'\)\{rows\.mantigo_open=\[\];loadErrors\.mantigo_open=\{message:'NETWORK_OR_RPC_FAILURE'\}\}\}/, "open-rides network exceptions must become visible safe load failures");
assert.match(source, /if\(generation!==loadGeneration\|\|current!=='MantiGO والنقل'\|\|tab!=='open'\)return/, "late open-rides responses must not overwrite a newer navigation state");
assert.match(source, /if\(b\.isConnected\)\{b\.disabled=false;b\.removeAttribute\('aria-busy'\)\}/, "open-rides controls must recover after success or failure");
const rideCreate = source.slice(source.indexOf("async function mgCreateRide()"), source.indexOf("function mantigoOpenRides()"));
assert.match(rideCreate, /btn\?\.dataset\.idempotencyKey\|\|\(crypto\.randomUUID/, "ride creation must reuse the same idempotency key after uncertain outcomes");
assert.match(rideCreate, /catch\{[\s\S]*?انقطع الاتصال قبل تأكيد نشر الطلب/, "ride creation network exceptions must show safe guidance instead of leaving an unhandled rejection");
assert.match(rideCreate, /finally\{[\s\S]*?btn\.removeAttribute\('aria-busy'\)/, "ride creation controls must recover from success, server errors, and network exceptions");
assert.match(rideCreate, /if\(!user\?\.id\)return alert\('انتهت جلسة الدخول/, "ride creation must fail safely when the session is unavailable");



assert.match(source, /function shell\(d,body\)[\s\S]*?const accessContext=membershipLoadError\?/, "module shell must show membership verification failure rather than silently implying full access");
assert.match(source, /تم إخفاء البيانات التي تحتاج إلى نطاق مؤسسي/, "membership lookup failure must explain that scoped data is hidden safely");
assert.match(source, /module-access-context[\s\S]*?تم تحميل العضوية النشطة/, "module shell must show when an active membership context was loaded");
assert.match(source, /لا توجد عضوية مؤسسة نشطة لهذا الحساب/, "module shell must explain missing active membership context");
assert.match(source, /roleLabels=\{OWNER:'مالك المؤسسة'/, "membership roles must be rendered in Arabic instead of exposing role codes");

// Navigation observation is event-driven: avoid polling the entire document every 800ms.
assert.match(source, /new MutationObserver\(observe\)\.observe\(document\.body,\{childList:true,subtree:true\}\);observe\(\);/, "module navigation must initialize once and react to DOM mutations without periodic polling");
assert.doesNotMatch(source, /setInterval\(observe,\s*800\)/, "module navigation must not poll the document every 800ms");



// Fail closed when prior user-owned state cannot be verified.

assert.match(source, /if\(loadErrors\.job_applications\)return shell\(defs\['الوظائف'\][\s\S]*?تم إيقاف التقديم مؤقتًا حتى لا يظهر الحساب وكأنه لم يتقدم/, "job applications must be blocked when prior application state cannot be verified");
assert.match(source, /loadErrors\.education_requests\?'<tr><td colspan="4">تعذر تحميل الطلبات السابقة؛ أعد المحاولة/, "education request history must not show a false empty state after a read failure");
assert.match(source, /if\(tab==='appointments'\)return shell\(d,tabs\(d\)\+\(loadErrors\.medical_appointments\?'<div class="notice" role="alert">تعذر تحميل مواعيدك؛ لم نعتبر القائمة فارغة/, "medical appointment history must distinguish read failure from no appointments");


assert.ok(source.includes("sensitiveKey=/(?:access.?token|refresh.?token|id.?token|token|secret|password|passwd|credential|authorization|cookie|session|private.?key|api.?key|webhook.?payload|raw.?payload|headers|metadata|e.?mail|phone|mobile|address|latitude|longitude|current.?lat|current.?lon|pickup.?lat|pickup.?lon|destination.?lat|destination.?lon|patient|student.?name|customer.?name|captain.?name|full.?name|first.?name|last.?name|date.?of.?birth|emergency.?contact|private.?note)/i"), "generic module tables must exclude secrets, contact details, precise coordinates, and sensitive personal fields");
assert.match(source, /sensitiveKey=\/[\s\S]*?e\.\?mail[\s\S]*?latitude[\s\S]*?patient[\s\S]*?\/i/, "generic module tables must exclude contact details, precise coordinates, and sensitive personal fields");
assert.match(source, /visibleKeys=keys\.slice\(0,8\)/, "generic module tables must render only the bounded safe field list");
assert.match(source, /visibleKeys\.map\(k=>'<th scope="col">'/, "generic table headers must match safe displayed columns and expose semantic column scope");

// Accessibility contracts for shared module navigation, tables, and loading feedback.
assert.match(source, /data-op-tab=.*aria-pressed/, "module navigation buttons must expose their selected state");
assert.match(source, /<th scope="col">/, "data tables must mark column headers semantically");
assert.match(source, /class="table-wrap" role="region" aria-label="جدول البيانات" tabindex="0"/, "data tables must be keyboard-scrollable and labelled");
assert.match(source, /role="status" aria-live="polite">جاري تحميل البيانات الفعلية/, "loading feedback must remain available to assistive technology");

// MantiGO bid-form contracts: bounded inputs, accessible feedback, and strict numeric validation.
const bidForm = source.slice(source.indexOf("function mantigoBidForm("), source.indexOf("async function mgSubmitBid()"));
const bidSubmit = source.slice(source.indexOf("async function mgSubmitBid()"), source.indexOf("async function mgAccept("));
assert.match(bidForm, /label for="mgBidModel"[\s\S]*maxlength="80"/, "captain bid fields must have associated labels and bounded vehicle-model input");
assert.match(bidForm, /id="mgBidPlate"[^>]*maxlength="30"/, "captain bid plate input must be bounded");
assert.match(bidForm, /id="mgBidPrice"[^>]*max="10000000"[^>]*step="0\.01"/, "captain bid price must declare a finite maximum and decimal step");
assert.match(bidForm, /id="mgBidEta"[^>]*max="1440"[^>]*step="1"/, "captain ETA must be bounded to an integer minute range");
assert.match(bidForm, /role="status" aria-live="polite" data-mg-bid-status/, "bid form must announce validation and submission feedback accessibly");
assert.match(bidSubmit, /if\(!model\|\|!plate\)/, "captain bid must require vehicle model and plate");
assert.match(bidSubmit, /!Number\.isFinite\(price\)\|\|price<=0\|\|price>10000000/, "captain bid must reject non-finite, non-positive, and excessive prices");
assert.match(bidSubmit, /!Number\.isInteger\(eta\)\|\|eta<0\|\|eta>1440/, "captain bid must reject fractional, negative, and excessive ETA values");
assert.match(bidSubmit, /message.length>500/, "captain bid message length must be bounded in the client");
assert.match(bidSubmit, /setStatus\('أكمل موديل المركبة ورقم اللوحة قبل إرسال العرض\.',true\)/, "captain bid validation errors must provide clear Arabic feedback");

// UI binding regression contracts.
assert.match(source, /async function init\(\)\{const s=await sb\.auth\.getSession\(\)/, "module initialization must be async before awaiting the auth session");
assert.match(source, /function listenOnce\(element,key,event,handler\)/, "workspace event binding must have a one-time listener helper");
assert.match(source, /opSaveLeadBound/, "marketing lead save must be bound at most once per rendered control");
assert.match(source, /opLeadSearchBound/, "marketing lead search must not accumulate duplicate input handlers");
assert.match(source, /liveSearchBound==='true'/, "live table search must guard against duplicate event handlers");
assert.match(source, /liveClearBound==='true'/, "live table clear controls must guard against duplicate event handlers");
assert.match(source, /jobSubmitBound==='true'/, "job application forms must not submit multiple times from duplicate listeners");
assert.match(source, /eduSubmitBound==='true'/, "education request forms must not accumulate submit handlers");
assert.match(source, /medicalSubmitBound==='true'/, "medical booking forms must not accumulate submit handlers");

assert.match(source, /opReloadBound/, "reload control must not stack click handlers during nested form binding");
assert.match(source, /mgLocationBound/, "MantiGO location control must bind once per rendered instance");
assert.match(source, /!navigator\.geolocation&&!window\.MNTYLocationAdapter\?\.requestLocation/, "MantiGO must allow the configured location adapter when browser geolocation is unavailable");
assert.match(source, /try\{p=await mgGetCurrentPosition\(\)\}catch\{p=null\}finally\{if\(b\.isConnected\)\{b\.disabled=false;b\.removeAttribute\('aria-busy'\)/, "MantiGO location control must recover its enabled state if the location provider throws");
assert.match(source, /!Number\.isFinite\(p\.lat\)\|\|!Number\.isFinite\(p\.lon\)/, "MantiGO must reject invalid coordinates before populating the pickup field");
assert.match(source, /mgCreateRideBound/, "ride creation control must not accumulate click handlers");
assert.match(source, /mgSubmitBidBound/, "bid submission control must not accumulate click handlers");
assert.match(source, /mgApplyCaptainBound/, "captain application control must bind once per rendered instance");

console.log("Marketing lead form validation contract PASS.");
