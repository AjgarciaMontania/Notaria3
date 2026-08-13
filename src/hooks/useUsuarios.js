// Lista de fichas de usuario y sus roles. Solo la usa el panel de
// administración: las reglas de Firebase impiden leer esta colección completa
// a quien no sea administrador.
import { useEffect, useState, useCallback } from "react";
import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase";
import { normalizarCorreo, esAdminRaiz, ROLES } from "../utils/roles.js";

export function useUsuarios(activo) {
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!activo) {
      setUsuarios([]);
      setCargando(false);
      return;
    }
    setCargando(true);
    const parar = onSnapshot(
      collection(db, "usuarios"),
      (lista) => {
        setUsuarios(
          lista.docs
            .map((d) => ({ correo: d.id, ...d.data() }))
            .sort((a, b) => a.correo.localeCompare(b.correo))
        );
        setCargando(false);
        setError("");
      },
      (fallo) => {
        console.error("No se pudo leer la lista de usuarios", fallo);
        setError("No se pudo leer la lista de usuarios.");
        setCargando(false);
      }
    );
    return parar;
  }, [activo]);

  /** Crea o actualiza la ficha de un correo. */
  const guardar = useCallback(async ({ correo, rol, nombre }, quienLoHace) => {
    const id = normalizarCorreo(correo);
    if (!id) throw new Error("Escribe el correo.");
    if (!id.includes("@")) throw new Error("Ese correo no parece válido.");
    if (!Object.values(ROLES).includes(rol)) throw new Error("Rol no válido.");
    if (esAdminRaiz(id)) {
      throw new Error(
        "El administrador principal no se administra desde aquí: su rol está fijado en el código y en las reglas, para que nadie pueda dejarte sin acceso."
      );
    }
    await setDoc(
      doc(db, "usuarios", id),
      {
        rol,
        nombre: (nombre ?? "").trim(),
        actualizadoPor: normalizarCorreo(quienLoHace) || null,
        actualizadoEn: serverTimestamp(),
      },
      { merge: true }
    );
  }, []);

  /** Borra la ficha: la cuenta vuelve al rol por defecto (invitado). */
  const eliminar = useCallback(async (correo) => {
    const id = normalizarCorreo(correo);
    if (esAdminRaiz(id)) {
      throw new Error("El administrador principal no se puede quitar.");
    }
    await deleteDoc(doc(db, "usuarios", id));
  }, []);

  return { usuarios, cargando, error, guardar, eliminar };
}
