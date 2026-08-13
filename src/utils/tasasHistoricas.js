/**
 * Tasas de Usura certificadas por la Superfinanciera de Colombia.
 * Fuente: historicousura.xls descargado de superfinanciera.gov.co
 * Formato: [año, mes (1-12), tasa_anual_decimal]
 *
 * La Gobernación del Caquetá aplica la tasa vigente en el mes en que
 * vence el plazo de los 2 meses de gracia (fechaEscritura + 2 meses).
 */
const TASAS = [
  // 2024
  [2024,  1, 0.3498], [2024,  2, 0.3497], [2024,  3, 0.3330],
  [2024,  4, 0.3309], [2024,  5, 0.3153], [2024,  6, 0.3084],
  [2024,  7, 0.2949], [2024,  8, 0.2921], [2024,  9, 0.2885],
  [2024, 10, 0.2817], [2024, 11, 0.2790], [2024, 12, 0.2639],
  // 2025
  [2025,  1, 0.2489], [2025,  2, 0.2630], [2025,  3, 0.2492],
  [2025,  4, 0.2562], [2025,  5, 0.2597], [2025,  6, 0.2555],
  [2025,  7, 0.2478], [2025,  8, 0.2517], [2025,  9, 0.2501],
  [2025, 10, 0.2436], [2025, 11, 0.2499], [2025, 12, 0.2502],
  // 2026
  [2026,  1, 0.2436], [2026,  2, 0.2523], [2026,  3, 0.2552],
  [2026,  4, 0.2676], [2026,  5, 0.2817], [2026,  6, 0.2879],
  [2026,  7, 0.2879], [2026,  8, 0.2966],
];

/** Clave con la que se identifica cada mes: "2026-08". */
export function claveMes(anio, mes) {
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

/**
 * Tabla base incluida en el código, como mapa "YYYY-MM" → tasa decimal.
 * Sirve de respaldo: si Firestore no responde o no tiene un mes, se usa esta.
 */
export const TASAS_BASE = TASAS.reduce((acumulado, [anio, mes, tasa]) => {
  acumulado[claveMes(anio, mes)] = tasa;
  return acumulado;
}, {});

/**
 * Devuelve la tasa de mora que aplica la Gobernación del Caquetá.
 *
 * Regla confirmada con 3 recibos reales (jun-2026):
 *   - Si el pago es en un año POSTERIOR al vencimiento → tasa de enero del año de pago
 *     (la Gobernación fija la tasa al inicio del año fiscal; ej: 2026 → 24.36%)
 *   - Si el pago es en el mismo año del vencimiento → tasa del mes de vencimiento
 *   - Si la fecha no está en la tabla → null (usar tasa de Firestore)
 *
 * @param {string} fechaVencimiento - "YYYY-MM-DD" (escritura + 2 meses)
 * @param {string} fechaPago        - "YYYY-MM-DD"
 * @param {Object} tasasGuardadas   - mapa "YYYY-MM" → tasa decimal, traído de
 *                                    Firestore. Tiene prioridad sobre la tabla
 *                                    del código, así se pueden agregar meses
 *                                    nuevos (o corregir uno) desde el panel de
 *                                    administrador sin volver a desplegar.
 */
export function getTasaHistorica(fechaVencimiento, fechaPago, tasasGuardadas = {}) {
  if (!fechaVencimiento) return null;

  const buscar = (anio, mes) => {
    const clave = claveMes(anio, mes);
    const guardada = tasasGuardadas[clave];
    if (typeof guardada === "number" && guardada > 0) return guardada;
    const base = TASAS_BASE[clave];
    return typeof base === "number" ? base : null;
  };

  const venc = new Date(fechaVencimiento + "T12:00:00");
  const vYear = venc.getFullYear();
  const vMonth = venc.getMonth() + 1;

  if (fechaPago) {
    const pYear = new Date(fechaPago + "T12:00:00").getFullYear();
    if (pYear > vYear) {
      // Pago en año posterior al vencimiento → usar enero del año de pago
      const enero = buscar(pYear, 1);
      if (enero !== null) return enero;
    }
  }

  // Mismo año o fecha de pago no disponible → usar mes de vencimiento
  return buscar(vYear, vMonth);
}
