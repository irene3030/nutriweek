import { useState, useEffect, useCallback } from 'react';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DEFAULT_PANTRY_ITEMS, inferCategoryId } from '../lib/pantryData';

export function usePantry(householdId) {
  const [pantryItems, setPantryItems] = useState(null);
  const [pantryItemMeta, setPantryItemMeta] = useState({});
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
        setPantryItemMeta(data.pantryItemMeta || {});
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

  // categoryId: categoría elegida en el formulario de "añadir item" de esa tarjeta
  const addItem = useCallback(async (itemName, categoryId) => {
    if (!householdId || pantryItems === null) return;
    const trimmed = itemName.trim();
    if (!trimmed) return;
    const already = pantryItems.some(i => i.toLowerCase() === trimmed.toLowerCase());
    if (already) return;
    const ref = doc(db, 'households', householdId);
    const updates = { pantryItems: [...pantryItems, trimmed] };
    if (categoryId) {
      updates.pantryItemMeta = {
        ...pantryItemMeta,
        [trimmed.toLowerCase()]: { ...pantryItemMeta[trimmed.toLowerCase()], categoryId },
      };
    }
    await updateDoc(ref, updates);
  }, [householdId, pantryItems, pantryItemMeta]);

  const removeItem = useCallback(async (itemName) => {
    if (!householdId || pantryItems === null) return;
    const ref = doc(db, 'households', householdId);
    const newMeta = { ...pantryItemMeta };
    delete newMeta[itemName.toLowerCase()];
    await updateDoc(ref, {
      pantryItems: pantryItems.filter(i => i !== itemName),
      pantryItemMeta: newMeta,
    });
  }, [householdId, pantryItems, pantryItemMeta]);

  // Marca/desmarca un item como agotado (para integración futura con lista de la compra)
  const toggleOutOfStock = useCallback(async (itemName) => {
    if (!householdId) return;
    const ref = doc(db, 'households', householdId);
    const key = itemName.toLowerCase();
    const current = pantryItemMeta[key]?.outOfStock ?? false;
    const newMeta = { ...pantryItemMeta, [key]: { ...pantryItemMeta[key], outOfStock: !current } };
    await updateDoc(ref, { pantryItemMeta: newMeta });
  }, [householdId, pantryItemMeta]);

  const isOutOfStock = useCallback(
    (itemName) => !!pantryItemMeta[itemName.toLowerCase()]?.outOfStock,
    [pantryItemMeta]
  );

  // Categoría de un item: la guardada explícitamente (custom) o la inferida del catálogo (default)
  const categoryIdFor = useCallback(
    (itemName) => pantryItemMeta[itemName.toLowerCase()]?.categoryId ?? inferCategoryId(itemName),
    [pantryItemMeta]
  );

  return {
    pantryItems: pantryItems ?? DEFAULT_PANTRY_ITEMS,
    loading,
    toggleItem,
    addItem,
    removeItem,
    toggleOutOfStock,
    isOutOfStock,
    categoryIdFor,
  };
}
