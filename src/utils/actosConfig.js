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
    oripExtras: 24300 + 17000, // Certificado Tradición + Reproducción Doc
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
  "DONACIÓN": {
    tributariaRate: 0,
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
};