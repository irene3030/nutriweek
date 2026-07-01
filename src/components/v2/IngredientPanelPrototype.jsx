import { useState } from 'react';
import {
  Fish, Leaf, Egg, Bean, Utensils, ChefHat,
  Refrigerator, ChevronLeft, ChevronRight,
  Plus, Check, User, Baby, Sparkles,
} from 'lucide-react';

// ── Mock data ──────────────────────────────────────────────────────────────────

const INGREDIENTS = [
  { id: 'f1', name: 'Dorada',   type: 'flotante',      Icon: Fish,     bg: 'bg-sky-50',     border: 'border-sky-200',    icon: 'text-sky-500'     },
  { id: 'f2', name: 'Brócoli',  type: 'flotante',      Icon: Leaf,     bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-500' },
  { id: 'f3', name: 'Huevos',   type: 'flotante',      Icon: Egg,      bg: 'bg-amber-50',   border: 'border-amber-200',  icon: 'text-amber-500'   },
  { id: 'p1', name: 'Pollo al horno',    type: 'ya-preparado', Icon: Utensils, bg: 'bg-teal-50', border: 'border-teal-200', icon: 'text-teal-600', meta: '3 rac.' },
  { id: 'p2', name: 'Crema calabaza',    type: 'ya-preparado', Icon: ChefHat,  bg: 'bg-teal-50', border: 'border-teal-200', icon: 'text-teal-600', meta: '2 rac.' },
  { id: 'a1', name: 'Garbanzos cocidos', type: 'acelerador',   Icon: Bean,     bg: 'bg-violet-50', border: 'border-violet-200', icon: 'text-violet-500', meta: 'base' },
];

const TYPE_LABEL = { flotante: 'Ingrediente', 'ya-preparado': 'Listo', acelerador: 'Base' };
const TYPE_BADGE  = {
  flotante:       'bg-rose-100 text-rose-700',
  'ya-preparado': 'bg-teal-100 text-teal-700',
  acelerador:     'bg-violet-100 text-violet-700',
};

const SLOTS = ['Desayuno', 'Snack', 'Comida', 'Merienda', 'Cena'];
const DAYS  = ['Hoy', 'Mañana', 'Pasado'];

const MOCK_PLAN = {
  Hoy:    { Desayuno: { label: 'Tostadas con aguacate', type: 'ya-preparado' }, Comida: { label: 'Pollo al horno', type: 'ya-preparado', confirmed: true } },
  Mañana: { Desayuno: { label: 'Yogur con fruta',       type: 'ya-preparado' } },
  Pasado: {},
};

// ── Sub-components ─────────────────────────────────────────────────────────────

function IngredientCard({ item }) {
  return (
    <div
      className={`flex flex-col items-center gap-2 p-3 rounded-xl border cursor-grab select-none
        ${item.bg} ${item.border}
        hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 active:cursor-grabbing`}
    >
      <div className={`w-10 h-10 rounded-xl ${item.bg} flex items-center justify-center`}>
        <item.Icon className={`w-6 h-6 ${item.icon}`} />
      </div>
      <span className="text-xs font-semibold text-gray-700 text-center leading-tight w-full truncate text-center">
        {item.name}
      </span>
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${TYPE_BADGE[item.type]}`}>
        {item.meta ?? TYPE_LABEL[item.type]}
      </span>
    </div>
  );
}

function IngredientChip({ item }) {
  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-grab select-none shrink-0
        ${item.bg} ${item.border}
        hover:shadow-sm transition-shadow active:cursor-grabbing`}
    >
      <item.Icon className={`w-4 h-4 shrink-0 ${item.icon}`} />
      <div className="leading-tight">
        <p className="text-xs font-semibold text-gray-700">{item.name}</p>
        <p className="text-[10px] text-gray-400">{item.meta ?? TYPE_LABEL[item.type]}</p>
      </div>
    </div>
  );
}

function NeveraContent({ compact = false }) {
  const ingredientes = INGREDIENTS.filter(i => i.type === 'flotante');
  const preps        = INGREDIENTS.filter(i => i.type !== 'flotante');

  if (compact) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto py-3 px-4 scrollbar-none">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide shrink-0 mr-1">Ingredientes</span>
        {ingredientes.map(item => <IngredientChip key={item.id} item={item} />)}
        <div className="w-px h-6 bg-gray-200 shrink-0 mx-2" />
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide shrink-0 mr-1">Preparaciones</span>
        {preps.map(item => <IngredientChip key={item.id} item={item} />)}
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4 overflow-y-auto flex-1">
      <div>
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 px-0.5">Ingredientes</p>
        <div className="grid grid-cols-2 gap-2">
          {ingredientes.map(item => <IngredientCard key={item.id} item={item} />)}
        </div>
      </div>
      <div className="border-t border-gray-100 pt-4">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2 px-0.5">Preparaciones</p>
        <div className="grid grid-cols-2 gap-2">
          {preps.map(item => <IngredientCard key={item.id} item={item} />)}
        </div>
      </div>
    </div>
  );
}

function NeveraPanel({ onToggle, side = 'left' }) {
  return (
    <div className="flex flex-col bg-white border-gray-200 h-full w-64 shrink-0"
      style={{ borderRight: side === 'left' ? '1px solid #e5e7eb' : 'none', borderLeft: side === 'right' ? '1px solid #e5e7eb' : 'none' }}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <Refrigerator className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-700">Nevera</span>
        </div>
        {onToggle && (
          <button
            onClick={onToggle}
            className="w-6 h-6 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {side === 'left' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        )}
      </div>
      <NeveraContent />
    </div>
  );
}

function CollapsedPanel({ onToggle, side = 'left' }) {
  return (
    <div
      className="flex flex-col items-center py-4 gap-3 bg-white shrink-0 cursor-pointer hover:bg-gray-50 transition-colors"
      style={{
        width: 40,
        borderRight: side === 'left' ? '1px solid #e5e7eb' : 'none',
        borderLeft: side === 'right' ? '1px solid #e5e7eb' : 'none',
      }}
      onClick={onToggle}
    >
      <Refrigerator className="w-4 h-4 text-gray-400" />
      <div className="flex flex-col gap-1.5">
        {INGREDIENTS.slice(0, 4).map(item => (
          <div
            key={item.id}
            className={`w-6 h-6 rounded-lg ${item.bg} ${item.border} border flex items-center justify-center`}
          >
            <item.Icon className={`w-3.5 h-3.5 ${item.icon}`} />
          </div>
        ))}
      </div>
      {side === 'left'
        ? <ChevronRight className="w-3.5 h-3.5 text-gray-400 mt-auto" />
        : <ChevronLeft  className="w-3.5 h-3.5 text-gray-400 mt-auto" />
      }
    </div>
  );
}

function MockSlotRow({ name, content, isDropTarget }) {
  return (
    <div className={`flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0 transition-colors ${isDropTarget ? 'bg-brand-50/60 rounded-xl px-2 -mx-2' : ''}`}>
      <span className="w-20 shrink-0 text-xs font-medium text-gray-400 uppercase tracking-wide pt-0.5">
        {name}
      </span>
      {content ? (
        <div className="flex-1 flex items-center gap-2 flex-wrap">
          <span className={`text-sm font-medium ${content.confirmed ? 'text-gray-400' : 'text-gray-800'}`}>
            {content.label}
          </span>
          {content.confirmed ? (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-100">
              <Check className="w-3 h-3 text-green-600" />
            </span>
          ) : (
            <span className="text-xs px-1.5 py-0.5 rounded-full bg-brand-100 text-brand-700 font-medium">Listo</span>
          )}
        </div>
      ) : isDropTarget ? (
        <div className="flex-1 border-2 border-dashed border-brand-300 rounded-xl py-2 px-3 text-xs text-brand-500 font-medium">
          Soltar aquí
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-600 transition-colors group">
            <Plus className="w-3.5 h-3.5 group-hover:text-brand-500" />
            <span>Añadir</span>
          </button>
          {(name === 'Comida' || name === 'Cena') && (
            <button className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 transition-colors">
              <Sparkles className="w-3 h-3" />
              <span>Proponer</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MockDayColumn({ day, dragTarget }) {
  const plan = MOCK_PLAN[day] || {};
  const isDropDay = dragTarget?.day === day;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex-1 min-w-0">
      <div className="px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-semibold text-gray-800">{day}</span>
      </div>
      <div className="px-3 py-0.5">
        {SLOTS.map(slot => (
          <MockSlotRow
            key={slot}
            name={slot}
            content={plan[slot] ?? null}
            isDropTarget={isDropDay && slot === dragTarget.slot && !plan[slot]}
          />
        ))}
      </div>
    </div>
  );
}

function DayGrid({ dragTarget }) {
  return (
    <div className="flex gap-4 flex-1 min-w-0">
      {DAYS.map(day => <MockDayColumn key={day} day={day} dragTarget={dragTarget} />)}
    </div>
  );
}

// ── Variants ───────────────────────────────────────────────────────────────────

function VariantA({ dragTarget }) {
  return (
    <div className="flex gap-4 h-full">
      <NeveraPanel side="left" />
      <DayGrid dragTarget={dragTarget} />
    </div>
  );
}

function VariantB({ dragTarget }) {
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm shrink-0">
        <div className="flex items-center gap-3 px-4 pt-3 pb-0">
          <Refrigerator className="w-4 h-4 text-gray-500 shrink-0" />
          <span className="text-sm font-semibold text-gray-700">Nevera</span>
        </div>
        <NeveraContent compact />
      </div>
      <DayGrid dragTarget={dragTarget} />
    </div>
  );
}

function VariantC({ dragTarget }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="flex gap-4 h-full">
      {open
        ? <NeveraPanel side="left" onToggle={() => setOpen(false)} />
        : <CollapsedPanel side="left" onToggle={() => setOpen(true)} />
      }
      <DayGrid dragTarget={dragTarget} />
    </div>
  );
}

function VariantD({ dragTarget }) {
  return (
    <div className="flex gap-4 h-full">
      <DayGrid dragTarget={dragTarget} />
      <NeveraPanel side="right" />
    </div>
  );
}

// ── Switcher ───────────────────────────────────────────────────────────────────

const VARIANTS = [
  { id: 'A', label: 'Panel izquierdo',  desc: 'Nevera fija a la izquierda' },
  { id: 'B', label: 'Banda superior',   desc: 'Strip horizontal encima de los días' },
  { id: 'C', label: 'Panel colapsable', desc: 'Panel izq. con toggle abre/cierra' },
  { id: 'D', label: 'Panel derecho',    desc: 'Nevera fija a la derecha' },
];

// ── Main component ─────────────────────────────────────────────────────────────

export default function IngredientPanelPrototype() {
  const [variant, setVariant] = useState('A');
  const [dragActive, setDragActive] = useState(false);

  const dragTarget = dragActive ? { day: 'Mañana', slot: 'Comida' } : null;

  const VariantComponent = { A: VariantA, B: VariantB, C: VariantC, D: VariantD }[variant];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Proto header */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 shrink-0">
        <div className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
            {VARIANTS.map(v => (
              <button
                key={v.id}
                onClick={() => setVariant(v.id)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  variant === v.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {v.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400 hidden lg:block">
              {VARIANTS.find(v => v.id === variant)?.desc}
            </span>
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs font-medium text-gray-600">Simular arrastre</span>
              <button
                role="switch"
                aria-checked={dragActive}
                onClick={() => setDragActive(v => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${dragActive ? 'bg-brand-600' : 'bg-gray-200'}`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${dragActive ? 'translate-x-4' : 'translate-x-1'}`}
                />
              </button>
            </label>
          </div>
        </div>

        {dragActive && (
          <p className="text-xs text-brand-600 mt-2 font-medium">
            Arrastrando "Dorada" → Comida de Mañana
          </p>
        )}
      </div>

      {/* Variant content */}
      <div className="flex-1 p-4 lg:p-6 min-h-0">
        <VariantComponent dragTarget={dragTarget} />
      </div>
    </div>
  );
}
