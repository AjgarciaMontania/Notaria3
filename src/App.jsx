// src/App.jsx
import { useState, useRef, useCallback, useEffect } from "react";
import InputSection from "./components/InputSection";
import ResultTable from "./components/ResultTable";
import { ACTOS_CONFIG } from "./utils/actosConfig";
import EscriturasPendientes from "./components/EscriturasPendientes";
import Evidencias from "./components/Evidencias";
import TasaMoraPanel from "./components/TasaMoraPanel";
import TasasHistoricasPanel from "./components/TasasHistoricasPanel";
import { useTasaMora } from "./hooks/useTasaMora";
import { useTasasHistoricas } from "./hooks/useTasasHistoricas";
import { useAuth } from "./hooks/useAuth";
import { useRol } from "./hooks/useRol";
import UsuariosPanel from "./components/UsuariosPanel";
import { puedeOperar, puedeAdministrarUsuarios, ETIQUETAS_ROL, ROL_POR_DEFECTO } from "./utils/roles.js";

import icontecLogo from './assets/icontec-iso9001.png';
import iqnetLogo from './assets/iqnet.png';
import ucncLogo from './assets/ucnc.jpg';
import uinLogo from './assets/uin.png';
import officePhoto from './assets/office-photo.jpg';

import { formatNumberWithPoints } from "./utils/formatters";
import "./index.css";

const TODAY = new Date().toISOString().split("T")[0];
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutos

const COUNTS_INITIAL = {
  compraventa: "",
  certificado: "",
  hipoteca: "",
  saber: "",
  igac: "",
  donacionParticular: "",
  donacionPublica: "",
  permuta: "",
  sucesion: "",
  sinCuantia: "",
  cancelEnaje: "",
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

  // ── Autenticación con Firebase (una cuenta por persona) ─────────────────────
  const { usuario, cargando: cargandoSesion, error: errorAuth, setError: setErrorAuth, entrar, salir } = useAuth();
  // Hay sesión abierta ≠ tiene permiso. El nivel lo decide el rol de Firestore.
  const haySesion = Boolean(usuario);
  const { rol, cargando: cargandoRol } = useRol(usuario);
  // isAdmin conserva su nombre: significa "puede trabajar con evidencias,
  // escrituras y tasas". Un invitado (solo liquidar) NO lo es.
  const isAdmin = haySesion && puedeOperar(rol);
  const esAdministrador = haySesion && puedeAdministrarUsuarios(rol);
  // Sesión abierta pero sin permiso para las pestañas protegidas
  const sesionSinPermiso = haySesion && !cargandoRol && !isAdmin;
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [entrando, setEntrando] = useState(false);
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
      salir();
      setClave("");
      setSessionExpired(true);
    }, INACTIVITY_TIMEOUT_MS);
  }, [clearTimer, salir]);

  // Inicia/reinicia timer al detectar actividad (solo cuando hay sesión activa)
  useEffect(() => {
    if (!haySesion) {
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
  }, [haySesion, startTimer, clearTimer]);

  const handleAdminLogin = useCallback(async (e) => {
    if (e) e.preventDefault();
    if (!correo.trim() || !clave) {
      setErrorAuth("Escribe tu correo y tu contraseña.");
      return;
    }
    setEntrando(true);
    const ok = await entrar(correo, clave);
    setEntrando(false);
    if (ok) {
      setClave("");
      setSessionExpired(false);
    }
  }, [correo, clave, entrar, setErrorAuth]);

  const handleAdminLogout = useCallback(() => {
    salir();
    setClave("");
    clearTimer();
  }, [clearTimer, salir]);
  // ────────────────────────────────────────────────────────────────────────────

  const { tasaAnual, meta, loading: loadingTasa } = useTasaMora();
  const { tasas: tasasHistoricas } = useTasasHistoricas();
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
      const config = ACTOS_CONFIG[acto] || {};
      for (let i = 0; i < count; i++) {
        newRows.push({
          acto,
          numeroEscritura: "",
          fechaEscritura: TODAY,
          foliosAdicionales: 0,
          valorActo: "",
          // numActos: cuántos actos sin cuantía contiene este documento (editable en tabla)
          numActos: config.oripTipo === "sin_cuantia" ? (config.oripCount || 1) : 1,
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
    add("DONACIÓN PARTICULAR", parsed.donacionParticular);
    add("DONACIÓN ENTIDAD PÚBLICA", parsed.donacionPublica);
    add("PERMUTA", parsed.permuta);
    add("SUCESIÓN", parsed.sucesion);
    add("ACTO SIN CUANTÍA", parsed.sinCuantia);
    add("CANCELACIÓN ENAJENACIÓN", parsed.cancelEnaje);

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
  const isProtectedTab = activeTab === "escrituras" || activeTab === "evidencias" || activeTab === "usuarios";

  return (
    <div>
      <header>
        <img src={ucncLogo} alt="Unión Colegiada del Notariado Colombiano" className="logo" />
        <h2>NOTARÍA ÚNICA DE CARTAGENA DEL CHAIRA</h2>
        <img src={officePhoto} alt="Foto de la Notaría" className="office-photo" />
      </header>

      <h1>NOTARÍA ÚNICA DE CARTAGENA DEL CHAIRA</h1>

      {/* PESTAÑAS */}
      <div className="tabs-nav">
        <button onClick={() => setActiveTab("liquidacion")} style={tabStyle(activeTab === "liquidacion")}>
          Liquidación Notarial
        </button>
        <button onClick={() => setActiveTab("escrituras")} style={tabStyle(activeTab === "escrituras")}>
          Escrituras Pendientes Florencia
        </button>
        <button onClick={() => setActiveTab("evidencias")} style={tabStyle(activeTab === "evidencias")}>
          Evidencias
        </button>
        {esAdministrador && (
          <button onClick={() => setActiveTab("usuarios")} style={tabStyle(activeTab === "usuarios")}>
            👥 Usuarios
          </button>
        )}
      </div>

      {/* PANEL DE AUTENTICACIÓN (compartido para Escrituras y Evidencias) */}
      {isProtectedTab && !haySesion && !cargandoSesion && (
        <form
          onSubmit={handleAdminLogin}
          style={{ maxWidth: "400px", width: "100%", margin: "2rem auto", padding: "2rem 1.5rem", background: "#f3f4f6", borderRadius: "16px", boxShadow: "0 4px 16px rgba(0,0,0,0.08)" }}
        >
          <h3 style={{ textAlign: "center", color: "#166534", marginBottom: "1.5rem" }}>
            🔒 Acceso del personal
          </h3>

          {sessionExpired && (
            <div style={{ background: "#fef3c7", border: "1px solid #d97706", borderRadius: "8px", padding: "10px 14px", marginBottom: "1rem", color: "#92400e", fontSize: "0.9rem" }}>
              ⏱ Sesión cerrada automáticamente por inactividad (5 min).
            </div>
          )}

          {errorAuth && (
            <div style={{ background: "#fee2e2", border: "1px solid #b91c1c", borderRadius: "8px", padding: "10px 14px", marginBottom: "1rem", color: "#b91c1c", fontSize: "0.9rem" }}>
              {errorAuth}
            </div>
          )}

          <label htmlFor="correo" style={{ display: "block", fontWeight: "bold", marginBottom: "0.5rem", color: "#374151" }}>
            Correo:
          </label>
          <input
            id="correo"
            type="email"
            autoComplete="username"
            value={correo}
            onChange={(e) => { setCorreo(e.target.value); setErrorAuth(""); setSessionExpired(false); }}
            placeholder="nombre@notaria.gov.co"
            style={{ width: "100%", padding: "12px", fontSize: "1rem", border: "1px solid #d1d5db", borderRadius: "8px", marginBottom: "1rem", boxSizing: "border-box" }}
            autoFocus
          />

          <label htmlFor="clave" style={{ display: "block", fontWeight: "bold", marginBottom: "0.5rem", color: "#374151" }}>
            Contraseña:
          </label>
          <input
            id="clave"
            type="password"
            autoComplete="current-password"
            value={clave}
            onChange={(e) => { setClave(e.target.value); setErrorAuth(""); setSessionExpired(false); }}
            placeholder="Tu contraseña"
            style={{ width: "100%", padding: "12px", fontSize: "1rem", border: "1px solid #d1d5db", borderRadius: "8px", marginBottom: "1rem", boxSizing: "border-box" }}
          />

          <button
            type="submit"
            disabled={entrando}
            style={{ width: "100%", padding: "12px", background: entrando ? "#6b7280" : "#166534", color: "white", border: "none", borderRadius: "8px", cursor: entrando ? "wait" : "pointer", fontSize: "1rem", fontWeight: "bold" }}
          >
            {entrando ? "Entrando…" : "Iniciar sesión"}
          </button>

          <p style={{ textAlign: "center", marginTop: "1rem", color: "#6b7280", fontSize: "0.85rem" }}>
            Cada persona usa su propia cuenta. La sesión se cierra sola tras
            5 minutos de inactividad y al cerrar el navegador.
          </p>
        </form>
      )}

      {/* Sesión abierta, pero con un nivel que no alcanza para esta pestaña */}
      {isProtectedTab && sesionSinPermiso && (
        <div style={{ maxWidth: "520px", margin: "2rem auto", padding: "1.75rem 1.5rem", background: "#fffbeb", border: "1px solid #d97706", borderRadius: "16px", textAlign: "center" }}>
          <h3 style={{ color: "#92400e", marginTop: 0 }}>Tu cuenta no tiene acceso a esta sección</h3>
          <p style={{ color: "#92400e", fontSize: "0.95rem", lineHeight: 1.6 }}>
            {usuario?.email} entra con el nivel{" "}
            <strong>{ETIQUETAS_ROL[rol ?? ROL_POR_DEFECTO]?.nombre}</strong>, que
            solo permite liquidar. La calculadora de esta página es de uso libre:
            puedes usarla sin iniciar sesión, en la pestaña "Liquidación Notarial".
          </p>
          <p style={{ color: "#92400e", fontSize: "0.9rem" }}>
            Si necesitas entrar aquí, pídele al administrador que te cambie el nivel.
          </p>
          <button
            onClick={handleAdminLogout}
            style={{ padding: "10px 20px", background: "#6b7280", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", fontSize: "0.95rem" }}
          >
            Cerrar sesión
          </button>
        </div>
      )}

      {/* Mientras Firebase comprueba si ya había sesión abierta */}
      {isProtectedTab && cargandoSesion && (
        <p style={{ textAlign: "center", padding: "3rem 1rem", color: "#6b7280" }}>
          Comprobando sesión…
        </p>
      )}

      {/* BARRA DE SESIÓN (cuando admin está activo en pestañas protegidas) */}
      {isProtectedTab && isAdmin && (
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap", maxWidth: "1380px", margin: "0 auto 0.5rem", padding: "0 1rem", gap: "0.75rem" }}>
          <span style={{ color: "#166534", fontSize: "0.9rem", fontWeight: "bold" }}>
            ✅ {usuario?.email} · Cierre automático por inactividad en 5 min
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
            donacionParticular={counts.donacionParticular} onDonacionParticularChange={handleCountChange("donacionParticular")}
            donacionPublica={counts.donacionPublica} onDonacionPublicaChange={handleCountChange("donacionPublica")}
            permuta={counts.permuta} onPermutaChange={handleCountChange("permuta")}
            sucesion={counts.sucesion} onSucesionChange={handleCountChange("sucesion")}
            sinCuantia={counts.sinCuantia} onSinCuantiaChange={handleCountChange("sinCuantia")}
            cancelEnaje={counts.cancelEnaje} onCancelEnajeChange={handleCountChange("cancelEnaje")}
            dineroEnviado={dineroEnviado} onDineroChange={handleDineroChange}
            fechaPago={fechaPago} onFechaPagoChange={handleFechaPagoChange}
            onIngresar={handleIngresar}
            onCalcular={handleCalcular}
            onLimpiar={handleLimpiar}
            onExportar={handleExportar}
            calcularDisabled={!hasInserted}
          />

          {/* Indicador de tasa vigente (visible para todos) */}
          {!loadingTasa && (
            <div style={{ maxWidth: "1380px", margin: "0 auto 0.5rem", padding: "0 1rem", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "#6b7280" }}>
              <span>📊 Tasa de mora vigente:</span>
              <strong style={{ color: "#166534" }}>{(tasaAnual * 100).toFixed(2)}% anual</strong>
              {meta?.fechaActualizacion && <span>· actualizada {meta.fechaActualizacion}</span>}
              {isAdmin && <span style={{ color: "#d97706", marginLeft: "0.5rem" }}>· (editable abajo)</span>}
            </div>
          )}

          <ResultTable
            ref={resultRef}
            rows={rows}
            setRows={setRows}
            calcularDisabled={!hasInserted}
            fechaPago={fechaPago}
            tasaMoraDefault={tasaAnual}
            tasasHistoricas={tasasHistoricas}
          />

          {/* Panel admin para actualizar tasa */}
          {isAdmin && (
            <div style={{ maxWidth: "1380px", margin: "0 auto", padding: "0 1rem 2rem" }}>
              <TasaMoraPanel meta={meta} loading={loadingTasa} />
              <TasasHistoricasPanel tasasGuardadas={tasasHistoricas} />
            </div>
          )}

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

      {/*
        Estas dos pestañas solo se montan con sesión iniciada. Antes se
        montaban siempre y ahora, con las reglas de Firebase cerradas,
        intentarían leer sin permiso y llenarían la consola de errores.
      */}
      {activeTab === "escrituras" && isAdmin && <EscriturasPendientes isAdmin={isAdmin} />}

      {activeTab === "evidencias" && isAdmin && <Evidencias isAdmin={isAdmin} />}

      {activeTab === "usuarios" && esAdministrador && (
        <UsuariosPanel correoActual={usuario?.email?.toLowerCase()} />
      )}
    </div>
  );
}

export default App;
