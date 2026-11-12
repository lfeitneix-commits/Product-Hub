# Hub de Productos Neix — exportación para Claude Code

Exportado del artifact "Hub de Productos Neix · versión vigente" (claude.ai) el 11/11/2026.

## Qué hay
- `hub-neix.html` — la aplicación completa (HTML + CSS + JS en un archivo).
- `data/productos/*.json` — las 37 fichas de productos (un archivo por producto; el nombre es el id).
- `data/config/impuestos.json` — matriz impositiva.
- `data/config/exterior.json` — cuentas en el exterior, sociedades y bancos.
- `data/config/asesores.json` — asesores comerciales (nombre, mail, teléfono, área).
- `data/config/onepagers.local.json` — qué one pager corresponde a cada producto (rutas locales).
- `onepagers/*.pdf` — los one pagers originales.

## Importante: dependencias de Claude
El HTML usa el runtime de los artifacts de claude.ai (`window.claude`). Fuera de Claude, la página muestra
"Abrí el Hub con tu cuenta de Neix" porque no encuentra la base de datos. Hay que reemplazar estas piezas:

| En el código (`c.use(...)`) | Para qué se usa | Reemplazo sugerido |
| --- | --- | --- |
| `db` | Fichas (`productos/*`), `config/*`, `validaciones/*` | Firebase Firestore (o JSON estáticos en `data/` para arrancar) |
| `user` | Saber si el usuario puede editar; buscar asesores en el directorio | Login con Google (dominio neix.com.ar) + lista de editores |
| `sample` | Análisis de cartera con IA y "Mejorar con IA" | Función serverless en Vercel que llame a la API de Anthropic (la clave nunca en el navegador) |
| `downloads` | Descargar PDFs | Descarga normal del navegador (`<a download>` con un Blob) |
| `assets` (`/_blob/...`) | One pagers originales | Archivos de `onepagers/` servidos como estáticos (usar `onepagers.local.json`) |

La tenencia de comitentes es SIMULADA (`API_DEMO`, comitentes 10234, 20871 y 31555). Conectarla con datos reales
requiere aprobación de Compliance y Sistemas.

## Paso a paso sugerido en Claude Code
1. Crear un repo y copiar esta carpeta.
2. Pedirle a Claude Code: "Migrá hub-neix.html para que funcione fuera de claude.ai: reemplazá `window.claude`
   por lectura de `data/` (fase 1) y después por Firestore (fase 2), y los PDFs por descarga del navegador."
3. Agregar login antes de publicar: hoy Claude restringe el acceso a la organización; en Vercel la página es pública si no.
4. Recién con eso funcionando, sumar la función de IA con la API de Anthropic.
5. Una vez fuera de Claude, el botón "Enviar por WhatsApp" abre el chat directo (en Claude lo bloquea la plataforma).
