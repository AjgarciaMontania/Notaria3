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
];

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
 */
export function getTasaHistorica(fechaVencimiento, fechaPago) {
  if (!fechaVencimiento) return null;

  const venc  = new Date(fechaVencimiento + "T12:00:00");
  const vYear = venc.getFullYear();
  const vMonth = venc.getMonth() + 1;

  if (fechaPago) {
    const pYear = new Date(fechaPago + "T12:00:00").getFullYear();
    if (pYear > vYear) {
      // Pago en año posterior al vencimiento → usar enero del año de pago
      const janEntry = TASAS.find(([y, m]) => y === pYear && m === 1);
      if (janEntry) return janEntry[2];
    }
  }

  // Mismo año o fecha de pago no disponible → usar mes de vencimiento
  const entry = TASAS.find(([y, m]) => y === vYear && m === vMonth);
  return entry ? entry[2] : null;
}
