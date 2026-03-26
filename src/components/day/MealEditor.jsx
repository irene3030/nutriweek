import { useState, useEffect } from 'react';
import TagChip, { ALL_TAGS } from '../ui/TagChip';
import RecipeSearch, { saveRecipe } from '../recipes/RecipeSearch';
import { suggestMeal } from '../../lib/claude';
import { track } from '../../lib/analytics';

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MEAL_TYPES = ['desayuno', 'snack', 'comida', 'merienda', 'cena'];
const MEAL_LABELS = {
  desayuno: 'Desayuno',
  snack: 'Snack AM',
  comida: 'Comida',
  merienda: 'Merienda',
  cena: 'Cena',
};

const REGEN_REQUIREMENTS = [
  { id: 'hierro',        label: '🩸 Hierro' },
  { id: 'pescado graso', label: '🐟 Pescado' },
  { id: 'legumbre',      label: '🟢 Legumbre' },
  { id: 'verdura',       label: '🥦 Verdura' },
  { id: 'huevo',         label: '🟡 Huevo' },
  { id: 'fruta',         label: '🍓 Fruta' },
];

export default function MealEditor({
  meal,
  dayName,
  weekContext,
  householdId,
  apiKey,
  hasAiAccess,
  onSave,
  onCopy,
  onCancel,
}) {
  const [baby, setBaby] = useState('');
  const [tags, setTags] = useState([]);

  // Regenerate
  const [showRegen, setShowRegen]               = useState(false);
  const [regenIngredients, setRegenIngredients] = useState('');
  const [regenRequirements, setRegenRequirements] = useState([]);
  const [regenerating, setRegenerating]         = useState(false);
  const [regenError, setRegenError]             = useState(null);

  // Recipes
  const [showRecipes, setShowRecipes]           = useState(false);
  const [saveAsRecipeName, setSaveAsRecipeName] = useState('');
  const [showSaveRecipe, setShowSaveRecipe]     = useState(false);
  const [savedRecipeMsg, setSavedRecipeMsg]     = useState(false);

  // Copy
  const [showCopy, setShowCopy]       = useState(false);
  const [copyTarget, setCopyTarget]   = useState({ day: DAYS[0], meal: MEAL_TYPES[0] });

  useEffect(() => {
    if (meal) {
      setBaby(meal.baby || '');
      setTags(meal.tags || []);
    }
  }, [meal]);

  const toggleTag = (tag) =>
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const removeTag = (tag) =>
    setTags((prev) => prev.filter((t) => t !== tag));

  const toggleRegenReq = (id) =>
    setRegenRequirements((prev) => prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setRegenError(null);
    try {
      const result = await suggestMeal({
        dayName,
        mealType: meal?.tipo,
        weekContext,
        ingredients: regenIngredients,
        requirements: regenRequirements,
        apiKey,
      });
      if (result.baby) setBaby(result.baby);
      if (result.tags) setTags(result.tags);
      track('meal_suggested', { day: dayName, meal_type: meal?.tipo, tags: result.tags || [] });
      setShowRegen(false);
      setRegenIngredients('');
      setRegenRequirements([]);
    } catch (err) {
      setRegenError(
        err.message === 'NO_API_KEY'           ? 'Añade tu API key en Perfil.' :
        err.message === 'CALL_LIMIT_EXCEEDED'  ? 'Has alcanzado el límite mensual.' :
        err.message === 'FREE_QUOTA_EXCEEDED'  ? 'Has agotado las llamadas gratuitas.' :
        err.message || 'Error al regenerar.'
      );
    } finally {
      setRegenerating(false);
    }
  };

  const handleSaveRecipe = async () => {
    if (!saveAsRecipeName.trim() || !householdId) return;
    await saveRecipe(householdId, { name: saveAsRecipeName.trim(), baby, adult: '', tags });
    setSavedRecipeMsg(true);
    setShowSaveRecipe(false);
    setSaveAsRecipeName('');
    setTimeout(() => setSavedRecipeMsg(false), 2000);
  };

  const handleUseRecipe = (recipe) => {
    setBaby(recipe.baby || '');
    setTags(recipe.tags || []);
    setShowRecipes(false);
  };

  const handleSubmit = () => onSave({ baby, tags });

  return (
    <div className="space-y-4">

      {/* Comida */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Comida
        </label>
        <textarea
          value={baby}
          onChange={(e) => setBaby(e.target.value)}
          placeholder="Ej: Salmón al vapor + brócoli en trozos + arroz"
          rows={2}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
        />
      </div>

      {/* Etiquetas */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Etiquetas
        </label>
        <div className="flex flex-wrap gap-1.5">
          {ALL_TAGS.map((tag) => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${
                tags.includes(tag)
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.map((tag) => (
              <TagChip key={tag} tag={tag} onRemove={removeTag} small />
            ))}
          </div>
        )}
      </div>

      {/* Regenerar con IA */}
      {hasAiAccess && (
        <div className="border-t border-gray-100 pt-3">
          <button
            onClick={() => setShowRegen((v) => !v)}
            className="text-xs text-brand-600 hover:text-brand-700 flex items-center gap-1.5 font-medium"
          >
            <span>✨</span>
            {showRegen ? 'Ocultar regenerar' : 'Regenerar con IA'}
          </button>
          {showRegen && (
            <div className="mt-2 space-y-2">
              <input
                type="text"
                value={regenIngredients}
                onChange={(e) => setRegenIngredients(e.target.value)}
                placeholder="Ingredientes disponibles (opcional)"
                className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
              />
              <div className="flex flex-wrap gap-1">
                {REGEN_REQUIREMENTS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleRegenReq(r.id)}
                    className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                      regenRequirements.includes(r.id)
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-brand-400'
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              {regenError && <p className="text-xs text-red-500">{regenError}</p>}
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="w-full flex items-center justify-center gap-1.5 bg-brand-600 text-white text-xs font-medium py-1.5 rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50"
              >
                {regenerating
                  ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Regenerando...</>
                  : '✨ Regenerar'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Buscar en mis recetas */}
      <div className="border-t border-gray-100 pt-3">
        <button
          onClick={() => setShowRecipes((v) => !v)}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          {showRecipes ? 'Ocultar mis recetas' : 'Buscar en mis recetas'}
        </button>
        {showRecipes && (
          <div className="mt-2 border border-gray-200 rounded-xl p-3">
            <RecipeSearch householdId={householdId} onSelect={handleUseRecipe} />
          </div>
        )}
      </div>

      {/* Guardar como receta */}
      <div>
        <button
          onClick={() => setShowSaveRecipe((v) => !v)}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          Guardar como receta
        </button>
        {savedRecipeMsg && <p className="text-xs text-green-600 mt-1">✓ Receta guardada</p>}
        {showSaveRecipe && (
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={saveAsRecipeName}
              onChange={(e) => setSaveAsRecipeName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveRecipe()}
              placeholder="Nombre de la receta..."
              className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
            />
            <button
              onClick={handleSaveRecipe}
              disabled={!saveAsRecipeName.trim()}
              className="text-xs px-3 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              Guardar
            </button>
          </div>
        )}
      </div>

      {/* Copiar a otro slot */}
      <div>
        <button
          onClick={() => setShowCopy((v) => !v)}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Copiar a otro slot
        </button>
        {showCopy && (
          <div className="flex gap-2 mt-2 flex-wrap">
            <select
              value={copyTarget.day}
              onChange={(e) => setCopyTarget((p) => ({ ...p, day: e.target.value }))}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
            >
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select
              value={copyTarget.meal}
              onChange={(e) => setCopyTarget((p) => ({ ...p, meal: e.target.value }))}
              className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none"
            >
              {MEAL_TYPES.map((m) => <option key={m} value={m}>{MEAL_LABELS[m]}</option>)}
            </select>
            <button
              onClick={() => { onCopy(copyTarget.day, copyTarget.meal, { baby, tags }); setShowCopy(false); }}
              className="text-xs px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Copiar
            </button>
          </div>
        )}
      </div>

      {/* Guardar / Cancelar */}
      <div className="flex gap-3 pt-2 border-t border-gray-100">
        <button
          onClick={onCancel}
          className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSubmit}
          className="flex-1 bg-brand-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          Guardar
        </button>
      </div>
    </div>
  );
}
