import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
    const { type, payload } = body;

    let userMessage = '';

    if (type === 'generate_week') {
      const { availableIngredients, foodHistory, savedRecipes } = payload;
      userMessage = `Genera un menú completo para 7 días.

Ingredientes disponibles en casa: ${availableIngredients || 'ninguno especificado'}

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
      const { dayName, weekContext, availableIngredients } = payload;
      userMessage = `Regenera únicamente el día ${dayName} manteniendo coherencia nutricional con el resto de la semana.

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
