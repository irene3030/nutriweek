# Audit — MealOps
> Generado: 2026-04-09

## Anti-Patterns Verdict

**Parcialmente supera el test.** El app tiene una estética genuina e intencional (blueprint/engineering grid) que claramente no se generó desde cero con IA. Sin embargo, hay tres tells concretos que la debilitan:

1. ~~**Side-stripe en MealSlot**~~ — `w-1` div de borde izquierdo coloreado (`MealSlot.jsx:97`). **Corregido en /normalize.**
2. **Inter como única tipografía** — Está en la lista de fuentes reflex prohibidas. Hace que el app se sienta plantillado a pesar de tener un sistema de color/espaciado distintivo.
3. ~~**`rounded-full` en todas partes**~~ — 50+ instancias que contradecían la estética de 4px del blueprint. **Corregido en /normalize.**
4. **Rosa en tags de fruta** — `TagChip.jsx` usa `bg-pink-100 text-pink-700` para fruta. "Sin rosa" era una anti-referencia explícita.
5. ~~**Fondo degradado en Onboarding**~~ — `from-brand-50 via-white to-orange-50` divergía del grid-paper. **Corregido en /normalize.**

---

## Puntuación

| # | Dimensión | Puntuación | Hallazgo principal |
|---|-----------|------------|-------------------|
| 1 | Accesibilidad | 2/4 | Sin acceso por teclado en DayCard, sin focus trap en modales, touch targets ~28px |
| 2 | Rendimiento | 3/4 | Sin code splitting, `useKPIs` ×7 por render, sin `React.memo` |
| 3 | Diseño Responsive | 3/4 | Grid adaptativo correcto, iOS bien tratado; touch targets demasiado pequeños |
| 4 | Theming | 2/4 | Colores hard-coded en CSS, ~~rounded-full vs. blueprint~~, rosa en fruta |
| 5 | Anti-Patterns | 2/4 | ~~Side-stripe (ban absoluto)~~, Inter, ~~clash pill vs. blueprint~~ |
| **Total** | | **12/20** | **Aceptable — trabajo significativo necesario** |

> **Bandas**: 18-20 Excelente · 14-17 Bueno · 10-13 Aceptable · 6-9 Deficiente · 0-5 Crítico

---

## Resumen ejecutivo

- **12/20** — Aceptable
- Issues encontrados: **2 P1**, **7 P2**, **4 P3**
- Top 3 issues pendientes: Inter como fuente, touch targets <44px, sin focus trap en Modal
- Próximos pasos recomendados: `/harden` para accesibilidad, `/adapt` para touch targets, `/typeset` para tipografía

---

## Hallazgos por severidad

### P1 — Bloqueante

#### ~~[P1] Side-stripe coloreado en MealSlot~~ ✅ Corregido
- **Archivo**: `src/components/day/MealSlot.jsx:97`
- **Categoría**: Anti-Pattern
- **Corrección**: Eliminado en `/normalize`. El div `w-1` de borde izquierdo fue reemplazado por los TagChips como único portador del color de categoría.

#### [P1] DayCard es un div no-interactivo con onClick
- **Archivo**: `src/components/week/DayCard.jsx:66-69`
- **Categoría**: Accesibilidad
- **Impacto**: Usuarios de teclado no pueden enfocar ni activar la card. Los lectores de pantalla no la anuncian como interactiva. Afecta la navegación principal del app.
- **Estándar**: WCAG 2.1 SC 2.1.1 (Teclado), SC 4.1.2 (Nombre, Rol, Valor)
- **Recomendación**: Cambiar a `<button>` o añadir `role="button"`, `tabIndex={0}` y handler `onKeyDown`.
- **Comando**: `/harden`

---

### P2 — Mayor

#### [P2] Sin focus trap en Modal
- **Archivo**: `src/components/ui/Modal.jsx`
- **Categoría**: Accesibilidad
- **Impacto**: El foco puede escapar del modal al contenido de fondo. Falta también `aria-labelledby` apuntando al `<h2>` del título, y handler de tecla Escape.
- **Estándar**: WCAG 2.1 SC 2.1.2
- **Recomendación**: Añadir focus trap, `aria-labelledby="modal-title"` en el dialog, `id="modal-title"` en el `<h2>`, handler de Escape.
- **Comando**: `/harden`

#### ~~[P2] Touch targets ~28px — mínimo 44px~~ ✅ Corregido
- Corregido en `/adapt`. Todos los botones de icono usan ahora `min-h-[44px] min-w-[44px] flex items-center justify-center`. Track button de MealSlot usa `min-h-[44px] inline-flex items-center`. Afectados: WeekHeader (flechas nav, share, delete, nueva semana), DayView (cerrar, flechas día), MealSlot (editar, registrar), WeekKPIs (cerrar drawer).

#### ~~[P2] `rounded-full` generalizado — contradice estética blueprint~~ ✅ Corregido
- Corregido en `/normalize`. 50+ instancias cambiadas a `rounded` (4px). Mantenido `rounded-full` solo en: spinners, avatares, toggles, progress bars.

#### [P2] Inter como única tipografía
- **Archivos**: `index.html:27` · `index.css:7` · `tailwind.config.js:74`
- **Categoría**: Anti-Pattern
- **Impacto**: Inter está en la lista explícita de fuentes reflex prohibidas. Para un producto "calm, engineering, practical", Inter se lee como SaaS genérico. La estética blueprint merece una fuente que refuerce el carácter técnico/preciso.
- **Recomendación**: Reemplazar Inter. JetBrains Mono (ya cargado) podría promoverse para elementos de datos; considerar **Geist** o **Barlow Condensed** para el carácter engineering.
- **Comando**: `/typeset`

#### [P2] Rosa en tags de fruta
- **Archivo**: `src/components/ui/TagChip.jsx:8`
- **Categoría**: Theming / Anti-Pattern
- **Impacto**: `bg-pink-100 text-pink-700` para el tag de fruta. Anti-referencia explícita del usuario: "sin rosa".
- **Recomendación**: Reasignar fruta a un ámbar/naranja claro: `bg-orange-50 text-orange-700 border-orange-200`. El naranja caldero ya tiene peso semántico en el sistema.
- **Comando**: `/colorize`

#### ~~[P2] Fondo degradado en OnboardingScreen diverge del estilo del app~~ ✅ Corregido
- Corregido en `/normalize`. El fondo ahora hereda el grid-paper del body.

---

### P3 — Pulido

#### [P3] Sin code splitting en componentes pesados
- **Archivo**: `src/App.jsx:1-20`
- **Categoría**: Rendimiento
- **Impacto**: `NewWeekModal` (1100+ líneas), `BatchCooking`, `RecipeSearch` se importan eagerly. El primer paint es innecesariamente pesado.
- **Recomendación**: Envolver modales pesados en `React.lazy` + `Suspense`.
- **Comando**: `/optimize`

#### [P3] `useKPIs` llamado una vez por DayCard (7 veces)
- **Archivo**: `src/components/week/DayCard.jsx:60`
- **Categoría**: Rendimiento
- **Impacto**: Cada DayCard llama `useKPIs` independientemente. Bajo riesgo si el cómputo es puro/barato, pero ineficiente.
- **Recomendación**: Elevar el cómputo de KPIs a `WeekView` y pasar `kpi` como prop a cada DayCard.
- **Comando**: `/optimize`

#### [P3] Leyenda de KPIs solo via tooltip en DayCard
- **Archivo**: `src/components/week/DayCard.jsx:141-153`
- **Categoría**: Accesibilidad
- **Impacto**: Los indicadores de KPI (ahora cuadraditos tras /normalize) usan solo atributo `title`. En dispositivos táctiles `title` es inaccesible. Color como único portador de significado falla WCAG 1.4.1.
- **Recomendación**: Añadir `aria-label` en los `<span>` o una leyenda visible.
- **Comando**: `/harden`

#### [P3] `backdrop-blur-sm` en backdrop del Modal
- **Archivo**: `src/components/ui/Modal.jsx:26`
- **Categoría**: Anti-Pattern / Rendimiento
- **Impacto**: Glassmorfismo sutil. También activa compositing GPU en cada apertura de modal.
- **Recomendación**: Reemplazar con backdrop sólido semi-transparente (`bg-black/50` sin blur).
- **Comando**: `/polish`

---

## Patrones sistémicos

- **`rounded-full` en 50+ ubicaciones** ✅ — Resuelto en `/normalize`. Era un conflicto sistémico con el design system blueprint.
- **Touch targets consistentemente pequeños** — La convención de tamaño de botones necesita subirse globalmente. No es un caso aislado.
- **Sin tokens CSS como custom properties** — Los colores solo existen como clases Tailwind, no como `var(--color-brand-600)`. Dificulta overrides y theming dinámico.

---

## Lo que funciona bien

- **Estética blueprint genuinamente distintiva** — El fondo cream + grid paper, sombras offset planas y border-radius de 4px tienen un punto de vista de diseño real. No parece una plantilla por defecto.
- **Colores semánticos de alimentos bien pensados** — El sistema de tags (iron=naranja, fish=azul, legume=verde) es lógico e internamente consistente.
- **Detalles PWA/iOS excelentes** — Safe area padding, `font-size: max(16px, 1em)` para evitar zoom, `overscroll-behavior`, `theme-color` meta.
- **Copy en español claro y directo** — Etiquetas consistentes, sin copy de relleno.
- **`aria-label` en la mayoría de botones de icono** — Flechas de navegación, menú DayCard, cierre de Modal, lápiz de edición: todos etiquetados.
- **JetBrains Mono para valores de datos** — La clase `.data-value` es un patrón inteligente. Monoespaciado para datos numéricos/técnicos refuerza el carácter engineering.
- **Corner marks en elementos técnicos** — El patrón CSS `.corner-mark` es un detalle on-brand y elegante.

---

## Acciones recomendadas (por prioridad)

| Prioridad | Comando | Descripción |
|-----------|---------|-------------|
| P1 | `/harden` | DayCard como div no-interactivo; focus trap + `aria-labelledby` en Modal; handler de Escape |
| P1 | ~~`/normalize`~~ | ✅ Completado |
| P2 | `/adapt` | Subir todos los botones de icono a 44px touch target |
| P2 | `/colorize` | Reasignar tag de fruta de rosa a ámbar/naranja |
| P2 | `/typeset` | Reemplazar Inter por una alternativa distintiva que refuerce el carácter engineering |
| P3 | `/optimize` | `React.lazy` para NewWeekModal/RecipeSearch; elevar `useKPIs` fuera de DayCard |
| P3 | `/polish` | Eliminar backdrop-blur; añadir labels/leyenda a los indicadores KPI de DayCard |
