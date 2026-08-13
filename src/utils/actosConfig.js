// src/utils/actosConfig.js
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
    oripExtras: 24300 + 17300, // Certificado Tradición ($24.300) + Constancia Inscripción ($17.300) — RES-2026-001726-6
    honorarioContable: true,
  },
  "CERTIFICADO CANCELACIÓN HIPOTECA": {
    tributaria: 233500,
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
  "SUCESIÓN": {
    tributariaRate: 0,
    oripTipo: "sin_cuantia",
    honorarioContable: true,
  },
  "ACTO SIN CUANTÍA": {
    tributariaRate: 0,
    oripTipo: "sin_cuantia",
    honorarioContable: false,
  },
  // Art. 11 RES-2026-001726-6: cancelación = sin cuantía en ORIP ($30.100)
  // Tributaria: la Gobernación la calcula sobre el avalúo catastral (IGAC).
  // Como el documento no tiene cuantía, el usuario la ingresa manualmente
  // en la celda de la tabla una vez la Gobernación se la informe.
  // Resolución de levantamiento de prohibición de enajenar (Ley 1537/2012)
  // Tiene 2 actos en un mismo documento: levantamiento + desistimiento derecho preferencia
  // ORIP: 2 × $30.100 = $60.200  |  Tributaria: manual (Gobernación usa avalúo catastral IGAC)
  // Resolución levantamiento de prohibición de enajenar (Ley 1537/2012)
  // Tiene 2 actos por defecto (levantamiento + desistimiento). El usuario
  // puede cambiarlo en la columna "# ACTOS" de la tabla si el documento difiere.
  // Tributaria: manual (Gobernación usa avalúo catastral del IGAC).
  // Resolución levantamiento prohibición enajenar (Ley 1537/2012)
  // Tributaria Gobernación: tarifa mínima fija $233.500 (confirmado recibos Hacienda)
  // ORIP: 2 actos sin cuantía por defecto (editable en tabla)
  "CANCELACIÓN ENAJENACIÓN": {
    tributaria: 233500,
    oripTipo: "sin_cuantia",
    oripCount: 2,
    honorarioContable: true,
  },
};