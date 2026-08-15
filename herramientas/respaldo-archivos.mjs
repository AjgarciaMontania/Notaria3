#!/usr/bin/env node
/**
 * RESPALDO DE LOS ARCHIVOS DE STORAGE
 * Notaría Única de Cartagena del Chairá
 *
 * El botón "🗄️ Respaldo" de la página web guarda los REGISTROS (escrituras,
 * evidencias, liquidaciones, usuarios, tarifas) y los enlaces a los documentos.
 * Este programa baja LOS DOCUMENTOS: los PDF escaneados y las fotos.
 *
 * Cómo se usa, desde la carpeta del proyecto:
 *
 *     npm run respaldo:archivos
 *
 * Pide el correo y la clave de una cuenta con nivel admin o personal (son las
 * únicas que las reglas de Storage dejan leer los documentos), y va bajando
 * todo a una carpeta, conservando la misma organización que tiene en Firebase.
 *
 * Opciones:
 *     npm run respaldo:archivos -- --destino=D:\respaldo-notaria
 *     npm run respaldo:archivos -- --limite=500        (megas máximos por vuelta)
 *     npm run respaldo:archivos -- --revisar           (no baja nada; solo cuenta)
 *
 * ES INCREMENTAL: lo que ya está bajado no se vuelve a bajar. Se puede correr
 * todos los meses y solo traerá lo nuevo. Si se corta a la mitad (se fue la
 * luz, se acabó la cuota), se vuelve a correr y sigue donde quedó.
 *
 * ── EL LÍMITE DE 1 GB AL DÍA ────────────────────────────────────────────────
 * El plan gratuito de Firebase deja bajar 1 GB por día. Si la notaría ya tiene
 * varios gigas de escaneos, la PRIMERA copia no cabe en un solo día: hay que
 * correr el programa varios días seguidos y cada vez continuará donde quedó.
 * De ahí en adelante, como solo baja lo nuevo, sobra de a mucho.
 * Por eso el programa se detiene solo al llegar a 900 MB.
 */

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getStorage, ref, listAll, getMetadata, getDownloadURL } from "firebase/storage";
import { mkdir, writeFile, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// La misma configuración que usa la página web.
const CONFIG = {
  apiKey: "AIzaSyA-h8Zy18sYDNuJihLLM0H7lxA2ct9gfUk",
  authDomain: "notaria-liquidacion.firebaseapp.com",
  projectId: "notaria-liquidacion",
  storageBucket: "notaria-liquidacion.firebasestorage.app",
  messagingSenderId: "564468614815",
  appId: "1:564468614815:web:d055a708bb9c1cfdc844aa",
};

/**
 * Las carpetas que se respaldan. Son exactamente las que las reglas de Storage
 * permiten leer (firebase/storage.rules). El resto del bucket está cerrado, así
 * que listarlo daría error de permisos.
 *
 * ⚠️ SI ALGÚN DÍA SE AGREGA UNA CARPETA NUEVA EN storage.rules, HAY QUE
 * AGREGARLA TAMBIÉN AQUÍ. Si no, esos documentos quedarían sin respaldo y nadie
 * se daría cuenta hasta que hicieran falta.
 */
const CARPETAS = ["evidencias", "soportes-escrituras", "recibos-registro"];

const LIMITE_POR_DEFECTO_MB = 900;   // por debajo del giga diario del plan gratuito
const INTENTOS = 3;
const NOMBRE_INDICE = "_indice-respaldo.json";

// ── Argumentos ──────────────────────────────────────────────────────────────

function leerArgumentos() {
  const args = process.argv.slice(2);
  const valor = (nombre) => {
    const encontrado = args.find((a) => a.startsWith(`--${nombre}=`));
    return encontrado ? encontrado.slice(nombre.length + 3) : null;
  };
  const limiteCrudo = valor("limite");
  const limite = limiteCrudo ? Number(limiteCrudo) : LIMITE_POR_DEFECTO_MB;
  if (!Number.isFinite(limite) || limite <= 0) {
    throw new Error(`--limite debe ser un número de megas. Recibí: "${limiteCrudo}"`);
  }
  return {
    destino: valor("destino"),
    limiteMB: limite,
    revisar: args.includes("--revisar"),
  };
}

// ── Dónde se guarda ─────────────────────────────────────────────────────────

const raizProyecto = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * El destino NO puede quedar dentro del proyecto.
 *
 * El proyecto es un repositorio de GitHub y el comando de siempre es
 * `git add -A`, que agrega TODO lo que encuentre. Si los escaneos cayeran aquí
 * adentro, el primer `git push` publicaría en internet los documentos de la
 * notaría. Por eso el programa se niega, sin excepción.
 */
function comprobarDestino(destino) {
  const relativo = path.relative(raizProyecto, destino);
  const estaDentro = relativo === "" || (!relativo.startsWith("..") && !path.isAbsolute(relativo));
  if (estaDentro) {
    throw new Error(
      "El destino no puede estar dentro de la carpeta del proyecto.\n\n" +
      `  Destino pedido: ${destino}\n` +
      `  Proyecto:       ${raizProyecto}\n\n` +
      "Este proyecto se sube a GitHub con `git add -A`, que agrega todo lo que\n" +
      "encuentre. Los escaneos de la notaría terminarían publicados en internet.\n" +
      "Elige una carpeta aparte, idealmente una USB o un disco externo:\n\n" +
      "  npm run respaldo:archivos -- --destino=D:\\respaldo-notaria"
    );
  }
}

// ── Preguntas por consola ───────────────────────────────────────────────────

function preguntar(texto, oculto = false) {
  return new Promise((resolver, rechazar) => {
    process.stdout.write(texto);
    const entrada = process.stdin;
    let valor = "";

    if (!oculto) {
      entrada.setEncoding("utf8");
      entrada.resume();
      const alLeer = (trozo) => {
        valor += trozo;
        const corte = valor.indexOf("\n");
        if (corte >= 0) {
          entrada.pause();
          entrada.off("data", alLeer);
          resolver(valor.slice(0, corte).replace(/\r$/, "").trim());
        }
      };
      entrada.on("data", alLeer);
      return;
    }

    // Clave: se lee tecla por tecla para no dejarla escrita en la pantalla.
    if (!entrada.isTTY) {
      rechazar(new Error(
        "No hay teclado disponible para pedir la clave.\n" +
        "Corre el programa desde una ventana de comandos, o define las variables\n" +
        "NOTARIA_CORREO y NOTARIA_CLAVE antes de ejecutarlo."
      ));
      return;
    }
    entrada.setRawMode(true);
    entrada.resume();
    entrada.setEncoding("utf8");
    const alLeer = (trozo) => {
      for (const tecla of trozo) {
        if (tecla === "\r" || tecla === "\n" || tecla === "\u0004") {
          entrada.setRawMode(false);
          entrada.pause();
          entrada.off("data", alLeer);
          process.stdout.write("\n");
          resolver(valor);
          return;
        }
        if (tecla === "\u0003") {           // Ctrl+C
          entrada.setRawMode(false);
          process.stdout.write("\n");
          process.exit(130);
        }
        if (tecla === "\u007f" || tecla === "\b") {
          valor = valor.slice(0, -1);
        } else if (tecla >= " ") {
          valor += tecla;
        }
      }
    };
    entrada.on("data", alLeer);
  });
}

// ── Utilidades ──────────────────────────────────────────────────────────────

const megas = (bytes) => (bytes / 1024 / 1024).toFixed(1);

/**
 * Windows no admite : ? * " < > | \ en los nombres, y Storage sí los permite.
 * Se cambian por guion bajo para poder guardar el archivo. La ruta verdadera
 * queda anotada en el índice, así que no se pierde de dónde salió.
 */
function nombreSeguro(segmento) {
  return segmento.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").replace(/[. ]+$/, "") || "_";
}

function rutaLocal(destino, rutaStorage) {
  return path.join(destino, ...rutaStorage.split("/").map(nombreSeguro));
}

async function conReintentos(descripcion, tarea) {
  let ultimoFallo;
  for (let intento = 1; intento <= INTENTOS; intento++) {
    try {
      return await tarea();
    } catch (fallo) {
      ultimoFallo = fallo;
      if (intento < INTENTOS) {
        await new Promise((r) => setTimeout(r, 1000 * intento));
      }
    }
  }
  throw new Error(`${descripcion}: ${ultimoFallo?.message || ultimoFallo}`);
}

/** Recorre una carpeta de Storage y todas las que tenga adentro. */
async function listarTodo(storage, ruta, encontrados = []) {
  const contenido = await conReintentos(
    `No se pudo listar "${ruta}"`,
    () => listAll(ref(storage, ruta))
  );
  for (const archivo of contenido.items) encontrados.push(archivo.fullPath);
  for (const subcarpeta of contenido.prefixes) {
    await listarTodo(storage, subcarpeta.fullPath, encontrados);
  }
  return encontrados;
}

async function leerIndice(destino) {
  const archivo = path.join(destino, NOMBRE_INDICE);
  if (!existsSync(archivo)) return {};
  try {
    const datos = JSON.parse(await readFile(archivo, "utf8"));
    return datos.archivos || {};
  } catch {
    console.warn("⚠ El índice anterior estaba dañado; se rehace desde cero.");
    return {};
  }
}

async function guardarIndice(destino, archivos, correo) {
  await writeFile(
    path.join(destino, NOMBRE_INDICE),
    JSON.stringify({
      generadoEn: new Date().toISOString(),
      generadoPor: correo,
      bucket: CONFIG.storageBucket,
      version: 1,
      archivos,
    }, null, 2),
    "utf8"
  );
}

/**
 * ¿Ya está bajado y es el mismo? Se comparan la "generación" (el número que
 * Firebase le cambia cada vez que el archivo se reemplaza) y el tamaño en
 * disco. Si alguien reemplazó el documento en Firebase, la generación cambia
 * y se vuelve a bajar.
 */
async function yaEstaAlDia(destino, ruta, anotado, meta) {
  if (!anotado || anotado.generation !== meta.generation) return false;
  const local = rutaLocal(destino, ruta);
  if (!existsSync(local)) return false;
  const enDisco = await stat(local);
  return enDisco.size === Number(meta.size);
}

// ── Programa ────────────────────────────────────────────────────────────────

async function principal() {
  const { destino: destinoPedido, limiteMB, revisar } = leerArgumentos();

  const destino = path.resolve(destinoPedido || path.join(raizProyecto, "..", "respaldo-archivos"));
  comprobarDestino(destino);

  console.log("\n╔══════════════════════════════════════════════════════════╗");
  console.log("║  Respaldo de los archivos de Storage                     ║");
  console.log("║  Notaría Única de Cartagena del Chairá                   ║");
  console.log("╚══════════════════════════════════════════════════════════╝\n");
  console.log(`Se guardará en:  ${destino}`);
  console.log(`Tope por vuelta: ${limiteMB} MB${revisar ? "   (modo revisar: no baja nada)" : ""}\n`);

  const correo = process.env.NOTARIA_CORREO || await preguntar("Correo:  ");
  const clave = process.env.NOTARIA_CLAVE || await preguntar("Clave:   ", true);

  const app = initializeApp(CONFIG);
  const auth = getAuth(app);
  const storage = getStorage(app);

  try {
    await signInWithEmailAndPassword(auth, correo, clave);
  } catch (fallo) {
    const codigo = fallo.code || "";
    if (codigo.includes("invalid-credential") || codigo.includes("wrong-password") || codigo.includes("user-not-found")) {
      throw new Error("Correo o clave incorrectos.");
    }
    throw new Error(`No se pudo entrar: ${fallo.message}`);
  }
  console.log(`\n✓ Entró como ${correo}\n`);

  // 1. Ver qué hay
  const rutas = [];
  const carpetasFallidas = [];
  for (const carpeta of CARPETAS) {
    process.stdout.write(`Revisando ${carpeta}… `);
    try {
      const encontrados = await listarTodo(storage, carpeta);
      rutas.push(...encontrados);
      console.log(`${encontrados.length} archivo(s)`);
    } catch (fallo) {
      // Que una carpeta falle no debe tumbar el respaldo de las otras, pero
      // tiene que verse: un respaldo incompleto que parece completo es peor
      // que no tener respaldo. Por eso se anota y al final el programa se
      // niega a decir que quedó al día.
      console.log("ERROR");
      console.log(`  ⚠ ${fallo.message}`);
      carpetasFallidas.push(carpeta);
    }
  }

  /** Se imprime al final. Un respaldo a medias no puede parecer completo. */
  const avisarIncompleto = () => {
    if (carpetasFallidas.length === 0) return;
    console.log("\n══════════════════════════════════════════════════════════");
    console.log("⚠  RESPALDO INCOMPLETO");
    console.log(`   Quedó SIN respaldar: ${carpetasFallidas.join(", ")}`);
    console.log("   Casi siempre es porque la cuenta no tiene nivel admin o");
    console.log("   personal, o porque faltan por publicar las reglas de");
    console.log("   Storage. Revísalo antes de confiar en esta copia.");
    console.log("══════════════════════════════════════════════════════════");
  };

  if (rutas.length === 0) {
    console.log("\nNo hay archivos que respaldar.");
    avisarIncompleto();
    return carpetasFallidas.length === 0;
  }

  // 2. Decidir qué falta
  const indice = await leerIndice(destino);
  const pendientes = [];
  let yaEstaban = 0;
  let bytesPendientes = 0;

  process.stdout.write(`\nComparando ${rutas.length} archivo(s) con lo ya respaldado… `);
  for (const ruta of rutas) {
    const meta = await conReintentos(
      `No se pudieron leer los datos de "${ruta}"`,
      () => getMetadata(ref(storage, ruta))
    );
    if (await yaEstaAlDia(destino, ruta, indice[ruta], meta)) {
      yaEstaban++;
    } else {
      pendientes.push({ ruta, meta });
      bytesPendientes += Number(meta.size) || 0;
    }
  }
  console.log("listo");

  console.log(`\n  Ya respaldados: ${yaEstaban}`);
  console.log(`  Por bajar:      ${pendientes.length}  (${megas(bytesPendientes)} MB)\n`);

  if (revisar || pendientes.length === 0) {
    if (pendientes.length === 0 && carpetasFallidas.length === 0) {
      console.log("✅ El respaldo ya está al día.\n");
    } else if (pendientes.length === 0) {
      console.log("Lo que se pudo leer ya estaba respaldado.\n");
    } else {
      console.log("(modo revisar: no se bajó nada)\n");
    }
    avisarIncompleto();
    return carpetasFallidas.length === 0;
  }

  // 3. Bajar
  await mkdir(destino, { recursive: true });
  const tope = limiteMB * 1024 * 1024;
  let bajados = 0;
  let bytes = 0;
  let fallidos = 0;
  let cortadoPorCuota = false;

  for (const [i, { ruta, meta }] of pendientes.entries()) {
    const tamano = Number(meta.size) || 0;
    if (bytes > 0 && bytes + tamano > tope) {
      cortadoPorCuota = true;
      break;
    }
    const etiqueta = `[${i + 1}/${pendientes.length}] ${ruta}`;
    process.stdout.write(`${etiqueta} … `);
    try {
      const url = await conReintentos("No se pudo pedir el enlace", () => getDownloadURL(ref(storage, ruta)));
      const contenido = await conReintentos("No se pudo bajar", async () => {
        const respuesta = await fetch(url);
        if (!respuesta.ok) throw new Error(`el servidor respondió ${respuesta.status}`);
        return Buffer.from(await respuesta.arrayBuffer());
      });

      const local = rutaLocal(destino, ruta);
      await mkdir(path.dirname(local), { recursive: true });
      await writeFile(local, contenido);

      indice[ruta] = {
        generation: meta.generation,
        size: Number(meta.size) || contenido.length,
        contentType: meta.contentType || "",
        actualizado: meta.updated || "",
        md5: meta.md5Hash || "",
        archivoLocal: path.relative(destino, local).split(path.sep).join("/"),
      };
      bajados++;
      bytes += contenido.length;
      console.log(`✓ ${megas(contenido.length)} MB`);

      // Se guarda el índice sobre la marcha: si se corta la luz, lo bajado
      // hasta ese momento ya quedó anotado y no se repite.
      if (bajados % 10 === 0) await guardarIndice(destino, indice, correo);
    } catch (fallo) {
      fallidos++;
      console.log("✗");
      console.error(`     ${fallo.message}`);
    }
  }

  await guardarIndice(destino, indice, correo);

  // 4. Contar el cuento
  console.log("\n──────────────────────────────────────────────────────────");
  console.log(`  Bajados en esta vuelta: ${bajados}  (${megas(bytes)} MB)`);
  if (fallidos > 0) console.log(`  Con error:              ${fallidos}   ← se reintentan la próxima vez`);
  const faltan = pendientes.length - bajados - fallidos;
  if (cortadoPorCuota) {
    console.log(`  Quedan sin bajar:       ${faltan}`);
    console.log("\n⏸  Se paró al llegar al tope de la vuelta para no pasarse del");
    console.log("   giga diario que regala Firebase. Vuelve a correr el mismo");
    console.log("   comando MAÑANA y seguirá justo donde quedó.");
  } else if (fallidos === 0 && carpetasFallidas.length === 0) {
    console.log("\n✅ Respaldo al día.");
  } else if (fallidos > 0) {
    console.log("\n⚠ Terminó, pero algunos archivos fallaron. Vuelve a correrlo.");
  }
  console.log(`\n   Carpeta: ${destino}`);
  console.log("   Guárdala en una USB o disco externo, aparte del computador.");
  avisarIncompleto();
  console.log("");

  return carpetasFallidas.length === 0 && fallidos === 0;
}

principal().then(
  (completo) => process.exit(completo === false ? 1 : 0),
  (fallo) => {
    console.error(`\n❌ ${fallo.message}\n`);
    process.exit(1);
  }
);
