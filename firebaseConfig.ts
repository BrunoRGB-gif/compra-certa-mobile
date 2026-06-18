export const firebaseConfig = {
  apiKey: "AIzaSyCMxoRBtTUyJFyegSO2qsnfnKMPCxvZByI",
  authDomain: "lista-inteligente-compra-13732.firebaseapp.com",
  projectId: "lista-inteligente-compra-13732",
  storageBucket: "lista-inteligente-compra-13732.firebasestorage.app",
  messagingSenderId: "17284192324",
  appId: "1:17284192324:web:ed5dcaf0d6f60c460b8411",
  measurementId: "G-7EZPLGRC17"
} as const;

export const firebaseIsConfigured = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.storageBucket &&
    firebaseConfig.appId
);
