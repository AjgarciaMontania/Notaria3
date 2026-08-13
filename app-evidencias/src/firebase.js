// Conexión a la MISMA base de datos que usa la página web.
// Si algún día cambias el proyecto de Firebase en la web, cambia también estos datos.
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyA-h8Zy18sYDNuJihLLM0H7lxA2ct9gfUk',
  authDomain: 'notaria-liquidacion.firebaseapp.com',
  projectId: 'notaria-liquidacion',
  storageBucket: 'notaria-liquidacion.firebasestorage.app',
  messagingSenderId: '564468614815',
  appId: '1:564468614815:web:d055a708bb9c1cfdc844aa',
  measurementId: 'G-41EMHWGR4K',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
