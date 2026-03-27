import { describe, it, expect } from 'vitest';
import { calculateKPIs, computeAdaptiveTargets } from '../kpis.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function meal(tipo, baby, tags = []) {
  return { tipo, baby, adult: '', tags, track: null };
}

function day(name, meals) {
  return { day: name, meals };
}

function week(...days) {
  return { days };
}

// ─── calculateKPIs ───────────────────────────────────────────────────────────

describe('calculateKPIs', () => {
  it('devuelve ceros para semana vacía', () => {
    const result = calculateKPIs(null);
    expect(result.ironDays).toBe(0);
    expect(result.fishDays).toBe(0);
    expect(result.legumedDays).toBe(0);
    expect(result.fruitDays).toBe(0);
    expect(result.distinctVeggies).toBe(0);
    expect(result.veggieList).toEqual([]);
  });

  it('devuelve ceros para semana sin días', () => {
    expect(calculateKPIs({ days: [] }).ironDays).toBe(0);
  });

  describe('ironDays', () => {
    it('cuenta días con tag iron', () => {
      const w = week(
        day('Lun', [meal('comida', 'pollo', ['iron'])]),
        day('Mar', [meal('comida', 'pasta', [])]),
        day('Mié', [meal('comida', 'ternera', ['iron'])]),
      );
      expect(calculateKPIs(w).ironDays).toBe(2);
    });

    it('solo cuenta una vez por día aunque haya varias comidas con iron', () => {
      const w = week(
        day('Lun', [
          meal('comida', 'pollo', ['iron']),
          meal('cena', 'ternera', ['iron']),
        ]),
      );
      expect(calculateKPIs(w).ironDays).toBe(1);
    });
  });

  describe('fishDays', () => {
    it('cuenta días con tag fish', () => {
      const w = week(
        day('Lun', [meal('comida', 'salmón', ['fish'])]),
        day('Mar', [meal('comida', 'pollo', ['iron'])]),
      );
      expect(calculateKPIs(w).fishDays).toBe(1);
    });
  });

  describe('legumedDays', () => {
    it('cuenta días con tag legume', () => {
      const w = week(
        day('Lun', [meal('comida', 'lentejas', ['legume', 'iron'])]),
        day('Mar', [meal('comida', 'garbanzos', ['legume', 'iron'])]),
        day('Mié', [meal('comida', 'pasta', [])]),
      );
      expect(calculateKPIs(w).legumedDays).toBe(2);
    });
  });

  describe('fruitDays', () => {
    it('cuenta días con tag fruit', () => {
      const w = week(
        day('Lun', [meal('snack', 'manzana', ['fruit'])]),
        day('Mar', [meal('snack', 'yogur', [])]),
      );
      expect(calculateKPIs(w).fruitDays).toBe(1);
    });
  });

  describe('verduras', () => {
    it('cuenta verduras distintas por tags veggie:nombre', () => {
      const w = week(
        day('Lun', [meal('comida', 'brócoli y zanahoria', ['veggie:brócoli', 'veggie:zanahoria'])]),
        day('Mar', [meal('comida', 'brócoli con arroz', ['veggie:brócoli'])]),
      );
      const result = calculateKPIs(w);
      expect(result.distinctVeggies).toBe(2);
      expect(result.veggieList).toEqual(expect.arrayContaining(['brócoli', 'zanahoria']));
    });

    it('no cuenta duplicados aunque aparezcan varios días', () => {
      const w = week(
        day('Lun', [meal('comida', 'brócoli', ['veggie:brócoli'])]),
        day('Mar', [meal('comida', 'brócoli', ['veggie:brócoli'])]),
      );
      expect(calculateKPIs(w).distinctVeggies).toBe(1);
    });

    it('normaliza a minúsculas', () => {
      const w = week(
        day('Lun', [meal('comida', 'Brócoli', ['veggie:Brócoli'])]),
        day('Mar', [meal('comida', 'brócoli', ['veggie:brócoli'])]),
      );
      expect(calculateKPIs(w).distinctVeggies).toBe(1);
    });
  });

  describe('rotación de proteínas', () => {
    it('no genera alerta si la misma proteína aparece solo 2 días seguidos', () => {
      const w = week(
        day('Lun', [meal('comida', 'pollo', ['iron'])]),
        day('Mar', [meal('comida', 'pollo', ['iron'])]),
        day('Mié', [meal('comida', 'pasta', [])]),
      );
      expect(calculateKPIs(w).consecutiveAlerts).toHaveLength(0);
    });

    it('genera alerta si la misma proteína aparece 3 días seguidos', () => {
      const w = week(
        day('Lun', [meal('comida', 'pollo', ['iron'])]),
        day('Mar', [meal('comida', 'pollo', ['iron'])]),
        day('Mié', [meal('comida', 'pollo', ['iron'])]),
        day('Jue', [meal('comida', 'ternera', ['iron'])]),
      );
      const alerts = calculateKPIs(w).consecutiveAlerts;
      expect(alerts).toHaveLength(1);
      expect(alerts[0].protein).toBe('iron');
      expect(alerts[0].startDay).toBe('Lun');
    });
  });

  describe('KPIs custom', () => {
    it('cuenta días donde aparece la query en texto', () => {
      const w = week(
        day('Lun', [meal('comida', 'salmón con brócoli', [])]),
        day('Mar', [meal('comida', 'lentejas estofadas', [])]),
        day('Mié', [meal('comida', 'salmón al vapor', [])]),
      );
      const custom = [{ id: 'custom_salmon', name: 'Salmón', query: 'salmón', target: 2 }];
      expect(calculateKPIs(w, custom).customResults['custom_salmon']).toBe(2);
    });

    it('devuelve 0 si la query no aparece', () => {
      const w = week(day('Lun', [meal('comida', 'pollo', ['iron'])]));
      const custom = [{ id: 'custom_tofu', name: 'Tofu', query: 'tofu', target: 1 }];
      expect(calculateKPIs(w, custom).customResults['custom_tofu']).toBe(0);
    });
  });
});

// ─── computeAdaptiveTargets ──────────────────────────────────────────────────

describe('computeAdaptiveTargets', () => {
  it('devuelve defaults si weekDoc es null', () => {
    const result = computeAdaptiveTargets(null);
    expect(result.ironTarget).toBe(5);
    expect(result.fishTarget).toBe(3);
    expect(result.veggieTarget).toBe(5);
    expect(result.legumeTarget).toBe(3);
  });

  it('ironTarget y fishTarget son null si no hay comida ni cena', () => {
    const w = week(
      day('Lun', [meal('desayuno', 'avena', [])]),
      day('Mar', [meal('snack', 'fruta', ['fruit'])]),
    );
    const result = computeAdaptiveTargets(w);
    expect(result.ironTarget).toBeNull();
    expect(result.fishTarget).toBeNull();
  });

  it('ironTarget se limita al número de días con comida principal', () => {
    // Solo 2 días tienen comida/cena
    const w = week(
      day('Lun', [meal('comida', 'pollo', ['iron'])]),
      day('Mar', [meal('comida', 'pasta', [])]),
      day('Mié', [meal('desayuno', 'avena', [])]),
    );
    const result = computeAdaptiveTargets(w);
    expect(result.ironTarget).toBe(2);
  });

  it('veggieTarget se reduce con pocas franjas activas', () => {
    // Solo 1 franja activa → veggieTarget máximo 2
    const w = week(
      day('Lun', [meal('comida', 'pollo', ['iron'])]),
      day('Mar', [meal('comida', 'pasta', [])]),
    );
    const result = computeAdaptiveTargets(w);
    expect(result.veggieTarget).toBeLessThanOrEqual(2);
  });

  it('isAdapted es false si los targets son los por defecto', () => {
    // Semana completa con todas las franjas y suficientes días
    const days = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map(d =>
      day(d, [
        meal('desayuno', 'avena', []),
        meal('comida', 'pollo', ['iron']),
        meal('merienda', 'fruta', ['fruit']),
        meal('cena', 'verdura', []),
        meal('snack', 'yogur', []),
      ])
    );
    const result = computeAdaptiveTargets({ days });
    expect(result.isAdapted).toBe(false);
  });

  it('respeta targets personalizados', () => {
    const w = week(
      day('Lun', [meal('comida', 'pollo', ['iron'])]),
      day('Mar', [meal('comida', 'salmón', ['fish'])]),
      day('Mié', [meal('comida', 'lentejas', ['legume'])]),
    );
    const result = computeAdaptiveTargets(w, { iron: 3, fish: 2, legume: 2 });
    expect(result.legumeTarget).toBe(2);
  });
});
