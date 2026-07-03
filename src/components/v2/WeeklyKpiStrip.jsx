import { Droplets, Fish, Bean, Leaf, Apple } from 'lucide-react';

const KPI_DEFS = [
  { id: 'iron',   icon: Droplets, label: 'Hierro',    getValue: (k) => k.ironDays,        target: 5, getItems: (k) => k.ironItems },
  { id: 'fish',   icon: Fish,     label: 'Pescado',   getValue: (k) => k.fishDays,        target: 3, getItems: (k) => k.fishItems },
  { id: 'legume', icon: Bean,     label: 'Legumbre',  getValue: (k) => k.legumedDays,     target: 3, getItems: (k) => k.legumeItems },
  { id: 'veggie', icon: Leaf,     label: 'Verduras',  getValue: (k) => k.distinctVeggies, target: 5, unit: 'tipos', getItems: (k) => k.veggieList },
  { id: 'fruit',  icon: Apple,    label: 'Fruta',     getValue: (k) => k.fruitDays,       target: 5, unit: 'días', getItems: (k) => k.fruitItems },
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

export default function WeeklyKpiStrip({ kpis, onKpiTap }) {
  if (!kpis) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {KPI_DEFS.map(({ id, icon: Icon, label, getValue, target, unit, getItems }) => {
        const value = getValue(kpis);
        const status = getStatus(value, target);
        const tappable = onKpiTap && status !== 'good';
        const Wrapper = tappable ? 'button' : 'div';
        const items = getItems(kpis) || [];
        return (
          <div key={id} className="relative group">
            <Wrapper
              onClick={tappable ? () => onKpiTap(id) : undefined}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium ${STATUS_STYLES[status]} ${tappable ? 'cursor-pointer active:scale-95 transition-transform' : ''}`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
              <span className="font-bold">{value}/{target}</span>
              {unit && <span className="opacity-60">{unit}</span>}
              {tappable && <span className="opacity-50 text-[9px] ml-0.5">↗</span>}
            </Wrapper>

            {/* Hover tooltip: which items cover this KPI */}
            <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 w-max max-w-[220px] px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-[11px] leading-snug shadow-lg pointer-events-none">
              {items.length > 0 ? items.join(', ') : `Sin ${label.toLowerCase()} registrada esta semana`}
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-gray-900 rotate-45 -mt-[3px]" />
            </div>
          </div>
        );
      })}
    </div>
  );
}
