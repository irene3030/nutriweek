import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';

export default function TrackModal({ isOpen, onClose, meal, dayName, onSave }) {
  const [done, setDone] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (meal?.track) {
      setDone(meal.track.done || false);
      setNote(meal.track.note || '');
    } else {
      setDone(false);
      setNote('');
    }
  }, [meal, isOpen]);

  const handleSave = () => {
    onSave({ done, note: note.trim() });
    onClose();
  };

  const MEAL_TYPE_LABELS = {
    desayuno: 'Desayuno',
    snack: 'Snack AM',
    comida: 'Comida',
    merienda: 'Merienda',
    cena: 'Cena',
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Registrar ${MEAL_TYPE_LABELS[meal?.tipo] || 'comida'} - ${dayName}`}
    >
      <div className="space-y-4">
        {meal?.baby && (
          <div className="bg-gray-50 rounded-xl px-4 py-3">
            <p className="text-xs font-medium text-gray-400 mb-1">Planificado</p>
            <p className="text-sm text-gray-700">{meal.baby}</p>
          </div>
        )}

        {/* Done toggle */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">¿Se lo comió?</p>
          <div className="flex gap-2">
            <button
              onClick={() => setDone(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-medium text-sm transition-all ${
                done
                  ? 'border-green-400 bg-green-50 text-green-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <span>✓</span>
              Sí, se lo comió
            </button>
            <button
              onClick={() => setDone(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border-2 font-medium text-sm transition-all ${
                !done
                  ? 'border-red-300 bg-red-50 text-red-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              <span>✗</span>
              No / Parcial
            </button>
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nota (opcional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej: Se lo comió todo menos el brócoli. Le encantó el salmón."
            rows={3}
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent resize-none"
          />
        </div>

        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-3 font-medium hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-brand-600 text-white rounded-xl py-3 font-medium hover:bg-brand-700 transition-colors"
          >
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  );
}
