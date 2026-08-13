// Puente con el plugin nativo que recibe los PDF enviados desde otras apps
// mediante el botón "Compartir" de Android.
import { registerPlugin, Capacitor } from '@capacitor/core';

const ArchivosCompartidos = registerPlugin('ArchivosCompartidos', {
  // En navegador (npm run dev) no hay nada que recibir: implementación vacía
  // para que la app siga funcionando durante el desarrollo.
  web: () => ({
    obtenerPendientes: async () => ({ archivos: [] }),
    addListener: () => ({ remove: async () => {} }),
    removeAllListeners: async () => {},
  }),
});

/** Archivos que llegaron antes de que la interfaz estuviera lista. */
export async function pendientesAlArrancar() {
  if (!Capacitor.isNativePlatform()) return [];
  try {
    const respuesta = await ArchivosCompartidos.obtenerPendientes();
    return respuesta?.archivos ?? [];
  } catch (error) {
    console.error('No se pudieron leer los archivos compartidos', error);
    return [];
  }
}

/** Avisa cuando llegan archivos con la app ya abierta. */
export async function alRecibirArchivos(callback) {
  if (!Capacitor.isNativePlatform()) return { remove: async () => {} };
  try {
    return await ArchivosCompartidos.addListener('archivosCompartidos', (datos) => {
      const archivos = datos?.archivos ?? [];
      if (archivos.length) callback(archivos);
    });
  } catch (error) {
    console.error('No se pudo escuchar los archivos compartidos', error);
    return { remove: async () => {} };
  }
}

/**
 * Convierte la ruta local que entrega el plugin en contenido subible.
 * El plugin ya copió el archivo a la caché de la app, así que aquí solo se
 * lee un archivo propio: no hay content:// de por medio ni lecturas parciales.
 */
export async function leerCompartido(archivo) {
  const url = Capacitor.convertFileSrc(archivo.ruta);
  const respuesta = await fetch(url);
  if (!respuesta.ok) {
    throw new Error(`No se pudo leer "${archivo.nombre}"`);
  }
  const blob = await respuesta.blob();
  if (blob.size === 0) {
    throw new Error(`"${archivo.nombre}" llegó vacío`);
  }
  // Se devuelve con el tipo correcto para que Storage lo guarde como PDF.
  return new Blob([await blob.arrayBuffer()], {
    type: archivo.tipo || 'application/pdf',
  });
}

export function formatoTamano(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
