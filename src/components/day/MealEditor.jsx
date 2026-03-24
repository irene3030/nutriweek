import { useState, useEffect } from 'react';
import TagChip, { ALL_TAGS } from '../ui/TagChip';
import RecipeSearch, { saveRecipe } from '../recipes/RecipeSearch';
import { suggestMeal } from '../../lib/claude';

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MEAL_TYPES = ['desayuno', 'snack', 'comida', 'merienda', 'cena'];
const MEAL_LABELS = {
  desayuno: 'Desayuno',
  snack: 'Snack AM',
  comida: 'Comida',
  merienda: 'Merienda',
  cena: 'Cena',
};

export default function MealEditor({
  meal,
  dayName,
  weekContext,
  householdId,
  apiKey,
  onSave,
  onCopy,
  onCancel,
}) {
  const [baby, setBaby] = useState('');
  const [adult, setAdult] = useState('');
  const [tags, setTags] = useState([]);
  const [veggieInput, setVeggieInput] = useState('');
  const [showRecipes, setShowRecipes] = useState(false);
  const [showCopy, setShowCopy] = useState(false);
  const [copyTarget, setCopyTarget] = useState({ day: DAYS[0], meal: MEAL_TYPES[0] });
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState(null);
  const [saveAsRecipeName, setSaveAsRecipeName] = useState('');
  const [showSaveRecipe, setShowSaveRecipe] = useState(false);
  const [savedRecipeMsg, setSavedRecipeMsg] = useState(false);

  useEffect(() => {
    if (meal) {
      setBaby(meal.baby || '');
      setAdult(meal.adult || '');
      setTags(meal.tags || []);
    }
  }, [meal]);

  const toggleTag = (tag) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const addVeggieTag = () => {
    const name = veggieInput.trim().toLowerCase();
    if (!name) return;
    const veggieTag = `veggie:${name}`;
    if (!tags.includes(veggieTag)) {
      setTags((prev) => [...prev, veggieTag]);
    }
    setVeggieInput('');
  };

  const removeTag = (tag) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  };

  const handleSuggest = async () => {
    setSuggesting(true);
    setSuggestError(null);
    try {
      const result = await suggestMeal({
        dayName,
        mealType: meal?.tipo,
        weekContext,
        apiKey,
      });
      if (result.baby) setBaby(result.baby);
      if (result.adult) setAdult(result.adult);
      if (result.tags) setTags(result.tags);
    } catch (err) {
      setSuggestError(err.message || 'Error al sugerir. Revisa la API.');
    } finally {
      setSuggesting(false);
    }
  };

  const handleSaveRecipe = async () => {
    if (!saveAsRecipeName.trim() || !householdId) return;
    await saveRecipe(householdId, {
      name: saveAsRecipeName.trim(),
      baby,
      adult,
      tags,
    });
    setSavedRecipeMsg(true);
    setShowSaveRecipe(false);
    setSaveAsRecipeName('');
    setTimeout(() => setSavedRecipeMsg(false), 2000);
  };

  const handleUseRecipe = (recipe) => {
    setBaby(recipe.baby || '');
    setAdult(recipe.adult || '');
    setTags(recipe.tags || []);
    setShowRecipes(false);
  };

  const handleSubmit = () => {
    onSave({ baby, adult, tags });
  };

  return (
    <div className="space-y-4">
      {/* Baby field */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          👶 Bebé
        </label>
        <textarea
          value={baby}
          onChange={(e) => setBaby(e.target.value)}
          placeholder="Ej: Salmón al vapor + brócoli en trozos + arroz"
          rows={2}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
        />
      </div>

      {/* Adult field */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          👨‍👩‍👧 Adulto
        </label>
        <textarea
          value={adult}
          onChange={(e) => setAdult(e.target.value)}
          placeholder="Ej: Lo mismo con sal, limón y aceite de oliva"
          rows={2}
          className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Etiquetas
        </label>
        <div className="flex flex-wrap gap-1.5 mb-2">
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
        {/* Veggie input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={veggieInput}
            onChange={(e) => setVeggieInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addVeggieTag()}
            placeholder="verdura (Enter para añadir)"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
          <button
            onClick={addVeggieTag}
            className="text-xs px-3 py-1.5 bg-lime-500 text-white rounded-lg hover:bg-lime-600 transition-colors"
          >
            + Veggie
          </button>
        </div>
        {/* Active tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tags.map((tag) => (
              <TagChip key={tag} tag={tag} onRemove={removeTag} small />
            ))}
          </div>
        )}
      </div>

      {/* AI Suggest button */}
      <div>
        <button
          onClick={handleSuggest}
          disabled={suggesting}
          className="flex items-center gap-2 text-sm text-brand-700 bg-brand-50 border border-brand-200 rounded-xl px-4 py-2 hover:bg-brand-100 transition-colors disabled:opacity-60 w-full justify-center"
        >
          {suggesting ? (
            <div className="w-4 h-4 border-2 border-brand-300 border-t-brand-600 rounded-full animate-spin" />
          ) : (
            '✨'
          )}
          {suggesting ? 'Sugiriendo...' : 'Sugerir con IA'}
        </button>
        {suggestError && (
          <p className="text-xs text-red-500 mt-1">{suggestError}</p>
        )}
      </div>

      {/* Recipes */}
      <div>
        <button
          onClick={() => setShowRecipes((v) => !v)}
          className="text-sm text-gray-600 hover:text-gray-800 flex items-center gap-1 font-medium"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          {showRecipes ? 'Ocultar recetas' : 'Buscar en mis recetas'}
        </button>
        {showRecipes && (
          <div className="mt-2 border border-gray-200 rounded-xl p-3">
            <RecipeSearch householdId={householdId} onSelect={handleUseRecipe} />
          </div>
        )}
      </div>

      {/* Save as recipe */}
      <div>
        <button
          onClick={() => setShowSaveRecipe((v) => !v)}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          Guardar como receta
        </button>
        {savedRecipeMsg && (
          <p className="text-xs text-green-600 mt-1">✓ Receta guardada</p>
        )}
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

      {/* Copy to */}
      <div>
        <button
          onClick={() => setShowCopy((v) => !v)}
          className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
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
              {MEAL_TYPES.map((m) => (
                <option key={m} value={m}>{MEAL_LABELS[m]}</option>
              ))}
            </select>
            <button
              onClick={() => {
                onCopy(copyTarget.day, copyTarget.meal, { baby, adult, tags });
                setShowCopy(false);
              }}
              className="text-xs px-3 py-1.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Copiar
            </button>
          </div>
        )}
      </div>

      {/* Action buttons */}
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
