import { useState } from 'react';
import { X, Sparkles, User, Baby, Check, Package, ShoppingCart, Home, RefreshCw } from 'lucide-react';
import { proposeMeal } from '../../lib/claude';
import { daysUntil } from '../../hooks/useInventory';

const SLOT_LABELS = {
  comida:   'Comida',
  cena:     'Cena',
  desayuno: 'Desayuno',
  snack:    'Snack',
  merienda: 'Merienda',
};

const PREP_TYPE_BADGES = {
  'ya-preparado': { label: 'Listo',       color: 'bg-brand-100 text-brand-700' },
  acelerador:     { label: 'Justo-antes', color: 'bg-violet-100 text-violet-700' },
  'justo-antes':  { label: 'Justo-antes', color: 'bg-violet-100 text-violet-700' },
};

const KPI_BOOST_LABELS = {
  legume: 'Cubre legumbre',
  fish:   'Cubre pescado azul',
  iron:   'Cubre hierro',
  veggie: 'Añade verduras',
};

function SourceIcon({ source }) {
  if (source === 'stock') return <Check className="w-3 h-3 text-green-500 shrink-0" />;
  if (source === 'despensa') return <Home className="w-3 h-3 text-gray-400 shrink-0" />;
  return <ShoppingCart className="w-3 h-3 text-amber-500 shrink-0" />;
}

function ProposalCard({ proposal, onSelect }) {
  const badge = PREP_TYPE_BADGES[proposal.prepType];
  const kpiLabel = proposal.kpiBoost ? KPI_BOOST_LABELS[proposal.kpiBoost] : null;

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-start gap-2 flex-wrap">
          <span className="flex-1 text-sm font-semibold text-gray-900 leading-tight">{proposal.name}</span>
          {badge && (
            <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
              {badge.label}
            </span>
          )}
        </div>
        {proposal.description && (
          <p className="text-xs text-gray-500 leading-snug">{proposal.description}</p>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          {proposal.prepTime && (
            <span className="text-xs text-violet-500 font-medium">{proposal.prepTime}</span>
          )}
          {kpiLabel && (
            <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium border border-green-100">
              {kpiLabel}
            </span>
          )}
        </div>
      </div>

      {/* Ingredients */}
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

      {/* Portions + CTA */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span className="flex items-center gap-0.5">
            <User className="w-3 h-3" /> {proposal.adultPortions ?? 2}
          </span>
          <span className="flex items-center gap-0.5">
            <Baby className="w-3 h-3" /> {proposal.babyPortions ?? 1}
          </span>
        </div>
        <button
          onClick={() => onSelect(proposal)}
          className="text-xs font-medium px-4 py-1.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors"
        >
          Seleccionar
        </button>
      </div>
    </div>
  );
}

export default function MealProposalSheet({
  slotId,
  date,
  inventoryItems,
  todaySlots,
  weeklyKpis,
  onSelect,
  onClose,
}) {
  const [braindump, setBraindump] = useState('');
  const [loading, setLoading] = useState(false);
  const [proposals, setProposals] = useState(null);
  const [dayGaps, setDayGaps] = useState(null);
  const [error, setError] = useState(null);

  const label = SLOT_LABELS[slotId] || slotId;

  // Prepare inventory payload: sort by expiry, cap at 15
  function buildInventoryPayload() {
    const sorted = [...inventoryItems].sort((a, b) => {
      const da = a.expiresAt ? daysUntil(a.expiresAt) : 999;
      const db = b.expiresAt ? daysUntil(b.expiresAt) : 999;
      return da - db;
    }).slice(0, 15);

    return sorted.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      adultPortions: item.adultPortions ?? item.portionsAdult ?? 0,
      babyPortions: item.babyPortions ?? item.portionsBaby ?? 0,
      daysLeft: item.expiresAt ? daysUntil(item.expiresAt) : null,
      tags: item.tags ?? [],
    }));
  }

  async function handlePropose() {
    setLoading(true);
    setError(null);
    setProposals(null);
    setDayGaps(null);
    try {
      const result = await proposeMeal({
        slotId,
        dateStr: date,
        inventoryItems: buildInventoryPayload(),
        braindump,
        todaySlots,
        weeklyKpis,
      });
      if (!result?.proposals?.length) throw new Error('Sin propuestas');
      setProposals(result.proposals);
      setDayGaps(result.dayGaps || null);
    } catch (err) {
      setError(err.message || 'Error al generar propuestas');
    } finally {
      setLoading(false);
    }
  }

  function handleSelect(proposal) {
    // Find primary stock ingredient for inventoryItemId
    const stockIng = proposal.ingredients?.find(i => i.source === 'stock' && i.inventoryId);

    // Map prepType to SlotEntry itemType
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

    onSelect(entry);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-30"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-40 bg-gray-50 rounded-t-3xl max-h-[85vh] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-600" />
            <h2 className="text-base font-semibold text-gray-900">¿Qué pongo en {label}?</h2>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-4">

          {/* Braindump + CTA (shown when no proposals yet) */}
          {!proposals && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1.5">
                  ¿Tienes algo en casa que no hayas registrado?
                </label>
                <textarea
                  value={braindump}
                  onChange={e => setBraindump(e.target.value)}
                  placeholder="ej: aguacate, guisantes congelados, boniato..."
                  className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-brand-300 bg-white"
                  rows={2}
                  disabled={loading}
                />
              </div>

              {/* Inventory summary pill */}
              {inventoryItems.length > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Package className="w-3.5 h-3.5" />
                  <span>
                    {inventoryItems.length} preparación{inventoryItems.length > 1 ? 'es' : ''} en inventario
                  </span>
                </div>
              )}

              <button
                onClick={handlePropose}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Buscando opciones...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Proponer opciones
                  </>
                )}
              </button>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-center">
              {error}
              <button
                onClick={handlePropose}
                className="block mx-auto mt-2 text-xs text-red-600 underline"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Proposals */}
          {proposals && (
            <div className="space-y-3">
              {dayGaps && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                  <span className="text-amber-500 text-sm shrink-0">↗</span>
                  <p className="text-xs text-amber-800 leading-snug">{dayGaps}</p>
                </div>
              )}
              {proposals.map((proposal, i) => (
                <ProposalCard key={i} proposal={proposal} onSelect={handleSelect} />
              ))}

              {/* Other options */}
              <button
                onClick={handlePropose}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                {loading ? (
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                ) : (
                  <>
                    <RefreshCw className="w-3.5 h-3.5" />
                    Pedir otras opciones
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
