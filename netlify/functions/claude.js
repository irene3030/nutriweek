import Anthropic from '@anthropic-ai/sdk';

const SYSTEM_PROMPT = `Eres un asistente de nutrición infantil especializado en BLW (Baby-Led Weaning).
Genera un menú semanal completo (7 días × 5 franjas: desayuno, snack, comida, merienda, cena)
para un bebé de ~12 meses y su familia.

Reglas BLW estrictas:
- Sin sal añadida en la comida del bebé
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
- baby: texto de la comida del bebé
- adult: adaptación para adulto (puede ser igual con sal/condimentos)
- tags: array con los tags aplicables (iron, fish, legume, egg, dairy, fruit, cereal, y/o veggie:nombre)

Devuelve SOLO JSON válido con la estructura de semana definida, sin texto adicional.`;

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders(),
      body: '',
    };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders(),
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { type, payload, apiKey } = body;

    const resolvedKey = apiKey || process.env.ANTHROPIC_API_KEY;
    if (!resolvedKey) {
      return {
        statusCode: 400,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'No hay API key configurada. Añádela en la sección Perfil.' }),
      };
    }

    const client = new Anthropic({ apiKey: resolvedKey });

    let userMessage = '';

    if (type === 'generate_week') {
      const { availableIngredients, fixedMeals, recurringMeals, mealSlots, foodHistory, savedRecipes } = payload;

      const ingredientsSection = availableIngredients
        ? `\nIngredientes disponibles en nevera/despensa (priorízalos cuanto antes en la semana, cada uno para una comida distinta, pero completa la semana con otros alimentos también): ${availableIngredients}`
        : '';

      const fixedSection = fixedMeals && fixedMeals.length > 0
        ? `\nComidas fijadas en día y franja concretos (respétalas EXACTAMENTE):\n${fixedMeals.filter(m => m.day).map(m => `- ${m.day} ${m.tipo}: "${m.text}"`).join('\n')}`
        : '';

      const recurringSection = recurringMeals && recurringMeals.length > 0
        ? `\nComidas que deben aparecer esta semana (colócalas en el día y franja que mejor encaje nutricionalmente): ${recurringMeals.join(', ')}`
        : '';

      const slotsSection = mealSlots ? (() => {
        const disabled = Object.entries(mealSlots).filter(([, v]) => !v.enabled).map(([k]) => k);
        const same = Object.entries(mealSlots).filter(([, v]) => v.enabled && v.sameEveryDay).map(([k]) => k);
        let s = '';
        if (disabled.length) s += `\nFranjas que NO debes generar (déjalas vacías: baby:"", adult:"", tags:[]): ${disabled.join(', ')}`;
        if (same.length) {
          // Check if any sameEveryDay slot also has a fixed meal — use that text for all days
          const sameDetails = same.map(tipo => {
            const fixed = fixedMeals && fixedMeals.find(m => m.tipo === tipo && m.day);
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

Historial de alimentos últimas semanas: ${foodHistory ? JSON.stringify(foodHistory) : 'sin historial'}

Recetas guardadas del usuario: ${savedRecipes && savedRecipes.length > 0 ? savedRecipes.map(r => r.name).join(', ') : 'ninguna'}

Devuelve un JSON con esta estructura exacta:
{
  "days": [
    {
      "day": "Lun",
      "meals": [
        {
          "tipo": "desayuno",
          "baby": "descripción para el bebé",
          "adult": "adaptación para adulto",
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

      const dayFixed = fixedMeals && fixedMeals.length > 0
        ? fixedMeals.filter(m => m.day === dayName)
        : [];
      const fixedNote = dayFixed.length > 0
        ? `\nComidas fijas para este día (respétalas, no las cambies):\n${dayFixed.map(m => `- ${m.tipo}: "${m.text}"`).join('\n')}`
        : '';

      userMessage = `Regenera únicamente el día ${dayName} manteniendo coherencia nutricional con el resto de la semana.${fixedNote}

Contexto semanal actual:
${JSON.stringify(weekContext, null, 2)}

Ingredientes disponibles en casa: ${availableIngredients || 'ninguno especificado'}

Devuelve SOLO el JSON de ese día:
{
  "day": "${dayName}",
  "meals": [
    { "tipo": "desayuno", "baby": "...", "adult": "...", "tags": [...] },
    { "tipo": "snack", "baby": "...", "adult": "...", "tags": [...] },
    { "tipo": "comida", "baby": "...", "adult": "...", "tags": [...] },
    { "tipo": "merienda", "baby": "...", "adult": "...", "tags": [...] },
    { "tipo": "cena", "baby": "...", "adult": "...", "tags": [...] }
  ]
}`;
    } else if (type === 'suggest_meal') {
      const { dayName, mealType, weekContext } = payload;
      userMessage = `Sugiere una comida para el slot "${mealType}" del día ${dayName}.

Contexto semanal actual para mantener coherencia nutricional:
${JSON.stringify(weekContext, null, 2)}

Devuelve SOLO el JSON de esa comida:
{
  "baby": "descripción para el bebé",
  "adult": "adaptación para adulto",
  "tags": ["tag1", "tag2"]
}`;
    } else if (type === 'quick_meal') {
      const { ingredients, requirements } = payload;
      const reqList = requirements && requirements.length > 0 ? requirements.join(', ') : null;
      userMessage = `Sugiere una comida completa para un bebé de ~12 meses (BLW).
${ingredients ? `\nIngredientes disponibles: ${ingredients}` : ''}
${reqList ? `\nRequisitos nutricionales: ${reqList}` : ''}

Devuelve SOLO este JSON:
{
  "baby": "descripción breve de la comida para el bebé",
  "adult": "adaptación para adulto",
  "tags": ["tag1", "tag2"]
}`;
    } else if (type === 'batch_cooking') {
      const { weekMenu } = payload;
      userMessage = `Analiza este menú semanal para bebé BLW (~12 meses) y familia, y sugiere 5-8 preparaciones de batch cooking que faciliten la semana.

Menú:
${JSON.stringify(weekMenu, null, 2)}

Prioriza:
- Bases que se repiten (caldos, salsas de tomate, legumbres cocidas)
- Cereales o pasta que se pueden cocer en cantidad para varios días
- Verduras que pueden lavarse, cortarse o asarse con antelación
- Proteínas que pueden prepararse para 2-3 días a la vez
- Preparaciones que sirven tanto para bebé como para adulto

Devuelve SOLO este JSON:
{"items": [{"id": "1", "text": "..."}, {"id": "2", "text": "..."}, ...]}`;
    } else {
      return {
        statusCode: 400,
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
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
        headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Claude returned invalid JSON', raw: rawText }),
      };
    }

    return {
      statusCode: 200,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ result: parsed }),
    };
  } catch (err) {
    console.error('Claude function error:', err);
    return {
      statusCode: 500,
      headers: { ...corsHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Internal server error' }),
    };
  }
};
