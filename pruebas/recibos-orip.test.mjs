// ─────────────────────────────────────────────────────────────────────────────
// DERECHOS DE REGISTRO CONTRA LOS RECIBOS DE LA ORIP
//
// Cada caso sale de una "Solicitud Registro Documentos" de la Oficina de
// Registro de Instrumentos Publicos de Florencia, de la relacion de ingresos de
// 2026. Los valores son los que la ORIP cobro, no los que creemos que deberia
// cobrar.
//
// SI UNA PRUEBA FALLA, NO LA CAMBIES PARA QUE PASE. Cada numero esta respaldado
// por un recibo con su numero de radicacion.
//
// Lo que estas pruebas fijan:
//   - el derecho de cada acto con cuantia sale de la tabla de tramos y se
//     ajusta a la CENTENA acto por acto, no solo al final
//   - los actos sin cuantia cobran su tarifa fija multiplicada por el numero
//     de unidades (matriculas, folios, reproducciones)
//   - sobre el derecho se suma el 2% de conservacion documental y el total se
//     ajusta a la centena
//   - el certificado de tradicion de la hipoteca va POR FUERA del 2%
// ─────────────────────────────────────────────────────────────────────────────
import test from "node:test";
import assert from "node:assert/strict";
import { liquidar, calcOripBase } from "../src/utils/motorLiquidacion.js";
import { TARIFAS_BASE } from "../src/utils/tarifasConfig.js";

// ── El derecho de cada acto con cuantia ─────────────────────────────────────
// [radicacion o escritura, cuantia, derecho que cobro la ORIP]
const ACTOS_CON_CUANTIA = [
  ["esc 168 venta", 73000000, 665000],
  ["esc 085 venta", 40000000, 364400],
  ["esc 129 hipoteca", 70000000, 637700],
  ["esc 116 venta", 170000000, 1548700],
  ["esc 037 venta", 120000000, 1093200],
  ["esc 092 venta", 176000000, 1603400],
  ["esc 089 hipoteca", 17000000, 154900],
  ["esc 221 venta", 309000000, 3494800],
  ["esc 254 venta", 94000000, 856300],
  ["esc 179 venta a", 55000000, 501100],
  ["esc 179 venta b", 45000000, 410000],
  ["esc 066 hipoteca", 80000000, 728800],
  ["esc 208 venta", 147000000, 1339200],
  ["esc 232 venta", 25000000, 227800],
  ["esc 224 venta", 23000000, 209500],
  ["esc 223 venta", 23000000, 209500],
  ["esc 067 venta", 65000000, 592200],
  ["esc 121 venta", 80000000, 728800],
  ["cert 001 cancelacion hipoteca", 2000000, 53100],
  ["esc 231 donacion", 6360000, 53100],
];

for (const [id, cuantia, derecho] of ACTOS_CON_CUANTIA) {
  test(`derecho de registro · ${id}`, () => {
    assert.equal(calcOripBase(cuantia, TARIFAS_BASE), derecho);
  });
}

test("el derecho de cada acto se ajusta a la centena", () => {
  // Una venta de $73.000.000 da $665.030 exactos y la ORIP cobra $665.000.
  // Sin este ajuste los pesos sueltos se arrastran hasta el total y el
  // resultado queda $100 arriba o abajo del recibo.
  const derecho = calcOripBase(73000000, TARIFAS_BASE);
  assert.equal(derecho % 100, 0, "el derecho tiene que quedar en centenas");
  assert.equal(derecho, 665000);
});

// ── Actos sin cuantia: tarifa fija por unidad ───────────────────────────────
test("los actos sin cuantia cobran la tarifa fija por unidad", () => {
  const T = TARIFAS_BASE;
  assert.equal(T.sinCuantiaBase * 1, 29500, "cancelacion, division material: 1 unidad");
  assert.equal(T.sinCuantiaBase * 2, 59000, "resolucion con 2 cancelaciones");
  assert.equal(T.folioAdicional * 7, 107100, "7 matriculas nuevas");
  assert.equal(T.hipotecaConstancia * 1, 17300, "1 reproduccion de constancia");
  assert.equal(T.hipotecaConstancia * 5, 86500, "5 reproducciones");
});

// ── El recibo completo, como lo arma la pagina ──────────────────────────────
// [caso, actos tal como se digitan, total que cobro la ORIP]
const RECIBOS = [
  ["esc 168", [{ acto: "COMPRAVENTA", valorActo: "73000000" }], 678300],
  ["esc 085", [{ acto: "COMPRAVENTA", valorActo: "40000000" }], 371700],
  ["esc 116", [{ acto: "COMPRAVENTA", valorActo: "170000000" }], 1579700],
  ["esc 037", [{ acto: "COMPRAVENTA", valorActo: "120000000" }], 1115100],
  ["esc 092", [{ acto: "COMPRAVENTA", valorActo: "176000000" }], 1635500],
  ["esc 221", [{ acto: "COMPRAVENTA", valorActo: "309000000" }], 3564700],
  ["esc 254", [{ acto: "COMPRAVENTA", valorActo: "94000000" }], 873400],
  ["esc 232", [{ acto: "COMPRAVENTA", valorActo: "25000000" }], 232400],
  ["esc 223", [{ acto: "COMPRAVENTA", valorActo: "23000000" }], 213700],
  ["esc 121", [{ acto: "COMPRAVENTA", valorActo: "80000000" }], 743400],
  // Dos ventas en la misma escritura: aqui es donde se notaba el arrastre.
  ["esc 179 con dos ventas", [
    { acto: "COMPRAVENTA", valorActo: "55000000" },
    { acto: "COMPRAVENTA", valorActo: "45000000" },
  ], 929300],
  ["esc 208 cancelacion mas venta", [
    { acto: "ACTO SIN CUANTÍA", valorActo: "0" },
    { acto: "COMPRAVENTA", valorActo: "147000000" },
  ], 1396100],
  ["esc 067 cancelacion mas venta", [
    { acto: "ACTO SIN CUANTÍA", valorActo: "0" },
    { acto: "COMPRAVENTA", valorActo: "65000000" },
  ], 634100],
  ["resolucion 1150 sin cuantia", [{ acto: "ACTO SIN CUANTÍA", valorActo: "0" }], 30100],
  ["resolucion 1144 con dos cancelaciones", [
    { acto: "ACTO SIN CUANTÍA", valorActo: "0", numActos: 2 },
  ], 60200],
];

for (const [id, actos, total] of RECIBOS) {
  test(`recibo ORIP · ${id}`, () => {
    const r = liquidar(actos, { fechaPago: "2026-08-14" });
    const orip = r.actos.reduce((suma, a) => suma + (a.orip || 0), 0);
    assert.equal(orip, total, `${id}: la ORIP cobro ${total} y el motor da ${orip}`);
  });
}
