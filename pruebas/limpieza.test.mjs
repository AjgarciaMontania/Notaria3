// Pruebas de la limpieza de archivos al borrar escrituras.
//
// SI UNA PRUEBA FALLA, NO LA CAMBIES PARA QUE PASE. Cada caso de aquí es una
// forma real de perder o de filtrar un documento de la notaría.
import test from "node:test";
import assert from "node:assert/strict";
import { archivosHuerfanos } from "../src/utils/limpiezaArchivos.js";

// Un envío con dos escrituras que comparten soporte, y una tercera aparte.
const BASE = [
  { id: "a", reciboPath: "recibos-registro/a-1.pdf", soportePath: "soportes-escrituras/envio-7.pdf" },
  { id: "b", reciboPath: "recibos-registro/b-1.pdf", soportePath: "soportes-escrituras/envio-7.pdf" },
  { id: "c", reciboPath: "recibos-registro/c-1.pdf" },
  { id: "d" },
];

test("el recibo de una escritura se va con ella", () => {
  const rutas = archivosHuerfanos([BASE[2]], BASE);
  assert.deepEqual(rutas, ["recibos-registro/c-1.pdf"]);
});

test("el soporte compartido NO se borra si otra escritura lo usa", () => {
  const rutas = archivosHuerfanos([BASE[0]], BASE);
  assert.deepEqual(rutas, ["recibos-registro/a-1.pdf"]);
  assert.ok(!rutas.includes("soportes-escrituras/envio-7.pdf"),
    "borrar el soporte dejaría a la escritura b sin su comprobante de envío");
});

test("el soporte sí se borra cuando se van todas las que lo usaban", () => {
  const rutas = archivosHuerfanos([BASE[0], BASE[1]], BASE);
  assert.deepEqual(rutas.sort(), [
    "recibos-registro/a-1.pdf",
    "recibos-registro/b-1.pdf",
    "soportes-escrituras/envio-7.pdf",
  ]);
});

test("el soporte compartido se cuenta una sola vez", () => {
  const rutas = archivosHuerfanos([BASE[0], BASE[1]], BASE);
  const veces = rutas.filter((r) => r === "soportes-escrituras/envio-7.pdf").length;
  assert.equal(veces, 1);
});

test("borrar TODA la base se lleva todos los archivos", () => {
  const rutas = archivosHuerfanos(BASE, BASE);
  assert.deepEqual(rutas.sort(), [
    "recibos-registro/a-1.pdf",
    "recibos-registro/b-1.pdf",
    "recibos-registro/c-1.pdf",
    "soportes-escrituras/envio-7.pdf",
  ]);
});

test("una escritura sin archivos no produce nada que borrar", () => {
  assert.deepEqual(archivosHuerfanos([BASE[3]], BASE), []);
});

test("aguanta listas vacías o mal formadas sin reventar", () => {
  assert.deepEqual(archivosHuerfanos([], BASE), []);
  assert.deepEqual(archivosHuerfanos(null, BASE), []);
  assert.deepEqual(archivosHuerfanos([null], BASE), []);
  assert.deepEqual(archivosHuerfanos([BASE[2]], undefined), ["recibos-registro/c-1.pdf"]);
});

test("si no se pasa la lista completa, el soporte compartido se borra igual", () => {
  // Sin saber quién más lo usa no se puede decidir bien. Se documenta el
  // comportamiento para que quien llame sepa que TIENE que pasar la lista.
  const rutas = archivosHuerfanos([BASE[0]], []);
  assert.ok(rutas.includes("soportes-escrituras/envio-7.pdf"));
});

test("un campo vacío no se toma por una ruta", () => {
  const rutas = archivosHuerfanos(
    [{ id: "x", reciboPath: "", soportePath: "" }],
    [{ id: "x", reciboPath: "", soportePath: "" }]
  );
  assert.deepEqual(rutas, []);
});
