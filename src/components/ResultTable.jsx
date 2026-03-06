// src/components/ResultTable.jsx
import * as XLSX from 'xlsx';
import { formatCOP, formatNumberWithPoints, parseNumberWithoutPoints } from "../utils/formatters";
import { forwardRef, useImperativeHandle } from "react";
import { ACTOS_CONFIG } from "../utils/actosConfig";

// ── Tarifas ORIP 2026 (RES-2026-001726-6) ──────────────────────────────────
const SIN_CUANTIA_BASE = 29500;
const FOLIO_ADICIONAL  = 15300;

const FEE_CONSTANTS = {
  BASE_FEE: 53100,
  TIERS: [
    { limit: 12852101,  rate: null },
    { limit: 192778606, rate: 0.00911 },
    { limit: 334149656, rate: 0.01131 },
    { limit: 494798857, rate: 0.01260 },
    { limit: Infinity,  rate: 0.01333 },
  ],
  ADDITIONAL_RATE: 1.02,
};

const HONORARIOS_RATES = { FIRST: 35000, SECOND_TO_THIRD: 25000, REMAINING: 20000 };

// ── Mora por extemporaneidad (Art. 25 Ley 1579/2012 + Sec. Hacienda Caquetá) ──
// Tasa derivada del ejemplo real: $26.000 mora sobre $1.383.500 tributaria en 31 días
// = ~22.13% anual simple  →  actualizar si la Gobernación cambia la tasa vigente
const MORA_ANNUAL_RATE  = 0.2213; // 22.13% anual simple
const MORA_RATE_DIARIA  = MORA_ANNUAL_RATE / 365; // ≈ 0.0606% diario
const DIAS_GRACIA       = 60;     // Días desde la fecha de escritura sin mora

/**
 * Días calendario entre dos fechas "YYYY-MM-DD".
 * Usa mediodía para evitar problemas de horario de verano (DST).
 */
const diasEntre = (desde, hasta) => {
  if (!desde || !hasta) return 0;
  const d1 = new Date(desde + "T12:00:00");
  const d2 = new Date(hasta  + "T12:00:00");
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
};

/**
 * Calcula los intereses de mora para una escritura.
 * @param {string} fechaEscritura  - "YYYY-MM-DD", fecha en que fue otorgada la escritura
 * @param {number} tributaria      - Impuesto de registro (base de la mora)
 * @param {string} fechaPago       - "YYYY-MM-DD", fecha en que se va a pagar/registrar
 * @returns {number} mora en pesos (redondeada a la centena más cercana)
 */
const calcularMoraEscritura = (fechaEscritura, tributaria, fechaPago) => {
  if (!fechaEscritura || !tributaria || tributaria <= 0) return 0;
  const diasTotales = diasEntre(fechaEscritura, fechaPago);
  const diasMora    = Math.max(0, diasTotales - DIAS_GRACIA);
  if (diasMora === 0) return 0;
  return Math.round(Math.round(tributaria * MORA_RATE_DIARIA * diasMora) / 100) * 100;
};
// ───────────────────────────────────────────────────────────────────────────

const ResultTable = forwardRef(({ rows, setRows, calcularDisabled, fechaPago }, ref) => {
  useImperativeHandle(ref, () => ({ calcularTodo, exportToExcel }));

  const calculateNotaryFee = (valor) => {
    if (valor <= 0) return 0;
    const tier = FEE_CONSTANTS.TIERS.find((t) => valor <= t.limit);
    const base = tier.rate ? valor * tier.rate : FEE_CONSTANTS.BASE_FEE;
    return Math.round(base * FEE_CONSTANTS.ADDITIONAL_RATE);
  };

  const calcularTodo = (dineroEnviadoStr) => {
    if (calcularDisabled) return;

    const actoRows = rows.filter(r => !r.isSummary && !r.isAdditional && !r.isNote);

    let tributariaTotal = 0;
    let oripTotal       = 0;
    let igacTotal       = 0;
    let saberTotal      = 0;
    let honorarios      = 0;
    let contHonorarios  = 0;
    let moraTotal       = 0;

    const updatedRows = actoRows.map((row) => {
      const config = ACTOS_CONFIG[row.acto] || { oripTipo: "none", honorarioContable: false };
      const valor      = parseNumberWithoutPoints(row.valorActo || "0");
      const foliosAdic = row.foliosAdicionales || 0;

      const isSaber             = row.acto.includes("SABER") || row.acto.includes("ESCRITURA PARA SABER");
      const isHonorarioContable = config.honorarioContable || isSaber;

      if (isHonorarioContable) {
        contHonorarios++;
        honorarios += contHonorarios === 1 ? HONORARIOS_RATES.FIRST :
                      contHonorarios <= 3  ? HONORARIOS_RATES.SECOND_TO_THIRD :
                                             HONORARIOS_RATES.REMAINING;
      }

      if (config.oripTipo === "none") {
        if (row.acto.includes("IGAC"))  igacTotal  += valor;
        if (isSaber)                     saberTotal += valor;
        return { ...row, tributaria: null, orip: null, total: valor };
      }

      let tributaria = 0;
      let orip       = 0;

      if (config.tributariaRate !== undefined) {
        tributaria = Math.round(valor * config.tributariaRate);
      } else if (config.tributaria !== undefined) {
        tributaria = config.tributaria;
      }

      if (config.oripTipo === "cuantia") {
        orip = calculateNotaryFee(valor) + (config.oripExtras || 0);
      } else if (config.oripTipo === "sin_cuantia") {
        orip = SIN_CUANTIA_BASE;
      }

      orip += FOLIO_ADICIONAL * foliosAdic;
      orip  = Math.round(orip / 100) * 100;

      const totalRow = tributaria + orip;
      tributariaTotal += tributaria;
      oripTotal       += orip;

      // ── Mora por esta escritura (sobre su tributaria) ──────────────────────
      const moraPagada = fechaPago
        ? calcularMoraEscritura(row.fechaEscritura, tributaria, fechaPago)
        : 0;
      moraTotal += moraPagada;
      // ───────────────────────────────────────────────────────────────────────

      return { ...row, tributaria, orip, total: totalRow, mora: moraPagada };
    });

    const subtotal        = tributariaTotal + oripTotal + igacTotal + saberTotal;
    const retiros         = Math.round(Math.ceil((subtotal + honorarios + moraTotal) / 600000) * 3000);
    const totalConsignar  = subtotal + honorarios + moraTotal + retiros;

    const dineroEnviadoNum = parseNumberWithoutPoints(dineroEnviadoStr || "0");
    const sobrante         = dineroEnviadoNum - totalConsignar;

    // Advertencia visual si hay mora
    const hayMora = moraTotal > 0;

    setRows([
      ...updatedRows,
      { isSummary: true, label: "SUBTOTAL",  value: subtotal },
      { isSummary: true, label: "HONORARIOS", value: honorarios },
      ...(hayMora ? [{
        isSummary: true,
        label: `⚠️ INTERESES DE MORA (${DIAS_GRACIA} días gracia · ${(MORA_ANNUAL_RATE * 100).toFixed(2)}% anual)`,
        value: moraTotal,
        isMora: true,
      }] : []),
      { isSummary: true, label: "RETIROS",           value: retiros },
      { isSummary: true, label: "TOTAL A CONSIGNAR", value: totalConsignar },
      { isAdditional: true, label: "TOTAL GASTOS",   value: totalConsignar },
      { isAdditional: true, label: "DINERO ENVIADO",  value: dineroEnviadoNum },
      { isAdditional: true, label: "SOBRANTE",        value: sobrante },
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
        'VALOR ACTO': row.valorActo,
        'VALOR TRIBUTARIA': row.tributaria ? formatCOP(row.tributaria).replace('$', '') : '',
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
      <table id="result-table">
        <thead>
          <tr>
            <th>ACTO</th>
            <th>NÚMERO DE ESCRITURA</th>
            <th>FECHA DE ESCRITURA</th>
            <th>FOLIOS ADIC.</th>
            <th>VALOR ACTO</th>
            <th>VALOR TRIBUTARIA</th>
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
                  <td colSpan={7}></td>
                  <td>{row.label}</td>
                  <td>{formatCOP(row.value)}</td>
                </tr>
              );
            }
            if (row.isNote) {
              return (
                <tr key={index} style={{ backgroundColor: "#f0fdf4", fontSize: "0.95rem", color: "#166534" }}>
                  <td colSpan={9} style={{ textAlign: "center", fontStyle: "italic", padding: "12px" }}>
                    {row.label}
                  </td>
                </tr>
              );
            }

            const mostrarMora = row.mora && row.mora > 0;
            return (
              <tr key={index} style={mostrarMora ? { background: "#fffbeb" } : {}}>
                <td>{row.acto}</td>
                <td>
                  <textarea
                    placeholder="Número de escritura"
                    value={row.numeroEscritura}
                    onChange={(e) => setRows(prev => prev.map((r, i) => i === index ? { ...r, numeroEscritura: e.target.value } : r))}
                  />
                </td>
                <td>
                  <input
                    type="date"
                    value={row.fechaEscritura}
                    onChange={(e) => setRows(prev => prev.map((r, i) => i === index ? { ...r, fechaEscritura: e.target.value } : r))}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    value={row.foliosAdicionales}
                    onChange={(e) => setRows(prev => prev.map((r, i) => i === index ? { ...r, foliosAdicionales: parseInt(e.target.value) || 0 } : r))}
                  />
                </td>
                <td>
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
                <td>{row.tributaria !== null ? formatCOP(row.tributaria) : ""}</td>
                <td style={mostrarMora ? { color: "#92400e", fontWeight: "bold" } : { color: "#9ca3af" }}>
                  {mostrarMora
                    ? formatCOP(row.mora)
                    : (row.tributaria !== null ? "—" : "")}
                </td>
                <td>{row.orip !== null ? formatCOP(row.orip) : ""}</td>
                <td>{row.total !== null ? formatCOP(row.total) : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Nota explicativa de mora */}
      {rows.some(r => r.isMora) && (
        <div style={{
          margin: "1rem 0",
          padding: "14px 20px",
          background: "#fef3c7",
          border: "1px solid #d97706",
          borderRadius: "10px",
          fontSize: "0.9rem",
          color: "#78350f",
          lineHeight: "1.5"
        }}>
          <strong>⚠️ ESCRITURAS CON MORA:</strong> Algunas escrituras superaron los 60 días desde su otorgamiento.
          La Gobernación del Caquetá (Sec. de Hacienda) cobra intereses de mora al <strong>{(MORA_ANNUAL_RATE * 100).toFixed(2)}% anual simple</strong> sobre el impuesto de registro.
          Tasa vigente según recibo No. 185000066725 del 24/02/2026.{" "}
          <em>Actualizar la constante <code>MORA_ANNUAL_RATE</code> si la Gobernación comunica un nuevo porcentaje.</em>
        </div>
      )}
    </div>
  );
});

export default ResultTable;
