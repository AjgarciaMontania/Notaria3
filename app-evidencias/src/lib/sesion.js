// Sesión con Firebase Authentication: cada persona entra con su propia cuenta.
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth } from '../firebase';
import { marcarActividad, olvidarActividad } from './inactividad.js';
import { aCorreo } from '@calculo/roles.js';

// Firebase devuelve códigos en inglés; aquí se traducen.
const MENSAJES = {
  'auth/invalid-email': 'El usuario o el correo no tienen un formato válido.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada. Avisa al administrador.',
  'auth/user-not-found': 'No existe una cuenta con ese usuario.',
  'auth/wrong-password': 'Contraseña incorrecta.',
  'auth/invalid-credential': 'Usuario o contraseña incorrectos.',
  'auth/missing-password': 'Escribe la contraseña.',
  'auth/too-many-requests':
    'Demasiados intentos fallidos. Espera unos minutos antes de reintentar.',
  'auth/network-request-failed': 'Sin conexión. Revisa los datos o el wifi.',
  'auth/operation-not-allowed':
    'El acceso por correo y contraseña no está habilitado en Firebase.',
};

export function traducirError(fallo) {
  return MENSAJES[fallo?.code] || 'No se pudo iniciar sesión. Intenta de nuevo.';
}

/** Avisa cada vez que cambia la sesión (entrar, salir, o sesión recordada). */
export function alCambiarSesion(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function iniciarSesion(correo, clave) {
  // En el celular la sesión se recuerda entre aperturas de la app: sería
  // insufrible escribir correo y contraseña cada vez. Lo que la limita es el
  // cierre por inactividad, que ahora sí funciona con la app cerrada.
  // Acepta un nombre de usuario ("AlvaroArias") o un correo real: aCorreo()
  // le agrega el dominio interno solo cuando hace falta.
  await signInWithEmailAndPassword(auth, aCorreo(correo), clave);
  // El reloj de inactividad arranca aquí. Sin esta marca, la sesión recién
  // abierta se consideraría vencida de inmediato.
  marcarActividad();
}

export async function cerrarSesion() {
  olvidarActividad();
  try {
    await signOut(auth);
  } catch (fallo) {
    console.error('Error al cerrar sesión', fallo);
  }
}

export function usuarioActual() {
  return auth.currentUser;
}
