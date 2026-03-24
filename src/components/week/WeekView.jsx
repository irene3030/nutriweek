import { useState } from 'react';
import WeekHeader from './WeekHeader';
import WeekKPIs from './WeekKPIs';
import DayCard from './DayCard';
import BatchCooking from './BatchCooking';
import NewWeekModal from './NewWeekModal';
import QuickMealModal from './QuickMealModal';
import LoadingSpinner from '../ui/LoadingSpinner';

const DAY_ORDER = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function getTodayDayName() {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return days[new Date().getDay()];
}

const MEAL_EMOJIS = { desayuno: '☀️', snack: '🍎', comida: '🍽️', merienda: '🍪', cena: '🌙' };
const MEAL_ORDER = ['desayuno', 'snack', 'comida', 'merienda', 'cena'];

export default function WeekView({
  weeks,
  currentWeek,
  currentWeekIndex,
  loading,
  saving,
  onGoToPrevious,
  onGoToNext,
  onNewWeek,
  onDeleteWeek,
  onUpdateLabel,
  onDayClick,
  onAddMealToSlot,
  onUpdateBatchCooking,
  foodHistory,
  savedRecipes,
  usualMeals,
  apiKey,
}) {
  const [showNewWeekModal, setShowNewWeekModal] = useState(false);
  const [showQuickMeal, setShowQuickMeal] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportSimple, setExportSimple] = useState(true);
  const [exportCopied, setExportCopied] = useState(false);
  const todayName = getTodayDayName();

  function shortName(text) {
    if (!text) return '';
    if (text.length <= 22) return text;
    const words = text.trim().split(/\s+/);
    const connectors = ['con', 'y'];
    for (const conn of connectors) {
      const idx = words.indexOf(conn);
      if (idx > 0 && idx < words.length - 1) return `${words[0]} ${conn} ${words[idx + 1]}`;
    }
    return words[0];
  }

  function buildExportText(simple) {
    if (!currentWeek) return '';
    const sorted = [...currentWeek.days].sort(
      (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day)
    );
    let text = `📅 *${currentWeek.label || 'Menú semanal'}*\n`;
    for (const day of sorted) {
      text += `\n*${day.day}*\n`;
      for (const tipo of MEAL_ORDER) {
        const meal = day.meals?.find(m => m.tipo === tipo);
        if (meal?.baby) {
          const label = simple ? shortName(meal.baby) : meal.baby;
          text += `${MEAL_EMOJIS[tipo]} ${label}\n`;
        }
      }
    }
    return text.trim();
  }

  const exportText = buildExportText(exportSimple);

  const handleExport = () => setShowExport(true);

  const handleCopyExport = () => {
    navigator.clipboard.writeText(exportText);
    setExportCopied(true);
    setTimeout(() => setExportCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" label="Cargando semanas..." />
      </div>
    );
  }

  const sortedDays = currentWeek?.days
    ? [...currentWeek.days].sort(
        (a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day)
      )
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <WeekHeader
        weekDoc={currentWeek}
        currentWeekIndex={currentWeekIndex}
        totalWeeks={weeks.length}
        onPrevious={onGoToPrevious}
        onNext={onGoToNext}
        onNewWeek={() => setShowNewWeekModal(true)}
        onExport={handleExport}
        onUpdateLabel={onUpdateLabel}
        onDeleteWeek={onDeleteWeek}
        saving={saving}
      />

      <main className="max-w-4xl mx-auto">
        {currentWeek ? (
          <>
            <WeekKPIs weekDoc={currentWeek} />
            <div className="px-4 pb-3">
              <button
                onClick={() => setShowQuickMeal(true)}
                className="flex items-center gap-2 text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 shadow-sm px-4 py-2 rounded-xl transition-colors"
              >
                ⚡ Generar idea de comida
              </button>
            </div>

            <div className="px-4 pb-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {sortedDays.map((dayData) => (
                  <DayCard
                    key={dayData.day}
                    dayData={dayData}
                    onClick={() => onDayClick(DAY_ORDER.indexOf(dayData.day))}
                    isToday={dayData.day === todayName}
                  />
                ))}
              </div>
            </div>

            <BatchCooking
              weekDoc={currentWeek}
              apiKey={apiKey}
              onUpdate={(items) => onUpdateBatchCooking(currentWeek.id, items)}
            />
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
            <div className="text-6xl mb-4">📅</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Sin semanas planificadas</h2>
            <p className="text-gray-500 text-sm mb-6">
              Crea tu primera semana con IA o en blanco para empezar a planificar.
            </p>
            <button
              onClick={() => setShowNewWeekModal(true)}
              className="flex items-center gap-2 bg-brand-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-brand-700 transition-colors"
            >
              <span>✨</span>
              Crear primera semana
            </button>
          </div>
        )}
      </main>

      <NewWeekModal
        isOpen={showNewWeekModal}
        onClose={() => setShowNewWeekModal(false)}
        onSave={onNewWeek}
        existingWeekIds={weeks.map((w) => w.id)}
        foodHistory={foodHistory}
        savedRecipes={savedRecipes}
        usualMeals={usualMeals}
        apiKey={apiKey}
      />
      <QuickMealModal
        isOpen={showQuickMeal}
        onClose={() => setShowQuickMeal(false)}
        apiKey={apiKey}
        currentWeek={currentWeek}
        onAddToWeek={onAddMealToSlot}
      />

      {/* WhatsApp export modal */}
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Compartir semana</h2>
              <button onClick={() => { setShowExport(false); setExportCopied(false); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            {/* Simple / Detallado toggle */}
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
              <span className="text-sm text-gray-700">Menú simple</span>
              <button
                onClick={() => setExportSimple(v => !v)}
                className={`relative w-10 h-5.5 rounded-full transition-colors ${exportSimple ? 'bg-brand-600' : 'bg-gray-300'}`}
                style={{ height: '22px', width: '40px' }}
              >
                <span
                  className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${exportSimple ? 'translate-x-5' : 'translate-x-0.5'}`}
                />
              </button>
            </div>
            <textarea
              readOnly
              value={exportText}
              className="w-full h-56 border border-gray-200 rounded-xl p-3 text-sm text-gray-700 resize-none focus:outline-none bg-gray-50"
            />
            <button
              onClick={handleCopyExport}
              className="w-full bg-brand-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              {exportCopied ? '✓ Copiado' : '📋 Copiar para WhatsApp'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
