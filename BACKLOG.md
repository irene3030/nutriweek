BACKLOG.md  MealOps (local, fuera de git)

Tareas de entorno/proceso pendientes. No es backlog de producto.

Pendientes


 Decisin pendiente: naming de src/components/v2/. Es la implementacin actual (no legacy), pero el nombre "v2" ya no aporta informacin  qued de cuando se rehzo la lgica de la app. Evaluar renombrar a algo descriptivo (daily/, today/?)  cambio ms invasivo, requiere sesin dedicada, no meterlo de pasada.
 Revisar si feat/v2-* en ramas ya mergeadas/histricas merece limpieza de naming o se deja como est (son historia, no afectan a nada activo).
 npm run lint ya funciona (eslint.config.js creado) pero reporta 54 errores/22 warnings preexistentes en el cdigo (vars sin usar, comillas sin escapar, deps de hooks). Con --max-warnings 0 el comando sigue devolviendo cdigo de error hasta limpiarlos. Uno es un bug real, no solo estilo: src/components/week/DayCard.jsx:83 llama a un hook condicionalmente (viola rules-of-hooks). Decidir si se limpia todo de una vez o gradualmente.


Hecho


 Crear eslint.config.js. Flat config con eslint-plugin-react, react-hooks, react-refresh; aadidas deps @eslint/js y globals. Quitado --ext (incompatible con flat config) del script "lint" en package.json.
 Actualizar scripts/setup-worktree.sh: ahora copia tambin PROGRESS.md y BACKLOG.md desde el worktree principal.
 Confirmado: el prefijo "mealops-" nunca estuvo en setup-worktree.sh (ese script no crea el worktree, solo copia archivos post-creacin)  la nota de aviso en CLAUDE.md estaba obsoleta, eliminada.
 Confirmado: convencin worktree=rama por slug ya exista en la prctica  solo se ajusta el prefijo.
 ffActivation y hasAiAccess documentados como gotchas en CLAUDE.md.
 playground/ confirmado como zona sin proteccin especial (no fragile).
