# Hub de Productos Neix

Herramienta interna para que los comerciales de Neix consulten productos, analicen la cartera de un cliente
y armen propuestas y presentaciones en PDF. Migración del artifact de claude.ai para publicarlo en Vercel.
El README original del export está en `README-export.md`.

## Estructura
- `public/index.html` — el Hub (HTML + CSS + JS en un archivo, igual al artifact salvo los puntos de integración).
- `public/js/runtime.js` — reemplazo de `window.claude`: base de datos, descargas, usuario e IA.
- `public/onepagers/*.pdf` — one pagers originales, servidos como archivos estáticos.
- `data/productos/*.json`, `data/config/*.json` — fichas y configuración (fuente para cargar Firestore).
- `scripts/dev-server.mjs` — servidor local de la fase 1 (sin dependencias).

## Estado de la migración
| Pieza | Fase 1 (actual) | Destino |
| --- | --- | --- |
| `db` | JSON de `data/` (solo lectura; lo que se edita queda en memoria) | Firestore (fase 2) |
| `user` | Sin login. `?editor=1` simula un editor para probar Gestión | Google, dominio neix.com.ar (fase 2) |
| `sample` | Sin IA: los botones de IA no aparecen | Función `/api` en Vercel (fase 3) |
| `downloads` | Blob + `<a download>` | Igual |
| one pagers | `public/onepagers` vía `onepagers.local.json` | Igual |
| WhatsApp | Abre wa.me (mobile) o web.whatsapp.com (desktop) | Igual |

La tenencia de comitentes sigue SIMULADA (`API_DEMO`: 10234, 20871, 31555).

## Correr en local (fase 1)
Requiere Node 18 o superior.

```bash
npm run dev
```

Abrir http://localhost:5173. Para probar Gestión y Editar: http://localhost:5173/?editor=1
