import { useState, useEffect, useRef } from 'react';
import Modal from '../ui/Modal';
import LoadingSpinner from '../ui/LoadingSpinner';
import MenuLoadingAnimation from '../ui/MenuLoadingAnimation';
import { generateWeekMenu, suggestIngredients, suggestIngredientAlternative } from '../../lib/claude';
import { track } from '../../lib/analytics';
import { computeAdaptiveTargets, KPI_CATALOG, DEFAULT_KPI_CONFIG } from '../../lib/kpis';
import { Beef, Fish, Bean, Leaf, Cherry, Wheat, GlassWater, Sparkles, Zap, ShoppingCart, Star, Sunrise, Apple, Utensils, Coffee, Moon } from 'lucide-react';

const CATEGORY_META = {
  proteína: { label: 'Proteínas', Icon: Beef },
  pescado:  { label: 'Pescado',   Icon: Fish },
  legumbre: { label: 'Legumbres', Icon: Bean },
  verdura:  { label: 'Verduras',  Icon: Leaf },
  fruta:    { label: 'Frutas',    Icon: Cherry },
  cereal:   { label: 'Cereales',  Icon: Wheat },
  lácteo:   { label: 'Lácteos',   Icon: GlassWater },
  huevo:    { label: 'Huevos',    Icon: null },
};

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MEAL_TYPES = ['desayuno', 'snack', 'comida', 'merienda', 'cena'];

const MEAL_ICONS = {
  desayuno: Sunrise,
  snack: Apple,
  comida: Utensils,
  merienda: Coffee,
  cena: Moon,
};

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

const KPI_GENERATION_META = {
  iron:   { icon: '🩸', label: 'Hierro',         unit: 'días' },
  fish:   { icon: '🐟', label: 'Pescado graso',   unit: 'días' },
  veggie: { icon: '🥦', label: 'Verduras dist.',  unit: 'tipos' },
  legume: { icon: '🟢', label: 'Legumbres',       unit: 'días' },
  fruit:  { icon: '🍎', label: 'Fruta',           unit: 'días' },
};

const DEFAULT_KPI_IDS = ['iron', 'fish', 'veggie', 'legume'];

const SEASONS = {
  primavera: { label: 'Primavera', emoji: '🌸', months: [3, 4, 5], ingredients: 'espárragos, guisantes, fresas, alcachofas, habas, espinacas, rábanos, cerezas' },
  verano:    { label: 'Verano',    emoji: '☀️',  months: [6, 7, 8], ingredients: 'tomate, pimiento, calabacín, berenjena, pepino, sandía, melocotón, maíz, judías verdes' },
  otoño:     { label: 'Otoño',     emoji: '🍂',  months: [9, 10, 11], ingredients: 'calabaza, setas, uvas, peras, manzanas, boniato, coles, brócoli, granada' },
  invierno:  { label: 'Invierno',  emoji: '❄️',  months: [12, 1, 2], ingredients: 'naranja, mandarina, coliflor, puerro, col, acelga, kiwi, cardo, chirivía' },
};

function getSeason(dateStr) {
  if (!dateStr) return null;
  const month = new Date(dateStr + 'T12:00:00').getMonth() + 1; // 1-12
  return Object.entries(SEASONS).find(([, s]) => s.months.includes(month))?.[0] ?? null;
}

function initKpiOverrides(kpiConfig) {
  const config = kpiConfig || DEFAULT_KPI_CONFIG;
  const overrides = {};
  // Always include the 4 default KPIs
  for (const id of DEFAULT_KPI_IDS) {
    const catalog = KPI_CATALOG.find(k => k.id === id);
    overrides[id] = {
      active: config.active.includes(id),
      target: config.targets[id] ?? catalog?.defaultTarget ?? 3,
    };
  }
  // Add any other active KPIs (custom, fruit, etc.) excluding protein_rotation
  for (const id of config.active) {
    if (id === 'protein_rotation' || DEFAULT_KPI_IDS.includes(id)) continue;
    const catalog = KPI_CATALOG.find(k => k.id === id);
    const custom = (config.custom || []).find(k => k.id === id);
    overrides[id] = {
      active: true,
      target: config.targets[id] ?? catalog?.defaultTarget ?? custom?.target ?? 3,
    };
  }
  return overrides;
}

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

export default function NewWeekModal({ isOpen, onClose, onSave, existingWeekIds = [], pastWeeks = [], foodHistory, savedRecipes, usualMeals = [], apiKey, hasAiAccess, kpiConfig, onUpdateKpiConfig, babyProfile = null }) {
  const [step, setStep] = useState('form');
  const [copyFromWeekId, setCopyFromWeekId] = useState('');
  const [ingredientPills, setIngredientPills] = useState([]);
  const [ingredientInput, setIngredientInput] = useState('');
  const [mondayDate, setMondayDate] = useState(getThisMonday());
  const [error, setError] = useState(null);
  const ingredientInputRef = useRef(null);
  const [showFixedMeals, setShowFixedMeals] = useState(false);
  const [showAllUsualMeals, setShowAllUsualMeals] = useState(false);
  const [fixedMeals, setFixedMeals] = useState([]);      // [{day, tipo, text}]
  const [newFixed, setNewFixed] = useState({ day: 'Lun', tipo: 'comida', text: '', anyDay: true });
  const [recurringMeals, setRecurringMeals] = useState([]); // string[]
  const [mealSlots, setMealSlots] = useState(DEFAULT_SLOTS);
  const [includeWeekend, setIncludeWeekend] = useState(true);
  const [kpiOverrides, setKpiOverrides] = useState(() => initKpiOverrides(kpiConfig));
  useEffect(() => { setKpiOverrides(initKpiOverrides(kpiConfig)); }, [kpiConfig]);

  // Ingredient review state
  const [ingredientsList, setIngredientsList] = useState([]); // [{id, name, category, reason, removed, vetoed, vetoReason, customName, editing, altLoading}]
  const [ingredientsLoading, setIngredientsLoading] = useState(false);
  const [ingredientsError, setIngredientsError] = useState(null);
  const [newIngredientInput, setNewIngredientInput] = useState('');
  const [vetoPickerId, setVetoPickerId] = useState(null); // id of ingredient showing veto reason picker

  const weekLabel = mondayToLabel(mondayDate);
  const isDuplicate = existingWeekIds.includes(mondayDate);

  const addFixedMeal = () => {
    if (!newFixed.text.trim()) return;
    if (newFixed.anyDay) {
      setRecurringMeals(prev => [...prev, newFixed.text.trim()]);
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

  const updateKpiOverride = (id, field, value) => {
    setKpiOverrides(prev => {
      const updated = { ...prev, [id]: { ...prev[id], [field]: value } };
      if (onUpdateKpiConfig) {
        const config = kpiConfig || DEFAULT_KPI_CONFIG;
        let newActive = [...config.active];
        const newTargets = { ...config.targets };
        if (field === 'active') {
          if (value && !newActive.includes(id)) newActive.push(id);
          else if (!value) newActive = newActive.filter(a => a !== id);
        } else if (field === 'target') {
          newTargets[id] = value;
        }
        onUpdateKpiConfig({ ...config, active: newActive, targets: newTargets });
      }
      return updated;
    });
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

  const handleGenerateDirect = async (requiredIngredients = null, vetoedIngredients = null) => {
    setStep('loading');
    setError(null);
    try {
      const result = await generateWeekMenu({
        availableIngredients: ingredientPills.join(', '),
        fixedMeals,
        recurringMeals,
        mealSlots,
        foodHistory,
        savedRecipes,
        requiredIngredients,
        kpiOverrides,
        season: getSeason(mondayDate),
        vetoedIngredients,
        babyProfile,
        apiKey,
      });
      let proposed = enforceSlots(result, mealSlots);
      if (!includeWeekend) {
        proposed = { ...proposed, days: proposed.days.filter(d => !['Sáb', 'Dom'].includes(d.day)) };
      }
      const cleanDays = (proposed.days || []).map(day => ({
        day: day.day,
        meals: (day.meals || []).map(meal => ({
          tipo: meal.tipo,
          baby: meal.baby ?? '',
          adult: meal.adult ?? '',
          tags: meal.tags ?? [],
          track: meal.track ?? null,
        })),
      }));
      track('menu_generated', {
        method: requiredIngredients ? 'ingredient_review' : 'direct',
        has_fixed_meals: fixedMeals.length > 0,
        has_recurring_meals: recurringMeals.length > 0,
      });
      await onSave(mondayDate, weekLabel, cleanDays);
      handleClose();
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
      const result = await suggestIngredients({ foodHistory, availableIngredients: ingredientPills.join(', '), mealSlots, apiKey });
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

  const handleAddIngredient = () => {
    const name = newIngredientInput.trim();
    if (!name) return;
    setIngredientsList(prev => [...prev, {
      id: `manual_${Date.now()}`,
      name,
      category: 'manual',
      reason: 'Añadido manualmente',
      removed: false,
      customName: null,
      editing: false,
      altLoading: false,
    }]);
    setNewIngredientInput('');
  };

  const toggleIngredientRemoved = (id) => {
    setIngredientsList(prev => prev.map(i => i.id === id ? { ...i, removed: !i.removed, editing: false } : i));
  };

  const handleVeto = (id, vetoReason) => {
    setIngredientsList(prev => prev.map(i => i.id === id ? { ...i, vetoed: true, vetoReason, removed: false, editing: false } : i));
    setVetoPickerId(null);
  };

  const handleUnveto = (id) => {
    setIngredientsList(prev => prev.map(i => i.id === id ? { ...i, vetoed: false, vetoReason: null } : i));
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
    const approved = ingredientsList.filter(i => !i.removed && !i.vetoed).map(i => i.customName || i.name);
    const vetoed = ingredientsList.filter(i => i.vetoed).map(i => i.customName || i.name);
    handleGenerateDirect(approved, vetoed);
  };


  const handleCopyWeek = () => {
    const sourceId = copyFromWeekId || pastWeeks[0]?.id;
    const source = pastWeeks.find(w => w.id === sourceId);
    if (!source) return;
    const cleanDays = (source.days || []).map(day => ({
      day: day.day,
      meals: (day.meals || []).map(meal => ({
        tipo: meal.tipo,
        baby: meal.baby ?? '',
        adult: meal.adult ?? '',
        tags: meal.tags ?? [],
        track: null,
      })),
    }));
    onSave(mondayDate, weekLabel, cleanDays);
    handleClose();
  };

  const handleClose = () => {
    setStep('form');
    setIngredientPills([]);
    setIngredientInput('');
    setMondayDate(getThisMonday());
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
            {mondayDate && (() => {
              const seasonKey = getSeason(mondayDate);
              const season = SEASONS[seasonKey];
              if (!season) return null;
              return (
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="inline-flex items-center gap-1 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded px-2.5 py-0.5">
                    {season.emoji} {season.label}
                  </span>
                  <span className="text-xs text-gray-400">La IA priorizará ingredientes de temporada</span>
                </div>
              );
            })()}
            {isDuplicate && (
              <p className="text-xs text-red-600 mt-1">Ya existe un menú para esta semana.</p>
            )}
            <label className="flex items-center gap-2 cursor-pointer mt-2">
              <input
                type="checkbox"
                checked={includeWeekend}
                onChange={e => setIncludeWeekend(e.target.checked)}
                className="w-4 h-4 rounded accent-brand-600"
              />
              <span className="text-sm text-gray-700">Incluir fin de semana (sáb y dom)</span>
            </label>

            {/* Franjas a generar */}
            <div className="mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">Franjas a generar</label>
              <div className="space-y-2">
                {MEAL_TYPES.map(tipo => (
                  <div key={tipo} className="flex items-center gap-3 flex-wrap">
                    <label className="flex items-center gap-2 cursor-pointer w-36">
                      <input
                        type="checkbox"
                        checked={mealSlots[tipo].enabled}
                        onChange={() => toggleSlot(tipo)}
                        className="w-4 h-4 rounded accent-brand-600"
                      />
                      {(() => { const Icon = MEAL_ICONS[tipo]; return Icon ? <Icon className={`w-4 h-4 shrink-0 ${mealSlots[tipo].enabled ? 'text-brand-600' : 'text-gray-300'}`} /> : null; })()}
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
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ¿Qué tienes en la nevera? <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <div
              className="min-h-[44px] flex flex-wrap gap-1.5 items-center border border-gray-300 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-brand-400 focus-within:border-transparent cursor-text"
              onClick={() => ingredientInputRef.current?.focus()}
            >
              {ingredientPills.map((pill, i) => (
                <span key={i} className="flex items-center gap-1 bg-brand-50 text-brand-700 border border-brand-200 rounded px-2 py-0.5 text-sm shrink-0">
                  {pill}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setIngredientPills(prev => prev.filter((_, j) => j !== i)); }}
                    className="hover:text-red-500 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
              <input
                ref={ingredientInputRef}
                type="text"
                value={ingredientInput}
                onChange={e => {
                  const val = e.target.value;
                  if (val.includes(',')) {
                    const parts = val.split(',');
                    const newPills = parts.slice(0, -1).map(p => p.trim()).filter(Boolean);
                    if (newPills.length > 0) setIngredientPills(prev => [...prev, ...newPills]);
                    setIngredientInput(parts[parts.length - 1]);
                  } else {
                    setIngredientInput(val);
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Backspace' && !ingredientInput && ingredientPills.length > 0) {
                    setIngredientPills(prev => prev.slice(0, -1));
                  }
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const pill = ingredientInput.trim();
                    if (pill) { setIngredientPills(prev => [...prev, pill]); setIngredientInput(''); }
                  }
                }}
                placeholder={ingredientPills.length === 0 ? 'Ej: pollo, zanahoria, arroz, huevos...' : ''}
                className="flex-1 min-w-[100px] outline-none text-sm bg-transparent py-0.5"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              La IA los priorizará cuanto antes (cada alimento para una comida), sin limitarse solo a ellos.
            </p>
          </div>

          {/* KPIs que intentará cumplir la IA */}
          {hasAiAccess && <KPIPreview kpiConfig={kpiConfig} mealSlots={mealSlots} includeWeekend={includeWeekend} kpiOverrides={kpiOverrides} onUpdate={updateKpiOverride} />}

          {/* Platos concretos */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowFixedMeals(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-sm font-medium text-gray-700"
            >
              <span>
                ¿Quieres incluir algún plato concreto?
                {(fixedMeals.length + recurringMeals.length) > 0 && (
                  <span className="ml-1.5 text-xs bg-brand-600 text-white rounded px-1.5 py-0.5">
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
              <div className="p-4 space-y-3">
                <p className="text-xs text-gray-400">La IA lo colocará donde encaje mejor, o en el día y franja que indiques.</p>

                {/* Quick-add from usual meals */}
                {usualMeals.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {(showAllUsualMeals ? usualMeals : usualMeals.slice(0, 4)).map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setNewFixed(p => ({ ...p, text: m.name }))}
                        className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                          newFixed.text === m.name
                            ? 'bg-brand-100 text-brand-700 border-brand-300'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400 hover:text-brand-600'
                        }`}
                      >
                        <Star className="w-3 h-3 inline mr-0.5" />{m.name}
                      </button>
                    ))}
                    {usualMeals.length > 4 && (
                      <button
                        type="button"
                        onClick={() => setShowAllUsualMeals(v => !v)}
                        className="text-xs px-2.5 py-1 rounded border border-dashed border-gray-300 text-gray-400 hover:border-brand-400 hover:text-brand-600 transition-colors"
                      >
                        {showAllUsualMeals ? 'Ver menos' : `+${usualMeals.length - 4} más…`}
                      </button>
                    )}
                  </div>
                )}

                {/* Unified form */}
                <div className="flex gap-2 flex-wrap">
                  <input
                    type="text"
                    value={newFixed.text}
                    onChange={e => setNewFixed(p => ({ ...p, text: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addFixedMeal()}
                    placeholder="Ej: lentejas, salmón al horno, tortitas..."
                    className="flex-1 min-w-[140px] border border-gray-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                  />
                  <select
                    value={newFixed.anyDay ? 'any' : newFixed.day}
                    onChange={e => {
                      if (e.target.value === 'any') setNewFixed(p => ({ ...p, anyDay: true }));
                      else setNewFixed(p => ({ ...p, anyDay: false, day: e.target.value }));
                    }}
                    className="border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                  >
                    <option value="any">Cualquier día</option>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  {!newFixed.anyDay && (
                    <select
                      value={newFixed.tipo}
                      onChange={e => setNewFixed(p => ({ ...p, tipo: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                    >
                      {MEAL_TYPES.map(t => <option key={t} value={t}>{MEAL_LABELS[t]}</option>)}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={addFixedMeal}
                    disabled={!newFixed.text.trim()}
                    className="bg-brand-600 text-white rounded-lg px-3 py-2 text-xs font-medium hover:bg-brand-700 transition-colors disabled:opacity-40"
                  >
                    + Añadir
                  </button>
                </div>

                {/* Combined list */}
                {(recurringMeals.length > 0 || fixedMeals.length > 0) && (
                  <div className="flex flex-wrap gap-1.5">
                    {recurringMeals.map((m, i) => (
                      <span key={`r-${i}`} className="flex items-center gap-1 bg-brand-50 text-brand-700 border border-brand-200 rounded px-2.5 py-1 text-xs">
                        {m}
                        <button onClick={() => setRecurringMeals(prev => prev.filter((_, j) => j !== i))} className="hover:text-red-500 transition-colors ml-0.5">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </span>
                    ))}
                    {fixedMeals.map((m, idx) => (
                      <span key={`f-${idx}`} className="flex items-center gap-1 bg-orange-50 text-orange-700 border border-orange-200 rounded px-2.5 py-1 text-xs">
                        {m.text}
                        <span className="text-orange-400">· {m.day} {MEAL_LABELS[m.tipo]}</span>
                        <button onClick={() => removeFixedMeal(idx)} className="hover:text-red-500 transition-colors ml-0.5">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </span>
                    ))}
                  </div>
                )}
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
              <Sparkles className="w-4 h-4" />
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

          {pastWeeks.length > 0 && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-sm text-gray-400 shrink-0">O copiar</span>
              <select
                value={copyFromWeekId || pastWeeks[0]?.id}
                onChange={e => setCopyFromWeekId(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-400 bg-white"
              >
                {pastWeeks.map(w => (
                  <option key={w.id} value={w.id}>{w.label}</option>
                ))}
              </select>
              <button
                disabled={isDuplicate}
                onClick={handleCopyWeek}
                className="shrink-0 text-sm text-brand-600 hover:text-brand-800 font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Copiar →
              </button>
            </div>
          )}
        </div>
      )}

      {/* Choice dialog */}
      {step === 'choice' && (
        <div className="py-4 space-y-4">
          <div className="text-center space-y-1">
            <p className="text-base font-semibold text-gray-800">¿Cómo quieres generar el menú?</p>
            <p className="text-sm text-gray-500">Puedes revisar los ingredientes antes o generar directamente.</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              onClick={() => handleGenerateDirect()}
              className="flex flex-col items-center gap-2 p-5 border-2 border-gray-200 rounded-2xl hover:border-brand-400 hover:bg-brand-50 transition-colors text-left"
            >
              <Zap className="w-8 h-8 text-brand-500" />
              <div>
                <p className="font-semibold text-gray-800 text-sm">Generar directamente</p>
                <p className="text-xs text-gray-500 mt-0.5">Claude elige los ingredientes y crea el menú completo.</p>
              </div>
            </button>
            <button
              onClick={handleReviewIngredients}
              className="flex flex-col items-center gap-2 p-5 border-2 border-gray-200 rounded-2xl hover:border-brand-400 hover:bg-brand-50 transition-colors text-left"
            >
              <ShoppingCart className="w-8 h-8 text-brand-500" />
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
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                        {meta.Icon && <meta.Icon className="w-3.5 h-3.5" />} {meta.label}
                      </p>
                      <div className="space-y-1.5">
                        {items.map(item => (
                          <div key={item.id}>
                            <div
                              className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-colors ${
                                item.vetoed ? 'border-red-200 bg-red-50' :
                                item.removed ? 'border-gray-100 bg-gray-50 opacity-50' :
                                'border-gray-200 bg-white'
                              }`}
                            >
                              {/* Remove/restore toggle */}
                              {!item.vetoed && (
                                <button
                                  onClick={() => toggleIngredientRemoved(item.id)}
                                  title={item.removed ? 'Restaurar' : 'Eliminar'}
                                  className={`shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs font-bold transition-colors ${
                                    item.removed
                                      ? 'bg-gray-200 text-gray-500 hover:bg-brand-100 hover:text-brand-600'
                                      : 'bg-red-100 text-red-500 hover:bg-red-200'
                                  }`}
                                >
                                  {item.removed ? '↩' : '×'}
                                </button>
                              )}
                              {item.vetoed && (
                                <button
                                  onClick={() => handleUnveto(item.id)}
                                  title="Quitar veto"
                                  className="shrink-0 w-5 h-5 rounded flex items-center justify-center text-xs font-bold bg-red-200 text-red-600 hover:bg-gray-200 hover:text-gray-500 transition-colors"
                                >
                                  ↩
                                </button>
                              )}

                              {/* Name */}
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
                                  className={`flex-1 text-sm ${item.removed ? 'line-through text-gray-400' : item.vetoed ? 'text-red-700 line-through' : 'text-gray-800'}`}
                                  title={item.reason}
                                >
                                  {item.customName || item.name}
                                  {item.customName && item.customName !== item.name && (
                                    <span className="text-xs text-gray-400 ml-1">(era: {item.name})</span>
                                  )}
                                  {item.vetoed && item.vetoReason && (
                                    <span className="text-xs text-red-400 ml-1.5">· {item.vetoReason}</span>
                                  )}
                                </span>
                              )}

                              {!item.removed && !item.vetoed && (
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

                                  {/* Veto button */}
                                  <button
                                    onClick={() => setVetoPickerId(v => v === item.id ? null : item.id)}
                                    title="Vetar — excluir de la generación"
                                    className="shrink-0 text-gray-300 hover:text-red-500 transition-colors text-sm leading-none"
                                  >
                                    🚫
                                  </button>
                                </>
                              )}
                            </div>

                            {/* Veto reason picker */}
                            {vetoPickerId === item.id && (
                              <div className="ml-7 mt-1 mb-1 flex flex-wrap gap-1.5">
                                {['No le gusta', 'Alergia', 'Fuera de temporada', 'No tengo'].map(reason => (
                                  <button
                                    key={reason}
                                    onClick={() => handleVeto(item.id, reason)}
                                    className="text-xs px-2.5 py-1 rounded border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
                                  >
                                    {reason}
                                  </button>
                                ))}
                                <button
                                  onClick={() => setVetoPickerId(null)}
                                  className="text-xs px-2 py-1 text-gray-400 hover:text-gray-600 transition-colors"
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="border-t border-gray-100 pt-3 space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newIngredientInput}
                    onChange={e => setNewIngredientInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddIngredient()}
                    placeholder="Añadir ingrediente..."
                    className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
                  />
                  <button
                    onClick={handleAddIngredient}
                    disabled={!newIngredientInput.trim()}
                    className="text-sm px-3 py-1.5 bg-brand-50 text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-100 transition-colors disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                <p className="text-xs text-gray-400">
                  {ingredientsList.filter(i => !i.removed && !i.vetoed).length} ingredientes seleccionados
                  {ingredientsList.filter(i => i.vetoed).length > 0 && (
                    <span className="text-red-400 ml-1">· {ingredientsList.filter(i => i.vetoed).length} vetados</span>
                  )}
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
                    disabled={ingredientsList.filter(i => !i.removed && !i.vetoed).length === 0}
                    className="flex-1 bg-brand-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
                  >
                    <span className="flex items-center gap-1.5"><Sparkles className="w-4 h-4" /> Generar menú</span>
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

    </Modal>
  );
}

// ─── KPI Preview (editable) ──────────────────────────────────────────────────

function KPIPreview({ kpiConfig, mealSlots, includeWeekend, kpiOverrides, onUpdate }) {
  const config = {
    active: kpiConfig?.active ?? DEFAULT_KPI_CONFIG.active,
    targets: kpiConfig?.targets ?? {},
    custom: kpiConfig?.custom ?? [],
  };

  const fakeWeek = simulateWeekDoc(mealSlots, includeWeekend);
  const adaptive = computeAdaptiveTargets(fakeWeek, config.targets);

  const entries = Object.entries(kpiOverrides || {});
  if (entries.length === 0) return null;

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
      <p className="text-sm font-medium text-gray-700">Objetivos nutricionales de la semana</p>
      <div className="space-y-3">
        {entries.map(([id, override]) => {
          const catalogKpi = KPI_CATALOG.find(k => k.id === id);
          const customKpi = config.custom.find(k => k.id === id);
          const icon = catalogKpi?.icon ?? '⭐';
          const label = catalogKpi?.label ?? customKpi?.name ?? id;
          const unit = catalogKpi?.unit ?? 'días';
          const adaptiveTarget = id === 'iron' ? adaptive.ironTarget
            : id === 'fish' ? adaptive.fishTarget
            : null;
          const notApplicable = adaptiveTarget === null && (id === 'iron' || id === 'fish');
          const wasAdapted = adaptiveTarget !== null && adaptiveTarget < override.target;

          return (
            <div key={id} className={`flex items-center gap-2 ${notApplicable ? 'opacity-40' : ''}`}>
              <input
                type="checkbox"
                checked={override.active && !notApplicable}
                disabled={notApplicable}
                onChange={e => onUpdate(id, 'active', e.target.checked)}
                className="accent-brand-600 shrink-0"
              />
              <span className="text-sm flex-1">{label}</span>
              <input
                type="number"
                min={1}
                max={7}
                value={override.target}
                disabled={!override.active || notApplicable}
                onChange={e => {
                  const val = e.target.value;
                  if (val === '' || val === '0') return;
                  onUpdate(id, 'target', Math.min(7, Math.max(1, Number(val))));
                }}
                className="w-12 text-sm text-center border border-gray-200 rounded-lg px-1 py-0.5 bg-white focus:outline-none focus:ring-1 focus:ring-brand-400 disabled:opacity-40"
              />
              <span className="text-xs text-gray-400 w-16 shrink-0">
                {notApplicable ? 'No aplica' : wasAdapted ? `≥${adaptiveTarget} ajust.` : unit}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
