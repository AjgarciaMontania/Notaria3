// Tasas que la notaría administra desde el panel de la página web.
// La APK solo las lee: quien las edita es el computador.
import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export function useTarifas() {
  const [tasaAnual, setTasaAnual] = useState(null);   // respaldo general
  const [tasasHistoricas, setTasasHistoricas] = useState({}); // "YYYY-MM" → decimal
  const [tarifas, setTarifas] = useState(null);       // config/tarifas

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
    // Tarifas en pesos (derechos ORIP, honorarios, retiros…). Se administran
    // desde el panel de la página web y llegan aquí al instante, sin reinstalar.
    const pararTarifas = onSnapshot(
      doc(db, 'config', 'tarifas'),
      (d) => setTarifas(d.exists() ? d.data() : null),
      (e) => console.error('No se pudieron leer las tarifas', e)
    );
    return () => {
      pararTasa();
      pararHist();
      pararTarifas();
    };
  }, []);

  return { tasaAnual, tasasHistoricas, tarifas };
}
