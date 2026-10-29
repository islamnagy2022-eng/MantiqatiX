# MantiqatiX Directory Data — Duplicate Prevention Policy

Effective date: 2026-10-29

## Mandatory rule
Never insert a directory listing until checking existing production data. Apply this policy to every future batch and every functional group, not only medical listings.

## Before insertion
1. Normalize names by trimming whitespace, removing Arabic diacritics and tatweel, collapsing internal whitespace, and comparing case-insensitively where applicable.
2. Normalize phone numbers to digits only. Check both primary and secondary phone fields across the entire directory, not just the target group.
3. Skip an incoming record when its normalized name already exists.
4. Skip an incoming record when either non-empty incoming phone matches an existing primary or secondary phone, unless a human review establishes that the same contact number legitimately belongs to a distinct entity.
5. If the same listing exists but a phone field is empty, update only the empty field from a cited public source. Never overwrite an existing non-empty value without verification.
6. Do not merge records automatically based only on similar names or a shared phone. Flag ambiguous cases for review.
7. Keep source URL, source name, check date, and owner-confirmation state on each new public-source record.
8. New public-source listings remain PUBLISHED and UNCLAIMED, with owner confirmation pending. Do not create owner accounts, mark activities confirmed, or activate subscriptions from a directory import.

## After insertion
Run read-after-write checks for:
- normalized-name duplicate groups;
- exact normalized primary/secondary phone collisions;
- listing totals by functional group;
- missing source URLs and addresses;
- group/category consistency.

Report any pre-existing duplicates separately; do not silently delete or merge them as part of an unrelated import. A zero-duplicate result for the new batch must not be described as a zero-duplicate result for the whole database if pre-existing exceptions remain.

## 2026-10-29 medical listings batch
- Added 15 public-source medical listings after normalized-name and phone collision checks.
- Production read-back: 59 medical-health listings with phone numbers.
- Normalized-name duplicate groups across the database: 0.
- One pre-existing phone collision remains between two spelling variants of the same home-appliance listing: “العطوى للأجهزة المنزلية” and “العطوي للأجهزة المنزلية”, phone 0482994097. This was not changed in the medical batch and requires a separate careful reconciliation.
- Public source data is not owner verification; contact details and specialties may be outdated and must be confirmed directly.
