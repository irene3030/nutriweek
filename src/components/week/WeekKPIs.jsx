import { useState, useMemo, useEffect } from 'react';
import { useKPIs } from '../../hooks/useKPIs';
import { computeAdaptiveTargets, calculateDailyCompliance, KPI_CATALOG, DEFAULT_KPI_CONFIG } from '../../lib/kpis';
import { fixKPI } from '../../lib/claude';
import { track } from '../../lib/analytics';
import { Droplets, Fish, Leaf, Bean, Apple, RefreshCw, Star, AlertTriangle, Sparkles, X, Check } from 'lucide-react';

const MEAL_LABELS = {
  desayuno: 'Desayuno', snack: 'Snack', comida: 'Comida', merienda: 'Merienda', cena: 'Cena',
};

const PROTEIN_LABELS = { iron: 'hierro', fish: 'pescado', egg: 'huevo', legume: 'legumbre', dairy: 'lácteo' };

export default function WeekKPIs({ weekDoc, apiKey, hasAiAccess, onApplyFixes, onFixesChange, kpiConfig, onUpdateKpiConfig }) {
  const config = {
    active: kpiConfig?.active ?? DEFAULT_KPI_CONFIG.active,
    targets: kpiConfig?.targets ?? {},
    qualities: kpiConfig?.qualities ?? {},
    frequencies: { ...DEFAULT_KPI_CONFIG.frequencies, ...(kpiConfig?.frequencies ?? {}) },
    custom: kpiConfig?.custom ?? [],
  };

  const kpis = useKPIs(weekDoc, config.custom);
  const { ironTarget, fishTarget, veggieTarget, legumeTarget, isAdapted } = computeAdaptiveTargets(weekDoc, config.targets);
  const dailyCompliance = useMemo(() => calculateDailyCompliance(weekDoc, config), [weekDoc, config]);

  const [fixing, setFixing] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fixes, setFixes] = useState(null);
  const [error, setError] = useState(null);
  const [showLibrary, setShowLibrary] = useState(false);

  useEffect(() => {
    onFixesChange?.(fixes?.length ? fixes.map(f => ({ day: f.day, tipo: f.tipo })) : null);
  }, [fixes]);

  // --- status helpers ---
  function getStatusWithQuality(value, target, quality = 'mínimo') {
    if (target === null || target === undefined) return null;
    if (quality === 'máximo') {
      if (value <= target) return 'good';
      if (value <= Math.round(target * 1.4)) return 'warning';
      return 'bad';
    }
    if (quality === 'exacto') {
      if (value === target) return 'good';
      if (Math.abs(value - target) <= 1) return 'warning';
      return 'bad';
    }
    if (value >= target) return 'good';
    if (value >= Math.ceil(target * 0.6)) return 'warning';
    return 'bad';
  }

  function getDailyStatus(compliant, total) {
    if (!total) return null;
    if (compliant >= total) return 'good';
    if (compliant >= total - 2) return 'warning';
    return 'bad';
  }

  function getCatalogStatus(id, weeklyValue, weeklyTarget) {
    const freq = config.frequencies[id] || 'semanal';
    if (freq === 'diario') {
      const dc = dailyCompliance[id];
      return dc ? getDailyStatus(dc.compliant, dc.total) : null;
    }
    return getStatusWithQuality(weeklyValue, weeklyTarget, config.qualities[id] ?? 'mínimo');
  }

  function getPillValueTarget(id, weeklyValue, weeklyTarget, weeklyUnit = 'días') {
    const freq = config.frequencies[id] || 'semanal';
    const quality = config.qualities[id] ?? 'mínimo';
    const qualPrefix = quality === 'máximo' ? '≤' : quality === 'exacto' ? '=' : '≥';
    if (freq === 'diario') {
      const dc = dailyCompliance[id];
      const catalogEntry = KPI_CATALOG.find(k => k.id === id);
      const targetLabel = catalogEntry?.unit === 'al día' ? '1 al día' : `${qualPrefix}${weeklyTarget ?? '–'} días`;
      return {
        value: dc ? `${dc.compliant}/${dc.total} días` : '–',
        target: targetLabel,
      };
    }
    return {
      value: `${weeklyValue}/${weeklyTarget ?? '–'}`,
      target: `${qualPrefix}${weeklyTarget ?? '–'} ${weeklyUnit}`,
    };
  }

  const fruitTarget = config.targets.fruit ?? 5;

  const ironStatus = getCatalogStatus('iron', kpis.ironDays, ironTarget);
  const fishStatus = getCatalogStatus('fish', kpis.fishDays, fishTarget);
  const veggieStatus = getCatalogStatus('veggie', kpis.distinctVeggies, veggieTarget);
  const legumeStatus = getCatalogStatus('legume', kpis.legumedDays, legumeTarget);
  const fruitStatus = getCatalogStatus('fruit', kpis.fruitDays, fruitTarget);

  const statusColors = {
    good:    'text-green-700 bg-green-50 border-green-200',
    warning: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    bad:     'text-red-700 bg-red-50 border-red-200',
  };

  // --- helpers ---
  const DAY_ORDER = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

  function futureDays(days) {
    const mondayDate = weekDoc?.mondayDate;
    if (!mondayDate) return days;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return days.filter(d => {
      const idx = DAY_ORDER.indexOf(d.day);
      if (idx === -1) return true;
      const date = new Date(mondayDate);
      date.setDate(date.getDate() + idx);
      return date >= today;
    });
  }

  // --- fix handler ---
  const handleFix = async (kpiType) => {
    if (fixing === kpiType) { setFixing(null); setFixes(null); setError(null); return; }
    setFixing(kpiType);
    setFixes(null);
    setError(null);
    setLoading(true);
    try {
      const customKPI = config.custom.find(k => k.id === kpiType);
      const kpiState =
        kpiType === 'iron'             ? { compliant: dailyCompliance.iron?.compliant ?? kpis.ironDays, total: dailyCompliance.iron?.total ?? 7, missingDays: (weekDoc?.days || []).filter(d => !d.meals?.some(m => (m.track?.tags ?? m.tags ?? []).includes('iron'))).map(d => d.day) } :
        kpiType === 'fish'             ? { current: kpis.fishDays,       target: fishTarget } :
        kpiType === 'legume'           ? { current: kpis.legumedDays,    target: legumeTarget } :
        kpiType === 'veggie'           ? { current: kpis.distinctVeggies, existing: kpis.veggieList, target: veggieTarget } :
        kpiType === 'fruit'            ? { current: kpis.fruitDays,      target: fruitTarget } :
        kpiType === 'protein_rotation' ? { alerts: kpis.consecutiveAlerts } :
        customKPI                      ? { current: kpis.customResults?.[kpiType] ?? 0, target: config.targets[kpiType] ?? customKPI.target ?? 3, name: customKPI.name, query: customKPI.query } :
        null;

      const activeTipos = [...new Set(
        (weekDoc?.days || []).flatMap(day =>
          (day.meals || []).filter(m => m.baby).map(m => m.tipo)
        )
      )];

      const allKpiStates = [
        config.active.includes('iron') ? `Hierro ${dailyCompliance.iron ? `${dailyCompliance.iron.compliant}/${dailyCompliance.iron.total} días (objetivo: 1 al día)` : `${kpis.ironDays} días`}` : null,
        config.active.includes('fish') && fishTarget ? `Pescado graso ${kpis.fishDays}/${fishTarget} días` : null,
        config.active.includes('legume') ? `Legumbres ${kpis.legumedDays}/${legumeTarget} días` : null,
        config.active.includes('veggie') ? `Verduras distintas ${kpis.distinctVeggies}/${veggieTarget} tipos` : null,
        config.active.includes('fruit') ? `Fruta ${kpis.fruitDays}/${fruitTarget} días` : null,
        ...activeCustomKPIs.map(k => `${k.name} ${kpis.customResults?.[k.id] ?? 0}/${config.targets[k.id] ?? k.target ?? 3} días`),
      ].filter(Boolean);

      const result = await fixKPI({ kpiType, weekContext: futureDays(weekDoc.days), kpiState, activeTipos, allKpiStates, apiKey });
      const validFixes = (result.fixes || []).filter(f => {
        if (!activeTipos.includes(f.tipo)) return false;
        const originalDay = weekDoc?.days?.find(d => d.day === f.day);
        const originalMeal = originalDay?.meals?.find(m => m.tipo === f.tipo);
        return !originalMeal || originalMeal.baby?.trim() !== f.baby?.trim();
      });
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

  const handleApply = async () => {
    if (!fixes?.length) return;
    await onApplyFixes(fixes.map(f => ({ day: f.day, tipo: f.tipo, baby: f.baby, tags: f.tags || [] })));
    track('kpi_fix_applied', { kpiType: fixing, fixCount: fixes.length });
    setFixing(null);
    setFixes(null);
    onFixesChange?.(null);
  };

  const handleDiscard = () => { setFixing(null); setFixes(null); setError(null); onFixesChange?.(null); };

  // Compute KPI impact of a single fix vs the original meal
  const computeFixImpact = (fix) => {
    const originalDay = weekDoc?.days?.find(d => d.day === fix.day);
    const originalMeal = originalDay?.meals?.find(m => m.tipo === fix.tipo);
    if (!originalMeal) return { impacts: [], originalText: null };

    const origTags = originalMeal.tags || [];
    const newTags = fix.tags || [];
    const impacts = [];

    const TAG_KPI = [
      { tag: 'iron',   id: 'iron',   iconKey: 'iron' },
      { tag: 'oily_fish', id: 'fish', iconKey: 'fish' },
      { tag: 'legume', id: 'legume', iconKey: 'legume' },
      { tag: 'fruit',  id: 'fruit',  iconKey: 'fruit' },
    ];
    for (const { tag, id, iconKey } of TAG_KPI) {
      if (!config.active.includes(id)) continue;
      const had = origTags.includes(tag);
      const has = newTags.includes(tag);
      if (had && !has) impacts.push({ iconKey, delta: -1 });
      if (!had && has) impacts.push({ iconKey, delta: +1 });
    }

    if (config.active.includes('veggie')) {
      const origVeggies = new Set(origTags.filter(t => t.startsWith('veggie:')).map(t => t.split(':')[1]));
      const newVeggies  = new Set(newTags.filter(t => t.startsWith('veggie:')).map(t => t.split(':')[1]));
      const weekVeggies = new Set(kpis.veggieList);
      let delta = 0;
      for (const v of newVeggies)  if (!origVeggies.has(v) && !weekVeggies.has(v)) delta++;
      for (const v of origVeggies) if (!newVeggies.has(v)) delta--;
      if (delta !== 0) impacts.push({ iconKey: 'veggie', delta });
    }

    for (const k of config.custom) {
      if (!config.active.includes(k.id)) continue;
      const q = k.query.toLowerCase().trim();
      const had = (originalMeal.baby || '').toLowerCase().includes(q);
      const has = (fix.baby || '').toLowerCase().includes(q);
      if (had && !has) impacts.push({ iconKey: 'custom', delta: -1 });
      if (!had && has) impacts.push({ iconKey: 'custom', delta: +1 });
    }

    return { impacts, originalText: originalMeal.baby || null };
  };

  const KPI_ICON_NAMES = { iron: 'Hierro', fish: 'Pescado', legume: 'Legumbres', fruit: 'Fruta', veggie: 'Verduras', custom: 'KPI personalizado' };
  const KPI_ICON_COMPONENTS = { iron: Droplets, fish: Fish, legume: Bean, fruit: Apple, veggie: Leaf, custom: Star };

  const getConflictSummary = (fixes) => {
    if (!fixes?.length) return null;
    const totals = {};
    for (const fix of fixes) {
      const { impacts } = computeFixImpact(fix);
      for (const { iconKey, delta } of impacts) {
        totals[iconKey] = (totals[iconKey] || 0) + delta;
      }
    }
    const worsens = Object.entries(totals)
      .filter(([, d]) => d < 0)
      .map(([iconKey, delta]) => ({ iconKey, name: KPI_ICON_NAMES[iconKey] || iconKey, delta }));
    const improvements = Object.entries(totals)
      .filter(([, d]) => d > 0)
      .map(([iconKey, delta]) => ({ iconKey, name: KPI_ICON_NAMES[iconKey] || iconKey, delta }));
    if (!worsens.length) return null;
    return { worsens, improvements };
  };

  const conflictSummary = fixes ? getConflictSummary(fixes) : null;

  // Build the ordered list of active KPI pills to render
  const activeCatalogKPIs = KPI_CATALOG.filter(k => config.active.includes(k.id));
  const activeCustomKPIs = config.custom.filter(k => config.active.includes(k.id));

  // Tooltip detail content for each KPI
  const ironDetail = (weekDoc?.days || []).flatMap(d =>
    (d.meals || []).filter(m => m.baby && m.tags?.includes('iron')).map(m => `${m.baby} (${d.day} - ${MEAL_LABELS[m.tipo]})`)
  ).join('\n') || null;
  const fishDetail = (weekDoc?.days || []).flatMap(d =>
    (d.meals || []).filter(m => m.baby && m.tags?.includes('oily_fish')).map(m => `${m.baby} (${d.day} - ${MEAL_LABELS[m.tipo]})`)
  ).join('\n') || null;
  const legumeDetail = (weekDoc?.days || []).flatMap(d =>
    (d.meals || []).filter(m => m.baby && m.tags?.includes('legume')).map(m => `${m.baby} (${d.day} - ${MEAL_LABELS[m.tipo]})`)
  ).join('\n') || null;
  const fruitDetail = (weekDoc?.days || []).flatMap(d =>
    (d.meals || []).filter(m => m.baby && m.tags?.includes('fruit')).map(m => `${m.baby} (${d.day} - ${MEAL_LABELS[m.tipo]})`)
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
          <div className="absolute bottom-full left-0 mb-1.5 px-2 py-1.5 bg-gray-800 text-white text-xs rounded-lg w-[28rem] opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
            Los targets se adaptan automáticamente a las franjas activas del menú
            <div className="absolute top-full left-3 border-4 border-transparent border-t-gray-800" />
          </div>
        </div>
      </div>

      {/* KPI Pills */}
      <div data-tour="kpi-pills" className="flex flex-wrap gap-2 items-center">
        {activeCatalogKPIs.map(k => {
          if (k.id === 'iron') { const pv = getPillValueTarget('iron', kpis.ironDays, ironTarget); return (
            <KPIPill key="iron"
              IconComponent={Droplets} label="Hierro" value={pv.value} target={pv.target}
              status={ironStatus} statusColors={statusColors}
              disabled={ironStatus === null}
              disabledTooltip="Solo aplica cuando el menú tiene comidas principales (comida o cena)"
              tooltip={ironDetail}
              onFix={hasAiAccess && ironStatus !== null && ironStatus !== 'good' ? () => handleFix('iron') : null}
              fixing={fixing === 'iron'} loading={loading && fixing === 'iron'}
            />
          ); }
          if (k.id === 'fish') { const pv = getPillValueTarget('fish', kpis.fishDays, fishTarget); return (
            <KPIPill key="fish"
              IconComponent={Fish} label="Pesc. graso" value={pv.value} target={pv.target}
              status={fishStatus} statusColors={statusColors}
              disabled={fishStatus === null}
              disabledTooltip="Solo aplica cuando el menú tiene comidas principales (comida o cena)"
              tooltip={fishDetail}
              onFix={hasAiAccess && fishStatus !== null && fishStatus !== 'good' ? () => handleFix('fish') : null}
              fixing={fixing === 'fish'} loading={loading && fixing === 'fish'}
            />
          ); }
          if (k.id === 'veggie') { const pv = getPillValueTarget('veggie', kpis.distinctVeggies, veggieTarget, 'tipos'); return (
            <KPIPill key="veggie"
              IconComponent={Leaf} label="Verduras" value={pv.value} target={pv.target}
              status={veggieStatus} statusColors={statusColors}
              tooltip={veggieDetail}
              onFix={hasAiAccess && veggieStatus !== 'good' ? () => handleFix('veggie') : null}
              fixing={fixing === 'veggie'} loading={loading && fixing === 'veggie'}
            />
          ); }
          if (k.id === 'legume') { const pv = getPillValueTarget('legume', kpis.legumedDays, legumeTarget); return (
            <KPIPill key="legume"
              IconComponent={Bean} label="Legumbres" value={pv.value} target={pv.target}
              status={legumeStatus} statusColors={statusColors}
              tooltip={legumeDetail}
              onFix={hasAiAccess && legumeStatus !== 'good' ? () => handleFix('legume') : null}
              fixing={fixing === 'legume'} loading={loading && fixing === 'legume'}
            />
          ); }
          if (k.id === 'fruit') { const pv = getPillValueTarget('fruit', kpis.fruitDays, fruitTarget); return (
            <KPIPill key="fruit"
              IconComponent={Apple} label="Fruta" value={pv.value} target={pv.target}
              status={fruitStatus} statusColors={statusColors}
              tooltip={fruitDetail}
              onFix={hasAiAccess && fruitStatus !== 'good' ? () => handleFix('fruit') : null}
              fixing={fixing === 'fruit'} loading={loading && fixing === 'fruit'}
            />
          ); }
          if (k.id === 'protein_rotation') {
            const alertCount = kpis.consecutiveAlerts.length;
            const rotStatus = alertCount === 0 ? 'good' : 'warning';
            return (
              <KPIPill key="protein_rotation"
                IconComponent={RefreshCw} label="Rotación" value={alertCount === 0 ? 'OK' : `${alertCount} alerta${alertCount > 1 ? 's' : ''}`} target="sin repetir >2 días"
                status={rotStatus} statusColors={statusColors}
                onFix={hasAiAccess && alertCount > 0 ? () => handleFix('protein_rotation') : null}
                fixing={fixing === 'protein_rotation'} loading={loading && fixing === 'protein_rotation'}
              />
            );
          }
          return null;
        })}

        {/* Custom KPI pills */}
        {activeCustomKPIs.map(k => {
          const tgt = config.targets[k.id] ?? k.target ?? 3;
          const quality = k.quality || 'mínimo';
          const freq = k.frequency || 'semanal';
          const qualPrefix = quality === 'máximo' ? '≤' : quality === 'exacto' ? '=' : '≥';
          let val, valueLabel, targetLabel, st;
          if (freq === 'diario') {
            const dc = dailyCompliance[k.id];
            const perDayTgt = config.targets[k.id] ?? k.target ?? 1;
            val = dc?.compliant ?? 0;
            valueLabel = dc ? `${dc.compliant}/${dc.total} días` : '0/0 días';
            targetLabel = `${qualPrefix}${perDayTgt}/día`;
            st = dc ? getDailyStatus(dc.compliant, dc.total) : null;
          } else {
            val = kpis.customResults?.[k.id] ?? 0;
            valueLabel = `${val}/${tgt}`;
            targetLabel = quality === 'máximo' ? `≤${tgt} días` : quality === 'exacto' ? `=${tgt} días` : `≥${tgt} días`;
            st = getStatusWithQuality(val, tgt, quality);
          }
          return (
            <KPIPill key={k.id}
              IconComponent={Star} label={k.name} value={valueLabel} target={targetLabel}
              status={st} statusColors={statusColors}
              onFix={hasAiAccess && st !== null && quality === 'mínimo' ? () => handleFix(k.id) : null}
              fixing={fixing === k.id} loading={loading && fixing === k.id}
            />
          );
        })}

        {/* Library button */}
        {onUpdateKpiConfig && (
          <button
            onClick={() => setShowLibrary(true)}
            className="flex items-center gap-1 border border-dashed border-gray-300 rounded px-3 py-1.5 text-xs text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors"
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
            <p key={i} className="text-xs text-amber-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 shrink-0" /> {PROTEIN_LABELS[alert.protein] || alert.protein} aparece {alert.count} días seguidos desde {alert.startDay}
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
                {fixes.map((fix, i) => {
                  const { impacts, originalText } = computeFixImpact(fix);
                  return (
                    <li key={i} className="text-xs bg-brand-50 border border-brand-100 rounded-lg px-3 py-2 space-y-1">
                      <span className="font-semibold text-brand-700">{fix.day} · {MEAL_LABELS[fix.tipo] || fix.tipo}</span>
                      {originalText && (
                        <p className="text-gray-400 line-through leading-snug">{originalText}</p>
                      )}
                      <p className="text-gray-700 leading-snug">→ {fix.baby}</p>
                      {impacts.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {impacts.map((imp, j) => {
                            const ImpIcon = KPI_ICON_COMPONENTS[imp.iconKey];
                            return (
                              <span key={j} className={`inline-flex items-center gap-0.5 font-medium px-1.5 py-0.5 rounded ${imp.delta > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {ImpIcon && <ImpIcon className="w-3 h-3" />} {imp.delta > 0 ? '+1' : '-1'}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
              {conflictSummary && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 space-y-0.5">
                  <p className="text-xs font-medium text-amber-700 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Conflicto entre KPIs</p>
                  <p className="text-xs text-amber-600 flex items-center flex-wrap gap-0.5">
                    {conflictSummary.improvements.map((i, idx) => { const IC = KPI_ICON_COMPONENTS[i.iconKey]; return <span key={idx} className="inline-flex items-center gap-0.5">{IC && <IC className="w-3 h-3" />} +{i.delta}</span>; })}
                    {conflictSummary.improvements.length > 0 ? <span> mejora</span> : null}
                    {conflictSummary.improvements.length > 0 && conflictSummary.worsens.length > 0 ? <span>, pero </span> : null}
                    {conflictSummary.worsens.map((w, idx) => { const IC = KPI_ICON_COMPONENTS[w.iconKey]; return <span key={idx} className="inline-flex items-center gap-0.5">{IC && <IC className="w-3 h-3" />} {w.delta}</span>; })}
                    {conflictSummary.worsens.length > 0 ? <span> empeora</span> : null}
                  </p>
                  <p className="text-xs text-amber-500">Puedes aplicar igualmente si lo consideras prioritario.</p>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={handleDiscard} className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-1.5 text-xs hover:bg-gray-50 transition-colors">
                  Descartar
                </button>
                <button onClick={handleApply} className="flex-1 bg-brand-600 text-white rounded-lg py-1.5 text-xs font-medium hover:bg-brand-700 transition-colors">
                  Aplicar{conflictSummary ? ' igualmente' : ' cambios'}
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

function KPIPill({ IconComponent, label, value, target, status, statusColors, onFix, fixing, loading, disabled, disabledTooltip, tooltip }) {
  if (disabled) {
    return (
      <div className="relative group">
        <div className="flex items-center gap-1.5 border rounded px-3 py-1.5 text-gray-400 bg-gray-50 border-gray-200 opacity-50 cursor-default">
          {IconComponent && <IconComponent className="w-3.5 h-3.5" />}
          <span className="text-xs font-semibold">{label}</span>
        </div>
        {disabledTooltip && (
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
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
      <div className={`flex items-center gap-1.5 border rounded px-3 py-1.5 ${statusColors[status]}`}>
        {IconComponent && <IconComponent className="w-3.5 h-3.5" />}
        <span className="text-xs font-semibold">{label}</span>
        <span className="text-xs font-bold">{value}</span>
        <span className="text-xs opacity-60">({target})</span>
        {canFix && (
          <button
            onClick={onFix}
            className={`ml-0.5 flex items-center transition-opacity ${fixing ? 'opacity-60' : 'hover:opacity-80'}`}
            title="Corregir con IA"
          >
            {loading ? '...' : fixing ? <X className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
          </button>
        )}
      </div>
      {tooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1.5 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-pre-wrap text-left" style={{ minWidth: '200px', maxWidth: '480px' }}>
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
        </div>
      )}
    </div>
  );
}

// ─── KPI Library ─────────────────────────────────────────────────────────────

const CATALOG_ICON_MAP = { iron: Droplets, fish: Fish, veggie: Leaf, legume: Bean, fruit: Apple, protein_rotation: RefreshCw };

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
  const [customQuality, setCustomQuality] = useState('mínimo');
  const [customFrequency, setCustomFrequency] = useState('semanal');
  const [editingCustomId, setEditingCustomId] = useState(null);

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
      custom: [...d.custom, { id, name: customName.trim(), query: customQuery.trim(), target: parseInt(customTarget, 10) || 3, quality: customQuality, frequency: customFrequency }],
      active: [...d.active, id],
    }));
    setCustomName(''); setCustomQuery(''); setCustomTarget('3'); setCustomQuality('mínimo'); setCustomFrequency('semanal');
    setShowAddCustom(false);
  };

  const updateCustomKPI = (id, changes) => {
    setDraft(d => ({
      ...d,
      custom: d.custom.map(k => k.id === id ? { ...k, ...changes } : k),
    }));
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
          <button onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-gray-400 hover:text-gray-600">
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
                  <span className="mt-0.5 text-gray-500">{CATALOG_ICON_MAP[k.id] && (() => { const CatIcon = CATALOG_ICON_MAP[k.id]; return <CatIcon className="w-5 h-5" />; })()}</span>
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
                            <button onClick={() => commitTarget(k.id)} className="text-xs text-brand-600 font-medium hover:text-brand-700"><Check className="w-3 h-3" /></button>
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
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isActive ? 'translate-x-5' : 'translate-x-1'}`} />
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
                const isEditingCard = editingCustomId === k.id;
                const currentQuality = k.quality || 'mínimo';
                return (
                  <div key={k.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${isActive ? 'bg-brand-50 border-brand-200' : 'bg-gray-50 border-gray-100'}`}>
                    <span className="mt-0.5 text-gray-500"><Star className="w-5 h-5" /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{k.name}</p>
                      <p className="text-xs text-gray-400">busca: "{k.query}"</p>
                      {isActive && (
                        <div className="mt-2 space-y-1.5">
                          <div className="flex items-center gap-2">
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
                                <button onClick={() => commitTarget(k.id)} className="text-xs text-brand-600 font-medium hover:text-brand-700"><Check className="w-3 h-3" /></button>
                              </div>
                            ) : (
                              <button onClick={() => { setEditingTarget(k.id); setTargetInput(String(currentTarget)); }} className="text-xs text-brand-600 font-medium hover:underline">
                                {currentTarget} días
                              </button>
                            )}
                          </div>
                          {isEditingCard ? (
                            <div className="space-y-1.5">
                              <div className="flex gap-1">
                                {['mínimo', 'máximo', 'exacto'].map(q => (
                                  <button
                                    key={q} type="button"
                                    onClick={() => updateCustomKPI(k.id, { quality: q })}
                                    className={`flex-1 text-xs py-1 rounded-lg border transition-colors ${currentQuality === q ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'}`}
                                  >
                                    {q === 'mínimo' ? '≥ mín' : q === 'máximo' ? '≤ máx' : '= exacto'}
                                  </button>
                                ))}
                              </div>
                              <div className="flex gap-1">
                                {[['semanal', 'Por semana'], ['diario', 'Por día']].map(([val, lbl]) => (
                                  <button
                                    key={val} type="button"
                                    onClick={() => updateCustomKPI(k.id, { frequency: val })}
                                    className={`flex-1 text-xs py-1 rounded-lg border transition-colors ${(k.frequency || 'semanal') === val ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'}`}
                                  >
                                    {lbl}
                                  </button>
                                ))}
                              </div>
                              <button onClick={() => setEditingCustomId(null)} className="text-xs text-brand-600 font-medium">✓ Listo</button>
                            </div>
                          ) : (
                            <button onClick={() => setEditingCustomId(k.id)} className="text-xs text-gray-400 hover:text-brand-600 transition-colors">
                              tipo: {currentQuality === 'mínimo' ? '≥ mínimo' : currentQuality === 'máximo' ? '≤ máximo' : '= exacto'} · {(k.frequency || 'semanal') === 'diario' ? 'por día' : 'por semana'} (editar)
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
                        <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform ${isActive ? 'translate-x-5' : 'translate-x-1'}`} />
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
                  placeholder="Ej: salmón, atún, sardina"
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400 bg-white"
                />
                <p className="text-xs text-gray-400 mt-1">Palabras clave separadas por coma: ej. salmón, atún, sardina</p>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Tipo de objetivo</label>
                <div className="flex gap-1">
                  {['mínimo', 'máximo', 'exacto'].map(q => (
                    <button
                      key={q} type="button"
                      onClick={() => setCustomQuality(q)}
                      className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${customQuality === q ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'}`}
                    >
                      {q === 'mínimo' ? '≥ mínimo' : q === 'máximo' ? '≤ máximo' : '= exacto'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Frecuencia</label>
                <div className="flex gap-1">
                  {[['semanal', 'Por semana'], ['diario', 'Por día']].map(([val, lbl]) => (
                    <button
                      key={val} type="button"
                      onClick={() => setCustomFrequency(val)}
                      className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${customFrequency === val ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200 hover:border-brand-300'}`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  {customFrequency === 'diario' ? 'Objetivo (veces/día)' : 'Objetivo (días/semana)'}
                </label>
                <input
                  type="number" min={1} max={customFrequency === 'diario' ? 5 : 7} value={customTarget} onChange={e => setCustomTarget(e.target.value)}
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
