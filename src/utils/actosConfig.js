// src/utils/actosConfig.js

/**
 * Tarifa mínima del impuesto de registro para actos SIN CUANTÍA.
 *
 * La Gobernación del Caquetá no cobra $0 por un acto sin cuantía: aplica una
 * tarifa mínima fija asociada al código del acto. Confirmado con recibos de
 * Hacienda y verificado de nuevo con la escritura 077 del 03/06/2026
 * (compraventa $64.000.000 + cancelación de patrimonio de familia):
 *
 *   tributaria compraventa 1% ......  $640.000
 *   tarifa mínima sin cuantía .......  $233.500
 *   base ............................  $873.500
 *   mora 9 días al 29,66% ...........    $6.000
 *   TOTAL ...........................  $879.500  ← exactamente lo liquidado
 *
 * Si la Gobernación actualiza este valor, cámbialo aquí y se aplica a todos
 * los actos sin cuantía a la vez.
 */
export const TARIFA_MINIMA_SIN_CUANTIA = 233500;

export const ACTOS_CONFIG = {
  "COMPRAVENTA": {
    tributariaRate: 0.01,
    oripTipo: "cuantia",
    oripExtras: 0,
    honorarioContable: true,
  },
  "HIPOTECA CON BANCO AGRARIO": {
    tributariaRate: 0.005,
    oripTipo: "cuantia",
    // Constancia de inscripción: entra al subtotal del registro y sí paga el 2%.
    oripExtras: 17300,
    // Certificado de tradición: la ORIP lo cobra como un trámite APARTE y no
    // paga el 2% de conservación documental. Confirmado con el recibo de la
    // escritura 089 (18/06/2026): registro $172.200 + 2% = $175.600, y el
    // certificado $24.300 se suma después, sin recargo.
    // Antes iban sumados como $41.600 y el 2% caía también sobre el
    // certificado, cobrando $500 de más en cada hipoteca.
    oripFueraDel2: 24300, // RES-2026-001726-6
    honorarioContable: true,
  },
  "CERTIFICADO CANCELACIÓN HIPOTECA": {
    tributaria: TARIFA_MINIMA_SIN_CUANTIA,
    oripTipo: "cuantia",
    honorarioContable: true,
  },
  "ESCRITURA PARA SABER": {
    oripTipo: "none",
    honorarioContable: false,
  },
  "TRAMITE IGAC": {
    oripTipo: "none",
    honorarioContable: false,
  },
  // Donación a particular → 1% tributaria
  "DONACIÓN PARTICULAR": {
    tributariaRate: 0.01,
    oripTipo: "cuantia",
    oripExtras: 0,
    honorarioContable: true,
  },
  // Donación donde el beneficiario es entidad gubernamental → 0.5% tributaria
  "DONACIÓN ENTIDAD PÚBLICA": {
    tributariaRate: 0.005,
    oripTipo: "cuantia",
    oripExtras: 0,
    honorarioContable: true,
  },
  "PERMUTA": {
    tributariaRate: 0.01,
    oripTipo: "cuantia",
    oripExtras: 0,
    honorarioContable: true,
  },
  // La sucesión es acto CON CUANTÍA en las dos entidades. La base es el valor
  // de la adjudicación, que se escribe en la columna VALOR ACTO.
  //   ORIP  (Art. 3 RES-2026-001726-6): tabla por rangos del literal b).
  //         Se liquida por círculo registral, no por inmueble.
  //   Tributaria (Gobernación): 1%, igual que la compraventa.
  "SUCESIÓN": {
    tributariaRate: 0.01,
    oripTipo: "cuantia",
    oripExtras: 0,
    honorarioContable: true,
  },
  "ACTO SIN CUANTÍA": {
    // Sin tributariaRate a propósito: en ResultTable el rate tiene prioridad
    // sobre el importe fijo, y con rate 0 esta tarifa nunca se aplicaría.
    tributaria: TARIFA_MINIMA_SIN_CUANTIA,
    oripTipo: "sin_cuantia",
    honorarioContable: false,
  },
  // Resolución de levantamiento de prohibición de enajenar (Ley 1537/2012).
  //
  // ORIP: un solo acto sin cuantía = $30.100.
  //   Aunque la resolución del municipio contiene dos disposiciones
  //   (levantamiento de la prohibición + desistimiento del derecho de
  //   preferencia), la ORIP cobra UNA sola. Antes estaba en 2 y liquidaba
  //   $60.200 de más. Si algún documento llegara a cobrarse doble, se puede
  //   subir a 2 en la columna "ACTOS" de la tabla.
  //
  // Tributaria: tarifa mínima de acto sin cuantía, $233.500.
  //   Confirmado con recibos de la Secretaría de Hacienda Departamental
  //   (p. ej. matrícula 420-113130: "CANCELACIÓN REGISTRO · cuantía 1 ·
  //   $233.500" más intereses de mora).
  "CANCELACIÓN ENAJENACIÓN": {
    tributaria: TARIFA_MINIMA_SIN_CUANTIA,
    oripTipo: "sin_cuantia",
    oripCount: 1,
    honorarioContable: true,
  },
};