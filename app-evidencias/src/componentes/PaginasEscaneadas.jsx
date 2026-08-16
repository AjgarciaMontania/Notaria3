// Las páginas ya tomadas, con el selector de filtro de cada una.
//
// Lo usan las dos pantallas que escanean —Escrituras y Archivos— para que el
// escáner se vea y se comporte igual en las dos.
import { formatearTamano } from '../lib/filtroEscaner.js';
import { dataUrlDePagina } from '../lib/escaner.js';

const VERSIONES = [
  { id: 'byn', texto: 'Escáner', ayuda: 'Blanco y negro, como un escáner. El más limpio y el más liviano.' },
  { id: 'gris', texto: 'Gris', ayuda: 'Limpia la sombra pero conserva los grises. Para sellos o firmas muy claras.' },
  { id: 'original', texto: 'Original', ayuda: 'La foto tal como la tomó la cámara, sin tocar.' },
];

export default function PaginasEscaneadas({ paginas, onCambiar, onQuitar }) {
  if (!paginas.length) return null;

  // Cuánto va a pesar lo elegido, y cuánto habría pesado sin filtro.
  const elegido = paginas.reduce((t, p) => t + (p[p.elegida]?.bytes || 0), 0);
  const sinFiltro = paginas.reduce((t, p) => t + (p.original?.bytes || 0), 0);
  const ahorro = sinFiltro > 0 ? Math.round((1 - elegido / sinFiltro) * 100) : 0;

  return (
    <>
      <div className="paginas">
        {paginas.map((pagina, i) => (
          <div className="pagina" key={i}>
            <img src={dataUrlDePagina(pagina)} alt={`Página ${i + 1}`} />
            <span className="pagina-num">{i + 1}</span>
            <button
              className="pagina-quitar"
              onClick={() => onQuitar(i)}
              aria-label={`Quitar página ${i + 1}`}
            >
              ✕
            </button>

            <div className="filtros-pagina">
              {VERSIONES.map((v) => {
                // Si el filtro no se pudo aplicar (un celular sin memoria, por
                // ejemplo), esa versión no existe y no se ofrece: es preferible
                // un botón menos que uno que no hace nada.
                const version = pagina[v.id];
                if (!version) return null;
                return (
                  <button
                    key={v.id}
                    title={v.ayuda}
                    className={`chip-filtro${pagina.elegida === v.id ? ' activo' : ''}`}
                    onClick={() => onCambiar(i, v.id)}
                  >
                    <strong>{v.texto}</strong>
                    <small>{formatearTamano(version.bytes)}</small>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="resumen-peso">
        El PDF llevará <strong>{formatearTamano(elegido)}</strong>
        {sinFiltro > elegido && ` · sin filtro serían ${formatearTamano(sinFiltro)} (${ahorro}% menos)`}
        {sinFiltro < elegido && ` · sin filtro serían ${formatearTamano(sinFiltro)}`}
      </p>
    </>
  );
}
