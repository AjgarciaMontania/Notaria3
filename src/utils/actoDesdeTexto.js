// ─────────────────────────────────────────────────────────────────────────────
// RECONOCER EL ACTO DE UNA ESCRITURA
//
// Lo comparten la página web y la APK. Es lógica pura, sin Firebase.
//
// ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
// El módulo de Escrituras Pendientes guardaba el acto como TEXTO LIBRE: cada
// quien escribía lo que quisiera. La liquidación, en cambio, solo entiende los
// once tipos de actosConfig.js, porque cada uno tiene su tarifa y su regla.
//
// De ahora en adelante el acto se elige de una lista, así que lo nuevo siempre
// coincide. Pero lo que ya está guardado quedó como se escribió, y hay que
// poder saber si sirve para liquidar o no.
//
// ── LO QUE ESTO NO HACE, A PROPÓSITO ────────────────────────────────────────
// NO adivina. Solo empareja lo que es la misma palabra escrita distinto:
// mayúsculas, tildes o espacios de más. "compra venta" o "VENTA" NO se toman
// por COMPRAVENTA.
//
// Y es a propósito: el tipo de acto decide la tarifa. Confundir una permuta
// con una compraventa no es un detalle de presentación, es cobrar mal. Cuando
// no se reconoce, se devuelve null y quien liquida elige el tipo a mano.
// ─────────────────────────────────────────────────────────────────────────────
import { ACTOS_CONFIG } from "./actosConfig.js";

/** Los once tipos que la liquidación sabe calcular. */
export const TIPOS_DE_ACTO = Object.keys(ACTOS_CONFIG);

/**
 * Actos que la notaría registra pero que TODAVÍA no se saben liquidar.
 *
 * Hoy está vacía, y así debe quedarse mientras se pueda: lo normal es que un
 * acto tenga su tarifa en actosConfig.js y se calcule.
 *
 * Aquí va un acto solo cuando hay que poder REGISTRARLO en el panel de
 * Escrituras pero todavía no se sabe cuánto cobra. Al estar fuera de
 * actosConfig.js, el botón de liquidar lo aparta y avisa, en vez de calcularlo
 * en cero calladamente. Un cero silencioso en una liquidación es un cobro mal
 * hecho, y nadie lo nota hasta que ya se consignó.
 *
 * Así estuvo la CONSTITUCIÓN PATRIMONIO DE FAMILIA hasta el 21/08/2026, cuando
 * la notaría averiguó que se cobra como acto sin cuantía y pasó a actosConfig.
 */
export const ACTOS_SIN_TARIFA = [];

/** Todo lo que se puede elegir en el panel de Escrituras Pendientes. */
export const ACTOS_PARA_ESCRITURAS = [...TIPOS_DE_ACTO, ...ACTOS_SIN_TARIFA];

/** Quita tildes, mayúsculas y espacios de más para poder comparar. */
function normalizar(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Se arma una sola vez: texto normalizado → nombre exacto del tipo.
const POR_NOMBRE = new Map(TIPOS_DE_ACTO.map((t) => [normalizar(t), t]));

/**
 * Devuelve el tipo de acto exacto, o null si no se reconoce.
 *
 * @param {string} texto lo que hay guardado en el campo "acto"
 * @returns {string|null}
 */
export function tipoDeActo(texto) {
  return POR_NOMBRE.get(normalizar(texto)) || null;
}

/** ¿Este acto se puede liquidar tal como está guardado? */
export function sePuedeLiquidar(texto) {
  return tipoDeActo(texto) !== null;
}

/**
 * ¿Está en la lista del panel de Escrituras?
 *
 * Sirve para distinguir dos cosas que se ven parecidas pero no lo son: un acto
 * que alguien escribió a mano, y uno que se eligió de la lista y que todavía
 * no se sabe liquidar. El primero puede ser un error de digitación; el segundo
 * es una decisión tomada a conciencia.
 */
export function esActoDeLaLista(texto) {
  const n = normalizar(texto);
  return POR_NOMBRE.has(n) || ACTOS_SIN_TARIFA.some((a) => normalizar(a) === n);
}

// actosParaLiquidar() se mudó a actosDeEscritura.js, que es donde vive la
// lista de actos de cada escritura. Aquí quedó solo el reconocimiento del
// nombre del acto, que es de lo que trata este archivo.
