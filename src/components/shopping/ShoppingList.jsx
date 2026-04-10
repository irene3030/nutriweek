import { useState, useEffect, useMemo } from 'react';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { generateShoppingList, formatShoppingListText } from '../../lib/shopping';
import { Beef, Leaf, Apple, ShoppingCart, ClipboardList, Check, CheckCircle2 } from 'lucide-react';

const MEAL_LABELS = {
  desayuno: 'Desayuno',
  snack: 'Snack',
  comida: 'Comida',
  merienda: 'Merienda',
  cena: 'Cena',
};

const CATEGORY_ICON_COMPONENTS = {
  'proteína animal': Beef,
  verdura: Leaf,
  fruta: Apple,
  despensa: null,
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
        <ShoppingCart className="w-10 h-10 mb-3" />
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
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-0.5"
            >
              Limpiar <Check className="w-3 h-3" />
            </button>
          )}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 text-sm font-medium text-brand-700 bg-brand-50 border border-brand-200 rounded-xl px-3 py-2 hover:bg-brand-100 transition-colors"
          >
            {copied ? <><Check className="w-3.5 h-3.5 inline mr-0.5" />Copiado</> : <><ClipboardList className="w-3.5 h-3.5 inline mr-0.5" />Copiar texto</>}
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
        const checkedInCat = items.filter((i) => checked[i.name]).length;
        return (
          <div key={cat} className={`border rounded-xl overflow-hidden ${CATEGORY_COLORS[cat]}`}>
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-inherit">
              {CATEGORY_ICON_COMPONENTS[cat] && (() => { const CatIcon = CATEGORY_ICON_COMPONENTS[cat]; return <CatIcon className="w-4 h-4 text-gray-500" />; })()}
              <h3 className="font-semibold text-sm text-gray-700 capitalize">{cat}</h3>
              <span className="text-xs text-gray-400 ml-auto">
                {checkedInCat}/{items.length}
              </span>
            </div>
            <div className="bg-white divide-y divide-gray-50">
              {items.map((item) => (
                <label
                  key={item.name}
                  className={`flex items-start gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 transition-colors ${
                    checked[item.name] ? 'opacity-50' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!checked[item.name]}
                    onChange={() => handleToggle(item.name)}
                    className="w-4 h-4 rounded accent-brand-600 mt-0.5 shrink-0"
                  />
                  <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1">
                    <span className={`text-sm capitalize ${checked[item.name] ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                      {item.name}
                    </span>
                    {item.usages?.map((u, i) => (
                      <span key={i} className="relative group/pill inline-block">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 cursor-default">
                          {u.day} · {MEAL_LABELS[u.tipo] ?? u.tipo}
                        </span>
                        {u.text && (
                          <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-800 text-white text-[10px] rounded-lg opacity-0 group-hover/pill:opacity-100 transition-opacity z-20 w-max max-w-[240px] text-center leading-snug">
                            {u.text}
                            <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                          </span>
                        )}
                      </span>
                    ))}
                  </div>
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
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <h3 className="font-semibold text-sm text-gray-700">Ya tienes en casa</h3>
          </div>
          <div className="bg-white divide-y divide-gray-50">
            {shoppingList.atHome.map((item) => (
              <div key={item.name} className="px-4 py-2.5 flex items-start gap-3 opacity-60">
                <Check className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0 flex flex-wrap items-center gap-1">
                  <span className="text-sm capitalize text-gray-500">{item.name}</span>
                  {item.usages?.map((u, i) => (
                    <span key={i} className="relative group/pill inline-block">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-400 cursor-default">
                        {u.day} · {MEAL_LABELS[u.tipo] ?? u.tipo}
                      </span>
                      {u.text && (
                        <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-800 text-white text-[10px] rounded-lg opacity-0 group-hover/pill:opacity-100 transition-opacity z-20 w-max max-w-[240px] text-center leading-snug">
                          {u.text}
                          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalItems === 0 && shoppingList.atHome.length === 0 && (
        <div className="text-center py-12 text-gray-400">
          <ShoppingCart className="w-10 h-10 mx-auto mb-3" />
          <p className="text-sm">No se detectaron ingredientes en el menú.</p>
          <p className="text-xs mt-1">Asegúrate de que el menú tenga texto con ingredientes reconocibles.</p>
        </div>
      )}
    </div>
  );
}
