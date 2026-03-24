import { useState, useEffect } from 'react';
import {
  collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ALL_TAGS } from '../ui/TagChip';

const TAG_LABELS = {
  iron: '🩸 Hierro', fish: '🐟 Pescado', legume: '🟢 Legumbre',
  egg: '🟡 Huevo', dairy: '🥛 Lácteo', fruit: '🍓 Fruta',
  cereal: '🌾 Cereal', veggie: '🥦 Verdura',
};

export default function UsualMeals({ householdId, onAddToWeek }) {
  const [meals, setMeals] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', baby: '', adult: '', tags: [] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!householdId) return;
    const ref = collection(db, 'households', householdId, 'usualMeals');
    const q = query(ref, orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
      setMeals(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [householdId]);

  const handleSave = async () => {
    if (!form.name.trim() || !householdId) return;
    setSaving(true);
    try {
      await addDoc(collection(db, 'households', householdId, 'usualMeals'), {
        ...form,
        name: form.name.trim(),
        baby: form.baby.trim(),
        adult: form.adult.trim(),
        createdAt: new Date().toISOString(),
      });
      setForm({ name: '', baby: '', adult: '', tags: [] });
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    await deleteDoc(doc(db, 'households', householdId, 'usualMeals', id));
  };

  const toggleTag = (tag) => {
    setForm(prev => ({
      ...prev,
      tags: prev.tags.includes(tag) ? prev.tags.filter(t => t !== tag) : [...prev.tags, tag],
    }));
  };

  return (
    <div className="space-y-3">
      {meals.length === 0 && !showForm && (
        <p className="text-sm text-gray-400 text-center py-4">
          Guarda aquí las comidas que preparáis habitualmente para incluirlas fácilmente al generar la semana.
        </p>
      )}

      {meals.map(meal => (
        <div key={meal.id} className="bg-white rounded-xl border border-gray-100 p-3 group">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-800 truncate">{meal.name}</p>
              {meal.baby && <p className="text-xs text-gray-500 truncate">👶 {meal.baby}</p>}
              {meal.adult && <p className="text-xs text-gray-400 truncate">🧑 {meal.adult}</p>}
              {meal.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {meal.tags.map(t => (
                    <span key={t} className="text-xs bg-brand-50 text-brand-700 border border-brand-100 rounded-full px-2 py-0.5">
                      {TAG_LABELS[t] || t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              {onAddToWeek && (
                <button
                  onClick={() => onAddToWeek(meal)}
                  className="text-xs text-brand-600 hover:text-brand-800 font-medium px-2 py-1 rounded-lg hover:bg-brand-50 transition-colors"
                >
                  + Semana
                </button>
              )}
              <button
                onClick={() => handleDelete(meal.id)}
                className="text-xs text-gray-300 hover:text-red-500 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      ))}

      {showForm ? (
        <div className="bg-white rounded-xl border border-brand-200 p-4 space-y-3">
          <input
            type="text"
            value={form.name}
            onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
            placeholder="Nombre (ej: Lentejas con verduras)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <input
            type="text"
            value={form.baby}
            onChange={e => setForm(p => ({ ...p, baby: e.target.value }))}
            placeholder="Versión bebé (opcional)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <input
            type="text"
            value={form.adult}
            onChange={e => setForm(p => ({ ...p, adult: e.target.value }))}
            placeholder="Versión adulto (opcional)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <div>
            <p className="text-xs text-gray-500 mb-1.5">Tags nutricionales</p>
            <div className="flex flex-wrap gap-1.5">
              {[...ALL_TAGS, 'veggie'].map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                    form.tags.includes(tag)
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400'
                  }`}
                >
                  {TAG_LABELS[tag] || tag}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="flex-1 bg-brand-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full border-2 border-dashed border-gray-300 hover:border-brand-400 text-gray-400 hover:text-brand-600 rounded-xl py-3 text-sm font-medium transition-colors"
        >
          + Añadir comida habitual
        </button>
      )}
    </div>
  );
}
