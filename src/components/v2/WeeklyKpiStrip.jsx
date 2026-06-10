import { Droplets, Fish, Bean, Leaf } from 'lucide-react';

const KPI_DEFS = [
  { id: 'iron',   icon: Droplets, label: 'Hierro',    getValue: (k) => k.ironDays,       target: 5 },
  { id: 'fish',   icon: Fish,     label: 'Pescado',   getValue: (k) => k.fishDays,       target: 3 },
  { id: 'legume', icon: Bean,     label: 'Legumbre',  getValue: (k) => k.legumedDays,    target: 3 },
  { id: 'veggie', icon: Leaf,     label: 'Verduras',  getValue: (k) => k.distinctVeggies, target: 5, unit: 'tipos' },
];

function getStatus(value, target) {
  if (value >= target) return 'good';
  if (value >= Math.ceil(target * 0.5)) return 'mid';
  return 'low';
}

const STATUS_STYLES = {
  good: 'bg-green-50 text-green-700 border-green-200',
  mid:  'bg-amber-50 text-amber-700 border-amber-200',
  low:  'bg-gray-50 text-gray-500 border-gray-200',
};

export default function WeeklyKpiStrip({ kpis }) {
  if (!kpis) return null;

  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5 no-scrollbar">
      {KPI_DEFS.map(({ id, icon: Icon, label, getValue, target, unit }) => {
        const value = getValue(kpis);
        const status = getStatus(value, target);
        return (
          <div
            key={id}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium shrink-0 ${STATUS_STYLES[status]}`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
            <span className="font-bold">{value}/{target}</span>
            {unit && <span className="opacity-60">{unit}</span>}
          </div>
        );
      })}
    </div>
  );
}
