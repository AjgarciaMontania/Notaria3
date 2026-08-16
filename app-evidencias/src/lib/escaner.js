// Convierte fotos tomadas con la cámara en un único PDF.
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { jsPDF } from 'jspdf';
import { versionesDeFoto, pesoDeDataUrl } from './filtroEscaner.js';

/**
 * Abre la cámara y devuelve la foto como dataURL (base64).
 *
 * `allowEditing` abre el recortador propio de Android justo después de la
 * foto: se arrastran las esquinas para dejar solo el papel. Es el mismo paso
 * que hace que un escaneo de ClearScanner se vea limpio; recortar el
 * escritorio también evita que el filtro tenga que adivinar dónde acaba la
 * hoja. La pantalla la pone Android, así que cambia un poco de un celular a
 * otro.
 *
 * Se toma a 2000 px y no a 1600: el filtro necesita detalle para separar la
 * letra del papel, y como después vuelve a comprimir, el archivo termina
 * pesando menos que antes aunque se capture más grande.
 *
 * @param {'camara'|'galeria'} origen
 */
export async function tomarFoto(origen = 'camara') {
  const foto = await Camera.getPhoto({
    quality: 82,
    allowEditing: origen !== 'galeria',
    resultType: CameraResultType.DataUrl,
    source: origen === 'galeria' ? CameraSource.Photos : CameraSource.Camera,
    correctOrientation: true,
    width: 2000,
  });
  return foto.dataUrl;
}

/**
 * Deja una foto lista para el escáner: la original y las dos versiones
 * filtradas, cada una con su peso, para poder elegir.
 *
 * Si el filtro falla —un celular justo de memoria, una foto rarísima— se
 * devuelve al menos la original. Vale mil veces más un escaneo sin filtrar
 * que un error que deja al usuario sin poder subir el recibo.
 */
export async function prepararPagina(dataUrl) {
  try {
    const v = await versionesDeFoto(dataUrl);
    return { original: v.original, gris: v.gris, byn: v.byn, elegida: 'byn' };
  } catch (fallo) {
    console.warn('No se pudo aplicar el filtro:', fallo);
    return { original: { dataUrl, bytes: pesoDeDataUrl(dataUrl) }, elegida: 'original' };
  }
}

/** La imagen que hay que usar de una página: la versión que esté elegida. */
export function dataUrlDePagina(pagina) {
  if (typeof pagina === 'string') return pagina;       // por si queda alguna vieja
  return (pagina[pagina.elegida] || pagina.original).dataUrl;
}

/** Lee el ancho y alto reales de una imagen en dataURL. */
function medirImagen(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ ancho: img.naturalWidth, alto: img.naturalHeight });
    img.onerror = () => reject(new Error('No se pudo leer la imagen'));
    img.src = dataUrl;
  });
}

/**
 * Arma un PDF tamaño carta con una página por foto, centrando cada imagen
 * y respetando su proporción.
 * @param {string[]} paginas lista de dataURL
 * @returns {Promise<Blob>}
 */
export async function fotosAPdf(paginas) {
  if (!paginas.length) throw new Error('No hay páginas para generar el PDF');

  const pdf = new jsPDF({ unit: 'mm', format: 'letter', orientation: 'portrait' });
  const anchoPagina = pdf.internal.pageSize.getWidth();
  const altoPagina = pdf.internal.pageSize.getHeight();
  const margen = 8;
  const anchoUtil = anchoPagina - margen * 2;
  const altoUtil = altoPagina - margen * 2;

  for (let i = 0; i < paginas.length; i++) {
    if (i > 0) pdf.addPage();

    const imagen = dataUrlDePagina(paginas[i]);
    const { ancho, alto } = await medirImagen(imagen);
    const escala = Math.min(anchoUtil / ancho, altoUtil / alto);
    const w = ancho * escala;
    const h = alto * escala;
    const x = (anchoPagina - w) / 2;
    const y = (altoPagina - h) / 2;

    const formato = imagen.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    pdf.addImage(imagen, formato, x, y, w, h, undefined, 'FAST');
  }

  return pdf.output('blob');
}

/** Nombre sugerido: ESCANEO_2026-08-13_14-05.pdf */
export function nombreEscaneo() {
  const ahora = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const fecha = `${ahora.getFullYear()}-${p(ahora.getMonth() + 1)}-${p(ahora.getDate())}`;
  const hora = `${p(ahora.getHours())}-${p(ahora.getMinutes())}`;
  return `ESCANEO_${fecha}_${hora}.pdf`;
}
