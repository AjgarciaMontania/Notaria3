import { useState, useRef } from 'react';
import { Browser } from '@capacitor/browser';
import {
  subirArchivo,
  eliminarArchivo,
  eliminarCarpeta,
  nombreDisponible,
} from '../lib/evidencias.js';
import { tomarFoto, fotosAPdf, nombreEscaneo } from '../lib/escaner.js';

const formatoTamano = (bytes) => {
  if (!bytes && bytes !== 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatoFecha = (iso) => {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export default function Archivos({ carpeta, archivos, onVolver }) {
  const [subiendo, setSubiendo] = useState(null); // { nombre, porcentaje, actual, total }
  const [aviso, setAviso] = useState(null);
  const [escaneo, setEscaneo] = useState(null); // { paginas: [] } cuando el escáner está abierto
  const inputArchivo = useRef(null);

  const mostrar = (tipo, texto, ms = 3500) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), ms);
  };

  const ordenados = [...archivos].sort(
    (a, b) => new Date(b.uploadDate) - new Date(a.uploadDate)
  );

  // ── Subir PDFs desde el almacenamiento del celular ────────────────────────
  const alElegirArchivos = async (e) => {
    const seleccion = Array.from(e.target.files || []);
    e.target.value = '';
    if (!seleccion.length) return;

    const noPdf = seleccion.filter(
      (f) => f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')
    );
    if (noPdf.length) {
      mostrar('error', 'Solo se pueden subir archivos PDF');
      return;
    }

    let subidos = 0;
    const fallidos = [];
    // Se acumulan los nombres ya usados para que dos archivos del mismo lote
    // no se pisen entre sí.
    const ocupados = [...archivos];

    try {
      for (let i = 0; i < seleccion.length; i++) {
        const archivo = seleccion[i];
        const nombre = nombreDisponible(archivo.name, ocupados);
        // Antes de que empiece el progreso hay una lectura completa del
        // archivo, que en PDFs grandes tarda un momento: se avisa.
        setSubiendo({
          nombre,
          porcentaje: 0,
          actual: i + 1,
          total: seleccion.length,
          leyendo: true,
        });
        try {
          await subirArchivo(archivo, nombre, carpeta.name, (p) =>
            setSubiendo((s) => (s ? { ...s, porcentaje: p, leyendo: false } : s))
          );
          ocupados.push({ fileName: nombre });
          subidos++;
        } catch (error) {
          // Un archivo con problemas no detiene el resto del lote
          console.error(error);
          fallidos.push({ nombre: archivo.name, motivo: error.message });
        }
      }

      if (fallidos.length === 0) {
        mostrar('ok', `${subidos} ${subidos === 1 ? 'archivo subido' : 'archivos subidos'}`);
      } else if (subidos === 0) {
        mostrar('error', fallidos[0].motivo, 10000);
      } else {
        mostrar(
          'parcial',
          `${subidos} de ${seleccion.length} subidos. No se pudo con: ${fallidos
            .map((f) => f.nombre)
            .join(', ')}`,
          10000
        );
      }
    } finally {
      setSubiendo(null);
    }
  };

  // ── Escanear con la cámara ────────────────────────────────────────────────
  const agregarPagina = async (origen) => {
    try {
      const foto = await tomarFoto(origen);
      setEscaneo((e) => ({ paginas: [...(e?.paginas || []), foto] }));
    } catch (error) {
      // El usuario canceló la cámara: no es un error real.
      if (!/cancel/i.test(error?.message || '')) {
        mostrar('error', 'No se pudo tomar la foto');
      }
    }
  };

  const iniciarEscaneo = async () => {
    setEscaneo({ paginas: [] });
    await agregarPagina('camara');
  };

  const quitarPagina = (indice) => {
    setEscaneo((e) => ({ paginas: e.paginas.filter((_, i) => i !== indice) }));
  };

  const guardarEscaneo = async () => {
    const paginas = escaneo?.paginas || [];
    if (!paginas.length) return;
    try {
      setSubiendo({ nombre: 'Generando PDF…', porcentaje: 0, actual: 1, total: 1 });
      const pdf = await fotosAPdf(paginas);
      const nombre = nombreDisponible(nombreEscaneo(), archivos);
      setSubiendo({ nombre, porcentaje: 0, actual: 1, total: 1 });
      await subirArchivo(pdf, nombre, carpeta.name, (p) =>
        setSubiendo((s) => (s ? { ...s, porcentaje: p } : s))
      );
      setEscaneo(null);
      mostrar('ok', `PDF de ${paginas.length} ${paginas.length === 1 ? 'página' : 'páginas'} subido`);
    } catch (error) {
      console.error(error);
      mostrar('error', `Error al guardar el escaneo: ${error.message}`);
    } finally {
      setSubiendo(null);
    }
  };

  // ── Ver / eliminar ────────────────────────────────────────────────────────
  const abrir = async (archivo) => {
    try {
      await Browser.open({ url: archivo.downloadURL, presentationStyle: 'fullscreen' });
    } catch {
      window.open(archivo.downloadURL, '_blank');
    }
  };

  const borrarArchivo = async (archivo) => {
    if (!window.confirm(`¿Eliminar "${archivo.fileName}"?`)) return;
    try {
      await eliminarArchivo(archivo.storagePath, archivo.id);
      mostrar('ok', 'Archivo eliminado');
    } catch (error) {
      mostrar('error', `No se pudo eliminar: ${error.message}`);
    }
  };

  const borrarCarpeta = async () => {
    if (!window.confirm(`¿Eliminar la carpeta "${carpeta.name}"?`)) return;
    try {
      await eliminarCarpeta(carpeta, archivos);
      onVolver();
    } catch (error) {
      mostrar('error', error.message);
    }
  };

  // ── Vista del escáner ─────────────────────────────────────────────────────
  if (escaneo) {
    return (
      <div className="pantalla">
        <header className="barra">
          <button className="boton fantasma" onClick={() => setEscaneo(null)}>
            ‹ Cancelar
          </button>
          <div className="barra-centro">
            <h1>Escanear</h1>
            <span className="barra-sub">
              {escaneo.paginas.length}{' '}
              {escaneo.paginas.length === 1 ? 'página' : 'páginas'}
            </span>
          </div>
        </header>

        <main className="contenido">
          {escaneo.paginas.length === 0 ? (
            <div className="vacio">
              <div className="vacio-icono">📷</div>
              <p>Toma una foto de cada página del documento.</p>
            </div>
          ) : (
            <div className="paginas">
              {escaneo.paginas.map((pagina, i) => (
                <div className="pagina" key={i}>
                  <img src={pagina} alt={`Página ${i + 1}`} />
                  <span className="pagina-num">{i + 1}</span>
                  <button
                    className="pagina-quitar"
                    onClick={() => quitarPagina(i)}
                    aria-label={`Quitar página ${i + 1}`}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="fila-botones">
            <button className="boton gris" onClick={() => agregarPagina('camara')}>
              📷 Otra página
            </button>
            <button className="boton gris" onClick={() => agregarPagina('galeria')}>
              🖼️ Galería
            </button>
          </div>

          <button
            className="boton principal ancho"
            onClick={guardarEscaneo}
            disabled={!escaneo.paginas.length || Boolean(subiendo)}
          >
            {subiendo ? 'Guardando…' : 'Guardar como PDF y subir'}
          </button>
        </main>

        {subiendo && <BarraSubida datos={subiendo} />}
      </div>
    );
  }

  // ── Vista normal de la carpeta ────────────────────────────────────────────
  return (
    <div className="pantalla">
      <header className="barra">
        <button className="boton fantasma" onClick={onVolver}>
          ‹ Carpetas
        </button>
        <div className="barra-centro">
          <h1 title={carpeta.name}>{carpeta.name}</h1>
          <span className="barra-sub">
            {archivos.length} {archivos.length === 1 ? 'archivo' : 'archivos'}
          </span>
        </div>
      </header>

      <main className="contenido">
        {aviso && <div className={`aviso ${aviso.tipo}`}>{aviso.texto}</div>}

        <div className="acciones">
          <button
            className="boton principal"
            onClick={() => inputArchivo.current?.click()}
            disabled={Boolean(subiendo)}
          >
            📄 Subir PDF
          </button>
          <button
            className="boton naranja"
            onClick={iniciarEscaneo}
            disabled={Boolean(subiendo)}
          >
            📷 Escanear
          </button>
        </div>

        <input
          ref={inputArchivo}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          onChange={alElegirArchivos}
          hidden
        />

        {ordenados.length === 0 ? (
          <div className="vacio">
            <div className="vacio-icono">📄</div>
            <p>Esta carpeta está vacía.</p>
            <p className="tenue">
              Sube un PDF del celular o escanea un documento con la cámara.
            </p>
            <button className="boton peligro fantasma" onClick={borrarCarpeta}>
              Eliminar esta carpeta
            </button>
          </div>
        ) : (
          <ul className="lista">
            {ordenados.map((archivo) => (
              <li key={archivo.id}>
                <div className="item item-archivo">
                  <button className="item-principal" onClick={() => abrir(archivo)}>
                    <span className="item-icono">📄</span>
                    <span className="item-texto">
                      <strong>{archivo.fileName}</strong>
                      <small>
                        {formatoTamano(archivo.size)} · {formatoFecha(archivo.uploadDate)}
                        {archivo.origen === 'apk' ? ' · celular' : ''}
                      </small>
                    </span>
                  </button>
                  <button
                    className="item-borrar"
                    onClick={() => borrarArchivo(archivo)}
                    aria-label={`Eliminar ${archivo.fileName}`}
                  >
                    🗑️
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {subiendo && <BarraSubida datos={subiendo} />}
    </div>
  );
}

function BarraSubida({ datos }) {
  return (
    <div className="subida">
      <div className="subida-info">
        <span className="subida-nombre">{datos.nombre}</span>
        {datos.total > 1 && (
          <span className="subida-contador">
            {datos.actual} de {datos.total}
          </span>
        )}
      </div>
      <div className="barra-progreso">
        <div
          className={`barra-progreso-relleno${datos.leyendo ? ' indeterminado' : ''}`}
          style={datos.leyendo ? undefined : { width: `${datos.porcentaje}%` }}
        />
      </div>
      <span className="subida-porcentaje">
        {datos.leyendo ? 'Leyendo el archivo…' : `${datos.porcentaje}%`}
      </span>
    </div>
  );
}
