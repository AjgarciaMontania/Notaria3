// Tabla mensual de tasas de usura guardada en Firestore (config/tasasHistoricas).
//
// Antes esta tabla vivía dentro del código y cada mes nuevo obligaba a editar
// un archivo y volver a desplegar. Ahora se administra desde el panel de la
// propia página. La tabla del código sigue existiendo como respaldo, así que
// si Firestore no responde el cálculo no se queda sin tasas.
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

export function useTasasHistoricas() {
  // Mapa "YYYY-MM" → tasa anual en decimal (0.2966 = 29.66%)
  const [tasas, setTasas] = useState({});
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const referencia = doc(db, "config", "tasasHistoricas");
    const dejarDeEscuchar = onSnapshot(
      referencia,
      (documento) => {
        const datos = documento.exists() ? documento.data() : null;
        setTasas(datos?.meses ?? {});
        setCargando(false);
      },
      (fallo) => {
        // La calculadora es pública: si algo falla se sigue con la tabla del
        // código en vez de dejar la página rota.
        console.error("No se pudieron leer las tasas históricas", fallo);
        setTasas({});
        setCargando(false);
      }
    );
    return dejarDeEscuchar;
  }, []);

  return { tasas, cargando };
}
