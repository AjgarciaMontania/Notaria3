// Historial de liquidaciones guardadas. Lo ve el personal y el administrador.
//
// Responde a "¿cuánto se le cobró a esta escritura y con qué tarifas?", que es
// justo lo que hace falta cuando alguien reclama meses después.
import { useState, useEffect } from "react";
import {
  escucharLiquidaciones,
  eliminarLiquidacion,
  fechaHora,
} from "../utils/historialLiquidaciones";
import { formatCOP } from "../utils/formatters";

const CAJA = {
  maxWidth: "1100px",
  margin: "1.5rem auto",
  padding: "1.5rem",
  background: "#f8fafc",
  border: "1px solid #cbd5e1",
  borderRadius: "14px",
};

export default function HistorialPanel({ isAdmin }) {
  const [liquidaciones, setLiquidaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [abierta, setAbierta] = useState(null);

  useEffect(() => {
    const parar = escucharLiquidaciones(
      (datos) => {
        setLiquidaciones(datos);
        setCargando(false);
      }
    );
    return parar;
  }, []);

  const texto = busqueda.trim().toLowerCase();
  const visibles = !texto
    ? liquidaciones
    : liquidaciones.filter((l) =>
        l.escrituras?.some((e) =>
          String(e.numeroEscritura).toLowerCase().includes(texto)
        ) || String(l.creadoPor).toLowerCase().includes(texto)
      );

  const borrar = async (l) => {
    const numeros = (l.escrituras || []).map((e) => e.numeroEscritura).join(", ");
    if (!window.confirm(
      `¿Borrar del historial la liquidación del ${fechaHora(l.creadoEn)}?\n\n` +
      `Escrituras: ${numeros || "(sin número)"}\n` +
      `Total: ${formatCOP(l.totales?.totalConsignar || 0)}\n\n` +
      `Esto no deshace ningún cobro, solo quita el registro.`
    )) return;
    try {
      await eliminarLiquidacion(l.id);
    } catch (fallo) {
      setError(fallo.message || "No se pudo borrar.");
    }
  };

  return (
    <div style={CAJA}>
      <h3 style={{ color: "#0f172a", marginTop: 0 }}>📒 Historial de liquidaciones</h3>

      <p style={{ color: "#475569", fontSize: "0.9rem", lineHeight: 1.55 }}>
        Cada liquidación guardada queda aquí con lo que se cobró, quién la hizo y
        con qué tarifas se calculó. Sirve para responder un reclamo meses después,
        cuando las tarifas ya cambiaron.
      </p>

      <input
        value={busqueda}
        onChange={(e) => setBusqueda(e.target.value)}
        placeholder="Buscar por número de escritura o por quién la hizo"
        style={{
          width: "100%", padding: "11px", fontSize: "0.95rem",
          border: "1px solid #cbd5e1", borderRadius: "8px",
          boxSizing: "border-box", marginBottom: "1rem",
        }}
      />

      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      {cargando ? (
        <p style={{ color: "#64748b" }}>Cargando historial…</p>
      ) : visibles.length === 0 ? (
        <p style={{ color: "#64748b" }}>
          {liquidaciones.length === 0
            ? 'Todavía no hay liquidaciones guardadas. Al calcular una, pulsa "💾 Guardar" para dejarla registrada.'
            : "Ninguna liquidación coincide con la búsqueda."}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
          {visibles.map((l) => {
            const numeros = (l.escrituras || []).map((e) => e.numeroEscritura || "—").join(" · ");
            const desplegada = abierta === l.id;
            return (
              <div key={l.id} style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden" }}>
                <button
                  onClick={() => setAbierta(desplegada ? null : l.id)}
                  style={{
                    width: "100%", display: "flex", justifyContent: "space-between",
                    alignItems: "center", gap: "1rem", flexWrap: "wrap",
                    padding: "12px 14px", background: "none", border: "none",
                    cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                  }}
                >
                  <span>
                    <strong style={{ color: "#0f172a", fontSize: "0.95rem" }}>
                      {desplegada ? "▾" : "▸"} Escritura{(l.escrituras?.length || 0) > 1 ? "s" : ""} {numeros}
                    </strong>
                    <br />
                    <small style={{ color: "#64748b", fontSize: "0.8rem" }}>
                      {fechaHora(l.creadoEn)} · {l.creadoPor || "sin identificar"}
                      {l.fechaPago && ` · pago ${l.fechaPago}`}
                    </small>
                  </span>
                  <strong style={{ color: "#166534", fontSize: "1.02rem", whiteSpace: "nowrap" }}>
                    {formatCOP(l.totales?.totalConsignar || 0)}
                  </strong>
                </button>

                {desplegada && (
                  <div style={{ padding: "0 14px 14px", borderTop: "1px solid #f1f5f9" }}>
                    {(l.escrituras || []).map((e, i) => (
                      <div key={i} style={{ marginTop: "0.9rem" }}>
                        <strong style={{ color: "#166534", fontSize: "0.9rem" }}>
                          Escritura {e.numeroEscritura || "—"}
                          {e.fechaEscritura && ` · ${e.fechaEscritura}`}
                        </strong>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem", marginTop: "0.4rem" }}>
                          <thead>
                            <tr style={{ background: "#f1f5f9", color: "#475569" }}>
                              <th style={{ padding: "6px 8px", textAlign: "left" }}>ACTO</th>
                              <th style={{ padding: "6px 8px", textAlign: "right" }}>VALOR</th>
                              <th style={{ padding: "6px 8px", textAlign: "right" }}>IMPUESTO</th>
                              <th style={{ padding: "6px 8px", textAlign: "right" }}>REGISTRO</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(e.actos || []).map((a, j) => (
                              <tr key={j} style={{ borderBottom: "1px solid #f8fafc" }}>
                                <td style={{ padding: "6px 8px" }}>{a.acto}</td>
                                <td style={{ padding: "6px 8px", textAlign: "right" }}>{a.valorActo || "—"}</td>
                                <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatCOP(a.tributaria)}</td>
                                <td style={{ padding: "6px 8px", textAlign: "right" }}>{formatCOP(a.orip)}</td>
                              </tr>
                            ))}
                            {e.mora > 0 && (
                              <tr style={{ background: "#fffbeb", color: "#92400e" }}>
                                <td colSpan={3} style={{ padding: "6px 8px" }}>
                                  Intereses de mora · {e.diasVencidos} días
                                </td>
                                <td style={{ padding: "6px 8px", textAlign: "right", fontWeight: "bold" }}>
                                  {formatCOP(e.mora)}
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    ))}

                    <div style={{ marginTop: "1rem", padding: "0.8rem", background: "#f0fdf4", borderRadius: "8px", fontSize: "0.88rem" }}>
                      {[
                        ["Subtotal", l.totales?.subtotal],
                        ["Honorarios", l.totales?.honorarios],
                        ["Retiros", l.totales?.retiros],
                        ["TOTAL A CONSIGNAR", l.totales?.totalConsignar],
                      ].map(([et, v], i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", fontWeight: i === 3 ? "bold" : "normal", color: i === 3 ? "#166534" : "#334155" }}>
                          <span>{et}</span><span>{formatCOP(v || 0)}</span>
                        </div>
                      ))}
                    </div>

                    {l.tarifas && (
                      <p style={{ marginTop: "0.7rem", fontSize: "0.78rem", color: "#64748b", lineHeight: 1.5 }}>
                        Calculada con: acto sin cuantía {formatCOP(l.tarifas.sinCuantiaBase)} ·
                        folio {formatCOP(l.tarifas.folioAdicional)} ·
                        mínimo sin cuantía {formatCOP(l.tarifas.tarifaMinimaSinCuantia)} ·
                        conservación {(l.tarifas.conservacion * 100).toFixed(0)}% ·
                        mora = usura − {(l.tarifas.descuentoMora * 100).toFixed(0)} puntos
                        {l.tarifas.resolucion && ` · ${l.tarifas.resolucion}`}
                      </p>
                    )}

                    {l.mesesSinTasa?.length > 0 && (
                      <p style={{ marginTop: "0.5rem", fontSize: "0.8rem", color: "#b91c1c" }}>
                        ⚠ Al calcularla faltaban las tasas de: {l.mesesSinTasa.join(", ")}
                      </p>
                    )}

                    {isAdmin && (
                      <button
                        onClick={() => borrar(l)}
                        style={{ marginTop: "0.8rem", padding: "7px 14px", background: "white", color: "#b91c1c", border: "1px solid #b91c1c", borderRadius: "8px", cursor: "pointer", fontSize: "0.82rem" }}
                      >
                        Borrar del historial
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {liquidaciones.length >= 200 && (
        <p style={{ fontSize: "0.8rem", color: "#64748b", marginTop: "1rem" }}>
          Se muestran las 200 más recientes.
        </p>
      )}
    </div>
  );
}
