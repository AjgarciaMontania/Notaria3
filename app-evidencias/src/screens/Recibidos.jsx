import { useState, useRef } from 'react';
import { crearCarpeta, subirArchivo, nombreDisponible } from '../lib/evidencias.js';
import { leerCompartido, formatoTamano } from '../lib/compartidos.js';

/**
 * Pantalla que aparece cuando otra app (ClearScanner, Drive, Archivos…)
 * comparte uno o varios PDF con Evidencias Notaría: se elige la carpeta
 * destino y se suben todos de una vez.
 */
export default function Recibidos({ archivos, carpetas, archivosExistentes, onCerrar }) {
  const [destino, setDestino] = useState(null);
  const [nuevaCarpeta, setNuevaCarpeta] = useState('');
  const [creando, setCreando] = useState(false);
  const [progreso, setProgreso] = useState(null); // { actual, total, nombre, porcentaje }
  const [resultado, setResultado] = useState(null); // { subidos, fallidos: [] }
  const [error, setError] = useState('');
  // Un doble toque en el botón podría lanzar la subida dos veces antes de que
  // React redibuje la pantalla; este cerrojo lo impide.
  const subiendo = useRef(false);

  const totalBytes = archivos.reduce((suma, a) => suma + (a.tamano || 0), 0);

  const crear = async (e) => {
    e.preventDefault();
    setCreando(true);
    setError('');
    try {
      await crearCarpeta(nuevaCarpeta, carpetas);
      setDestino(nuevaCarpeta.trim());
      setNuevaCarpeta('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCreando(false);
    }
  };

  const subirTodo = async () => {
    if (!destino || subiendo.current) return;
    subiendo.current = true;
    setError('');

    // Se va acumulando para que dos archivos del mismo lote no choquen de nombre
    const yaEnLaCarpeta = archivosExistentes.filter((a) => a.folder === destino);
    const ocupados = [...yaEnLaCarpeta];
    const fallidos = [];
    let subidos = 0;

    for (let i = 0; i < archivos.length; i++) {
      const archivo = archivos[i];
      setProgreso({
        actual: i + 1,
        total: archivos.length,
        nombre: archivo.nombre,
        porcentaje: 0,
      });

      try {
        const contenido = await leerCompartido(archivo);
        const nombre = nombreDisponible(archivo.nombre, ocupados);
        await subirArchivo(contenido, nombre, destino, (p) =>
          setProgreso((estado) => (estado ? { ...estado, porcentaje: p } : estado))
        );
        ocupados.push({ fileName: nombre });
        subidos++;
      } catch (err) {
        // Un archivo dañado no debe frenar el resto del lote
        console.error(err);
        fallidos.push({ nombre: archivo.nombre, motivo: err.message });
      }
    }

    subiendo.current = false;
    setProgreso(null);
    setResultado({ subidos, fallidos });
  };

  // ── Resumen final ─────────────────────────────────────────────────────────
  if (resultado) {
    const { subidos, fallidos } = resultado;
    return (
      <div className="pantalla">
        <header className="barra">
          <div className="barra-centro">
            <h1>Resultado</h1>
          </div>
        </header>
        <main className="contenido">
          <div className={`aviso ${fallidos.length ? 'parcial' : 'ok'}`}>
            {subidos} de {archivos.length}{' '}
            {archivos.length === 1 ? 'documento subido' : 'documentos subidos'}
            {fallidos.length > 0 && ` · ${fallidos.length} con problemas`}
          </div>

          {fallidos.length > 0 && (
            <div className="tarjeta">
              <strong>No se pudieron subir:</strong>
              <ul className="lista-simple">
                {fallidos.map((f) => (
                  <li key={f.nombre}>
                    <span className="fallido-nombre">{f.nombre}</span>
                    <small>{f.motivo}</small>
                  </li>
                ))}
              </ul>
              <p className="tenue" style={{ marginTop: '0.8rem' }}>
                Vuelve a compartirlos desde la app de origen. Si insisten en
                fallar, ábrelos primero ahí para comprobar que no estén dañados.
              </p>
            </div>
          )}

          <button className="boton principal ancho" onClick={onCerrar}>
            Listo
          </button>
        </main>
      </div>
    );
  }

  // ── Subida en curso ───────────────────────────────────────────────────────
  if (progreso) {
    return (
      <div className="pantalla">
        <header className="barra">
          <div className="barra-centro">
            <h1>Subiendo</h1>
            <span className="barra-sub">a {destino}</span>
          </div>
        </header>
        <main className="contenido">
          <div className="centrado">
            <div className="contador-grande">
              {progreso.actual} <span>de {progreso.total}</span>
            </div>
            <p className="subida-nombre">{progreso.nombre}</p>
          </div>
          <div className="barra-progreso">
            <div
              className="barra-progreso-relleno"
              style={{ width: `${progreso.porcentaje}%` }}
            />
          </div>
          <p className="tenue" style={{ textAlign: 'center' }}>
            No cierres la aplicación hasta que termine.
          </p>
        </main>
      </div>
    );
  }

  // ── Elegir carpeta destino ────────────────────────────────────────────────
  return (
    <div className="pantalla">
      <header className="barra">
        <button className="boton fantasma" onClick={onCerrar}>
          Cancelar
        </button>
        <div className="barra-centro">
          <h1>
            {archivos.length}{' '}
            {archivos.length === 1 ? 'documento' : 'documentos'}
          </h1>
          <span className="barra-sub">{formatoTamano(totalBytes)} en total</span>
        </div>
      </header>

      <main className="contenido">
        {error && <div className="aviso error">{error}</div>}

        <div className="tarjeta">
          <strong>Documentos recibidos</strong>
          <ul className="lista-simple">
            {archivos.map((a, i) => (
              <li key={`${a.ruta}-${i}`}>
                <span className="fallido-nombre">📄 {a.nombre}</span>
                <small>{formatoTamano(a.tamano)}</small>
              </li>
            ))}
          </ul>
        </div>

        <label className="titulo-seccion">¿En qué carpeta los guardo?</label>

        {carpetas.length > 0 && (
          <ul className="lista">
            {carpetas.map((carpeta) => (
              <li key={carpeta.id}>
                <button
                  className={`item${destino === carpeta.name ? ' item-elegido' : ''}`}
                  onClick={() => setDestino(carpeta.name)}
                >
                  <span className="item-icono">
                    {destino === carpeta.name ? '✅' : '📁'}
                  </span>
                  <span className="item-texto">
                    <strong>{carpeta.name}</strong>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <form className="tarjeta form-nueva" onSubmit={crear}>
          <label htmlFor="carpeta-nueva">O crea una carpeta nueva</label>
          <input
            id="carpeta-nueva"
            type="text"
            value={nuevaCarpeta}
            onChange={(e) => setNuevaCarpeta(e.target.value)}
            placeholder="Ej: Escrituras Agosto 2026"
          />
          <button
            type="submit"
            className="boton gris"
            disabled={creando || !nuevaCarpeta.trim()}
          >
            {creando ? 'Creando…' : 'Crear y usar esta carpeta'}
          </button>
        </form>
      </main>

      <div className="pie-fijo">
        <button
          className="boton principal ancho"
          onClick={subirTodo}
          disabled={!destino}
        >
          {destino
            ? `Subir ${archivos.length} a "${destino}"`
            : 'Elige una carpeta primero'}
        </button>
      </div>
    </div>
  );
}
