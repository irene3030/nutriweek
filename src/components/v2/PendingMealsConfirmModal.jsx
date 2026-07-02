import { useState } from 'react';
import { Pencil, Check } from 'lucide-react';
import Modal from '../ui/Modal';
import EditSlotItemModal from './EditSlotItemModal';

const SLOT_LABELS = {
  desayuno: 'Desayuno',
  snack:    'Snack',
  comida:   'Comida',
  merienda: 'Merienda',
  cena:     'Cena',
};

// pendingSlots: [{ dateStr, dateLabel, slotId, items }]
export default function PendingMealsConfirmModal({ pendingSlots, onConfirmSlot, onUpdateItem, onDismiss }) {
  const [removedKeys, setRemovedKeys] = useState(() => new Set());
  const [editTarget, setEditTarget] = useState(null); // { dateStr, slotId, idx, item }
  const [confirming, setConfirming] = useState(false);

  if (!pendingSlots?.length) return null;

  function toggle(dateStr, slotId, idx) {
    const key = `${dateStr}:${slotId}:${idx}`;
    setRemovedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function handleConfirm() {
    setConfirming(true);
    try {
      for (const { dateStr, slotId, items } of pendingSlots) {
        const keepIndices = new Set(
          items.map((_, idx) => idx).filter((idx) => !removedKeys.has(`${dateStr}:${slotId}:${idx}`))
        );
        await onConfirmSlot(dateStr, slotId, keepIndices);
      }
      onDismiss();
    } finally {
      setConfirming(false);
    }
  }

  return (
    <>
      <Modal isOpen title="¿Qué comiste?" onClose={onDismiss} maxWidth="max-w-sm" headerBorder={false}>
        <div className="space-y-5">
          {pendingSlots.map(({ dateStr, dateLabel, slotId, items }) => (
            <div key={`${dateStr}:${slotId}`} className="space-y-1.5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                {dateLabel} · {SLOT_LABELS[slotId] || slotId}
              </h3>
              <ul className="space-y-1.5">
                {items.map((item, idx) => {
                  const key = `${dateStr}:${slotId}:${idx}`;
                  const checked = !removedKeys.has(key);
                  return (
                    <li key={idx} className="flex items-center gap-2.5 rounded-xl bg-gray-50 px-3 py-2">
                      <button
                        type="button"
                        onClick={() => toggle(dateStr, slotId, idx)}
                        aria-pressed={checked}
                        aria-label={checked ? 'Marcar como no comido' : 'Marcar como comido'}
                        className={`shrink-0 w-5 h-5 flex items-center justify-center rounded-md border transition-colors ${
                          checked ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-300 text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                      </button>
                      <span className={`flex-1 text-sm ${checked ? 'text-gray-700' : 'text-gray-400 line-through'}`}>
                        {item.label}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditTarget({ dateStr, slotId, idx, item })}
                        className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg text-gray-300 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                        aria-label="Editar"
                        title="Editar"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onDismiss}
              disabled={confirming}
              className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-3 font-medium hover:bg-gray-50 transition-colors disabled:opacity-40"
            >
              Aún no
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={confirming}
              className="flex-1 bg-brand-600 text-white rounded-xl py-3 font-medium hover:bg-brand-700 transition-colors disabled:opacity-40"
            >
              {confirming ? 'Confirmando…' : 'Confirmar'}
            </button>
          </div>
        </div>
      </Modal>

      <EditSlotItemModal
        isOpen={!!editTarget}
        item={editTarget?.item}
        onClose={() => setEditTarget(null)}
        onSave={(fields) => onUpdateItem(editTarget.dateStr, editTarget.slotId, editTarget.idx, fields)}
      />
    </>
  );
}
