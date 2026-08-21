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
  ACTOS_SIN_TARIFA,
  esActoDeLaLista,
} from "../src/utils/actoDesdeTexto.js";

test("los doce tipos se reconocen tal cual", () => {
  assert.equal(TIPOS_DE_ACTO.length, 12);
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

// ── Constitucion de patrimonio de familia ───────────────────────────────────
// Estuvo apartada hasta el 21/08/2026 por no tener tarifa conocida. La notaria
// averiguo que se cobra como acto sin cuantia, asi que ahora se registra Y se
// liquida. Las pruebas de la tarifa en si estan en liquidacion.test.mjs.
test("la constitucion de patrimonio de familia se registra y se liquida", () => {
  assert.ok(ACTOS_PARA_ESCRITURAS.includes("CONSTITUCIÓN PATRIMONIO DE FAMILIA"));
  assert.equal(esActoDeLaLista("CONSTITUCIÓN PATRIMONIO DE FAMILIA"), true);
  assert.equal(esActoDeLaLista("constitucion patrimonio de familia"), true);
  assert.equal(sePuedeLiquidar("CONSTITUCIÓN PATRIMONIO DE FAMILIA"), true);
  assert.equal(tipoDeActo("constitucion patrimonio de familia"), "CONSTITUCIÓN PATRIMONIO DE FAMILIA");
});

test("al liquidar pasa completa, con su numero y su fecha", () => {
  const { actos, sinTipo } = actosParaLiquidar([
    { id: "p", acto: "CONSTITUCIÓN PATRIMONIO DE FAMILIA", numeroEscritura: "200", fechaEscritura: "2026-08-20" },
    { id: "q", acto: "COMPRAVENTA", numeroEscritura: "201", fechaEscritura: "2026-08-20", valorActo: 50000000 },
  ]);
  assert.equal(actos.length, 2);
  assert.equal(sinTipo.length, 0);
  assert.equal(actos[0].acto, "CONSTITUCIÓN PATRIMONIO DE FAMILIA");
  assert.equal(actos[0].numeroEscritura, "200");
});

// ── El mecanismo de "se registra pero no se liquida" sigue en pie ───────────
// Hoy no lo usa nadie, pero el dia que llegue un acto sin tarifa conocida hay
// que poder registrarlo sin que se calcule en cero calladamente.
test("un acto escrito a mano no se reconoce ni se liquida", () => {
  assert.equal(esActoDeLaLista("CUALQUIER COSA"), false);
  assert.equal(sePuedeLiquidar("CUALQUIER COSA"), false);
  const { actos, sinTipo } = actosParaLiquidar([
    { id: "z", acto: "CUALQUIER COSA", numeroEscritura: "300", fechaEscritura: "2026-08-20" },
  ]);
  assert.equal(actos.length, 0);
  assert.equal(sinTipo.length, 1, "se aparta y se avisa, no se calcula en cero");
});

test("todo lo que se ofrece en Escrituras o se liquida o esta apartado a proposito", () => {
  for (const acto of ACTOS_PARA_ESCRITURAS) {
    const liquidable = sePuedeLiquidar(acto);
    const apartado = ACTOS_SIN_TARIFA.includes(acto);
    assert.ok(liquidable !== apartado, `"${acto}" tiene que ser una cosa o la otra`);
  }
});
