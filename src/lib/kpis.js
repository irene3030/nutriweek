/**
 * KPI calculations for a week document.
 * A week document has { days: [{ day, meals: [{ tipo, baby, adult, tags, track }] }] }
 */

/** Static catalog of all available KPIs */
export const KPI_CATALOG = [
  {
    id: 'iron',
    label: 'Hierro',
    icon: '🩸',
    description: 'Al menos 1 comida con hierro cada día (carne, legumbre o pescado azul)',
    defaultTarget: 1,
    unit: 'al día',
    frequency: 'diario',
    defaultOn: true,
    adaptive: false,
  },
  {
    id: 'fish',
    label: 'Pescado graso',
    icon: '🐟',
    description: 'Salmón, caballa, sardinas, atún... (objetivo: 3 veces/semana)',
    defaultTarget: 3,
    unit: 'días',
    defaultOn: true,
    adaptive: true,
  },
  {
    id: 'veggie',
    label: 'Verduras distintas',
    icon: '🥦',
    description: 'Variedad de verduras distintas en la semana',
    defaultTarget: 5,
    unit: 'tipos',
    defaultOn: true,
    adaptive: true,
  },
  {
    id: 'legume',
    label: 'Legumbres',
    icon: '🟢',
    description: 'Lentejas, garbanzos, alubias... (objetivo: 3 veces/semana)',
    defaultTarget: 3,
    unit: 'días',
    defaultOn: true,
    adaptive: false,
  },
  {
    id: 'fruit',
    label: 'Fruta',
    icon: '🍎',
    description: 'Presencia de fruta al menos una vez al día',
    defaultTarget: 5,
    unit: 'días',
    defaultOn: false,
    adaptive: false,
  },
  {
    id: 'protein_rotation',
    label: 'Rotación proteínas',
    icon: '🔄',
    description: 'No repetir la misma proteína más de 2 días seguidos',
    defaultTarget: 0,
    unit: 'alertas',
    defaultOn: false,
    adaptive: false,
  },
];

export const DEFAULT_KPI_CONFIG = {
  active: ['iron', 'fish', 'veggie', 'legume'],
  targets: {},
  frequencies: { iron: 'diario', fruit: 'diario' },
  custom: [],
};

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

/**
 * Resolve the specific ingredient name that carries the given tag within a meal.
 * Falls back to the full dish label when the meal has no per-ingredient breakdown
 * (single-ingredient items, or dishes saved before ingredientTags existed).
 */
function resolveTagSource(meal, tag) {
  if (Array.isArray(meal.ingredientTags) && meal.ingredientTags.length > 0) {
    const matches = meal.ingredientTags
      .filter((ing) => (ing.tags || []).some((t) => t === tag || t.startsWith(tag + ':')))
      .map((ing) => ing.name)
      .filter(Boolean);
    if (matches.length > 0) return matches.join(' + ');
  }
  return meal.baby || meal.adult;
}

/** Get distinct meal labels (dish names) that carry the given tag, across all days */
function getItemsWithTag(days, tag) {
  const items = new Set();
  for (const day of days) {
    if (!day.meals) continue;
    for (const meal of day.meals) {
      if (!meal.tags) continue;
      const hasTag = meal.tags.some((t) => t === tag || t.startsWith(tag + ':'));
      if (hasTag) {
        const name = resolveTagSource(meal, tag);
        if (name) items.add(name);
      }
    }
  }
  return [...items];
}

/** Get every occurrence (one per meal, duplicates included) of dishes carrying the given tag, tagged with their day */
function getOccurrencesWithTag(days, tag) {
  const occurrences = [];
  for (const day of days) {
    if (!day.meals) continue;
    for (const meal of day.meals) {
      if (!meal.tags) continue;
      const hasTag = meal.tags.some((t) => t === tag || t.startsWith(tag + ':'));
      if (hasTag) {
        const name = resolveTagSource(meal, tag);
        if (name) occurrences.push(day.day ? `${name} · ${day.day}` : name);
      }
    }
  }
  return occurrences;
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

/** Count days where at least n meals have the given tag */
function countDaysMeetingDailyTag(days, tag, n = 1) {
  let count = 0;
  for (const day of days) {
    if (!day.meals) continue;
    const mealCount = day.meals.filter(m => m.tags?.some(t => t === tag || t.startsWith(tag + ':'))).length;
    if (mealCount >= n) count++;
  }
  return count;
}

/** Count days where the number of distinct veggies in that day is >= n */
function countDaysMeetingDailyVeggies(days, n = 1) {
  let count = 0;
  for (const day of days) {
    const veggies = new Set();
    for (const meal of (day.meals || [])) {
      for (const tag of (meal.tags || [])) {
        if (tag.startsWith('veggie:')) {
          const name = tag.split(':')[1];
          if (name) veggies.add(name.toLowerCase().trim());
        }
      }
    }
    if (veggies.size >= n) count++;
  }
  return count;
}

/** Count days where query text appears in at least n meals */
function countDaysMeetingDailyText(days, query, n = 1) {
  const terms = query.split(',').map(t => t.toLowerCase().trim()).filter(Boolean);
  if (!terms.length) return 0;
  let count = 0;
  for (const day of days) {
    if (!day.meals) continue;
    const matchCount = day.meals.filter(m => {
      const text = `${m.baby || ''} ${m.adult || ''}`.toLowerCase();
      return terms.some(t => text.includes(t));
    }).length;
    if (matchCount >= n) count++;
  }
  return count;
}

/** Count days where at least one meal text contains any of the query terms (comma-separated OR logic) */
function countDaysWithText(days, query) {
  const terms = query.split(',').map(t => t.toLowerCase().trim()).filter(Boolean);
  if (!terms.length) return 0;
  let count = 0;
  for (const day of days) {
    if (!day.meals) continue;
    const found = day.meals.some((meal) => {
      const text = `${meal.baby || ''} ${meal.adult || ''}`.toLowerCase();
      return terms.some(t => text.includes(t));
    });
    if (found) count++;
  }
  return count;
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
  if (!day.meals) return { hasIron: false, hasFish: false, hasLegume: false, hasFruit: false, veggies: [] };
  const hasIron   = day.meals.some((m) => m.tags && m.tags.includes('iron'));
  const hasFish   = day.meals.some((m) => m.tags && m.tags.includes('oily_fish'));
  const hasLegume = day.meals.some((m) => m.tags && m.tags.includes('legume'));
  const hasFruit  = day.meals.some((m) => m.tags && m.tags.includes('fruit'));
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
  return { hasIron, hasFish, hasLegume, hasFruit, veggies: [...veggies] };
}

/**
 * Calculate all KPIs for a week document.
 * @param {object} weekDoc
 * @param {Array} customKPIs - array of { id, name, query, target } from kpiConfig.custom
 */
export function calculateKPIs(weekDoc, customKPIs = []) {
  if (!weekDoc || !weekDoc.days || weekDoc.days.length === 0) {
    return {
      ironDays: 0,
      fishDays: 0,
      legumedDays: 0,
      fruitDays: 0,
      distinctVeggies: 0,
      veggieList: [],
      ironItems: [],
      fishItems: [],
      legumeItems: [],
      fruitItems: [],
      consecutiveAlerts: [],
      dayKPIs: [],
      customResults: {},
    };
  }

  const { days } = weekDoc;

  // Use track.tags (effective eaten tags) when available, falling back to planned tags
  const effectiveDays = days.map(day => ({
    ...day,
    meals: (day.meals || []).map(meal => ({
      ...meal,
      tags: meal.track?.tags ?? meal.tags ?? [],
    })),
  }));

  const customResults = {};
  for (const kpi of customKPIs) {
    customResults[kpi.id] = countDaysWithText(effectiveDays, kpi.query);
  }

  return {
    ironDays: countDaysWithTag(effectiveDays, 'iron'),
    fishDays: countDaysWithTag(effectiveDays, 'oily_fish'),
    legumedDays: countDaysWithTag(effectiveDays, 'legume'),
    fruitDays: countDaysWithTag(effectiveDays, 'fruit'),
    distinctVeggies: countDistinctVeggies(effectiveDays),
    veggieList: getDistinctVeggies(effectiveDays),
    ironItems: getOccurrencesWithTag(effectiveDays, 'iron'),
    fishItems: getOccurrencesWithTag(effectiveDays, 'oily_fish'),
    legumeItems: getOccurrencesWithTag(effectiveDays, 'legume'),
    fruitItems: getItemsWithTag(effectiveDays, 'fruit'),
    consecutiveAlerts: detectConsecutiveProteinAlert(effectiveDays),
    dayKPIs: effectiveDays.map((day) => ({ day: day.day, ...getDayKPIs(day) })),
    customResults,
  };
}

/**
 * Compute adaptive KPI targets based on which slots actually have content.
 * Returns null for iron/fish if no main meals (comida/cena) are present.
 */
export function computeAdaptiveTargets(weekDoc, targets = {}) {
  const defaults = { ironTarget: 5, fishTarget: 3, veggieTarget: 5, legumeTarget: 3, isAdapted: false };
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
  const ironTarget = hasMainMeals ? Math.min(mainMealDays, targets.iron ?? 5) : null;
  const fishTarget = hasMainMeals ? Math.max(1, Math.round(mainMealDays * (targets.fish ?? 3) / 7)) : null;

  const slotCount = activeSlots.size;
  const veggieDefault = targets.veggie ?? 5;
  const veggieTarget = slotCount <= 1 ? Math.min(2, veggieDefault) : slotCount === 2 ? Math.min(3, veggieDefault) : slotCount === 3 ? Math.min(4, veggieDefault) : veggieDefault;

  const legumeTarget = targets.legume ?? 3;

  const isAdapted = ironTarget !== (targets.iron ?? 5) || fishTarget !== (targets.fish ?? 3) || veggieTarget !== veggieDefault;

  return { ironTarget, fishTarget, veggieTarget, legumeTarget, isAdapted };
}

/**
 * For each KPI with frequency='diario', returns { compliant, total }
 * where compliant = days meeting the per-day threshold.
 */
export function calculateDailyCompliance(weekDoc, kpiConfig = {}) {
  if (!weekDoc?.days?.length) return {};
  // Use effective tags (track.tags when tracked, else planned tags) — same as calculateKPIs
  const days = weekDoc.days.map(day => ({
    ...day,
    meals: (day.meals || []).map(meal => ({
      ...meal,
      tags: meal.track?.tags ?? meal.tags ?? [],
    })),
  }));
  const total = days.length;
  const targets = kpiConfig.targets || {};
  const frequencies = kpiConfig.frequencies || {};
  const custom = kpiConfig.custom || [];
  const result = {};

  // For 'diario' KPIs: each day needs >= 1 of the food (n=1).
  // 'targets.x' is the weekly day-count goal, used as the compliance threshold.
  if (frequencies.iron === 'diario')
    result.iron = { compliant: countDaysMeetingDailyTag(days, 'iron', 1), total: days.length };
  if (frequencies.fish === 'diario')
    result.fish = { compliant: countDaysMeetingDailyTag(days, 'oily_fish', 1), total: targets.fish ?? days.length };
  if (frequencies.legume === 'diario')
    result.legume = { compliant: countDaysMeetingDailyTag(days, 'legume', 1), total: targets.legume ?? days.length };
  if (frequencies.fruit === 'diario')
    result.fruit = { compliant: countDaysMeetingDailyTag(days, 'fruit', 1), total: targets.fruit ?? days.length };
  if (frequencies.veggie === 'diario')
    result.veggie = { compliant: countDaysMeetingDailyVeggies(days, 1), total: targets.veggie ?? days.length };
  for (const kpi of custom) {
    if (kpi.frequency === 'diario')
      result[kpi.id] = { compliant: countDaysMeetingDailyText(days, kpi.query, targets[kpi.id] ?? kpi.target ?? 1), total };
  }
  return result;
}

/**
 * Generate short informational phrases about the week's nutritional state.
 * Tone: neutral, no scoring, no gamification.
 * Returns array of { id, text }.
 */
export function generateKpiPhrases(kpis) {
  if (!kpis) return [];
  const { ironDays, fishDays, legumedDays, fruitDays, distinctVeggies } = kpis;
  const todayDayIndex = (new Date().getDay() + 6) % 7; // Mon=0 … Sun=6
  const phrases = [];

  // Iron
  if (ironDays === 0 && todayDayIndex > 1) {
    phrases.push({ id: 'iron', text: 'Sin fuente de hierro esta semana aún' });
  } else if (ironDays > 0 && ironDays < 5) {
    phrases.push({ id: 'iron', text: `Hierro: ${ironDays} día${ironDays > 1 ? 's' : ''} esta semana` });
  }

  // Fish
  if (fishDays === 0) {
    phrases.push({ id: 'fish', text: 'Sin pescado azul esta semana aún' });
  } else if (fishDays < 3) {
    phrases.push({ id: 'fish', text: `Pescado azul ${fishDays} ${fishDays > 1 ? 'veces' : 'vez'} esta semana` });
  } else {
    phrases.push({ id: 'fish', text: 'Pescado azul cubierto esta semana' });
  }

  // Legume
  if (legumedDays === 0) {
    phrases.push({ id: 'legume', text: 'Sin legumbre esta semana aún' });
  } else if (legumedDays < 3) {
    phrases.push({ id: 'legume', text: `Legumbre ${legumedDays} día${legumedDays > 1 ? 's' : ''} esta semana` });
  } else {
    phrases.push({ id: 'legume', text: 'Legumbre bien cubierta esta semana' });
  }

  // Veggies
  if (distinctVeggies === 0) {
    phrases.push({ id: 'veggie', text: 'Sin verduras registradas esta semana' });
  } else if (distinctVeggies < 5) {
    phrases.push({ id: 'veggie', text: `${distinctVeggies} verdura${distinctVeggies > 1 ? 's' : ''} distinta${distinctVeggies > 1 ? 's' : ''} esta semana` });
  }

  // Fruit (skip early in week if zero)
  if (fruitDays === 0 && todayDayIndex > 1) {
    phrases.push({ id: 'fruit', text: 'Sin fruta registrada esta semana aún' });
  } else if (fruitDays > 0 && fruitDays < 4) {
    phrases.push({ id: 'fruit', text: `Fruta ${fruitDays} día${fruitDays > 1 ? 's' : ''} esta semana` });
  } else if (fruitDays >= 4) {
    phrases.push({ id: 'fruit', text: 'Fruta presente la mayoría de los días' });
  }

  return phrases;
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
