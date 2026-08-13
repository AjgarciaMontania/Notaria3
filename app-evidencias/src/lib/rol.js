// Nivel de acceso de la cuenta que está usando la APK.
//
// Se lee de Firestore (usuarios/{correo}), el mismo sitio que administra la
// página web. Si no hay ficha, vale el rol por defecto: invitado, que solo
// puede liquidar. El administrador raíz es admin siempre, sin ficha ni red.
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { rolDe, esAdminRaiz, normalizarCorreo, ROLES } from '@calculo/roles.js';

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

    if (esAdminRaiz(correo)) {
      setRol(ROLES.ADMIN);
      setCargando(false);
      return;
    }

    setCargando(true);
    const parar = onSnapshot(
      doc(db, 'usuarios', correo),
      (ficha) => {
        setRol(rolDe(correo, ficha.exists() ? ficha.data() : null));
        setCargando(false);
      },
      (fallo) => {
        // Sin permiso o sin señal: se asume el nivel más restringido.
        // Nunca se conceden permisos por culpa de un error de lectura.
        console.error('No se pudo leer el rol', fallo);
        setRol(rolDe(correo, null));
        setCargando(false);
      }
    );
    return parar;
  }, [usuario?.email]);

  return { rol, cargando };
}
