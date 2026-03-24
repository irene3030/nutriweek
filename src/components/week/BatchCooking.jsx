import { useState } from 'react';
import { generateBatchCooking } from '../../lib/claude';

export default function BatchCooking({ weekDoc, apiKey, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
    } catch (err) {
      setError(
        err.message === 'NO_API_KEY' ? 'Añade tu API key en Perfil para usar esta función.' :
        err.message === 'CALL_LIMIT_EXCEEDED' ? 'Has alcanzado el límite mensual de llamadas. Auméntalo en Perfil.' :
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
                  disabled={loading || !apiKey}
                  title={!apiKey ? 'Añade tu API key en Perfil' : undefined}
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
                <div className="space-y-5">
                  {sections.map(section => {
                    const tasks = section.tasks || [];
                    const sectionDone = tasks.filter(t => t.done).length;
                    const sectionTotal = tasks.length;
                    return (
                      <div key={section.id}>
                        {/* Section header */}
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-sm">{section.emoji}</span>
                          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                            {section.title}
                          </span>
                          {sectionDone === sectionTotal && sectionTotal > 0 && (
                            <span className="text-xs text-green-600">✓</span>
                          )}
                        </div>

                        {/* Tasks */}
                        <ul className="space-y-2 pl-1">
                          {tasks.map(task => (
                            <li key={task.id} className="flex items-start gap-2.5">
                              <button
                                onClick={() => toggleTask(section.id, task.id)}
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
                              <span className={`text-sm leading-snug ${task.done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                                {task.text}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={loading || !apiKey}
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
