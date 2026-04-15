import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import LoadingSpinner from '../ui/LoadingSpinner';
import MenuLoadingAnimation from '../ui/MenuLoadingAnimation';
import { generateWeekMenu } from '../../lib/claude';
import { track } from '../../lib/analytics';
import { Check, ChevronRight, RefreshCw, Pencil } from 'lucide-react';

const DAY_ORDER = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MEAL_TYPES = ['desayuno', 'snack', 'comida', 'merienda', 'cena'];
const MEAL_LABELS = { desayuno: 'Desayuno', snack: 'Snack', comida: 'Comida', merienda: 'Merienda', cena: 'Cena' };
const DAY_LABELS = { Lun: 'Lunes', Mar: 'Martes', Mié: 'Miércoles', Jue: 'Jueves', Vie: 'Viernes', Sáb: 'Sábado', Dom: 'Domingo' };

function getTodayDayName() {
  const names = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return names[new Date().getDay()];
}

function getSeason(dateStr) {
  const month = new Date(dateStr).getMonth() + 1;
  if (month >= 3 && month <= 5) return 'primavera';
  if (month >= 6 && month <= 8) return 'verano';
  if (month >= 9 && month <= 11) return 'otoño';
  return 'invierno';
}

// Which days are "past" (Monday up to and including today)
function getPastDays(mondayDate) {
  const today = getTodayDayName();
  const todayIdx = DAY_ORDER.indexOf(today);
  if (todayIdx < 0) return [];
  return DAY_ORDER.slice(0, todayIdx + 1);
}

// Days to regenerate (from cutoff onwards)
function getFutureDays(mondayDate, includeTodayMeals) {
  const today = getTodayDayName();
  const todayIdx = DAY_ORDER.indexOf(today);
  if (todayIdx < 0) return DAY_ORDER;
  if (includeTodayMeals) return DAY_ORDER.slice(todayIdx);
  return DAY_ORDER.slice(todayIdx + 1);
}

// Overlay card showing old vs new meal
function MealDiff({ oldMeal, newMeal }) {
  const hasNew = !!newMeal?.baby;
  const hasOld = !!oldMeal?.baby;
  if (!hasOld && !hasNew) return null;

  return (
    <div className="text-xs space-y-0.5">
      {hasOld && (
        <div className={`line-through text-gray-400 leading-snug ${hasNew ? '' : 'no-underline text-gray-500'}`}>
          {oldMeal.babyShort || oldMeal.baby}
        </div>
      )}
      {hasNew && (
        <div className="text-brand-700 font-medium leading-snug">
          {newMeal.babyShort || newMeal.baby}
        </div>
      )}
    </div>
  );
}

export default function ReplanModal({ isOpen, onClose, weekDoc, foodHistory, savedRecipes, kpiConfig, hasAiAccess, onApply }) {
  const [step, setStep] = useState('log'); // 'log' | 'config' | 'review'
  const [logData, setLogData] = useState({}); // { 'Lun-comida': { status: 'eaten'|'other'|'skip', text } }
  const [includeTodayMeals, setIncludeTodayMeals] = useState(false);
  const [ingredients, setIngredients] = useState([]);
  const [ingredientInput, setIngredientInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [proposed, setProposed] = useState(null);

  const mondayDate = weekDoc?.mondayDate;
  const pastDays = mondayDate ? getPastDays(mondayDate) : [];
  const today = getTodayDayName();
  const todayIdx = DAY_ORDER.indexOf(today);
  // Days that will be regenerated given current settings
  const daysToGenerate = mondayDate ? getFutureDays(mondayDate, includeTodayMeals) : [];
  // Next regeneration start label
  const regenFromLabel = daysToGenerate[0] ? DAY_LABELS[daysToGenerate[0]] : '';
  // Today has future unlogged meals that could be regenerated
  const todayHasFutureMeals = todayIdx >= 0 && todayIdx < 6;

  useEffect(() => {
    if (!isOpen) {
      setStep('log');
      setLogData({});
      setIncludeTodayMeals(false);
      setProposed(null);
      setError(null);
      setIngredients([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setIngredients(weekDoc?.ingredients || []);
    }
  }, [isOpen, weekDoc?.id]);

  // Build consumed meals from logData + already tracked meals
  function buildConsumedMeals() {
    const consumed = [];
    for (const dayName of pastDays) {
      // Skip today if we're regenerating from today
      if (includeTodayMeals && dayName === today) continue;
      const dayData = weekDoc?.days?.find(d => d.day === dayName);
      if (!dayData) continue;
      for (const meal of (dayData.meals || [])) {
        const key = `${dayName}-${meal.tipo}`;
        const logged = logData[key];

        if (logged) {
          if (logged.status === 'skip') continue;
          if (logged.status === 'eaten') consumed.push({ day: dayName, tipo: meal.tipo, text: meal.baby });
          if (logged.status === 'other' && logged.text?.trim()) consumed.push({ day: dayName, tipo: meal.tipo, text: logged.text.trim() });
        } else if (meal.track) {
          // Already tracked from before
          const text = meal.track.altFood || meal.baby;
          if (text) consumed.push({ day: dayName, tipo: meal.tipo, text });
        }
        // Unlogged with no interaction = ignored (don't count as consumed)
      }
    }
    return consumed;
  }

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const consumedMeals = buildConsumedMeals();
      const result = await generateWeekMenu({
        availableIngredients: ingredients.join(', '),
        foodHistory,
        savedRecipes,
        season: getSeason(mondayDate),
        consumedMeals,
        daysToGenerate,
        kpiOverrides: kpiConfig?.active
          ? Object.fromEntries(
              Object.entries(kpiConfig.active)
                .filter(([, v]) => v)
                .map(([k]) => [k, { active: true, target: kpiConfig.targets?.[k] ?? 5 }])
            )
          : null,
      });
      setProposed(result);
      setStep('review');
      track('replan_generated', { days: daysToGenerate.length, consumed: consumedMeals.length });
    } catch (err) {
      setError(
        err.message === 'CALL_LIMIT_EXCEEDED' ? 'Has alcanzado el límite mensual.' :
        err.message === 'FREE_QUOTA_EXCEEDED' ? 'Has agotado las llamadas gratuitas.' :
        err.message || 'Error generando el menú.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!proposed?.days) return;
    // Merge: keep existing days not in daysToGenerate, replace regenerated ones
    const mergedDays = (weekDoc.days || []).map(existingDay => {
      if (!daysToGenerate.includes(existingDay.day)) return existingDay;
      const newDay = proposed.days.find(d => d.day === existingDay.day);
      if (!newDay) return existingDay;
      // Merge meals: only replace meals that have content in the new proposal
      const mergedMeals = (existingDay.meals || []).map(existingMeal => {
        const newMeal = (newDay.meals || []).find(m => m.tipo === existingMeal.tipo);
        if (!newMeal?.baby) return existingMeal;
        return { ...existingMeal, baby: newMeal.baby, babyShort: newMeal.babyShort || '', tags: newMeal.tags || [], ingredients: newMeal.ingredients || [], track: null };
      });
      return { ...existingDay, meals: mergedMeals };
    });
    onApply(weekDoc.id, mergedDays);
    onClose();
  };

  const setMealLog = (dayName, tipo, status, text = '') => {
    setLogData(prev => ({ ...prev, [`${dayName}-${tipo}`]: { status, text } }));
  };

  const updateMealText = (dayName, tipo, text) => {
    setLogData(prev => ({
      ...prev,
      [`${dayName}-${tipo}`]: { ...prev[`${dayName}-${tipo}`], text },
    }));
  };

  const addIngredient = (val) => {
    const trimmed = val.trim();
    if (trimmed && !ingredients.includes(trimmed)) setIngredients(prev => [...prev, trimmed]);
    setIngredientInput('');
  };

  const removeIngredient = (ing) => setIngredients(prev => prev.filter(i => i !== ing));

  if (!weekDoc) return null;

  // ── Step 1: Quick log ──────────────────────────────────────────────────────
  const renderLogStep = () => (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Antes de regenerar, marca qué has comido realmente. Esto ayuda a cuadrar los nutrientes del resto de la semana.
      </p>

      {pastDays.length === 0 && (
        <p className="text-sm text-gray-400 italic">Esta semana acaba de empezar — no hay días pasados que revisar.</p>
      )}

      {pastDays.map(dayName => {
        const dayData = weekDoc.days?.find(d => d.day === dayName);
        const meals = (dayData?.meals || []).filter(m => m.baby);
        if (meals.length === 0) return null;

        return (
          <div key={dayName}>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{DAY_LABELS[dayName]}</div>
            <div className="space-y-1.5">
              {meals.map(meal => {
                const key = `${dayName}-${meal.tipo}`;
                const logged = logData[key];
                const alreadyTracked = !!meal.track;

                if (alreadyTracked) {
                  return (
                    <div key={key} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 text-gray-400">
                      <Check className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span className="text-xs">{MEAL_LABELS[meal.tipo]} · {meal.babyShort || meal.baby}</span>
                      <span className="ml-auto text-xs text-gray-300">ya logueado</span>
                    </div>
                  );
                }

                return (
                  <div key={key} className="border border-gray-100 rounded-lg p-2.5 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-medium text-gray-500">{MEAL_LABELS[meal.tipo]}</span>
                        <p className="text-sm text-gray-800 leading-snug mt-0.5">{meal.babyShort || meal.baby}</p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      <button
                        onClick={() => setMealLog(dayName, meal.tipo, 'eaten')}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${logged?.status === 'eaten' ? 'bg-green-50 border-green-300 text-green-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      >
                        ✓ Lo comí
                      </button>
                      <button
                        onClick={() => setMealLog(dayName, meal.tipo, 'other', logged?.text || '')}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors flex items-center gap-1 ${logged?.status === 'other' ? 'bg-amber-50 border-amber-300 text-amber-700 font-medium' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                      >
                        <Pencil className="w-3 h-3" /> Comí otra cosa
                      </button>
                      <button
                        onClick={() => setMealLog(dayName, meal.tipo, 'skip')}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${logged?.status === 'skip' ? 'bg-gray-100 border-gray-300 text-gray-500 font-medium' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
                      >
                        No comí
                      </button>
                    </div>
                    {logged?.status === 'other' && (
                      <input
                        type="text"
                        value={logged.text || ''}
                        onChange={e => updateMealText(dayName, meal.tipo, e.target.value)}
                        placeholder="¿Qué comiste?"
                        className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400"
                        autoFocus
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="pt-2 flex justify-end">
        <button
          onClick={() => setStep('config')}
          className="flex items-center gap-1.5 bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-brand-700 transition-colors"
        >
          Continuar <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  // ── Step 2: Config ─────────────────────────────────────────────────────────
  const renderConfigStep = () => (
    <div className="space-y-5">
      {/* From when */}
      {todayHasFutureMeals && (
        <div>
          <div className="text-sm font-medium text-gray-800 mb-2">¿Desde cuándo regeneramos?</div>
          <div className="space-y-2">
            <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-50 has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50">
              <input
                type="radio"
                name="regenFrom"
                checked={!includeTodayMeals}
                onChange={() => setIncludeTodayMeals(false)}
                className="mt-0.5 accent-brand-600"
              />
              <div>
                <div className="text-sm font-medium text-gray-800">Desde mañana ({DAY_LABELS[DAY_ORDER[todayIdx + 1]]})</div>
                <div className="text-xs text-gray-500 mt-0.5">Las comidas de hoy quedan como están en el plan</div>
              </div>
            </label>
            <label className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-gray-50 has-[:checked]:border-brand-400 has-[:checked]:bg-brand-50">
              <input
                type="radio"
                name="regenFrom"
                checked={includeTodayMeals}
                onChange={() => setIncludeTodayMeals(true)}
                className="mt-0.5 accent-brand-600"
              />
              <div>
                <div className="text-sm font-medium text-gray-800">Desde hoy ({DAY_LABELS[today]})</div>
                <div className="text-xs text-gray-500 mt-0.5">Regenera también las comidas de hoy que no has hecho</div>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* Ingredients */}
      <div>
        <div className="text-sm font-medium text-gray-800 mb-1">Ingredientes disponibles</div>
        <p className="text-xs text-gray-500 mb-2">
          {ingredients.length > 0
            ? 'Los mismos que elegiste al generar la semana. Quita lo que ya hayas gastado o añade lo nuevo que tengas.'
            : 'Añade los ingredientes que tengas disponibles.'}
        </p>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {ingredients.map(ing => (
            <span key={ing} className="flex items-center gap-1 text-xs bg-brand-50 text-brand-700 border border-brand-200 px-2 py-1 rounded-lg">
              {ing}
              <button onClick={() => removeIngredient(ing)} className="text-brand-400 hover:text-brand-600 leading-none">×</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={ingredientInput}
            onChange={e => setIngredientInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addIngredient(ingredientInput); }
              if (e.key === 'Backspace' && !ingredientInput && ingredients.length > 0) removeIngredient(ingredients[ingredients.length - 1]);
            }}
            placeholder="Añadir ingrediente..."
            className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
          <button
            onClick={() => addIngredient(ingredientInput)}
            disabled={!ingredientInput.trim()}
            className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-40 transition-colors"
          >
            Añadir
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between pt-1">
        <button onClick={() => setStep('log')} className="text-sm text-gray-500 hover:text-gray-700">← Atrás</button>
        <button
          onClick={handleGenerate}
          disabled={loading || !hasAiAccess}
          className="flex items-center gap-1.5 bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
        >
          {loading ? <LoadingSpinner size="sm" /> : <RefreshCw className="w-4 h-4" />}
          Regenerar desde {regenFromLabel}
        </button>
      </div>

      {loading && (
        <div className="pt-2">
          <MenuLoadingAnimation />
        </div>
      )}
    </div>
  );

  // ── Step 3: Review overlay ─────────────────────────────────────────────────
  const renderReviewStep = () => {
    const allDays = DAY_ORDER;
    return (
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Revisa la propuesta. En <span className="text-brand-700 font-medium">verde</span> los nuevos platos, tachado lo que se reemplaza.
        </p>

        <div className="grid grid-cols-7 gap-1 text-center">
          {allDays.map(dayName => {
            const isRegen = daysToGenerate.includes(dayName);
            const oldDay = weekDoc.days?.find(d => d.day === dayName);
            const newDay = proposed?.days?.find(d => d.day === dayName);

            return (
              <div key={dayName} className={`rounded-lg p-1.5 ${isRegen ? 'bg-brand-50 border border-brand-100' : 'bg-gray-50 border border-gray-100'}`}>
                <div className={`text-xs font-semibold mb-1.5 ${isRegen ? 'text-brand-600' : 'text-gray-400'}`}>{dayName}</div>
                <div className="space-y-1.5">
                  {MEAL_TYPES.map(tipo => {
                    const oldMeal = oldDay?.meals?.find(m => m.tipo === tipo);
                    const newMeal = newDay?.meals?.find(m => m.tipo === tipo);
                    if (!isRegen && !oldMeal?.baby) return null;
                    if (isRegen) return <MealDiff key={tipo} oldMeal={oldMeal} newMeal={newMeal} />;
                    return oldMeal?.baby ? (
                      <div key={tipo} className="text-xs text-gray-500 leading-snug">
                        {oldMeal.babyShort || oldMeal.baby}
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => { setStep('config'); setProposed(null); }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Regenerar de nuevo
          </button>
          <button
            onClick={handleApply}
            className="flex items-center gap-1.5 bg-brand-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-brand-700 transition-colors"
          >
            <Check className="w-4 h-4" /> Aplicar cambios
          </button>
        </div>
      </div>
    );
  };

  const stepTitle = step === 'log' ? 'Revisa lo que has comido' : step === 'config' ? `Regenerar desde ${regenFromLabel}` : 'Propuesta';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={stepTitle} maxWidth="max-w-2xl">
      <div className="pb-2">
        {/* Step indicator */}
        <div className="flex items-center gap-1.5 mb-5">
          {['log', 'config', 'review'].map((s, i) => (
            <div key={s} className="flex items-center gap-1.5">
              <div className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-medium transition-colors ${step === s ? 'bg-brand-600 text-white' : ['log', 'config', 'review'].indexOf(step) > i ? 'bg-brand-200 text-brand-700' : 'bg-gray-100 text-gray-400'}`}>
                {i + 1}
              </div>
              {i < 2 && <div className={`h-px w-6 transition-colors ${['log', 'config', 'review'].indexOf(step) > i ? 'bg-brand-300' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>

        {step === 'log' && renderLogStep()}
        {step === 'config' && renderConfigStep()}
        {step === 'review' && renderReviewStep()}
      </div>
    </Modal>
  );
}
