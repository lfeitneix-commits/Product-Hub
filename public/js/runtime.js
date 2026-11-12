/*
 * Runtime del Hub de Productos Neix fuera de claude.ai.
 *
 * Reemplaza a window.claude con la misma forma de uso: window.neixRuntime.use(nombre)
 * devuelve una promesa con el servicio pedido. El código del Hub no cambia según el backend.
 *
 * Dos modos, según public/js/firebase-config.js:
 *   Firebase (hay apiKey): login con Google restringido al dominio, datos en Firestore.
 *   Local (sin apiKey):    JSON de data/ servidos por scripts/dev-server.mjs, sin login (fase 1).
 *                          Con ?editor=1 en la URL se simula un editor para probar Gestión.
 *
 *   db         collection(n).onSnapshot · doc(p).onSnapshot · doc(p).set
 *   user       canEdit · id · me · search
 *   downloads  save({filename, data}) con Blob + <a download>
 *   sample     IA: se habilita en la fase 3 con la función /api (por ahora null).
 */
(function () {
  "use strict";

  const FB_VERSION = "10.12.2";
  const CFG = window.NEIX_FIREBASE || {};
  const DOMINIO = (window.NEIX_DOMINIO || "neix.com.ar").toLowerCase();
  const MODE = CFG.apiKey ? "firebase" : "local";
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* ── Firestore no admite arrays dentro de arrays (beneficios, objeciones, matriz impositiva).
        Se guardan como [{_a:[...]}] y se reconstruyen al leer. Mismo formato que scripts/seed-firestore.mjs. ── */
  const enc = (v) =>
    Array.isArray(v) ? v.map((x) => (Array.isArray(x) ? { _a: enc(x) } : enc(x)))
    : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, enc(x)]))
    : v;
  const dec = (v) =>
    Array.isArray(v) ? v.map(dec)
    : v && typeof v === "object" ? (Object.keys(v).length === 1 && Array.isArray(v._a) ? v._a.map(dec) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, dec(x)])))
    : v;

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

  /* ════════ Modo local (fase 1) ════════ */
  const getJSON = async (url) => {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status + " " + url);
    return r.json();
  };
  const CONFIG_FILES = {
    asesores: "data/config/asesores.json",
    exterior: "data/config/exterior.json",
    impuestos: "data/config/impuestos.json",
    onepagers: "data/config/onepagers.local.json",
  };
  function createStaticDb() {
    const store = { productos: null, validaciones: {}, config: {} };
    const listeners = [];
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
        if (!(id in store.config)) store.config[id] = CONFIG_FILES[id] ? await getJSON(CONFIG_FILES[id]).catch(() => null) : null;
        return store.config[id];
      }
      const all = await loadCollection(col);
      return all[id] == null ? null : all[id];
    }
    const colSnap = (all) => ({ metadata: { fromCache: false }, docs: Object.entries(all).map(([id, d]) => ({ id, data: () => clone(d) })) });
    const docSnap = (d) => ({ exists: d != null, data: () => (d == null ? undefined : clone(d)) });
    function notify(path) {
      const col = path.split("/")[0];
      listeners.forEach((l) => {
        if (l.kind === "doc" && l.path === path) loadDoc(path).then((d) => l.cb(docSnap(d)));
        if (l.kind === "col" && l.path === col) loadCollection(col).then((all) => l.cb(colSnap(all)));
      });
    }
    const listen = (kind, path, load, wrap) => (cb, onErr) => {
      const l = { kind, path, cb };
      listeners.push(l);
      load(path).then((x) => cb(wrap(x)), (e) => onErr && onErr(e));
      return () => listeners.splice(listeners.indexOf(l), 1);
    };
    return {
      collection: (name) => ({ onSnapshot: listen("col", name, loadCollection, colSnap) }),
      doc: (path) => ({
        onSnapshot: listen("doc", path, loadDoc, docSnap),
        async set(data) { // queda en memoria hasta recargar
          const [col, id] = path.split("/");
          if (col === "config") store.config[id] = clone(data);
          else (await loadCollection(col))[id] = clone(data);
          notify(path);
        },
      }),
    };
  }
  const localServices = () => {
    const devUser = /[?&]editor=1\b/.test(location.search)
      ? { canEdit: async () => true, id: async () => "editor-local", me: async () => ({ name: "", email: "" }), search: async () => [] }
      : null;
    return { db: async () => createStaticDb(), user: async () => devUser };
  };

  /* ════════ Modo Firebase (fase 2) ════════ */
  let fbReady = null; // promesa con {fs, auth, user, sdk}
  function loadFirebase() {
    if (fbReady) return fbReady;
    const base = "https://www.gstatic.com/firebasejs/" + FB_VERSION + "/";
    fbReady = Promise.all([import(base + "firebase-app.js"), import(base + "firebase-auth.js"), import(base + "firebase-firestore.js")]).then(
      ([appSdk, authSdk, fsSdk]) => {
        const app = appSdk.initializeApp(CFG);
        const auth = authSdk.getAuth(app);
        const fs = fsSdk.getFirestore(app);
        // Primer estado de sesión: usuario de Neix, o null (y se cierra cualquier sesión de otro dominio).
        return new Promise((ok) => {
          const off = authSdk.onAuthStateChanged(auth, async (u) => {
            off();
            if (u && !esNeix(u)) { await authSdk.signOut(auth); u = null; }
            ok({ app, auth, fs, user: u, authSdk, fsSdk });
          });
        });
      }
    );
    return fbReady;
  }
  const esNeix = (u) => !!(u && u.email && u.emailVerified && u.email.toLowerCase().endsWith("@" + DOMINIO));

  // Los códigos de Firestore vienen con guion ("permission-denied"); el Hub espera guion bajo.
  const fsErr = (e) => { const x = new Error(e && e.message); x.code = String((e && e.code) || "").replace(/-/g, "_"); return x; };

  function createFirestoreDb(F) {
    const { fs, fsSdk: S } = F;
    const ref = (path) => S.doc(fs, ...path.split("/"));
    return {
      collection: (name) => ({
        onSnapshot: (cb, onErr) =>
          S.onSnapshot(S.collection(fs, name), { includeMetadataChanges: true },
            (snap) => cb({ metadata: { fromCache: snap.metadata.fromCache }, docs: snap.docs.map((d) => ({ id: d.id, data: () => dec(d.data()) })) }),
            (e) => onErr && onErr(fsErr(e))),
      }),
      doc: (path) => ({
        onSnapshot: (cb, onErr) =>
          S.onSnapshot(ref(path),
            (d) => cb({ exists: d.exists(), data: () => (d.exists() ? dec(d.data()) : undefined) }),
            (e) => onErr && onErr(fsErr(e))),
        set: (data) => S.setDoc(ref(path), enc(clone(data))).catch((e) => { throw fsErr(e); }),
      }),
    };
  }
  function createFirebaseUser(F) {
    const u = F.user;
    const email = u.email.toLowerCase();
    let editores = null;
    const leerEditores = async () => {
      if (!editores) {
        const d = await F.fsSdk.getDoc(F.fsSdk.doc(F.fs, "config", "editores")).catch(() => null);
        editores = ((d && d.exists() && d.data().mails) || []).map((m) => String(m).toLowerCase());
      }
      return editores;
    };
    return {
      canEdit: async () => (await leerEditores()).includes(email),
      id: async () => email,
      me: async () => ({ name: u.displayName || "", email: u.email || "" }),
      search: async () => [], // el Hub ya busca en config/asesores (data/config/asesores.json)
    };
  }
  const firebaseServices = () => ({
    db: async () => { const F = await loadFirebase(); return F.user ? createFirestoreDb(F) : null; },
    user: async () => { const F = await loadFirebase(); return F.user ? createFirebaseUser(F) : null; },
  });

  /* ── Sesión (solo modo Firebase) ── */
  async function login() {
    const F = await loadFirebase();
    const A = F.authSdk;
    const provider = new A.GoogleAuthProvider();
    provider.setCustomParameters({ hd: DOMINIO, prompt: "select_account" });
    const res = await A.signInWithPopup(F.auth, provider);
    if (!esNeix(res.user)) {
      await A.signOut(F.auth);
      const e = new Error("dominio"); e.code = "wrong_domain"; throw e;
    }
    location.reload();
  }
  async function logout() {
    const F = await loadFirebase();
    await F.authSdk.signOut(F.auth);
    location.reload();
  }
  async function session() {
    if (MODE !== "firebase") return null;
    const F = await loadFirebase();
    return F.user ? { name: F.user.displayName || "", email: F.user.email || "" } : null;
  }

  const services = Object.assign(
    { downloads: async () => downloads, sample: async () => null },
    MODE === "firebase" ? firebaseServices() : localServices()
  );

  window.neixRuntime = {
    mode: MODE,
    dominio: DOMINIO,
    use(name) {
      const make = services[name];
      return make ? make().catch((e) => { console.error("neixRuntime." + name, e); return null; }) : Promise.resolve(null);
    },
    login,
    logout,
    session,
  };
})();
