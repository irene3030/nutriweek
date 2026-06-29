import { useState } from 'react';
import { Plus, Package, UtensilsCrossed, Upload } from 'lucide-react';
import { useInventory, addDays } from '../../hooks/useInventory';
import { useUsualMeals } from '../../hooks/useUsualMeals';
import { useDailyPlan, todayStr } from '../../hooks/useDailyPlan';
import InventoryItemCard from './InventoryItemCard';
import AddPrepModal from './AddPrepModal';
import FloatingResolverSheet from './FloatingResolverSheet';
import SlotAssignSheet from './SlotAssignSheet';
import EmlImportSheet from './EmlImportSheet';
import LoadingSpinner from '../ui/LoadingSpinner';

const SECTIONS = [
  { type: 'ya-preparado', label: 'Ya preparados', empty: 'Nada preparado todavía' },
  { type: 'acelerador',   label: 'Aceleradores',  empty: 'Sin aceleradores' },
  { type: 'snack-batch',  label: 'Snacks',        empty: 'Sin snacks en stock' },
  { type: 'flotante',     label: 'Ingredientes',  empty: 'Sin ingredientes' },
];

export default function InventoryScreen({ householdId, hasAiAccess, pantryItems = [] }) {
  const { items, loading, addItem, updateItem, deleteItem } = useInventory(householdId);
  const { usualMeals, addUsualMeal } = useUsualMeals(householdId);
  const { todayPlan, addSlotItem } = useDailyPlan(householdId);
  const [showAdd, setShowAdd]             = useState(false);
  const [showImport, setShowImport]       = useState(false);
  const [editingItem, setEditingItem]     = useState(null);
  const [resolvingItem, setResolvingItem] = useState(null);
  const [prepopulated, setPrepopulated]   = useState(null);
  const [assigningItem, setAssigningItem] = useState(null);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" label="Cargando inventario…" />
      </div>
    );
  }

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

  async function handleAssignToToday(slotId, entry) {
    await addSlotItem(todayStr(), slotId, entry);
  }

  async function handleImport(itemsToAdd) {
    await Promise.all(itemsToAdd.map(item => addItem(item)));
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
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
                title="Importar pedido online (.eml)"
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
      </header>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-5">
        {/* By type sections */}
        {SECTIONS.map(({ type, label, empty }) => {
          const sectionItems = items.filter((i) => i.type === type);
          if (sectionItems.length === 0) return null;
          return (
            <section key={type}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</h2>
              <div className="space-y-2">
                {sectionItems.map((item) => (
                  <div key={item.id} className="space-y-1">
                    <InventoryItemCard item={item} onDelete={handleDelete} onEdit={setEditingItem} onAddToToday={setAssigningItem} />
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

        {/* Truly empty state */}
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
