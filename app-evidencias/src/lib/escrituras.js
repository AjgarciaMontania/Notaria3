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
import { archivosHuerfanos } from '@calculo/limpiezaArchivos.js';

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
    // Cuantía del acto. Es lo que faltaba para poder liquidar desde aquí:
    // el acto y la fecha ya estaban, el valor no. Las escrituras guardadas
    // antes no lo traen y se leen como 0, sin necesidad de convertir nada.
    valorActo: soloDigitos(datos.valorActo),
    enviado: false,
  });
}

/** Deja solo los dígitos de lo que se escribió: "60.000.000" → 60000000. */
export function soloDigitos(texto) {
  const n = parseInt(String(texto ?? '').replace(/\D/g, ''), 10);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Cambia la cuantía de una escritura ya guardada.
 *
 * Sirve para completar las que quedaron sin valor, que son todas las
 * anteriores a este cambio.
 */
export async function actualizarValorActo(escritura, valor) {
  if (!escritura?.id) throw new Error('Escritura no válida');
  await updateDoc(doc(db, 'escrituras', escritura.id), { valorActo: soloDigitos(valor) });
}

/**
 * Elimina una escritura y se lleva los archivos que quedan huérfanos.
 *
 * Antes solo miraba el soporte de envío y se olvidaba del recibo de impuestos,
 * que se quedaba en Storage para siempre. Qué se borra y qué no lo decide
 * ahora archivosHuerfanos(), el mismo archivo que usa la página web.
 *
 * @returns {Promise<number>} cuántos archivos se borraron
 */
export async function eliminarEscritura(escritura, todas = []) {
  const rutas = archivosHuerfanos([escritura], todas);
  await deleteDoc(doc(db, 'escrituras', escritura.id));

  let borrados = 0;
  for (const ruta of rutas) {
    try {
      await deleteObject(ref(storage, ruta));
      borrados++;
    } catch (fallo) {
      // Que ya no esté es justo lo que se buscaba.
      if (fallo.code === 'storage/object-not-found') { borrados++; continue; }
      // Si falla por otra razón se avisa, pero la escritura YA se borró: no
      // tiene sentido dejar el proceso a medias.
      console.warn('No se pudo borrar el archivo:', ruta, fallo.code);
    }
  }
  return borrados;
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

  if (!(archivo instanceof Blob)) {
    throw new Error('El documento no se generó bien. Intenta de nuevo.');
  }

  const referencia = ref(storage, ruta);
  try {
    await uploadBytes(referencia, archivo, {
      contentType: tipo,
      // "inline" hace que al abrirlo se vea en el navegador en vez de descargarse
      contentDisposition: 'inline',
    });
  } catch (fallo) {
    throw new Error(traducirErrorArchivo(fallo, CARPETA_SOPORTES));
  }
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

// ─────────────────────────────────────────────────────────────────────────────
// RECIBO DE PAGO DE IMPUESTOS — soporte individual de cada escritura
//
// Etapa anterior al envío: se pagaron los impuestos y la ORIP tiene la
// escritura radicada, unos 15 días hábiles. A diferencia del soporte de envío
// —que ampara varias escrituras—, este recibo es de una sola.
//
// Escribe exactamente los mismos campos que la página web, así que lo que se
// adjunte desde el celular se ve al instante en el computador y al revés.
// ─────────────────────────────────────────────────────────────────────────────

const CARPETA_RECIBOS = 'recibos-registro';

/**
 * Traduce los errores de Firebase Storage a algo que se entienda.
 *
 * El mensaje original viene en inglés y no dice qué hacer. El caso más común
 * al estrenar una carpeta nueva es que falten las reglas: eso no se arregla
 * desde el celular, hay que publicarlas en la consola de Firebase.
 */
export function traducirErrorArchivo(fallo, carpeta = '') {
  const codigo = fallo?.code || '';
  if (codigo === 'storage/unauthorized') {
    return `El servidor no permite guardar en "${carpeta}". Hay que publicar las reglas de Storage con esa carpeta desde la consola de Firebase.`;
  }
  if (codigo === 'storage/unauthenticated') return 'La sesión se venció. Vuelve a entrar e intenta de nuevo.';
  if (codigo === 'storage/retry-limit-exceeded') return 'La subida tardó demasiado. Revisa la conexión e intenta otra vez.';
  if (codigo === 'storage/canceled') return 'La subida se canceló.';
  if (codigo === 'storage/quota-exceeded') return 'Se acabó el espacio de almacenamiento.';
  if (codigo === 'storage/invalid-argument') return 'El archivo no llegó en un formato válido. Intenta tomar la foto de nuevo.';
  return fallo?.message || 'Error desconocido';
}

/** Sube el recibo de una escritura y la marca como pagada / en registro. */
export async function subirReciboRegistro(archivo, nombreArchivo, escritura) {
  if (!escritura?.id) throw new Error('Escritura no válida');

  const marca = new Date().toISOString().replace(/[:.]/g, '-');
  const ruta = `${CARPETA_RECIBOS}/${escritura.id}-${marca}_${nombreSeguro(nombreArchivo)}`;

  // Comprobación temprana: si lo que llega no es un archivo, el error de
  // Firebase es críptico ("Expected Blob or File"). Mejor decirlo claro.
  if (!(archivo instanceof Blob)) {
    throw new Error('La foto no se convirtió en documento. Intenta tomarla de nuevo.');
  }

  const referencia = ref(storage, ruta);
  try {
    await uploadBytes(referencia, archivo, {
      contentType: archivo.type || 'application/pdf',
      contentDisposition: 'inline',
    });
  } catch (fallo) {
    throw new Error(traducirErrorArchivo(fallo, CARPETA_RECIBOS));
  }
  const reciboURL = await getDownloadURL(referencia);

  await updateDoc(doc(db, 'escrituras', escritura.id), {
    enRegistro: true,
    fechaRegistro: new Date().toISOString(),
    registradoPor: auth.currentUser?.email || '',
    reciboNombre: nombreArchivo,
    reciboURL,
    reciboPath: ruta,
  });
}

/** Quita el recibo y devuelve la escritura a pendiente. */
export async function quitarReciboRegistro(escritura) {
  if (escritura.reciboPath) {
    try {
      await deleteObject(ref(storage, escritura.reciboPath));
    } catch (fallo) {
      // Si el archivo ya no existe, no vale la pena detener el proceso.
      console.warn('No se pudo borrar el recibo:', fallo);
    }
  }
  await updateDoc(doc(db, 'escrituras', escritura.id), {
    enRegistro: false,
    fechaRegistro: '',
    registradoPor: '',
    reciboNombre: '',
    reciboURL: '',
    reciboPath: '',
  });
}

// El contador de días hábiles vive en el archivo compartido con la web.
export {
  diasHabilesDesde,
  DIAS_HABILES_REGISTRO,
  estadoEscritura,
  registroDemorado,
} from '@calculo/registro.js';
