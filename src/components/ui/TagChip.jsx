import { Droplets, Fish, Bean, Egg, GlassWater, Cherry, Wheat, Leaf } from 'lucide-react';

const TAG_CONFIG = {
  iron:      { label: 'Hierro',      color: 'bg-orange-100 text-orange-700 border-orange-200', Icon: Droplets },
  fish:      { label: 'Pescado',     color: 'bg-blue-100 text-blue-700 border-blue-200',       Icon: Fish },
  oily_fish: { label: 'Pesc. graso', color: 'bg-blue-200 text-blue-800 border-blue-300',       Icon: Fish },
  legume:    { label: 'Legumbre',    color: 'bg-green-100 text-green-700 border-green-200',    Icon: Bean },
  egg:       { label: 'Huevo',       color: 'bg-yellow-100 text-yellow-700 border-yellow-200', Icon: Egg },
  dairy:     { label: 'Lácteo',      color: 'bg-sky-100 text-sky-700 border-sky-200',          Icon: GlassWater },
  fruit:     { label: 'Fruta',       color: 'bg-pink-100 text-pink-700 border-pink-200',       Icon: Cherry },
  cereal:    { label: 'Cereal',      color: 'bg-amber-100 text-amber-700 border-amber-200',    Icon: Wheat },
};

function getTagConfig(tag) {
  if (TAG_CONFIG[tag]) return TAG_CONFIG[tag];
  if (tag === 'veggie' || tag.startsWith('veggie:')) {
    return {
      label: 'Verdura',
      color: 'bg-lime-100 text-lime-700 border-lime-200',
      Icon: Leaf,
    };
  }
  return { label: tag, color: 'bg-gray-100 text-gray-600 border-gray-200', Icon: null };
}

export default function TagChip({ tag, onRemove, small = false }) {
  const { label, color, Icon } = getTagConfig(tag);

  return (
    <span
      className={`inline-flex items-center gap-1 border rounded font-medium ${color} ${
        small ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-1'
      }`}
    >
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      {label}
      {onRemove && (
        <button
          onClick={() => onRemove(tag)}
          className="ml-0.5 hover:opacity-70 transition-opacity"
          aria-label={`Quitar ${label}`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </span>
  );
}

export const ALL_TAGS = ['iron', 'oily_fish', 'fish', 'legume', 'egg', 'dairy', 'fruit', 'cereal'];
export { getTagConfig, TAG_CONFIG };
