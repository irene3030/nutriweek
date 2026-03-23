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

export default function NewWeekModal({ isOpen, onClose, onSave, existingWeekIds = [], foodHistory, savedRecipes }) {
  const [step, setStep] = useState('form'); // 'form' | 'loading' | 'preview'
  const [ingredients, setIngredients] = useState('');
  const [mondayDate, setMondayDate] = useState(getThisMonday());
  const [proposedWeek, setProposedWeek] = useState(null);
  const [regeneratingDay, setRegeneratingDay] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const weekLabel = mondayToLabel(mondayDate);
  const isDuplicate = existingWeekIds.includes(mondayDate);

  const handleGenerate = async () => {
    if (isDuplicate) {
      setError('Ya existe un menú para esa semana.');
      return;
    }
    setStep('loading');
    setError(null);
    try {
      const result = await generateWeekMenu({
        availableIngredients: ingredients,
        foodHistory,
        savedRecipes,
      });
      setProposedWeek(result);
      setStep('preview');
    } catch (err) {
      setError(err.message || 'Error generando el menú. Verifica la configuración de la API.');
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
              Ingredientes disponibles en casa (opcional)
            </label>
            <textarea
              value={ingredients}
              onChange={(e) => setIngredients(e.target.value)}
              placeholder="Ej: pollo, zanahoria, arroz, huevos, lentejas..."
              rows={3}
              className="w-full border border-gray-300 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-sm resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">
              Estos ingredientes se priorizarán en el menú y aparecerán marcados en la lista de la compra.
            </p>
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
              disabled={isDuplicate}
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
