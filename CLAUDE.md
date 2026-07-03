# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Producto

Este repo implementa NutriWeek v2 — una app de logística culinaria diaria para familias BLW.
El spec funcional completo está en `docs/functional-spec-v2.md`.
Léelo antes de proponer cualquier cambio de arquitectura o nuevos componentes.

---

## Comandos de desarrollo

```bash
npm run dev          # Dev server (Vite, puerto por defecto 5173)
npm run dev:local    # Dev con Netlify CLI (incluye functions)
npm run build        # Build de producción
npm run preview      # Preview del build
npm run lint         # ESLint (0 warnings permitidos)
```

No hay test suite. La verificación es manual en el navegador.

Variables de entorno necesarias: copia `.env.example` a `.env` y rellena las variables de Firebase (`VITE_FIREBASE_*`) y opcionalmente `VITE_OWNER_UID` para el panel de dev en Perfil.

---

## Arquitectura

### Stack
- React 18 + Vite, Tailwind CSS v3
- Firebase Auth (Google) + Firestore (base de datos en tiempo real)
- Claude API (`@anthropic-ai/sdk`) para generación de menús y sugerencias IA
- PostHog para analytics
- PWA via `vite-plugin-pwa`

### Modelo de datos en Firestore
```
users/{uid}                           # perfil usuario: householdId, tourCompleted
households/{householdId}              # hogar: members[], anthropicApiKey, baby, ffActivated, kpiConfig
  /inventory/{itemId}                 # preparaciones en stock (Feature 1)
  /dailyPlans/{dateStr}               # planning diario YYYY-MM-DD (Feature 2)
  /recipes/{recipeId}                 # recetas guardadas
  /usualMeals/{id}                    # comidas habituales
invites/{token}                       # tokens de invitación F&F de un solo uso
meta/ffActivation                     # contador global de activaciones F&F (máx 10)
```

#### Estructura de un `dailyPlan`
```js
{
  date: 'YYYY-MM-DD',
  slots: {
    desayuno: { items: [SlotEntry], confirmedAt: string | null },
    comida:   { items: [SlotEntry], confirmedAt: string | null },
    // ...
  }
}
// SlotEntry: { id, inventoryItemId, additionalInventoryIds, label, itemType, tags,
//              prepTime, accelBase, prepMethod, pendingPrep, depletedInventoryIds,
//              portionsAdultConsumed, portionsBabyConsumed }
// - id: uuid estable, solo se asigna a entries que generan tarea en prepQueue
//   (vincula SlotEntry <-> prepQueue.linkedEntryId)
// - depletedInventoryIds: subset de [inventoryItemId, ...additionalInventoryIds]
//   que se desactiva en inventario al confirmar el slot (y se reactiva al eliminar
//   el item del slot) — evita vaciar del todo un ingrediente del que solo se usó una parte
```

#### Tipos de item de inventario (`type`)
- `ya-preparado` — raciones adulto/bebé, reloj de frescura
- `acelerador` — necesita prep justo-antes
- `snack` — contador de unidades
- `flotante` — ingrediente sin plan (sin raciones, campo `amount` libre)

### KPI system (`src/lib/kpis.js`)
`calculateKPIs(weekDoc)` recibe un weekDoc con `{ days: [{ day, meals: [{tipo, baby, adult, tags}] }] }` y devuelve conteos de `ironDays`, `fishDays`, `legumedDays`, `distinctVeggies`, etc. Los tags nutricionales son: `iron`, `oily_fish`, `legume`, `fruit`, `egg`, `dairy`, `veggie:<nombre>`. Los hits efectivos usan `meal.track?.tags ?? meal.tags`.

### Hooks principales
- `useInventory(householdId)` — CRUD de inventario, `consumePortions`, `consumeUnits`, listas derivadas (`expiringItems`, `floatingItems`)
- `useDailyPlan(householdId)` — planning diario, escucha lunes→pasado mañana, expone `weeklyKpis` calculados desde slots confirmados
- `useWeek(householdId)` — semanas legacy (WeekView)
- `useAuth()` / `useAuthProvider()` — autenticación Google, `AuthContext`

### Navegación (App.jsx)
`App.jsx` gestiona toda la navegación con un `activeTab` state. Los tabs activos son: `today` → `TodayScreen`, `inventory` → `InventoryScreen`, `week` → `WeekView` (legacy), `profile` → `ProfileTab`. El drawer lateral de `DayView` se muestra sobre el WeekView cuando `selectedDayIndex !== null`.

### Componentes v2
Todos en `src/components/v2/`. Son la implementación actual de Features 1 y 2:
- `TodayScreen` — pantalla principal: KPI strip + secciones de planning diario (Hoy/Mañana/Pasado)
- `InventoryScreen` — lista de preparaciones, agrupadas por tipo
- `DayPlanSection` — sección colapsable de un día con sus slots
- `PlanSlotRow` — fila de un slot con sus items y acción de confirmar
- `SlotPickerSheet` — sheet modal para añadir items a un slot (busca en inventario + acelerador)
- `WeeklyKpiStrip` — tira horizontal de indicadores nutricionales
- `AddPrepModal` — formulario para registrar una preparación nueva

### Acceso a la IA
`hasAiAccess` se calcula en `App.jsx`: `!!householdApiKey || (ffActivated && freeCallsUsed < 30)`. Se pasa como prop a todos los componentes que usan IA. Las llamadas van a través de `src/lib/claude.js`.

---

## Git & Deployment Workflow

### Branch strategy
- `main` → producción (auto-deploy Netlify producción). Es la única rama larga viva; no existe `dev`.
- `legacy` → snapshot histórico, no se toca.
- `feat/<slug>` → ramas de feature de corta duración, normalmente en worktrees (ver sección de worktrees), creadas a partir de `main`.

### Reglas — seguir estrictamente
1. Antes de empezar cualquier tarea, confirmar rama con `git branch --show-current`. Para trabajo no trivial, usa un worktree con rama `feat/<slug>` en vez de trabajar directo en `main`.
2. Al completar una tarea en una rama de feature, commit descriptivo y push:
   `git add -A && git commit -m "<type>: <description>" && git push origin feat/<slug>`
3. **Nunca hacer merge ni push a `main`** sin aprobación explícita mía.
4. Cuando diga "merge a main", hacer:
   `git checkout main && git pull origin main && git merge feat/<slug> && git push origin main`

### Formato de commits (conventional commits)
- `feat: add inventory crud hooks`
- `fix: correct ration count on daily plan`
- `chore: update dependencies`
- `style: improve mobile layout on home view`

### Worktrees — crear y limpiar

#### Crear un worktree nuevo

Cuando la usuaria diga **"quiero abrir una rama nueva con worktree para X"** (o similar), ejecutar este flujo completo sin pedir más confirmación:

```bash
# 1. Crear el worktree con nombre derivado de la feature
git worktree add ../mealops-<slug> feat/<slug>

# 2. Copiar archivos locales necesarios
cd ../mealops-<slug> && bash scripts/setup-worktree.sh
```

El `<slug>` se deriva del nombre de la feature en kebab-case (ej: "shopping list" → `shopping-list`, rama `feat/shopping-list`, carpeta `../mealops-shopping-list`).

Terminar informando a la usuaria de la ruta del worktree y que puede abrirlo en su editor.

#### Limpiar un worktree tras merge

Cuando la usuaria diga **"elimina el worktree de X"** o **"limpia la rama X"**, ejecutar desde dentro del worktree correspondiente:

```bash
bash scripts/cleanup-worktree.sh
```

Si la usuaria no especifica si quiere borrar la rama remota, preguntar antes de hacerlo.

---

### Nunca hacer
- Push a `main` sin aprobación explícita
- Force push a cualquier rama
- Commitear secrets, .env o API keys

---

## Reglas v2 — componentes legacy

**No modificar** ningún componente existente en:
- `src/components/week/WeekView.jsx`
- `src/components/week/NewWeekModal.jsx`
- `src/components/week/ReplanModal.jsx`
- `src/components/day/` (DayView, MealEditor, MealSlot, TrackModal)

Estos componentes se mantienen funcionales pero son legacy.
Cualquier cambio en features legacy requiere aprobación explícita mía.
Los nuevos componentes van en `src/components/v2/`.
