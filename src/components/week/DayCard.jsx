import { useState, useRef, useEffect } from 'react';
import { useKPIs } from '../../hooks/useKPIs';
import { Sunrise, Apple, Utensils, Coffee, Moon, Trash2, Check, Circle, ArrowLeftRight } from 'lucide-react';

const MEAL_ICONS = {
  desayuno: Sunrise,
  snack: Apple,
  comida: Utensils,
  merienda: Coffee,
  cena: Moon,
};

function effectiveText(meal) {
  const t = meal.track;
  if (!t?.status && !t?.done) return meal.baby;
  if (t.status === 'other' && t.altFood) return t.altFood;
  if (t.status === 'partial') {
    if (t.checkedIngredients?.length) return t.checkedIngredients.join(', ');
    if (t.extra) return t.extra;
  }
  return meal.baby;
}

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

export default function DayCard({ dayData, onClick, isToday, onClear }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  if (!dayData) return null;

  const { day, meals } = dayData;

  // Build a mini "week doc" for KPI calculation on this day alone
  const dayWeekDoc = { days: [dayData] };
  const { dayKPIs } = useKPIs(dayWeekDoc);
  const kpi = dayKPIs[0] || { hasIron: false, hasFish: false, veggies: [] };

  const filledMeals = meals ? meals.filter((m) => m.baby) : [];
  const trackedMeals = meals ? meals.filter((m) => m.track?.done || m.track?.status) : [];

  return (
    <div
      className={`w-full text-left bg-white rounded-xl border transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 cursor-pointer ${
        isToday
          ? 'border-brand-400 shadow-sm shadow-brand-100'
          : 'border-gray-100 hover:border-gray-200'
      }`}
      onClick={onClick}
    >
      {/* Day header */}
      <div
        className={`px-3 py-2 rounded-t-xl flex items-center justify-between ${
          isToday ? 'bg-brand-600 text-white' : 'bg-gray-50 text-gray-700'
        }`}
      >
        <span className="font-semibold text-sm">{day}</span>
        <div className="flex items-center gap-1.5">
          {trackedMeals.length > 0 && (
            <span className={`text-xs flex items-center gap-0.5 ${isToday ? 'text-brand-200' : 'text-gray-400'}`}>
              <Check className="w-3 h-3 inline" /> {trackedMeals.length}
            </span>
          )}
          <div className="relative" ref={menuRef}>
            <button
              onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v); }}
              className={`p-0.5 rounded transition-colors ${isToday ? 'hover:bg-brand-500 text-brand-200' : 'hover:bg-gray-200 text-gray-400'}`}
              aria-label="Opciones"
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                <circle cx="10" cy="4" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="10" cy="16" r="1.5" />
              </svg>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 min-w-[140px]">
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onClear?.(); }}
                  className="w-full text-left px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Eliminar comidas
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Meal dots */}
      <div className="px-3 py-2 space-y-1">
        {meals && meals.map((meal) => {
          const MealIcon = MEAL_ICONS[meal.tipo];
          return (
            <div key={meal.tipo} className="flex items-center gap-1.5">
              <span className="w-4 flex items-center justify-center text-gray-400">
                {MealIcon ? <MealIcon className="w-3 h-3" /> : <span className="text-xs">•</span>}
              </span>
              <div className="flex-1 min-w-0">
                {meal.baby ? (
                  <p className="text-xs text-gray-700 truncate">{shortName(effectiveText(meal))}</p>
                ) : (
                  <div className="h-2.5 bg-gray-100 rounded w-3/4" />
                )}
              </div>
              {meal.track?.status === 'partial' ? (
                <Circle className="w-3 h-3 text-orange-400 shrink-0 opacity-50" />
              ) : meal.track?.status === 'other' ? (
                <ArrowLeftRight className="w-3 h-3 text-blue-400 shrink-0" />
              ) : (meal.track?.status === 'done' || meal.track?.done) ? (
                <Check className="w-3 h-3 text-green-500 shrink-0" />
              ) : null}
            </div>
          );
        })}
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
    </div>
  );
}
