// Operaciones sobre carpetas y archivos.
// IMPORTANTE: la estructura de datos es idéntica a la de la página web
// (colecciones "folders" y "files", y ruta evidencias/{carpeta}/{archivo} en
// Storage) para que lo que se sube desde el celular aparezca en la web y
// viceversa.
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { db, storage } from '../firebase';

const rutaStorage = (carpeta, nombreArchivo) =>
  `evidencias/${carpeta}/${nombreArchivo}`;

/** Escucha en tiempo real la lista de carpetas, ordenadas por nombre. */
export function escucharCarpetas(callback) {
  return onSnapshot(collection(db, 'folders'), (snap) => {
    const datos = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => a.name.localeCompare(b.name));
    callback(datos);
  });
}

/** Escucha en tiempo real todos los archivos. */
export function escucharArchivos(callback) {
  return onSnapshot(collection(db, 'files'), (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  });
}

export async function crearCarpeta(nombre, carpetasExistentes) {
  const limpio = nombre.trim();
  if (!limpio) throw new Error('Escribe un nombre para la carpeta');
  const yaExiste = carpetasExistentes.some(
    (c) => c.name.toLowerCase() === limpio.toLowerCase()
  );
  if (yaExiste) throw new Error('Ya existe una carpeta con ese nombre');

  await addDoc(collection(db, 'folders'), {
    name: limpio,
    createdAt: new Date().toISOString(),
  });
}

export async function eliminarCarpeta(carpeta, archivosDeLaCarpeta) {
  if (archivosDeLaCarpeta.length > 0) {
    throw new Error(
      'No se puede eliminar una carpeta que todavía contiene archivos'
    );
  }
  await deleteDoc(doc(db, 'folders', carpeta.id));
}

/**
 * Lee un archivo COMPLETO a memoria de una sola pasada.
 *
 * Por qué existe esta función:
 * cuando eliges un PDF desde el celular, Android no entrega el archivo en sí
 * sino una referencia `content://` que apunta a la app que lo comparte
 * (ClearScanner, Drive, WhatsApp…). Firebase, al subir, parte el archivo en
 * trozos y lee cada trozo por separado; varias de esas apps solo permiten
 * leer su archivo UNA vez y de corrido, así que a partir del segundo trozo
 * devolvían datos vacíos y el PDF llegaba truncado, es decir, corrupto.
 *
 * Leyendo todo de una sola pasada y subiendo el contenido ya cargado en
 * memoria, el problema desaparece. Es lo mismo que ya ocurría con el escáner
 * de la app (que genera el PDF en memoria) y por eso ese sí funcionaba.
 */
async function leerArchivoCompleto(archivo) {
  let datos = null;

  try {
    datos = await archivo.arrayBuffer();
  } catch {
    datos = null;
  }

  // Reserva: algunos proveedores de Android fallan con arrayBuffer()
  // pero sí responden a FileReader.
  if (!datos || datos.byteLength === 0) {
    datos = await new Promise((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(lector.result);
      lector.onerror = () =>
        reject(new Error('El celular no dejó leer el archivo'));
      lector.readAsArrayBuffer(archivo);
    });
  }

  if (!datos || datos.byteLength === 0) {
    throw new Error(
      'El archivo llegó vacío. Guárdalo primero en el celular (por ejemplo en Descargas) y vuelve a elegirlo desde ahí.'
    );
  }

  return datos;
}

/** Comprueba la firma de un PDF real: todo PDF empieza por "%PDF-". */
function pareceUnPdf(datos) {
  if (datos.byteLength < 5) return false;
  const cabecera = new Uint8Array(datos, 0, 5);
  return String.fromCharCode(...cabecera) === '%PDF-';
}

/**
 * Sube un archivo y registra su ficha en Firestore.
 * @param {Blob|File} archivo
 * @param {string} nombreArchivo nombre final dentro de la carpeta
 * @param {string} carpeta nombre de la carpeta destino
 * @param {(porcentaje:number)=>void} onProgreso
 */
export async function subirArchivo(archivo, nombreArchivo, carpeta, onProgreso) {
  const ruta = rutaStorage(carpeta, nombreArchivo);
  const referencia = ref(storage, ruta);
  const tipo = archivo.type || 'application/pdf';

  // 1. Todo el contenido a memoria antes de empezar a subir.
  const datos = await leerArchivoCompleto(archivo);

  // 2. Verificamos que sea un PDF de verdad ANTES de subirlo, para no llenar
  //    la carpeta de archivos que después no abren.
  if (nombreArchivo.toLowerCase().endsWith('.pdf') && !pareceUnPdf(datos)) {
    throw new Error(
      'El archivo no se leyó completo y quedaría dañado. Ábrelo primero en el celular para comprobar que sirve, o compártelo a Descargas y elígelo desde ahí.'
    );
  }

  const contenido = new Blob([datos], { type: tipo });
  const tamanoReal = contenido.size;

  // 3. Subida con el contenido ya en memoria: la lectura por trozos que hace
  //    Firebase ahora ocurre sobre datos locales, no sobre el content:// .
  await new Promise((resolve, reject) => {
    const tarea = uploadBytesResumable(referencia, contenido, {
      contentType: tipo,
    });
    tarea.on(
      'state_changed',
      (snap) => {
        if (onProgreso && snap.totalBytes > 0) {
          onProgreso(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
        }
      },
      reject,
      resolve
    );
  });

  const downloadURL = await getDownloadURL(referencia);

  await addDoc(collection(db, 'files'), {
    folder: carpeta,
    fileName: nombreArchivo,
    downloadURL,
    uploadDate: new Date().toISOString(),
    // Tamaño realmente subido, no el que anunciaba el celular.
    size: tamanoReal,
    contentType: tipo,
    storagePath: ruta,
    // Marca de origen: permite saber qué se subió desde el celular.
    origen: 'apk',
  });

  return downloadURL;
}

export async function eliminarArchivo(storagePath, docId) {
  try {
    await deleteObject(ref(storage, storagePath));
  } catch (error) {
    // Si el archivo ya no está en Storage igual limpiamos la ficha.
    if (error.code !== 'storage/object-not-found') throw error;
  }
  await deleteDoc(doc(db, 'files', docId));
}

/**
 * Evita sobrescribir un archivo existente añadiendo un sufijo (1), (2)…
 */
export function nombreDisponible(nombreDeseado, archivosDeLaCarpeta) {
  const nombresUsados = new Set(archivosDeLaCarpeta.map((a) => a.fileName));
  if (!nombresUsados.has(nombreDeseado)) return nombreDeseado;

  const punto = nombreDeseado.lastIndexOf('.');
  const base = punto > 0 ? nombreDeseado.slice(0, punto) : nombreDeseado;
  const ext = punto > 0 ? nombreDeseado.slice(punto) : '';

  let n = 1;
  while (nombresUsados.has(`${base} (${n})${ext}`)) n++;
  return `${base} (${n})${ext}`;
}
