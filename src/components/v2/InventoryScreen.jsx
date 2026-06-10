import { useState } from 'react';
import { Plus, Package, AlertTriangle, MapPin } from 'lucide-react';
import { useInventory } from '../../hooks/useInventory';
import InventoryItemCard from './InventoryItemCard';
import AddPrepModal from './AddPrepModal';
import LoadingSpinner from '../ui/LoadingSpinner';

const SECTIONS = [
  { type: 'ya-preparado', label: 'Ya preparados', empty: 'Nada preparado todavía' },
  { type: 'acelerador',   label: 'Aceleradores',  empty: 'Sin aceleradores' },
  { type: 'snack-batch',  label: 'Snacks',        empty: 'Sin snacks en stock' },
];

export default function InventoryScreen({ householdId }) {
  const { items, expiringItems, floatingItems, loading, addItem, deleteItem } = useInventory(householdId);
  const [showAdd, setShowAdd] = useState(false);

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

  const nonFloatingItems = items.filter((i) => i.type !== 'flotante');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-brand-600" />
            <h1 className="text-lg font-bold text-gray-900">Inventario</h1>
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 bg-brand-600 text-white text-sm font-medium px-3 min-h-[44px] rounded-xl hover:bg-brand-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nueva preparación
          </button>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-5">
        {/* Expiring alert */}
        {expiringItems.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-semibold text-amber-700">Próximos a caducar</h2>
            </div>
            <div className="space-y-2">
              {expiringItems.map((item) => (
                <InventoryItemCard key={item.id} item={item} onDelete={handleDelete} />
              ))}
            </div>
          </section>
        )}

        {/* Floating ingredients */}
        {floatingItems.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="w-4 h-4 text-rose-500" />
              <h2 className="text-sm font-semibold text-rose-700">Sin plan asignado</h2>
            </div>
            <div className="space-y-2">
              {floatingItems.map((item) => (
                <InventoryItemCard key={item.id} item={item} onDelete={handleDelete} />
              ))}
            </div>
          </section>
        )}

        {/* By type sections */}
        {SECTIONS.map(({ type, label, empty }) => {
          const sectionItems = nonFloatingItems.filter((i) => i.type === type);
          return (
            <section key={type}>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</h2>
              {sectionItems.length === 0 ? (
                <p className="text-sm text-gray-400 py-3 text-center">{empty}</p>
              ) : (
                <div className="space-y-2">
                  {sectionItems.map((item) => (
                    <InventoryItemCard key={item.id} item={item} onDelete={handleDelete} />
                  ))}
                </div>
              )}
            </section>
          );
        })}

        {/* Truly empty state */}
        {items.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <div className="text-5xl">🍳</div>
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

      <AddPrepModal
        isOpen={showAdd}
        onClose={() => setShowAdd(false)}
        onSave={addItem}
      />
    </div>
  );
}
