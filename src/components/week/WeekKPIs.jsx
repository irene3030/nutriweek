import { useKPIs } from '../../hooks/useKPIs';

export default function WeekKPIs({ weekDoc }) {
  const kpis = useKPIs(weekDoc);

  const ironStatus = kpis.ironDays >= 5 ? 'good' : kpis.ironDays >= 3 ? 'warning' : 'bad';
  const fishStatus = kpis.fishDays >= 3 ? 'good' : kpis.fishDays >= 2 ? 'warning' : 'bad';
  const veggieStatus = kpis.distinctVeggies >= 5 ? 'good' : kpis.distinctVeggies >= 3 ? 'warning' : 'bad';

  const statusColors = {
    good: 'text-green-700 bg-green-50 border-green-200',
    warning: 'text-yellow-700 bg-yellow-50 border-yellow-200',
    bad: 'text-red-700 bg-red-50 border-red-200',
  };

  return (
    <div className="px-4 py-3 space-y-2">
      {/* KPI Pills */}
      <div data-tour="kpi-pills" className="flex flex-wrap gap-2">
        <KPIPill
          icon="🩸"
          label="Hierro"
          value={`${kpis.ironDays}/7`}
          target="≥5 días"
          status={ironStatus}
          statusColors={statusColors}
        />
        <KPIPill
          icon="🐟"
          label="Pesc. graso"
          value={`${kpis.fishDays}/7`}
          target="≥3 días"
          status={fishStatus}
          statusColors={statusColors}
        />
        <KPIPill
          icon="🥦"
          label="Verduras"
          value={`${kpis.distinctVeggies} distintas`}
          target="≥5 tipos"
          status={veggieStatus}
          statusColors={statusColors}
        />
      </div>

      {/* Veggie list */}
      {kpis.veggieList.length > 0 && (
        <div className="text-xs text-gray-500">
          <span className="font-medium">Verduras esta semana: </span>
          {kpis.veggieList.join(', ')}
        </div>
      )}
    </div>
  );
}

function KPIPill({ icon, label, value, target, status, statusColors }) {
  return (
    <div className={`flex items-center gap-1.5 border rounded-full px-3 py-1.5 ${statusColors[status]}`}>
      <span className="text-sm">{icon}</span>
      <span className="text-xs font-semibold">{label}</span>
      <span className="text-xs font-bold">{value}</span>
      <span className="text-xs opacity-60">({target})</span>
    </div>
  );
}
