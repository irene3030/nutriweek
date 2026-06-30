import { Trash2, Pencil, CalendarPlus, Archive, ChefHat, Wand2 } from 'lucide-react';
import TagChip from '../ui/TagChip';


export default function InventoryItemCard({ item, onDelete, onEdit, onAddToToday, onMoveToPantry, onResolve, hasPendingPrep }) {
  const borderClass = item.type === 'flotante' ? 'border-rose-100' : 'border-gray-100';

  return (
    <div className={`bg-white rounded-2xl border p-4 flex items-start gap-3 ${borderClass}`}>
      <div className="flex-1 min-w-0 space-y-2">
        {/* Name + pending badge */}
        <div className="flex items-start gap-2 flex-wrap">
          <span className="font-semibold text-gray-900 leading-snug">{item.name}</span>
          {hasPendingPrep && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full shrink-0 bg-violet-100 text-violet-700 flex items-center gap-1">
              <ChefHat className="w-3 h-3" /> En cola
            </span>
          )}
        </div>

        {/* Amount (flotante only) */}
        {item.type === 'flotante' && item.amount && (
          <span className="text-sm text-gray-500">{item.amount}</span>
        )}

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
        {onResolve && (
          <button
            onClick={() => onResolve(item)}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-rose-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
            aria-label="Sugerir qué hacer"
            title="¿Qué hago con esto?"
          >
            <Wand2 className="w-4 h-4" />
          </button>
        )}
        {onAddToToday && (
          <button
            onClick={() => onAddToToday(item)}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-gray-300 hover:text-brand-500 hover:bg-brand-50 transition-colors"
            aria-label="Añadir a hoy"
            title="Añadir a hoy"
          >
            <CalendarPlus className="w-4 h-4" />
          </button>
        )}
        {onMoveToPantry && (
          <button
            onClick={() => onMoveToPantry(item)}
            className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-gray-300 hover:text-amber-500 hover:bg-amber-50 transition-colors"
            aria-label="Mover a despensa"
            title="Mover a despensa"
          >
            <Archive className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={() => onEdit?.(item)}
          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-gray-300 hover:text-brand-500 hover:bg-brand-50 transition-colors"
          aria-label="Editar"
          title="Editar"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDelete(item.id)}
          className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-xl text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors"
          aria-label="Eliminar"
          title="Eliminar"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
