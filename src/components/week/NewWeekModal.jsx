import { useState } from 'react';
import Modal from '../ui/Modal';
import LoadingSpinner from '../ui/LoadingSpinner';
import MenuLoadingAnimation from '../ui/MenuLoadingAnimation';
import { generateWeekMenu, regenerateDay, suggestIngredients, suggestIngredientAlternative } from '../../lib/claude';
import { track } from '../../lib/analytics';
import { computeAdaptiveTargets, KPI_CATALOG, DEFAULT_KPI_CONFIG } from '../../lib/kpis';

const CATEGORY_META = {
  proteína: { label: 'Proteínas', emoji: '🥩' },
  pescado:  { label: 'Pescado',   emoji: '🐟' },
  legumbre: { label: 'Legumbres', emoji: '🫘' },
  verdura:  { label: 'Verduras',  emoji: '🥦' },
  fruta:    { label: 'Frutas',    emoji: '🍓' },
  cereal:   { label: 'Cereales',  emoji: '🌾' },
  lácteo:   { label: 'Lácteos',   emoji: '🥛' },
  huevo:    { label: 'Huevos',    emoji: '🥚' },
};

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MEAL_TYPES = ['desayuno', 'snack', 'comida', 'merienda', 'cena'];

const MEAL_LABELS = {
  desayuno: 'Desayuno',
  snack: 'Snack AM',
  comida: 'Comida',
  merienda: 'Merienda',
  cena: 'Cena',
};

// Returns the Monday of the current week as YYYY-MM-DD
function getThisMonday() {
  const d = new Date();
  const day = d.getDay(); // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function mondayToLabel(mondayStr) {
  if (!mondayStr) return '';
  const d = new Date(mondayStr + 'T12:00:00'); // avoid timezone issues
  return `Semana del ${d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long' })}`;
}

const SLOTS_WITH_SAME = ['desayuno', 'snack', 'merienda'];

const DEFAULT_SLOTS = {
  desayuno:  { enabled: true, sameEveryDay: false },
  snack:     { enabled: true, sameEveryDay: false },
  comida:    { enabled: true, sameEveryDay: false },
  merienda:  { enabled: true, sameEveryDay: false },
  cena:      { enabled: true, sameEveryDay: false },
};

/** Build a fake weekDoc from mealSlots so computeAdaptiveTargets can simulate targets */
function simulateWeekDoc(mealSlots, includeWeekend) {
  const activeDays = includeWeekend ? DAYS : DAYS.slice(0, 5);
  return {
    days: activeDays.map(day => ({
      day,
      meals: MEAL_TYPES.map(tipo => ({
        tipo,
        baby: mealSlots[tipo]?.enabled ? 'placeholder' : '',
        adult: '',
        tags: [],
      })),
    })),
  };
}

/** Enforce mealSlots constraints on a generated week result */
function enforceSlots(result, mealSlots) {
  if (!mealSlots || !result?.days) return result;

  const emptyMeal = { baby: '', adult: '', tags: [] };

  // First pass: blank out disabled slots
  const days = result.days.map(day => ({
    ...day,
    meals: (day.meals || []).map(meal => {
      const slot = mealSlots[meal.tipo];
      if (!slot?.enabled) return { ...meal, ...emptyMeal };
      return meal;
    }),
  }));

  // Second pass: for sameEveryDay slots, copy first non-empty occurrence to all days
  const sameSlots = Object.entries(mealSlots)
    .filter(([, v]) => v.enabled && v.sameEveryDay)
    .map(([k]) => k);

  if (sameSlots.length > 0) {
    const canonical = {};
    for (const tipo of sameSlots) {
      for (const day of days) {
        const meal = day.meals?.find(m => m.tipo === tipo);
        if (meal?.baby) { canonical[tipo] = meal; break; }
      }
    }
    return {
      ...result,
      days: days.map(day => ({
        ...day,
        meals: day.meals.map(meal =>
          sameSlots.includes(meal.tipo) && canonical[meal.tipo]
            ? { ...meal, baby: canonical[meal.tipo].baby, adult: canonical[meal.tipo].adult, tags: canonical[meal.tipo].tags }
            : meal
        ),
      })),
    };
  }

  return { ...result, days };
}

export default function NewWeekModal({ isOpen, onClose, onSave, existingWeekIds = [], foodHistory, savedRecipes, usualMeals = [], apiKey, hasAiAccess, kpiConfig }) {
  const [step, setStep] = useState('form');
  const [ingredients, setIngredients] = useState('');
  const [mondayDate, setMondayDate] = useState(getThisMonday());
  const [proposedWeek, setProposedWeek] = useState(null);
  const [regeneratingDay, setRegeneratingDay] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showFixedMeals, setShowFixedMeals] = useState(false);
  const [showAllUsualMeals, setShowAllUsualMeals] = useState(false);
  const [fixedMeals, setFixedMeals] = useState([]);      // [{day, tipo, text}] day can be null
  const [newFixed, setNewFixed] = useState({ day: 'Lun', tipo: 'comida', text: '', anyDay: false });
  const [recurringMeals, setRecurringMeals] = useState([]); // string[]
  const [recurringInput, setRecurringInput] = useState('');
  const [mealSlots, setMealSlots] = useState(DEFAULT_SLOTS);
  const [includeWeekend, setIncludeWeekend] = useState(true);

  // Ingredient review state
  const [ingredientsList, setIngredientsList] = useState([]); // [{id, name, category, reason, removed, customName, editing, altLoading}]
  const [ingredientsLoading, setIngredientsLoading] = useState(false);
  const [ingredientsError, setIngredientsError] = useState(null);

  const weekLabel = mondayToLabel(mondayDate);
  const isDuplicate = existingWeekIds.includes(mondayDate);

  const addFixedMeal = () => {
    if (!newFixed.text.trim()) return;
    if (newFixed.anyDay) {
      // Floating: keyed only by texto, allow duplicates by texto+tipo
      setFixedMeals(prev => [...prev, { day: null, tipo: newFixed.tipo, text: newFixed.text.trim() }]);
    } else {
      setFixedMeals(prev => {
        const filtered = prev.filter(m => !(m.day === newFixed.day && m.tipo === newFixed.tipo));
        return [...filtered, { day: newFixed.day, tipo: newFixed.tipo, text: newFixed.text.trim() }];
      });
    }
    setNewFixed(prev => ({ ...prev, text: '' }));
  };

  const removeFixedMeal = (idx) => {
    setFixedMeals(prev => prev.filter((_, i) => i !== idx));
  };

  const addRecurring = () => {
    const val = recurringInput.trim();
    if (!val) return;
    setRecurringMeals(prev => [...prev, val]);
    setRecurringInput('');
  };

  const toggleSlot = (tipo) => {
    setMealSlots(prev => ({ ...prev, [tipo]: { ...prev[tipo], enabled: !prev[tipo].enabled } }));
  };

  const toggleSameEveryDay = (tipo) => {
    setMealSlots(prev => ({ ...prev, [tipo]: { ...prev[tipo], sameEveryDay: !prev[tipo].sameEveryDay } }));
  };

  const handleGenerateClick = () => {
    if (isDuplicate) { setError('Ya existe un menú para esa semana.'); return; }
    if (!hasAiAccess) { setError('Añade tu API key de Anthropic en Perfil para usar la generación con IA.'); return; }
    setError(null);
    setStep('choice');
  };

  const handleGenerateDirect = async (requiredIngredients = null) => {
    setStep('loading');
    setError(null);
    try {
      const result = await generateWeekMenu({
        availableIngredients: ingredients,
        fixedMeals,
        recurringMeals,
        mealSlots,
        foodHistory,
        savedRecipes,
        requiredIngredients,
        apiKey,
      });
      let proposed = enforceSlots(result, mealSlots);
      if (!includeWeekend) {
        proposed = { ...proposed, days: proposed.days.filter(d => !['Sáb', 'Dom'].includes(d.day)) };
      }
      setProposedWeek(proposed);
      setStep('preview');
      track('menu_generated', {
        method: requiredIngredients ? 'ingredient_review' : 'direct',
        has_fixed_meals: fixedMeals.length > 0,
        has_recurring_meals: recurringMeals.length > 0,
      });
    } catch (err) {
      setError(
        err.message === 'CALL_LIMIT_EXCEEDED' ? 'Has alcanzado el límite mensual de llamadas. Auméntalo en Perfil.' :
        err.message === 'FREE_QUOTA_EXCEEDED' ? 'Has agotado las 30 llamadas gratuitas. Añade tu API key en Perfil.' :
        err.message || 'Error generando el menú. Verifica la configuración de la API.'
      );
      setStep('form');
    }
  };

  const handleReviewIngredients = async () => {
    setStep('review_ingredients');
    setIngredientsLoading(true);
    setIngredientsError(null);
    try {
      const result = await suggestIngredients({ foodHistory, availableIngredients: ingredients, mealSlots, apiKey });
      setIngredientsList((result.ingredients || []).map(i => ({
        ...i,
        removed: false,
        customName: null,
        editing: false,
        altLoading: false,
      })));
    } catch (err) {
      setIngredientsError(err.message || 'Error generando la lista de ingredientes.');
    } finally {
      setIngredientsLoading(false);
    }
  };

  const toggleIngredientRemoved = (id) => {
    setIngredientsList(prev => prev.map(i => i.id === id ? { ...i, removed: !i.removed, editing: false } : i));
  };

  const setIngredientEditing = (id, val) => {
    setIngredientsList(prev => prev.map(i => i.id === id ? { ...i, editing: val } : i));
  };

  const setIngredientCustomName = (id, name) => {
    setIngredientsList(prev => prev.map(i => i.id === id ? { ...i, customName: name } : i));
  };

  const handleGetAlternative = async (id) => {
    const item = ingredientsList.find(i => i.id === id);
    if (!item) return;
    const existingInCategory = ingredientsList
      .filter(i => i.id !== id && i.category === item.category)
      .map(i => i.customName || i.name);
    setIngredientsList(prev => prev.map(i => i.id === id ? { ...i, altLoading: true } : i));
    try {
      const result = await suggestIngredientAlternative({
        ingredient: item.customName || item.name,
        category: item.category,
        existingInCategory,
        apiKey,
      });
      setIngredientsList(prev => prev.map(i => i.id === id ? { ...i, customName: result.alternative, editing: false, altLoading: false } : i));
    } catch {
      setIngredientsList(prev => prev.map(i => i.id === id ? { ...i, altLoading: false } : i));
    }
  };

  const handleGenerateFromIngredients = () => {
    const approved = ingredientsList.filter(i => !i.removed).map(i => i.customName || i.name);
    handleGenerateDirect(approved);
  };

  const handleRegenerateDay = async (dayName) => {
    setRegeneratingDay(dayName);
    try {
      const result = await regenerateDay({
        dayName,
        weekContext: proposedWeek.days,
        availableIngredients: ingredients,
        fixedMeals,
        apiKey,
      });
      setProposedWeek((prev) => ({
        ...prev,
        days: prev.days.map((d) => (d.day === dayName ? result : d)),
      }));
      track('day_regenerated', { day: dayName });
    } catch (err) {
      setError(err.message || 'Error regenerando el día');
    } finally {
      setRegeneratingDay(null);
    }
  };

  const handleUpdateMeal = (dayIndex, mealIndex, field, value) => {
    setProposedWeek((prev) => ({
      ...prev,
      days: prev.days.map((day, di) =>
        di !== dayIndex
          ? day
          : {
              ...day,
              meals: day.meals.map((meal, mi) =>
                mi !== mealIndex ? meal : { ...meal, [field]: value }
              ),
            }
      ),
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Sanitize: ensure no undefined fields (Firestore rejects them)
      const cleanDays = (proposedWeek.days || []).map(day => ({
        day: day.day,
        meals: (day.meals || []).map(meal => ({
          tipo: meal.tipo,
          baby: meal.baby ?? '',
          adult: meal.adult ?? '',
          tags: meal.tags ?? [],
          track: meal.track ?? null,
        })),
      }));
      await onSave(mondayDate, weekLabel, cleanDays);
      handleClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setStep('form');
    setIngredients('');
    setMondayDate(getThisMonday());
    setProposedWeek(null);
    setError(null);
    setFixedMeals([]);
    setShowFixedMeals(false);
    setNewFixed({ day: 'Lun', tipo: 'comida', text: '', anyDay: false });
    setRecurringMeals([]);
    setRecurringInput('');
    setMealSlots(DEFAULT_SLOTS);
    setIncludeWeekend(true);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        step === 'preview' ? 'Revisar menú propuesto' :
        step === 'review_ingredients' ? 'Revisar ingredientes' :
        step === 'choice' ? 'Generar menú' :
        'Nueva semana'
      }
      maxWidth="max-w-3xl"
    >
      {step === 'form' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Semana (selecciona el lunes)
            </label>
            <input
              type="date"
              value={mondayDate}
              onChange={(e) => {
                // Snap to Monday of the selected date
                const d = new Date(e.target.value + 'T12:00:00');
                const day = d.getDay();
                const diff = day === 0 ? -6 : 1 - day;
                d.setDate(d.getDate() + diff);
                setMondayDate(d.toISOString().slice(0, 10));
                setError(null);
              }}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-sm"
            />
            {weekLabel && (
              <p className="text-xs text-brand-700 font-medium mt-1">{weekLabel}</p>
            )}
            {isDuplicate && (
              <p className="text-xs text-red-600 mt-1">Ya existe un menú para esta semana.</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ¿Qué tienes en la nevera? (opcional)
            </label>
            <textarea
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder="Ej: pollo, zanahoria, arroz, huevos, lentejas..."
              rows={3}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-sm resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              La IA los priorizará cuanto antes (cada alimento para una comida), sin limitarse solo a ellos.
            </p>
          </div>

          {/* Franjas a generar */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Franjas a generar</label>
            <div className="space-y-2">
              {MEAL_TYPES.map(tipo => (
                <div key={tipo} className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer w-32">
                    <input
                      type="checkbox"
                      checked={mealSlots[tipo].enabled}
                      onChange={() => toggleSlot(tipo)}
                      className="w-4 h-4 rounded accent-brand-600"
                    />
                    <span className={`text-sm ${mealSlots[tipo].enabled ? 'text-gray-800' : 'text-gray-400'}`}>
                      {MEAL_LABELS[tipo]}
                    </span>
                  </label>
                  {mealSlots[tipo].enabled && SLOTS_WITH_SAME.includes(tipo) && (
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={mealSlots[tipo].sameEveryDay}
                        onChange={() => toggleSameEveryDay(tipo)}
                        className="w-3.5 h-3.5 rounded accent-brand-600"
                      />
                      <span className="text-xs text-gray-500">Misma todos los días</span>
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Incluir fin de semana */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeWeekend}
              onChange={e => setIncludeWeekend(e.target.checked)}
              className="w-4 h-4 rounded accent-brand-600"
            />
            <span className="text-sm text-gray-700">Incluir fin de semana (sáb y dom)</span>
          </label>

          {/* KPIs que intentará cumplir la IA */}
          {hasAiAccess && <KPIPreview kpiConfig={kpiConfig} mealSlots={mealSlots} includeWeekend={includeWeekend} />}

          {/* Fixed meals & recurring */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowFixedMeals(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
            >
              <span>
                📌 Fijar comidas
                {(fixedMeals.length + recurringMeals.length) > 0 && (
                  <span className="ml-1.5 text-xs bg-brand-600 text-white rounded-full px-1.5 py-0.5">
                    {fixedMeals.length + recurringMeals.length}
                  </span>
                )}
                <span className="text-gray-400 font-normal ml-1">(opcional)</span>
              </span>
              <svg className={`w-4 h-4 text-gray-400 transition-transform ${showFixedMeals ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showFixedMeals && (
              <div className="p-4 space-y-4">

                {/* Recurring meals (any day) */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1.5">Incluir esta semana <span className="font-normal text-gray-400">(sin día específico)</span></p>
                  <p className="text-xs text-gray-400 mb-2">La IA la colocará en el día y franja más adecuados.</p>
                  {usualMeals.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {(showAllUsualMeals ? usualMeals : usualMeals.slice(0, 3)).map(m => {
                        const alreadyAdded = recurringMeals.includes(m.name);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            disabled={alreadyAdded}
                            onClick={() => !alreadyAdded && setRecurringMeals(prev => [...prev, m.name])}
                            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                              alreadyAdded
                                ? 'bg-brand-100 text-brand-400 border-brand-200 cursor-default'
                                : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400 hover:text-brand-600'
                            }`}
                          >
                            ⭐ {m.name}
                          </button>
                        );
                      })}
                      {usualMeals.length > 3 && (
                        <button
                          type="button"
                          onClick={() => setShowAllUsualMeals(v => !v)}
                          className="text-xs px-2.5 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-brand-400 hover:text-brand-600 transition-colors"
                        >
                          {showAllUsualMeals ? 'Ver menos' : `+${usualMeals.length - 3} más…`}
                        </button>
                      )}
                    </div>
                  )}
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={recurringInput}
                      onChange={e => setRecurringInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addRecurring()}
                      placeholder="Ej: lentejas, salmón, tortitas..."
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                    />
                    <button
                      type="button"
                      onClick={addRecurring}
                      disabled={!recurringInput.trim()}
                      className="bg-brand-600 text-white rounded-lg px-3 py-2 text-xs font-medium hover:bg-brand-700 transition-colors disabled:opacity-40"
                    >
                      + Añadir
                    </button>
                  </div>
                  {recurringMeals.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {recurringMeals.map((m, i) => (
                        <span key={i} className="flex items-center gap-1 bg-brand-50 text-brand-700 border border-brand-200 rounded-full px-2.5 py-1 text-xs">
                          {m}
                          <button onClick={() => setRecurringMeals(prev => prev.filter((_, j) => j !== i))} className="hover:text-red-500 transition-colors">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-100" />

                {/* Fixed to a specific day */}
                <div>
                  <p className="text-xs font-semibold text-gray-600 mb-1.5">Fijar en día y franja concretos</p>
                  {fixedMeals.length > 0 && (
                    <div className="space-y-1.5 mb-2">
                      {fixedMeals.map((m, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-orange-50 rounded-lg px-3 py-2">
                          <span className="text-xs font-semibold text-orange-700 w-16 shrink-0">{m.day ?? 'Libre'}</span>
                          <span className="text-xs text-orange-600 w-16 shrink-0">{MEAL_LABELS[m.tipo]}</span>
                          <span className="text-xs text-gray-700 flex-1 truncate">{m.text}</span>
                          <button onClick={() => removeFixedMeal(idx)} className="text-gray-400 hover:text-red-500 transition-colors shrink-0">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  {usualMeals.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {usualMeals.map(m => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setNewFixed(p => ({ ...p, text: m.name }))}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                            newFixed.text === m.name
                              ? 'bg-orange-100 text-orange-700 border-orange-300'
                              : 'bg-white text-gray-600 border-gray-300 hover:border-orange-400 hover:text-orange-600'
                          }`}
                        >
                          ⭐ {m.name}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <select
                      value={newFixed.day}
                      onChange={e => setNewFixed(p => ({ ...p, day: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                    >
                      {DAYS.map(d => <option key={d}>{d}</option>)}
                    </select>
                    <select
                      value={newFixed.tipo}
                      onChange={e => setNewFixed(p => ({ ...p, tipo: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                    >
                      {MEAL_TYPES.map(t => <option key={t} value={t}>{MEAL_LABELS[t]}</option>)}
                    </select>
                    <input
                      type="text"
                      value={newFixed.text}
                      onChange={e => setNewFixed(p => ({ ...p, text: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && addFixedMeal()}
                      placeholder="Ej: pollo guisado"
                      className="flex-1 min-w-0 border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                    />
                    <button
                      type="button"
                      onClick={addFixedMeal}
                      disabled={!newFixed.text.trim()}
                      className="bg-orange-500 text-white rounded-lg px-3 py-2 text-xs font-medium hover:bg-orange-600 transition-colors disabled:opacity-40"
                    >
                      + Fijar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleClose}
              className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-3 font-medium hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleGenerateClick}
              disabled={isDuplicate || !hasAiAccess}
              title={!hasAiAccess ? 'Necesitas una API key o un código Friends & Family para usar la IA' : undefined}
              className="flex-1 bg-brand-600 text-white rounded-xl py-3 font-medium hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>✨</span>
              Generar con IA
            </button>
            {!hasAiAccess && (
              <p className="text-xs text-center text-gray-400 mt-1">
                Añade una API key o activa un código Friends &amp; Family en Perfil
              </p>
            )}
          </div>

          <button
            disabled={isDuplicate}
            onClick={() => {
              const activeDays = includeWeekend ? DAYS : DAYS.slice(0, 5);
              const emptyDaysData = activeDays.map(day => ({
                day,
                meals: MEAL_TYPES.map(tipo => ({ tipo, baby: '', adult: '', tags: [], track: null })),
              }));
              onSave(mondayDate, weekLabel, emptyDaysData);
              handleClose();
            }}
            className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors py-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            O crear semana vacía sin IA
          </button>
        </div>
      )}

      {/* Choice dialog */}
      {step === 'choice' && (
        <div className="py-6 space-y-4">
          <div className="text-center space-y-1">
            <p className="text-base font-semibold text-gray-800">¿Cómo quieres generar el menú?</p>
            <p className="text-sm text-gray-500">Puedes revisar los ingredientes antes o generar directamente.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={() => handleGenerateDirect()}
              className="flex flex-col items-center gap-2 p-5 border-2 border-gray-200 rounded-2xl hover:border-brand-400 hover:bg-brand-50 transition-colors text-left"
            >
              <span className="text-3xl">⚡</span>
              <div>
                <p className="font-semibold text-gray-800 text-sm">Generar directamente</p>
                <p className="text-xs text-gray-500 mt-0.5">Claude elige los ingredientes y crea el menú completo.</p>
              </div>
            </button>
            <button
              onClick={handleReviewIngredients}
              className="flex flex-col items-center gap-2 p-5 border-2 border-gray-200 rounded-2xl hover:border-brand-400 hover:bg-brand-50 transition-colors text-left"
            >
              <span className="text-3xl">🛒</span>
              <div>
                <p className="font-semibold text-gray-800 text-sm">Revisar ingredientes primero</p>
                <p className="text-xs text-gray-500 mt-0.5">Ve y edita la lista antes de generar. Elimina o sustituye lo que no tengas.</p>
              </div>
            </button>
          </div>
          <button onClick={() => setStep('form')} className="w-full text-sm text-gray-400 hover:text-gray-600 transition-colors pt-1">
            ← Volver
          </button>
        </div>
      )}

      {/* Ingredient review step */}
      {step === 'review_ingredients' && (
        <div className="space-y-4">
          {ingredientsLoading && (
            <div className="py-12 text-center">
              <LoadingSpinner size="lg" label="" />
              <p className="text-gray-700 font-medium mt-4">Generando lista de ingredientes...</p>
            </div>
          )}

          {ingredientsError && !ingredientsLoading && (
            <div className="py-8 text-center space-y-3">
              <p className="text-sm text-red-600">{ingredientsError}</p>
              <button onClick={handleReviewIngredients} className="text-sm text-brand-600 hover:text-brand-800 font-medium">
                Reintentar
              </button>
            </div>
          )}

          {!ingredientsLoading && !ingredientsError && ingredientsList.length > 0 && (
            <>
              <div>
                <p className="text-sm font-semibold text-gray-800">Ingredientes sugeridos</p>
                <p className="text-xs text-gray-500 mt-0.5">Elimina los que no quieras o sustitúyelos. Claude generará el menú con lo que apruebes.</p>
              </div>

              <div className="space-y-4 max-h-[50vh] overflow-y-auto pr-1">
                {Object.entries(CATEGORY_META).map(([cat, meta]) => {
                  const items = ingredientsList.filter(i => i.category === cat);
                  if (!items.length) return null;
                  return (
                    <div key={cat}>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                        {meta.emoji} {meta.label}
                      </p>
                      <div className="space-y-1.5">
                        {items.map(item => (
                          <div
                            key={item.id}
                            className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${
                              item.removed ? 'border-gray-100 bg-gray-50 opacity-50' : 'border-gray-200 bg-white'
                            }`}
                          >
                            {/* Remove/restore toggle */}
                            <button
                              onClick={() => toggleIngredientRemoved(item.id)}
                              title={item.removed ? 'Restaurar' : 'Eliminar'}
                              className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                                item.removed
                                  ? 'bg-gray-200 text-gray-500 hover:bg-brand-100 hover:text-brand-600'
                                  : 'bg-red-100 text-red-500 hover:bg-red-200'
                              }`}
                            >
                              {item.removed ? '↩' : '×'}
                            </button>

                            {/* Name — inline edit or label */}
                            {item.editing ? (
                              <input
                                autoFocus
                                value={item.customName ?? item.name}
                                onChange={e => setIngredientCustomName(item.id, e.target.value)}
                                onBlur={() => setIngredientEditing(item.id, false)}
                                onKeyDown={e => e.key === 'Enter' && setIngredientEditing(item.id, false)}
                                className="flex-1 text-sm border-b border-brand-400 outline-none bg-transparent py-0.5"
                              />
                            ) : (
                              <span
                                className={`flex-1 text-sm ${item.removed ? 'line-through text-gray-400' : 'text-gray-800'}`}
                                title={item.reason}
                              >
                                {item.customName || item.name}
                                {item.customName && item.customName !== item.name && (
                                  <span className="text-xs text-gray-400 ml-1">(era: {item.name})</span>
                                )}
                              </span>
                            )}

                            {!item.removed && (
                              <>
                                {/* Edit button */}
                                <button
                                  onClick={() => setIngredientEditing(item.id, !item.editing)}
                                  title="Editar nombre"
                                  className="shrink-0 text-gray-300 hover:text-brand-500 transition-colors"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>

                                {/* AI alternative button */}
                                <button
                                  onClick={() => handleGetAlternative(item.id)}
                                  disabled={item.altLoading}
                                  title="Sugerir alternativa con IA"
                                  className="shrink-0 text-gray-300 hover:text-brand-500 transition-colors disabled:opacity-40"
                                >
                                  {item.altLoading
                                    ? <div className="w-3.5 h-3.5 border border-gray-300 border-t-brand-500 rounded-full animate-spin" />
                                    : (
                                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                      </svg>
                                    )
                                  }
                                </button>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-gray-100 pt-3 space-y-2">
                <p className="text-xs text-gray-400">
                  {ingredientsList.filter(i => !i.removed).length} ingredientes seleccionados de {ingredientsList.length}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStep('choice')}
                    className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
                  >
                    ← Volver
                  </button>
                  <button
                    onClick={handleGenerateFromIngredients}
                    disabled={ingredientsList.filter(i => !i.removed).length === 0}
                    className="flex-1 bg-brand-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
                  >
                    ✨ Generar menú
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {step === 'loading' && (
        <div className="py-8 text-center">
          <MenuLoadingAnimation />
          <p className="text-gray-700 font-semibold -mt-2">Generando tu menú semanal...</p>
          <p className="text-gray-400 text-sm mt-1">Claude está creando un plan nutritivo completo</p>
        </div>
      )}

      {step === 'preview' && proposedWeek && (
        <div className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <p className="text-sm text-gray-500">
            Revisa y edita el menú antes de guardarlo. Puedes regenerar días individuales si no te convencen.
          </p>

          <div className="space-y-3">
            {proposedWeek.days && proposedWeek.days.map((dayData, dayIndex) => (
              <div key={dayData.day} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5">
                  <span className="font-semibold text-gray-800">{dayData.day}</span>
                  <button
                    onClick={() => handleRegenerateDay(dayData.day)}
                    disabled={regeneratingDay === dayData.day}
                    className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 disabled:opacity-50 font-medium"
                  >
                    {regeneratingDay === dayData.day ? (
                      <div className="w-3 h-3 border border-brand-300 border-t-brand-600 rounded-full animate-spin" />
                    ) : (
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    )}
                    Regenerar día
                  </button>
                </div>
                <div className="divide-y divide-gray-100">
                  {dayData.meals && dayData.meals.map((meal, mealIndex) => (
                    <div key={meal.tipo} className="px-4 py-2.5">
                      <div className="flex items-start gap-3">
                        <span className="text-xs font-medium text-gray-400 w-16 shrink-0 pt-0.5">
                          {MEAL_LABELS[meal.tipo]}
                        </span>
                        <div className="flex-1 space-y-1">
                          <input
                            type="text"
                            value={meal.baby || ''}
                            onChange={(e) => handleUpdateMeal(dayIndex, mealIndex, 'baby', e.target.value)}
                            placeholder="Bebé..."
                            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
                          />
                          <input
                            type="text"
                            value={meal.adult || ''}
                            onChange={(e) => handleUpdateMeal(dayIndex, mealIndex, 'adult', e.target.value)}
                            placeholder="Adulto..."
                            className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 text-gray-500 focus:outline-none focus:ring-1 focus:ring-brand-400"
                          />
                          {meal.tags && meal.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-0.5">
                              {meal.tags.map((tag) => (
                                <span key={tag} className="text-xs bg-brand-50 text-brand-700 rounded-full px-2 py-0.5">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-3 pt-2 sticky bottom-0 bg-white pb-1">
            <button
              onClick={() => setStep('form')}
              className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-3 font-medium hover:bg-gray-50 transition-colors"
            >
              ← Volver
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-brand-600 text-white rounded-xl py-3 font-medium hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {saving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {saving ? 'Guardando...' : '💾 Guardar semana'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── KPI Preview ─────────────────────────────────────────────────────────────

function KPIPreview({ kpiConfig, mealSlots, includeWeekend }) {
  const config = {
    active: kpiConfig?.active ?? DEFAULT_KPI_CONFIG.active,
    targets: kpiConfig?.targets ?? {},
    custom: kpiConfig?.custom ?? [],
  };

  const fakeWeek = simulateWeekDoc(mealSlots, includeWeekend);
  const { ironTarget, fishTarget, veggieTarget, legumeTarget } = computeAdaptiveTargets(fakeWeek, config.targets);

  const activeCatalog = KPI_CATALOG.filter(k => config.active.includes(k.id));
  const activeCustom = config.custom.filter(k => config.active.includes(k.id));

  if (activeCatalog.length === 0 && activeCustom.length === 0) return null;

  function getTarget(id) {
    if (id === 'iron') return ironTarget;
    if (id === 'fish') return fishTarget;
    if (id === 'veggie') return veggieTarget;
    if (id === 'legume') return legumeTarget;
    if (id === 'fruit') return config.targets.fruit ?? 5;
    if (id === 'protein_rotation') return null; // no aplica como target numérico
    return null;
  }

  function getDefaultTarget(id) {
    const kpi = KPI_CATALOG.find(k => k.id === id);
    return config.targets[id] ?? kpi?.defaultTarget ?? null;
  }

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">KPIs que intentará cumplir la IA</p>
      <div className="space-y-1.5">
        {activeCatalog.map(k => {
          if (k.id === 'protein_rotation') {
            return (
              <div key={k.id} className="flex items-center gap-2">
                <span className="text-sm">{k.icon}</span>
                <span className="text-xs text-gray-600">{k.label}</span>
                <span className="text-xs text-gray-400">sin repetir &gt;2 días seguidos</span>
              </div>
            );
          }

          const target = getTarget(k.id);
          const defaultTarget = getDefaultTarget(k.id);
          const notApplicable = target === null;
          const isAdapted = !notApplicable && target !== defaultTarget;

          return (
            <div key={k.id} className={`flex items-center gap-2 ${notApplicable ? 'opacity-40' : ''}`}>
              <span className="text-sm">{k.icon}</span>
              <span className={`text-xs ${notApplicable ? 'text-gray-400' : 'text-gray-700'}`}>{k.label}</span>
              {notApplicable ? (
                <span className="text-xs text-gray-400 italic">No aplica con estas franjas</span>
              ) : (
                <span className="text-xs text-brand-700 font-medium">
                  ≥{target} {k.unit}
                  {isAdapted && <span className="text-gray-400 font-normal ml-1">(ajustado)</span>}
                </span>
              )}
            </div>
          );
        })}

        {activeCustom.map(k => {
          const target = config.targets[k.id] ?? k.target ?? 3;
          return (
            <div key={k.id} className="flex items-center gap-2">
              <span className="text-sm">⭐</span>
              <span className="text-xs text-gray-700">{k.name}</span>
              <span className="text-xs text-brand-700 font-medium">≥{target} días</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
