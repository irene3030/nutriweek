import { track, getDistinctId } from './analytics';

const API_URL = '/api/claude';

// Module-level pre-call hook — set from App.jsx to check limits and track usage.
// Must throw an error to block the call, or resolve to allow it.
let _preCallHook = null;
export function setPreCallHook(fn) { _preCallHook = fn; }

async function callClaude(type, payload, apiKey) {
  if (_preCallHook) {
    // Hook is responsible for: validating access (personal key OR free quota),
    // tracking usage, and throwing NO_API_KEY / CALL_LIMIT_EXCEEDED / FREE_QUOTA_EXCEEDED.
    await _preCallHook({ apiKey });
  } else if (!apiKey) {
    throw new Error('NO_API_KEY');
  }

  const headers = { 'Content-Type': 'application/json' };
  const distinctId = getDistinctId();
  if (distinctId) headers['X-POSTHOG-DISTINCT-ID'] = distinctId;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers,
    // Only send apiKey when present; server falls back to its own key for free quota calls
    body: JSON.stringify({ type, payload, ...(apiKey ? { apiKey } : {}) }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.result;
}

export async function generateWeekMenu({ availableIngredients = '', fixedMeals = [], recurringMeals = [], mealSlots = null, foodHistory = [], savedRecipes = [], requiredIngredients = null, kpiOverrides = null, season = null, apiKey } = {}) {
  const result = await callClaude('generate_week', { availableIngredients, fixedMeals, recurringMeals, mealSlots, foodHistory, savedRecipes, requiredIngredients, kpiOverrides, season }, apiKey);
  track('ai_week_generated');
  return result;
}

export async function suggestIngredients({ foodHistory = [], availableIngredients = '', mealSlots = null, apiKey } = {}) {
  return callClaude('suggest_ingredients', { foodHistory, availableIngredients, mealSlots }, apiKey);
}

export async function suggestIngredientAlternative({ ingredient, category, existingInCategory = [], apiKey } = {}) {
  return callClaude('suggest_ingredient_alternative', { ingredient, category, existingInCategory }, apiKey);
}

export async function regenerateDay({ dayName, weekContext = [], availableIngredients = '', fixedMeals = [], apiKey }) {
  const result = await callClaude('regenerate_day', { dayName, weekContext, availableIngredients, fixedMeals }, apiKey);
  track('ai_day_regenerated');
  return result;
}

export async function suggestMeal({ dayName, mealType, weekContext = [], ingredients = '', requirements = [], apiKey }) {
  return callClaude('suggest_meal', { dayName, mealType, weekContext, ingredients, requirements }, apiKey);
}

export async function quickMeal({ ingredients = '', requirements = [], prepTime = null, apiKey }) {
  const result = await callClaude('quick_meal', { ingredients, requirements, prepTime }, apiKey);
  track('ai_meal_suggested');
  return result;
}

export async function evaluateDay({ meals, apiKey }) {
  return callClaude('evaluate_day', { meals }, apiKey);
}

export async function suggestDinner({ meals, weeklyFish = null, weeklyLegume = null, previousTitle = null, apiKey }) {
  return callClaude('suggest_dinner', { meals, weeklyFish, weeklyLegume, previousTitle }, apiKey);
}

export async function swapDinnerIngredient({ ingredient, role, otherIngredients = [], apiKey }) {
  return callClaude('swap_dinner_ingredient', { ingredient, role, otherIngredients }, apiKey);
}

export async function detectTags({ text, apiKey }) {
  return callClaude('detect_tags', { text }, apiKey);
}

export async function analyzeMealPhoto({ imageBase64, mimeType = 'image/jpeg', apiKey }) {
  return callClaude('analyze_meal_photo', { imageBase64, mimeType }, apiKey);
}

export async function generateBatchCooking({ weekMenu, apiKey }) {
  const result = await callClaude('batch_cooking', { weekMenu }, apiKey);
  track('ai_batch_cooking_generated');
  return result;
}

export async function generateBatchCookingOptimized({ weekMenu, timeSessions, apiKey }) {
  const result = await callClaude('batch_cooking_optimized', { weekMenu, timeSessions }, apiKey);
  track('ai_batch_cooking_generated');
  return result;
}

export async function fixKPI({ kpiType, weekContext, kpiState, activeTipos, allKpiStates, apiKey }) {
  return callClaude('fix_kpi', { kpiType, weekContext, kpiState, activeTipos, allKpiStates }, apiKey);
}

export async function validateFFCode(code) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'validate_ff_code', payload: { code } }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.result;
}
