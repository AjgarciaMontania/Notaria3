import { useState, useRef } from 'react';
import { Browser } from '@capacitor/browser';
import {
  agregarEscritura,
  actualizarEscritura,
  subirSoporteYMarcarEnviadas,
  revertirEnvio,
  eliminarEscritura,
  formatoFechaEnvio,
  subirReciboRegistro,
  quitarReciboRegistro,
  diasHabilesDesde,
  DIAS_HABILES_REGISTRO,
} from '../lib/escrituras.js';
import { ordenarPorFecha, CAMPO_FECHA_DEL_FILTRO } from '@calculo/registro.js';
import { ACTOS_PARA_ESCRITURAS, TIPOS_DE_ACTO, sePuedeLiquidar, esActoDeLaLista } from '@calculo/actoDesdeTexto.js';
import { actosParaLiquidar, actosDeEscritura, tieneVariosActos } from '@calculo/actosDeEscritura.js';
import { formatNumberWithPoints } from '@calculo/formatters.js';
import { tomarFoto, prepararPagina, fotosAPdf, nombreEscaneo } from '../lib/escaner.js';
import PaginasEscaneadas from '../componentes/PaginasEscaneadas.jsx';

const FILTROS = [
  { id: 'pendientes', texto: 'Pendientes' },
  { id: 'registro', texto: 'En registro' },
  { id: 'enviadas', texto: 'Enviadas' },
  { id: 'todas', texto: 'Todas' },
];

// Una escritura puede traer VARIOS actos: una compraventa que además cancela
// una hipoteca son dos, y cada uno paga su tarifa. Por eso el formulario lleva
// una lista y no un acto suelto. Empieza con una sola línea: el caso corriente
// sigue siendo un acto y no debe costar más que antes.
const ENTRADA_VACIA = {
  actos: [{ acto: TIPOS_DE_ACTO[0], valorActo: '' }],
  numeroEscritura: '',
  fechaEscritura: '',
  matricula: '',
  notaDevolutiva: 'NO',
  motivo: '',
};

export default function Escrituras({ escrituras, cargando, onSalir, onLiquidar }) {
  const [filtro, setFiltro] = useState('pendientes');
  // "asc" = la más antigua primero. En «En registro» esa es la que lleva más
  // tiempo esperando en la ORIP, o sea la PRÓXIMA en salir. Es el orden con el
  // que se trabaja, por eso es el que viene puesto.
  const [orden, setOrden] = useState('asc');
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
  // Escrituras cuyo detalle de actos está abierto en la lista (ids).
  const [desplegadas, setDesplegadas] = useState([]);

  const alternarDespliegue = (id) => {
    setDesplegadas((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  // ── Edición de la lista de actos del formulario ───────────────────────────
  const cambiarActo = (indice, campo, valor) => {
    setFormulario((previo) => ({
      ...previo,
      actos: previo.actos.map((a, i) => (i === indice ? { ...a, [campo]: valor } : a)),
    }));
  };
  const agregarLineaActo = () => {
    setFormulario((previo) => ({
      ...previo,
      actos: [...previo.actos, { acto: TIPOS_DE_ACTO[0], valorActo: '' }],
    }));
  };
  const quitarLineaActo = (indice) => {
    setFormulario((previo) => ({
      // Nunca se queda sin ninguna: si se quita la última, queda una en blanco.
      ...previo,
      actos: previo.actos.length > 1
        ? previo.actos.filter((_, i) => i !== indice)
        : [{ acto: TIPOS_DE_ACTO[0], valorActo: '' }],
    }));
  };
  const inputArchivo = useRef(null);
  // A qué escritura pertenece el archivo que se está eligiendo (si es un recibo)
  const reciboPara = useRef(null);
  const enCurso = useRef(false);

  const mostrar = (tipo, texto, ms = 5000) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), ms);
  };

  const sinOrdenar = escrituras.filter((e) =>
    filtro === 'pendientes' ? !e.enviado && !e.enRegistro
      : filtro === 'registro' ? e.enRegistro && !e.enviado
        : filtro === 'enviadas' ? e.enviado
          : true
  );

  // Solo «En registro» y «Enviadas» tienen fecha propia por la que ordenar.
  // «Todas» y «Pendientes» conservan el orden de captura: una escritura
  // pendiente no tiene ninguna fecha que la ponga antes o después de otra.
  //
  // Es el mismo archivo compartido que usa la página web, para que las dos
  // ordenen igual y la lista no cambie de un aparato a otro.
  const campoOrden = CAMPO_FECHA_DEL_FILTRO[filtro] || null;
  const porEstado = ordenarPorFecha(sinOrdenar, campoOrden, orden);

  // El buscador trabaja SOBRE el chip que esté puesto, no en vez de él: así
  // "en registro" + "420" da las que están en registro de esa matrícula.
  const texto = busqueda.trim().toLowerCase();
  const visibles = !texto
    ? porEstado
    : porEstado.filter((e) =>
        [e.numeroEscritura, e.matricula, e.motivo, ...actosDeEscritura(e).map((a) => a.acto)]
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

  // ── Guardar: el mismo formulario sirve para crear y para editar ──────────
  // Lo que decide es si el formulario trae `id`: si lo trae, es una escritura
  // que ya existe y se actualiza; si no, es nueva.
  const guardarNueva = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      if (formulario.id) {
        await actualizarEscritura(formulario.id, formulario);
        mostrar('ok', 'Escritura actualizada');
      } else {
        await agregarEscritura(formulario);
        mostrar('ok', 'Escritura agregada');
      }
      setFormulario(null);
    } catch (error) {
      mostrar('error', error.message, 7000);
    } finally {
      setGuardando(false);
    }
  };

  /**
   * Abre el formulario con los datos de una escritura que ya existe.
   *
   * actosDeEscritura() lee tanto la lista nueva como las escrituras viejas de
   * un solo acto, así que aquí no hay que preguntar cuál es cuál: una guardada
   * hace meses se abre igual que una de ayer.
   */
  const editar = (escritura) => {
    setFormulario({
      id: escritura.id,
      actos: actosDeEscritura(escritura).map((a) => ({
        acto: a.acto,
        valorActo: a.valorActo ? formatNumberWithPoints(String(a.valorActo)) : '',
      })),
      numeroEscritura: escritura.numeroEscritura || '',
      fechaEscritura: escritura.fechaEscritura || '',
      matricula: escritura.matricula || '',
      notaDevolutiva: escritura.notaDevolutiva || 'NO',
      motivo: escritura.motivo || '',
    });
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
            <h1>{formulario.id ? 'Editar escritura' : 'Nueva escritura'}</h1>
          </div>
        </header>

        <form className="contenido" onSubmit={guardarNueva}>
          {/* La lista trae los tipos que la liquidación sabe calcular, pero
              NUNCA impide registrar: con «Otro» el acto se escribe a mano.
              Anotar la escritura es lo primero; que además se pueda liquidar
              sola es un extra, no un requisito. */}
          {formulario.actos.map((linea, i) => (
            <div className="campo" key={i}>
              <label htmlFor={`acto-${i}`}>
                {formulario.actos.length > 1 ? `Acto ${i + 1} de ${formulario.actos.length}` : 'Acto'}
              </label>
              <select
                id={`acto-${i}`}
                value={esActoDeLaLista(linea.acto) ? linea.acto : '__otro__'}
                onChange={(ev) =>
                  cambiarActo(i, 'acto', ev.target.value === '__otro__' ? ' ' : ev.target.value)
                }
                autoFocus={i === 0}
              >
                {ACTOS_PARA_ESCRITURAS.map((t) => (
                  <option key={t} value={t}>
                    {t}{sePuedeLiquidar(t) ? '' : ' · no se liquida'}
                  </option>
                ))}
                <option value="__otro__">Otro — escribirlo a mano</option>
              </select>
              {esActoDeLaLista(linea.acto) && !sePuedeLiquidar(linea.acto) && (
                <small className="tenue">
                  Se registra normalmente, pero todavía no entra en el botón de
                  liquidar: falta un recibo que confirme su tarifa.
                </small>
              )}
              {!esActoDeLaLista(linea.acto) && (
                <>
                  <input
                    style={{ marginTop: '0.5rem' }}
                    value={linea.acto.trim() === '' ? '' : linea.acto}
                    onChange={(ev) => cambiarActo(i, 'acto', ev.target.value)}
                    placeholder="Escribe el acto"
                  />
                  <small className="tenue">
                    Se guarda tal cual. Como no está en la lista, este acto no
                    entrará en el botón de liquidar hasta que le elijas un tipo.
                  </small>
                </>
              )}

              {/* La cuantía de ESTE acto. Si todavía no se sabe, se deja en
                  blanco y queda en $0 hasta que se complete. */}
              <input
                style={{ marginTop: '0.5rem' }}
                inputMode="numeric"
                value={linea.valorActo}
                onChange={(ev) =>
                  cambiarActo(i, 'valorActo', formatNumberWithPoints(ev.target.value.replace(/[^\d]/g, '')))
                }
                placeholder="Valor del acto · déjalo vacío si aún no se sabe"
              />

              {formulario.actos.length > 1 && (
                <button
                  type="button"
                  className="boton fantasma"
                  style={{ marginTop: '0.4rem' }}
                  onClick={() => quitarLineaActo(i)}
                >
                  Quitar este acto
                </button>
              )}
            </div>
          ))}

          <button type="button" className="boton gris ancho" onClick={agregarLineaActo}>
            + Agregar otro acto a esta escritura
          </button>
          {formulario.actos.length > 1 && (
            <p className="tenue centrado-texto">
              Los {formulario.actos.length} van juntos como una sola escritura:
              cada uno paga su tarifa, pero la mora se cobra una sola vez.
            </p>
          )}
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
            {guardando ? 'Guardando…' : formulario.id ? 'Guardar cambios' : 'Guardar escritura'}
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

        {/* El orden solo aparece donde hay una fecha por la que ordenar. En
            «Pendientes» y «Todas» no se muestra: no habría por qué. */}
        {campoOrden && (
          <button
            className="orden-fecha"
            onClick={() => setOrden((p) => (p === 'asc' ? 'desc' : 'asc'))}
          >
            {orden === 'asc' ? '↑' : '↓'}{' '}
            {filtro === 'registro'
              ? orden === 'asc'
                ? 'Más antigua primero · la próxima en salir'
                : 'Más reciente primero · la última en salir'
              : orden === 'asc'
                ? 'Enviada hace más tiempo primero'
                : 'Enviada más reciente primero'}
          </button>
        )}

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
                      <small>{actosDeEscritura(e)[0].acto}</small>
                    </div>
                    {e.notaDevolutiva === 'SI' && <span className="etiqueta-roja">Nota dev.</span>}
                  </div>

                  {/* Los actos que contiene. La pastilla solo sale si de
                      verdad hay más de uno: una escritura corriente se sigue
                      viendo igual que siempre. */}
                  {tieneVariosActos(e) && (
                    <>
                      <button
                        className="pastilla-actos"
                        onClick={() => alternarDespliegue(e.id)}
                      >
                        {desplegadas.includes(e.id) ? '▾' : '▸'}{' '}
                        {actosDeEscritura(e).length} actos en esta escritura
                      </button>
                      {desplegadas.includes(e.id) && (
                        <div className="lista-actos">
                          {actosDeEscritura(e).map((a, i) => (
                            <div className="linea-acto" key={i}>
                              <span className="numero">{i + 1}</span>
                              <span className="nombre">
                                {a.acto}
                                {!sePuedeLiquidar(a.acto) && (
                                  <small className="tenue"> ⚠ no se liquida</small>
                                )}
                              </span>
                              <span className="plata">
                                {a.valorActo > 0
                                  ? `$ ${formatNumberWithPoints(String(a.valorActo))}`
                                  : 'sin cuantía'}
                              </span>
                            </div>
                          ))}
                          <p className="tenue">
                            Van juntos como una sola escritura: cada uno paga su
                            tarifa, pero la mora se cobra una sola vez.
                          </p>
                        </div>
                      )}
                    </>
                  )}

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

                  {/* Editar sirve sobre todo para desglosar en varios actos las
                      que quedaron con uno solo, y para completar la cuantía que
                      falta. No cambia el estado del trámite. */}
                  <div className="fila-botones">
                    <button className="boton gris" onClick={() => editar(e)}>
                      ✏️ Editar
                    </button>
                    {!e.enviado && (
                      <button className="boton peligro fantasma" onClick={() => borrar(e)}>
                        🗑️ Eliminar
                      </button>
                    )}
                  </div>

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
