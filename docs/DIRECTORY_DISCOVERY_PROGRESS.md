# Directory Discovery Progress — Berket El Sabaa

Last updated: 2026-10-29

## Scope

Only Berket El Sabaa city and the villages, hamlets, and administrative dependencies belonging to Berket El Sabaa Markaz, Monufia Governorate, Egypt. Do not attribute listings from other centers to this scope.

## Initial verified audit

- Repository: `islamnagy2022-eng/MantiqatiX`, default branch `main`.
- Canonical taxonomy source: `apps/catalog-frontend/src/data/productionDefaults.ts`.
- Code currently defines 18 functional groups and 221 `CATEGORY_SEEDS` entries. This is the source seed count, not a claim about the effective categories loaded by the live UI or saved settings.
- Medical taxonomy has 17 seeds: 9 activity categories and 8 profession categories.
- Production table `public.public_directory_listings` has 325 rows at audit time and RLS enabled.
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
- The pharmacy review also confirmed that four other village pharmacy records from the same source already existed, so they were not duplicated.

## Still open

- Verify and correct the known dental-center classification for `مركز د. محمد أحمد المراكبي للأسنان`; a prior attempt was blocked and must not be represented as complete.
- Complete a source-backed administrative list of all villages/hamlets/dependencies of Berket El Sabaa.
- Continue medical discovery by specialty and village; query more than one source and compare against all 325+ current listings before each batch.
- Review medical listings with incomplete specialty/location metadata.
- Design a safe canonical 50-category mapping, including persisted settings and legacy category IDs, before implementing any broad migration.
- Continue through the other 17 functional groups, only within the stated geographic scope.
- Run relevant data and UI tests after each batch and record actual results.

## Current status

Partial execution started: 4 verified insertions in this session (3 doctors and 1 pharmacy). This is not a completed directory, not a completed 50-category migration, and not a deployment certification.
