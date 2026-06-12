import { useState } from 'react';
import { suggestCookingTime } from '../../lib/claude';
import SuggestionSheet from './SuggestionSheet';
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

  const timeLabel = TIME_OPTIONS.find(o => o.value === selectedTime)?.label;

  const timePicker = (
    <div className="space-y-2">
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
      {selectedTime && timeLabel && (
        <div className="flex items-center gap-1.5 text-xs text-brand-700">
          <span className="bg-brand-50 border border-brand-200 px-2 py-0.5 rounded-full font-medium">
            {timeLabel} disponibles
          </span>
        </div>
      )}
    </div>
  );

  return (
    <SuggestionSheet
      title="¿Qué preparo ahora?"
      proposals={proposals}
      loading={loading}
      error={error}
      onFetch={() => selectedTime && fetchProposals(selectedTime)}
      onRefetch={() => selectedTime && fetchProposals(selectedTime)}
      onClose={onClose}
      onSelect={onSelect}
      inventoryItems={inventoryItems}
      selectLabel="Cocinar"
      headerContent={timePicker}
    />
  );
}
