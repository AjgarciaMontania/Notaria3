// ─────────────────────────────────────────────────────────────────────────────
// Clave de acceso de la aplicación.
//
// Debe ser LA MISMA que usa la página web (constante ADMIN_PASSWORD en App.jsx).
// Si la cambias en la web, cámbiala aquí y vuelve a generar el APK.
//
// AVISO DE SEGURIDAD: esta clave viaja dentro del APK. Cualquiera que
// descomprima el archivo puede leerla. Sirve para evitar que alguien que
// tome el celular prestado suba documentos, pero no protege el bucket de
// Firebase. Si más adelante quieres protección real, hay que activar
// Firebase Authentication y cerrar las reglas de Storage/Firestore.
// ─────────────────────────────────────────────────────────────────────────────
export const CLAVE_ACCESO = 'notaria2026';

// Minutos de inactividad tras los cuales la app pide la clave de nuevo.
export const MINUTOS_INACTIVIDAD = 30;

// Nombre de la notaría que se muestra en la cabecera.
export const NOMBRE_NOTARIA = 'Notaría Única de Cartagena del Chairá';
