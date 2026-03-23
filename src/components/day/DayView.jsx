import { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import MealSlot from './MealSlot';

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MEAL_TYPES = ['desayuno', 'snack', 'comida', 'merienda', 'cena'];
const MEAL_LABELS = {
  desayuno: 'Desayuno',
  snack: 'Snack AM',
  comida: 'Comida',
  merienda: 'Merienda',
  cena: 'Cena',
};

export default function DayView({
  weekDoc,
  dayIndex,
  householdId,
  onBack,
  onSaveMeal,
  onTrackMeal,
  onCopyMeal,
  onReorderMeals,
}) {
  const [activeId, setActiveId] = useState(null);

  const dayData = weekDoc?.days?.[dayIndex];
  const dayName = dayData?.day || DAYS[dayIndex];
  const meals = dayData?.meals || MEAL_TYPES.map((tipo) => ({ tipo, baby: '', adult: '', tags: [], track: null }));

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const mealIds = meals.map((m, i) => `${dayName}-${m.tipo}-${i}`);

  const handleDragStart = ({ active }) => setActiveId(active.id);

  const handleDragEnd = ({ active, over }) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = mealIds.indexOf(active.id);
    const newIndex = mealIds.indexOf(over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(meals, oldIndex, newIndex);
    onReorderMeals(weekDoc.id, dayIndex, reordered);
  };

  // Navigate between days
  const canGoPrev = dayIndex > 0;
  const canGoNext = dayIndex < (weekDoc?.days?.length || 0) - 1;

  const weekContext = weekDoc?.days || [];

  const handleCopy = (fromDay, fromMealType, toDay, toMealType, data) => {
    const toDayIndex = DAYS.indexOf(toDay);
    const toMealIndex = MEAL_TYPES.indexOf(toMealType);
    if (toDayIndex === -1 || toMealIndex === -1) return;
    onCopyMeal(weekDoc.id, dayIndex, MEAL_TYPES.indexOf(fromMealType), toDayIndex, toMealIndex);
    // Also save the current data first
    const fromMealIdx = MEAL_TYPES.indexOf(fromMealType);
    if (fromMealIdx !== -1) {
      onSaveMeal(weekDoc.id, dayIndex, fromMealIdx, data);
    }
    // Then copy to target
    onSaveMeal(weekDoc.id, toDayIndex, toMealIndex, data);
  };

  if (!dayData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Día no encontrado</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
            aria-label="Volver"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
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
            <h1 className="text-lg font-bold text-gray-900 flex-1 text-center">
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
      </header>

      {/* Meal slots */}
      <main className="max-w-2xl mx-auto px-4 py-4">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={mealIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {meals.map((meal, mealIndex) => (
                <MealSlot
                  key={`${dayName}-${meal.tipo}-${mealIndex}`}
                  id={`${dayName}-${meal.tipo}-${mealIndex}`}
                  meal={meal}
                  dayName={dayName}
                  dayIndex={dayIndex}
                  mealIndex={mealIndex}
                  weekId={weekDoc?.id}
                  weekContext={weekContext}
                  householdId={householdId}
                  onSave={(dIdx, mIdx, data) => onSaveMeal(weekDoc.id, dIdx, mIdx, data)}
                  onTrack={(dIdx, mIdx, trackData) => onTrackMeal(weekDoc.id, dIdx, mIdx, trackData)}
                  onCopy={handleCopy}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </main>
    </div>
  );
}
