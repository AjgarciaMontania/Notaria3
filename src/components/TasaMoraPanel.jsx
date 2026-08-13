// Panel de admin para consultar y actualizar la tasa de mora en Firestore
import { useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

const SF_URL = "https://www.superfinanciera.gov.co/publicaciones/10829/sala-de-prensacomunicados-de-prensa-interes-bancario-corriente-10829/";

export default function TasaMoraPanel({ meta, loading }) {
  const [nuevoPct, setNuevoPct]   = useState("");
  const [fuente, setFuente]       = useState("");
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk]               = useState(false);

  const handleGuardar = async () => {
    const pct = parseFloat(nuevoPct);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      alert("Ingresa un porcentaje válido (ej: 27.84)");
      return;
    }
    setGuardando(true);
    setOk(false);
    try {
      await setDoc(doc(db, "config", "tasaMora"), {
        tasaAnual:           pct / 100,
        fechaActualizacion:  new Date().toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" }),
        fuente:              fuente.trim() || "Actualización manual",
      });
      setNuevoPct("");
      setFuente("");
      setOk(true);
      setTimeout(() => setOk(false), 4000);
    } catch (e) {
      alert("Error guardando: " + e.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div style={{
      background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "12px",
      padding: "1.5rem", marginTop: "1.5rem", maxWidth: "600px"
    }}>
      <h3 style={{ color: "#166534", marginTop: 0, marginBottom: "1rem" }}>
        📊 Tasa de Mora — Impuesto de Registro
      </h3>

      {/* Tasa vigente */}
      <div style={{ background: "white", borderRadius: "8px", padding: "1rem", marginBottom: "1.2rem", border: "1px solid #d1fae5" }}>
        {loading ? (
          <span style={{ color: "#6b7280" }}>Cargando...</span>
        ) : meta ? (
          <>
            <div style={{ fontSize: "2rem", fontWeight: "bold", color: "#166534" }}>
              {meta.porcentaje}% <span style={{ fontSize: "1rem", fontWeight: "normal", color: "#6b7280" }}>anual simple</span>
            </div>
            <div style={{ fontSize: "0.85rem", color: "#6b7280", marginTop: "4px" }}>
              Actualizado: <strong>{meta.fechaActualizacion}</strong>
              {meta.fuente && <> · Fuente: {meta.fuente}</>}
            </div>
          </>
        ) : (
          <span style={{ color: "#d97706" }}>⚠️ No hay tasa guardada — usando valor por defecto (24.79%)</span>
        )}
      </div>

      {/* Nota explicativa */}
      <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: "8px", padding: "0.8rem 1rem", marginBottom: "1rem", fontSize: "0.83rem", color: "#78350f", lineHeight: "1.5" }}>
        <strong>¿Cómo obtener la tasa?</strong> La Superfinanciera certifica mensualmente la <em>Tasa de Usura</em> (= 1.5 × Interés Bancario Corriente).
        La Gobernación usa esa tasa para liquidar mora de impuestos de registro.
        Ejemplo: usura junio 2026 = <strong>28.79%</strong>. Consulta el valor del mes actual abajo y actualízalo aquí.
      </div>

      {/* Enlace a Superfinanciera */}
      <a
        href={SF_URL}
        target="_blank"
        rel="noreferrer"
        style={{
          display: "inline-block", marginBottom: "1.2rem",
          padding: "8px 16px", background: "#1d4ed8", color: "white",
          borderRadius: "8px", textDecoration: "none", fontSize: "0.9rem"
        }}
      >
        🔗 Ver Interés Bancario Corriente — Superfinanciera
      </a>

      {/* Formulario actualización */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
        <label style={{ fontWeight: "bold", color: "#374151", fontSize: "0.95rem" }}>
          Nueva tasa anual (%)
        </label>
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="Ej: 27.84"
          value={nuevoPct}
          onChange={(e) => setNuevoPct(e.target.value)}
          style={{ padding: "10px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "1rem", maxWidth: "180px" }}
        />
        <label style={{ fontWeight: "bold", color: "#374151", fontSize: "0.95rem" }}>
          Fuente / referencia
        </label>
        <input
          type="text"
          placeholder="Ej: Superfinanciera junio 2026 / Recibo 185000087986"
          value={fuente}
          onChange={(e) => setFuente(e.target.value)}
          style={{ padding: "10px", borderRadius: "8px", border: "1px solid #d1d5db", fontSize: "0.95rem" }}
        />
        <button
          onClick={handleGuardar}
          disabled={guardando || !nuevoPct}
          style={{
            padding: "10px 24px", background: guardando ? "#9ca3af" : "#166534",
            color: "white", border: "none", borderRadius: "8px",
            cursor: guardando ? "default" : "pointer", fontWeight: "bold",
            fontSize: "1rem", alignSelf: "flex-start"
          }}
        >
          {guardando ? "Guardando..." : "Guardar tasa"}
        </button>
        {ok && (
          <div style={{ color: "#166534", fontWeight: "bold", fontSize: "0.95rem" }}>
            ✅ Tasa actualizada. Todos los usuarios verán el nuevo valor al instante.
          </div>
        )}
      </div>
    </div>
  );
}
