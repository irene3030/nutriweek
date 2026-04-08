# Backlog MealOps

## Pendiente

### TrackModal — eliminar "¿Comió algo más?" en opción "Otra cosa"
En el modal de registrar comida, cuando el estado es "Comió otra cosa", eliminar el campo opcional "¿Comió algo más?". Solo es relevante el campo "¿Qué comió en su lugar?".

---

### Vista semanal — comida registrada vs planificada (diseño pendiente)
Cuando una comida tiene tracking, ¿qué se muestra en la celda del DayCard?
Opciones a valorar:
- Mostrar solo lo planificado (como antes)
- Mostrar solo lo comido en realidad (implementación actual)
- Mostrar ambas: planificado tachado + comido debajo, o algún indicador visual que distinga entre plan y realidad

Actualmente se muestra lo comido. Decidir si esta es la mejor UX o si hay una solución más clara.

---

### Single Day Playground — UX propuesta de cena (revisar)

La evaluación del día y la sugerencia de cena están implementadas, pero la UX de la propuesta de cena no funciona correctamente. Pendiente de revisar prompt y lógica de frontend:

- Título del plato destacado, preparación debajo en texto discreto
- Ingredientes como pills, cada una con su justificación nutricional al lado
- ↺ por ingrediente: sustituir por otro del mismo rol nutricional (`swap_dinner_ingredient`)
- ✕ por ingrediente: eliminar de la propuesta
- "Nueva propuesta" debe evitar repetir el plato anterior (pasar `previousTitle` al prompt)

> Revisar que los KPIs cuadran. Hacer que si has logeado algo durante el día, aparezca ya relleno en la evaluación.

---

### Batch cooking — preparación integrada y optimización por tiempo

**Preparación integrada en vista de día:**
Una vez generado el plan de batch cooking, cada comida en la vista de día muestra su estado de preparación en tiempo real:
- Si todos los pasos completados → "Lista" / si algunos → "Casi hecha" con tiempo restante / si ninguno → tiempo total estimado
- Sección "Preparación" colapsable por comida: checklist de pasos con tiempo estimado por paso, sincronización bidireccional con batch cooking, total de tiempo restante en el encabezado
- La sección puede activarse/desactivarse por defecto desde Perfil
- El batch cooking debe generar pasos de preparación individuales con tiempo estimado por tarea
- Las comidas del menú deben vincularse a las tareas de batch cooking correspondientes

**Optimización por tiempo disponible:**
- Al generar el menú, el usuario indica cuánto tiempo tiene para cocinar (pendiente definir UX: sesiones concretas vs tiempo total)
- El plan de batch cooking se ajusta a ese tiempo, priorizando preparaciones con mayor impacto nutricional
- Agrupación en packs paralelos ("mientras el pollo está en el horno, cuece las legumbres")
- Optimizar uso simultáneo de fuegos, horno y tiempo de espera

> No funciona bien con la estimación de tiempos — da demasiadas tareas si dices que tienes 2h. Hay que ajustar criterio de selección y estimaciones.

---

### KPIs nutricionales — pendientes

**Vigilar cantidad de proteína diaria**
- La cantidad de proteína recomendada varía según la edad del bebé (distinto en 6-9m, 9-12m, 12m+)
- El KPI de proteína diaria debe ajustar su objetivo automáticamente en función de la edad calculada desde `households.baby.birthDate`
- Mostrar control/visualización de la ingesta proteica diaria con target adaptado a la edad actual
> Pendiente. Diferenciar por edad del bebé — el objetivo numérico (gramos o raciones) debe cambiar dinámicamente.

**Nuevos KPIs en biblioteca** (aún no implementados)
- Ratio proteína animal vs vegetal
- Colores distintos en el plato por semana (proxy de fitoquímicos)
- Nuevos alimentos introducidos este mes
- Días con grasa de calidad (AOVE, aguacate, pescado azul)
- Omega-3 semanal (pescado azul + semillas de lino/cáñamo)
- Días con proteína en cada comida principal (adulto)
- Frecuencia de ultraprocesados

---

### KPIs — mejoras de gestión

**Modal generación — KPIs editables inline**
El bloque "KPIs que intentará cumplir la IA" debe ser editable directamente desde el modal: activar/desactivar cada KPI, editar cantidad objetivo y cualidad (mínimo/máximo/exacto). Los cambios se guardan en `kpiConfig` igual que desde la biblioteca.

**Panel de fix: entrada de texto libre**
Además de corregir el KPI sustituyendo comidas automáticamente, permitir que el usuario introduzca una comida en texto libre: obtener sus KPIs y mostrar los badges de incremento/decremento para que pueda corregir manualmente.

**Conflictos entre KPIs al aplicar un fix**
Al proponer un fix, verificar que los cambios no empeoran otros KPIs activos. Si hay conflicto: informar al usuario ("Este cambio mejora X pero empeora Y") y dejar que decida. Pasar el estado de todos los KPIs activos al prompt.

---

### Despensa base
Guardar una lista de ingredientes siempre disponibles (aceite, huevos, yogur, pasta...) que se asumen en nevera/despensa sin tener que escribirlos cada vez.
- Gestión en Perfil o en el modal de nueva semana
- Se incluyen automáticamente como ingredientes disponibles al generar el menú
- El usuario puede activar/desactivar ingredientes de la despensa base puntualmente

---

### Tracking de comidas — flujo de guardado y visualización (⚠️ revisar)

El flujo de registro de comidas está implementado (3 estados: done/partial/other, checklist de ingredientes, regeneración de tags) pero **no funciona correctamente**: el guardado y la visualización posterior fallan. Requiere revisión y corrección completa.

**Pendiente revisar:**
- Guardar el track en Firestore correctamente
- Mostrar en MealSlot lo que se comió en realidad (ingredients eaten/altFood/extra)
- Tags efectivos (track.tags) reflejados en display y KPIs
- Subir foto de lo que ha comido el bebé — la IA detecta ingredientes y extrae tags automáticamente

**Iconos de estado por resultado:**
- ✓ verde — se lo comió todo
- ◑ naranja — comido parcial
- ↔ azul — comió otra cosa
- Visible en la vista de día junto a cada comida, sin necesidad de abrir el detalle

---

### Regenerar resto del día
En la vista de día, una vez que hay comidas registradas (ej: desayuno y comida), añadir un botón "Regenerar resto del día" que:
- Toma como input las comidas ya registradas (y lo realmente ingerido si hay tracking parcial)
- Regenera las franjas pendientes con coherencia nutricional respecto a lo ya comido ese día y al contexto de la semana
- Objetivo: equilibrar el resto del día (ej: si no comió hierro en la comida, priorizar hierro en la cena)

---

### Persistencia de comidas en la sección Día
Las comidas introducidas en el Single Day Playground deben persistir mientras dure el día. Al cambiar de día se limpian automáticamente.

Implementación sugerida: guardar en `households/{id}/dayPlayground` con campo `date` (YYYY-MM-DD). Al cargar, si `date` coincide con hoy se restauran; si no, se ignoran.

---

### Tracking de lactancia
Registro de tomas de lactancia del día para tener el contexto nutricional completo, especialmente de cara al calcio.

> El toggle de lactancia ya está en "Tu bebé" (Perfil) y afecta a las recomendaciones de la IA. El tracking de tomas concretas durante el día queda pendiente.

---

### Vista semanal — mejoras UI y resumen nutricional
- Mejorar legibilidad general de las celdas de cada día (badges/tags no se ven bien)
- Mostrar resumen nutricional de la semana en curso: qué KPIs se están cumpliendo, cuáles van flojos
- El día de hoy ya aparece highlighted — revisar que funciona bien con semanas pasadas/futuras

---

### Consciencia del día actual — fixes solo en futuro
Al proponer fixes de KPIs o regenerar días, la IA solo debe modificar comidas de hoy en adelante — nunca días que ya han pasado. Filtrar el contexto semanal antes de enviarlo al prompt, excluyendo días anteriores a hoy. La lógica debe centralizarse y reutilizarse en fix de KPIs y regenerar día.

---

### Eliminar día del menú
En cada DayCard de la vista semanal, añadir un botón de tres puntos (⋯) con un menú de opciones. Primera opción: "Eliminar día" — borra todas las comidas de ese día del menú.

> Hecho. El día permanece en la vista con slots vacíos y flag `cleared:true`. Al abrir el drawer muestra una nota sobre nutrición al comer fuera.

---

### Intercambiar comida entre días
Poder mover/intercambiar una comida de un día a otro directamente desde la vista semanal.
- Para esto la vista semanal debe mostrar el contenido completo de cada comida (no solo resumen).

---

### Lista de la compra — tooltip visual en pills de franja
Las pills `Lun · Comida` ya tienen `title={u.text}` (tooltip nativo del browser) pero no funciona en móvil. Sustituir por un tooltip visual custom (igual que los de los KPIs) que muestre el nombre completo de la comida al hacer hover o tap.

---

### Mejorar el Spotlight Tour
El tour actual no cubre todas las funcionalidades de la app. Revisarlo para que guíe al usuario por todas las secciones y características reales.

---

### Otros (recogidos para valorar)
- Alerta de alimentos nuevos a introducir (variedad para bebé según historial)
- Registro de alergias/intolerancias — excluir de generación IA
- Notas de reacción en el track — rechazo, alergia, atragantamiento leve
- Modo "tengo 10 minutos" — filtrar recetas por tiempo de preparación

---

## Hecho

### Tooltip de KPIs — formato comida (Día - Franja)
Formato actualizado en hierro, pescado, legumbres y fruta. Fruta también tiene tooltip ahora.

### Fix IA para todos los KPIs
Revisado — frontend y backend ya implementan el botón ✨ para todos los KPIs (fruta, rotación, custom).

### Modal generación semanal — selector de comidas habituales
Sección "Incluir esta semana": muestra 3 comidas + "+N más…". Sección "Fijar en día y franja": igual. Implementado en dev.

### Mejoras biblioteca de KPIs custom
Bug toggle, búsqueda OR y cualidad del objetivo (mínimo/máximo/exacto) implementados.

### Tu bebé — perfil del bebé
Nombre, fecha de nacimiento (edad calculada dinámicamente en meses) y toggle de lactancia materna. Guardado en `households.baby`. La edad real y el estado de lactancia se inyectan en el prompt de generación de semana.

### Temporalidad de alimentos
Avisar si un alimento no es de temporada, orientar hacia alternativas, indicador visual en el menú generado por IA.

### KPIs a cumplir al generar semana
Panel en modal nueva semana con checkboxes, targets editables, adaptive targets y temporada.

### Vetar ingredientes en revisión
Botón 🚫 por ingrediente con motivo (no le gusta, alergia, temporada, no tengo). Excluidos del prompt.

### Repensar UI de batch cooking
Campo `days_fresh` en cada tarea generada por IA. Badge ❄️ Xd nevera en la UI, ⚠️ en ámbar si se usa más tarde de lo que aguanta.

### Fix: incluir comida rápida en semana no funcionaba
Al generar una comida rápida (⚡) y pulsar "Incluir en semana", si la franja seleccionada no existía en ese día, la acción se ignoraba silenciosamente. Ahora crea la franja si no existe.

### Renombrar NutriWeek → MealOps
### Spotlight tour tras el onboarding
### Subir foto de comida con detección automática de ingredientes y tags
### Coherencia de alimentos por franja horaria
### Fix nutricional puntual
### KPIs adaptativos a la configuración de franjas
### Auto-detección de tags en comidas habituales
### Single Day Playground (evaluar día + sugerencia de cena — base funcional)
### KPIs nutricionales: biblioteca, legumbres/hierro/verduras/fruta/rotación por defecto, custom, objetivos editables
### Generar semana con o sin fin de semana
### UX mejoras sección KPIs: título con tooltip ℹ️, tooltips por pill con detalle
### Reorganización de navegación: Semana → Día → Comidas → Perfil, lista compra en sección Semana
### Configurar PostHog
### Compartir menú semanal con texto completo y toggle "Resumir nombres"
### Lista de la compra — pills de uso por franja (Lun · Comida)
### Duplicar semana anterior
