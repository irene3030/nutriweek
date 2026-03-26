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
  const [recipes, setRecipes]         = useState([]);
  const [usualMeals, setUsualMeals]   = useState([]);
  const [search, setSearch]           = useState('');

  useEffect(() => {
    if (!householdId) return;
    const q = query(collection(db, 'households', householdId, 'recipes'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => setRecipes(snap.docs.map((d) => ({ id: d.id, _source: 'recipe', ...d.data() }))));
  }, [householdId]);

  useEffect(() => {
    if (!householdId) return;
    const q = query(collection(db, 'households', householdId, 'usualMeals'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => setUsualMeals(snap.docs.map((d) => ({ id: d.id, _source: 'usual', ...d.data() }))));
  }, [householdId]);

  const all = [...recipes, ...usualMeals];

  const filtered = search
    ? all.filter(
        (r) =>
          r.name?.toLowerCase().includes(search.toLowerCase()) ||
          r.baby?.toLowerCase().includes(search.toLowerCase())
      )
    : all;

  const handleDelete = async (item) => {
    if (!householdId) return;
    const col = item._source === 'recipe' ? 'recipes' : 'usualMeals';
    await deleteDoc(doc(db, 'households', householdId, col, item.id));
  };

  if (all.length === 0 && !search) {
    return (
      <div className="text-center py-4 text-gray-400 text-sm">
        No hay recetas ni comidas habituales guardadas todavía.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar..."
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
      <div className="max-h-48 overflow-y-auto space-y-1">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 text-sm py-3">Sin resultados</p>
        ) : (
          filtered.map((item) => (
            <div
              key={`${item._source}-${item.id}`}
              className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
                    item._source === 'usual'
                      ? 'bg-brand-50 text-brand-600'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {item._source === 'usual' ? 'habitual' : 'receta'}
                  </span>
                </div>
                {item.baby && (
                  <p className="text-xs text-gray-500 truncate">{item.baby}</p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                {onSelect && (
                  <button
                    onClick={() => onSelect(item)}
                    className="text-xs text-brand-600 hover:text-brand-800 font-medium px-2 py-1 rounded hover:bg-brand-50 transition-colors"
                  >
                    Usar
                  </button>
                )}
                <button
                  onClick={() => handleDelete(item)}
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
