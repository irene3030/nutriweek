import { useState } from 'react';
import { Fish, Leaf, Egg, Bean, Apple, Milk, Utensils, Zap, Package, Droplets, Refrigerator, Search } from 'lucide-react';

// ── Icon / color mapping ───────────────────────────────────────────────────────

function getIconAndColor(item) {
  const tags = item.tags || [];
  if (tags.includes('oily_fish') || tags.includes('fish'))
    return { Icon: Fish,     bg: 'bg-sky-50',     border: 'border-sky-200',     icon: 'text-sky-500'     };
  if (tags.includes('egg'))
    return { Icon: Egg,      bg: 'bg-amber-50',   border: 'border-amber-200',   icon: 'text-amber-500'   };
  if (tags.includes('legume'))
    return { Icon: Bean,     bg: 'bg-violet-50',  border: 'border-violet-200',  icon: 'text-violet-500'  };
  if (tags.includes('fruit'))
    return { Icon: Apple,    bg: 'bg-rose-50',    border: 'border-rose-200',    icon: 'text-rose-500'    };
  if (tags.includes('dairy'))
    return { Icon: Milk,     bg: 'bg-blue-50',    border: 'border-blue-200',    icon: 'text-blue-500'    };
  if (tags.some(t => t.startsWith('veggie:')))
    return { Icon: Leaf,     bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-500' };
  if (tags.includes('iron'))
    return { Icon: Droplets, bg: 'bg-red-50',     border: 'border-red-200',     icon: 'text-red-500'     };
  if (item.type === 'ya-preparado')
    return { Icon: Utensils, bg: 'bg-teal-50',    border: 'border-teal-200',    icon: 'text-teal-600'    };
  if (item.type === 'acelerador')
    return { Icon: Zap,      bg: 'bg-violet-50',  border: 'border-violet-200',  icon: 'text-violet-500'  };
  return   { Icon: Package,  bg: 'bg-gray-50',    border: 'border-gray-200',    icon: 'text-gray-500'    };
}

function getSubtitle(item) {
  if (item.type === 'flotante') return 'Ingrediente';
  if (item.type === 'acelerador') return 'Base';
  if (item.type === 'snack' || item.type === 'snack-batch') {
    return item.units != null ? `${item.units} uds.` : 'Snack';
  }
  const total = (item.portionsAdult ?? 0) + (item.portionsBaby ?? 0);
  return total > 0 ? `${total} rac.` : 'Listo';
}

// ── Filters ────────────────────────────────────────────────────────────────────

const PROTEIN_TAGS = ['iron', 'fish', 'oily_fish', 'egg', 'legume'];

const FILTERS = [
  { id: 'proteina',   label: 'Proteína',   match: (i) => (i.tags || []).some(t => PROTEIN_TAGS.includes(t)) },
  { id: 'fruta',      label: 'Fruta',      match: (i) => (i.tags || []).includes('fruit') },
  { id: 'verdura',    label: 'Verdura',    match: (i) => (i.tags || []).some(t => t.startsWith('veggie:')) },
  { id: 'preparado',  label: 'Preparado',  match: (i) => i.type === 'ya-preparado' },
  { id: 'snack',      label: 'Snack',      match: (i) => i.type === 'snack' || i.type === 'snack-batch' },
  { id: 'acelerador', label: 'Acelerador', match: (i) => i.type === 'acelerador' },
];

const DEFAULT_FILTERS = new Set(['proteina', 'verdura', 'preparado', 'snack', 'acelerador']);

const SHELF_TYPES = new Set(['flotante', 'ya-preparado', 'acelerador', 'snack', 'snack-batch']);

// ── Chip ───────────────────────────────────────────────────────────────────────

function InventoryChip({ item, onDragStart }) {
  const { Icon, bg, border, icon } = getIconAndColor(item);
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'copy';
        onDragStart(item);
      }}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-grab select-none shrink-0
        ${bg} ${border} hover:shadow-sm transition-all active:cursor-grabbing active:opacity-60`}
    >
      <Icon className={`w-4 h-4 shrink-0 ${icon}`} />
      <div className="leading-tight">
        <p className="text-xs font-semibold text-gray-700 whitespace-nowrap">{item.name}</p>
        <p className="text-[10px] text-gray-400">{getSubtitle(item)}</p>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

export default function IngredientShelf({ inventoryItems, onDragStart }) {
  const [search,        setSearch]        = useState('');
  const [activeFilters, setActiveFilters] = useState(() => new Set(DEFAULT_FILTERS));

  const allItems = inventoryItems.filter(i => i.isActive !== false && SHELF_TYPES.has(i.type));

  if (allItems.length === 0) return null;

  const noFilters = activeFilters.size === 0;

  const visibleItems = allItems.filter(item => {
    const matchesFilter = noFilters || FILTERS.some(f => activeFilters.has(f.id) && f.match(item));
    if (!matchesFilter) return false;
    if (search.trim()) return item.name.toLowerCase().includes(search.trim().toLowerCase());
    return true;
  });

  const flotantes = visibleItems.filter(i => i.type === 'flotante');
  const preps     = visibleItems.filter(i => i.type !== 'flotante');

  function toggleFilter(id) {
    setActiveFilters(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Row 1: icon + label */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-gray-50">
        <Refrigerator className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-sm font-semibold text-gray-700">Nevera</span>
      </div>

      {/* Row 2: search + filters */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-50 flex-wrap">
        <div className="flex items-center gap-1 text-gray-400 shrink-0">
          <Search className="w-3 h-3" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar…"
            className="text-[11px] font-medium bg-transparent border-0 outline-none w-20 placeholder-gray-300 text-gray-600"
          />
        </div>
        <div className="w-px h-3.5 bg-gray-200 shrink-0" />
        <div className="flex items-center gap-1 flex-wrap">
          <button
            onClick={() => setActiveFilters(new Set())}
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors ${
              noFilters
                ? 'bg-gray-800 text-white'
                : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            Todo
          </button>
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => toggleFilter(f.id)}
              className={`text-[11px] font-medium px-2 py-0.5 rounded-full transition-colors ${
                activeFilters.has(f.id)
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chips row */}
      {visibleItems.length > 0 ? (
        <div className="flex items-center gap-2 px-4 py-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {flotantes.map(item => (
            <InventoryChip key={item.id} item={item} onDragStart={onDragStart} />
          ))}
          {flotantes.length > 0 && preps.length > 0 && (
            <div className="w-px h-6 bg-gray-200 shrink-0 mx-1" />
          )}
          {preps.map(item => (
            <InventoryChip key={item.id} item={item} onDragStart={onDragStart} />
          ))}
        </div>
      ) : (
        <p className="px-4 py-3 text-xs text-gray-400">Sin resultados</p>
      )}
    </div>
  );
}
