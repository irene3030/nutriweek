import { track } from '../../lib/analytics';
import MealSlot from './MealSlot';
import { Droplets, Fish, Bean, Apple, Leaf, Sparkles } from 'lucide-react';

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MEAL_TYPES = ['desayuno', 'snack', 'comida', 'merienda', 'cena'];

const KPI_DAY_META = {
  iron:   { Icon: Droplets, label: 'Hierro' },
  fish:   { Icon: Fish,     label: 'Pescado graso' },
  legume: { Icon: Bean,     label: 'Legumbre' },
  fruit:  { Icon: Apple,    label: 'Fruta' },
  veggie: { Icon: Leaf,     label: 'Verduras' },
};

function computeDayContributions(dayData, kpiConfig) {
  if (!dayData?.meals || !kpiConfig) return [];
  // Use effective tags: track.tags (real) when tracked, meal.tags (planned) otherwise
  const meals = dayData.meals.map(m => ({
    ...m,
    tags: m.track?.tags ?? m.tags ?? [],
  }));
  const active = kpiConfig.active || [];
  const result = [];

  for (const id of active) {
    if (id === 'protein_rotation') continue;

    if (id === 'iron') {
      if (meals.some(m => m.tags?.includes('iron')))
        result.push({ id, ...KPI_DAY_META.iron, value: '+1' });
    } else if (id === 'fish') {
      if (meals.some(m => m.tags?.includes('oily_fish')))
        result.push({ id, ...KPI_DAY_META.fish, value: '+1' });
    } else if (id === 'legume') {
      if (meals.some(m => m.tags?.includes('legume')))
        result.push({ id, ...KPI_DAY_META.legume, value: '+1' });
    } else if (id === 'fruit') {
      if (meals.some(m => m.tags?.includes('fruit')))
        result.push({ id, ...KPI_DAY_META.fruit, value: '+1' });
    } else if (id === 'veggie') {
      const veggies = new Set();
      for (const m of meals) {
        for (const tag of (m.tags || [])) {
          if (tag.startsWith('veggie:')) {
            const name = tag.split(':')[1];
            if (name) veggies.add(name.toLowerCase().trim());
          }
        }
      }
      if (veggies.size > 0)
        result.push({ id, ...KPI_DAY_META.veggie, value: `+${veggies.size}` });
    } else {
      // Custom KPI
      const custom = (kpiConfig.custom || []).find(k => k.id === id);
      if (custom) {
        const terms = custom.query.split(',').map(t => t.toLowerCase().trim()).filter(Boolean);
        const matched = meals.some(m => {
          const text = `${m.baby || ''} ${m.adult || ''}`.toLowerCase();
          return terms.some(t => text.includes(t));
        });
        if (matched)
          result.push({ id, Icon: Sparkles, label: custom.name, value: '+1' });
      }
    }
  }
  return result;
}

export default function DayView({
  weekDoc,
  dayIndex,
  householdId,
  apiKey,
  hasAiAccess,
  kpiConfig,
  onBack,
  onSaveMeal,
  onTrackMeal,
  onCopyMeal,
  onSwapMeals,
  onReorderMeals,
}) {
  const dayData = weekDoc?.days?.[dayIndex];
  const dayName = dayData?.day || DAYS[dayIndex];
  const meals = dayData?.meals || MEAL_TYPES.map((tipo) => ({ tipo, baby: '', tags: [], track: null }));

  const contributions = computeDayContributions(dayData, kpiConfig);

  // Navigate between days
  const canGoPrev = dayIndex > 0;
  const canGoNext = dayIndex < (weekDoc?.days?.length || 0) - 1;

  const weekContext = weekDoc?.days || [];

  const handleSwap = (fromDay, fromMealType, toDay, toMealType) => {
    const fromDayIndex = DAYS.indexOf(fromDay);
    const fromMealIndex = MEAL_TYPES.indexOf(fromMealType);
    const toDayIndex = DAYS.indexOf(toDay);
    const toMealIndex = MEAL_TYPES.indexOf(toMealType);
    if (toDayIndex === -1 || toMealIndex === -1) return;
    onSwapMeals(weekDoc.id, fromDayIndex, fromMealIndex, toDayIndex, toMealIndex);
  };

  const handleCopy = (fromDay, fromMealType, toDay, toMealType, data) => {
    const toDayIndex = DAYS.indexOf(toDay);
    const toMealIndex = MEAL_TYPES.indexOf(toMealType);
    if (toDayIndex === -1 || toMealIndex === -1) return;
    onCopyMeal(weekDoc.id, dayIndex, MEAL_TYPES.indexOf(fromMealType), toDayIndex, toMealIndex);
    track('meal_copied');
    // Also save the current data first
    const fromMealIdx = MEAL_TYPES.indexOf(fromMealType);
    if (fromMealIdx !== -1) {
      onSaveMeal(weekDoc.id, dayIndex, fromMealIdx, data);
    }
    // Then copy to target
    onSaveMeal(weekDoc.id, toDayIndex, toMealIndex, data);
  };

  if (!dayData) return null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 shrink-0 px-4 py-3 flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
          aria-label="Cerrar"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="flex items-center gap-2 flex-1">
          <button
            disabled={!canGoPrev}
            onClick={() => onBack(dayIndex - 1)}
            className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-base font-bold text-gray-900 flex-1 text-center">
            {dayName} <span className="text-gray-400 font-normal text-sm">— {weekDoc?.label}</span>
          </h1>
          <button
            disabled={!canGoNext}
            onClick={() => onBack(dayIndex + 1)}
            className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Meal slots */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-3">
          {dayData.cleared && meals.every(m => !m.baby) && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700 space-y-1">
              <p className="font-semibold">Día sin planificar</p>
              <p>Aunque comas fuera de casa, recuerda mantener el equilibrio nutricional: intenta incluir verdura, proteína de calidad (carne, pescado, legumbre o huevo) y algo de fruta.</p>
            </div>
          )}
          {meals.map((meal, mealIndex) => (
            <MealSlot
              key={`${dayName}-${meal.tipo}-${mealIndex}`}
              meal={meal}
              dayName={dayName}
              dayIndex={dayIndex}
              mealIndex={mealIndex}
              weekId={weekDoc?.id}
              weekContext={weekContext}
              householdId={householdId}
              apiKey={apiKey}
              hasAiAccess={hasAiAccess}
              onSave={(dIdx, mIdx, data) => onSaveMeal(weekDoc.id, dIdx, mIdx, data)}
              onTrack={(dIdx, mIdx, trackData) => onTrackMeal(weekDoc.id, dIdx, mIdx, trackData)}
              onCopy={handleCopy}
              onSwap={handleSwap}
            />
          ))}
        </div>

        {contributions.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <p className="text-xs text-gray-400 mb-2">Contribución de hoy</p>
            <div className="flex flex-wrap gap-1.5">
              {contributions.map(c => (
                <span key={c.id} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 border border-brand-100">
                  {c.Icon && <c.Icon className="w-3 h-3 shrink-0" />}
                  {c.value} {c.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

