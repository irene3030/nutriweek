import { useState, useEffect, useRef } from 'react';
import { Plus, AlertTriangle, MapPin, ShoppingCart, Clock, ChevronRight, ChevronLeft, Cookie } from 'lucide-react';
import { useInventory } from '../../hooks/useInventory';
import { useDailyPlan, todayStr } from '../../hooks/useDailyPlan';
import { useUsualMeals } from '../../hooks/useUsualMeals';
import { usePrepQueue } from '../../hooks/usePrepQueue';
import DayPlanSection from './DayPlanSection';
import WeeklyKpiStrip from './WeeklyKpiStrip';
import AddPrepModal from './AddPrepModal';
import FreshnessIndicator from './FreshnessIndicator';
import ShoppingSuggestionSheet from './ShoppingSuggestionSheet';
import FloatingResolverSheet from './FloatingResolverSheet';
import SnackSuggestionSheet from './SnackSuggestionSheet';
import CookingTimeSheet from './CookingTimeSheet';
import MealProposalSheet from './MealProposalSheet';
import WeeklyBriefing from './WeeklyBriefing';
import WeekHistoryStrip from './WeekHistoryStrip';
import PrepQueueSection from './PrepQueueSection';
import { daysUntil } from '../../hooks/useInventory';
import LoadingSpinner from '../ui/LoadingSpinner';

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'mañana';
  if (h < 17) return 'tarde';
  return 'noche';
}

function getMondayStr() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

const LAST_WEEK_KPIS_KEY = 'mealops_lastWeekKpis';
const BRIEFING_DISMISSED_KEY = 'mealops_briefingDismissed';

function getDays(base) {
  const labels = {
    [-2]: 'Anteayer', [-1]: 'Ayer', [0]: 'Hoy', [1]: 'Mañana', [2]: 'Pasado mañana',
  };
  return [base, base + 1, base + 2].map((offset) => ({
    offset,
    label: labels[offset] ?? (offset < 0 ? `Hace ${-offset} días` : `En ${offset} días`),
    defaultExpanded: true,
  }));
}

const MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DAY_NAMES_FULL = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];

function formatTodayHeader() {
  const d = new Date();
  return `${DAY_NAMES_FULL[d.getDay()]} ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
}

export default function TodayScreen({ householdId, hasAiAccess, pantryItems = [] }) {
  const {
    items: inventoryItems,
    expiringItems,
    floatingItems,
    loading: invLoading,
    addItem,
    consumePortions,
    consumeUnits,
    restorePortions,
    restoreUnits,
  } = useInventory(householdId);

  const { prepQueue, addToPrepQueue, removeFromPrepQueue } = usePrepQueue(householdId);

  const { usualMeals, addUsualMeal } = useUsualMeals(householdId);

  const {
    plans,
    getPlan,
    weeklyKpis,
    projectedWeeklyKpis,
    loading: planLoading,
    addSlotItem,
    removeSlotItem,
    updateSlotItem,
    updateSlotItemPortions,
    confirmSlot,
    clearSlot,
    offsetDateStr,
  } = useDailyPlan(householdId);

  const [showAddPrep, setShowAddPrep]             = useState(false);
  const [showShopping, setShowShopping]           = useState(false);
  const [prepopulated, setPrepopulated]           = useState(null);
  const [prepQueueItemToRemove, setPrepQueueItemToRemove] = useState(null);
  const [resolvingItem, setResolvingItem]     = useState(null);
  const [showSnackSheet, setShowSnackSheet]   = useState(false);
  const [showCookingTime, setShowCookingTime] = useState(false);
  const [usualToast, setUsualToast]           = useState(null);
  const [kpiProposalSlot, setKpiProposalSlot] = useState(null);
  const [kpiPriority, setKpiPriority]         = useState(null);
  const [showBriefing, setShowBriefing]       = useState(false);
  const [lastWeekKpis, setLastWeekKpis]       = useState(null);
  const [dayOffset, setDayOffset]             = useState(0);
  const savedKpisRef = useRef(false);

  const isMonday = new Date().getDay() === 1;
  const mondayStr = getMondayStr();

  // Save current KPIs to localStorage whenever they're non-zero (for next Monday's briefing)
  useEffect(() => {
    if (!weeklyKpis || savedKpisRef.current) return;
    const hasData = weeklyKpis.ironDays > 0 || weeklyKpis.fishDays > 0 || weeklyKpis.legumedDays > 0 || weeklyKpis.distinctVeggies > 0;
    if (!hasData) return;
    savedKpisRef.current = true;
    localStorage.setItem(LAST_WEEK_KPIS_KEY, JSON.stringify(weeklyKpis));
  }, [weeklyKpis]);

  // Show briefing on Mondays when KPIs are fresh (all zero) and we have last week's data
  useEffect(() => {
    if (!isMonday) return;
    const dismissed = localStorage.getItem(`${BRIEFING_DISMISSED_KEY}_${mondayStr}`);
    if (dismissed) return;
    const stored = localStorage.getItem(LAST_WEEK_KPIS_KEY);
    if (!stored) return;
    const parsed = JSON.parse(stored);
    const isAllZero = !weeklyKpis || (weeklyKpis.ironDays === 0 && weeklyKpis.fishDays === 0 && weeklyKpis.legumedDays === 0);
    if (isAllZero) {
      setLastWeekKpis(parsed);
      setShowBriefing(true);
    }
  }, [isMonday, mondayStr, weeklyKpis]);

  function handleDismissBriefing() {
    setShowBriefing(false);
    localStorage.setItem(`${BRIEFING_DISMISSED_KEY}_${mondayStr}`, '1');
  }

  function handleKpiTap(kpiId) {
    const todayPlan = getPlan(todayStr());
    const slots = todayPlan?.slots || {};
    const firstEmpty = ['comida', 'cena'].find(s => !slots[s]?.items?.length);
    setKpiPriority(kpiId);
    setKpiProposalSlot(firstEmpty || 'comida');
  }

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

  const handleRemoveSlotItem = async (dateStr, slotId, itemIdx) => {
    const plan = getPlan(dateStr);
    const slot = plan?.slots?.[slotId];
    const item = slot?.items?.[itemIdx];

    if (item && slot?.confirmedAt && item.inventoryItemId) {
      if (item.itemType === 'snack-batch') {
        await restoreUnits(item.inventoryItemId, 1);
      } else if (item.itemType !== 'manual' && item.itemType !== 'flotante') {
        await restorePortions(
          item.inventoryItemId,
          item.portionsAdultConsumed || 0,
          item.portionsBabyConsumed || 0,
        );
      }
    }

    await removeSlotItem(dateStr, slotId, itemIdx);
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
    setShowCookingTime(false);
    setShowSnackSheet(false);
  }

  function handlePrepQueueDone(item) {
    setPrepopulated({
      name:          item.label,
      type:          item.prepType === 'justo-antes' ? 'acelerador' : (item.prepType ?? 'ya-preparado'),
      portionsAdult: item.adultPortions ?? 2,
      portionsBaby:  item.babyPortions  ?? 1,
      tags:          item.tags ?? [],
    });
    setPrepQueueItemToRemove(item.id);
    setShowAddPrep(true);
  }

  const handleSavePrep = async (data) => {
    await addItem(data);
    if (prepQueueItemToRemove) {
      await removeFromPrepQueue(prepQueueItemToRemove);
      setPrepQueueItemToRemove(null);
    }
    // Auto-inference: if same name already exists in inventory → recurring meal
    const sameName = inventoryItems.filter(
      i => i.name.toLowerCase() === data.name.toLowerCase()
    );
    const alreadyUsual = usualMeals.some(
      m => m.name?.toLowerCase() === data.name.toLowerCase()
    );
    if (sameName.length >= 1 && !alreadyUsual) {
      await addUsualMeal({ name: data.name, tags: data.tags });
      setUsualToast(data.name);
      setTimeout(() => setUsualToast(null), 3000);
    }
  };

  const alertsVisible = expiringItems.length > 0 || floatingItems.length > 0 || (hasAiAccess && lowSnackItems.length > 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between lg:max-w-none lg:pl-6 lg:pr-16">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDayOffset((o) => o - 1)}
              disabled={dayOffset <= -5}
              className="flex items-center justify-center w-8 h-8 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-20"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-center">
              <p className="text-xs text-gray-400 capitalize">{formatTodayHeader()}</p>
              <h1 className="text-lg font-bold text-gray-900">
                {dayOffset === 0 ? 'Hoy' : dayOffset === -1 ? 'Ayer' : dayOffset < 0 ? `Hace ${-dayOffset} días` : `En ${dayOffset} días`}
              </h1>
            </div>
            <button
              onClick={() => setDayOffset((o) => o + 1)}
              disabled={dayOffset >= 5}
              className="flex items-center justify-center w-8 h-8 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors disabled:opacity-20"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {hasAiAccess && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCookingTime(true)}
                className="hidden lg:flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-xl transition-colors"
              >
                <Clock className="w-3.5 h-3.5" />
                Tengo tiempo para cocinar
              </button>
              <button
                onClick={() => setShowShopping(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-xl transition-colors"
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                Voy a comprar
              </button>
            </div>
          )}
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-4 space-y-4 pb-24 lg:pb-6 lg:max-w-none lg:px-6">
        {/* Briefing del lunes */}
        {showBriefing && lastWeekKpis && (
          <WeeklyBriefing lastWeekKpis={lastWeekKpis} onDismiss={handleDismissBriefing} />
        )}

        {/* KPI strip semanal (accionables cuando hay acceso IA) */}
        <WeeklyKpiStrip kpis={weeklyKpis} onKpiTap={hasAiAccess ? handleKpiTap : undefined} />

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
                <Cookie className="w-4 h-4 text-amber-500 shrink-0" />
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

        {/* Cola de preparaciones pendientes */}
        <PrepQueueSection
          items={prepQueue}
          onDone={handlePrepQueueDone}
          onRemove={removeFromPrepQueue}
          onAdd={addToPrepQueue}
        />

        {/* F8 — Tengo tiempo para cocinar (mobile only — en desktop aparece en el header) */}
        {hasAiAccess && (
          <button
            onClick={() => setShowCookingTime(true)}
            className="lg:hidden w-full flex items-center gap-3 bg-brand-600 text-white rounded-2xl px-4 py-3 text-sm font-medium hover:bg-brand-700 transition-colors"
          >
            <Clock className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">Tengo tiempo para cocinar</span>
            <ChevronRight className="w-4 h-4 opacity-70 shrink-0" />
          </button>
        )}

        {/* Day planning sections */}
        <div className="lg:grid lg:grid-cols-3 lg:gap-4 space-y-4 lg:space-y-0">
          {getDays(dayOffset).map(({ offset, label }) => {
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
                pantryItems={pantryItems}
                defaultExpanded={true}
                autoPropose={offset === 0}
                timeOfDay={offset === 0 ? getTimeOfDay() : undefined}
                onAddSlotItem={addSlotItem}
                onRemoveSlotItem={handleRemoveSlotItem}
                onConfirmSlot={handleConfirmSlot}
                onClearSlot={clearSlot}
                onUpdateSlotItemPortions={updateSlotItemPortions}
                onUpdateSlotItem={updateSlotItem}
              />
            );
          })}
        </div>

        {/* Historial semanal discreto */}
        <WeekHistoryStrip plans={plans} />
      </div>

      {/* FAB — nueva preparación */}
      <button
        onClick={() => setShowAddPrep(true)}
        className="fixed right-4 z-20 flex items-center gap-2 bg-brand-600 text-white text-sm font-medium px-4 py-3 rounded-2xl shadow-lg hover:bg-brand-700 transition-colors bottom-[calc(4rem+env(safe-area-inset-bottom)+1rem)] lg:bottom-6"
      >
        <Plus className="w-4 h-4" />
        Nueva preparación
      </button>

      {/* Toast: añadido a habituales */}
      {usualToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-xs font-medium px-4 py-2 rounded-full shadow-lg">
          "{usualToast}" añadido a habituales ⭐
        </div>
      )}

      <AddPrepModal
        isOpen={showAddPrep}
        onClose={() => { setShowAddPrep(false); setPrepopulated(null); }}
        onSave={handleSavePrep}
        onAddUsualMeal={addUsualMeal}
        initialData={prepopulated}
      />

      {showShopping && (
        <ShoppingSuggestionSheet
          inventoryItems={inventoryItems}
          expiringItems={expiringItems}
          floatingItems={floatingItems}
          weeklyKpis={weeklyKpis}
          pantryItems={pantryItems}
          onClose={() => setShowShopping(false)}
        />
      )}

      {resolvingItem && (
        <FloatingResolverSheet
          floatingItem={resolvingItem}
          inventoryItems={inventoryItems}
          weeklyKpis={weeklyKpis}
          pantryItems={pantryItems}
          onClose={() => setResolvingItem(null)}
          onSelect={handleSuggestionSelect}
          onSchedule={handleSchedulePrep}
        />
      )}

      {showSnackSheet && (
        <SnackSuggestionSheet
          snackItems={lowSnackItems}
          inventoryItems={inventoryItems}
          pantryItems={pantryItems}
          onClose={() => setShowSnackSheet(false)}
          onSelect={handleSuggestionSelect}
          onSchedule={handleSchedulePrep}
        />
      )}

      {showCookingTime && (
        <CookingTimeSheet
          inventoryItems={inventoryItems}
          weeklyKpis={weeklyKpis}
          pantryItems={pantryItems}
          onClose={() => setShowCookingTime(false)}
          onSelect={handleSuggestionSelect}
          onSchedule={handleSchedulePrep}
        />
      )}

      {/* KPI accionable: propuesta enfocada en cubrir un KPI específico */}
      {kpiProposalSlot && (
        <MealProposalSheet
          slotId={kpiProposalSlot}
          date={offsetDateStr(0)}
          inventoryItems={inventoryItems}
          todaySlots={getPlan(offsetDateStr(0))?.slots}
          weeklyKpis={weeklyKpis}
          pantryItems={pantryItems}
          priorityKpi={kpiPriority}
          timeOfDay={getTimeOfDay()}
          onSelect={(entry) => {
            addSlotItem(offsetDateStr(0), kpiProposalSlot, entry);
            setKpiProposalSlot(null);
            setKpiPriority(null);
          }}
          onClose={() => { setKpiProposalSlot(null); setKpiPriority(null); }}
        />
      )}

    </div>
  );
}
