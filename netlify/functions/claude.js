import Anthropic from '@anthropic-ai/sdk';
import { PostHog } from 'posthog-node';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0];
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_B64) {
    throw new Error('MISSING_SERVICE_ACCOUNT');
  }
  const serviceAccount = JSON.parse(
    Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf-8')
  );
  return initializeApp({ credential: cert(serviceAccount) });
}

async function verifyToken(authHeader) {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const decoded = await getAuth(getAdminApp()).verifyIdToken(authHeader.slice(7));
  return decoded.uid;
}

async function fetchHousehold(uid) {
  const db = getFirestore(getAdminApp());
  const userSnap = await db.doc(`users/${uid}`).get();
  if (!userSnap.exists) return null;
  const householdId = userSnap.data().householdId;
  if (!householdId) return null;
  const householdSnap = await db.doc(`households/${householdId}`).get();
  if (!householdSnap.exists) return null;
  return { householdId, ...householdSnap.data() };
}

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
- baby: descripción completa de la comida (apta para bebé BLW, la familia come lo mismo)
- babyShort: nombre muy corto para vista de calendario (máx 20 caracteres, solo lo esencial — ej: "Puré de zanahoria", "Salmón con brócoli", "Tortilla de patata")
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
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-POSTHOG-DISTINCT-ID',
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
    // Verify Firebase auth token
    const authHeader = event.headers?.authorization || event.headers?.Authorization;
    let uid;
    try {
      uid = await verifyToken(authHeader);
    } catch (e) {
      if (e.message === 'MISSING_SERVICE_ACCOUNT') {
        return {
          statusCode: 503,
          headers: { ...cors, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'Servidor no configurado: falta FIREBASE_SERVICE_ACCOUNT_B64' }),
        };
      }
      uid = null;
    }
    if (!uid) {
      return {
        statusCode: 401,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No autorizado' }),
      };
    }

    const body = JSON.parse(event.body);
    const { type, payload } = body;

    // validate_ff_code only needs auth, not a household API key
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

    // Fetch household and resolve API key server-side (key never sent from client)
    const household = await fetchHousehold(uid);
    if (!household) {
      return {
        statusCode: 403,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Household no encontrado' }),
      };
    }

    const db = getFirestore(getAdminApp());
    const householdRef = db.doc(`households/${household.householdId}`);
    let resolvedKey;

    if (household.anthropicApiKey) {
      // Personal API key — enforce monthly call limit server-side
      const currentMonth = new Date().toISOString().slice(0, 7);
      const storedMonth = household.aiCallMonth || '';
      const calls = storedMonth === currentMonth ? (household.aiCallsThisMonth || 0) : 0;
      const limit = household.aiCallLimit || null;
      if (limit && calls >= limit) {
        return {
          statusCode: 429,
          headers: { ...cors, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'CALL_LIMIT_EXCEEDED' }),
        };
      }
      await householdRef.update({ aiCallsThisMonth: calls + 1, aiCallMonth: currentMonth });
      resolvedKey = household.anthropicApiKey;
    } else if (household.ffActivated) {
      // Friends & Family quota — enforce server-side
      const used = household.freeCallsUsed || 0;
      if (used >= 30) {
        return {
          statusCode: 429,
          headers: { ...cors, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'FREE_QUOTA_EXCEEDED' }),
        };
      }
      if (!process.env.ANTHROPIC_API_KEY) {
        return {
          statusCode: 503,
          headers: { ...cors, 'Content-Type': 'application/json' },
          body: JSON.stringify({ error: 'NO_API_KEY' }),
        };
      }
      await householdRef.update({ freeCallsUsed: used + 1 });
      resolvedKey = process.env.ANTHROPIC_API_KEY;
    } else {
      return {
        statusCode: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'NO_API_KEY' }),
      };
    }

    const client = new Anthropic({ apiKey: resolvedKey, baseURL: 'https://api.anthropic.com' });

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
      const { availableIngredients, fixedMeals, recurringMeals, mealSlots, foodHistory, savedRecipes, requiredIngredients, kpiOverrides, season, vetoedIngredients, babyProfile, consumedMeals, daysToGenerate, weekVarietyStyle } = payload;

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
      const safeConsumed = Array.isArray(consumedMeals)
        ? consumedMeals.map(m => ({
            day: sanitize(m.day, 10),
            tipo: sanitize(m.tipo, 20),
            text: sanitize(m.text, 200),
          })).filter(m => m.day && m.text)
        : [];
      const safeDaysToGenerate = Array.isArray(daysToGenerate)
        ? daysToGenerate.map(d => sanitize(d, 10)).filter(Boolean)
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

      const consumedSection = safeConsumed.length > 0
        ? `\nComidas YA CONSUMIDAS esta semana (NO las regeneres — úsalas solo como contexto nutricional para cuadrar los KPIs del resto de días):\n${safeConsumed.map(m => `- ${m.day} ${m.tipo}: "${m.text}"`).join('\n')}`
        : '';

      const daysToGenerateSection = safeDaysToGenerate.length > 0
        ? `\nDías a generar (SOLO genera comidas para estos días; para el resto devuelve baby:"", adult:"", tags:[], ingredients:[]): ${safeDaysToGenerate.join(', ')}`
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

      const safeVarietyStyle = ['high', 'balanced', 'optimized'].includes(weekVarietyStyle) ? weekVarietyStyle : 'balanced';
      const varietyStyleSection = safeVarietyStyle === 'high'
        ? '\nVariedad semanal: ALTA — no repitas ningún plato. Excepción: puedes repetir hasta 2 veces un plato de legumbre o guiso si la semana lo requiere nutricionalmente.'
        : safeVarietyStyle === 'optimized'
        ? '\nVariedad semanal: OPTIMIZADA para eficiencia — puedes repetir platos de legumbre o guiso hasta 3 veces a lo largo de la semana. Puedes repetir otros platos hasta 2 veces. Varía siempre las verduras, guarniciones y métodos de cocción para evitar monotonía.'
        : '\nVariedad semanal: EQUILIBRADA (default) — puedes repetir platos de legumbre o guiso hasta 2 veces. No repitas platos de huevo o pescado.';

      userMessage = `Genera un menú completo para 7 días para: ${babyContext}.
${ingredientsSection}${recurringSection}${fixedSection}${slotsSection}${seasonSection}${kpiSection}${vetoedSection}${consumedSection}${daysToGenerateSection}${varietyStyleSection}

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
          "babyShort": "nombre corto",
          "ingredients": ["ingrediente1", "ingrediente2"],
          "tags": ["tag1", "tag2"],
          "repeatability_score": "high"
        },
        { "tipo": "snack", ... },
        { "tipo": "comida", ... },
        { "tipo": "merienda", ... },
        { "tipo": "cena", ... }
      ]
    },
    ... (7 días: Lun, Mar, Mié, Jue, Vie, Sáb, Dom)
  ]
}

El campo "ingredients" debe contener la lista de ingredientes principales en crudo (nombres simples, sin preparación): p.ej. para "tortilla de patata con calabacín" → ["huevo", "patata", "calabacín"].

El campo "repeatability_score" indica si la receta es buena candidata para batch cooking (preparar en lote y reutilizar varios días):
- "high" → ideal para lote: legumbres, guisos, estofados, cremas, sopas (aguantan bien en nevera y recalientan bien)
- "medium" → aceptable: pasta, arroz, platos de cereal con verdura
- "low" → no apto para lote: huevo (tortilla, revuelto), pescado fresco, platos que no aguantan o no recalientan bien`;
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
    { "tipo": "desayuno", "baby": "...", "babyShort": "...", "ingredients": ["ing1", "ing2"], "tags": [...], "repeatability_score": "low" },
    { "tipo": "snack", "baby": "...", "babyShort": "...", "ingredients": ["ing1", "ing2"], "tags": [...], "repeatability_score": "low" },
    { "tipo": "comida", "baby": "...", "babyShort": "...", "ingredients": ["ing1", "ing2"], "tags": [...], "repeatability_score": "high" },
    { "tipo": "merienda", "baby": "...", "babyShort": "...", "ingredients": ["ing1", "ing2"], "tags": [...], "repeatability_score": "low" },
    { "tipo": "cena", "baby": "...", "babyShort": "...", "ingredients": ["ing1", "ing2"], "tags": [...], "repeatability_score": "medium" }
  ]
}

El campo "ingredients" debe contener la lista de ingredientes principales en crudo (nombres simples, sin preparación).
El campo "repeatability_score": "high" para legumbres/guisos, "medium" para cereales/arroz/pasta, "low" para huevo/pescado/fruta.`;
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
  "babyShort": "nombre corto",
  "ingredients": ["ingrediente1", "ingrediente2"],
  "tags": ["tag1", "tag2"]
}

El campo "ingredients" debe contener la lista de ingredientes principales en crudo (nombres simples, sin preparación).`;
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
  "babyShort": "nombre corto",
  "ingredients": ["ingrediente1", "ingrediente2"],
  "tags": ["tag1", "tag2"]
}

El campo "ingredients" debe contener la lista de ingredientes principales en crudo (nombres simples, sin preparación).`;
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
        const compliant = kpiState.compliant ?? 0;
        const total = kpiState.total ?? 7;
        const missingDays = Array.isArray(kpiState.missingDays) ? kpiState.missingDays.map(d => sanitize(d, 10)) : [];
        kpiDescription = `Hierro (objetivo: 1 comida con hierro cada día): actualmente ${compliant}/${total} días tienen hierro.${missingDays.length ? ` Días sin hierro: ${missingDays.join(', ')}.` : ''} Modifica una comida en cada uno de esos días para incluir hierro (carne roja, legumbre o pescado azul). Prioriza las franjas comida o cena de esos días.`;
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
    } else if (type === 'generate_meal_prep') {
      const { weekMenu, prepWindows, maxResolvedUses } = payload;

      const safeWeekMenu = Array.isArray(weekMenu)
        ? weekMenu.map(day => ({
            day: sanitize(day.day, 10),
            meals: Array.isArray(day.meals)
              ? day.meals
                  .filter(m => m.baby)
                  .map(m => ({
                    tipo: sanitize(m.tipo, 20),
                    baby: sanitize(m.baby, 300),
                    tags: Array.isArray(m.tags) ? m.tags.map(t => sanitize(t, 30)) : [],
                    repeatability_score: ['high', 'medium', 'low'].includes(m.repeatability_score) ? m.repeatability_score : 'medium',
                  }))
              : [],
          }))
        : [];

      const safePrepWindows = Array.isArray(prepWindows)
        ? prepWindows
            .filter(w => w.day && w.durationMinutes)
            .map(w => ({
              day: sanitize(w.day, 20),
              durationMinutes: Math.min(Math.max(parseInt(w.durationMinutes) || 60, 15), 300),
            }))
        : [];

      const safeMaxResolvedUses = [2, 3].includes(Number(maxResolvedUses)) ? Number(maxResolvedUses) : 3;

      const prepWindowsDesc = safePrepWindows.length > 0
        ? safePrepWindows.map(w => `- ${w.day}: ${w.durationMinutes} minutos disponibles`).join('\n')
        : '- Sin ventanas definidas: crea una única sesión "inicio_semana" sin límite de tiempo.';

      userMessage = `Eres un planificador de meal prep para bebé BLW ~12 meses y familia.

Analiza el siguiente menú semanal y crea un plan de preparación anticipada que optimice el tiempo en la cocina.

Menú semanal:
${JSON.stringify(safeWeekMenu, null, 2)}

Ventanas de preparación:
${prepWindowsDesc}
Máx. usos por comida resuelta: ${safeMaxResolvedUses}

CONCEPTOS:
- Comida resuelta (resolved_meal): receta que se cocina UNA VEZ en lote y cubre varios slots del MISMO tipo (comida→comida, cena→cena). Ideal cuando repeatability_score es "high": legumbres, guisos, cremas, estofados.
- Acelerador (accelerator): ingrediente base precocinado que reduce el tiempo de preparación de futuras comidas. Ejemplos: patatas cocidas → tortilla o puré; arroz cocido → salteados; verduras asadas → múltiples cenas; proteína cocida → ensaladas o wok.

REGLAS ESTRICTAS:
1. Comidas resueltas: solo repeatability_score "high" o "medium". Max ${safeMaxResolvedUses} slots del mismo tipo (comida→comida, cena→cena). Respeta siempre daysFresh (lentejas/garbanzos=4, guiso carne=3, pescado=2, verdura=3, arroz=3).
2. Aceleradores: detecta ingredientes base que aparecen en 2+ comidas distintas de la semana. Solo incluye si el ahorro de tiempo es real.
3. No dupliques: si un plato ya es comida resuelta, no crees aceleradores para sus ingredientes principales.
4. Solo preparaciones con cocción activa: NO incluyas yogur, fruta fresca, queso, pan, leche u otros que se consumen sin cocinar.
5. Sesiones: distribuye las tareas en las ventanas sin superar su duración. Prioriza tareas de mayor impacto (más slots cubiertos). Si no hay ventanas, id de sesión "s_inicio", day "inicio_semana", durationMinutes null.
6. mealBadges debe cubrir TODOS los slots que se benefician del plan (resolved o accelerated). Los slots sin badge son "normal".

Devuelve SOLO este JSON (sin texto adicional):
{
  "sessions": [
    {
      "id": "s1",
      "day": "Lun",
      "durationMinutes": 45,
      "tasks": [
        {
          "id": "t1",
          "type": "resolved_meal",
          "name": "Lentejas con verduras",
          "durationMinutes": 25,
          "outputServings": 3,
          "daysFresh": 4,
          "impactedSlots": [
            { "day": "Lun", "tipo": "comida" },
            { "day": "Mar", "tipo": "comida" }
          ],
          "minutesSaved": 25
        },
        {
          "id": "t2",
          "type": "accelerator",
          "name": "Patatas cocidas",
          "durationMinutes": 20,
          "outputUses": 2,
          "daysFresh": 4,
          "impactedSlots": [
            { "day": "Mar", "tipo": "cena" },
            { "day": "Jue", "tipo": "cena" }
          ],
          "minutesSaved": 15
        }
      ]
    }
  ],
  "mealBadges": [
    { "day": "Lun", "tipo": "comida", "badge": "resolved", "taskId": "t1" },
    { "day": "Mar", "tipo": "comida", "badge": "resolved", "taskId": "t1" },
    { "day": "Mar", "tipo": "cena", "badge": "accelerated", "taskId": "t2" },
    { "day": "Jue", "tipo": "cena", "badge": "accelerated", "taskId": "t2" }
  ],
  "summary": {
    "resolvedCount": 2,
    "acceleratedCount": 2,
    "totalMinutesSaved": 55,
    "sessionCount": 1
  }
}`;

    } else if (type === 'propose_meal') {
      const { slotId, dateStr, inventoryItems, braindump, todaySlots, weeklyKpis, pantryItems, timeOfDay, priorityKpi } = payload;

      const SLOT_LABELS_ES = { comida: 'comida', cena: 'cena', desayuno: 'desayuno', snack: 'snack', merienda: 'merienda' };
      const safeSlot = SLOT_LABELS_ES[sanitize(slotId, 20)] || 'comida';
      const safeDateStr = sanitize(dateStr, 12);
      const safeBraindump = sanitize(braindump, 200);

      // Limit to 15 most relevant items (expiring soonest first, then others)
      const safeItems = Array.isArray(inventoryItems)
        ? inventoryItems
            .slice(0, 15)
            .map(item => ({
              id: sanitize(item.id, 50),
              name: sanitize(item.name, 100),
              type: sanitize(item.type, 30),
              adultPortions: Math.max(0, parseInt(item.adultPortions) || 0),
              babyPortions: Math.max(0, parseInt(item.babyPortions) || 0),
              daysLeft: item.daysLeft != null ? Math.max(0, parseInt(item.daysLeft) || 0) : null,
              tags: Array.isArray(item.tags) ? item.tags.map(t => sanitize(t, 30)).filter(Boolean) : [],
            }))
        : [];

      const inventoryLines = safeItems.length > 0
        ? safeItems.map(i => {
            const freshness = i.daysLeft != null ? `, ${i.daysLeft}d frescura` : '';
            const portions = (i.type === 'ya-preparado' || i.type === 'acelerador')
              ? `, ${i.adultPortions}r adulto / ${i.babyPortions}r bebé`
              : '';
            const tags = i.tags.length ? `, tags: ${i.tags.join(',')}` : '';
            return `- [${i.id}] ${i.name} (${i.type})${portions}${freshness}${tags}`;
          }).join('\n')
        : '- (inventario vacío)';

      // Build today's planned slots context
      const safeSlots = todaySlots && typeof todaySlots === 'object' ? todaySlots : {};
      const slotLines = Object.entries(safeSlots)
        .filter(([sid]) => sid !== safeSlot)
        .map(([sid, slot]) => {
          const items = Array.isArray(slot?.items) ? slot.items : [];
          if (items.length === 0) return null;
          const confirmed = slot?.confirmedAt ? ' ✓' : '';
          const names = items.map(i => sanitize(i.label, 100)).join(', ');
          const tags = items.flatMap(i => Array.isArray(i.tags) ? i.tags.map(t => sanitize(t, 30)) : []);
          const tagStr = tags.length ? ` [${tags.join(',')}]` : '';
          return `- ${sid}${confirmed}: ${names}${tagStr}`;
        })
        .filter(Boolean);
      const slotsContext = slotLines.length > 0 ? slotLines.join('\n') : '(ningún otro slot planificado hoy)';

      // For cena: build confirmed-only context for day gap analysis
      const isCena = safeSlot === 'cena';
      const confirmedSlotLines = isCena
        ? Object.entries(safeSlots)
            .filter(([sid, slot]) => sid !== 'cena' && slot?.confirmedAt && Array.isArray(slot?.items) && slot.items.length > 0)
            .map(([sid, slot]) => {
              const names = slot.items.map(i => sanitize(i.label, 100)).join(', ');
              const tags = slot.items.flatMap(i => Array.isArray(i.tags) ? i.tags.map(t => sanitize(t, 30)) : []);
              const tagStr = tags.length ? ` [${tags.join(',')}]` : '';
              return `- ${sid}: ${names}${tagStr}`;
            })
        : [];

      // KPI context
      const kpi = weeklyKpis || {};
      const ironDays = parseInt(kpi.ironDays) || 0;
      const fishDays = parseInt(kpi.fishDays) || 0;
      const legumedDays = parseInt(kpi.legumedDays) || 0;
      const distinctVeggies = parseInt(kpi.distinctVeggies) || 0;
      const veggieList = Array.isArray(kpi.veggieList) ? kpi.veggieList.map(v => sanitize(v, 30)).join(', ') : '';

      const dayGapsSection = isCena ? `
Slots confirmados hoy (para analizar qué falta nutricionalmente en el día):
${confirmedSlotLines.length > 0 ? confirmedSlotLines.join('\n') : '(ningún slot confirmado aún)'}

ANÁLISIS DE GAPS DEL DÍA (solo para cena):
Antes de las propuestas, analiza qué grupos nutricionales faltan o están poco representados en los slots confirmados de hoy. Genera una frase corta, concreta y sin juicio. Ejemplos: "Falta una fuente de carbs y una verdura nueva", "El día tiene poca proteína vegetal", "Bien cubierto, la cena puede ser ligera". Máximo 12 palabras. Si el día está bien equilibrado, dilo brevemente.` : '';

      const safePantry = Array.isArray(pantryItems)
        ? pantryItems.map(i => sanitize(i, 100)).filter(Boolean).slice(0, 30)
        : [];
      const pantryLine = safePantry.length > 0
        ? `\nDespensa base (siempre disponible, usa source "despensa"):\n${safePantry.join(', ')}`
        : '';

      const safeTimeOfDay = ['mañana', 'tarde', 'noche'].includes(sanitize(timeOfDay, 10))
        ? sanitize(timeOfDay, 10) : null;
      const timeContext = safeTimeOfDay
        ? `\nHora del día: ${safeTimeOfDay}. ${safeTimeOfDay === 'noche' ? 'Prioriza opciones rápidas de preparar y ligeras.' : safeTimeOfDay === 'mañana' ? 'Puedes proponer preparaciones más elaboradas si el inventario lo permite.' : ''}`
        : '';

      const KPI_PRIORITY_MAP = {
        iron:   { label: 'hierro',            tags: 'iron', hint: 'carne roja, legumbre o pescado azul' },
        fish:   { label: 'pescado azul',       tags: 'oily_fish', hint: 'salmón, caballa, sardina, atún o boquerón' },
        legume: { label: 'legumbre',           tags: 'legume', hint: 'lentejas, garbanzos, judías o guisantes' },
        veggie: { label: 'variedad de verduras', tags: 'veggie:*', hint: 'verduras distintas a las ya usadas esta semana' },
        fruit:  { label: 'fruta',              tags: 'fruit', hint: 'cualquier fruta' },
      };
      const kpiPriorityDef = KPI_PRIORITY_MAP[sanitize(priorityKpi, 10)];
      const priorityInstruction = kpiPriorityDef
        ? `\nPRIORIDAD MÁXIMA: El usuario quiere cubrir el KPI de ${kpiPriorityDef.label} hoy. Al menos 2 de las 3 propuestas deben incluir ${kpiPriorityDef.hint} y llevar el tag correspondiente.`
        : '';

      userMessage = `Propón exactamente 3 opciones concretas para la ${safeSlot} del día ${safeDateStr || 'hoy'} en una familia BLW.

Inventario disponible (usa el id para referenciarlo):
${inventoryLines}

Ingredientes extra que el usuario menciona (sin registrar en inventario):
${safeBraindump || 'ninguno'}${pantryLine}

Otros slots planificados hoy (✓ = confirmado):
${slotsContext}

Estado nutricional de la semana (hits confirmados hasta ahora):
- Hierro: ${ironDays} días esta semana
- Pescado azul: ${fishDays} días esta semana
- Legumbre: ${legumedDays} días esta semana
- Verduras distintas: ${distinctVeggies}${veggieList ? ` (${veggieList})` : ''}
${dayGapsSection}
INSTRUCCIONES:
1. Prioriza usar ingredientes del inventario disponible.
2. Cada opción debe complementar nutricionalmente lo ya planificado hoy.
3. Si algún KPI está bajo (hierro < 3, pescado < 2, legumbre < 2, verduras < 3), cubre uno con alguna de las opciones.
4. Las opciones deben ser variadas entre sí (no 3 variantes del mismo plato).
5. Para ingredients, usa "stock" solo si el ingrediente está en el inventario disponible e incluye su inventoryId.${timeContext}${priorityInstruction}

Devuelve SOLO este JSON:
{
  ${isCena ? '"dayGaps": "Falta una fuente de carbs y una verdura nueva",' : '"dayGaps": null,'}
  "proposals": [
    {
      "name": "Lentejas con zanahoria y arroz",
      "description": "Calentar el batch de lentejas. Añadir zanahoria al vapor.",
      "prepType": "ya-preparado",
      "prepTime": "5 min",
      "adultPortions": 2,
      "babyPortions": 1,
      "ingredients": [
        {"name": "Lentejas", "source": "stock", "inventoryId": "abc123"},
        {"name": "Zanahoria", "source": "despensa"},
        {"name": "Arroz", "source": "despensa"}
      ],
      "tags": ["legume", "iron", "veggie:zanahoria"],
      "kpiBoost": "legume"
    }
  ]
}

prepType debe ser: "ya-preparado" | "acelerador" | "justo-antes"
source debe ser: "stock" (en inventario) | "despensa" (despensa base, siempre disponible) | "compra" (habría que comprar)
kpiBoost: "legume" | "fish" | "iron" | "veggie" | null`;

    } else if (type === 'suggest_shopping') {
      const { inventoryItems, weeklyKpis, expiringItems, floatingItems, pantryItems } = payload;

      const safeItems = Array.isArray(inventoryItems)
        ? inventoryItems.slice(0, 20).map(item => ({
            name: sanitize(item.name, 100),
            type: sanitize(item.type, 30),
            daysLeft: item.daysLeft != null ? Math.max(0, parseInt(item.daysLeft) || 0) : null,
            tags: Array.isArray(item.tags) ? item.tags.map(t => sanitize(t, 30)).filter(Boolean) : [],
          }))
        : [];

      const safeExpiring = Array.isArray(expiringItems)
        ? expiringItems.slice(0, 5).map(i => ({
            name: sanitize(i.name, 100),
            daysLeft: i.daysLeft != null ? Math.max(0, parseInt(i.daysLeft) || 0) : null,
          }))
        : [];

      const safeFloating = Array.isArray(floatingItems)
        ? floatingItems.slice(0, 5).map(i => ({ name: sanitize(i.name, 100) }))
        : [];

      const kpi = weeklyKpis && typeof weeklyKpis === 'object' ? weeklyKpis : {};
      const ironDays = Math.max(0, parseInt(kpi.ironDays) || 0);
      const fishDays = Math.max(0, parseInt(kpi.fishDays) || 0);
      const legumedDays = Math.max(0, parseInt(kpi.legumedDays) || 0);
      const distinctVeggies = Math.max(0, parseInt(kpi.distinctVeggies) || 0);
      const veggieList = Array.isArray(kpi.veggieList) ? kpi.veggieList.map(v => sanitize(v, 30)).join(', ') : '';

      const today = new Date();
      const dayOfWeek = today.getDay(); // 0=Dom, 1=Lun...
      const daysLeftInWeek = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
      const DAY_NAMES_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      const todayName = DAY_NAMES_ES[dayOfWeek];

      const inventoryLines = safeItems.length > 0
        ? safeItems.map(i => {
            const freshness = i.daysLeft != null ? ` (${i.daysLeft}d)` : '';
            const tags = i.tags.length ? ` [${i.tags.join(',')}]` : '';
            return `- ${i.name} (${i.type})${freshness}${tags}`;
          }).join('\n')
        : '- (inventario vacío)';

      const expiringLines = safeExpiring.length > 0
        ? safeExpiring.map(i => `- ${i.name} (caduca en ${i.daysLeft ?? '?'} día${i.daysLeft !== 1 ? 's' : ''})`).join('\n')
        : 'ninguno';

      const floatingLines = safeFloating.length > 0
        ? safeFloating.map(i => `- ${i.name}`).join('\n')
        : 'ninguno';

      const safePantryShop = Array.isArray(pantryItems)
        ? pantryItems.map(i => sanitize(i, 100)).filter(Boolean).slice(0, 30)
        : [];
      const pantryLineShop = safePantryShop.length > 0
        ? `\nDespensa base (ya en casa, no sugerir comprar):\n${safePantryShop.join(', ')}`
        : '';

      userMessage = `Eres un asistente de logística culinaria para familias BLW. El usuario va a hacer la compra ahora.

Hoy es ${todayName}. Quedan ${daysLeftInWeek} días en la semana actual. El horizonte de compra son los próximos 3 días.

Estado nutricional de la semana hasta ahora:
- Hierro: ${ironDays} días (objetivo: ≥5 días/semana)
- Pescado azul: ${fishDays} veces (objetivo: ≥3 veces/semana)
- Legumbres: ${legumedDays} días (objetivo: ≥3 días/semana)
- Verduras distintas: ${distinctVeggies}${veggieList ? ` (${veggieList})` : ''} (objetivo: ≥5 tipos/semana)

Inventario actual en casa:
${inventoryLines}${pantryLineShop}

Items que caducan pronto (urgente usarlos, no hace falta comprar más):
${expiringLines}

Ingredientes flotantes sin plan:
${floatingLines}

INSTRUCCIONES:
1. Calcula los gaps nutricionales reales para los próximos 3 días teniendo en cuenta lo que queda de semana.
2. Solo sugiere comprar lo que realmente falta. No repitas categorías ya bien cubiertas.
3. Para cada categoría: indica POR QUÉ hace falta (menciona el número actual vs objetivo) y da 2-3 ejemplos concretos y fáciles de encontrar en un supermercado español.
4. Los items que ya están en el inventario vigente NO son necesarios comprar.
5. Si los KPIs están bien cubiertos para los días restantes, devuelve categories vacío o con solo pantry (reposición básica).
6. Prioridad "alta" = gap crítico (objetivo no alcanzable sin comprar). Prioridad "media" = recomendable.

Devuelve SOLO este JSON:
{
  "categories": [
    {
      "id": "fish",
      "emoji": "🐟",
      "label": "Pescado azul",
      "priority": "alta",
      "why": "solo ${fishDays} vez esta semana, objetivo 3",
      "items": ["salmón", "caballa", "sardinas en lata"]
    }
  ]
}

IDs válidos: "fish", "iron", "legume", "veggie", "fruit", "pantry"
priority válidos: "alta", "media"
Máximo 5 categories. Si no hay gaps, devuelve {"categories": []}`;

    } else if (type === 'resolve_floating') {
      const { floatingItem, inventoryItems, weeklyKpis, pantryItems } = payload;
      const safeName = sanitize(floatingItem?.name, 100);
      const safeAmount = sanitize(floatingItem?.amount, 50);

      const safeItems = Array.isArray(inventoryItems)
        ? inventoryItems.slice(0, 15).map(item => ({
            id: sanitize(item.id, 50),
            name: sanitize(item.name, 100),
            type: sanitize(item.type, 30),
            adultPortions: Math.max(0, parseInt(item.adultPortions) || 0),
            babyPortions: Math.max(0, parseInt(item.babyPortions) || 0),
            daysLeft: item.daysLeft != null ? Math.max(0, parseInt(item.daysLeft) || 0) : null,
            tags: Array.isArray(item.tags) ? item.tags.map(t => sanitize(t, 30)).filter(Boolean) : [],
          }))
        : [];

      const kpi = weeklyKpis || {};
      const kpiCtx = `Hierro: ${parseInt(kpi.ironDays) || 0} días · Pescado azul: ${parseInt(kpi.fishDays) || 0} días · Legumbre: ${parseInt(kpi.legumedDays) || 0} días · Verduras distintas: ${parseInt(kpi.distinctVeggies) || 0}`;

      const inventoryLines = safeItems.length > 0
        ? safeItems.map(i => {
            const freshness = i.daysLeft != null ? `, ${i.daysLeft}d` : '';
            const portions = (i.type === 'ya-preparado' || i.type === 'acelerador') ? `, ${i.adultPortions}r adulto/${i.babyPortions}r bebé` : '';
            return `- [${i.id}] ${i.name} (${i.type})${portions}${freshness}`;
          }).join('\n')
        : '- (inventario vacío)';

      const safePantryFloat = Array.isArray(pantryItems)
        ? pantryItems.map(i => sanitize(i, 100)).filter(Boolean).slice(0, 30)
        : [];
      const pantryLineFloat = safePantryFloat.length > 0
        ? `\nDespensa base disponible (usa source "despensa"): ${safePantryFloat.join(', ')}`
        : '';

      userMessage = `El usuario tiene un ingrediente sin plan: "${safeName}"${safeAmount ? ` (${safeAmount})` : ''}.
Propón exactamente 3 formas de cocinarlo o usarlo, pensando en una familia BLW con bebé ~12 meses.

Inventario disponible actualmente:
${inventoryLines}${pantryLineFloat}

Estado nutricional de la semana: ${kpiCtx}

INSTRUCCIONES:
1. Varía los tipos: al menos una opción batch (cocinas una vez, comes varios días) y al menos una justo-antes (resuelves una comida rápido).
2. Para cada opción, marca los ingredientes extra necesarios: "stock" si está en inventario (usa su id), "despensa" si es básico de cocina, "compra" si habría que comprarlo.
3. Prioriza las opciones que cubran gaps nutricionales de la semana.
4. Todas las opciones deben ser aptas para BLW (bebé ~12 meses y familia comen lo mismo).

Devuelve SOLO este JSON:
{
  "proposals": [
    {
      "name": "Albóndigas de ternera",
      "description": "Mezclar con pan rallado, huevo y perejil. Hornear 20 min a 180°.",
      "prepType": "ya-preparado",
      "prepTime": "30 min",
      "adultPortions": 3,
      "babyPortions": 2,
      "ingredients": [
        {"name": "Carne picada", "source": "stock", "inventoryId": "flotante-id"},
        {"name": "Huevo", "source": "despensa"},
        {"name": "Pan rallado", "source": "despensa"}
      ],
      "tags": ["iron"],
      "kpiBoost": "iron"
    }
  ]
}
prepType: "ya-preparado" | "acelerador" | "snack-batch" | "justo-antes"
source: "stock" | "despensa" | "compra"
kpiBoost: "legume" | "fish" | "iron" | "veggie" | null`;

    } else if (type === 'suggest_snack') {
      const { recentSnacks, inventoryItems, pantryItems } = payload;
      const safeRecent = Array.isArray(recentSnacks)
        ? recentSnacks.map(s => sanitize(s, 100)).filter(Boolean)
        : [];
      const safeItems = Array.isArray(inventoryItems)
        ? inventoryItems.slice(0, 15).map(i => ({
            id: sanitize(i.id, 50),
            name: sanitize(i.name, 100),
            type: sanitize(i.type, 30),
            daysLeft: i.daysLeft != null ? Math.max(0, parseInt(i.daysLeft) || 0) : null,
          }))
        : [];

      const inventoryLines = safeItems.length > 0
        ? safeItems.map(i => `- [${i.id}] ${i.name} (${i.type})${i.daysLeft != null ? `, ${i.daysLeft}d` : ''}`).join('\n')
        : '- (inventario vacío)';

      const recentNote = safeRecent.length > 0
        ? `\nÚltimos snacks hechos (NO repetir ni algo muy similar): ${safeRecent.join(', ')}`
        : '';

      const safePantrySnack = Array.isArray(pantryItems)
        ? pantryItems.map(i => sanitize(i, 100)).filter(Boolean).slice(0, 30)
        : [];
      const pantryLineSnack = safePantrySnack.length > 0
        ? `\nDespensa base disponible: ${safePantrySnack.join(', ')}`
        : '';

      userMessage = `El stock de snacks está agotándose. Propón exactamente 3 opciones de snack batch para bebé BLW (~12 meses) y familia.

Inventario actual:
${inventoryLines}${pantryLineSnack}
${recentNote}

INSTRUCCIONES:
1. Las opciones deben ser distintas entre sí y distintas a los últimos snacks.
2. Prioriza lo que se puede hacer con ingredientes de despensa básica (harina, avena, huevo, plátano, zanahoria, manzana…).
3. Incluye el número de unidades que genera cada preparación en "unitsGenerated".
4. Snacks aptos para BLW: sin sal, sin azúcar añadida (máx miel si el bebé tiene más de 12 meses), textura que permita agarrar.

Devuelve SOLO este JSON:
{
  "proposals": [
    {
      "name": "Muffins de zanahoria y avena",
      "description": "Mezclar avena, zanahoria rallada, huevo y plátano. Hornear 20 min a 180°.",
      "prepType": "snack-batch",
      "prepTime": "30 min",
      "unitsGenerated": 12,
      "adultPortions": 0,
      "babyPortions": 0,
      "ingredients": [
        {"name": "Avena", "source": "despensa"},
        {"name": "Zanahoria", "source": "despensa"},
        {"name": "Huevo", "source": "despensa"},
        {"name": "Plátano", "source": "despensa"}
      ],
      "tags": ["fruit", "cereal", "veggie:zanahoria"],
      "kpiBoost": null
    }
  ]
}`;

    } else if (type === 'cooking_time_suggestions') {
      const { minutes, inventoryItems, weeklyKpis, recentPreps, pantryItems } = payload;
      const VALID_MINUTES = [15, 30, 60, 'más'];
      const safeMinutes = VALID_MINUTES.includes(minutes) ? minutes : 30;

      const safeItems = Array.isArray(inventoryItems)
        ? inventoryItems.slice(0, 15).map(item => ({
            id: sanitize(item.id, 50),
            name: sanitize(item.name, 100),
            type: sanitize(item.type, 30),
            adultPortions: Math.max(0, parseInt(item.adultPortions) || 0),
            babyPortions: Math.max(0, parseInt(item.babyPortions) || 0),
            daysLeft: item.daysLeft != null ? Math.max(0, parseInt(item.daysLeft) || 0) : null,
            tags: Array.isArray(item.tags) ? item.tags.map(t => sanitize(t, 30)).filter(Boolean) : [],
          }))
        : [];

      const safeRecent = Array.isArray(recentPreps)
        ? recentPreps.map(r => sanitize(r, 100)).filter(Boolean)
        : [];

      const kpi = weeklyKpis || {};
      const ironDays = parseInt(kpi.ironDays) || 0;
      const fishDays = parseInt(kpi.fishDays) || 0;
      const legumedDays = parseInt(kpi.legumedDays) || 0;
      const distinctVeggies = parseInt(kpi.distinctVeggies) || 0;

      const gaps = [];
      if (ironDays < 3) gaps.push('hierro (faltan días con carne roja, legumbre o pescado azul)');
      if (fishDays < 2) gaps.push('pescado azul');
      if (legumedDays < 2) gaps.push('legumbre');
      if (distinctVeggies < 3) gaps.push(`variedad de verduras (solo ${distinctVeggies} distintas esta semana)`);
      const gapText = gaps.length > 0 ? `KPIs bajos esta semana: ${gaps.join(', ')}.` : 'KPIs en buen estado esta semana.';

      const inventoryLines = safeItems.length > 0
        ? safeItems.map(i => {
            const freshness = i.daysLeft != null ? `, ${i.daysLeft}d` : '';
            const portions = (i.type === 'ya-preparado' || i.type === 'acelerador') ? `, ${i.adultPortions}r adulto/${i.babyPortions}r bebé` : '';
            return `- [${i.id}] ${i.name} (${i.type})${portions}${freshness}`;
          }).join('\n')
        : '- (inventario vacío)';

      const recentNote = safeRecent.length > 0 ? `\nPreparaciones recientes (evita repetir): ${safeRecent.join(', ')}` : '';

      const timeLabel = safeMinutes === 'más' ? 'más de 1 hora' : `${safeMinutes} minutos`;

      const safePantryCook = Array.isArray(pantryItems)
        ? pantryItems.map(i => sanitize(i, 100)).filter(Boolean).slice(0, 30)
        : [];
      const pantryLineCook = safePantryCook.length > 0
        ? `\nDespensa base disponible: ${safePantryCook.join(', ')}`
        : '';

      userMessage = `El usuario tiene ${timeLabel} disponibles para cocinar. Propón exactamente 3 preparaciones que sean más útiles para la semana.

${gapText}

Inventario actual:
${inventoryLines}${pantryLineCook}
${recentNote}

INSTRUCCIONES:
1. Ordena las opciones por impacto: primero las que cubren más gaps nutricionales y más slots de comida.
2. Solo propón preparaciones que se puedan hacer en ${timeLabel} o menos.
3. Prioriza batch cooking cuando tiene sentido (legumbres, guisos, cremas que duran varios días).
4. Varía las opciones: no 3 variantes del mismo tipo.
5. Todas deben ser aptas para BLW (bebé ~12 meses y familia).

Devuelve SOLO este JSON:
{
  "proposals": [
    {
      "name": "Lentejas con verduras",
      "description": "Guiso de lentejas con zanahoria, puerro y tomate. Rinde para 3 comidas.",
      "prepType": "ya-preparado",
      "prepTime": "25 min",
      "adultPortions": 3,
      "babyPortions": 2,
      "ingredients": [
        {"name": "Lentejas", "source": "despensa"},
        {"name": "Zanahoria", "source": "despensa"},
        {"name": "Tomate", "source": "despensa"}
      ],
      "tags": ["legume", "iron", "veggie:zanahoria"],
      "kpiBoost": "legume"
    }
  ]
}
prepType: "ya-preparado" | "acelerador" | "snack-batch" | "justo-antes"
kpiBoost: "legume" | "fish" | "iron" | "veggie" | null`;

    } else if (type === 'generate_recipe') {
      const { prepName, prepType, ingredients, adultPortions, babyPortions } = payload;
      const safeName = sanitize(prepName, 100);
      const safePrepType = sanitize(prepType, 30);
      const safeIngredients = Array.isArray(ingredients)
        ? ingredients.map(i => ({
            name: sanitize(i.name, 100),
            source: sanitize(i.source, 20),
          }))
        : [];
      const safeAdult = Math.max(0, parseInt(adultPortions) || 2);
      const safeBaby = Math.max(0, parseInt(babyPortions) || 1);

      const ingredientsList = safeIngredients.map(i => `- ${i.name}`).join('\n');

      userMessage = `Genera los pasos de preparación para: "${safeName}" (tipo: ${safePrepType}).
Para ${safeAdult} raciones adulto y ${safeBaby} raciones bebé BLW (~12 meses).

Ingredientes:
${ingredientsList || '- (no especificados)'}

INSTRUCCIONES:
1. Pasos concretos y breves, en orden. Máximo 8 pasos.
2. Indica cantidades aproximadas cuando sea útil (ej: "200g de lentejas").
3. Menciona el formato BLW cuando aplique (trozos grandes para agarrar, sin triturar).
4. Si hay notas importantes (conservación, variantes, temperatura de servicio), inclúyelas en "notes".
5. Sin sal añadida en la versión bebé.

Devuelve SOLO este JSON:
{
  "steps": [
    "Cocer las lentejas en agua sin sal durante 20 minutos hasta que estén tiernas.",
    "Sofreír la cebolla y el ajo en aceite de oliva a fuego medio.",
    "Añadir la zanahoria cortada en dados y rehogar 5 minutos.",
    "Incorporar las lentejas cocidas y el tomate triturado. Cocinar 10 minutos más.",
    "Servir al bebé en trozos o en cuchara. Los adultos añaden sal al gusto."
  ],
  "notes": "Aguanta 4 días en nevera. Se puede congelar en porciones."
}`;

    } else if (type === 'recipe_chat') {
      const { recipe, question, inventoryItems } = payload;
      const safeQuestion = sanitize(question, 300);
      const safeSteps = Array.isArray(recipe?.steps)
        ? recipe.steps.map((s, i) => `${i + 1}. ${sanitize(s, 200)}`).join('\n')
        : '';
      const safeNotes = recipe?.notes ? sanitize(recipe.notes, 200) : '';
      const safeName = sanitize(recipe?.name, 100);
      const safeInventory = Array.isArray(inventoryItems)
        ? inventoryItems.slice(0, 10).map(i => sanitize(i.name, 80)).filter(Boolean).join(', ')
        : '';

      userMessage = `El usuario está preparando "${safeName}" y tiene esta receta:

${safeSteps}
${safeNotes ? `\nNotas: ${safeNotes}` : ''}

Inventario disponible del usuario: ${safeInventory || '(no especificado)'}

El usuario pregunta: "${safeQuestion}"

Responde de forma concreta y directa, en el contexto de esta receta específica. Si la pregunta involucra un ingrediente del inventario, dile exactamente cómo incorporarlo (cantidad, en qué paso, qué cambia). Si no es posible o no tiene sentido, explica por qué brevemente.

Devuelve SOLO este JSON:
{
  "answer": "Sí, puedes añadir el boniato. Córtalo en dados de 1-2cm y añádelo en el paso 3 junto con la zanahoria. Necesitará unos 8-10 minutos de cocción. El resultado será más dulce y cremoso."
}`;

    } else {
      return {
        statusCode: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Unknown request type' }),
      };
    }

    const maxTokens = ['generate_week', 'regenerate_day'].includes(type) ? 8192 : 4096;

    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: maxTokens,
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

    // Ensure dayGaps is always string | null — never an object
    if (parsed && typeof parsed === 'object' && 'dayGaps' in parsed) {
      if (typeof parsed.dayGaps !== 'string') parsed.dayGaps = null;
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
