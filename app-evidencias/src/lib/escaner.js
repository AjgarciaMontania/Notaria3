// Convierte fotos tomadas con la cámara en un único PDF.
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { jsPDF } from 'jspdf';

/**
 * Abre la cámara y devuelve la foto como dataURL (base64).
 * @param {'camara'|'galeria'} origen
 */
export async function tomarFoto(origen = 'camara') {
  const foto = await Camera.getPhoto({
    quality: 75,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: origen === 'galeria' ? CameraSource.Photos : CameraSource.Camera,
    correctOrientation: true,
    // Ancho máximo: mantiene los PDF livianos sin perder legibilidad del texto.
    width: 1600,
  });
  return foto.dataUrl;
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

    const { ancho, alto } = await medirImagen(paginas[i]);
    const escala = Math.min(anchoUtil / ancho, altoUtil / alto);
    const w = ancho * escala;
    const h = alto * escala;
    const x = (anchoPagina - w) / 2;
    const y = (altoPagina - h) / 2;

    const formato = paginas[i].startsWith('data:image/png') ? 'PNG' : 'JPEG';
    pdf.addImage(paginas[i], formato, x, y, w, h, undefined, 'FAST');
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
