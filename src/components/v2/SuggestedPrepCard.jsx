import { useState } from 'react';
import { Check, ShoppingCart, Home, User, Baby, ChefHat, Send, Loader2, Zap } from 'lucide-react';
import { generateRecipe, chatWithRecipe } from '../../lib/claude';

const PREP_TYPE_BADGES = {
  'ya-preparado': { label: 'Listo',       color: 'bg-brand-100 text-brand-700' },
  acelerador:     { label: 'Base',        color: 'bg-violet-100 text-violet-700' },
  'justo-antes':  { label: 'Justo-antes', color: 'bg-purple-100 text-purple-700' },
  'snack-batch':  { label: 'Snack batch', color: 'bg-amber-100 text-amber-700' },
};

const KPI_BOOST_LABELS = {
  legume: 'Cubre legumbre',
  fish:   'Cubre pescado azul',
  iron:   'Cubre hierro',
  veggie: 'Añade verduras',
};

function SourceIcon({ source }) {
  if (source === 'stock')    return <Check       className="w-3 h-3 text-green-500 shrink-0" />;
  if (source === 'despensa') return <Home        className="w-3 h-3 text-gray-400 shrink-0" />;
  return                            <ShoppingCart className="w-3 h-3 text-amber-500 shrink-0" />;
}

export default function SuggestedPrepCard({ proposal, inventoryItems = [], onSelect, onSchedule, selectLabel = 'Seleccionar' }) {
  const [recipe, setRecipe] = useState(null);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [recipeError, setRecipeError] = useState(null);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const badge    = PREP_TYPE_BADGES[proposal.prepType];
  const kpiLabel = proposal.kpiBoost ? KPI_BOOST_LABELS[proposal.kpiBoost] : null;

  async function handleGenerateRecipe() {
    setRecipeLoading(true);
    setRecipeError(null);
    try {
      const result = await generateRecipe({
        prepName:      proposal.name,
        prepType:      proposal.prepType,
        ingredients:   proposal.ingredients ?? [],
        adultPortions: proposal.adultPortions ?? 2,
        babyPortions:  proposal.babyPortions ?? 1,
      });
      if (!result?.steps?.length) throw new Error('Sin pasos');
      setRecipe({ name: proposal.name, steps: result.steps, notes: result.notes ?? null });
    } catch {
      setRecipeError('No se pudo generar la receta. Inténtalo de nuevo.');
    } finally {
      setRecipeLoading(false);
    }
  }

  async function handleSendChat(e) {
    e.preventDefault();
    const q = chatInput.trim();
    if (!q || chatLoading) return;
    setChatInput('');
    const userMsg = { role: 'user', content: q };
    setChatMessages(prev => [...prev, userMsg]);
    setChatLoading(true);
    try {
      const inventoryNames = inventoryItems.map(i => ({ name: i.name }));
      const result = await chatWithRecipe({ recipe, question: q, inventoryItems: inventoryNames });
      setChatMessages(prev => [...prev, { role: 'assistant', content: result?.answer || '…' }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'No pude responder. Inténtalo de nuevo.' }]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <div className="bg-white border border-gray-100 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-start gap-2 flex-wrap">
          <span className="flex-1 text-sm font-semibold text-gray-900 leading-tight">{proposal.name}</span>
          {badge && (
            <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${badge.color}`}>
              {badge.label}
            </span>
          )}
        </div>
        {proposal.description && (
          <p className="text-xs text-gray-500 leading-snug">{proposal.description}</p>
        )}
        <div className="flex items-center gap-3 flex-wrap">
          {proposal.prepTime && (
            <span className="text-xs text-violet-500 font-medium">{proposal.prepTime}</span>
          )}
          {proposal.unitsGenerated && (
            <span className="text-xs text-amber-600 font-medium">{proposal.unitsGenerated} uds.</span>
          )}
          {kpiLabel && (
            <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium border border-green-100">
              {kpiLabel}
            </span>
          )}
        </div>
      </div>

      {/* quickDishes — acelerador only */}
      {proposal.prepType === 'acelerador' && proposal.quickDishes?.length > 0 && (
        <div className="bg-violet-50 border border-violet-100 rounded-xl px-3 py-2 space-y-1">
          <p className="text-xs font-medium text-violet-700 flex items-center gap-1">
            <Zap className="w-3 h-3" /> Con esta base puedes hacer:
          </p>
          <ul className="space-y-0.5">
            {proposal.quickDishes.map((dish, i) => (
              <li key={i} className="text-xs text-violet-600 flex items-center gap-1.5">
                <span className="text-violet-400">→</span> {dish}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Ingredients */}
      {proposal.ingredients?.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {proposal.ingredients.map((ing, i) => (
            <span key={i} className="flex items-center gap-1 text-xs text-gray-600">
              <SourceIcon source={ing.source} />
              {ing.name}
            </span>
          ))}
        </div>
      )}

      {/* Portions + CTAs */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3 text-xs text-gray-400">
          {proposal.prepType !== 'snack-batch' && proposal.prepType !== 'acelerador' && (
            <>
              <span className="flex items-center gap-0.5">
                <User className="w-3 h-3" /> {proposal.adultPortions ?? 2}
              </span>
              <span className="flex items-center gap-0.5">
                <Baby className="w-3 h-3" /> {proposal.babyPortions ?? 1}
              </span>
            </>
          )}
          {proposal.prepType === 'acelerador' && (
            <span className="text-xs text-violet-500 font-medium">
              {proposal.adultPortions ?? 2}r · acelera {proposal.quickDishes?.length ?? 2}+ platos
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!recipe && (
            <button
              onClick={handleGenerateRecipe}
              disabled={recipeLoading}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {recipeLoading
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <ChefHat className="w-3 h-3" />
              }
              {recipeLoading ? 'Generando…' : 'Receta'}
            </button>
          )}
          {onSchedule && (
            <button
              onClick={() => onSchedule(proposal)}
              className="text-xs font-medium px-4 py-1.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors"
            >
              Programar
            </button>
          )}
          {!onSchedule && onSelect && (
            <button
              onClick={() => onSelect(proposal)}
              className="text-xs font-medium px-4 py-1.5 rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors"
            >
              {selectLabel}
            </button>
          )}
        </div>
      </div>

      {/* Recipe error */}
      {recipeError && (
        <p className="text-xs text-red-500 text-center">{recipeError}</p>
      )}

      {/* Recipe steps */}
      {recipe && (
        <div className="border-t border-gray-100 pt-3 space-y-3">
          <ol className="space-y-1.5 list-none">
            {recipe.steps.map((step, i) => (
              <li key={i} className="flex gap-2 text-xs text-gray-700 leading-snug">
                <span className="shrink-0 w-4 h-4 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-bold mt-0.5">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          {recipe.notes && (
            <p className="text-xs text-gray-400 italic">{recipe.notes}</p>
          )}

          {/* Chat history */}
          {chatMessages.length > 0 && (
            <div className="space-y-2 pt-1">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`text-xs rounded-xl px-3 py-2 max-w-[90%] ${
                  msg.role === 'user'
                    ? 'ml-auto bg-brand-600 text-white'
                    : 'mr-auto bg-gray-100 text-gray-700'
                }`}>
                  {msg.content}
                </div>
              ))}
              {chatLoading && (
                <div className="mr-auto bg-gray-100 rounded-xl px-3 py-2 max-w-[90%]">
                  <Loader2 className="w-3 h-3 text-gray-400 animate-spin" />
                </div>
              )}
            </div>
          )}

          {/* Chat input */}
          <form onSubmit={handleSendChat} className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Pregunta algo sobre la receta…"
              disabled={chatLoading}
              className="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-300 bg-gray-50"
            />
            <button
              type="submit"
              disabled={!chatInput.trim() || chatLoading}
              className="flex items-center justify-center w-8 h-8 rounded-xl bg-brand-600 text-white hover:bg-brand-700 transition-colors disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
