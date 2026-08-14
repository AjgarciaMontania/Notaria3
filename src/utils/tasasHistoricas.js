/**
 * Tasas de USURA certificadas por la Superintendencia Financiera de Colombia.
 *
 * FUENTE OFICIAL: archivo "historicousura.xls" descargado de
 * superfinanciera.gov.co (última actualización del archivo: 29/07/2026).
 * Cargada desde enero de 2008 hasta agosto de 2026, sin huecos.
 *
 * Los periodos anteriores a 2008 quedaron fuera a propósito: en esos años la
 * certificación no siempre era mensual (había trimestres e incluso tramos de
 * medio mes), y una tabla por meses no los representa bien. Si algún día hace
 * falta liquidar una escritura tan antigua, el sistema avisará que le faltan
 * las tasas en vez de calcular un valor incorrecto en silencio.
 *
 * Formato: [año, mes (1-12), usura anual en decimal]
 *
 * ⚠️ AQUÍ SE GUARDA LA USURA, NO LA TASA DE MORA.
 * La mora que cobra la Gobernación es esta tasa MENOS 2 puntos porcentuales
 * (Estatuto Tributario, art. 635), y se acumula día por día: cada día lleva
 * la tasa del mes al que pertenece. Esa resta y esa suma las hace
 * motorLiquidacion.js; este archivo solo guarda la usura tal como la publica
 * la Superfinanciera, que es lo que se consulta y lo que se digita en el
 * panel de administración.
 */
const TASAS = [
  // 2008
  [2008,  1, 0.3275], [2008,  2, 0.3275], [2008,  3, 0.3275],
  [2008,  4, 0.3288], [2008,  5, 0.3288], [2008,  6, 0.3288],
  [2008,  7, 0.3226], [2008,  8, 0.3226], [2008,  9, 0.3226],
  [2008, 10, 0.3153], [2008, 11, 0.3153], [2008, 12, 0.3153],
  // 2009
  [2009,  1, 0.3070], [2009,  2, 0.3070], [2009,  3, 0.3070],
  [2009,  4, 0.3042], [2009,  5, 0.3042], [2009,  6, 0.3042],
  [2009,  7, 0.2797], [2009,  8, 0.2797], [2009,  9, 0.2797],
  [2009, 10, 0.2592], [2009, 11, 0.2592], [2009, 12, 0.2592],
  // 2010
  [2010,  1, 0.2421], [2010,  2, 0.2421], [2010,  3, 0.2421],
  [2010,  4, 0.2297], [2010,  5, 0.2297], [2010,  6, 0.2297],
  [2010,  7, 0.2241], [2010,  8, 0.2241], [2010,  9, 0.2241],
  [2010, 10, 0.2132], [2010, 11, 0.2132], [2010, 12, 0.2132],
  // 2011
  [2011,  1, 0.2341], [2011,  2, 0.2341], [2011,  3, 0.2341],
  [2011,  4, 0.2653], [2011,  5, 0.2653], [2011,  6, 0.2653],
  [2011,  7, 0.2794], [2011,  8, 0.2794], [2011,  9, 0.2794],
  [2011, 10, 0.2908], [2011, 11, 0.2908], [2011, 12, 0.2908],
  // 2012
  [2012,  1, 0.2988], [2012,  2, 0.2988], [2012,  3, 0.2988],
  [2012,  4, 0.3078], [2012,  5, 0.3078], [2012,  6, 0.3078],
  [2012,  7, 0.3129], [2012,  8, 0.3129], [2012,  9, 0.3129],
  [2012, 10, 0.3134], [2012, 11, 0.3134], [2012, 12, 0.3134],
  // 2013
  [2013,  1, 0.3112], [2013,  2, 0.3112], [2013,  3, 0.3112],
  [2013,  4, 0.3125], [2013,  5, 0.3125], [2013,  6, 0.3125],
  [2013,  7, 0.3051], [2013,  8, 0.3051], [2013,  9, 0.3051],
  [2013, 10, 0.2978], [2013, 11, 0.2978], [2013, 12, 0.2978],
  // 2014
  [2014,  1, 0.2948], [2014,  2, 0.2948], [2014,  3, 0.2948],
  [2014,  4, 0.2944], [2014,  5, 0.2944], [2014,  6, 0.2944],
  [2014,  7, 0.2899], [2014,  8, 0.2899], [2014,  9, 0.2899],
  [2014, 10, 0.2876], [2014, 11, 0.2876], [2014, 12, 0.2876],
  // 2015
  [2015,  1, 0.2882], [2015,  2, 0.2882], [2015,  3, 0.2882],
  [2015,  4, 0.2906], [2015,  5, 0.2906], [2015,  6, 0.2906],
  [2015,  7, 0.2889], [2015,  8, 0.2889], [2015,  9, 0.2889],
  [2015, 10, 0.2899], [2015, 11, 0.2899], [2015, 12, 0.2899],
  // 2016
  [2016,  1, 0.2952], [2016,  2, 0.2952], [2016,  3, 0.2952],
  [2016,  4, 0.3081], [2016,  5, 0.3081], [2016,  6, 0.3081],
  [2016,  7, 0.3201], [2016,  8, 0.3201], [2016,  9, 0.3201],
  [2016, 10, 0.3299], [2016, 11, 0.3299], [2016, 12, 0.3299],
  // 2017
  [2017,  1, 0.3351], [2017,  2, 0.3351], [2017,  3, 0.3351],
  [2017,  4, 0.3349], [2017,  5, 0.3349], [2017,  6, 0.3349],
  [2017,  7, 0.3297], [2017,  8, 0.3297], [2017,  9, 0.3222],
  [2017, 10, 0.3172], [2017, 11, 0.3144], [2017, 12, 0.3115],
  // 2018
  [2018,  1, 0.3104], [2018,  2, 0.3152], [2018,  3, 0.3102],
  [2018,  4, 0.3072], [2018,  5, 0.3066], [2018,  6, 0.3042],
  [2018,  7, 0.3004], [2018,  8, 0.2991], [2018,  9, 0.2972],
  [2018, 10, 0.2945], [2018, 11, 0.2924], [2018, 12, 0.2910],
  // 2019
  [2019,  1, 0.2874], [2019,  2, 0.2955], [2019,  3, 0.2906],
  [2019,  4, 0.2898], [2019,  5, 0.2901], [2019,  6, 0.2895],
  [2019,  7, 0.2892], [2019,  8, 0.2898], [2019,  9, 0.2898],
  [2019, 10, 0.2865], [2019, 11, 0.2855], [2019, 12, 0.2837],
  // 2020
  [2020,  1, 0.2816], [2020,  2, 0.2859], [2020,  3, 0.2843],
  [2020,  4, 0.2804], [2020,  5, 0.2729], [2020,  6, 0.2718],
  [2020,  7, 0.2718], [2020,  8, 0.2744], [2020,  9, 0.2753],
  [2020, 10, 0.2714], [2020, 11, 0.2676], [2020, 12, 0.2619],
  // 2021
  [2021,  1, 0.2598], [2021,  2, 0.2631], [2021,  3, 0.2611],
  [2021,  4, 0.2596], [2021,  5, 0.2583], [2021,  6, 0.2581],
  [2021,  7, 0.2577], [2021,  8, 0.2586], [2021,  9, 0.2579],
  [2021, 10, 0.2562], [2021, 11, 0.2591], [2021, 12, 0.2619],
  // 2022
  [2022,  1, 0.2649], [2022,  2, 0.2745], [2022,  3, 0.2771],
  [2022,  4, 0.2858], [2022,  5, 0.2956], [2022,  6, 0.3060],
  [2022,  7, 0.3192], [2022,  8, 0.3332], [2022,  9, 0.3525],
  [2022, 10, 0.3692], [2022, 11, 0.3867], [2022, 12, 0.4146],
  // 2023
  [2023,  1, 0.4326], [2023,  2, 0.4527], [2023,  3, 0.4626],
  [2023,  4, 0.4708], [2023,  5, 0.4541], [2023,  6, 0.4464],
  [2023,  7, 0.4404], [2023,  8, 0.4312], [2023,  9, 0.4204],
  [2023, 10, 0.3979], [2023, 11, 0.3828], [2023, 12, 0.3756],
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
 * Usura de un mes concreto.
 *
 * Lo guardado en Firestore manda sobre la tabla del código, así se pueden
 * agregar meses nuevos (o corregir uno) desde el panel de administración sin
 * volver a desplegar.
 *
 * @param {string} clave          "YYYY-MM"
 * @param {Object} tasasGuardadas mapa "YYYY-MM" → decimal, traído de Firestore
 * @returns {number|null} la usura, o null si ese mes no está en ninguna tabla
 */
export function getUsuraDelMes(clave, tasasGuardadas = {}) {
  const guardada = tasasGuardadas?.[clave];
  if (typeof guardada === "number" && guardada > 0) return guardada;
  const base = TASAS_BASE[clave];
  return typeof base === "number" ? base : null;
}

/**
 * ⚠️ OBSOLETA — se conserva solo para no romper código antiguo.
 *
 * Elegía UNA sola tasa para todo el periodo de mora. Los recibos de agosto de
 * 2026 demostraron que eso es incorrecto: la Gobernación acumula día por día
 * con la tasa de cada mes. La regla de "enero del año de pago" que había aquí
 * era una coincidencia deducida de tres recibos, no una regla real.
 *
 * No la uses para calcular: usa liquidar() de motorLiquidacion.js.
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
