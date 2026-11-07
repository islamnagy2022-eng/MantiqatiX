#!/usr/bin/env python3
"""Restore compact activity-card quick-tabs in the sanitized V6 public directory."""
from __future__ import annotations
import sys
from pathlib import Path

TARGET = Path("src/components/DirectoryView.tsx")

def replace_once(source: str, old: str, new: str, label: str) -> str:
    if new in source:
        return source
    count = source.count(old)
    if count != 1:
        raise ValueError(f"{label}: expected one anchor, found {count}")
    return source.replace(old, new, 1)

def patch(source: str) -> tuple[str, bool]:
    original = source
    source = replace_once(
        source,
        "  const [coverIndex, setCoverIndex] = useState(0);",
        "  const [coverIndex, setCoverIndex] = useState(0);\n  const [activityViewStyle, setActivityViewStyle] = useState<'cards' | 'tabs'>('cards');",
        "activity view state",
    )
    source = replace_once(
        source,
        """            <button type="button" onClick={() => setSelectedActivityId('all')} className="text-xs font-bold text-emerald-800 hover:underline">عرض كل الأنشطة</button>""",
        """            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1" aria-label="طريقة عرض الأنشطة">
                <button data-testid="activity-view-cards" type="button" aria-pressed={activityViewStyle === 'cards'} onClick={() => setActivityViewStyle('cards')} className={activityViewStyle === 'cards' ? 'inline-flex min-h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-[11px] font-black text-slate-900 shadow-sm' : 'inline-flex min-h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-black text-slate-500 hover:text-slate-900'}><span aria-hidden="true">▦</span>شبكة</button>
                <button data-testid="activity-view-tabs" type="button" aria-pressed={activityViewStyle === 'tabs'} onClick={() => setActivityViewStyle('tabs')} className={activityViewStyle === 'tabs' ? 'inline-flex min-h-8 items-center gap-1 rounded-lg bg-white px-2.5 text-[11px] font-black text-slate-900 shadow-sm' : 'inline-flex min-h-8 items-center gap-1 rounded-lg px-2.5 text-[11px] font-black text-slate-500 hover:text-slate-900'}><span aria-hidden="true">☰</span>شريط سريع</button>
              </div>
              <button type="button" onClick={() => setSelectedActivityId('all')} className="text-xs font-bold text-emerald-800 hover:underline">عرض كل الأنشطة</button>
            </div>""",
        "activity view controls",
    )
    source = replace_once(
        source,
        '<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">',
        '<div data-testid="activity-filter-list" className={activityViewStyle === \'cards\' ? \'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4\' : \'flex items-center gap-2 overflow-x-auto pb-2\'}>',
        "activity filter container",
    )
    source = replace_once(
        source,
        'className={`rounded-2xl border p-4 text-right transition ${selectedActivityId === \'all\' ? \'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-100\' : \'border-slate-200 bg-white hover:border-emerald-300\'}`}',
        'className={activityViewStyle === \'cards\' ? `min-w-0 rounded-2xl border p-4 text-right transition ${selectedActivityId === \'all\' ? \'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-100\' : \'border-slate-200 bg-white hover:border-emerald-300\'}` : `min-w-52 shrink-0 rounded-xl border p-3 text-right transition ${selectedActivityId === \'all\' ? \'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-100\' : \'border-slate-200 bg-white hover:border-emerald-300\'}`}',
        "all activities responsive card",
    )
    source = replace_once(
        source,
        'className={`rounded-2xl border p-4 text-right transition ${selectedActivityId === activity.id ? \'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-100\' : \'border-slate-200 bg-white hover:border-emerald-300\'}`}',
        'className={activityViewStyle === \'cards\' ? `min-w-0 rounded-2xl border p-4 text-right transition ${selectedActivityId === activity.id ? \'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-100\' : \'border-slate-200 bg-white hover:border-emerald-300\'}` : `min-w-52 shrink-0 rounded-xl border p-3 text-right transition ${selectedActivityId === activity.id ? \'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-100\' : \'border-slate-200 bg-white hover:border-emerald-300\'}`}',
        "activity responsive card",
    )
    for marker in ['data-testid="activity-view-cards"', 'data-testid="activity-view-tabs"', 'data-testid="activity-filter-list"']:
        if marker not in source:
            raise ValueError(f"Missing activity view marker: {marker}")
    return source, source != original

def self_test() -> None:
    fixture = """  const [coverIndex, setCoverIndex] = useState(0);
            <button type="button" onClick={() => setSelectedActivityId('all')} className="text-xs font-bold text-emerald-800 hover:underline">عرض كل الأنشطة</button>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <button type="button" onClick={() => setSelectedActivityId('all')} className={`rounded-2xl border p-4 text-right transition ${selectedActivityId === 'all' ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-white hover:border-emerald-300'}`}>
            {activityOptions.map((activity) => (
              <button key={activity.id} type="button" onClick={() => setSelectedActivityId(activity.id)} className={`rounded-2xl border p-4 text-right transition ${selectedActivityId === activity.id ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-100' : 'border-slate-200 bg-white hover:border-emerald-300'}`}>
"""
    updated, changed = patch(fixture)
    assert changed
    again, changed_again = patch(updated)
    assert not changed_again and again == updated

def main() -> None:
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        self_test()
        print("V6_PUBLIC_ACTIVITY_VIEW_OVERLAY_SELF_TEST=PASS")
        return
    if len(sys.argv) != 2:
        raise SystemExit("Usage: patch-v6-sector-view-markers.py <extracted-v6-root>")
    target = Path(sys.argv[1]).resolve() / TARGET
    if not target.is_file():
        raise SystemExit("V6_PUBLIC_ACTIVITY_VIEW_TARGET_MISSING")
    updated, changed = patch(target.read_text(encoding="utf-8"))
    if changed:
        target.write_text(updated, encoding="utf-8")
    verified, changed_again = patch(target.read_text(encoding="utf-8"))
    if changed_again or verified != updated:
        raise SystemExit("V6_PUBLIC_ACTIVITY_VIEW_OVERLAY_NOT_IDEMPOTENT")
    print(f"V6_PUBLIC_ACTIVITY_VIEW_OVERLAY=PASS changed={int(changed)}")

if __name__ == "__main__":
    main()
