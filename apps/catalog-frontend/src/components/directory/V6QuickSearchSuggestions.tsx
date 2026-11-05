import React from 'react';
import { Sparkles } from 'lucide-react';

const QUICK_SEARCH_SUGGESTIONS = [
  { label: 'صيدليات', query: 'صيدلية' },
  { label: 'مطاعم', query: 'مطعم' },
  { label: 'صيانة تكييف', query: 'تكييف' },
  { label: 'عقارات', query: 'شقة' },
  { label: 'أطباء وعيادات', query: 'طبيب' },
] as const;

interface V6QuickSearchSuggestionsProps {
  onSelect: (query: string) => void;
}

/**
 * V6-inspired quick-search presentation adapted to the primary catalog's
 * existing query state. It does not own search logic, taxonomy, or data.
 */
export const V6QuickSearchSuggestions: React.FC<V6QuickSearchSuggestionsProps> = ({ onSelect }) => (
  <div
    dir="rtl"
    data-testid="directory-quick-search-suggestions"
    aria-label="اقتراحات بحث سريعة"
    className="mt-3 space-y-2"
  >
    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
      <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-amber-500" />
      <span>ابدأ ببحث سريع</span>
    </div>
    <div className="flex flex-wrap gap-2">
      {QUICK_SEARCH_SUGGESTIONS.map((suggestion) => (
        <button
          key={suggestion.label}
          type="button"
          onClick={() => onSelect(suggestion.query)}
          className="min-h-9 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
          {suggestion.label}
        </button>
      ))}
    </div>
  </div>
);
