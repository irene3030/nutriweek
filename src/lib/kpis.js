/**
 * KPI calculations for a week document.
 * A week document has { days: [{ day, meals: [{ tipo, baby, adult, tags, track }] }] }
 */

/** Count days where at least one meal has the given tag */
function countDaysWithTag(days, tag) {
  let count = 0;
  for (const day of days) {
    if (!day.meals) continue;
    const hasTag = day.meals.some(
      (meal) => meal.tags && meal.tags.some((t) => t === tag || t.startsWith(tag + ':'))
    );
    if (hasTag) count++;
  }
  return count;
}

/** Count distinct vegetable names from veggie:nombre tags across all days */
function countDistinctVeggies(days) {
  const veggies = new Set();
  for (const day of days) {
    if (!day.meals) continue;
    for (const meal of day.meals) {
      if (!meal.tags) continue;
      for (const tag of meal.tags) {
        if (tag.startsWith('veggie:')) {
          const name = tag.split(':')[1];
          if (name) veggies.add(name.toLowerCase().trim());
        }
      }
    }
  }
  return veggies.size;
}

/** Get the distinct veggie names */
function getDistinctVeggies(days) {
  const veggies = new Set();
  for (const day of days) {
    if (!day.meals) continue;
    for (const meal of day.meals) {
      if (!meal.tags) continue;
      for (const tag of meal.tags) {
        if (tag.startsWith('veggie:')) {
          const name = tag.split(':')[1];
          if (name) veggies.add(name.toLowerCase().trim());
        }
      }
    }
  }
  return [...veggies];
}

/** Detect if same protein type appears >2 consecutive days */
function detectConsecutiveProteinAlert(days) {
  const PROTEIN_TAGS = ['iron', 'fish', 'egg', 'legume', 'dairy'];
  const alerts = [];

  for (const proteinTag of PROTEIN_TAGS) {
    let consecutiveCount = 0;
    let startDay = null;

    for (let i = 0; i < days.length; i++) {
      const day = days[i];
      if (!day.meals) {
        consecutiveCount = 0;
        startDay = null;
        continue;
      }
      const hasProtein = day.meals.some(
        (meal) => meal.tags && meal.tags.includes(proteinTag)
      );

      if (hasProtein) {
        if (consecutiveCount === 0) startDay = day.day;
        consecutiveCount++;
        if (consecutiveCount > 2) {
          alerts.push({
            protein: proteinTag,
            startDay,
            count: consecutiveCount,
          });
        }
      } else {
        consecutiveCount = 0;
        startDay = null;
      }
    }
  }

  // Deduplicate: keep only alerts where count is exactly the max for that protein
  const deduplicated = [];
  const seenProteins = new Set();
  for (const alert of alerts.reverse()) {
    if (!seenProteins.has(alert.protein)) {
      seenProteins.add(alert.protein);
      deduplicated.push(alert);
    }
  }

  return deduplicated.reverse();
}

/** Get per-day KPI indicators */
function getDayKPIs(day) {
  if (!day.meals) return { hasIron: false, hasFish: false, veggies: [] };
  const hasIron = day.meals.some((m) => m.tags && m.tags.includes('iron'));
  const hasFish = day.meals.some((m) => m.tags && m.tags.includes('fish'));
  const veggies = new Set();
  for (const meal of day.meals) {
    if (!meal.tags) continue;
    for (const tag of meal.tags) {
      if (tag.startsWith('veggie:')) {
        const name = tag.split(':')[1];
        if (name) veggies.add(name.toLowerCase().trim());
      }
    }
  }
  return { hasIron, hasFish, veggies: [...veggies] };
}

/**
 * Calculate all KPIs for a week document.
 */
export function calculateKPIs(weekDoc) {
  if (!weekDoc || !weekDoc.days || weekDoc.days.length === 0) {
    return {
      ironDays: 0,
      fishDays: 0,
      distinctVeggies: 0,
      veggieList: [],
      consecutiveAlerts: [],
      dayKPIs: [],
    };
  }

  const { days } = weekDoc;

  return {
    ironDays: countDaysWithTag(days, 'iron'),
    fishDays: countDaysWithTag(days, 'fish'),
    distinctVeggies: countDistinctVeggies(days),
    veggieList: getDistinctVeggies(days),
    consecutiveAlerts: detectConsecutiveProteinAlert(days),
    dayKPIs: days.map((day) => ({ day: day.day, ...getDayKPIs(day) })),
  };
}

/**
 * Compute adaptive KPI targets based on which slots actually have content.
 * Returns null for iron/fish if no main meals (comida/cena) are present.
 */
export function computeAdaptiveTargets(weekDoc) {
  const defaults = { ironTarget: 5, fishTarget: 3, veggieTarget: 5, isAdapted: false };
  if (!weekDoc?.days) return defaults;

  const activeSlots = new Set();
  let mainMealDays = 0;

  for (const day of weekDoc.days) {
    let hasMainMeal = false;
    for (const meal of (day.meals || [])) {
      if (meal.baby) {
        activeSlots.add(meal.tipo);
        if (meal.tipo === 'comida' || meal.tipo === 'cena') hasMainMeal = true;
      }
    }
    if (hasMainMeal) mainMealDays++;
  }

  const hasMainMeals = mainMealDays > 0;
  const ironTarget = hasMainMeals ? Math.min(mainMealDays, 5) : null;
  const fishTarget = hasMainMeals ? Math.max(1, Math.round(mainMealDays * 3 / 7)) : null;

  const slotCount = activeSlots.size;
  const veggieTarget = slotCount <= 1 ? 2 : slotCount === 2 ? 3 : slotCount === 3 ? 4 : 5;

  const isAdapted = ironTarget !== 5 || fishTarget !== 3 || veggieTarget !== 5;

  return { ironTarget, fishTarget, veggieTarget, isAdapted };
}

/** Check if a food has been absent for more than 3 weeks from foodHistory */
export function getFoodAbsenceWarnings(foodHistory = [], currentWeekFoods = []) {
  const warnings = [];
  const currentLower = currentWeekFoods.map((f) => f.toLowerCase());

  for (const item of foodHistory) {
    const { food, lastSeen, weeksAgo } = item;
    if (weeksAgo > 3 && !currentLower.some((f) => f.includes(food.toLowerCase()))) {
      warnings.push({ food, lastSeen, weeksAgo });
    }
  }
  return warnings;
}
