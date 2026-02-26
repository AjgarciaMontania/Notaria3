// src/App.jsx
import { useState, useRef, useCallback } from "react";
import InputSection from "./components/InputSection";
import ResultTable from "./components/ResultTable";
import EscriturasPendientes from "./components/EscriturasPendientes";

import icontecLogo from './assets/icontec-iso9001.png';
import iqnetLogo from './assets/iqnet.png';
import ucncLogo from './assets/ucnc.jpg';
import uinLogo from './assets/uin.png';
import officePhoto from './assets/office-photo.jpg';

import { formatNumberWithPoints } from "./utils/formatters";
import "./index.css";

function App() {
  const [activeTab, setActiveTab] = useState("liquidacion");

  const [rows, setRows] = useState([]);
  const [hasInserted, setHasInserted] = useState(false);

  const [compraventa, setCompraventa] = useState("");
  const [certificado, setCertificado] = useState("");
  const [hipoteca, setHipoteca] = useState("");
  const [saber, setSaber] = useState("");
  const [igac, setIgac] = useState("");
  const [donacion, setDonacion] = useState("");
  const [permuta, setPermuta] = useState("");
  const [sucesion, setSucesion] = useState("");
  const [sinCuantia, setSinCuantia] = useState("");
  const [dineroEnviado, setDineroEnviado] = useState("");

  const resultRef = useRef();

  const handleCompraventaChange = useCallback((e) => setCompraventa(e.target.value), []);
  const handleCertificadoChange = useCallback((e) => setCertificado(e.target.value), []);
  const handleHipotecaChange = useCallback((e) => setHipoteca(e.target.value), []);
  const handleSaberChange = useCallback((e) => setSaber(e.target.value), []);
  const handleIgacChange = useCallback((e) => setIgac(e.target.value), []);
  const handleDonacionChange = useCallback((e) => setDonacion(e.target.value), []);
  const handlePermutaChange = useCallback((e) => setPermuta(e.target.value), []);
  const handleSucesionChange = useCallback((e) => setSucesion(e.target.value), []);
  const handleSinCuantiaChange = useCallback((e) => setSinCuantia(e.target.value), []);

  const handleDineroChange = useCallback((e) => {
    const val = e.target.value.replace(/[^\d]/g, "");
    setDineroEnviado(formatNumberWithPoints(val));
  }, []);

  const handleIngresar = useCallback(() => {
    const counts = {
      compraventa: parseInt(compraventa) || 0,
      certificado: parseInt(certificado) || 0,
      hipoteca: parseInt(hipoteca) || 0,
      saber: parseInt(saber) || 0,
      igac: parseInt(igac) || 0,
      donacion: parseInt(donacion) || 0,
      permuta: parseInt(permuta) || 0,
      sucesion: parseInt(sucesion) || 0,
      sinCuantia: parseInt(sinCuantia) || 0,
    };

    const newRows = [];
    const add = (acto, count) => {
      for (let i = 0; i < count; i++) {
        newRows.push({
          acto,
          numeroEscritura: '',
          fechaEscritura: '2026-02-16',
          foliosAdicionales: 0,
          valorActo: '',
          tributaria: null,
          orip: null,
          total: null,
        });
      }
    };

    add("COMPRAVENTA", counts.compraventa);
    add("CERTIFICADO CANCELACIÓN HIPOTECA", counts.certificado);
    add("HIPOTECA CON BANCO AGRARIO", counts.hipoteca);
    add("ESCRITURA PARA SABER", counts.saber);
    add("TRAMITE IGAC", counts.igac);
    add("DONACIÓN", counts.donacion);
    add("PERMUTA", counts.permuta);
    add("SUCESIÓN", counts.sucesion);
    add("ACTO SIN CUANTÍA", counts.sinCuantia);

    setRows(newRows);
    setHasInserted(true);
  }, [compraventa, certificado, hipoteca, saber, igac, donacion, permuta, sucesion, sinCuantia]);

  const handleLimpiar = useCallback(() => {
    setCompraventa(""); setCertificado(""); setHipoteca("");
    setSaber(""); setIgac(""); setDonacion("");
    setPermuta(""); setSucesion(""); setSinCuantia("");
    setDineroEnviado("");
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
        <button
          onClick={() => setActiveTab("liquidacion")}
          style={{
            padding: "14px 28px",
            margin: "0 8px",
            fontSize: "1.15rem",
            background: activeTab === "liquidacion" ? "#166534" : "#e5e7eb",
            color: activeTab === "liquidacion" ? "white" : "#333",
            border: "none",
            borderRadius: "12px",
            cursor: "pointer"
          }}
        >
          📋 Liquidación Notarial
        </button>
        <button
          onClick={() => setActiveTab("escrituras")}
          style={{
            padding: "14px 28px",
            margin: "0 8px",
            fontSize: "1.15rem",
            background: activeTab === "escrituras" ? "#166534" : "#e5e7eb",
            color: activeTab === "escrituras" ? "white" : "#333",
            border: "none",
            borderRadius: "12px",
            cursor: "pointer"
          }}
        >
          📁 Escrituras Pendientes Florencia
        </button>
      </div>

      {/* PESTAÑA LIQUIDACIÓN */}
      {activeTab === "liquidacion" && (
        <>
          <InputSection
            compraventa={compraventa} onCompraventaChange={handleCompraventaChange}
            certificado={certificado} onCertificadoChange={handleCertificadoChange}
            hipoteca={hipoteca} onHipotecaChange={handleHipotecaChange}
            saber={saber} onSaberChange={handleSaberChange}
            igac={igac} onIgacChange={handleIgacChange}
            donacion={donacion} onDonacionChange={handleDonacionChange}
            permuta={permuta} onPermutaChange={handlePermutaChange}
            sucesion={sucesion} onSucesionChange={handleSucesionChange}
            sinCuantia={sinCuantia} onSinCuantiaChange={handleSinCuantiaChange}
            dineroEnviado={dineroEnviado} onDineroChange={handleDineroChange}
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
      {activeTab === "escrituras" && (
        <EscriturasPendientes />
      )}
    </div>
  );
}

export default App;