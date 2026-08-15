// ─────────────────────────────────────────────────────────────────────────────
// HISTORIAL DE LIQUIDACIONES
//
// Cada liquidación que se guarda queda registrada con lo que se cobró, quién la
// hizo y cuándo. Sirve para dos cosas:
//
//   · Responder un reclamo: "¿cuánto se le cobró a la escritura 067 y por qué?"
//   · Saber con qué tarifas se calculó, porque las tarifas cambian cada año y
//     una liquidación vieja no se puede juzgar con las de hoy.
//
// No se guarda sola al pulsar Calcular: eso llenaría el historial de intentos a
// medio hacer. Se guarda cuando la persona lo pide, con el botón "Guardar".
// ─────────────────────────────────────────────────────────────────────────────
import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { db, auth } from "../firebase";

const COLECCION = "liquidaciones";

/**
 * Guarda una liquidación.
 *
 * @param {Object} datos
 *   @param {string} datos.fechaPago
 *   @param {Array}  datos.documentos  agrupados por escritura, como los devuelve liquidar()
 *   @param {Array}  datos.actos       todos los actos calculados
 *   @param {Object} datos.totales
 *   @param {Object} datos.tarifas     tarifas con las que se calculó
 *   @param {Array}  datos.mesesSinTasa
 */
export async function guardarLiquidacion({ fechaPago, documentos, actos, totales, tarifas, mesesSinTasa }) {
  if (!documentos?.length) throw new Error("No hay nada que guardar: calcula primero.");

  // Se guarda una copia plana y legible, no referencias: si mañana cambian las
  // tarifas o se edita la tabla, lo guardado sigue diciendo lo que se cobró.
  const registro = {
    fechaPago: fechaPago || "",
    creadoEn: new Date().toISOString(),
    creadoPor: auth.currentUser?.email || "",

    escrituras: documentos.map((d) => ({
      numeroEscritura: d.numeroEscritura || "",
      fechaEscritura: d.fechaEscritura || "",
      vence: d.vence || "",
      tributaria: d.tributaria || 0,
      orip: d.orip || 0,
      diasVencidos: d.diasVencidos || 0,
      mora: d.mora || 0,
      total: d.total || 0,
      actos: d.indices
        .map((i) => actos[i])
        .filter(Boolean)
        .map((a) => ({
          acto: a.acto,
          valorActo: a.valorActo || "",
          foliosAdicionales: a.foliosAdicionales || 0,
          tributaria: a.tributaria || 0,
          orip: a.orip || 0,
        })),
    })),

    totales: {
      tributariaTotal: totales.tributariaTotal,
      oripTotal: totales.oripTotal,
      moraTotal: totales.moraTotal,
      subtotal: totales.subtotal,
      honorarios: totales.honorarios,
      retiros: totales.retiros,
      totalConsignar: totales.totalConsignar,
      dineroEnviado: totales.dineroEnviado,
      sobrante: totales.sobrante,
    },

    // Con qué se calculó, para poder auditarlo cuando las tarifas cambien
    tarifas: tarifas
      ? {
          sinCuantiaBase: tarifas.sinCuantiaBase,
          folioAdicional: tarifas.folioAdicional,
          derechoMinimo: tarifas.derechoMinimo,
          conservacion: tarifas.conservacion,
          tarifaMinimaSinCuantia: tarifas.tarifaMinimaSinCuantia,
          descuentoMora: tarifas.descuentoMora,
          honorarios: tarifas.honorarios,
          resolucion: tarifas.resolucion,
        }
      : null,

    mesesSinTasa: mesesSinTasa || [],
  };

  const referencia = await addDoc(collection(db, COLECCION), registro);
  return referencia.id;
}

/**
 * Escucha las liquidaciones guardadas, de la más reciente a la más antigua.
 * Se limita para no traer años de historial de una sola vez.
 */
export function escucharLiquidaciones(callback, cuantas = 200) {
  const consulta = query(collection(db, COLECCION), orderBy("creadoEn", "desc"), limit(cuantas));
  return onSnapshot(consulta, (lista) => {
    callback(lista.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function eliminarLiquidacion(id) {
  await deleteDoc(doc(db, COLECCION, id));
}

/** "2026-08-15T16:20:49.334Z" → "15/08/2026 11:20 a. m." */
export function fechaHora(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("es-CO", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
