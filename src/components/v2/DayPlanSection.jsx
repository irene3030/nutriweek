import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import PlanSlotRow from './PlanSlotRow';
import SlotPickerSheet from './SlotPickerSheet';

const SLOTS = ['desayuno', 'snack', 'comida', 'merienda', 'cena'];

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function formatDateHeader(dateStr, offsetLabel) {
  const d = new Date(dateStr + 'T12:00:00');
  const dayName = DAY_NAMES[d.getDay()];
  const dayNum = d.getDate();
  const month = MONTH_NAMES[d.getMonth()];
  return `${offsetLabel} · ${dayName} ${dayNum} ${month}`;
}

export default function DayPlanSection({
  date,
  offsetLabel,  // 'Hoy', 'Mañana', 'Pasado mañana'
  plan,
  inventoryItems,
  defaultExpanded,
  onSetSlot,
  onConfirmSlot,
  onClearSlot,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [pickerSlot, setPickerSlot] = useState(null); // slotId being picked

  const slots = plan?.slots || {};
  const confirmedCount = SLOTS.filter((s) => slots[s]?.confirmedAt).length;
  const plannedCount = SLOTS.filter((s) => slots[s] && !slots[s]?.confirmedAt).length;

  const handleSelectItem = (slotId, entry) => {
    onSetSlot(date, slotId, entry);
    setPickerSlot(null);
  };

  const handleUpdatePortions = (slotId, adult, baby) => {
    const existing = slots[slotId];
    if (!existing) return;
    onSetSlot(date, slotId, { ...existing, portionsAdultConsumed: adult, portionsBabyConsumed: baby });
  };

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
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
        )}
      </button>

      {/* Slots */}
      {expanded && (
        <div className="px-4 pb-3">
          {SLOTS.map((slotId) => (
            <PlanSlotRow
              key={slotId}
              slotId={slotId}
              slotEntry={slots[slotId] || null}
              onPick={() => setPickerSlot(slotId)}
              onConfirm={() => onConfirmSlot(date, slotId)}
              onClear={() => onClearSlot(date, slotId)}
              onUpdatePortions={(adult, baby) => handleUpdatePortions(slotId, adult, baby)}
            />
          ))}
        </div>
      )}

      {/* Slot picker sheet */}
      {pickerSlot && (
        <SlotPickerSheet
          slotId={pickerSlot}
          inventoryItems={inventoryItems}
          onSelect={(entry) => handleSelectItem(pickerSlot, entry)}
          onClose={() => setPickerSlot(null)}
        />
      )}
    </div>
  );
}
