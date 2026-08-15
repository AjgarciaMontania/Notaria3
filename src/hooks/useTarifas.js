// Tarifas administradas desde el panel de la página, guardadas en Firestore
// (config/tarifas). Lo que no esté guardado conserva el valor del código.
import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { combinarTarifas } from "../utils/tarifasConfig.js";

export function useTarifas() {
  const [guardadas, setGuardadas] = useState(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const parar = onSnapshot(
      doc(db, "config", "tarifas"),
      (d) => {
        setGuardadas(d.exists() ? d.data() : null);
        setCargando(false);
      },
      (fallo) => {
        // Sin conexión o sin permiso: se siguen usando las del código.
        console.error("No se pudieron leer las tarifas", fallo);
        setGuardadas(null);
        setCargando(false);
      }
    );
    return parar;
  }, []);

  return {
    guardadas,
    tarifas: combinarTarifas(guardadas),
    cargando,
    /** Guarda la tabla completa. */
    guardar: (nuevas, quien) =>
      setDoc(
        doc(db, "config", "tarifas"),
        { ...nuevas, actualizadoPor: quien || null, actualizadoEn: new Date().toISOString() },
        { merge: true }
      ),
    /**
     * Vuelve a los valores del código.
     *
     * Se reemplaza el documento por uno vacío (setDoc SIN merge): con merge los
     * campos viejos seguirían ahí y no se restauraría nada.
     */
    restaurar: () => setDoc(doc(db, "config", "tarifas"), {}),
  };
}
