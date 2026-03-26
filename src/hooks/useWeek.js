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

  const createWeek = useCallback(async (mondayDate, label, daysData = null) => {
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
        ? { label, mondayDate, createdAt: new Date().toISOString(), days: daysData }
        : { ...createEmptyWeek(label), mondayDate };

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
      days[dayIdx] = {
        ...days[dayIdx],
        meals: days[dayIdx].meals.map((m, mi) =>
          mi === mealIdx ? { ...m, baby: fix.baby, tags: fix.tags || [] } : m
        ),
      };
    }
    await updateWeek(weekId, { days });
  }, [householdId, weeks, updateWeek]);

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
    applyMealFixes,
    copyMeal,
    DAYS,
    MEAL_TYPES,
  };
}
