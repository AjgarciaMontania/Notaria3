// ─────────────────────────────────────────────────────────────────────────────
// Qué archivos hay que borrar de Storage al eliminar escrituras.
//
// Este archivo lo comparten la página web y la APK (alias @calculo), para que
// las dos borren exactamente lo mismo. Es lógica pura: decide QUÉ borrar, no
// borra nada. Cada aplicación lo borra con su propia conexión a Firebase.
//
// ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
// Borrar la escritura de Firestore no borra sus archivos. Antes, al eliminar
// una fila, el recibo de impuestos y el soporte de envío se quedaban en el
// bucket para siempre: nadie los veía en la aplicación, pero seguían ahí
// ocupando espacio de los 5 GB, apareciendo en los respaldos y —lo más
// delicado— abriéndose con el enlace de descarga para quien lo tuviera.
//
// ── LAS DOS CLASES DE ARCHIVO NO SE BORRAN IGUAL ────────────────────────────
//   · Recibo de impuestos (reciboPath): es de UNA escritura. Cada escritura
//     paga los suyos. Al borrarla, su recibo se va con ella.
//   · Soporte de envío (soportePath): UNO puede amparar VARIAS escrituras que
//     se enviaron juntas. Solo se borra si no queda ninguna otra usándolo; si
//     no, se estarían borrando el soporte de escrituras que siguen vivas.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devuelve las rutas de Storage que quedan huérfanas al borrar unas escrituras.
 *
 * @param {Array<Object>} aBorrar  las escrituras que se van a eliminar
 * @param {Array<Object>} todas    la lista completa, antes de borrar
 * @returns {string[]} rutas de Storage, sin repetidos
 */
export function archivosHuerfanos(aBorrar, todas = []) {
  const lista = Array.isArray(aBorrar) ? aBorrar.filter(Boolean) : [];
  if (lista.length === 0) return [];

  const seVan = new Set(lista.map((e) => e.id));
  const sobreviven = (Array.isArray(todas) ? todas : []).filter(
    (e) => e && !seVan.has(e.id)
  );

  const rutas = new Set();
  for (const escritura of lista) {
    // El recibo siempre se va con su escritura.
    if (escritura.reciboPath) rutas.add(escritura.reciboPath);

    // El soporte, solo si no queda nadie más usándolo.
    if (escritura.soportePath) {
      const loUsaOtra = sobreviven.some((e) => e.soportePath === escritura.soportePath);
      if (!loUsaOtra) rutas.add(escritura.soportePath);
    }
  }
  return [...rutas];
}
