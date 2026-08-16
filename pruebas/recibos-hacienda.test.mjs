// --------------------------------------------------------------------------
// MORA CONTRA LOS RECIBOS DE VERDAD
//
// Cada caso de aqui sale de un recibo de impuesto de registro de la Secretaria
// de Hacienda del Caqueta, de las relaciones de ingresos de 2025 y 2026. La
// columna mora es lo que la Gobernacion COBRO, no lo que creemos que deberia
// cobrar.
//
// SI UNA PRUEBA FALLA, NO LA CAMBIES PARA QUE PASE. Cada numero esta respaldado
// por un recibo. Si el motor deja de coincidir, el que se equivoco es el motor.
//
// Lo que estas pruebas fijan:
//   - la mora corre desde los 2 meses de la escritura hasta el dia del pago
//   - cada dia usa la usura de SU mes menos 2 puntos (E.T. art. 635)
//   - el resultado se redondea al MIL mas cercano, para arriba o para abajo
//   - si hay dias vencidos, nunca se cobra cero: el minimo es $1.000
//
// NO ESTAN AQUI 7 recibos de 2025 (escrituras 28, 75, 96, 105, 221, 307 y 0697)
// en los que la Gobernacion cobro MENOS que este calculo: el 20%, el 40% o el
// 70% del interes completo, en escalera segun el mes en que se pago.
//
// La causa esta confirmada por la notaria: en 2025 hubo un alivio tributario
// departamental. Ya no esta vigente, y por eso los recibos de 2026 coinciden
// exactos, incluida la escritura 121 con 1.116 dias de mora.
//
// Por eso quedan fuera: un descuento temporal no es la formula. Si vuelve a
// haber un alivio, se aplica como un descuento aparte sobre la mora calculada.
// Meter esos 7 aqui obligaria a torcer el calculo para que cuadre con una
// rebaja que ya se acabo, y el sistema quedaria cobrando de menos para siempre.
// --------------------------------------------------------------------------
import test from "node:test";
import assert from "node:assert/strict";
import { calcularMoraEscritura } from "../src/utils/motorLiquidacion.js";

const RECIBOS = [
  { id: "2025 esc 70", fechaEscritura: "2025-05-16", tributaria: 180000, fechaPago: "2025-08-15", mora: 3000 },
  { id: "2025 esc 72", fechaEscritura: "2025-05-16", tributaria: 160000, fechaPago: "2025-08-15", mora: 3000 },
  { id: "2025 esc 40", fechaEscritura: "2025-04-03", tributaria: 1000000, fechaPago: "2025-08-15", mora: 46000 },
  { id: "2025 esc 69", fechaEscritura: "2025-05-15", tributaria: 965000, fechaPago: "2025-07-18", mora: 2000 },
  { id: "2025 esc 56", fechaEscritura: "2025-05-05", tributaria: 450000, fechaPago: "2025-07-16", mora: 3000 },
  { id: "2025 esc 02", fechaEscritura: "2025-03-11", tributaria: 189800, fechaPago: "2025-11-05", mora: 21000 },
  { id: "2025 esc 79", fechaEscritura: "2025-05-22", tributaria: 200000, fechaPago: "2025-11-05", mora: 13000 },
  { id: "2025 esc 36", fechaEscritura: "2025-04-01", tributaria: 600000, fechaPago: "2025-10-10", mora: 50000 },
  { id: "2025 esc 102", fechaEscritura: "2025-06-24", tributaria: 1140000, fechaPago: "2025-10-03", mora: 29000 },
  { id: "2025 esc 61", fechaEscritura: "2025-05-09", tributaria: 1471000, fechaPago: "2025-10-03", mora: 80000 },
  { id: "2025 esc 84", fechaEscritura: "2025-05-29", tributaria: 300000, fechaPago: "2025-10-03", mora: 13000 },
  { id: "2025 esc 122", fechaEscritura: "2025-07-23", tributaria: 100000, fechaPago: "2025-09-30", mora: 1000 },
  { id: "2025 esc 87", fechaEscritura: "2025-06-04", tributaria: 189800, fechaPago: "2025-09-19", mora: 6000 },
  { id: "2025 esc 99", fechaEscritura: "2025-06-20", tributaria: 189800, fechaPago: "2025-09-05", mora: 2000 },
  { id: "2025 esc 184", fechaEscritura: "2025-10-01", tributaria: 530000, fechaPago: "2025-12-05", mora: 1000 },
  { id: "2026 esc 168", fechaEscritura: "2024-08-08", tributaria: 730000, fechaPago: "2026-08-13", mora: 324000 },
  { id: "2026 acta 1150", fechaEscritura: "2025-10-06", tributaria: 233500, fechaPago: "2026-07-30", mora: 37000 },
  { id: "2026 esc 254", fechaEscritura: "2025-12-19", tributaria: 940000, fechaPago: "2026-07-16", mora: 96000 },
  { id: "2026 esc 001", fechaEscritura: "2026-03-05", tributaria: 233500, fechaPago: "2026-07-14", mora: 12000 },
  { id: "2026 esc 179", fechaEscritura: "2025-09-25", tributaria: 1000000, fechaPago: "2026-06-10", mora: 129000 },
  { id: "2026 acta 1048", fechaEscritura: "2025-09-16", tributaria: 233500, fechaPago: "2026-06-05", mora: 31000 },
  { id: "2026 acta 1144", fechaEscritura: "2025-10-06", tributaria: 233500, fechaPago: "2026-06-05", mora: 28000 },
  { id: "2026 esc 231", fechaEscritura: "2025-12-01", tributaria: 31800, fechaPago: "2026-06-05", mora: 3000 },
  { id: "2026 esc 208", fechaEscritura: "2025-11-06", tributaria: 1703500, fechaPago: "2026-05-26", mora: 157000 },
  { id: "2026 esc 232", fechaEscritura: "2025-12-04", tributaria: 250000, fechaPago: "2026-05-21", mora: 18000 },
  { id: "2026 esc 224", fechaEscritura: "2025-11-25", tributaria: 1383500, fechaPago: "2026-02-24", mora: 26000 },
  { id: "2026 esc 223", fechaEscritura: "2025-11-21", tributaria: 230000, fechaPago: "2026-02-24", mora: 5000 },
  { id: "2026 esc 121", fechaEscritura: "2023-05-25", tributaria: 800000, fechaPago: "2026-08-14", mora: 673000 },
  { id: "2026 esc 67", fechaEscritura: "2026-05-21", tributaria: 883500, fechaPago: "2026-08-14", mora: 16000 },
  { id: "2026 acta 1468", fechaEscritura: "2025-11-27", tributaria: 233500, fechaPago: "2026-08-14", mora: 32000 },
  { id: "2026 esc 221", fechaEscritura: "2025-11-19", tributaria: 3090000, fechaPago: "2026-07-22", mora: 389000 },
  { id: "2025 esc 108 (sin mora)", fechaEscritura: "2025-07-01", tributaria: 180000, fechaPago: "2025-07-18", mora: 0 },
  { id: "2025 esc 214 (sin mora)", fechaEscritura: "2025-11-11", tributaria: 615000, fechaPago: "2025-11-20", mora: 0 },
  { id: "2025 esc 202 (sin mora)", fechaEscritura: "2025-10-23", tributaria: 2640000, fechaPago: "2025-11-11", mora: 0 },
  { id: "2026 esc 85 (sin mora)", fechaEscritura: "2026-06-16", tributaria: 400000, fechaPago: "2026-08-12", mora: 0 },
  { id: "2026 esc 129 (sin mora)", fechaEscritura: "2026-07-30", tributaria: 350000, fechaPago: "2026-08-12", mora: 0 },
  { id: "2026 esc 66 (sin mora)", fechaEscritura: "2026-05-21", tributaria: 400000, fechaPago: "2026-06-05", mora: 0 },
  { id: "2025 esc 151 (sin mora)", fechaEscritura: "2025-09-03", tributaria: 949800, fechaPago: "2025-09-18", mora: 0 },
  { id: "2025 esc 113 (sin mora)", fechaEscritura: "2025-07-14", tributaria: 789800, fechaPago: "2025-09-02", mora: 0 },
];

for (const r of RECIBOS) {
  test(`recibo ${r.id}`, () => {
    const calculado = calcularMoraEscritura(r.fechaEscritura, r.tributaria, r.fechaPago, {
      tasasHistoricas: {},
    });
    assert.equal(
      calculado.mora,
      r.mora,
      `${r.id}: la Gobernacion cobro ${r.mora} y el motor da ${calculado.mora}`
    );
  });
}

test("con dias vencidos nunca se cobra cero: el minimo es $1.000", () => {
  // Escritura 122: 7 dias de mora sobre $100.000 dan $441 exactos, que al
  // redondear serian $0. El recibo del 30/09/2025 cobro $1.000.
  const r = calcularMoraEscritura("2025-07-23", 100000, "2025-09-30", { tasasHistoricas: {} });
  assert.ok(r.moraExacta > 0 && r.moraExacta < 500);
  assert.equal(r.mora, 1000);
});

test("sin dias vencidos no se cobra nada", () => {
  // Escritura 108 del 01/07/2025, pagada el 18/07/2025: dentro del plazo.
  const r = calcularMoraEscritura("2025-07-01", 180000, "2025-07-18", { tasasHistoricas: {} });
  assert.equal(r.diasVencidos, 0);
  assert.equal(r.mora, 0);
});
