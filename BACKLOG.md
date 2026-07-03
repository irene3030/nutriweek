BACKLOG.md  MealOps (local, fuera de git)

Tareas de entorno/proceso pendientes. No es backlog de producto.

Pendientes


 Crear eslint.config.js. npm run lint referencia ESLint pero no existe archivo de configuracin en ninguna rama  el comando falla siempre. Que lo cree Claude Code.
 Actualizar scripts/setup-worktree.sh. Dos cambios:

Actualmente antepone mealops- al nombre del worktree. Nueva convencin: worktree = ../<slug-descriptivo> sin prefijo, rama = feat/<slug-descriptivo>, mismo slug en ambos.
Actualmente solo copia .env y .netlify/state.json desde el worktree principal. Aadir copia de PROGRESS.md y BACKLOG.md (ambos fuera de git)  si no, cada worktree nuevo arranca sin memoria de sesin ni backlog.



 Decisin pendiente: naming de src/components/v2/. Es la implementacin actual (no legacy), pero el nombre "v2" ya no aporta informacin  qued de cuando se rehzo la lgica de la app. Evaluar renombrar a algo descriptivo (daily/, today/?)  cambio ms invasivo, requiere sesin dedicada, no meterlo de pasada.
 Revisar si feat/v2-* en ramas ya mergeadas/histricas merece limpieza de naming o se deja como est (son historia, no afectan a nada activo).


Hecho


 Confirmado: convencin worktree=rama por slug ya exista en la prctica  solo se ajusta el prefijo.
 ffActivation y hasAiAccess documentados como gotchas en CLAUDE.md.
 playground/ confirmado como zona sin proteccin especial (no fragile).
