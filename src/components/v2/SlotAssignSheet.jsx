import { X, Check } from 'lucide-react';

const SLOT_CONFIG = [
  { id: 'desayuno',  label: 'Desayuno',       emoji: '🌅' },
  { id: 'snack',     label: 'Media mañana',   emoji: '🍎' },
  { id: 'comida',    label: 'Comida',          emoji: '🍽️' },
  { id: 'merienda',  label: 'Merienda',        emoji: '🥪' },
  { id: 'cena',      label: 'Cena',            emoji: '🌙' },
];

export default function SlotAssignSheet({ item, todaySlots, onAssign, onClose }) {
  const slots = todaySlots || {};

  function handleAssign(slotId) {
    const slot = slots[slotId];
    const entry = {
      inventoryItemId: item.id,
      label: item.name,
      itemType: item.type,
      tags: item.tags ?? [],
      prepTime: item.prepTime ?? null,
      accelBase: item.type === 'acelerador' ? item.name : null,
      portionsAdultConsumed: item.portionsAdult ?? item.adultPortions ?? 2,
      portionsBabyConsumed: item.portionsBaby ?? item.babyPortions ?? 1,
    };
    onAssign(slotId, entry, slot?.confirmedAt);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />

      <div className="fixed inset-x-0 bottom-0 z-40 bg-white rounded-t-3xl max-h-[70vh] flex flex-col lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:bottom-auto lg:top-[10vh] lg:w-full lg:max-w-[480px] lg:rounded-2xl">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-4 py-3 shrink-0 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-400">Añadir a hoy</p>
            <h2 className="text-base font-semibold text-gray-900 leading-tight">{item.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 pb-8">
          {SLOT_CONFIG.map(({ id, label, emoji }) => {
            const slot = slots[id];
            const hasItems = slot?.items?.length > 0;
            const confirmed = !!slot?.confirmedAt;
            return (
              <button
                key={id}
                onClick={() => handleAssign(id)}
                disabled={confirmed}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl border text-left transition-colors ${
                  confirmed
                    ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                    : 'border-gray-200 bg-white hover:border-brand-300 hover:bg-brand-50 active:scale-[0.98]'
                }`}
              >
                <span className="text-xl shrink-0">{emoji}</span>
                <span className="flex-1 text-sm font-medium text-gray-800">{label}</span>
                {confirmed && (
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Check className="w-3 h-3" /> confirmado
                  </span>
                )}
                {hasItems && !confirmed && (
                  <span className="text-xs text-brand-600 bg-brand-50 border border-brand-100 px-2 py-0.5 rounded-full">
                    {slot.items.length} añadido{slot.items.length > 1 ? 's' : ''}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
