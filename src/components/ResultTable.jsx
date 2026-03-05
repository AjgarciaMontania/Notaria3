// src/components/ResultTable.jsx
import * as XLSX from 'xlsx';
import { formatCOP, formatNumberWithPoints, parseNumberWithoutPoints } from "../utils/formatters";
import { forwardRef, useImperativeHandle } from "react";
import { ACTOS_CONFIG } from "../utils/actosConfig";

const SIN_CUANTIA_BASE = 29500;
const FOLIO_ADICIONAL = 15300;

const FEE_CONSTANTS = {
  BASE_FEE: 53100,
  TIERS: [
    { limit: 12852101, rate: null },
    { limit: 192778606, rate: 0.00911 },
    { limit: 334149656, rate: 0.01131 },
    { limit: 494798857, rate: 0.01260 },
    { limit: Infinity, rate: 0.01333 },
  ],
  ADDITIONAL_RATE: 1.02,
};

const HONORARIOS_RATES = { FIRST: 35000, SECOND_TO_THIRD: 25000, REMAINING: 20000 };

const ResultTable = forwardRef(({ rows, setRows, calcularDisabled }, ref) => {
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
    let oripTotal = 0;
    let igacTotal = 0;
    let saberTotal = 0;
    let honorarios = 0;
    let contHonorarios = 0;

    const updatedRows = actoRows.map((row) => {
      const config = ACTOS_CONFIG[row.acto] || { oripTipo: "none", honorarioContable: false };
      const valor = parseNumberWithoutPoints(row.valorActo || "0");
      const foliosAdic = row.foliosAdicionales || 0;

      // SABER ahora cuenta honorarios
      const isSaber = row.acto.includes("SABER") || row.acto.includes("ESCRITURA PARA SABER");
      const isHonorarioContable = config.honorarioContable || isSaber;

      if (isHonorarioContable) {
        contHonorarios++;
        honorarios += contHonorarios === 1 ? HONORARIOS_RATES.FIRST :
                      contHonorarios <= 3 ? HONORARIOS_RATES.SECOND_TO_THIRD :
                      HONORARIOS_RATES.REMAINING;
      }

      if (config.oripTipo === "none") {
        if (row.acto.includes("IGAC")) igacTotal += valor;
        if (isSaber) saberTotal += valor;
        return { ...row, tributaria: null, orip: null, total: valor };
      }

      let tributaria = 0;
      let orip = 0;

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
      orip = Math.round(orip / 100) * 100;

      const totalRow = tributaria + orip;
      tributariaTotal += tributaria;
      oripTotal += orip;

      return { ...row, tributaria, orip, total: totalRow };
    });

    const subtotal = tributariaTotal + oripTotal + igacTotal + saberTotal;
    const retiros = Math.round(Math.ceil((subtotal + honorarios) / 600000) * 3000);
    const totalConsignar = subtotal + honorarios + retiros;

    const dineroEnviadoNum = parseNumberWithoutPoints(dineroEnviadoStr || "0");
    const sobrante = dineroEnviadoNum - totalConsignar;

    setRows([
      ...updatedRows,
      { isSummary: true, label: "SUBTOTAL", value: subtotal },
      { isSummary: true, label: "HONORARIOS", value: honorarios },
      { isSummary: true, label: "RETIROS", value: retiros },
      { isSummary: true, label: "TOTAL A CONSIGNAR", value: totalConsignar },
      { isAdditional: true, label: "TOTAL GASTOS", value: totalConsignar },
      { isAdditional: true, label: "DINERO ENVIADO", value: dineroEnviadoNum },
      { isAdditional: true, label: "SOBRANTE", value: sobrante },
    ]);
  };

  const exportToExcel = () => {
    const data = rows.map((row) => {
      if (row.isSummary || row.isAdditional) {
        return { ACTO: '', 'NÚMERO DE ESCRITURA': '', 'FECHA DE ESCRITURA': '', 'FOLIOS ADIC.': '', 'VALOR ACTO': '', 'VALOR TRIBUTARIA': '', 'VALOR ORIP': row.label, TOTAL: formatCOP(row.value).replace('$', '') };
      }
      if (row.isNote) {
        return { ACTO: row.label, 'NÚMERO DE ESCRITURA': '', 'FECHA DE ESCRITURA': '', 'FOLIOS ADIC.': '', 'VALOR ACTO': '', 'VALOR TRIBUTARIA': '', 'VALOR ORIP': '', TOTAL: '' };
      }
      return {
        ACTO: row.acto,
        'NÚMERO DE ESCRITURA': row.numeroEscritura,
        'FECHA DE ESCRITURA': row.fechaEscritura,
        'FOLIOS ADIC.': row.foliosAdicionales || '',
        'VALOR ACTO': row.valorActo,
        'VALOR TRIBUTARIA': row.tributaria ? formatCOP(row.tributaria).replace('$', '') : '',
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
            <th>VALOR ORIP</th>
            <th>TOTAL</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            if (row.isSummary || row.isAdditional) {
              const className = row.isSummary ? "summary-row" : "additional-row";
              return (
                <tr key={index} className={className}>
                  <td colSpan={6}></td>
                  <td>{row.label}</td>
                  <td>{formatCOP(row.value)}</td>
                </tr>
              );
            }
            if (row.isNote) {
              return (
                <tr key={index} style={{ backgroundColor: "#f0fdf4", fontSize: "0.95rem", color: "#166534" }}>
                  <td colSpan={8} style={{ textAlign: "center", fontStyle: "italic", padding: "12px" }}>
                    {row.label}
                  </td>
                </tr>
              );
            }

            return (
              <tr key={index}>
                <td>{row.acto}</td>
                <td><textarea placeholder="Número de escritura" value={row.numeroEscritura} onChange={(e) => setRows(prev => prev.map((r, i) => i === index ? { ...r, numeroEscritura: e.target.value } : r))} /></td>
                <td><input type="date" value={row.fechaEscritura} onChange={(e) => setRows(prev => prev.map((r, i) => i === index ? { ...r, fechaEscritura: e.target.value } : r))} /></td>
                <td><input type="number" min="0" value={row.foliosAdicionales} onChange={(e) => setRows(prev => prev.map((r, i) => i === index ? { ...r, foliosAdicionales: parseInt(e.target.value) || 0 } : r))} /></td>
                
                <td><input type="text" className="valor-acto" placeholder="Valor" value={row.valorActo} onChange={(e) => {
                  let raw = e.target.value.replace(/\./g, "");
                  setRows(prev => prev.map((r, i) => i === index ? { ...r, valorActo: !isNaN(raw) && raw !== "" ? formatNumberWithPoints(parseInt(raw)) : "" } : r));
                }} /></td>
                <td>{row.tributaria !== null ? formatCOP(row.tributaria) : ""}</td>
                <td>{row.orip !== null ? formatCOP(row.orip) : ""}</td>
                <td>{row.total !== null ? formatCOP(row.total) : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
});

export default ResultTable;