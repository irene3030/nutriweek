import { Plus, X, Check } from 'lucide-react';

const SLOT_LABELS = {
  desayuno: 'Desayuno',
  snack:    'Snack',
  comida:   'Comida',
  merienda: 'Merienda',
  cena:     'Cena',
};

const TYPE_BADGES = {
  'ya-preparado': { label: 'Listo',      color: 'bg-brand-100 text-brand-700' },
  acelerador:     { label: 'Justo-antes', color: 'bg-violet-100 text-violet-700' },
  'snack-batch':  { label: 'Snack',      color: 'bg-amber-100 text-amber-700' },
  flotante:       { label: 'Ingrediente', color: 'bg-rose-100 text-rose-700' },
  manual:         { label: 'Manual',     color: 'bg-gray-100 text-gray-600' },
};

export default function PlanSlotRow({ slotId, slotEntry, onPick, onConfirm, onClear, disabled }) {
  const label = SLOT_LABELS[slotId] || slotId;
  const isConfirmed = !!slotEntry?.confirmedAt;
  const isPlanned = slotEntry && !isConfirmed;
  const badge = slotEntry ? TYPE_BADGES[slotEntry.itemType] : null;

  return (
    <div className={`flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0 ${disabled ? 'opacity-50' : ''}`}>
      {/* Slot label */}
      <span className="w-20 shrink-0 text-xs font-medium text-gray-400 uppercase tracking-wide">
        {label}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {!slotEntry ? (
          <button
            onClick={onPick}
            disabled={disabled}
            className="flex items-center gap-1 text-sm text-gray-400 hover:text-brand-600 transition-colors group"
          >
            <Plus className="w-4 h-4 group-hover:text-brand-500" />
            <span className="text-xs">Añadir</span>
          </button>
        ) : (
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-sm font-medium truncate ${isConfirmed ? 'text-gray-400' : 'text-gray-800'}`}>
                {slotEntry.label}
              </span>
              {badge && (
                <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${badge.color}`}>
                  {badge.label}
                </span>
              )}
            </div>
            {(slotEntry.accelBase || slotEntry.prepTime) && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                {slotEntry.accelBase && (
                  <span>Base: {slotEntry.accelBase}</span>
                )}
                {slotEntry.accelBase && slotEntry.prepTime && <span>·</span>}
                {slotEntry.prepTime && (
                  <span className="text-violet-500 font-medium">{slotEntry.prepTime}</span>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {isConfirmed && (
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-green-100">
            <Check className="w-4 h-4 text-green-600" />
          </span>
        )}
        {isPlanned && (
          <>
            <button
              onClick={onClear}
              className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
              aria-label="Quitar"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={onConfirm}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors min-h-[32px]"
            >
              Confirmar
            </button>
          </>
        )}
      </div>
    </div>
  );
}
