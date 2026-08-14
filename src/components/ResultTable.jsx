// src/components/ResultTable.jsx
import * as XLSX from 'xlsx';
import { formatCOP, formatNumberWithPoints } from "../utils/formatters";
import React, { forwardRef, useImperativeHandle, useState } from "react";
import { ACTOS_CONFIG } from "../utils/actosConfig";
import { liquidar, DESCUENTO_MORA, MORA_ANNUAL_RATE } from "../utils/motorLiquidacion.js";

// Las tarifas, la mora y los totales viven en utils/motorLiquidacion.js:
// una sola fuente de verdad compartida con la APK del celular.
//
// Una escritura puede traer varios actos. Cuando eso pasa, la Gobernación los
// liquida como UN documento y cobra una sola línea de intereses de mora sobre
// la tributaria combinada. Esta tabla se muestra igual: los actos de una misma
// escritura quedan dentro de un bloque con su encabezado y una sola mora al
// pie. Un acto solo se sigue viendo como una fila corriente.

const NUM_COLUMNAS = 12;

const ResultTable = forwardRef(({ rows, setRows, calcularDisabled, fechaPago, tasaMoraDefault, tasasHistoricas }, ref) => {
  const TASA_EFECTIVA = tasaMoraDefault ?? MORA_ANNUAL_RATE;
  const TASAS_MES = tasasHistoricas ?? {};
  const [documentos, setDocumentos] = useState([]);
  const [mesesSinTasa, setMesesSinTasa] = useState([]);

  useImperativeHandle(ref, () => ({ calcularTodo, exportToExcel }));

  const calcularTodo = (dineroEnviadoStr) => {
    if (calcularDisabled) return;

    const actos = rows.filter((r) => !r.isSummary && !r.isAdditional && !r.isNote);

    const { actos: calculados, documentos: docs, totales, mesesSinTasa: faltan } = liquidar(actos, {
      fechaPago,
      tasaMoraDefault: TASA_EFECTIVA,
      tasasHistoricas: TASAS_MES,
      dineroEnviado: dineroEnviadoStr,
    });

    setDocumentos(docs);
    setMesesSinTasa(faltan);

    setRows([
      ...calculados,
      { isSummary: true, label: "SUBTOTAL", value: totales.subtotal },
      { isSummary: true, label: "HONORARIOS", value: totales.honorarios },
      { isSummary: true, label: "RETIROS", value: totales.retiros },
      { isSummary: true, label: "TOTAL A CONSIGNAR", value: totales.totalConsignar },
      { isAdditional: true, label: "TOTAL GASTOS", value: totales.totalConsignar },
      { isAdditional: true, label: "DINERO ENVIADO", value: totales.dineroEnviado, isDinero: true },
      { isAdditional: true, label: "SOBRANTE", value: totales.sobrante, isSobrante: true },
    ]);
  };

  // ── Agrupación para pintar ─────────────────────────────────────────────────
  // Se arma desde las filas, igual que en el motor: mismo número + misma fecha.
  const actosConIndice = rows
    .map((fila, indice) => ({ fila, indice }))
    .filter(({ fila }) => !fila.isSummary && !fila.isAdditional && !fila.isNote);

  const bloques = [];
  const porClave = new Map();
  actosConIndice.forEach(({ fila, indice }) => {
    const num = String(fila.numeroEscritura ?? "").trim();
    const clave = num ? `${num}||${fila.fechaEscritura}` : `__suelto__${indice}`;
    if (!porClave.has(clave)) {
      const bloque = { clave, numeroEscritura: num, fechaEscritura: fila.fechaEscritura, items: [] };
      porClave.set(clave, bloque);
      bloques.push(bloque);
    }
    porClave.get(clave).items.push({ fila, indice });
  });

  const docDe = (clave) => documentos.find((d) => d.clave === clave);

  const cambiar = (indice, campo, valor) =>
    setRows((prev) => prev.map((r, i) => (i === indice ? { ...r, [campo]: valor } : r)));

  /** Cambia número o fecha en TODOS los actos del documento a la vez. */
  const cambiarEnBloque = (indices, campo, valor) =>
    setRows((prev) => prev.map((r, i) => (indices.includes(i) ? { ...r, [campo]: valor } : r)));

  const filasResumen = rows
    .map((fila, indice) => ({ fila, indice }))
    .filter(({ fila }) => fila.isSummary || fila.isAdditional || fila.isNote);

  // ── Excel ──────────────────────────────────────────────────────────────────
  const exportToExcel = () => {
    const data = [];

    bloques.forEach((b) => {
      const doc = docDe(b.clave);
      const varios = b.items.length > 1;

      b.items.forEach(({ fila }, posicion) => {
        data.push({
          'ESCRITURA': posicion === 0 ? (b.numeroEscritura || '(sin número)') : '',
          'FECHA': posicion === 0 ? b.fechaEscritura : '',
          'ACTO': fila.acto,
          'FOLIOS ADIC.': fila.foliosAdicionales || '',
          '# ACTOS': fila.numActos && fila.numActos > 1 ? fila.numActos : '',
          'VALOR ACTO': fila.valorActo,
          'VALOR TRIBUTARIA': fila.tributaria ? formatCOP(fila.tributaria).replace('$', '') : '',
          'VALOR ORIP': fila.orip ? formatCOP(fila.orip).replace('$', '') : '',
          'DÍAS VENC.': '',
          'MORA': '',
          TOTAL: fila.total ? formatCOP(fila.total).replace('$', '') : '',
        });
      });

      if (doc && (doc.mora > 0 || varios)) {
        data.push({
          'ESCRITURA': varios ? `TOTAL ESCRITURA ${b.numeroEscritura || ''}`.trim() : '',
          'FECHA': '', 'ACTO': doc.mora > 0 ? 'INTERESES DE MORA' : '', 'FOLIOS ADIC.': '',
          '# ACTOS': '', 'VALOR ACTO': '', 'VALOR TRIBUTARIA': '', 'VALOR ORIP': '',
          'DÍAS VENC.': doc.diasVencidos || '',
          'MORA': doc.mora ? formatCOP(doc.mora).replace('$', '') : '',
          TOTAL: formatCOP(doc.total).replace('$', ''),
        });
      }
    });

    filasResumen.forEach(({ fila }) => {
      if (fila.isNote) return;
      data.push({
        'ESCRITURA': '', 'FECHA': '', 'ACTO': '', 'FOLIOS ADIC.': '', '# ACTOS': '',
        'VALOR ACTO': '', 'VALOR TRIBUTARIA': '', 'VALOR ORIP': fila.label,
        'DÍAS VENC.': '', 'MORA': '',
        TOTAL: formatCOP(fila.value).replace('$', ''),
      });
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Liquidacion');
    XLSX.writeFile(wb, 'liquidacion_notarial.xlsx');
  };

  // ── Piezas de la tabla ─────────────────────────────────────────────────────
  const celdaActos = (fila, indice) =>
    ACTOS_CONFIG[fila.acto]?.oripTipo === "sin_cuantia" ? (
      <input
        type="number"
        min="1"
        title="Número de actos sin cuantía en el documento"
        style={{ width: "100%", textAlign: "center" }}
        value={fila.numActos ?? 1}
        onChange={(e) => cambiar(indice, "numActos", parseInt(e.target.value) || 1)}
      />
    ) : <span style={{ color: "#9ca3af" }}>—</span>;

  const celdaValor = (fila, indice) => (
    <input
      type="text"
      className="valor-acto"
      placeholder="Valor"
      value={fila.valorActo}
      onChange={(e) => {
        const raw = e.target.value.replace(/\./g, "");
        cambiar(indice, "valorActo", !isNaN(raw) && raw !== "" ? formatNumberWithPoints(parseInt(raw)) : "");
      }}
    />
  );

  const celdaFolios = (fila, indice) => (
    <input
      type="number"
      min="0"
      value={fila.foliosAdicionales}
      onChange={(e) => cambiar(indice, "foliosAdicionales", parseInt(e.target.value) || 0)}
    />
  );

  /** Celdas de mora: días, tasa editable y valor. Se usan una sola vez por documento. */
  const celdasMora = (doc, indices) => {
    if (!doc || doc.diasVencidos === 0) {
      return (
        <>
          <td style={{ textAlign: "center", color: "#9ca3af" }}>—</td>
          <td style={{ textAlign: "center", color: "#9ca3af" }}>—</td>
          <td style={{ color: "#9ca3af" }}>—</td>
        </>
      );
    }
    // Con varios meses no existe "una" tasa: se muestra la TASA EFECTIVA
    // PROMEDIO del periodo, que es la que explica el valor cobrado. Al pasar
    // el cursor se ve el desglose real mes por mes.
    const tasaMostrada = doc.tasaManual != null
      ? doc.tasaManual
      : (doc.diasVencidos > 0 && doc.tributaria > 0
          ? doc.moraExacta / (doc.tributaria * (doc.diasVencidos / 365))
          : TASA_EFECTIVA - DESCUENTO_MORA);
    const variasTasas = doc.tasaManual == null && doc.desglose.length > 1;
    const detalle = doc.desglose
      .map((m) => `${m.mes}: ${m.dias} días × ${(m.tasa * 100).toFixed(2)}% = ${formatCOP(Math.round(m.valor))}`)
      .join("\n");

    return (
      <>
        <td style={{ color: "#92400e", fontWeight: "bold", textAlign: "center" }}>{doc.diasVencidos}</td>
        <td style={{ textAlign: "center" }}>
          <input
            type="number"
            min="0"
            step="0.01"
            className="input-tasa"
            title={
              variasTasas
                ? `Se aplicó la tasa de cada mes:\n\n${detalle}\n\nSi escribes un valor aquí, se usará esa tasa fija para todo el periodo.`
                : "Tasa de mora anual (usura − 2 puntos). Edítala y vuelve a Calcular para forzar otra."
            }
            style={{
              width: "100%", textAlign: "center", fontWeight: "bold",
              color: "#92400e", border: "1px solid #d97706", background: "#fffbeb",
            }}
            value={parseFloat((tasaMostrada * 100).toFixed(2))}
            onChange={(e) => {
              const pct = parseFloat(e.target.value) || 0;
              setRows((prev) => prev.map((r, i) => (indices.includes(i) ? { ...r, tasaAnual: pct / 100 } : r)));
            }}
          />
          {variasTasas && (
            <div style={{ fontSize: "0.7rem", color: "#92400e", marginTop: "2px" }} title={detalle}>
              prom. de {doc.desglose.length} meses ▾
            </div>
          )}
        </td>
        <td style={{ color: "#92400e", fontWeight: "bold" }}>{formatCOP(doc.mora)}</td>
      </>
    );
  };

  return (
    <div id="output-section">
      {mesesSinTasa.length > 0 && (
        <div style={{
          maxWidth: "1380px", margin: "0 auto 1rem", padding: "12px 16px",
          background: "#fee2e2", border: "1px solid #b91c1c", borderRadius: "10px", color: "#b91c1c",
        }}>
          <strong>⚠ Faltan las tasas de usura de: {mesesSinTasa.join(", ")}.</strong>{" "}
          Esos días no se cobraron y la mora quedó por debajo de lo real. Cárgalas
          en el panel de tasas históricas y vuelve a calcular.
        </div>
      )}

      {rows.length > 0 && (
        <p className="scroll-hint">← Desliza la tabla hacia los lados para ver todas las columnas →</p>
      )}

      <div className="table-scroll">
      <table id="result-table">
        <thead>
          <tr>
            <th>ACTO</th>
            <th>N° ESCRITURA</th>
            <th>FECHA</th>
            <th title="Folios adicionales del documento">FOLIOS</th>
            <th title="Número de actos sin cuantía en el documento (editable)">ACTOS</th>
            <th>VALOR ACTO</th>
            <th>TRIBUTARIA</th>
            <th title="Días vencidos después del plazo legal de 2 meses">DÍAS</th>
            <th title="Tasa de mora anual: usura del mes menos 2 puntos">% MORA</th>
            <th>MORA</th>
            <th>VALOR ORIP</th>
            <th>TOTAL</th>
          </tr>
        </thead>

        <tbody>
          {bloques.map((b) => {
            const doc = docDe(b.clave);
            const indices = b.items.map((i) => i.indice);
            const varios = b.items.length > 1;
            const conMora = doc && doc.mora > 0;

            // ── Un solo acto: fila corriente, como siempre ──────────────────
            if (!varios) {
              const { fila, indice } = b.items[0];
              return (
                <tr key={b.clave} style={conMora ? { background: "#fffbeb" } : {}}>
                  <td className="celda-acto">{fila.acto}</td>
                  <td data-label="N° ESCRITURA">
                    <textarea
                      placeholder="Número de escritura"
                      value={fila.numeroEscritura}
                      onChange={(e) => cambiar(indice, "numeroEscritura", e.target.value)}
                    />
                  </td>
                  <td data-label="FECHA" style={{ overflow: "visible", whiteSpace: "nowrap" }}>
                    <input
                      type="date"
                      value={fila.fechaEscritura}
                      onChange={(e) => cambiar(indice, "fechaEscritura", e.target.value)}
                      style={{ minWidth: "112px", width: "100%" }}
                    />
                  </td>
                  <td data-label="FOLIOS ADICIONALES">{celdaFolios(fila, indice)}</td>
                  <td data-label="N° DE ACTOS" style={{ textAlign: "center" }}>{celdaActos(fila, indice)}</td>
                  <td data-label="VALOR ACTO">{celdaValor(fila, indice)}</td>
                  <td data-label="TRIBUTARIA">{fila.tributaria != null ? formatCOP(fila.tributaria) : ""}</td>
                  {celdasMora(doc, indices)}
                  <td data-label="VALOR ORIP">{fila.orip != null ? formatCOP(fila.orip) : ""}</td>
                  <td data-label="TOTAL" className="celda-total">
                    {doc ? formatCOP(doc.total) : (fila.total != null ? formatCOP(fila.total) : "")}
                  </td>
                </tr>
              );
            }

            // ── Varios actos: bloque con encabezado y una sola mora ─────────
            return (
              <React.Fragment key={b.clave}>
                {/* Encabezado del documento */}
                <tr className="doc-cabecera">
                  <td colSpan={NUM_COLUMNAS}>
                    <div className="doc-cabecera-caja">
                      <span className="doc-icono">📄</span>
                      <label>
                        Escritura N°
                        <input
                          className="doc-numero"
                          value={b.numeroEscritura}
                          placeholder="Número"
                          onChange={(e) => cambiarEnBloque(indices, "numeroEscritura", e.target.value)}
                        />
                      </label>
                      <label>
                        Fecha
                        <input
                          type="date"
                          className="doc-fecha"
                          value={b.fechaEscritura}
                          onChange={(e) => cambiarEnBloque(indices, "fechaEscritura", e.target.value)}
                        />
                      </label>
                      <span className="doc-pastilla">{b.items.length} actos</span>
                      {doc?.vence && <span className="doc-vence">vence {doc.vence}</span>}
                    </div>
                  </td>
                </tr>

                {/* Actos del documento */}
                {b.items.map(({ fila, indice }) => (
                  <tr key={indice} className="doc-acto">
                    <td className="celda-acto"><span className="doc-vineta">└</span> {fila.acto}</td>
                    <td colSpan={2} className="doc-heredado">
                      <span title="Estos datos se editan arriba, en el encabezado de la escritura">
                        ↑ de la escritura {b.numeroEscritura || "—"}
                      </span>
                    </td>
                    <td data-label="FOLIOS ADICIONALES">{celdaFolios(fila, indice)}</td>
                    <td data-label="N° DE ACTOS" style={{ textAlign: "center" }}>{celdaActos(fila, indice)}</td>
                    <td data-label="VALOR ACTO">{celdaValor(fila, indice)}</td>
                    <td data-label="TRIBUTARIA">{fila.tributaria != null ? formatCOP(fila.tributaria) : ""}</td>
                    <td colSpan={3} className="doc-mora-aparte">
                      <span title="La mora se cobra una sola vez sobre toda la escritura, al pie del bloque">
                        se liquida al pie ↓
                      </span>
                    </td>
                    <td data-label="VALOR ORIP">{fila.orip != null ? formatCOP(fila.orip) : ""}</td>
                    <td data-label="TOTAL" className="celda-total">
                      {fila.total != null ? formatCOP(fila.total) : ""}
                    </td>
                  </tr>
                ))}

                {/* Pie del documento: una sola mora y el total de la escritura */}
                <tr className={`doc-pie ${conMora ? "con-mora" : ""}`}>
                  <td colSpan={7} className="doc-pie-etiqueta">
                    {conMora
                      ? `Intereses de mora de la escritura ${b.numeroEscritura || ""}`.trim()
                      : "Sin mora: dentro del plazo de 2 meses"}
                    <span className="doc-pie-detalle">
                      tributaria {formatCOP(doc?.tributaria ?? 0)} · ORIP {formatCOP(doc?.orip ?? 0)}
                    </span>
                  </td>
                  {celdasMora(doc, indices)}
                  <td></td>
                  <td className="celda-total doc-pie-total">{doc ? formatCOP(doc.total) : ""}</td>
                </tr>
              </React.Fragment>
            );
          })}

          {/* Notas y totales generales */}
          {filasResumen.map(({ fila, indice }) => {
            if (fila.isNote) {
              return (
                <tr key={indice} style={{ backgroundColor: "#f0fdf4", fontSize: "0.95rem", color: "#166534" }}>
                  <td colSpan={NUM_COLUMNAS} style={{ textAlign: "center", fontStyle: "italic", padding: "12px" }}>
                    {fila.label}
                  </td>
                </tr>
              );
            }
            const color = fila.isDinero
              ? "#166534"
              : fila.isSobrante ? (fila.value >= 0 ? "#166534" : "#b91c1c") : undefined;
            return (
              <tr key={indice} className={fila.isSummary ? "summary-row" : "additional-row"}>
                <td colSpan={10}></td>
                <td className="resumen-etiqueta" style={{ fontWeight: "bold", color }}>{fila.label}</td>
                <td className="resumen-valor" style={{ fontWeight: "bold", color }}>{formatCOP(fila.value)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
});

export default ResultTable;
