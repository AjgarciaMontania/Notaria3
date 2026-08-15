// Soportes de envío de escrituras a la notaría de Florencia.
//
// Un mismo soporte (el oficio, la guía de envío, el correo impreso…) puede
// amparar VARIAS escrituras a la vez. Por eso el archivo se sube UNA sola vez
// y luego se referencia desde cada escritura que cubre.
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage, auth } from "../firebase";

const CARPETA = "soportes-escrituras";

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
export async function subirReciboRegistro(archivo, escritura) {
  if (!archivo) throw new Error("No se eligió ningún archivo.");
  if (archivo.size > 50 * 1024 * 1024) {
    throw new Error("El archivo pesa más de 50 MB.");
  }

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
    fechaRegistro: new Date().toISOString(),
    registradoPor: auth.currentUser?.email || "",
    reciboNombre: archivo.name,
    reciboURL,
    reciboPath: ruta,
  });
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

/**
 * Días hábiles transcurridos desde una fecha (sin contar sábados ni domingos).
 *
 * Sirve para saber cuánto lleva una escritura en registro: la ORIP se demora
 * unos 15 días hábiles. No descuenta festivos, así que es una guía, no una
 * fecha exacta.
 */
export function diasHabilesDesde(iso) {
  if (!iso) return 0;
  const desde = new Date(iso);
  if (Number.isNaN(desde.getTime())) return 0;

  const hoy = new Date();
  let dias = 0;
  const cursor = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  const fin = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  while (cursor < fin) {
    cursor.setDate(cursor.getDate() + 1);
    const diaSemana = cursor.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) dias++;
  }
  return dias;
}

/** Días hábiles que suele demorarse la ORIP en sacar una escritura. */
export const DIAS_HABILES_REGISTRO = 15;
