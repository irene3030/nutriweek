import { useState } from 'react';
import { useKPIs } from '../../hooks/useKPIs';
import { computeAdaptiveTargets, KPI_CATALOG, DEFAULT_KPI_CONFIG } from '../../lib/kpis';
import { fixKPI } from '../../lib/claude';
import { track } from '../../lib/analytics';

const MEAL_LABELS = {
  desayuno: 'Desayuno', snack: 'Snack', comida: 'Comida', merienda: 'Merienda', cena: 'Cena',
};

const PROTEIN_LABELS = { iron: 'hierro', fish: 'pescado', egg: 'huevo', legume: 'legumbre', dairy: 'lácteo' };

export default function WeekKPIs({ weekDoc, apiKey, hasAiAccess, onApplyFixes, kpiConfig, onUpdateKpiConfig }) {
  const config = {
    active: kpiConfig?.active ?? DEFAULT_KPI_CONFIG.active,
    targets: kpiConfig?.targets ?? {},
    custom: kpiConfig?.custom ?? [],
  };

  const kpis = useKPIs(weekDoc, config.custom);
  const { ironTarget, fishTarget, veggieTarget, legumeTarget, isAdapted } = computeAdaptiveTargets(weekDoc, config.targets);

  const [fixing, setFixing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fixes, setFixes] = useState(null);
  const [error, setError] = useState(null);
  const [showLibrary, setShowLibrary] = useState(false);

  // --- status helpers ---
  function getStatus(value, target) {
    if (target === null) return null;
    if (value >= target) return 'good';
    if (value >= Math.ceil(target * 0.6)) return 'warning';
    return 'bad';
  }

  const ironStatus = getStatus(kpis.ironDays, ironTarget);
  const fishStatus = getStatus(kpis.fishDays, fishTarget);
  const veggieStatus = getStatus(kpis.distinctVeggies, veggieTarget);
  const legumeStatus = getStatus(kpis.legumedDays, legumeTarget);
  const fruitTarget = config.targets.fruit ?? 5;
  const fruitStatus = getStatus(kpis.fruitDays, fruitTarget);

  const statusColors = {
    good:    'text-green-700 bg-green-50 border-green-200',
    warning: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    bad:     'text-red-700 bg-red-50 border-red-200',
  };

  // --- fix handler ---
  const handleFix = async (kpiType) => {
    if (fixing === kpiType) { setFixing(null); setFixes(null); setError(null); return; }
    setFixing(kpiType);
    setFixes(null);
    setError(null);
    setLoading(true);
    try {
      const kpiState =
        kpiType === 'iron'   ? { current: kpis.ironDays,       target: ironTarget } :
        kpiType === 'fish'   ? { current: kpis.fishDays,       target: fishTarget } :
        kpiType === 'legume' ? { current: kpis.legumedDays,    target: legumeTarget } :
        { current: kpis.distinctVeggies, existing: kpis.veggieList, target: veggieTarget };

      const activeTipos = [...new Set(
        (weekDoc?.days || []).flatMap(day =>
          (day.meals || []).filter(m => m.baby).map(m => m.tipo)
        )
      )];

      const result = await fixKPI({ kpiType, weekContext: weekDoc.days, kpiState, activeTipos, apiKey });
      const validFixes = (result.fixes || []).filter(f => activeTipos.includes(f.tipo));
      setFixes(validFixes);
      track('kpi_fix_proposed', { kpiType, fixCount: result.fixes?.length || 0 });
    } catch (err) {
      setError(
        err.message === 'NO_API_KEY' ? 'Necesitas una API key o código F&F en Perfil.' :
        err.message === 'FREE_QUOTA_EXCEEDED' ? 'Has agotado las llamadas gratuitas.' :
        err.message === 'CALL_LIMIT_EXCEEDED' ? 'Has alcanzado el límite mensual.' :
        'Error generando la corrección.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (!fixes?.length) return;
    onApplyFixes(fixes.map(f => ({ day: f.day, tipo: f.tipo, baby: f.baby, tags: f.tags || [] })));
    track('kpi_fix_applied', { kpiType: fixing, fixCount: fixes.length });
    setFixing(null);
    setFixes(null);
  };

  const handleDiscard = () => { setFixing(null); setFixes(null); setError(null); };

  // Build the ordered list of active KPI pills to render
  const activeCatalogKPIs = KPI_CATALOG.filter(k => config.active.includes(k.id));
  const activeCustomKPIs = config.custom.filter(k => config.active.includes(k.id));

  // Tooltip detail content for each KPI
  const ironDetail = (weekDoc?.days || []).flatMap(d =>
    (d.meals || []).filter(m => m.baby && m.tags?.includes('iron')).map(m => `${d.day} · ${MEAL_LABELS[m.tipo]}`)
  ).join('\n') || null;
  const fishDetail = (weekDoc?.days || []).flatMap(d =>
    (d.meals || []).filter(m => m.baby && m.tags?.includes('fish')).map(m => `${d.day} · ${MEAL_LABELS[m.tipo]}`)
  ).join('\n') || null;
  const legumeDetail = (weekDoc?.days || []).flatMap(d =>
    (d.meals || []).filter(m => m.baby && m.tags?.includes('legume')).map(m => `${d.day} · ${MEAL_LABELS[m.tipo]}`)
  ).join('\n') || null;
  const veggieDetail = kpis.veggieList.length > 0 ? kpis.veggieList.join(', ') : null;

  return (
    <div className="px-4 py-3 space-y-2">
      {/* Title */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">KPIs nutricionales</span>
        <div className="relative group">
          <svg className="w-3.5 h-3.5 text-gray-400 cursor-help" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="absolute bottom-full left-0 mb-1.5 px-2 py-1.5 bg-gray-800 text-white text-xs rounded-lg w-56 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
            Los targets se adaptan automáticamente a las franjas activas del menú
            <div className="absolute top-full left-3 border-4 border-transparent border-t-gray-800" />
          </div>
        </div>
      </div>

      {/* KPI Pills */}
      <div data-tour="kpi-pills" className="flex flex-wrap gap-2 items-center">
        {activeCatalogKPIs.map(k => {
          if (k.id === 'iron') return (
            <KPIPill key="iron"
              icon="🩸" label="Hierro" value={`${kpis.ironDays}/${ironTarget ?? '–'}`} target={ironTarget ? `≥${ironTarget} días` : '–'}
              status={ironStatus} statusColors={statusColors}
              disabled={ironStatus === null}
              disabledTooltip="Solo aplica cuando el menú tiene comidas principales (comida o cena)"
              tooltip={ironDetail}
              onFix={hasAiAccess && ironStatus !== null ? () => handleFix('iron') : null}
              fixing={fixing === 'iron'} loading={loading && fixing === 'iron'}
            />
          );
          if (k.id === 'fish') return (
            <KPIPill key="fish"
              icon="🐟" label="Pesc. graso" value={`${kpis.fishDays}/${fishTarget ?? '–'}`} target={fishTarget ? `≥${fishTarget} días` : '–'}
              status={fishStatus} statusColors={statusColors}
              disabled={fishStatus === null}
              disabledTooltip="Solo aplica cuando el menú tiene comidas principales (comida o cena)"
              tooltip={fishDetail}
              onFix={hasAiAccess && fishStatus !== null ? () => handleFix('fish') : null}
              fixing={fixing === 'fish'} loading={loading && fixing === 'fish'}
            />
          );
          if (k.id === 'veggie') return (
            <KPIPill key="veggie"
              icon="🥦" label="Verduras" value={`${kpis.distinctVeggies} distintas`} target={`≥${veggieTarget} tipos`}
              status={veggieStatus} statusColors={statusColors}
              tooltip={veggieDetail}
              onFix={hasAiAccess ? () => handleFix('veggie') : null}
              fixing={fixing === 'veggie'} loading={loading && fixing === 'veggie'}
            />
          );
          if (k.id === 'legume') return (
            <KPIPill key="legume"
              icon="🟢" label="Legumbres" value={`${kpis.legumedDays}/${legumeTarget}`} target={`≥${legumeTarget} días`}
              status={legumeStatus} statusColors={statusColors}
              tooltip={legumeDetail}
              onFix={hasAiAccess ? () => handleFix('legume') : null}
              fixing={fixing === 'legume'} loading={loading && fixing === 'legume'}
            />
          );
          if (k.id === 'fruit') return (
            <KPIPill key="fruit"
              icon="🍎" label="Fruta" value={`${kpis.fruitDays}/${fruitTarget}`} target={`≥${fruitTarget} días`}
              status={fruitStatus} statusColors={statusColors}
            />
          );
          if (k.id === 'protein_rotation') {
            const alertCount = kpis.consecutiveAlerts.length;
            const rotStatus = alertCount === 0 ? 'good' : 'warning';
            return (
              <KPIPill key="protein_rotation"
                icon="🔄" label="Rotación" value={alertCount === 0 ? 'OK' : `${alertCount} alerta${alertCount > 1 ? 's' : ''}`} target="sin repetir >2 días"
                status={rotStatus} statusColors={statusColors}
              />
            );
          }
          return null;
        })}

        {/* Custom KPI pills */}
        {activeCustomKPIs.map(k => {
          const val = kpis.customResults?.[k.id] ?? 0;
          const tgt = config.targets[k.id] ?? k.target ?? 3;
          const st = getStatus(val, tgt);
          return (
            <KPIPill key={k.id}
              icon="⭐" label={k.name} value={`${val}/${tgt}`} target={`≥${tgt} días`}
              status={st} statusColors={statusColors}
            />
          );
        })}

        {/* Library button */}
        {onUpdateKpiConfig && (
          <button
            onClick={() => setShowLibrary(true)}
            className="flex items-center gap-1 border border-dashed border-gray-300 rounded-full px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors"
            title="Gestionar KPIs"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            KPIs
          </button>
        )}
      </div>

      {/* Protein rotation alerts (when KPI active) */}
      {config.active.includes('protein_rotation') && kpis.consecutiveAlerts.length > 0 && (
        <div className="space-y-1">
          {kpis.consecutiveAlerts.map((alert, i) => (
            <p key={i} className="text-xs text-amber-600">
              ⚠ {PROTEIN_LABELS[alert.protein] || alert.protein} aparece {alert.count} días seguidos desde {alert.startDay}
            </p>
          ))}
        </div>
      )}

      {/* Fix panel */}
      {fixing && (
        <div className="bg-white border border-gray-200 rounded-xl p-3 space-y-3">
          {loading && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <div className="w-3.5 h-3.5 border-2 border-gray-200 border-t-brand-500 rounded-full animate-spin" />
              Buscando corrección...
            </div>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}

          {fixes && fixes.length === 0 && (
            <p className="text-xs text-gray-500">No se encontraron cambios necesarios.</p>
          )}

          {fixes && fixes.length > 0 && (
            <>
              <p className="text-xs font-medium text-gray-700">
                {fixes.length === 1 ? 'Cambio propuesto:' : `${fixes.length} cambios propuestos:`}
              </p>
              <ul className="space-y-2">
                {fixes.map((fix, i) => (
                  <li key={i} className="text-xs bg-brand-50 border border-brand-100 rounded-lg px-3 py-2">
                    <span className="font-semibold text-brand-700">{fix.day} · {MEAL_LABELS[fix.tipo] || fix.tipo}</span>
                    <p className="text-gray-700 mt-0.5 leading-snug">{fix.baby}</p>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <button onClick={handleDiscard} className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-1.5 text-xs hover:bg-gray-50 transition-colors">
                  Descartar
                </button>
                <button onClick={handleApply} className="flex-1 bg-brand-600 text-white rounded-lg py-1.5 text-xs font-medium hover:bg-brand-700 transition-colors">
                  Aplicar cambios
                </button>
              </div>
            </>
          )}

          {!loading && !error && !fixes && (
            <button onClick={handleDiscard} className="text-xs text-gray-400 hover:text-gray-600">Cancelar</button>
          )}
        </div>
      )}

      {/* KPI Library modal */}
      {showLibrary && (
        <KPILibrary
          config={config}
          onSave={(newConfig) => { onUpdateKpiConfig?.(newConfig); setShowLibrary(false); }}
          onClose={() => setShowLibrary(false)}
        />
      )}
    </div>
  );
}

// ─── KPI Pill ───────────────────────────────────────────────────────────────

function KPIPill({ icon, label, value, target, status, statusColors, onFix, fixing, loading, disabled, disabledTooltip, tooltip }) {
  if (disabled) {
    return (
      <div className="relative group">
        <div className="flex items-center gap-1.5 border rounded-full px-3 py-1.5 text-gray-400 bg-gray-50 border-gray-200 opacity-50 cursor-default">
          <span className="text-sm">{icon}</span>
          <span className="text-xs font-semibold">{label}</span>
        </div>
        {disabledTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10">
            {disabledTooltip}
            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
          </div>
        )}
      </div>
    );
  }
  const canFix = onFix && status !== 'good';
  return (
    <div className="relative group">
      <div className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 ${statusColors[status]}`}>
        <span className="text-sm">{icon}</span>
        <span className="text-xs font-semibold">{label}</span>
        <span className="text-xs font-bold">{value}</span>
        <span className="text-xs opacity-60">({target})</span>
        {canFix && (
          <button
            onClick={onFix}
            className={`ml-0.5 text-xs transition-opacity ${fixing ? 'opacity-60' : 'hover:opacity-80'}`}
            title="Corregir con IA"
          >
            {loading ? '...' : fixing ? '✕' : '✨'}
          </button>
        )}
      </div>
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 whitespace-pre-wrap text-left" style={{ minWidth: '100px', maxWidth: '200px' }}>
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
        </div>
      )}
    </div>
  );
}

// ─── KPI Library ─────────────────────────────────────────────────────────────

function KPILibrary({ config, onSave, onClose }) {
  const [draft, setDraft] = useState(() => ({
    active: [...config.active],
    targets: { ...config.targets },
    custom: config.custom.map(k => ({ ...k })),
  }));
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customQuery, setCustomQuery] = useState('');
  const [customTarget, setCustomTarget] = useState('3');
  const [editingTarget, setEditingTarget] = useState(null);
  const [targetInput, setTargetInput] = useState('');

  const isDirty = JSON.stringify(draft) !== JSON.stringify(config);

  const toggleKPI = (id) => {
    setDraft(d => ({
      ...d,
      active: d.active.includes(id) ? d.active.filter(a => a !== id) : [...d.active, id],
    }));
  };

  const commitTarget = (id) => {
    const num = parseInt(targetInput, 10);
    if (!isNaN(num) && num >= 1) {
      setDraft(d => ({ ...d, targets: { ...d.targets, [id]: num } }));
    }
    setEditingTarget(null);
  };

  const handleAddCustom = () => {
    if (!customName.trim() || !customQuery.trim()) return;
    const id = `custom_${Date.now()}`;
    setDraft(d => ({
      ...d,
      custom: [...d.custom, { id, name: customName.trim(), query: customQuery.trim(), target: parseInt(customTarget, 10) || 3 }],
      active: [...d.active, id],
    }));
    setCustomName(''); setCustomQuery(''); setCustomTarget('3');
    setShowAddCustom(false);
  };

  const removeCustomKPI = (id) => {
    setDraft(d => ({
      ...d,
      custom: d.custom.filter(k => k.id !== id),
      active: d.active.filter(a => a !== id),
    }));
  };

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 bg-white rounded-t-2xl shadow-xl max-h-[80vh] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-200 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-4 pb-3">
          <h2 className="font-semibold text-gray-900">Biblioteca de KPIs</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto px-4 space-y-4 flex-1 pb-4">
          {/* Catalog KPIs */}
          <div className="space-y-2">
            {KPI_CATALOG.map(k => {
              const isActive = draft.active.includes(k.id);
              const currentTarget = draft.targets[k.id] ?? k.defaultTarget;
              const isEditingThis = editingTarget === k.id;

              return (
                <div key={k.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${isActive ? 'bg-brand-50 border-brand-200' : 'bg-gray-50 border-gray-100'}`}>
                  <span className="text-xl mt-0.5">{k.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">{k.label}</p>
                    <p className="text-xs text-gray-400 leading-snug">{k.description}</p>
                    {isActive && k.unit !== 'alertas' && (
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-gray-500">Objetivo:</span>
                        {isEditingThis ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number" min={1} max={7}
                              value={targetInput}
                              onChange={e => setTargetInput(e.target.value)}
                              className="w-14 text-xs border border-brand-300 rounded-lg px-2 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-brand-400"
                              autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') commitTarget(k.id); if (e.key === 'Escape') setEditingTarget(null); }}
                            />
                            <span className="text-xs text-gray-500">{k.unit}</span>
                            <button onClick={() => commitTarget(k.id)} className="text-xs text-brand-600 font-medium hover:text-brand-700">✓</button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setEditingTarget(k.id); setTargetInput(String(currentTarget)); }}
                            className="text-xs text-brand-600 font-medium hover:underline"
                          >
                            {currentTarget} {k.unit}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => toggleKPI(k.id)}
                    className={`shrink-0 w-10 h-6 rounded-full transition-colors relative ${isActive ? 'bg-brand-600' : 'bg-gray-200'}`}
                    aria-label={isActive ? 'Desactivar' : 'Activar'}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isActive ? 'translate-x-5' : 'translate-x-1'}`} />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Custom KPIs */}
          {draft.custom.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Personalizados</p>
              {draft.custom.map(k => {
                const isActive = draft.active.includes(k.id);
                const currentTarget = draft.targets[k.id] ?? k.target ?? 3;
                const isEditingThis = editingTarget === k.id;
                return (
                  <div key={k.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${isActive ? 'bg-brand-50 border-brand-200' : 'bg-gray-50 border-gray-100'}`}>
                    <span className="text-xl mt-0.5">⭐</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{k.name}</p>
                      <p className="text-xs text-gray-400">busca: "{k.query}"</p>
                      {isActive && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-xs text-gray-500">Objetivo:</span>
                          {isEditingThis ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number" min={1} max={7}
                                value={targetInput}
                                onChange={e => setTargetInput(e.target.value)}
                                className="w-14 text-xs border border-brand-300 rounded-lg px-2 py-0.5 text-center focus:outline-none focus:ring-1 focus:ring-brand-400"
                                autoFocus
                                onKeyDown={e => { if (e.key === 'Enter') commitTarget(k.id); if (e.key === 'Escape') setEditingTarget(null); }}
                              />
                              <span className="text-xs text-gray-500">días</span>
                              <button onClick={() => commitTarget(k.id)} className="text-xs text-brand-600 font-medium hover:text-brand-700">✓</button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditingTarget(k.id); setTargetInput(String(currentTarget)); }} className="text-xs text-brand-600 font-medium hover:underline">
                              {currentTarget} días
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => toggleKPI(k.id)}
                        className={`w-10 h-6 rounded-full transition-colors relative ${isActive ? 'bg-brand-600' : 'bg-gray-200'}`}
                      >
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isActive ? 'translate-x-5' : 'translate-x-1'}`} />
                      </button>
                      <button onClick={() => removeCustomKPI(k.id)} className="text-gray-300 hover:text-red-400 transition-colors" title="Eliminar">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add custom KPI */}
          {!showAddCustom ? (
            <button
              onClick={() => setShowAddCustom(true)}
              className="w-full border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Añadir KPI personalizado
            </button>
          ) : (
            <div className="border border-brand-200 bg-brand-50 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Nuevo KPI personalizado</p>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Nombre</label>
                <input
                  type="text" value={customName} onChange={e => setCustomName(e.target.value)}
                  placeholder="Ej: Aguacate"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Buscar en menú</label>
                <input
                  type="text" value={customQuery} onChange={e => setCustomQuery(e.target.value)}
                  placeholder="Ej: aguacate"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                />
                <p className="text-xs text-gray-400 mt-1">Cuenta los días en que este alimento aparece en el menú</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Objetivo (días/semana)</label>
                <input
                  type="number" min={1} max={7} value={customTarget} onChange={e => setCustomTarget(e.target.value)}
                  className="w-20 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowAddCustom(false)} className="flex-1 border border-gray-300 text-gray-600 rounded-xl py-2 text-sm hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
                <button
                  onClick={handleAddCustom}
                  disabled={!customName.trim() || !customQuery.trim()}
                  className="flex-1 bg-brand-600 text-white rounded-xl py-2 text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
                >
                  Añadir
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Save button — sticky at bottom */}
        <div className={`px-4 py-3 border-t border-gray-100 transition-all ${isDirty ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
          <button
            onClick={() => onSave(draft)}
            className="w-full bg-brand-600 text-white rounded-xl py-3 text-sm font-semibold hover:bg-brand-700 transition-colors"
          >
            Guardar cambios
          </button>
        </div>
      </div>
    </>
  );
}
