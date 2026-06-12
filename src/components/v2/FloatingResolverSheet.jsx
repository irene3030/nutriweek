import { useState, useEffect } from 'react';
import { resolveFloating } from '../../lib/claude';
import SuggestionSheet from './SuggestionSheet';
import { daysUntil } from '../../hooks/useInventory';

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

export default function FloatingResolverSheet({ floatingItem, inventoryItems, weeklyKpis, pantryItems, onClose, onSelect }) {
  const [proposals, setProposals] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  async function fetchProposals() {
    setLoading(true);
    setError(null);
    try {
      const result = await resolveFloating({
        floatingItem: { id: floatingItem.id, name: floatingItem.name, amount: floatingItem.amount ?? '' },
        inventoryItems: buildInventoryPayload(inventoryItems),
        weeklyKpis,
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

  // Auto-fetch on mount
  useEffect(() => { fetchProposals(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SuggestionSheet
      title={`¿Qué hago con ${floatingItem.name}?`}
      proposals={proposals}
      loading={loading}
      error={error}
      onFetch={fetchProposals}
      onRefetch={fetchProposals}
      onClose={onClose}
      onSelect={onSelect}
      inventoryItems={inventoryItems}
      selectLabel="Planear"
    />
  );
}
