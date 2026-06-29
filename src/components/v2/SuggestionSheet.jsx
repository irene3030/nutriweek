import { X, Sparkles, RefreshCw } from 'lucide-react';
import SuggestedPrepCard from './SuggestedPrepCard';

export default function SuggestionSheet({
  title,
  proposals,
  loading,
  error,
  onFetch,
  onRefetch,
  onClose,
  onSelect,
  inventoryItems = [],
  selectLabel = 'Seleccionar',
  headerContent,
}) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-40 bg-gray-50 rounded-t-3xl max-h-[85vh] flex flex-col lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:bottom-auto lg:top-[10vh] lg:w-full lg:max-w-[520px] lg:rounded-2xl">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-brand-600" />
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Optional extra UI (e.g. time picker) */}
        {headerContent && (
          <div className="px-4 pb-2 shrink-0">
            {headerContent}
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-4">

          {/* Initial CTA (only shown when no proposals and no loading and headerContent isn't handling it) */}
          {!proposals && !loading && !headerContent && (
            <button
              onClick={onFetch}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              Generar sugerencias
            </button>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center gap-3 py-8 text-gray-400">
              <div className="w-5 h-5 border-2 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
              <span className="text-sm">Buscando opciones…</span>
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5 text-center">
              {error}
              <button
                onClick={onFetch}
                className="block mx-auto mt-2 text-xs text-red-600 underline"
              >
                Reintentar
              </button>
            </div>
          )}

          {/* Proposals */}
          {proposals && !loading && (
            <div className="space-y-3">
              {proposals.map((proposal, i) => (
                <SuggestedPrepCard
                  key={i}
                  proposal={proposal}
                  inventoryItems={inventoryItems}
                  onSelect={onSelect}
                  selectLabel={selectLabel}
                />
              ))}

              <button
                onClick={onRefetch}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-gray-200 bg-white text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Pedir otras opciones
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
