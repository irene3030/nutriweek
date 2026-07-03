# CLAUDE-ENVIRONMENT-TO-DO.md

Mejoras pendientes para cómo trabajamos juntas (Irene + Claude Code) en este repo. No es documentación del producto — eso vive en `CLAUDE.md` y `docs/functional-spec-v2.md`. Esto es una lista viva que voy ampliando.

- [ ] **Actualizar CLAUDE.md** con lo que vayamos aprendiendo sobre el proyecto a medida que trabajemos (convenciones, gotchas, decisiones de arquitectura que no queden obvias solo leyendo el código).
- [ ] **Incorporar memoria** de forma más sistemática — que Claude guarde y recupere contexto relevante entre sesiones sin que yo tenga que repetirlo.
- [ ] **Pedir commit al cerrar cada feature** — cuando note que le pido algo distinto a lo que estaba haciendo, es señal de que la anterior ha terminado y toca commitear esa pieza antes de seguir, en vez de acumular varias cosas sin relacionar en un solo commit al final.
- [ ] **Dar acceso de login a Firebase a Claude** (credenciales de un household de prueba, o algo tipo sesión de Playwright guardada) para que pueda comprobar los cambios en el navegador de verdad, en vez de depender de que yo pruebe y le pase capturas.
- [ ] **Arreglar el linter** — `npm run lint` está roto en todo el repo (no existe `eslint.config.js`/`.eslintrc` en ninguna rama), aunque `CLAUDE.md` lo documenta como si funcionase.
- [ ] **Patrón de análisis y opinar** — seguir pidiendo primero "analiza y opina" antes de pasar a implementar en features/flujos complejos, porque da mejores resultados que pedir directamente la implementación.
