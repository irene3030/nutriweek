import { useState } from 'react';
import TagChip, { ALL_TAGS } from '../ui/TagChip';

const ALL_AVAILABLE = [...ALL_TAGS, 'carbs'];

const TAG_LABELS = {
  iron: 'Hierro',
  oily_fish: 'Pesc. graso',
  fish: 'Pescado',
  legume: 'Legumbre',
  egg: 'Huevo',
  dairy: 'Lácteo',
  fruit: 'Fruta',
  cereal: 'Cereal',
  carbs: 'Carbohidratos',
};

export default function TagConfirm({ value = [], onChange }) {
  const [veggieInput, setVeggieInput] = useState('');

  const toggle = (tag) => {
    const next = value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag];
    onChange(next);
  };

  const addVeggie = () => {
    const name = veggieInput.trim().toLowerCase().replace(/\s+/g, '_');
    if (!name) return;
    const tag = `veggie:${name}`;
    if (!value.includes(tag)) onChange([...value, tag]);
    setVeggieInput('');
  };

  const removeTag = (tag) => onChange(value.filter((t) => t !== tag));

  const veggieTags = value.filter((t) => t.startsWith('veggie:'));
  const otherTags = value.filter((t) => !t.startsWith('veggie:'));

  return (
    <div className="space-y-3">
      {/* Standard nutritional tags */}
      <div className="flex flex-wrap gap-2">
        {ALL_AVAILABLE.map((tag) => {
          const active = value.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${
                active
                  ? 'bg-brand-600 text-white border-brand-600'
                  : 'bg-white text-gray-500 border-gray-300 hover:border-gray-400'
              }`}
            >
              {TAG_LABELS[tag] || tag}
            </button>
          );
        })}
      </div>

      {/* Veggie tags already selected */}
      {veggieTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {veggieTags.map((t) => (
            <TagChip key={t} tag={t} onRemove={removeTag} small />
          ))}
        </div>
      )}

      {/* Add a veggie */}
      <div className="flex gap-2">
        <input
          type="text"
          value={veggieInput}
          onChange={(e) => setVeggieInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addVeggie())}
          placeholder="Añadir verdura (ej: boniato)"
          className="flex-1 text-sm border border-gray-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent"
        />
        <button
          type="button"
          onClick={addVeggie}
          disabled={!veggieInput.trim()}
          className="text-sm font-medium px-3 py-2 rounded-xl bg-lime-100 text-lime-700 hover:bg-lime-200 transition-colors disabled:opacity-40"
        >
          + Verdura
        </button>
      </div>
    </div>
  );
}
