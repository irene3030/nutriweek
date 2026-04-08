# To Review (rama dev → main)

Items implementados en `dev` pendientes de revisión visual antes de merge.

---

## Post-merge dev → main — verificar que no se rompió nada

### Crítico (afectado por el merge)
- [ ] **Generar semana con IA** — prompt incluye ahora babyProfile + kpis + season + vetoedIngredients juntos. Comprobar que genera y no falla
- [ ] **Perfil bebé** — que se guarda y carga bien en Perfil
- [ ] **Modal nueva semana** — KPIs editables + selector comidas habituales + "Fijar en día" truncado
- [ ] **Tracking de comidas** — registrar done/partial/other, que se guarda y se muestra en MealSlot
- [ ] **Vista de día** — que abre bien y muestra el banner en días eliminados

### Importante (features de main que podrían haberse roto)
- [ ] **Vetar ingredientes** — en la revisión previa a generar semana
- [ ] **Fix de KPIs con IA** — botón ✨ en cada KPI
- [ ] **Batch cooking** — generación y estados de tareas
- [ ] **⚡ Generar idea de comida** — quick meal modal

### Menor (features de dev)
- [ ] **Lista de la compra** — pills con tooltip, progreso, copiar texto
- [ ] **Eliminar día** — ⋯ en DayCard, aparece vacío con nota
- [ ] **Spotlight Tour** — que recorre los pasos sin romperse

---

## 8. Modal generación — selector comidas habituales
- Sección "Incluir esta semana": muestra 3 comidas y botón `+N más…` para expandir
- Sección "Fijar en día y franja": pills de comidas habituales para rellenar el campo con un clic
- **Revisar:** que las pills no se vean abarrotadas si hay muchas comidas habituales

## 9. Duplicar semana anterior
- Selector inline en el modal de nueva semana con las semanas guardadas
- Copia días y comidas (sin tracking) como punto de partida
- **Revisar:** que el selector se ve bien y el label de cada semana es legible

## 16. Lista de la compra — pills de uso por franja
- Cada ingrediente muestra pills `Lun · Comida` debajo del nombre
- Tooltip nativo (hover) con el texto completo de la comida
- **Revisar:** que las pills no hacen la lista demasiado densa; valorar si el tamaño de fuente es suficiente en móvil

## 4. Bug toggle KPI custom
- Quitado `overflow-hidden` que cortaba la sombra del círculo blanco
- **Revisar:** que el toggle se ve bien en activo e inactivo en ambas secciones (catálogo y personalizados)

## 9b. Compartir menú con texto completo *(en curso)*

## KPIs — frecuencia diaria/semanal
- Hierro y Fruta ahora usan frecuencia **diaria** por defecto (antes semanal): el pill muestra `X/7 días` con objetivo `≥1/día`
- KPIs custom: nuevo selector "Por semana / Por día" al crear y al editar
- Bug corregido: `getCustomStatus` (no definida) → `getStatusWithQuality`
- **Revisar:** que los pills de Hierro y Fruta muestran bien el nuevo formato; que crear un KPI custom con frecuencia diaria funciona y el pill se actualiza correctamente

## Tu bebé — perfil del bebé
- Nombre, fecha de nacimiento (con edad en meses calculada al momento), toggle de lactancia materna
- Guardado en `households.baby`, pasado al prompt de generación de semana
- **Revisar:** que el layout del formulario se ve bien en móvil; que el toggle de lactancia tiene buen contraste
