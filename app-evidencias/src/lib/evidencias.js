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

  await new Promise((resolve, reject) => {
    const tarea = uploadBytesResumable(referencia, archivo, {
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
    size: archivo.size,
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
