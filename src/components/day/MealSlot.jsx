import { useState } from 'react';
import TagChip from '../ui/TagChip';
import MealEditor from './MealEditor';
import TrackModal from './TrackModal';
import { track } from '../../lib/analytics';
import { Sunrise, Apple, Utensils, Coffee, Moon, Check, Circle, ArrowLeftRight } from 'lucide-react';

const MEAL_LABELS = {
  desayuno: 'Desayuno',
  snack: 'Snack AM',
  comida: 'Comida',
  merienda: 'Merienda',
  cena: 'Cena',
};

const MEAL_ICONS = {
  desayuno: Sunrise,
  snack: Apple,
  comida: Utensils,
  merienda: Coffee,
  cena: Moon,
};

const TAG_BAR_COLORS = {
  iron: 'bg-orange-400',
  fish: 'bg-blue-400',
  legume: 'bg-green-400',
  egg: 'bg-yellow-400',
  dairy: 'bg-sky-400',
  fruit: 'bg-pink-400',
  cereal: 'bg-amber-400',
};

function parseIngredients(text) {
  if (!text) return [];
  const parts = text
    .split(/\s+con\s+|\s+y\s+|,/i)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 2 && s.length < 50);
  return parts.length >= 2 ? parts : [];
}

function getBarColor(tags = []) {
  const priority = ['iron', 'fish', 'legume', 'egg', 'dairy', 'fruit', 'cereal'];
  for (const p of priority) {
    if (tags.includes(p)) return TAG_BAR_COLORS[p];
  }
  if (tags.some((t) => t.startsWith('veggie:'))) return 'bg-lime-400';
  return 'bg-gray-200';
}

export default function MealSlot({
  meal,
  dayName,
  dayIndex,
  mealIndex,
  weekId,
  weekContext,
  householdId,
  apiKey,
  hasAiAccess,
  onSave,
  onTrack,
  onCopy,
  onSwap,
}) {
  const [editing, setEditing] = useState(false);
  const [showTrack, setShowTrack] = useState(false);

  const effectiveTags = meal?.track?.tags ?? meal?.tags ?? [];
  const barColor = getBarColor(effectiveTags);
  const hasContent = !!meal?.baby;


  const handleSave = (data) => {
    onSave(dayIndex, mealIndex, data);
    setEditing(false);
  };

  const handleTrackSave = (trackData) => {
    onTrack(dayIndex, mealIndex, trackData);
    if (trackData.done) track('meal_tracked', { day: dayName, meal_type: meal?.tipo });
  };

  const handleCopy = (targetDay, targetMealType, data) => {
    onCopy(dayName, meal?.tipo, targetDay, targetMealType, data);
  };

  const handleSwap = (targetDay, targetMealType) => {
    onSwap(dayName, meal?.tipo, targetDay, targetMealType);
    setEditing(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-shadow">
      {/* Content */}
      <div className="px-3 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
            {MEAL_ICONS[meal?.tipo] && (() => { const Icon = MEAL_ICONS[meal.tipo]; return <Icon className="w-3.5 h-3.5" />; })()}
            {MEAL_LABELS[meal?.tipo]}
          </span>
          <div className="flex items-center gap-1">
            {/* Track button */}
            <button
              onClick={() => setShowTrack(true)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                meal?.track?.status === 'done'
                  ? 'bg-green-50 border-green-300 text-green-700'
                  : meal?.track?.status === 'partial'
                  ? 'bg-orange-50 border-orange-300 text-orange-700'
                  : meal?.track?.status === 'other'
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : meal?.track?.done
                  ? 'bg-green-50 border-green-300 text-green-700'
                  : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
              }`}
              title="Registrar seguimiento"
            >
              {meal?.track?.status === 'done' || meal?.track?.done
                ? <><Check className="w-3 h-3 inline mr-0.5" />Comido</>
                : meal?.track?.status === 'partial'
                ? <><Circle className="w-3 h-3 inline mr-0.5 opacity-50" />Parcial</>
                : meal?.track?.status === 'other'
                ? <><ArrowLeftRight className="w-3 h-3 inline mr-0.5" />Otra cosa</>
                : <><Circle className="w-3 h-3 inline mr-0.5" />Registrar</>}
            </button>
            {/* Edit button */}
            <button
              onClick={() => setEditing(!editing)}
              className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Editar"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
        </div>

        {!editing ? (
          <>
            {hasContent ? (
              <>
                {/* Planned meal — struck through if 'other' */}
                <p className={`text-sm leading-snug ${
                  meal?.track?.status === 'other' ? 'text-gray-400 line-through' : 'text-gray-800'
                }`}>{meal.baby}</p>

                {/* Actual eaten — 'other' status */}
                {meal?.track?.status === 'other' && meal.track.altFood && (
                  <p className="text-sm text-gray-500 leading-snug mt-1">
                    <span className="font-medium">Comió:</span> {meal.track.altFood}
                  </p>
                )}

                {/* Ingredient breakdown — 'partial' with checklist */}
                {meal?.track?.status === 'partial' && meal.track.checkedIngredients && (() => {
                  const allIngs = parseIngredients(meal.baby || '');
                  const checkedSet = new Set(meal.track.checkedIngredients);
                  if (allIngs.length < 2) return null;
                  return (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {allIngs.map(ing => (
                        <span key={ing} className={`text-xs px-1.5 py-0.5 rounded-full ${
                          checkedSet.has(ing)
                            ? 'bg-orange-50 text-orange-700'
                            : 'bg-gray-100 text-gray-400 line-through'
                        }`}>{ing}</span>
                      ))}
                    </div>
                  );
                })()}

                {/* Extra food (any status) */}
                {meal?.track?.extra && (
                  <p className="text-sm text-gray-500 mt-1">
                    <span className="font-medium">También:</span> {meal.track.extra}
                  </p>
                )}

                {/* Effective tags — deduplicate veggie:* into a single pill */}
                {effectiveTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {effectiveTags
                      .reduce((acc, tag) => {
                        if (tag.startsWith('veggie:') || tag === 'veggie') {
                          if (!acc.includes('veggie')) acc.push('veggie');
                        } else if (!acc.includes(tag)) {
                          acc.push(tag);
                        }
                        return acc;
                      }, [])
                      .map((tag) => (
                        <TagChip key={tag} tag={tag} small />
                      ))}
                  </div>
                )}

                {/* Legacy note (backwards compat) */}
                {!meal?.track?.status && meal?.track?.note && (
                  <p className="text-xs text-gray-400 italic mt-1.5 border-t border-gray-100 pt-1.5">
                    "{meal.track.note}"
                  </p>
                )}
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="text-sm text-gray-300 hover:text-gray-400 transition-colors"
              >
                + Añadir comida
              </button>
            )}

          </>
        ) : (
          <div className="mt-2">
            <MealEditor
              meal={meal}
              dayName={dayName}
              weekContext={weekContext}
              householdId={householdId}
              apiKey={apiKey}
              hasAiAccess={hasAiAccess}
              onSave={handleSave}
              onCopy={handleCopy}
              onSwap={handleSwap}
              onCancel={() => setEditing(false)}
            />
          </div>
        )}
      </div>

      {/* Track modal */}
      <TrackModal
        isOpen={showTrack}
        onClose={() => setShowTrack(false)}
        meal={meal}
        dayName={dayName}
        onSave={handleTrackSave}
        apiKey={apiKey}
      />
    </div>
  );
}
