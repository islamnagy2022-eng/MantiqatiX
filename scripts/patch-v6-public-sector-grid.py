#!/usr/bin/env python3
"""Restore the 15-sector public discovery grid from the uploaded BizCatalog V6 reference."""
from __future__ import annotations
import sys
from pathlib import Path

DIRECTORY = Path("src/components/DirectoryView.tsx")
COMPONENT = Path("src/components/common/PublicSectorGrid.tsx")

COMPONENT_SOURCE = r'''import React, { useMemo } from 'react';
import type { Business, FunctionalGroupId } from '../../types';

type PublicSector = { id: FunctionalGroupId; shortName: string; description: string; emoji: string };

// Canonical 15 functional groups from the uploaded V6 reference.
// This is discovery metadata only; all activity counts come from the live public directory.
const PUBLIC_SECTORS: PublicSector[] = [
  { id: 'dining', shortName: 'مطاعم ومأكولات', description: 'المطاعم والمقاهي والمخابز', emoji: '🍽️' },
  { id: 'retail', shortName: 'تجارة وتجزئة', description: 'المتاجر والسلع والمنتجات', emoji: '🛍️' },
  { id: 'services', shortName: 'خدمات وحجوزات', description: 'الخدمات المهنية والحجوزات', emoji: '📅' },
  { id: 'healthcare', shortName: 'صحة ورعاية', description: 'العيادات والصيدليات والمعامل', emoji: '🩺' },
  { id: 'crafts_maintenance', shortName: 'ورش وصيانة', description: 'الصيانة والحرف والتشطيبات', emoji: '🛠️' },
  { id: 'education_training', shortName: 'تعليم وتدريب', description: 'التعليم والسناتر والتدريب', emoji: '🎓' },
  { id: 'real_estate', shortName: 'عقارات ومقاولات', description: 'العقارات والمقاولات والديكور', emoji: '🏗️' },
  { id: 'tourism_hotels', shortName: 'سياحة وفنادق', description: 'الفنادق والإقامة والرحلات', emoji: '🧭' },
  { id: 'transport_logistics', shortName: 'نقل وشحن', description: 'النقل والشحن والخدمات اللوجستية', emoji: '🚚' },
  { id: 'agriculture_livestock', shortName: 'زراعة وإنتاج', description: 'الزراعة والإنتاج الحيواني', emoji: '🌱' },
  { id: 'technology_software', shortName: 'برمجيات وتكنولوجيا', description: 'التقنية والاتصالات والبرمجيات', emoji: '💻' },
  { id: 'sports_fitness', shortName: 'رياضة ولياقة', description: 'الأندية والجيم واللياقة', emoji: '🏋️' },
  { id: 'events_entertainment', shortName: 'حفلات ومناسبات', description: 'المناسبات والترفيه', emoji: '🎉' },
  { id: 'legal_financial', shortName: 'قانوني ومالي', description: 'الاستشارات القانونية والمحاسبية', emoji: '⚖️' },
  { id: 'industrial_manufacturing', shortName: 'صناعة ومصانع', description: 'المصانع والصناعات والإنتاج', emoji: '🏭' },
];

interface PublicSectorGridProps {
  businesses: Business[];
  selectedSectorId: FunctionalGroupId | 'all';
  onSelectSector: (sectorId: FunctionalGroupId | 'all') => void;
}

export const PublicSectorGrid: React.FC<PublicSectorGridProps> = ({ businesses, selectedSectorId, onSelectSector }) => {
  const counts = useMemo(() => {
    const result = new Map<FunctionalGroupId, number>();
    for (const business of businesses) {
      result.set(business.functionalGroupId, (result.get(business.functionalGroupId) || 0) + 1);
    }
    return result;
  }, [businesses]);

  return (
    <section data-testid="public-sector-grid" aria-label="دليل القطاعات والأنشطة" className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900 sm:text-xl">دليل القطاعات والأنشطة الاقتصادية</h2>
          <p className="mt-1 text-xs leading-6 text-slate-500">اختر القطاع لعرض الأنشطة المدرجة فعلياً في الدليل. الأعداد تُحسب من البيانات المنشورة المحمّلة.</p>
        </div>
        <button type="button" onClick={() => onSelectSector('all')} className="min-h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 hover:bg-slate-100">عرض كل القطاعات</button>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {PUBLIC_SECTORS.map((sector) => {
          const count = counts.get(sector.id) || 0;
          const selected = selectedSectorId === sector.id;
          return (
            <button key={sector.id} type="button" data-testid="public-sector-card" data-sector-id={sector.id}
              aria-pressed={selected} onClick={() => onSelectSector(sector.id)}
              className={'group flex min-h-[126px] min-w-0 flex-col justify-between rounded-2xl border p-3 text-right transition duration-150 hover:-translate-y-0.5 hover:shadow-md sm:p-4 ' + (selected ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-gradient-to-br from-white to-slate-50 hover:border-emerald-300')}>
              <span className="flex w-full items-start justify-between gap-2">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-xl shadow-sm" aria-hidden="true">{sector.emoji}</span>
                <span className={'rounded-full border px-2 py-1 text-[10px] font-black ' + (count > 0 ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-slate-200 bg-slate-100 text-slate-500')}>{count} نشاط</span>
              </span>
              <span className="mt-3 block min-w-0">
                <span className="block truncate text-sm font-black text-slate-900">{sector.shortName}</span>
                <span className="mt-1 block text-[10px] leading-5 text-slate-500">{sector.description}</span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] leading-5 text-slate-400">القطاعات التي لا تحتوي على أنشطة حالياً تظل ظاهرة للتصفح، ويظهر عددها صفر دون إنشاء بيانات افتراضية.</p>
    </section>
  );
};
'''

IMPORT = "import { PublicGovernorateMap } from './common/PublicGovernorateMap';"
STATE = "  const [selectedActivityId, setSelectedActivityId] = useState('all');"
MAP = "        <PublicGovernorateMap businesses={businesses} selectedGovernorate={governorate} onSelectGovernorate={setGovernorate} />"

def replace_once(source: str, old: str, new: str, label: str) -> str:
    if new in source:
        return source
    count = source.count(old)
    if count != 1:
        raise ValueError(f"{label}: expected one anchor, found {count}")
    return source.replace(old, new, 1)

def patch_directory(source: str) -> tuple[str, bool]:
    original = source
    source = replace_once(source, IMPORT, IMPORT + "\nimport { PublicSectorGrid } from './common/PublicSectorGrid';", "component import")
    source = replace_once(source, STATE, STATE + "\n  const [selectedSectorId, setSelectedSectorId] = useState<FunctionalGroupId | 'all'>('all');", "sector state")
    source = replace_once(source, MAP, MAP + "\n        <PublicSectorGrid businesses={businesses} selectedSectorId={selectedSectorId} onSelectSector={(sectorId) => { setSelectedSectorId(sectorId); setSelectedActivityId('all'); setSelectedSpecialtyId('all'); }} />", "component mount")
    source = replace_once(source,
        "  useEffect(() => setVisibleCount(DIRECTORY_PAGE_SIZE), [query, governorate, selectedActivityId, selectedSpecialtyId, verification]);",
        "  useEffect(() => setVisibleCount(DIRECTORY_PAGE_SIZE), [query, governorate, selectedActivityId, selectedSectorId, selectedSpecialtyId, verification]);",
        "pagination reset")
    source = replace_once(source,
        "      functionalGroupId: selectedActivity?.functionalGroupId || 'all',",
        "      functionalGroupId: selectedActivity?.functionalGroupId || selectedSectorId,",
        "sector filtering")
    source = replace_once(source,
        "  }, [businesses, query, governorate, selectedActivity, selectedSpecialtyId, verification]);",
        "  }, [businesses, query, governorate, selectedActivity, selectedSectorId, selectedSpecialtyId, verification]);",
        "sector filter dependencies")
    source = replace_once(source,
        "<button type=\"button\" onClick={() => setSelectedActivityId('all')} className={activityViewStyle === 'cards' ?",
        "<button type=\"button\" onClick={() => { setSelectedSectorId('all'); setSelectedActivityId('all'); }} className={activityViewStyle === 'cards' ?",
        "clear sector when showing all categories")
    source = replace_once(source,
        "<button key={activity.id} type=\"button\" onClick={() => setSelectedActivityId(activity.id)} className={activityViewStyle === 'cards' ?",
        "<button key={activity.id} type=\"button\" onClick={() => { setSelectedSectorId('all'); setSelectedActivityId(activity.id); }} className={activityViewStyle === 'cards' ?",
        "clear sector when selecting category")
    required = ["selectedSectorId", "data-testid=\"public-sector-grid\"", "data-testid=\"public-sector-card\"", "functionalGroupId: selectedActivity?.functionalGroupId || selectedSectorId,"]
    if any(x not in source for x in required[:1] + required[3:]):
        raise ValueError("sector filter integration incomplete")
    return source, source != original

def patch_tests(source: str) -> tuple[str, bool]:
    anchor = "  const sectorCardsMode = page.getByTestId('activity-view-cards');"
    insert = """  const publicSectorGrid = page.getByTestId('public-sector-grid');
  assert.equal(await publicSectorGrid.getByTestId('public-sector-card').count(), 15, 'The public directory must display all 15 canonical sectors');
  const healthcareSector = publicSectorGrid.locator('[data-sector-id=\"healthcare\"]');
  assert.match(await healthcareSector.innerText(), /6 نشاط/, 'Sector count must come from the six live healthcare fixtures');
  await healthcareSector.click();
  assert.equal(await page.getByRole('button', { name: 'عرض النشاط', exact: true }).count(), 6, 'Selecting a sector must filter the existing public directory by its canonical group');
  await publicSectorGrid.getByRole('button', { name: 'عرض كل القطاعات' }).click();
  assert.equal(await page.getByRole('button', { name: 'عرض النشاط', exact: true }).count(), 20, 'Resetting sectors must restore the first directory page');
  console.log('V6_PUBLIC_15_SECTOR_GRID=PASS sectors=15 live_counts=true filter=true');
"""
    if insert in source:
        return source, False
    if source.count(anchor) != 1:
        raise ValueError(f"sector E2E anchor expected once; found {source.count(anchor)}")
    return source.replace(anchor, insert + anchor, 1), True

def self_test() -> None:
    fixture = "\n".join([IMPORT, STATE,
        "  useEffect(() => setVisibleCount(DIRECTORY_PAGE_SIZE), [query, governorate, selectedActivityId, selectedSpecialtyId, verification]);",
        "      functionalGroupId: selectedActivity?.functionalGroupId || 'all',",
        "  }, [businesses, query, governorate, selectedActivity, selectedSpecialtyId, verification]);",
        MAP,
        "<button type=\"button\" onClick={() => setSelectedActivityId('all')} className={activityViewStyle === 'cards' ?",
        "<button key={activity.id} type=\"button\" onClick={() => setSelectedActivityId(activity.id)} className={activityViewStyle === 'cards' ?"])
    updated, changed = patch_directory(fixture)
    again, changed_again = patch_directory(updated)
    assert changed and not changed_again and updated == again
    test_fixture = "  const sectorCardsMode = page.getByTestId('activity-view-cards');"
    updated_test, test_changed = patch_tests(test_fixture)
    again_test, test_changed_again = patch_tests(updated_test)
    assert test_changed and not test_changed_again and updated_test == again_test
    assert COMPONENT_SOURCE.count("{ id: '") == 15

def main() -> None:
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        self_test()
        print("V6_PUBLIC_15_SECTOR_GRID_OVERLAY_SELF_TEST=PASS")
        return
    if len(sys.argv) == 3 and sys.argv[1] == "--tests":
        target = Path(sys.argv[2]).resolve()
        if not target.is_file():
            raise SystemExit("V6_PUBLIC_SECTOR_GRID_TEST_TARGET_MISSING")
        updated, changed = patch_tests(target.read_text(encoding="utf-8"))
        if changed:
            target.write_text(updated, encoding="utf-8")
        verified, changed_again = patch_tests(target.read_text(encoding="utf-8"))
        if changed_again or verified != updated:
            raise SystemExit("V6_PUBLIC_SECTOR_GRID_TEST_PATCH_FAILED")
        print(f"V6_PUBLIC_15_SECTOR_GRID_TESTS=PASS changed={int(changed)}")
        return
    if len(sys.argv) != 2:
        raise SystemExit("Usage: patch-v6-public-sector-grid.py <v6-worktree> | --tests <test-file>")
    root = Path(sys.argv[1]).resolve()
    directory = root / DIRECTORY
    component = root / COMPONENT
    if not directory.is_file():
        raise SystemExit("V6_PUBLIC_SECTOR_GRID_DIRECTORY_TARGET_MISSING")
    if component.exists() and component.read_text(encoding="utf-8") != COMPONENT_SOURCE:
        raise SystemExit("V6_PUBLIC_SECTOR_GRID_COMPONENT_CONFLICT")
    updated, changed = patch_directory(directory.read_text(encoding="utf-8"))
    if changed:
        directory.write_text(updated, encoding="utf-8")
    component.parent.mkdir(parents=True, exist_ok=True)
    if not component.exists():
        component.write_text(COMPONENT_SOURCE, encoding="utf-8")
    verified, changed_again = patch_directory(directory.read_text(encoding="utf-8"))
    if changed_again or verified != updated or component.read_text(encoding="utf-8") != COMPONENT_SOURCE:
        raise SystemExit("V6_PUBLIC_SECTOR_GRID_OVERLAY_VERIFY_FAILED")
    print(f"V6_PUBLIC_15_SECTOR_GRID=PASS changed={int(changed)} sectors=15")

if __name__ == "__main__":
    main()
