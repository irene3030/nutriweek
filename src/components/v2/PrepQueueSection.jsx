import { useState } from 'react';
import { Plus, CheckCircle2, X, ChefHat } from 'lucide-react';

const PREP_TYPE_BADGES = {
  'ya-preparado': { label: 'Listo',       color: 'bg-brand-100 text-brand-700' },
  acelerador:     { label: 'Base',        color: 'bg-violet-100 text-violet-700' },
  'justo-antes':  { label: 'Justo-antes', color: 'bg-purple-100 text-purple-700' },
  'snack-batch':  { label: 'Snack',       color: 'bg-amber-100 text-amber-700' },
};

export default function PrepQueueSection({ items, onDone, onRemove, onAdd }) {
  const [input, setInput] = useState('');

  function handleAdd(e) {
    e.preventDefault();
    const label = input.trim();
    if (!label) return;
    onAdd({ label });
    setInput('');
  }

  return (
    <section className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3">
        <ChefHat className="w-4 h-4 text-gray-400" />
        <h2 className="text-sm font-semibold text-gray-700">Por preparar</h2>
        {items.length > 0 && (
          <span className="ml-auto text-xs text-gray-400">{items.length}</span>
        )}
      </div>

      {items.length > 0 && (
        <ul className="divide-y divide-gray-50">
          {items.map((item) => {
            const badge = PREP_TYPE_BADGES[item.prepType];
            return (
              <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-800 font-medium truncate">{item.label}</span>
                    {badge && (
                      <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${badge.color}`}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                  {item.prepTime && (
                    <p className="text-xs text-gray-400 mt-0.5">{item.prepTime}</p>
                  )}
                </div>
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
