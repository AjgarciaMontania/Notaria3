// ─────────────────────────────────────────────────────────────────────────────
// Ajustes generales de la aplicación.
//
// Ya NO hay clave escrita en el código: cada persona entra con su propia
// cuenta de Firebase (correo y contraseña). Las cuentas se crean desde
// console.firebase.google.com → Authentication → Users.
// ─────────────────────────────────────────────────────────────────────────────

// El plazo de inactividad vive en utils/configuracion.js, compartido con la
// página web, para que los dos cierren la sesión a los mismos minutos.
export { MINUTOS_INACTIVIDAD } from '@calculo/configuracion.js';

// Versión que se muestra en la pantalla de acceso, para saber de un vistazo
// qué APK tiene instalada cada celular. Debe coincidir con versionName en
// android/app/build.gradle.
export const VERSION_APP = '3.4';

// Nombre de la notaría que se muestra en la pantalla de acceso.
export const NOMBRE_NOTARIA = 'Notaría Única de Cartagena del Chairá';
