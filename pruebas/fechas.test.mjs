// Pruebas de las fechas de registro, EN LA HORA DE COLOMBIA.
//
// Se fija el huso horario antes de cargar nada: el error que estas pruebas
// vigilan solo aparece al oeste de Londres, así que corriendo en UTC pasarían
// aunque el código estuviera mal.
//
// SI UNA PRUEBA FALLA, NO LA CAMBIES PARA QUE PASE. Una fecha corrida un día
// adelanta el contador de la ORIP y hace saltar avisos de demora falsos.
process.env.TZ = "America/Bogota";

import test from "node:test";
import assert from "node:assert/strict";
import {
  aFechaLocal,
  desdeFechaLocal,
  hoyLocal,
  diasHabilesDesde,
} from "../src/utils/registro.js";

test("el huso horario de la prueba es el de Colombia", () => {
  assert.equal(new Date("2026-08-10T12:00:00").getTimezoneOffset(), 300);
});

test("guardar una fecha y volverla a leer da la misma fecha", () => {
  for (const dia of ["2026-01-01", "2026-08-10", "2026-12-31", "2026-02-28"]) {
    assert.equal(aFechaLocal(desdeFechaLocal(dia)), dia, `se corrió el día ${dia}`);
  }
});

test("la fecha NO se corre un día hacia atrás", () => {
  // Esto es lo que pasaba al guardar "2026-08-10" tal cual: en Colombia se
  // leía como 9 de agosto.
  const malo = new Date("2026-08-10");
  assert.equal(malo.getDate(), 9, "el problema que se está evitando");

  const bueno = new Date(desdeFechaLocal("2026-08-10"));
  assert.equal(bueno.getDate(), 10);
  assert.equal(bueno.getMonth(), 7);
  assert.equal(bueno.getFullYear(), 2026);
});

test("los días hábiles se cuentan desde la fecha escrita, no desde la de al lado", () => {
  // Del lunes 10 al viernes 14 de agosto de 2026 hay 4 días hábiles.
  const lunes = desdeFechaLocal("2026-08-10");
  const viernes = new Date(desdeFechaLocal("2026-08-14"));
  assert.equal(diasHabilesDesde(lunes, viernes), 4);
});

test("un recibo pagado la semana pasada cuenta esos días", () => {
  // Es justo el caso de la notaría: se paga el martes y se adjunta el lunes
  // siguiente. Deben aparecer los días corridos, no cero.
  const pago = desdeFechaLocal("2026-08-04");        // martes
  const hoy = new Date(desdeFechaLocal("2026-08-10")); // lunes siguiente
  assert.equal(diasHabilesDesde(pago, hoy), 4);
});

test("hoyLocal da el día de hoy en Colombia", () => {
  // A las 8 de la noche del 10 en Colombia, en Londres ya es el 11. Debe
  // seguir diciendo 10.
  assert.equal(hoyLocal(new Date("2026-08-11T01:30:00.000Z")), "2026-08-10");
});

test("aguanta vacíos y basura sin reventar", () => {
  assert.equal(aFechaLocal(""), "");
  assert.equal(aFechaLocal(null), "");
  assert.equal(aFechaLocal("no es una fecha"), "");
  assert.equal(desdeFechaLocal(""), "");
  assert.equal(desdeFechaLocal("31/12/2026"), "");
});

test("una fecha guardada por el sistema viejo se sigue leyendo bien", () => {
  // Las que ya están en la base se grabaron con new Date().toISOString().
  const vieja = "2026-08-10T15:04:05.000Z";   // 10 de agosto, 10:04 a.m. en Colombia
  assert.equal(aFechaLocal(vieja), "2026-08-10");
});
