// ─────────────────────────────────────────────────────────────────────────────
// ACTUALIZACIÓN AUTOMÁTICA DE LA APK
//
// La página web se actualiza sola al subir a GitHub. La APK, hasta ahora, no:
// había que compilar el APK y volver a instalarlo en cada celular.
//
// Con esto la APK se trae por internet la parte web —que es donde vive TODO:
// las pantallas, el motor de cálculo y las tarifas— y la reemplaza sola. Subir
// a GitHub actualiza las dos cosas.
//
// ── CÓMO FUNCIONA, EN CORTO ─────────────────────────────────────────────────
//   1. Al abrir, la aplicación avisa que arrancó bien (notifyAppReady).
//   2. Consulta un archivo pequeño en GitHub Pages: app/manifest.json.
//   3. Si el commit publicado no es el que está corriendo, baja el .zip.
//   4. Lo deja listo y avisa. Se aplica al volver a abrir la aplicación.
//
// ── POR QUÉ NO SE APLICA DE UNA ─────────────────────────────────────────────
// Aplicarlo en caliente recarga la pantalla de golpe. Si alguien está tomando
// una foto o llenando una escritura, pierde lo que iba haciendo. Se aplica al
// volver a abrir, y mientras tanto se ofrece un botón para reiniciar ya.
//
// ── LA RED DE SEGURIDAD ─────────────────────────────────────────────────────
// notifyAppReady() es lo que impide dejar todos los celulares con una
// aplicación rota: si una actualización no alcanza a arrancar y no avisa en
// appReadyTimeout, el plugin se devuelve SOLO a la versión anterior. Por eso
// se llama lo más temprano posible y sin condiciones.
//
// ── LO QUE ESTO NO PUEDE ACTUALIZAR ─────────────────────────────────────────
// La parte nativa: la cámara, los permisos, el plugin mismo. Eso vive dentro
// del APK. Cuando una versión necesita algo nativo nuevo, el manifiesto lo
// dice con `minNativo` y aquí se rechaza en vez de romper la aplicación.
// ─────────────────────────────────────────────────────────────────────────────
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor } from '@capacitor/core';
import { decidirActualizacion } from '@calculo/decidirActualizacion.js';

/** Dónde se publica el manifiesto. Es la misma página web de la notaría. */
export const URL_MANIFIESTO =
  'https://ajgarciamontania.github.io/Notaria3/app/manifest.json';

/**
 * El commit con el que se compiló lo que está corriendo AHORA.
 *
 * Lo inyecta vite al compilar (ver vite.config.js). En desarrollo vale
 * "local", y con eso la actualización se apaga sola.
 */
export const COMMIT_ACTUAL =
  typeof __COMMIT__ === 'string' ? __COMMIT__ : 'local';

/** Avisa que la aplicación arrancó bien. Si no se llama, el plugin se devuelve. */
export async function confirmarArranque() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await CapacitorUpdater.notifyAppReady();
  } catch (fallo) {
    // Que esto falle no debe impedir usar la aplicación.
    console.warn('No se pudo confirmar el arranque:', fallo?.message);
  }
}

/**
 * Busca, baja y deja lista una actualización.
 *
 * No lanza excepciones: una actualización que falla no puede impedir trabajar.
 * Todo lo que pasa se devuelve para poder mostrarlo.
 *
 * @param {(estado: {tipo: string, texto: string}) => void} avisar
 * @returns {Promise<{tipo: string, texto: string}>}
 */
export async function buscarActualizacion(avisar = () => {}) {
  if (!Capacitor.isNativePlatform()) {
    return { tipo: 'nada', texto: 'La página web se actualiza sola.' };
  }

  let versionNativa = '';
  try {
    const actual = await CapacitorUpdater.current();
    versionNativa = actual?.native || '';
  } catch {
    // Si ni siquiera se puede preguntar, mejor no tocar nada.
    return { tipo: 'nada', texto: 'No se pudo leer la versión instalada.' };
  }

  let manifiesto = null;
  try {
    // Sin caché: el manifiesto cambia con cada publicación y un archivo viejo
    // guardado por el celular dejaría la actualización sin llegar nunca.
    const respuesta = await fetch(`${URL_MANIFIESTO}?t=${Date.now()}`, { cache: 'no-store' });
    if (respuesta.ok) manifiesto = await respuesta.json();
  } catch {
    // Sin internet. No es un error que valga la pena mostrar.
  }

  const decision = decidirActualizacion({
    manifiesto,
    commitActual: COMMIT_ACTUAL,
    versionNativa,
  });

  if (decision.accion === 'nada') {
    return { tipo: 'nada', texto: decision.motivo };
  }

  if (decision.accion === 'exige-apk') {
    return { tipo: 'exige-apk', texto: decision.motivo };
  }

  // ── Descarga ────────────────────────────────────────────────────────────
  avisar({ tipo: 'bajando', texto: 'Bajando la actualización…' });
  try {
    const paquete = await CapacitorUpdater.download({
      url: decision.url,
      version: decision.version,
    });
    // set() no reemplaza nada ahora mismo: deja el paquete marcado para que
    // se use la próxima vez que la aplicación arranque.
    await CapacitorUpdater.set({ id: paquete.id });
    return {
      tipo: 'lista',
      texto: 'Actualización lista. Se aplica al volver a abrir la aplicación.',
    };
  } catch (fallo) {
    // Se dice qué pasó, en vez de quedarse callado: una actualización que
    // nunca llega y nadie sabe por qué es peor que un aviso.
    return {
      tipo: 'error',
      texto: `No se pudo actualizar: ${fallo?.message || 'error desconocido'}`,
    };
  }
}

/** Reinicia la aplicación para aplicar lo que ya se bajó. */
export async function aplicarAhora() {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await CapacitorUpdater.reload();
  } catch (fallo) {
    console.warn('No se pudo reiniciar:', fallo?.message);
  }
}
