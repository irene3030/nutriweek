import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  setDoc,
  doc,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { calculateKPIs } from '../lib/kpis';
import { publishMealToLifeops, deleteMealFromLifeops } from '../lib/lifeopsDb';

// ── date helpers ──────────────────────────────────────────────────────────────

export function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

export function todayStr() {
  return toDateStr(new Date());
}

export function offsetDateStr(deltaDays) {
  const d = new Date();
  d.setDate(d.getDate() + deltaDays);
  return toDateStr(d);
}

function getMondayStr() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toDateStr(d);
}

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function dayLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return DAY_LABELS[d.getDay()];
}

// ── Slot structure ────────────────────────────────────────────────────────────
//
// slots.{slotId} = { items: SlotEntry[], confirmedAt: string | null }
//
// SlotEntry = {
//   inventoryItemId, label, itemType, tags,
//   prepTime, accelBase,
//   portionsAdultConsumed, portionsBabyConsumed
// }

// ── hook ──────────────────────────────────────────────────────────────────────

export function useDailyPlan(householdId) {
  const [plans, setPlans] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!householdId) { setLoading(false); return; }

    const monday = getMondayStr();
    const dayAfterTomorrow = offsetDateStr(2);

    const ref = collection(db, 'households', householdId, 'dailyPlans');
    const q = query(ref, where('date', '>=', monday), where('date', '<=', dayAfterTomorrow));

    const unsub = onSnapshot(q, (snap) => {
      const map = {};
      snap.docs.forEach((d) => { map[d.id] = { id: d.id, ...d.data() }; });
      setPlans(map);
      setLoading(false);
    });
    return unsub;
  }, [householdId]);

  const getPlan = useCallback((dateStr) => plans[dateStr] || null, [plans]);

  const today = todayStr();
  const todayPlan = plans[today] || null;

  // ── helpers ─────────────────────────────────────────────────────────────────

  const writeSlot = useCallback(async (dateStr, slotId, slotContainer) => {
    if (!householdId) return;
    const ref = doc(db, 'households', householdId, 'dailyPlans', dateStr);
    await setDoc(
      ref,
      { date: dateStr, slots: { [slotId]: slotContainer }, updatedAt: new Date().toISOString() },
      { merge: true }
    );
    if (slotId === 'comida' || slotId === 'cena') {
      const items = slotContainer?.items ?? [];
      if (items.length === 0) {
        deleteMealFromLifeops(slotId, dateStr).catch((e) => console.error('[lifeops] delete failed', slotId, dateStr, e));
      } else {
        publishMealToLifeops(slotId, dateStr, items).catch((e) => console.error('[lifeops] publish failed', slotId, dateStr, e));
      }
    }
  }, [householdId]);

  // ── mutations ───────────────────────────────────────────────────────────────

  const addSlotItem = useCallback(async (dateStr, slotId, itemEntry) => {
    const plan = plans[dateStr];
    const existing = plan?.slots?.[slotId];
    const newSlot = {
      items: [...(existing?.items || []), itemEntry],
      confirmedAt: existing?.confirmedAt || null,
    };
    await writeSlot(dateStr, slotId, newSlot);
  }, [plans, writeSlot]);

  const removeSlotItem = useCallback(async (dateStr, slotId, itemIndex) => {
    const plan = plans[dateStr];
    const existing = plan?.slots?.[slotId];
    if (!existing?.items) return;
    const newItems = existing.items.filter((_, i) => i !== itemIndex);
    // If last item removed, set slot to null to clean up
    await writeSlot(dateStr, slotId, newItems.length === 0 ? null : { ...existing, items: newItems });
  }, [plans, writeSlot]);

  const updateSlotItemPortions = useCallback(async (dateStr, slotId, itemIndex, adult, baby) => {
    const plan = plans[dateStr];
    const existing = plan?.slots?.[slotId];
    if (!existing?.items) return;
    const newItems = existing.items.map((item, i) =>
      i === itemIndex ? { ...item, portionsAdultConsumed: adult, portionsBabyConsumed: baby } : item
    );
    await writeSlot(dateStr, slotId, { ...existing, items: newItems });
  }, [plans, writeSlot]);

  const updateSlotItem = useCallback(async (dateStr, slotId, itemIndex, fields) => {
    const plan = plans[dateStr];
    const existing = plan?.slots?.[slotId];
    if (!existing?.items) return;
    const newItems = existing.items.map((item, i) =>
      i === itemIndex ? { ...item, ...fields } : item
    );
    await writeSlot(dateStr, slotId, { ...existing, items: newItems });
  }, [plans, writeSlot]);

  const confirmSlot = useCallback(async (dateStr, slotId) => {
    const plan = plans[dateStr];
    const slot = plan?.slots?.[slotId];
    if (!slot?.items?.length || slot.confirmedAt) return;
    await writeSlot(dateStr, slotId, { ...slot, confirmedAt: new Date().toISOString() });
  }, [plans, writeSlot]);

  const clearSlot = useCallback(async (dateStr, slotId) => {
    await writeSlot(dateStr, slotId, null);
  }, [writeSlot]);

  // ── weekly KPIs from confirmed slots ────────────────────────────────────────

  const weeklyKpis = useMemo(() => {
    const monday = getMondayStr();
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday + 'T12:00:00');
      d.setDate(d.getDate() + i);
      return toDateStr(d);
    });

    const weekDoc = {
      days: weekDays.map((dateStr) => {
        const plan = plans[dateStr];
        const meals = Object.entries(plan?.slots || {})
          .filter(([, slot]) => slot?.confirmedAt)
          .flatMap(([tipo, slot]) =>
            (slot.items || []).map((item) => ({
              tipo,
              baby: item.label,
              adult: item.label,
              tags: item.tags || [],
            }))
          );
        return { day: dayLabel(dateStr), meals };
      }),
    };

    return calculateKPIs(weekDoc);
  }, [plans]);

  // Projected KPIs: confirmed for the whole week + today's planned (unconfirmed) items
  const projectedWeeklyKpis = useMemo(() => {
    const monday = getMondayStr();
    const currentDay = toDateStr(new Date());
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday + 'T12:00:00');
      d.setDate(d.getDate() + i);
      return toDateStr(d);
    });

    const weekDoc = {
      days: weekDays.map((dateStr) => {
        const plan = plans[dateStr];
        const isToday = dateStr === currentDay;
        const meals = Object.entries(plan?.slots || {})
          .filter(([, slot]) => isToday ? slot?.items?.length > 0 : slot?.confirmedAt)
          .flatMap(([tipo, slot]) =>
            (slot.items || []).map((item) => ({
              tipo,
              baby: item.label,
              adult: item.label,
              tags: item.tags || [],
            }))
          );
        return { day: dayLabel(dateStr), meals };
      }),
    };

    return calculateKPIs(weekDoc);
  }, [plans]);

  return {
    plans,
    getPlan,
    todayPlan,
    loading,
    addSlotItem,
    removeSlotItem,
    updateSlotItem,
    updateSlotItemPortions,
    confirmSlot,
    clearSlot,
    weeklyKpis,
    projectedWeeklyKpis,
    todayStr,
    offsetDateStr,
  };
}
