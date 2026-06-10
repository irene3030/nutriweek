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
  const day = d.getDay(); // 0 = Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toDateStr(d);
}

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function dayLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return DAY_LABELS[d.getDay()];
}

// ── hook ──────────────────────────────────────────────────────────────────────

export function useDailyPlan(householdId) {
  const [plans, setPlans] = useState({}); // { 'YYYY-MM-DD': { date, slots, updatedAt } }
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

  // ── mutations ───────────────────────────────────────────────────────────────

  const setSlot = useCallback(async (dateStr, slotId, entry) => {
    if (!householdId) return;
    const ref = doc(db, 'households', householdId, 'dailyPlans', dateStr);
    await setDoc(
      ref,
      { date: dateStr, slots: { [slotId]: entry }, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  }, [householdId]);

  const confirmSlot = useCallback(async (dateStr, slotId) => {
    if (!householdId) return;
    const plan = plans[dateStr];
    const slot = plan?.slots?.[slotId];
    if (!slot || slot.confirmedAt) return;
    const ref = doc(db, 'households', householdId, 'dailyPlans', dateStr);
    await setDoc(
      ref,
      {
        date: dateStr,
        slots: { [slotId]: { ...slot, confirmedAt: new Date().toISOString() } },
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  }, [householdId, plans]);

  const clearSlot = useCallback(async (dateStr, slotId) => {
    if (!householdId) return;
    const ref = doc(db, 'households', householdId, 'dailyPlans', dateStr);
    await setDoc(
      ref,
      { date: dateStr, slots: { [slotId]: null }, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  }, [householdId]);

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
          .map(([tipo, slot]) => ({
            tipo,
            baby: slot.label,
            adult: slot.label,
            tags: slot.tags || [],
          }));
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
    setSlot,
    confirmSlot,
    clearSlot,
    weeklyKpis,
    todayStr,
    offsetDateStr,
  };
}
