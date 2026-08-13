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
