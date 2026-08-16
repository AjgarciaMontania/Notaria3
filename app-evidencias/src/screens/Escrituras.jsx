import { useState, useRef } from 'react';
import { Browser } from '@capacitor/browser';
import {
  agregarEscritura,
  subirSoporteYMarcarEnviadas,
  revertirEnvio,
  eliminarEscritura,
  formatoFechaEnvio,
  subirReciboRegistro,
  quitarReciboRegistro,
  diasHabilesDesde,
  DIAS_HABILES_REGISTRO,
} from '../lib/escrituras.js';
import { tomarFoto, prepararPagina, fotosAPdf, nombreEscaneo } from '../lib/escaner.js';
import PaginasEscaneadas from '../componentes/PaginasEscaneadas.jsx';

const FILTROS = [
  { id: 'pendientes', texto: 'Pendientes' },
  { id: 'registro', texto: 'En registro' },
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
  // { paginas: [], recibo?: escritura }. Si trae "recibo", lo escaneado es el
  // comprobante de pago de ESA escritura, no el soporte de envío del lote.
  const [escaneo, setEscaneo] = useState(null);
  const [formulario, setFormulario] = useState(null); // datos de la escritura nueva
  const [guardando, setGuardando] = useState(false);
  const inputArchivo = useRef(null);
  // A qué escritura pertenece el archivo que se está eligiendo (si es un recibo)
  const reciboPara = useRef(null);
  const enCurso = useRef(false);

  const mostrar = (tipo, texto, ms = 5000) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), ms);
  };

  const visibles = escrituras.filter((e) =>
    filtro === 'pendientes' ? !e.enviado && !e.enRegistro
      : filtro === 'registro' ? e.enRegistro && !e.enviado
        : filtro === 'enviadas' ? e.enviado
          : true
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

  // ── Recibo de pago: es de UNA escritura, no del lote ──────────────────────
  const subirRecibo = async (archivo, nombre, escritura) => {
    if (enCurso.current) return;
    enCurso.current = true;
    setTrabajando(`Subiendo ${nombre}…`);
    try {
      await subirReciboRegistro(archivo, nombre, escritura);
      setEscaneo(null);
      mostrar('ok', `Escritura ${escritura.numeroEscritura} marcada como pagada y en registro.`);
    } catch (error) {
      console.error(error);
      mostrar('error', `No se pudo adjuntar el recibo: ${error.message}`, 9000);
    } finally {
      enCurso.current = false;
      setTrabajando(null);
    }
  };

  const quitarRegistro = async (escritura) => {
    if (!window.confirm(
      `¿Quitar el estado "en registro" de la escritura ${escritura.numeroEscritura}?\n\n` +
      'Se eliminará el recibo y volverá a pendiente.'
    )) return;
    try {
      await quitarReciboRegistro(escritura);
      mostrar('ok', 'Escritura devuelta a pendiente.');
    } catch (error) {
      mostrar('error', `No se pudo quitar: ${error.message}`, 9000);
    }
  };

  const alElegirPdf = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    // El mismo selector sirve para el soporte del lote y para el recibo de una
    // escritura: lo que decide es a quién se le pidió.
    if (reciboPara.current?.id) {
      const destino = reciboPara.current;
      reciboPara.current = null;
      await subirRecibo(archivo, archivo.name, destino);
    } else {
      await enviarConSoporte(archivo, archivo.name);
    }
  };

  /** Abre el selector de archivos para el recibo de una escritura concreta. */
  const elegirArchivoRecibo = (escritura) => {
    reciboPara.current = escritura;
    inputArchivo.current?.click();
  };

  // ── Escáner ───────────────────────────────────────────────────────────────
  const agregarPagina = async (origen) => {
    try {
      const foto = await tomarFoto(origen);
      // El filtro tarda algo menos de un segundo por foto; se avisa para que
      // no parezca que la aplicación se colgó.
      setTrabajando('Limpiando la foto…');
      const pagina = await prepararPagina(foto);
      setEscaneo((e) => ({ ...(e || {}), paginas: [...(e?.paginas || []), pagina] }));
    } catch (error) {
      if (!/cancel/i.test(error?.message || '')) mostrar('error', 'No se pudo tomar la foto');
    } finally {
      setTrabajando(null);
    }
  };

  /** Cambia qué versión de una página se va a usar: escáner, gris u original. */
  const cambiarVersion = (i, cual) => {
    setEscaneo((e) => ({
      ...e,
      paginas: e.paginas.map((p, x) => (x === i ? { ...p, elegida: cual } : p)),
    }));
  };

  // Se conserva el resto del estado: si esto es el recibo de una escritura,
  // quitar una página no puede borrar a cuál pertenece.
  const quitarPagina = (i) =>
    setEscaneo((e) => ({ ...e, paginas: e.paginas.filter((_, x) => x !== i) }));

  /**
   * Abre el escáner. Si se le pasa una escritura, lo escaneado será el RECIBO
   * de esa escritura; si no, el soporte de envío del lote seleccionado.
   *
   * Se comprueba que traiga `id` a propósito: si este método se conecta por
   * error como `onClick={iniciarEscaneo}`, React le entrega el evento del clic
   * y sin esta comprobación lo tomaría por una escritura. Eso fue justo lo que
   * pasó: el botón del lote terminaba pidiendo "guardar recibo de la escritura
   * undefined" y fallaba con "Escritura no válida".
   */
  const iniciarEscaneo = async (escritura = null) => {
    const recibo = escritura && escritura.id ? escritura : null;
    setEscaneo({ paginas: [], recibo });
    await agregarPagina('camara');
  };

  const guardarEscaneo = async () => {
    const paginas = escaneo?.paginas || [];
    if (!paginas.length) return;
    setTrabajando('Generando PDF…');
    try {
      const pdf = await fotosAPdf(paginas);
      if (escaneo.recibo?.id) {
        await subirRecibo(pdf, nombreEscaneo(), escaneo.recibo);
      } else {
        await enviarConSoporte(pdf, nombreEscaneo());
      }
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

  const borrar = async (registro) => {
    const ok = window.confirm(
      `¿Eliminar la escritura ${registro.numeroEscritura} — ${registro.acto}?\n\n` +
        'Esta acción no se puede deshacer.'
    );
    if (!ok) return;
    try {
      const archivosBorrados = await eliminarEscritura(registro, escrituras);
      setSeleccion((p) => p.filter((x) => x !== registro.id));
      mostrar(
        'ok',
        archivosBorrados > 0
          ? `Escritura eliminada junto con ${archivosBorrados} archivo(s).`
          : 'Escritura eliminada.'
      );
    } catch (error) {
      mostrar('error', `No se pudo eliminar: ${error.message}`, 9000);
    }
  };

  /** Abre un documento en el visor del sistema; si falla, en el navegador. */
  const abrirEnlace = async (url) => {
    if (!url) return;
    try {
      await Browser.open({ url, presentationStyle: 'fullscreen' });
    } catch {
      window.open(url, '_blank');
    }
  };

  const abrirSoporte = (registro) => abrirEnlace(registro.soporteURL);

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
            <h1>{escaneo.recibo?.id ? 'Escanear recibo' : 'Escanear soporte'}</h1>
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
            <PaginasEscaneadas
              paginas={escaneo.paginas}
              onCambiar={cambiarVersion}
              onQuitar={quitarPagina}
            />
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
            {trabajando ||
              (escaneo.recibo?.id
                ? `Guardar recibo de la escritura ${escaneo.recibo.numeroEscritura || ''}`.trim()
                : `Adjuntar a ${seleccion.length} y marcar enviadas`)}
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
                <div
                  className={`tarjeta-escritura${
                    e.enviado ? ' enviada' : e.enRegistro ? ' en-registro' : ''
                  }`}
                >
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

                  {/* Pagada y en registro: la etapa previa al envío */}
                  {e.enRegistro ? (
                    <div className="escritura-registro">
                      <span>
                        🧾 Pagada el {formatoFechaEnvio(e.fechaRegistro)}
                        {!e.enviado && (() => {
                          const dias = diasHabilesDesde(e.fechaRegistro);
                          return dias > DIAS_HABILES_REGISTRO
                            ? ` · ⚠ ${dias} días hábiles`
                            : ` · ${dias} de ${DIAS_HABILES_REGISTRO} días`;
                        })()}
                      </span>
                      <div className="fila-botones">
                        {e.reciboURL && (
                          <button className="boton gris" onClick={() => abrirEnlace(e.reciboURL)}>
                            📎 Ver recibo
                          </button>
                        )}
                        {!e.enviado && (
                          <button className="boton fantasma peligro" onClick={() => quitarRegistro(e)}>
                            Quitar
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    !e.enviado && (
                      <div className="registrar-opciones">
                        <span>🧾 Recibo de pago</span>
                        <div className="fila-botones">
                          <button className="boton gris" onClick={() => iniciarEscaneo(e)}>
                            📷 Foto
                          </button>
                          <button className="boton gris" onClick={() => elegirArchivoRecibo(e)}>
                            📄 Archivo
                          </button>
                        </div>
                      </div>
                    )
                  )}

                  {!e.enviado && (
                    <button className="borrar-escritura" onClick={() => borrar(e)}>
                      🗑️ Eliminar escritura
                    </button>
                  )}

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
                        <button className="boton gris" onClick={() => borrar(e)}>
                          🗑️ Eliminar
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
            <button className="boton naranja" onClick={() => iniciarEscaneo()} disabled={Boolean(trabajando)}>
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
