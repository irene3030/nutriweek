import { useState } from 'react';
import { X, Sparkles, RefreshCw, Zap } from 'lucide-react';
import { suggestCookingTime } from '../../lib/claude';
import SuggestedPrepCard from './SuggestedPrepCard';
import { daysUntil } from '../../hooks/useInventory';

const TIME_OPTIONS = [
  { value: 15,    label: '15 min' },
  { value: 30,    label: '30 min' },
  { value: 60,    label: '1 hora' },
  { value: 'más', label: 'Más tiempo' },
];

function buildInventoryPayload(inventoryItems) {
  return [...inventoryItems]
    .sort((a, b) => {
      const da = a.expiresAt ? daysUntil(a.expiresAt) : 999;
      const db = b.expiresAt ? daysUntil(b.expiresAt) : 999;
      return da - db;
    })
    .slice(0, 15)
    .map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      adultPortions: item.adultPortions ?? item.portionsAdult ?? 0,
      babyPortions:  item.babyPortions  ?? item.portionsBaby  ?? 0,
      daysLeft: item.expiresAt ? daysUntil(item.expiresAt) : null,
      tags: item.tags ?? [],
    }));
}

export default function CookingTimeSheet({ inventoryItems, weeklyKpis, pantryItems, onClose, onSelect }) {
  const [selectedTime, setSelectedTime] = useState(null);
  const [proposals, setProposals]       = useState(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);

  const recentPreps = inventoryItems.slice(0, 5).map(i => i.name);

  async function fetchProposals(minutes) {
    setLoading(true);
    setError(null);
    setProposals(null);
    try {
      const result = await suggestCookingTime({
        minutes,
        inventoryItems: buildInventoryPayload(inventoryItems),
        weeklyKpis,
        recentPreps,
        pantryItems,
      });
      if (!result?.proposals?.length) throw new Error('Sin propuestas');
      setProposals(result.proposals);
    } catch (err) {
      setError(err.message || 'Error al generar sugerencias');
    } finally {
      setLoading(false);
    }
  }

  function handleTimeSelect(value) {
    setSelectedTime(value);
    fetchProposals(value);
  }

  const readyProposals = proposals?.filter(p => p.prepType !== 'acelerador') ?? [];
  const baseProposals  = proposals?.filter(p => p.prepType === 'acelerador') ?? [];

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />

      <div className="fixed inset-x-0 bottom-0 z-40 bg-gray-50 rounded-t-3xl max-h-[85vh] flex flex-col">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-600" />
            <h2 className="text-base font-semibold text-gray-900">¿Qué preparo ahora?</h2>
          </div>
          <button onClick={onClose} className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-200 transition-colors">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Time picker */}
        <div className="px-4 pb-3 shrink-0 space-y-2">
          <p className="text-xs text-gray-500 font-medium">¿Cuánto tiempo tienes?</p>
          <div className="grid grid-cols-4 gap-2">
            {TIME_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleTimeSelect(opt.value)}
                disabled={loading}
                className={`py-2.5 rounded-xl text-xs font-medium border transition-colors ${
                  selectedTime === opt.value
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-5">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-8 text-gray-400">
              <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
              <span className="text-sm">Buscando opciones…</span>
            </div>
          )}

          {error && !loading && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-center">
              {error}
              <button onClick={() => selectedTime && fetchProposals(selectedTime)} className="block mx-auto mt-2 text-xs underline">
                Reintentar
              </button>
            </div>
          )}

          {proposals && !loading && (
            <>
              {/* Sección: para tener listo */}
              {readyProposals.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Para tener listo</p>
                  {readyProposals.map((p, i) => (
                    <SuggestedPrepCard key={i} proposal={p} inventoryItems={inventoryItems} onSelect={onSelect} selectLabel="Cocinar" />
                  ))}
                </div>
              )}

              {/* Sección: bases para agilizar */}
              {baseProposals.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-violet-500" />
                    <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Base para agilizar la semana</p>
                  </div>
                  {baseProposals.map((p, i) => (
                    <SuggestedPrepCard key={i} proposal={p} inventoryItems={inventoryItems} onSelect={onSelect} selectLabel="Preparar base" />
                  ))}
                </div>
              )}

              <button
                onClick={() => selectedTime && fetchProposals(selectedTime)}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Pedir otras opciones
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}
