// Carga data/ en Firestore.
//
//   npm run seed                 carga solo lo que falta (no pisa fichas ya editadas en el Hub)
//   npm run seed -- --force      pisa todo con lo que hay en data/
//   npm run seed -- --dry-run    muestra qué haría, sin conectarse
//
// Variables (en .env o en el entorno):
//   GOOGLE_APPLICATION_CREDENTIALS  JSON de la cuenta de servicio (fuera del repo)
//   EDITORES                        mails separados por coma -> config/editores
//
// Colecciones: productos/{id} (data/productos/*.json), config/{asesores,exterior,impuestos,onepagers,editores}.
// validaciones no se toca: la completan los editores desde el Hub.
import { readFile, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force"), DRY = args.has("--dry-run");

// .env mínimo (sin dependencias)
try {
  for (const line of (await readFile(join(ROOT, ".env"), "utf8")).split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {}

// Firestore no admite arrays dentro de arrays: [[a,b]] -> [{_a:[a,b]}]. Mismo formato que public/js/runtime.js.
const enc = (v) =>
  Array.isArray(v) ? v.map((x) => (Array.isArray(x) ? { _a: enc(x) } : enc(x)))
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)]))
  : v;
const readJSON = async (p) => JSON.parse(await readFile(join(ROOT, p), "utf8"));

const docs = [];
for (const f of (await readdir(join(ROOT, "data/productos"))).filter((f) => f.endsWith(".json") && f !== "index.json").sort())
  docs.push(["productos/" + f.slice(0, -5), await readJSON("data/productos/" + f)]);
for (const n of ["asesores", "exterior", "impuestos"]) docs.push(["config/" + n, await readJSON(`data/config/${n}.json`)]);
docs.push(["config/onepagers", await readJSON("data/config/onepagers.local.json")]); // rutas a public/onepagers

const editores = (process.env.EDITORES || "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
const malos = editores.filter((m) => !m.endsWith("@neix.com.ar"));
if (malos.length) { console.error("Estos editores no son de neix.com.ar:", malos.join(", ")); process.exit(1); }
if (editores.length) docs.push(["config/editores", { mails: editores }]);
else console.warn("Aviso: EDITORES vacío. No se toca config/editores (nadie nuevo podrá editar).");

if (DRY) {
  docs.forEach(([p]) => console.log("·", p));
  console.log(`\n${docs.length} documentos. Modo ${FORCE ? "--force (pisa todo)" : "solo faltantes"} (editores siempre se actualiza).`);
  process.exit(0);
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) { console.error("Falta GOOGLE_APPLICATION_CREDENTIALS (ver .env.example)."); process.exit(1); }
const { initializeApp, applicationDefault } = await import("firebase-admin/app");
const { getFirestore } = await import("firebase-admin/firestore");
initializeApp({ credential: applicationDefault() });
const db = getFirestore();

let creados = 0, pisados = 0, salteados = 0;
for (const [path, data] of docs) {
  const ref = db.doc(path);
  const existe = (await ref.get()).exists;
  if (existe && !FORCE && path !== "config/editores") { salteados++; continue; }
  await ref.set(enc(data));
  existe ? pisados++ : creados++;
  console.log(existe ? "↻" : "+", path);
}
console.log(`\nListo: ${creados} creados, ${pisados} actualizados, ${salteados} sin cambios (ya existían; usá --force para pisarlos).`);
