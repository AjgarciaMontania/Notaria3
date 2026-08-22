// ─────────────────────────────────────────────────────────────────────────────
// ¿HAY QUE ACTUALIZAR LA APK, Y SE PUEDE?
//
// Esta es la parte peligrosa de la actualización automática, así que vive
// aquí: separada, sin Capacitor, sin red y sin Firebase, para poder probarla.
// Lo que la rodea (bajar el archivo y aplicarlo) son tres llamadas al plugin;
// LO QUE DECIDE es esto, y está cubierto por pruebas.
//
// ── POR QUÉ HACE FALTA ──────────────────────────────────────────────────────
// La página web se actualiza sola al subir a GitHub. La APK no: había que
// compilar el APK e instalarlo en cada celular. Ahora la APK se trae por
// internet la parte web (que es donde vive TODO: pantallas, motor de cálculo y
// tarifas) y la reemplaza sin reinstalar nada.
//
// ── LO QUE NO SE PUEDE ACTUALIZAR ASÍ ───────────────────────────────────────
// La parte NATIVA — la cámara, el almacenamiento, los permisos de Android, el
// plugin de actualización mismo — vive dentro del APK y no viaja por internet.
// Si una versión nueva necesita algo nativo que el celular no tiene, aplicarla
// dejaría la aplicación rota y sin forma de arreglarse a distancia.
//
// Por eso el manifiesto trae `minNativo`: la versión de APK mínima que esa
// actualización necesita. Si el celular tiene una más vieja, NO se aplica y se
// avisa que hay que instalar el APK nuevo. Es la diferencia entre "no se
// actualizó" y "se dañó".
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Compara dos versiones tipo "3.4" o "3.10.1".
 *
 * OJO con lo obvio: "3.10" es MAYOR que "3.4", aunque como texto sea menor.
 * Comparar versiones con < de texto es un error clásico y aquí costaría caro.
 *
 * @returns {number} negativo si a < b, 0 si son iguales, positivo si a > b
 */
export function compararVersiones(a, b) {
  const partes = (v) => String(v ?? "").trim().split(".").map((n) => parseInt(n, 10) || 0);
  const pa = partes(a);
  const pb = partes(b);
  const largo = Math.max(pa.length, pb.length);
  for (let i = 0; i < largo; i++) {
    const diferencia = (pa[i] || 0) - (pb[i] || 0);
    if (diferencia !== 0) return diferencia;
  }
  return 0;
}

/**
 * Decide qué hacer con lo que dice el manifiesto publicado en GitHub Pages.
 *
 * @param {Object} opciones
 * @param {Object|null} opciones.manifiesto  lo que se bajó de internet, o null
 * @param {string} opciones.commitActual     el commit con el que se compiló lo
 *                                           que está corriendo ahora mismo
 * @param {string} opciones.versionNativa    versión del APK instalado ("3.4")
 * @returns {{accion: 'nada'|'descargar'|'exige-apk', motivo: string, url?: string, version?: string}}
 */
export function decidirActualizacion({ manifiesto, commitActual, versionNativa } = {}) {
  // En desarrollo el commit no existe. Actualizar una compilación local desde
  // internet sería reemplazar lo que se está probando: nunca.
  if (!commitActual || commitActual === "local") {
    return { accion: "nada", motivo: "compilación local: no se actualiza" };
  }

  // Sin internet, con el archivo caído o con basura en vez de JSON. No es un
  // error que haya que mostrar: la aplicación funciona igual.
  if (!manifiesto || typeof manifiesto !== "object") {
    return { accion: "nada", motivo: "no se pudo consultar" };
  }
  if (!manifiesto.commit || !manifiesto.url) {
    return { accion: "nada", motivo: "el manifiesto no trae commit o url" };
  }

  if (manifiesto.commit === commitActual) {
    return { accion: "nada", motivo: "ya está al día" };
  }

  // El freno de mano: si lo publicado necesita una APK más nueva que la
  // instalada, no se toca nada y se avisa.
  if (manifiesto.minNativo && compararVersiones(manifiesto.minNativo, versionNativa) > 0) {
    return {
      accion: "exige-apk",
      motivo:
        `Esta actualización necesita la APK ${manifiesto.minNativo} y este ` +
        `celular tiene la ${versionNativa || "desconocida"}. Hay que instalar ` +
        `el APK nuevo; no se puede actualizar por internet.`,
    };
  }

  return {
    accion: "descargar",
    motivo: `hay una versión nueva (${manifiesto.version || manifiesto.commit.slice(0, 7)})`,
    url: manifiesto.url,
    // El plugin identifica cada descarga por esta cadena. Se usa el commit
    // completo y no el número de versión: si alguien sube dos cambios sin
    // tocar el número, siguen siendo dos versiones distintas y el celular se
    // trae la segunda. Que actualizar dependa de acordarse de subir un número
    // a mano es justo lo que hay que evitar.
    version: `${manifiesto.version || "0.0.0"}-${manifiesto.commit.slice(0, 7)}`,
  };
}
