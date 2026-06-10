import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import PlanSlotRow from './PlanSlotRow';
import SlotPickerSheet from './SlotPickerSheet';

const SLOTS = ['desayuno', 'snack', 'comida', 'merienda', 'cena'];

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatDateHeader(dateStr, offsetLabel) {
  const d = new Date(dateStr + 'T12:00:00');
  return `${offsetLabel} · ${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`;
}

export default function DayPlanSection({
  date,
  offsetLabel,
  plan,
  inventoryItems,
  defaultExpanded,
  onAddSlotItem,
  onRemoveSlotItem,
  onConfirmSlot,
  onClearSlot,
  onUpdateSlotItemPortions,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [pickerSlot, setPickerSlot] = useState(null);

  const slots = plan?.slots || {};

  // Badge counts for collapsed header
  const confirmedCount = SLOTS.filter((s) => slots[s]?.confirmedAt).length;
  const plannedCount = SLOTS.filter((s) => {
    const slot = slots[s];
    return slot?.items?.length > 0 && !slot.confirmedAt;
  }).length;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-gray-800">
            {formatDateHeader(date, offsetLabel)}
          </span>
          {(confirmedCount > 0 || plannedCount > 0) && (
            <div className="flex items-center gap-1.5">
              {confirmedCount > 0 && (
                <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                  {confirmedCount} ✓
                </span>
              )}
              {plannedCount > 0 && (
                <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium">
                  {plannedCount} por confirmar
                </span>
              )}
            </div>
          )}
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        }
      </button>

      {/* Slots */}
      {expanded && (
        <div className="px-4 pb-3">
          {SLOTS.map((slotId) => (
            <PlanSlotRow
              key={slotId}
              slotId={slotId}
              slot={slots[slotId] || null}
              onAddItem={() => setPickerSlot(slotId)}
              onRemoveItem={(idx) => onRemoveSlotItem(date, slotId, idx)}
              onConfirm={() => onConfirmSlot(date, slotId)}
              onUpdatePortions={(idx, adult, baby) => onUpdateSlotItemPortions(date, slotId, idx, adult, baby)}
            />
          ))}
        </div>
      )}

      {/* Slot picker sheet */}
      {pickerSlot && (
        <SlotPickerSheet
          slotId={pickerSlot}
          inventoryItems={inventoryItems}
          onSelect={(entry) => {
            onAddSlotItem(date, pickerSlot, entry);
            setPickerSlot(null);
          }}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </div>
  );
}
