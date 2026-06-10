import { useState } from 'react';
import { Plus, AlertTriangle, MapPin } from 'lucide-react';
import { useInventory } from '../../hooks/useInventory';
import { useDailyPlan } from '../../hooks/useDailyPlan';
import DayPlanSection from './DayPlanSection';
import WeeklyKpiStrip from './WeeklyKpiStrip';
import AddPrepModal from './AddPrepModal';
import FreshnessIndicator from './FreshnessIndicator';
import { daysUntil } from '../../hooks/useInventory';
import LoadingSpinner from '../ui/LoadingSpinner';

const DAYS = [
  { offset: 0, label: 'Hoy',            defaultExpanded: true },
  { offset: 1, label: 'Mañana',         defaultExpanded: false },
  { offset: 2, label: 'Pasado mañana',  defaultExpanded: false },
];

const MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DAY_NAMES_FULL = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

function formatTodayHeader() {
  const d = new Date();
  return `${DAY_NAMES_FULL[d.getDay()]} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
}

export default function TodayScreen({ householdId }) {
  const {
    items: inventoryItems,
    expiringItems,
    floatingItems,
    loading: invLoading,
    addItem,
    consumePortions,
    consumeUnits,
  } = useInventory(householdId);

  const {
    getPlan,
    weeklyKpis,
    loading: planLoading,
    setSlot,
    confirmSlot,
    clearSlot,
    offsetDateStr,
  } = useDailyPlan(householdId);

  const [showAddPrep, setShowAddPrep] = useState(false);

  const loading = invLoading || planLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" label="Cargando..." />
      </div>
    );
  }

  const handleConfirmSlot = async (dateStr, slotId) => {
    const plan = getPlan(dateStr);
    const slot = plan?.slots?.[slotId];
    if (!slot || slot.confirmedAt) return;

    // Mark confirmed in plan
    await confirmSlot(dateStr, slotId);

    // Decrement inventory
    if (slot.inventoryItemId) {
      if (slot.itemType === 'snack-batch') {
        await consumeUnits(slot.inventoryItemId, 1);
      } else if (slot.itemType !== 'manual' && slot.itemType !== 'flotante') {
        await consumePortions(
          slot.inventoryItemId,
          slot.portionsAdultConsumed || 0,
          slot.portionsBabyConsumed || 0
        );
      }
    }
  };

  const alertsVisible = expiringItems.length > 0 || floatingItems.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <p className="text-xs text-gray-400 capitalize">{formatTodayHeader()}</p>
          <h1 className="text-lg font-bold text-gray-900">Hoy</h1>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-4 pb-24">
        {/* KPI strip */}
        <WeeklyKpiStrip kpis={weeklyKpis} />

        {/* Alerts */}
        {alertsVisible && (
          <section className="space-y-2">
            {expiringItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span className="flex-1 text-sm text-amber-800 font-medium truncate">{item.name}</span>
                <FreshnessIndicator expiresAt={item.expiresAt} daysUntil={daysUntil} />
              </div>
            ))}
            {floatingItems.map((item) => (
              <div key={item.id} className="flex items-center gap-3 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">
                <MapPin className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="flex-1 text-sm text-rose-800 font-medium truncate">{item.name}</span>
                <span className="text-xs text-rose-500">sin plan</span>
              </div>
            ))}
          </section>
        )}

        {/* Day planning sections */}
        {DAYS.map(({ offset, label, defaultExpanded }) => {
          const dateStr = offsetDateStr(offset);
          return (
            <DayPlanSection
              key={dateStr}
              date={dateStr}
              offsetLabel={label}
              plan={getPlan(dateStr)}
              inventoryItems={inventoryItems}
              defaultExpanded={defaultExpanded}
              onSetSlot={setSlot}
              onConfirmSlot={handleConfirmSlot}
              onClearSlot={clearSlot}
            />
          );
        })}
      </div>

      {/* FAB — nueva preparación */}
      <button
        onClick={() => setShowAddPrep(true)}
        className="fixed bottom-20 right-4 flex items-center gap-2 bg-brand-600 text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-lg hover:bg-brand-700 transition-colors z-20"
        style={{ bottom: 'calc(4rem + env(safe-area-inset-bottom) + 1rem)' }}
      >
        <Plus className="w-4 h-4" />
        Nueva preparación
      </button>

      <AddPrepModal
        isOpen={showAddPrep}
        onClose={() => setShowAddPrep(false)}
        onSave={addItem}
      />
    </div>
  );
}
