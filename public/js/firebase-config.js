/*
 * Configuración web de Firebase (no es secreta: identifica al proyecto, no da acceso).
 * La seguridad la dan el login con Google y las reglas de firestore.rules.
 *
 * Firebase console › Configuración del proyecto › Tus apps › App web › "SDK setup and configuration" › Config.
 * Si apiKey queda vacío, el Hub funciona en modo local (fase 1): lee los JSON de data/ y no pide login.
 */
window.NEIX_FIREBASE = {
  apiKey: "AIzaSyBKWqmGM4Ma1Zi6l5Sn10nWJeCI9C7_4NI",
  authDomain: "product-hub-a1b33.firebaseapp.com",
  projectId: "product-hub-a1b33",
  storageBucket: "product-hub-a1b33.firebasestorage.app",
  messagingSenderId: "918509178468",
  appId: "1:918509178468:web:8efb2263decad38e5f5971",
};

// Solo pueden entrar cuentas de este dominio (además lo exigen las reglas de Firestore).
window.NEIX_DOMINIO = "neix.com.ar";
