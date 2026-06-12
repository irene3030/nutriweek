import { useState, useEffect, useCallback } from 'react';
import {
  collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export function useUsualMeals(householdId) {
  const [usualMeals, setUsualMeals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!householdId) { setLoading(false); return; }
    const ref = collection(db, 'households', householdId, 'usualMeals');
    const q = query(ref, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setUsualMeals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return unsub;
  }, [householdId]);

  const addUsualMeal = useCallback(async (data) => {
    if (!householdId) return;
    const name = data.name?.trim();
    if (!name) return;
    const exists = usualMeals.some(m => m.name?.toLowerCase() === name.toLowerCase());
    if (exists) return;
    await addDoc(collection(db, 'households', householdId, 'usualMeals'), {
      ...data,
      name,
      createdAt: new Date().toISOString(),
    });
  }, [householdId, usualMeals]);

  const removeUsualMeal = useCallback(async (id) => {
    if (!householdId) return;
    await deleteDoc(doc(db, 'households', householdId, 'usualMeals', id));
  }, [householdId]);

  return { usualMeals, loading, addUsualMeal, removeUsualMeal };
}
