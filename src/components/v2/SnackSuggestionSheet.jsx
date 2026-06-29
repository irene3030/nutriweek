import { useState, useEffect } from 'react';
import { suggestSnack } from '../../lib/claude';
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
      daysLeft: item.expiresAt ? daysUntil(item.expiresAt) : null,
    }));
}

export default function SnackSuggestionSheet({ snackItems, inventoryItems, pantryItems, onClose, onSelect, onSchedule }) {
  const [proposals, setProposals] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);

  const recentSnacks = snackItems.map(i => i.name);

  async function fetchProposals() {
    setLoading(true);
    setError(null);
    try {
      const result = await suggestSnack({
        recentSnacks,
        inventoryItems: buildInventoryPayload(inventoryItems),
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

  useEffect(() => { fetchProposals(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SuggestionSheet
      title="¿Qué snack preparo?"
      proposals={proposals}
      loading={loading}
      error={error}
      onFetch={fetchProposals}
      onRefetch={fetchProposals}
      onClose={onClose}
      onSelect={onSelect}
      onSchedule={onSchedule}
      inventoryItems={inventoryItems}
      selectLabel="Preparar"
    />
  );
}
