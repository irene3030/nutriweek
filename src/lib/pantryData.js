export const PANTRY_CATEGORIES = [
  {
    id: 'aceites',
    label: 'Aceites y grasas',
    emoji: '🫒',
    defaults: ['Aceite de oliva', 'Mantequilla', 'Aceite de coco'],
  },
  {
    id: 'aromaticos',
    label: 'Aromáticos',
    emoji: '🧄',
    defaults: ['Ajo', 'Cebolla', 'Limón'],
  },
  {
    id: 'cereales',
    label: 'Cereales y carbohidratos',
    emoji: '🌾',
    defaults: ['Arroz', 'Pasta', 'Avena', 'Pan', 'Harina'],
  },
  {
    id: 'lacteos',
    label: 'Lácteos y huevos',
    emoji: '🥚',
    defaults: ['Huevos', 'Yogur natural', 'Queso fresco'],
  },
  {
    id: 'conservas',
    label: 'Conservas',
    emoji: '🥫',
    defaults: ['Tomate triturado', 'Caldo'],
  },
  {
    id: 'especias',
    label: 'Especias',
    emoji: '🌿',
    defaults: ['Sal', 'Pimienta', 'Pimentón', 'Comino', 'Orégano', 'Canela'],
  },
];

export const DEFAULT_PANTRY_ITEMS = PANTRY_CATEGORIES.flatMap(c => c.defaults);
