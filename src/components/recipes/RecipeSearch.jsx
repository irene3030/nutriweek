import { useState, useEffect } from 'react';
import {
  collection,
  onSnapshot,
  addDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';

export default function RecipeSearch({ householdId, onSelect }) {
  const [recipes, setRecipes] = useState([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!householdId) return;
    const recipesRef = collection(db, 'households', householdId, 'recipes');
    const q = query(recipesRef, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setRecipes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [householdId]);

  const filtered = search
    ? recipes.filter(
        (r) =>
          r.name?.toLowerCase().includes(search.toLowerCase()) ||
          r.baby?.toLowerCase().includes(search.toLowerCase())
      )
    : recipes;

  const handleDelete = async (recipeId) => {
    if (!householdId) return;
    await deleteDoc(doc(db, 'households', householdId, 'recipes', recipeId));
  };

  if (recipes.length === 0 && !search) {
    return (
      <div className="text-center py-4 text-gray-400 text-sm">
        No hay recetas guardadas todavía.
        <br />
        Usa "Guardar como receta" al editar una comida.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar recetas..."
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
      <div className="max-h-48 overflow-y-auto space-y-1">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-3">Sin resultados</p>
        ) : (
          filtered.map((recipe) => (
            <div
              key={recipe.id}
              className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{recipe.name}</p>
                {recipe.baby && (
                  <p className="text-xs text-gray-500 truncate">{recipe.baby}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                {onSelect && (
                  <button
                    onClick={() => onSelect(recipe)}
                    className="text-xs text-brand-600 hover:text-brand-800 font-medium px-2 py-1 rounded hover:bg-brand-50 transition-colors"
                  >
                    Usar
                  </button>
                )}
                <button
                  onClick={() => handleDelete(recipe.id)}
                  className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export async function saveRecipe(householdId, { name, baby, adult, tags }) {
  if (!householdId) return;
  const recipesRef = collection(db, 'households', householdId, 'recipes');
  await addDoc(recipesRef, {
    name,
    baby,
    adult,
    tags,
    createdAt: new Date().toISOString(),
  });
}
