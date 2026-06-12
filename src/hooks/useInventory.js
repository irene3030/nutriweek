import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export function addDays(isoDate, days) {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function daysUntil(isoDate) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const exp = new Date(isoDate);
  exp.setHours(0, 0, 0, 0);
  return Math.round((exp - now) / (1000 * 60 * 60 * 24));
}

export function useInventory(householdId) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!householdId) {
      setLoading(false);
      return;
    }
    const ref = collection(db, 'households', householdId, 'inventory');
    const q = query(ref, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [householdId]);

  // Derived lists — active = not explicitly deactivated
  const activeItems = useMemo(() => items.filter((i) => i.isActive !== false), [items]);
  const expiringItems = useMemo(
    () => activeItems.filter((i) => i.expiresAt && daysUntil(i.expiresAt) <= 2),
    [activeItems]
  );
  const floatingItems = useMemo(
    () => activeItems.filter((i) => i.type === 'flotante'),
    [activeItems]
  );

  const addItem = useCallback(async (data) => {
    if (!householdId) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const expiresAt = data.shelfLifeDays ? addDays(now, data.shelfLifeDays) : null;
      await addDoc(collection(db, 'households', householdId, 'inventory'), {
        ...data,
        createdAt: now,
        expiresAt,
        isActive: true,
      });
    } finally {
      setSaving(false);
    }
  }, [householdId]);

  const updateItem = useCallback(async (id, data) => {
    if (!householdId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'households', householdId, 'inventory', id), data);
    } finally {
      setSaving(false);
    }
  }, [householdId]);

  const deleteItem = useCallback(async (id) => {
    if (!householdId) return;
    await deleteDoc(doc(db, 'households', householdId, 'inventory', id));
  }, [householdId]);

  const consumePortions = useCallback(async (id, adultDelta = 0, babyDelta = 0) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const newAdult = Math.max(0, (item.portionsAdult || 0) - adultDelta);
    const newBaby = Math.max(0, (item.portionsBaby || 0) - babyDelta);
    const depleted = newAdult === 0 && newBaby === 0;
    await updateItem(id, {
      portionsAdult: newAdult,
      portionsBaby: newBaby,
      isActive: !depleted,
    });
  }, [items, updateItem]);

  const consumeUnits = useCallback(async (id, delta = 1) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const newUnits = Math.max(0, (item.units || 0) - delta);
    await updateItem(id, { units: newUnits, isActive: newUnits > 0 });
  }, [items, updateItem]);

  return {
    items: activeItems,
    allItems: items,
    expiringItems,
    floatingItems,
    loading,
    saving,
    addItem,
    updateItem,
    deleteItem,
    consumePortions,
    consumeUnits,
    daysUntil,
  };
}
