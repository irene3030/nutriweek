const API_URL = '/api/claude';

async function callClaude(type, payload, apiKey) {
  if (!apiKey) {
    throw new Error('NO_API_KEY');
  }
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, payload, apiKey }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.result;
}

export async function generateWeekMenu({ availableIngredients = '', fixedMeals = [], recurringMeals = [], mealSlots = null, foodHistory = [], savedRecipes = [], apiKey } = {}) {
  return callClaude('generate_week', { availableIngredients, fixedMeals, recurringMeals, mealSlots, foodHistory, savedRecipes }, apiKey);
}

export async function regenerateDay({ dayName, weekContext = [], availableIngredients = '', fixedMeals = [], apiKey }) {
  return callClaude('regenerate_day', { dayName, weekContext, availableIngredients, fixedMeals }, apiKey);
}

export async function suggestMeal({ dayName, mealType, weekContext = [], apiKey }) {
  return callClaude('suggest_meal', { dayName, mealType, weekContext }, apiKey);
}

export async function quickMeal({ ingredients = '', requirements = [], apiKey }) {
  return callClaude('quick_meal', { ingredients, requirements }, apiKey);
}

export async function generateBatchCooking({ weekMenu, apiKey }) {
  return callClaude('batch_cooking', { weekMenu }, apiKey);
}
