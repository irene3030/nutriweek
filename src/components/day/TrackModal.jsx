import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import { detectTags } from '../../lib/claude';

const MEAL_TYPE_LABELS = {
  desayuno: 'Desayuno',
  snack: 'Snack AM',
  comida: 'Comida',
  merienda: 'Merienda',
  cena: 'Cena',
};

function parseIngredients(text) {
  if (!text) return [];
  const parts = text
    .split(/\s+con\s+|\s+y\s+|,/i)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length > 2 && s.length < 50);
  return parts.length >= 2 ? parts : [];
}

export default function TrackModal({ isOpen, onClose, meal, dayName, onSave, apiKey }) {
  const [status, setStatus] = useState(null);
  const [checkedIngredients, setCheckedIngredients] = useState(new Set());
  const [extra, setExtra] = useState('');
  const [altFood, setAltFood] = useState('');
  const [tagsLoading, setTagsLoading] = useState(false);

  const ingredients = parseIngredients(meal?.baby || '');
  const hasChecklist = ingredients.length >= 2;

  useEffect(() => {
    if (!isOpen) return;
    if (meal?.track?.status) {
      setStatus(meal.track.status);
      setCheckedIngredients(new Set(meal.track.checkedIngredients || ingredients));
      setExtra(meal.track.extra || '');
      setAltFood(meal.track.altFood || '');
    } else if (meal?.track?.done !== undefined) {
      // backwards compat with old boolean format
      setStatus(meal.track.done ? 'done' : 'partial');
      setCheckedIngredients(new Set(ingredients));
      setExtra(meal.track.note || '');
      setAltFood('');
    } else {
      setStatus(null);
      setCheckedIngredients(new Set(ingredients));
      setExtra('');
      setAltFood('');
    }
  }, [meal, isOpen]);

  useEffect(() => {
    if (status === 'partial' && checkedIngredients.size === 0 && ingredients.length > 0) {
      setCheckedIngredients(new Set(ingredients));
    }
  }, [status]);

  const toggleIngredient = (ing) => {
    setCheckedIngredients(prev => {
      const next = new Set(prev);
      next.has(ing) ? next.delete(ing) : next.add(ing);
      return next;
    });
  };

  const handleSave = async () => {
    if (!status) return;
    setTagsLoading(true);
    try {
      let tags = null;

      if (apiKey) {
        if (status === 'partial' && hasChecklist && checkedIngredients.size > 0) {
          const text = [[...checkedIngredients].join(' y '), extra.trim()].filter(Boolean).join(' y ');
          const res = await detectTags({ text, apiKey });
          tags = res.tags?.length ? res.tags : null;
        } else if (status === 'other' && altFood.trim()) {
          const text = [altFood.trim(), extra.trim()].filter(Boolean).join(' y ');
          const res = await detectTags({ text, apiKey });
          tags = res.tags?.length ? res.tags : null;
        } else if (status === 'done' && extra.trim()) {
          const res = await detectTags({ text: extra.trim(), apiKey });
          const extraTags = res.tags || [];
          tags = [...new Set([...(meal?.tags || []), ...extraTags])];
        }
      }

      onSave({
        status,
        checkedIngredients: (status === 'partial' && hasChecklist) ? [...checkedIngredients] : undefined,
        extra: extra.trim() || undefined,
        altFood: status === 'other' ? (altFood.trim() || undefined) : undefined,
        tags,
        done: true,
      });
      onClose();
    } catch {
      onSave({ status, checkedIngredients: (status === 'partial' && hasChecklist) ? [...checkedIngredients] : undefined, extra: extra.trim() || undefined, altFood: status === 'other' ? altFood.trim() || undefined : undefined, tags: null, done: true });
      onClose();
    } finally {
      setTagsLoading(false);
    }
  };

  const canSave = status === 'done' || status === 'partial' || (status === 'other' && altFood.trim());

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Registrar ${MEAL_TYPE_LABELS[meal?.tipo] || 'comida'} — ${dayName}`}>
      <div className="space-y-4">
        {/* Planned meal */}
        {meal?.baby && (
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-xs font-medium text-gray-400 mb-1">Planificado</p>
            <p className="text-sm text-gray-700">{meal.baby}</p>
          </div>
        )}

        {/* Status selector */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">¿Qué pasó?</p>
          <div className="space-y-2">
            {[
              { id: 'done',    icon: '✓', label: 'Se lo comió todo',  active: 'border-green-400 bg-green-50 text-green-700' },
              { id: 'partial', icon: '◑', label: 'Comido parcial',    active: 'border-orange-400 bg-orange-50 text-orange-700' },
              { id: 'other',   icon: '↔', label: 'Comió otra cosa',   active: 'border-blue-400 bg-blue-50 text-blue-700' },
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setStatus(opt.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 font-medium text-sm transition-all ${
                  status === opt.id ? opt.active : 'border-gray-200 text-gray-500 hover:border-gray-300'
                }`}
              >
                <span className="text-base w-5 text-center">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Partial: ingredient checklist */}
        {status === 'partial' && hasChecklist && (
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">¿Qué comió? <span className="text-gray-400 font-normal">(marca lo que sí comió)</span></p>
            <div className="space-y-2 bg-gray-50 rounded-xl p-3">
              {ingredients.map(ing => (
                <label key={ing} className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkedIngredients.has(ing)}
                    onChange={() => toggleIngredient(ing)}
                    className="w-4 h-4 rounded accent-brand-600 shrink-0"
                  />
                  <span className="text-sm text-gray-700 capitalize">{ing}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Partial: no parseable ingredients — free text */}
        {status === 'partial' && !hasChecklist && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">¿Qué comió?</label>
            <input
              type="text"
              value={extra}
              onChange={e => setExtra(e.target.value)}
              placeholder="Ej: la verdura sí, el salmón no"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
        )}

        {/* Other: what they ate instead */}
        {status === 'other' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">¿Qué comió en su lugar?</label>
            <input
              type="text"
              value={altFood}
              onChange={e => setAltFood(e.target.value)}
              placeholder="Ej: tortilla de patata"
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
        )}

        {/* Extra food — all statuses (except partial without checklist which already used extra above) */}
        {status && !(status === 'partial' && !hasChecklist) && (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">
              ¿Comió algo más? <span className="font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={extra}
              onChange={e => setExtra(e.target.value)}
              placeholder="Ej: un trozo de pan, fruta..."
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-3 font-medium hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || tagsLoading}
            className="flex-1 bg-brand-600 text-white rounded-xl py-3 font-medium hover:bg-brand-700 transition-colors disabled:opacity-50"
          >
            {tagsLoading ? 'Analizando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
