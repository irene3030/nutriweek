import { useState, useEffect, useRef } from 'react';
import {
  collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy,
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { ALL_TAGS } from '../ui/TagChip';
import { analyzeMealPhoto, detectTags } from '../../lib/claude';

const TAG_LABELS = {
  iron: '🩸 Hierro', fish: '🐟 Pescado', legume: '🟢 Legumbre',
  egg: '🟡 Huevo', dairy: '🥛 Lácteo', fruit: '🍓 Fruta',
  cereal: '🌾 Cereal', veggie: '🥦 Verdura',
};

function tagLabel(tag) {
  if (tag.startsWith('veggie:')) return `🥦 ${tag.slice(7)}`;
  return TAG_LABELS[tag] || tag;
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 900;
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          const reader = new FileReader();
          reader.onload = () => resolve({
            base64: reader.result.split(',')[1],
            previewUrl: reader.result,
          });
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        0.78,
      );
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function UsualMeals({ householdId, apiKey, hasAiAccess, onAddToWeek }) {
  const [meals, setMeals] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', baby: '', adult: '', tags: [] });
  const [saving, setSaving] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectError, setDetectError] = useState(null);

  const [photoPreview, setPhotoPreview] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState(null);
  const [detected, setDetected] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

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
      resetForm();
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

  const resetForm = () => {
    setForm({ name: '', baby: '', adult: '', tags: [] });
    setPhotoPreview(null);
    setAnalyzeError(null);
    setDetected(false);
    setDetectError(null);
    setShowForm(false);
  };

  const handleDetectTags = async () => {
    const text = [form.name, form.baby, form.adult].filter(Boolean).join('. ');
    if (!text.trim()) return;
    setDetecting(true);
    setDetectError(null);
    try {
      const result = await detectTags({ text, apiKey });
      setForm(prev => ({ ...prev, tags: result.tags || [] }));
    } catch (err) {
      setDetectError(
        err.message === 'NO_API_KEY' ? 'Necesitas una API key o código de invitación en Perfil.' :
        err.message === 'FREE_QUOTA_EXCEEDED' ? 'Has agotado las llamadas gratuitas.' :
        'Error detectando tags.'
      );
    } finally {
      setDetecting(false);
    }
  };

  const processPhoto = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setAnalyzeError(null);
    setDetected(false);

    let resized;
    try {
      resized = await resizeImage(file);
    } catch {
      setAnalyzeError('No se pudo procesar la imagen.');
      return;
    }
    setPhotoPreview(resized.previewUrl);

    if (!hasAiAccess) {
      setAnalyzeError('Añade tu API key en Perfil para autorellenar desde foto.');
      return;
    }

    setAnalyzing(true);
    try {
      const result = await analyzeMealPhoto({
        imageBase64: resized.base64,
        mimeType: 'image/jpeg',
        apiKey,
      });
      if (result?.name) {
        const validTags = (result.tags || []).filter(t =>
          t.startsWith('veggie:') || [...ALL_TAGS, 'veggie'].includes(t)
        );
        setForm(prev => ({ ...prev, name: result.name, tags: validTags }));
        setDetected(true);
      } else {
        setAnalyzeError('No se reconoció el plato. Rellena el nombre manualmente.');
      }
    } catch (err) {
      setAnalyzeError(
        err.message === 'NO_API_KEY' ? 'Añade tu API key en Perfil para autorellenar desde foto.' :
        err.message === 'FREE_QUOTA_EXCEEDED' ? 'Has agotado las llamadas gratuitas.' :
        'No se pudo analizar la foto. Rellena el nombre manualmente.'
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processPhoto(file);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processPhoto(file);
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
                      {tagLabel(t)}
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

          {/* Photo autofill */}
          <div
            className={`rounded-xl border-2 border-dashed transition-colors ${
              dragOver ? 'border-brand-400 bg-brand-50' : 'border-gray-200'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            {photoPreview ? (
              <div className="flex items-center gap-3 p-2">
                <img
                  src={photoPreview}
                  alt="Foto"
                  className="w-14 h-14 object-cover rounded-lg shrink-0"
                />
                <div className="flex-1 min-w-0">
                  {analyzing ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <div className="w-3.5 h-3.5 border-2 border-gray-300 border-t-brand-500 rounded-full animate-spin shrink-0" />
                      Analizando foto...
                    </div>
                  ) : detected ? (
                    <p className="text-sm text-green-700 font-medium">✓ Campos rellenados automáticamente</p>
                  ) : (
                    <p className="text-sm text-gray-500">Vista previa</p>
                  )}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs text-brand-600 hover:text-brand-800 mt-0.5"
                  >
                    Cambiar foto
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 rounded-xl transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-brand-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Autorellenar desde foto</p>
                  <p className="text-xs text-gray-400">La IA detecta el plato y marca los tags</p>
                </div>
              </button>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {analyzeError && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">{analyzeError}</p>
          )}

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
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-xs text-gray-500">Tags nutricionales</p>
              {hasAiAccess && (
                <button
                  type="button"
                  onClick={handleDetectTags}
                  disabled={detecting || (!form.name.trim() && !form.baby.trim())}
                  className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-800 disabled:opacity-40 transition-colors"
                >
                  {detecting
                    ? <><div className="w-3 h-3 border border-brand-400 border-t-transparent rounded-full animate-spin" /> Detectando...</>
                    : '✨ Detectar automáticamente'
                  }
                </button>
              )}
            </div>
            {detectError && (
              <p className="text-xs text-amber-600 mb-1.5">{detectError}</p>
            )}
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
              onClick={resetForm}
              className="flex-1 border border-gray-300 text-gray-600 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim() || analyzing}
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
