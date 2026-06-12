import { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import PlanSlotRow from './PlanSlotRow';
import SlotPickerSheet from './SlotPickerSheet';
import MealProposalSheet from './MealProposalSheet';
import DayProposalSheet from './DayProposalSheet';
import EditSlotItemModal from './EditSlotItemModal';

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
  weeklyKpis,
  hasAiAccess,
  pantryItems,
  defaultExpanded,
  onAddSlotItem,
  onRemoveSlotItem,
  onConfirmSlot,
  onClearSlot,
  onUpdateSlotItemPortions,
  onUpdateSlotItem,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [pickerSlot, setPickerSlot] = useState(null);
  const [proposalSlot, setProposalSlot] = useState(null);
  const [showDayProposal, setShowDayProposal] = useState(false);
  const [editTarget, setEditTarget] = useState(null); // { slotId, idx, item }

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
          {/* CTA: Sugerir comida y cena (shown when both are empty) */}
          {hasAiAccess && !slots.comida?.items?.length && !slots.cena?.items?.length && (
            <button
              onClick={() => setShowDayProposal(true)}
              className="w-full flex items-center justify-center gap-2 mb-3 py-2.5 rounded-2xl border border-brand-200 bg-brand-50 text-brand-700 text-sm font-medium hover:bg-brand-100 transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Sugerir comida y cena
            </button>
          )}

          {SLOTS.map((slotId) => {
            const slot = slots[slotId] || null;
            const canAiPropose = hasAiAccess && !slot?.confirmedAt;
            return (
              <PlanSlotRow
                key={slotId}
                slotId={slotId}
                slot={slot}
                onAddItem={() => setPickerSlot(slotId)}
                onRemoveItem={(idx) => onRemoveSlotItem(date, slotId, idx)}
                onEditItem={(idx) => {
                  const item = slot?.items?.[idx];
                  if (item) setEditTarget({ slotId, idx, item });
                }}
                onConfirm={() => onConfirmSlot(date, slotId)}
                onUpdatePortions={(idx, adult, baby) => onUpdateSlotItemPortions(date, slotId, idx, adult, baby)}
                onAiPropose={canAiPropose ? () => setProposalSlot(slotId) : undefined}
              />
            );
          })}
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

      {/* AI meal proposal sheet (single slot) */}
      {proposalSlot && (
        <MealProposalSheet
          slotId={proposalSlot}
          date={date}
          inventoryItems={inventoryItems}
          todaySlots={slots}
          weeklyKpis={weeklyKpis}
          pantryItems={pantryItems}
          onSelect={(entry) => {
            onAddSlotItem(date, proposalSlot, entry);
            setProposalSlot(null);
          }}
          onClose={() => setProposalSlot(null)}
        />
      )}

      {/* Combined comida+cena proposal sheet */}
      {showDayProposal && (
        <DayProposalSheet
          date={date}
          inventoryItems={inventoryItems}
          todaySlots={slots}
          weeklyKpis={weeklyKpis}
          pantryItems={pantryItems}
          onSelectComida={(entry) => onAddSlotItem(date, 'comida', entry)}
          onSelectCena={(entry) => onAddSlotItem(date, 'cena', entry)}
          onClose={() => setShowDayProposal(false)}
        />
      )}

      {/* Edit slot item modal */}
      <EditSlotItemModal
        isOpen={!!editTarget}
        item={editTarget?.item}
        onClose={() => setEditTarget(null)}
        onSave={(fields) => onUpdateSlotItem(date, editTarget.slotId, editTarget.idx, fields)}
      />
    </div>
  );
}
