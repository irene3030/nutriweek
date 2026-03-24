import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TagChip from '../ui/TagChip';
import MealEditor from './MealEditor';
import TrackModal from './TrackModal';
import { suggestMeal } from '../../lib/claude';

const REGEN_REQUIREMENTS = [
  { id: 'hierro', label: '🩸 Hierro' },
  { id: 'pescado graso', label: '🐟 Pescado' },
  { id: 'legumbre', label: '🟢 Legumbre' },
  { id: 'verdura', label: '🥦 Verdura' },
  { id: 'huevo', label: '🟡 Huevo' },
  { id: 'fruta', label: '🍓 Fruta' },
];

const MEAL_LABELS = {
  desayuno: 'Desayuno',
  snack: 'Snack AM',
  comida: 'Comida',
  merienda: 'Merienda',
  cena: 'Cena',
};

const MEAL_ICONS = {
  desayuno: '☀️',
  snack: '🍎',
  comida: '🍽️',
  merienda: '🧃',
  cena: '🌙',
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
  onSave,
  onTrack,
  onCopy,
  id,
}) {
  const [editing, setEditing] = useState(false);
  const [showTrack, setShowTrack] = useState(false);
  const [showRegen, setShowRegen] = useState(false);
  const [regenIngredients, setRegenIngredients] = useState('');
  const [regenRequirements, setRegenRequirements] = useState([]);
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const barColor = getBarColor(meal?.tags || []);
  const hasContent = !!meal?.baby;

  const toggleRegenReq = (id) => {
    setRegenRequirements(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    setRegenError(null);
    try {
      const result = await suggestMeal({
        dayName,
        mealType: meal?.tipo,
        weekContext,
        ingredients: regenIngredients,
        requirements: regenRequirements,
        apiKey,
      });
      onSave(dayIndex, mealIndex, { baby: result.baby, tags: result.tags || [] });
      setShowRegen(false);
      setRegenIngredients('');
      setRegenRequirements([]);
    } catch (err) {
      setRegenError(
        err.message === 'NO_API_KEY' ? 'Añade tu API key en Perfil.' :
        err.message === 'CALL_LIMIT_EXCEEDED' ? 'Has alcanzado el límite mensual de llamadas. Auméntalo en Perfil.' :
        err.message || 'Error al regenerar.');
    } finally {
      setRegenerating(false);
    }
  };

  const handleSave = (data) => {
    onSave(dayIndex, mealIndex, data);
    setEditing(false);
  };

  const handleTrackSave = (trackData) => {
    onTrack(dayIndex, mealIndex, trackData);
  };

  const handleCopy = (targetDay, targetMealType, data) => {
    onCopy(dayName, meal?.tipo, targetDay, targetMealType, data);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex gap-0 bg-white rounded-xl border transition-shadow ${
        isDragging ? 'shadow-lg border-brand-300' : 'border-gray-100 hover:border-gray-200 hover:shadow-sm'
      }`}
    >
      {/* Color bar */}
      <div className={`w-1 rounded-l-xl shrink-0 ${barColor}`} />

      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="flex items-center px-1.5 text-gray-300 hover:text-gray-400 cursor-grab active:cursor-grabbing touch-none"
        aria-label="Arrastrar"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
        </svg>
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0 px-3 py-3">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-gray-500 flex items-center gap-1">
            <span>{MEAL_ICONS[meal?.tipo]}</span>
            {MEAL_LABELS[meal?.tipo]}
          </span>
          <div className="flex items-center gap-1">
            {/* Track button */}
            <button
              onClick={() => setShowTrack(true)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                meal?.track?.done
                  ? 'bg-green-50 border-green-300 text-green-700'
                  : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
              }`}
              title="Registrar seguimiento"
            >
              {meal?.track?.done ? '✓ Comido' : '○ Registrar'}
            </button>
            {/* Regenerate button */}
            {hasContent && (
              <button
                onClick={() => { setShowRegen(v => !v); setEditing(false); }}
                className={`p-1 rounded-lg transition-colors ${showRegen ? 'bg-brand-100 text-brand-600' : 'hover:bg-gray-100 text-gray-400 hover:text-gray-600'}`}
                aria-label="Regenerar con IA"
                title="Regenerar comida"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
            {/* Edit button */}
            <button
              onClick={() => { setEditing(!editing); setShowRegen(false); }}
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
                <p className="text-sm text-gray-800 leading-snug">{meal.baby}</p>
                {meal?.tags && meal.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {meal.tags.map((tag) => (
                      <TagChip key={tag} tag={tag} small />
                    ))}
                  </div>
                )}
                {meal?.track?.note && (
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

            {/* Inline regenerate panel */}
            {showRegen && (
              <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                <input
                  type="text"
                  value={regenIngredients}
                  onChange={e => setRegenIngredients(e.target.value)}
                  placeholder="Ingredientes (opcional)"
                  className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                />
                <div className="flex flex-wrap gap-1">
                  {REGEN_REQUIREMENTS.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => toggleRegenReq(r.id)}
                      className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                        regenRequirements.includes(r.id)
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'bg-white text-gray-500 border-gray-200 hover:border-brand-400'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                {regenError && (
                  <p className="text-xs text-red-500">{regenError}</p>
                )}
                <button
                  onClick={handleRegenerate}
                  disabled={regenerating}
                  className="w-full flex items-center justify-center gap-1.5 bg-brand-600 text-white text-xs font-medium py-1.5 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
                >
                  {regenerating
                    ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Regenerando...</>
                    : '✨ Regenerar'
                  }
                </button>
              </div>
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
              onSave={handleSave}
              onCopy={handleCopy}
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
      />
    </div>
  );
}
