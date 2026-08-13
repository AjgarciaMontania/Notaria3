import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

const TASA_FALLBACK = 0.2479; // 24.79% - usado si Firestore no tiene dato aún

export function useTasaMora() {
  const [tasaAnual, setTasaAnual]   = useState(TASA_FALLBACK);
  const [meta, setMeta]             = useState(null); // { fechaActualizacion, fuente, porcentaje }
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    const ref = doc(db, "config", "tasaMora");
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setTasaAnual(data.tasaAnual ?? TASA_FALLBACK);
        setMeta({
          porcentaje:          (data.tasaAnual * 100).toFixed(2),
          fechaActualizacion:  data.fechaActualizacion ?? "",
          fuente:              data.fuente ?? "",
        });
      } else {
        setTasaAnual(TASA_FALLBACK);
        setMeta(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  return { tasaAnual, meta, loading };
}
