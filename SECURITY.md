# Security Audit — NutriWeek
> Revisado: 2026-04-14

---

## Resumen

| # | Check | Estado | Severidad |
|---|-------|--------|-----------|
| 1 | API key de Anthropic expuesta en DevTools | ✅ Corregido | Crítico |
| 2 | Endpoint sin autenticación | ✅ Corregido | Crítico |
| 3 | Rate limiting en cliente (bypasseable) | ✅ Corregido | Alto |
| 4 | Reglas de Firestore permisivas | ✅ Corregido | Alto |
| 5 | `console.log` con datos sensibles en prod | ✅ Corregido | Medio |
| 6 | Vulnerabilidades npm | ✅ Reducidas | Medio |
| 7 | CORS sin restringir origen | ✅ Corregido | Medio |
| 8 | Ausencia de validación/sanitización de inputs | ✅ Corregido | Medio |
| 9 | Backups de Firestore | ⚠️ Pendiente | Medio |

---

## Hallazgos y correcciones

### [CRÍTICO] API key de Anthropic expuesta al cliente

**Problema:** La API key de Anthropic se enviaba desde el cliente en el body de cada request a `/api/claude`. Cualquier usuario con DevTools podía verla en la pestaña Network y usarla fuera de la app.

**Corrección:**
- La key se elimina completamente del cliente
- El servidor (Netlify Function) verifica el Firebase ID token del usuario, busca el household en Firestore con Firebase Admin SDK, y resuelve la key server-side
- El cliente nunca recibe ni almacena la key
- Ficheros afectados: `netlify/functions/claude.js`, `src/lib/claude.js`, `src/App.jsx`, todos los componentes que propagaban `apiKey` como prop

---

### [CRÍTICO] Endpoint `/api/claude` sin autenticación

**Problema:** Cualquier persona sin cuenta podía llamar al endpoint directamente y consumir la API key del household.

**Corrección:**
- El handler verifica un Firebase ID token en el header `Authorization: Bearer <token>` en cada request
- Se usa Firebase Admin SDK (`firebase-admin/auth`) para verificar el token server-side
- Si el token falta o es inválido → 401
- Si el household no existe → 403
- Setup: `FIREBASE_SERVICE_ACCOUNT_B64` (JSON de cuenta de servicio en base64) como env var en Netlify

---

### [ALTO] Rate limiting gestionado en el cliente

**Problema:** El límite de llamadas mensuales se comprobaba en el cliente antes de hacer el request. Era bypasseable modificando el estado local o llamando al endpoint directamente.

**Corrección:**
- El servidor lee `aiCallsThisMonth` / `aiCallMonth` del documento del household en Firestore
- Si `calls >= limit` → 429 `CALL_LIMIT_EXCEEDED`
- El contador se incrementa server-side con `householdRef.update(...)` antes de llamar a Anthropic
- La cuota F&F (30 llamadas gratuitas) también se controla server-side con `freeCallsUsed`

---

### [ALTO] Reglas de Firestore demasiado permisivas

**Problema:** Las reglas originales permitían leer cualquier household a cualquier usuario autenticado.

**Corrección (`firestore.rules`):**
```
allow read: if request.auth != null && (
  get(/databases/$(database)/documents/users/$(request.auth.uid)).data.householdId == householdId ||
  get(/databases/$(database)/documents/users/$(request.auth.uid)).data.householdId == null
);
```
- Solo los miembros del household pueden leer sus datos
- `householdId == null` permite el flujo de onboarding (el usuario aún no tiene household asignado)
- Reglas desplegadas vía Firebase Console

---

### [MEDIO] `console.log` con datos sensibles en producción

**Problema:** Los logs de desarrollo podían exponer datos de usuario o de configuración en la consola del navegador en producción.

**Corrección (`vite.config.js`):**
```js
build: {
  minify: 'terser',
  terserOptions: {
    compress: { drop_console: true, drop_debugger: true }
  }
}
```
- Todos los `console.*` y `debugger` se eliminan en el bundle de producción

---

### [MEDIO] Vulnerabilidades npm

**Antes:** 24 vulnerabilidades (2 críticas, 7 altas, 9 medias, 6 bajas)

**Corrección:**
- `npm install firebase@latest` — principal fuente de vulnerabilidades
- `npm install vite-plugin-pwa@latest`
- **Después:** 2 vulnerabilidades residuales (ambas en dependencias de build, no en runtime — upstream-only)

---

### [MEDIO] CORS sin restringir origen

**Problema:** El header `Access-Control-Allow-Origin: *` permitía llamadas desde cualquier dominio.

**Corrección:**
- `CORS_ORIGIN` como env var en Netlify (valor: URL del sitio en producción)
- La función solo acepta el origen configurado; requests de otros dominios reciben CORS headers que el browser bloquea
- En desarrollo local: `CORS_ORIGIN=http://localhost:8888,http://localhost:5173` en `.env.local`

---

### [MEDIO] Inputs del usuario sin sanitizar

**Problema:** Los textos enviados al prompt de Claude (ingredientes, nombres de recetas, notas) podían contener prompt injection o textos excesivamente largos.

**Corrección:**
- Función `sanitize(input, maxLength)` en `netlify/functions/claude.js` aplicada a todos los inputs antes de incluirlos en el prompt
- Elimina saltos de línea (`\r\n` → espacio), hace trim, y trunca a un máximo configurable por campo (300–500 chars según contexto)

---

## Pendiente

### [MEDIO] Backups automáticos de Firestore

**Estado:** No configurado.

**Recomendación:** Activar backups programados desde GCP Console → Firestore → Backups. Retención mínima recomendada: 7 días. Coste estimado: ~$0.03/GB/mes.

---

## Arquitectura de seguridad resultante

```
Browser                    Netlify Function              Firebase / Anthropic
──────                     ────────────────              ────────────────────
Firebase ID token   ──►    verifyIdToken()        ──►   Firebase Admin SDK
(no API key)               fetchHousehold()              Firestore (server-side)
                           sanitize(inputs)
                           checkRateLimit()
                           resolveAnthropicKey()   ──►   Anthropic API
                    ◄──    JSON response
                           (key nunca sale del servidor)
```

La API key de Anthropic solo existe en:
1. Firestore (`households/{id}.anthropicApiKey`) — lectura solo desde el servidor
2. Env var `ANTHROPIC_API_KEY` en Netlify — para cuota F&F
