import Anthropic from '@anthropic-ai/sdk';
import { PostHog } from 'posthog-node';

const posthog = process.env.POSTHOG_KEY
  ? new PostHog(process.env.POSTHOG_KEY, {
      host: 'https://eu.i.posthog.com',
      flushAt: 1,
      flushInterval: 0,
      enableExceptionAutocapture: true,
    })
  : null;

const SYSTEM_PROMPT = `Eres un asistente de nutrición infantil especializado en BLW (Baby-Led Weaning).
Planificas comidas para un bebé de ~12 meses y su familia (los adultos comen lo mismo, añadiendo sal y condimentos ellos mismos).

Reglas BLW estrictas:
- Sin sal añadida
- Sin miel hasta los 12 meses cumplidos
- Sin verduras de hoja verde (espinaca, acelga) hasta los 12 meses por nitratos
- Texturas blandas, trozos grandes para agarrar (no triturado, no bola)
- Sin frutos secos enteros

Reglas por franja horaria (MUY IMPORTANTE — respétalas siempre):
- desayuno: frutas, cereales (avena, tostada, tortita, porridge), lácteos (yogur, queso fresco), huevo. NO verduras, NO proteína cárnica.
- snack (media mañana): fruta, pequeño trozo de pan o cereal, lácteo. Ración pequeña. NO platos elaborados, NO verduras cocinadas.
- comida: plato completo — proteína (carne, pescado, legumbre o huevo) + verdura + base (cereal o legumbre). Es la comida principal del día.
- merienda: fruta, yogur, lácteo, pan con algo suave. Ración pequeña. NO proteína cárnica, NO platos de verdura elaborados.
- cena: plato ligero pero completo — verdura + proteína suave o huevo. Más ligero que la comida pero no un snack.

Reglas nutricionales semanales:
- Hierro en al menos 5 de 7 días (carne roja, legumbre, pescado azul)
- Pescado azul (salmón, caballa, sardina, atún, boquerón) al menos 3 veces — tag oily_fish (+ fish)
- Mínimo 5 verduras distintas a lo largo de la semana
- No repetir la misma proteína animal más de 2 días consecutivos
- Evitar pescados altos en mercurio (pez espada, tiburón, atún rojo, marlín) — especialmente en bebé BLW

Para cada comida devuelve:
- baby: descripción de la comida (apta para bebé BLW, la familia come lo mismo)
- tags: array con los tags aplicables. Definición de cada tag:
  - iron → contiene carne roja (ternera, cerdo, cordero) o legumbre o pescado azul (salmón, caballa, sardina, atún, boquerón)
  - oily_fish → contiene pescado azul alto en omega-3 (salmón, caballa, sardina, atún, boquerón) — también añade siempre el tag fish
  - fish → contiene cualquier pescado o marisco (incluido pescado blanco: merluza, bacalao, dorada, lubina...)
  - legume → contiene legumbre (lentejas, garbanzos, judías, guisantes, edamame)
  - egg → contiene huevo
  - dairy → contiene lácteo (yogur, queso, leche)
  - fruit → contiene fruta
  - cereal → contiene cereal (arroz, pasta, pan, avena, quinoa)
  - veggie:nombre → una por cada verdura concreta identificada (ej: veggie:brócoli, veggie:zanahoria)

Devuelve SOLO JSON válido con la estructura definida, sin texto adicional.`;

function sanitize(input, maxLength = 500) {
  if (input === null || input === undefined) return '';
  return String(input).replace(/[\r\n]/g, ' ').trim().slice(0, maxLength);
}

const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(o => o.trim());

function corsHeaders(requestOrigin) {
  const origin = ALLOWED_ORIGINS.includes(requestOrigin)
    ? requestOrigin
    : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'Content-Type, X-POSTHOG-DISTINCT-ID',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

export const handler = async (event) => {
  const requestOrigin = event.headers?.origin || event.headers?.Origin || '';
  const cors = corsHeaders(requestOrigin);

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: cors, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: cors,
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const distinctId = event.headers?.['x-posthog-distinct-id'] || null;

  try {
    const body = JSON.parse(event.body);
    const { type, payload, apiKey } = body;

    // validate_ff_code does not need an Anthropic API key — handle it first
    if (type === 'validate_ff_code') {
      const ffCode = process.env.FRIENDS_FAMILY_CODE;
      if (!ffCode) {
        return {
          statusCode: 503,
          headers: { ...cors, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'No hay códigos de invitación configurados.' }),
        };
      }
      const valid = sanitize(payload?.code, 30).toUpperCase() === ffCode.trim().toUpperCase();
      return {
        statusCode: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: { valid } }),
      };
    }

    const resolvedKey = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!resolvedKey) {
      return {
        statusCode: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No hay API key configurada. Añádela en la sección Perfil.' }),
      };
    }

    const client = new Anthropic({ apiKey: resolvedKey });

    let userMessage = '';

    if (type === 'suggest_ingredients') {
      const { foodHistory, availableIngredients, mealSlots } = payload;
      const safeAvailable = sanitize(availableIngredients, 300);

      // Calculate how many distinct meals will actually be cooked
      let distinctMealCount = 35; // default: 5 slots × 7 days
      let enabledSlotNames = ['desayuno', 'snack', 'comida', 'merienda', 'cena'];
      if (mealSlots && typeof mealSlots === 'object') {
        const entries = Object.entries(mealSlots);
        const enabled = entries.filter(([, v]) => v && v.enabled);
        const sameEveryDay = enabled.filter(([, v]) => v.sameEveryDay);
        const varying = enabled.filter(([, v]) => !v.sameEveryDay);
        distinctMealCount = sameEveryDay.length + varying.length * 7;
        enabledSlotNames = enabled.map(([k]) => k);
      }

      // Scale ingredient count to actual meal count
      let minIng, maxIng;
      if (distinctMealCount <= 2)       { minIng = 2; maxIng = 4; }
      else if (distinctMealCount <= 7)  { minIng = 4; maxIng = 7; }
      else if (distinctMealCount <= 14) { minIng = 6; maxIng = 10; }
      else if (distinctMealCount <= 21) { minIng = 9; maxIng = 13; }
      else                              { minIng = 12; maxIng = 18; }

      // Adapt nutritional rules to actual slots
      const hasMainMeals = enabledSlotNames.some(s => s === 'comida' || s === 'cena');
      const hasBreakfastOrSnacks = enabledSlotNames.some(s => ['desayuno', 'snack', 'merienda'].includes(s));

      const nutritionRules = [];
      if (hasMainMeals) {
        nutritionRules.push('- Hierro en al menos 5 comidas (carne roja, legumbre, pescado azul)');
        nutritionRules.push('- Pescado graso al menos 3 veces');
        nutritionRules.push('- Mínimo 5 verduras distintas');
        nutritionRules.push('- Proteínas variadas, sin repetir más de 2 días seguidos');
      }
      if (hasBreakfastOrSnacks && !hasMainMeals) {
        nutritionRules.push('- Fruta, cereales y lácteos apropiados para desayuno/snack/merienda');
        nutritionRules.push('- Huevo y lácteo como fuentes de proteína');
      }

      const slotsInfo = `Franjas activas: ${enabledSlotNames.join(', ')} (${distinctMealCount} comidas distintas en total).`;

      userMessage = `Sugiere una lista de ingredientes para planificar una semana de menús BLW para bebé ~12 meses y familia.

${slotsInfo}
${nutritionRules.length > 0 ? `\nLa lista debe cubrir:\n${nutritionRules.join('\n')}` : ''}
${safeAvailable ? `\nIngredientes disponibles en casa (inclúyelos si son adecuados): ${safeAvailable}` : ''}
Historial reciente (evita repetir demasiado): ${foodHistory ? JSON.stringify(foodHistory).slice(0, 500) : 'sin historial'}

Devuelve entre ${minIng} y ${maxIng} ingredientes, ajustado a las comidas reales. SOLO este JSON:
{
  "ingredients": [
    { "id": "1", "name": "Salmón", "category": "pescado", "reason": "Pescado graso, omega-3 e hierro" },
    { "id": "2", "name": "Lentejas", "category": "legumbre", "reason": "Hierro vegetal y proteína" }
  ]
}
Categorías válidas: proteína, pescado, legumbre, verdura, fruta, cereal, lácteo, huevo`;

    } else if (type === 'suggest_ingredient_alternative') {
      const { ingredient, category, existingInCategory } = payload;
      const safeName = sanitize(ingredient, 100);
      const safeCategory = sanitize(category, 30);
      const safeExisting = Array.isArray(existingInCategory)
        ? existingInCategory.map(i => sanitize(i, 100)).filter(Boolean)
        : [];
      const excludeNote = safeExisting.length > 0
        ? `\nNO uses ninguno de estos, ya están en la lista: ${safeExisting.join(', ')}.`
        : '';
      userMessage = `Sugiere UN ingrediente alternativo para sustituir "${safeName}" en un menú BLW para bebé ~12 meses.
El alternativo debe ser de la misma categoría nutricional (${safeCategory}), fácil de encontrar y apto para BLW.${excludeNote}
Devuelve SOLO este JSON: { "alternative": "nombre del ingrediente" }`;

    } else if (type === 'generate_week') {
      const { availableIngredients, fixedMeals, recurringMeals, mealSlots, foodHistory, savedRecipes, requiredIngredients, kpiOverrides, season, vetoedIngredients, babyProfile } = payload;

      // Build baby context from profile
      let babyContext = 'bebé de ~12 meses';
      if (babyProfile) {
        const name = babyProfile.name ? sanitize(babyProfile.name, 30) : null;
        const birthDate = babyProfile.birthDate ? sanitize(babyProfile.birthDate, 12) : null;
        const isBreastfeeding = !!babyProfile.isBreastfeeding;
        if (birthDate) {
          const birth = new Date(birthDate);
          const now = new Date();
          const ageMonths = Math.max(0, (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth()));
          babyContext = name ? `${name} (${ageMonths} meses)` : `bebé de ${ageMonths} meses`;
          if (isBreastfeeding && ageMonths < 18) {
            babyContext += '. Toma lactancia materna — los lácteos y el calcio están cubiertos en gran parte por la leche materna; no es necesario priorizar lácteos en el menú.';
          } else if (isBreastfeeding) {
            babyContext += '. Sigue con lactancia materna — considera incluir lácteos de forma habitual ya que la leche materna puede no cubrir todo el calcio necesario.';
          }
        } else if (name) {
          babyContext = `${name} (~12 meses)`;
        }
      }

      const safeIngredients = sanitize(availableIngredients, 300);
      const safeRequired = Array.isArray(requiredIngredients)
        ? requiredIngredients.map(i => sanitize(i, 100)).filter(Boolean)
        : [];
      const safeVetoed = Array.isArray(vetoedIngredients)
        ? vetoedIngredients.map(v => sanitize(typeof v === 'string' ? v : v?.name, 100)).filter(Boolean)
        : [];
      const safeFixedMeals = Array.isArray(fixedMeals)
        ? fixedMeals.map(m => ({
            day: sanitize(m.day, 10),
            tipo: sanitize(m.tipo, 20),
            text: sanitize(m.text, 200),
          }))
        : [];
      const safeRecurring = Array.isArray(recurringMeals)
        ? recurringMeals.map(r => sanitize(r, 200))
        : [];

      const ingredientsSection = safeRequired.length > 0
        ? `\nIngredientes OBLIGATORIOS que debes usar en el menú, distribuyéndolos a lo largo de la semana (uno por comida principal): ${safeRequired.join(', ')}`
        : safeIngredients
          ? `\nIngredientes disponibles en nevera/despensa (priorízalos cuanto antes en la semana, cada uno para una comida distinta, pero completa la semana con otros alimentos también): ${safeIngredients}`
          : '';

      const fixedSection = safeFixedMeals.length > 0
        ? `\nComidas fijadas en día y franja concretos (respétalas EXACTAMENTE):\n${safeFixedMeals.filter(m => m.day).map(m => `- ${m.day} ${m.tipo}: "${m.text}"`).join('\n')}`
        : '';

      const recurringSection = safeRecurring.length > 0
        ? `\nComidas que deben aparecer esta semana (colócalas en el día y franja que mejor encaje nutricionalmente): ${safeRecurring.join(', ')}`
        : '';

      const slotsSection = mealSlots ? (() => {
        const disabled = Object.entries(mealSlots).filter(([, v]) => !v.enabled).map(([k]) => k);
        const same = Object.entries(mealSlots).filter(([, v]) => v.enabled && v.sameEveryDay).map(([k]) => k);
        let s = '';
        if (disabled.length) s += `\nFranjas que NO debes generar (déjalas vacías: baby:"", adult:"", tags:[]): ${disabled.join(', ')}`;
        if (same.length) {
          // Check if any sameEveryDay slot also has a fixed meal — use that text for all days
          const sameDetails = same.map(tipo => {
            const fixed = safeFixedMeals.find(m => m.tipo === tipo && m.day);
            return fixed
              ? `${tipo} (usa EXACTAMENTE "${fixed.text}" para los 7 días)`
              : `${tipo} (genera una sola comida adecuada y repítela los 7 días)`;
          });
          s += `\nFranjas donde debes poner la MISMA comida todos los días: ${sameDetails.join('; ')}`;
        }
        return s;
      })() : '';

      const SEASON_INGREDIENTS = {
        primavera: 'espárragos, guisantes, fresas, alcachofas, habas, espinacas, rábanos, cerezas',
        verano:    'tomate, pimiento, calabacín, berenjena, pepino, sandía, melocotón, maíz, judías verdes',
        otoño:     'calabaza, setas, uvas, peras, manzanas, boniato, coles, brócoli, granada',
        invierno:  'naranja, mandarina, coliflor, puerro, col, acelga, kiwi, cardo, chirivía',
      };
      const SEASON_NAMES = { primavera: 'primavera', verano: 'verano', otoño: 'otoño', invierno: 'invierno' };
      const safeSeason = SEASON_NAMES[season] ?? null;
      const seasonSection = safeSeason
        ? `\nTemporada: ${safeSeason}. Prioriza ingredientes de temporada: ${SEASON_INGREDIENTS[safeSeason]}. Úsalos cuando encaje nutricionalmente, sin forzarlo.`
        : '';

      const KPI_DESCRIPTIONS = {
        iron:   (t) => `Hierro en al menos ${t} días (carne roja, legumbre o pescado azul)`,
        fish:   (t) => `Pescado azul en al menos ${t} días`,
        veggie: (t) => `Mínimo ${t} verduras distintas a lo largo de la semana`,
        legume: (t) => `Legumbres en al menos ${t} días`,
        fruit:  (t) => `Fruta en al menos ${t} días`,
      };
      const kpiSection = (() => {
        if (!kpiOverrides || typeof kpiOverrides !== 'object') return '';
        const lines = Object.entries(kpiOverrides)
          .filter(([, v]) => v && v.active)
          .map(([id, v]) => {
            const target = Math.min(7, Math.max(1, Number(v.target) || 1));
            const desc = KPI_DESCRIPTIONS[id];
            return desc ? `- ${desc(target)}` : null;
          })
          .filter(Boolean);
        return lines.length > 0 ? `\nObjetivos nutricionales para esta semana (respétalos):\n${lines.join('\n')}` : '';
      })();

      const vetoedSection = safeVetoed.length > 0
        ? `\nIngredientes PROHIBIDOS (NO los uses bajo ningún concepto en ninguna comida): ${safeVetoed.join(', ')}`
        : '';

      userMessage = `Genera un menú completo para 7 días para: ${babyContext}.
${ingredientsSection}${recurringSection}${fixedSection}${slotsSection}${seasonSection}${kpiSection}${vetoedSection}

Historial de alimentos últimas semanas: ${foodHistory ? JSON.stringify(foodHistory).slice(0, 1000) : 'sin historial'}

Recetas guardadas del usuario: ${savedRecipes && savedRecipes.length > 0 ? savedRecipes.map(r => sanitize(r.name, 100)).join(', ') : 'ninguna'}

Devuelve un JSON con esta estructura exacta:
{
  "days": [
    {
      "day": "Lun",
      "meals": [
        {
          "tipo": "desayuno",
          "baby": "descripción de la comida",
          "tags": ["tag1", "tag2"]
        },
        { "tipo": "snack", ... },
        { "tipo": "comida", ... },
        { "tipo": "merienda", ... },
        { "tipo": "cena", ... }
      ]
    },
    ... (7 días: Lun, Mar, Mié, Jue, Vie, Sáb, Dom)
  ]
}`;
    } else if (type === 'regenerate_day') {
      const { dayName, weekContext, availableIngredients, fixedMeals } = payload;

      const safeDayName = sanitize(dayName, 10);
      const safeIngredients = sanitize(availableIngredients, 300);
      const safeDayFixed = Array.isArray(fixedMeals)
        ? fixedMeals
            .filter(m => sanitize(m.day, 10) === safeDayName)
            .map(m => ({ tipo: sanitize(m.tipo, 20), text: sanitize(m.text, 200) }))
        : [];
      const fixedNote = safeDayFixed.length > 0
        ? `\nComidas fijas para este día (respétalas, no las cambies):\n${safeDayFixed.map(m => `- ${m.tipo}: "${m.text}"`).join('\n')}`
        : '';

      userMessage = `Regenera únicamente el día ${safeDayName} manteniendo coherencia nutricional con el resto de la semana.${fixedNote}

Contexto semanal actual:
${JSON.stringify(weekContext, null, 2).slice(0, 3000)}

Ingredientes disponibles en casa: ${safeIngredients || 'ninguno especificado'}

Devuelve SOLO el JSON de ese día:
{
  "day": "${safeDayName}",
  "meals": [
    { "tipo": "desayuno", "baby": "...", "tags": [...] },
    { "tipo": "snack", "baby": "...", "tags": [...] },
    { "tipo": "comida", "baby": "...", "tags": [...] },
    { "tipo": "merienda", "baby": "...", "tags": [...] },
    { "tipo": "cena", "baby": "...", "tags": [...] }
  ]
}`;
    } else if (type === 'suggest_meal') {
      const { dayName, mealType, weekContext, ingredients, requirements } = payload;
      const safeDayName = sanitize(dayName, 10);
      const safeMealType = sanitize(mealType, 20);
      const safeIngredients = sanitize(ingredients, 300);
      const safeRequirements = Array.isArray(requirements) ? requirements.map(r => sanitize(r, 50)) : [];
      const ingredientsNote = safeIngredients ? `\nIngredientes que quiero usar: ${safeIngredients}` : '';
      const reqNote = safeRequirements.length > 0 ? `\nRequisitos nutricionales: ${safeRequirements.join(', ')}` : '';
      userMessage = `Sugiere una comida para el slot "${safeMealType}" del día ${safeDayName}.${ingredientsNote}${reqNote}

Contexto semanal actual para mantener coherencia nutricional:
${JSON.stringify(weekContext, null, 2).slice(0, 3000)}

Devuelve SOLO el JSON de esa comida:
{
  "baby": "descripción de la comida",
  "tags": ["tag1", "tag2"]
}`;
    } else if (type === 'quick_meal') {
      const { ingredients, requirements, prepTime } = payload;
      const safeIngredients = sanitize(ingredients, 300);
      const safeRequirements = Array.isArray(requirements) ? requirements.map(r => sanitize(r, 50)) : [];
      const reqList = safeRequirements.length > 0 ? safeRequirements.join(', ') : null;
      const safePrepTime = [15, 30].includes(prepTime) ? prepTime : null;
      const prepNote = safePrepTime ? `\nTiempo de preparación: menos de ${safePrepTime} minutos.` : '';
      userMessage = `Sugiere una comida completa para un bebé de ~12 meses (BLW).
${safeIngredients ? `\nIngredientes disponibles: ${safeIngredients}` : ''}
${reqList ? `\nRequisitos nutricionales: ${reqList}` : ''}${prepNote}

Devuelve SOLO este JSON:
{
  "baby": "descripción breve de la comida",
  "tags": ["tag1", "tag2"]
}`;
    } else if (type === 'fix_kpi') {
      const { kpiType, weekContext, kpiState, activeTipos, allKpiStates } = payload;
      const safeKpiType = sanitize(kpiType, 20);
      const safeActiveTipos = Array.isArray(activeTipos)
        ? activeTipos.map(t => sanitize(t, 20)).filter(Boolean)
        : ['desayuno', 'snack', 'comida', 'merienda', 'cena'];
      const safeWeekContext = Array.isArray(weekContext)
        ? weekContext.map(day => ({
            day: sanitize(day.day, 10),
            meals: Array.isArray(day.meals)
              ? day.meals
                  .filter(m => safeActiveTipos.includes(sanitize(m.tipo, 20)))
                  .map(m => ({
                    tipo: sanitize(m.tipo, 20),
                    baby: sanitize(m.baby, 200),
                    tags: Array.isArray(m.tags) ? m.tags.map(t => sanitize(t, 30)) : [],
                  }))
              : [],
          }))
        : [];

      const activeSlotsList = safeActiveTipos.join(', ');

      const ironTarget = kpiState.target ?? 5;
      const fishTarget = kpiState.target ?? 3;
      const veggieTarget = kpiState.target ?? 5;

      let kpiDescription = '';
      if (safeKpiType === 'iron') {
        const needed = Math.max(0, ironTarget - (kpiState.current || 0));
        kpiDescription = `Hierro: actualmente ${kpiState.current} días con hierro, necesita al menos ${ironTarget}. Modifica ${needed} comida(s) para añadir hierro (carne roja, legumbre o pescado azul).`;
      } else if (safeKpiType === 'fish') {
        const needed = Math.max(0, fishTarget - (kpiState.current || 0));
        kpiDescription = `Pescado graso: actualmente ${kpiState.current} días con pescado graso, necesita al menos ${fishTarget}. Modifica ${needed} comida(s) para añadir salmón, caballa, sardina o atún.`;
      } else if (safeKpiType === 'veggie') {
        const needed = Math.max(0, veggieTarget - (kpiState.current || 0));
        const existing = Array.isArray(kpiState.existing) ? kpiState.existing.map(v => sanitize(v, 30)).join(', ') : '';
        kpiDescription = `Verduras distintas: actualmente ${kpiState.current} (${existing || 'ninguna'}), necesita al menos ${veggieTarget}. Añade ${needed} verdura(s) nueva(s) que no estén ya en el menú.`;
      } else if (safeKpiType === 'legume') {
        const legumeTarget = kpiState.target ?? 3;
        const needed = Math.max(0, legumeTarget - (kpiState.current || 0));
        kpiDescription = `Legumbres: actualmente ${kpiState.current} días con legumbres, necesita al menos ${legumeTarget}. Modifica ${needed} comida(s) para incluir legumbres (lentejas, garbanzos, alubias, guisantes, edamame...). Las comidas modificadas DEBEN incluir el tag "legume" en el array de tags.`;
      } else if (safeKpiType === 'fruit') {
        const fruitTarget = kpiState.target ?? 5;
        const needed = Math.max(0, fruitTarget - (kpiState.current || 0));
        kpiDescription = `Fruta: actualmente ${kpiState.current} días con fruta, necesita al menos ${fruitTarget}. Modifica ${needed} comida(s) para añadir fruta (manzana, pera, plátano, naranja, kiwi, fresas...). Las comidas modificadas DEBEN incluir el tag "fruit".`;
      } else if (safeKpiType === 'protein_rotation') {
        const alerts = Array.isArray(kpiState.alerts) ? kpiState.alerts : [];
        const alertDesc = alerts.map(a => `${a.protein} aparece ${a.count} días seguidos desde ${a.startDay}`).join('; ');
        kpiDescription = `Rotación de proteínas: ${alertDesc || 'hay proteínas repetidas más de 2 días seguidos'}. Modifica alguna comida en los días con repetición para sustituir esa proteína por otra distinta (ej: si hay pollo 3 días seguidos, cambia uno por pescado, legumbre o huevo).`;
      } else if (safeKpiType.startsWith('custom_')) {
        const customTarget = kpiState.target ?? 3;
        const customName = sanitize(kpiState.name || safeKpiType, 50);
        const customQuery = sanitize(kpiState.query || '', 100);
        const needed = Math.max(0, customTarget - (kpiState.current || 0));
        kpiDescription = `KPI personalizado "${customName}": actualmente ${kpiState.current} días que contienen "${customQuery}", necesita al menos ${customTarget}. Modifica ${needed} comida(s) para incluir "${customQuery}".`;
      }

      const otherKpiContext = Array.isArray(allKpiStates) && allKpiStates.length > 0
        ? `\n5. Estado actual de otros KPIs activos: ${allKpiStates.join(', ')}. Intenta no empeorar los que ya están en buen estado o cerca del objetivo.`
        : '';

      userMessage = `Corrige el siguiente problema nutricional en el menú semanal haciendo el mínimo de cambios posibles.

REGLAS ESTRICTAS:
1. Este menú solo tiene activas estas franjas: ${activeSlotsList}. SOLO puedes proponer cambios en esas franjas.
2. Al modificar una comida, CONSERVA todos los tags nutricionales que ya tenía (hierro, pescado, verduras, etc.). No elimines nutrientes que ya estaban presentes. Si el plato original tenía tag "iron", el nuevo también debe tenerlo.
3. Haz el mínimo número de cambios posibles.
4. Respeta las reglas BLW para bebé ~12 meses.${otherKpiContext}

Problema a resolver: ${kpiDescription}

Menú actual (solo franjas activas):
${JSON.stringify(safeWeekContext, null, 2)}

Devuelve SOLO los slots que necesitas modificar. Para cada uno, devuelve la nueva comida completa con TODOS sus tags (los que ya tenía + los nuevos necesarios).
{"fixes": [
  {"day": "Mar", "tipo": "${safeActiveTipos[0] || 'comida'}", "baby": "descripción de la comida", "tags": ["iron", "veggie:zanahoria"]}
]}`;

    } else if (type === 'detect_tags') {
      const { text } = payload;
      const safeText = sanitize(text, 300);
      userMessage = `Analiza el nombre y descripción de esta comida para bebé BLW (~12 meses) e identifica sus tags nutricionales.

Comida: "${safeText}"

Tags posibles:
- iron → contiene carne roja, legumbre o pescado azul (fuentes de hierro)
- fish → contiene pescado (cualquier tipo)
- legume → contiene legumbre (lentejas, garbanzos, judías, guisantes...)
- egg → contiene huevo
- dairy → contiene lácteo (yogur, queso, leche...)
- fruit → contiene fruta
- cereal → contiene cereal (arroz, pasta, pan, avena, quinoa...)
- veggie:nombre → contiene una verdura concreta (ej: veggie:brócoli, veggie:zanahoria). Usa una por cada verdura identificada.

Devuelve SOLO este JSON: {"tags": ["tag1", "tag2"]}
Si no identificas ningún tag con certeza, devuelve {"tags": []}`;

    } else if (type === 'batch_cooking') {
      const { weekMenu } = payload;
      // Sanitize weekMenu: only keep expected fields, strip arbitrary strings
      const safeWeekMenu = Array.isArray(weekMenu)
        ? weekMenu.map(day => ({
            day: sanitize(day.day, 10),
            meals: Array.isArray(day.meals)
              ? day.meals.map(m => ({
                  tipo: sanitize(m.tipo, 20),
                  baby: sanitize(m.baby, 300),
                }))
              : [],
          }))
        : [];
      userMessage = `Analiza este menú semanal para bebé BLW (~12 meses) y familia, y devuelve un plan de batch cooking organizado por secciones.

Menú:
${JSON.stringify(safeWeekMenu, null, 2)}

Organiza las tareas en secciones temáticas (ej: Legumbres, Verduras, Proteínas, Cereales y bases). Cada sección agrupa tareas del mismo tipo.
IMPORTANTE:
- Dentro de cada sección, cada tarea debe ser UNA SOLA preparación concreta. Si hay dos ingredientes distintos, son dos tareas separadas. No agrupes varias cosas en una misma tarea.
- Solo incluye preparaciones que requieren cocción u otra técnica activa (cocer, hornear, saltear, preparar masa, etc.). NO incluyas alimentos que se consumen directamente sin preparar (yogur, fruta fresca entera, queso, pan de molde, leche, etc.).
- En el campo "days" indica el array de días de la semana (Lun, Mar, Mié, Jue, Vie, Sáb, Dom) en que se usará esa preparación.
- En el campo "text" NO menciones los días; solo la tarea y cantidad aproximada.
- En el campo "days_fresh" indica cuántos días aguanta la preparación en nevera (número entero, ej: lentejas cocidas=4, pollo horneado=3, arroz cocido=3, verdura salteada=3, pescado=2, masa/rebozado=1).

Devuelve SOLO este JSON:
{"sections": [
  {
    "id": "s1",
    "emoji": "🟢",
    "title": "Legumbres",
    "tasks": [
      {"id": "t1", "text": "Cocer lentejas (200g)", "days": ["Lun", "Jue"], "days_fresh": 4},
      {"id": "t2", "text": "Cocer garbanzos (150g)", "days": ["Mié"], "days_fresh": 4}
    ]
  },
  ...
]}`;
    } else if (type === 'batch_cooking_optimized') {
      const { weekMenu, timeSessions } = payload;
      const safeWeekMenu = Array.isArray(weekMenu)
        ? weekMenu.map(day => ({
            day: sanitize(day.day, 10),
            meals: Array.isArray(day.meals)
              ? day.meals.map(m => ({ tipo: sanitize(m.tipo, 20), baby: sanitize(m.baby, 300) }))
              : [],
          }))
        : [];
      const safeTimeSessions = Array.isArray(timeSessions)
        ? timeSessions
            .filter(s => s.day && s.duration)
            .map(s => ({ day: sanitize(s.day, 20), duration: Math.min(Math.max(parseInt(s.duration) || 60, 15), 300) }))
        : [];
      const sessionsDesc = safeTimeSessions.map(s => `- ${s.day}: ${s.duration} minutos disponibles`).join('\n');

      userMessage = `Analiza este menú semanal para bebé BLW (~12 meses) y crea un plan de batch cooking optimizado para las sesiones de tiempo disponibles.

Menú:
${JSON.stringify(safeWeekMenu, null, 2)}

Sesiones de cocina disponibles:
${sessionsDesc}

INSTRUCCIONES:
1. Para cada sesión, selecciona las preparaciones más impactantes (las que desbloquean más comidas durante la semana). Prioriza las que aparecen en más días.
2. Agrupa las tareas en "packs" paralelos: cosas que se pueden hacer simultáneamente (ej: mientras el horno hace el pollo, cocer lentejas en el fuego y picar verduras).
3. El tiempo total activo de una sesión no debe superar el tiempo disponible. Indica el tiempo estimado de cada tarea.
4. Solo incluye preparaciones que requieren técnica activa (cocer, hornear, saltear, preparar masa…). NO incluyas alimentos que se consumen sin preparar (yogur, fruta, queso, etc.).
5. En "days" indica los días en que se usará cada preparación.
6. Etiqueta cada pack por técnica: 🔥 Fuego, 🫙 Horno, 🔪 Prep (cortar/triturar), ❄️ En frío.
7. En el campo "days_fresh" de cada tarea indica cuántos días aguanta en nevera (ej: lentejas cocidas=4, pollo horneado=3, arroz cocido=3, verdura salteada=3, pescado=2, masa/rebozado=1).

Devuelve SOLO este JSON:
{"sessions": [
  {
    "id": "s1",
    "day": "Lunes",
    "duration": 60,
    "packs": [
      {
        "id": "p1",
        "label": "🔥 Fuego",
        "parallel": false,
        "tasks": [
          {"id": "t1", "text": "Cocer lentejas (200g)", "time": 20, "days": ["Mié", "Jue"], "days_fresh": 4},
          {"id": "t2", "text": "Cocer garbanzos (150g)", "time": 25, "days": ["Lun", "Mar"], "days_fresh": 4}
        ]
      },
      {
        "id": "p2",
        "label": "🔪 Mientras tanto: prep",
        "parallel": true,
        "tasks": [
          {"id": "t3", "text": "Picar y reservar brócoli y zanahoria", "time": 10, "days": ["Lun", "Mar", "Mié"], "days_fresh": 3}
        ]
      }
    ]
  }
]}`;

    } else if (type === 'evaluate_day') {
      const { meals } = payload;
      const safeMeals = Array.isArray(meals)
        ? meals.map(m => ({ tipo: sanitize(m.tipo, 20), text: sanitize(m.text, 300) })).filter(m => m.text)
        : [];
      const mealLines = safeMeals.map(m => `- ${m.tipo}: ${m.text}`).join('\n');
      userMessage = `Evalúa nutricionalmente el siguiente día de comidas para un bebé BLW de ~12 meses:

${mealLines || '(sin comidas introducidas)'}

Analiza qué nutrientes clave están presentes y cuáles faltan. Distingue entre:
- Lo que debería estar CADA DÍA (verduras variadas, fruta, proteína, grasa de calidad...)
- Lo que se recomienda a lo largo de LA SEMANA pero no necesariamente cada día (pescado graso 2-3x/semana, legumbres 3x/semana...)

Devuelve SOLO este JSON:
{
  "overall": "resumen de 1-2 frases del día",
  "positives": ["frase corta de algo que está bien en este día"],
  "missing_daily": [
    {
      "nutrient": "nombre del nutriente o grupo de alimento",
      "reason": "por qué debería estar presente hoy"
    }
  ],
  "missing_weekly": [
    {
      "nutrient": "nombre del nutriente o alimento",
      "frequency": "ej: 2-3 veces por semana",
      "reason": "por qué es importante incluirlo regularmente en la semana"
    }
  ]
}
Si no falta nada en una categoría, devuelve el array vacío.`;

    } else if (type === 'suggest_dinner') {
      const { meals, weeklyFish, weeklyLegume, previousTitle } = payload;
      const safeMeals = Array.isArray(meals)
        ? meals.map(m => ({ tipo: sanitize(m.tipo, 20), text: sanitize(m.text, 300) })).filter(m => m.text)
        : [];
      const mealLines = safeMeals.map(m => `- ${m.tipo}: ${m.text}`).join('\n');
      const safeWeeklyFish = [0, 1, 2, 3].includes(weeklyFish) ? weeklyFish : null;
      const safeWeeklyLegume = [0, 1, 2, 3].includes(weeklyLegume) ? weeklyLegume : null;
      const weekCtx = [
        safeWeeklyFish !== null ? `Raciones de pescado graso llevadas esta semana: ${safeWeeklyFish}/3` : '',
        safeWeeklyLegume !== null ? `Raciones de legumbre llevadas esta semana: ${safeWeeklyLegume}/3` : '',
      ].filter(Boolean).join('\n');
      const prevNote = previousTitle ? `\nNO propongas "${sanitize(previousTitle, 100)}" ni un plato muy similar. Propón algo diferente.` : '';
      userMessage = `Propón una cena para un bebé BLW de ~12 meses que complemente nutricionalmente este día:

Comidas del día:
${mealLines || '(sin comidas registradas)'}
${weekCtx ? `\nContexto semanal:\n${weekCtx}` : ''}${prevNote}

Sugiere una cena concreta y explica brevemente por qué tiene sentido nutricionalmente dado lo que ya ha comido hoy y el contexto semanal.

Devuelve SOLO este JSON:
{
  "title": "nombre del plato (corto y claro)",
  "preparation": "descripción breve de preparación apta para BLW",
  "ingredients": [
    { "name": "nombre del ingrediente", "why": "por qué lo incluyes (beneficio nutricional concreto)" }
  ],
  "tags": ["tag1", "tag2"]
}`;

    } else if (type === 'swap_dinner_ingredient') {
      const { ingredient, role, otherIngredients } = payload;
      const safeIng = sanitize(ingredient, 100);
      const safeRole = sanitize(role, 200);
      const safeOthers = Array.isArray(otherIngredients)
        ? otherIngredients.map(i => sanitize(i, 100)).filter(Boolean)
        : [];
      const excludeNote = safeOthers.length > 0
        ? `\nNO uses ninguno de estos, ya están en la cena: ${safeOthers.join(', ')}.`
        : '';
      userMessage = `Sugiere UN ingrediente alternativo para sustituir "${safeIng}" en una cena BLW para bebé ~12 meses.
El ingrediente original cumple este rol nutricional: "${safeRole}".
El sustituto debe cumplir el mismo rol nutricional, ser apto para BLW y diferente al original.${excludeNote}
Devuelve SOLO este JSON: { "name": "nombre del ingrediente", "why": "beneficio nutricional concreto" }`;

    } else if (type === 'detect_tags') {
      const { text } = payload;
      const safeText = sanitize(text, 300);
      userMessage = `Analiza el nombre y descripción de esta comida para bebé BLW (~12 meses) e identifica sus tags nutricionales.

Comida: "${safeText}"

Tags posibles:
- iron → contiene carne roja, legumbre o pescado azul (fuentes de hierro)
- fish → contiene pescado (cualquier tipo)
- legume → contiene legumbre (lentejas, garbanzos, judías, guisantes...)
- egg → contiene huevo
- dairy → contiene lácteo (yogur, queso, leche...)
- fruit → contiene fruta
- cereal → contiene cereal (arroz, pasta, pan, avena, quinoa...)
- veggie:nombre → contiene una verdura concreta (ej: veggie:brócoli, veggie:zanahoria). Usa una por cada verdura identificada.

Devuelve SOLO este JSON: {"tags": ["tag1", "tag2"]}
Si no identificas ningún tag con certeza, devuelve {"tags": []}`;

    } else if (type === 'analyze_meal_photo') {
      const { imageBase64, mimeType } = payload;
      if (!imageBase64 || typeof imageBase64 !== 'string' || imageBase64.length > 1_500_000) {
        return {
          statusCode: 400,
          headers: { ...cors, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Imagen no válida o demasiado grande.' }),
        };
      }
      const safeMime = ['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)
        ? mimeType
        : 'image/jpeg';

      const photoMsg = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 512,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: safeMime, data: imageBase64 },
            },
            {
              type: 'text',
              text: `Analiza esta foto de comida para bebé BLW (~12 meses). Identifica el plato e ingredientes principales.

Devuelve SOLO este JSON (sin texto adicional):
{
  "name": "nombre corto del plato (ej: Albóndigas con brócoli y patata)",
  "tags": ["tag1", "tag2"]
}

Reglas para tags (incluye TODOS los que apliquen):
- iron → si hay carne roja, legumbre o pescado azul
- fish → si hay cualquier pescado
- legume → si hay legumbre (lentejas, garbanzos, guisantes...)
- egg → si hay huevo
- dairy → si hay lácteo (yogur, queso, leche)
- fruit → si hay fruta
- cereal → si hay cereal, pasta, arroz, pan, avena
- veggie:nombre → UNA entrada por cada verdura visible (ej: veggie:brócoli, veggie:zanahoria). IMPORTANTE: si ves verdura en el plato, incluye su tag veggie:nombre.

Si no puedes identificar el plato, devuelve name:"" y tags:[].`,
            },
          ],
        }],
      });

      const rawPhoto = photoMsg.content[0].text.trim();
      let photoJson = rawPhoto;
      const photoMatch = rawPhoto.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (photoMatch) photoJson = photoMatch[1].trim();

      let photoResult;
      try {
        photoResult = JSON.parse(photoJson);
      } catch {
        return {
          statusCode: 500,
          headers: { ...cors, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'No se pudo analizar la foto.' }),
        };
      }

      return {
        statusCode: 200,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body: JSON.stringify({ result: photoResult }),
      };
    } else {
      return {
        statusCode: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unknown request type' }),
      };
    }

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    const rawText = message.content[0].text.trim();

    // Extract JSON from potential markdown code blocks
    let jsonText = rawText;
    const jsonMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return {
        statusCode: 500,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Claude returned invalid JSON', raw: rawText }),
      };
    }

    if (posthog && distinctId) {
      posthog.capture({
        distinctId,
        event: 'ai_call_completed',
        properties: {
          call_type: type,
          model: message.model,
          input_tokens: message.usage?.input_tokens,
          output_tokens: message.usage?.output_tokens,
        },
      });
      await posthog.shutdown();
    }

    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ result: parsed }),
    };
  } catch (err) {
    console.error('Claude function error:', err);

    if (posthog && distinctId) {
      let callType = 'unknown';
      try { callType = JSON.parse(event.body).type || 'unknown'; } catch { /* ignore */ }
      posthog.capture({
        distinctId,
        event: 'ai_call_failed',
        properties: {
          call_type: callType,
          error_type: err.constructor?.name || 'Error',
        },
      });
      await posthog.shutdown();
    }

    return {
      statusCode: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Internal server error' }),
    };
  }
};
