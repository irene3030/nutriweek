import { useState } from 'react';
import { Plus, X, Droplets, Flower2, Wheat, Egg, Archive, Sparkles, Snowflake, ShoppingCart } from 'lucide-react';

const CATEGORY_ICONS = { Droplets, Flower2, Wheat, Egg, Archive, Sparkles, Snowflake };
import { usePantry } from '../../hooks/usePantry';
import { PANTRY_CATEGORIES, DEFAULT_PANTRY_ITEMS } from '../../lib/pantryData';
import LoadingSpinner from '../ui/LoadingSpinner';

function ItemChip({ name, active, onToggle, onRemove, isCustom, outOfStock, onToggleOutOfStock }) {
  return (
    <div className="flex items-center gap-0.5">
      <button
        onClick={onToggle}
        className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${
          active
            ? 'bg-brand-600 text-white border-brand-600'
            : 'bg-white text-gray-500 border-gray-200 hover:border-brand-300 hover:text-brand-600'
        }`}
      >
        {name}
      </button>
      {active && (
        <button
          onClick={onToggleOutOfStock}
          title={outOfStock ? 'Quitar de agotados' : 'Marcar como agotado'}
          className={`flex items-center justify-center w-5 h-5 rounded-full transition-colors ${
            outOfStock ? 'text-amber-600 bg-amber-50' : 'text-gray-300 hover:text-amber-500 hover:bg-amber-50'
          }`}
        >
          <ShoppingCart className="w-3 h-3" />
        </button>
      )}
      {isCustom && active && (
        <button
          onClick={onRemove}
          className="flex items-center justify-center w-5 h-5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function AddItemInput({ onAdd }) {
  const [value, setValue] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!value.trim()) return;
    await onAdd(value.trim());
    setValue('');
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 mt-3">
      <input
        type="text"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Añadir item..."
        className="flex-1 text-xs border border-dashed border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-300 focus:border-brand-300 bg-gray-50"
      />
      <button
        type="submit"
        disabled={!value.trim()}
        className="flex items-center justify-center w-8 h-8 rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-40"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </form>
  );
}

export default function DespensaScreen({ householdId }) {
  const {
    pantryItems, loading, toggleItem, addItem, removeItem,
    toggleOutOfStock, isOutOfStock, categoryIdFor,
  } = usePantry(householdId);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" label="Cargando despensa…" />
      </div>
    );
  }

  // Items que están en pantryItems pero no son parte de ningún catálogo por defecto
  const defaultAll = DEFAULT_PANTRY_ITEMS.map(i => i.toLowerCase());
  const customItems = pantryItems.filter(
    i => !defaultAll.includes(i.toLowerCase())
  );
  const knownCategoryIds = new Set(PANTRY_CATEGORIES.map(c => c.id));
  const uncategorizedItems = customItems.filter(i => !knownCategoryIds.has(categoryIdFor(i)));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <h1 className="text-lg font-bold text-gray-900">Despensa</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Lo que siempre tienes. La app lo usa para sugerencias sin pedirte que lo compres.
          </p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-3 pb-24">
        {PANTRY_CATEGORIES.map(cat => {
          const Icon = CATEGORY_ICONS[cat.icon];
          const customInCategory = customItems.filter(i => categoryIdFor(i) === cat.id);
          return (
          <div key={cat.id} className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              {Icon && <Icon className="w-3.5 h-3.5 text-gray-400" />}
              {cat.label}
            </h2>
            <div className="flex flex-wrap gap-2">
              {cat.defaults.map(item => (
                <ItemChip
                  key={item}
                  name={item}
                  active={pantryItems.includes(item)}
                  onToggle={() => toggleItem(item)}
                  isCustom={false}
                  outOfStock={isOutOfStock(item)}
                  onToggleOutOfStock={() => toggleOutOfStock(item)}
                />
              ))}
              {customInCategory.map(item => (
                <ItemChip
                  key={item}
                  name={item}
                  active
                  onToggle={() => toggleItem(item)}
                  onRemove={() => removeItem(item)}
                  isCustom
                  outOfStock={isOutOfStock(item)}
                  onToggleOutOfStock={() => toggleOutOfStock(item)}
                />
              ))}
            </div>
            <AddItemInput onAdd={(name) => addItem(name, cat.id)} />
          </div>
        )})}

        {uncategorizedItems.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-gray-400" />
              Otros
            </h2>
            <div className="flex flex-wrap gap-2">
              {uncategorizedItems.map(item => (
                <ItemChip
                  key={item}
                  name={item}
                  active
                  onToggle={() => toggleItem(item)}
                  onRemove={() => removeItem(item)}
                  isCustom
                  outOfStock={isOutOfStock(item)}
                  onToggleOutOfStock={() => toggleOutOfStock(item)}
                />
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-center text-gray-400 px-4">
          Toca un item para activarlo o desactivarlo.{' '}
          {pantryItems.length} items en despensa.
        </p>
      </div>
    </div>
  );
}
