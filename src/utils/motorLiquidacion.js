// ─────────────────────────────────────────────────────────────────────────────
// MOTOR DE LIQUIDACIÓN NOTARIAL — única fuente de verdad
//
// Aquí vive TODA la matemática de tarifas. Lo usan las dos aplicaciones:
//   · la página web  (src/components/ResultTable.jsx)
//   · la APK Android (app-evidencias, mediante un alias de Vite)
//
// Está escrito sin React ni Firebase a propósito: es código puro, así que se
// puede importar desde cualquier parte y probarse de forma aislada.
//
// Si cambian las tarifas, se cambian AQUÍ y las dos aplicaciones quedan al día.
// ─────────────────────────────────────────────────────────────────────────────
import { ACTOS_CONFIG } from "./actosConfig.js";
import { getUsuraDelMes, claveMes } from "./tasasHistoricas.js";
import { TARIFAS_BASE, combinarTarifas } from "./tarifasConfig.js";

// ── Tarifas ──────────────────────────────────────────────────────────────────
// Los importes ya no se escriben aquí: viven en tarifasConfig.js y se
// administran desde el panel "Tarifas" de la página web, igual que las tasas
// de mora. Estas constantes se conservan porque son el respaldo del código y
// las usan algunas pantallas, pero SIEMPRE salen de la misma tabla.
export const SIN_CUANTIA_BASE = TARIFAS_BASE.sinCuantiaBase;
export const FOLIO_ADICIONAL = TARIFAS_BASE.folioAdicional;

export const HONORARIOS_RATES = {
  FIRST: TARIFAS_BASE.honorarios.primero,
  SECOND_TO_THIRD: TARIFAS_BASE.honorarios.segundoTercero,
  REMAINING: TARIFAS_BASE.honorarios.resto,
};

// ── Mora por extemporaneidad ────────────────────────────────────────────────
//
// Confirmado contra 8 recibos reales de la Gobernación del Caquetá
// (jul–ago 2026), los ocho reproducidos al peso:
//
//   1. La tasa NO es la usura: es la usura MENOS 2 puntos porcentuales
//      (Estatuto Tributario, art. 635).
//   2. Los intereses se acumulan DÍA POR DÍA, y cada día lleva la tasa del
//      mes al que pertenece. No existe una sola tasa para todo el periodo.
//   3. En años bisiestos el año se divide entre 366.
//   4. El resultado se redondea al millar más cercano.
//
// Antes se aplicaba una única tasa a todo el periodo, con una regla de "enero
// del año de pago" deducida de tres recibos. Era una coincidencia: fallaba
// tanto por exceso como por defecto según el caso.

/** Puntos que se restan a la usura para obtener la mora (art. 635 E.T.). */
export const DESCUENTO_MORA = TARIFAS_BASE.descuentoMora;

/** Tasa de respaldo, solo si no hay ninguna tabla disponible. */
export const MORA_ANNUAL_RATE = 0.2479;

/** Días calendario entre dos fechas "YYYY-MM-DD" (usa mediodía para evitar DST). */
export function diasEntre(desde, hasta) {
  if (!desde || !hasta) return 0;
  const d1 = new Date(desde + "T12:00:00");
  const d2 = new Date(hasta + "T12:00:00");
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

/**
 * Vencimiento del plazo legal: 2 meses calendario después del otorgamiento
 * (Art. 8 Ley 1579/2012).
 *
 * OJO CON EL ÚLTIMO DÍA DEL MES. JavaScript, si le pide "31 de febrero", se
 * pasa solo al 3 de marzo. Eso daba vencimientos posteriores a los reales y
 * cobraba menos mora de la debida en toda escritura otorgada un 29, 30 o 31.
 *
 * El Código Civil colombiano (art. 67) resuelve el caso expresamente: si el mes
 * en que termina el plazo tiene menos días que aquel en que empezó, el plazo
 * vence el ÚLTIMO DÍA de ese mes. Una escritura del 31 de diciembre vence el
 * 28 de febrero, no el 3 de marzo.
 */
export function fechaVencimiento(fechaEscritura) {
  const d = new Date(fechaEscritura + "T12:00:00");
  const diaOriginal = d.getDate();

  // Se avanza desde el día 1 para que el mes no se desborde…
  d.setDate(1);
  d.setMonth(d.getMonth() + 2);

  // …y luego se recorta al último día si el mes destino es más corto.
  const ultimoDelMes = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(diaOriginal, ultimoDelMes));

  return d.toISOString().split("T")[0];
}

function esBisiesto(anio) {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

/**
 * Intereses de mora de un documento, sumando día por día.
 *
 * @param {string} fechaEscritura
 * @param {number} tributaria      base sobre la que corre la mora
 * @param {string} fechaPago
 * @param {Object} opciones
 *   @param {Object} opciones.tasasHistoricas  mapa "YYYY-MM" → usura decimal
 *   @param {number} [opciones.tasaFija]       si se indica, se usa esa tasa de
 *                                             MORA plana para todo el periodo
 *                                             (escape manual desde la tabla)
 *   @param {number} [opciones.tasaRespaldo]   usura a usar si falta un mes
 *
 * @returns {{ diasVencidos, mora, moraExacta, desglose, mesesSinTasa }}
 */
export function calcularMoraEscritura(fechaEscritura, tributaria, fechaPago, opciones = {}) {
  const { tasasHistoricas = {}, tasaFija = null, tasaRespaldo = null, tarifas = null } = opciones;
  const T = tarifas || TARIFAS_BASE;
  const descuento = T.descuentoMora;

  const vacio = { diasVencidos: 0, mora: 0, moraExacta: 0, desglose: [], mesesSinTasa: [] };
  if (!fechaEscritura || !fechaPago || !tributaria || tributaria <= 0) return vacio;

  const venc = fechaVencimiento(fechaEscritura);
  const diasVencidos = Math.max(0, diasEntre(venc, fechaPago));
  if (diasVencidos === 0) return vacio;

  const inicio = new Date(venc + "T12:00:00");
  const fin = new Date(fechaPago + "T12:00:00");

  let acumulado = 0;
  const porMes = new Map();
  const mesesSinTasa = new Set();

  for (const d = new Date(inicio); d < fin; d.setDate(d.getDate() + 1)) {
    const anio = d.getFullYear();
    const clave = claveMes(anio, d.getMonth() + 1);

    let tasaDia;
    if (tasaFija != null) {
      tasaDia = tasaFija;
    } else {
      const usura = getUsuraDelMes(clave, tasasHistoricas);
      if (usura == null) {
        mesesSinTasa.add(clave);
        if (tasaRespaldo == null) continue; // sin tasa: ese día no suma, y se avisa
        tasaDia = tasaRespaldo - descuento;
      } else {
        tasaDia = usura - descuento;
      }
    }

    const delDia = tributaria * (tasaDia / (esBisiesto(anio) ? 366 : 365));
    acumulado += delDia;

    const fila = porMes.get(clave) || { mes: clave, dias: 0, tasa: tasaDia, valor: 0 };
    fila.dias += 1;
    fila.valor += delDia;
    porMes.set(clave, fila);
  }

  return {
    diasVencidos,
    mora: Math.round(acumulado / 1000) * 1000,
    moraExacta: acumulado,
    desglose: [...porMes.values()],
    mesesSinTasa: [...mesesSinTasa],
  };
}

/**
 * Derecho base de ORIP, sin el 2% de conservación documental.
 * @param {number} valor
 * @param {Object} [tarifas] tabla activa; si no se pasa, la del código
 */
export function calcOripBase(valor, tarifas) {
  if (valor <= 0) return 0;
  const T = tarifas || TARIFAS_BASE;
  const tramo = T.tramos.find((t) => t.limite === null || valor <= t.limite);
  if (!tramo) return T.derechoMinimo;
  return tramo.tasa ? valor * tramo.tasa : T.derechoMinimo;
}

/** Convierte "1.234.567" en 1234567. */
export function aNumero(texto) {
  if (typeof texto === "number") return texto;
  const limpio = String(texto ?? "").replace(/\./g, "").replace(/[^\d-]/g, "");
  return parseInt(limpio, 10) || 0;
}

/**
 * Liquida un conjunto de actos.
 *
 * Los actos que comparten número de escritura y fecha forman UN DOCUMENTO: así
 * los liquida la Gobernación, que cobra una sola línea de "intereses de mora"
 * sobre la tributaria combinada del documento. Por eso el resultado trae, además
 * de los actos, un arreglo `documentos` con la mora de cada escritura sin
 * repartir entre sus actos.
 *
 * @param {Array} actos  cada uno: { acto, numeroEscritura, fechaEscritura,
 *                       foliosAdicionales, valorActo, numActos, tasaAnual?,
 *                       tributariaManual? }
 * @param {Object} opciones
 *   @param {string} opciones.fechaPago        "YYYY-MM-DD"
 *   @param {number} opciones.tasaMoraDefault  usura de respaldo si falta un mes
 *   @param {Object} opciones.tasasHistoricas  mapa "YYYY-MM" → usura decimal
 *   @param {number|string} opciones.dineroEnviado
 *
 * @returns {{ actos, documentos, totales, mesesSinTasa }}
 */
export function liquidar(actos, opciones = {}) {
  const {
    fechaPago = "",
    tasaMoraDefault = MORA_ANNUAL_RATE,
    tasasHistoricas = {},
    dineroEnviado = 0,
    tarifas = null,
  } = opciones;

  const USURA_RESPALDO = tasaMoraDefault ?? MORA_ANNUAL_RATE;
  // Tarifas activas: lo guardado en Firestore sobre los valores del código.
  const T = combinarTarifas(tarifas);

  let tributariaTotal = 0;
  let oripTotal = 0;
  let igacTotal = 0;
  let saberTotal = 0;
  let honorarios = 0;
  let contHonorarios = 0;
  let moraTotal = 0;

  // ── PASO 1: tributaria y ORIP de cada acto ────────────────────────────────
  const calculados = actos.map((fila) => {
    const config = ACTOS_CONFIG[fila.acto] || { oripTipo: "none", honorarioContable: false };
    const valor = aNumero(fila.valorActo);
    const foliosAdic = fila.foliosAdicionales || 0;

    const esSaber = fila.acto.includes("SABER") || fila.acto.includes("ESCRITURA PARA SABER");
    const cuentaHonorario = config.honorarioContable || esSaber;

    if (cuentaHonorario) {
      contHonorarios++;
      honorarios +=
        contHonorarios === 1
          ? T.honorarios.primero
          : contHonorarios <= 3
            ? T.honorarios.segundoTercero
            : T.honorarios.resto;
    }

    // Actos que no pasan por ORIP ni pagan tributaria
    if (config.oripTipo === "none") {
      if (fila.acto.includes("IGAC")) igacTotal += valor;
      if (esSaber) saberTotal += valor;
      return { ...fila, tributaria: null, orip: null, mora: 0, diasVencidos: 0, total: valor };
    }

    let tributaria = 0;
    if (config.tributariaManual) {
      tributaria = aNumero(fila.tributariaManual);
    } else if (config.tributariaRate !== undefined) {
      tributaria = Math.round(valor * config.tributariaRate);
    } else if (config.tributariaMinima) {
      tributaria = T.tarifaMinimaSinCuantia;
    } else if (config.tributaria !== undefined) {
      tributaria = config.tributaria;
    }

    // El 2% de sistematización y conservación documental (Art. 25) se aplica
    // sobre el derecho de registro, y luego se redondea a la centena.
    //
    // `oripFueraDel2` queda por fuera de ese 2%: es el caso del certificado de
    // tradición de la hipoteca, que la ORIP cobra como un trámite aparte. El
    // recibo de la escritura 089 lo confirma: registro $172.200 + 2% = $175.600,
    // y el certificado $24.300 se suma después, sin recargo.
    let orip = 0;
    const conElDosPorCiento = 1 + T.conservacion;
    // Extras propios de la hipoteca, tomados de la tabla de tarifas
    const extraDentro = config.extrasHipoteca ? T.hipotecaConstancia : (config.oripExtras || 0);
    const extraFuera = config.extrasHipoteca ? T.hipotecaCertificado : (config.oripFueraDel2 || 0);

    if (config.oripTipo === "cuantia") {
      const base = calcOripBase(valor, T) + extraDentro;
      const subtotal = base + T.folioAdicional * foliosAdic;
      orip = Math.round((subtotal * conElDosPorCiento) / 100) * 100 + extraFuera;
    } else if (config.oripTipo === "sin_cuantia") {
      const numActos = fila.numActos || 1;
      const subtotal = T.sinCuantiaBase * numActos + T.folioAdicional * foliosAdic;
      orip = Math.round((subtotal * conElDosPorCiento) / 100) * 100 + extraFuera;
    }

    tributariaTotal += tributaria;
    oripTotal += orip;

    return { ...fila, tributaria, orip, mora: 0, diasVencidos: 0, total: tributaria + orip };
  });

  // ── PASO 2: agrupar los actos por documento ───────────────────────────────
  // Mismo número de escritura + misma fecha = un solo documento.
  const grupos = new Map();
  calculados.forEach((fila, idx) => {
    if (fila.tributaria === null) return;
    const numEsc = String(fila.numeroEscritura ?? "").trim();
    const clave = numEsc ? `${numEsc}||${fila.fechaEscritura}` : `__suelto__${idx}`;
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        clave,
        numeroEscritura: numEsc,
        fechaEscritura: fila.fechaEscritura,
        indices: [],
        tributaria: 0,
        orip: 0,
        tasaManual: null,
      });
    }
    const g = grupos.get(clave);
    g.indices.push(idx);
    g.tributaria += fila.tributaria;
    g.orip += fila.orip || 0;
    // La primera tasa editada a mano dentro del grupo manda sobre la tabla
    if (fila.tasaAnual != null && g.tasaManual == null) g.tasaManual = fila.tasaAnual;
  });

  // ── PASO 3: mora de cada documento, día por día ───────────────────────────
  const mesesSinTasa = new Set();
  const documentos = [];

  grupos.forEach((g) => {
    const r = calcularMoraEscritura(g.fechaEscritura, g.tributaria, fechaPago, {
      tasasHistoricas,
      tasaFija: g.tasaManual,
      tasaRespaldo: USURA_RESPALDO,
      tarifas: T,
    });
    r.mesesSinTasa.forEach((m) => mesesSinTasa.add(m));
    moraTotal += r.mora;

    // Los días quedan también en cada acto, para poder mostrarlos en la fila
    g.indices.forEach((idx) => {
      calculados[idx].diasVencidos = r.diasVencidos;
    });

    documentos.push({
      clave: g.clave,
      numeroEscritura: g.numeroEscritura,
      fechaEscritura: g.fechaEscritura,
      indices: g.indices,
      vence: g.fechaEscritura ? fechaVencimiento(g.fechaEscritura) : "",
      tributaria: g.tributaria,
      orip: g.orip,
      diasVencidos: r.diasVencidos,
      mora: r.mora,
      moraExacta: r.moraExacta,
      desglose: r.desglose,
      tasaManual: g.tasaManual,
      total: g.tributaria + g.orip + r.mora,
    });
  });

  // ── PASO 4: totales ───────────────────────────────────────────────────────
  const subtotal = tributariaTotal + oripTotal + igacTotal + saberTotal + moraTotal;
  // Un retiro por cada tramo a consignar, redondeando hacia arriba
  const retiros = Math.round(Math.ceil((subtotal + honorarios) / T.retiroPorCada) * T.retiroValor);
  const totalConsignar = subtotal + honorarios + retiros;
  const enviado = aNumero(dineroEnviado);

  return {
    actos: calculados,
    documentos,
    mesesSinTasa: [...mesesSinTasa].sort(),
    tarifasUsadas: T,
    totales: {
      tributariaTotal,
      oripTotal,
      moraTotal,
      igacTotal,
      saberTotal,
      subtotal,
      honorarios,
      retiros,
      totalConsignar,
      dineroEnviado: enviado,
      sobrante: enviado - totalConsignar,
      hayMora: moraTotal > 0,
    },
  };
}
