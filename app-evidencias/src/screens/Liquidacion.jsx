import { useState, useRef, useMemo } from 'react';
import { liquidar, MORA_ANNUAL_RATE } from '@calculo/motorLiquidacion.js';
import { ACTOS_CONFIG } from '@calculo/actosConfig.js';
import { formatCOP, formatNumberWithPoints } from '@calculo/formatters.js';
import { useTarifas } from '../lib/tarifas.js';
import { generarYCompartir } from '../lib/imagenLiquidacion.js';
import { NOMBRE_NOTARIA } from '../config.js';
import escudo from '../assets/escudo.png';

const HOY = new Date().toISOString().split('T')[0];
const TIPOS = Object.keys(ACTOS_CONFIG);

const ACTO_VACIO = () => ({
  acto: 'COMPRAVENTA',
  numeroEscritura: '',
  fechaEscritura: HOY,
  foliosAdicionales: 0,
  valorActo: '',
  numActos: 1,
});

export default function Liquidacion({ onSalir }) {
  const { tasaAnual, tasasHistoricas } = useTarifas();
  const [actos, setActos] = useState([]);
  const [fechaPago, setFechaPago] = useState(HOY);
  const [dineroEnviado, setDineroEnviado] = useState('');
  const [formulario, setFormulario] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [generando, setGenerando] = useState(false);
  const lamina = useRef(null);

  const mostrar = (tipo, texto, ms = 5000) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), ms);
  };

  // El motor se recalcula solo cuando cambia algo: no hay botón "Calcular"
  const resultado = useMemo(
    () =>
      liquidar(actos, {
        fechaPago,
        tasaMoraDefault: tasaAnual ?? MORA_ANNUAL_RATE,
        tasasHistoricas,
        dineroEnviado,
      }),
    [actos, fechaPago, tasaAnual, tasasHistoricas, dineroEnviado]
  );

  const { totales, documentos = [], mesesSinTasa = [] } = resultado;

  // Actos que no pasan por ORIP (IGAC, escritura para saber): no forman
  // documento, se muestran sueltos al final.
  const sueltos = resultado.actos
    .map((a, i) => ({ a, i }))
    .filter(({ a }) => a.tributaria === null);

  const guardarActo = (e) => {
    e.preventDefault();
    if (formulario.indice === null) {
      setActos((p) => [...p, { ...formulario.datos }]);
    } else {
      setActos((p) => p.map((a, i) => (i === formulario.indice ? { ...formulario.datos } : a)));
    }
    setFormulario(null);
  };

  const quitarActo = (indice) => {
    if (!window.confirm('¿Quitar este acto de la liquidación?')) return;
    setActos((p) => p.filter((_, i) => i !== indice));
  };

  const limpiar = () => {
    if (!actos.length) return;
    if (!window.confirm('¿Borrar toda la liquidación y empezar de nuevo?')) return;
    setActos([]);
    setDineroEnviado('');
    setFechaPago(HOY);
  };

  const compartirImagen = async () => {
    if (!actos.length || generando) return;
    setGenerando(true);
    try {
      const { guardadaEn } = await generarYCompartir(lamina.current);
      mostrar('ok', `Imagen guardada en ${guardadaEn}`);
    } catch (error) {
      console.error(error);
      mostrar('error', `No se pudo generar la imagen: ${error.message}`, 9000);
    } finally {
      setGenerando(false);
    }
  };

  // ══ Formulario de acto ════════════════════════════════════════════════════
  if (formulario) {
    const d = formulario.datos;
    const cambiar = (clave, valor) =>
      setFormulario({ ...formulario, datos: { ...d, [clave]: valor } });
    const config = ACTOS_CONFIG[d.acto] || {};
    const llevaValor = config.oripTipo === 'cuantia' || config.oripTipo === 'none';
    const llevaNumActos = config.oripTipo === 'sin_cuantia';

    return (
      <div className="pantalla">
        <header className="barra">
          <button className="boton fantasma" onClick={() => setFormulario(null)}>
            ‹ Cancelar
          </button>
          <div className="barra-centro">
            <h1>{formulario.indice === null ? 'Agregar acto' : 'Editar acto'}</h1>
          </div>
        </header>

        <form className="contenido" onSubmit={guardarActo}>
          <div className="campo">
            <label htmlFor="tipo">Tipo de acto</label>
            <select id="tipo" value={d.acto} onChange={(e) => cambiar('acto', e.target.value)}>
              {TIPOS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="campo">
            <label htmlFor="num">N° de escritura</label>
            <input
              id="num"
              value={d.numeroEscritura}
              onChange={(e) => cambiar('numeroEscritura', e.target.value)}
              placeholder="Ej: 077"
              inputMode="numeric"
            />
            <small className="tenue">
              Si varios actos van en la misma escritura, escribe el mismo número en
              todos: la mora se calcula sobre el documento completo.
            </small>
          </div>

          <div className="campo">
            <label htmlFor="fecha">Fecha de la escritura</label>
            <input
              id="fecha"
              type="date"
              value={d.fechaEscritura}
              onChange={(e) => cambiar('fechaEscritura', e.target.value)}
            />
          </div>

          {llevaValor && (
            <div className="campo">
              <label htmlFor="valor">Valor del acto</label>
              <input
                id="valor"
                inputMode="numeric"
                value={d.valorActo}
                onChange={(e) =>
                  cambiar('valorActo', formatNumberWithPoints(e.target.value.replace(/[^\d]/g, '')))
                }
                placeholder="Ej: 64.000.000"
              />
            </div>
          )}

          {llevaNumActos && (
            <div className="campo">
              <label htmlFor="nactos">Número de actos sin cuantía</label>
              <input
                id="nactos"
                type="number"
                min="1"
                value={d.numActos}
                onChange={(e) => cambiar('numActos', parseInt(e.target.value, 10) || 1)}
              />
            </div>
          )}

          <div className="campo">
            <label htmlFor="folios">Folios adicionales</label>
            <input
              id="folios"
              type="number"
              min="0"
              value={d.foliosAdicionales}
              onChange={(e) => cambiar('foliosAdicionales', parseInt(e.target.value, 10) || 0)}
            />
          </div>

          <button type="submit" className="boton principal ancho">
            {formulario.indice === null ? 'Agregar a la liquidación' : 'Guardar cambios'}
          </button>
        </form>
      </div>
    );
  }

  // ══ Pantalla principal ════════════════════════════════════════════════════
  const fila = (etiqueta, valor, clase = '') => (
    <div className={`total-fila ${clase}`}>
      <span>{etiqueta}</span>
      <strong>{formatCOP(valor)}</strong>
    </div>
  );

  return (
    <div className="pantalla">
      <header className="barra">
        <div>
          <h1>Liquidación</h1>
          <span className="barra-sub">
            {actos.length} {actos.length === 1 ? 'acto' : 'actos'}
            {tasaAnual != null && ` · mora ${(tasaAnual * 100).toFixed(2)}%`}
          </span>
        </div>
        <button className="boton fantasma" onClick={onSalir}>
          Salir
        </button>
      </header>

      <main className="contenido">
        {aviso && <div className={`aviso ${aviso.tipo}`}>{aviso.texto}</div>}

        {mesesSinTasa.length > 0 && (
          <div className="aviso error">
            ⚠ Faltan las tasas de usura de {mesesSinTasa.join(", ")}. Esos días sí
            se cobraron, pero con la tasa de respaldo
            {tasaAnual != null && ` (${(tasaAnual * 100).toFixed(2)}%)`}, que puede
            no ser la real. Pídele al administrador que las cargue en la página.
          </div>
        )}

        <div className="campo">
          <label htmlFor="fpago">📅 Fecha de pago / registro ORIP</label>
          <input
            id="fpago"
            type="date"
            value={fechaPago}
            onChange={(e) => setFechaPago(e.target.value)}
          />
        </div>

        <button
          className="boton principal ancho"
          onClick={() => setFormulario({ indice: null, datos: ACTO_VACIO() })}
        >
          + Agregar acto
        </button>

        {actos.length === 0 ? (
          <div className="vacio">
            <div className="vacio-icono">🧮</div>
            <p>Todavía no hay actos.</p>
            <p className="tenue">
              Agrega el primero y la liquidación se calcula sola.
            </p>
          </div>
        ) : (
          <>
            {/* Lo que se convierte en imagen */}
            <div className="lamina" ref={lamina}>
              <div className="lamina-cabecera">
                <img src={escudo} alt="" className="lamina-escudo" />
                <div>
                  <strong>{NOMBRE_NOTARIA}</strong>
                  <span>
                    Liquidación notarial ·{' '}
                    {new Date().toLocaleDateString('es-CO', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              {documentos.map((doc) => {
                const suyos = doc.indices.map((i) => resultado.actos[i]);
                const varios = suyos.length > 1;
                return (
                  <div className="lamina-acto" key={doc.clave}>
                    {/* Encabezado: solo cuando la escritura trae varios actos */}
                    {varios && (
                      <div className="lamina-doc-cabecera">
                        <strong>📄 Escritura N° {doc.numeroEscritura || "—"}</strong>
                        <span>{doc.fechaEscritura} · {suyos.length} actos</span>
                      </div>
                    )}

                    {suyos.map((a, j) => (
                      <div key={j} className={varios ? "lamina-subacto" : ""}>
                        <div className="lamina-acto-titulo">
                          <strong>{varios ? `└ ${a.acto}` : a.acto}</strong>
                          {!varios && a.numeroEscritura && <span>N° {a.numeroEscritura}</span>}
                        </div>
                        <div className="lamina-detalle">
                          {!varios && a.fechaEscritura && (
                            <div><span>Fecha</span><span>{a.fechaEscritura}</span></div>
                          )}
                          {a.valorActo && (
                            <div><span>Valor del acto</span><span>{a.valorActo}</span></div>
                          )}
                          {a.foliosAdicionales > 0 && (
                            <div><span>Folios adicionales</span><span>{a.foliosAdicionales}</span></div>
                          )}
                          <div><span>Tributaria</span><span>{formatCOP(a.tributaria)}</span></div>
                          <div><span>ORIP</span><span>{formatCOP(a.orip)}</span></div>
                          {varios && (
                            <div className="lamina-subtotal-acto">
                              <span>Subtotal del acto</span><span>{formatCOP(a.total)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* La mora se cobra UNA sola vez por escritura */}
                    <div className="lamina-detalle lamina-cierre-doc">
                      {doc.diasVencidos > 0 ? (
                        <>
                          <div><span>Días vencidos</span><span>{doc.diasVencidos}</span></div>
                          <div>
                            <span>
                              Intereses de mora
                              {doc.desglose.length > 1 && ` (${doc.desglose.length} meses)`}
                            </span>
                            <span>{formatCOP(doc.mora)}</span>
                          </div>
                        </>
                      ) : (
                        <div><span>Mora</span><span>Dentro del plazo</span></div>
                      )}
                      <div className="lamina-total-acto">
                        <span>{varios ? "Total de la escritura" : "Total del acto"}</span>
                        <span>{formatCOP(doc.total)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {sueltos.map(({ a, i }) => (
                <div className="lamina-acto" key={`suelto-${i}`}>
                  <div className="lamina-acto-titulo">
                    <strong>{a.acto}</strong>
                    {a.numeroEscritura && <span>N° {a.numeroEscritura}</span>}
                  </div>
                  <div className="lamina-detalle">
                    <div className="lamina-total-acto">
                      <span>Total del acto</span><span>{formatCOP(a.total || 0)}</span>
                    </div>
                  </div>
                </div>
              ))}

              <div className="lamina-totales">
                {fila('Subtotal', totales.subtotal)}
                {fila('Honorarios', totales.honorarios)}
                {fila('Retiros', totales.retiros)}
                {fila('TOTAL A CONSIGNAR', totales.totalConsignar, 'destacado')}
                {totales.dineroEnviado > 0 && (
                  <>
                    {fila('Dinero enviado', totales.dineroEnviado)}
                    {fila(
                      'Sobrante',
                      totales.sobrante,
                      totales.sobrante >= 0 ? 'positivo' : 'negativo'
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Controles que NO salen en la imagen */}
            <ul className="lista">
              {actos.map((a, i) => (
                <li key={i}>
                  <div className="item item-archivo">
                    <button
                      className="item-principal"
                      onClick={() => setFormulario({ indice: i, datos: { ...a } })}
                    >
                      <span className="item-icono">✏️</span>
                      <span className="item-texto">
                        <strong>{a.acto}</strong>
                        <small>
                          {a.numeroEscritura ? `N° ${a.numeroEscritura}` : 'sin número'}
                          {a.valorActo ? ` · ${a.valorActo}` : ''}
                        </small>
                      </span>
                    </button>
                    <button className="item-borrar" onClick={() => quitarActo(i)} aria-label="Quitar acto">
                      🗑️
                    </button>
                  </div>
                </li>
              ))}
            </ul>

            <div className="campo">
              <label htmlFor="dinero">Dinero enviado</label>
              <input
                id="dinero"
                inputMode="numeric"
                value={dineroEnviado}
                onChange={(e) =>
                  setDineroEnviado(formatNumberWithPoints(e.target.value.replace(/[^\d]/g, '')))
                }
                placeholder="Opcional"
              />
            </div>

            <div className="fila-botones">
              <button className="boton gris" onClick={limpiar}>
                Limpiar todo
              </button>
              <button
                className="boton principal"
                onClick={compartirImagen}
                disabled={generando}
              >
                {generando ? 'Generando…' : '🖼️ Imagen'}
              </button>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
