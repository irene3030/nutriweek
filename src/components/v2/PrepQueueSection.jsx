import { useState } from 'react';
import { Plus, CheckCircle2, X, ChefHat, ChevronDown, ChevronUp, Zap, ShoppingCart, Home, Check } from 'lucide-react';

const SLOT_LABELS = {
  desayuno: 'desayuno', snack: 'snack', comida: 'comida', merienda: 'merienda', cena: 'cena',
};

function formatSlotTarget(targetDate, targetSlot) {
  if (!targetDate || !targetSlot) return null;
  const todayStr = new Date().toISOString().slice(0, 10);
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  let day;
  if (targetDate === todayStr) day = 'Hoy';
  else if (targetDate === tomorrowStr) day = 'Mañana';
  else {
    const d = new Date(targetDate + 'T12:00:00');
    const DAYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    day = `${DAYS[d.getDay()]} ${d.getDate()}`;
  }
  return `${day} ${SLOT_LABELS[targetSlot] ?? targetSlot}`;
}

const PREP_TYPE_BADGES = {
  'ya-preparado': { label: 'Listo',       color: 'bg-brand-100 text-brand-700' },
  acelerador:     { label: 'Base',        color: 'bg-violet-100 text-violet-700' },
  'justo-antes':  { label: 'Justo-antes', color: 'bg-purple-100 text-purple-700' },
  'snack-batch':  { label: 'Snack',       color: 'bg-amber-100 text-amber-700' },
};

function IngredientIcon({ source }) {
  if (source === 'stock')    return <Check        className="w-3 h-3 text-green-500 shrink-0" />;
  if (source === 'despensa') return <Home         className="w-3 h-3 text-gray-400 shrink-0" />;
  return                            <ShoppingCart className="w-3 h-3 text-amber-500 shrink-0" />;
}

export default function PrepQueueSection({ items, onDone, onRemove, onAdd }) {
  const [input, setInput]       = useState('');
  const [expandedId, setExpandedId] = useState(null);

  function handleAdd(e) {
    e.preventDefault();
    const label = input.trim();
    if (!label) return;
    onAdd({ label });
    setInput('');
  }

  function toggleExpand(id) {
    setExpandedId(prev => (prev === id ? null : id));
  }

  const hasDetail = (item) =>
    item.description || item.ingredients?.length > 0 || item.quickDishes?.length > 0;

  return (
    <section className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-50">
        <ChefHat className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-sm font-semibold text-gray-700">Por preparar</span>
        {items.length > 0 && (
          <span className="ml-auto text-xs text-gray-400">{items.length}</span>
        )}
      </div>

      {items.length > 0 && (
        <ul className="divide-y divide-gray-50">
          {items.map((item) => {
            const badge    = PREP_TYPE_BADGES[item.prepType];
            const expanded = expandedId === item.id;
            const canExpand = hasDetail(item);

            return (
              <li key={item.id}>
                {/* Main row */}
                <div className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-gray-800 font-medium truncate">{item.label}</span>
                      {badge && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${badge.color}`}>
                          {badge.label}
                        </span>
                      )}
                      {formatSlotTarget(item.targetDate, item.targetSlot) && (
                        <span className="text-xs text-gray-400 shrink-0">
                          {formatSlotTarget(item.targetDate, item.targetSlot)}
                        </span>
                      )}
                    </div>
                    {item.prepTime && (
                      <p className="text-xs text-gray-400 mt-0.5">{item.prepTime}</p>
                    )}
                  </div>
                  {canExpand && (
                    <button
                      onClick={() => toggleExpand(item.id)}
                      className="flex items-center justify-center w-6 h-6 rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors shrink-0"
                      aria-label={expanded ? 'Colapsar' : 'Ver detalles'}
                    >
                      {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  <button
                    onClick={() => onDone(item)}
                    className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700 shrink-0 transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Lo hice
                  </button>
                  <button
                    onClick={() => onRemove(item.id)}
                    className="flex items-center justify-center w-6 h-6 rounded-full text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors shrink-0"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                {/* Expanded detail */}
                {expanded && (
                  <div className="px-4 pb-3 space-y-2.5 border-t border-gray-50 pt-2.5">
                    {item.description && (
                      <p className="text-xs text-gray-600 leading-snug">{item.description}</p>
                    )}

                    {item.quickDishes?.length > 0 && (
                      <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 space-y-1">
                        <p className="text-xs font-medium text-violet-700 flex items-center gap-1">
                          <Zap className="w-3 h-3" /> Con esta base puedes hacer:
                        </p>
                        <ul className="space-y-0.5">
                          {item.quickDishes.map((dish, i) => (
                            <li key={i} className="text-xs text-violet-600 flex items-center gap-1.5">
                              <span className="text-violet-400">→</span> {dish}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {item.ingredients?.length > 0 && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {item.ingredients.map((ing, i) => (
                          <span key={i} className="flex items-center gap-1 text-xs text-gray-500">
                            <IngredientIcon source={ing.source} />
                            {ing.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleAdd} className="flex items-center gap-2 px-4 py-3 border-t border-gray-50">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Añadir tarea de cocina…"
          className="flex-1 text-sm text-gray-700 placeholder-gray-400 bg-transparent focus:outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="flex items-center justify-center w-7 h-7 rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-30"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </form>
    </section>
  );
}
