// src/components/ResultTable.jsx
import * as XLSX from 'xlsx';
import { formatCOP, formatNumberWithPoints } from "../utils/formatters";
import { forwardRef, useImperativeHandle } from "react";
import { ACTOS_CONFIG } from "../utils/actosConfig";
import { liquidar, MORA_ANNUAL_RATE } from "../utils/motorLiquidacion.js";

// Las tarifas, la mora y los totales viven en utils/motorLiquidacion.js:
// una sola fuente de verdad compartida con la APK del celular.

const ResultTable = forwardRef(({ rows, setRows, calcularDisabled, fechaPago, tasaMoraDefault, tasasHistoricas }, ref) => {
  // tasaMoraDefault viene de Firestore vía App.jsx; si no llega, usa la constante local
  const TASA_EFECTIVA = tasaMoraDefault ?? MORA_ANNUAL_RATE;
  // Tabla mensual administrable desde el panel; si está vacía se usa la del código
  const TASAS_MES = tasasHistoricas ?? {};
  useImperativeHandle(ref, () => ({ calcularTodo, exportToExcel }));

  const calcularTodo = (dineroEnviadoStr) => {
    if (calcularDisabled) return;

    // Toda la matemática vive en utils/motorLiquidacion.js, que comparten la
    // web y la APK. Aquí solo se prepara la entrada y se arma la tabla.
    const actos = rows.filter((r) => !r.isSummary && !r.isAdditional && !r.isNote);

    const { actos: calculados, totales } = liquidar(actos, {
      fechaPago,
      tasaMoraDefault: TASA_EFECTIVA,
      tasasHistoricas: TASAS_MES,
      dineroEnviado: dineroEnviadoStr,
    });

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

  const exportToExcel = () => {
    const data = rows.map((row) => {
      if (row.isSummary || row.isAdditional) {
        return {
          ACTO: '',
          'NÚMERO DE ESCRITURA': '',
          'FECHA DE ESCRITURA': '',
          'FOLIOS ADIC.': '',
          'VALOR ACTO': '',
          'VALOR TRIBUTARIA': '',
          'DÍAS VENC.': '',
          '% INTERÉS': '',
          'MORA': '',
          'VALOR ORIP': row.label,
          TOTAL: formatCOP(row.value).replace('$', ''),
        };
      }
      if (row.isNote) {
        return {
          ACTO: row.label,
          'NÚMERO DE ESCRITURA': '',
          'FECHA DE ESCRITURA': '',
          'FOLIOS ADIC.': '',
          'VALOR ACTO': '',
          'VALOR TRIBUTARIA': '',
          'DÍAS VENC.': '',
          '% INTERÉS': '',
          'MORA': '',
          'VALOR ORIP': '',
          TOTAL: '',
        };
      }
      return {
        ACTO: row.acto,
        'NÚMERO DE ESCRITURA': row.numeroEscritura,
        'FECHA DE ESCRITURA': row.fechaEscritura,
        'FOLIOS ADIC.': row.foliosAdicionales || '',
        '# ACTOS': row.numActos && row.numActos > 1 ? row.numActos : '',
        'VALOR ACTO': row.valorActo,
        'VALOR TRIBUTARIA': row.tributaria ? formatCOP(row.tributaria).replace('$', '') : '',
        'DÍAS VENC.': row.diasVencidos || '',
        '% INTERÉS': row.mora > 0 ? `${(MORA_ANNUAL_RATE * 100).toFixed(0)}%` : '',
        'MORA': row.mora ? formatCOP(row.mora).replace('$', '') : '',
        'VALOR ORIP': row.orip ? formatCOP(row.orip).replace('$', '') : '',
        TOTAL: row.total ? formatCOP(row.total).replace('$', '') : '',
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Liquidacion');
    XLSX.writeFile(wb, 'liquidacion_notarial.xlsx');
  };

  return (
    <div id="output-section">
      {rows.length > 0 && (
        <p className="scroll-hint">← Desliza la tabla hacia los lados para ver todas las columnas →</p>
      )}
      <div className="table-scroll">
      {/* Sin colgroup en porcentajes: los anchos mínimos están en index.css
          (#result-table th:nth-child), en píxeles, para que ninguna columna
          se aplaste ni los títulos se partan letra por letra. */}
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
            <th title="Tasa de mora anual aplicada, editable">% MORA</th>
            <th>MORA</th>
            <th>VALOR ORIP</th>
            <th>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            if (row.isSummary || row.isAdditional) {
              const className = row.isSummary ? "summary-row" : "additional-row";
              const moraStyle = row.isMora
                ? { background: "#fef3c7", color: "#92400e", fontWeight: "bold" }
                : {};
              return (
                <tr key={index} className={className} style={moraStyle}>
                  <td colSpan={10}></td>
                  <td className="resumen-etiqueta" style={{
                    fontWeight: "bold",
                    color: row.isDinero ? "#166534" : row.isSobrante ? (row.value >= 0 ? "#166534" : "#b91c1c") : undefined
                  }}>{row.label}</td>
                  <td className="resumen-valor" style={{
                    fontWeight: "bold",
                    color: row.isDinero ? "#166534" : row.isSobrante ? (row.value >= 0 ? "#166534" : "#b91c1c") : undefined
                  }}>{formatCOP(row.value)}</td>
                </tr>
              );
            }
            if (row.isNote) {
              return (
                <tr key={index} style={{ backgroundColor: "#f0fdf4", fontSize: "0.95rem", color: "#166534" }}>
                  <td colSpan={12} style={{ textAlign: "center", fontStyle: "italic", padding: "12px" }}>
                    {row.label}
                  </td>
                </tr>
              );
            }

            const mostrarMora = row.mora && row.mora > 0;
            return (
              <tr key={index} style={mostrarMora ? { background: "#fffbeb" } : {}}>
                <td className="celda-acto">{row.acto}</td>
                <td data-label="N° ESCRITURA">
                  <textarea
                    placeholder="Número de escritura"
                    value={row.numeroEscritura}
                    onChange={(e) => setRows(prev => prev.map((r, i) => i === index ? { ...r, numeroEscritura: e.target.value } : r))}
                  />
                </td>
                <td data-label="FECHA" style={{ overflow: "visible", whiteSpace: "nowrap" }}>
                  <input
                    type="date"
                    value={row.fechaEscritura}
                    onChange={(e) => setRows(prev => prev.map((r, i) => i === index ? { ...r, fechaEscritura: e.target.value } : r))}
                    style={{ minWidth: "112px", width: "100%" }}
                  />
                </td>
                <td data-label="FOLIOS ADICIONALES">
                  <input
                    type="number"
                    min="0"
                    value={row.foliosAdicionales}
                    onChange={(e) => setRows(prev => prev.map((r, i) => i === index ? { ...r, foliosAdicionales: parseInt(e.target.value) || 0 } : r))}
                  />
                </td>
                <td data-label="N° DE ACTOS" style={{ textAlign: "center" }}>
                  {ACTOS_CONFIG[row.acto]?.oripTipo === "sin_cuantia" ? (
                    <input
                      type="number"
                      min="1"
                      title="Número de actos sin cuantía en el documento"
                      style={{ width: "100%", textAlign: "center" }}
                      value={row.numActos ?? 1}
                      onChange={(e) => setRows(prev => prev.map((r, i) => i === index ? { ...r, numActos: parseInt(e.target.value) || 1 } : r))}
                    />
                  ) : <span style={{ color: "#9ca3af" }}>—</span>}
                </td>
                <td data-label="VALOR ACTO">
                  <input
                    type="text"
                    className="valor-acto"
                    placeholder="Valor"
                    value={row.valorActo}
                    onChange={(e) => {
                      let raw = e.target.value.replace(/\./g, "");
                      setRows(prev => prev.map((r, i) => i === index
                        ? { ...r, valorActo: !isNaN(raw) && raw !== "" ? formatNumberWithPoints(parseInt(raw)) : "" }
                        : r
                      ));
                    }}
                  />
                </td>
                <td data-label="TRIBUTARIA">{row.tributaria !== null ? formatCOP(row.tributaria) : ""}</td>
                <td data-label="DÍAS VENCIDOS" style={mostrarMora ? { color: "#92400e", fontWeight: "bold", textAlign: "center" } : { color: "#9ca3af", textAlign: "center" }}>
                  {mostrarMora ? row.diasVencidos : (row.tributaria !== null ? "—" : "")}
                </td>
                <td data-label="% MORA ANUAL" style={{ textAlign: "center" }}>
                  {row.tributaria !== null && row.diasVencidos > 0 ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input-tasa"
                      title="Tasa anual %. Edita y vuelve a Calcular para actualizar."
                      style={{
                        width: "100%", textAlign: "center", fontWeight: "bold",
                        color: "#92400e", border: "1px solid #d97706",
                        background: "#fffbeb"
                      }}
                      value={parseFloat(((row.tasaAnual ?? TASA_EFECTIVA) * 100).toFixed(2))}
                      onChange={(e) => {
                        const pct = parseFloat(e.target.value) || 0;
                        setRows(prev => prev.map((r, i) => i === index ? { ...r, tasaAnual: pct / 100 } : r));
                      }}
                    />
                  ) : (row.tributaria !== null ? <span style={{ color: "#9ca3af" }}>—</span> : "")}
                </td>
                <td data-label="MORA" style={mostrarMora ? { color: "#92400e", fontWeight: "bold" } : { color: "#9ca3af" }}>
                  {mostrarMora
                    ? formatCOP(row.mora)
                    : (row.tributaria !== null ? "—" : "")}
                </td>
                <td data-label="VALOR ORIP">{row.orip !== null ? formatCOP(row.orip) : ""}</td>
                <td data-label="TOTAL" className="celda-total">{row.total !== null ? formatCOP(row.total) : ""}</td>
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
