import { useState } from 'react';
import { evaluateDay, suggestDinner } from '../../lib/claude';

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

export default function DayPlayground({ apiKey, hasAiAccess }) {
  const [mode, setMode] = useState('evaluate'); // 'evaluate' | 'dinner'
  const [meals, setMeals] = useState({});
  const [weeklyFish, setWeeklyFish] = useState(null);
  const [weeklyLegume, setWeeklyLegume] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

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
        const res = await suggestDinner({ meals: mealList, weeklyFish, weeklyLegume, apiKey });
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
    <div className="min-h-screen bg-gray-50">
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
          <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-4">
            {/* Overall */}
            <p className="text-sm text-gray-800 font-medium">{result.data.overall}</p>

            {/* Positives */}
            {result.data.positives?.length > 0 && (
              <div className="space-y-1.5">
                {result.data.positives.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-green-700">
                    <span className="shrink-0 mt-0.5">✓</span>
                    <span>{p}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Missing */}
            {result.data.missing?.length > 0 && (
              <div className="space-y-3 border-t border-gray-100 pt-3">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Falta en este día</p>
                {result.data.missing.map((m, i) => (
                  <div key={i} className="space-y-1">
                    <p className="text-sm font-medium text-orange-700">⚠ {m.nutrient}</p>
                    <p className="text-xs text-gray-500 leading-relaxed">{m.weekly_context}</p>
                  </div>
                ))}
              </div>
            )}

            {result.data.missing?.length === 0 && (
              <div className="flex items-center gap-2 text-sm text-green-700 border-t border-gray-100 pt-3">
                <span>🎉</span>
                <span>¡Día completo nutricionalmente!</span>
              </div>
            )}
          </div>
        )}

        {/* Result — dinner */}
        {result?.type === 'dinner' && (
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 space-y-2">
            <p className="text-xs font-medium text-brand-600 uppercase tracking-wide">Cena propuesta</p>
            <p className="text-sm font-semibold text-gray-900">{result.data.dinner}</p>
            <p className="text-xs text-gray-500 leading-relaxed pt-1">{result.data.reasoning}</p>
          </div>
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
