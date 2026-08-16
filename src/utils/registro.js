// ─────────────────────────────────────────────────────────────────────────────
// ESTADO DE REGISTRO DE UNA ESCRITURA
//
// Lo comparten la página web y la APK del celular, para que las dos cuenten
// los días igual y pinten los mismos estados. Aquí no hay nada de Firebase:
// es lógica pura y se puede probar sola.
//
// El recorrido de una escritura es:
//
//   1. Pendiente ................ nada todavía
//   2. Pagada y en registro ..... se pagaron los impuestos y la ORIP la radicó.
//                                 Suele demorarse unos 15 días hábiles.
//   3. Registrada y enviada ..... ya salió y se envió a la notaría.
// ─────────────────────────────────────────────────────────────────────────────

/** Días hábiles que suele demorarse la ORIP en sacar una escritura. */
export const DIAS_HABILES_REGISTRO = 15;

// ── FECHAS ───────────────────────────────────────────────────────────────────
// Las fechas se guardan en formato ISO completo, pero los campos de fecha de la
// pantalla trabajan con "AAAA-MM-DD". Estas dos funciones traducen entre lo uno
// y lo otro sin que la fecha se corra de día.

/** Pasa una fecha guardada a "AAAA-MM-DD", que es lo que lee un campo de fecha. */
export function aFechaLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

/**
 * Pasa un "AAAA-MM-DD" a la fecha ISO que se guarda.
 *
 * ⚠️ SE FIJA EL MEDIODÍA A PROPÓSITO. new Date("2026-08-10") se entiende como
 * medianoche en Londres, que en Colombia (UTC−5) es el 9 de agosto a las 7 de
 * la noche: la fecha se correría UN DÍA HACIA ATRÁS y el contador de días
 * hábiles empezaría antes de tiempo, avisando de demoras que no existen.
 * Al mediodía no hay huso horario que la mueva de día.
 */
export function desdeFechaLocal(ymd) {
  if (!ymd) return "";
  const d = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString();
}

/** El día de hoy en "AAAA-MM-DD", para dejarlo puesto en los campos de fecha. */
export function hoyLocal(ahora = new Date()) {
  return aFechaLocal(ahora.toISOString());
}

/**
 * Días hábiles transcurridos desde una fecha, sin contar sábados ni domingos.
 *
 * No descuenta festivos: es una guía para saber cuánto lleva esperando una
 * escritura, no una fecha exacta de salida.
 */
export function diasHabilesDesde(iso, hasta = new Date()) {
  if (!iso) return 0;
  const desde = new Date(iso);
  if (Number.isNaN(desde.getTime())) return 0;

  let dias = 0;
  const cursor = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  const fin = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());

  while (cursor < fin) {
    cursor.setDate(cursor.getDate() + 1);
    const diaSemana = cursor.getDay();
    if (diaSemana !== 0 && diaSemana !== 6) dias++;
  }
  return dias;
}

/** En qué punto del recorrido está: "enviada", "en-registro" o "pendiente". */
export function estadoEscritura(escritura) {
  if (escritura?.enviado) return "enviada";
  if (escritura?.enRegistro) return "en-registro";
  return "pendiente";
}

/**
 * ¿Lleva más tiempo del habitual en registro?
 * Solo tiene sentido mientras siga en registro: si ya se envió, salió de la
 * ORIP y avisar de una demora sería engañoso.
 */
export function registroDemorado(escritura, hasta = new Date()) {
  if (estadoEscritura(escritura) !== "en-registro") return false;
  return diasHabilesDesde(escritura.fechaRegistro, hasta) > DIAS_HABILES_REGISTRO;
}
