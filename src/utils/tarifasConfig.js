// ─────────────────────────────────────────────────────────────────────────────
// TARIFAS — administrables desde la página web
//
// Aquí están todos los valores en pesos y porcentajes que la notaría usa para
// liquidar. Cada año sale una resolución nueva de la Superintendencia y estas
// cifras cambian; antes había que editar el código, compilar y reinstalar la
// APK en todos los celulares. Ahora se editan desde el panel "Tarifas" de la
// página y viajan solas al computador y a los celulares, igual que las tasas
// de mora.
//
// CÓMO FUNCIONA
// Lo de este archivo es el RESPALDO: los valores vigentes al momento de
// programar. Lo que se guarde en Firestore (config/tarifas) manda sobre ellos,
// campo por campo. Si Firestore está vacío o no responde, todo sigue
// funcionando con estos números.
//
// Lo que NO está aquí, a propósito:
//   · Los porcentajes del impuesto de registro por acto (1% y 0,5%) los fija la
//     Ley 223 de 1995, no una resolución anual. Viven en actosConfig.js.
//   · El 2% de conservación documental sí está, porque va en la resolución.
// ─────────────────────────────────────────────────────────────────────────────

/** Valores vigentes según RES-2026-001726-6 y los recibos de agosto de 2026. */
export const TARIFAS_BASE = {
  // ── Derechos de registro (ORIP) ───────────────────────────────────────────
  /** Derecho de un acto sin cuantía. */
  sinCuantiaBase: 29500,
  /** Cada folio adicional del documento. */
  folioAdicional: 15300,
  /** Derecho mínimo: se cobra cuando la cuantía cae en el primer tramo. */
  derechoMinimo: 53100,
  /** Sistematización y conservación documental, sobre el derecho (Art. 25). */
  conservacion: 0.02,

  /**
   * Tramos de cuantía. Se toma el primero cuyo límite no supere el valor.
   * `tasa: null` significa que en ese tramo se cobra el derecho mínimo.
   * `limite: null` es el último tramo, sin tope.
   */
  tramos: [
    { limite: 12852101, tasa: null },
    { limite: 192778606, tasa: 0.00911 },
    { limite: 334149656, tasa: 0.01131 },
    { limite: 494798857, tasa: 0.01260 },
    { limite: null, tasa: 0.01333 },
  ],

  // ── Impuesto de registro (Gobernación) ────────────────────────────────────
  /** Mínimo que se cobra en los actos sin cuantía. */
  tarifaMinimaSinCuantia: 233500,
  /** Puntos que se le restan a la usura para la mora (E.T. art. 635). */
  descuentoMora: 0.02,

  // ── Honorarios de la notaría ──────────────────────────────────────────────
  honorarios: {
    primero: 35000,
    segundoTercero: 25000,
    resto: 20000,
  },

  // ── Retiros bancarios ─────────────────────────────────────────────────────
  /** Se cobra un retiro por cada este monto a consignar. */
  retiroPorCada: 600000,
  /** Valor de cada retiro. */
  retiroValor: 3000,

  // ── Cobros propios de la hipoteca ─────────────────────────────────────────
  /** Constancia de inscripción: entra al derecho y sí paga el 2%. */
  hipotecaConstancia: 17300,
  /** Certificado de tradición: trámite aparte, NO paga el 2%. */
  hipotecaCertificado: 24300,

  // ── Referencia ────────────────────────────────────────────────────────────
  /** Solo informativo: se muestra en el panel para saber de dónde salen. */
  resolucion: 'RES-2026-001726-6',
};

/** Etiquetas y ayudas para el panel de administración. */
export const CAMPOS_TARIFA = [
  {
    grupo: 'Derechos de registro (ORIP)',
    campos: [
      { clave: 'sinCuantiaBase', etiqueta: 'Acto sin cuantía', tipo: 'pesos',
        ayuda: 'Derecho por cada acto sin cuantía.' },
      { clave: 'folioAdicional', etiqueta: 'Folio adicional', tipo: 'pesos',
        ayuda: 'Se cobra por cada folio de más del documento.' },
      { clave: 'derechoMinimo', etiqueta: 'Derecho mínimo', tipo: 'pesos',
        ayuda: 'Se aplica cuando la cuantía cae en el primer tramo.' },
      { clave: 'conservacion', etiqueta: 'Conservación documental', tipo: 'porcentaje',
        ayuda: 'Se suma sobre el derecho de registro. Hoy es 2%.' },
    ],
  },
  {
    grupo: 'Impuesto de registro',
    campos: [
      { clave: 'tarifaMinimaSinCuantia', etiqueta: 'Mínimo sin cuantía', tipo: 'pesos',
        ayuda: 'Lo que cobra la Gobernación en actos sin cuantía.' },
      { clave: 'descuentoMora', etiqueta: 'Descuento de mora', tipo: 'porcentaje',
        ayuda: 'Puntos que se le restan a la usura (art. 635 E.T.). Hoy 2 puntos.' },
    ],
  },
  {
    grupo: 'Honorarios de la notaría',
    campos: [
      { clave: 'honorarios.primero', etiqueta: 'Primer acto', tipo: 'pesos' },
      { clave: 'honorarios.segundoTercero', etiqueta: 'Actos 2° y 3°', tipo: 'pesos' },
      { clave: 'honorarios.resto', etiqueta: 'Del 4° en adelante', tipo: 'pesos' },
    ],
  },
  {
    grupo: 'Retiros bancarios',
    campos: [
      { clave: 'retiroPorCada', etiqueta: 'Un retiro por cada', tipo: 'pesos' },
      { clave: 'retiroValor', etiqueta: 'Valor del retiro', tipo: 'pesos' },
    ],
  },
  {
    grupo: 'Hipoteca',
    campos: [
      { clave: 'hipotecaConstancia', etiqueta: 'Constancia de inscripción', tipo: 'pesos',
        ayuda: 'Entra al derecho de registro y sí paga el 2%.' },
      { clave: 'hipotecaCertificado', etiqueta: 'Certificado de tradición', tipo: 'pesos',
        ayuda: 'Trámite aparte: NO paga el 2% de conservación.' },
    ],
  },
];

/** Lee "honorarios.primero" dentro de un objeto. */
export function leerCampo(objeto, ruta) {
  return ruta.split('.').reduce((o, k) => (o == null ? undefined : o[k]), objeto);
}

/** Escribe "honorarios.primero" devolviendo una copia nueva. */
export function escribirCampo(objeto, ruta, valor) {
  const partes = ruta.split('.');
  const copia = { ...objeto };
  let actual = copia;
  for (let i = 0; i < partes.length - 1; i++) {
    actual[partes[i]] = { ...(actual[partes[i]] || {}) };
    actual = actual[partes[i]];
  }
  actual[partes[partes.length - 1]] = valor;
  return copia;
}

/**
 * Mezcla lo guardado en Firestore sobre los valores del código.
 *
 * Campo por campo: lo que no esté guardado conserva el valor del código. Así,
 * si alguien guarda solo el folio adicional, todo lo demás sigue igual.
 */
export function combinarTarifas(guardadas) {
  if (!guardadas || typeof guardadas !== 'object') return TARIFAS_BASE;

  const numero = (v, respaldo) =>
    typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : respaldo;

  const tramos = Array.isArray(guardadas.tramos) && guardadas.tramos.length
    ? guardadas.tramos.map((t, i) => ({
        limite: t?.limite === null || typeof t?.limite === 'number'
          ? t.limite
          : TARIFAS_BASE.tramos[i]?.limite ?? null,
        tasa: t?.tasa === null || typeof t?.tasa === 'number'
          ? t.tasa
          : TARIFAS_BASE.tramos[i]?.tasa ?? null,
      }))
    : TARIFAS_BASE.tramos;

  return {
    ...TARIFAS_BASE,
    ...Object.fromEntries(
      Object.keys(TARIFAS_BASE)
        .filter((k) => typeof TARIFAS_BASE[k] === 'number')
        .map((k) => [k, numero(guardadas[k], TARIFAS_BASE[k])])
    ),
    honorarios: {
      primero: numero(guardadas.honorarios?.primero, TARIFAS_BASE.honorarios.primero),
      segundoTercero: numero(guardadas.honorarios?.segundoTercero, TARIFAS_BASE.honorarios.segundoTercero),
      resto: numero(guardadas.honorarios?.resto, TARIFAS_BASE.honorarios.resto),
    },
    tramos,
    resolucion: typeof guardadas.resolucion === 'string' && guardadas.resolucion.trim()
      ? guardadas.resolucion.trim()
      : TARIFAS_BASE.resolucion,
  };
}

/** Lista de campos que están cambiados respecto al código, para avisarlo. */
export function camposModificados(guardadas) {
  const activas = combinarTarifas(guardadas);
  const cambiados = [];
  CAMPOS_TARIFA.forEach(({ campos }) =>
    campos.forEach(({ clave, etiqueta }) => {
      if (leerCampo(activas, clave) !== leerCampo(TARIFAS_BASE, clave)) cambiados.push(etiqueta);
    })
  );
  const tramosDistintos = activas.tramos.some(
    (t, i) =>
      t.limite !== TARIFAS_BASE.tramos[i]?.limite || t.tasa !== TARIFAS_BASE.tramos[i]?.tasa
  );
  if (tramosDistintos) cambiados.push('Tramos de cuantía');
  return cambiados;
}
