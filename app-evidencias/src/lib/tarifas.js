// Tasas que la notaría administra desde el panel de la página web.
// La APK solo las lee: quien las edita es el computador.
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export function useTarifas() {
  const [tasaAnual, setTasaAnual] = useState(null);   // respaldo general
  const [tasasHistoricas, setTasasHistoricas] = useState({}); // "YYYY-MM" → decimal

  useEffect(() => {
    const pararTasa = onSnapshot(
      doc(db, 'config', 'tasaMora'),
      (d) => setTasaAnual(d.exists() ? (d.data().tasaAnual ?? null) : null),
      (e) => console.error('No se pudo leer la tasa de mora', e)
    );
    const pararHist = onSnapshot(
      doc(db, 'config', 'tasasHistoricas'),
      (d) => setTasasHistoricas(d.exists() ? (d.data().meses ?? {}) : {}),
      (e) => console.error('No se pudieron leer las tasas históricas', e)
    );
    return () => {
      pararTasa();
      pararHist();
    };
  }, []);

  return { tasaAnual, tasasHistoricas };
}
