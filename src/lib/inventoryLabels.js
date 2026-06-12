// Keyword → nutritional tag inference for inventory prep names.
// Uses the same tag IDs as kpis.js — no duplication.

const RULES = [
  // oily_fish (subset of iron too)
  { tags: ['oily_fish', 'iron'], keywords: ['salmón', 'salmon', 'caballa', 'sardina', 'atún', 'atun', 'boquerones', 'anchoas', 'trucha'] },
  // white fish
  { tags: ['fish', 'iron'], keywords: ['merluza', 'lubina', 'dorada', 'bacalao', 'lenguado', 'rape', 'rodaballo', 'pescado'] },
  // legumes (iron too)
  { tags: ['legume', 'iron'], keywords: ['lenteja', 'garbanzo', 'alubia', 'judía', 'judia', 'guisante', 'haba', 'edamame', 'soja', 'hummus'] },
  // egg
  { tags: ['egg', 'iron'], keywords: ['huevo', 'tortilla', 'revuelto'] },
  // dairy
  { tags: ['dairy'], keywords: ['yogur', 'queso', 'leche', 'requesón', 'requesón', 'kéfir', 'kefir', 'bechamel'] },
  // fruit
  { tags: ['fruit'], keywords: ['manzana', 'pera', 'plátano', 'platano', 'naranja', 'fresa', 'frambuesa', 'arándano', 'arandano', 'mango', 'kiwi', 'melocotón', 'melocoton', 'nectarina', 'uva', 'melón', 'melon', 'sandía', 'sandia', 'piña', 'pina', 'mandarina', 'ciruela', 'cereza', 'albaricoque', 'papaya', 'fruta', 'compota', 'puré de fruta', 'pure de fruta'] },
  // carbs / cereal
  { tags: ['carbs'], keywords: ['arroz', 'pasta', 'macarrón', 'macarron', 'espagueti', 'fideos', 'quinoa', 'mijo', 'avena', 'pan', 'tostada', 'couscous', 'cuscús', 'polenta', 'boniato', 'patata', 'papa'] },
  // meat (iron)
  { tags: ['iron'], keywords: ['carne', 'ternera', 'pollo', 'pavo', 'cerdo', 'cordero', 'conejo', 'pechuga', 'muslo', 'hamburguesa', 'albóndiga', 'albondiga', 'filete'] },
];

// Each entry: [display_key, ...match_keywords]
// display_key is used as the veggie: tag value
const VEGGIES = [
  ['zanahoria', 'zanahoria'],
  ['calabacin', 'calabacín', 'calabacin'],
  ['brocoli', 'brócoli', 'brocoli'],
  ['espinaca', 'espinaca'],
  ['acelga', 'acelga'],
  ['coliflor', 'coliflor'],
  ['pimiento', 'pimiento'],
  ['tomate', 'tomate'],
  ['pepino', 'pepino'],
  ['berenjena', 'berenjena'],
  ['alcachofa', 'alcachofa'],
  ['puerro', 'puerro'],
  ['cebolla', 'cebolla'],
  ['ajo', 'ajo'],
  ['apio', 'apio'],
  ['remolacha', 'remolacha'],
  ['judia_verde', 'judía verde', 'judias verdes', 'judia verde'],
  ['esparrago', 'espárrago', 'esparrago'],
  ['col', 'lombarda'],
  ['nabo', 'nabo'],
  ['boniato', 'boniato'],
  ['calabaza', 'calabaza'],
  ['champinon', 'champiñón', 'champiñon', 'seta'],
  ['berro', 'berro'],
  ['rucula', 'rúcula', 'rucula'],
  ['lechuga', 'lechuga'],
  ['endivia', 'endivia'],
  ['hinojo', 'hinojo'],
];

/**
 * Infer nutritional tags from a preparation name.
 * @param {string} name
 * @returns {string[]} array of tag IDs (e.g. ['iron', 'oily_fish', 'veggie:zanahoria'])
 */
export function inferLabels(name) {
  if (!name) return [];
  const lower = name.toLowerCase();
  const tagSet = new Set();

  for (const rule of RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      rule.tags.forEach((t) => tagSet.add(t));
    }
  }

  for (const [key, ...keywords] of VEGGIES) {
    if (keywords.some((kw) => lower.includes(kw))) {
      tagSet.add(`veggie:${key}`);
    }
  }

  return [...tagSet];
}
