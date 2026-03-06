// src/App.jsx
import { useState, useRef, useCallback, useEffect } from "react";
import InputSection from "./components/InputSection";
import ResultTable from "./components/ResultTable";
import EscriturasPendientes from "./components/EscriturasPendientes";
import Evidencias from "./components/Evidencias";

import icontecLogo from './assets/icontec-iso9001.png';
import iqnetLogo from './assets/iqnet.png';
import ucncLogo from './assets/ucnc.jpg';
import uinLogo from './assets/uin.png';
import officePhoto from './assets/office-photo.jpg';

import { formatNumberWithPoints } from "./utils/formatters";
import "./index.css";

const TODAY = new Date().toISOString().split("T")[0];
const ADMIN_PASSWORD = "notaria2026";
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos

const COUNTS_INITIAL = {
  compraventa: "",
  certificado: "",
  hipoteca: "",
  saber: "",
  igac: "",
  donacion: "",
  permuta: "",
  sucesion: "",
  sinCuantia: "",
};

const TAB_STYLE_BASE = {
  padding: "14px 28px",
  margin: "0 8px",
  fontSize: "1.15rem",
  border: "none",
  borderRadius: "12px",
  cursor: "pointer",
};

function tabStyle(active) {
  return { ...TAB_STYLE_BASE, background: active ? "#166534" : "#e5e7eb", color: active ? "white" : "#333" };
}

function App() {
  const [activeTab, setActiveTab] = useState("liquidacion");
  const [rows, setRows] = useState([]);
  const [hasInserted, setHasInserted] = useState(false);
  const [counts, setCounts] = useState(COUNTS_INITIAL);
  const [dineroEnviado, setDineroEnviado] = useState("");
  const [fechaPago, setFechaPago] = useState(TODAY);

  // ── Autenticación centralizada ──────────────────────────────────────────────
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminPwd, setAdminPwd] = useState("");
  const [sessionExpired, setSessionExpired] = useState(false);
  const timerRef = useRef(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      setIsAdmin(false);
      setAdminPwd("");
      setSessionExpired(true);
    }, INACTIVITY_TIMEOUT_MS);
  }, [clearTimer]);

  // Inicia/reinicia timer al detectar actividad (solo cuando hay sesión activa)
  useEffect(() => {
    if (!isAdmin) {
      clearTimer();
      return;
    }
    startTimer();
    const handleActivity = () => startTimer();
    const events = ["click", "keydown", "mousemove", "touchstart"];
    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));
    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
      clearTimer();
    };
  }, [isAdmin, startTimer, clearTimer]);

  const handleAdminLogin = useCallback(() => {
    if (adminPwd === ADMIN_PASSWORD) {
      setIsAdmin(true);
      setAdminPwd("");
      setSessionExpired(false);
    } else {
      alert("Contraseña incorrecta");
    }
  }, [adminPwd]);

  const handleAdminLogout = useCallback(() => {
    setIsAdmin(false);
    setAdminPwd("");
    clearTimer();
  }, [clearTimer]);

  // Permitir Enter en el campo de contraseña
  const handlePwdKeyDown = useCallback((e) => {
    if (e.key === "Enter") handleAdminLogin();
  }, [handleAdminLogin]);
  // ────────────────────────────────────────────────────────────────────────────

  const resultRef = useRef();

  const handleCountChange = useCallback((field) => (e) => {
    setCounts((prev) => ({ ...prev, [field]: e.target.value }));
  }, []);

  const handleDineroChange = useCallback((e) => {
    const val = e.target.value.replace(/[^\d]/g, "");
    setDineroEnviado(formatNumberWithPoints(val));
  }, []);

  const handleIngresar = useCallback(() => {
    const parsed = Object.fromEntries(
      Object.entries(counts).map(([k, v]) => [k, parseInt(v) || 0])
    );

    const newRows = [];
    const add = (acto, count) => {
      for (let i = 0; i < count; i++) {
        newRows.push({
          acto,
          numeroEscritura: "",
          fechaEscritura: TODAY,
          foliosAdicionales: 0,
          valorActo: "",
          tributaria: null,
          orip: null,
          total: null,
        });
      }
    };

    add("COMPRAVENTA", parsed.compraventa);
    add("CERTIFICADO CANCELACIÓN HIPOTECA", parsed.certificado);
    add("HIPOTECA CON BANCO AGRARIO", parsed.hipoteca);
    add("ESCRITURA PARA SABER", parsed.saber);
    add("TRAMITE IGAC", parsed.igac);
    add("DONACIÓN", parsed.donacion);
    add("PERMUTA", parsed.permuta);
    add("SUCESIÓN", parsed.sucesion);
    add("ACTO SIN CUANTÍA", parsed.sinCuantia);

    setRows(newRows);
    setHasInserted(true);
  }, [counts]);

  const handleFechaPagoChange = useCallback((e) => {
    setFechaPago(e.target.value);
  }, []);

  const handleLimpiar = useCallback(() => {
    setCounts(COUNTS_INITIAL);
    setDineroEnviado("");
    setFechaPago(TODAY);
    setRows([]);
    setHasInserted(false);
  }, []);

  const handleCalcular = useCallback((dineroStr) => {
    if (!hasInserted) {
      alert("Primero debe hacer clic en 'Ingresar' antes de calcular.");
      return;
    }
    resultRef.current?.calcularTodo(dineroStr);
  }, [hasInserted]);

  const handleExportar = useCallback(() => {
    if (!hasInserted || rows.length === 0) {
      alert("Primero ingrese datos y calcule.");
      return;
    }
    resultRef.current?.exportToExcel();
  }, [hasInserted, rows.length]);

  // Panel de login compartido para pestañas protegidas
  const isProtectedTab = activeTab === "escrituras" || activeTab === "evidencias";

  return (
    <div>
      <header>
        <img src={ucncLogo} alt="Unión Colegiada del Notariado Colombiano" className="logo" />
        <h2>NOTARÍA ÚNICA DE CARTAGENA DEL CHAIRA</h2>
        <img src={officePhoto} alt="Foto de la Notaría" className="office-photo" />
      </header>

      <h1>NOTARÍA ÚNICA DE CARTAGENA DEL CHAIRA</h1>

      {/* PESTAÑAS */}
      <div style={{ textAlign: "center", margin: "20px 0" }}>
        <button onClick={() => setActiveTab("liquidacion")} style={tabStyle(activeTab === "liquidacion")}>
          Liquidación Notarial
        </button>
        <button onClick={() => setActiveTab("escrituras")} style={tabStyle(activeTab === "escrituras")}>
          Escrituras Pendientes Florencia
        </button>
        <button onClick={() => setActiveTab("evidencias")} style={tabStyle(activeTab === "evidencias")}>
          Evidencias
        </button>
      </div>

      {/* PANEL DE AUTENTICACIÓN (compartido para Escrituras y Evidencias) */}
      {isProtectedTab && !isAdmin && (
        <div style={{ maxWidth: "400px", margin: "2rem auto", padding: "2rem", background: "#f3f4f6", borderRadius: "16px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}>
          <h3 style={{ textAlign: "center", color: "#166534", marginBottom: "1.5rem" }}>
            🔒 Acceso de Administrador
          </h3>
          {sessionExpired && (
            <div style={{ background: "#fef3c7", border: "1px solid #d97706", borderRadius: "8px", padding: "10px 14px", marginBottom: "1rem", color: "#92400e", fontSize: "0.9rem" }}>
              ⏱ Sesión cerrada automáticamente por inactividad (30 min).
            </div>
          )}
          <label style={{ display: "block", fontWeight: "bold", marginBottom: "0.5rem", color: "#374151" }}>
            Contraseña Admin:
          </label>
          <input
            type="password"
            value={adminPwd}
            onChange={(e) => { setAdminPwd(e.target.value); setSessionExpired(false); }}
            onKeyDown={handlePwdKeyDown}
            placeholder="Ingrese la contraseña"
            style={{ width: "100%", padding: "12px", fontSize: "1rem", border: "1px solid #d1d5db", borderRadius: "8px", marginBottom: "1rem", boxSizing: "border-box" }}
            autoFocus
          />
          <button
            onClick={handleAdminLogin}
            style={{ width: "100%", padding: "12px", background: "#166534", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "1rem", fontWeight: "bold" }}
          >
            Ingresar como Admin
          </button>
          <p style={{ textAlign: "center", marginTop: "1rem", color: "#6b7280", fontSize: "0.85rem" }}>
            La sesión se cierra automáticamente tras 5 min de inactividad.
          </p>
        </div>
      )}

      {/* BARRA DE SESIÓN (cuando admin está activo en pestañas protegidas) */}
      {isProtectedTab && isAdmin && (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", maxWidth: "1200px", margin: "0 auto 0.5rem", padding: "0 1rem", gap: "1rem" }}>
          <span style={{ color: "#166534", fontSize: "0.9rem", fontWeight: "bold" }}>
            ✅ Sesión admin activa · Cierre automático por inactividad en 5 min
          </span>
          <button
            onClick={handleAdminLogout}
            style={{ padding: "8px 18px", background: "#6b7280", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem" }}
          >
            Cerrar Sesión
          </button>
        </div>
      )}

      {/* PESTAÑA LIQUIDACIÓN */}
      {activeTab === "liquidacion" && (
        <>
          <InputSection
            compraventa={counts.compraventa} onCompraventaChange={handleCountChange("compraventa")}
            certificado={counts.certificado} onCertificadoChange={handleCountChange("certificado")}
            hipoteca={counts.hipoteca} onHipotecaChange={handleCountChange("hipoteca")}
            saber={counts.saber} onSaberChange={handleCountChange("saber")}
            igac={counts.igac} onIgacChange={handleCountChange("igac")}
            donacion={counts.donacion} onDonacionChange={handleCountChange("donacion")}
            permuta={counts.permuta} onPermutaChange={handleCountChange("permuta")}
            sucesion={counts.sucesion} onSucesionChange={handleCountChange("sucesion")}
            sinCuantia={counts.sinCuantia} onSinCuantiaChange={handleCountChange("sinCuantia")}
            dineroEnviado={dineroEnviado} onDineroChange={handleDineroChange}
            fechaPago={fechaPago} onFechaPagoChange={handleFechaPagoChange}
            onIngresar={handleIngresar}
            onCalcular={handleCalcular}
            onLimpiar={handleLimpiar}
            onExportar={handleExportar}
            calcularDisabled={!hasInserted}
          />

          <ResultTable
            ref={resultRef}
            rows={rows}
            setRows={setRows}
            calcularDisabled={!hasInserted}
            fechaPago={fechaPago}
          />

          <div id="notaria-info">
            <h2>Nuestra Ubicación</h2>
            <iframe
              width="100%"
              height="450"
              style={{ border: 0, borderRadius: "8px", marginBottom: "2rem" }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3988.5!2d-74.844!3d1.335!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMcKwMjAnMDYuMCJOIDc0wrA1MCczNC44Ilc!5e0!3m2!1ses!2sco!4v1700000000000"
            />

            <div className="info-grid">
              <div className="contacto">
                <h3>Contacto</h3>
                <p><strong>Dirección:</strong> Cl. 5 # 8-5, Cartagena Del Chairá, Caquetá</p>
                <p><strong>Teléfono:</strong> (322) 582 5736</p>
                <p><strong>Email:</strong> unicartagenadelchaira@supernotariado.gov.co</p>
              </div>
              <div className="horario">
                <h3>Horario de Atención</h3>
                <p>Lunes a Viernes: 8:00 a.m. – 12:00 m y 2:00 p.m. a 6:00 p.m.</p>
                <p>Sábado: Cerrado</p>
                <p>Domingo: Cerrado</p>
              </div>
            </div>

            <div className="certificados">
              <p>Miembro de la UINL</p>
              <img src={uinLogo} alt="UINL" style={{ height: "70px" }} />
              <p style={{ marginTop: "1.5rem" }}>Certificado por:</p>
              <img src={icontecLogo} alt="Icontec" style={{ height: "60px", marginRight: "20px" }} />
              <img src={iqnetLogo} alt="IQNet" style={{ height: "60px" }} />
            </div>
          </div>
        </>
      )}

      {/* PESTAÑA ESCRITURAS */}
      {activeTab === "escrituras" && <EscriturasPendientes isAdmin={isAdmin} />}

      {/* PESTAÑA EVIDENCIAS */}
      {activeTab === "evidencias" && <Evidencias isAdmin={isAdmin} />}
    </div>
  );
}

export default App;
