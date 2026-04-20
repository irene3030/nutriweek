# Meal Prep — Cambios pendientes de revisión

Branch: `feat/meal-prep`

---

## Resumen de la feature

Rediseño del sistema de batch cooking en dos fases:

- **Fase 1 (planificación):** La generación de semana ahora acepta un estilo de variedad y Claude asigna un `repeatability_score` por comida.
- **Fase 2 (prep):** Nueva llamada `generate_meal_prep` a Claude que analiza el menú generado y produce un plan de preparación con sesiones, tareas y badges por slot.

---

## Ficheros modificados

### `netlify/functions/claude.js`
- `generate_week`: acepta `weekVarietyStyle` (high/balanced/optimized), añade reglas de repetición al prompt, y ahora pide a Claude un campo `repeatability_score: "high"|"medium"|"low"` por comida en el output.
- `regenerate_day`: también incluye `repeatability_score` en el schema de output.
- **Nuevo action `generate_meal_prep`**: recibe el menú semanal (con scores), ventanas de prep y maxResolvedUses. Claude devuelve:
  - `sessions[]` → sesiones con tareas (`resolved_meal` o `accelerator`)
  - `mealBadges[]` → qué slots quedan como resueltos/acelerados/normal
  - `summary` → resumen (conteos, minutos ahorrados, nº sesiones)

### `src/lib/claude.js`
- `generateWeekMenu`: acepta `weekVarietyStyle`.
- Nueva función `generateMealPrep({ weekMenu, prepWindows, maxResolvedUses })`.

### `src/hooks/useWeek.js`
- Nuevo método `updateMealPrep(weekId, mealPrep)` → guarda `week.mealPrep` en Firestore.

### `src/App.jsx`
- Extrae `updateMealPrep` de `useWeek` y lo pasa a `WeekView` como `onUpdateMealPrep`.

### `src/components/week/NewWeekModal.jsx`
- Nuevo selector "Variedad semanal" (Alta / Equilibrada / Optimizada) visible solo con acceso a IA.
- `weekVarietyStyle` se pasa a `generateWeekMenu`.
- `cleanDays` ahora preserva `repeatability_score` al guardar la semana generada.

### `src/components/week/WeekView.jsx`
- Sustituye `<BatchCooking>` por `<MealPrep>`.
- Acepta `onUpdateMealPrep` y lo pasa a `MealPrep`.
- Pasa `mealBadges` desde `currentWeek.mealPrep.mealBadges` a cada `DayCard`.

### `src/components/week/DayCard.jsx`
- Acepta prop `mealBadges`.
- Muestra un punto de color en cada meal slot con badge: verde = resuelta, naranja = acelerada.

---

## Ficheros nuevos

### `src/components/week/MealPrep.jsx`
Reemplaza `BatchCooking.jsx`. Incluye:
- **Panel de configuración**: ventanas de prep (día + duración), máx. usos por comida resuelta (2 o 3).
- **Banner de resumen**: nº de comidas resueltas, aceleradas, minutos ahorrados, nº de sesiones.
- **Sesiones con tareas**: cada tarea muestra tipo (Resuelta/Acelerador), nombre, duración, slots impactados, raciones/usos, días de nevera y minutos ahorrados. Las tareas son marcables (done persiste en Firestore).

---

## Schema nuevo en Firestore

```js
week.mealPrep = {
  generatedAt: ISO string,
  config: { prepWindows: [{day, durationMinutes}], maxResolvedUses: 2|3 },
  sessions: [
    {
      id, day, durationMinutes,
      tasks: [
        {
          id, type: "resolved_meal"|"accelerator",
          name, durationMinutes,
          outputServings,   // solo resolved_meal
          outputUses,       // solo accelerator
          daysFresh, impactedSlots: [{day, tipo}],
          minutesSaved, done
        }
      ]
    }
  ],
  mealBadges: [{ day, tipo, badge: "resolved"|"accelerated", taskId }],
  summary: { resolvedCount, acceleratedCount, totalMinutesSaved, sessionCount }
}

// Añadido a cada meal slot:
days[].meals[].repeatability_score = "high" | "medium" | "low"
```

---

## Lo que NO se ha tocado

- `BatchCooking.jsx` — sigue existiendo, no se usa en el nuevo flujo pero no se ha borrado.
- Semanas existentes — el campo `batchCooking` en Firestore se ignora, no se migra.
- El resto del flujo (KPIs, tracking, shopping, replan) — sin cambios.

---

## Pendiente / decisiones abiertas

- [ ] Confirmar que el login en el branch deploy funciona (problema de dominio no autorizado en Firebase Auth, no relacionado con esta feature).
- [ ] Borrar `BatchCooking.jsx` una vez confirmado que `MealPrep.jsx` funciona en producción.
- [ ] Decidir si migrar semanas antiguas con `batchCooking` al nuevo formato o simplemente ignorarlas.
