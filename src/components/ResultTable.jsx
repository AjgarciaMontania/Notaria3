// src/components/ResultTable.jsx
import * as XLSX from 'xlsx';
import { formatCOP, formatNumberWithPoints, parseNumberWithoutPoints } from "../utils/formatters";
import { forwardRef, useImperativeHandle } from "react";
import { ACTOS_CONFIG } from "../utils/actosConfig";
import { getTasaHistorica } from "../utils/tasasHistoricas";

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
// Tasa derivada de recibos reales Gobernación Caquetá 2026:
// Escritura 232: $250.000 tributaria × 106 días mora = $18.000 → ~24% anual
// Actualizar MORA_ANNUAL_RATE si la Gobernación comunica nuevo porcentaje.
// Tasa exacta: 18.000 mora / (250.000 base × 106 días) × 365 = 24.79%
const MORA_ANNUAL_RATE = 0.2479; // 24.79% anual simple
const MORA_RATE_DIARIA = MORA_ANNUAL_RATE / 365;

/** Días calendario entre dos fechas "YYYY-MM-DD" (usa mediodía para evitar DST). */
const diasEntre = (desde, hasta) => {
  if (!desde || !hasta) return 0;
  const d1 = new Date(desde + "T12:00:00");
  const d2 = new Date(hasta  + "T12:00:00");
  return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
};

/**
 * Fecha de vencimiento del plazo legal: exactamente 2 meses calendario
 * después de la fecha de escritura (Art. 8 Ley 1579/2012).
 */
const fechaVencimiento = (fechaEscritura) => {
  const d = new Date(fechaEscritura + "T12:00:00");
  d.setMonth(d.getMonth() + 2);
  return d.toISOString().split("T")[0];
};

/**
 * Calcula días vencidos e intereses de mora para una escritura.
 * @param {number} tasaAnual - tasa anual en decimal (ej: 0.2784). Si no se pasa, usa MORA_ANNUAL_RATE.
 * @returns {{ diasVencidos: number, mora: number }}
 */
const calcularMoraEscritura = (fechaEscritura, tributaria, fechaPago, tasaAnual = MORA_ANNUAL_RATE) => {
  if (!fechaEscritura || !tributaria || tributaria <= 0) return { diasVencidos: 0, mora: 0 };
  const venc         = fechaVencimiento(fechaEscritura);
  const diasVencidos = Math.max(0, diasEntre(venc, fechaPago));
  if (diasVencidos === 0) return { diasVencidos: 0, mora: 0 };
  const rateDiaria = tasaAnual / 365;
  // La Gobernación del Caquetá redondea la mora al millar más cercano
  // (confirmado en todos los recibos: $31.000, $28.000, $37.000, $3.000…)
  const mora = Math.round(tributaria * rateDiaria * diasVencidos / 1000) * 1000;
  return { diasVencidos, mora };
};
// ───────────────────────────────────────────────────────────────────────────

const ResultTable = forwardRef(({ rows, setRows, calcularDisabled, fechaPago, tasaMoraDefault }, ref) => {
  // tasaMoraDefault viene de Firestore vía App.jsx; si no llega, usa la constante local
  const TASA_EFECTIVA = tasaMoraDefault ?? MORA_ANNUAL_RATE;
  useImperativeHandle(ref, () => ({ calcularTodo, exportToExcel }));

  // Derecho base sin el 2% de conservación documental (se aplica al final sobre el total)
  const calcOripBase = (valor) => {
    if (valor <= 0) return 0;
    const tier = FEE_CONSTANTS.TIERS.find((t) => valor <= t.limit);
    return tier.rate ? valor * tier.rate : FEE_CONSTANTS.BASE_FEE;
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

      if (config.tributariaManual) {
        // tributaria ingresada manualmente por el usuario en la celda de la tabla
        tributaria = parseNumberWithoutPoints(row.tributariaManual || "0");
      } else if (config.tributariaRate !== undefined) {
        tributaria = Math.round(valor * config.tributariaRate);
      } else if (config.tributaria !== undefined) {
        tributaria = config.tributaria;
      }

      // Cálculo ORIP según RES-2026-001726-6 Párrafo 8:
      // 2% de conservación documental se aplica sobre el subtotal completo
      // (base + extras + folios adicionales), NO solo sobre el derecho base.
      if (config.oripTipo === "cuantia") {
        const base    = calcOripBase(valor) + (config.oripExtras || 0);
        const subtotal = base + FOLIO_ADICIONAL * foliosAdic;
        orip = Math.round(subtotal * FEE_CONSTANTS.ADDITIONAL_RATE / 100) * 100;
      } else if (config.oripTipo === "sin_cuantia") {
        const numActos  = row.numActos || 1;
        const subtotal  = SIN_CUANTIA_BASE * numActos + FOLIO_ADICIONAL * foliosAdic;
        orip = Math.round(subtotal * FEE_CONSTANTS.ADDITIONAL_RATE / 100) * 100;
      }

      tributariaTotal += tributaria;
      oripTotal       += orip;

      return { ...row, tributaria, orip, _base: tributaria + orip, mora: 0, diasVencidos: 0 };
    });

    // ── PASO 2: mora agrupada por escritura ───────────────────────────────────
    // Actos con el mismo número+fecha de escritura comparten la base de mora
    // (así lo liquida la Gobernación: mora sobre tributaria combinada por escritura)
    const grupos = new Map();
    updatedRows.forEach((row, idx) => {
      if (row.tributaria === null || row.tributaria <= 0 || !row.fechaEscritura) return;
      const numEsc = row.numeroEscritura?.trim();
      const key    = numEsc ? `${numEsc}||${row.fechaEscritura}` : `__solo__${idx}`;
      if (!grupos.has(key)) {
        grupos.set(key, { fechaEscritura: row.fechaEscritura, tasaAnual: null, indices: [], total: 0 });
      }
      const g = grupos.get(key);
      g.indices.push(idx);
      g.total += row.tributaria;
      // Primera tasa editada manualmente en el grupo tiene prioridad
      if (row.tasaAnual != null && g.tasaAnual == null) g.tasaAnual = row.tasaAnual;
    });

    const moraIdx   = new Array(updatedRows.length).fill(0);
    const diasIdx   = new Array(updatedRows.length).fill(0);
    const tasaIdx   = new Array(updatedRows.length).fill(TASA_EFECTIVA);

    grupos.forEach((g) => {
      if (!fechaPago || g.total <= 0) return;
      // Si el usuario no editó la tasa, buscar en historial por fecha de vencimiento + año de pago
      const fv   = fechaVencimiento(g.fechaEscritura);
      const tasa = g.tasaAnual ?? getTasaHistorica(fv, fechaPago) ?? TASA_EFECTIVA;
      const { diasVencidos, mora: moraGrupo } = calcularMoraEscritura(g.fechaEscritura, g.total, fechaPago, tasa);
      if (moraGrupo === 0) return;
      moraTotal += moraGrupo;

      // Distribuir mora proporcionalmente entre los actos del grupo
      let asignada = 0;
      g.indices.forEach((idx, i) => {
        let parte;
        if (i === g.indices.length - 1) {
          parte = moraGrupo - asignada; // remanente exacto al último
        } else {
          parte = Math.round(moraGrupo * (updatedRows[idx].tributaria / g.total) / 100) * 100;
          asignada += parte;
        }
        moraIdx[idx]  = parte;
        diasIdx[idx]  = diasVencidos;
        tasaIdx[idx]  = tasa;
      });
    });

    // ── PASO 3: aplicar mora a cada fila ─────────────────────────────────────
    const updatedRowsFinal = updatedRows.map((row, idx) => {
      if (row.tributaria === null) return row;
      const { _base, ...rest } = row;
      return { ...rest, mora: moraIdx[idx], diasVencidos: diasIdx[idx], tasaAnual: tasaIdx[idx], total: _base + moraIdx[idx] };
    });

    // SUBTOTAL = suma de todos los totales de fila (tributaria + ORIP + mora incluida)
    const subtotal        = tributariaTotal + oripTotal + igacTotal + saberTotal + moraTotal;
    const retiros         = Math.round(Math.ceil((subtotal + honorarios) / 600000) * 3000);
    const totalConsignar  = subtotal + honorarios + retiros;

    const dineroEnviadoNum = parseNumberWithoutPoints(dineroEnviadoStr || "0");
    const sobrante         = dineroEnviadoNum - totalConsignar;

    // Advertencia visual si hay mora
    const hayMora = moraTotal > 0;

    setRows([
      ...updatedRowsFinal,
      { isSummary: true, label: "SUBTOTAL",  value: subtotal },
      { isSummary: true, label: "HONORARIOS", value: honorarios },
      { isSummary: true, label: "RETIROS",           value: retiros },
      { isSummary: true, label: "TOTAL A CONSIGNAR", value: totalConsignar },
      { isAdditional: true, label: "TOTAL GASTOS",   value: totalConsignar },
      { isAdditional: true, label: "DINERO ENVIADO",  value: dineroEnviadoNum, isDinero: true },
      { isAdditional: true, label: "SOBRANTE",        value: sobrante, isSobrante: true },
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
      <table id="result-table" style={{ width: "100%", tableLayout: "fixed" }}>
        {/* colgroup debe ser hijo directo de <table>, antes de <thead> */}
        <colgroup>
          <col style={{ width: "16%" }} />  {/* ACTO */}
          <col style={{ width: "10%" }} />  {/* NRO ESCRITURA */}
          <col style={{ width: "11%" }} />  {/* FECHA */}
          <col style={{ width: "4%" }} />   {/* FOLIOS */}
          <col style={{ width: "3%" }} />   {/* # ACTOS */}
          <col style={{ width: "9%" }} />   {/* VALOR ACTO */}
          <col style={{ width: "8%" }} />   {/* TRIBUTARIA */}
          <col style={{ width: "3%" }} />   {/* DÍAS VENC */}
          <col style={{ width: "6%" }} />   {/* % INTERÉS */}
          <col style={{ width: "6%" }} />   {/* MORA */}
          <col style={{ width: "7%" }} />   {/* ORIP */}
          <col style={{ width: "9%" }} />   {/* TOTAL */}
        </colgroup>
        <thead>
          <tr>
            <th>ACTO</th>
            <th>N° ESCRITURA</th>
            <th>FECHA</th>
            <th>FOLIOS ADIC.</th>
            <th title="Número de actos sin cuantía en el documento (editable)"># ACTOS</th>
            <th>VALOR ACTO</th>
            <th>TRIBUTARIA</th>
            <th>DÍAS VENC.</th>
            <th>% INTERÉS</th>
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
                  <td style={{
                    whiteSpace: "normal", wordBreak: "break-word", lineHeight: "1.3", fontWeight: "bold",
                    color: row.isDinero ? "#166534" : row.isSobrante ? (row.value >= 0 ? "#166534" : "#b91c1c") : undefined
                  }}>{row.label}</td>
                  <td style={{
                    whiteSpace: "nowrap", fontWeight: "bold",
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
                <td>{row.acto}</td>
                <td>
                  <textarea
                    placeholder="Número de escritura"
                    value={row.numeroEscritura}
                    onChange={(e) => setRows(prev => prev.map((r, i) => i === index ? { ...r, numeroEscritura: e.target.value } : r))}
                  />
                </td>
                <td style={{ overflow: "visible", whiteSpace: "nowrap" }}>
                  <input
                    type="date"
                    value={row.fechaEscritura}
                    onChange={(e) => setRows(prev => prev.map((r, i) => i === index ? { ...r, fechaEscritura: e.target.value } : r))}
                    style={{ minWidth: "120px", width: "100%" }}
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
                <td style={{ textAlign: "center" }}>
                  {ACTOS_CONFIG[row.acto]?.oripTipo === "sin_cuantia" ? (
                    <input
                      type="number"
                      min="1"
                      title="Número de actos sin cuantía en el documento"
                      style={{ width: "55px", textAlign: "center", padding: "6px", border: "1px solid #d1d5db", borderRadius: "4px" }}
                      value={row.numActos ?? 1}
                      onChange={(e) => setRows(prev => prev.map((r, i) => i === index ? { ...r, numActos: parseInt(e.target.value) || 1 } : r))}
                    />
                  ) : <span style={{ color: "#9ca3af" }}>—</span>}
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
                <td style={mostrarMora ? { color: "#92400e", fontWeight: "bold", textAlign: "center" } : { color: "#9ca3af", textAlign: "center" }}>
                  {mostrarMora ? row.diasVencidos : (row.tributaria !== null ? "—" : "")}
                </td>
                <td style={{ textAlign: "center" }}>
                  {row.tributaria !== null && row.diasVencidos > 0 ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      title="Tasa anual %. Edita y vuelve a Calcular para actualizar."
                      style={{
                        width: "70px", textAlign: "center", fontWeight: "bold",
                        color: "#92400e", border: "1px solid #d97706",
                        borderRadius: "4px", padding: "4px", background: "#fffbeb"
                      }}
                      value={parseFloat(((row.tasaAnual ?? TASA_EFECTIVA) * 100).toFixed(2))}
                      onChange={(e) => {
                        const pct = parseFloat(e.target.value) || 0;
                        setRows(prev => prev.map((r, i) => i === index ? { ...r, tasaAnual: pct / 100 } : r));
                      }}
                    />
                  ) : (row.tributaria !== null ? <span style={{ color: "#9ca3af" }}>—</span> : "")}
                </td>
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
      </div>
    </div>
  );
});

export default ResultTable;
