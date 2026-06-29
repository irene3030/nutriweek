import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import TagConfirm from './TagConfirm';

export default function EditSlotItemModal({ isOpen, item, onClose, onSave }) {
  const [label, setLabel] = useState('');
  const [tags, setTags] = useState([]);
  const [prepTime, setPrepTime] = useState('');
  const [accelBase, setAccelBase] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && item) {
      setLabel(item.label || '');
      setTags(item.tags || []);
      setPrepTime(item.prepTime || '');
      setAccelBase(item.accelBase || '');
    }
  }, [isOpen, item]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = { label: label.trim(), tags };
      if (item?.itemType === 'acelerador') {
        updates.prepTime = prepTime.trim();
        updates.accelBase = accelBase.trim();
      }
      await onSave(updates);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar comida" maxWidth="max-w-md">
      <div className="space-y-4 pb-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            {item?.itemType === 'acelerador' ? 'Nota de preparación (opcional)' : 'Nombre'}
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            autoFocus
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
          />
        </div>

        {item?.itemType === 'acelerador' && (
          <>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Ingrediente</label>
              <input
                type="text"
                value={accelBase}
                onChange={(e) => setAccelBase(e.target.value)}
                placeholder="Ej: Brócoli al vapor"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Tiempo de preparación</label>
              <input
                type="text"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
                placeholder="Ej: 10 min"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
              />
            </div>
          </>
        )}

        <TagConfirm value={tags} onChange={setTags} />

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-3 font-medium hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !label.trim()}
            className="flex-1 bg-brand-600 text-white rounded-xl py-3 font-medium hover:bg-brand-700 transition-colors disabled:opacity-40"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
