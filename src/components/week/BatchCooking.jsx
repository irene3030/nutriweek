import { useState } from 'react';
import { generateBatchCooking, generateBatchCookingOptimized } from '../../lib/claude';
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

const WEEK_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

const DURATION_OPTIONS = [
  { value: 30, label: '30m' },
  { value: 60, label: '1h' },
  { value: 90, label: '1h30' },
  { value: 120, label: '2h' },
  { value: 180, label: '3h' },
];

function firstDay(days) {
  if (!Array.isArray(days) || days.length === 0) return 999;
  return Math.min(...days.map(d => DAY_ORDER.indexOf(d)).filter(i => i !== -1));
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export default function BatchCooking({ weekDoc, apiKey, hasAiAccess, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortMode, setSortMode] = useState('groups');

  // Mode: 'simple' | 'optimized'
  const [mode, setMode] = useState(() => {
    const raw = weekDoc?.batchCooking;
    return raw?.type === 'optimized' ? 'optimized' : 'simple';
  });

  // Time session inputs for optimized mode
  const [timeSessions, setTimeSessions] = useState([
    { day: 'Domingo', duration: 120 },
    { day: '', duration: 60 },
  ]);

  // Parse stored data
  const raw = weekDoc?.batchCooking;
  const isOptimizedStored = raw?.type === 'optimized';
  const sections = !isOptimizedStored && Array.isArray(raw) && raw?.[0]?.tasks !== undefined ? raw : [];
  const optimizedSessions = isOptimizedStored ? (raw.sessions || []) : [];

  const hasSimpleData = sections.length > 0;
  const hasOptimizedData = optimizedSessions.length > 0;
  const hasData = mode === 'simple' ? hasSimpleData : hasOptimizedData;

  // Count tasks
  const allSimpleTasks = sections.flatMap(s => s.tasks || []);
  const allOptimizedTasks = optimizedSessions.flatMap(s => s.packs?.flatMap(p => p.tasks || []) || []);
  const allTasks = mode === 'simple' ? allSimpleTasks : allOptimizedTasks;
  const doneCount = allTasks.filter(t => t.done).length;
  const totalCount = allTasks.length;

  // Build week menu for API
  const buildWeekMenu = () =>
    weekDoc.days.map(day => ({
      day: day.day,
      meals: day.meals.filter(m => m.baby).map(m => ({ tipo: m.tipo, baby: m.baby })),
    }));

  const handleGenerateSimple = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateBatchCooking({ weekMenu: buildWeekMenu(), apiKey });
      const newSections = (result.sections || []).map(section => ({
        ...section,
        tasks: (section.tasks || []).map(task => ({ ...task, done: false })),
      }));
      onUpdate(newSections);
      track('batch_cooking_generated', { type: 'simple', sections: newSections.length });
    } catch (err) {
      setError(handleError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateOptimized = async () => {
    const validSessions = timeSessions.filter(s => s.day && s.duration);
    if (validSessions.length === 0) {
      setError('Añade al menos una sesión con día y tiempo disponible.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await generateBatchCookingOptimized({
        weekMenu: buildWeekMenu(),
        timeSessions: validSessions,
        apiKey,
      });
      const newSessions = (result.sessions || []).map(session => ({
        ...session,
        packs: (session.packs || []).map(pack => ({
          ...pack,
          tasks: (pack.tasks || []).map(task => ({ ...task, done: false })),
        })),
      }));
      onUpdate({ type: 'optimized', sessions: newSessions });
      track('batch_cooking_generated', { type: 'optimized', sessions: newSessions.length });
    } catch (err) {
      setError(handleError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = mode === 'simple' ? handleGenerateSimple : handleGenerateOptimized;

  // Toggle task in simple mode
  const toggleSimpleTask = (sectionId, taskId) => {
    onUpdate(sections.map(section =>
      section.id !== sectionId ? section : {
        ...section,
        tasks: section.tasks.map(task =>
          task.id !== taskId ? task : { ...task, done: !task.done }
        ),
      }
    ));
  };

  // Toggle task in optimized mode
  const toggleOptimizedTask = (sessionId, packId, taskId) => {
    const newSessions = optimizedSessions.map(session =>
      session.id !== sessionId ? session : {
        ...session,
        packs: session.packs.map(pack =>
          pack.id !== packId ? pack : {
            ...pack,
            tasks: pack.tasks.map(task =>
              task.id !== taskId ? task : { ...task, done: !task.done }
            ),
          }
        ),
      }
    );
    onUpdate({ type: 'optimized', sessions: newSessions });
  };

  // Chrono view for simple mode
  const chronoItems = sortMode === 'chrono'
    ? allSimpleTasks
        .map(task => {
          const section = sections.find(s => s.tasks?.some(t => t.id === task.id));
          return { ...task, sectionEmoji: section?.emoji, sectionTitle: section?.title };
        })
        .sort((a, b) => firstDay(a.days) - firstDay(b.days))
    : null;

  const updateTimeSession = (idx, field, value) => {
    setTimeSessions(prev => prev.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };

  const addTimeSession = () => setTimeSessions(prev => [...prev, { day: '', duration: 60 }]);
  const removeTimeSession = (idx) => setTimeSessions(prev => prev.filter((_, i) => i !== idx));

  return (
    <div className="px-4 pb-4">
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <span className="text-base">🍳</span>
            <span className="text-sm font-semibold text-gray-800">Batch cooking</span>
            {totalCount > 0 && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                doneCount === totalCount ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {doneCount}/{totalCount}
              </span>
            )}
          </div>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="border-t border-gray-100 px-4 py-4 space-y-4">
            {/* Mode tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
              {[
                { id: 'simple', label: 'Por ingrediente' },
                { id: 'optimized', label: '⏱ Por tiempo' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setMode(tab.id); setError(null); }}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    mode === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            {/* ── SIMPLE MODE ── */}
            {mode === 'simple' && (
              !hasSimpleData ? (
                <div className="text-center py-4 space-y-3">
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Genera un plan de preparación anticipada basado en el menú de esta semana.
                  </p>
                  <GenerateButton loading={loading} hasAiAccess={hasAiAccess} onClick={handleGenerateSimple} />
                </div>
              ) : (
                <>
                  {/* Sort toggle */}
                  <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5 w-fit">
                    {[{ id: 'groups', label: 'Por grupos' }, { id: 'chrono', label: 'Cronológico' }].map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setSortMode(opt.id)}
                        className={`text-xs px-3 py-1 rounded-md transition-colors ${
                          sortMode === opt.id ? 'bg-white text-gray-800 shadow-sm font-medium' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {sortMode === 'groups' ? (
                    <div className="space-y-5">
                      {sections.map(section => {
                        const tasks = section.tasks || [];
                        const sectionDone = tasks.filter(t => t.done).length;
                        return (
                          <div key={section.id}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm">{section.emoji}</span>
                              <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{section.title}</span>
                              {sectionDone === tasks.length && tasks.length > 0 && <span className="text-xs text-green-600">✓</span>}
                            </div>
                            <ul className="space-y-2 pl-1">
                              {tasks.map(task => (
                                <TaskRow key={task.id} task={task}
                                  onToggle={() => toggleSimpleTask(section.id, task.id)} />
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {chronoItems.map(task => (
                        <TaskRow key={task.id} task={task}
                          onToggle={() => toggleSimpleTask(
                            sections.find(s => s.tasks?.some(t => t.id === task.id))?.id,
                            task.id
                          )}
                          showSection
                        />
                      ))}
                    </ul>
                  )}

                  <RegenerateButton loading={loading} hasAiAccess={hasAiAccess} onClick={handleGenerateSimple} />
                </>
              )
            )}

            {/* ── OPTIMIZED MODE ── */}
            {mode === 'optimized' && (
              !hasOptimizedData ? (
                <div className="space-y-4">
                  <p className="text-xs text-gray-400">
                    Indica cuándo tienes tiempo para cocinar y la IA creará un plan optimizado con preparaciones paralelas.
                  </p>

                  {/* Time session inputs */}
                  <div className="space-y-3">
                    {timeSessions.map((session, idx) => (
                      <div key={idx} className="bg-gray-50 rounded-xl p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-gray-600">Sesión {idx + 1}</span>
                          {timeSessions.length > 1 && (
                            <button onClick={() => removeTimeSession(idx)} className="text-gray-300 hover:text-red-400 transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                        </div>
                        <select
                          value={session.day}
                          onChange={e => updateTimeSession(idx, 'day', e.target.value)}
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 text-gray-700"
                        >
                          <option value="">Día...</option>
                          {WEEK_DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                        <div className="flex gap-1 flex-wrap">
                          {DURATION_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              onClick={() => updateTimeSession(idx, 'duration', opt.value)}
                              className={`text-xs px-3 py-1 rounded-lg border font-medium transition-colors ${
                                session.duration === opt.value
                                  ? 'bg-brand-600 text-white border-brand-600'
                                  : 'bg-white text-gray-600 border-gray-200 hover:border-brand-400'
                              }`}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}

                    {timeSessions.length < 3 && (
                      <button
                        onClick={addTimeSession}
                        className="w-full border border-dashed border-gray-300 rounded-xl py-2 text-xs text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors"
                      >
                        + Añadir sesión
                      </button>
                    )}
                  </div>

                  <GenerateButton loading={loading} hasAiAccess={hasAiAccess} onClick={handleGenerateOptimized}
                    label="✨ Generar plan optimizado" />
                </div>
              ) : (
                <div className="space-y-6">
                  {optimizedSessions.map(session => {
                    const sessionTasks = session.packs?.flatMap(p => p.tasks || []) || [];
                    const sessionDone = sessionTasks.filter(t => t.done).length;
                    const totalTime = session.packs?.reduce((sum, p) => {
                      const packTime = Math.max(...(p.tasks || []).map(t => t.time || 0), 0);
                      return sum + (p.parallel ? packTime : (p.tasks || []).reduce((s, t) => s + (t.time || 0), 0));
                    }, 0) || 0;

                    return (
                      <div key={session.id}>
                        {/* Session header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold text-gray-800">📅 {session.day}</span>
                            <span className="text-xs text-gray-400">{formatDuration(session.duration)} disponibles</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {totalTime > 0 && (
                              <span className="text-xs text-gray-400">~{formatDuration(totalTime)} activos</span>
                            )}
                            {sessionDone === sessionTasks.length && sessionTasks.length > 0 && (
                              <span className="text-xs font-medium text-green-600">✓</span>
                            )}
                          </div>
                        </div>

                        {/* Packs */}
                        <div className="space-y-3 pl-1">
                          {(session.packs || []).map(pack => {
                            const packDone = (pack.tasks || []).filter(t => t.done).length;
                            const packTotal = (pack.tasks || []).length;
                            return (
                              <div key={pack.id} className={`rounded-xl border px-3 py-2.5 space-y-2 ${
                                packDone === packTotal && packTotal > 0
                                  ? 'bg-green-50 border-green-100'
                                  : 'bg-gray-50 border-gray-100'
                              }`}>
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-gray-700">{pack.label}</span>
                                  {pack.parallel && (
                                    <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">paralelo</span>
                                  )}
                                </div>
                                <ul className="space-y-2">
                                  {(pack.tasks || []).map(task => (
                                    <TaskRow key={task.id} task={task}
                                      onToggle={() => toggleOptimizedTask(session.id, pack.id, task.id)}
                                      showTime
                                    />
                                  ))}
                                </ul>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  <RegenerateButton loading={loading} hasAiAccess={hasAiAccess} onClick={handleGenerateOptimized}
                    label="↺ Regenerar" />
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Shared buttons ───────────────────────────────────────────────────────────

function GenerateButton({ loading, hasAiAccess, onClick, label = '✨ Generar plan' }) {
  return (
    <button
      onClick={onClick}
      disabled={loading || !hasAiAccess}
      title={!hasAiAccess ? 'Necesitas una API key o un código Friends & Family en Perfil' : undefined}
      className="flex items-center gap-2 mx-auto bg-brand-600 text-white text-xs font-medium px-4 py-2 rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading
        ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generando...</>
        : label}
    </button>
  );
}

function RegenerateButton({ loading, hasAiAccess, onClick, label = '↺ Regenerar' }) {
  return (
    <button
      onClick={onClick}
      disabled={loading || !hasAiAccess}
      title={!hasAiAccess ? 'Necesitas una API key o un código Friends & Family en Perfil' : undefined}
      className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-brand-600 transition-colors disabled:opacity-40"
    >
      {loading
        ? <><div className="w-3 h-3 border border-gray-300 border-t-brand-500 rounded-full animate-spin" /> Regenerando...</>
        : label}
    </button>
  );
}

// ─── Task row ─────────────────────────────────────────────────────────────────

function TaskRow({ task, onToggle, showSection, showTime }) {
  return (
    <li className="flex items-start gap-2.5">
      <button
        onClick={onToggle}
        className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
          task.done ? 'bg-brand-600 border-brand-600 text-white' : 'border-gray-300 hover:border-brand-400'
        }`}
      >
        {task.done && (
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span className={`text-sm leading-snug ${task.done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
            {showSection && task.sectionEmoji && <span className="mr-1">{task.sectionEmoji}</span>}
            {task.text}
          </span>
          {showTime && task.time > 0 && (
            <span className="text-[10px] text-gray-400 mt-0.5 shrink-0">{task.time}min</span>
          )}
        </div>
        {Array.isArray(task.days) && task.days.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {task.days.map(day => (
              <span key={day} className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${DAY_COLORS[day] || 'bg-gray-100 text-gray-600'}`}>
                {day}
              </span>
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

// ─── Error helper ─────────────────────────────────────────────────────────────

function handleError(err) {
  if (err.message === 'NO_API_KEY') return 'Añade tu API key en Perfil para usar esta función.';
  if (err.message === 'CALL_LIMIT_EXCEEDED') return 'Has alcanzado el límite mensual de llamadas. Auméntalo en Perfil.';
  if (err.message === 'FREE_QUOTA_EXCEEDED') return 'Has agotado las 30 llamadas gratuitas. Añade tu API key en Perfil.';
  return err.message || 'Error generando el batch cooking.';
}
