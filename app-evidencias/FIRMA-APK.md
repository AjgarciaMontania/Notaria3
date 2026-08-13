# Firma del APK — por qué antes tocaba desinstalar

## El problema

Al instalar una versión nueva encima de la anterior, Android mostraba:

> **No se instaló la app debido a un conflicto con un paquete.**

La única salida era desinstalar la app y volver a instalarla desde cero, lo
que **borra la sesión** y obliga a entrar otra vez con usuario y contraseña.

## La causa

El workflow compilaba `assembleDebug` sin una firma propia. Cuando no se
indica ninguna, Gradle usa la *clave de depuración automática* de la máquina
que está compilando (`~/.android/debug.keystore`).

En GitHub Actions esa máquina es **un servidor nuevo en cada compilación**, y
cada uno genera una clave distinta. Es decir: cada APK salía firmado con una
clave diferente.

Android solo permite actualizar una aplicación si el APK nuevo está firmado
con **la misma clave** que el que ya está instalado. Es una protección
deliberada: impide que alguien reemplace una app por otra que no viene del
mismo autor. Como las claves nunca coincidían, Android rechazaba todas las
actualizaciones.

No tenía nada que ver con el `versionCode` ni con el contenido de la app: por
eso pasaba con todas las versiones.

## La solución

Existe una única clave fija de la notaría, guardada como *secret* cifrado en
GitHub. El repositorio **no** contiene la clave; el workflow la reconstruye en
memoria durante la compilación y la borra al terminar.

Además, en `android/app/build.gradle` el APK de **debug** ahora se firma con
esa misma clave, no con la automática. Así cualquiera de los dos APK
actualiza al otro sin conflicto.

### Los 4 secrets

En el repositorio → **Settings** → **Secrets and variables** → **Actions**:

| Nombre | Contenido |
|---|---|
| `KEYSTORE_BASE64` | El archivo `.jks` convertido a base64, en una sola línea |
| `KEYSTORE_PASSWORD` | Contraseña del almacén de claves |
| `KEY_ALIAS` | `notaria` |
| `KEY_PASSWORD` | Contraseña de la clave (igual a la anterior) |

### Datos de la clave

- **Alias:** `notaria`
- **Algoritmo:** RSA 4096 bits, SHA384withRSA
- **Válida hasta:** 5 de agosto de 2056
- **Huella SHA-256:**
  `B2:0E:31:A7:81:C8:65:E5:6E:6A:D6:0A:52:41:FA:53:86:9C:D2:BF:4E:25:4C:49:3F:56:85:63:38:1A:F9:8A`

## Importante: hay que desinstalar UNA última vez

La app que está hoy en los celulares fue firmada con una de aquellas claves
automáticas. La primera versión firmada con la clave definitiva tampoco podrá
instalarse encima de ella, por la misma razón de siempre.

Entonces, **solo esta vez**:

1. Desinstala "Evidencias Notaría" del celular.
2. Instala el APK nuevo.

De ahí en adelante todas las actualizaciones se instalan encima, conservando
la sesión y los datos.

## Cuidado con la clave

Si el archivo `.jks` o la contraseña se pierden, **no hay forma de
recuperarlos**. Ninguna versión futura podría actualizar a las instaladas:
habría que desinstalar en todos los celulares otra vez.

- Guárdalo **fuera** del repositorio (está en `Escritorio\Notaria\clave-firma-apk\`).
- Ten una copia en otro lugar: una USB, un disco externo o un gestor de
  contraseñas.
- El `.gitignore` ya bloquea `*.jks`, `*.keystore` y `keystore.properties`
  para que la clave no se suba por accidente.

## Si algún día hay que crear otra clave

En un computador con Java instalado:

```bash
keytool -genkeypair -v -keystore notaria.jks -alias notaria \
  -keyalg RSA -keysize 4096 -validity 10950 \
  -dname "CN=Notaria Unica de Cartagena del Chaira, O=Notaria Unica de Cartagena del Chaira, L=Cartagena del Chaira, ST=Caqueta, C=CO"
```

Y para convertirla a base64 en una sola línea:

```bash
base64 -w 0 notaria.jks > keystore-base64.txt
```

Recuerda que cambiar de clave obliga a desinstalar la app en todos los
celulares.
