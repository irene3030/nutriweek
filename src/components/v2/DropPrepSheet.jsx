import { useState, useEffect } from 'react';
import { X, Sparkles, User, Baby } from 'lucide-react';
import { inferPrepMethod } from '../../lib/claude';

const SLOT_LABELS = {
  desayuno: 'Desayuno', snack: 'Snack', comida: 'Comida', merienda: 'Merienda', cena: 'Cena',
};

const PREP_METHODS = ['Air fryer', 'Horno', 'Plancha', 'Sartén', 'Olla', 'Vapor', 'Microondas', 'Crudo / Sin cocción'];

function Counter({ icon: Icon, label, value, onChange }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-xs text-gray-400">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => onChange(Math.max(0, value - 1))}
          className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors text-lg leading-none flex items-center justify-center"
        >−</button>
        <div className="flex items-center gap-1 w-8 justify-center">
          <Icon className="w-3.5 h-3.5 text-gray-400" />
          <span className="text-sm font-semibold text-gray-800">{value}</span>
        </div>
        <button
          onClick={() => onChange(value + 1)}
          className="w-8 h-8 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors text-lg leading-none flex items-center justify-center"
        >+</button>
      </div>
    </div>
  );
}

export default function DropPrepSheet({
  item,
  targetSlot,
  dayLabel,
  hasAiAccess,
  flotanteItems = [],
  onClose,
  onConfirm,
  onOpenAi,
}) {
  const isFloating = item.type === 'flotante';
  const slotLabel  = SLOT_LABELS[targetSlot] || targetSlot;

  const [step,             setStep]             = useState('name'); // 'name' | 'method'
  const [prepName,         setPrepName]         = useState(item.name);
  const [nameEdited,       setNameEdited]       = useState(false);
  const [adult,            setAdult]            = useState(1);
  const [baby,             setBaby]             = useState(1);
  const [extraIds,         setExtraIds]         = useState(() => new Set());
  const [depletedIds,      setDepletedIds]      = useState(() => new Set());
  const [prepMethodText,   setPrepMethodText]   = useState('');
  const [inferring,        setInferring]        = useState(false);

  const availableExtra = flotanteItems.filter(i => i.id !== item.id);
  const selectedExtras = availableExtra.filter(i => extraIds.has(i.id));
  const depletableItems = [item, ...selectedExtras];
  const needsPrepStep = isFloating && (nameEdited || selectedExtras.length > 0);

  // Auto-update name when selection changes, unless user has manually edited it
  useEffect(() => {
    if (!isFloating || nameEdited) return;
    const names = [item.name, ...selectedExtras.map(i => i.name)];
    setPrepName(names.join(' + '));
  }, [extraIds]); // eslint-disable-line react-hooks/exhaustive-deps

  function toggleExtra(id) {
    setExtraIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleDepleted(id) {
    setDepletedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleNameChange(e) {
    setPrepName(e.target.value);
    setNameEdited(true);
  }

  function buildFloatingEntry(extraFields) {
    const name = prepName.trim();
    const allTags = [...new Set([
      ...(item.tags || []),
      ...selectedExtras.flatMap(i => i.tags || []),
    ])];
    const ingredientTags = [
      { name: item.name, tags: item.tags || [] },
      ...selectedExtras.map(i => ({ name: i.name, tags: i.tags || [] })),
    ];
    const relevantIds = new Set(depletableItems.map(i => i.id));
    return {
      inventoryItemId:           item.id,
      additionalInventoryIds:    selectedExtras.map(i => i.id),
      additionalIngredientNames: selectedExtras.map(i => i.name),
      primaryIngredientName:     item.name,
      isNamedDish:               nameEdited,
      label:                     name,
      itemType:                  'flotante',
      tags:                      allTags,
      ingredientTags,
      portionsAdultConsumed:     0,
      portionsBabyConsumed:      0,
      prepTime:                  null,
      accelBase:                 null,
      depletedInventoryIds:      [...depletedIds].filter(id => relevantIds.has(id)),
      ...extraFields,
    };
  }

  function handleConfirmDirect() {
    if (!prepName.trim()) return;
    onConfirm(buildFloatingEntry({}));
  }

  async function handleConfirmWithMethod() {
    let method = prepMethodText.trim();
    if (!method && hasAiAccess) {
      setInferring(true);
      try {
        const result = await inferPrepMethod({
          dishName: prepName.trim(),
          ingredients: depletableItems.map(i => i.name),
        });
        method = result?.method || '';
      } catch {
        method = '';
      } finally {
        setInferring(false);
      }
    }
    onConfirm(buildFloatingEntry({
      id: crypto.randomUUID(),
      pendingPrep: true,
      prepMethod: method || null,
    }));
  }

  function handleNext() {
    if (!prepName.trim()) return;
    if (needsPrepStep) setStep('method');
    else handleConfirmDirect();
  }

  function handleConfirmPortions() {
    onConfirm({
      inventoryItemId:          item.id,
      additionalInventoryIds:   [],
      additionalIngredientNames: [],
      label:                    item.name,
      itemType:                 item.type,
      accelBase:                item.type === 'acelerador' ? item.name : null,
      tags:                     item.tags || [],
      portionsAdultConsumed:    adult,
      portionsBabyConsumed:     baby,
      prepTime:                 item.type === 'acelerador' ? (item.prepTime || null) : null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl px-5 pt-4 pb-10 shadow-xl">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              {step === 'method'
                ? '¿Cómo lo vas a preparar?'
                : isFloating ? `¿Cómo preparas ${item.name}?` : item.name}
            </h2>
            <p className="text-sm text-gray-400 mt-0.5">{slotLabel} · {dayLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 'method' ? (
          <>
            <p className="text-xs text-gray-400 mb-3">
              Se añadirá a "Por preparar" en tu checklist de cocina.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {PREP_METHODS.map(m => (
                <button
                  key={m}
                  onClick={() => setPrepMethodText(m)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    prepMethodText === m
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'text-gray-600 border-gray-200 hover:border-gray-400'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
            <input
              value={prepMethodText}
              onChange={e => setPrepMethodText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleConfirmWithMethod()}
              placeholder={hasAiAccess ? 'Otro método (opcional — si lo dejas vacío, la IA lo infiere)' : 'Otro método (opcional)'}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
            />
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setStep('name')}
                className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
              >
                ← Atrás
              </button>
              <button
                onClick={handleConfirmWithMethod}
                disabled={inferring}
                className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-40"
              >
                {inferring ? 'Pensando…' : 'Añadir al slot'}
              </button>
            </div>
          </>
        ) : isFloating ? (
          <>
            {/* Name input */}
            <input
              autoFocus
              value={prepName}
              onChange={handleNameChange}
              onFocus={e => e.target.select()}
              onKeyDown={e => e.key === 'Enter' && handleNext()}
              placeholder="Ej: Boloñesa, revuelto, salteado…"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
            />

            {/* Extra ingredients */}
            {availableExtra.length > 0 && (
              <div className="mt-4">
                <p className="text-xs text-gray-400 mb-2">¿Usas más ingredientes de la nevera?</p>
                <div className="flex flex-wrap gap-2">
                  {availableExtra.map(i => (
                    <button
                      key={i.id}
                      onClick={() => toggleExtra(i.id)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                        extraIds.has(i.id)
                          ? 'bg-gray-800 text-white border-gray-800'
                          : 'text-gray-600 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {i.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ¿Se ha acabado alguno? — controla si se desactiva del todo en el inventario */}
            <div className="mt-4">
              <p className="text-xs text-gray-400 mb-2">¿Se ha acabado alguno? Si no marcas nada, siguen disponibles en la nevera.</p>
              <div className="flex flex-wrap gap-2">
                {depletableItems.map(i => (
                  <button
                    key={i.id}
                    onClick={() => toggleDepleted(i.id)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      depletedIds.has(i.id)
                        ? 'bg-rose-600 text-white border-rose-600'
                        : 'text-gray-500 border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {i.name}{depletedIds.has(i.id) ? ' · se acabó' : ''}
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-5">
              {hasAiAccess && onOpenAi && (
                <button
                  onClick={onOpenAi}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                  Ver opciones IA
                </button>
              )}
              <button
                onClick={handleNext}
                disabled={!prepName.trim()}
                className="flex-1 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors disabled:opacity-40"
              >
                {needsPrepStep ? 'Siguiente →' : 'Añadir al slot'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-center gap-10 py-5">
              <Counter icon={User} label="Adulto" value={adult} onChange={setAdult} />
              <Counter icon={Baby} label="Bebé"   value={baby}  onChange={setBaby}  />
            </div>
            <button
              onClick={handleConfirmPortions}
              className="w-full py-2.5 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
            >
              Añadir al slot
            </button>
          </>
        )}
      </div>
    </div>
  );
}
