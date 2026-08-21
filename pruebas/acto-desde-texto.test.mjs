// Pruebas del reconocimiento del acto.
//
// SI UNA PRUEBA FALLA, NO LA CAMBIES PARA QUE PASE. El tipo de acto decide la
// tarifa: reconocer de mas es cobrar mal.
import test from "node:test";
import assert from "node:assert/strict";
import {
  tipoDeActo,
  sePuedeLiquidar,
  actosParaLiquidar,
  TIPOS_DE_ACTO,
  ACTOS_PARA_ESCRITURAS,
  esActoDeLaLista,
} from "../src/utils/actoDesdeTexto.js";

test("los once tipos se reconocen tal cual", () => {
  assert.equal(TIPOS_DE_ACTO.length, 11);
  for (const t of TIPOS_DE_ACTO) assert.equal(tipoDeActo(t), t);
});

test("no importan mayusculas, tildes ni espacios de mas", () => {
  assert.equal(tipoDeActo("compraventa"), "COMPRAVENTA");
  assert.equal(tipoDeActo("  Compraventa  "), "COMPRAVENTA");
  assert.equal(tipoDeActo("sucesion"), "SUCESIÓN");
  assert.equal(tipoDeActo("SUCESION"), "SUCESIÓN");
  assert.equal(tipoDeActo("Donacion  Particular"), "DONACIÓN PARTICULAR");
  assert.equal(tipoDeActo("acto sin cuantia"), "ACTO SIN CUANTÍA");
});

test("NO adivina con textos parecidos", () => {
  // Esto es lo importante de todo el archivo: confundir un acto con otro
  // cambia la tarifa. Ante la duda, no se reconoce.
  for (const texto of ["VENTA", "COMPRA VENTA", "VENTAS REGISTRO", "COMPRAVENTAS",
                       "HIPOTECA", "DONACION", "CANCELACION", "PERMUTAS"]) {
    assert.equal(tipoDeActo(texto), null, `"${texto}" no deberia reconocerse`);
  }
});

test("aguanta vacios y basura", () => {
  for (const v of ["", null, undefined, 0, {}, []]) assert.equal(tipoDeActo(v), null);
  assert.equal(sePuedeLiquidar(""), false);
  assert.equal(sePuedeLiquidar("COMPRAVENTA"), true);
});

test("arma los actos y aparta los que no se reconocen", () => {
  const { actos, sinTipo } = actosParaLiquidar([
    { id: "a", acto: "COMPRAVENTA", numeroEscritura: "147", fechaEscritura: "2026-08-14", valorActo: 60000000 },
    { id: "b", acto: "VENTA", numeroEscritura: "148", fechaEscritura: "2026-08-14", valorActo: 10000000 },
    { id: "c", acto: "sucesion", numeroEscritura: "149", fechaEscritura: "2026-08-15" },
  ]);
  assert.equal(actos.length, 2);
  assert.equal(sinTipo.length, 1);
  assert.equal(sinTipo[0].numeroEscritura, "148");
  assert.equal(actos[0].acto, "COMPRAVENTA");
  assert.equal(actos[0].valorActo, "60.000.000", "el valor debe salir con puntos de miles");
  assert.equal(actos[1].acto, "SUCESIÓN");
});

test("la escritura sin valor entra en blanco, no se inventa un numero", () => {
  const { actos } = actosParaLiquidar([
    { id: "c", acto: "COMPRAVENTA", numeroEscritura: "150", fechaEscritura: "2026-08-15" },
  ]);
  assert.equal(actos[0].valorActo, "");
});

test("conserva el numero y la fecha, que son lo que la mora necesita", () => {
  const { actos } = actosParaLiquidar([
    { id: "d", acto: "COMPRAVENTA", numeroEscritura: " 168 ", fechaEscritura: "2024-08-08", valorActo: 73000000 },
  ]);
  assert.equal(actos[0].numeroEscritura, "168");
  assert.equal(actos[0].fechaEscritura, "2024-08-08");
});

test("una lista vacia o mal formada no revienta", () => {
  assert.deepEqual(actosParaLiquidar([]), { actos: [], sinTipo: [] });
  assert.deepEqual(actosParaLiquidar(), { actos: [], sinTipo: [] });
  assert.deepEqual(actosParaLiquidar([null, undefined]), { actos: [], sinTipo: [] });
});

// ── Actos que se registran pero todavia no se liquidan ──────────────────────
test("la constitucion de patrimonio de familia se puede REGISTRAR", () => {
  assert.ok(ACTOS_PARA_ESCRITURAS.includes("CONSTITUCIÓN PATRIMONIO DE FAMILIA"));
  assert.equal(esActoDeLaLista("CONSTITUCIÓN PATRIMONIO DE FAMILIA"), true);
  assert.equal(esActoDeLaLista("constitucion patrimonio de familia"), true);
});

test("pero NO se liquida: no hay recibo que respalde su tarifa", () => {
  // Si algun dia esto falla porque alguien la metio a actosConfig.js, que sea
  // porque apareció un recibo. No por conveniencia.
  assert.equal(sePuedeLiquidar("CONSTITUCIÓN PATRIMONIO DE FAMILIA"), false);
  assert.equal(tipoDeActo("CONSTITUCIÓN PATRIMONIO DE FAMILIA"), null);
  assert.ok(!TIPOS_DE_ACTO.includes("CONSTITUCIÓN PATRIMONIO DE FAMILIA"));
});

test("al liquidar queda apartada y avisada, no en cero", () => {
  const { actos, sinTipo } = actosParaLiquidar([
    { id: "p", acto: "CONSTITUCIÓN PATRIMONIO DE FAMILIA", numeroEscritura: "200", fechaEscritura: "2026-08-20" },
    { id: "q", acto: "COMPRAVENTA", numeroEscritura: "201", fechaEscritura: "2026-08-20", valorActo: 50000000 },
  ]);
  assert.equal(actos.length, 1, "solo la compraventa se liquida");
  assert.equal(sinTipo.length, 1);
  assert.equal(sinTipo[0].numeroEscritura, "200");
});

test("un acto escrito a mano NO es lo mismo que uno de la lista sin tarifa", () => {
  assert.equal(esActoDeLaLista("CUALQUIER COSA"), false);
  assert.equal(esActoDeLaLista("CONSTITUCIÓN PATRIMONIO DE FAMILIA"), true);
});
