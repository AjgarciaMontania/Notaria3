// ─────────────────────────────────────────────────────────────────────────────
// CIERRE DE SESIÓN POR INACTIVIDAD — que funcione de verdad
//
// Antes esto era un setTimeout de 30 minutos. En Android eso solo corre
// mientras la app está viva en memoria: al cerrarla, al matarla desde la lista
// de aplicaciones recientes o al instalar una actualización, el temporizador
// desaparece y nunca llega a ejecutarse. Firebase, por su parte, guarda la
// sesión en el disco del teléfono y la restaura al abrir. Resultado: la sesión
// no se cerraba nunca.
//
// La solución es no confiar en un temporizador, sino guardar la HORA de la
// última actividad en el disco y compararla contra el reloj cada vez que la
// app arranca o vuelve del segundo plano.
// ─────────────────────────────────────────────────────────────────────────────

const CLAVE = 'notaria.ultimaActividad';

/** Deja constancia de que la persona sigue usando la app. */
export function marcarActividad() {
  try {
    localStorage.setItem(CLAVE, String(Date.now()));
  } catch {
    // Si el almacenamiento falla, sesionExpirada() cerrará la sesión por
    // precaución: preferimos pedir la contraseña de más que de menos.
  }
}

/**
 * ¿Ya pasó el tiempo permitido sin actividad?
 *
 * Si no hay ninguna marca guardada devuelve TRUE, no false. Es deliberado:
 * una sesión restaurada de la que no sabemos cuándo se usó por última vez se
 * trata como vencida. Vale más pedir la contraseña de sobra que dejar abierta
 * la sesión de alguien en un teléfono compartido.
 */
export function sesionExpirada(minutos) {
  try {
    const guardado = Number(localStorage.getItem(CLAVE));
    if (!guardado || Number.isNaN(guardado)) return true;
    // Reloj movido hacia atrás (cambio de hora, viaje): se trata como vencida.
    if (guardado > Date.now()) return true;
    return Date.now() - guardado > minutos * 60 * 1000;
  } catch {
    return true;
  }
}

/** Borra la marca al cerrar sesión a propósito. */
export function olvidarActividad() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* nada que hacer */
  }
}
