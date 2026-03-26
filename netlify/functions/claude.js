import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `Eres un asistente de nutrición infantil especializado en BLW (Baby-Led Weaning).
Planificas comidas para un bebé de ~12 meses y su familia (los adultos comen lo mismo, añadiendo sal y condimentos ellos mismos).

Reglas BLW estrictas:
- Sin sal añadida
- Sin miel hasta los 12 meses cumplidos
- Sin verduras de hoja verde (espinaca, acelga) hasta los 12 meses por nitratos
- Texturas blandas, trozos grandes para agarrar (no triturado, no bola)
- Sin frutos secos enteros

Reglas nutricionales semanales:
- Hierro en al menos 5 de 7 días (carne roja, legumbre, pescado azul)
- Pescado graso (salmón, caballa, sardina, atún) al menos 3 veces
- Mínimo 5 verduras distintas a lo largo de la semana
- No repetir la misma proteína animal más de 2 días consecutivos

Para cada comida devuelve:
- baby: descripción de la comida (apta para bebé BLW, la familia come lo mismo)
- tags: array con los tags aplicables (iron, fish, legume, egg, dairy, fruit, cereal, y/o veggie:nombre)

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
    'Access-Control-Allow-Headers': 'Content-Type',
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

    if (type === 'generate_week') {
      const { availableIngredients, fixedMeals, recurringMeals, mealSlots, foodHistory, savedRecipes } = payload;

      const safeIngredients = sanitize(availableIngredients, 300);
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

      const ingredientsSection = safeIngredients
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

      userMessage = `Genera un menú completo para 7 días.
${ingredientsSection}${recurringSection}${fixedSection}${slotsSection}

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

Organiza las tareas en secciones temáticas (ej: Legumbres, Verduras, Proteínas, Cereales y bases, Fruta). Cada sección agrupa tareas del mismo tipo.
IMPORTANTE: dentro de cada sección, cada tarea debe ser UNA SOLA preparación concreta (un ingrediente, una elaboración). Si hay dos legumbres distintas, son dos tareas separadas. No agrupes varias cosas en una misma tarea.
Cada tarea debe indicar cantidad aproximada y para qué días/comidas sirve.

Devuelve SOLO este JSON:
{"sections": [
  {
    "id": "s1",
    "emoji": "🟢",
    "title": "Legumbres",
    "tasks": [
      {"id": "t1", "text": "Cocer lentejas (200g) — para comida del lunes y jueves"},
      {"id": "t2", "text": "Cocer garbanzos (150g) — para cena del miércoles"}
    ]
  },
  ...
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
              text: `Analiza esta foto de comida para bebé BLW (~12 meses). Identifica el plato e ingredientes principales. Devuelve SOLO este JSON:
{
  "name": "nombre corto del plato (ej: Salmón con puré de calabaza)",
  "tags": ["tag1", "tag2"]
}
Tags posibles: iron (carne roja, legumbre, pescado azul), fish (pescado graso), legume (legumbre), egg (huevo), dairy (lácteo), fruit (fruta), cereal (cereal/pan/pasta/arroz), veggie:nombreVerdura (una entrada por verdura identificada).
Si no puedes identificar el plato con claridad, devuelve name:"" y tags:[]. Devuelve solo el JSON, sin texto adicional.`,
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

    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ result: parsed }),
    };
  } catch (err) {
    console.error('Claude function error:', err);
    return {
      statusCode: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Internal server error' }),
    };
  }
};
