// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";  // ← Agrega esta importación para getFirestore

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA-h8Zy18sYDNuJihLLM0H7lxA2ct9gfUk",
  authDomain: "notaria-liquidacion.firebaseapp.com",
  projectId: "notaria-liquidacion",
  storageBucket: "notaria-liquidacion.firebasestorage.app",
  messagingSenderId: "564468614815",
  appId: "1:564468614815:web:d055a708bb9c1cfdc844aa",
  measurementId: "G-41EMHWGR4K"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Exporta la instancia de la base de datos Firestore
export const db = getFirestore(app);