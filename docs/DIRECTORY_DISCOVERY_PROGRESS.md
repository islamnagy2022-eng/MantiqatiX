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
