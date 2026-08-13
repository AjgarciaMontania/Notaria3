// Rol de la persona que tiene la sesión abierta.
//
// Se lee de Firestore, del documento usuarios/{correo}. Si no existe ficha,
// vale el rol por defecto (invitado, que solo liquida). El administrador raíz
// es admin siempre, sin necesidad de ficha ni de conexión.
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { rolDe, esAdminRaiz, normalizarCorreo, ROLES } from "../utils/roles.js";

export function useRol(usuario) {
  const [rol, setRol] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const correo = normalizarCorreo(usuario?.email);

    if (!correo) {
      setRol(null);
      setCargando(false);
      return;
    }

    // La llave maestra no depende de Firestore: si el administrador raíz entra,
    // es admin de inmediato aunque la colección esté vacía o sin conexión.
    if (esAdminRaiz(correo)) {
      setRol(ROLES.ADMIN);
      setCargando(false);
      return;
    }

    setCargando(true);
    const parar = onSnapshot(
      doc(db, "usuarios", correo),
      (ficha) => {
        setRol(rolDe(correo, ficha.exists() ? ficha.data() : null));
        setCargando(false);
      },
      (fallo) => {
        // Sin permiso o sin red: se asume el rol más restringido. Nunca se
        // conceden permisos por un error de lectura.
        console.error("No se pudo leer el rol", fallo);
        setRol(rolDe(correo, null));
        setCargando(false);
      }
    );
    return parar;
  }, [usuario?.email]);

  return { rol, cargando };
}
