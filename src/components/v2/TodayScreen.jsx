import { useState } from 'react';
import { Plus, AlertTriangle, MapPin, Clock, ChevronRight } from 'lucide-react';
import { useInventory } from '../../hooks/useInventory';
import { useDailyPlan } from '../../hooks/useDailyPlan';
import DayPlanSection from './DayPlanSection';
import WeeklyKpiStrip from './WeeklyKpiStrip';
import AddPrepModal from './AddPrepModal';
import FreshnessIndicator from './FreshnessIndicator';
import KpiInsights from './KpiInsights';
import FloatingResolverSheet from './FloatingResolverSheet';
import SnackSuggestionSheet from './SnackSuggestionSheet';
import CookingTimeSheet from './CookingTimeSheet';
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

export default function TodayScreen({ householdId, hasAiAccess }) {
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
    addSlotItem,
    removeSlotItem,
    updateSlotItemPortions,
    confirmSlot,
    clearSlot,
    offsetDateStr,
  } = useDailyPlan(householdId);

  const [showAddPrep, setShowAddPrep]       = useState(false);
  const [prepopulated, setPrepopulated]     = useState(null);
  const [resolvingItem, setResolvingItem]   = useState(null);
  const [showSnackSheet, setShowSnackSheet] = useState(false);
  const [showCookingTime, setShowCookingTime] = useState(false);

  const lowSnackItems = inventoryItems.filter(i => i.type === 'snack-batch' && (i.units ?? 0) <= 2);

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
    if (!slot?.items?.length || slot.confirmedAt) return;

    await confirmSlot(dateStr, slotId);

    // Decrement inventory for each item in the slot
    for (const item of slot.items) {
      if (!item.inventoryItemId) continue;
      if (item.itemType === 'snack-batch') {
        await consumeUnits(item.inventoryItemId, 1);
      } else if (item.itemType !== 'manual' && item.itemType !== 'flotante') {
        await consumePortions(
          item.inventoryItemId,
          item.portionsAdultConsumed || 0,
          item.portionsBabyConsumed || 0
        );
      }
    }
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
    setShowSnackSheet(false);
    setShowCookingTime(false);
    setShowAddPrep(true);
  }

  const alertsVisible = expiringItems.length > 0 || floatingItems.length > 0 || (hasAiAccess && lowSnackItems.length > 0);

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
        <KpiInsights kpis={weeklyKpis} />

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
                {hasAiAccess ? (
                  <button
                    onClick={() => setResolvingItem(item)}
                    className="text-xs text-rose-600 font-medium shrink-0 hover:underline"
                  >
                    ¿Qué hago?
                  </button>
                ) : (
                  <span className="text-xs text-rose-500 shrink-0">sin plan</span>
                )}
              </div>
            ))}
            {hasAiAccess && lowSnackItems.length > 0 && (
              <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <span className="text-lg shrink-0">🧁</span>
                <span className="flex-1 text-sm text-amber-800 font-medium">Snack casi agotado</span>
                <button
                  onClick={() => setShowSnackSheet(true)}
                  className="text-xs text-amber-700 font-medium shrink-0 hover:underline"
                >
                  Preparar snack
                </button>
              </div>
            )}
          </section>
        )}

        {/* F8 — Tengo tiempo para cocinar */}
        {hasAiAccess && (
          <button
            onClick={() => setShowCookingTime(true)}
            className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Clock className="w-4 h-4 text-brand-500 shrink-0" />
            <span className="flex-1 text-left font-medium">Tengo tiempo para cocinar</span>
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
          </button>
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
              weeklyKpis={weeklyKpis}
              hasAiAccess={hasAiAccess}
              defaultExpanded={defaultExpanded}
              onAddSlotItem={addSlotItem}
              onRemoveSlotItem={removeSlotItem}
              onConfirmSlot={handleConfirmSlot}
              onClearSlot={clearSlot}
              onUpdateSlotItemPortions={updateSlotItemPortions}
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
        onClose={() => { setShowAddPrep(false); setPrepopulated(null); }}
        onSave={addItem}
        initialData={prepopulated}
      />

      {resolvingItem && (
        <FloatingResolverSheet
          floatingItem={resolvingItem}
          inventoryItems={inventoryItems}
          weeklyKpis={weeklyKpis}
          onClose={() => setResolvingItem(null)}
          onSelect={handleSuggestionSelect}
        />
      )}

      {showSnackSheet && (
        <SnackSuggestionSheet
          snackItems={lowSnackItems}
          inventoryItems={inventoryItems}
          onClose={() => setShowSnackSheet(false)}
          onSelect={handleSuggestionSelect}
        />
      )}

      {showCookingTime && (
        <CookingTimeSheet
          inventoryItems={inventoryItems}
          weeklyKpis={weeklyKpis}
          onClose={() => setShowCookingTime(false)}
          onSelect={handleSuggestionSelect}
        />
      )}
    </div>
  );
}
