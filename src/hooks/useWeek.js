import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  onSnapshot,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  orderBy,
  query,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MEAL_TYPES = ['desayuno', 'snack', 'comida', 'merienda', 'cena'];

function createEmptyWeek(label) {
  return {
    label,
    createdAt: new Date().toISOString(),
    days: DAYS.map((day) => ({
      day,
      meals: MEAL_TYPES.map((tipo) => ({
        tipo,
        baby: '',
        adult: '',
        tags: [],
        track: null,
      })),
    })),
  };
}

export function useWeek(householdId) {
  const [weeks, setWeeks] = useState([]);
  const [currentWeekIndex, setCurrentWeekIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!householdId) {
      setLoading(false);
      return;
    }

    const weeksRef = collection(db, 'households', householdId, 'weeks');
    const q = query(weeksRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const weekList = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setWeeks(weekList);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching weeks:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [householdId]);

  const currentWeek = weeks[currentWeekIndex] || null;

  const goToPreviousWeek = useCallback(() => {
    setCurrentWeekIndex((i) => Math.min(i + 1, weeks.length - 1));
  }, [weeks.length]);

  const goToNextWeek = useCallback(() => {
    setCurrentWeekIndex((i) => Math.max(i - 1, 0));
  }, []);

  const createWeek = useCallback(async (mondayDate, label, daysData = null, ingredients = []) => {
    if (!householdId) return;
    setSaving(true);
    try {
      // mondayDate is YYYY-MM-DD — used as doc ID to prevent duplicates
      const weekRef = doc(db, 'households', householdId, 'weeks', mondayDate);
      const existing = await getDoc(weekRef);
      if (existing.exists()) {
        throw new Error('Ya existe un menú para esa semana.');
      }

      const weekData = daysData
        ? { label, mondayDate, createdAt: new Date().toISOString(), days: daysData, ingredients }
        : { ...createEmptyWeek(label), mondayDate, ingredients: [] };

      await setDoc(weekRef, weekData);
      setCurrentWeekIndex(0);
      return mondayDate;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [householdId]);

  const deleteWeek = useCallback(async (weekId) => {
    if (!householdId) return;
    setSaving(true);
    try {
      const weekRef = doc(db, 'households', householdId, 'weeks', weekId);
      await deleteDoc(weekRef);
      setCurrentWeekIndex(0);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [householdId]);

  const updateWeek = useCallback(async (weekId, data) => {
    if (!householdId) return;
    setSaving(true);
    try {
      const weekRef = doc(db, 'households', householdId, 'weeks', weekId);
      await updateDoc(weekRef, data);
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }, [householdId]);

  const updateMeal = useCallback(async (weekId, dayIndex, mealIndex, mealData) => {
    if (!householdId) return;
    const week = weeks.find((w) => w.id === weekId);
    if (!week) return;

    const updatedDays = week.days.map((day, di) => {
      if (di !== dayIndex) return day;
      return {
        ...day,
        meals: day.meals.map((meal, mi) => {
          if (mi !== mealIndex) return meal;
          return { ...meal, ...mealData };
        }),
      };
    });

    await updateWeek(weekId, { days: updatedDays });
  }, [householdId, weeks, updateWeek]);

  const updateDayMeals = useCallback(async (weekId, dayIndex, meals) => {
    if (!householdId) return;
    const week = weeks.find((w) => w.id === weekId);
    if (!week) return;

    const updatedDays = week.days.map((day, di) => {
      if (di !== dayIndex) return day;
      return { ...day, meals };
    });

    await updateWeek(weekId, { days: updatedDays });
  }, [householdId, weeks, updateWeek]);

  const updateWeekLabel = useCallback(async (weekId, label) => {
    await updateWeek(weekId, { label });
  }, [updateWeek]);

  const updateBatchCooking = useCallback(async (weekId, batchCooking) => {
    await updateWeek(weekId, { batchCooking });
  }, [updateWeek]);

  const trackMeal = useCallback(async (weekId, dayIndex, mealIndex, trackData) => {
    await updateMeal(weekId, dayIndex, mealIndex, { track: trackData });
  }, [updateMeal]);

  const applyMealFixes = useCallback(async (weekId, fixes) => {
    if (!householdId || !fixes?.length) return;
    const week = weeks.find((w) => w.id === weekId);
    if (!week) return;

    // Build updated days in one pass — avoids race condition from multiple updateMeal calls
    let days = week.days.map(day => ({ ...day, meals: day.meals.map(m => ({ ...m })) }));
    for (const fix of fixes) {
      const dayIdx = days.findIndex(d => d.day === fix.day);
      if (dayIdx === -1) continue;
      const mealIdx = days[dayIdx].meals.findIndex(m => m.tipo === fix.tipo);
      if (mealIdx === -1) continue;
      const originalTags = days[dayIdx].meals[mealIdx].tags || [];
      const fixTags = fix.tags || [];
      // Merge: union of fix tags + original tags. Fix tags take precedence for
      // standard KPI tags; original veggie:* tags are always preserved to avoid
      // losing vegetable variety count. Duplicates are removed.
      const KPI_TAGS = new Set(['iron', 'oily_fish', 'fish', 'legume', 'egg', 'dairy', 'fruit', 'cereal']);
      // KPI tags (iron, fish, legume…) come from Claude's response — it's instructed to preserve them.
      // veggie:* tags from the original are always preserved to avoid losing vegetable variety count.
      // Non-KPI tags from original are also kept.
      const originalVeggies = originalTags.filter(t => t.startsWith('veggie:') && !fixTags.includes(t));
      const originalNonKpi = originalTags.filter(t => !KPI_TAGS.has(t) && !t.startsWith('veggie:'));
      const mergedTags = [...new Set([...fixTags, ...originalVeggies, ...originalNonKpi])];
      days[dayIdx] = {
        ...days[dayIdx],
        meals: days[dayIdx].meals.map((m, mi) =>
          mi === mealIdx ? { ...m, baby: fix.baby, tags: mergedTags } : m
        ),
      };
    }
    // Optimistic update: reflect changes immediately without waiting for Firebase snapshot
    setWeeks(prev => prev.map(w => w.id === weekId ? { ...w, days } : w));
    await updateWeek(weekId, { days });
  }, [householdId, weeks, updateWeek]);

  const clearDay = useCallback(async (weekId, dayName) => {
    if (!householdId) return;
    const week = weeks.find((w) => w.id === weekId);
    if (!week) return;
    const updatedDays = week.days.map((day) => {
      if (day.day !== dayName) return day;
      return {
        ...day,
        cleared: true,
        meals: day.meals.map((meal) => ({ ...meal, baby: '', adult: '', tags: [], track: null })),
      };
    });
    await updateWeek(weekId, { days: updatedDays });
  }, [householdId, weeks, updateWeek]);

  const swapMeals = useCallback(async (weekId, dayIdx1, mealIdx1, dayIdx2, mealIdx2) => {
    const week = weeks.find((w) => w.id === weekId);
    if (!week) return;
    const meal1 = week.days[dayIdx1]?.meals[mealIdx1];
    const meal2 = week.days[dayIdx2]?.meals[mealIdx2];
    const updatedDays = week.days.map((day, di) => ({
      ...day,
      meals: day.meals.map((meal, mi) => {
        if (di === dayIdx1 && mi === mealIdx1)
          return { ...meal, baby: meal2?.baby || '', adult: meal2?.adult || '', tags: meal2?.tags || [], track: null };
        if (di === dayIdx2 && mi === mealIdx2)
          return { ...meal, baby: meal1?.baby || '', adult: meal1?.adult || '', tags: meal1?.tags || [], track: null };
        return meal;
      }),
    }));
    await updateWeek(weekId, { days: updatedDays });
  }, [weeks, updateWeek]);

  const copyMeal = useCallback(async (sourceWeekId, sourceDayIdx, sourceMealIdx, targetDayIdx, targetMealIdx) => {
    const week = weeks.find((w) => w.id === sourceWeekId);
    if (!week) return;
    const sourceMeal = week.days[sourceDayIdx]?.meals[sourceMealIdx];
    if (!sourceMeal) return;
    await updateMeal(sourceWeekId, targetDayIdx, targetMealIdx, {
      baby: sourceMeal.baby,
      adult: sourceMeal.adult,
      tags: sourceMeal.tags,
    });
  }, [weeks, updateMeal]);

  const updateAllDays = useCallback(async (weekId, days) => {
    await updateWeek(weekId, { days });
  }, [updateWeek]);

  return {
    weeks,
    currentWeek,
    currentWeekIndex,
    loading,
    saving,
    error,
    goToPreviousWeek,
    goToNextWeek,
    createWeek,
    deleteWeek,
    updateWeek,
    updateMeal,
    updateDayMeals,
    updateWeekLabel,
    updateBatchCooking,
    trackMeal,
    updateAllDays,
    applyMealFixes,
    copyMeal,
    swapMeals,
    clearDay,
    DAYS,
    MEAL_TYPES,
  };
}
