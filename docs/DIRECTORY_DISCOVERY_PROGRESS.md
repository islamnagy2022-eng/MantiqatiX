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
