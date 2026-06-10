# NutriWeek — Functional Spec v2

## Qué es el producto

Una app de **logística culinaria diaria** para familias BLW. No planifica 7 días por adelantado. Ayuda a gestionar lo que tienes preparado en casa, lo que te falta nutritivamente esta semana, y qué hacer con lo que tienes en la nevera. El usuario sabe cómo cocinar y cómo hacer BLW — la app no opina sobre eso. La app gestiona el inventario, los gaps y las decisiones logísticas.

---

## Features

### 1. Inventario de preparaciones

Lo que el usuario tiene cocinado o disponible en un momento dado.

**Tipos de items:**
- **Ya-preparado** — se sirve tal cual o calentando (alubias, curry, pasta de lentejas). Tiene raciones adulto/bebé y reloj de frescura.
- **Acelerador** — necesita un justo-antes para convertirse en comida (boniato asado, arroz hervido, quinoa). Tiene reloj pero no es una comida resuelta.
- **Snack batch** — pool de unidades con vida útil (muffins, galletas). Tiene contador de unidades.
- **Ingrediente flotante** — algo comprado o disponible sin preparación asignada (500g carne picada, aguacate).

**Comportamiento:**
- El usuario registra una preparación: nombre, raciones adulto / bebé, vida útil en días, tipo.
- La app infiere etiquetas nutricionales (pescado azul, legumbre, hierro, verdura, fruta, lácteo, huevo, carbs) — el usuario puede confirmarlas o corregirlas rápido.
- El inventario descuenta raciones automáticamente cuando se incluyen en el planning diario.
- Los items próximos a caducar se marcan visualmente.
- Los flotantes se muestran destacados como "sin plan".

---

### 2. Planning diario

El ritual matutino: qué comemos hoy, y opcionalmente mañana y pasado.

**Slots disponibles:** desayuno · snack AM · comida · merienda · cena.
No todos los slots son obligatorios — el usuario planifica los que quiere.

**Comportamiento:**
- El usuario planifica para 1, 2 o 3 días vista.
- La app pre-rellena sugerencias desde el inventario actual.
- Para cada slot planificado la app muestra:
  - **Ya preparado**: qué hay en stock que resuelve o completa ese slot.
  - **Falta preparar**: qué hay que hacer justo antes, con tiempo estimado (ej: "lubina en air fryer, 10 min").
- Al confirmar, el inventario se actualiza (raciones consumidas) y los hits nutricionales quedan registrados.
- Si el usuario no planifica un día, no hay alerta ni presión.

**Caso de uso — cena abierta:**
Es legítimo planificar por la mañana solo la comida y dejar la cena sin decidir. Cuando la cena queda abierta, la app la sostiene: sabe qué se ha comido en el resto de slots del día y puede activar en cualquier momento la orientación "¿qué ceno?" con contexto completo del día. Así el usuario no tiene que cargar ese hilo mental durante la tarde.

**Objetivo de tiempo: 2 minutos por sesión matutina.**

---

### 3. Indicadores nutricionales suaves

No alarmas. No prescripción. Solo visibilidad del estado de la semana.

**KPIs tracking:**
- Pescado azul: X/3 esta semana
- Legumbre: X/2 esta semana
- Hierro: X días con fuente de hierro esta semana
- Verduras: N tipos distintos esta semana
- Fruta: presencia la mayoría de días

**Comportamiento:**
- Los hits se registran automáticamente desde el planning diario.
- Frases informativas simples: "llevas 2 días sin pescado azul", "legumbre bien cubierta esta semana".
- Sin puntuaciones, sin gamificación, sin juicio. Solo estado actual.

---

### 4. Propuesta de comida y cena

Cuando el usuario no tiene decidido qué comer, la app propone opciones concretas — no solo categorías.

**Entradas que usa la app:**
- Inventario actual (preparaciones en stock, aceleradores, flotantes)
- Despensa base asumida
- **Campo de braindump**: texto libre donde el usuario escribe rápido lo que tiene pero no ha registrado ("tengo aguacate, guisantes congelados, boniato"). La app lo incorpora sin necesidad de registro formal.
- Lo que se ha comido en los otros slots del día (para redondear nutricionalmente)
- KPIs de la semana

**Comportamiento:**
- El usuario activa "¿qué como?" o "¿qué ceno?" — o la app lo sugiere cuando detecta un slot sin planificar.
- El usuario puede escribir en el braindump antes de pedir la propuesta.
- La app propone algo concreto: nombre + ya preparado / falta preparar + tiempo. No solo "falta carbs".
- La propuesta considera el resto del día para que el conjunto sea nutricionalmente completo.
- El usuario acepta, pide otra opción, o ajusta manualmente.

---

### 5. Sugerencia de compra

Para cuando el usuario va al supermercado.

**Comportamiento:**
- El usuario activa "voy a comprar".
- La app calcula los gaps actuales: KPIs no cubiertos, stock que se agota en 1-2 días, flotantes sin plan.
- Devuelve lista por categorías: "compra pescado azul · compra 2-3 verduras · compra fuente de hierro".
- Horizonte de 3 días (no la semana entera).
- No marcas obligatorias. Puede sugerir concretos si ayuda ("salmón o caballa") pero el usuario elige libremente.

---

### 6. Resolver ingredientes flotantes

Para cuando hay un ingrediente disponible sin plan asignado.

**Comportamiento:**
- La app detecta flotantes y los muestra destacados, con días restantes hasta caducidad estimada.
- El usuario puede activar manualmente: "tengo 500g de carne picada, ¿qué hago?".
- La app propone 2-3 preparaciones, cada una con:
  - Nombre
  - Tiempo de prep
  - Batch (cocinas una vez, comes varios días) vs. justo-antes (resuelves una comida)
  - Raciones que genera (adulto / bebé)
  - Ingredientes extra necesarios, cruzado con lo que hay en stock
- El usuario elige una → queda registrada como preparación planeada en el inventario.
- O descarta y el flotante sigue visible.

---

### 7. Sugerencias de snack

Para cuando el stock de snacks está a punto de acabarse.

**Comportamiento:**
- Los snacks batch tienen un contador de unidades (muffins × 6).
- Cuando quedan pocas unidades, la app sugiere: "pronto te quedas sin snack".
- Propone 2-3 opciones distintas al último snack hecho, priorizando variedad.
- Las sugerencias se basan en lo que hay disponible en despensa, no en ingredientes ideales.
- Incluye tiempo de prep y unidades que genera.

### 8. "Tengo X minutos, ¿qué preparo?"

Para cuando el usuario tiene una ventana de tiempo disponible y quiere usarla bien.

**Comportamiento:**
- El usuario activa el flujo e indica el tiempo disponible (15 min / 30 min / 1 hora / más).
- La app calcula qué sería más útil preparar en ese tiempo, cruzando:
  - Gaps de la semana (qué KPIs faltan cubrir)
  - Stock disponible en inventario
  - Qué se ha preparado recientemente (para priorizar variedad)
  - Platos habituales del usuario (ver abajo)
  - Sugerencias nuevas generadas por IA
- Devuelve 2-3 opciones mezclando platos conocidos y sugerencias nuevas.
- El usuario elige una o descarta.
- Al terminar de cocinar, entra al flujo de registrar preparación con los datos ya pre-rellenados.

**Objetivo: que el usuario nunca desperdicie un rato libre sin saber qué haría más bien para la semana.**

---

### 9. Biblioteca de preparaciones habituales

Los platos que el usuario sabe hacer y quiere que la app proponga recurrentemente.

**Comportamiento:**
- El usuario puede registrar sus preparaciones habituales una vez en la configuración: nombre, tipo, tiempo aproximado, ingredientes base.
- La app también infiere qué es habitual del historial de registros: si algo aparece frecuentemente, pasa a considerarse habitual automáticamente.
- Estas preparaciones tienen prioridad en las sugerencias de los flujos de "tengo tiempo", "snack running low" y "resolver flotante".

---

### Patrón transversal — tarjeta de preparación sugerida

Todas las sugerencias de preparación (features 6, 7, 8) y las propuestas de comida/cena (feature 4) siguen el mismo formato:

**La app siempre muestra 2-3 opciones** — nunca una sola. El usuario elige.

Cada tarjeta incluye:
- Nombre
- Ingredientes necesarios (marcando cuáles tiene ya en stock o en despensa base)
- Tiempo de prep
- Tipo: batch / acelerador / snack / justo-antes
- Raciones que genera (adulto / bebé)
- Botón **"Generar receta"** — genera los pasos de preparación bajo demanda. La tarjeta es ligera por defecto.

### Patrón transversal — conversación con la receta

Una vez generada la receta, el usuario puede hacerle preguntas en lenguaje natural. No es un chat genérico — la IA tiene contexto de la receta activa + el inventario actual del usuario.

**Ejemplos de uso:**
- "¿Puedo meterle el boniato que tengo?" → responde con cantidad, en qué paso añadirlo y qué cambia en el resultado.
- "Tengo calabacín, ¿lo añado?" → responde con instrucción concreta (rallarlo, escurrirlo, cantidad).
- "¿Lo puedo hacer en air fryer?" → respuesta con temperatura y tiempo ajustado.
- "¿Cómo lo adapto para que Silvia lo pueda agarrar mejor?" → ajuste de formato/tamaño.

La respuesta es siempre concreta y contextualizada, no genérica.

**Persistencia — opción A (decidido):**
La conversación es efímera — desaparece al cerrar la receta. No se guarda el chat ni la variante modificada de forma explícita. Sin embargo, la app registra en el historial que se hizo esta preparación con esos ingredientes. La próxima vez que el usuario tenga los mismos ingredientes disponibles, la app lo recuerda y lo sugiere directamente.

---

### 10. Despensa base

Lista de ingredientes que la app asume disponibles siempre, sin necesidad de registrarlos en el inventario.

**Comportamiento:**
- Se configura una vez en la configuración del hogar.
- La app viene con una lista de defaults razonables que el usuario puede editar.
- Los ingredientes de la despensa base se usan en las sugerencias de preparación sin marcarse como "necesitas comprar esto".
- El usuario puede añadir o quitar items cuando cambia su despensa habitual.

**Defaults sugeridos:**
Aceite de oliva · ajo · cebolla · sal · especias básicas · huevos · yogur · pasta · arroz · avena · mantequilla/aceite de coco · tomate triturado · caldo · limón.

## Arquitectura de UI

### Navegación principal

**Hoy** (default, pantalla de inicio) — vista diaria con inventario activo, planning del día, KPIs de la semana y acciones rápidas. Es lo que el usuario abre cada mañana.

**Semana** — el WeekView existente. Queda accesible como vista secundaria para quien quiera la parrilla de 7 días, pero deja de ser el centro del producto.

**Ajustes** — configuración del hogar: despensa base, raciones por defecto, preparaciones habituales, KPI targets.

### Principio de navegación

Las acciones del flujo nuevo ("registrar preparación", "tengo tiempo", "voy a comprar", "¿qué ceno?") son CTAs o accesos rápidos desde la pantalla Hoy — no tabs ni destinos de navegación independientes. El nav principal tiene 3 items máximo.

### Features legacy

NewWeekModal, PrepPlan y WeekView se mantienen funcionales pero no son el flujo principal. NewWeekModal sigue accesible desde la vista Semana como opción avanzada. No modificar ningún componente legacy durante la implementación de v2.

---

## Flujos principales

### Flujo A — Ritual matutino *(el más frecuente)*

1. Abre la app por la mañana.
2. Ve el estado del día: stock disponible, KPIs de la semana, flotantes pendientes.
3. Planifica comida + cena (hoy, o también mañana/pasado si lo tiene claro).
4. La app pre-rellena sugerencias del inventario.
5. Ajusta rápido: confirma o cambia comida y cena.
6. Ve para cada comida: ya preparado / falta preparar + tiempo.
7. Opcionalmente ve orientación nutricional: "a la cena falta carbs".
8. Sale. Tiene la cabeza despejada.

**Duración objetivo: 2 minutos.**

---

### Flujo B — Registrar una preparación

1. Acaba de cocinar (alubias, muffins, boniato asado...).
2. Abre la app, toca "nueva preparación".
3. Escribe el nombre o elige de sugerencias recientes/frecuentes.
4. Indica raciones adulto / bebé.
5. Indica vida útil en días (o elige de una estimación por defecto según el tipo).
6. Indica tipo: ya-preparado / acelerador / snack.
7. La app sugiere etiquetas nutricionales → el usuario confirma o ajusta rápido.
8. Queda en inventario. Actualiza el estado de KPIs automáticamente.

**Duración objetivo: 30 segundos.**

---

### Flujo C — Ir de compras

1. El usuario activa "voy a comprar" antes de salir.
2. Ve lista de gaps por categoría (no lista de ingredientes específicos).
3. Ve flotantes sin plan y stock próximo a caducar.
4. Compra libremente.
5. Al volver, registra lo relevante (principalmente ingredientes flotantes o preparaciones nuevas).

---

### Flujo D — Resolver un flotante

1. La app muestra: "tienes carne picada sin plan · usar antes del viernes".
2. El usuario toca "¿qué hago?".
3. Ve 2-3 opciones de preparación con tiempo, batch/justo-antes, raciones e ingredientes extra necesarios.
4. Elige una.
5. La preparación planeada aparece en el inventario y opcionalmente se añade al planning del día elegido.

---

### Flujo E — Snack running low

1. Muffins quedan 2 → app lo muestra en el estado del día.
2. El usuario toca "preparar snack".
3. Ve 2-3 sugerencias distintas al último snack, basadas en despensa disponible.
4. Elige una → queda como preparación planeada.

### Flujo F — "Tengo X minutos, ¿qué preparo?"

1. El usuario tiene un rato libre y abre la app.
2. Activa "tengo tiempo para cocinar".
3. Indica cuánto tiempo tiene.
4. Ve 2-3 sugerencias ordenadas por utilidad para la semana.
5. Elige una (o no — sin presión).
6. Cocina.
7. Al terminar, registra la preparación (flujo B) con datos pre-rellenados.

---

- **Flujo de crear semana (NewWeekModal)** — puede sobrevivir como opción avanzada, pero no es el flujo principal ni el que necesita trabajo ahora.
- **PrepPlan tal como existe** — se reemplaza por estos flujos.
- **Logging retrospectivo** — no se logea lo que ya se comió. Solo se planifica hacia adelante.
- **Instrucciones BLW de presentación** — el usuario sabe cómo servir. La app no opina sobre cómo cortar o presentar la comida al bebé.
- **Recetas detalladas paso a paso** — la app sugiere preparaciones, no escribe recetas.

---

## Preguntas abiertas

1. ~~**¿Juan participa en la app?**~~ ✓ — App unipersonal. Juan no entra.
2. ~~**¿Historial semanal?**~~ ✓ — Sí. La app recuerda semanas anteriores y lo usa para evitar repetición en sugerencias.
3. ~~**¿Despensa base asumida?**~~ ✓ — Sí. Lista configurable con defaults (aceite, ajo, huevos, yogur, pasta, arroz...). Se configura una vez.
4. ~~**¿Notificaciones?**~~ ✓ — No push notifications. La pantalla de inicio muestra proactivamente el estado del día: flotantes pendientes, snack bajo, cena sin decidir.
5. ~~**¿Cómo se resetea la semana?**~~ ✓ — Automático el lunes. Los contadores de KPI vuelven a cero sin acción del usuario. La semana anterior queda en historial.
6. ~~**Configuración de raciones**~~ ✓ — Default del hogar configurable en ajustes (ej: 2 adultos + 1 bebé), con override rápido por día en el planning.
