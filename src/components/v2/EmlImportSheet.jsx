import { useRef, useState } from 'react';
import { AlertCircle, Check, Loader2, Upload, X } from 'lucide-react';
import { parseShoppingEmail } from '../../lib/claude';
import { parseEml } from '../../lib/emlParser';
import { getTagConfig } from '../ui/TagChip';

const TYPES = [
  { id: 'flotante',     label: 'Ingred.' },
  { id: 'ya-preparado', label: 'Preparado' },
  { id: 'acelerador',   label: 'Acelerador' },
  { id: 'snack-batch',  label: 'Snack' },
];

const DEFAULT_SHELF_LIFE = {
  'ya-preparado': 4,
  acelerador: 5,
  'snack-batch': 5,
  flotante: 3,
};

const ALL_STANDARD_TAGS = ['iron', 'oily_fish', 'fish', 'legume', 'egg', 'dairy', 'fruit', 'cereal'];

const TAG_LABELS = {
  iron: 'Hierro', oily_fish: 'Pesc. graso', fish: 'Pescado',
  legume: 'Legumbre', egg: 'Huevo', dairy: 'Lácteo', fruit: 'Fruta', cereal: 'Cereal',
};

function tagLabel(tag) {
  if (tag.startsWith('veggie:')) return tag.replace('veggie:', '');
  return TAG_LABELS[tag] || tag;
}

let _idCounter = 0;
function nextId() { return `eml-${++_idCounter}`; }

function mapAiItems(raw) {
  return raw.map(item => ({
    id: nextId(),
    name: typeof item.name === 'string' ? item.name : '',
    type: TYPES.some(t => t.id === item.type) ? item.type : 'flotante',
    tags: Array.isArray(item.tags) ? item.tags : [],
    amount: typeof item.amount === 'string' ? item.amount : '',
    selected: true,
  }));
}

function ItemCard({ item, onChange, onRemove }) {
  // Always show standard tags; show any veggie tags the AI suggested
  const allTags = [
    ...ALL_STANDARD_TAGS,
    ...item.tags.filter(t => t.startsWith('veggie:')),
  ];

  return (
    <div className={`bg-white border border-gray-100 rounded-xl p-3 space-y-2 transition-opacity ${!item.selected ? 'opacity-40' : ''}`}>
      {/* Name row */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={item.selected}
          onChange={e => onChange({ ...item, selected: e.target.checked })}
          className="w-4 h-4 rounded shrink-0 accent-brand-600"
        />
        <input
          value={item.name}
          onChange={e => onChange({ ...item, name: e.target.value })}
          className="flex-1 min-w-0 text-sm font-medium text-gray-900 bg-transparent focus:outline-none focus:ring-1 focus:ring-brand-400 rounded px-1 -mx-1"
        />
        <button
          onClick={onRemove}
          className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-gray-500 shrink-0"
          aria-label="Eliminar"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Type selector */}
      <div className="flex gap-1 pl-6">
        {TYPES.map(t => (
          <button
            key={t.id}
            onClick={() => onChange({ ...item, type: t.id })}
            className={`text-xs px-2 py-1 rounded-lg border font-medium transition-colors ${
              item.type === t.id
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300 hover:text-gray-600'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Amount — only for flotante */}
      {item.type === 'flotante' && (
        <div className="pl-6">
          <input
            value={item.amount}
            onChange={e => onChange({ ...item, amount: e.target.value })}
            placeholder="Cantidad (ej: 500g, 1 pack, 2 filetes…)"
            className="w-full text-xs text-gray-600 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>
      )}

      {/* Tags */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-1 pl-6">
          {allTags.map(tag => {
            const active = item.tags.includes(tag);
            const color = active ? getTagConfig(tag).color : 'bg-gray-50 text-gray-300 border-gray-100';
            return (
              <button
                key={tag}
                onClick={() => {
                  const next = active
                    ? item.tags.filter(t => t !== tag)
                    : [...item.tags, tag];
                  onChange({ ...item, tags: next });
                }}
                className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${color}`}
              >
                {tagLabel(tag)}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function EmlImportSheet({ onClose, onImport }) {
  const fileRef = useRef(null);
  const [step, setStep] = useState('pick'); // 'pick' | 'loading' | 'review'
  const [items, setItems] = useState([]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so the same file can be re-selected
    e.target.value = '';
    setError(null);
    setStep('loading');
    try {
      const raw = await file.text();
      const emailText = parseEml(raw);
      if (!emailText.trim()) throw new Error('No se pudo extraer contenido. ¿Es un .eml válido?');
      const result = await parseShoppingEmail({ emailText });
      const aiItems = Array.isArray(result?.items) ? result.items : [];
      if (aiItems.length === 0) throw new Error('No se encontraron productos alimentarios en el email.');
      setItems(mapAiItems(aiItems));
      setStep('review');
    } catch (err) {
      setError(err.message || 'Error al analizar el archivo');
      setStep('pick');
    }
  }

  function updateItem(id, updated) {
    setItems(prev => prev.map(i => i.id === id ? updated : i));
  }

  function removeItem(id) {
    setItems(prev => prev.filter(i => i.id !== id));
  }

  const selectedItems = items.filter(i => i.selected && i.name.trim());

  async function handleConfirm() {
    if (!selectedItems.length) return;
    setSaving(true);
    try {
      const toAdd = selectedItems.map(item => ({
        name: item.name.trim(),
        type: item.type,
        portionsAdult: item.type === 'snack-batch' || item.type === 'flotante' ? 0 : 2,
        portionsBaby:  item.type === 'snack-batch' || item.type === 'flotante' ? 0 : 1,
        units:  item.type === 'snack-batch' ? 6 : 0,
        amount: item.type === 'flotante' ? item.amount.trim() : '',
        shelfLifeDays: DEFAULT_SHELF_LIFE[item.type] ?? 3,
        tags:  item.tags,
        notes: '',
      }));
      await onImport(toAdd);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-30" onClick={onClose} />

      <div className="fixed inset-x-0 bottom-0 z-40 bg-gray-50 rounded-t-3xl max-h-[90vh] flex flex-col lg:left-1/2 lg:right-auto lg:-translate-x-1/2 lg:bottom-auto lg:top-[5vh] lg:w-full lg:max-w-[560px] lg:rounded-2xl">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 bg-gray-300 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0">
          <h2 className="text-base font-semibold text-gray-900">
            {step === 'review'
              ? `${items.length} productos encontrados`
              : 'Importar compra online'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 pb-4 min-h-0">
          {step === 'pick' && (
            <div className="space-y-4 py-2">
              <p className="text-sm text-gray-600 leading-relaxed">
                Sube el email de confirmación de tu pedido online en formato .eml.
                La IA identificará los alimentos y los clasificará en tu inventario.
              </p>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">
                  <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              )}

              <button
                onClick={() => fileRef.current?.click()}
                className="w-full flex flex-col items-center gap-3 border-2 border-dashed border-gray-300 rounded-2xl py-10 hover:border-brand-400 hover:bg-brand-50 transition-colors"
              >
                <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center">
                  <Upload className="w-6 h-6 text-brand-600" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-gray-900">Seleccionar archivo .eml</p>
                  <p className="text-xs text-gray-400 mt-0.5">En Gmail: ⋮ → Descargar mensaje</p>
                </div>
              </button>

              <input
                ref={fileRef}
                type="file"
                accept=".eml,message/rfc822"
                className="hidden"
                onChange={handleFile}
              />
            </div>
          )}

          {step === 'loading' && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
              <p className="text-sm text-gray-500">Analizando tu pedido…</p>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-2 py-2">
              <p className="text-xs text-gray-400 pb-1">
                Desmarca lo que no quieras añadir · ajusta el tipo si es necesario · toca las etiquetas para activarlas o desactivarlas
              </p>
              {items.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onChange={updated => updateItem(item.id, updated)}
                  onRemove={() => removeItem(item.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer — only in review step */}
        {step === 'review' && (
          <div className="shrink-0 px-4 pb-6 pt-3 border-t border-gray-100 bg-gray-50">
            <button
              onClick={handleConfirm}
              disabled={selectedItems.length === 0 || saving}
              className="w-full bg-brand-600 text-white rounded-xl py-3 font-medium hover:bg-brand-700 transition-colors disabled:opacity-40 flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              {saving
                ? 'Añadiendo…'
                : `Añadir ${selectedItems.length} al inventario`}
            </button>
          </div>
        )}
      </div>
    </>
  );
}
