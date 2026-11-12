// Servidor local de la fase 1 (sin dependencias).
// Sirve public/ en "/" y data/ en "/data/". El índice de productos (/data/productos/index.json)
// se arma al vuelo con los archivos de data/productos, así no hay que mantenerlo a mano.
import { createServer } from "node:http";
import { readFile, readdir, stat } from "node:fs/promises";
import { join, normalize, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(ROOT, "public");
const DATA = join(ROOT, "data");
const PORT = Number(process.env.PORT) || 5173;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".pdf": "application/pdf", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".ico": "image/x-icon" };

const safe = (base, rel) => { const p = normalize(join(base, rel)); return p.startsWith(base) ? p : null; };

createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    if (path === "/data/productos/index.json") {
      const ids = (await readdir(join(DATA, "productos"))).filter((f) => f.endsWith(".json") && f !== "index.json").map((f) => f.slice(0, -5)).sort();
      res.writeHead(200, { "content-type": TYPES[".json"], "cache-control": "no-store" });
      return res.end(JSON.stringify(ids));
    }
    let file = path.startsWith("/data/") ? safe(DATA, path.slice(6)) : safe(PUBLIC, path === "/" ? "index.html" : path.slice(1));
    if (!file) { res.writeHead(403); return res.end(); }
    if ((await stat(file).catch(() => null))?.isDirectory()) file = join(file, "index.html");
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("No encontrado");
  }
}).listen(PORT, () => console.log(`Hub de Productos Neix en http://localhost:${PORT}`));
