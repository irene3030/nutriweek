import { X, RotateCcw } from 'lucide-react';

const SLOTS = ['desayuno', 'snack', 'comida', 'merienda', 'cena'];

const SLOT_LABELS = {
  desayuno: 'Desayuno', snack: 'Snack', comida: 'Comida', merienda: 'Merienda', cena: 'Cena',
};

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function formatPastDate(dateStr) {
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  if (dateStr === yesterday) return 'Ayer';
  if (dateStr === twoDaysAgo) return 'Anteayer';
  const d = new Date(dateStr + 'T12:00:00');
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()}`;
}

// Construye la lista de slots confirmados de días anteriores a targetDate, más recientes primero.
function buildCandidates(plans, targetDate) {
  return Object.keys(plans)
    .filter((dateStr) => dateStr < targetDate)
    .sort((a, b) => b.localeCompare(a))
    .flatMap((dateStr) =>
      SLOTS.map((slotId) => {
        const slot = plans[dateStr]?.slots?.[slotId];
        if (!slot?.confirmedAt || !slot.items?.length) return null;
        return { dateStr, slotId, items: slot.items };
      }).filter(Boolean)
    );
}

export default function RepeatMealSheet({ plans, targetDate, targetSlot, dayLabel, onClose, onSelect }) {
  const candidates = buildCandidates(plans, targetDate);
  const slotLabel = SLOT_LABELS[targetSlot] || targetSlot;

  function handlePick(candidate) {
    const entries = candidate.items.map((item) => ({
      inventoryItemId: null,
      additionalInventoryIds: [],
      additionalIngredientNames: [],
      label: item.label,
      itemType: 'manual',
      tags: item.tags || [],
      portionsAdultConsumed: 0,
      portionsBabyConsumed: 0,
      prepTime: null,
      accelBase: null,
    }));
    onSelect(entries);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl px-5 pt-4 pb-8 shadow-xl max-h-[75vh] flex flex-col">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5 shrink-0" />

        <div className="flex items-start justify-between mb-4 shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">Repetir comida</h2>
            <p className="text-sm text-gray-400 mt-0.5">Añadir a {slotLabel} · {dayLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {candidates.length === 0 ? (
          <p className="text-sm text-gray-400 py-6 text-center">
            No hay comidas confirmadas en días anteriores para repetir.
          </p>
        ) : (
          <div className="overflow-y-auto space-y-2">
            {candidates.map((c) => (
              <button
                key={`${c.dateStr}:${c.slotId}`}
                onClick={() => handlePick(c)}
                className="w-full flex items-start gap-3 text-left px-3 py-2.5 rounded-xl border border-gray-100 hover:border-brand-300 hover:bg-brand-50 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5 text-gray-300 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-400">
                    {formatPastDate(c.dateStr)} · {SLOT_LABELS[c.slotId] || c.slotId}
                  </p>
                  <p className="text-sm text-gray-800 font-medium truncate">
                    {c.items.map((i) => i.label).join(', ')}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
