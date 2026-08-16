// ─────────────────────────────────────────────────────────────────────────────
// FILTRO DE ESCÁNER
//
// Deja la foto de un documento como si saliera de un escáner: fondo blanco
// parejo y texto oscuro, en vez de la hoja gris con sombras que entrega la
// cámara del celular.
//
// Se hace todo con el lienzo del navegador, sin librerías: la APK no crece ni
// un kilobyte y funciona sin internet.
//
// ── CÓMO FUNCIONA ───────────────────────────────────────────────────────────
// El problema de una foto no es que sea oscura, es que es DESPAREJA: la
// esquina donde pega la lámpara es casi blanca y la de la sombra es gris. Un
// brillo o un contraste de los de toda la vida —los que aplican el mismo
// número a toda la imagen— no arreglan eso: aclaran la sombra y queman la
// parte iluminada.
//
// Por eso cada píxel se compara contra EL PAPEL QUE TIENE ALREDEDOR y no
// contra un valor fijo. Donde hay sombra, el papel de al lado también está en
// sombra, así que la letra sigue destacando igual. Es el método de Sauvola,
// el mismo que usan los escáneres de documentos.
//
// El promedio del vecindario se calcula sobre una copia reducida de la imagen:
// la iluminación cambia despacio, así que una versión pequeña la describe
// igual de bien y el celular hace 16 veces menos cuentas.
// ─────────────────────────────────────────────────────────────────────────────

/** Lado mayor de la imagen ya procesada. Suficiente para leer letra de recibo. */
const LADO_MAXIMO = 2000;

/** Cuánto se reduce la imagen para estimar la iluminación. */
const REDUCCION = 4;

/**
 * Qué tan exigente es el blanco y negro (la "k" de Sauvola).
 * Más alto = fondo más limpio pero se pierde antes lo pálido.
 * 0,18 conserva los sellos flojos y aun así deja el papel blanco.
 */
const EXIGENCIA = 0.18;

/** Calidad del JPEG de la versión en gris. */
const CALIDAD_GRIS = 0.82;

/**
 * Por debajo de esta fracción del brillo del papel, se entiende que ahí NO hay
 * documento —es el escritorio, la mesa, lo que rodee la hoja— y se deja en
 * blanco.
 *
 * ⚠️ Es una fracción, no un valor fijo, y esa es la clave: si la foto es de un
 * documento entero, hasta el papel más amarillento marca el nivel de papel y
 * ninguna parte queda por debajo. La regla solo se activa cuando en la misma
 * foto conviven dos brillos muy distintos, que es justo el caso de la hoja
 * sobre el escritorio oscuro.
 */
const FRACCION_PAPEL = 0.45;

// ── Utilidades ───────────────────────────────────────────────────────────────

function cargarImagen(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('No se pudo leer la foto.'));
    img.src = dataUrl;
  });
}

function lienzo(ancho, alto) {
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  return c;
}

/** Convierte el lienzo a dataURL y calcula cuánto pesaría el archivo. */
function aSalida(canvas, tipo, calidad) {
  const dataUrl = canvas.toDataURL(tipo, calidad);
  // El base64 crece 4 bytes por cada 3; el "=" del final no son datos.
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const relleno = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return { dataUrl, bytes: Math.floor((base64.length * 3) / 4) - relleno };
}

/** "1,4 MB", "620 KB". */
export function formatearTamano(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB`;
}

// ── El cálculo ───────────────────────────────────────────────────────────────

/** Gris perceptual: el ojo ve mucho más el verde que el azul. */
function aGris(datos, total) {
  const gris = new Float32Array(total);
  for (let i = 0, p = 0; i < total; i++, p += 4) {
    gris[i] = 0.299 * datos[p] + 0.587 * datos[p + 1] + 0.114 * datos[p + 2];
  }
  return gris;
}

/** Versión reducida promediando bloques de REDUCCION×REDUCCION. */
function reducir(gris, ancho, alto, f) {
  const an = Math.max(1, Math.ceil(ancho / f));
  const al = Math.max(1, Math.ceil(alto / f));
  const chico = new Float32Array(an * al);
  for (let y = 0; y < al; y++) {
    const y0 = y * f;
    const y1 = Math.min(alto, y0 + f);
    for (let x = 0; x < an; x++) {
      const x0 = x * f;
      const x1 = Math.min(ancho, x0 + f);
      let suma = 0;
      let cuantos = 0;
      for (let yy = y0; yy < y1; yy++) {
        const fila = yy * ancho;
        for (let xx = x0; xx < x1; xx++) { suma += gris[fila + xx]; cuantos++; }
      }
      chico[y * an + x] = suma / cuantos;
    }
  }
  return { chico, an, al };
}

/**
 * Promedio y desviación del vecindario de cada punto, sobre la imagen chica.
 *
 * Se usan "sumas acumuladas": una tabla donde cada casilla guarda la suma de
 * todo lo que tiene arriba y a la izquierda. Con ella, el promedio de un
 * cuadro —por grande que sea— sale con cuatro restas en vez de recorrerlo
 * entero. Sin esto, en un celular esto se demoraría minutos.
 */
function mediaYDesviacion(chico, an, al, radio) {
  const ancho = an + 1;
  const sum = new Float64Array(ancho * (al + 1));
  const sum2 = new Float64Array(ancho * (al + 1));

  for (let y = 0; y < al; y++) {
    let filaS = 0;
    let filaS2 = 0;
    for (let x = 0; x < an; x++) {
      const v = chico[y * an + x];
      filaS += v;
      filaS2 += v * v;
      sum[(y + 1) * ancho + (x + 1)] = sum[y * ancho + (x + 1)] + filaS;
      sum2[(y + 1) * ancho + (x + 1)] = sum2[y * ancho + (x + 1)] + filaS2;
    }
  }

  const media = new Float32Array(an * al);
  const desv = new Float32Array(an * al);
  for (let y = 0; y < al; y++) {
    const y0 = Math.max(0, y - radio);
    const y1 = Math.min(al, y + radio + 1);
    for (let x = 0; x < an; x++) {
      const x0 = Math.max(0, x - radio);
      const x1 = Math.min(an, x + radio + 1);
      const n = (x1 - x0) * (y1 - y0);
      const s = sum[y1 * ancho + x1] - sum[y0 * ancho + x1] - sum[y1 * ancho + x0] + sum[y0 * ancho + x0];
      const s2 = sum2[y1 * ancho + x1] - sum2[y0 * ancho + x1] - sum2[y1 * ancho + x0] + sum2[y0 * ancho + x0];
      const m = s / n;
      media[y * an + x] = m;
      // La varianza puede dar un negativo minúsculo por redondeo; sin el
      // máximo, la raíz devolvería NaN y la imagen saldría en blanco.
      desv[y * an + x] = Math.sqrt(Math.max(0, s2 / n - m * m));
    }
  }
  return { media, desv };
}

/**
 * Brillo del papel: el valor por encima del cual solo queda el 10% más claro.
 *
 * Se usa un percentil y no el máximo porque un reflejo o un pixel quemado
 * mandarían el nivel a 255 y entonces medio documento parecería "no papel".
 */
function nivelDePapel(chico) {
  const muestra = Float32Array.from(chico).sort();
  return muestra[Math.floor(muestra.length * 0.9)] || 255;
}

/** Toma un valor del mapa chico suavizando entre los cuatro vecinos. */
function interpolar(mapa, an, al, x, y) {
  const fx = Math.min(an - 1, Math.max(0, x));
  const fy = Math.min(al - 1, Math.max(0, y));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(an - 1, x0 + 1);
  const y1 = Math.min(al - 1, y0 + 1);
  const dx = fx - x0;
  const dy = fy - y0;
  const a = mapa[y0 * an + x0];
  const b = mapa[y0 * an + x1];
  const c = mapa[y1 * an + x0];
  const d = mapa[y1 * an + x1];
  return a * (1 - dx) * (1 - dy) + b * dx * (1 - dy) + c * (1 - dx) * dy + d * dx * dy;
}

/**
 * Genera las tres versiones de una foto.
 *
 * @param {string} dataUrl foto tal como la entrega la cámara
 * @returns {Promise<{original:Object, gris:Object, byn:Object, ancho:number, alto:number, ms:number}>}
 *          cada versión trae { dataUrl, bytes }
 */
export async function versionesDeFoto(dataUrl) {
  const arranque = Date.now();
  const img = await cargarImagen(dataUrl);

  const escala = Math.min(1, LADO_MAXIMO / Math.max(img.naturalWidth, img.naturalHeight));
  const ancho = Math.max(1, Math.round(img.naturalWidth * escala));
  const alto = Math.max(1, Math.round(img.naturalHeight * escala));

  const c = lienzo(ancho, alto);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, ancho, alto);

  const imagen = ctx.getImageData(0, 0, ancho, alto);
  const datos = imagen.data;
  const total = ancho * alto;

  const gris = aGris(datos, total);
  const { chico, an, al } = reducir(gris, ancho, alto, REDUCCION);

  // La ventana tiene que ser bastante más ancha que un renglón de texto, o el
  // promedio se contagia de la propia letra y el texto se aclara.
  const radio = Math.max(6, Math.round(Math.min(an, al) / 14));
  const { media, desv } = mediaYDesviacion(chico, an, al, radio);
  const papel = nivelDePapel(chico);
  const minimoPapel = papel * FRACCION_PAPEL;

  const salidaGris = new Uint8ClampedArray(total);
  const salidaByn = new Uint8ClampedArray(total);

  for (let y = 0; y < alto; y++) {
    const my = y / REDUCCION;
    for (let x = 0; x < ancho; x++) {
      const i = y * ancho + x;
      const mx = x / REDUCCION;
      const m = interpolar(media, an, al, mx, my);
      const s = interpolar(desv, an, al, mx, my);
      const v = gris[i];

      // Lo que está mucho más oscuro que el papel no es documento: es la mesa
      // donde está apoyada la hoja. Se deja en blanco. Sin esto, el borde de
      // la hoja se convierte en un marco negro y el escritorio en un salpicado
      // de motas que además engorda el archivo.
      if (m < minimoPapel) {
        salidaGris[i] = 255;
        salidaByn[i] = 255;
        continue;
      }

      // ── Versión en gris ────────────────────────────────────────────────
      // Se divide por el papel de alrededor: donde el papel vale 180 y donde
      // vale 240, ambos quedan en blanco, y la letra conserva su tono.
      const normal = m > 1 ? (v / m) * 242 : v;
      // Un estirón suave del contraste para que el gris del papel termine de
      // irse a blanco sin comerse los grises del texto.
      const g = (normal - 118) * 1.32 + 128;
      // Lo que ya casi es blanco se vuelve blanco del todo. El papel deja de
      // tener grano y el JPEG, que gasta la mitad de su tamaño guardando ese
      // grano invisible, se achica muchísimo.
      salidaGris[i] = g > 234 ? 255 : g;

      // ── Versión en blanco y negro (Sauvola) ────────────────────────────
      // El umbral baja donde no hay nada escrito (poca variación), así el
      // papel vacío queda blanco en vez de llenarse de motas.
      const umbral = m * (1 + EXIGENCIA * (s / 128 - 1));
      salidaByn[i] = v > umbral ? 255 : 0;
    }
  }

  const pintar = (valores) => {
    for (let i = 0, p = 0; i < total; i++, p += 4) {
      datos[p] = datos[p + 1] = datos[p + 2] = valores[i];
      datos[p + 3] = 255;
    }
    ctx.putImageData(imagen, 0, 0);
  };

  pintar(salidaGris);
  const gr = aSalida(c, 'image/jpeg', CALIDAD_GRIS);

  pintar(salidaByn);
  // En blanco y negro solo hay dos tonos: el PNG los guarda sin inventarse
  // nada y pesa menos que un JPEG, que además ensuciaría los bordes de las
  // letras con esa especie de eco gris.
  const bn = aSalida(c, 'image/png');

  return {
    original: { dataUrl, bytes: pesoDeDataUrl(dataUrl) },
    gris: gr,
    byn: bn,
    ancho,
    alto,
    ms: Date.now() - arranque,
  };
}

/** Cuánto pesa de verdad un dataURL que ya viene armado. */
export function pesoDeDataUrl(dataUrl) {
  if (!dataUrl) return 0;
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const relleno = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - relleno;
}
