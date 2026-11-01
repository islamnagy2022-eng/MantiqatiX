# Directory Discovery Progress — Berket El Sabaa

Last updated: 2026-10-29

## Scope

Only Berket El Sabaa city and the villages, hamlets, and administrative dependencies belonging to Berket El Sabaa Markaz, Monufia Governorate, Egypt. Do not attribute listings from other centers to this scope.

## Initial verified audit

- Repository: `islamnagy2022-eng/MantiqatiX`, default branch `main`.
- Canonical taxonomy source: `apps/catalog-frontend/src/data/productionDefaults.ts`.
- Code currently defines 18 functional groups and 221 `CATEGORY_SEEDS` entries. This is the source seed count, not a claim about the effective categories loaded by the live UI or saved settings.
- Medical taxonomy has 17 seeds: 9 activity categories and 8 profession categories.
- Production table `public.public_directory_listings` had 348 rows immediately before the latest administrative-services batch; RLS is enabled.
- Existing category settings may be merged with canonical defaults, so changing seed definitions alone is not sufficient to guarantee old categories disappear. A mapping and read/write compatibility review is required before consolidation to 50 categories.

## Work completed in this session

### Medical group — initial batch

- Reviewed existing medical taxonomy IDs and queried current directory rows before adding new entries.
- Searched public medical directory sources for Berket El Sabaa listings.
- Added 3 public-source doctor listings after a cross-catalog name/phone anti-duplicate check:
  1. د. هيثم البلتاجي عبد القادر — 0482913270; secondary 0482998467; source: https://dalil140.com/category/ar/doctors/el-monofeya/berket-el-sabaa
  2. د. إيهاب محمد البلشي — 0482994199; secondary 0482998880; source: https://dalil140.com/category/ar/doctors/el-monofeya/berket-el-sabaa
  3. د. عادل عبد الكريم بدوي — 01112480327; source: https://dalil140.com/category/ar/doctors/el-monofeya/berket-el-sabaa
- The new records are `PUBLISHED` and `UNCLAIMED`, with owner confirmation required and source phone verification set to false.
- Database returned all 3 inserted rows after write.
- Existing matching doctors already in the database were not reinserted.
- Added 1 pharmacy in Genzour after a cross-catalog name/phone check: صيدلية إسلام داوود — 0489136699; source: https://www.dalilmadina.com/city_clinic.aspx?NUM=241. The record is PUBLISHED/UNCLAIMED; owner confirmation required; source phone not directly verified with owner.
- Added 2 more pharmacies after a cross-catalog name/phone check: صيدلية سهام — 0482913190 (near Berket El Sabaa Hospital) and صيدلية د. أحمد حسن — 0482270049 (Malig village). Source: https://dalil140.com/category/en/pharmacies/el-monofeya/berket-el-sabaa. Both records are PUBLISHED/UNCLAIMED; owner confirmation required; source phone not directly verified with owner.

### Food & grocery group — initial batch

- Used the Egypt Yellow Pages restaurant listing for Berket El Sabaa: https://yellowpages.com.eg/en/category/berket-el-sabaa-restaurants/3829.
- Compared candidate names against current catalog records. Existing records such as مطعم الأصلي, مطعم المحلاوي, مطعم جابر عمر, حكاية, كشري الباشا, حلويات ياقوت, and مخبز الحرمين were not reinserted.
- Added 9 listings from source names/addresses where no matching existing record was found: مطعم أبو رضوى; مخبز علا بركات الله; مطعم الحرمين; مطعم الملكي; مطعم السلطان; مطعم الزعيم; مطعم إيطاليا; كشري فيينا; مطعم سويت هوم.
- Source page did not expose phone numbers in the retrieved listing; phone fields were left empty rather than guessed. All 9 are PUBLISHED/UNCLAIMED with owner confirmation required and source phone verification false.
- Used the Egypt Yellow Pages supermarket directory https://yellowpages.com.eg/en/category/berket-el-sabaa-supermarkets/3829 and inserted 8 additional businesses after comparing names against existing records: سوبر ماركت أبو عفيفي; سوبر ماركت الإسكندراني; سوبر ماركت الشاذلي; سوبر ماركت الزيات; سوبر ماركت فرح; حمادة ماركت; هاني ماركت; وائل ماركت. Phone numbers were not shown in the source and were left empty.
- Corrected the existing record for مركز د. محمد أحمد المراكبي للأسنان from the individual-dentist category to the dental-centers activity category, preserving its ID, slug, contact information, source, and status.
- The pharmacy review also confirmed that four other village pharmacy records from the same source already existed, so they were not duplicated.

## Still open

- [DONE] Corrected the classification for `مركز د. محمد أحمد المراكبي للأسنان` to `cat_medical_health_dental_centers` while preserving the record.
- Complete a source-backed administrative list of all villages/hamlets/dependencies of Berket El Sabaa.
- Continue medical discovery by specialty and village; query more than one source and compare against all current listings before each batch.
- Review medical listings with incomplete specialty/location metadata.
- Design a safe canonical 50-category mapping, including persisted settings and legacy category IDs, before implementing any broad migration.
- Continue through the other 17 functional groups, only within the stated geographic scope.
- Run relevant data and UI tests after each batch and record actual results.

## Current status

Partial execution started: 34 verified insertions across the documented batches (3 doctors, 3 pharmacies, 17 food businesses/markets, 11 public/community service listings). This is not a completed directory, not a completed 50-category migration, and not a deployment certification.


### Public & community services — additional batch (2026-10-29)

- Queried the current database before insertion. Existing matches included مركز شباب الدبايبة and مكتب تسوية المنازعات الأسرية بركة السبع; those were not reinserted.
- Added 11 records and verified the returned rows after write: الإدارة التعليمية ببركة السبع; مركز شرطة بركة السبع; السجل المدني ببركة السبع; بيت ثقافة بركة السبع; مكتب بريد بركة السبع; مكتب عمل بركة السبع; مأمورية الضرائب العامة ببركة السبع; مكتب الشهر العقاري ببركة السبع; مكتب التأمينات الاجتماعية ببركة السبع; مكتب تموين بركة السبع; وحدة مرور بركة السبع.
- Source: [Egypt Yellow Pages — public/government services in Berket El Sabaa](https://yellowpages.com.eg/en/category/berket-el-sabaa-ministries-%26-government-organizations/3829), with the civil registry and social insurance profile pages used for cross-reference.
- Source pages did not expose direct phone numbers in the retrieved content, so phone fields were left empty. Records are PUBLISHED/UNCLAIMED, with owner confirmation required and source phone verification false.
- The source lists both a Real Estate Registration Mission and a Real Estate Registration Office at the same local court/address. The inserted listing includes a metadata note that the source names may refer to related offices; do not merge or delete without further verification.
- Current row-count evidence: 348 rows before this batch; 11 rows returned by insert; expected table total is 359 if no concurrent writes occurred. Re-query the total before reporting a definitive current count.


### Auto parts + agriculture supplies — next batch (2026-10-29)

- [x] Checked existing local listings before adding new candidates. Existing records for الجودة, الصفا, هاني, أكتوبر, and حجاج were found and retained rather than recreated.
- [x] Filled missing phone fields for three existing matching auto-parts records from the Dalil140 Berket El Sabaa auto-parts source: أكتوبر (01003811434), الصفا (01009088919; secondary 01001722747), and هاني (01111026219). Existing non-empty phone values were not overwritten. Source: https://dalil140.com/category/en/cars-parts-accessories/el-monofeya/berket-el-sabaa.
- [x] Inserted 8 read-after-write verified public-source candidates within the administrative scope: أولاد غنيم لقطع غيار السيارات; الكابتن لقطع غيار السيارات (جنزور; phone not surfaced in returned result); المهندس لقطع غيار السيارات (كفر عليم); إبراهيم جودت لقطع غيار السيارات; نوح إيسوزو لقطع غيار السيارات (كفر هلال); العنتر لقطع غيار السيارات والإكسسوارات; شركة الأمل لاستيراد المعدات الزراعية (جنزور); شرف الدين للمبيدات والبذور والأسمدة الزراعية.
- [x] New listings are PUBLISHED/UNCLAIMED, require owner confirmation, and are not represented as owner-verified. For records where a source supplied a phone, it is marked as public-source data, not direct verification with the business.
- [ ] Continue broad global duplicate checks by normalized phone and normalized name across the entire directory before every further insertion; do not merge distinct branches or shared-contact businesses without evidence.
- [ ] Revisit agricultural candidate leads (including حجاج and additional village suppliers) for missing phone/location details and confirm all villages are within Berket El Sabaa's administrative scope.


### Legal services — local listings batch (2026-10-29)

- [x] Queried existing professional-services records first. Existing مكتب محاماة حمدي حافظ فهمي was found and not duplicated.
- [x] Added 17 local law-office listings from the Egypt Yellow Pages Berket El Sabaa lawyer directory; names/addresses were retained from the directory and Arabic transliterations are best-effort display names: أحمد محمد جبر; أحمد زكي البهنسي; علاء الشاعر; علاء سمير بدر; عمرو عبد الفتاح بدوي; أشرف إبراهيم عمارة; مكتب العدل (كفر هلال); الدسوقي البرماوي; إيمان عبد الحميد الصاوي; فؤاد محمد لاشين; جمال عيسى; هيثم إبراهيم الشريف; حامد إبراهيم الشريف; هاني أبو طالب; هاني سلامة; هبة حلمي المهدي; إبراهيم أحمد عناني.
- [x] Phone fields were left blank because the category page did not surface numbers in the retrieved result. Listings are PUBLISHED/UNCLAIMED, with owner confirmation required and no direct phone verification claimed.
- Source: https://yellowpages.com.eg/en/category/بركة-السبع-محامين/3829.
- [ ] Verify Arabic spellings, exact office identity, and contact details with the businesses before marking these entries confirmed. A name/address in a public directory is a lead, not proof of current operation or bar membership.


### Medical group — pharmacy discovery follow-up (2026-10-29)

- [x] Queried current pharmacy records by name before inserting the next batch; existing records for صيدليات د. عبد الحميد الجندي, صيدلية أحمد فرج, and صيدلية د. محمد صبري were found and not duplicated.
- [x] Added 5 pharmacy directory leads after checking current records: صيدلية ابن سينا (phone not exposed by source and left blank), صيدلية أحمد سليمان (phone not exposed and left blank), صيدلية مكة (0482994571), صيدلية فتحي الجديدة (0482994595), and صيدلية د. علاء فرج in مليج (0482272400).
- [x] Source pages: https://healtheg.com/en/Results/Pharmacies/City-monofiya/area-berket-alsab3 and Med.tn pharmacy directory pages for Berket El Sabaa listings. These numbers are public-directory data, not direct owner verification.
- [x] Corrected an initially entered unsubstantiated phone for صيدلية ابن سينا immediately after review; phone is now NULL because the source did not provide it. Do not treat the record as phone-verified.
- [ ] Continue the same name + normalized-phone duplicate checks across the whole catalog and verify all source-derived contact details with owners before marking any record confirmed.


## 2026-10-29 — Phone-required publication gate

- [x] Applied a production database guard: a listing cannot have `listing_status='PUBLISHED'` unless its primary or secondary phone contains at least 7 digits.
- [x] Moved all existing published listings with no primary or secondary phone to `DRAFT` without deleting records, changing IDs/slugs, or inventing contact data. They remain available for admin completion.
- [x] Read-after-write verification: **284 PUBLISHED listings, zero without a phone; 105 DRAFT listings without a phone** awaiting verified contact data.
- [x] Updated and deployed Edge Function `directory-listings` version 7. Its `UPSERT_LISTING` action now rejects publication without a valid phone and returns `PHONE_REQUIRED_FOR_PUBLICATION`.
- [ ] Continue discovery only with a source-backed phone number; add each eligible record idempotently, verify it after insertion, and publish it immediately only when the phone passes the 7-digit check. A directory number is still not direct owner verification.

- [x] Follow-up after the gate was deployed: added **صيدلية سمية سعيد — 0482964400** in جنزور from the public Med.tn directory after checking the database for the phone/name. Insert read-back confirmed `PUBLISHED/UNCLAIMED`; the phone is source-derived, not owner-verified. Based on the prior verified 284 published count plus this one successful insert, expected published total is 285; re-run the inventory count when query checks allow.


## 2026-10-29 — Phone-backed technology and mobile listings

- [x] Filled source-backed phones on existing listings without creating duplicates: العربية للكمبيوتر (0482914114; 01005782130), سوفت لخدمات الكمبيوتر (0482915021; 01000729093), دريم للكمبيوتر (01007146122 secondary), الأهلية للكمبيوتر (01001342501 secondary), العالمية مول لخدمات الكمبيوتر (01144662023 secondary), والصفوة للموبايلات (01225950140). The first two were DRAFT and were published after their phone fields were populated; the others retained their existing IDs and slugs.
- [x] Added 8 source-backed, phone-bearing listings: العراقي للكمبيوتر (01113745541), جولدن لاين لخدمات الكمبيوتر (01062627430), صن رايز للكمبيوتر (0482994337; 01007123075), يونكس للكمبيوتر (01007094409), مالك لخدمات الكمبيوتر (01117878488; 01154460781), ندى للموبايلات (0482998244; 01221667001), غاوي خسارة للموبايلات (01005398652), جاري الشحن للموبايلات (0482915227; 01001827888). Each insertion was read-after-write verified as PUBLISHED/UNCLAIMED.
- [x] Inventory check after the batch: **296 PUBLISHED listings, zero without primary or secondary phone; 102 DRAFT listings without phone** remain hidden until a sourced number is found. Database constraint and deployed Edge Function continue enforcing the publication gate.
- [x] Sources: [Dalil140 computer hardware in Berket El Sabaa](https://dalil140.com/category/ar/computer-hardware/el-monofeya/berket-el-sabaa), [Arabeya Computer detail](https://dalil140.com/company/ar/102547-el-arabeya), [Malek Computer Services detail](https://dalil140.com/company/ar/105170-malek-computer-services), and [Dalil140 mobile phones and accessories in Berket El Sabaa](https://dalil140.com/category/ar/mobile-phones-accessories/el-monofeya/berket-el-sabaa).
- [ ] Public directory phone numbers are source-backed but not owner-verified; keep owner-confirmation metadata and do not treat these leads as confirmed business claims.


## 2026-10-29 — Building materials and medical-service expansion

- [x] Added and read-after-write verified four phone-bearing medical-service pages: مستشفى الأمل ببركة السبع (0482994559), مركز الشفاء للعلاج الطبيعي (01115417465; 01069671338), مركز العلاج الطبيعي بكفر الحمادية (0489137678), and المركز التخصصي للأطفال (0482998900). Categories follow the directory's local hospital/medical-center list; owner/service verification remains pending.
- [x] Added two new building-materials leads: أبو صبيحة للأسمنت (0489137904; 01273399775) and الرياح لمواد البناء (0482914653; 01280588871), after checking names/phones. Existing أبو النصر للمقاولات was retained and its listed secondary phone 01007374175 filled from its detail page.
- [x] Latest production read-after-write inventory: **302 PUBLISHED listings, zero without a primary or secondary phone; 102 no-phone records remain DRAFT**. Database publication constraint remains in force; deployed Edge Function version 7 rejects publish attempts without a usable phone.
- [x] Sources: [Dalil140 hospitals/medical centres in Berket El Sabaa](https://dalil140.com/category/ar/hospitals-medical-centers/el-monofeya/berket-el-sabaa), [Dalil140 cement/concrete/brick directory](https://dalil140.com/category/ar/cement-concrete-gypsum-brick/el-monofeya/berket-el-sabaa), [Dalil140 local building-materials directory](https://dalil140.com/category/en/building-materials/el-monofeya/berket-el-sabaa), and [Abou El Nasr contracting detail](https://dalil140.com/company/en/109620-abou-el-nasr-contracting).
- [ ] Continue checking local activity coverage, normalize and compare names/primary+secondary phones before every write, and keep public-source numbers unverified by owner until direct confirmation.


## 2026-10-29 — Publish eligible food listings; preserve duplicate history

- [x] Filled numbers from Dalil140 on existing restaurant records, including secondary phones for أبو رضوى, إيطاليا, حكاية, الأصلي, and الشمندورة. Did not create parallel public records for their already-published identities.
- [x] Published 9 phone-backed drafts after read-after-write verification: كشري فيينا (0482911265), مخبز الحرمين (01221068785), مخبوزات المدينة المنورة (01283660771), مخبوزات على بركة الله (01003639251), مطعم الحرمين (01128397243), مطعم الملكي (01112985045), مطعم السلطان (01220727600), مطعم الزعيم (01065250977), and مطعم سويت هوم (01128557173).
- [x] Updated existing حمادة ماركت with source phone 01274530432; published after the phone was supplied.
- [x] Added 9 phone-backed food leads: 4 spice/herb shops (المدينة، الباشا، السلطان، أم القرى), 4 butcher shops (أبو حسني، التوفيق، جنة اللحوم، سمير حسني), and خضار طازة. The same primary phone appears for أبو حسني and سمير حسني at different listed addresses; both records are retained separately with a shared-number review note, not merged based on phone alone.
- [x] Resolved two high-confidence duplicate drafts without deleting them: duplicate أبو رضوى and duplicate إيطاليا drafts were set to HIDDEN with a pointer to each canonical published slug. The possible duplicate مخبز علا بركات الله remains DRAFT and flagged for identity review because the near-identical name/address do not conclusively prove identity.
- [x] Latest inventory check: **321 PUBLISHED (zero without phone), 90 DRAFT (all without phone), 2 HIDDEN duplicate-review records (both without phone)**. Database check constraint remains active; Edge Function version 7 enforces the same publication rule.
- [x] Sources: [Dalil140 restaurants in Berket El Sabaa](https://dalil140.com/category/ar/restaurants/el-monofeya/berket-el-sabaa), [spices and herbs](https://dalil140.com/category/ar/spices-herbs/el-monofeya/berket-el-sabaa), [butchers](https://dalil140.com/category/ar/butchers/el-monofeya/berket-el-sabaa), [fresh produce](https://dalil140.com/category/ar/fruits-vegetables-shops/el-monofeya/berket-el-sabaa), and [supermarkets in Monufia](https://dalil140.com/category/ar/supermarkets/el-monofeya).
- [ ] Directory numbers remain source-derived, not owner-verified. Keep all owner-confirmation flags, and resolve the shared butcher phone and possible bakery identity with direct verification before declaring them confirmed.


## 2026-10-29 — Wholesale food and food manufacturing expansion

- [x] Added 10 unique local wholesale/food-manufacturing records after name/phone duplicate checks, all inserted as PUBLISHED only with a source-backed phone and then read-after-write verified: بكز عزوز - للجملة (01200869963); أبو سليمان للمواد الغذائية جملة — كفر هلال (01283665350); خالد رخا للمواد الغذائية — جنزور (0482962086); شركة نايس فودز للصناعات الغذائية (0482991808); منتصر ماركت للجملة (01200818171); التهامي جملة (01000610671); الخير والبركة للمواد الغذائية — الغوري (01025627227); الطازج للمجمدات واللحوم (01023334448); شركة الماسة للمواد الغذائية والمياه الغازية — الروضة (01004441788); شركة كيمت للصناعات الغذائية والتعبئة والتغليف — الغوري (01007440136).
- [x] Added 6 food-processing/manufacturing records from the local Dalil140 food-producer category, plus the Egyptian Australian food industries company from Find in Egypt: المصطفى للصناعات الغذائية (01065264169); الصعيدي لمنتجات الأغذية (0482913291; 01288775191); أولاد مالك للصناعات الغذائية (01223754388); محمد حموده لمنتجات الأغذية (01069553031); صبحي لمنتجات الأغذية (01099212762); الشركة المصرية الأسترالية للصناعات الغذائية (0482994427; 01016618444). All are read-after-write verified PUBLISHED/UNCLAIMED.
- [x] Latest database inventory: **337 PUBLISHED, zero missing phone; 90 DRAFT records without phone; 2 HIDDEN no-phone records held for duplicate review**. The phone-required database constraint and deployed Edge Function v7 remain active.
- [x] Sources: [Dalil140 — food producers and processors in Berket El Sabaa](https://dalil140.com/category/ar/food-producers-processors-equipment/el-monofeya/berket-el-sabaa), [Find in Egypt — Egyptian Australian Food Industries](https://www.findinegypt.com/c/the-egyptian-australian-co-for-food-industries-201353), and direct local Google Maps business search links stored on each relevant record.
- [ ] Public-source contact numbers are not owner-verified. Keep the listings unclaimed and require direct confirmation before marking contact details or active status as verified. Coverage remains in progress, not exhaustive.


## 2026-10-29 — Auto-service, tyres, and aluminum workshop batch

- [x] Added six unique local activities with phone numbers after pre-insert name/phone checks: الأمين للإطارات والبطاريات (01224432916); شركة سرور للإطارات والبطاريات والجنوط — كفر عليم (01091411500); خطاب للكاوتش والبطاريات (01016272991); معرض الفايز للإطارات والبطاريات — هورين (01008791696); مسعود غنام لميكانيكا السيارات — كفر عليم (01000336043); ورشة المختار للألوميتال (0482996373; 01006782967). All insertions were read-after-write verified PUBLISHED/UNCLAIMED.
- [x] Did not duplicate already-existing حمادة لصيانة السيارات or مركز القبطان لصيانة سيارات النقل; their same phone numbers and existing rows were detected before insertion.
- [x] Latest inventory: **343 PUBLISHED / 0 without phone; 90 DRAFT / 90 without phone; 2 HIDDEN / 2 without phone**. Phone-required DB constraint and deployed directory-listings Edge Function v7 remain active.
- [x] Sources: [Find in Egypt — Hamada auto service](https://www.findinegypt.com/c/hamada-258787), [Dalil140 — El Mokhtar aluminum workshop](https://dalil140.com/company/en/11621-el-mokhtar-workshop), and local Google Maps business results stored on each listing. Local tire/auto listings were selected from Berket El Sabaa city and affiliated villages; unrelated Cairo/Shibin El Kom listings were excluded.
- [ ] Public phone values still need direct owner confirmation; continue auditing duplicate names/phones and village-level coverage before marking any record confirmed.


## 2026-10-29 — Normalized duplicate audit and specialty correction

- [x] Full normalized-name audit of PUBLISHED rows now returns **zero duplicate-name groups** after review. The audit normalizes whitespace/punctuation, Arabic alef variants, and alif maqṣūra/yā.
- [x] Published primary/secondary phone audit returns one shared phone across different local butcher names/addresses: 01225953508 for جزارة أبو حسني and جزارة سمير حسني. Both remain separately listed; metadata explicitly flags direct review. No automatic merge based on phone alone.
- [x] Preserved duplicate rows but hid confirmed duplicate copies (no deletion): العطوي للأجهزة المنزلية → berket-home-atwy; صيدلية فتحي الجديدة → pharmacy-48eb089f66f293a2; صيدلية ابن سينا → pharmacy-38c0d86c4d8c8bb4; صيدلية أحمد سليمان → berket-ahmed-soliman-pharmacy; هاني ماركت → berket-hany-market. Earlier duplicate copies of أبو رضوى and إيطاليا remain HIDDEN with canonical slugs. IDs, slugs, phone/source fields remain on the hidden records.
- [x] Reclassified the appliance shop (including its hidden duplicate record) to a dedicated category, `cat_home_maintenance_home_appliances`, and added seed `home_appliances` to `apps/catalog-frontend/src/data/productionDefaults.ts` with specialties for refrigerators, washing machines, AC units, screens, ovens, heaters, and kitchen appliances. The prior homewares classification was not precise enough for an appliance retailer. Code commit: `c40a910fb14fe95a084f15c41e8094f49e38f5e4`.
- [x] Latest production count after duplicate resolution: **341 PUBLISHED (0 missing phones), 87 DRAFT (all 87 missing phones), 7 HIDDEN (5 no-phone; two duplicate-hidden rows have phones)**. The database publication constraint remains active; the directory-listings Edge Function remains deployed at version 7.
- [ ] The category seed is committed but build/Pages deployment status was not retrievable from the available workflow endpoint; do not claim the new category is live until a successful validation/deploy is confirmed.


## 2026-10-29 — Poultry and veterinary listings; latest duplicate gate audit

- [x] Added 5 local phone-backed entries with read-after-write confirmation as PUBLISHED/UNCLAIMED: الأندلس لمحلات الدواجن (01006068424; 01006561699), طيور الرحمة (01060048003; 01229933380), الشريف للدواجن (0489136313; 01006278628), الشركة الوطنية للدواجن (01090178215), and مركز د. مسعد البلتاجي البيطري - عيادة د. سمر حامد (01284040763). The last record stays separate from other veterinary entries because its public listing has a distinct name/phone, with a metadata note to confirm whether it shares a site with مركز د. مسعد البلتاجي.
- [x] Resolved two more exact duplicate pairs found in live data: أولاد غنيم لقطع غيار السيارات and نورتوك للأعلاف. In both cases the newer row was set HIDDEN with a pointer to the canonical slug; nothing was deleted. The canonical Nortok row was reclassified from general agricultural supplies to the existing animal-feed category, and both rows now carry the correct animal-feed taxonomy.
- [x] Latest inventory read: **358 PUBLISHED with 0 missing phone; 87 DRAFT with 87 lacking phones; 9 HIDDEN (5 without phone)**. Phone-required database check and deployed directory-listings Edge Function v7 remain in force.
- [x] Combined normalized audit on PUBLISHED rows shows **zero duplicate-name groups**. One same-number group remains for different butcher names/addresses (01225953508: جزارة أبو حسني and جزارة سمير حسني). They remain separate and flagged for direct identity verification; no auto-merge by phone.
- [x] Source: [Dalil140 local poultry shops](https://dalil140.com/category/ar/poultry-shops/el-monofeya/berket-el-sabaa), [Dalil140 veterinarians](https://dalil140.com/category/en/veterinarians/el-monofeya/berket-el-sabaa), and Google Maps local veterinary business result stored in the listing.
- [ ] Public-source phone details are not owner-verified. Keep claim status UNCLAIMED and confirmation flags until direct confirmation. The new home-appliance category seed remains committed but frontend build/deployment has not been verified.


## 2026-11-01 — National doctor directory expansion baseline

- Owner request: expand doctor listings across all 27 Egyptian governorates, with each physician attached to the actual clinic address/location.
- Read-only live Supabase snapshot (public.public_directory_listings, listing_type='doctor'): **57 published doctor records, all in المنوفية / بركة السبع; 1 governorate represented; 0 records with latitude+longitude in recognized metadata fields**. This supersedes older notes that counted only the three records added in the initial local doctor batch; the live total includes all subsequent local doctor additions.
- No nationwide doctor records were found in the current live doctor listing type outside Berket El Sabaa. This is the verified baseline, not a claim that other doctor-type records do not exist under different listing types/taxonomy.
- The existing listing schema stores address, governorate, district and village, and permits richer metadata; it has no dedicated latitude/longitude columns. The public directory Edge Function only allows SUPER_ADMIN with permissions.scope=PLATFORM and full_control=true to upsert. Publication requires a phone number with at least seven digits. RLS is enabled and FORCE RLS is active; direct public table grants are revoked.
- Source discovery: Dalil140 exposes Egypt-wide and governorate/specialty doctor pages with names, phone numbers and addresses; Egyptian Medical Syndicate describes an official lookup by doctor name/registration number and medical facilities by governorate. Reuse terms and source-level freshness must be reviewed; do not bulk-copy other aggregators absent explicit reuse permission. Every new record must retain its exact source URL and retrieval date.
- No records were inserted and no production data/schema/permissions/functions were changed during this baseline audit. The new national expansion task is tracked in TODO_PRODUCTION.md and master request issue #599.
- Next: map the 27-governorate / 365-district hierarchy to source coverage; identify source terms and actual geocoding path; then process bounded governorate batches with global normalized Arabic-name/phone duplicate checks, correct individual-doctor taxonomy, exact clinic location, owner-unverified status, and read-after-write verification.


## 2026-11-01 — National doctor directory pagination source implementation

- Added backward-compatible keyset pagination to the directory Edge Function source on `feat/national-doctor-directory-pagination-20261101`.
- New paginated mode supports a maximum of 100 records per request, stable created_at/id cursor, PUBLISHED-only rows and geographic/taxonomy filters. The old GET contract remains unchanged for legacy clients.
- Added typed frontend page-fetch helper and static assertions. Root `DirectoryView` and activity-folder pagination integration remain open; this is not yet a complete nationwide browsing experience.
- No production function deployment or data import. Keep the national coverage task IN PROGRESS.


### Nationwide source and reuse review — 2026-11-01

- Egyptian Medical Syndicate states that its public service lets citizens search a doctor's name or registration number and see registered specialty/registration status. This is a useful identity/credential cross-check, but the reviewed public material does not establish an open bulk export of clinic addresses and phone numbers. Official site: https://www.ems.org.eg/; guidance: https://www.ems.org.eg/news/cmutlhb0o00009k8yo3p6nkxw.
- Dakatra Misr's own About page describes a directory of 49,001 doctors/clinics and says it compiles public data from Google Maps, clinic Facebook pages/websites, booking platforms and directories. Its privacy page explicitly states phone numbers are not exposed in the page HTML and are designed not to be harvested automatically. No bulk-copy or automated phone extraction is authorized by these pages; pursue a written data partnership/licence instead of scraping or cloning their database.
- The UK FCDO's public Egypt doctor/facility list includes some English-speaking doctors and clinics but is dated 18 July 2022 and is not a current comprehensive national registry. It can be a secondary lead only after each clinic/contact is rechecked at its original source; do not treat it as current or exhaustive.
- Therefore no 49k-record bulk import was attempted. Each imported record must be independently sourced from a page that permits republication, or be provided/confirmed by the doctor/clinic, and must retain provenance and retrieval date.


## 2026-11-01 — Root and activity directory pagination integration

- Connected the main directory to `fetchPublicDirectoryListingPage` on the national-directory feature branch. Each initial server request returns 20 rows; the «رؤية المزيد» control continues with the returned keyset cursor instead of fetching the capped legacy 500-row list.
- Wired the same request pipeline into activity modules and specialty folders. Changing a specialty or the module's search term requests a new server-filtered page, while pagination keeps the chosen governorate, district/markaz, village and address/area scope.
- Extended public search to match name, specialty, phone, secondary phone, address and administrative location fields; added a server-side address filter and Arabic administrative-label substring matching.
- Public endpoint continues to constrain reads to `listing_status='PUBLISHED'`; client-side rendering excludes claimed rows from the unclaimed directory cards. No table/schema/RLS/GRANT/Auth mutation, production Edge deployment, or doctor-record import was performed.
- Exact-head frontend validation and browser E2E are still pending on the current branch head. Isolated Edge Function tests for cursor continuation and the combined search/cursor predicates remain a release requirement. National coverage is still IN PROGRESS; the production baseline remains 57 doctors in one governorate and zero confirmed clinic coordinate pairs.


## 2026-11-01 — Geographic prefix matching and pagination contract

- Updated the paginated Edge Function so governorate, district/markaz, village, address, and specialty filters are applied in the SQL query before the bounded page limit. Geographic/address/specialty text is sanitized and matched with `ILIKE '%…%'` to tolerate common administrative prefixes such as «محافظة»، «مركز»، and «قرية».
- Preserved legacy functional-group and taxonomy-category IDs by expanding known aliases to canonical ID sets before applying the server-side `IN` filters.
- The keyset helper validates page size (1–100), validates UUID/timestamp cursors, preserves PostgreSQL microsecond timestamp precision, and builds one PostgREST logic tree when text search and cursor continuation are used together.
- Read-only SQL verification against production returned the 57 currently published doctor listings as 20 + 20 + 17 rows with 57 distinct IDs, with no cursor gaps/duplicates. A second filtered query confirmed 54 records under the canonical medical-practices category plus its legacy aliases; the selected «أطفال» specialty predicate matched six rows across the current/legacy specialty columns.
- On branch commit `46d6098aa2fd90ba5aa807651a07fd318b371162`, TypeScript/build, canonical taxonomy, persisted-catalog contract validation, geographic/GPS contracts, CORS boundary checks, and employee RBAC PostgreSQL passed. Browser E2E was still in progress when this note was recorded; rerun after documentation changes.
- Production Edge Function is currently version 9 and still serves the legacy capped GET path; no deployment of the paginated code has occurred. No database/schema/RLS/GRANT/Auth mutation or live doctor import has been performed.


## 2026-11-01 — Egypt-wide doctor-source review (current public terms)

- Egyptian Medical Syndicate's latest public notices describe two useful official lookup paths: doctor search by name or registration number to verify registration and registered specialty; and medical-facility search with facility-type and governorate filters. These are verification/discovery interfaces, not evidence of an open bulk-export licence or a complete nationwide clinic-address dataset. References: doctor-registration lookup https://www.ems.org.eg/news/cmutlhb0o00009k8yo3p6nkxw; medical-facility search https://www.ems.org.eg/news/cmsq68cuk00009kv2xynj9gxe.
- GAHAR's current public analytics page reports 97,505 registered medical professionals in its summary but currently renders zero accredited facilities / zero covered governorates in the visible dashboard output. This is an aggregate signal only, not a list of doctors or a verified clinic-address feed. Reference: https://www.gahar.gov.eg/ar/facilities/analytics.
- Public medical directories reviewed in this pass explicitly restrict automated extraction and/or commercial republication without written permission, including Tabeeb-EG, MasrDoctors, and DocLine. Do not scrape or republish their directory records absent written licence/permission. References: https://www.tabeeb-eg.com/ar/terms-conditions, https://www.masrdoctors.com/page?slug=terms-conditions, https://www.docline-eg.com/terms.
- Dakatra Misr's privacy notice describes collection from already-public sources but does not itself grant MantiqatiX permission to scrape/republish. No bulk extraction was performed.
- Next permitted acquisition path: request a formal data-access/republication agreement from EMS or facility owners; otherwise use provider-submitted/owner-confirmed records and independently source only fields whose republication terms permit. Keep syndicate registration verification distinct from clinic-address verification, and retain source URL, retrieval date, and exact clinic location evidence per record.


## 2026-11-01 — Verified production snapshot superseding the earlier 57-doctor baseline

The earlier baseline above was superseded by subsequent national import batches. A fresh read-only query against Production now confirms:

- 568 PUBLISHED doctor-type listings across all 27 governorates.
- Every current published doctor listing has a non-empty source URL.
- No doctor listing is missing both primary and secondary phone numbers.
- A normalized cross-check across primary and secondary phone fields found no duplicate phone numbers across different doctor records.
- 511 records explicitly carry `coordinates_status=NOT_PROVIDED_BY_SOURCE`; zero are marked `PROVIDED_BY_SOURCE` or `GEOCODED` by the same metadata audit. The other 57 need a separate metadata/location review; this is not proof that their physical clinic coordinates are accurate.
- Coverage means at least one listing in each governorate, not a complete census, current operational check, professional-registration verification, or verified clinic geolocation.
- Existing source mix includes 497 Dalil140-labelled rows plus records attributed to other directories and official sources. A source URL is provenance, not a republication licence. Existing rows were not modified in this read-only audit; their source-term/republication basis remains a separate legal/data-governance audit.

Incremental ingestion work is being added on PR #640. Its new batch path requires a per-row republication basis (`LICENSED`, `OWNER_PROVIDED`, or `PUBLIC_PERMISSION_CONFIRMED`), an exact HTTP(S) source URL, sequential writes of 1–20 rows, duplicate checks, and protection of existing slugs, publication states, claim state, source-check timestamps, and verification metadata. The new endpoint is not yet deployed to Production.


## 2026-11-01 — Latest doctor-ingestion verification and licensing gate

- Exact-head GitHub Actions checks on `081322fb0d80bf3a871c5770a4eb7d3061eaf03e`: incremental-import contract PASS, Deno type-check PASS, Catalog build/TypeScript PASS, isolated professional-dashboard RBAC PostgreSQL PASS, and dashboard browser E2E PASS (job `124789206800`). PR #640 remains open/draft.
- Production `directory-listings` Edge Function remains version 10; the new batch importer has not been deployed. Authenticated isolated write tests remain pending because the available Supabase tool connection has no Edge Function invocation operation. No direct production writes or test deployment were used to bypass that missing test path.
- Reviewed Egypt's 2025 Open Data Policy. It describes a national open licence intended to permit reuse of approved government datasets with attribution, but datasets must be reviewed/approved and the policy excludes personal data protected by Law 151/2020 as well as third-party copyrighted or contract-restricted datasets. This policy is not proof that the EMS doctor registry or private directory records are licensed for MantiqatiX republication. Reference: https://ai.gov.eg/SynchedFiles/en/Resources/Open%20Data%20Policy.pdf.
- The EMS offers individual doctor lookup by name/registration number and specialty, and a medical-facility search path. Treat these as verification/discovery interfaces only; no open bulk export or republication licence was identified. Doctor lookup: https://ems.org.eg/ar/inquiries/doctor-specialist. Facility search news/reference: https://www.ems.org.eg/news/cmsq68cuk00009kv2xynj9gxe.
- Next acquisition route remains a written EMS/data-owner agreement, dataset-specific open licence, or direct doctor/clinic owner submission. Preserve the source URL, source timestamp, exact permission basis, and independent status of professional-registration vs clinic-address checks for every imported row.


## 2026-11-01 — Source permission evidence hardening and official statistical source

- A second source review found the previous `sourcePermissionStatus` import field was only an operator-entered declaration and did not reference evidence. It has been removed as an authorization mechanism.
- Feature branch now adds a private `directory_source_permission_evidence` registry with FORCE RLS and service-role-only access. Evidence records are pending until reviewed; approval requires a second distinct platform Super Admin; revocation immediately blocks future imports.
- Doctor imports now require an approved evidence UUID. The source name and normalized hostname must match the evidence record; the record must not be revoked or expired and must include doctor-profile and commercial-republication scope. This is still a human evidence review process, not an automated legal determination.
- The Central Agency for Public Mobilization and Statistics (CAPMAS) health services 2024 metadata lists a file named `SPSS_doctors_2024` with 31,937 records. This is a statistical data file rather than an individual public phone/address directory; it may support aggregate analysis, not direct contact enrichment. Reference: https://censusinfo.capmas.gov.eg/Metadata-ar-v4.2/index.php/catalog/1944/datafile/F2.
- The official Egyptian Medical Syndicate page now describes a searchable doctor directory by name or registration number, plus a medical-facility search by facility type and governorate. No bulk-export or commercial republication licence is stated on that page. Reference: https://www.ems.org.eg/news/cmsq68cuk00009kv2xynj9gxe.
- The new migration, admin UI and Edge Function changes are on the feature branch only. No production migration or deployment has been performed. Isolated migration replay and authenticated invocation tests remain release blockers.
