# Evidencias Notaría — aplicación Android

APK para subir documentos PDF al módulo **Evidencias** de la página web
directamente desde el celular.

Se conecta a la misma base de datos de Firebase que usa la web, así que todo lo
que subes desde el celular aparece en la página al instante, y al revés.

---

## Qué hace la aplicación

- **Entrar con clave** — la misma que usa el panel de administrador de la web.
  La sesión se cierra sola tras 30 minutos sin uso.
- **Ver las carpetas** que ya existen, con el número de archivos de cada una.
- **Crear y eliminar carpetas** (solo se pueden eliminar carpetas vacías, igual
  que en la web).
- **Subir PDFs** desde el almacenamiento del celular, varios a la vez, con barra
  de progreso. Si ya existe un archivo con el mismo nombre, el nuevo se guarda
  como `nombre (1).pdf` en vez de sobrescribirlo.
- **Escanear con la cámara** — tomas una foto por página, las revisas, y la app
  arma un único PDF tamaño carta y lo sube.
- **Ver y descargar** los archivos ya subidos.
- **Eliminar archivos.**

---

## Cómo obtener el APK

El APK lo compila **GitHub Actions**. No necesitas instalar Android Studio.

### Primera vez

1. **Coloca el workflow en su sitio.** En esta misma carpeta hay un archivo
   llamado `github-workflow-build-apk.yml`. Muévelo (y renómbralo) a:

   ```
   notaria-liquidacion/.github/workflows/build-apk.yml
   ```

   Debe quedar junto a `deploy.yml`, que ya tienes ahí. Sin este paso GitHub
   no sabe cómo compilar el APK.
2. Sube todo al repositorio:

   ```bash
   git add .
   git commit -m "Agregar APK de Evidencias y diseño responsivo"
   git push
   ```
3. Entra a tu repositorio en GitHub → pestaña **Actions**.
4. Selecciona **"Compilar APK de Evidencias"** en la lista de la izquierda.
5. Botón **"Run workflow"** → **"Run workflow"**.
6. Espera unos 4–6 minutos.
7. Abre la ejecución terminada y descarga el archivo
   **APK-Evidencias-Notaria** de la sección *Artifacts*.
8. Descomprime el `.zip`: dentro está `EvidenciasNotaria-debug.apk`.

A partir de ahí, cada vez que cambies algo dentro de `app-evidencias/` y hagas
push a `main`, el APK se vuelve a generar solo.

### Instalar en el celular

1. Pasa el `.apk` al celular (WhatsApp, correo, cable USB, Drive…).
2. Ábrelo desde el gestor de archivos.
3. Android pedirá permitir la instalación de **orígenes desconocidos**: acepta.
4. Listo. El icono aparece como **Evidencias Notaría**.

> El APK de *debug* funciona perfectamente y no requiere ninguna configuración.
> El de *release* solo cambia en que va firmado con tu propia clave; hace falta
> si algún día quieres publicarlo en Google Play.

---

## APK de release firmado (opcional)

Solo si quieres un APK firmado con tu propia clave.

### 1. Crear la clave (una sola vez, en tu PC con Java instalado)

```bash
keytool -genkeypair -v -keystore notaria.jks -keyalg RSA -keysize 2048 \
        -validity 10000 -alias notaria
```

Te pedirá una contraseña y algunos datos. **Guarda el archivo `notaria.jks` y la
contraseña en un lugar seguro**: si los pierdes no podrás publicar
actualizaciones de la misma aplicación.

### 2. Convertir la clave a texto

```bash
# Windows (PowerShell)
[Convert]::ToBase64String([IO.File]::ReadAllBytes("notaria.jks")) | Set-Clipboard

# Linux / Mac
base64 -w 0 notaria.jks
```

### 3. Cargar los secrets en GitHub

En el repositorio → **Settings → Secrets and variables → Actions → New repository secret**:

| Nombre              | Valor                                       |
| ------------------- | ------------------------------------------- |
| `KEYSTORE_BASE64`   | el texto largo del paso 2                   |
| `KEYSTORE_PASSWORD` | la contraseña del keystore                  |
| `KEY_ALIAS`         | `notaria`                                   |
| `KEY_PASSWORD`      | la contraseña de la clave (suele ser la misma) |

En la siguiente ejecución del workflow aparecerá también
`EvidenciasNotaria.apk` (el firmado).

### 4. Publicar una versión descargable

Crea una **Release** en GitHub (pestaña *Releases* → *Draft a new release*) con
una etiqueta como `v1.0.0`. El workflow adjunta el APK a esa Release y así
tienes un enlace fijo para compartir con el personal de la notaría.

---

## Compilar en tu propio PC (alternativa)

Requiere [Android Studio](https://developer.android.com/studio) instalado.

```bash
cd app-evidencias
npm install
npm run build
npx cap sync android
npx cap open android      # abre Android Studio
```

En Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.

O directamente por consola:

```bash
npm run apk:debug
# el APK queda en android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Configuración

### Cambiar la clave de acceso

Está en [`src/config.js`](src/config.js), constante `CLAVE_ACCESO`. Debe coincidir
con la constante `ADMIN_PASSWORD` de `src/App.jsx` en la web. Después de
cambiarla hay que volver a generar el APK.

### Cambiar la versión de la app

En `android/app/build.gradle`, sube `versionCode` (número entero, +1 cada vez) y
`versionName` (el texto que ve el usuario, por ejemplo `"1.1"`). Android no deja
instalar encima un APK con un `versionCode` menor.

### Cambiar el proyecto de Firebase

En [`src/firebase.js`](src/firebase.js). Debe ser el mismo proyecto que usa la web.

---

## Aviso de seguridad

La clave de acceso está escrita dentro del APK y las reglas de Firebase están
abiertas. Esto significa que:

- La clave evita que alguien que tome el celular prestado suba documentos.
- **No** protege el bucket de Firebase Storage: quien conozca la configuración
  del proyecto puede subir o borrar archivos sin pasar por la app.

Para protección real hay que activar **Firebase Authentication**, crear usuarios
por persona y cerrar las reglas de Firestore y Storage para exigir sesión
iniciada. Es un cambio que afecta también a la página web.

---

## Estructura del proyecto

```
app-evidencias/
├── src/
│   ├── config.js            Clave de acceso y ajustes generales
│   ├── firebase.js          Conexión a Firebase (igual que la web)
│   ├── App.jsx              Sesión, navegación y datos en tiempo real
│   ├── styles.css           Estilos
│   ├── lib/
│   │   ├── evidencias.js    Carpetas, subidas y borrados en Firebase
│   │   └── escaner.js       Cámara → PDF
│   └── screens/
│       ├── Login.jsx
│       ├── Carpetas.jsx
│       └── Archivos.jsx
├── android/                 Proyecto Android nativo (generado por Capacitor)
├── capacitor.config.json    Nombre, id y ajustes de la app
└── vite.config.js
```
