// Respaldo de los datos. Solo lo ve el administrador.
//
// Firebase en plan gratuito no tiene "deshacer": si alguien borra una escritura
// o una carpeta de evidencias, no hay de dónde recuperarla. Esto descarga en un
// archivo todo lo que está guardado, para poder reponerlo si hace falta.
//
// ⚠️ QUÉ CUBRE Y QUÉ NO
// El archivo lleva los REGISTROS (escrituras, evidencias, liquidaciones,
// usuarios, tarifas) y los ENLACES a los documentos, pero no los documentos en
// sí: un PDF escaneado puede pesar varios megas y no cabe en un respaldo de
// texto. Si alguien borra un archivo de Storage, el enlace del respaldo ya no
// servirá. Para eso está el "Volver a las del programa" de las tarifas y, sobre
// todo, no borrar a la ligera.
import { useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

const COLECCIONES = [
  { nombre: "escrituras", etiqueta: "Escrituras pendientes" },
  { nombre: "folders", etiqueta: "Carpetas de evidencias" },
  { nombre: "files", etiqueta: "Documentos de evidencias" },
  { nombre: "liquidaciones", etiqueta: "Historial de liquidaciones" },
  { nombre: "usuarios", etiqueta: "Usuarios y roles" },
  { nombre: "config", etiqueta: "Tasas y tarifas" },
];

const CAJA = {
  maxWidth: "760px",
  margin: "1.5rem auto",
  padding: "1.5rem",
  background: "#eff6ff",
  border: "1px solid #93c5fd",
  borderRadius: "14px",
};

export default function RespaldoPanel({ correoActual }) {
  const [trabajando, setTrabajando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");

  const descargar = async () => {
    setTrabajando(true);
    setError("");
    setResultado(null);
    try {
      const respaldo = {
        generadoEn: new Date().toISOString(),
        generadoPor: correoActual || "",
        version: 1,
        colecciones: {},
      };
      const conteo = [];

      for (const { nombre, etiqueta } of COLECCIONES) {
        const lista = await getDocs(collection(db, nombre));
        respaldo.colecciones[nombre] = lista.docs.map((d) => ({ id: d.id, ...d.data() }));
        conteo.push({ etiqueta, cuantos: lista.docs.length });
      }

      const texto = JSON.stringify(respaldo, null, 2);
      const blob = new Blob([texto], { type: "application/json" });
      const enlace = document.createElement("a");
      const fecha = new Date().toISOString().split("T")[0];
      enlace.download = `respaldo_notaria_${fecha}.json`;
      enlace.href = URL.createObjectURL(blob);
      enlace.click();
      URL.revokeObjectURL(enlace.href);

      setResultado({ conteo, peso: Math.round(blob.size / 1024) });
    } catch (fallo) {
      console.error(fallo);
      setError(fallo.message || "No se pudo generar el respaldo.");
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <div style={CAJA}>
      <h3 style={{ color: "#1e40af", marginTop: 0 }}>🗄️ Respaldo de los datos</h3>

      <p style={{ color: "#1e3a8a", fontSize: "0.9rem", lineHeight: 1.55 }}>
        Descarga en un solo archivo todo lo que hay guardado: escrituras,
        evidencias, historial de liquidaciones, usuarios y tarifas. Guárdalo en
        una USB o en un disco aparte. Si alguien borra algo por error, de ahí se
        puede reponer.
      </p>

      <button
        onClick={descargar}
        disabled={trabajando}
        style={{
          padding: "12px 26px",
          background: trabajando ? "#94a3b8" : "#1e40af",
          color: "white", border: "none", borderRadius: "8px",
          cursor: trabajando ? "wait" : "pointer",
          fontWeight: "bold", fontSize: "1rem",
        }}
      >
        {trabajando ? "Generando…" : "⬇️ Descargar respaldo"}
      </button>

      {error && (
        <p style={{ marginTop: "1rem", color: "#b91c1c", fontSize: "0.9rem" }}>⚠ {error}</p>
      )}

      {resultado && (
        <div style={{ marginTop: "1rem", padding: "0.9rem 1.1rem", background: "white", border: "1px solid #bfdbfe", borderRadius: "10px", fontSize: "0.9rem" }}>
          <strong style={{ color: "#166534" }}>✅ Respaldo descargado ({resultado.peso} KB)</strong>
          <ul style={{ marginTop: "0.6rem", paddingLeft: "1.2rem", color: "#334155" }}>
            {resultado.conteo.map(({ etiqueta, cuantos }) => (
              <li key={etiqueta}>
                {etiqueta}: <strong>{cuantos}</strong> {cuantos === 1 ? "registro" : "registros"}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ marginTop: "1.2rem", padding: "0.9rem 1.1rem", background: "#fffbeb", border: "1px solid #d97706", borderRadius: "10px", fontSize: "0.86rem", color: "#92400e", lineHeight: 1.55 }}>
        <strong>Qué NO incluye.</strong> El archivo guarda los registros y los
        enlaces a los documentos, pero no los documentos escaneados: un PDF pesa
        varios megas y no cabe en un respaldo de texto. Si alguien borra un
        archivo de Storage, el enlace del respaldo dejará de funcionar. El
        respaldo protege la información, no los escaneos.
        <br /><br />
        <strong>Los escaneos se respaldan aparte</strong>, desde el computador
        donde está el proyecto, con el comando{" "}
        <code style={{ background: "#fef3c7", padding: "1px 5px", borderRadius: "4px" }}>
          npm run respaldo:archivos
        </code>
        . Baja los PDF y las fotos a una carpeta o a una USB, y solo trae lo
        nuevo cada vez. Las instrucciones están en RESPALDO-ARCHIVOS.md.
      </div>

      <p style={{ marginTop: "1rem", fontSize: "0.84rem", color: "#475569", lineHeight: 1.55 }}>
        <strong>Cada cuánto:</strong> una vez al mes es razonable con el volumen
        de la notaría; y siempre antes de borrar algo en bloque. El archivo es
        pequeño, así que no cuesta nada guardar varios.
      </p>
    </div>
  );
}
