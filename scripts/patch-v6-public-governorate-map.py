#!/usr/bin/env python3
"""Add a safe governorate-level discovery map; never place inferred business pins."""
from __future__ import annotations
import sys
from pathlib import Path

DIRECTORY_REL = Path("src/components/DirectoryView.tsx")
COMPONENT_REL = Path("src/components/common/PublicGovernorateMap.tsx")

COMPONENT_SOURCE = r'''import React, { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import { Business } from '../../types';
import { DEFAULT_EGYPT_CENTER, EGYPT_GOVERNORATES_MAP } from '../../utils/geoCoordinates';

interface PublicGovernorateMapProps {
  businesses: Business[];
  selectedGovernorate: string;
  onSelectGovernorate: (governorate: string) => void;
}

interface GovernorateDirectoryStat {
  name: string;
  count: number;
  center?: { lat: number; lng: number };
}

export const PublicGovernorateMap: React.FC<PublicGovernorateMapProps> = ({
  businesses,
  selectedGovernorate,
  onSelectGovernorate,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const governorateStats = useMemo<GovernorateDirectoryStat[]>(() => {
    const counts = new Map<string, number>();
    for (const business of businesses) {
      const name = (business.governorate || '').trim();
      if (!name) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count, center: EGYPT_GOVERNORATES_MAP[name]?.center }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ar'));
  }, [businesses]);

  const mappedStats = useMemo(
    () => governorateStats.filter((stat) => Boolean(stat.center)) as Array<GovernorateDirectoryStat & { center: { lat: number; lng: number } }>,
    [governorateStats],
  );

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [DEFAULT_EGYPT_CENTER.lat, DEFAULT_EGYPT_CENTER.lng],
      zoom: 5,
      minZoom: 4,
      maxZoom: 10,
      scrollWheelZoom: false,
      attributionControl: true,
      zoomControl: true,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 12,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    const layer = L.layerGroup().addTo(map);
    mapRef.current = map;
    markersLayerRef.current = layer;

    return () => {
      map.remove();
      mapRef.current = null;
      markersLayerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const layer = markersLayerRef.current;
    if (!map || !layer) return;

    layer.clearLayers();
    const bounds: L.LatLngExpression[] = [];

    mappedStats.forEach((stat) => {
      const color = selectedGovernorate === stat.name ? '#047857' : '#0f766e';
      const icon = L.divIcon({
        className: 'public-governorate-map-marker',
        html: '<span data-testid="public-governorate-marker" style="display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:50%;border:3px solid #ffffff;background:' + color + ';color:#ffffff;font:800 13px/1 Arial,sans-serif;box-shadow:0 2px 10px rgba(15,23,42,.28);">' + stat.count + '</span>',
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });
      const marker = L.marker([stat.center.lat, stat.center.lng], {
        icon,
        keyboard: true,
        title: stat.name + ': ' + stat.count + ' نشاط مدرج في الدليل',
        alt: 'مؤشر تجميعي لمحافظة ' + stat.name,
      });
      marker.bindTooltip(stat.name + ' • ' + stat.count + ' نشاط مدرج');
      marker.on('click', () => onSelectGovernorate(stat.name));
      marker.addTo(layer);
      bounds.push([stat.center.lat, stat.center.lng]);
    });

    const selected = mappedStats.find((stat) => stat.name === selectedGovernorate);
    if (selected) {
      map.setView([selected.center.lat, selected.center.lng], 7, { animate: false });
    } else if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [28, 28], maxZoom: 6, animate: false });
    } else if (bounds.length === 1) {
      const [lat, lng] = bounds[0] as [number, number];
      map.setView([lat, lng], 6, { animate: false });
    } else {
      map.setView([DEFAULT_EGYPT_CENTER.lat, DEFAULT_EGYPT_CENTER.lng], 5, { animate: false });
    }
    requestAnimationFrame(() => map.invalidateSize());
  }, [mappedStats, selectedGovernorate, onSelectGovernorate]);

  return (
    <section data-testid="public-governorate-explorer" className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5" aria-label="استكشاف الدليل حسب المحافظة">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-slate-900">استكشف الأنشطة حسب المحافظة</h2>
          <p className="mt-1 text-xs leading-6 text-slate-500">اختر محافظة لتصفية الأنشطة المنشورة في الدليل.</p>
        </div>
        <button type="button" onClick={() => onSelectGovernorate('all')} className="min-h-9 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-700 hover:bg-slate-100">كل المحافظات</button>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,.9fr)]">
        <div className="min-w-0 space-y-2">
          <div ref={mapContainerRef} data-testid="public-governorate-map" role="group" aria-label="خريطة مرجعية للمحافظات المصرية؛ العلامات تعرض أعداد الأنشطة في الدليل ولا تحدد مواقع الأنشطة" className="h-[280px] w-full overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 sm:h-[340px]" />
          <p className="text-[11px] leading-5 text-slate-500">تنبيه: العلامات نقاط مرجعية عامة للمحافظات لأغراض التصفية فقط، ولا تمثل مواقع الأنشطة أو عناوينها الدقيقة.</p>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-black text-slate-800">المحافظات المدرجة</h3>
            <span className="text-[11px] font-bold text-slate-500">{governorateStats.length} محافظة</span>
          </div>
          <div className="grid max-h-[340px] grid-cols-2 gap-2 overflow-y-auto pr-1">
            {governorateStats.map((stat) => (
              <button
                key={stat.name}
                type="button"
                data-testid="public-governorate-option"
                aria-pressed={selectedGovernorate === stat.name}
                onClick={() => onSelectGovernorate(stat.name)}
                className={'min-h-14 rounded-xl border px-3 py-2 text-right transition ' + (selectedGovernorate === stat.name ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-100' : 'border-slate-200 bg-slate-50 hover:border-emerald-300')}
              >
                <span className="block text-xs font-black text-slate-800">{stat.name}</span>
                <span className="mt-1 block text-[10px] text-slate-500">{stat.count} نشاط مدرج</span>
                {!stat.center && <span className="mt-1 block text-[10px] text-amber-700">بدون نقطة خريطة معتمدة</span>}
              </button>
            ))}
            {governorateStats.length === 0 && <p className="col-span-2 rounded-xl bg-slate-50 p-4 text-center text-xs text-slate-500">ستظهر المحافظات بعد تحميل الدليل المنشور.</p>}
          </div>
        </div>
      </div>
    </section>
  );
};
'''

IMPORT_ANCHOR = "import { LivePublishedCatalogStrip } from './common/LivePublishedCatalogStrip';"
IMPORT_REPLACEMENT = IMPORT_ANCHOR + "\nimport { PublicGovernorateMap } from './common/PublicGovernorateMap';"
MAIN_ANCHOR = '      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8">'
MAP_MOUNT = "        <PublicGovernorateMap businesses={businesses} selectedGovernorate={governorate} onSelectGovernorate={setGovernorate} />"


def patch_directory(source: str) -> tuple[str, bool]:
    original = source
    if "import { PublicGovernorateMap }" not in source:
        if source.count(IMPORT_ANCHOR) != 1:
            raise ValueError("Expected one public catalog strip import anchor")
        source = source.replace(IMPORT_ANCHOR, IMPORT_REPLACEMENT, 1)
    if MAP_MOUNT not in source:
        if source.count(MAIN_ANCHOR) != 1:
            raise ValueError("Expected one public directory main anchor")
        source = source.replace(MAIN_ANCHOR, MAIN_ANCHOR + "\n" + MAP_MOUNT, 1)
    if source.count("import { PublicGovernorateMap }") != 1 or source.count(MAP_MOUNT) != 1:
        raise ValueError("Public governorate map must be imported and mounted exactly once")
    return source, source != original


def self_test() -> None:
    fixture = IMPORT_ANCHOR + "\n" + MAIN_ANCHOR + "\n"
    updated, changed = patch_directory(fixture)
    assert changed
    second, changed_again = patch_directory(updated)
    assert not changed_again and second == updated
    assert "resolveBusinessCoordinates" not in COMPONENT_SOURCE
    assert "EGYPT_GOVERNORATES_MAP[name]?.center" in COMPONENT_SOURCE
    assert "لا تمثل مواقع الأنشطة أو عناوينها الدقيقة" in COMPONENT_SOURCE
    assert "public-governorate-marker" in COMPONENT_SOURCE


def main() -> None:
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        self_test()
        print("V6_PUBLIC_GOVERNORATE_MAP_OVERLAY_SELF_TEST=PASS")
        return
    if len(sys.argv) != 2:
        raise SystemExit("Usage: patch-v6-public-governorate-map.py <extracted-v6-root>")
    root = Path(sys.argv[1]).resolve()
    directory_path = root / DIRECTORY_REL
    component_path = root / COMPONENT_REL
    if not directory_path.is_file():
        raise SystemExit("V6_PUBLIC_GOVERNORATE_MAP_DIRECTORY_TARGET_MISSING")
    if component_path.exists() and component_path.read_text(encoding="utf-8") != COMPONENT_SOURCE:
        raise SystemExit("V6_PUBLIC_GOVERNORATE_MAP_COMPONENT_CONFLICT")
    directory_source, changed = patch_directory(directory_path.read_text(encoding="utf-8"))
    if changed:
        directory_path.write_text(directory_source, encoding="utf-8")
    component_path.parent.mkdir(parents=True, exist_ok=True)
    if not component_path.exists():
        component_path.write_text(COMPONENT_SOURCE, encoding="utf-8")
    if component_path.read_text(encoding="utf-8") != COMPONENT_SOURCE:
        raise SystemExit("V6_PUBLIC_GOVERNORATE_MAP_COMPONENT_VERIFY_FAILED")
    checked, changed_again = patch_directory(directory_path.read_text(encoding="utf-8"))
    if changed_again or checked != directory_source:
        raise SystemExit("V6_PUBLIC_GOVERNORATE_MAP_OVERLAY_NOT_IDEMPOTENT")
    print("V6_PUBLIC_GOVERNORATE_MAP_OVERLAY=PASS changed=" + str(int(changed)))


if __name__ == "__main__":
    main()
