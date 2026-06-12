import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DEFAULT_PANTRY_ITEMS } from '../lib/pantryData';

export function usePantry(householdId) {
  const [pantryItems, setPantryItems] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!householdId) { setLoading(false); return; }
    const ref = doc(db, 'households', householdId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.pantryItems) {
          setPantryItems(data.pantryItems);
        } else {
          updateDoc(ref, { pantryItems: DEFAULT_PANTRY_ITEMS }).catch(() => {});
          setPantryItems(DEFAULT_PANTRY_ITEMS);
        }
      }
      setLoading(false);
    });
    return unsub;
  }, [householdId]);

  const toggleItem = useCallback(async (itemName) => {
    if (!householdId || pantryItems === null) return;
    const ref = doc(db, 'households', householdId);
    const newItems = pantryItems.includes(itemName)
      ? pantryItems.filter(i => i !== itemName)
      : [...pantryItems, itemName];
    await updateDoc(ref, { pantryItems: newItems });
  }, [householdId, pantryItems]);

  const addItem = useCallback(async (itemName) => {
    if (!householdId || pantryItems === null) return;
    const trimmed = itemName.trim();
    if (!trimmed) return;
    const already = pantryItems.some(i => i.toLowerCase() === trimmed.toLowerCase());
    if (already) return;
    const ref = doc(db, 'households', householdId);
    await updateDoc(ref, { pantryItems: [...pantryItems, trimmed] });
  }, [householdId, pantryItems]);

  const removeItem = useCallback(async (itemName) => {
    if (!householdId || pantryItems === null) return;
    const ref = doc(db, 'households', householdId);
    await updateDoc(ref, { pantryItems: pantryItems.filter(i => i !== itemName) });
  }, [householdId, pantryItems]);

  return {
    pantryItems: pantryItems ?? DEFAULT_PANTRY_ITEMS,
    loading,
    toggleItem,
    addItem,
    removeItem,
  };
}
