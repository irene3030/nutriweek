import { useState } from 'react';
import Modal from '../ui/Modal';
import LoadingSpinner from '../ui/LoadingSpinner';
import { generateWeekMenu, regenerateDay } from '../../lib/claude';

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

export default function NewWeekModal({ isOpen, onClose, onSave, existingWeekIds = [], foodHistory, savedRecipes, usualMeals = [], apiKey }) {
  const [step, setStep] = useState('form');
  const [ingredients, setIngredients] = useState('');
  const [mondayDate, setMondayDate] = useState(getThisMonday());
  const [proposedWeek, setProposedWeek] = useState(null);
  const [regeneratingDay, setRegeneratingDay] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showFixedMeals, setShowFixedMeals] = useState(false);
  const [fixedMeals, setFixedMeals] = useState([]);      // [{day, tipo, text}] day can be null
  const [newFixed, setNewFixed] = useState({ day: 'Lun', tipo: 'comida', text: '', anyDay: false });
  const [recurringMeals, setRecurringMeals] = useState([]); // string[]
  const [recurringInput, setRecurringInput] = useState('');
  const [mealSlots, setMealSlots] = useState(DEFAULT_SLOTS);

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

  const handleGenerate = async () => {
    if (isDuplicate) {
      setError('Ya existe un menú para esa semana.');
      return;
    }
    if (!apiKey) {
      setError('Añade tu API key de Anthropic en Perfil para usar la generación con IA.');
      return;
    }
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
        apiKey,
      });
      setProposedWeek(result);
      setStep('preview');
    } catch (err) {
      setError(
        err.message === 'CALL_LIMIT_EXCEEDED' ? 'Has alcanzado el límite mensual de llamadas. Auméntalo en Perfil.' :
        err.message || 'Error generando el menú. Verifica la configuración de la API.'
      );
      setStep('form');
    }
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
      await onSave(mondayDate, weekLabel, proposedWeek.days);
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
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'preview' ? 'Revisar menú propuesto' : 'Nueva semana'}
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
                      {usualMeals.map(m => {
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
              onClick={handleGenerate}
              disabled={isDuplicate || !apiKey}
              title={!apiKey ? 'Añade tu API key en Perfil' : undefined}
              className="flex-1 bg-brand-600 text-white rounded-xl py-3 font-medium hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>✨</span>
              Generar con IA
            </button>
          </div>

          <button
            disabled={isDuplicate}
            onClick={() => {
              onSave(mondayDate, weekLabel, null);
              handleClose();
            }}
            className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors py-1 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            O crear semana vacía sin IA
          </button>
        </div>
      )}

      {step === 'loading' && (
        <div className="py-16 text-center">
          <LoadingSpinner size="lg" label="" />
          <p className="text-gray-700 font-medium mt-4">Generando tu menú semanal...</p>
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
