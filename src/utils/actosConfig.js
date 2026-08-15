// src/utils/actosConfig.js

// La tarifa mínima de los actos sin cuantía ya no se escribe aquí: vive en
// tarifasConfig.js y se administra desde el panel "Tarifas" de la página web.
// Los actos que la cobran se marcan con la bandera `tributariaMinima: true`.

// ⚠️ Los IMPORTES en pesos ya no se escriben aquí: viven en tarifasConfig.js y
// se administran desde el panel "Tarifas" de la página web. En este archivo
// quedan solo las BANDERAS que dicen QUÉ cobra cada acto:
//
//   tributariaMinima: true  → cobra el mínimo sin cuantía (tarifasConfig)
//   extrasHipoteca: true    → suma la constancia y el certificado (tarifasConfig)
//
// Los porcentajes del impuesto de registro (1% y 0,5%) sí se quedan aquí,
// porque los fija la Ley 223 de 1995 y no una resolución anual.

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
    // Suma la constancia de inscripción (que sí paga el 2%) y el certificado de
    // tradición (que NO lo paga). Los dos importes están en tarifasConfig.js.
    // Confirmado con el recibo de la escritura 089 (18/06/2026):
    // registro $172.200 + 2% = $175.600, y el certificado $24.300 aparte.
    extrasHipoteca: true,
    honorarioContable: true,
  },
  "CERTIFICADO CANCELACIÓN HIPOTECA": {
    tributariaMinima: true,
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
    tributariaMinima: true,
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
    tributariaMinima: true,
    oripTipo: "sin_cuantia",
    oripCount: 1,
    honorarioContable: true,
  },
};