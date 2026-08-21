// ─────────────────────────────────────────────────────────────────────────────
// PRUEBAS DEL MOTOR DE LIQUIDACIÓN
//
// Estas pruebas comparan el cálculo contra RECIBOS REALES de la Gobernación del
// Caquetá y de la Oficina de Registro de Florencia (julio y agosto de 2026).
// No son ejemplos inventados: cada cifra salió de un recibo en papel.
//
// Por qué existen: en agosto de 2026 se descubrió que la mora estaba mal
// calculada —se aplicaba una sola tasa a todo el periodo en vez de acumular día
// por día con la usura de cada mes menos 2 puntos—, y en una escritura de 2023
// eso significaba $77.000 de diferencia. El error vivió meses sin que nadie lo
// notara. Estas pruebas están para que eso no vuelva a pasar en silencio.
//
// Se ejecutan solas en GitHub antes de publicar la página o compilar la APK.
// Para correrlas en el computador:  npm test
//
// SI UNA PRUEBA FALLA, NO LA CAMBIES PARA QUE PASE. Cada número aquí está
// respaldado por un recibo. Si el cálculo cambió a propósito (una resolución
// nueva, por ejemplo), lo correcto es agregar casos nuevos con los recibos
// nuevos, no borrar los viejos.
// ─────────────────────────────────────────────────────────────────────────────
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { liquidar, calcularMoraEscritura, fechaVencimiento, diasEntre } from '../src/utils/motorLiquidacion.js';
import { combinarTarifas, TARIFAS_BASE } from '../src/utils/tarifasConfig.js';
import { getUsuraDelMes, TASAS_BASE } from '../src/utils/tasasHistoricas.js';
import { aCorreo, aNombreVisible, rolDe, puedeOperar, ROLES } from '../src/utils/roles.js';

const acto = (nombre, numero, fecha, valor = '') => ({
  acto: nombre,
  numeroEscritura: numero,
  fechaEscritura: fecha,
  valorActo: valor,
  foliosAdicionales: 0,
  numActos: 1,
});

const opciones = (fechaPago) => ({
  fechaPago,
  tasaMoraDefault: 0.2966,
  tasasHistoricas: {},
});

// ─── Recibos reales ──────────────────────────────────────────────────────────
// Cada caso trae: qué se liquidó, cuándo se pagó, y lo que cobró cada entidad.

const RECIBOS = [
  {
    nombre: 'Escritura 121 · venta de $80.000.000 · 1.116 días de mora',
    recibo: 'Hacienda 185000108067 y ORIP 2026-420-6-8605, ambos del 14/08/2026',
    pago: '2026-08-14',
    actos: [acto('COMPRAVENTA', '121', '2023-05-25', '80.000.000')],
    tributaria: 800000,
    mora: 673000,
    orip: 743400,
  },
  {
    nombre: 'Escritura 168 · venta de $73.000.000 · 674 días de mora',
    recibo: 'Hacienda 185000107714 y ORIP 2026-420-6-8497, del 13/08/2026',
    pago: '2026-08-13',
    actos: [acto('COMPRAVENTA', '168', '2024-08-08', '73.000.000')],
    tributaria: 730000,
    mora: 324000,
    orip: 678300,
  },
  {
    nombre: 'Escritura 037 · venta de $120.000.000 · 434 días de mora',
    recibo: 'Hacienda 185000106805 y ORIP 2026-420-6-8335, del 11/08/2026',
    pago: '2026-08-11',
    actos: [acto('COMPRAVENTA', '037', '2025-04-03', '120.000.000')],
    tributaria: 1200000,
    mora: 342000,
    orip: 1115100,
  },
  {
    nombre: 'Acta 1150 · cancelación sola · 236 días de mora',
    recibo: 'Hacienda 185000104253 y ORIP 2026-420-6-7875, del 30/07/2026',
    pago: '2026-07-30',
    actos: [acto('CANCELACIÓN ENAJENACIÓN', '1150', '2025-10-06')],
    tributaria: 233500,
    mora: 37000,
    orip: 30100,
  },
  {
    nombre: 'Acta 1468 · cancelación sola · 199 días de mora',
    recibo: 'Hacienda 185000108072 y ORIP 2026-420-6-8602, del 14/08/2026',
    pago: '2026-08-14',
    actos: [acto('CANCELACIÓN ENAJENACIÓN', '1468', '2025-11-27')],
    tributaria: 233500,
    mora: 32000,
    orip: 30100,
  },
  {
    nombre: 'Escritura 067 · venta + cancelación en un solo documento · 24 días',
    recibo: 'Hacienda 185000108069 y ORIP 2026-420-6-8604, del 14/08/2026',
    pago: '2026-08-14',
    actos: [
      acto('COMPRAVENTA', '067', '2026-05-21', '65.000.000'),
      acto('CANCELACIÓN ENAJENACIÓN', '067', '2026-05-21'),
    ],
    tributaria: 883500, // 650.000 de la venta + 233.500 de la cancelación
    mora: 16000,        // UNA sola línea de mora para todo el documento
    orip: 634100,
  },
  {
    nombre: 'Escritura 085 · venta de $40.000.000 · pagada DENTRO del plazo',
    recibo: 'Hacienda 185000107396 y ORIP 2026-420-6-8498',
    pago: '2026-08-12',
    actos: [acto('COMPRAVENTA', '085', '2026-06-16', '40.000.000')],
    tributaria: 400000,
    mora: 0,
    orip: 371700,
  },
  {
    nombre: 'Escritura 089 · hipoteca de $17.000.000 · dentro del plazo',
    recibo: 'Hacienda 185000104251 y ORIP 2026-420-6-7876, del 30/07/2026',
    pago: '2026-07-30',
    actos: [acto('HIPOTECA CON BANCO AGRARIO', '089', '2026-06-18', '17.000.000')],
    tributaria: 85000,  // 0,5% de la hipoteca
    mora: 0,
    orip: 199900,       // registro 175.600 + certificado de tradición 24.300
  },
];

for (const caso of RECIBOS) {
  test(`recibo real — ${caso.nombre}`, () => {
    const { totales } = liquidar(caso.actos, opciones(caso.pago));

    assert.equal(totales.tributariaTotal, caso.tributaria,
      `Impuesto de registro distinto al del recibo (${caso.recibo})`);
    assert.equal(totales.moraTotal, caso.mora,
      `Intereses de mora distintos a los del recibo (${caso.recibo})`);
    assert.equal(totales.oripTotal, caso.orip,
      `Derechos de registro distintos a los del recibo (${caso.recibo})`);
  });
}

// ─── Reglas de la mora ───────────────────────────────────────────────────────

test('el plazo legal es de 2 meses exactos desde el otorgamiento', () => {
  assert.equal(fechaVencimiento('2026-05-21'), '2026-07-21');
  assert.equal(fechaVencimiento('2025-12-31'), '2026-02-28'); // febrero no tiene 31
  assert.equal(fechaVencimiento('2024-01-31'), '2024-03-31'); // año bisiesto
});

test('dentro del plazo no se cobra un solo peso de mora', () => {
  const r = calcularMoraEscritura('2026-06-16', 400000, '2026-08-12', {});
  assert.equal(r.diasVencidos, 0);
  assert.equal(r.mora, 0);
});

test('la mora usa la usura del mes MENOS 2 puntos (art. 635 E.T.)', () => {
  // 24 días, todos dentro de agosto de 2026: interviene una sola tasa.
  const r = calcularMoraEscritura('2026-05-21', 883500, '2026-08-14', {
    tasasHistoricas: { '2026-08': 0.2966 },
  });
  assert.equal(r.diasVencidos, 24);
  assert.equal(r.mora, 16000);
  // Con la usura completa (29,66%) darían 17.000: por eso importan los 2 puntos.
  assert.notEqual(r.mora, 17000);
});

test('la mora se acumula mes a mes, no con una sola tasa', () => {
  const r = calcularMoraEscritura('2025-11-27', 233500, '2026-08-14', {});
  assert.equal(r.mora, 32000);
  assert.ok(r.desglose.length > 1, 'debería haber pasado por varios meses');
  // Las tasas de los meses son distintas entre sí
  const distintas = new Set(r.desglose.map((m) => m.tasa));
  assert.ok(distintas.size > 1, 'todas las tasas salieron iguales: no se está usando la de cada mes');
});

test('avisa cuando falta la tasa de un mes, en vez de callar', () => {
  const r = calcularMoraEscritura('2026-06-10', 500000, '2026-09-20', {
    tasasHistoricas: {},
    tasaRespaldo: 0.2966,
  });
  assert.ok(r.mesesSinTasa.includes('2026-09'), 'debería avisar que falta septiembre');
  assert.ok(r.mora > 0, 'con tasa de respaldo esos días SÍ se cobran');
});

test('los actos de una misma escritura comparten una sola mora', () => {
  const { documentos, totales } = liquidar([
    acto('COMPRAVENTA', '067', '2026-05-21', '65.000.000'),
    acto('CANCELACIÓN ENAJENACIÓN', '067', '2026-05-21'),
  ], opciones('2026-08-14'));

  assert.equal(documentos.length, 1, 'los dos actos deberían formar un solo documento');
  assert.equal(documentos[0].tributaria, 883500, 'la mora se calcula sobre la tributaria combinada');
  assert.equal(totales.moraTotal, 16000);
});

test('escrituras distintas no se mezclan', () => {
  const { documentos } = liquidar([
    acto('COMPRAVENTA', '100', '2026-05-21', '65.000.000'),
    acto('COMPRAVENTA', '200', '2026-05-21', '65.000.000'),
  ], opciones('2026-08-14'));
  assert.equal(documentos.length, 2);
});

// ─── Tarifas administrables ──────────────────────────────────────────────────

test('lo guardado en Firestore manda sobre las tarifas del código', () => {
  const T = combinarTarifas({ folioAdicional: 16500 });
  assert.equal(T.folioAdicional, 16500);
  // Lo no guardado conserva el valor del código
  assert.equal(T.derechoMinimo, TARIFAS_BASE.derechoMinimo);
  assert.equal(T.honorarios.primero, TARIFAS_BASE.honorarios.primero);
});

test('unas tarifas corruptas no rompen ni ponen todo en cero', () => {
  for (const basura of [null, undefined, {}, { folioAdicional: 'hola' }, { honorarios: null }, { tramos: 'x' }]) {
    const T = combinarTarifas(basura);
    assert.equal(T.folioAdicional, TARIFAS_BASE.folioAdicional);
    assert.equal(T.honorarios.primero, TARIFAS_BASE.honorarios.primero);
    assert.equal(T.tramos.length, TARIFAS_BASE.tramos.length);
  }
});

test('cambiar una tarifa cambia el resultado', () => {
  const uno = [acto('COMPRAVENTA', 'A', '2026-06-10', '50.000.000')];
  const normal = liquidar(uno, opciones('2026-08-14'));
  const caro = liquidar(uno, { ...opciones('2026-08-14'), tarifas: { honorarios: { primero: 40000 } } });
  assert.equal(caro.totales.honorarios - normal.totales.honorarios, 5000);
});

// ─── Tabla de usura ──────────────────────────────────────────────────────────

test('la tabla de usura está completa desde 2008', () => {
  const faltan = [];
  for (let anio = 2008; anio <= 2026; anio++) {
    for (let mes = 1; mes <= 12; mes++) {
      if (anio === 2026 && mes > 8) break;
      const clave = `${anio}-${String(mes).padStart(2, '0')}`;
      if (getUsuraDelMes(clave) == null) faltan.push(clave);
    }
  }
  assert.deepEqual(faltan, [], `faltan meses en la tabla de usura: ${faltan.join(', ')}`);
});

test('las tasas guardadas mandan sobre la tabla del código', () => {
  assert.equal(getUsuraDelMes('2026-08'), TASAS_BASE['2026-08']);
  assert.equal(getUsuraDelMes('2026-08', { '2026-08': 0.31 }), 0.31);
});

// ─── Usuarios y roles ────────────────────────────────────────────────────────

test('el nombre de usuario se convierte en correo interno', () => {
  assert.equal(aCorreo('AlvaroArias'), 'alvaroarias@cartagena.com');
  assert.equal(aCorreo('  Álvaro Arias '), 'alvaroarias@cartagena.com');
  assert.equal(aCorreo('cha1@outlook.es'), 'cha1@outlook.es'); // los correos reales se respetan
  assert.equal(aNombreVisible('alvaroarias@cartagena.com'), 'alvaroarias');
});

test('el administrador raíz lo es siempre, aunque no tenga ficha', () => {
  assert.equal(rolDe('cha1@outlook.es', null), ROLES.ADMIN);
  assert.equal(rolDe('CHA1@OUTLOOK.ES', null), ROLES.ADMIN);
  // Y no se le puede degradar desde la ficha
  assert.equal(rolDe('cha1@outlook.es', { rol: 'liquidador' }), ROLES.ADMIN);
});

test('una cuenta sin ficha entra con el nivel más restringido', () => {
  assert.equal(rolDe('desconocido@notaria.com', null), ROLES.LIQUIDADOR);
  assert.equal(puedeOperar(rolDe('desconocido@notaria.com', null)), false);
  assert.equal(puedeOperar(rolDe('juan@notaria.com', { rol: 'personal' })), true);
});

// ─── Cuentas ─────────────────────────────────────────────────────────────────

test('los días se cuentan por calendario, sin sorpresas de horario', () => {
  assert.equal(diasEntre('2026-08-13', '2026-08-14'), 1);
  assert.equal(diasEntre('2024-02-28', '2024-03-01'), 2); // 2024 es bisiesto
  assert.equal(diasEntre('2025-02-28', '2025-03-01'), 1);
});

test('los retiros se cobran por tramo empezado', () => {
  const { totales } = liquidar([acto('COMPRAVENTA', 'A', '2026-08-01', '1.000.000')], opciones('2026-08-14'));
  assert.equal(totales.retiros % TARIFAS_BASE.retiroValor, 0, 'los retiros deben ser múltiplo del valor unitario');
  assert.ok(totales.retiros > 0);
});

// ─── Constitución de patrimonio de familia ───────────────────────────────────
//
// OJO: estas pruebas NO salen de un recibo. En los 143 folios de las relaciones
// de ingresos de 2025 y 2026 no hay ninguno de este acto. La notaría averiguó
// el 21/08/2026 que se cobra como acto sin cuantía, y así quedó configurado.
//
// Por eso lo que se comprueba aquí es la EQUIVALENCIA: que liquide exactamente
// igual que la cancelación de enajenación, que sí está respaldada por recibos
// (actas 1150 y 1468). Si un día aparece un recibo de patrimonio de familia y
// dice otra cosa, estas pruebas son las que hay que cambiar, y con el recibo
// a la vista.

test('el patrimonio de familia liquida igual que un acto sin cuantía con recibo', () => {
  const patrimonio = liquidar(
    [acto('CONSTITUCIÓN PATRIMONIO DE FAMILIA', '1150', '2025-10-06')],
    opciones('2026-07-30')
  ).totales;
  const cancelacion = liquidar(
    [acto('CANCELACIÓN ENAJENACIÓN', '1150', '2025-10-06')],
    opciones('2026-07-30')
  ).totales;

  assert.equal(patrimonio.tributariaTotal, cancelacion.tributariaTotal);
  assert.equal(patrimonio.oripTotal, cancelacion.oripTotal);
  assert.equal(patrimonio.moraTotal, cancelacion.moraTotal);
  assert.equal(patrimonio.honorarios, cancelacion.honorarios);
  assert.equal(patrimonio.totalConsignar, cancelacion.totalConsignar);
});

test('y da los mismos importes del recibo del acta 1150', () => {
  // Los mismos números que la cancelación sola de arriba: si alguien cambia la
  // configuración del acto, esto se cae aquí y no en una liquidación real.
  const { totales } = liquidar(
    [acto('CONSTITUCIÓN PATRIMONIO DE FAMILIA', '1150', '2025-10-06')],
    opciones('2026-07-30')
  );
  assert.equal(totales.tributariaTotal, 233500, 'tarifa mínima de acto sin cuantía');
  assert.equal(totales.oripTotal, 30100, 'un acto sin cuantía en la ORIP');
  assert.equal(totales.moraTotal, 37000);
});

test('cobra honorario de gestión, como se confirmó el 21/08/2026', () => {
  const { totales } = liquidar(
    [acto('CONSTITUCIÓN PATRIMONIO DE FAMILIA', '200', '2026-08-01')],
    opciones('2026-08-14')
  );
  assert.equal(totales.honorarios, TARIFAS_BASE.honorarios.primero,
    'siendo el primer acto de la liquidación debe cobrar el honorario del primero');
});

test('varios en una misma escritura se suben en la columna ACTOS', () => {
  const uno = liquidar([acto('CONSTITUCIÓN PATRIMONIO DE FAMILIA', '201', '2026-08-01')], opciones('2026-08-14')).totales;
  const dos = liquidar(
    [{ ...acto('CONSTITUCIÓN PATRIMONIO DE FAMILIA', '201', '2026-08-01'), numActos: 2 }],
    opciones('2026-08-14')
  ).totales;
  assert.equal(dos.oripTotal, uno.oripTotal * 2, 'la ORIP cobra por cada acto');
});
