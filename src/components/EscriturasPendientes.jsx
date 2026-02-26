// src/components/EscriturasPendientes.jsx
import { useState, useEffect } from "react";
import * as XLSX from 'xlsx';

const ADMIN_PASSWORD = "notaria2026"; // ← CAMBIA ESTA CONTRASEÑA

export default function EscriturasPendientes() {
  const [escrituras, setEscrituras] = useState([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [newEntry, setNewEntry] = useState({
    acto: "",
    numeroEscritura: "",
    fechaEscritura: "",
    matricula: "",
    notaDevolutiva: "NO",
    motivo: "",
  });

  const STORAGE_KEY = "escriturasPendientesFlorencia";

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setEscrituras(JSON.parse(saved));
  }, []);

  const saveToStorage = (data) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  const addEntry = () => {
    if (!newEntry.acto.trim() || !newEntry.numeroEscritura.trim()) {
      alert("Acto y Número de Escritura son obligatorios");
      return;
    }

    const newItem = {
      item: escrituras.length + 1,
      ...newEntry,
    };

    const updated = [...escrituras, newItem];
    setEscrituras(updated);
    saveToStorage(updated);

    setNewEntry({
      acto: "", numeroEscritura: "", fechaEscritura: "",
      matricula: "", notaDevolutiva: "NO", motivo: ""
    });
  };

  const deleteEntry = (index) => {
    if (!isAdmin) return;
    const updated = escrituras.filter((_, i) => i !== index);
    setEscrituras(updated);
    saveToStorage(updated);
  };

  const clearAll = () => {
    if (!isAdmin || !window.confirm("¿Estás seguro de borrar TODA la base de datos?")) return;
    setEscrituras([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  const exportToExcel = () => {
    const data = escrituras.map(r => ({
      ITEM: r.item,
      ACTO: r.acto,
      "NUMERO ESCRITURA": r.numeroEscritura,
      "FECHA ESCRITURA": r.fechaEscritura,
      MATRICULA: r.matricula,
      "NOTA DEVOLUTIVA": r.notaDevolutiva,
      MOTIVO: r.motivo || "",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Escrituras Pendientes");
    XLSX.writeFile(wb, `RELACION_ESCRITURAS_PENDIENTES_${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target.result);
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

      const imported = [];
      for (let i = 1; i < json.length; i++) {
        const row = json[i];
        if (!row || row.length < 2) continue;

        imported.push({
          item: imported.length + 1,
          acto: (row[1] || "").toString().trim(),
          numeroEscritura: (row[2] || "").toString().trim(),
          fechaEscritura: row[3] ? (row[3] instanceof Date ? row[3].toISOString().split("T")[0] : row[3].toString()) : "",
          matricula: (row[4] || "").toString().trim(),
          notaDevolutiva: (row[5] || "").toString().toUpperCase().includes("SI") ? "SI" : "NO",
          motivo: (row[6] || "").toString().trim(),
        });
      }

      setEscrituras(imported);
      saveToStorage(imported);
      alert(`✅ Importados ${imported.length} registros correctamente`);
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="input-card" style={{ maxWidth: "1300px", margin: "20px auto" }}>
      <h2 style={{ textAlign: "center", color: "#166534", marginBottom: "20px" }}>
        📋 RELACIÓN DE ESCRITURAS PENDIENTES - FLORENCIA
      </h2>

      {/* FORMULARIO NUEVA ESCRITURA */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "15px", marginBottom: "25px" }}>
        <div><label>Acto *</label><input type="text" value={newEntry.acto} onChange={e => setNewEntry({ ...newEntry, acto: e.target.value })} /></div>
        <div><label>N° Escritura *</label><input type="text" value={newEntry.numeroEscritura} onChange={e => setNewEntry({ ...newEntry, numeroEscritura: e.target.value })} /></div>
        <div><label>Fecha Escritura</label><input type="date" value={newEntry.fechaEscritura} onChange={e => setNewEntry({ ...newEntry, fechaEscritura: e.target.value })} /></div>
        <div><label>Matrícula Inmobiliaria</label><input type="text" value={newEntry.matricula} onChange={e => setNewEntry({ ...newEntry, matricula: e.target.value })} /></div>
        <div><label>Nota Devolutiva</label>
          <select value={newEntry.notaDevolutiva} onChange={e => setNewEntry({ ...newEntry, notaDevolutiva: e.target.value })}>
            <option value="NO">NO</option>
            <option value="SI">SI</option>
          </select>
        </div>
        <div><label>Motivo / Observación</label><textarea rows="2" value={newEntry.motivo} onChange={e => setNewEntry({ ...newEntry, motivo: e.target.value })} /></div>
      </div>

      <button onClick={addEntry} className="ingresar" style={{ marginBottom: "30px" }}>
        ➕ Añadir Escritura
      </button>

      {/* CONTROLES ADMIN */}
      <div style={{ textAlign: "center", marginBottom: "30px" }}>
        {!isAdmin ? (
          <div>
            <input
              type="password"
              placeholder="Contraseña de Administrador"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={{ padding: "12px", width: "220px", marginRight: "10px", fontSize: "1rem" }}
            />
            <button onClick={() => password === ADMIN_PASSWORD ? setIsAdmin(true) : alert("❌ Contraseña incorrecta")}>
              Entrar como Admin
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <button onClick={exportToExcel} className="exportar">💾 Guardar / Exportar Excel</button>
            <label className="exportar" style={{ cursor: "pointer", padding: "12px 24px" }}>
              📥 Importar Excel
              <input type="file" accept=".xlsx,.xls" onChange={handleImportExcel} style={{ display: "none" }} />
            </label>
            <button onClick={clearAll} style={{ background: "#b91c1c", color: "white" }}>🗑️ Borrar toda la base</button>
            <button onClick={() => { setIsAdmin(false); setPassword(""); }}>Cerrar sesión Admin</button>
          </div>
        )}
      </div>

      {/* TABLA DE REGISTROS */}
      <table style={{ width: "100%", borderCollapse: "collapse", background: "white" }}>
        <thead>
          <tr style={{ background: "#166534", color: "white" }}>
            <th style={{ padding: "12px" }}>ITEM</th>
            <th style={{ padding: "12px" }}>ACTO</th>
            <th style={{ padding: "12px" }}>N° ESCRITURA</th>
            <th style={{ padding: "12px" }}>FECHA</th>
            <th style={{ padding: "12px" }}>MATRÍCULA</th>
            <th style={{ padding: "12px" }}>NOTA DEVOLUTIVA</th>
            <th style={{ padding: "12px" }}>MOTIVO</th>
            {isAdmin && <th style={{ padding: "12px" }}>Acción</th>}
          </tr>
        </thead>
        <tbody>
          {escrituras.map((r, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #ddd" }}>
              <td style={{ padding: "12px", textAlign: "center" }}>{r.item}</td>
              <td style={{ padding: "12px" }}>{r.acto}</td>
              <td style={{ padding: "12px", textAlign: "center" }}>{r.numeroEscritura}</td>
              <td style={{ padding: "12px", textAlign: "center" }}>{r.fechaEscritura}</td>
              <td style={{ padding: "12px", textAlign: "center" }}>{r.matricula}</td>
              <td style={{ padding: "12px", textAlign: "center", color: r.notaDevolutiva === "SI" ? "red" : "green", fontWeight: "bold" }}>
                {r.notaDevolutiva}
              </td>
              <td style={{ padding: "12px" }}>{r.motivo}</td>
              {isAdmin && (
                <td style={{ padding: "12px", textAlign: "center" }}>
                  <button onClick={() => deleteEntry(i)} style={{ background: "#b91c1c", color: "white", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>
                    Eliminar
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {escrituras.length === 0 && (
        <p style={{ textAlign: "center", padding: "60px 20px", color: "#666", fontSize: "1.1rem" }}>
          Aún no hay registros.<br />Sube tu Excel o agrega manualmente.
        </p>
      )}
    </div>
  );
}