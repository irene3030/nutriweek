import { useState, useRef, useEffect } from 'react';
import { useKPIs } from '../../hooks/useKPIs';
import { Sun, Banana, Apple, Utensils, Citrus, Moon, Trash2, Check, Circle, ArrowLeftRight, Droplets, Fish, Leaf, Bean } from 'lucide-react';

const MEAL_ICONS = {
  desayuno: Sun,
  snack: Banana,
  comida: Utensils,
  merienda: Citrus,
  cena: Moon,
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
  // No connector: take as many words as fit within 22 chars
  let result = first;
  for (let i = 1; i < words.length; i++) {
    const candidate = result + ' ' + words[i];
    if (candidate.length > 22) break;
    result = candidate;
  }
  return result;
}

function summaryText(meal, ingredientsMode) {
  const t = meal.track;

  // 'other': always show what was actually eaten regardless of mode
  if (t?.status === 'other' && t.altFood) return shortName(t.altFood);

  // Ingredients mode: show raw ingredients list if available, else fall back to normal
  if (ingredientsMode && Array.isArray(meal.ingredients) && meal.ingredients.length > 0) {
    return meal.ingredients.join(', ');
  }

  // Base name: prefer AI-generated short version, fall back to algorithmic truncation
  const baseName = meal.babyShort || shortName(meal.baby || '');

  // Extra food eaten alongside planned meal: append with "+"
  if (t?.extra) {
    const extraShort = t.extra.split(/[\s,]+/).slice(0, 2).join(' ');
    return `${baseName} + ${extraShort}`;
  }

  return baseName;
}

export default function DayCard({ dayData, onClick, isToday, onClear, highlightedMeals, ingredientsMode }) {
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
        highlightedMeals?.length
          ? 'border-amber-300 shadow-sm shadow-amber-100'
          : isToday
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
          const isHighlighted = highlightedMeals?.some(m => m.tipo === meal.tipo);
          return (
            <div key={meal.tipo} className={`flex items-center gap-1.5 rounded px-0.5 -mx-0.5 transition-colors ${isHighlighted ? 'bg-amber-50 ring-1 ring-amber-300' : ''}`}>
              <span className={`w-4 flex items-center justify-center ${isHighlighted ? 'text-amber-500' : 'text-gray-400'}`}>
                {MealIcon ? <MealIcon className="w-3 h-3" /> : <span className="text-xs">•</span>}
              </span>
              <div className="flex-1 min-w-0">
                {meal.baby ? (
                  <p className={`text-xs truncate ${isHighlighted ? 'text-amber-700 font-medium' : 'text-gray-700'}`}>{summaryText(meal, ingredientsMode)}</p>
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

      {/* Contribution pills */}
      <div className="px-3 pb-2 flex flex-wrap gap-1">
        {kpi.hasIron && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-100">
            <Droplets className="w-2.5 h-2.5 shrink-0" />+1
          </span>
        )}
        {kpi.hasFish && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
            <Fish className="w-2.5 h-2.5 shrink-0" />+1
          </span>
        )}
        {kpi.hasLegume && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-100">
            <Bean className="w-2.5 h-2.5 shrink-0" />+1
          </span>
        )}
        {kpi.hasFruit && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-100">
            <Apple className="w-2.5 h-2.5 shrink-0" />+1
          </span>
        )}
        {kpi.veggies.length > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded bg-lime-50 text-lime-700 border border-lime-100">
            <Leaf className="w-2.5 h-2.5 shrink-0" />+{kpi.veggies.length}
          </span>
        )}
        {filledMeals.length === 0 && (
          <span className="text-[10px] text-gray-300">Sin planificar</span>
        )}
      </div>
    </div>
  );
}
