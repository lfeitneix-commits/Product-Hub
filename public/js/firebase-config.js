/*
 * Configuración web de Firebase (no es secreta: identifica al proyecto, no da acceso).
 * La seguridad la dan el login con Google y las reglas de firestore.rules.
 *
 * Firebase console › Configuración del proyecto › Tus apps › App web › "SDK setup and configuration" › Config.
 * Si apiKey queda vacío, el Hub funciona en modo local (fase 1): lee los JSON de data/ y no pide login.
 */
window.NEIX_FIREBASE = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

// Solo pueden entrar cuentas de este dominio (además lo exigen las reglas de Firestore).
window.NEIX_DOMINIO = "neix.com.ar";
