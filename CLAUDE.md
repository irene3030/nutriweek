## Producto

Este repo implementa NutriWeek v2  una app de logstica culinaria diaria para familias BLW.
El spec funcional completo est en `docs/functional-spec-v2.md`.
Lelo antes de proponer cualquier cambio de arquitectura o nuevos componentes.

---

## Git & Deployment Workflow

### Branch strategy
- `dev`  staging (auto-deploy Netlify staging)
- `main`  produccin (auto-deploy Netlify production)
- `feat/v2-logistics`  rama activa de desarrollo v2, parte de `dev`

### Reglas  seguir estrictamente
1. **Trabajar siempre en `feat/v2-logistics`** durante el desarrollo v2.
2. Antes de empezar cualquier tarea, confirmar rama:
   `git checkout feat/v2-logistics && git pull origin feat/v2-logistics`
3. Al completar una tarea, commit descriptivo y push:
   `git add -A && git commit -m "<type>: <description>" && git push origin feat/v2-logistics`
4. **Nunca hacer merge a `dev` o `main`** sin aprobacin explcita ma.
5. Cuando diga "merge a dev", hacer:
   `git checkout dev && git pull origin dev && git merge feat/v2-logistics && git push origin dev && git checkout feat/v2-logistics`
6. Si hay dudas sobre si algo est listo, quedarse en la rama y preguntar.

### Formato de commits (conventional commits)
- `feat: add inventory crud hooks`
- `fix: correct ration count on daily plan`
- `chore: update dependencies`
- `style: improve mobile layout on home view`

### Nunca hacer
- Push a `main` sin aprobacin explcita
- Force push a cualquier rama
- Commitear secrets, .env o API keys

---

## Reglas v2  componentes legacy

**No modificar** ningn componente existente en:
- `/PrepPlan`
- `/WeekView`
- `/NewWeekModal`
- `/ReplanModal`

Estos componentes se mantienen funcionales pero son legacy.
Cualquier cambio en features legacy requiere aprobacin explcita ma.
Los nuevos componentes van en `/components/v2/` o rutas nuevas.
