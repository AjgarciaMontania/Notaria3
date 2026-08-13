// Genera la imagen de la liquidación, la guarda en el celular y ofrece
// compartirla.
import html2canvas from 'html2canvas';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';

/** Nombre del archivo: LIQUIDACION_2026-08-13_21-40.png */
export function nombreImagen() {
  const ahora = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return (
    `LIQUIDACION_${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}` +
    `_${p(ahora.getHours())}-${p(ahora.getMinutes())}.png`
  );
}

/** Convierte el nodo del DOM en una imagen PNG en base64 (sin la cabecera). */
async function nodoABase64(nodo) {
  const lienzo = await html2canvas(nodo, {
    backgroundColor: '#ffffff',
    // 2x para que el texto se lea nítido al ampliar en el celular
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const dataUrl = lienzo.toDataURL('image/png');
  return dataUrl.split(',')[1];
}

/**
 * Guarda la imagen en Documentos y abre el menú de compartir de Android.
 *
 * @param {HTMLElement} nodo  el bloque a fotografiar
 * @returns {Promise<{archivo:string, guardadaEn:string}>}
 */
export async function generarYCompartir(nodo) {
  const base64 = await nodoABase64(nodo);
  const archivo = nombreImagen();

  // En navegador (npm run dev) no hay Filesystem: se descarga sin más.
  if (!Capacitor.isNativePlatform()) {
    const enlace = document.createElement('a');
    enlace.href = `data:image/png;base64,${base64}`;
    enlace.download = archivo;
    enlace.click();
    return { archivo, guardadaEn: 'Descargas' };
  }

  const escrito = await Filesystem.writeFile({
    path: archivo,
    data: base64,
    directory: Directory.Documents,
    recursive: true,
  });

  // El menú de compartir permite mandarla por WhatsApp o guardarla en la
  // galería desde la propia app de fotos.
  try {
    await Share.share({
      title: 'Liquidación notarial',
      files: [escrito.uri],
      dialogTitle: 'Compartir la liquidación',
    });
  } catch (fallo) {
    // Que el usuario cierre el menú de compartir no es un error:
    // la imagen ya quedó guardada.
    if (!/cancel/i.test(fallo?.message || '')) throw fallo;
  }

  return { archivo, guardadaEn: 'Documentos' };
}
