// ─────────────────────────────────────────────────────────────────────────────
// AJUSTES COMPARTIDOS entre la página web y la APK del celular.
//
// Lo que esté aquí vale para los dos. Antes el cierre de sesión estaba escrito
// por separado —5 minutos en la web, 10 en el celular— y nadie sabía cuál era
// el bueno.
// ─────────────────────────────────────────────────────────────────────────────

/** Minutos sin actividad tras los cuales se cierra la sesión, en ambos lados. */
export const MINUTOS_INACTIVIDAD = 10;
