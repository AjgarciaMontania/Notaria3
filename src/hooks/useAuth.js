// Autenticación con Firebase: correo y contraseña, una cuenta por persona.
import { useState, useEffect, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { auth } from "../firebase";
import { esSoloLiquidacion } from "../utils/roles.js";

// Firebase devuelve códigos en inglés; aquí se traducen a algo entendible.
const MENSAJES = {
  "auth/invalid-email": "El correo no tiene un formato válido.",
  "auth/user-disabled": "Esta cuenta está deshabilitada. Avisa al administrador.",
  "auth/user-not-found": "No existe una cuenta con ese correo.",
  "auth/wrong-password": "Contraseña incorrecta.",
  "auth/invalid-credential": "Correo o contraseña incorrectos.",
  "auth/missing-password": "Escribe la contraseña.",
  "auth/too-many-requests":
    "Demasiados intentos fallidos. Espera unos minutos antes de reintentar.",
  "auth/network-request-failed": "Sin conexión. Revisa tu internet.",
  "auth/operation-not-allowed":
    "El acceso por correo y contraseña no está habilitado en Firebase.",
};

// Aviso para las cuentas que solo pueden liquidar desde el celular.
const SOLO_APK =
  "Esta cuenta solo puede usarse en la aplicación del celular. " +
  "Para liquidar en el computador no necesitas iniciar sesión: la " +
  "calculadora de esta página es de uso libre.";

export function useAuth() {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const dejarDeEscuchar = onAuthStateChanged(auth, (cuenta) => {
      // Una cuenta de solo liquidación no abre sesión en la web ni siquiera
      // si el navegador la tenía recordada: se cierra de inmediato.
      if (cuenta && esSoloLiquidacion(cuenta.email)) {
        signOut(auth).catch(() => {});
        setUsuario(null);
        setError(SOLO_APK);
        setCargando(false);
        return;
      }
      setUsuario(cuenta);
      setCargando(false);
    });
    return dejarDeEscuchar;
  }, []);

  const entrar = useCallback(async (correo, clave) => {
    setError("");
    try {
      // Persistencia de pestaña: al cerrar el navegador la sesión se cierra.
      // En un computador compartido de la notaría es lo prudente.
      await setPersistence(auth, browserSessionPersistence);
      const { user } = await signInWithEmailAndPassword(auth, correo.trim(), clave);
      // La contraseña era correcta, pero esta cuenta es solo para la APK.
      if (esSoloLiquidacion(user?.email)) {
        await signOut(auth);
        setError(SOLO_APK);
        return false;
      }
      return true;
    } catch (fallo) {
      setError(MENSAJES[fallo.code] || "No se pudo iniciar sesión. Intenta de nuevo.");
      return false;
    }
  }, []);

  const salir = useCallback(async () => {
    try {
      await signOut(auth);
    } catch (fallo) {
      console.error("Error al cerrar sesión", fallo);
    }
  }, []);

  return { usuario, cargando, error, setError, entrar, salir };
}
