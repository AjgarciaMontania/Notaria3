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
import { getTasaHistorica } from "./tasasHistoricas.js";

// ── Tarifas ORIP 2026 (RES-2026-001726-6) ──────────────────────────────────
export const SIN_CUANTIA_BASE = 29500;
export const FOLIO_ADICIONAL = 15300;

export const FEE_CONSTANTS = {
  BASE_FEE: 53100,
  TIERS: [
    { limit: 12852101, rate: null },
    { limit: 192778606, rate: 0.00911 },
    { limit: 334149656, rate: 0.01131 },
    { limit: 494798857, rate: 0.01260 },
    { limit: Infinity, rate: 0.01333 },
  ],
  // 2% de sistematización y conservación documental (Parágrafo 8)
  ADDITIONAL_RATE: 1.02,
};

export const HONORARIOS_RATES = {
  FIRST: 35000,
  SECOND_TO_THIRD: 25000,
  REMAINING: 20000,
};

// ── Mora por extemporaneidad ────────────────────────────────────────────────
// Tasa de respaldo, derivada de recibos reales de la Gobernación del Caquetá:
// $18.000 de mora / ($250.000 base × 106 días) × 365 = 24,79% anual.
// Solo se usa cuando el mes no está en la tabla histórica.
export const MORA_ANNUAL_RATE = 0.2479;

/** Días calendario entre dos fechas "YYYY-MM-DD" (usa mediodía para evitar DST). */
export function diasEntre(desde, hasta) {
  if (!desde || !hasta) return 0;
  const d1 = new Date(desde + "T12:00:00");
  const d2 = new Date(hasta + "T12:00:00");
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

/**
 * Vencimiento del plazo legal: exactamente 2 meses calendario después del
 * otorgamiento (Art. 8 Ley 1579/2012).
 */
export function fechaVencimiento(fechaEscritura) {
  const d = new Date(fechaEscritura + "T12:00:00");
  d.setMonth(d.getMonth() + 2);
  return d.toISOString().split("T")[0];
}

/**
 * Días vencidos e intereses de mora de una escritura.
 * La Gobernación redondea la mora al millar más cercano (confirmado en todos
 * los recibos: $31.000, $28.000, $37.000, $3.000…).
 */
export function calcularMoraEscritura(fechaEscritura, tributaria, fechaPago, tasaAnual = MORA_ANNUAL_RATE) {
  if (!fechaEscritura || !tributaria || tributaria <= 0) {
    return { diasVencidos: 0, mora: 0 };
  }
  const venc = fechaVencimiento(fechaEscritura);
  const diasVencidos = Math.max(0, diasEntre(venc, fechaPago));
  if (diasVencidos === 0) return { diasVencidos: 0, mora: 0 };

  const rateDiaria = tasaAnual / 365;
  const mora = Math.round((tributaria * rateDiaria * diasVencidos) / 1000) * 1000;
  return { diasVencidos, mora };
}

/** Derecho base de ORIP, sin el 2% de conservación documental. */
export function calcOripBase(valor) {
  if (valor <= 0) return 0;
  const tier = FEE_CONSTANTS.TIERS.find((t) => valor <= t.limit);
  return tier.rate ? valor * tier.rate : FEE_CONSTANTS.BASE_FEE;
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
 * @param {Array} actos  cada uno: { acto, numeroEscritura, fechaEscritura,
 *                       foliosAdicionales, valorActo, numActos, tasaAnual?,
 *                       tributariaManual? }
 * @param {Object} opciones
 *   @param {string} opciones.fechaPago        "YYYY-MM-DD"
 *   @param {number} opciones.tasaMoraDefault  respaldo si el mes no está en la tabla
 *   @param {Object} opciones.tasasHistoricas  mapa "YYYY-MM" → tasa decimal
 *   @param {number|string} opciones.dineroEnviado
 *
 * @returns {{ actos: Array, totales: Object }}
 */
export function liquidar(actos, opciones = {}) {
  const {
    fechaPago = "",
    tasaMoraDefault = MORA_ANNUAL_RATE,
    tasasHistoricas = {},
    dineroEnviado = 0,
  } = opciones;

  const TASA_EFECTIVA = tasaMoraDefault ?? MORA_ANNUAL_RATE;

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
          ? HONORARIOS_RATES.FIRST
          : contHonorarios <= 3
            ? HONORARIOS_RATES.SECOND_TO_THIRD
            : HONORARIOS_RATES.REMAINING;
    }

    // Actos que no pasan por ORIP ni pagan tributaria
    if (config.oripTipo === "none") {
      if (fila.acto.includes("IGAC")) igacTotal += valor;
      if (esSaber) saberTotal += valor;
      return { ...fila, tributaria: null, orip: null, total: valor };
    }

    let tributaria = 0;
    if (config.tributariaManual) {
      tributaria = aNumero(fila.tributariaManual);
    } else if (config.tributariaRate !== undefined) {
      tributaria = Math.round(valor * config.tributariaRate);
    } else if (config.tributaria !== undefined) {
      tributaria = config.tributaria;
    }

    // El 2% se aplica sobre el subtotal completo del acto y luego se redondea
    // a la centena más cercana (Art. 25).
    let orip = 0;
    if (config.oripTipo === "cuantia") {
      const base = calcOripBase(valor) + (config.oripExtras || 0);
      const subtotal = base + FOLIO_ADICIONAL * foliosAdic;
      orip = Math.round((subtotal * FEE_CONSTANTS.ADDITIONAL_RATE) / 100) * 100;
    } else if (config.oripTipo === "sin_cuantia") {
      const numActos = fila.numActos || 1;
      const subtotal = SIN_CUANTIA_BASE * numActos + FOLIO_ADICIONAL * foliosAdic;
      orip = Math.round((subtotal * FEE_CONSTANTS.ADDITIONAL_RATE) / 100) * 100;
    }

    tributariaTotal += tributaria;
    oripTotal += orip;

    return { ...fila, tributaria, orip, _base: tributaria + orip, mora: 0, diasVencidos: 0 };
  });

  // ── PASO 2: mora agrupada por escritura ───────────────────────────────────
  // Los actos con el mismo número + fecha comparten la base de mora, tal como
  // lo liquida la Gobernación: sobre la tributaria combinada del documento.
  const grupos = new Map();
  calculados.forEach((fila, idx) => {
    if (fila.tributaria === null || fila.tributaria <= 0 || !fila.fechaEscritura) return;
    const numEsc = fila.numeroEscritura?.trim();
    const clave = numEsc ? `${numEsc}||${fila.fechaEscritura}` : `__solo__${idx}`;
    if (!grupos.has(clave)) {
      grupos.set(clave, { fechaEscritura: fila.fechaEscritura, tasaAnual: null, indices: [], total: 0 });
    }
    const g = grupos.get(clave);
    g.indices.push(idx);
    g.total += fila.tributaria;
    // La primera tasa editada a mano dentro del grupo tiene prioridad
    if (fila.tasaAnual != null && g.tasaAnual == null) g.tasaAnual = fila.tasaAnual;
  });

  const moraIdx = new Array(calculados.length).fill(0);
  const diasIdx = new Array(calculados.length).fill(0);
  const tasaIdx = new Array(calculados.length).fill(TASA_EFECTIVA);

  grupos.forEach((g) => {
    if (!fechaPago || g.total <= 0) return;
    const venc = fechaVencimiento(g.fechaEscritura);
    const tasa = g.tasaAnual ?? getTasaHistorica(venc, fechaPago, tasasHistoricas) ?? TASA_EFECTIVA;
    const { diasVencidos, mora: moraGrupo } = calcularMoraEscritura(
      g.fechaEscritura, g.total, fechaPago, tasa
    );
    if (moraGrupo === 0) return;
    moraTotal += moraGrupo;

    // La mora del documento se reparte entre sus actos, en proporción a la
    // tributaria de cada uno. El remanente exacto va al último para que la
    // suma cuadre al peso.
    let asignada = 0;
    g.indices.forEach((idx, i) => {
      let parte;
      if (i === g.indices.length - 1) {
        parte = moraGrupo - asignada;
      } else {
        parte = Math.round((moraGrupo * (calculados[idx].tributaria / g.total)) / 100) * 100;
        asignada += parte;
      }
      moraIdx[idx] = parte;
      diasIdx[idx] = diasVencidos;
      tasaIdx[idx] = tasa;
    });
  });

  // ── PASO 3: aplicar la mora a cada acto ───────────────────────────────────
  const finales = calculados.map((fila, idx) => {
    if (fila.tributaria === null) return fila;
    const { _base, ...resto } = fila;
    return {
      ...resto,
      mora: moraIdx[idx],
      diasVencidos: diasIdx[idx],
      tasaAnual: tasaIdx[idx],
      total: _base + moraIdx[idx],
    };
  });

  // ── PASO 4: totales ───────────────────────────────────────────────────────
  const subtotal = tributariaTotal + oripTotal + igacTotal + saberTotal + moraTotal;
  // Un retiro de $3.000 por cada $600.000 a consignar, redondeando hacia arriba
  const retiros = Math.round(Math.ceil((subtotal + honorarios) / 600000) * 3000);
  const totalConsignar = subtotal + honorarios + retiros;
  const enviado = aNumero(dineroEnviado);

  return {
    actos: finales,
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
