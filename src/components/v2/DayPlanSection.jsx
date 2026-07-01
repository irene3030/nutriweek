import { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles, Droplets, Fish, Bean, Leaf, Apple, AlertCircle } from 'lucide-react';
import PlanSlotRow from './PlanSlotRow';
import SlotPickerSheet from './SlotPickerSheet';
import MealProposalSheet from './MealProposalSheet';
import DayProposalSheet from './DayProposalSheet';
import EditSlotItemModal from './EditSlotItemModal';

const SLOTS = ['desayuno', 'snack', 'comida', 'merienda', 'cena'];

const DAILY_KPIS = [
  { key: 'iron',   icon: Droplets, label: 'Hierro',   count: (tags) => tags.includes('iron') ? 1 : 0 },
  { key: 'fish',   icon: Fish,     label: 'Pesc. azul', count: (tags) => tags.includes('oily_fish') ? 1 : 0, weeklyOnly: true },
  { key: 'legume', icon: Bean,     label: 'Legumbre', count: (tags) => tags.includes('legume') ? 1 : 0 },
  { key: 'veggie', icon: Leaf,     label: 'Verduras', count: (tags) => new Set(tags.filter(t => t.startsWith('veggie:')).map(t => t.slice(7))).size },
  { key: 'fruit',  icon: Apple,    label: 'Fruta',    count: (tags) => tags.filter(t => t === 'fruit').length },
];

function computeDailyTags(slots) {
  return Object.values(slots).flatMap(slot => (slot?.items || []).flatMap(item => item.tags || []));
}

function computeBalanceGaps(slots, weeklyKpis) {
  const confirmedSlots = Object.values(slots).filter(s => s?.confirmedAt);
  if (!confirmedSlots.length) return null;

  const allTags = computeDailyTags(slots);
  const gaps = [];

  if (!allTags.includes('iron')) gaps.push('hierro');

  const veggies = new Set(allTags.filter(t => t.startsWith('veggie:')));
  if (veggies.size === 0) gaps.push('verduras');
  else if (veggies.size === 1) gaps.push('una verdura más');

  if (!allTags.includes('oily_fish') && (weeklyKpis?.fishDays ?? 0) < 3) {
    gaps.push('pescado azul');
  }

  return gaps.length ? gaps : null;
}

function DailyBalanceHint({ slots, weeklyKpis }) {
  const gaps = computeBalanceGaps(slots, weeklyKpis);
  if (!gaps) return null;

  const hasOpen = SLOTS.some(id => !slots[id]?.confirmedAt);
  const verb = hasOpen ? 'Para completar el día:' : 'Al día le faltó:';

  return (
    <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-2 text-xs text-amber-800">
      <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
      <span>{verb} <span className="font-medium">{gaps.join(' y ')}</span></span>
    </div>
  );
}

function DailyKpiRow({ slots }) {
  const tags = computeDailyTags(slots);
  const hasAny = tags.length > 0;

  return (
    <div className="flex flex-wrap gap-1.5 pt-1 pb-2">
      {DAILY_KPIS.map(({ key, icon: Icon, label, count, weeklyOnly }) => {
        const n = count(tags);
        if (weeklyOnly && n === 0) return null;
        return (
          <span
            key={key}
            className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg font-medium transition-colors ${
              n > 0 ? 'bg-green-50 text-green-700' : hasAny ? 'bg-gray-100 text-gray-400' : 'bg-gray-50 text-gray-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
            {n > 0 && <span className="font-bold">+{n}</span>}
          </span>
        );
      })}
    </div>
  );
}

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
  autoPropose = false,
  timeOfDay,
  isToday = false,
  slotTemplates = {},
  onAddSlotItem,
  onRemoveSlotItem,
  onConfirmSlot,
  onClearSlot,
  onUpdateSlotItemPortions,
  onUpdateSlotItem,
  onSaveTemplate,
  dragActive = false,
  onDropItem,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [pickerSlot, setPickerSlot] = useState(null);
  const [proposalSlot, setProposalSlot] = useState(null);
  const [showDayProposal, setShowDayProposal] = useState(false);
  const [editTarget, setEditTarget] = useState(null);

  const slots = plan?.slots || {};

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
          <DailyKpiRow slots={slots} />

          {/* CTA: Sugerir comida y cena (shown when both are empty) */}
          {hasAiAccess && !slots.comida?.items?.length && !slots.cena?.items?.length && (
            <button
              onClick={() => setShowDayProposal(true)}
              className="w-full flex items-center justify-center gap-2 mb-3 py-2.5 rounded-2xl text-sm font-medium transition-colors border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100"
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
                template={slotTemplates[slotId]}
                onSaveTemplate={onSaveTemplate ? (items) => onSaveTemplate(slotId, items) : undefined}
                onApplyTemplate={slotTemplates[slotId]?.length ? () => {
                  slotTemplates[slotId].forEach(item => onAddSlotItem(date, slotId, {
                    inventoryItemId: null,
                    label: item.label,
                    itemType: item.itemType || 'manual',
                    tags: item.tags || [],
                    confirmedAt: null,
                    prepTime: null,
                    portionsAdultConsumed: 0,
                    portionsBabyConsumed: 0,
                  }));
                } : undefined}
                dragActive={dragActive}
                onDropItem={onDropItem ? () => onDropItem(date, slotId, offsetLabel) : undefined}
              />
            );
          })}

          {/* Balance hint — below cena, only for today */}
          {isToday && <DailyBalanceHint slots={slots} weeklyKpis={weeklyKpis} />}
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
          autoPropose={autoPropose}
          timeOfDay={timeOfDay}
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
