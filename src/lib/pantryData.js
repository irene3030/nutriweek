export const PANTRY_CATEGORIES = [
  {
    id: 'aceites',
    label: 'Aceites y grasas',
    icon: 'Droplets',
    defaults: ['Aceite de oliva', 'Mantequilla', 'Aceite de coco'],
  },
  {
    id: 'aromaticos',
    label: 'Aromáticos',
    icon: 'Flower2',
    defaults: ['Ajo', 'Cebolla', 'Limón'],
  },
  {
    id: 'cereales',
    label: 'Cereales y carbohidratos',
    icon: 'Wheat',
    defaults: ['Arroz', 'Pasta', 'Avena', 'Pan', 'Harina'],
  },
  {
    id: 'lacteos',
    label: 'Lácteos y huevos',
    icon: 'Egg',
    defaults: ['Huevos', 'Yogur natural', 'Queso fresco'],
  },
  {
    id: 'conservas',
    label: 'Conservas',
    icon: 'Archive',
    defaults: ['Tomate triturado', 'Caldo'],
  },
  {
    id: 'especias',
    label: 'Especias',
    icon: 'Sparkles',
    defaults: ['Sal', 'Pimienta', 'Pimentón', 'Comino', 'Orégano', 'Canela'],
  },
];

export const DEFAULT_PANTRY_ITEMS = PANTRY_CATEGORIES.flatMap(c => c.defaults);
