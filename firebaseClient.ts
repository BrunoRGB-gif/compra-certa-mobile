import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import "firebase/compat/storage";
import { firebaseConfig, firebaseIsConfigured } from "./firebaseConfig";

export function getFirebaseClient() {
  if (!firebaseIsConfigured) {
    throw new Error("Configuração do aplicativo pendente.");
  }

  const app = firebase.apps.length
    ? firebase.app()
    : firebase.initializeApp(firebaseConfig);

  return {
    app,
    auth: firebase.auth(),
    db: firebase.firestore(),
    storage: firebase.storage(),
    firebase
  };
}
