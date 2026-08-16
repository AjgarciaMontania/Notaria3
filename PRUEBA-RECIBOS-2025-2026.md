# Prueba del motor contra los recibos de ingresos 2025–2026

Notaría Única de Cartagena del Chairá · agosto de 2026

---

## Qué se hizo

Se revisaron las dos relaciones de ingresos —**143 páginas**, 2025 y 2026— y se
sacaron de ellas los recibos del impuesto de registro de la Secretaría de
Hacienda del Caquetá: los que traen la cuantía, el valor del impuesto, los
intereses de mora y la fecha de pago.

De ahí salieron **46 casos completos y verificables**: 38 con mora y 8 pagados
dentro del plazo. Cada uno se metió al motor con la fecha de la escritura, el
impuesto y la fecha de pago, y se comparó contra lo que la Gobernación cobró de
verdad.

**Resultado: 39 de 46 coinciden al peso.**

| | Casos | Coinciden |
|---|---|---|
| Recibos de 2026 con mora | 16 | **16** |
| Recibos de 2025 con mora | 22 | 15 |
| Pagados dentro del plazo (mora $0) | 8 | **8** |
| **Total** | **46** | **39** |

Los 39 quedaron guardados como pruebas automáticas en
`pruebas/recibos-hacienda.test.mjs`. Corren con `npm test` y bloquean el
despliegue si alguna falla. Ya no son un cálculo que salió bien una vez: son
una red que avisa si alguien mueve la fórmula.

---

## Lo que la prueba confirmó

La fórmula de la mora reproduce exactamente lo que cobra la Gobernación:

- corre desde los **2 meses** de la fecha de la escritura hasta el día del pago;
- cada día usa la **usura de su propio mes menos 2 puntos** (E.T. art. 635), no
  una tasa fija ni la del mes del pago;
- el resultado se redondea al **mil más cercano**, para arriba o para abajo según
  caiga.

Ese redondeo se verificó en 31 recibos: en 14 la Gobernación redondeó hacia
abajo y en 17 hacia arriba, y el motor acertó los 31.

Casos que valen la pena mencionar porque son los difíciles:

| Escritura | Fecha | Pago | Días | Mora del recibo | Motor |
|---|---|---|---|---|---|
| 121 | 25/05/2023 | 14/08/2026 | 1.116 | $673.000 | $673.000 |
| 168 | 08/08/2024 | 13/08/2026 | 674 | $324.000 | $324.000 |
| 221 | 19/11/2025 | 22/07/2026 | 184 | $389.000 | $389.000 |
| 208 | 06/11/2025 | 26/05/2026 | 140 | $157.000 | $157.000 |

---

## Un error que se encontró y se corrigió

**Faltaba el mínimo de $1.000.**

La escritura 122 (recibo del 30/09/2025) se pagó con 7 días de mora sobre
$100.000. El interés exacto de esos 7 días son **$441**, que al redondear al mil
más cercano daban **$0**. La Gobernación cobró **$1.000**.

O sea: cuando hay días vencidos, nunca se cobra cero. Hay un piso de $1.000.

El motor quedaba corto en todas las moras chiquitas. Ya está corregido y con su
propia prueba.

---

## Los 7 recibos que no coinciden

Los siete son de **2025** y en todos la Gobernación cobró **menos** que el
cálculo completo:

| Escritura | Fecha escritura | Pago | Mora del recibo | Cálculo completo | Cobró el… |
|---|---|---|---|---|---|
| 307 | 28/12/2024 | 16/07/2025 | $15.000 | $75.000 | 20% |
| 28 | 04/03/2024 | 12/09/2025 | $80.400 | $201.000 | 40% |
| 75 | 10/04/2023 | 19/09/2025 | $132.000 | $330.000 | 40% |
| 0697 | 30/08/2012 | 02/10/2025 | $96.600 | $351.000 | 27,5% |
| 96 | 28/04/2023 | 31/10/2025 | $128.100 | $183.000 | 70% |
| 221 | 09/10/2024 | 14/11/2025 | $74.200 | $106.000 | 70% |
| 105 | 10/05/2023 | 21/11/2025 | $71.400 | $102.000 | 70% |

Hay tres cosas que saltan a la vista y que apuntan todas al mismo sitio:

1. **Los porcentajes son limpios**: 20%, 40%, 40%, 70%, 70%, 70%. No son
   redondeos ni errores de cálculo, son fracciones exactas del interés completo.
2. **Van en escalera según el mes de pago**: en julio se cobró el 20%, en
   septiembre el 40%, y de finales de octubre en adelante el 70%. Entre más
   tarde se pagó, menos descuento.
3. **En 2026 no pasa**: los 16 recibos de 2026 coinciden exactos, incluida la
   escritura 121 con 1.116 días de mora, que es el caso más extremo de todos.

Eso es la forma que tiene un **alivio tributario departamental**: un descuento
sobre los intereses que se va reduciendo a medida que avanza el plazo, y que se
acaba.

**La notaría confirmó que en 2025 hubo un alivio tributario de la Gobernación
del Caquetá.** Eso explica los siete recibos y cierra el tema: la fórmula del
sistema está bien; a esos pagos les aplicaron un descuento por encima.

Queda una sola cosa sin verificar, y se anota para que nadie la dé por hecha:
**no se encontró publicada la ordenanza** del Caquetá con las fechas y los
porcentajes exactos del alivio. Lo que sí está comprobado es que otros
departamentos corrieron en 2025 programas con esa misma estructura escalonada
—80% de descuento al principio, bajando al 40% y luego menos a medida que se
acercaba el cierre—, que es exactamente el patrón que aparece en estos recibos.
Si algún día hace falta reconstruir por qué se cobró lo que se cobró en uno de
esos siete, el documento a buscar es esa ordenanza.

Estos siete **no** se metieron a las pruebas automáticas, a propósito: un
descuento temporal no es la fórmula. Si mañana hay otro alivio, se aplica como
un descuento aparte sobre la mora calculada, no cambiando el cálculo.

Nada que corregir hacia atrás: esos siete ya se pagaron y se pagaron bien, con
el descuento que estaba vigente. Y nada que ajustar hacia adelante: el alivio se
acabó, y por eso los 16 recibos de 2026 dan exactos.

---

## Segunda parte: los recibos de la ORIP de 2026

Después se revisaron los otros recibos, los de la Oficina de Registro de
Instrumentos Públicos: las "Solicitud Registro Documentos", que son las que
cobran los **derechos de registro**. Se sacaron los 22 de 2026, con sus 29 actos.

**Resultado: los 22 recibos cuadran al peso.** Pero para llegar ahí hubo que
corregir algo.

### El error: faltaba ajustar cada acto a la centena

La ORIP no ajusta solo el total: ajusta a la centena **el derecho de cada acto**.

Una venta de $73.000.000 da $665.030 exactos según la tabla de tarifas, y el
recibo cobra **$665.000**. Una de $23.000.000 da $209.530 y cobra **$209.500**.
Se comprobó en los 20 actos con cuantía de 2026: los 20 se ajustan a la centena.

El sistema arrastraba esos pesos sueltos hasta el total. Con un solo acto casi
nunca se notaba, pero con varios el total quedaba **$100 arriba o abajo** del
recibo. Pasaba en 5 de los 22:

| Recibo | Daba el sistema | Cobró la ORIP | Diferencia |
|---|---|---|---|
| esc 092 | $1.635.400 | $1.635.500 | −$100 |
| esc 254 | $873.500 | $873.400 | +$100 |
| esc 179 | $929.200 | $929.300 | −$100 |
| esc 208 | $1.396.000 | $1.396.100 | −$100 |
| esc 232 | $232.300 | $232.400 | −$100 |

Corregido: ahora el derecho se ajusta a la centena acto por acto, y los 22
recibos dan exactos.

### Lo demás quedó confirmado

- **Actos sin cuantía**: cobran la tarifa fija multiplicada por el número de
  unidades. 7 matrículas nuevas son 7 × $15.300 = $107.100; 5 reproducciones son
  5 × $17.300 = $86.500; dos cancelaciones son 2 × $29.500 = $59.000.
- **El 2% de conservación documental** sobre el derecho, con el total ajustado a
  la centena: los 22 recibos coinciden.
- **El certificado de tradición de la hipoteca va por fuera del 2%**. Lo
  confirma la escritura 089: registro $172.200 + 2% = $175.600, y el certificado
  de $24.300 se suma después, sin recargo. El sistema ya lo hacía bien.

Los 15 casos completos se probaron **de punta a punta**, armando la liquidación
igual que la arma el usuario en la página, no solo la fórmula suelta.

---

## Lo que esta prueba NO cubre

Hay que ser claro con el alcance, porque un informe que promete de más es peor
que no tenerlo:

- Las tarifas del impuesto de registro que aparecen en los recibos (1% en
  ventas, 0,5% en hipotecas y donaciones, y la tarifa fija de los actos sin
  cuantía) se leyeron y son coherentes, pero **no** se probaron una por una
  contra el motor.
- De las 143 páginas, buena parte son solicitudes de la ORIP y copias, no
  recibos. Los 46 casos son los que traían todos los datos necesarios y en los
  que las cifras cuadran entre sí (actos + mora = total).
