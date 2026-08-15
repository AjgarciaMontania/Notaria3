// Panel de administración de tarifas. Solo lo ve el administrador.
//
// Cada año sale una resolución nueva de la Superintendencia y estos valores
// cambian. Antes había que editar el código, compilar y reinstalar la APK en
// todos los celulares; ahora se cambian aquí y viajan solos, igual que las
// tasas de mora.
import { useState, useEffect } from "react";
import { useTarifas } from "../hooks/useTarifas";
import {
  TARIFAS_BASE,
  CAMPOS_TARIFA,
  leerCampo,
  escribirCampo,
  camposModificados,
} from "../utils/tarifasConfig.js";
import { formatCOP } from "../utils/formatters";

const CAJA = {
  maxWidth: "900px",
  margin: "1.5rem auto",
  padding: "1.5rem",
  background: "#fefce8",
  border: "1px solid #facc15",
  borderRadius: "14px",
};

const INPUT = {
  padding: "9px",
  fontSize: "0.95rem",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  width: "100%",
  boxSizing: "border-box",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
};

/** Un valor se guarda en decimal (0.02) pero se escribe en porcentaje (2). */
const aVista = (valor, tipo) => (tipo === "porcentaje" ? +(valor * 100).toFixed(4) : valor);
const aGuardar = (texto, tipo) => {
  const n = parseFloat(String(texto).replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return tipo === "porcentaje" ? n / 100 : Math.round(n);
};

export default function TarifasPanel({ correoActual }) {
  const { guardadas, tarifas, cargando, guardar, restaurar } = useTarifas();
  const [borrador, setBorrador] = useState(null);
  const [aviso, setAviso] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // El borrador se rehace cada vez que llegan tarifas nuevas de Firestore
  useEffect(() => {
    if (!cargando) setBorrador(tarifas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando, JSON.stringify(tarifas)]);

  const mostrar = (tipo, texto) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 7000);
  };

  if (cargando || !borrador) {
    return <div style={CAJA}><p style={{ color: "#78350f" }}>Cargando tarifas…</p></div>;
  }

  const cambiar = (clave, tipo) => (e) => {
    const valor = aGuardar(e.target.value, tipo);
    if (valor === null && e.target.value !== "") return;
    setBorrador((b) => escribirCampo(b, clave, valor ?? 0));
  };

  const cambiarTramo = (indice, campo) => (e) => {
    const bruto = e.target.value;
    setBorrador((b) => {
      const tramos = b.tramos.map((t, i) => {
        if (i !== indice) return t;
        if (campo === "limite") {
          const n = parseFloat(bruto.replace(/\./g, ""));
          return { ...t, limite: Number.isFinite(n) ? Math.round(n) : null };
        }
        const n = parseFloat(bruto.replace(",", "."));
        return { ...t, tasa: Number.isFinite(n) && n > 0 ? n / 100 : null };
      });
      return { ...b, tramos };
    });
  };

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await guardar(borrador, correoActual);
      mostrar("ok", "Tarifas guardadas. La página y los celulares ya las están usando.");
    } catch (fallo) {
      mostrar("error", fallo.message || "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const volverAlCodigo = async () => {
    if (!window.confirm(
      "¿Volver a las tarifas originales del programa?\n\n" +
      "Se descarta todo lo que hayas guardado aquí y se recuperan los valores " +
      "de la resolución " + TARIFAS_BASE.resolucion + "."
    )) return;
    try {
      await restaurar();
      mostrar("ok", "Se restauraron las tarifas del programa.");
    } catch (fallo) {
      mostrar("error", fallo.message || "No se pudo restaurar.");
    }
  };

  const cambiados = camposModificados(guardadas);

  return (
    <div style={CAJA}>
      <h3 style={{ color: "#854d0e", marginTop: 0 }}>💰 Tarifas de liquidación</h3>

      <p style={{ color: "#713f12", fontSize: "0.9rem", lineHeight: 1.55 }}>
        Estos son los valores con los que se liquida. Al guardarlos aquí quedan
        activos <strong>al instante en la página y en los celulares</strong>, sin
        compilar ni reinstalar la aplicación. Referencia del programa:{" "}
        <strong>{TARIFAS_BASE.resolucion}</strong>.
      </p>

      {cambiados.length > 0 && (
        <div style={{ background: "#fff7ed", border: "1px solid #fb923c", borderRadius: "8px", padding: "10px 13px", marginBottom: "1rem", fontSize: "0.87rem", color: "#9a3412" }}>
          ✏️ Hay {cambiados.length} valor{cambiados.length === 1 ? "" : "es"} distinto
          {cambiados.length === 1 ? "" : "s"} al del programa: {cambiados.join(", ")}.
        </div>
      )}

      {aviso && (
        <div style={{
          background: aviso.tipo === "ok" ? "#dcfce7" : "#fee2e2",
          border: `1px solid ${aviso.tipo === "ok" ? "#166534" : "#b91c1c"}`,
          color: aviso.tipo === "ok" ? "#166534" : "#b91c1c",
          borderRadius: "8px", padding: "10px 14px", marginBottom: "1rem", fontSize: "0.9rem",
        }}>
          {aviso.texto}
        </div>
      )}

      <form onSubmit={enviar}>
        {CAMPOS_TARIFA.map(({ grupo, campos }) => (
          <div key={grupo} style={{ background: "white", borderRadius: "10px", padding: "1rem", marginBottom: "1rem", border: "1px solid #fde68a" }}>
            <strong style={{ color: "#854d0e", fontSize: "0.92rem" }}>{grupo}</strong>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "0.9rem", marginTop: "0.8rem" }}>
              {campos.map(({ clave, etiqueta, tipo, ayuda }) => {
                const actual = leerCampo(borrador, clave);
                const original = leerCampo(TARIFAS_BASE, clave);
                const distinto = actual !== original;
                return (
                  <div key={clave}>
                    <label htmlFor={`t-${clave}`} style={{ display: "block", fontSize: "0.83rem", fontWeight: "bold", color: "#374151", marginBottom: "4px" }}>
                      {etiqueta} {tipo === "porcentaje" && <span style={{ fontWeight: "normal", color: "#6b7280" }}>(%)</span>}
                    </label>
                    <input
                      id={`t-${clave}`}
                      type="number"
                      min="0"
                      step={tipo === "porcentaje" ? "0.01" : "100"}
                      value={aVista(actual, tipo)}
                      onChange={cambiar(clave, tipo)}
                      style={{ ...INPUT, borderColor: distinto ? "#fb923c" : "#d1d5db", background: distinto ? "#fff7ed" : "white" }}
                    />
                    {distinto && (
                      <small style={{ fontSize: "0.73rem", color: "#9a3412" }}>
                        el programa trae {tipo === "porcentaje" ? `${(original * 100).toFixed(2)}%` : formatCOP(original)}
                      </small>
                    )}
                    {ayuda && !distinto && (
                      <small style={{ fontSize: "0.73rem", color: "#6b7280" }}>{ayuda}</small>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Tramos de cuantía */}
        <div style={{ background: "white", borderRadius: "10px", padding: "1rem", marginBottom: "1rem", border: "1px solid #fde68a" }}>
          <strong style={{ color: "#854d0e", fontSize: "0.92rem" }}>Tramos de cuantía (ORIP)</strong>
          <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: "0.4rem 0 0.8rem" }}>
            Se aplica el primer tramo cuyo tope no supere el valor del acto. El
            primero no lleva porcentaje: ahí se cobra el derecho mínimo. El
            último no tiene tope: déjalo vacío.
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
              <thead>
                <tr style={{ background: "#fef3c7", color: "#854d0e" }}>
                  <th style={{ padding: "8px", textAlign: "left" }}>TRAMO</th>
                  <th style={{ padding: "8px", textAlign: "right" }}>HASTA (valor del acto)</th>
                  <th style={{ padding: "8px", textAlign: "right" }}>PORCENTAJE (%)</th>
                </tr>
              </thead>
              <tbody>
                {borrador.tramos.map((t, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #fef3c7" }}>
                    <td style={{ padding: "7px" }}>{i + 1}</td>
                    <td style={{ padding: "7px" }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={t.limite === null ? "" : t.limite.toLocaleString("es-CO")}
                        onChange={cambiarTramo(i, "limite")}
                        placeholder="sin tope"
                        style={INPUT}
                      />
                    </td>
                    <td style={{ padding: "7px" }}>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={t.tasa === null ? "" : +(t.tasa * 100).toFixed(4)}
                        onChange={cambiarTramo(i, "tasa")}
                        placeholder="derecho mínimo"
                        style={INPUT}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            type="submit"
            disabled={guardando}
            style={{
              padding: "11px 24px", background: guardando ? "#9ca3af" : "#854d0e",
              color: "white", border: "none", borderRadius: "8px",
              cursor: guardando ? "wait" : "pointer", fontWeight: "bold", fontSize: "0.98rem",
            }}
          >
            {guardando ? "Guardando…" : "Guardar tarifas"}
          </button>

          <button
            type="button"
            onClick={volverAlCodigo}
            style={{
              padding: "11px 20px", background: "white", color: "#854d0e",
              border: "1px solid #d97706", borderRadius: "8px", cursor: "pointer", fontSize: "0.95rem",
            }}
          >
            Volver a las del programa
          </button>
        </div>
      </form>

      <p style={{ fontSize: "0.82rem", color: "#78350f", marginTop: "1rem", lineHeight: 1.5 }}>
        ⚠️ Cambiar estos valores altera <strong>todas</strong> las liquidaciones que
        se hagan de aquí en adelante. Revisa contra la resolución antes de
        guardar; si algo queda mal, "Volver a las del programa" deshace todo.
        Los porcentajes del impuesto de registro por acto (1% y 0,5%) no están
        aquí: los fija la Ley 223 de 1995 y siguen en el código.
      </p>
    </div>
  );
}
