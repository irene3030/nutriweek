import { useKPIs } from '../../hooks/useKPIs';

const MEAL_LABELS = {
  desayuno: '☀️',
  snack: '🍎',
  comida: '🍽️',
  merienda: '🧃',
  cena: '🌙',
};

function shortName(text) {
  if (!text) return '';
  if (text.length <= 22) return text;
  const words = text.trim().split(/\s+/);
  const first = words[0];
  // Find first connector ("con" or "y") and take the word right after it
  const connectors = ['con', 'y'];
  for (const conn of connectors) {
    const idx = words.indexOf(conn);
    if (idx > 0 && idx < words.length - 1) {
      return `${first} ${conn} ${words[idx + 1]}`;
    }
  }
  // No connector found: first word only
  return first;
}

export default function DayCard({ dayData, onClick, isToday }) {
  if (!dayData) return null;

  const { day, meals } = dayData;

  // Build a mini "week doc" for KPI calculation on this day alone
  const dayWeekDoc = { days: [dayData] };
  const { dayKPIs } = useKPIs(dayWeekDoc);
  const kpi = dayKPIs[0] || { hasIron: false, hasFish: false, veggies: [] };

  const filledMeals = meals ? meals.filter((m) => m.baby) : [];
  const trackedMeals = meals ? meals.filter((m) => m.track?.done) : [];

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 ${
        isToday
          ? 'border-brand-400 shadow-sm shadow-brand-100'
          : 'border-gray-100 hover:border-gray-200'
      }`}
    >
      {/* Day header */}
      <div
        className={`px-3 py-2 rounded-t-xl flex items-center justify-between ${
          isToday ? 'bg-brand-600 text-white' : 'bg-gray-50 text-gray-700'
        }`}
      >
        <span className="font-semibold text-sm">{day}</span>
        {trackedMeals.length > 0 && (
          <span className={`text-xs ${isToday ? 'text-brand-200' : 'text-gray-400'}`}>
            ✓ {trackedMeals.length}
          </span>
        )}
      </div>

      {/* Meal dots */}
      <div className="px-3 py-2 space-y-1">
        {meals && meals.map((meal) => (
          <div key={meal.tipo} className="flex items-center gap-1.5">
            <span className="text-xs w-4">{MEAL_LABELS[meal.tipo] || '•'}</span>
            <div className="flex-1 min-w-0">
              {meal.baby ? (
                <p className="text-xs text-gray-700 truncate">{shortName(meal.baby)}</p>
              ) : (
                <div className="h-2.5 bg-gray-100 rounded w-3/4" />
              )}
            </div>
            {meal.track?.done && (
              <span className="text-green-500 text-xs">✓</span>
            )}
          </div>
        ))}
      </div>

      {/* KPI indicators */}
      <div className="px-3 pb-2 flex gap-1">
        {kpi.hasIron && (
          <span className="w-2 h-2 rounded-full bg-orange-400" title="Hierro" />
        )}
        {kpi.hasFish && (
          <span className="w-2 h-2 rounded-full bg-blue-400" title="Pescado graso" />
        )}
        {kpi.veggies.length > 0 && (
          <span className="w-2 h-2 rounded-full bg-green-400" title={`Verduras: ${kpi.veggies.join(', ')}`} />
        )}
        {filledMeals.length === 0 && (
          <span className="text-xs text-gray-300">Sin planificar</span>
        )}
      </div>
    </button>
  );
}
