// Escrituras pendientes de Florencia.
//
// Usa exactamente la misma colección y los mismos campos que la página web,
// así que lo que se marca desde el celular aparece al instante en el computador
// y al revés.
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, auth } from '../firebase';

const CARPETA_SOPORTES = 'soportes-escrituras';

/** Escucha la lista completa, ordenada por número de ítem. */
export function escucharEscrituras(callback) {
  return onSnapshot(collection(db, 'escrituras'), (snap) => {
    const datos = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.item || 0) - (b.item || 0));
    callback(datos);
  });
}

/** Agrega una escritura nueva, calculando el siguiente número de ítem. */
export async function agregarEscritura(datos) {
  if (!datos.acto?.trim()) throw new Error('Escribe el acto');
  if (!datos.numeroEscritura?.trim()) throw new Error('Escribe el número de escritura');

  const snap = await getDocs(collection(db, 'escrituras'));
  const maxItem = snap.docs.length
    ? Math.max(...snap.docs.map((d) => d.data().item || 0))
    : 0;

  await addDoc(collection(db, 'escrituras'), {
    item: maxItem + 1,
    acto: datos.acto.trim(),
    numeroEscritura: datos.numeroEscritura.trim(),
    fechaEscritura: datos.fechaEscritura || '',
    matricula: datos.matricula?.trim() || '',
    notaDevolutiva: datos.notaDevolutiva || 'NO',
    motivo: datos.motivo?.trim() || '',
    enviado: false,
  });
}

/**
 * Elimina una escritura. Si tenía soporte y ninguna otra lo usa, el archivo
 * también se borra de Storage.
 */
export async function eliminarEscritura(escritura, todas) {
  const ruta = escritura.soportePath;
  await deleteDoc(doc(db, 'escrituras', escritura.id));

  if (!ruta) return false;
  const enUso = todas.some((e) => e.id !== escritura.id && e.soportePath === ruta);
  if (enUso) return false;

  try {
    await deleteObject(ref(storage, ruta));
    return true;
  } catch (fallo) {
    if (fallo.code !== 'storage/object-not-found') throw fallo;
    return false;
  }
}

/** Quita acentos y caracteres que no valen como nombre de archivo. */
function nombreSeguro(nombre) {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w.\- ]/g, '_')
    .trim();
}

/**
 * Sube un soporte y marca como enviadas todas las escrituras indicadas.
 * Un mismo archivo puede amparar varias, por eso se sube una sola vez.
 *
 * @param {Blob|File} archivo
 * @param {string} nombreArchivo  nombre que verá el usuario
 * @param {Array} escrituras      escrituras que ampara este soporte
 */
export async function subirSoporteYMarcarEnviadas(archivo, nombreArchivo, escrituras) {
  if (!escrituras.length) throw new Error('No hay escrituras seleccionadas');

  const tipo = archivo.type || 'application/pdf';
  const marca = new Date().toISOString().replace(/[:.]/g, '-');
  const ruta = `${CARPETA_SOPORTES}/${marca}_${nombreSeguro(nombreArchivo)}`;

  const referencia = ref(storage, ruta);
  await uploadBytes(referencia, archivo, {
    contentType: tipo,
    // "inline" hace que al abrirlo se vea en el navegador en vez de descargarse
    contentDisposition: 'inline',
  });
  const soporteURL = await getDownloadURL(referencia);

  const envio = {
    enviado: true,
    fechaEnvio: new Date().toISOString(),
    enviadoPor: auth.currentUser?.email || '',
    soporteNombre: nombreArchivo,
    soporteURL,
    soportePath: ruta,
  };

  await Promise.all(
    escrituras.map((e) => updateDoc(doc(db, 'escrituras', e.id), envio))
  );

  return escrituras.length;
}

/**
 * Devuelve una escritura a pendiente. Si ninguna otra sigue usando ese
 * soporte, el archivo también se borra para no dejar documentos huérfanos.
 */
export async function revertirEnvio(escritura, todas) {
  const ruta = escritura.soportePath;

  await updateDoc(doc(db, 'escrituras', escritura.id), {
    enviado: false,
    fechaEnvio: '',
    enviadoPor: '',
    soporteNombre: '',
    soporteURL: '',
    soportePath: '',
  });

  if (!ruta) return false;

  const enUso = todas.some((e) => e.id !== escritura.id && e.soportePath === ruta);
  if (enUso) return false;

  try {
    await deleteObject(ref(storage, ruta));
    return true;
  } catch (fallo) {
    if (fallo.code !== 'storage/object-not-found') throw fallo;
    return false;
  }
}

export function formatoFechaEnvio(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
