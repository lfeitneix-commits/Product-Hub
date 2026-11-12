/*
 * Runtime del Hub de Productos Neix fuera de claude.ai.
 *
 * Reemplaza a window.claude con la misma forma de uso: window.neixRuntime.use(nombre)
 * devuelve una promesa con el servicio pedido. El código del Hub no cambia según el backend.
 *
 *   db         Fase 1: JSON estáticos de /data (solo lectura; las escrituras quedan en memoria).
 *   downloads  Descarga del navegador con Blob + <a download>.
 *   user       Fase 1: sin login (null). Con ?editor=1 en la URL se simula un editor para probar Gestión.
 *   sample     Fase 1: sin IA (null). Se habilita en la fase 3 con la función /api.
 */
(function () {
  "use strict";

  /* ── Base de datos: JSON estáticos ── */
  const getJSON = async (url) => {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status + " " + url);
    return r.json();
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // Documentos de config/* y el archivo de data/ que les corresponde.
  const CONFIG_FILES = {
    asesores: "data/config/asesores.json",
    exterior: "data/config/exterior.json",
    impuestos: "data/config/impuestos.json",
    onepagers: "data/config/onepagers.local.json",
  };

  function createStaticDb() {
    const store = { productos: null, validaciones: {}, config: {} }; // cache en memoria
    const listeners = []; // {kind:"col"|"doc", path, cb}

    async function loadCollection(name) {
      if (name === "validaciones") return store.validaciones;
      if (name !== "productos") return {};
      if (!store.productos) {
        const ids = await getJSON("data/productos/index.json");
        const docs = await Promise.all(ids.map((id) => getJSON("data/productos/" + id + ".json").then((d) => [id, d])));
        store.productos = Object.fromEntries(docs);
      }
      return store.productos;
    }
    async function loadDoc(path) {
      const [col, id] = path.split("/");
      if (col === "config") {
        if (!(id in store.config)) {
          const file = CONFIG_FILES[id];
          store.config[id] = file ? await getJSON(file).catch(() => null) : null;
        }
        return store.config[id];
      }
      const all = await loadCollection(col);
      return all[id] == null ? null : all[id];
    }
    const colSnap = (all) => ({
      metadata: { fromCache: false },
      docs: Object.entries(all).map(([id, d]) => ({ id, data: () => clone(d) })),
    });
    const docSnap = (d) => ({ exists: d != null, data: () => (d == null ? undefined : clone(d)) });

    function notify(path) {
      const col = path.split("/")[0];
      listeners.forEach((l) => {
        if (l.kind === "doc" && l.path === path) loadDoc(path).then((d) => l.cb(docSnap(d)));
        if (l.kind === "col" && l.path === col) loadCollection(col).then((all) => l.cb(colSnap(all)));
      });
    }

    return {
      collection(name) {
        return {
          onSnapshot(cb, onErr) {
            const l = { kind: "col", path: name, cb };
            listeners.push(l);
            loadCollection(name).then((all) => cb(colSnap(all)), (e) => onErr && onErr(e));
            return () => listeners.splice(listeners.indexOf(l), 1);
          },
        };
      },
      doc(path) {
        return {
          onSnapshot(cb, onErr) {
            const l = { kind: "doc", path, cb };
            listeners.push(l);
            loadDoc(path).then((d) => cb(docSnap(d)), (e) => onErr && onErr(e));
            return () => listeners.splice(listeners.indexOf(l), 1);
          },
          // Fase 1: los cambios viven en memoria hasta recargar la página.
          async set(data) {
            const [col, id] = path.split("/");
            if (col === "config") store.config[id] = clone(data);
            else (await loadCollection(col))[id] = clone(data);
            notify(path);
          },
        };
      },
    };
  }

  /* ── Descargas: Blob + <a download> ── */
  const downloads = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    },
  };

  /* ── Usuario (fase 1: sin login) ── */
  const devEditor = /[?&]editor=1\b/.test(location.search);
  const devUser = devEditor
    ? {
        canEdit: async () => true,
        id: async () => "editor-local",
        me: async () => ({ name: "", email: "" }),
        search: async () => [],
      }
    : null;

  const services = {
    db: () => createStaticDb(),
    downloads: () => downloads,
    user: () => devUser,
    sample: () => null,
  };

  window.neixRuntime = {
    use(name) {
      const make = services[name];
      return Promise.resolve(make ? make() : null);
    },
  };
})();
