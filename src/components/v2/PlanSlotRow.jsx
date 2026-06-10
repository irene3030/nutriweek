import { useState } from 'react';
import { Plus, X, Check, User, Baby } from 'lucide-react';

const SLOT_LABELS = {
  desayuno: 'Desayuno',
  snack:    'Snack',
  comida:   'Comida',
  merienda: 'Merienda',
  cena:     'Cena',
};

const TYPE_BADGES = {
  'ya-preparado': { label: 'Listo',       color: 'bg-brand-100 text-brand-700' },
  acelerador:     { label: 'Justo-antes', color: 'bg-violet-100 text-violet-700' },
  'snack-batch':  { label: 'Snack',       color: 'bg-amber-100 text-amber-700' },
  flotante:       { label: 'Ingrediente', color: 'bg-rose-100 text-rose-700' },
  manual:         { label: 'Manual',      color: 'bg-gray-100 text-gray-600' },
};

// Types that track portions (adult + baby)
const SHOWS_PORTIONS = new Set(['ya-preparado', 'acelerador', 'snack-batch']);

function PortionCounter({ icon, value, onChange }) {
  return (
    <span className="flex items-center gap-0.5">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-base leading-none"
      >
        −
      </button>
      <span className="flex items-center gap-0.5 min-w-[2ch] justify-center text-xs text-gray-600">
        {icon}
        <span className="font-medium">{value}</span>
      </span>
      <button
        onClick={() => onChange(value + 1)}
        className="w-5 h-5 flex items-center justify-center rounded text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors text-base leading-none"
      >
        +
      </button>
    </span>
  );
}

export default function PlanSlotRow({ slotId, slotEntry, onPick, onConfirm, onClear, onUpdatePortions, disabled }) {
  const label = SLOT_LABELS[slotId] || slotId;
  const isConfirmed = !!slotEntry?.confirmedAt;
  const isPlanned = slotEntry && !isConfirmed;
  const badge = slotEntry ? TYPE_BADGES[slotEntry.itemType] : null;
  const showPortions = slotEntry && SHOWS_PORTIONS.has(slotEntry.itemType);

  const [editingPortions, setEditingPortions] = useState(false);
  const [draftAdult, setDraftAdult] = useState(0);
  const [draftBaby, setDraftBaby] = useState(0);

  const openPortionEditor = () => {
    setDraftAdult(slotEntry.portionsAdultConsumed ?? 0);
    setDraftBaby(slotEntry.portionsBabyConsumed ?? 0);
    setEditingPortions(true);
  };

  const savePortions = () => {
    onUpdatePortions?.(draftAdult, draftBaby);
    setEditingPortions(false);
  };

  return (
    <div className={`flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0 ${disabled ? 'opacity-50' : ''}`}>
      {/* Slot label — align top */}
      <span className="w-20 shrink-0 text-xs font-medium text-gray-400 uppercase tracking-wide pt-0.5">
        {label}
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1">
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
          <>
            {/* Label + badge */}
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

            {/* Acelerador meta */}
            {(slotEntry.accelBase || slotEntry.prepTime) && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                {slotEntry.accelBase && <span>Base: {slotEntry.accelBase}</span>}
                {slotEntry.accelBase && slotEntry.prepTime && <span>·</span>}
                {slotEntry.prepTime && (
                  <span className="text-violet-500 font-medium">{slotEntry.prepTime}</span>
                )}
              </div>
            )}

            {/* Portions row — editable when planned */}
            {showPortions && !isConfirmed && (
              <div className="flex items-center gap-3">
                {editingPortions ? (
                  <>
                    <PortionCounter
                      icon={<User className="w-3 h-3" />}
                      value={draftAdult}
                      onChange={setDraftAdult}
                    />
                    <PortionCounter
                      icon={<Baby className="w-3 h-3" />}
                      value={draftBaby}
                      onChange={setDraftBaby}
                    />
                    <button
                      onClick={savePortions}
                      className="text-xs text-brand-600 font-medium hover:underline"
                    >
                      Listo
                    </button>
                  </>
                ) : (
                  <button
                    onClick={openPortionEditor}
                    className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <span className="flex items-center gap-0.5">
                      <User className="w-3 h-3" />
                      {slotEntry.portionsAdultConsumed ?? 0}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <Baby className="w-3 h-3" />
                      {slotEntry.portionsBabyConsumed ?? 0}
                    </span>
                  </button>
                )}
              </div>
            )}

            {/* Confirmed portions (read-only) */}
            {showPortions && isConfirmed && (
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="flex items-center gap-0.5">
                  <User className="w-3 h-3" />
                  {slotEntry.portionsAdultConsumed ?? 0}
                </span>
                <span className="flex items-center gap-0.5">
                  <Baby className="w-3 h-3" />
                  {slotEntry.portionsBabyConsumed ?? 0}
                </span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0 pt-0.5">
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
