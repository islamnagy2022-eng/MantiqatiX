#!/usr/bin/env python3
"""Add consent-first location discovery and manual Egypt geography to the V6 general directory."""
from __future__ import annotations
import re
import sys
import tempfile
from pathlib import Path

COMPONENT_SOURCE = r'''import React from 'react';
import {
  EGYPT_GEO_DISTRICTS,
  EGYPT_GEO_GOVERNORATES,
  type EgyptGeoShiyakha,
} from '../../data/egyptGeoDiscovery';

export interface PublicGeoDiscoveryProps {
  governorate: string;
  districtId: string;
  shiyakhaId: string;
  shiyakhas: EgyptGeoShiyakha[];
  shiyakhaStatus: 'idle' | 'loading' | 'ready' | 'error';
  completed: boolean;
  mode: 'all' | 'manual' | 'auto';
  locationBusy: boolean;
  locationMessage: string;
  onUseLocation: () => void;
  onBrowseEgypt: () => void;
  onSelectGovernorate: (value: string) => void;
  onSelectDistrict: (value: string) => void;
  onSelectShiyakha: (value: string) => void;
}

export const PublicGeoDiscovery: React.FC<PublicGeoDiscoveryProps> = ({
  governorate,
  districtId,
  shiyakhaId,
  shiyakhas,
  shiyakhaStatus,
  completed,
  mode,
  locationBusy,
  locationMessage,
  onUseLocation,
  onBrowseEgypt,
  onSelectGovernorate,
  onSelectDistrict,
  onSelectShiyakha,
}) => {
  const districts = EGYPT_GEO_DISTRICTS.filter((item) =>
    governorate === 'all' || item.governorateName === governorate
  );

  return (
    <section
      data-testid="public-geo-discovery"
      aria-label="تحديد نطاق البحث الجغرافي"
      className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      dir="rtl"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-black text-slate-900">حدد نطاق البحث</h2>
          <p className="text-xs leading-6 text-slate-600">
            استكشف الأنشطة في مصر بالكامل أو اختر المحافظة والمركز والقرية يدويًا.
          </p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-bold text-emerald-800">
          {mode === 'auto' ? 'ترشيح موقع تقريبي' : governorate === 'all' ? 'مصر بالكامل' : 'نطاق يدوي'}
        </span>
      </div>

      {!completed && (
        <div data-testid="geo-first-visit" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-black text-emerald-950">كيف تفضل استكشاف الأنشطة؟</p>
          <p className="mt-1 text-xs leading-6 text-emerald-900">
            لن نطلب إذن الموقع قبل ضغطك على استخدام موقعي. يمكنك المتابعة دون مشاركة موقعك.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onUseLocation}
              disabled={locationBusy}
              className="inline-flex min-h-10 items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-xs font-black text-white disabled:opacity-60"
            >
              {locationBusy ? 'جارٍ تحديد الموقع…' : 'استخدم موقعي'}
            </button>
            <button
              type="button"
              onClick={onBrowseEgypt}
              className="inline-flex min-h-10 items-center justify-center rounded-lg border border-emerald-300 bg-white px-4 py-2 text-xs font-bold text-emerald-900"
            >
              تصفح مصر بالكامل
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-slate-700">المحافظة</span>
          <select
            aria-label="اختيار المحافظة"
            value={governorate}
            onChange={(event) => onSelectGovernorate(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500"
          >
            <option value="all">مصر بالكامل — كل المحافظات</option>
            {EGYPT_GEO_GOVERNORATES.map((item) => (
              <option key={item.id} value={item.name}>{item.name}</option>
            ))}
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-bold text-slate-700">المركز أو القسم</span>
          <select
            aria-label="اختيار المركز أو القسم"
            value={districtId}
            onChange={(event) => onSelectDistrict(event.target.value)}
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500"
          >
            <option value="all">كل المراكز والأقسام</option>
            {districts.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </select>
        </label>

        {districtId !== 'all' && (
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-700">القرية أو الشياخة</span>
            <select
              aria-label="اختيار القرية أو الشياخة"
              value={shiyakhaId}
              onChange={(event) => onSelectShiyakha(event.target.value)}
              disabled={shiyakhaStatus === 'loading'}
              className="min-h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-800 outline-none focus:border-emerald-500 disabled:opacity-60"
            >
              <option value="all">
                {shiyakhaStatus === 'loading' ? 'جارٍ تحميل القرى والشياخات…' : 'كل القرى والشياخات'}
              </option>
              {shiyakhas.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {districtId !== 'all' && shiyakhaStatus === 'error' && (
        <p className="text-xs text-amber-800" role="status">
          تعذر تحميل القرى والشياخات لهذا المركز. ما زال بإمكانك البحث على مستوى المركز أو المحافظة.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {completed && (
          <button
            type="button"
            onClick={onUseLocation}
            disabled={locationBusy}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800 disabled:opacity-60"
          >
            {locationBusy ? 'جارٍ تحديد الموقع…' : 'إعادة تحديد موقعي'}
          </button>
        )}
        <button
          type="button"
          onClick={onBrowseEgypt}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700"
        >
          عرض مصر بالكامل
        </button>
        {locationMessage && <p className="min-w-0 flex-1 text-xs leading-6 text-slate-600" role="status" aria-live="polite">{locationMessage}</p>}
      </div>

      <p className="border-t border-slate-100 pt-2 text-[10px] leading-5 text-slate-500">
        البيانات الإدارية: Open Admin Data Egypt 2026.09 — ترخيص CC BY 4.0. نقاط القرى والمراكز مرجعية تقريبية وليست حدودًا إدارية قانونية. لا تُحفظ إحداثيات GPS ولا تُرسل إلى مصدر البيانات.
      </p>
    </section>
  );
};
'''

def replace_once(source: str, old: str, new: str, label: str) -> str:
    if new in source:
        return source
    count = source.count(old)
    if count != 1:
        raise SystemExit(f"V6_GEO_PATCH_FAILED anchor={label} count={count}")
    return source.replace(old, new, 1)


def patch_directory(source: str) -> str:
    source = replace_once(
        source,
        "import { PublicGovernorateMap } from './common/PublicGovernorateMap';",
        "import { PublicGovernorateMap } from './common/PublicGovernorateMap';\nimport { PublicGeoDiscovery } from './common/PublicGeoDiscovery';\nimport { EGYPT_GEO_DISTRICTS, loadEgyptDistrictShiyakhas, resolveEgyptAdministrativeLocation, type EgyptGeoShiyakha } from '../data/egyptGeoDiscovery';",
        "geo imports",
    )
    helper_anchor = "const isBusinessVerified = (business: Business) => business.isVerified && (!business.verificationStatus || business.verificationStatus === 'verified');"
    helper = r'''
type StoredGeoPreference = {
  completed: true;
  mode: 'all' | 'manual' | 'auto';
  governorate: string;
  districtId: string;
  shiyakhaId: string;
};

const GEO_PREFERENCE_KEY = 'mantiqatix.v6.geo-scope.v1';

const readStoredGeoPreference = (): StoredGeoPreference | null => {
  if (typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(GEO_PREFERENCE_KEY) || 'null') as Partial<StoredGeoPreference> | null;
    if (!value || value.completed !== true || !['all', 'manual', 'auto'].includes(String(value.mode))) return null;
    const validGovernorate = value.governorate === 'all' || EGYPT_GEO_DISTRICTS.some((district) => district.governorateName === value.governorate);
    const validDistrict = value.districtId === 'all' || EGYPT_GEO_DISTRICTS.some((district) => district.id === value.districtId && (value.governorate === 'all' || district.governorateName === value.governorate));
    return {
      completed: true,
      mode: value.mode as StoredGeoPreference['mode'],
      governorate: validGovernorate && typeof value.governorate === 'string' ? value.governorate : 'all',
      districtId: validDistrict && typeof value.districtId === 'string' ? value.districtId : 'all',
      shiyakhaId: typeof value.shiyakhaId === 'string' ? value.shiyakhaId : 'all',
    };
  } catch {
    return null;
  }
};

const normalizeGeoName = (value: unknown) => String(value || '')
  .toLocaleLowerCase('ar-EG')
  .normalize('NFKC')
  .replace(/[أإآ]/g, 'ا')
  .replace(/[ىي]/g, 'ي')
  .replace(/ة/g, 'ه')
  .replace(/[\u064B-\u065F\u0670]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .replace(/^(?:محافظة|مركز|مدينة|قسم|قرية|شياخة|حي|نجع)\s*/, '')
  .trim();

'''
    source = replace_once(source, helper_anchor, helper_anchor + "\n" + helper, "geo preference helpers")

    source = replace_once(
        source,
        "  const [query, setQuery] = useState('');\n  const [governorate, setGovernorate] = useState('all');",
        "  const [initialGeoPreference] = useState<StoredGeoPreference | null>(() => readStoredGeoPreference());\n  const [query, setQuery] = useState('');\n  const [governorate, setGovernorate] = useState(initialGeoPreference?.governorate || 'all');\n  const [selectedDistrictId, setSelectedDistrictId] = useState(initialGeoPreference?.districtId || 'all');\n  const [selectedShiyakhaId, setSelectedShiyakhaId] = useState(initialGeoPreference?.shiyakhaId || 'all');\n  const [geoSetupCompleted, setGeoSetupCompleted] = useState(Boolean(initialGeoPreference?.completed));\n  const [geoPreferenceMode, setGeoPreferenceMode] = useState<StoredGeoPreference['mode']>(initialGeoPreference?.mode || 'all');\n  const [locationBusy, setLocationBusy] = useState(false);\n  const [locationMessage, setLocationMessage] = useState('');\n  const [administrativeShiyakhas, setAdministrativeShiyakhas] = useState<EgyptGeoShiyakha[]>([]);\n  const [shiyakhaStatus, setShiyakhaStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');",
        "geo state",
    )

    state_anchor = "  const currentCover = PUBLIC_HOME_COVER_SLIDES[coverIndex];"
    geo_logic = r'''
  const persistGeoScope = (
    next: { governorate: string; districtId: string; shiyakhaId: string },
    mode: StoredGeoPreference['mode'],
  ) => {
    const district = next.districtId === 'all' ? null : EGYPT_GEO_DISTRICTS.find((item) => item.id === next.districtId);
    const safeGovernorate = district ? district.governorateName : next.governorate;
    const safeDistrictId = district && (next.governorate === 'all' || district.governorateName === next.governorate)
      ? district.id
      : 'all';
    const safeShiyakhaId = safeDistrictId === 'all' ? 'all' : next.shiyakhaId;
    setGovernorate(safeGovernorate);
    setSelectedDistrictId(safeDistrictId);
    setSelectedShiyakhaId(safeShiyakhaId);
    setGeoPreferenceMode(mode);
    setGeoSetupCompleted(true);
    try {
      // Persist administrative names and stable dataset ids only.
      window.localStorage.setItem(GEO_PREFERENCE_KEY, JSON.stringify({
        completed: true,
        mode,
        governorate: safeGovernorate,
        districtId: safeDistrictId,
        shiyakhaId: safeShiyakhaId,
      } satisfies StoredGeoPreference));
    } catch {
      // Private browsing may block local storage; the directory remains usable.
    }
  };

  const browseEgypt = () => {
    persistGeoScope({ governorate: 'all', districtId: 'all', shiyakhaId: 'all' }, 'all');
    setLocationMessage('نطاق البحث الحالي: مصر بالكامل. يمكنك تضييق النطاق من القوائم.');
  };

  const requestUserLocation = () => {
    if (!window.isSecureContext) {
      browseEgypt();
      setLocationMessage('تحديد الموقع يحتاج إلى HTTPS. يمكنك متابعة البحث في مصر بالكامل أو اختيار نطاق يدوي.');
      return;
    }
    if (!navigator.geolocation) {
      browseEgypt();
      setLocationMessage('تحديد الموقع غير مدعوم في هذا المتصفح. يمكنك متابعة البحث في مصر بالكامل أو اختيار نطاق يدوي.');
      return;
    }
    setLocationBusy(true);
    setLocationMessage('جارٍ طلب إذن الموقع من المتصفح…');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = Number(position.coords.latitude);
        const longitude = Number(position.coords.longitude);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
            latitude < 21.5 || latitude > 32.2 || longitude < 24 || longitude > 37.5) {
          browseEgypt();
          setLocationMessage('الموقع خارج النطاق الجغرافي المدعوم حاليًا. تم إبقاء البحث على مصر بالكامل.');
          setLocationBusy(false);
          return;
        }
        try {
          const match = await resolveEgyptAdministrativeLocation(latitude, longitude);
          if (!match) {
            browseEgypt();
            setLocationMessage('لم تتوفر نقطة إدارية قريبة بدرجة كافية. تم إبقاء البحث على مصر بالكامل ويمكنك الاختيار يدويًا.');
          } else {
            persistGeoScope({
              governorate: match.governorate.name,
              districtId: match.district?.id || 'all',
              shiyakhaId: match.shiyakha?.id || 'all',
            }, 'auto');
            const levelLabel = match.level === 'SHIYAKHA'
              ? 'قرية أو شياخة'
              : match.level === 'DISTRICT' ? 'مركز أو قسم' : 'محافظة';
            const matchedName = match.shiyakha?.name || match.district?.name || match.governorate.name;
            setLocationMessage(
              'ترشيح تقريبي حسب أقرب نقطة بيانات: ' + levelLabel + ' ' + matchedName +
              ' (المسافة التقريبية ' + match.distanceKm.toFixed(1) +
              ' كم). يمكنك تعديل النطاق يدويًا. هذا ليس إثباتًا بحدود إدارية رسمية.',
            );
          }
        } catch {
          browseEgypt();
          setLocationMessage('تعذر تحميل بيانات المناطق. تم إبقاء البحث على مصر بالكامل؛ يمكنك الاختيار يدويًا.');
        } finally {
          setLocationBusy(false);
        }
      },
      (error) => {
        browseEgypt();
        const message = error.code === error.PERMISSION_DENIED
          ? 'تم رفض إذن الموقع. لن نكرر الطلب تلقائيًا؛ يمكنك الاختيار يدويًا.'
          : error.code === error.TIMEOUT
            ? 'انتهت مهلة تحديد الموقع. يمكنك إعادة المحاولة أو اختيار النطاق يدويًا.'
            : 'الموقع غير متاح حاليًا. يستمر الدليل بنطاق مصر بالكامل.';
        setLocationMessage(message);
        setLocationBusy(false);
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 30000 },
    );
  };

  const selectedDistrict = selectedDistrictId === 'all'
    ? undefined
    : EGYPT_GEO_DISTRICTS.find((item) => item.id === selectedDistrictId);
  const selectedShiyakha = administrativeShiyakhas.find((item) => item.id === selectedShiyakhaId);

  useEffect(() => {
    if (!selectedDistrict) {
      setAdministrativeShiyakhas([]);
      setShiyakhaStatus('idle');
      return;
    }
    let active = true;
    setAdministrativeShiyakhas([]);
    setShiyakhaStatus('loading');
    loadEgyptDistrictShiyakhas(selectedDistrict)
      .then((items) => {
        if (!active) return;
        setAdministrativeShiyakhas(items);
        setShiyakhaStatus('ready');
      })
      .catch(() => {
        if (!active) return;
        setAdministrativeShiyakhas([]);
        setShiyakhaStatus('error');
      });
    return () => { active = false; };
  }, [selectedDistrictId]);

'''
    source = replace_once(source, state_anchor, geo_logic + state_anchor, "geo interactions")

    source = replace_once(
        source,
        "  const activityOptions = useMemo(() => {",
        "  const geoScopedBusinesses = useMemo(() => businesses.filter((business) => {\n"
        "    if (governorate !== 'all' && normalizeGeoName(business.governorate) !== normalizeGeoName(governorate)) return false;\n"
        "    if (selectedDistrict && normalizeGeoName(business.markaz) !== normalizeGeoName(selectedDistrict.name)) return false;\n"
        "    if (selectedShiyakha && normalizeGeoName(business.village) !== normalizeGeoName(selectedShiyakha.name)) return false;\n"
        "    return true;\n"
        "  }), [businesses, governorate, selectedDistrict, selectedShiyakha]);\n\n"
        "  const activityOptions = useMemo(() => {",
        "geo-scoped business list",
    )
    source = replace_once(
        source,
        "    businesses.forEach((business) => {",
        "    geoScopedBusinesses.forEach((business) => {",
        "activity options use geo scope",
    )
    dependency_pattern = re.compile(
        r"(const activityOptions = useMemo\(\(\) => \{.*?)(\n\s*\}, \[[^\]]*\]\);)",
        re.DOTALL,
    )
    dependency_match = dependency_pattern.search(source)
    if not dependency_match:
        raise SystemExit("V6_GEO_PATCH_FAILED activity_options_dependency_not_found")
    patched_dependency_block = "\n  }, [geoScopedBusinesses]);"
    if dependency_match.group(2) != patched_dependency_block:
        source = source[:dependency_match.start(2)] + patched_dependency_block + source[dependency_match.end(2):]
    source = replace_once(
        source,
        "    let result = executeEnterpriseSearch(businesses, {",
        "    let result = executeEnterpriseSearch(geoScopedBusinesses, {",
        "search within geo scope",
    )
    source = replace_once(
        source,
        "  }, [businesses, query, governorate, selectedActivity, selectedSectorId, selectedSpecialtyId, verification]);",
        "  }, [geoScopedBusinesses, query, governorate, selectedActivity, selectedSectorId, selectedSpecialtyId, verification]);",
        "search geo dependencies",
    )
    source = replace_once(
        source,
        "  const getActivityCount = (activity: { name: string; functionalGroupId: FunctionalGroupId }) => businesses.filter((business) =>",
        "  const getActivityCount = (activity: { name: string; functionalGroupId: FunctionalGroupId }) => geoScopedBusinesses.filter((business) =>",
        "activity counts follow geo scope",
    )
    source = replace_once(
        source,
        "useEffect(() => setVisibleCount(DIRECTORY_PAGE_SIZE), [query, governorate, selectedActivityId, selectedSectorId, selectedSpecialtyId, verification]);",
        "useEffect(() => setVisibleCount(DIRECTORY_PAGE_SIZE), [query, governorate, selectedDistrictId, selectedShiyakhaId, selectedActivityId, selectedSectorId, selectedSpecialtyId, verification]);",
        "pagination reset for geo scope",
    )
    source = replace_once(
        source,
        "<PublicGovernorateMap businesses={businesses} selectedGovernorate={governorate} onSelectGovernorate={setGovernorate} />",
        "<PublicGovernorateMap businesses={businesses} selectedGovernorate={governorate} onSelectGovernorate={(value) => persistGeoScope({ governorate: value, districtId: 'all', shiyakhaId: 'all' }, 'manual')} />\n"
        "        <PublicGeoDiscovery\n"
        "          governorate={governorate}\n"
        "          districtId={selectedDistrictId}\n"
        "          shiyakhaId={selectedShiyakhaId}\n"
        "          shiyakhas={administrativeShiyakhas}\n"
        "          shiyakhaStatus={shiyakhaStatus}\n"
        "          completed={geoSetupCompleted}\n"
        "          mode={geoPreferenceMode}\n"
        "          locationBusy={locationBusy}\n"
        "          locationMessage={locationMessage}\n"
        "          onUseLocation={requestUserLocation}\n"
        "          onBrowseEgypt={browseEgypt}\n"
        "          onSelectGovernorate={(value) => persistGeoScope({ governorate: value, districtId: 'all', shiyakhaId: 'all' }, 'manual')}\n"
        "          onSelectDistrict={(value) => persistGeoScope({ governorate, districtId: value, shiyakhaId: 'all' }, 'manual')}\n"
        "          onSelectShiyakha={(value) => persistGeoScope({ governorate, districtId: selectedDistrictId, shiyakhaId: value }, 'manual')}\n"
        "        />",
        "geo discovery panel mount",
    )
    source = replace_once(
        source,
        "<PublicSectorGrid businesses={businesses} selectedSectorId={selectedSectorId}",
        "<PublicSectorGrid businesses={geoScopedBusinesses} selectedSectorId={selectedSectorId}",
        "sector counts follow geo scope",
    )
    return source


def self_test() -> None:
    fixture = """
import { PublicGovernorateMap } from './common/PublicGovernorateMap';
const isBusinessVerified = (business: Business) => business.isVerified && (!business.verificationStatus || business.verificationStatus === 'verified');
export const DirectoryView: React.FC = () => {
  const [query, setQuery] = useState('');
  const [governorate, setGovernorate] = useState('all');
  const [selectedActivityId, setSelectedActivityId] = useState('all');
  const [selectedSectorId, setSelectedSectorId] = useState<FunctionalGroupId | 'all'>('all');
  const [selectedSpecialtyId, setSelectedSpecialtyId] = useState('all');
  const [verification, setVerification] = useState<'all' | 'verified' | 'unverified'>('all');
  const [visibleCount, setVisibleCount] = useState(DIRECTORY_PAGE_SIZE);
  const [coverIndex, setCoverIndex] = useState(0);
  const [activityViewStyle, setActivityViewStyle] = useState<'cards' | 'tabs'>('cards');
  const currentCover = PUBLIC_HOME_COVER_SLIDES[coverIndex];
  const activityOptions = useMemo(() => {
    const unique = new Map();
    businesses.forEach((business) => {
      const name = business.category?.trim();
      if (!name) return;
      const id = name;
      unique.set(id, { id, name, functionalGroupId: business.functionalGroupId });
    });
    return Array.from(unique.values());
  }, [businesses]);
  useEffect(() => setVisibleCount(DIRECTORY_PAGE_SIZE), [query, governorate, selectedActivityId, selectedSectorId, selectedSpecialtyId, verification]);
  const filteredBusinesses = useMemo(() => {
    let result = executeEnterpriseSearch(businesses, {
      query,
      governorate,
      functionalGroupId: selectedActivity?.functionalGroupId || selectedSectorId,
      sortBy: 'verified_first',
    });
    return result;
  }, [businesses, query, governorate, selectedActivity, selectedSectorId, selectedSpecialtyId, verification]);
  const getActivityCount = (activity: { name: string; functionalGroupId: FunctionalGroupId }) => businesses.filter((business) =>
    business.category === activity.name && business.functionalGroupId === activity.functionalGroupId
  ).length;
  return (
    <main>
      <PublicGovernorateMap businesses={businesses} selectedGovernorate={governorate} onSelectGovernorate={setGovernorate} />
      <PublicSectorGrid businesses={businesses} selectedSectorId={selectedSectorId} onSelectSector={() => undefined} />
    </main>
  );
};
"""
    updated = patch_directory(fixture)
    again = patch_directory(updated)
    if updated != again:
        raise SystemExit("V6_GEO_PATCH_NOT_IDEMPOTENT")
    for marker in ["PublicGeoDiscovery", "resolveEgyptAdministrativeLocation", "GEO_PREFERENCE_KEY", "geoScopedBusinesses", "selectedDistrictId", "selectedShiyakhaId"]:
        if marker not in updated:
            raise SystemExit("V6_GEO_PATCH_SELF_TEST_MISSING=" + marker)
    if "localStorage.setItem(GEO_PREFERENCE_KEY" not in updated or "latitude" in updated[updated.find("const persistGeoScope"):updated.find("const browseEgypt")]:
        raise SystemExit("V6_GEO_PATCH_PRIVACY_SELF_TEST_FAILED")


def apply(root: Path, geo_source: Path) -> None:
    directory = root / "src/components/DirectoryView.tsx"
    if not directory.is_file() or not geo_source.is_file():
        raise SystemExit("V6_GEO_PATCH_INPUT_MISSING")
    data_target = root / "src/data/egyptGeoDiscovery.ts"
    data_target.parent.mkdir(parents=True, exist_ok=True)
    source_data = geo_source.read_text(encoding="utf-8")
    if "sourceCommit: '76b47b22872288c0d8b0c757975980e6986945e8'" not in source_data:
        raise SystemExit("V6_GEO_DATASET_VERSION_MISMATCH")
    if "CC-BY-4.0" not in source_data or "not point-in-polygon proof" not in source_data:
        raise SystemExit("V6_GEO_DATASET_ATTRIBUTION_OR_ACCURACY_NOTE_MISSING")
    if not data_target.exists():
        data_target.write_text(source_data, encoding="utf-8")
    elif data_target.read_text(encoding="utf-8") != source_data:
        raise SystemExit("V6_GEO_DATASET_SOURCE_CONFLICT")
    updated = patch_directory(directory.read_text(encoding="utf-8"))
    directory.write_text(updated, encoding="utf-8")
    component = root / "src/components/common/PublicGeoDiscovery.tsx"
    if component.exists() and component.read_text(encoding="utf-8") != COMPONENT_SOURCE:
        raise SystemExit("V6_GEO_COMPONENT_SOURCE_CONFLICT")
    component.parent.mkdir(parents=True, exist_ok=True)
    component.write_text(COMPONENT_SOURCE, encoding="utf-8")
    if patch_directory(directory.read_text(encoding="utf-8")) != updated:
        raise SystemExit("V6_GEO_PATCH_VERIFY_FAILED")
    print("V6_GEO_DISCOVERY_PATCH=PASS; scope=general-directory; geo_coordinates_persisted=NO")


def main() -> None:
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        self_test()
        print("V6_GEO_DISCOVERY_PATCH_SELF_TEST=PASS")
    elif len(sys.argv) == 3:
        apply(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve())
    else:
        raise SystemExit("Usage: patch-v6-geo-discovery.py WORKTREE GEO_SOURCE | --self-test")


if __name__ == "__main__":
    main()
