// Pruebas de la decisión de actualizar la APK por internet.
//
// SI UNA PRUEBA FALLA, NO LA CAMBIES PARA QUE PASE. Una actualización mal
// decidida llega a TODOS los celulares a la vez y no hay forma de arreglarla a
// distancia: toca ir celular por celular a reinstalar el APK.
import test from "node:test";
import assert from "node:assert/strict";
import { decidirActualizacion, compararVersiones } from "../src/utils/decidirActualizacion.js";

const COMMIT = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0";
const OTRO = "0000111122223333444455556666777788889999";
const base = { manifiesto: null, commitActual: COMMIT, versionNativa: "3.4" };

// ── Comparar versiones ──────────────────────────────────────────────────────

test("3.10 es MAYOR que 3.4, aunque como texto sea menor", () => {
  // Este es el error clásico. Si esto falla, un celular con la APK 3.10 se
  // quedaría sin actualizar creyendo que está atrasado.
  assert.ok(compararVersiones("3.10", "3.4") > 0);
  assert.ok(compararVersiones("3.4", "3.10") < 0);
  assert.equal(compararVersiones("3.4", "3.4"), 0);
  assert.equal(compararVersiones("3.4", "3.4.0"), 0);
  assert.ok(compararVersiones("4.0", "3.99") > 0);
});

test("comparar basura no revienta ni inventa un orden raro", () => {
  assert.equal(compararVersiones("", ""), 0);
  assert.equal(compararVersiones(null, undefined), 0);
  assert.ok(compararVersiones("3.4", "") > 0);
  assert.equal(compararVersiones("hola", "mundo"), 0);
});

// ── Cuándo NO se actualiza ──────────────────────────────────────────────────

test("una compilación local NUNCA se actualiza desde internet", () => {
  // Estar probando algo y que internet lo reemplace sería perder el trabajo.
  const r = decidirActualizacion({ ...base, commitActual: "local", manifiesto: { commit: OTRO, url: "u" } });
  assert.equal(r.accion, "nada");
});

test("sin internet o con el archivo caído, no pasa nada", () => {
  for (const m of [null, undefined, "", 0, "texto suelto"]) {
    assert.equal(decidirActualizacion({ ...base, manifiesto: m }).accion, "nada");
  }
});

test("un manifiesto incompleto se ignora, no se adivina", () => {
  assert.equal(decidirActualizacion({ ...base, manifiesto: {} }).accion, "nada");
  assert.equal(decidirActualizacion({ ...base, manifiesto: { commit: OTRO } }).accion, "nada");
  assert.equal(decidirActualizacion({ ...base, manifiesto: { url: "u" } }).accion, "nada");
});

test("si el commit es el mismo, ya está al día", () => {
  const r = decidirActualizacion({ ...base, manifiesto: { commit: COMMIT, url: "u", version: "3.4" } });
  assert.equal(r.accion, "nada");
  assert.match(r.motivo, /al día/);
});

// ── El freno de mano: lo nativo no viaja por internet ───────────────────────

test("si la actualización necesita una APK más nueva, NO se aplica", () => {
  // Esto es lo que evita dejar la aplicación rota y sin arreglo a distancia.
  const r = decidirActualizacion({
    ...base,
    versionNativa: "3.4",
    manifiesto: { commit: OTRO, url: "u", version: "4.0", minNativo: "4.0" },
  });
  assert.equal(r.accion, "exige-apk");
  assert.match(r.motivo, /4\.0/);
  assert.match(r.motivo, /instalar/);
});

test("si la APK instalada alcanza, sí se aplica", () => {
  const r = decidirActualizacion({
    ...base,
    versionNativa: "3.4",
    manifiesto: { commit: OTRO, url: "u", version: "3.5", minNativo: "3.4" },
  });
  assert.equal(r.accion, "descargar");
});

test("una APK MÁS NUEVA que el mínimo también sirve", () => {
  const r = decidirActualizacion({
    ...base,
    versionNativa: "3.10",
    manifiesto: { commit: OTRO, url: "u", version: "3.11", minNativo: "3.4" },
  });
  assert.equal(r.accion, "descargar");
});

test("sin minNativo se asume que sirve: es el caso corriente", () => {
  const r = decidirActualizacion({ ...base, manifiesto: { commit: OTRO, url: "u", version: "3.5" } });
  assert.equal(r.accion, "descargar");
});

// ── Cuándo SÍ se actualiza ──────────────────────────────────────────────────

test("commit distinto = versión nueva, aunque el número no cambie", () => {
  // Que actualizar dependa de acordarse de subir el número a mano es
  // exactamente lo que hay que evitar: se sube a GitHub y ya.
  const r = decidirActualizacion({
    ...base,
    manifiesto: { commit: OTRO, url: "https://x/app.zip", version: "3.4" },
  });
  assert.equal(r.accion, "descargar");
  assert.equal(r.url, "https://x/app.zip");
  assert.ok(r.version.includes("0000111"), "la versión debe llevar el commit para no repetirse");
});

test("dos publicaciones distintas dan dos versiones distintas", () => {
  const a = decidirActualizacion({ ...base, manifiesto: { commit: OTRO, url: "u", version: "3.4" } });
  const b = decidirActualizacion({ ...base, manifiesto: { commit: "ffff1111" + "0".repeat(32), url: "u", version: "3.4" } });
  assert.notEqual(a.version, b.version);
});

test("también se aplica una versión ANTERIOR: sirve para devolverse", () => {
  // Si una actualización sale mala, volver a publicar la anterior tiene que
  // llegar a los celulares. Por eso se compara por commit y no por número.
  const r = decidirActualizacion({
    ...base,
    manifiesto: { commit: OTRO, url: "u", version: "3.3" },
  });
  assert.equal(r.accion, "descargar");
});
