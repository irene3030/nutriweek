import { useState, useEffect, useMemo } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { generateShoppingList, formatShoppingListText } from '../../lib/shopping';

const CATEGORY_ICONS = {
  'proteína animal': '🥩',
  verdura: '🥦',
  fruta: '🍎',
  despensa: '🫙',
};

const CATEGORY_COLORS = {
  'proteína animal': 'bg-red-50 border-red-200',
  verdura: 'bg-green-50 border-green-200',
  fruta: 'bg-pink-50 border-pink-200',
  despensa: 'bg-amber-50 border-amber-200',
};

export default function ShoppingList({ weekDoc, householdId }) {
  const [checked, setChecked] = useState({});
  const [availableAtHome, setAvailableAtHome] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load checked state and available ingredients from Firestore
  useEffect(() => {
    if (!weekDoc?.id || !householdId) return;
    const weekRef = doc(db, 'households', householdId, 'weeks', weekDoc.id);
    getDoc(weekRef).then((snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setChecked(data.shoppingChecked || {});
        setAvailableAtHome(data.availableAtHome || '');
      }
    });
  }, [weekDoc?.id, householdId]);

  const shoppingList = useMemo(
    () => generateShoppingList(weekDoc, availableAtHome),
    [weekDoc, availableAtHome]
  );

  const persistChecked = async (newChecked) => {
    if (!weekDoc?.id || !householdId) return;
    setSaving(true);
    try {
      const weekRef = doc(db, 'households', householdId, 'weeks', weekDoc.id);
      await updateDoc(weekRef, { shoppingChecked: newChecked });
    } catch (err) {
      console.error('Error saving shopping checked:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = (item) => {
    const newChecked = { ...checked, [item]: !checked[item] };
    setChecked(newChecked);
    persistChecked(newChecked);
  };

  const handleExport = () => {
    const text = formatShoppingListText(shoppingList, weekDoc?.label);
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const uncheckAll = () => {
    const newChecked = {};
    persistChecked(newChecked);
    setChecked(newChecked);
  };

  const totalItems = Object.values(shoppingList.categories).reduce((sum, arr) => sum + arr.length, 0);
  const checkedCount = Object.values(checked).filter(Boolean).length;

  if (!weekDoc) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center text-gray-400">
        <span className="text-4xl mb-3">🛒</span>
        <p>Selecciona una semana para ver la lista de la compra.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold text-gray-900">Lista de la compra</h2>
          <p className="text-xs text-gray-400">{weekDoc.label}</p>
        </div>
        <div className="flex items-center gap-2">
          {saving && <span className="text-xs text-gray-400">Guardando...</span>}
          {checkedCount > 0 && (
            <button
              onClick={uncheckAll}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Limpiar ✓
            </button>
          )}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-sm font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded-xl px-3 py-2 hover:bg-brand-100 transition-colors"
          >
            {copied ? '✓ Copiado' : '📋 Copiar texto'}
          </button>
        </div>
      </div>

      {/* Progress bar */}
      {totalItems > 0 && (
        <div>
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>{checkedCount} de {totalItems} marcados</span>
            <span>{Math.round((checkedCount / totalItems) * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all"
              style={{ width: `${(checkedCount / totalItems) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Categories */}
      {Object.entries(shoppingList.categories).map(([cat, items]) => {
        if (items.length === 0) return null;
        const remaining = items.filter((i) => !checked[i]);
        return (
          <div key={cat} className={`border rounded-xl overflow-hidden ${CATEGORY_COLORS[cat]}`}>
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-inherit">
              <span className="text-lg">{CATEGORY_ICONS[cat]}</span>
              <h3 className="font-semibold text-sm text-gray-700 capitalize">{cat}</h3>
              <span className="text-xs text-gray-400 ml-auto">
                {remaining.length}/{items.length}
              </span>
            </div>
            <div className="bg-white divide-y divide-gray-50">
              {items.map((item) => (
                <label
                  key={item}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                    checked[item] ? 'opacity-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!checked[item]}
                    onChange={() => handleToggle(item)}
                    className="w-4 h-4 rounded accent-brand-600"
                  />
                  <span className={`text-sm capitalize ${checked[item] ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                    {item}
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}

      {/* At home section */}
      {shoppingList.atHome.length > 0 && (
        <div className="border border-green-200 rounded-xl overflow-hidden bg-green-50">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-green-200">
            <span className="text-lg">✅</span>
            <h3 className="font-semibold text-sm text-gray-700">Ya tienes en casa</h3>
          </div>
          <div className="bg-white divide-y divide-gray-50">
            {shoppingList.atHome.map((item) => (
              <div key={item} className="px-4 py-2.5 flex items-center gap-3 opacity-60">
                <span className="w-4 h-4 flex items-center justify-center text-green-500 text-xs">✓</span>
                <span className="text-sm capitalize text-gray-500">{item}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalItems === 0 && shoppingList.atHome.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <span className="text-4xl block mb-3">🛒</span>
          <p className="text-sm">No se detectaron ingredientes en el menú.</p>
          <p className="text-xs mt-1">Asegúrate de que el menú tenga texto con ingredientes reconocibles.</p>
        </div>
      )}
    </div>
  );
}
