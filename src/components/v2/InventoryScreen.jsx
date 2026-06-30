import { useState } from 'react';
import { Plus, Package, UtensilsCrossed, Upload, Search, X } from 'lucide-react';
import { useInventory, addDays } from '../../hooks/useInventory';
import { useUsualMeals } from '../../hooks/useUsualMeals';
import { useDailyPlan, todayStr } from '../../hooks/useDailyPlan';
import { usePantry } from '../../hooks/usePantry';
import { usePrepQueue } from '../../hooks/usePrepQueue';
import InventoryItemCard from './InventoryItemCard';
import AddPrepModal from './AddPrepModal';
import FloatingResolverSheet from './FloatingResolverSheet';
import SlotAssignSheet from './SlotAssignSheet';
import EmlImportSheet from './EmlImportSheet';
import LoadingSpinner from '../ui/LoadingSpinner';

const SECTIONS = [
  { type: 'ya-preparado', label: 'Ya preparados' },
  { type: 'acelerador',   label: 'Aceleradores'  },
  { type: 'snack-batch',  label: 'Snacks'        },
  { type: 'flotante',     label: 'Ingredientes'  },
];

const TYPE_FILTERS = [
  { id: 'ya-preparado', label: 'Preparados' },
  { id: 'acelerador',   label: 'Aceleradores' },
  { id: 'snack-batch',  label: 'Snacks' },
  { id: 'flotante',     label: 'Ingredientes' },
];

const NUTRITION_FILTERS = [
  { id: 'protein', label: 'Proteína', test: t => t.some(x => ['iron','fish','oily_fish','legume','egg'].includes(x)) },
  { id: 'iron',    label: 'Hierro',   test: t => t.includes('iron') },
  { id: 'fish',    label: 'Pescado',  test: t => t.some(x => x === 'fish' || x === 'oily_fish') },
  { id: 'legume',  label: 'Legumbre', test: t => t.includes('legume') },
  { id: 'egg',     label: 'Huevo',    test: t => t.includes('egg') },
  { id: 'dairy',   label: 'Lácteo',   test: t => t.includes('dairy') },
  { id: 'fruit',   label: 'Fruta',    test: t => t.includes('fruit') },
  { id: 'veggie',  label: 'Verdura',  test: t => t.some(x => x.startsWith('veggie:')) },
  { id: 'cereal',  label: 'Cereal',   test: t => t.includes('cereal') },
];

function FilterChip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
        active
          ? 'bg-gray-900 text-white border-gray-900'
          : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
      }`}
    >
      {label}
    </button>
  );
}

export default function InventoryScreen({ householdId, hasAiAccess, pantryItems = [] }) {
  const { items, loading, addItem, updateItem, deleteItem } = useInventory(householdId);
  const { usualMeals, addUsualMeal } = useUsualMeals(householdId);
  const { todayPlan, addSlotItem } = useDailyPlan(householdId);
  const { addItem: addToPantry } = usePantry(householdId);
  const { addToPrepQueue } = usePrepQueue(householdId);

  const [showAdd, setShowAdd]             = useState(false);
  const [showImport, setShowImport]       = useState(false);
  const [editingItem, setEditingItem]     = useState(null);
  const [resolvingItem, setResolvingItem] = useState(null);
  const [prepopulated, setPrepopulated]   = useState(null);
  const [assigningItem, setAssigningItem] = useState(null);
  const [search, setSearch]               = useState('');
  const [activeTypes, setActiveTypes]     = useState(new Set());
  const [activeNutr, setActiveNutr]       = useState(new Set());
  const [hideFruit, setHideFruit]         = useState(true);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" label="Cargando inventario…" />
      </div>
    );
  }

  // ── handlers ──────────────────────────────────────────────────────────────

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar esta preparación?')) return;
    await deleteItem(id);
  };

  const handleEditSave = async (data) => {
    const now = new Date().toISOString();
    const expiresAt = data.shelfLifeDays ? addDays(now, data.shelfLifeDays) : null;
    await updateItem(editingItem.id, { ...data, expiresAt });
    setEditingItem(null);
  };

  function handleSuggestionSelect(proposal) {
    setPrepopulated({
      name:          proposal.name,
      type:          proposal.prepType === 'justo-antes' ? 'acelerador' : proposal.prepType,
      portionsAdult: proposal.adultPortions ?? 2,
      portionsBaby:  proposal.babyPortions  ?? 1,
      units:         proposal.unitsGenerated ?? 6,
      tags:          proposal.tags ?? [],
    });
    setResolvingItem(null);
    setShowAdd(true);
  }

  async function handleSchedulePrep(proposal) {
    await addToPrepQueue({
      label:         proposal.name,
      prepType:      proposal.prepType,
      prepTime:      proposal.prepTime ?? null,
      adultPortions: proposal.adultPortions ?? null,
      babyPortions:  proposal.babyPortions  ?? null,
      tags:          proposal.tags ?? [],
      ingredients:   proposal.ingredients ?? [],
    });
    setResolvingItem(null);
  }

  async function handleAssignToToday(slotId, entry) {
    await addSlotItem(todayStr(), slotId, entry);
  }

  async function handleImport(itemsToAdd) {
    await Promise.all(itemsToAdd.map(item => addItem(item)));
  }

  async function handleMoveToPantry(item) {
    await addToPantry(item.name);
    await deleteItem(item.id);
  }

  function toggleType(id) {
    setActiveTypes(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleNutr(id) {
    setActiveNutr(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function clearFilters() {
    setSearch('');
    setActiveTypes(new Set());
    setActiveNutr(new Set());
    setHideFruit(true);
  }

  // ── filtering ─────────────────────────────────────────────────────────────

  const query = search.trim().toLowerCase();

  function filterItems(list) {
    const hasTypeFilters = activeTypes.size > 0;
    const hasNutrFilters = activeNutr.size > 0;
    const hasAnyFilters = hasTypeFilters || hasNutrFilters;

    return list.filter(item => {
      if (query && !item.name.toLowerCase().includes(query)) return false;
      if (hideFruit && (item.tags || []).includes('fruit')) return false;
      if (!hasAnyFilters) return true;

      if (hasTypeFilters && activeTypes.has(item.type)) return true;

      if (hasNutrFilters) {
        const tags = item.tags || [];
        const matchesNutr = [...activeNutr].some(id => {
          const def = NUTRITION_FILTERS.find(f => f.id === id);
          return def?.test(tags);
        });
        if (matchesNutr) return true;
      }

      return false;
    });
  }

  const hasActiveFilters = activeTypes.size > 0 || activeNutr.size > 0 || !!query || !hideFruit;

  const PROTEIN_TAGS = ['iron', 'fish', 'oily_fish', 'legume', 'egg'];
  function flotanteOrder(item) {
    const tags = item.tags || [];
    if (tags.some(t => PROTEIN_TAGS.includes(t))) return 0;
    if (tags.some(t => t.startsWith('veggie:')))   return 1;
    return 2;
  }

  const hasResults = SECTIONS.some(({ type }) =>
    filterItems(items.filter(i => i.type === type)).length > 0
  );

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Sticky header ── */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        {/* Title + actions */}
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-brand-600" />
            <h1 className="text-lg font-bold text-gray-900">Inventario</h1>
          </div>
          <div className="flex items-center gap-2">
            {hasAiAccess && (
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-1.5 border border-gray-200 text-gray-700 text-sm font-medium px-3 min-h-[44px] rounded-xl hover:bg-gray-50 transition-colors"
                title="Importar pedido online"
              >
                <Upload className="w-4 h-4" />
                <span className="hidden sm:inline">Importar</span>
              </button>
            )}
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 bg-brand-600 text-white text-sm font-medium px-3 min-h-[44px] rounded-xl hover:bg-brand-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Nueva preparación
            </button>
          </div>
        </div>

        {/* Search + filters — only when inventory has items */}
        {items.length > 0 && (
          <div className="max-w-4xl mx-auto px-4 pb-3 space-y-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar en el inventario…"
                className="w-full pl-9 pr-8 py-2 text-sm bg-gray-100 rounded-xl border-none focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Filter chips — horizontally scrollable */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden">
              {/* Type filters */}
              {TYPE_FILTERS.map(f => (
                <FilterChip
                  key={f.id}
                  label={f.label}
                  active={activeTypes.has(f.id)}
                  onClick={() => toggleType(f.id)}
                />
              ))}

              {/* Divider */}
              <div className="w-px h-4 bg-gray-200 shrink-0 mx-0.5" />

              {/* Nutritional filters */}
              {NUTRITION_FILTERS.map(f => (
                <FilterChip
                  key={f.id}
                  label={f.label}
                  active={activeNutr.has(f.id)}
                  onClick={() => toggleNutr(f.id)}
                />
              ))}

              {/* Fruit visibility toggle */}
              <div className="w-px h-4 bg-gray-200 shrink-0 mx-0.5" />
              <button
                onClick={() => setHideFruit(h => !h)}
                className={`shrink-0 text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                  hideFruit
                    ? 'bg-white text-gray-400 border-gray-200 hover:border-gray-400 hover:text-gray-600'
                    : 'bg-gray-900 text-white border-gray-900'
                }`}
              >
                {hideFruit ? '🍎 Mostrar fruta' : '🍎 Ocultar fruta'}
              </button>

              {/* Clear all */}
              {hasActiveFilters && (
                <>
                  <div className="w-px h-4 bg-gray-200 shrink-0 mx-0.5" />
                  <button
                    onClick={clearFilters}
                    className="shrink-0 text-xs px-2.5 py-1 rounded-full text-brand-600 font-medium hover:bg-brand-50 transition-colors flex items-center gap-1"
                  >
                    <X className="w-3 h-3" />
                    Limpiar
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ── Content ── */}
      <div className="max-w-4xl mx-auto px-4 py-4 space-y-5">
        {SECTIONS.map(({ type, label }) => {
          const filtered = filterItems(items.filter(i => i.type === type));
          const sectionItems = type === 'flotante'
            ? [...filtered].sort((a, b) => flotanteOrder(a) - flotanteOrder(b))
            : filtered;
          if (sectionItems.length === 0) return null;
          return (
            <section key={type}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {label}
                <span className="ml-1.5 text-xs font-normal normal-case text-gray-400">
                  {sectionItems.length}
                </span>
              </h2>
              <div className="space-y-2">
                {sectionItems.map((item) => (
                  <div key={item.id} className="space-y-1">
                    <InventoryItemCard
                      item={item}
                      onDelete={handleDelete}
                      onEdit={setEditingItem}
                      onAddToToday={setAssigningItem}
                      onMoveToPantry={handleMoveToPantry}
                    />
                    {type === 'flotante' && hasAiAccess && (
                      <button
                        onClick={() => setResolvingItem(item)}
                        className="w-full text-xs text-rose-600 font-medium py-2 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 transition-colors"
                      >
                        ¿Qué hago con esto?
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          );
        })}

        {/* No results */}
        {hasActiveFilters && !hasResults && (
          <div className="text-center py-12 space-y-2">
            <p className="text-sm text-gray-500">Ningún item coincide con los filtros activos</p>
            <button onClick={clearFilters} className="text-sm text-brand-600 font-medium">
              Limpiar filtros
            </button>
          </div>
        )}

        {/* Empty inventory */}
        {items.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <UtensilsCrossed className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="font-semibold text-gray-700">El inventario está vacío</p>
            <p className="text-sm text-gray-400 leading-relaxed max-w-xs mx-auto">
              Registra lo que tienes cocinado o disponible para que la app pueda ayudarte a planificar.
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="mt-2 bg-brand-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-brand-700 transition-colors"
            >
              + Añadir primera preparación
            </button>
          </div>
        )}
      </div>

      {/* ── Modales y sheets ── */}
      {showImport && (
        <EmlImportSheet
          onClose={() => setShowImport(false)}
          onImport={handleImport}
        />
      )}

      <AddPrepModal
        isOpen={showAdd}
        onClose={() => { setShowAdd(false); setPrepopulated(null); }}
        onSave={addItem}
        onAddUsualMeal={addUsualMeal}
        initialData={prepopulated}
      />

      <AddPrepModal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        onSave={handleEditSave}
        initialData={editingItem}
      />

      {resolvingItem && (
        <FloatingResolverSheet
          floatingItem={resolvingItem}
          inventoryItems={items}
          weeklyKpis={null}
          pantryItems={pantryItems}
          onClose={() => setResolvingItem(null)}
          onSelect={handleSuggestionSelect}
          onSchedule={handleSchedulePrep}
        />
      )}

      {assigningItem && (
        <SlotAssignSheet
          item={assigningItem}
          todaySlots={todayPlan?.slots}
          onAssign={handleAssignToToday}
          onClose={() => setAssigningItem(null)}
        />
      )}
    </div>
  );
}
