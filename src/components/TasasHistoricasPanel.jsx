// Panel de admin para mantener la tabla mensual de tasas de usura.
//
// Antes esta tabla estaba escrita dentro del código y agregar un mes obligaba a
// editar un archivo y volver a desplegar la página. Ahora se guarda en Firestore
// (config/tasasHistoricas) y se administra desde aquí.
import { useState, useMemo } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { TASAS_BASE, claveMes } from "../utils/tasasHistoricas";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const HOY = new Date();

export default function TasasHistoricasPanel({ tasasGuardadas }) {
  const [anio, setAnio] = useState(HOY.getFullYear());
  const [mes, setMes] = useState(HOY.getMonth() + 1);
  const [porcentaje, setPorcentaje] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState(null);

  // Lo guardado en Firestore manda sobre la tabla del código
  const tablaCompleta = useMemo(
    () => ({ ...TASAS_BASE, ...(tasasGuardadas || {}) }),
    [tasasGuardadas]
  );

  // Últimos 14 meses, del más reciente al más antiguo
  const ultimos = useMemo(
    () =>
      Object.entries(tablaCompleta)
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 14),
    [tablaCompleta]
  );

  const claveActual = claveMes(anio, mes);
  const valorActual = tablaCompleta[claveActual];

  const guardar = async (e) => {
    e.preventDefault();
    const pct = parseFloat(porcentaje);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      setAviso({ tipo: "error", texto: "Escribe un porcentaje válido, por ejemplo 29.66" });
      return;
    }

    setGuardando(true);
    setAviso(null);
    try {
      // merge: true → solo toca el mes indicado, no reescribe los demás
      await setDoc(
        doc(db, "config", "tasasHistoricas"),
        { meses: { [claveActual]: pct / 100 } },
        { merge: true }
      );
      setPorcentaje("");
      setAviso({
        tipo: "ok",
        texto: `Guardado: ${MESES[mes - 1]} ${anio} = ${pct.toFixed(2)}%`,
      });
      setTimeout(() => setAviso(null), 5000);
    } catch (fallo) {
      setAviso({ tipo: "error", texto: `No se pudo guardar: ${fallo.message}` });
    } finally {
      setGuardando(false);
    }
  };

  const etiqueta = (clave) => {
    const [a, m] = clave.split("-");
    return `${MESES[parseInt(m, 10) - 1]} ${a}`;
  };

  return (
    <div style={{
      background: "#eff6ff", border: "1px solid #93c5fd", borderRadius: "12px",
      padding: "1.5rem", marginTop: "1.5rem", maxWidth: "600px"
    }}>
      <h3 style={{ color: "#1e40af", marginTop: 0, marginBottom: "0.6rem" }}>
        🗓️ Tasas de usura por mes
      </h3>

      <p style={{ fontSize: "0.86rem", color: "#334155", lineHeight: 1.5, marginBottom: "1rem" }}>
        Esta es la tabla que usa la columna <strong>% MORA</strong> de la liquidación.
        La Gobernación aplica la tasa del <strong>mes en que vence el plazo</strong> de
        2 meses; si el pago ocurre en un año posterior, aplica la de <strong>enero del
        año de pago</strong>. Agrega aquí cada mes nuevo que certifique la Superfinanciera.
      </p>

      <form onSubmit={guardar} style={{ background: "white", borderRadius: "8px", padding: "1rem", border: "1px solid #bfdbfe" }}>
        <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column", flex: "1 1 110px" }}>
            <label htmlFor="tasa-mes" style={{ fontWeight: "bold", color: "#374151", fontSize: "0.85rem", marginBottom: "4px" }}>
              Mes
            </label>
            <select
              id="tasa-mes"
              value={mes}
              onChange={(e) => setMes(parseInt(e.target.value, 10))}
              style={{ padding: "10px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "0.95rem" }}
            >
              {MESES.map((nombre, i) => (
                <option key={nombre} value={i + 1}>{nombre}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", flex: "0 1 100px" }}>
            <label htmlFor="tasa-anio" style={{ fontWeight: "bold", color: "#374151", fontSize: "0.85rem", marginBottom: "4px" }}>
              Año
            </label>
            <input
              id="tasa-anio"
              type="number"
              min="2020"
              max="2100"
              value={anio}
              onChange={(e) => setAnio(parseInt(e.target.value, 10) || HOY.getFullYear())}
              style={{ padding: "10px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "0.95rem", width: "100%" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", flex: "0 1 120px" }}>
            <label htmlFor="tasa-pct" style={{ fontWeight: "bold", color: "#374151", fontSize: "0.85rem", marginBottom: "4px" }}>
              Tasa anual (%)
            </label>
            <input
              id="tasa-pct"
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="29.66"
              value={porcentaje}
              onChange={(e) => setPorcentaje(e.target.value)}
              style={{ padding: "10px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "0.95rem", width: "100%" }}
            />
          </div>
        </div>

        {valorActual !== undefined && (
          <p style={{ fontSize: "0.83rem", color: "#78350f", background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "6px", padding: "8px 10px", marginTop: "0.8rem" }}>
            {MESES[mes - 1]} {anio} ya tiene <strong>{(valorActual * 100).toFixed(2)}%</strong>.
            Si guardas, se reemplaza.
          </p>
        )}

        <button
          type="submit"
          disabled={guardando || !porcentaje}
          style={{
            marginTop: "0.9rem", padding: "10px 24px",
            background: guardando || !porcentaje ? "#9ca3af" : "#1e40af",
            color: "white", border: "none", borderRadius: "8px",
            cursor: guardando || !porcentaje ? "default" : "pointer",
            fontWeight: "bold", fontSize: "0.95rem",
          }}
        >
          {guardando ? "Guardando…" : "Guardar mes"}
        </button>

        {aviso && (
          <div style={{
            marginTop: "0.8rem", fontSize: "0.9rem", fontWeight: "bold",
            color: aviso.tipo === "ok" ? "#166534" : "#b91c1c",
          }}>
            {aviso.tipo === "ok" ? "✅ " : "⚠️ "}{aviso.texto}
          </div>
        )}
      </form>

      {/* Meses cargados */}
      <div style={{ marginTop: "1.2rem" }}>
        <strong style={{ fontSize: "0.9rem", color: "#1e40af" }}>Últimos meses cargados</strong>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "0.6rem" }}>
          {ultimos.map(([clave, tasa]) => {
            const esGuardado = Boolean(tasasGuardadas?.[clave]);
            return (
              <span
                key={clave}
                title={esGuardado ? "Cargado desde esta página" : "Viene de la tabla original del programa"}
                style={{
                  fontSize: "0.78rem",
                  padding: "5px 9px",
                  borderRadius: "6px",
                  background: esGuardado ? "#dbeafe" : "#f1f5f9",
                  border: `1px solid ${esGuardado ? "#93c5fd" : "#e2e8f0"}`,
                  color: "#1e293b",
                  whiteSpace: "nowrap",
                }}
              >
                {etiqueta(clave)}: <strong>{(tasa * 100).toFixed(2)}%</strong>
              </span>
            );
          })}
        </div>
        <p style={{ fontSize: "0.78rem", color: "#64748b", marginTop: "0.6rem" }}>
          Los de fondo azul se cargaron desde esta página; los grises vienen de la
          tabla original del programa.
        </p>
      </div>
    </div>
  );
}
