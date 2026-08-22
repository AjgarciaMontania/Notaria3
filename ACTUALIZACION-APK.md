# Actualización automática de la APK

Desde la versión **3.5**, la APK se actualiza sola por internet. Subir los
cambios a GitHub actualiza la página web **y** la aplicación del celular.

---

## Lo primero, y solo una vez

Los celulares que hoy tienen la APK 3.4 **no** pueden recibir actualizaciones
automáticas: esa versión no trae la pieza que las descarga.

Hay que instalar el APK 3.5 a mano, una vez, en cada celular. **De ahí en
adelante ya no hace falta volver a instalar nada**, salvo en el caso que se
explica más abajo.

El APK sale de GitHub → pestaña **Actions** → *Compilar APK de Evidencias* →
el archivo `EvidenciasNotaria-debug.apk` que queda adjunto al final.

---

## Cómo funciona

Cada vez que se sube algo a la rama `main`, GitHub publica dos archivos junto a
la página web:

| Archivo | Qué es |
|---|---|
| `app/bundle-<commit>.zip` | La interfaz de la APK comprimida (unos 530 KB) |
| `app/manifest.json` | Qué versión es y dónde está el zip |

Y al abrir la aplicación, el celular:

1. **Avisa que arrancó bien.** Esto es la red de seguridad, no un detalle: si
   una actualización deja la aplicación sin arrancar y no alcanza a avisar en
   10 segundos, la propia aplicación **se devuelve sola** a la versión
   anterior. Sin esto, una mala actualización dejaría todos los celulares
   inservibles y sin arreglo a distancia.
2. **Mira el manifiesto.** Compara el commit publicado con el que trae dentro.
3. **Si hay algo nuevo, lo baja** y lo deja listo.
4. **Lo aplica al volver a abrir.** No en caliente: si alguien está tomando una
   foto o llenando una escritura, recargar la pantalla le haría perder lo que
   iba haciendo. Sale un aviso abajo con un botón «Reiniciar ahora» para quien
   tenga prisa.

Sin internet no pasa nada: la aplicación funciona igual y lo intenta la próxima
vez que se abra.

## No hay que acordarse de subir ningún número

La comparación es por **commit**, no por número de versión. Cada push a `main`
es una versión nueva para los celulares, se haya tocado o no `VERSION_APP`.

Esto también sirve para **devolverse**: si una actualización sale mala, se
revierte el commit, se sube, y los celulares vuelven a la versión buena solos.

---

## Lo que NO se actualiza por internet

La parte **nativa** de Android vive dentro del APK y no viaja por internet:

- la cámara y el escáner
- los permisos de Android
- Firebase y las demás piezas nativas
- la pieza que hace las actualizaciones

Todo lo demás —las pantallas, el motor de cálculo, **las tarifas**, las reglas
de mora— sí viaja, porque es parte de la interfaz web.

Cuando una versión necesita algo nativo nuevo, hay que compilar e instalar el
APK otra vez. Para que eso no rompa nada, el manifiesto lleva `minNativo`: la
versión de APK más vieja capaz de correr ese paquete. Si el celular tiene una
anterior, **no se actualiza** y muestra un aviso diciendo que hay que instalar
el APK nuevo. Es la diferencia entre «no se actualizó» y «se dañó».

`minNativo` se toma solo del `versionName` de `android/app/build.gradle`. Si
agregas o cambias un plugin nativo, **sube ese número** (y `versionCode`) en el
mismo cambio: eso deja fuera automáticamente a los celulares que necesitan
reinstalar.

---

## Lo que hay que tener presente

**Una actualización mala llega a todos los celulares a la vez.** Antes había un
paso manual —compilar e instalar— que servía de freno. Ya no. Lo que queda
como red de seguridad es:

- Las 167 pruebas automáticas, que bloquean la publicación si algo falla
  (`npm test` corre antes de publicar, tanto en la página como en el APK).
- La vuelta atrás automática si la aplicación no arranca.
- Revertir el commit y volver a subir, que llega a los celulares solo.

**El motor de cálculo viaja en la actualización.** Un cambio de tarifas llega a
los celulares sin reinstalar nada. Eso es bueno cuando la resolución cambia; y
es exactamente por lo que las tarifas están respaldadas por 61 recibos reales
en las pruebas.

---

## Dónde está cada cosa

| Archivo | Para qué |
|---|---|
| `src/utils/decidirActualizacion.js` | Decide si actualizar y si se puede. Lógica pura, con pruebas. |
| `pruebas/decidir-actualizacion.test.mjs` | Las 13 pruebas de esa decisión. |
| `app-evidencias/src/lib/actualizacion.js` | Habla con el plugin: consulta, baja, aplica. |
| `app-evidencias/src/componentes/AvisoActualizacion.jsx` | El aviso de abajo. |
| `app-evidencias/capacitor.config.json` | `appReadyTimeout`, la vuelta atrás automática. |
| `.github/workflows/deploy.yml` | Publica el zip y el manifiesto. |

## Para comprobar que está publicando

Abre en el navegador:

```
https://ajgarciamontania.github.io/Notaria3/app/manifest.json
```

Debe salir algo así:

```json
{
  "version": "3.5",
  "commit": "8d3d7c5...",
  "minNativo": "3.5",
  "url": "https://ajgarciamontania.github.io/Notaria3/app/bundle-8d3d7c5.zip",
  "sha256": "…",
  "bytes": 538862
}
```

Si el `commit` es el del último push, está funcionando.
