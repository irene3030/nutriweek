import { X, TrendingUp, Droplets, Fish, Bean, Leaf, Apple } from 'lucide-react';

const KPI_ITEMS = [
  { key: 'ironDays',        label: 'Hierro',       target: 5, unit: 'días',  icon: Droplets },
  { key: 'fishDays',        label: 'Pescado azul', target: 3, unit: 'días',  icon: Fish },
  { key: 'legumedDays',     label: 'Legumbre',     target: 3, unit: 'días',  icon: Bean },
  { key: 'distinctVeggies', label: 'Verduras',     target: 5, unit: 'tipos', icon: Leaf },
  { key: 'fruitDays',       label: 'Fruta',        target: 5, unit: 'días',  icon: Apple },
];

export default function WeeklyBriefing({ lastWeekKpis, onDismiss }) {
  if (!lastWeekKpis) return null;

  const achieved = KPI_ITEMS.filter(({ key, target }) => (lastWeekKpis[key] ?? 0) >= target);
  const missed   = KPI_ITEMS.filter(({ key, target }) => (lastWeekKpis[key] ?? 0) < target);

  return (
    <div className="bg-white rounded-2xl border border-brand-100 p-4 space-y-3 relative">
      <button
        onClick={onDismiss}
        className="absolute top-3 right-3 text-gray-300 hover:text-gray-500 transition-colors"
        aria-label="Cerrar"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2">
        <TrendingUp className="w-4 h-4 text-brand-500" />
        <h3 className="text-sm font-semibold text-gray-800">Resumen de la semana pasada</h3>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {KPI_ITEMS.map(({ key, label, target, icon: Icon }) => {
          const val = lastWeekKpis[key] ?? 0;
          const ok = val >= target;
          return (
            <div
              key={key}
              className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl ${
                ok ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'
              }`}
            >
              <Icon className="w-3.5 h-3.5 shrink-0" />
              <span className="font-medium">{label}</span>
              <span className={`ml-auto font-bold ${ok ? 'text-green-600' : 'text-gray-400'}`}>
                {val}/{target}
              </span>
            </div>
          );
        })}
      </div>

      {missed.length === 0 ? (
        <p className="text-xs text-green-700 font-medium text-center py-1">
          ¡Semana perfecta! Todos los objetivos cubiertos.
        </p>
      ) : achieved.length > 0 ? (
        <p className="text-xs text-gray-500 leading-snug">
          Esta semana puedes reforzar: <span className="font-medium text-gray-700">{missed.map(m => m.label).join(', ')}</span>
        </p>
      ) : (
        <p className="text-xs text-gray-500 leading-snug">
          Semana difícil. Esta semana empezamos de nuevo.
        </p>
      )}
    </div>
  );
}
