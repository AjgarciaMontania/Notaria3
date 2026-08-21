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
import { ACTOS_PARA_ESCRITURAS, TIPOS_DE_ACTO, sePuedeLiquidar, esActoDeLaLista, actosParaLiquidar } from '@calculo/actoDesdeTexto.js';
import { formatNumberWithPoints } from '@calculo/formatters.js';
import { tomarFoto, prepararPagina, fotosAPdf, nombreEscaneo } from '../lib/escaner.js';
import PaginasEscaneadas from '../componentes/PaginasEscaneadas.jsx';

const FILTROS = [
  { id: 'pendientes', texto: 'Pendientes' },
  { id: 'registro', texto: 'En registro' },
  { id: 'enviadas', texto: 'Enviadas' },
  { id: 'todas', texto: 'Todas' },
];

const ENTRADA_VACIA = {
  acto: TIPOS_DE_ACTO[0],
  numeroEscritura: '',
  fechaEscritura: '',
  matricula: '',
  notaDevolutiva: 'NO',
  motivo: '',
  valorActo: '',
};

export default function Escrituras({ escrituras, cargando, onSalir, onLiquidar }) {
  const [filtro, setFiltro] = useState('pendientes');
  const [busqueda, setBusqueda] = useState('');
  const [seleccion, setSeleccion] = useState([]);
  const [aviso, setAviso] = useState(null);
  // { actos, sinTipo }: lo que se va a liquidar y lo que queda por fuera,
  // mientras se espera la confirmación.
  const [porDecidir, setPorDecidir] = useState(null);
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

  const porEstado = escrituras.filter((e) =>
    filtro === 'pendientes' ? !e.enviado && !e.enRegistro
      : filtro === 'registro' ? e.enRegistro && !e.enviado
        : filtro === 'enviadas' ? e.enviado
          : true
  );

  // El buscador trabaja SOBRE el chip que esté puesto, no en vez de él: así
  // "en registro" + "420" da las que están en registro de esa matrícula.
  const texto = busqueda.trim().toLowerCase();
  const visibles = !texto
    ? porEstado
    : porEstado.filter((e) =>
        [e.numeroEscritura, e.acto, e.matricula, e.motivo]
          .some((campo) => String(campo || '').toLowerCase().includes(texto))
      );
  const pendientes = escrituras.filter((e) => !e.enviado);

  const alternar = (id) => {
    setSeleccion((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const elegidas = () => escrituras.filter((e) => seleccion.includes(e.id));

  /**
   * Pasa las escrituras marcadas a la pantalla de liquidar.
   *
   * Las que tengan un acto que la liquidación no reconoce NO se dejan caer en
   * silencio: se avisa cuáles son. Una escritura que desaparece sin decir por
   * qué es peor que un aviso incómodo.
   */
  const liquidarSeleccionadas = () => {
    const elegidas = escrituras.filter((e) => seleccion.includes(e.id));
    if (!elegidas.length) return;

    const { actos, sinTipo } = actosParaLiquidar(elegidas);

    if (!actos.length) {
      mostrar(
        'error',
        `Ninguna de las ${elegidas.length} se puede liquidar: el acto que tienen escrito no está en la lista. Ábrelas y elige el acto.`,
        11000
      );
      return;
    }
    // Si alguna queda por fuera hay que detenerse a decirlo AQUÍ. El aviso de
    // siempre no sirve: al pasar a la pantalla de liquidar esta se desmonta y
    // el mensaje se va con ella sin que nadie alcance a leerlo.
    if (sinTipo.length) {
      setPorDecidir({ actos, sinTipo });
      return;
    }
    setSeleccion([]);
    onLiquidar?.(actos);
  };

  /** Confirma el paso a liquidar después de ver cuáles quedan por fuera. */
  const confirmarLiquidar = () => {
    const actos = porDecidir?.actos || [];
    setPorDecidir(null);
    setSeleccion([]);
    onLiquidar?.(actos);
  };

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
          {/* La lista trae los tipos que la liquidación sabe calcular, pero
              NUNCA impide registrar: con «Otro» el acto se escribe a mano.
              Anotar la escritura es lo primero; que además se pueda liquidar
              sola es un extra, no un requisito. */}
          <div className="campo">
            <label htmlFor="acto">Acto</label>
            <select
              id="acto"
              value={esActoDeLaLista(formulario.acto) ? formulario.acto : '__otro__'}
              onChange={(ev) =>
                setFormulario({
                  ...formulario,
                  acto: ev.target.value === '__otro__' ? ' ' : ev.target.value,
                })
              }
              autoFocus
            >
              {ACTOS_PARA_ESCRITURAS.map((t) => (
                <option key={t} value={t}>
                  {t}{sePuedeLiquidar(t) ? '' : ' · no se liquida'}
                </option>
              ))}
              <option value="__otro__">Otro — escribirlo a mano</option>
            </select>
            {esActoDeLaLista(formulario.acto) && !sePuedeLiquidar(formulario.acto) && (
              <small className="tenue">
                Se registra normalmente, pero todavía no entra en el botón de
                liquidar: falta un recibo que confirme su tarifa.
              </small>
            )}
            {!esActoDeLaLista(formulario.acto) && (
              <>
                <input
                  style={{ marginTop: '0.5rem' }}
                  value={formulario.acto.trim() === '' ? '' : formulario.acto}
                  onChange={(ev) => setFormulario({ ...formulario, acto: ev.target.value })}
                  placeholder="Escribe el acto"
                />
                <small className="tenue">
                  Se guarda tal cual. Como no está en la lista, esta escritura no
                  entrará en el botón de liquidar hasta que le elijas un tipo.
                </small>
              </>
            )}
          </div>
          {campo('numeroEscritura', 'N° de escritura', { placeholder: 'Ej: 077', inputMode: 'numeric' })}
          {campo('fechaEscritura', 'Fecha de la escritura', { type: 'date' })}
          {campo('matricula', 'Matrícula inmobiliaria', { placeholder: 'Ej: 420-113130' })}

          {/* La cuantía. Con el acto y la fecha ya se puede liquidar desde
              aquí sin volver a escribir nada. Si todavía no se sabe, se deja
              en blanco y queda en $0 hasta que se complete. */}
          <div className="campo">
            <label htmlFor="valorActo">Valor del acto</label>
            <input
              id="valorActo"
              inputMode="numeric"
              value={formulario.valorActo}
              onChange={(ev) =>
                setFormulario({
                  ...formulario,
                  valorActo: formatNumberWithPoints(ev.target.value.replace(/[^\d]/g, '')),
                })
              }
              placeholder="Ej: 64.000.000 · déjalo vacío si aún no se sabe"
            />
          </div>

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

        <div className="buscador">
          <input
            value={busqueda}
            onChange={(ev) => setBusqueda(ev.target.value)}
            placeholder="Buscar por escritura, acto o matrícula"
            inputMode="search"
          />
          {busqueda && (
            <button className="buscador-limpiar" onClick={() => setBusqueda('')} aria-label="Limpiar búsqueda">
              ✕
            </button>
          )}
        </div>
        {busqueda.trim() && (
          <p className="tenue centrado-texto">
            {visibles.length} de {porEstado.length} en «{FILTROS.find((f) => f.id === filtro)?.texto}»
          </p>
        )}

        {seleccion.length > 0 && !porDecidir && (
          <button className="boton principal ancho" onClick={liquidarSeleccionadas}>
            🧮 Liquidar {seleccion.length} {seleccion.length === 1 ? 'escritura' : 'escrituras'}
          </button>
        )}

        {porDecidir && (
          <div className="aviso parcial">
            <p>
              Se llevan <strong>{porDecidir.actos.length}</strong>{' '}
              {porDecidir.actos.length === 1 ? 'acto' : 'actos'} a liquidar.
            </p>
            <p>
              ⚠ Quedan por fuera <strong>{porDecidir.sinTipo.length}</strong>{' '}
              {porDecidir.sinTipo.length === 1 ? 'escritura' : 'escrituras'} porque su
              acto no se puede liquidar:{' '}
              <strong>
                {porDecidir.sinTipo
                  .map((e) => `N.º ${e.numeroEscritura || '?'} · ${e.acto || 'sin acto'}`)
                  .join(' — ')}
              </strong>
              . Siguen en el panel, no se pierden.
            </p>
            <button className="boton principal ancho" onClick={confirmarLiquidar}>
              Continuar y liquidar
            </button>
            <button className="boton gris ancho" onClick={() => setPorDecidir(null)}>
              Cancelar
            </button>
          </div>
        )}

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
