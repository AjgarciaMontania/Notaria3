import { useState, useRef } from 'react';
import { crearCarpeta, subirArchivo, nombreDisponible } from '../lib/evidencias.js';
import { leerCompartido, formatoTamano } from '../lib/compartidos.js';
import { subirSoporteYMarcarEnviadas } from '../lib/escrituras.js';

/**
 * Pantalla que aparece cuando otra app (ClearScanner, Drive, Archivos…)
 * comparte uno o varios PDF con Evidencias Notaría: se elige la carpeta
 * destino y se suben todos de una vez.
 */
export default function Recibidos({ archivos, carpetas, archivosExistentes, escrituras = [], onCerrar }) {
  // Primero se elige a qué módulo va lo compartido; después el detalle.
  const [modulo, setModulo] = useState(null);       // 'evidencias' | 'soporte'
  const [escriturasElegidas, setEscriturasElegidas] = useState([]);
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

  const usarComoSoporte = async () => {
    if (!escriturasElegidas.length || subiendo.current) return;
    subiendo.current = true;
    setError('');
    const soporte = archivos[0];
    setProgreso({ actual: 1, total: 1, nombre: soporte.nombre, porcentaje: 0 });
    try {
      const contenido = await leerCompartido(soporte);
      const elegidas = escrituras.filter((e) => escriturasElegidas.includes(e.id));
      const cuantas = await subirSoporteYMarcarEnviadas(contenido, soporte.nombre, elegidas);
      setProgreso(null);
      setResultado({ subidos: cuantas, fallidos: [], comoSoporte: true });
    } catch (err) {
      console.error(err);
      setProgreso(null);
      setError(err.message);
    } finally {
      subiendo.current = false;
    }
  };

  // ── Resumen final ─────────────────────────────────────────────────────────
  if (resultado) {
    const { subidos, fallidos, comoSoporte } = resultado;
    return (
      <div className="pantalla">
        <header className="barra">
          <div className="barra-centro">
            <h1>Resultado</h1>
          </div>
        </header>
        <main className="contenido">
          <div className={`aviso ${fallidos.length ? 'parcial' : 'ok'}`}>
            {comoSoporte ? (
              <>
                {subidos}{' '}
                {subidos === 1
                  ? 'escritura marcada como enviada'
                  : 'escrituras marcadas como enviadas'}
              </>
            ) : (
              <>
                {subidos} de {archivos.length}{' '}
                {archivos.length === 1 ? 'documento subido' : 'documentos subidos'}
                {fallidos.length > 0 && ` · ${fallidos.length} con problemas`}
              </>
            )}
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

  // ── Paso 1: ¿a qué módulo va lo compartido? ───────────────────────────────
  if (modulo === null) {
    const pendientes = escrituras.filter((e) => !e.enviado);
    return (
      <div className="pantalla">
        <header className="barra">
          <button className="boton fantasma" onClick={onCerrar}>
            Cancelar
          </button>
          <div className="barra-centro">
            <h1>
              {archivos.length} {archivos.length === 1 ? 'documento' : 'documentos'}
            </h1>
            <span className="barra-sub">{formatoTamano(totalBytes)} en total</span>
          </div>
        </header>

        <main className="contenido">
          <div className="tarjeta">
            <ul className="lista-simple">
              {archivos.map((a, i) => (
                <li key={`${a.ruta}-${i}`}>
                  <span className="fallido-nombre">📄 {a.nombre}</span>
                  <small>{formatoTamano(a.tamano)}</small>
                </li>
              ))}
            </ul>
          </div>

          <label className="titulo-seccion">¿Qué hago con esto?</label>

          <ul className="lista">
            <li>
              <button className="item" onClick={() => setModulo('evidencias')}>
                <span className="item-icono">📁</span>
                <span className="item-texto">
                  <strong>Guardar en Evidencias</strong>
                  <small>Elegir una carpeta y archivarlo ahí</small>
                </span>
                <span className="item-flecha">›</span>
              </button>
            </li>
            <li>
              <button
                className="item"
                onClick={() => setModulo('soporte')}
                disabled={archivos.length !== 1 || pendientes.length === 0}
              >
                <span className="item-icono">📋</span>
                <span className="item-texto">
                  <strong>Usar como soporte de envío</strong>
                  <small>
                    {archivos.length !== 1
                      ? 'Solo funciona con un documento a la vez'
                      : pendientes.length === 0
                        ? 'No hay escrituras pendientes'
                        : `Marcar escrituras como enviadas (${pendientes.length} pendientes)`}
                  </small>
                </span>
                <span className="item-flecha">›</span>
              </button>
            </li>
          </ul>
        </main>
      </div>
    );
  }

  // ── Paso 2 (soporte): elegir a qué escrituras ampara ──────────────────────
  if (modulo === 'soporte') {
    const pendientes = escrituras.filter((e) => !e.enviado);
    return (
      <div className="pantalla">
        <header className="barra">
          <button className="boton fantasma" onClick={() => setModulo(null)}>
            ‹ Atrás
          </button>
          <div className="barra-centro">
            <h1>Soporte de envío</h1>
            <span className="barra-sub">{archivos[0]?.nombre}</span>
          </div>
        </header>

        <main className="contenido">
          {error && <div className="aviso error">{error}</div>}

          <label className="titulo-seccion">
            ¿Qué escrituras ampara este soporte?
          </label>

          <ul className="lista">
            {pendientes.map((e) => (
              <li key={e.id}>
                <label className={`item${escriturasElegidas.includes(e.id) ? ' item-elegido' : ''}`}>
                  <input
                    type="checkbox"
                    checked={escriturasElegidas.includes(e.id)}
                    onChange={() =>
                      setEscriturasElegidas((p) =>
                        p.includes(e.id) ? p.filter((x) => x !== e.id) : [...p, e.id]
                      )
                    }
                  />
                  <span className="item-texto">
                    <strong>N° {e.numeroEscritura}</strong>
                    <small>{e.acto}</small>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </main>

        <div className="pie-fijo">
          <button
            className="boton principal ancho"
            onClick={usarComoSoporte}
            disabled={!escriturasElegidas.length}
          >
            {escriturasElegidas.length
              ? `Marcar ${escriturasElegidas.length} como enviadas`
              : 'Elige al menos una escritura'}
          </button>
        </div>
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
