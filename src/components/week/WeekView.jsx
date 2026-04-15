import { useState } from 'react';
import WeekHeader from './WeekHeader';
import WeekKPIs from './WeekKPIs';
import DayCard from './DayCard';
import BatchCooking from './BatchCooking';
import NewWeekModal from './NewWeekModal';
import ReplanModal from './ReplanModal';
import LoadingSpinner from '../ui/LoadingSpinner';
import ShoppingList from '../shopping/ShoppingList';
import { ShoppingCart, Sparkles, Calendar, ClipboardList, Check, RefreshCw } from 'lucide-react';

const DAY_ORDER = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function getTodayDayName() {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return days[new Date().getDay()];
}

const MEAL_LABELS_EXPORT = { desayuno: 'Desayuno', snack: 'Snack', comida: 'Comida', merienda: 'Merienda', cena: 'Cena' };
const MEAL_ORDER = ['desayuno', 'snack', 'comida', 'merienda', 'cena'];

export default function WeekView({
  weeks,
  currentWeek,
  currentWeekIndex,
  loading,
  saving,
  ingredientsMode,
  onToggleIngredientsMode,
  onGoToPrevious,
  onGoToNext,
  onNewWeek,
  onDeleteWeek,
  onUpdateLabel,
  onDayClick,
  onAddMealToSlot,
  onUpdateBatchCooking,
  onApplyFixes,
  foodHistory,
  savedRecipes,
  usualMeals,
  hasAiAccess,
  householdId,
  kpiConfig,
  onUpdateKpiConfig,
  babyProfile,
  onClearDay,
  onReplanWeek,
}) {
  const [showNewWeekModal, setShowNewWeekModal] = useState(false);
  const [showReplan, setShowReplan] = useState(false);
  const [showShopping, setShowShopping] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportSimple, setExportSimple] = useState(false);
  const [exportCopied, setExportCopied] = useState(false);
  const [pendingFixMeals, setPendingFixMeals] = useState(null);
  const todayName = getTodayDayName();
  const DAY_LABELS = { Lun: 'Lunes', Mar: 'Martes', Mié: 'Miércoles', Jue: 'Jueves', Vie: 'Viernes', Sáb: 'Sábado', Dom: 'Domingo' };

  // Show "Regenerar desde X" when: the viewed week is the current week (today falls
  // within its Monday–Sunday range), today is not Saturday, and there are future days left.
  const todayIdx = DAY_ORDER.indexOf(todayName);
  const replanFromDay = todayIdx >= 0 && todayIdx < 6 ? DAY_ORDER[todayIdx + 1] : null;
  const isCurrentWeek = (() => {
    if (!currentWeek?.mondayDate) return false;
    const monday = new Date(currentWeek.mondayDate + 'T00:00:00');
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return today >= monday && today <= sunday;
  })();
  const showReplanButton = !!(currentWeek && replanFromDay && hasAiAccess && isCurrentWeek);

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
    let text = `*${currentWeek.label || 'Menú semanal'}*\n`;
    for (const day of sorted) {
      text += `\n*${day.day}*\n`;
      for (const tipo of MEAL_ORDER) {
        const meal = day.meals?.find(m => m.tipo === tipo);
        if (meal?.baby) {
          const label = simple ? shortName(meal.baby) : meal.baby;
          text += `${MEAL_LABELS_EXPORT[tipo] || tipo}: ${label}\n`;
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
      <div className="min-h-screen flex items-center justify-center">
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
    <div className="min-h-screen">
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

      <main className="max-w-7xl mx-auto">
        {currentWeek ? (
          <>
            <div className="px-4 pt-4 pb-4">
              <div className="bg-white rounded-2xl border border-gray-100 overflow-visible">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 rounded-t-2xl">
                  <Calendar className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-semibold text-gray-800">Planificación semanal</span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <span className={`text-xs transition-colors ${ingredientsMode ? 'text-gray-400' : 'text-gray-500 font-medium'}`}>Plato</span>
                    <button
                      onClick={onToggleIngredientsMode}
                      className={`relative rounded-full transition-colors shrink-0 ${ingredientsMode ? 'bg-brand-600' : 'bg-gray-200'}`}
                      style={{ width: 28, height: 16 }}
                      title={ingredientsMode ? 'Mostrando ingredientes' : 'Mostrando plato completo'}
                    >
                      <span
                        className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${ingredientsMode ? 'translate-x-3.5' : 'translate-x-0.5'}`}
                      />
                    </button>
                    <span className={`text-xs transition-colors ${ingredientsMode ? 'text-gray-500 font-medium' : 'text-gray-400'}`}>Ingredientes</span>
                  </div>
                </div>
                {showReplanButton && (
                  <div className="border-t border-gray-100 px-4 py-2.5 flex items-center justify-between">
                    <span className="text-xs text-gray-400">¿No has seguido el plan?</span>
                    <button
                      onClick={() => setShowReplan(true)}
                      className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Regenerar desde {DAY_LABELS[replanFromDay]}
                    </button>
                  </div>
                )}
                <WeekKPIs
                  weekDoc={currentWeek}
                  hasAiAccess={hasAiAccess}
                  onApplyFixes={onApplyFixes}
                  onFixesChange={setPendingFixMeals}
                  kpiConfig={kpiConfig}
                  onUpdateKpiConfig={onUpdateKpiConfig}
                />
                <div className="border-t border-gray-100 p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3 rounded-b-2xl">
                  {sortedDays.map((dayData) => (
                    <DayCard
                      key={dayData.day}
                      dayData={dayData}
                      onClick={() => onDayClick(DAY_ORDER.indexOf(dayData.day))}
                      isToday={dayData.day === todayName}
                      onClear={() => onClearDay?.(dayData.day)}
                      highlightedMeals={pendingFixMeals?.filter(m => m.day === dayData.day) ?? null}
                      ingredientsMode={ingredientsMode}
                    />
                  ))}
                </div>
              </div>
            </div>

            <BatchCooking
              weekDoc={currentWeek}
              hasAiAccess={hasAiAccess}
              onUpdate={(items) => onUpdateBatchCooking(currentWeek.id, items)}
            />

            <div className="px-4 pb-4">
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <button
                  data-tour="shopping-btn"
                  onClick={() => setShowShopping(v => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-semibold text-gray-800">Lista de la compra</span>
                  </div>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${showShopping ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {showShopping && (
                  <div className="border-t border-gray-100">
                    <ShoppingList weekDoc={currentWeek} householdId={householdId} />
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
            <div className="mb-4"><Calendar className="w-16 h-16 text-gray-300 mx-auto" /></div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">Sin semanas planificadas</h2>
            <p className="text-gray-500 text-sm mb-6">
              Crea tu primera semana con IA o en blanco para empezar a planificar.
            </p>
            <button
              onClick={() => setShowNewWeekModal(true)}
              className="flex items-center gap-2 bg-brand-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-brand-700 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Crear primera semana
            </button>
          </div>
        )}
      </main>

      <ReplanModal
        isOpen={showReplan}
        onClose={() => setShowReplan(false)}
        weekDoc={currentWeek}
        foodHistory={foodHistory}
        savedRecipes={savedRecipes}
        kpiConfig={kpiConfig}
        hasAiAccess={hasAiAccess}
        onApply={onReplanWeek}
      />

      <NewWeekModal
        isOpen={showNewWeekModal}
        onClose={() => setShowNewWeekModal(false)}
        onSave={onNewWeek}
        existingWeekIds={weeks.map((w) => w.id)}
        pastWeeks={weeks}
        foodHistory={foodHistory}
        savedRecipes={savedRecipes}
        usualMeals={usualMeals}
        hasAiAccess={hasAiAccess}
        kpiConfig={kpiConfig}
        onUpdateKpiConfig={onUpdateKpiConfig}
        babyProfile={babyProfile}
      />

      {/* WhatsApp export modal */}
      {showExport && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Compartir semana</h2>
              <button onClick={() => { setShowExport(false); setExportCopied(false); }} className="text-gray-400 hover:text-gray-600"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
            </div>
            {/* Simple / Detallado toggle */}
            <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-2.5">
              <span className="text-sm text-gray-700">Resumir nombres</span>
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
              {exportCopied ? <><Check className="w-4 h-4 inline mr-1" />Copiado</> : <><ClipboardList className="w-4 h-4 inline mr-1" />Copiar para WhatsApp</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
