// ─────────────────────────────────────────────────────────────────────────────
// Ajustes generales de la aplicación.
//
// Ya NO hay clave escrita en el código: cada persona entra con su propia
// cuenta de Firebase (correo y contraseña). Las cuentas se crean desde
// console.firebase.google.com → Authentication → Users.
// ─────────────────────────────────────────────────────────────────────────────

// Minutos de inactividad tras los cuales la app cierra la sesión.
//
// Se cuentan de verdad: la hora de la última actividad queda guardada en el
// teléfono, así que el plazo sigue corriendo aunque la app esté cerrada o se
// instale una actualización encima. Ver lib/inactividad.js.
export const MINUTOS_INACTIVIDAD = 10;

// Versión que se muestra en la pantalla de acceso, para saber de un vistazo
// qué APK tiene instalada cada celular. Debe coincidir con versionName en
// android/app/build.gradle.
export const VERSION_APP = '2.4';

// Nombre de la notaría que se muestra en la pantalla de acceso.
export const NOMBRE_NOTARIA = 'Notaría Única de Cartagena del Chairá';
