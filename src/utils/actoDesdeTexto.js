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
import { formatNumberWithPoints } from "./formatters.js";

/** Los once tipos que la liquidación sabe calcular. */
export const TIPOS_DE_ACTO = Object.keys(ACTOS_CONFIG);

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
 * Convierte escrituras del panel en actos para la liquidación.
 *
 * Devuelve las que sirven y, aparte, las que no, para poder avisar en vez de
 * dejarlas caer en silencio: una escritura que desaparece sin explicación es
 * peor que un aviso.
 *
 * El valor va tal como esté guardado; si no tiene, entra en cero y quien
 * liquida lo escribe. Así se puede arrancar la liquidación con lo que hay.
 *
 * @param {Array<Object>} escrituras
 * @returns {{actos: Array<Object>, sinTipo: Array<Object>}}
 */
export function actosParaLiquidar(escrituras = []) {
  const actos = [];
  const sinTipo = [];

  for (const e of escrituras) {
    if (!e) continue;
    const tipo = tipoDeActo(e.acto);
    if (!tipo) {
      sinTipo.push(e);
      continue;
    }
    actos.push({
      acto: tipo,
      numeroEscritura: String(e.numeroEscritura || "").trim(),
      fechaEscritura: e.fechaEscritura || "",
      // Con los puntos de miles, igual que cuando se escribe a mano en la
      // pantalla de liquidar. El motor los ignora, pero en pantalla la
      // diferencia entre "60000000" y "60.000.000" se nota.
      valorActo: e.valorActo ? formatNumberWithPoints(String(e.valorActo)) : "",
      foliosAdicionales: 0,
      numActos: 1,
      // De dónde salió, para poder devolver el valor al panel si se corrige.
      idEscritura: e.id || "",
    });
  }

  return { actos, sinTipo };
}
