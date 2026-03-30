# To Review (rama dev → main)

Items implementados en `dev` pendientes de revisión visual antes de merge.

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
