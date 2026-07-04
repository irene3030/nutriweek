# CLAUDE.md  MealOps

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Reglas de comportamiento

### 1. Piensa antes de codificar
No asumas. No escondas confusin. Expn trade-offs.
- Declara tus asunciones explcitamente. Si hay duda, pregunta.
- Si hay varias interpretaciones posibles, presntalas  no elijas en silencio.
- Si existe un approach ms simple, dilo. Cuestiona cuando corresponda.
- Si algo no est claro, para. Nombra qu es confuso. Pregunta.

### 2. Simplicidad primero
El cdigo mnimo que resuelve el problema. Nada especulativo.
- Sin features ms all de lo pedido.
- Sin abstracciones para cdigo de un solo uso.
- Sin "flexibilidad" o "configurabilidad" no solicitada.
- Sin manejo de errores para escenarios imposibles.
- Si escribes 200 lneas y podran ser 50, reescribe.

### 3. Cambios quirrgicos
Toca solo lo imprescindible. Limpia solo tu propio desorden.
- No "mejores" cdigo, comentarios o formato adyacente.
- No refactorices lo que no est roto.
- Respeta el estilo existente, aunque t lo haras distinto.
- Si tus cambios dejan hurfanos (imports/variables/funciones sin uso), elimnalos.
- No borres cdigo muerto preexistente salvo que se pida explcitamente.

Test: cada lnea cambiada debera trazarse directamente a la peticin del usuario.

### 4. Ejecucin orientada a objetivo
Define criterios de xito verificables. Itera hasta confirmarlos.
- "Aade validacin"  "Escribe casos que cubran inputs invlidos, luego haz que pasen"
- "Arregla el bug"  "Reproduce el bug, luego arrglalo"
- Para tareas multi-paso, indica un plan breve: paso  cmo se verifica.

### 5. Lgica de negocio siempre visible
**Este proyecto no tiene test suite  la verificacin es manual en el navegador, salvo para lgica de clculo, que se verifica leyendo cdigo.**

Cdigo de clculo/lgica de negocio  `calculateKPIs()`, lgica de raciones/inventario (`consumePortions`, `consumeUnits`, `depletedInventoryIds`), gating de coste de IA (`hasAiAccess`), reglas de Firestore con lgica de integridad (`ffActivation`)  NO se verifica solo por UI: un resultado puede "verse bien" en los casos que se prueban a mano y estar mal en edge cases no cubiertos.

Cuando escribas o modifiques cdigo de esta categora:
- Pega el fragmento relevante en tu respuesta, aunque ya est en el diff.
- Indica en una o dos lneas: inputs, transformacin, rango de output esperado.
- Seala qu edge cases consideraste y cules no cubriste.
- Si no ests segura de que la lgica es correcta, dilo explcitamente.

Cdigo de UI/presentacin/estilo: sigue verificndose visualmente como siempre, sin necesidad de mostrar fragmentos.

---

## Producto

Este repo implementa NutriWeek v2  una app de logstica culinaria diaria para familias BLW.
El spec funcional completo est en `docs/functional-spec-v2.md`.
Lelo antes de proponer cualquier cambio de arquitectura o nuevos componentes.

---

## Comandos de desarrollo

```bash
npm run dev          # Dev server (Vite, puerto por defecto 5173)
npm run dev:local    # Dev con Netlify CLI (incluye functions)
npm run dev:local:2  # Instancia paralela (puerto 5174/8889)  para worktrees simultneos
npm run dev:local:3  # Instancia paralela (puerto 5175/8890)  para worktrees simultneos
npm run build         # Build de produccin
npm run preview       # Preview del build
npm run lint          # ESLint (0 warnings permitidos)  actualmente roto, falta eslint.config.js, ver BACKLOG.md
```

No hay test suite. La verificacin es manual en el navegador (salvo Regla 5 de arriba).

Variables de entorno necesarias: copia `.env.example` a `.env` y rellena las variables de Firebase (`VITE_FIREBASE_*`) y opcionalmente `VITE_OWNER_UID` para el panel de dev en Perfil. `ANTHROPIC_API_KEY` y `FIREBASE_SERVICE_ACCOUNT_B64` son secretas, solo las usa la Netlify Function server-side.

---

## Arquitectura

### Stack
- React 18 + Vite, Tailwind CSS v3
- Firebase Auth (Google) + Firestore (base de datos en tiempo real)
- Claude API (`@anthropic-ai/sdk`) para generacin de mens y sugerencias IA, va `netlify/functions/claude.js` (proxy, nico archivo, sin servidor propio de larga duracin)
- PostHog para analytics
- PWA va `vite-plugin-pwa` (`registerType: 'autoUpdate'`, sin pasos manuales post-deploy)
- JavaScript puro, no TypeScript
- npm dentro de un monorepo pnpm (`lifeops`)  mezcla de gestores intencional, no normalizar sin que se pida

### Modelo de datos en Firestore
```
users/{uid}                           # perfil usuario: householdId, tourCompleted
households/{householdId}              # hogar: members[], anthropicApiKey, baby, ffActivated, kpiConfig
  /inventory/{itemId}                 # preparaciones en stock (Feature 1)
  /dailyPlans/{dateStr}               # planning diario YYYY-MM-DD (Feature 2)
  /recipes/{recipeId}                 # recetas guardadas
  /usualMeals/{id}                    # comidas habituales
invites/{token}                       # tokens de invitacin F&F de un solo uso
meta/ffActivation                     # contador global de activaciones F&F (mx 10)
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
//   el item del slot)  evita vaciar del todo un ingrediente del que solo se us una parte
```

#### Tipos de item de inventario (`type`)
- `ya-preparado`  raciones adulto/beb, reloj de frescura
- `acelerador`  necesita prep justo-antes
- `snack`  contador de unidades
- `flotante`  ingrediente sin plan (sin raciones, campo `amount` libre)

### KPI system (`src/lib/kpis.js`)
`calculateKPIs(weekDoc)` recibe un weekDoc con `{ days: [{ day, meals: [{tipo, baby, adult, tags}] }] }` y devuelve conteos de `ironDays`, `fishDays`, `legumedDays`, `distinctVeggies`, etc. Los tags nutricionales son: `iron`, `oily_fish`, `legume`, `fruit`, `egg`, `dairy`, `veggie:<nombre>`. Los hits efectivos usan `meal.track?.tags ?? meal.tags`.

### Hooks principales
- `useInventory(householdId)`  CRUD de inventario, `consumePortions`, `consumeUnits`, listas derivadas (`expiringItems`, `floatingItems`)
- `useDailyPlan(householdId)`  planning diario, escucha lunespasado maana, expone `weeklyKpis` calculados desde slots confirmados
- `useWeek(householdId)`  semanas legacy (WeekView)
- `useAuth()` / `useAuthProvider()`  autenticacin Google, `AuthContext`

### Navegacin (App.jsx)
`App.jsx` gestiona toda la navegacin con un `activeTab` state. Los tabs activos son: `today`  `TodayScreen`, `inventory`  `InventoryScreen`, `week`  `WeekView` (legacy), `profile`  `ProfileTab`. El drawer lateral de `DayView` se muestra sobre el WeekView cuando `selectedDayIndex !== null`.

### Componentes v2
Todos en `src/components/v2/`. Son la implementacin actual de Features 1 y 2:
- `TodayScreen`  pantalla principal: KPI strip + secciones de planning diario (Hoy/Maana/Pasado)
- `InventoryScreen`  lista de preparaciones, agrupadas por tipo
- `DayPlanSection`  seccin colapsable de un da con sus slots
- `PlanSlotRow`  fila de un slot con sus items y accin de confirmar
- `SlotPickerSheet`  sheet modal para aadir items a un slot (busca en inventario + acelerador)
- `WeeklyKpiStrip`  tira horizontal de indicadores nutricionales
- `AddPrepModal`  formulario para registrar una preparacin nueva

> Naming pendiente de revisin  ver BACKLOG.md. "v2" ya no aporta informacin (queda de cuando se rehzo la lgica de la app); no renombrar de pasada, requiere sesin dedicada.

### Acceso a la IA
`hasAiAccess` se calcula en `App.jsx`: `!!householdApiKey || (ffActivated && freeCallsUsed < 30)`. Se pasa como prop a todos los componentes que usan IA. Las llamadas van a travs de `src/lib/claude.js`. Cualquier cdigo que llame a `claude.js` en bucle o sin pasar por este gating puede saltarse el lmite de coste de la API de Anthropic.

### Playground
`src/components/playground/`  zona experimental, incluye `suggestDinner` ("qu ceno?"). **No** est en la lista de componentes protegidos  se puede iterar con ms libertad que en el resto del repo. Aun as, su lgica de clculo/coste sigue bajo la Regla 5.

---

## Gotchas y fragilidades conocidas

- **`meta/ffActivation`** (Firestore): contador de activaciones del programa Friends & Family, tope duro de 10, enforced en las propias reglas de Firestore (`firestore.rules`), no solo en cliente. Cambios descuidados ah podran romper ese lmite o permitir reutilizacin de invites.
- Dependencias con ciclos de breaking changes frecuentes: `firebase` (^12.12.0) y `firebase-admin` (^13.8.0) en Auth/Firestore.
- `vite-plugin-pwa` con `generateSW` puede requerir purgar el service worker cacheado en desarrollo tras cambiar configuracin.

---

## Git & Deployment Workflow

### Branch strategy
- `main`  produccin (auto-deploy Netlify produccin). Es la nica rama larga viva; no existe `dev`. Decisin consciente: Irene es la nica usuaria, la capa extra de `dev` no aporta proteccin real.
- `legacy`  snapshot histrico, no se toca.
- `feat/<slug>`  ramas de feature de corta duracin, normalmente en worktrees, creadas a partir de `main`.

### Reglas  seguir estrictamente
1. Antes de empezar cualquier tarea, confirmar rama con `git branch --show-current`. Para trabajo no trivial, usa un worktree con rama `feat/<slug>` en vez de trabajar directo en `main`.
2. Al completar una tarea en una rama de feature, commit descriptivo y push:
   `git add -A && git commit -m "<type>: <description>" && git push origin feat/<slug>`
3. **Nunca hacer merge ni push a `main`** sin aprobacin explcita ma.
4. Cuando diga "merge a main", hacer:
   `git checkout main && git pull origin main && git merge feat/<slug> && git push origin main`

### Formato de commits (conventional commits)
- `feat: add inventory crud hooks`
- `fix: correct ration count on daily plan`
- `chore: update dependencies`
- `style: improve mobile layout on home view`

### Worktrees  crear y limpiar

**Convencin de nombres:** worktree y rama comparten el mismo slug descriptivo de la feature, sin prefijo de repo y sin nmeros de identificacin.
- Worktree: `../<slug-descriptivo>`
- Rama: `feat/<slug-descriptivo>`

#### Crear un worktree nuevo

Cuando la usuaria diga **"quiero abrir una rama nueva con worktree para X"** (o similar), ejecutar este flujo completo sin pedir ms confirmacin:

```bash
# 1. Crear el worktree con nombre derivado de la feature (sin prefijo "mealops-")
git worktree add ../<slug> feat/<slug>

# 2. Copiar archivos locales necesarios
cd ../<slug> && bash scripts/setup-worktree.sh
```

El `<slug>` se deriva del nombre de la feature en kebab-case (ej: "shopping list"  `shopping-list`, rama `feat/shopping-list`, carpeta `../shopping-list`).

Terminar informando a la usuaria de la ruta del worktree y que puede abrirlo en su editor.

#### Limpiar un worktree tras merge

Cuando la usuaria diga **"elimina el worktree de X"** o **"limpia la rama X"**, ejecutar desde dentro del worktree correspondiente:

```bash
bash scripts/cleanup-worktree.sh
```

Si la usuaria no especifica si quiere borrar la rama remota, preguntar antes de hacerlo.

---

### Nunca hacer
- Push a `main` sin aprobacin explcita
- Force push a cualquier rama
- Commitear secrets, .env o API keys

---

## Componentes protegidos  no tocar sin aprobacin explcita

- `src/components/week/WeekView.jsx`
- `src/components/week/NewWeekModal.jsx`
- `src/components/week/ReplanModal.jsx`
- `src/components/day/` (DayView, MealEditor, MealSlot, TrackModal)

Estos componentes se mantienen funcionales pero son legacy. Cualquier cambio en features legacy requiere aprobacin explcita ma. Los nuevos componentes van en `src/components/v2/`.

## Registro de sesin

Al terminar cada sesin de trabajo (o antes de un cambio de contexto largo),
actualiza `PROGRESS.md`: qu se hizo, decisiones tomadas y por qu, qu queda
pendiente, bloqueos abiertos. Aade la entrada nueva arriba de las anteriores.
