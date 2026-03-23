import { useRef } from 'react';
import html2canvas from 'html2canvas';
import WeekHeader from './WeekHeader';
import WeekKPIs from './WeekKPIs';
import DayCard from './DayCard';
import NewWeekModal from './NewWeekModal';
import LoadingSpinner from '../ui/LoadingSpinner';
import { useState } from 'react';

const DAY_ORDER = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function getTodayDayName() {
  const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return days[new Date().getDay()];
}

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
  foodHistory,
  savedRecipes,
}) {
  const [showNewWeekModal, setShowNewWeekModal] = useState(false);
  const weekGridRef = useRef(null);
  const todayName = getTodayDayName();

  const handleExport = async () => {
    if (!weekGridRef.current) return;
    try {
      const canvas = await html2canvas(weekGridRef.current, {
        backgroundColor: '#f9fafb',
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `nutriweek-${currentWeek?.label || 'semana'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Error exporting:', err);
    }
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

            <div ref={weekGridRef} className="px-4 pb-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {sortedDays.map((dayData, index) => (
                  <DayCard
                    key={dayData.day}
                    dayData={dayData}
                    onClick={() => onDayClick(DAY_ORDER.indexOf(dayData.day))}
                    isToday={dayData.day === todayName}
                  />
                ))}
              </div>
            </div>
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
      />
    </div>
  );
}
