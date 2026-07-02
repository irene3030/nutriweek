import { useState } from 'react';
import { Plus, X, Sparkles, Pencil, BookmarkPlus, Clock, Sun, Apple, UtensilsCrossed, Cookie, Moon, ArrowDown } from 'lucide-react';

const SLOT_LABELS = {
  desayuno: 'Desayuno',
  snack:    'Snack',
  comida:   'Comida',
  merienda: 'Merienda',
  cena:     'Cena',
};

const SLOT_ICONS = {
  desayuno: Sun,
  snack:    Apple,
  comida:   UtensilsCrossed,
  merienda: Cookie,
  cena:     Moon,
};

const TYPE_BADGES = {
  'ya-preparado': { label: 'Listo',       color: 'bg-brand-100 text-brand-700' },
  acelerador:     { label: 'Base',        color: 'bg-violet-100 text-violet-700' },
  'snack-batch':  { label: 'Snack',       color: 'bg-amber-100 text-amber-700' },
  flotante:       null,
  manual:         null,
};

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

const AI_SLOTS = new Set(['comida', 'cena']);

const SLOT_CUTOFF_HOUR = {
  desayuno: 10, snack: 12, comida: 15, merienda: 18, cena: 22,
};

function getSlotStatus(slotId, slot, date) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const isConfirmed = !!slot?.confirmedAt;
  const hasItems = (slot?.items?.length ?? 0) > 0;

  const isPast = date < today;
  const isToday = date === today;

  if (isPast || (isToday && now.getHours() >= (SLOT_CUTOFF_HOUR[slotId] ?? 22))) {
    return isConfirmed ? 'confirmed' : 'missed';
  }
  return hasItems ? 'planned' : 'empty';
}

const SLOT_ICON_COLOR = {
  confirmed: 'text-green-400',
  missed:    'text-red-400',
  planned:   'text-amber-400',
  empty:     'text-gray-300',
};

// slot = { items: SlotEntry[], confirmedAt: string|null } | null
export default function PlanSlotRow({ slotId, slot, date, onAddItem, onRemoveItem, onEditItem, onConfirm, onUpdatePortions, onAiPropose, disabled, template, onSaveTemplate, onApplyTemplate, dragActive, onDropItem }) {
  const [editingIdx, setEditingIdx] = useState(null);
  const [draftAdult, setDraftAdult] = useState(0);
  const [draftBaby, setDraftBaby] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);

  const label = SLOT_LABELS[slotId] || slotId;
  const SlotIcon = SLOT_ICONS[slotId] ?? UtensilsCrossed;
  const items = slot?.items || [];
  const isEmpty = !slot || items.length === 0;
  const isConfirmed = !!slot?.confirmedAt;
  const isPlanned = !isEmpty && !isConfirmed;
  const slotStatus = getSlotStatus(slotId, slot, date);
  const isDropTarget = dragActive && !isConfirmed;

  function handleDragOver(e) {
    if (!isDropTarget) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }
  function handleDragLeave() { setIsDragOver(false); }
  function handleDrop(e) {
    if (!isDropTarget) return;
    e.preventDefault();
    setIsDragOver(false);
    onDropItem?.();
  }

  const openPortionEditor = (idx) => {
    const item = items[idx];
    setDraftAdult(item.portionsAdultConsumed ?? 0);
    setDraftBaby(item.portionsBabyConsumed ?? 0);
    setEditingIdx(idx);
  };

  const savePortions = () => {
    onUpdatePortions?.(editingIdx, draftAdult, draftBaby);
    setEditingIdx(null);
  };

  return (
    <div
      className={`flex items-start gap-3 py-3 border-b border-gray-100 last:border-0 transition-colors rounded-xl
        ${disabled ? 'opacity-50' : ''}
        ${isDragOver ? 'bg-brand-50 ring-1 ring-brand-300 px-2 -mx-2' : ''}
        ${isDropTarget && !isDragOver ? 'cursor-copy' : ''}
      `}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Slot icon */}
      <span className="shrink-0 pt-0.5" title={label}>
        <SlotIcon className={`w-4 h-4 ${SLOT_ICON_COLOR[slotStatus]}`} />
      </span>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {isEmpty && isDragOver ? (
          <div className="flex items-center gap-1.5 text-xs text-brand-600 font-medium py-1">
            <ArrowDown className="w-3.5 h-3.5" />
            Soltar aquí
          </div>
        ) : isEmpty ? (
          <div className="space-y-1.5">
            {template?.length > 0 && onApplyTemplate && (
              <button
                onClick={onApplyTemplate}
                disabled={disabled}
                className="flex items-center gap-1.5 text-xs font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded-lg px-2 py-1 hover:bg-brand-100 transition-colors"
              >
                <BookmarkPlus className="w-3 h-3" />
                Usar {label.toLowerCase()} habitual
              </button>
            )}
            <div className="flex items-center gap-3">
              <button
                onClick={onAddItem}
                disabled={disabled}
                className="flex items-center gap-1 text-sm text-gray-400 hover:text-brand-600 transition-colors group"
              >
                <Plus className="w-4 h-4 group-hover:text-brand-500" />
                <span className="text-xs">Añadir</span>
              </button>
              {AI_SLOTS.has(slotId) && onAiPropose && (
                <button
                  onClick={onAiPropose}
                  disabled={disabled}
                  className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Proponer</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            {items.map((item, idx) => {
              const badge = TYPE_BADGES[item.itemType];
              const isLast = idx === items.length - 1;

              return (
                <div key={idx} className="flex items-start gap-2 group/item">
                  <div className="flex-1 min-w-0 space-y-0.5">
                    {/* Label + badge — flotante-aware */}
                    {item.itemType === 'flotante' && item.isNamedDish ? (
                      // Named dish: no badge, all ingredients in subtitle
                      <>
                        <span className={`text-sm font-medium ${isConfirmed ? 'text-gray-400' : 'text-gray-800'}`}>
                          {item.label}
                        </span>
                        {(() => {
                          const all = [item.primaryIngredientName, ...(item.additionalIngredientNames || [])].filter(Boolean);
                          return all.length > 0 ? (
                            <p className="text-xs text-gray-400 leading-tight">{all.join(', ')}</p>
                          ) : null;
                        })()}
                      </>
                    ) : item.itemType === 'flotante' && item.additionalIngredientNames?.length > 0 ? (
                      // Raw ingredient + extras: everything inline
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${isConfirmed ? 'text-gray-400' : 'text-gray-800'}`}>
                          {[item.label, ...item.additionalIngredientNames].join(' · ')}
                        </span>
                      </div>
                    ) : (
                      // Default: label + badge + pendingPrep
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-medium ${isConfirmed ? 'text-gray-400' : 'text-gray-800'}`}>
                          {item.itemType === 'acelerador' ? (item.accelBase || item.label) : item.label}
                        </span>
                        {badge && (
                          <span className={`shrink-0 text-xs px-1.5 py-0.5 rounded-full font-medium ${badge.color}`}>
                            {badge.label}
                          </span>
                        )}
                        {item.pendingPrep && (
                          <span className="shrink-0 flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium bg-amber-100 text-amber-700">
                            <Clock className="w-2.5 h-2.5" /> Por preparar
                          </span>
                        )}
                      </div>
                    )}

                    {/* Acelerador meta: prep note + time */}
                    {item.itemType === 'acelerador' && (item.label !== item.accelBase || item.prepTime) && (
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        {item.label && item.label !== item.accelBase && <span>{item.label}</span>}
                        {item.label && item.label !== item.accelBase && item.prepTime && <span>·</span>}
                        {item.prepTime && (
                          <span className="text-violet-500 font-medium">{item.prepTime}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Per-item actions — hidden until hover */}
                  <div className="flex items-center gap-0.5 shrink-0 mt-0.5 opacity-0 group-hover/item:opacity-100 transition-opacity">
                    {isConfirmed && idx === 0 && onSaveTemplate && (
                      <button
                        onClick={() => onSaveTemplate(items.map(({ label: l, itemType, tags }) => ({ label: l, itemType, tags: tags || [] })))}
                        className="flex items-center justify-center w-6 h-6 rounded-lg text-gray-300 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        title="Guardar como habitual"
                      >
                        <BookmarkPlus className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      onClick={() => onEditItem?.(idx)}
                      className="flex items-center justify-center w-6 h-6 rounded-lg text-gray-300 hover:text-brand-500 hover:bg-brand-50 transition-colors"
                      aria-label="Editar"
                      title="Editar"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onRemoveItem?.(idx)}
                      className="flex items-center justify-center w-6 h-6 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                      aria-label="Quitar"
                      title="Eliminar"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    {isLast && (
                      <button
                        onClick={onAddItem}
                        className="flex items-center justify-center w-6 h-6 rounded-lg text-gray-300 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        aria-label="Añadir otro"
                        title="Añadir otro"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {isPlanned && (
              <div className="flex justify-end pt-1">
                <button
                  onClick={onConfirm}
                  className="text-xs font-medium px-3 py-1.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                >
                  Confirmar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
