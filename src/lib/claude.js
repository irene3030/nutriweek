import { track, getDistinctId } from './analytics';
import { auth } from './firebase';

const API_URL = '/api/claude';

async function callClaude(type, payload) {
  const user = auth.currentUser;
  if (!user) throw new Error('NO_API_KEY');

  const idToken = await user.getIdToken();
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`,
  };
  const distinctId = getDistinctId();
  if (distinctId) headers['X-POSTHOG-DISTINCT-ID'] = distinctId;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type, payload }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.result;
}

export async function generateWeekMenu({ availableIngredients = '', fixedMeals = [], recurringMeals = [], mealSlots = null, foodHistory = [], savedRecipes = [], requiredIngredients = null, kpiOverrides = null, season = null, vetoedIngredients = null, babyProfile = null, consumedMeals = null, daysToGenerate = null } = {}) {
  const result = await callClaude('generate_week', { availableIngredients, fixedMeals, recurringMeals, mealSlots, foodHistory, savedRecipes, requiredIngredients, kpiOverrides, season, vetoedIngredients, babyProfile, consumedMeals, daysToGenerate });
  track('ai_week_generated');
  return result;
}

export async function suggestIngredients({ foodHistory = [], availableIngredients = '', mealSlots = null } = {}) {
  return callClaude('suggest_ingredients', { foodHistory, availableIngredients, mealSlots });
}

export async function suggestIngredientAlternative({ ingredient, category, existingInCategory = [] } = {}) {
  return callClaude('suggest_ingredient_alternative', { ingredient, category, existingInCategory });
}

export async function regenerateDay({ dayName, weekContext = [], availableIngredients = '', fixedMeals = [] }) {
  const result = await callClaude('regenerate_day', { dayName, weekContext, availableIngredients, fixedMeals });
  track('ai_day_regenerated');
  return result;
}

export async function suggestMeal({ dayName, mealType, weekContext = [], ingredients = '', requirements = [] }) {
  return callClaude('suggest_meal', { dayName, mealType, weekContext, ingredients, requirements });
}

export async function quickMeal({ ingredients = '', requirements = [], prepTime = null }) {
  const result = await callClaude('quick_meal', { ingredients, requirements, prepTime });
  track('ai_meal_suggested');
  return result;
}

export async function evaluateDay({ meals }) {
  return callClaude('evaluate_day', { meals });
}

export async function suggestDinner({ meals, weeklyFish = null, weeklyLegume = null, previousTitle = null }) {
  return callClaude('suggest_dinner', { meals, weeklyFish, weeklyLegume, previousTitle });
}

export async function swapDinnerIngredient({ ingredient, role, otherIngredients = [] }) {
  return callClaude('swap_dinner_ingredient', { ingredient, role, otherIngredients });
}

export async function detectTags({ text }) {
  return callClaude('detect_tags', { text });
}

export async function analyzeMealPhoto({ imageBase64, mimeType = 'image/jpeg' }) {
  return callClaude('analyze_meal_photo', { imageBase64, mimeType });
}

export async function generateBatchCooking({ weekMenu }) {
  const result = await callClaude('batch_cooking', { weekMenu });
  track('ai_batch_cooking_generated');
  return result;
}

export async function generateBatchCookingOptimized({ weekMenu, timeSessions }) {
  const result = await callClaude('batch_cooking_optimized', { weekMenu, timeSessions });
  track('ai_batch_cooking_generated');
  return result;
}

export async function fixKPI({ kpiType, weekContext, kpiState, activeTipos, allKpiStates }) {
  return callClaude('fix_kpi', { kpiType, weekContext, kpiState, activeTipos, allKpiStates });
}

export async function validateFFCode(code) {
  const user = auth.currentUser;
  const headers = { 'Content-Type': 'application/json' };
  if (user) {
    const idToken = await user.getIdToken();
    headers['Authorization'] = `Bearer ${idToken}`;
  }
  const response = await fetch(API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ type: 'validate_ff_code', payload: { code } }),
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || `HTTP ${response.status}`);
  }
  const data = await response.json();
  return data.result;
}
