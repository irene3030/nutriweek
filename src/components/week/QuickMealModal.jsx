import { useState } from 'react';
import Modal from '../ui/Modal';
import { quickMeal } from '../../lib/claude';
import { track } from '../../lib/analytics';
import { Zap, Leaf, Check, ClipboardList, CalendarDays, RotateCcw, Sparkles } from 'lucide-react';

const REQUIREMENTS = [
  { id: 'hierro', label: 'Hierro' },
  { id: 'pescado graso', label: 'Pescado graso' },
  { id: 'legumbre', label: 'Legumbre' },
  { id: 'verdura', label: 'Verdura' },
  { id: 'huevo', label: 'Huevo' },
  { id: 'fruta', label: 'Fruta' },
];

const DAY_ORDER = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const TIPOS = ['desayuno', 'snack', 'comida', 'merienda', 'cena'];

export default function QuickMealModal({ isOpen, onClose, apiKey, hasAiAccess, currentWeek, onAddToWeek }) {
  const [ingredients, setIngredients] = useState('');
  const [requirements, setRequirements] = useState([]);
  const [prepTime, setPrepTime] = useState(null); // null | 15 | 30
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showAddToWeek, setShowAddToWeek] = useState(false);
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedTipo, setSelectedTipo] = useState('comida');
  const [addedConfirm, setAddedConfirm] = useState(false);

  const toggleReq = (id) => {
    setRequirements(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
    );
  };

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await quickMeal({ ingredients, requirements, prepTime, apiKey });
      setResult(res);
      track('quick_meal_generated', { tags: res.tags || [] });
    } catch (err) {
      setError(
        err.message === 'NO_API_KEY' ? 'Añade tu API key en Perfil para usar esta función.' :
        err.message === 'CALL_LIMIT_EXCEEDED' ? 'Has alcanzado el límite mensual de llamadas. Auméntalo en Perfil.' :
        err.message === 'FREE_QUOTA_EXCEEDED' ? 'Has agotado las 30 llamadas gratuitas. Añade tu API key en Perfil.' :
        err.message || 'Error generando la comida.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.baby);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddToWeek = () => {
    if (!result || !selectedDay || !selectedTipo || !onAddToWeek) return;
    onAddToWeek(selectedDay, selectedTipo, { baby: result.baby, adult: result.adult, tags: result.tags });
    track('quick_meal_added_to_week', { day: selectedDay, meal_type: selectedTipo });
    setAddedConfirm(true);
    setShowAddToWeek(false);
    setTimeout(() => setAddedConfirm(false), 2500);
  };

  const handleClose = () => {
    setIngredients('');
    setRequirements([]);
    setPrepTime(null);
    setResult(null);
    setError(null);
    setShowAddToWeek(false);
    setAddedConfirm(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={<span className="flex items-center gap-1.5"><Zap className="w-4 h-4" /> Comida rápida para bebé</span>} maxWidth="max-w-md">
      <div className="space-y-4">
        {/* Ingredients */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ingredientes disponibles <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <input
            type="text"
            value={ingredients}
            onChange={e => setIngredients(e.target.value)}
            placeholder="Ej: salmón, patata, brócoli..."
            className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
          />
        </div>

        {/* Requirements */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Requisitos nutricionales <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {REQUIREMENTS.map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => toggleReq(r.id)}
                className={`text-xs px-3 py-1.5 rounded border font-medium transition-colors ${
                  requirements.includes(r.id)
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* Prep time */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tiempo de preparación <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <div className="flex gap-2">
            {[
              { value: 15, label: '< 15 min', Icon: Zap },
              { value: 30, label: '< 30 min' },
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPrepTime(prev => prev === opt.value ? null : opt.value)}
                className={`text-xs px-3 py-1.5 rounded border font-medium transition-colors ${
                  prepTime === opt.value
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400'
                }`}
              >
                {opt.Icon ? <span className="flex items-center gap-1"><opt.Icon className="w-3 h-3" />{opt.label}</span> : opt.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="bg-brand-50 border border-brand-200 rounded-xl p-4 space-y-2">
            <div>
              <p className="text-sm text-gray-800">{result.baby}</p>
            </div>
            {result.tags?.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {result.tags.map(tag => (
                  <span key={tag} className="text-xs bg-white border border-brand-200 text-brand-700 rounded px-2 py-0.5">
                    {tag.startsWith('veggie:') ? <span className="flex items-center gap-0.5"><Leaf className="w-3 h-3" /> Verdura</span> : tag}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-3 mt-1">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 font-medium transition-colors"
              >
                {copied ? <><Check className="w-3.5 h-3.5 inline mr-0.5" />Copiado</> : <><ClipboardList className="w-3.5 h-3.5 inline mr-0.5" />Copiar</>}
              </button>
              {currentWeek && onAddToWeek && (
                <button
                  onClick={() => setShowAddToWeek(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-brand-600 hover:text-brand-800 font-medium transition-colors"
                >
                  {addedConfirm ? <><Check className="w-3.5 h-3.5 inline mr-0.5" />Añadida</> : <><CalendarDays className="w-3.5 h-3.5 inline mr-0.5" />Incluir en semana</>}
                </button>
              )}
            </div>

            {showAddToWeek && currentWeek && (
              <div className="border-t border-brand-100 pt-3 space-y-2">
                <p className="text-xs font-medium text-gray-600">¿En qué día y franja?</p>
                <div className="flex flex-wrap gap-1">
                  {[...currentWeek.days]
                    .sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day))
                    .map(d => (
                      <button
                        key={d.day}
                        type="button"
                        onClick={() => setSelectedDay(d.day)}
                        className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                          selectedDay === d.day
                            ? 'bg-brand-600 text-white border-brand-600'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400'
                        }`}
                      >
                        {d.day}
                      </button>
                    ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {TIPOS.map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTipo(t)}
                      className={`text-xs px-2.5 py-1 rounded border transition-colors capitalize ${
                        selectedTipo === t
                          ? 'bg-brand-600 text-white border-brand-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleAddToWeek}
                  disabled={!selectedDay}
                  className="w-full bg-brand-600 text-white rounded-lg py-1.5 text-xs font-medium hover:bg-brand-700 transition-colors disabled:opacity-40"
                >
                  Añadir
                </button>
              </div>
            )}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <button
            onClick={handleClose}
            className="flex-1 border border-gray-300 text-gray-700 rounded-xl py-2.5 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cerrar
          </button>
          <button
            onClick={handleGenerate}
            disabled={loading || !hasAiAccess}
            title={!hasAiAccess ? 'Necesitas una API key o un código Friends & Family en Perfil' : undefined}
            className="flex-1 bg-brand-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-brand-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading
              ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Generando...</>
              : result ? <><RotateCcw className="w-4 h-4" /> Regenerar</> : <><Sparkles className="w-4 h-4" /> Generar</>
            }
          </button>
        </div>
      </div>
    </Modal>
  );
}
