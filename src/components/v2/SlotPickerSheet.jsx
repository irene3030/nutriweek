import { useState } from 'react';
import { X, PenLine, User, Baby, ChevronRight } from 'lucide-react';
import FreshnessIndicator from './FreshnessIndicator';
import { daysUntil } from '../../hooks/useInventory';

const SLOT_LABELS = {
  desayuno: 'Desayuno',
  snack:    'Snack',
  comida:   'Comida',
  merienda: 'Merienda',
  cena:     'Cena',
};

const TYPE_CONFIG = {
  'ya-preparado': { label: 'Listo',       color: 'bg-brand-100 text-brand-700' },
  acelerador:     { label: 'Justo-antes', color: 'bg-violet-100 text-violet-700' },
  'snack-batch':  { label: 'Snack',       color: 'bg-amber-100 text-amber-700' },
  flotante:       { label: 'Ingrediente', color: 'bg-rose-100 text-rose-700' },
};

function relevanceScore(item, slotId) {
  const isSnackSlot = slotId === 'snack' || slotId === 'merienda';
  if (isSnackSlot && item.type === 'snack-batch') return 3;
  if (!isSnackSlot && (item.type === 'ya-preparado' || item.type === 'acelerador')) return 2;
  if (item.type === 'flotante') return 1;
  return 0;
}

function sortItems(items, slotId) {
  return [...items].sort((a, b) => {
    const relDiff = relevanceScore(b, slotId) - relevanceScore(a, slotId);
    if (relDiff !== 0) return relDiff;
    if (a.expiresAt && b.expiresAt) return daysUntil(a.expiresAt) - daysUntil(b.expiresAt);
    if (a.expiresAt) return -1;
    if (b.expiresAt) return 1;
    return 0;
  });
}

const DEFAULT_PORTIONS = {
  desayuno: { adult: 0, baby: 1 },
  snack:    { adult: 0, baby: 1 },
  comida:   { adult: 2, baby: 1 },
  merienda: { adult: 0, baby: 1 },
  cena:     { adult: 2, baby: 1 },
};

export default function SlotPickerSheet({ slotId, inventoryItems, onSelect, onClose }) {
  const [manualMode, setManualMode] = useState(false);
  const [manualText, setManualText] = useState('');
  // For aceleradores: which item is being expanded for the prep form
  const [pendingAccel, setPendingAccel] = useState(null); // item
  const [accelMealName, setAccelMealName] = useState('');
  const [accelPrepTime, setAccelPrepTime] = useState('');

  const sorted = sortItems(inventoryItems, slotId);

  const handleItemClick = (item) => {
    if (item.type === 'acelerador') {
      setPendingAccel(item);
      setAccelMealName('');
      setAccelPrepTime('');
      setManualMode(false);
    } else {
      const def = DEFAULT_PORTIONS[slotId] || { adult: 1, baby: 1 };
      onSelect({
        inventoryItemId: item.id,
        label: item.name,
        itemType: item.type,
        tags: item.tags || [],
        confirmedAt: null,
        prepTime: null,
        portionsAdultConsumed: item.type === 'flotante' ? 0 : def.adult,
        portionsBabyConsumed: item.type === 'flotante' ? 0 : def.baby,
      });
    }
  };

  const handleAccelConfirm = () => {
    if (!pendingAccel) return;
    const def = DEFAULT_PORTIONS[slotId] || { adult: 1, baby: 1 };
    onSelect({
      inventoryItemId: pendingAccel.id,
      label: accelMealName.trim() || pendingAccel.name,
      itemType: 'acelerador',
      tags: pendingAccel.tags || [],
      confirmedAt: null,
      prepTime: accelPrepTime.trim() || null,
      accelBase: pendingAccel.name,
      portionsAdultConsumed: def.adult,
      portionsBabyConsumed: def.baby,
    });
  };

  const handleManualSave = () => {
    if (!manualText.trim()) return;
    onSelect({
      inventoryItemId: null,
      label: manualText.trim(),
      itemType: 'manual',
      tags: [],
      confirmedAt: null,
      prepTime: null,
      portionsAdultConsumed: 0,
      portionsBabyConsumed: 0,
    });
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-2xl max-h-[80vh] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 shrink-0">
          <h2 className="font-semibold text-gray-900">
            {SLOT_LABELS[slotId] || slotId} — ¿qué hay?
          </h2>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-4 pb-6 space-y-2">
          {sorted.length === 0 && !manualMode && (
            <p className="text-sm text-gray-400 text-center py-6">
              No hay nada en el inventario todavía.
            </p>
          )}

          {sorted.map((item) => {
            const typeConf = TYPE_CONFIG[item.type];
            const isSnack = item.type === 'snack-batch';
            const isAccel = item.type === 'acelerador';
            const isExpanded = pendingAccel?.id === item.id;

            return (
              <div key={item.id}>
                <button
                  onClick={() => handleItemClick(item)}
                  className={`w-full text-left flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                    isExpanded
                      ? 'border-violet-300 bg-violet-50 rounded-b-none'
                      : 'border-gray-100 hover:border-brand-200 hover:bg-brand-50'
                  }`}
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-gray-900">{item.name}</span>
                      {typeConf && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${typeConf.color}`}>
                          {typeConf.label}
                        </span>
                      )}
                      {item.expiresAt && (
                        <FreshnessIndicator expiresAt={item.expiresAt} daysUntil={daysUntil} />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      {isSnack ? (
                        <span>{item.units ?? 0} uds.</span>
                      ) : (
                        <>
                          {item.portionsAdult > 0 && (
                            <span className="flex items-center gap-0.5">
                              <User className="w-3 h-3" /> {item.portionsAdult}
                            </span>
                          )}
                          {item.portionsBaby > 0 && (
                            <span className="flex items-center gap-0.5">
                              <Baby className="w-3 h-3" /> {item.portionsBaby}
                            </span>
                          )}
                          {item.type === 'flotante' && item.amount && (
                            <span>{item.amount}</span>
                          )}
                          {isAccel && !isExpanded && (
                            <span className="text-violet-400">Toca para especificar qué harás →</span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {isAccel && (
                    <ChevronRight className={`w-4 h-4 text-gray-300 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                  )}
                </button>

                {/* Acelerador inline form */}
                {isExpanded && (
                  <div className="border border-t-0 border-violet-300 bg-violet-50 rounded-b-xl px-3 pb-3 pt-2 space-y-2">
                    <p className="text-xs text-violet-600 font-medium">
                      Base: <span className="font-semibold">{item.name}</span>
                    </p>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">¿Qué harás con esto?</label>
                      <input
                        type="text"
                        value={accelMealName}
                        onChange={(e) => setAccelMealName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && accelMealName.trim() && handleAccelConfirm()}
                        placeholder={`Ej: Tortilla de ${item.name.toLowerCase()}`}
                        autoFocus
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tiempo estimado <span className="text-gray-400">(opcional)</span></label>
                      <input
                        type="text"
                        value={accelPrepTime}
                        onChange={(e) => setAccelPrepTime(e.target.value)}
                        placeholder="Ej: 10 min"
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent bg-white"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => setPendingAccel(null)}
                        className="flex-1 border border-gray-300 text-gray-600 rounded-xl py-2 text-sm hover:bg-white transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleAccelConfirm}
                        disabled={!accelMealName.trim()}
                        className="flex-1 bg-violet-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-violet-700 transition-colors disabled:opacity-40"
                      >
                        Añadir
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {/* Manual entry */}
          {!manualMode ? (
            <button
              onClick={() => { setManualMode(true); setPendingAccel(null); }}
              className="w-full flex items-center gap-2 p-3 rounded-xl border border-dashed border-gray-300 text-sm text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors"
            >
              <PenLine className="w-4 h-4" />
              Escribir a mano
            </button>
          ) : (
            <div className="space-y-2 pt-1">
              <input
                type="text"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleManualSave()}
                placeholder="Ej: Tostada con hummus"
                autoFocus
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => { setManualMode(false); setManualText(''); }}
                  className="flex-1 border border-gray-300 text-gray-600 rounded-xl py-2 text-sm hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleManualSave}
                  disabled={!manualText.trim()}
                  className="flex-1 bg-brand-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-40"
                >
                  Añadir
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
