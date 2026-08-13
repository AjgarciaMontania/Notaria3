// ─────────────────────────────────────────────────────────────────────────────
// QUIÉN PUEDE HACER QUÉ
//
// Este archivo lo comparten la página web y la APK del celular.
//
// Por ahora existe un único rol restringido: "solo liquidación". Una cuenta de
// esa lista entra a la APK y ve ÚNICAMENTE la pantalla de Liquidar: no puede
// abrir Evidencias ni Escrituras Pendientes, ni entrar a la página web.
//
// ⚠️ MUY IMPORTANTE
// Ocultar pantallas NO es seguridad: solo evita equivocaciones. Lo que de
// verdad bloquea el acceso son las reglas de Firebase.
//
// Por eso, cada vez que agregues o quites un correo aquí, tienes que hacer
// EXACTAMENTE el mismo cambio en la lista de las reglas y volver a publicarlas:
//
//   firebase/firestore.rules  → función esSoloLiquidacion()
//   firebase/storage.rules    → función esSoloLiquidacion()
//
// Si cambias solo este archivo, la persona dejará de ver las pestañas, pero
// sus permisos reales seguirán intactos.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Cuentas que únicamente pueden liquidar desde el celular.
 * Escribe los correos en minúscula, tal como se crearon en
 * console.firebase.google.com → Authentication → Users.
 */
export const CORREOS_SOLO_LIQUIDACION = [
  'liquidador@notaria.com',
];

/** ¿Este correo corresponde a una cuenta de solo liquidación? */
export function esSoloLiquidacion(correo) {
  if (!correo) return false;
  return CORREOS_SOLO_LIQUIDACION.includes(String(correo).trim().toLowerCase());
}
