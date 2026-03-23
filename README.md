# NutriWeek

Planificador semanal de alimentación BLW para bebé (~12 meses) y familia, con generación de menús con IA, seguimiento de comidas, KPIs nutricionales y lista de la compra.

## Stack

- **React + Vite** — frontend
- **Tailwind CSS** — estilos
- **Firebase Auth** (Google Sign-In) + **Firestore** — autenticación y base de datos
- **Claude API** (claude-haiku-4-5) — generación de menús con IA (a través de Netlify Functions)
- **@dnd-kit** — drag & drop
- **html2canvas** — exportar semana como imagen
- **Netlify** — deploy + serverless functions (todo free tier)

## Configuración

### 1. Copia el fichero de variables de entorno

```bash
cp .env.example .env
```

### 2. Firebase

1. Ve a [console.firebase.google.com](https://console.firebase.google.com) y crea un proyecto
2. Activa **Authentication** → Google Sign-In
3. Activa **Firestore Database**
4. Copia las credenciales en `.env`:

```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```

5. En Firestore, ve a **Rules** y pega el contenido de `firestore.rules`

### 3. Anthropic API Key

Obtén tu API key en [console.anthropic.com](https://console.anthropic.com).

En **local**, añádela a `.env` (usada por la Netlify function en dev):
```
ANTHROPIC_API_KEY=sk-ant-...
```

En **Netlify**, añádela como variable de entorno en Site settings → Environment variables.

### 4. Desarrollo local

```bash
npm install

# Para probar las Netlify functions en local:
npm install -g netlify-cli
netlify dev
```

O sin Netlify CLI (las llamadas a IA no funcionarán):
```bash
npm run dev
```

### 5. Deploy en Netlify

1. Conecta el repo en [netlify.com](https://app.netlify.com)
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Functions directory: `netlify/functions`
5. Añade la variable de entorno `ANTHROPIC_API_KEY`

El fichero `netlify.toml` ya tiene todo configurado.

## Funcionalidades

### Autenticación y Onboarding
- Google Sign-In con sesión persistente
- Al primer acceso: crear familia (genera código de invitación) o unirse a una existente

### Vista Semanal
- Cabecera con etiqueta editable y navegación ‹ › entre semanas
- KPIs siempre visibles: hierro (≥5/7 días), pescado graso (≥3 días), verduras distintas (≥5)
- Alerta si misma proteína >2 días consecutivos
- Grid de 7 días con indicadores de color por KPIs
- Botón "Nueva semana" con generación IA o vacía
- Exportar como imagen (html2canvas)

### Nueva Semana con IA
- Campo de ingredientes disponibles en casa
- Llama a Claude para generar menú completo (7 días × 5 franjas)
- Vista previa editable antes de guardar
- Botón "Regenerar día" por día individual

### Vista de Día
- Navegación por días (← →)
- 5 slots: Desayuno, Snack AM, Comida, Merienda, Cena
- Cada slot con: texto bebé, texto adulto, tags, barra de color por nutriente
- Edición inline con selector de tags, búsqueda de recetas, sugerencia con IA
- Copiar slot a otro día/franja
- Drag & drop entre slots
- Registrar si se comió (✓/✗ + nota)

### Lista de la Compra
- Generada automáticamente desde el texto del menú
- Categorías: proteína animal, verdura, fruta, despensa
- Ingredientes "ya en casa" aparecen separados
- Checkboxes persistentes en Firestore
- Exportar como texto plano (para WhatsApp)

### Libro de Recetas
- Guardar cualquier comida como receta
- Buscar y pegar recetas en el editor de comidas

## Estructura de datos en Firestore

```
users/{uid}
households/{householdId}
households/{householdId}/weeks/{weekId}
households/{householdId}/recipes/{recipeId}
```

## Tags nutricionales

| Tag | Color | Significado |
|-----|-------|-------------|
| `iron` | Naranja | Fuente de hierro (carne, legumbre, pescado azul) |
| `fish` | Azul | Pescado graso (salmón, caballa, sardina, atún) |
| `legume` | Verde | Legumbres |
| `egg` | Amarillo | Huevo |
| `dairy` | Celeste | Lácteo |
| `fruit` | Rosa | Fruta |
| `cereal` | Ámbar | Cereal/carbohidrato |
| `veggie:nombre` | Lima | Verdura específica |
