import { useState, useRef, useEffect } from 'react';

export default function WeekHeader({
  weekDoc,
  currentWeekIndex,
  totalWeeks,
  onPrevious,
  onNext,
  onNewWeek,
  onExport,
  onUpdateLabel,
  onDeleteWeek,
  saving,
}) {
  const [editing, setEditing] = useState(false);
  const [labelValue, setLabelValue] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (weekDoc) setLabelValue(weekDoc.label || '');
  }, [weekDoc?.label]);

  const handleLabelClick = () => {
    setEditing(true);
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleLabelSave = () => {
    setEditing(false);
    if (weekDoc && labelValue.trim() && labelValue.trim() !== weekDoc.label) {
      onUpdateLabel(weekDoc.id, labelValue.trim());
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleLabelSave();
    if (e.key === 'Escape') {
      setEditing(false);
      setLabelValue(weekDoc?.label || '');
    }
  };

  const canGoPrev = currentWeekIndex < totalWeeks - 1;
  const canGoNext = currentWeekIndex > 0;

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-4 py-3">
        {/* Top row: logo + actions */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xl">🥦</span>
            <span className="font-bold text-brand-700 text-lg">NutriWeek</span>
            {saving && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <div className="w-3 h-3 border border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                Guardando...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onExport}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
              title="Compartir semana"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </button>
            <button
              data-tour="new-week-btn"
              onClick={onNewWeek}
              className="flex items-center gap-1.5 bg-brand-600 text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-brand-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nueva semana
            </button>
          </div>
        </div>

        {/* Week navigation row */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevious}
            disabled={!canGoPrev}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Semana anterior"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {editing ? (
            <input
              ref={inputRef}
              type="text"
              value={labelValue}
              onChange={(e) => setLabelValue(e.target.value)}
              onBlur={handleLabelSave}
              onKeyDown={handleKeyDown}
              className="flex-1 text-sm font-semibold text-gray-800 border border-brand-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          ) : (
            <button
              onClick={handleLabelClick}
              className="flex-1 text-left text-sm font-semibold text-gray-800 hover:text-brand-700 transition-colors px-1 py-1 group"
              title="Editar nombre de la semana"
            >
              {weekDoc?.label || 'Sin semanas'}
              <svg className="w-3 h-3 inline ml-1 opacity-0 group-hover:opacity-50 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}

          <span className="text-xs text-gray-400 shrink-0">
            {totalWeeks > 0 ? `${totalWeeks - currentWeekIndex}/${totalWeeks}` : '0/0'}
          </span>

          <button
            onClick={onNext}
            disabled={!canGoNext}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Semana siguiente"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {weekDoc && (
            confirmDelete ? (
              <div className="flex items-center gap-1 ml-1">
                <span className="text-xs text-red-600 font-medium">¿Borrar?</span>
                <button
                  onClick={() => { onDeleteWeek(weekDoc.id); setConfirmDelete(false); }}
                  className="text-xs bg-red-600 text-white px-2 py-1 rounded-lg hover:bg-red-700 transition-colors"
                >
                  Sí
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs border border-gray-300 text-gray-600 px-2 py-1 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="p-1.5 rounded-lg text-gray-300 hover:bg-red-50 hover:text-red-500 transition-colors ml-1"
                title="Borrar semana"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )
          )}
        </div>
      </div>
    </header>
  );
}
