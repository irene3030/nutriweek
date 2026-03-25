import { useState } from 'react';
import { generateBatchCooking } from '../../lib/claude';
import { track } from '../../lib/analytics';

const DAY_ORDER = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const DAY_COLORS = {
  Lun: 'bg-blue-100 text-blue-700',
  Mar: 'bg-purple-100 text-purple-700',
  Mié: 'bg-green-100 text-green-700',
  Jue: 'bg-orange-100 text-orange-700',
  Vie: 'bg-pink-100 text-pink-700',
  Sáb: 'bg-amber-100 text-amber-700',
  Dom: 'bg-red-100 text-red-700',
};

function firstDay(days) {
  if (!Array.isArray(days) || days.length === 0) return 999;
  return Math.min(...days.map(d => DAY_ORDER.indexOf(d)).filter(i => i !== -1));
}

export default function BatchCooking({ weekDoc, apiKey, hasAiAccess, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortMode, setSortMode] = useState('groups'); // 'groups' | 'chrono'

  // Detect old format ({id, text, done}[]) vs new format ({id, emoji, title, tasks}[])
  const raw = weekDoc?.batchCooking || [];
  const sections = raw.length > 0 && raw[0].tasks !== undefined ? raw : [];

  const allTasks = sections.flatMap(s => s.tasks || []);
  const doneCount = allTasks.filter(t => t.done).length;
  const totalCount = allTasks.length;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const weekMenu = weekDoc.days.map(day => ({
        day: day.day,
        meals: day.meals.filter(m => m.baby).map(m => ({ tipo: m.tipo, baby: m.baby })),
      }));
      const result = await generateBatchCooking({ weekMenu, apiKey });
      const newSections = (result.sections || []).map(section => ({
        ...section,
        tasks: (section.tasks || []).map(task => ({ ...task, done: false })),
      }));
      onUpdate(newSections);
      track('batch_cooking_generated', { sections: newSections.length, tasks: newSections.flatMap(s => s.tasks).length });
    } catch (err) {
      setError(
        err.message === 'NO_API_KEY' ? 'Añade tu API key en Perfil para usar esta función.' :
        err.message === 'CALL_LIMIT_EXCEEDED' ? 'Has alcanzado el límite mensual de llamadas. Auméntalo en Perfil.' :
        err.message === 'FREE_QUOTA_EXCEEDED' ? 'Has agotado las 30 llamadas gratuitas. Añade tu API key en Perfil.' :
        err.message || 'Error generando el batch cooking.');
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = (sectionId, taskId) => {
    onUpdate(sections.map(section =>
      section.id !== sectionId ? section : {
        ...section,
        tasks: section.tasks.map(task =>
          task.id !== taskId ? task : { ...task, done: !task.done }
        ),
      }
    ));
  };

  // Build the list to render based on sort mode
  const renderItems = sortMode === 'chrono'
    ? allTasks
        .map(task => {
          const section = sections.find(s => s.tasks?.some(t => t.id === task.id));
          return { ...task, sectionEmoji: section?.emoji, sectionTitle: section?.title };
        })
        .sort((a, b) => firstDay(a.days) - firstDay(b.days))
    : null; // null means render by sections

  return (
    <div className="px-4 pb-4">
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Header / toggle */}
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">🍳</span>
            <span className="text-sm font-semibold text-gray-800">Batch cooking</span>
            {totalCount > 0 && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                doneCount === totalCount
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-500'
              }`}>
                {doneCount}/{totalCount}
              </span>
            )}
          </div>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* Content */}
        {open && (
          <div className="border-t border-gray-100 px-4 py-4 space-y-4">
            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            {sections.length === 0 ? (
              <div className="text-center py-4 space-y-3">
                <p className="text-xs text-gray-400 leading-relaxed">
                  Genera un plan de preparación anticipada basado en el menú de esta semana.
                </p>
                <button
                  onClick={handleGenerate}
                  disabled={loading || !hasAiAccess}
                  title={!hasAiAccess ? 'Necesitas una API key o un código Friends & Family en Perfil' : undefined}
                  className="flex items-center gap-2 mx-auto bg-brand-600 text-white text-xs font-medium px-4 py-2 rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading
                    ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generando...</>
                    : '✨ Generar plan'
                  }
                </button>
              </div>
            ) : (
              <>
                {/* Sort toggle */}
                <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 w-fit">
                  <button
                    onClick={() => setSortMode('groups')}
                    className={`text-xs px-3 py-1 rounded-md transition-colors ${
                      sortMode === 'groups'
                        ? 'bg-white text-gray-800 shadow-sm font-medium'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Por grupos
                  </button>
                  <button
                    onClick={() => setSortMode('chrono')}
                    className={`text-xs px-3 py-1 rounded-md transition-colors ${
                      sortMode === 'chrono'
                        ? 'bg-white text-gray-800 shadow-sm font-medium'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Cronológico
                  </button>
                </div>

                {sortMode === 'groups' ? (
                  <div className="space-y-5">
                    {sections.map(section => {
                      const tasks = section.tasks || [];
                      const sectionDone = tasks.filter(t => t.done).length;
                      const sectionTotal = tasks.length;
                      return (
                        <div key={section.id}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm">{section.emoji}</span>
                            <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                              {section.title}
                            </span>
                            {sectionDone === sectionTotal && sectionTotal > 0 && (
                              <span className="text-xs text-green-600">✓</span>
                            )}
                          </div>
                          <ul className="space-y-2 pl-1">
                            {tasks.map(task => (
                              <TaskRow
                                key={task.id}
                                task={task}
                                sectionId={section.id}
                                onToggle={toggleTask}
                              />
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {renderItems.map(task => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        sectionId={sections.find(s => s.tasks?.some(t => t.id === task.id))?.id}
                        onToggle={toggleTask}
                        showSection
                      />
                    ))}
                  </ul>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={loading || !hasAiAccess}
                  title={!hasAiAccess ? 'Necesitas una API key o un código Friends & Family en Perfil' : undefined}
                  className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-600 transition-colors disabled:opacity-40"
                >
                  {loading
                    ? <><div className="w-3 h-3 border border-gray-300 border-t-brand-500 rounded-full animate-spin" /> Regenerando...</>
                    : '↺ Regenerar'
                  }
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function TaskRow({ task, sectionId, onToggle, showSection }) {
  return (
    <li className="flex items-start gap-2.5">
      <button
        onClick={() => onToggle(sectionId, task.id)}
        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
          task.done
            ? 'bg-brand-600 border-brand-600 text-white'
            : 'border-gray-300 hover:border-brand-400'
        }`}
      >
        {task.done && (
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0 flex items-start gap-2 flex-wrap">
        <span className={`text-sm leading-snug ${task.done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
          {showSection && task.sectionEmoji && (
            <span className="mr-1">{task.sectionEmoji}</span>
          )}
          {task.text}
        </span>
        {Array.isArray(task.days) && task.days.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {task.days.map(day => (
              <span
                key={day}
                className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${DAY_COLORS[day] || 'bg-gray-100 text-gray-600'}`}
              >
                {day}
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}
