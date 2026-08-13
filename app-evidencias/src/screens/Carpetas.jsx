import { useState } from 'react';
import { crearCarpeta } from '../lib/evidencias.js';

export default function Carpetas({ carpetas, archivos, cargando, onAbrir, onSalir }) {
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const contarArchivos = (nombre) =>
    archivos.filter((a) => a.folder === nombre).length;

  const guardar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await crearCarpeta(nuevoNombre, carpetas);
      setNuevoNombre('');
      setMostrarNueva(false);
      setAviso({ tipo: 'ok', texto: 'Carpeta creada' });
    } catch (error) {
      setAviso({ tipo: 'error', texto: error.message });
    } finally {
      setGuardando(false);
      setTimeout(() => setAviso(null), 3000);
    }
  };

  return (
    <div className="pantalla">
      <header className="barra">
        <div>
          <h1>Evidencias</h1>
          <span className="barra-sub">
            {carpetas.length} {carpetas.length === 1 ? 'carpeta' : 'carpetas'}
          </span>
        </div>
        <button className="boton fantasma" onClick={onSalir}>
          Salir
        </button>
      </header>

      <main className="contenido">
        {aviso && <div className={`aviso ${aviso.tipo}`}>{aviso.texto}</div>}

        {mostrarNueva ? (
          <form className="tarjeta form-nueva" onSubmit={guardar}>
            <label htmlFor="nombre-carpeta">Nombre de la nueva carpeta</label>
            <input
              id="nombre-carpeta"
              type="text"
              value={nuevoNombre}
              onChange={(e) => setNuevoNombre(e.target.value)}
              placeholder="Ej: Escrituras Agosto 2026"
              autoFocus
            />
            <div className="fila-botones">
              <button
                type="button"
                className="boton gris"
                onClick={() => {
                  setMostrarNueva(false);
                  setNuevoNombre('');
                }}
              >
                Cancelar
              </button>
              <button type="submit" className="boton principal" disabled={guardando}>
                {guardando ? 'Creando…' : 'Crear'}
              </button>
            </div>
          </form>
        ) : (
          <button className="boton principal ancho" onClick={() => setMostrarNueva(true)}>
            + Nueva carpeta
          </button>
        )}

        {cargando ? (
          <div className="centrado">
            <div className="spinner" />
            <p className="tenue">Cargando carpetas…</p>
          </div>
        ) : carpetas.length === 0 ? (
          <div className="vacio">
            <div className="vacio-icono">📁</div>
            <p>Todavía no hay carpetas.</p>
            <p className="tenue">Crea la primera para empezar a subir documentos.</p>
          </div>
        ) : (
          <ul className="lista">
            {carpetas.map((carpeta) => {
              const total = contarArchivos(carpeta.name);
              return (
                <li key={carpeta.id}>
                  <button className="item" onClick={() => onAbrir(carpeta)}>
                    <span className="item-icono">📁</span>
                    <span className="item-texto">
                      <strong>{carpeta.name}</strong>
                      <small>
                        {total} {total === 1 ? 'archivo' : 'archivos'}
                      </small>
                    </span>
                    <span className="item-flecha">›</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
