import { useState, useEffect, useRef } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { evaluateDay, suggestDinner, swapDinnerIngredient } from '../../lib/claude';

const MEAL_TYPES = [
  { id: 'desayuno', label: 'Desayuno', emoji: '☀️' },
  { id: 'snack', label: 'Snack AM', emoji: '🍎' },
  { id: 'comida', label: 'Comida', emoji: '🍽️' },
  { id: 'merienda', label: 'Merienda', emoji: '🍪' },
  { id: 'cena', label: 'Cena', emoji: '🌙' },
];

const DINNER_MEALS = MEAL_TYPES.filter(m => m.id !== 'cena');

const WEEKLY_OPTIONS = [
  { value: 0, label: '0' },
  { value: 1, label: '1' },
  { value: 2, label: '2' },
  { value: 3, label: '3+' },
];

// ─── Evaluate result ──────────────────────────────────────────────────────────

function EvaluateResult({ data }) {
  const hasDaily   = data.missing_daily?.length > 0;
  const hasWeekly  = data.missing_weekly?.length > 0;
  const allGood    = !hasDaily && !hasWeekly;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
      <p className="text-sm text-gray-800 font-medium">{data.overall}</p>

      {data.positives?.length > 0 && (
        <div className="space-y-1.5">
          {data.positives.map((p, i) => (
            <div key={i} className="flex items-start gap-2 text-sm text-green-700">
              <span className="shrink-0 mt-0.5">✓</span>
              <span>{p}</span>
            </div>
          ))}
        </div>
      )}

      {hasDaily && (
        <div className="space-y-2.5 border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide">Falta en este día</p>
          {data.missing_daily.map((m, i) => (
            <div key={i}>
              <p className="text-sm font-medium text-orange-700">⚠ {m.nutrient}</p>
              <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{m.reason}</p>
            </div>
          ))}
        </div>
      )}

      {hasWeekly && (
        <div className="space-y-2.5 border-t border-gray-100 pt-3">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">A tener en cuenta durante la semana</p>
          {data.missing_weekly.map((m, i) => (
            <div key={i}>
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-blue-700">ℹ {m.nutrient}</p>
                {m.frequency && (
                  <span className="text-[10px] bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full">{m.frequency}</span>
                )}
              </div>
              <p className="text-xs text-gray-500 leading-relaxed mt-0.5">{m.reason}</p>
            </div>
          ))}
        </div>
      )}

      {allGood && (
        <div className="flex items-center gap-2 text-sm text-green-700 border-t border-gray-100 pt-3">
          <span>🎉</span>
          <span>¡Día completo nutricionalmente!</span>
        </div>
      )}
    </div>
  );
}

// ─── Dinner result ────────────────────────────────────────────────────────────

function DinnerResult({ data, apiKey }) {
  const [ingredients, setIngredients] = useState(() => data.ingredients || []);
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [swappingIdx, setSwappingIdx] = useState(null);

  useEffect(() => {
    setIngredients(data.ingredients || []);
    setExpandedIdx(null);
    setSwappingIdx(null);
  }, [data]);

  const removeIngredient = (idx) => {
    setIngredients(prev => prev.filter((_, i) => i !== idx));
    if (expandedIdx === idx) setExpandedIdx(null);
  };

  const handleSwap = async (idx) => {
    const ing = ingredients[idx];
    setSwappingIdx(idx);
    try {
      const others = ingredients.filter((_, i) => i !== idx).map(i => i.name);
      const res = await swapDinnerIngredient({ ingredient: ing.name, role: ing.why, otherIngredients: others, apiKey });
      setIngredients(prev => prev.map((item, i) => i === idx ? { name: res.name, why: res.why } : item));
    } catch {
      // silently fail
    } finally {
      setSwappingIdx(null);
    }
  };

  return (
    <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 space-y-3">
      <p className="text-xs font-semibold text-brand-600 uppercase tracking-wide">Cena propuesta</p>

      {/* Title */}
      <p className="text-base font-bold text-gray-900">{data.title}</p>

      {/* Preparation */}
      {data.preparation && (
        <p className="text-xs text-gray-500 leading-relaxed">{data.preparation}</p>
      )}

      {/* Ingredients as pills */}
      {ingredients.length > 0 && (
        <div className="pt-1">
          <p className="text-xs text-gray-400 mb-2">Toca un ingrediente para ver por qué está. Usa ↺ para cambiarlo, ✕ para quitarlo.</p>
          <div className="flex flex-wrap gap-2">
            {ingredients.map((ing, i) => (
              <div key={i} className="flex flex-col">
                <div className="flex items-center gap-0.5 bg-white border border-brand-200 rounded-full pl-3 pr-1.5 py-1">
                  <button
                    onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                    className="text-xs font-medium text-gray-700"
                  >
                    {ing.name}
                  </button>
                  <button
                    onClick={() => handleSwap(i)}
                    disabled={swappingIdx === i}
                    className="text-gray-300 hover:text-brand-500 transition-colors text-[11px] leading-none ml-1 disabled:opacity-40"
                    title="Cambiar ingrediente"
                  >
                    {swappingIdx === i
                      ? <span className="inline-block w-2.5 h-2.5 border border-gray-300 border-t-brand-500 rounded-full animate-spin" />
                      : '↺'}
                  </button>
                  <button
                    onClick={() => removeIngredient(i)}
                    className="text-gray-300 hover:text-red-400 transition-colors text-[10px] leading-none ml-0.5"
                    title="Quitar ingrediente"
                  >
                    ✕
                  </button>
                </div>
                {expandedIdx === i && ing.why && (
                  <div className="mt-1 mx-1 bg-white border border-brand-100 rounded-xl px-3 py-2">
                    <p className="text-xs text-gray-600 leading-relaxed">{ing.why}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DayPlayground({ apiKey, hasAiAccess, householdId }) {
  const [mode, setMode] = useState('evaluate'); // 'evaluate' | 'dinner'
  const [meals, setMeals] = useState({});
  const [weeklyFish, setWeeklyFish] = useState(null);
  const [weeklyLegume, setWeeklyLegume] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const today = new Date().toISOString().slice(0, 10);
  const saveTimerRef = useRef(null);

  // Load persisted meals on mount
  useEffect(() => {
    if (!householdId) return;
    const ref = doc(db, 'households', householdId, 'dayPlayground', 'state');
    getDoc(ref).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.date === today) setMeals(data.meals || {});
      }
    });
  }, [householdId]);

  // Debounced save on meals change
  useEffect(() => {
    if (!householdId) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const ref = doc(db, 'households', householdId, 'dayPlayground', 'state');
      setDoc(ref, { date: today, meals });
    }, 800);
    return () => clearTimeout(saveTimerRef.current);
  }, [meals, householdId]);

  const activeMeals = mode === 'evaluate' ? MEAL_TYPES : DINNER_MEALS;
  const hasSomeMeal = activeMeals.some(m => meals[m.id]?.trim());

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    const mealList = activeMeals
      .filter(m => meals[m.id]?.trim())
      .map(m => ({ tipo: m.id, text: meals[m.id].trim() }));
    try {
      if (mode === 'evaluate') {
        const res = await evaluateDay({ meals: mealList, apiKey });
        setResult({ type: 'evaluate', data: res });
      } else {
        const previousTitle = result?.type === 'dinner' ? result.data.title : null;
        const res = await suggestDinner({ meals: mealList, weeklyFish, weeklyLegume, previousTitle, apiKey });
        setResult({ type: 'dinner', data: res });
      }
    } catch (err) {
      setError(
        err.message === 'NO_API_KEY' ? 'Añade tu API key en Perfil para usar esta función.' :
        err.message === 'CALL_LIMIT_EXCEEDED' ? 'Has alcanzado el límite mensual de llamadas.' :
        err.message === 'FREE_QUOTA_EXCEEDED' ? 'Has agotado las 30 llamadas gratuitas.' :
        err.message || 'Error al generar la respuesta.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setMeals({});
    setResult(null);
    setError(null);
    setWeeklyFish(null);
    setWeeklyLegume(null);
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {[
              { id: 'evaluate', label: '🔍 Evaluar mi día' },
              { id: 'dinner', label: '🌙 ¿Qué ceno?' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => { setMode(tab.id); setResult(null); setError(null); }}
                className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  mode === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-4 space-y-3">

        {/* Description */}
        <p className="text-xs text-gray-400 text-center">
          {mode === 'evaluate'
            ? 'Introduce lo que ha comido el bebé hoy y analiza si el día está equilibrado.'
            : 'Introduce lo que ha comido hoy y la IA propone una cena que complemente el día.'}
        </p>

        {/* Meal inputs */}
        {activeMeals.map(m => (
          <div key={m.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3">
            <span className="text-lg shrink-0">{m.emoji}</span>
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 mb-0.5">{m.label}</p>
              <input
                type="text"
                value={meals[m.id] || ''}
                onChange={e => setMeals(prev => ({ ...prev, [m.id]: e.target.value }))}
                placeholder="¿Qué ha comido? (opcional)"
                className="w-full text-sm text-gray-800 placeholder-gray-300 focus:outline-none bg-transparent"
              />
            </div>
          </div>
        ))}

        {/* Weekly context (dinner mode only) */}
        {mode === 'dinner' && (
          <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 space-y-3">
            <p className="text-xs font-medium text-gray-500">Contexto semanal <span className="font-normal text-gray-400">(opcional)</span></p>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-gray-700">🐟 Pescado graso esta semana</span>
              <div className="flex gap-1">
                {WEEKLY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setWeeklyFish(prev => prev === opt.value ? null : opt.value)}
                    className={`w-8 h-7 text-xs rounded-lg border font-medium transition-colors ${
                      weeklyFish === opt.value
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-brand-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-gray-700">🟢 Legumbres esta semana</span>
              <div className="flex gap-1">
                {WEEKLY_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setWeeklyLegume(prev => prev === opt.value ? null : opt.value)}
                    className={`w-8 h-7 text-xs rounded-lg border font-medium transition-colors ${
                      weeklyLegume === opt.value
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-brand-400'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Result — evaluate */}
        {result?.type === 'evaluate' && (
          <EvaluateResult data={result.data} />
        )}

        {/* Result — dinner */}
        {result?.type === 'dinner' && (
          <DinnerResult data={result.data} apiKey={apiKey} />
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          {result && (
            <button
              onClick={handleReset}
              className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Limpiar
            </button>
          )}
          <button
            onClick={handleRun}
            disabled={loading || !hasAiAccess || !hasSomeMeal}
            title={!hasAiAccess ? 'Añade tu API key en Perfil' : !hasSomeMeal ? 'Introduce al menos una comida' : undefined}
            className="flex-1 bg-brand-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Analizando...</>
            ) : mode === 'evaluate' ? (
              result ? '↺ Re-evaluar' : '🔍 Evaluar día'
            ) : (
              result ? '↺ Nueva propuesta' : '🌙 Proponer cena'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
