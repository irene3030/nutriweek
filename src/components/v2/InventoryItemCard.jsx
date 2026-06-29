import { Trash2, Baby, User, Pencil, CalendarPlus, Cookie, Archive } from 'lucide-react';
import TagChip from '../ui/TagChip';
import FreshnessIndicator from './FreshnessIndicator';
import { daysUntil } from '../../hooks/useInventory';

const TYPE_CONFIG = {
  'ya-preparado': { label: 'Preparado', color: 'bg-brand-100 text-brand-700' },
  acelerador:     { label: 'Acelerador', color: 'bg-violet-100 text-violet-700' },
  'snack-batch':  { label: 'Snack', color: 'bg-amber-100 text-amber-700' },
  flotante:       { label: 'Sin plan', color: 'bg-rose-100 text-rose-700' },
};

export default function InventoryItemCard({ item, onDelete, onEdit, onAddToToday, onMoveToPantry }) {
  const typeConfig = TYPE_CONFIG[item.type] || { label: item.type, color: 'bg-gray-100 text-gray-600' };
  const isSnack = item.type === 'snack-batch';

  const days = item.expiresAt ? daysUntil(item.expiresAt) : null;
  const isExpiringSoon = days !== null && days <= 3;
  const borderClass = isExpiringSoon ? 'border-amber-300' : item.type === 'flotante' ? 'border-rose-100' : 'border-gray-100';

  return (
    <div className={`bg-white rounded-2xl border p-4 flex items-start gap-3 ${borderClass}`}>
      <div className="flex-1 min-w-0 space-y-2">
        {/* Name + type badge */}
        <div className="flex items-start gap-2 flex-wrap">
          <span className="font-semibold text-gray-900 leading-snug">{item.name}</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${typeConfig.color}`}>
            {typeConfig.label}
          </span>
        </div>

        {/* Portions / units */}
        <div className="flex items-center gap-3 text-sm text-gray-600">
          {isSnack ? (
            <span className="flex items-center gap-1">
              <Cookie className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-gray-800">{item.units ?? 0}</span>
              <span className="text-gray-400">unidades</span>
            </span>
          ) : item.type === 'flotante' ? (
            item.amount ? (
              <span className="text-sm text-gray-700 font-medium">{item.amount}</span>
            ) : (
              <span className="text-gray-400 text-xs">Cantidad no especificada</span>
            )
          ) : (
            <>
              {item.portionsAdult > 0 && (
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-gray-400" />
                  <span className="font-medium text-gray-800">{item.portionsAdult}</span>
                </span>
              )}
              {item.portionsBaby > 0 && (
                <span className="flex items-center gap-1">
                  <Baby className="w-3.5 h-3.5 text-gray-400" />
                  <span className="font-medium text-gray-800">{item.portionsBaby}</span>
                </span>
              )}
            </>
          )}
          {item.expiresAt && (
            <FreshnessIndicator expiresAt={item.expiresAt} daysUntil={daysUntil} />
          )}
        </div>

        {/* Tags */}
        {item.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {item.tags.map((t) => (
              <TagChip key={t} tag={t} small />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        {onAddToToday && (
          <button
            onClick={() => onAddToToday(item)}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-gray-300 hover:text-brand-500 hover:bg-brand-50 transition-colors"
            aria-label={`Añadir ${item.name} a hoy`}
          >
            <CalendarPlus className="w-4 h-4" />
          </button>
        )}
        {onMoveToPantry && (
          <button
            onClick={() => onMoveToPantry(item)}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-gray-300 hover:text-amber-500 hover:bg-amber-50 transition-colors"
            aria-label={`Mover ${item.name} a la despensa`}
            title="Mover a despensa"
          >
            <Archive className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => onEdit?.(item)}
          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-gray-300 hover:text-brand-500 hover:bg-brand-50 transition-colors"
          aria-label={`Editar ${item.name}`}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(item.id)}
          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
          aria-label={`Eliminar ${item.name}`}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
