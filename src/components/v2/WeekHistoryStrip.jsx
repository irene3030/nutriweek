import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function WeekHistoryStrip({ plans }) {
  const [expanded, setExpanded] = useState(false);

  const confirmedItems = [];
  const seen = new Set();

  Object.values(plans || {}).forEach((plan) => {
    Object.values(plan?.slots || {}).forEach((slot) => {
      if (!slot?.confirmedAt) return;
      (slot.items || []).forEach((item) => {
        const key = item.label?.toLowerCase();
        if (key && !seen.has(key)) {
          seen.add(key);
          confirmedItems.push(item.label);
        }
      });
    });
  });

  if (confirmedItems.length === 0) return null;

  const preview = confirmedItems.slice(0, 3);
  const rest    = confirmedItems.slice(3);

  return (
    <div className="space-y-1.5">
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 text-xs text-gray-400 hover:text-gray-500 transition-colors"
      >
        <span className="flex-1 text-left font-medium">Esta semana ({confirmedItems.length})</span>
        {rest.length > 0 && (expanded
          ? <ChevronUp className="w-3 h-3" />
          : <ChevronDown className="w-3 h-3" />
        )}
      </button>

      <div className="flex flex-wrap gap-1.5">
        {(expanded ? confirmedItems : preview).map((name, i) => (
          <span
            key={i}
            className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full"
          >
            {name}
          </span>
        ))}
        {!expanded && rest.length > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className="text-xs text-gray-400 px-2.5 py-1 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            +{rest.length} más
          </button>
        )}
      </div>
    </div>
  );
}
