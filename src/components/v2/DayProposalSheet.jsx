import { useState, useRef, useEffect } from 'react';
import { X, Sparkles, User, Baby, Check, Package, ShoppingCart, Home, RefreshCw } from 'lucide-react';
import { proposeMeal } from '../../lib/claude';
import { daysUntil } from '../../hooks/useInventory';

const SHEET_KPIS = [
  { key: 'iron',   emoji: '🩸', label: 'Hierro',   check: (tags) => tags.includes('iron') },
  { key: 'fish',   emoji: '🐟', label: 'Pescado',  check: (tags) => tags.includes('oily_fish') },
  { key: 'legume', emoji: '🫘', label: 'Legumbre', check: (tags) => tags.includes('legume') },
  { key: 'veggie', emoji: '🥦', label: 'Verduras', count: (tags) => new Set(tags.filter(t => t.startsWith('veggie:')).map(t => t.slice(7))).size },
  { key: 'fruit',  emoji: '🍎', label: 'Fruta',    check: (tags) => tags.includes('fruit') },
];

function SheetDailyKpiRow({ todaySlots }) {
  const tags = Object.values(todaySlots || {}).flatMap(slot => (slot?.items || []).flatMap(i => i.tags || []));
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {SHEET_KPIS.map(({ key, emoji, label, check, count }) => {
        const ok = count ? count(tags) > 0 : check(tags);
        const n  = count ? count(tags) : null;
        return (
          <span key={key} className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg font-medium ${ok ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
            {emoji}
            <span>{n !== null && n > 0 ? `${n} ${label.toLowerCase()}` : label}</span>
            {ok && <span className="font-bold">✓</span>}
          </span>
        );
      })}
    </div>
  );
}

const PREP_TYPE_BADGES = {
  'ya-preparado': { label: 'Listo',       color: 'bg-brand-100 text-brand-700' },
  acelerador:     { label: 'Base',        color: 'bg-violet-100 text-violet-700' },
  'justo-antes':  { label: 'Justo-antes', color: 'bg-purple-100 text-purple-700' },
};

function SourceIcon({ source }) {
  if (source === 'stock') return <Check className="w-3 h-3 text-green-500 shrink-0" />;
  if (source === 'despensa') return <Home className="w-3 h-3 text-gray-400 shrink-0" />;
  return <ShoppingCart className="w-3 h-3 text-amber-500 shrink-0" />;
}

function ProposalCard({ proposal, onSelect, selected }) {
  const badge = PREP_TYPE_BADGES[proposal.prepType];

  return (
    <div
      className={`bg-white border rounded-2xl p-3 space-y-2 cursor-pointer transition-colors ${
        selected ? 'border-brand-500 ring-1 ring-brand-400' : 'border-gray-100 hover:border-brand-200'
      }`}
      onClick={() => onSelect(proposal)}
    >
      <div className="flex items-start gap-2 flex-wrap">
        <span className="flex-1 text-sm font-semibold text-gray-900 leading-tight">{proposal.name}</span>
        {badge && (
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
            {badge.label}
          </span>
        )}
        {selected && (
          <span className="shrink-0 flex items-center justify-center w-5 h-5 rounded-full bg-brand-600">
            <Check className="w-3 h-3 text-white" />
          </span>
        )}
      </div>
      {proposal.description && (
        <p className="text-xs text-gray-500 leading-snug">{proposal.description}</p>
      )}
      {proposal.ingredients?.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {proposal.ingredients.map((ing, i) => (
            <span key={i} className="flex items-center gap-1 text-xs text-gray-600">
              <SourceIcon source={ing.source} />
              {ing.name}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3 text-xs text-gray-400">
        {proposal.prepTime && <span className="text-violet-500 font-medium">{proposal.prepTime}</span>}
        <span className="flex items-center gap-0.5"><User className="w-3 h-3" /> {proposal.adultPortions ?? 2}</span>
        <span className="flex items-center gap-0.5"><Baby className="w-3 h-3" /> {proposal.babyPortions ?? 1}</span>
      </div>
    </div>
  );
}

function SlotSection({ slotId, label, inventoryItems, todaySlots, weeklyKpis, pantryItems, date, onConfirm, autoPropose, timeOfDay }) {
  const [braindump, setBraindump] = useState('');
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState(null);
  const [dayGaps, setDayGaps] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const didAutoPropose = useRef(false);

  function buildInventoryPayload() {
    return [...inventoryItems].sort((a, b) => {
      const da = a.expiresAt ? daysUntil(a.expiresAt) : 999;
      const db = b.expiresAt ? daysUntil(b.expiresAt) : 999;
      return da - db;
    }).slice(0, 15).map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      adultPortions: item.adultPortions ?? item.portionsAdult ?? 0,
      babyPortions: item.babyPortions ?? item.portionsBaby ?? 0,
      daysLeft: item.expiresAt ? daysUntil(item.expiresAt) : null,
      tags: item.tags ?? [],
    }));
  }

  useEffect(() => {
    if (autoPropose && !didAutoPropose.current) {
      didAutoPropose.current = true;
      handlePropose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPropose]);

  async function handlePropose() {
    setLoading(true);
    setError(null);
    setProposals(null);
    setSelected(null);
    try {
      const result = await proposeMeal({
        slotId,
        dateStr: date,
        inventoryItems: buildInventoryPayload(),
        braindump,
        todaySlots,
        weeklyKpis,
        pantryItems,
        timeOfDay,
      });
      if (!result?.proposals?.length) throw new Error('Sin propuestas');
      setProposals(result.proposals);
      if (result.dayGaps) setDayGaps(result.dayGaps);
    } catch (err) {
      setError(err.message || 'Error al generar propuestas');
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(proposal) {
    setSelected(proposal);
    const stockIng = proposal.ingredients?.find(i => i.source === 'stock' && i.inventoryId);
    let itemType = 'manual';
    if (proposal.prepType === 'ya-preparado') itemType = 'ya-preparado';
    else if (proposal.prepType === 'acelerador') itemType = 'acelerador';
    const entry = {
      inventoryItemId: stockIng?.inventoryId ?? null,
      label: proposal.name,
      itemType,
      tags: proposal.tags ?? [],
      prepTime: proposal.prepTime ?? null,
      accelBase: proposal.prepType === 'acelerador' ? proposal.description : null,
      portionsAdultConsumed: proposal.adultPortions ?? 2,
      portionsBabyConsumed: proposal.babyPortions ?? 1,
    };
    onConfirm(entry);
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-brand-500" />
        {label}
      </h3>

      {!proposals && (
        <div className="space-y-2">
          <textarea
            value={braindump}
            onChange={e => setBraindump(e.target.value)}
            placeholder="Ingredientes extra no registrados… (opcional)"
            className="w-full text-xs border border-gray-200 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
            rows={2}
            disabled={loading}
          />
          <button
            onClick={handlePropose}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-60"
          >
            {loading ? (
              <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Buscando...</>
            ) : (
              <><Sparkles className="w-3.5 h-3.5" /> Proponer {label.toLowerCase()}</>
            )}
          </button>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 text-center">
          {error}
          <button onClick={handlePropose} className="block mx-auto mt-1 text-xs underline">Reintentar</button>
        </div>
      )}

      {proposals && (
        <div className="space-y-2">
          {dayGaps && typeof dayGaps === 'string' && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
              <span className="text-amber-500 text-xs shrink-0">↗</span>
              <p className="text-xs text-amber-800 leading-snug">{dayGaps}</p>
            </div>
          )}
          {proposals.map((p, i) => (
            <ProposalCard key={i} proposal={p} onSelect={handleSelect} selected={selected?.name === p.name} />
          ))}
          <button
            onClick={handlePropose}
            disabled={loading}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border border-gray-200 bg-white text-xs text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-60"
          >
            {loading
              ? <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
              : <><RefreshCw className="w-3 h-3" /> Pedir otras opciones</>
            }
          </button>
        </div>
      )}
    </div>
  );
}

export default function DayProposalSheet({
  date,
  inventoryItems,
  todaySlots,
  weeklyKpis,
  pantryItems,
  onSelectComida,
  onSelectCena,
  onClose,
  autoPropose = false,
  timeOfDay,
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />

      <div className="fixed inset-x-0 bottom-0 z-40 bg-gray-50 rounded-t-3xl max-h-[90vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-600" />
            <h2 className="text-base font-semibold text-gray-900">
              {autoPropose ? 'Planificando hoy…' : 'Sugerir comida y cena'}
            </h2>
          </div>
          <button onClick={onClose} className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-200 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {inventoryItems.length > 0 && (
          <div className="px-4 pb-2 flex items-center gap-1.5 text-xs text-gray-400">
            <Package className="w-3.5 h-3.5" />
            <span>{inventoryItems.length} preparación{inventoryItems.length > 1 ? 'es' : ''} en inventario</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-6">
          {/* KPIs del día en tiempo real */}
          <SheetDailyKpiRow todaySlots={todaySlots} />

          <SlotSection
            slotId="comida"
            label="Comida"
            inventoryItems={inventoryItems}
            todaySlots={todaySlots}
            weeklyKpis={weeklyKpis}
            pantryItems={pantryItems}
            date={date}
            onConfirm={onSelectComida}
            autoPropose={autoPropose}
            timeOfDay={timeOfDay}
          />

          <div className="border-t border-gray-100" />

          <SlotSection
            slotId="cena"
            label="Cena"
            inventoryItems={inventoryItems}
            todaySlots={todaySlots}
            weeklyKpis={weeklyKpis}
            pantryItems={pantryItems}
            date={date}
            onConfirm={onSelectCena}
            autoPropose={autoPropose}
            timeOfDay={timeOfDay}
          />
        </div>
      </div>
    </>
  );
}
