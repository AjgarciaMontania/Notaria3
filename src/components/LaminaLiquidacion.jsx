// Lámina de la liquidación: lo que se convierte en imagen para entregarle al
// cliente. Es la misma idea que la del celular, pero pensada para imprimirse o
// enviarse desde el computador.
//
// Va oculta fuera de la pantalla y solo se "fotografía" al pulsar el botón, así
// que no estorba en la tabla ni se ve mientras se trabaja.
import { forwardRef } from "react";
import { formatCOP } from "../utils/formatters";
import ucncLogo from "../assets/ucnc.jpg";

const NOMBRE_NOTARIA = "NOTARÍA ÚNICA DE CARTAGENA DEL CHAIRÁ";

const fechaLarga = (iso) => {
  if (!iso) return "";
  const [a, m, d] = iso.split("-").map(Number);
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
    "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${d} de ${meses[m - 1]} de ${a}`;
};

const LaminaLiquidacion = forwardRef(function LaminaLiquidacion(
  { documentos = [], actos = [], totales, fechaPago, sueltos = [] },
  ref
) {
  if (!totales) return <div ref={ref} />;

  const fila = (etiqueta, valor, clase = "") => (
    <div className={`lam-fila ${clase}`}>
      <span>{etiqueta}</span>
      <strong>{formatCOP(valor)}</strong>
    </div>
  );

  return (
    <div ref={ref} className="lam">
      <div className="lam-cabecera">
        <img src={ucncLogo} alt="" className="lam-escudo" />
        <div>
          <h1>{NOMBRE_NOTARIA}</h1>
          <p>Liquidación de derechos notariales y de registro</p>
        </div>
      </div>

      <div className="lam-fecha">
        Liquidado para pago el <strong>{fechaLarga(fechaPago)}</strong>
      </div>

      {documentos.map((doc) => {
        const suyos = doc.indices.map((i) => actos[i]).filter(Boolean);
        const varios = suyos.length > 1;
        return (
          <div className="lam-doc" key={doc.clave}>
            <div className="lam-doc-titulo">
              <strong>
                Escritura N° {doc.numeroEscritura || "—"}
                {doc.fechaEscritura && ` · ${doc.fechaEscritura}`}
              </strong>
              {varios && <span>{suyos.length} actos</span>}
            </div>

            <table className="lam-tabla">
              <thead>
                <tr>
                  <th>ACTO</th>
                  <th>VALOR DEL ACTO</th>
                  <th>IMPUESTO</th>
                  <th>REGISTRO</th>
                </tr>
              </thead>
              <tbody>
                {suyos.map((a, i) => (
                  <tr key={i}>
                    <td>{a.acto}</td>
                    <td className="num">{a.valorActo || "—"}</td>
                    <td className="num">{formatCOP(a.tributaria || 0)}</td>
                    <td className="num">{formatCOP(a.orip || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="lam-doc-pie">
              {doc.diasVencidos > 0 ? (
                <div className="lam-fila mora">
                  <span>
                    Intereses de mora · {doc.diasVencidos} días
                    {doc.desglose?.length > 1 && ` · ${doc.desglose.length} meses`}
                  </span>
                  <strong>{formatCOP(doc.mora)}</strong>
                </div>
              ) : (
                <div className="lam-fila tenue">
                  <span>Sin mora: dentro del plazo de 2 meses</span>
                  <strong>{formatCOP(0)}</strong>
                </div>
              )}
              {fila(varios ? "Total de la escritura" : "Total del acto", doc.total, "total-doc")}
            </div>
          </div>
        );
      })}

      {sueltos.length > 0 && (
        <div className="lam-doc">
          <div className="lam-doc-titulo"><strong>Otros conceptos</strong></div>
          <table className="lam-tabla">
            <tbody>
              {sueltos.map((a, i) => (
                <tr key={i}>
                  <td>{a.acto}</td>
                  <td className="num" colSpan={3}>{formatCOP(a.total || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="lam-totales">
        {fila("Subtotal", totales.subtotal)}
        {fila("Honorarios", totales.honorarios)}
        {fila("Retiros", totales.retiros)}
        {fila("TOTAL A CONSIGNAR", totales.totalConsignar, "destacado")}
        {totales.dineroEnviado > 0 && (
          <>
            {fila("Dinero enviado", totales.dineroEnviado)}
            {fila("Sobrante", totales.sobrante, totales.sobrante >= 0 ? "positivo" : "negativo")}
          </>
        )}
      </div>

      <p className="lam-nota">
        Los intereses de mora corren por día: esta liquidación es válida para el
        pago realizado el {fechaLarga(fechaPago)}. Si se consigna otro día, debe
        liquidarse de nuevo.
      </p>
    </div>
  );
});

export default LaminaLiquidacion;
