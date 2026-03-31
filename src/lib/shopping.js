/**
 * Shopping list generation from week menu text.
 */

// Keywords/patterns for ingredient detection by category
const PROTEIN_ANIMAL_KEYWORDS = [
  'salmón', 'salmon', 'caballa', 'sardina', 'sardinas', 'atún', 'atun', 'merluza', 'bacalao',
  'pollo', 'pechuga', 'muslo', 'contramuslo', 'ternera', 'buey', 'cerdo', 'lomo',
  'huevo', 'huevos', 'tortilla', 'pavo', 'conejo', 'cordero',
];

const VEGGIE_KEYWORDS = [
  'brócoli', 'brocoli', 'zanahoria', 'zanahorias', 'calabacín', 'calabacin',
  'boniato', 'batata', 'patata', 'patatas', 'tomate', 'tomates', 'pimiento',
  'cebolla', 'ajo', 'puerro', 'coliflor', 'guisantes', 'judías verdes', 'judias verdes',
  'berenjena', 'alcachofa', 'espárrago', 'esparragos', 'nabo', 'remolacha',
  'calabaza', 'maíz', 'maiz', 'champiñón', 'champiñones', 'seta', 'setas',
];

const FRUIT_KEYWORDS = [
  'manzana', 'pera', 'plátano', 'platano', 'fresa', 'fresas', 'mandarina',
  'naranja', 'kiwi', 'melocotón', 'melocoton', 'uva', 'uvas', 'mango',
  'aguacate', 'arándano', 'arandanos', 'ciruela', 'sandía', 'sandia',
  'melón', 'melon', 'piña', 'pina', 'frambuesa', 'frambuesas',
];

const PANTRY_KEYWORDS = [
  'arroz', 'pasta', 'pan', 'lentejas', 'garbanzos', 'alubias', 'judías', 'judias',
  'avena', 'quinoa', 'harina', 'aceite', 'aceite de oliva', 'mantequilla',
  'queso', 'yogur', 'leche', 'nata', 'crema', 'tofu',
  'macarrones', 'espagueti', 'fideos', 'cuscús', 'cuscus',
];

function extractIngredients(text) {
  if (!text) return [];
  const words = text.toLowerCase();
  const found = [];

  const allKeywords = [
    ...PROTEIN_ANIMAL_KEYWORDS,
    ...VEGGIE_KEYWORDS,
    ...FRUIT_KEYWORDS,
    ...PANTRY_KEYWORDS,
  ];

  for (const kw of allKeywords) {
    if (words.includes(kw)) {
      found.push(kw);
    }
  }

  return [...new Set(found)];
}

function categorize(ingredient) {
  const lc = ingredient.toLowerCase();
  if (PROTEIN_ANIMAL_KEYWORDS.some((k) => lc.includes(k))) return 'proteína animal';
  if (VEGGIE_KEYWORDS.some((k) => lc.includes(k))) return 'verdura';
  if (FRUIT_KEYWORDS.some((k) => lc.includes(k))) return 'fruta';
  return 'despensa';
}

/**
 * Generate shopping list from a week document.
 * @param {Object} weekDoc - The week document with days and meals
 * @param {string} availableAtHome - Comma-separated string of ingredients available at home
 * @returns {Object} - { categories: { 'proteína animal': [], verdura: [], fruta: [], despensa: [] }, atHome: [] }
 */
export function generateShoppingList(weekDoc, availableAtHome = '') {
  if (!weekDoc || !weekDoc.days) {
    return {
      categories: {
        'proteína animal': [],
        verdura: [],
        fruta: [],
        despensa: [],
      },
      atHome: [],
    };
  }

  // Map: ingredient → [{day, tipo, text}]
  const ingredientUsages = new Map();

  for (const day of weekDoc.days) {
    if (!day.meals) continue;
    for (const meal of day.meals) {
      const mealText = [meal.baby, meal.adult].filter(Boolean).join(' / ');
      const ingredients = [...new Set([
        ...extractIngredients(meal.baby || ''),
        ...extractIngredients(meal.adult || ''),
      ])];
      for (const ing of ingredients) {
        if (!ingredientUsages.has(ing)) ingredientUsages.set(ing, []);
        ingredientUsages.get(ing).push({ day: day.day, tipo: meal.tipo, text: mealText });
      }
    }
  }

  // Parse available at home
  const homeItems = availableAtHome
    ? availableAtHome
        .split(/[,;\n]+/)
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : [];

  const atHome = [];
  const shopping = {
    'proteína animal': [],
    verdura: [],
    fruta: [],
    despensa: [],
  };

  for (const [ingredient, usages] of ingredientUsages) {
    const isAtHome = homeItems.some(
      (h) => ingredient.includes(h) || h.includes(ingredient)
    );
    const item = { name: ingredient, usages };
    if (isAtHome) {
      atHome.push(item);
    } else {
      const cat = categorize(ingredient);
      shopping[cat].push(item);
    }
  }

  // Sort each category alphabetically by name
  for (const cat of Object.keys(shopping)) {
    shopping[cat].sort((a, b) => a.name.localeCompare(b.name));
  }
  atHome.sort((a, b) => a.name.localeCompare(b.name));

  return { categories: shopping, atHome };
}

/**
 * Format shopping list as plain text for copy/share.
 */
export function formatShoppingListText(shoppingList, weekLabel = '') {
  const lines = [];
  if (weekLabel) lines.push(`🛒 Lista de la compra - ${weekLabel}`, '');

  const { categories, atHome } = shoppingList;

  const categoryEmojis = {
    'proteína animal': '🥩',
    verdura: '🥦',
    fruta: '🍎',
    despensa: '🫙',
  };

  for (const [cat, items] of Object.entries(categories)) {
    if (items.length === 0) continue;
    lines.push(`${categoryEmojis[cat] || '•'} ${cat.toUpperCase()}`);
    for (const item of items) {
      lines.push(`  • ${item.name}`);
    }
    lines.push('');
  }

  if (atHome.length > 0) {
    lines.push('✅ YA TIENES EN CASA');
    for (const item of atHome) {
      lines.push(`  • ${item.name}`);
    }
  }

  return lines.join('\n');
}
