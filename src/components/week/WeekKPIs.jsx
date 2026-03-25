import { useState } from 'react';
import { useKPIs } from '../../hooks/useKPIs';
import { computeAdaptiveTargets } from '../../lib/kpis';
import { fixKPI } from '../../lib/claude';
import { track } from '../../lib/analytics';

const MEAL_LABELS = {
  desayuno: 'Desayuno', snack: 'Snack', comida: 'Comida', merienda: 'Merienda', cena: 'Cena',
};

export default function WeekKPIs({ weekDoc, apiKey, hasAiAccess, onApplyFixes }) {
  const kpis = useKPIs(weekDoc);
  const { ironTarget, fishTarget, veggieTarget, isAdapted } = computeAdaptiveTargets(weekDoc);
  const [fixing, setFixing] = useState(null);     // 'iron' | 'fish' | 'veggie'
  const [loading, setLoading] = useState(false);
  const [fixes, setFixes] = useState(null);
  const [error, setError] = useState(null);

  const ironStatus = ironTarget === null ? null
    : kpis.ironDays >= ironTarget ? 'good'
    : kpis.ironDays >= Math.ceil(ironTarget * 0.6) ? 'warning' : 'bad';

  const fishStatus = fishTarget === null ? null
    : kpis.fishDays >= fishTarget ? 'good'
    : kpis.fishDays >= Math.ceil(fishTarget * 0.6) ? 'warning' : 'bad';

  const veggieStatus = kpis.distinctVeggies >= veggieTarget ? 'good'
    : kpis.distinctVeggies >= Math.ceil(veggieTarget * 0.6) ? 'warning' : 'bad';

  const statusColors = {
    good:    'text-green-700 bg-green-50 border-green-200',
    warning: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    bad:     'text-red-700 bg-red-50 border-red-200',
  };

  const handleFix = async (kpiType) => {
    if (fixing === kpiType) { setFixing(null); setFixes(null); setError(null); return; }
    setFixing(kpiType);
    setFixes(null);
    setError(null);
    setLoading(true);
    try {
      const kpiState =
        kpiType === 'iron'  ? { current: kpis.ironDays,       target: ironTarget } :
        kpiType === 'fish'  ? { current: kpis.fishDays,       target: fishTarget } :
        { current: kpis.distinctVeggies, existing: kpis.veggieList, target: veggieTarget };

      // Compute which meal tipos actually have content in this week
      const activeTipos = [...new Set(
        (weekDoc?.days || []).flatMap(day =>
          (day.meals || []).filter(m => m.baby).map(m => m.tipo)
        )
      )];

      const result = await fixKPI({
        kpiType,
        weekContext: weekDoc.days,
        kpiState,
        activeTipos,
        apiKey,
      });
      // Filter out any fixes Claude proposed for inactive slots
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

  return (
    <div className="px-4 py-3 space-y-2">
      {/* KPI Pills */}
      <div className="flex flex-wrap gap-2">
        <KPIPill
          icon="🩸" label="Hierro" value={`${kpis.ironDays}/${ironTarget}`} target={`≥${ironTarget} días`}
          status={ironStatus} statusColors={statusColors}
          disabled={ironStatus === null}
          disabledTooltip="Solo aplica cuando el menú tiene comidas principales (comida o cena)"
          onFix={hasAiAccess && ironStatus !== null ? () => handleFix('iron') : null}
          fixing={fixing === 'iron'} loading={loading && fixing === 'iron'}
        />
        <KPIPill
          icon="🐟" label="Pesc. graso" value={`${kpis.fishDays}/${fishTarget}`} target={`≥${fishTarget} días`}
          status={fishStatus} statusColors={statusColors}
          disabled={fishStatus === null}
          disabledTooltip="Solo aplica cuando el menú tiene comidas principales (comida o cena)"
          onFix={hasAiAccess && fishStatus !== null ? () => handleFix('fish') : null}
          fixing={fixing === 'fish'} loading={loading && fixing === 'fish'}
        />
        <KPIPill
          icon="🥦" label="Verduras" value={`${kpis.distinctVeggies} distintas`} target={`≥${veggieTarget} tipos`}
          status={veggieStatus} statusColors={statusColors}
          onFix={hasAiAccess ? () => handleFix('veggie') : null}
          fixing={fixing === 'veggie'} loading={loading && fixing === 'veggie'}
        />
      </div>
      {isAdapted && (
        <p className="text-xs text-gray-400">ℹ️ Targets adaptados a las franjas activas de este menú</p>
      )}

      {/* Veggie list */}
      {kpis.veggieList.length > 0 && (
        <div className="text-xs text-gray-500">
          <span className="font-medium">Verduras esta semana: </span>
          {kpis.veggieList.join(', ')}
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
                <button
                  onClick={handleDiscard}
                  className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-1.5 text-xs hover:bg-gray-50 transition-colors"
                >
                  Descartar
                </button>
                <button
                  onClick={handleApply}
                  className="flex-1 bg-brand-600 text-white rounded-lg py-1.5 text-xs font-medium hover:bg-brand-700 transition-colors"
                >
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
    </div>
  );
}

function KPIPill({ icon, label, value, target, status, statusColors, onFix, fixing, loading, disabled, disabledTooltip }) {
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
    <div className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 ${statusColors[status]}`}>
      <span className="text-sm">{icon}</span>
      <span className="text-xs font-semibold">{label}</span>
      <span className="text-xs font-bold">{value}</span>
      <span className="text-xs opacity-60">({target})</span>
      {canFix && (
        <button
          onClick={onFix}
          className={`ml-0.5 text-xs font-medium underline underline-offset-2 transition-opacity ${fixing ? 'opacity-60' : 'hover:opacity-80'}`}
          title="Corregir con IA"
        >
          {loading ? '...' : fixing ? '✕' : '✨'}
        </button>
      )}
    </div>
  );
}
