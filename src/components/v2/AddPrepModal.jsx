import { useState, useEffect } from 'react';
import Modal from '../ui/Modal';
import TagConfirm from './TagConfirm';
import { inferLabels } from '../../lib/inventoryLabels';
import { daysUntil } from '../../hooks/useInventory';

const TYPES = [
  { id: 'ya-preparado', label: 'Ya preparado', desc: 'Listo para servir o calentar' },
  { id: 'acelerador',   label: 'Acelerador',   desc: 'Necesita algo justo-antes' },
  { id: 'snack-batch',  label: 'Snack batch',  desc: 'Pool de unidades (muffins, galletas…)' },
  { id: 'flotante',     label: 'Ingrediente',  desc: 'Disponible sin preparación asignada' },
];

const DEFAULT_SHELF_LIFE = {
  'ya-preparado': 4,
  acelerador: 5,
  'snack-batch': 5,
  flotante: 3,
};

const EMPTY = {
  name: '',
  type: 'ya-preparado',
  portionsAdult: 2,
  portionsBaby: 1,
  units: 6,
  amount: '',
  shelfLifeDays: 4,
  tags: [],
  notes: '',
};

export default function AddPrepModal({ isOpen, onClose, onSave, initialData = null }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const isEditing = !!initialData;

  // Reset/populate when modal opens
  useEffect(() => {
    if (!isOpen) return;
    if (initialData) {
      const remaining = initialData.expiresAt
        ? Math.max(1, daysUntil(initialData.expiresAt))
        : (DEFAULT_SHELF_LIFE[initialData.type] ?? 4);
      setForm({
        name: initialData.name || '',
        type: initialData.type || 'ya-preparado',
        portionsAdult: initialData.portionsAdult ?? 2,
        portionsBaby: initialData.portionsBaby ?? 1,
        units: initialData.units ?? 6,
        amount: initialData.amount || '',
        shelfLifeDays: remaining,
        tags: initialData.tags || [],
        notes: initialData.notes || '',
      });
    } else {
      setForm(EMPTY);
    }
    setStep(1);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Move to tag step; only infer tags for new items
  const handleNextStep = () => {
    if (!isEditing) {
      const inferred = inferLabels(form.name);
      setForm((f) => ({ ...f, tags: inferred }));
    }
    setStep(2);
  };

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const handleTypeChange = (type) => {
    setForm((f) => ({ ...f, type, shelfLifeDays: DEFAULT_SHELF_LIFE[type] ?? 4 }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const isSnack = form.type === 'snack-batch';
      const isFlotante = form.type === 'flotante';
      await onSave({
        name: form.name.trim(),
        type: form.type,
        portionsAdult: (isSnack || isFlotante) ? 0 : Number(form.portionsAdult) || 0,
        portionsBaby: (isSnack || isFlotante) ? 0 : Number(form.portionsBaby) || 0,
        units: isSnack ? Number(form.units) || 0 : 0,
        amount: isFlotante ? form.amount.trim() : '',
        shelfLifeDays: Number(form.shelfLifeDays) || 3,
        tags: form.tags,
        notes: form.notes.trim(),
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const isSnack = form.type === 'snack-batch';
  const isFlotante = form.type === 'flotante';
  const step1Valid = form.name.trim().length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={step === 1 ? (isEditing ? 'Editar preparación' : 'Nueva preparación') : 'Etiquetas nutricionales'}
      maxWidth="max-w-md"
    >
      {step === 1 ? (
        <div className="space-y-5 pb-2">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              ¿Qué has preparado?
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Ej: Alubias estofadas, Muffins de zanahoria…"
              autoFocus
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => handleTypeChange(t.id)}
                  className={`text-left p-3 rounded-xl border transition-colors ${
                    form.type === t.id
                      ? 'border-brand-500 bg-brand-50 text-brand-800'
                      : 'border-gray-200 hover:border-gray-300 text-gray-700'
                  }`}
                >
                  <p className="text-sm font-medium">{t.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-snug">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Portions or units */}
          <div className="grid grid-cols-2 gap-3">
            {isSnack ? (
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1.5">Unidades</label>
                <input
                  type="number"
                  min="1"
                  value={form.units}
                  onChange={(e) => set('units', e.target.value)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                />
              </div>
            ) : isFlotante ? (
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1.5">Cantidad disponible</label>
                <input
                  type="text"
                  value={form.amount}
                  onChange={(e) => set('amount', e.target.value)}
                  placeholder="Ej: 500g, 1 pack, 3 filetes, 2 aguacates…"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
                />
              </div>
            ) : (
              <>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Raciones adulto</label>
                  <input
                    type="number"
                    min="0"
                    value={form.portionsAdult}
                    onChange={(e) => set('portionsAdult', e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Raciones bebé</label>
                  <input
                    type="number"
                    min="0"
                    value={form.portionsBaby}
                    onChange={(e) => set('portionsBaby', e.target.value)}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  />
                </div>
              </>
            )}
          </div>

          {/* Shelf life */}
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Vida útil (días)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="1"
                max="30"
                value={form.shelfLifeDays}
                onChange={(e) => set('shelfLifeDays', e.target.value)}
                className="w-24 border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <span className="text-sm text-gray-500">días en nevera</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleNextStep}
            disabled={!step1Valid}
            className="w-full bg-brand-600 text-white rounded-xl py-3 font-medium hover:bg-brand-700 transition-colors disabled:opacity-40"
          >
            Siguiente → Etiquetas
          </button>
        </div>
      ) : (
        <div className="space-y-5 pb-2">
          <p className="text-sm text-gray-500 leading-relaxed">
            Etiquetas inferidas para <span className="font-medium text-gray-800">{form.name}</span>.
            Ajusta si es necesario.
          </p>

          <TagConfirm
            value={form.tags}
            onChange={(tags) => set('tags', tags)}
          />

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-3 font-medium hover:bg-gray-50 transition-colors"
            >
              ← Atrás
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-brand-600 text-white rounded-xl py-3 font-medium hover:bg-brand-700 transition-colors disabled:opacity-40"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
