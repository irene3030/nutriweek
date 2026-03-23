const API_URL = '/api/claude';

async function callClaude(type, payload) {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, payload }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `HTTP ${response.status}`);
  }

  const data = await response.json();
  return data.result;
}

/**
 * Generate a full week menu.
 * @param {string} availableIngredients
 * @param {Array} foodHistory
 * @param {Array} savedRecipes
 * @returns {Promise<{days: Array}>}
 */
export async function generateWeekMenu({ availableIngredients = '', foodHistory = [], savedRecipes = [] } = {}) {
  return callClaude('generate_week', { availableIngredients, foodHistory, savedRecipes });
}

/**
 * Regenerate a single day.
 * @param {string} dayName
 * @param {Array} weekContext
 * @param {string} availableIngredients
 * @returns {Promise<{day: string, meals: Array}>}
 */
export async function regenerateDay({ dayName, weekContext = [], availableIngredients = '' }) {
  return callClaude('regenerate_day', { dayName, weekContext, availableIngredients });
}

/**
 * Suggest a meal for a specific slot.
 * @param {string} dayName
 * @param {string} mealType
 * @param {Array} weekContext
 * @returns {Promise<{baby: string, adult: string, tags: Array}>}
 */
export async function suggestMeal({ dayName, mealType, weekContext = [] }) {
  return callClaude('suggest_meal', { dayName, mealType, weekContext });
}
