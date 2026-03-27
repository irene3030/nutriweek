import { describe, it, expect } from 'vitest';
import { generateShoppingList, formatShoppingListText } from '../shopping.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function meal(baby, adult = '') {
  return { tipo: 'comida', baby, adult, tags: [] };
}

function week(...dayMeals) {
  return {
    days: dayMeals.map((meals, i) => ({
      day: ['Lun', 'Mar', 'Mié', 'Jue', 'Vie'][i] || `Día${i}`,
      meals,
    })),
  };
}

// ─── generateShoppingList ─────────────────────────────────────────────────────

describe('generateShoppingList', () => {
  it('devuelve listas vacías si weekDoc es null', () => {
    const result = generateShoppingList(null);
    expect(result.categories['proteína animal']).toEqual([]);
    expect(result.categories.verdura).toEqual([]);
    expect(result.categories.fruta).toEqual([]);
    expect(result.categories.despensa).toEqual([]);
    expect(result.atHome).toEqual([]);
  });

  it('detecta proteína animal', () => {
    const w = week([meal('salmón con patatas')]);
    const result = generateShoppingList(w);
    expect(result.categories['proteína animal']).toContain('salmón');
  });

  it('detecta verduras', () => {
    const w = week([meal('brócoli al vapor con zanahoria')]);
    const result = generateShoppingList(w);
    expect(result.categories.verdura).toContain('brócoli');
    expect(result.categories.verdura).toContain('zanahoria');
  });

  it('detecta fruta', () => {
    const w = week([meal('manzana troceada y kiwi')]);
    const result = generateShoppingList(w);
    expect(result.categories.fruta).toContain('manzana');
    expect(result.categories.fruta).toContain('kiwi');
  });

  it('detecta despensa', () => {
    const w = week([meal('lentejas con arroz')]);
    const result = generateShoppingList(w);
    expect(result.categories.despensa).toContain('arroz');
    expect(result.categories.despensa).toContain('lentejas');
  });

  it('no duplica ingredientes que aparecen varios días', () => {
    const w = week(
      [meal('pollo con zanahoria')],
      [meal('pollo al horno')],
    );
    const result = generateShoppingList(w);
    expect(result.categories['proteína animal'].filter(i => i === 'pollo')).toHaveLength(1);
  });

  it('mueve ingredientes disponibles en casa a atHome', () => {
    const w = week([meal('pollo con zanahoria')]);
    const result = generateShoppingList(w, 'pollo');
    expect(result.atHome).toContain('pollo');
    expect(result.categories['proteína animal']).not.toContain('pollo');
  });

  it('extrae ingredientes también del campo adult', () => {
    const w = week([{ tipo: 'comida', baby: 'puré de zanahoria', adult: 'salmón a la plancha', tags: [] }]);
    const result = generateShoppingList(w);
    expect(result.categories.verdura).toContain('zanahoria');
    expect(result.categories['proteína animal']).toContain('salmón');
  });

  it('cada categoría está ordenada alfabéticamente', () => {
    const w = week([meal('zanahoria, brócoli, boniato')]);
    const { verdura } = generateShoppingList(w).categories;
    expect(verdura).toEqual([...verdura].sort());
  });
});

// ─── formatShoppingListText ───────────────────────────────────────────────────

describe('formatShoppingListText', () => {
  it('incluye el label de la semana si se pasa', () => {
    const list = { categories: { 'proteína animal': [], verdura: [], fruta: [], despensa: [] }, atHome: [] };
    const text = formatShoppingListText(list, 'Semana del 24 de marzo');
    expect(text).toContain('Semana del 24 de marzo');
  });

  it('lista ingredientes por categoría', () => {
    const list = {
      categories: { 'proteína animal': ['pollo'], verdura: ['brócoli'], fruta: [], despensa: [] },
      atHome: [],
    };
    const text = formatShoppingListText(list);
    expect(text).toContain('pollo');
    expect(text).toContain('brócoli');
  });

  it('incluye sección "ya tienes en casa" si hay items', () => {
    const list = {
      categories: { 'proteína animal': [], verdura: [], fruta: [], despensa: [] },
      atHome: ['zanahoria'],
    };
    const text = formatShoppingListText(list);
    expect(text).toContain('YA TIENES EN CASA');
    expect(text).toContain('zanahoria');
  });

  it('no incluye categorías vacías', () => {
    const list = {
      categories: { 'proteína animal': ['pollo'], verdura: [], fruta: [], despensa: [] },
      atHome: [],
    };
    const text = formatShoppingListText(list);
    expect(text).not.toContain('VERDURA');
    expect(text).not.toContain('FRUTA');
  });
});
