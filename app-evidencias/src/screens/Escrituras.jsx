import { useState, useRef } from 'react';
import { Browser } from '@capacitor/browser';
import {
  agregarEscritura,
  subirSoporteYMarcarEnviadas,
  revertirEnvio,
  formatoFechaEnvio,
} from '../lib/escrituras.js';
import { tomarFoto, fotosAPdf, nombreEscaneo } from '../lib/escaner.js';

const FILTROS = [
  { id: 'pendientes', texto: 'Pendientes' },
  { id: 'enviadas', texto: 'Enviadas' },
  { id: 'todas', texto: 'Todas' },
];

const ENTRADA_VACIA = {
  acto: '',
  numeroEscritura: '',
  fechaEscritura: '',
  matricula: '',
  notaDevolutiva: 'NO',
  motivo: '',
};

export default function Escrituras({ escrituras, cargando, onSalir }) {
  const [filtro, setFiltro] = useState('pendientes');
  const [seleccion, setSeleccion] = useState([]);
  const [aviso, setAviso] = useState(null);
  const [trabajando, setTrabajando] = useState(null); // texto a mostrar mientras sube
  const [escaneo, setEscaneo] = useState(null);       // { paginas: [] }
  const [formulario, setFormulario] = useState(null); // datos de la escritura nueva
  const [guardando, setGuardando] = useState(false);
  const inputArchivo = useRef(null);
  const enCurso = useRef(false);

  const mostrar = (tipo, texto, ms = 5000) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), ms);
  };

  const visibles = escrituras.filter((e) =>
    filtro === 'pendientes' ? !e.enviado : filtro === 'enviadas' ? e.enviado : true
  );
  const pendientes = escrituras.filter((e) => !e.enviado);

  const alternar = (id) => {
    setSeleccion((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const elegidas = () => escrituras.filter((e) => seleccion.includes(e.id));

  // ── Subida del soporte, venga de donde venga ──────────────────────────────
  const enviarConSoporte = async (archivo, nombre) => {
    if (enCurso.current) return;
    enCurso.current = true;
    setTrabajando(`Subiendo ${nombre}…`);
    try {
      const cuantas = await subirSoporteYMarcarEnviadas(archivo, nombre, elegidas());
      setSeleccion([]);
      setEscaneo(null);
      mostrar(
        'ok',
        `${cuantas} ${cuantas === 1 ? 'escritura marcada como enviada' : 'escrituras marcadas como enviadas'}`
      );
    } catch (error) {
      console.error(error);
      mostrar('error', `No se pudo adjuntar el soporte: ${error.message}`, 9000);
    } finally {
      enCurso.current = false;
      setTrabajando(null);
    }
  };

  const alElegirPdf = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (archivo) await enviarConSoporte(archivo, archivo.name);
  };

  // ── Escáner ───────────────────────────────────────────────────────────────
  const agregarPagina = async (origen) => {
    try {
      const foto = await tomarFoto(origen);
      setEscaneo((e) => ({ paginas: [...(e?.paginas || []), foto] }));
    } catch (error) {
      if (!/cancel/i.test(error?.message || '')) mostrar('error', 'No se pudo tomar la foto');
    }
  };

  const iniciarEscaneo = async () => {
    setEscaneo({ paginas: [] });
    await agregarPagina('camara');
  };

  const guardarEscaneo = async () => {
    const paginas = escaneo?.paginas || [];
    if (!paginas.length) return;
    setTrabajando('Generando PDF…');
    try {
      const pdf = await fotosAPdf(paginas);
      await enviarConSoporte(pdf, nombreEscaneo());
    } catch (error) {
      mostrar('error', `No se pudo generar el PDF: ${error.message}`, 9000);
      setTrabajando(null);
    }
  };

  // ── Revertir ──────────────────────────────────────────────────────────────
  const devolverAPendiente = async (registro) => {
    const ok = window.confirm(
      `¿Devolver la escritura ${registro.numeroEscritura} al estado pendiente?\n\n` +
        'Se le quitará el soporte. Si ninguna otra lo está usando, el archivo también se eliminará.'
    );
    if (!ok) return;
    try {
      const borrado = await revertirEnvio(registro, escrituras);
      mostrar(
        'ok',
        borrado
          ? 'Devuelta a pendiente y soporte eliminado.'
          : 'Devuelta a pendiente. El soporte sigue disponible para las demás.'
      );
    } catch (error) {
      mostrar('error', `No se pudo revertir: ${error.message}`, 9000);
    }
  };

  const abrirSoporte = async (registro) => {
    try {
      await Browser.open({ url: registro.soporteURL, presentationStyle: 'fullscreen' });
    } catch {
      window.open(registro.soporteURL, '_blank');
    }
  };

  // ── Guardar escritura nueva ───────────────────────────────────────────────
  const guardarNueva = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await agregarEscritura(formulario);
      setFormulario(null);
      mostrar('ok', 'Escritura agregada');
    } catch (error) {
      mostrar('error', error.message, 7000);
    } finally {
      setGuardando(false);
    }
  };

  // ══ Pantalla del escáner ══════════════════════════════════════════════════
  if (escaneo) {
    return (
      <div className="pantalla">
        <header className="barra">
          <button className="boton fantasma" onClick={() => setEscaneo(null)}>
            ‹ Cancelar
          </button>
          <div className="barra-centro">
            <h1>Escanear soporte</h1>
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
              <p>Toma una foto de cada página del oficio de envío.</p>
            </div>
          ) : (
            <div className="paginas">
              {escaneo.paginas.map((pagina, i) => (
                <div className="pagina" key={i}>
                  <img src={pagina} alt={`Página ${i + 1}`} />
                  <span className="pagina-num">{i + 1}</span>
                  <button
                    className="pagina-quitar"
                    onClick={() =>
                      setEscaneo((e) => ({ paginas: e.paginas.filter((_, x) => x !== i) }))
                    }
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
            disabled={!escaneo.paginas.length || Boolean(trabajando)}
          >
            {trabajando || `Adjuntar a ${seleccion.length} y marcar enviadas`}
          </button>
        </main>
      </div>
    );
  }

  // ══ Formulario de escritura nueva ═════════════════════════════════════════
  if (formulario) {
    const campo = (clave, etiqueta, extra = {}) => (
      <div className="campo">
        <label htmlFor={clave}>{etiqueta}</label>
        <input
          id={clave}
          value={formulario[clave]}
          onChange={(ev) => setFormulario({ ...formulario, [clave]: ev.target.value })}
          {...extra}
        />
      </div>
    );

    return (
      <div className="pantalla">
        <header className="barra">
          <button className="boton fantasma" onClick={() => setFormulario(null)}>
            ‹ Cancelar
          </button>
          <div className="barra-centro">
            <h1>Nueva escritura</h1>
          </div>
        </header>

        <form className="contenido" onSubmit={guardarNueva}>
          {campo('acto', 'Acto', { placeholder: 'Ej: COMPRAVENTA', autoFocus: true })}
          {campo('numeroEscritura', 'N° de escritura', { placeholder: 'Ej: 077', inputMode: 'numeric' })}
          {campo('fechaEscritura', 'Fecha de la escritura', { type: 'date' })}
          {campo('matricula', 'Matrícula inmobiliaria', { placeholder: 'Ej: 420-113130' })}

          <div className="campo">
            <label htmlFor="nota">¿Tiene nota devolutiva?</label>
            <select
              id="nota"
              value={formulario.notaDevolutiva}
              onChange={(ev) => setFormulario({ ...formulario, notaDevolutiva: ev.target.value })}
            >
              <option value="NO">No</option>
              <option value="SI">Sí</option>
            </select>
          </div>

          {campo('motivo', 'Motivo (opcional)', { placeholder: 'Solo si tiene nota devolutiva' })}

          <button type="submit" className="boton principal ancho" disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar escritura'}
          </button>
        </form>
      </div>
    );
  }

  // ══ Listado ═══════════════════════════════════════════════════════════════
  return (
    <div className="pantalla">
      <header className="barra">
        <div>
          <h1>Escrituras</h1>
          <span className="barra-sub">
            {pendientes.length} {pendientes.length === 1 ? 'pendiente' : 'pendientes'} de{' '}
            {escrituras.length}
          </span>
        </div>
        <button className="boton fantasma" onClick={onSalir}>
          Salir
        </button>
      </header>

      <main className="contenido">
        {aviso && <div className={`aviso ${aviso.tipo}`}>{aviso.texto}</div>}

        <div className="filtros">
          {FILTROS.map((f) => (
            <button
              key={f.id}
              className={`chip${filtro === f.id ? ' chip-activo' : ''}`}
              onClick={() => setFiltro(f.id)}
            >
              {f.texto}
            </button>
          ))}
        </div>

        <button className="boton gris ancho" onClick={() => setFormulario({ ...ENTRADA_VACIA })}>
          + Nueva escritura
        </button>

        {cargando ? (
          <div className="centrado">
            <div className="spinner" />
            <p className="tenue">Cargando escrituras…</p>
          </div>
        ) : visibles.length === 0 ? (
          <div className="vacio">
            <div className="vacio-icono">📋</div>
            <p>
              {filtro === 'pendientes'
                ? 'No hay escrituras pendientes.'
                : filtro === 'enviadas'
                  ? 'Todavía no has enviado ninguna.'
                  : 'No hay escrituras registradas.'}
            </p>
          </div>
        ) : (
          <ul className="lista">
            {visibles.map((e) => (
              <li key={e.id}>
                <div className={`tarjeta-escritura${e.enviado ? ' enviada' : ''}`}>
                  <div className="escritura-cabecera">
                    {!e.enviado && (
                      <input
                        type="checkbox"
                        checked={seleccion.includes(e.id)}
                        onChange={() => alternar(e.id)}
                        aria-label={`Seleccionar escritura ${e.numeroEscritura}`}
                      />
                    )}
                    <div className="escritura-titulo">
                      <strong>N° {e.numeroEscritura}</strong>
                      <small>{e.acto}</small>
                    </div>
                    {e.notaDevolutiva === 'SI' && <span className="etiqueta-roja">Nota dev.</span>}
                  </div>

                  <div className="escritura-datos">
                    {e.fechaEscritura && <span>📅 {e.fechaEscritura}</span>}
                    {e.matricula && <span>🏠 {e.matricula}</span>}
                  </div>

                  {e.motivo && <p className="escritura-motivo">{e.motivo}</p>}

                  {e.enviado && (
                    <div className="escritura-envio">
                      <span>✅ Enviada el {formatoFechaEnvio(e.fechaEnvio)}</span>
                      <div className="fila-botones">
                        {e.soporteURL && (
                          <button className="boton gris" onClick={() => abrirSoporte(e)}>
                            📎 Ver soporte
                          </button>
                        )}
                        <button className="boton gris" onClick={() => devolverAPendiente(e)}>
                          ↩ A pendiente
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      <input
        ref={inputArchivo}
        type="file"
        accept="application/pdf,.pdf,image/*"
        onChange={alElegirPdf}
        hidden
      />

      {/* Barra de acción: aparece al seleccionar escrituras */}
      {seleccion.length > 0 && (
        <div className="pie-fijo">
          <p className="pie-titulo">
            {seleccion.length}{' '}
            {seleccion.length === 1 ? 'escritura seleccionada' : 'escrituras seleccionadas'}
          </p>
          <div className="fila-botones">
            <button className="boton naranja" onClick={iniciarEscaneo} disabled={Boolean(trabajando)}>
              📷 Escanear
            </button>
            <button
              className="boton principal"
              onClick={() => inputArchivo.current?.click()}
              disabled={Boolean(trabajando)}
            >
              📄 Elegir PDF
            </button>
          </div>
          <button className="boton fantasma ancho" onClick={() => setSeleccion([])}>
            Cancelar selección
          </button>
        </div>
      )}

      {trabajando && (
        <div className="subida">
          <div className="subida-info">
            <span className="subida-nombre">{trabajando}</span>
          </div>
          <div className="barra-progreso">
            <div className="barra-progreso-relleno indeterminado" />
          </div>
        </div>
      )}
    </div>
  );
}
