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
// SlotEntry: { inventoryItemId, label, itemType, tags, prepTime, accelBase,
//              portionsAdultConsumed, portionsBabyConsumed }
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
- `dev` → staging (auto-deploy Netlify staging)
- `main` → producción (auto-deploy Netlify production)
- `feat/v2-logistics` → rama activa de desarrollo v2, parte de `dev`

### Reglas — seguir estrictamente
1. **Trabajar siempre en `feat/v2-logistics`** durante el desarrollo v2.
2. Antes de empezar cualquier tarea, confirmar rama:
   `git checkout feat/v2-logistics && git pull origin feat/v2-logistics`
3. Al completar una tarea, commit descriptivo y push:
   `git add -A && git commit -m "<type>: <description>" && git push origin feat/v2-logistics`
4. **Nunca hacer merge a `dev` o `main`** sin aprobación explícita mía.
5. Cuando diga "merge a dev", hacer:
   `git checkout dev && git pull origin dev && git merge feat/v2-logistics && git push origin dev && git checkout feat/v2-logistics`

### Formato de commits (conventional commits)
- `feat: add inventory crud hooks`
- `fix: correct ration count on daily plan`
- `chore: update dependencies`
- `style: improve mobile layout on home view`

### Worktrees — crear y limpiar

Cuando se crea un worktree nuevo (`git worktree add`), los archivos locales no se copian automáticamente. **Siempre sugerir ejecutar este script** justo después:

```bash
# desde dentro del worktree recién creado
bash scripts/setup-worktree.sh
```

Copia `.env` y `.netlify/state.json` desde el worktree principal. Sin esto `npm run dev:local` falla.

Cuando una rama ha sido mergeada y el worktree ya no es necesario, **usar este script en lugar de borrar a mano**:

```bash
# desde dentro del worktree a eliminar
bash scripts/cleanup-worktree.sh
```

Elimina el directorio del worktree, la rama local y (con confirmación) la rama remota.

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
