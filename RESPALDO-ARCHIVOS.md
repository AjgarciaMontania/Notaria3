# Respaldo de los archivos escaneados

Notaría Única de Cartagena del Chairá

---

## Por qué hay dos respaldos distintos

La información de la notaría vive en dos sitios de Firebase, y cada uno se
respalda por su lado:

| Qué | Dónde vive | Cómo se respalda |
|---|---|---|
| Escrituras, evidencias, historial de liquidaciones, usuarios, tarifas | Firestore | Botón **🗄️ Respaldo** de la página web |
| Los PDF escaneados y las fotos | Storage | El comando de este documento |

El botón de la página guarda los **datos** y los **enlaces** a los documentos.
No guarda los documentos: un solo PDF escaneado pesa más que todo el resto
junto. Si alguien borra un archivo de Storage, el enlace que quedó en ese
respaldo ya no lleva a ninguna parte.

Este comando es el que se lleva los documentos de verdad.

---

## Cómo se hace

En el computador donde está el proyecto, abre una ventana de comandos en la
carpeta `notaria-liquidacion` y escribe:

```
npm run respaldo:archivos
```

Pide el correo y la clave. Tiene que ser una cuenta con nivel **admin** o
**personal**: son las únicas que las reglas de Storage dejan leer los
documentos. La clave no se ve mientras se escribe y no queda guardada en
ninguna parte.

De ahí en adelante va solo. Va diciendo cada archivo que baja.

### Dónde queda

Sin decirle nada, en la carpeta `respaldo-archivos`, al lado de la carpeta del
proyecto. Para mandarlo a una USB o a un disco externo:

```
npm run respaldo:archivos -- --destino=D:\respaldo-notaria
```

**Ojo con dónde se guarda.** El programa se niega a guardar dentro de la carpeta
del proyecto, y es a propósito: el proyecto se sube a GitHub con `git add -A`,
que agrega todo lo que encuentre. Si los escaneos cayeran ahí adentro, el
siguiente `git push` publicaría en internet los documentos de la notaría.

### Cada cuánto

Una vez al mes va bien, junto con el botón 🗄️ Respaldo de la página. Los dos
respaldos van de la mano: los datos sin los documentos sirven a medias, y al
revés también.

Guarda la carpeta en una USB o un disco aparte, no en el mismo computador. Un
respaldo que se pierde con el computador no era un respaldo.

---

## La primera vez toma varios días

Firebase, en el plan gratuito, deja bajar **1 GB por día**. Si la notaría ya
tiene varios gigas escaneados, la primera copia no cabe en un solo día.

El programa lo tiene previsto: se detiene solo al llegar a 900 MB, avisa cuántos
archivos faltan, y **al día siguiente sigue justo donde quedó**. Hay que correr
el mismo comando varios días seguidos hasta que diga *"Respaldo al día"*.

De ahí en adelante ya no vuelve a pasar: cada mes solo baja lo nuevo, que son
unos pocos megas.

Para ver cuánto falta sin bajar nada:

```
npm run respaldo:archivos -- --revisar
```

---

## Qué hace por dentro

- Recorre las tres carpetas de Storage: `evidencias`, `soportes-escrituras` y
  `recibos-registro`, con todo lo que tengan adentro.
- Guarda cada archivo con la misma organización que tiene en Firebase, así que
  la carpeta del respaldo se puede abrir y entender sin ningún programa
  especial.
- Lleva un índice (`_indice-respaldo.json`) con lo que ya bajó. Por eso no
  repite trabajo y por eso puede continuar si se corta.
- Si alguien **reemplaza** un documento en Firebase, lo nota y baja la versión
  nueva.
- Si un archivo se borra del computador, la próxima vuelta lo repone.
- Los nombres con caracteres que Windows no admite (`: ? * " < > |`) se guardan
  con guion bajo; la ruta verdadera queda anotada en el índice.

Si alguna carpeta no se puede leer, el programa **no dice que quedó al día**:
avisa cuál faltó y termina con error. Un respaldo incompleto que parece completo
es peor que no tener respaldo.

---

## Si algún día se agrega una carpeta nueva en Storage

Hay que agregarla en dos sitios, o los documentos nuevos quedarán sin respaldo
sin que nadie se entere:

1. `firebase/storage.rules` — para que se pueda usar.
2. `herramientas/respaldo-archivos.mjs`, en la lista `CARPETAS` de arriba — para
   que se respalde.

---

## Reponer un archivo

Se sube otra vez desde la página o desde el celular, por el módulo que
corresponda. El respaldo es una copia normal de archivos: se abre la carpeta, se
busca el documento y se vuelve a adjuntar.

---

## El seguro que Google ya trae

Google Cloud Storage guarda los archivos borrados durante **7 días** antes de
eliminarlos de verdad (*soft delete*, activado por defecto). Si alguien borra
algo por error y se descubre esa misma semana, todavía se puede recuperar desde
la consola de Google Cloud.

Eso cubre el descuido de ayer. No cubre el de hace un mes, ni que se pierda la
cuenta. Para eso es este respaldo.
