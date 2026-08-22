// Soportes de envío de escrituras a la notaría de Florencia.
//
// Un mismo soporte (el oficio, la guía de envío, el correo impreso…) puede
// amparar VARIAS escrituras a la vez. Por eso el archivo se sube UNA sola vez
// y luego se referencia desde cada escritura que cubre.
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage, auth } from "../firebase";
import { desdeFechaLocal } from "./registro.js";

const CARPETA = "soportes-escrituras";

/**
 * Borra de Storage una lista de rutas.
 *
 * Devuelve cuántas se borraron y cuáles fallaron, en vez de reventar a la
 * primera: si el registro de Firestore ya se borró, dejar el proceso a medias
 * no arregla nada. Lo que falle se informa para poder mirarlo.
 *
 * Un archivo que ya no existe NO cuenta como error: el resultado buscado
 * —que no esté— ya se cumplió.
 *
 * @param {string[]} rutas  rutas de Storage
 * @returns {Promise<{borrados: number, fallidos: Array<{ruta: string, motivo: string}>}>}
 */
export async function borrarArchivos(rutas = []) {
  let borrados = 0;
  const fallidos = [];
  for (const ruta of rutas) {
    if (!ruta) continue;
    try {
      await deleteObject(ref(storage, ruta));
      borrados++;
    } catch (fallo) {
      if (fallo?.code === "storage/object-not-found") {
        borrados++;
        continue;
      }
      fallidos.push({ ruta, motivo: fallo?.code || fallo?.message || "error" });
    }
  }
  return { borrados, fallidos };
}

/**
 * Lee el archivo completo antes de subirlo.
 * Evita el problema de los PDF que llegan truncados cuando el navegador los
 * entrega por partes desde un proveedor externo.
 */
async function leerCompleto(archivo) {
  let datos = null;
  try {
    datos = await archivo.arrayBuffer();
  } catch {
    datos = null;
  }
  if (!datos || datos.byteLength === 0) {
    datos = await new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(lector.result);
      lector.onerror = () => reject(new Error("No se pudo leer el archivo"));
      lector.readAsArrayBuffer(archivo);
    });
  }
  if (!datos || datos.byteLength === 0) {
    throw new Error("El archivo llegó vacío. Vuelve a elegirlo.");
  }
  return datos;
}

/** Quita acentos y caracteres que no valen como nombre de archivo. */
function nombreSeguro(nombre) {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w.\- ]/g, "_")
    .trim();
}

/**
 * Sube un soporte y marca como enviadas todas las escrituras indicadas.
 *
 * @param {File} archivo        soporte a subir
 * @param {Array} escrituras    documentos de Firestore que ampara este soporte
 * @returns {Promise<{cantidad:number, nombre:string}>}
 */
export async function subirSoporteYMarcarEnviadas(archivo, escrituras) {
  if (!escrituras.length) throw new Error("No hay escrituras seleccionadas");

  const datos = await leerCompleto(archivo);
  const tipo = archivo.type || "application/octet-stream";

  // Marca de tiempo en el nombre: un mismo oficio puede enviarse varias veces
  // y no queremos que el segundo pise al primero.
  const marca = new Date().toISOString().replace(/[:.]/g, "-");
  const nombreArchivo = `${marca}_${nombreSeguro(archivo.name)}`;
  const ruta = `${CARPETA}/${nombreArchivo}`;

  const referencia = ref(storage, ruta);
  await uploadBytes(referencia, new Blob([datos], { type: tipo }), {
    contentType: tipo,
    // Para que "Ver soporte" lo muestre en el navegador en vez de descargarlo
    contentDisposition: "inline",
  });
  const soporteURL = await getDownloadURL(referencia);

  const envio = {
    enviado: true,
    fechaEnvio: new Date().toISOString(),
    enviadoPor: auth.currentUser?.email || "",
    soporteNombre: archivo.name,
    soporteURL,
    soportePath: ruta,
  };

  await Promise.all(
    escrituras.map((e) => updateDoc(doc(db, "escrituras", e.id), envio))
  );

  return { cantidad: escrituras.length, nombre: archivo.name };
}

/**
 * Devuelve una escritura al estado pendiente.
 *
 * Si ninguna otra escritura sigue usando ese mismo soporte, el archivo también
 * se borra de Storage para no dejar documentos huérfanos ocupando espacio.
 */
export async function revertirEnvio(escritura, todasLasEscrituras) {
  const ruta = escritura.soportePath;

  await updateDoc(doc(db, "escrituras", escritura.id), {
    enviado: false,
    fechaEnvio: "",
    enviadoPor: "",
    soporteNombre: "",
    soporteURL: "",
    soportePath: "",
  });

  if (!ruta) return { archivoBorrado: false };

  const loSiguenUsando = todasLasEscrituras.some(
    (e) => e.id !== escritura.id && e.soportePath === ruta
  );
  if (loSiguenUsando) return { archivoBorrado: false };

  try {
    await deleteObject(ref(storage, ruta));
    return { archivoBorrado: true };
  } catch (fallo) {
    // Si el archivo ya no estaba, no es un problema: la ficha quedó limpia.
    if (fallo.code !== "storage/object-not-found") throw fallo;
    return { archivoBorrado: false };
  }
}

export function formatoFechaEnvio(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// RECIBO DE PAGO DE IMPUESTOS — soporte INDIVIDUAL de cada escritura
//
// Es la etapa anterior al envío. El flujo completo de una escritura es:
//
//   1. Pendiente ................ fila blanca
//   2. Pagada y en registro ..... fila AMARILLA  ← esto
//        Se pagaron los impuestos y quedó radicada. La ORIP se demora unos
//        15 días hábiles en sacarla.
//   3. Registrada y enviada ..... fila VERDE
//        Ya salió de registro y se envió a la notaría.
//
// A diferencia del soporte de envío —que es UNO para muchas escrituras—, este
// recibo pertenece a una sola escritura: cada una paga sus propios impuestos.
// Por eso al quitarlo se borra el archivo sin preguntar por las demás.
// ─────────────────────────────────────────────────────────────────────────────

const CARPETA_RECIBOS = "recibos-registro";

/**
 * Sube el recibo de pago de una escritura y la marca como pagada / en registro.
 *
 * @param {File} archivo    recibo escaneado o fotografiado
 * @param {Object} escritura documento de Firestore
 */
export async function subirReciboRegistro(archivo, escritura, fechaPago = "") {
  if (!archivo) throw new Error("No se eligió ningún archivo.");
  if (archivo.size > 50 * 1024 * 1024) {
    throw new Error("El archivo pesa más de 50 MB.");
  }

  // La fecha que cuenta es la del PAGO, no la del día en que se adjunta el
  // recibo. De ella arranca el contador de los 15 días hábiles de la ORIP:
  // si se pagó el martes y el recibo se sube el lunes siguiente, esos días ya
  // corrieron y la escritura lleva más tiempo esperando de lo que parece.
  const fechaRegistro = fechaPago
    ? desdeFechaLocal(fechaPago)
    : new Date().toISOString();
  if (!fechaRegistro) throw new Error("La fecha del pago no es válida.");

  const limpio = archivo.name.replace(/[^\w.\-]+/g, "_");
  const ruta = `${CARPETA_RECIBOS}/${escritura.id}-${Date.now()}-${limpio}`;
  const referencia = ref(storage, ruta);

  await uploadBytes(referencia, archivo, {
    contentType: archivo.type || "application/octet-stream",
    // Para que "Ver recibo" lo abra en el navegador en vez de descargarlo
    contentDisposition: "inline",
  });
  const reciboURL = await getDownloadURL(referencia);

  await updateDoc(doc(db, "escrituras", escritura.id), {
    enRegistro: true,
    fechaRegistro,
    registradoPor: auth.currentUser?.email || "",
    reciboNombre: archivo.name,
    reciboURL,
    reciboPath: ruta,
  });
}

/**
 * Corrige la fecha de pago de una escritura que ya está en registro.
 *
 * No toca el archivo: sirve para cuando el recibo se adjuntó con la fecha del
 * día y en realidad el pago fue antes. Al cambiarla, el contador de días
 * hábiles se recalcula solo.
 *
 * @param {Object} escritura documento de Firestore
 * @param {string} fecha     "AAAA-MM-DD"
 */
export async function actualizarFechaRegistro(escritura, fecha) {
  const iso = desdeFechaLocal(fecha);
  if (!iso) throw new Error("La fecha no es válida.");
  await updateDoc(doc(db, "escrituras", escritura.id), { fechaRegistro: iso });
}

/** Quita el recibo y devuelve la escritura al estado pendiente. */
export async function quitarReciboRegistro(escritura) {
  if (escritura.reciboPath) {
    try {
      await deleteObject(ref(storage, escritura.reciboPath));
    } catch (fallo) {
      // Si el archivo ya no está, no vale la pena detener el proceso.
      console.warn("No se pudo borrar el recibo:", fallo);
    }
  }
  await updateDoc(doc(db, "escrituras", escritura.id), {
    enRegistro: false,
    fechaRegistro: "",
    registradoPor: "",
    reciboNombre: "",
    reciboURL: "",
    reciboPath: "",
  });
}

// El contador de días hábiles y el umbral viven en utils/registro.js, que
// comparten la web y la APK: así las dos cuentan igual.
export {
  diasHabilesDesde,
  DIAS_HABILES_REGISTRO,
  estadoEscritura,
  registroDemorado,
  aFechaLocal,
  desdeFechaLocal,
  hoyLocal,
  ordenarPorFecha,
  CAMPO_FECHA_DEL_FILTRO,
} from "./registro.js";
