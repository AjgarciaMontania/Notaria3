// ─────────────────────────────────────────────────────────────────────────────
// LOS ACTOS QUE CONTIENE UNA ESCRITURA
//
// Lo comparten la página web y la APK. Es lógica pura, sin Firebase.
//
// ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
// Una escritura puede contener VARIOS actos: una compraventa que además
// cancela una hipoteca y constituye patrimonio de familia son tres actos en un
// solo documento. Cada uno paga su tarifa, pero la escritura es una sola: la
// mora se cobra UNA vez sobre el total. Así salen los recibos de Hacienda.
//
// El panel de Escrituras guardaba un solo acto por registro. Quien tenía una
// escritura con varios escribía "VARIOS" en el campo, y esa escritura no se
// podía liquidar: "VARIOS" no es un acto con tarifa.
//
// ── CÓMO SE GUARDA AHORA ────────────────────────────────────────────────────
// La escritura sigue siendo UN solo documento de Firestore, con un campo nuevo:
//
//   actos: [ { acto: "COMPRAVENTA", valorActo: 65000000 },
//            { acto: "CANCELACIÓN ENAJENACIÓN", valorActo: 0 } ]
//
// Y se siguen escribiendo los campos viejos `acto` y `valorActo`, copiados del
// PRIMER acto de la lista. No es por descuido: hay código que los lee para
// buscar, ordenar y mostrar, y una versión anterior de la APK instalada en un
// celular los sigue leyendo. Mientras existan, nada se rompe.
//
// ── LAS ESCRITURAS DE ANTES ─────────────────────────────────────────────────
// Las que ya estaban guardadas no tienen `actos`. No hay que migrarlas ni
// tocarlas: actosDeEscritura() las lee como una lista de un solo acto. La
// primera vez que se editen, quedan con el campo nuevo.
// ─────────────────────────────────────────────────────────────────────────────
import { tipoDeActo } from "./actoDesdeTexto.js";
import { formatNumberWithPoints } from "./formatters.js";

/** Deja solo los dígitos de lo que se escribió: "60.000.000" → 60000000. */
export function soloDigitos(texto) {
  const n = parseInt(String(texto ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Los actos de una escritura, venga guardada como venga.
 *
 * Devuelve SIEMPRE una lista con al menos un elemento, para que quien la use
 * no tenga que preguntar si el campo nuevo existe o no.
 *
 * @param {Object} escritura registro tal como está en Firestore
 * @returns {Array<{acto: string, valorActo: number}>}
 */
export function actosDeEscritura(escritura) {
  if (!escritura) return [{ acto: "", valorActo: 0 }];

  const lista = Array.isArray(escritura.actos) ? escritura.actos : [];
  const limpios = lista
    .filter((a) => a && String(a.acto ?? "").trim() !== "")
    .map((a) => ({ acto: String(a.acto).trim(), valorActo: soloDigitos(a.valorActo) }));

  if (limpios.length > 0) return limpios;

  // Escritura de antes del cambio: un solo acto en los campos viejos.
  return [{
    acto: String(escritura.acto ?? "").trim(),
    valorActo: soloDigitos(escritura.valorActo),
  }];
}

/** ¿Esta escritura tiene más de un acto? */
export function tieneVariosActos(escritura) {
  return actosDeEscritura(escritura).length > 1;
}

/** El acto que se muestra en la columna ACTO: el primero de la lista. */
export function actoPrincipal(escritura) {
  return actosDeEscritura(escritura)[0].acto;
}

/** Suma de las cuantías de todos los actos. */
export function cuantiaTotal(escritura) {
  return actosDeEscritura(escritura).reduce((suma, a) => suma + a.valorActo, 0);
}

/**
 * Arma los campos que se guardan en Firestore a partir de una lista de actos.
 *
 * Escribe el campo nuevo Y los viejos, por lo explicado arriba. Los actos sin
 * nombre se descartan: una línea vacía en el formulario no debe convertirse en
 * un acto fantasma que después nadie sabe de dónde salió.
 *
 * @param {Array<{acto: string, valorActo: string|number}>} actos
 * @returns {{acto: string, valorActo: number, actos: Array}}
 */
export function camposDeActos(actos = []) {
  const limpios = (Array.isArray(actos) ? actos : [])
    .filter((a) => a && String(a.acto ?? "").trim() !== "")
    .map((a) => ({ acto: String(a.acto).trim(), valorActo: soloDigitos(a.valorActo) }));

  const primero = limpios[0] || { acto: "", valorActo: 0 };
  return {
    acto: primero.acto,
    valorActo: primero.valorActo,
    actos: limpios,
  };
}

/**
 * Convierte escrituras del panel en actos para la liquidación.
 *
 * Cada acto sale como una fila, PERO todas las de una misma escritura llevan
 * el mismo número y la misma fecha. Eso no es un detalle de presentación: el
 * motor agrupa por número + fecha y cobra una sola mora por documento, que es
 * como liquida la Secretaría de Hacienda. Está comprobado contra el recibo de
 * la escritura 067 (compraventa + cancelación: $883.500 y una mora de $16.000).
 *
 * Los actos que no se reconocen NO se dejan caer en silencio: salen aparte
 * para poder avisar cuáles quedaron por fuera. Una escritura que desaparece
 * sin explicación es peor que un aviso.
 *
 * @param {Array<Object>} escrituras
 * @returns {{actos: Array<Object>, sinTipo: Array<Object>}}
 */
export function actosParaLiquidar(escrituras = []) {
  const actos = [];
  const sinTipo = [];

  for (const e of escrituras) {
    if (!e) continue;
    const suyos = actosDeEscritura(e);
    const reconocidos = [];
    const noReconocidos = [];

    for (const uno of suyos) {
      const tipo = tipoDeActo(uno.acto);
      if (tipo) reconocidos.push({ tipo, valorActo: uno.valorActo });
      else noReconocidos.push(uno.acto);
    }

    // Si de una escritura no se reconoce NINGUNO, se reporta la escritura
    // entera. Si se reconocen unos sí y otros no, se avisa de los que faltan
    // pero indicando de qué escritura son, para poder ir a arreglarla.
    if (reconocidos.length === 0) {
      sinTipo.push(e);
      continue;
    }
    if (noReconocidos.length > 0) {
      sinTipo.push({ ...e, acto: noReconocidos.join(", "), parcial: true });
    }

    for (const r of reconocidos) {
      actos.push({
        acto: r.tipo,
        numeroEscritura: String(e.numeroEscritura || "").trim(),
        fechaEscritura: e.fechaEscritura || "",
        // Con los puntos de miles, igual que cuando se escribe a mano en la
        // pantalla de liquidar. El motor los ignora, pero en pantalla la
        // diferencia entre "60000000" y "60.000.000" se nota.
        valorActo: r.valorActo ? formatNumberWithPoints(String(r.valorActo)) : "",
        foliosAdicionales: 0,
        numActos: 1,
        // De dónde salió, para poder devolver el valor al panel si se corrige.
        idEscritura: e.id || "",
      });
    }
  }

  return { actos, sinTipo };
}
