import { useState } from 'react';
import { generateMealPrep } from '../../lib/claude';
import { track } from '../../lib/analytics';
import { ChefHat, Plus, Trash2, Check, Sparkles, RotateCcw, Clock, Zap, ChevronDown, ChevronUp } from 'lucide-react';

const DAY_ORDER = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const WEEK_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
const DURATION_OPTIONS = [
  { value: 30, label: '30 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 h' },
  { value: 90, label: '1 h 30' },
  { value: 120, label: '2 h' },
];

const TIPO_LABELS = { desayuno: 'Desayuno', snack: 'Snack', comida: 'Comida', merienda: 'Merienda', cena: 'Cena' };

function formatDuration(minutes) {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

function BadgePill({ type }) {
  if (type === 'resolved_meal') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-100 text-green-700 border border-green-200 uppercase tracking-wide shrink-0">
        Resuelta
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200 uppercase tracking-wide shrink-0">
      Acelerador
    </span>
  );
}

function ImpactedSlots({ slots }) {
  if (!slots?.length) return null;
  return (
    <span className="text-xs text-gray-400">
      → {slots.map(s => `${s.day} ${TIPO_LABELS[s.tipo] || s.tipo}`).join(' · ')}
    </span>
  );
}

export default function MealPrep({ weekDoc, hasAiAccess, onUpdate }) {
  const [open, setOpen] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [prepWindows, setPrepWindows] = useState([
    { day: 'Domingo', durationMinutes: 120 },
  ]);
  const [newWindow, setNewWindow] = useState({ day: 'Lunes', durationMinutes: 60 });
  const [maxResolvedUses, setMaxResolvedUses] = useState(3);

  const mealPrep = weekDoc?.mealPrep || null;
  const hasPlan = !!mealPrep?.sessions?.length;

  function buildWeekMenu() {
    if (!weekDoc?.days) return [];
    return [...weekDoc.days]
      .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day))
      .map(day => ({
        day: day.day,
        meals: (day.meals || []).filter(m => m.baby).map(m => ({
          tipo: m.tipo,
          baby: m.baby,
          tags: m.tags || [],
          repeatability_score: m.repeatability_score || 'medium',
        })),
      }));
  }

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const result = await generateMealPrep({
        weekMenu: buildWeekMenu(),
        prepWindows,
        maxResolvedUses,
      });
      const newMealPrep = {
        ...result,
        generatedAt: new Date().toISOString(),
        config: { prepWindows, maxResolvedUses },
      };
      await onUpdate(newMealPrep);
      setShowConfig(false);
      track('ai_meal_prep_generated');
    } catch (err) {
      setError(
        err.message === 'CALL_LIMIT_EXCEEDED' ? 'Has alcanzado el límite mensual de llamadas.' :
        err.message === 'FREE_QUOTA_EXCEEDED' ? 'Has agotado las llamadas gratuitas.' :
        err.message || 'Error generando el plan de prep.'
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleTaskDone(sessionId, taskId) {
    if (!mealPrep) return;
    const updated = {
      ...mealPrep,
      sessions: mealPrep.sessions.map(s =>
        s.id !== sessionId ? s : {
          ...s,
          tasks: s.tasks.map(t =>
            t.id !== taskId ? t : { ...t, done: !t.done }
          ),
        }
      ),
    };
    onUpdate(updated);
  }

  function addWindow() {
    if (!newWindow.day) return;
    setPrepWindows(prev => [...prev.filter(w => w.day !== newWindow.day), { ...newWindow }]);
  }

  function removeWindow(day) {
    setPrepWindows(prev => prev.filter(w => w.day !== day));
  }

  const summary = mealPrep?.summary;

  return (
    <div className="px-4 pb-4">
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <ChefHat className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-semibold text-gray-800">Plan de prep</span>
            {hasPlan && summary && (
              <div className="flex items-center gap-1.5 ml-1">
                <span className="text-xs text-green-600 font-medium bg-green-50 border border-green-200 rounded px-1.5 py-0.5">
                  {summary.resolvedCount} resueltas
                </span>
                <span className="text-xs text-orange-600 font-medium bg-orange-50 border border-orange-200 rounded px-1.5 py-0.5">
                  {summary.acceleratedCount} aceleradas
                </span>
                {summary.totalMinutesSaved > 0 && (
                  <span className="text-xs text-gray-400">· ~{summary.totalMinutesSaved} min ahorrados</span>
                )}
              </div>
            )}
          </div>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {open && (
          <div className="border-t border-gray-100">
            {/* Config panel */}
            {(!hasPlan || showConfig) && (
              <div className="p-4 space-y-4">
                {/* Prep windows */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ventanas de preparación <span className="font-normal text-gray-400">(opcional)</span>
                  </label>
                  <p className="text-xs text-gray-400 mb-2">
                    Si no añades ninguna, el plan generará una única sesión de inicio de semana.
                  </p>

                  {prepWindows.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {prepWindows.map(w => (
                        <span key={w.day} className="flex items-center gap-1.5 bg-brand-50 text-brand-700 border border-brand-200 rounded px-2.5 py-1 text-xs">
                          {w.day} · {formatDuration(w.durationMinutes)}
                          <button onClick={() => removeWindow(w.day)} className="hover:text-red-500 transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    <select
                      value={newWindow.day}
                      onChange={e => setNewWindow(p => ({ ...p, day: e.target.value }))}
                      className="border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                    >
                      {WEEK_DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    <select
                      value={newWindow.durationMinutes}
                      onChange={e => setNewWindow(p => ({ ...p, durationMinutes: Number(e.target.value) }))}
                      className="border border-gray-300 rounded-lg px-2 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
                    >
                      {DURATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={addWindow}
                      className="flex items-center gap-1 text-xs px-3 py-2 bg-brand-50 text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-100 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Añadir
                    </button>
                  </div>
                </div>

                {/* Max resolved uses */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Máx. usos por comida resuelta
                  </label>
                  <div className="flex gap-2">
                    {[2, 3].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setMaxResolvedUses(n)}
                        className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                          maxResolvedUses === n
                            ? 'border-brand-400 bg-brand-50 text-brand-700'
                            : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        {n} veces
                      </button>
                    ))}
                  </div>
                </div>

                {error && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                    {error}
                  </div>
                )}

                <div className="flex gap-2">
                  {hasPlan && showConfig && (
                    <button
                      onClick={() => setShowConfig(false)}
                      className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
                    >
                      Cancelar
                    </button>
                  )}
                  <button
                    onClick={handleGenerate}
                    disabled={loading || !hasAiAccess}
                    className="flex-1 bg-brand-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-brand-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generando...</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> {hasPlan ? 'Regenerar plan' : 'Generar plan de prep'}</>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Generated plan */}
            {hasPlan && !showConfig && (
              <div className="divide-y divide-gray-100">
                {/* Summary banner */}
                {summary && (
                  <div className="px-4 py-3 bg-gray-50 flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="text-xs text-gray-500">
                        <span className="font-medium text-green-700">{summary.resolvedCount} comidas resueltas</span>
                        {' · '}
                        <span className="font-medium text-orange-700">{summary.acceleratedCount} aceleradas</span>
                        {summary.totalMinutesSaved > 0 && (
                          <> · <Clock className="w-3 h-3 inline" /> ~{summary.totalMinutesSaved} min ahorrados</>
                        )}
                        {' · '}
                        {summary.sessionCount} {summary.sessionCount === 1 ? 'sesión' : 'sesiones'}
                      </span>
                    </div>
                    <button
                      onClick={() => setShowConfig(true)}
                      className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-600 transition-colors"
                    >
                      <RotateCcw className="w-3 h-3" /> Regenerar
                    </button>
                  </div>
                )}

                {/* Sessions */}
                {mealPrep.sessions.map((session, si) => {
                  const totalTime = session.tasks?.reduce((acc, t) => acc + (t.durationMinutes || 0), 0) || 0;
                  const doneTasks = session.tasks?.filter(t => t.done).length || 0;
                  const allDone = doneTasks === (session.tasks?.length || 0) && doneTasks > 0;

                  return (
                    <div key={session.id} className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded ${allDone ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                            Sesión {si + 1}
                          </span>
                          <span className="text-sm font-medium text-gray-800">{session.day}</span>
                          {session.durationMinutes && (
                            <span className="text-xs text-gray-400">· {formatDuration(session.durationMinutes)}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Zap className="w-3 h-3 text-gray-300" />
                          <span className="text-xs text-gray-400">{formatDuration(totalTime)} activos</span>
                          {doneTasks > 0 && (
                            <span className="text-xs text-gray-400 ml-1">· {doneTasks}/{session.tasks?.length} hechas</span>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {(session.tasks || []).map(task => (
                          <div
                            key={task.id}
                            className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                              task.done ? 'border-gray-100 bg-gray-50 opacity-60' : 'border-gray-200 bg-white'
                            }`}
                          >
                            <button
                              onClick={() => toggleTaskDone(session.id, task.id)}
                              className={`shrink-0 mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                task.done
                                  ? 'bg-green-500 border-green-500 text-white'
                                  : 'border-gray-300 hover:border-brand-400'
                              }`}
                            >
                              {task.done && <Check className="w-3 h-3" />}
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <BadgePill type={task.type} />
                                <span className={`text-sm font-medium ${task.done ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                                  {task.name}
                                </span>
                                <span className="text-xs text-gray-400 shrink-0">
                                  {formatDuration(task.durationMinutes)}
                                </span>
                              </div>
                              <div className="flex items-center gap-3 flex-wrap">
                                <ImpactedSlots slots={task.impactedSlots} />
                                <span className="text-xs text-gray-300">·</span>
                                <span className="text-xs text-gray-400">
                                  {task.type === 'resolved_meal'
                                    ? `${task.outputServings || '?'} raciones`
                                    : `${task.outputUses || '?'} usos`}
                                  {' · '}
                                  {task.daysFresh}d nevera
                                </span>
                                {task.minutesSaved > 0 && (
                                  <>
                                    <span className="text-xs text-gray-300">·</span>
                                    <span className="text-xs text-green-600 font-medium">
                                      ahorra ~{task.minutesSaved} min
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
