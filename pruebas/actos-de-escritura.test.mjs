// Pruebas de la lista de actos de una escritura.
//
// SI UNA PRUEBA FALLA, NO LA CAMBIES PARA QUE PASE. Aquí se decide qué actos
// entran a la liquidación y con qué cuantía: equivocarse es cobrar mal.
//
// Lo que más importa de todo el archivo son dos cosas:
//   1. Las escrituras guardadas ANTES de que existiera la lista se siguen
//      leyendo bien. Son 80 y no se van a migrar.
//   2. Los actos de una misma escritura conservan el mismo número y la misma
//      fecha, porque de eso depende que la mora se cobre UNA vez y no una por
//      acto.
import test from "node:test";
import assert from "node:assert/strict";
import {
  actosDeEscritura,
  tieneVariosActos,
  actoPrincipal,
  cuantiaTotal,
  camposDeActos,
  actosParaLiquidar,
  soloDigitos,
} from "../src/utils/actosDeEscritura.js";
import { liquidar } from "../src/utils/motorLiquidacion.js";
import { TARIFAS_BASE } from "../src/utils/tarifasConfig.js";

// ── Compatibilidad con lo que ya está guardado ──────────────────────────────

test("una escritura vieja, sin lista, se lee como un acto", () => {
  const vieja = { acto: "COMPRAVENTA", valorActo: 60000000, numeroEscritura: "147" };
  assert.deepEqual(actosDeEscritura(vieja), [{ acto: "COMPRAVENTA", valorActo: 60000000 }]);
  assert.equal(tieneVariosActos(vieja), false);
  assert.equal(actoPrincipal(vieja), "COMPRAVENTA");
  assert.equal(cuantiaTotal(vieja), 60000000);
});

test("una escritura vieja sin valor se lee en cero, no revienta", () => {
  assert.deepEqual(actosDeEscritura({ acto: "SUCESIÓN" }), [{ acto: "SUCESIÓN", valorActo: 0 }]);
});

test("una lista vacia o con basura cae de vuelta a los campos viejos", () => {
  const e = { acto: "PERMUTA", valorActo: 5000, actos: [] };
  assert.deepEqual(actosDeEscritura(e), [{ acto: "PERMUTA", valorActo: 5000 }]);
  const f = { acto: "PERMUTA", valorActo: 5000, actos: [{ acto: "  " }, null] };
  assert.deepEqual(actosDeEscritura(f), [{ acto: "PERMUTA", valorActo: 5000 }]);
});

test("aguanta nulos sin romperse", () => {
  assert.deepEqual(actosDeEscritura(null), [{ acto: "", valorActo: 0 }]);
  assert.deepEqual(actosDeEscritura(undefined), [{ acto: "", valorActo: 0 }]);
});

// ── La lista nueva ──────────────────────────────────────────────────────────

test("una escritura con tres actos devuelve los tres", () => {
  const e = {
    acto: "COMPRAVENTA", valorActo: 65000000,
    actos: [
      { acto: "COMPRAVENTA", valorActo: 65000000 },
      { acto: "CANCELACIÓN ENAJENACIÓN", valorActo: 0 },
      { acto: "CONSTITUCIÓN PATRIMONIO DE FAMILIA", valorActo: 0 },
    ],
  };
  assert.equal(actosDeEscritura(e).length, 3);
  assert.equal(tieneVariosActos(e), true);
  assert.equal(actoPrincipal(e), "COMPRAVENTA", "la columna ACTO muestra el primero");
  assert.equal(cuantiaTotal(e), 65000000);
});

test("la lista manda sobre los campos viejos si difieren", () => {
  // Puede pasar si algo escribió mal: la lista es la verdad.
  const e = { acto: "PERMUTA", valorActo: 1, actos: [{ acto: "SUCESIÓN", valorActo: 900 }] };
  assert.equal(actoPrincipal(e), "SUCESIÓN");
  assert.equal(cuantiaTotal(e), 900);
});

// ── Lo que se guarda ────────────────────────────────────────────────────────

test("al guardar se escriben la lista Y los campos viejos", () => {
  const campos = camposDeActos([
    { acto: "COMPRAVENTA", valorActo: "65.000.000" },
    { acto: "CANCELACIÓN ENAJENACIÓN", valorActo: "" },
  ]);
  assert.equal(campos.acto, "COMPRAVENTA", "el campo viejo copia el primer acto");
  assert.equal(campos.valorActo, 65000000, "y su cuantía, ya como número");
  assert.equal(campos.actos.length, 2);
  assert.equal(campos.actos[0].valorActo, 65000000, "los puntos de miles se quitan al guardar");
  assert.equal(campos.actos[1].valorActo, 0);
});

test("las lineas vacias del formulario NO se guardan como actos fantasma", () => {
  const campos = camposDeActos([
    { acto: "COMPRAVENTA", valorActo: "1.000" },
    { acto: "   ", valorActo: "999" },
    { acto: "", valorActo: "" },
  ]);
  assert.equal(campos.actos.length, 1);
});

test("guardar una lista vacia no inventa nada", () => {
  const campos = camposDeActos([]);
  assert.equal(campos.acto, "");
  assert.equal(campos.valorActo, 0);
  assert.deepEqual(campos.actos, []);
});

test("guardar y volver a leer da lo mismo", () => {
  const campos = camposDeActos([
    { acto: "COMPRAVENTA", valorActo: "65.000.000" },
    { acto: "SUCESIÓN", valorActo: "30.000.000" },
  ]);
  assert.deepEqual(actosDeEscritura(campos), [
    { acto: "COMPRAVENTA", valorActo: 65000000 },
    { acto: "SUCESIÓN", valorActo: 30000000 },
  ]);
});

test("soloDigitos aguanta lo que sea", () => {
  assert.equal(soloDigitos("60.000.000"), 60000000);
  assert.equal(soloDigitos("$ 1.500 pesos"), 1500);
  assert.equal(soloDigitos(""), 0);
  assert.equal(soloDigitos(null), 0);
  assert.equal(soloDigitos("hola"), 0);
  assert.equal(soloDigitos(4200), 4200);
});

// ── Al pasar a liquidar ─────────────────────────────────────────────────────

test("los tres actos de una escritura llevan su MISMO numero y fecha", () => {
  // Esto es lo que hace que la mora se cobre una sola vez. Si alguien cambia
  // esto, la mora se multiplica por el número de actos.
  const { actos } = actosParaLiquidar([{
    id: "x", numeroEscritura: "067", fechaEscritura: "2026-05-21",
    actos: [
      { acto: "COMPRAVENTA", valorActo: 65000000 },
      { acto: "CANCELACIÓN ENAJENACIÓN", valorActo: 0 },
    ],
  }]);
  assert.equal(actos.length, 2);
  assert.equal(actos[0].numeroEscritura, "067");
  assert.equal(actos[1].numeroEscritura, "067");
  assert.equal(actos[0].fechaEscritura, "2026-05-21");
  assert.equal(actos[1].fechaEscritura, "2026-05-21");
  assert.equal(actos[0].valorActo, "65.000.000", "con puntos de miles, como en pantalla");
  assert.equal(actos[1].valorActo, "", "sin cuantía entra en blanco, no en cero");
});

test("y da EXACTAMENTE el recibo real de la escritura 067", () => {
  // Recibo Hacienda 185000108069 y ORIP 2026-420-6-8604, del 14/08/2026.
  // Es el mismo caso que ya está en liquidacion.test.mjs escrito a mano; aquí
  // se comprueba que llegando DESDE el panel de escrituras da lo mismo.
  const { actos } = actosParaLiquidar([{
    id: "x", numeroEscritura: "067", fechaEscritura: "2026-05-21",
    actos: [
      { acto: "COMPRAVENTA", valorActo: 65000000 },
      { acto: "CANCELACIÓN ENAJENACIÓN", valorActo: 0 },
    ],
  }]);
  const { totales, documentos } = liquidar(actos, {
    fechaPago: "2026-08-14",
    tasaMoraDefault: 0.2966,
    tasasHistoricas: {},
    tarifas: TARIFAS_BASE,
  });
  assert.equal(documentos.length, 1, "los dos actos son UNA sola escritura");
  assert.equal(totales.tributariaTotal, 883500);
  assert.equal(totales.moraTotal, 16000, "una sola mora, no una por acto");
  assert.equal(totales.oripTotal, 634100);
});

test("una escritura vieja de un solo acto liquida igual que antes", () => {
  const { actos, sinTipo } = actosParaLiquidar([
    { id: "a", acto: "COMPRAVENTA", numeroEscritura: "147", fechaEscritura: "2026-08-14", valorActo: 60000000 },
  ]);
  assert.equal(sinTipo.length, 0);
  assert.equal(actos.length, 1);
  assert.equal(actos[0].acto, "COMPRAVENTA");
  assert.equal(actos[0].valorActo, "60.000.000");
});

test("si NINGUN acto se reconoce, la escritura entera queda apartada", () => {
  const { actos, sinTipo } = actosParaLiquidar([
    { id: "v", acto: "VARIOS", numeroEscritura: "307", fechaEscritura: "2024-12-28" },
  ]);
  assert.equal(actos.length, 0);
  assert.equal(sinTipo.length, 1);
  assert.equal(sinTipo[0].numeroEscritura, "307");
});

test("si unos se reconocen y otros no, van los buenos y se avisa de los otros", () => {
  // Lo importante: los buenos NO se pierden por culpa del malo, y el malo NO
  // se cuela sin avisar.
  const { actos, sinTipo } = actosParaLiquidar([{
    id: "y", numeroEscritura: "300", fechaEscritura: "2026-01-10",
    actos: [
      { acto: "COMPRAVENTA", valorActo: 1000000 },
      { acto: "ALGO RARO", valorActo: 0 },
    ],
  }]);
  assert.equal(actos.length, 1);
  assert.equal(actos[0].acto, "COMPRAVENTA");
  assert.equal(sinTipo.length, 1);
  assert.equal(sinTipo[0].numeroEscritura, "300");
  assert.ok(sinTipo[0].acto.includes("ALGO RARO"), "debe decir cuál fue el acto que no entró");
  assert.equal(sinTipo[0].parcial, true, "marcado como parcial: la escritura sí entró, el acto no");
});

test("varias escrituras distintas no se mezclan entre si", () => {
  const { actos } = actosParaLiquidar([
    { id: "a", numeroEscritura: "100", fechaEscritura: "2026-05-21", actos: [{ acto: "COMPRAVENTA", valorActo: 1 }] },
    { id: "b", numeroEscritura: "200", fechaEscritura: "2026-05-21", actos: [{ acto: "SUCESIÓN", valorActo: 2 }] },
  ]);
  const numeros = new Set(actos.map((a) => a.numeroEscritura));
  assert.deepEqual([...numeros].sort(), ["100", "200"]);
});

test("una lista vacia o mal formada no revienta", () => {
  assert.deepEqual(actosParaLiquidar([]), { actos: [], sinTipo: [] });
  assert.deepEqual(actosParaLiquidar(), { actos: [], sinTipo: [] });
  assert.deepEqual(actosParaLiquidar([null, undefined]), { actos: [], sinTipo: [] });
});
