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

// ─── Orden por fecha de registro o de envío ──────────────────────────────────
//
// En "En registro" la primera de la lista es la que lleva más tiempo esperando
// en la ORIP, o sea la PRÓXIMA en salir. Si esto se invierte, se trabaja al
// revés: se atienden primero las que acaban de entrar.
import { ordenarPorFecha, CAMPO_FECHA_DEL_FILTRO } from '../src/utils/registro.js';

const R = (n, fecha) => ({ numeroEscritura: n, fechaRegistro: fecha });

test('la más antigua primero: la próxima en salir va de primera', () => {
  const orden = ordenarPorFecha([
    R('nueva', '2026-08-20T10:00:00Z'),
    R('vieja', '2026-01-05T10:00:00Z'),
    R('media', '2026-05-10T10:00:00Z'),
  ], 'fechaRegistro', 'asc');
  assert.deepEqual(orden.map((e) => e.numeroEscritura), ['vieja', 'media', 'nueva']);
});

test('al revés, la más reciente primero', () => {
  const orden = ordenarPorFecha([
    R('vieja', '2026-01-05T10:00:00Z'),
    R('nueva', '2026-08-20T10:00:00Z'),
  ], 'fechaRegistro', 'desc');
  assert.deepEqual(orden.map((e) => e.numeroEscritura), ['nueva', 'vieja']);
});

test('una escritura SIN fecha se va al final, mire como mire el orden', () => {
  // Sin fecha no se puede comparar. Colada de primera parecería la más
  // urgente sin serlo.
  const lista = [R('sin', ''), R('vieja', '2026-01-05T10:00:00Z'), R('nueva', '2026-08-20T10:00:00Z')];
  assert.equal(ordenarPorFecha(lista, 'fechaRegistro', 'asc').at(-1).numeroEscritura, 'sin');
  assert.equal(ordenarPorFecha(lista, 'fechaRegistro', 'desc').at(-1).numeroEscritura, 'sin');
});

test('NO revuelve el arreglo original', () => {
  // El original suele ser el estado de React: revolverlo haría que la lista y
  // los datos dejaran de coincidir.
  const lista = [R('b', '2026-08-20T10:00:00Z'), R('a', '2026-01-05T10:00:00Z')];
  const copia = [...lista];
  ordenarPorFecha(lista, 'fechaRegistro', 'asc');
  assert.deepEqual(lista, copia);
});

test('sin campo, se devuelve tal cual: pendientes no se reordenan', () => {
  const lista = [R('b', '2026-08-20T10:00:00Z'), R('a', '2026-01-05T10:00:00Z')];
  assert.equal(ordenarPorFecha(lista, null, 'asc'), lista);
  assert.equal(ordenarPorFecha(lista, CAMPO_FECHA_DEL_FILTRO.pendientes, 'asc'), lista);
});

test('cada filtro ordena por SU fecha', () => {
  assert.equal(CAMPO_FECHA_DEL_FILTRO.registro, 'fechaRegistro');
  assert.equal(CAMPO_FECHA_DEL_FILTRO.enviadas, 'fechaEnvio');
  assert.equal(CAMPO_FECHA_DEL_FILTRO.todas, undefined);
});

test('aguanta listas vacías y basura', () => {
  assert.deepEqual(ordenarPorFecha([], 'fechaRegistro', 'asc'), []);
  assert.deepEqual(ordenarPorFecha(undefined, 'fechaRegistro', 'asc'), []);
  assert.equal(ordenarPorFecha([null, R('a', '2026-01-05T10:00:00Z')], 'fechaRegistro', 'asc').length, 2);
});
