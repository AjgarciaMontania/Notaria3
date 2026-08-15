// ─────────────────────────────────────────────────────────────────────────────
// ROLES — quién puede hacer qué
//
// Este archivo lo comparten la página web y la APK del celular.
//
// Los roles ya NO se escriben en el código: se administran desde la página,
// en el panel "Usuarios", y se guardan en Firestore, en la colección
// "usuarios", un documento por correo:
//
//   usuarios/juan@notaria.com  →  { rol: "personal", nombre: "Juan Pérez", ... }
//
// ⚠️ Ocultar botones NO es seguridad. Lo que de verdad bloquea el acceso son
// las reglas de Firebase (firebase/firestore.rules y firebase/storage.rules),
// que leen esta misma colección. Este archivo solo decide qué se DIBUJA.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Administrador raíz. Siempre tiene el rol más alto, aunque no exista su ficha
 * en Firestore y aunque alguien se la borre por error.
 *
 * Es la llave maestra: garantiza que nunca quedes fuera de tu propio sistema.
 * Está escrito también en las dos reglas de Firebase; si algún día cambia,
 * hay que cambiarlo en los tres sitios.
 */
export const CORREO_ADMIN_RAIZ = 'cha1@outlook.es';

export const ROLES = {
  ADMIN: 'admin',
  PERSONAL: 'personal',
  LIQUIDADOR: 'liquidador',
};

/**
 * Rol de quien todavía no tiene ficha asignada.
 *
 * Es el más restringido a propósito: una cuenta nueva nace sin poder ver nada
 * de la notaría, y es el administrador quien decide darle más. Así, si alguien
 * crea una cuenta en Firebase y olvida asignarle rol, no obtiene acceso.
 */
export const ROL_POR_DEFECTO = ROLES.LIQUIDADOR;

/** Nombres y descripciones que se muestran en el panel. */
export const ETIQUETAS_ROL = {
  [ROLES.ADMIN]: {
    nombre: 'Administrador',
    detalle: 'Todo, incluido repartir roles a los demás.',
  },
  [ROLES.PERSONAL]: {
    nombre: 'Personal',
    detalle: 'Evidencias, escrituras y tasas. No reparte roles.',
  },
  [ROLES.LIQUIDADOR]: {
    nombre: 'Invitado (solo liquidar)',
    detalle: 'Únicamente la liquidación en el celular.',
  },
};

/** El correo en minúscula y sin espacios: así se guarda y así se compara. */
export function normalizarCorreo(correo) {
  return String(correo ?? '').trim().toLowerCase();
}

export function esAdminRaiz(correo) {
  return normalizarCorreo(correo) === CORREO_ADMIN_RAIZ;
}

/**
 * Rol efectivo de una cuenta.
 *
 * @param {string} correo
 * @param {Object|null} ficha  documento de usuarios/{correo}, o null si no existe
 */
export function rolDe(correo, ficha) {
  if (!correo) return null;
  if (esAdminRaiz(correo)) return ROLES.ADMIN;
  const rol = ficha?.rol;
  return Object.values(ROLES).includes(rol) ? rol : ROL_POR_DEFECTO;
}

/** ¿Puede entrar al panel de usuarios y repartir roles? */
export function puedeAdministrarUsuarios(rol) {
  return rol === ROLES.ADMIN;
}

/** ¿Puede trabajar con evidencias, escrituras y tasas? */
export function puedeOperar(rol) {
  return rol === ROLES.ADMIN || rol === ROLES.PERSONAL;
}

/** ¿Es una cuenta que solo liquida (y por tanto solo sirve en la APK)? */
export function soloPuedeLiquidar(rol) {
  return rol === ROLES.LIQUIDADOR;
}

// ─────────────────────────────────────────────────────────────────────────────
// INGRESO CON NOMBRE DE USUARIO
//
// Firebase Authentication con correo y contraseña exige un texto con FORMA de
// correo: no acepta "AlvaroArias" a secas. Pero sí acepta cualquier correo bien
// formado aunque el dominio no exista, porque nunca envía ningún mensaje.
//
// Así que quien entra escribe solo su nombre de usuario y la app le agrega este
// dominio por dentro. Nadie ve el dominio en pantalla.
//
// Las cuentas con correo real siguen funcionando: si lo escrito trae "@", se
// respeta tal cual.
//
// ⚠️ Consecuencia a tener presente: estos usuarios NO pueden restablecer su
// contraseña por correo, porque no hay buzón al que escribir. El administrador
// se las cambia desde console.firebase.google.com → Authentication → Users.
// ─────────────────────────────────────────────────────────────────────────────

export const DOMINIO_INTERNO = 'cartagena.com';

/**
 * Convierte lo que la persona escribió en el correo que entiende Firebase.
 *
 *   "AlvaroArias"        → "alvaroarias@cartagena.com"
 *   "alvaro arias"       → "alvaroarias@cartagena.com"
 *   "cha1@outlook.es"    → "cha1@outlook.es"   (se respeta el correo real)
 */
export function aCorreo(entrada) {
  const texto = String(entrada ?? '').trim();
  if (!texto) return '';
  if (texto.includes('@')) return texto.toLowerCase();

  // Se dejan solo caracteres válidos para la parte antes del arroba.
  const limpio = texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita tildes: Álvaro → Alvaro
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '');

  return limpio ? `${limpio}@${DOMINIO_INTERNO}` : '';
}

/**
 * Lo contrario, para mostrar en pantalla:
 *   "alvaroarias@cartagena.com" → "alvaroarias"
 *   "cha1@outlook.es"           → "cha1@outlook.es"
 */
export function aNombreVisible(correo) {
  const c = normalizarCorreo(correo);
  if (!c) return '';
  const sufijo = `@${DOMINIO_INTERNO}`;
  return c.endsWith(sufijo) ? c.slice(0, -sufijo.length) : c;
}

/** ¿Es una cuenta de usuario interno (sin correo real)? */
export function esUsuarioInterno(correo) {
  return normalizarCorreo(correo).endsWith(`@${DOMINIO_INTERNO}`);
}
