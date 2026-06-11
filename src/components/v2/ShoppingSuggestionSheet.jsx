import { useEffect, useState } from 'react';
import { X, AlertTriangle, MapPin } from 'lucide-react';
import { suggestShopping } from '../../lib/claude';
import { daysUntil } from '../../hooks/useInventory';

const PRIORITY_BADGE = {
  alta:  'bg-red-50 text-red-700 border border-red-100',
  media: 'bg-amber-50 text-amber-700 border border-amber-100',
};

function CategoryCard({ category }) {
  const badge = PRIORITY_BADGE[category.priority];
  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xl leading-none">{category.emoji}</span>
          <span className="text-sm font-semibold text-gray-900">{category.label}</span>
        </div>
        {badge && (
          <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${badge}`}>
            {category.priority}
          </span>
        )}
      </div>
      {category.why && (
        <p className="text-xs text-gray-500 leading-snug">{category.why}</p>
      )}
      {category.items?.length > 0 && (
        <p className="text-xs text-gray-700">
          {category.items.join(' · ')}
        </p>
      )}
    </div>
  );
}

export default function ShoppingSuggestionSheet({
  inventoryItems,
  expiringItems,
  floatingItems,
  weeklyKpis,
  onClose,
}) {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  function buildPayload() {
    const safeItems = [...inventoryItems]
      .sort((a, b) => {
        const da = a.expiresAt ? daysUntil(a.expiresAt) : 999;
        const db = b.expiresAt ? daysUntil(b.expiresAt) : 999;
        return da - db;
      })
      .slice(0, 20)
      .map(item => ({
        name: item.name,
        type: item.type,
        daysLeft: item.expiresAt ? daysUntil(item.expiresAt) : null,
        tags: item.tags ?? [],
      }));

    const safeExpiring = expiringItems.slice(0, 5).map(i => ({
      name: i.name,
      daysLeft: i.expiresAt ? daysUntil(i.expiresAt) : null,
    }));

    const safeFloating = floatingItems.slice(0, 5).map(i => ({ name: i.name }));

    return { inventoryItems: safeItems, weeklyKpis, expiringItems: safeExpiring, floatingItems: safeFloating };
  }

  async function fetchSuggestion() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await suggestShopping(buildPayload());
      setResult(data);
    } catch (err) {
      setError(err.message || 'Error al generar sugerencias');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSuggestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = result?.categories ?? [];
  const hasAlerts = expiringItems.length > 0 || floatingItems.length > 0;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-40 bg-gray-50 rounded-t-3xl max-h-[85vh] flex flex-col">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-gray-50 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">¿Qué compro?</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-4">

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="w-6 h-6 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Calculando qué comprar...</p>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-3 text-center space-y-2">
              <p>{error}</p>
              <button
                onClick={fetchSuggestion}
                className="text-xs text-red-600 underline"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Results */}
          {!loading && result && (
            <>
              <p className="text-xs text-gray-400">Para los próximos 3 días</p>

              {categories.length === 0 ? (
                <div className="bg-green-50 border border-green-100 rounded-2xl px-4 py-4 text-center">
                  <p className="text-sm font-medium text-green-800">Todo cubierto</p>
                  <p className="text-xs text-green-600 mt-1">Los KPIs de la semana están bien para los días que quedan.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {categories.map(cat => (
                    <CategoryCard key={cat.id} category={cat} />
                  ))}
                </div>
              )}

              {/* Expiring items — urgent context */}
              {expiringItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-amber-700 flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Usar pronto (ya en casa)
                  </p>
                  {expiringItems.map(item => (
                    <div key={item.id} className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                      <span className="text-xs text-amber-800 font-medium">{item.name}</span>
                      {item.expiresAt && (
                        <span className="text-xs text-amber-500">
                          {daysUntil(item.expiresAt) <= 0 ? 'hoy' : `${daysUntil(item.expiresAt)}d`}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Floating items — reminder */}
              {floatingItems.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-rose-600 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    Sin plan (ya en casa)
                  </p>
                  {floatingItems.map(item => (
                    <div key={item.id} className="flex items-center bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">
                      <span className="text-xs text-rose-800 font-medium">{item.name}</span>
                    </div>
                  ))}
                </div>
              )}

              {!hasAlerts && categories.length > 0 && (
                <p className="text-xs text-gray-400 text-center pb-2">
                  No hay marcas obligatorias — elige libremente dentro de cada categoría.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
