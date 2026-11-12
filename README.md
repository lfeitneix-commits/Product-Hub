# Hub de Productos Neix

Herramienta interna para que los comerciales de Neix consulten productos, analicen la cartera de un cliente
y armen propuestas y presentaciones en PDF. Migración del artifact de claude.ai para publicarlo en Vercel.
El README original del export está en `README-export.md`.

## Estructura
- `public/index.html` — el Hub (HTML + CSS + JS en un archivo, igual al artifact salvo los puntos de integración).
- `public/js/runtime.js` — reemplazo de `window.claude`: base de datos, descargas, usuario e IA.
- `public/js/firebase-config.js` — configuración web de Firebase (no es secreta). Vacía = modo local.
- `firestore.rules` — quién lee y quién escribe en Firestore.
- `scripts/seed-firestore.mjs` — carga `data/` en Firestore.
- `public/onepagers/*.pdf` — one pagers originales, servidos como archivos estáticos.
- `data/productos/*.json`, `data/config/*.json` — fichas y configuración (fuente para cargar Firestore).
- `scripts/dev-server.mjs` — servidor local de la fase 1 (sin dependencias).

## Estado de la migración
| Pieza | Modo local (sin config de Firebase) | Con Firebase |
| --- | --- | --- |
| `db` | JSON de `data/` (lo que se edita queda en memoria) | Firestore |
| `user` | Sin login. `?editor=1` simula un editor | Login con Google, solo neix.com.ar; editores en `config/editores` |
| `sample` | Sin IA (fase 3) | Sin IA (fase 3: función `/api` en Vercel) |
| `downloads` | Blob + `<a download>` | Igual |
| one pagers | `public/onepagers` vía `onepagers.local.json` | Igual |
| WhatsApp | Abre wa.me (mobile) o web.whatsapp.com (desktop) | Igual |

La tenencia de comitentes sigue SIMULADA (`API_DEMO`: 10234, 20871, 31555).

## Correr en local
Requiere Node 18 o superior.

```bash
npm run dev
```

Abrir http://localhost:5173. Para probar Gestión y Editar: http://localhost:5173/?editor=1

## Conectar Firebase (fase 2)
1. En https://console.firebase.google.com crear un proyecto (Google Analytics no hace falta).
2. **Firestore Database** › Crear base de datos › modo producción › ubicación `southamerica-east1` (São Paulo).
3. **Authentication** › Comenzar › Método de acceso › **Google** › Habilitar.
   En Configuración › Dominios autorizados ya está `localhost`; el dominio de Vercel se suma en la fase 4.
4. **Configuración del proyecto** › Tus apps › agregar app **Web** (sin Hosting) y copiar los valores de `firebaseConfig`
   en `public/js/firebase-config.js`.
5. **Reglas**: en Firestore › Reglas, pegar el contenido de `firestore.rules` y publicar.
   (O con Firebase CLI: `firebase deploy --only firestore:rules`.)
6. **Cargar los datos**: Configuración del proyecto › Cuentas de servicio › Generar nueva clave privada.
   Guardar el JSON **fuera del repo**, copiar `.env.example` a `.env` y completar la ruta y los editores.

```bash
npm install
```

```bash
npm run seed -- --dry-run
```

```bash
npm run seed
```

`npm run seed` no pisa fichas que ya existen (para no perder lo editado desde el Hub); `--force` las pisa con `data/`.
`config/editores` se actualiza siempre con `EDITORES`.

### Formato en Firestore
Firestore no admite arrays dentro de arrays (beneficios, objeciones, competencia, matriz impositiva).
Se guardan como `[{"_a": [...]}]` y el runtime los reconstruye al leer. No editar esos campos a mano en la consola.
