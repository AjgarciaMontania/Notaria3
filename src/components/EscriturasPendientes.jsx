// src/components/EscriturasPendientes.jsx
import { useState, useEffect } from "react";
import * as XLSX from 'xlsx';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

// Función auxiliar para convertir fecha de Excel a string "YYYY-MM-DD"
const excelDateToString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") {
    const date = XLSX.SSF.parse_date_code(value);
    if (!date) return "";
    const yyyy = date.y;
    const mm = String(date.m).padStart(2, "0");
    const dd = String(date.d).padStart(2, "0");
    return `${dd}-${mm}-${yyyy}`;
  }
  return "";
};

export default function EscriturasPendientes({ isAdmin }) {
  const [escrituras, setEscrituras] = useState([]);
  const [newEntry, setNewEntry] = useState({
    acto: "",
    numeroEscritura: "",
    fechaEscritura: "",
    matricula: "",
    notaDevolutiva: "NO",
    motivo: "",
  });
  const [editingItem, setEditingItem] = useState(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "escrituras"), (querySnapshot) => {
      let data = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      data.sort((a, b) => a.item - b.item);
      setEscrituras(data);
    });
    return () => unsubscribe();
  }, []);

  const addOrUpdateEntry = async () => {
    if (!newEntry.acto.trim() || !newEntry.numeroEscritura.trim()) {
      alert("Acto y Número de Escritura son obligatorios");
      return;
    }
    try {
      if (editingItem) {
        await updateDoc(doc(db, "escrituras", editingItem.id), newEntry);
        alert("Registro actualizado exitosamente");
      } else {
        const querySnapshot = await getDocs(collection(db, "escrituras"));
        const maxItem = querySnapshot.docs.length > 0
          ? Math.max(...querySnapshot.docs.map(d => d.data().item || 0))
          : 0;
        const newItem = { item: maxItem + 1, ...newEntry };
        await addDoc(collection(db, "escrituras"), newItem);
        alert("Registro agregado exitosamente");
      }
      setNewEntry({ acto: "", numeroEscritura: "", fechaEscritura: "", matricula: "", notaDevolutiva: "NO", motivo: "" });
      setEditingItem(null);
    } catch (error) {
      console.error("Error al guardar:", error);
      alert("Error al guardar el registro");
    }
  };

  const editEntry = (r) => {
    setNewEntry({
      acto: r.acto,
      numeroEscritura: r.numeroEscritura,
      fechaEscritura: r.fechaEscritura,
      matricula: r.matricula,
      notaDevolutiva: r.notaDevolutiva,
      motivo: r.motivo || "",
    });
    setEditingItem(r);
  };

  const deleteEntry = async (id) => {
    if (!window.confirm("¿Estás seguro de eliminar este registro?")) return;
    try {
      await deleteDoc(doc(db, "escrituras", id));
    } catch (error) {
      console.error("Error al eliminar:", error);
      alert("Error al eliminar el registro");
    }
  };

  const clearAll = async () => {
    if (!window.confirm("¿Estás seguro de borrar TODA la base de datos?")) return;
    try {
      const querySnapshot = await getDocs(collection(db, "escrituras"));
      await Promise.all(querySnapshot.docs.map((d) => deleteDoc(doc(db, "escrituras", d.id))));
    } catch (error) {
      console.error("Error al limpiar:", error);
      alert("Error al limpiar la base");
    }
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
    XLSX.writeFile(wb, `RELACION_ESCRITURAS_PENDIENTES_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleImportExcel = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const querySnapshot = await getDocs(collection(db, "escrituras"));
      const maxItem = querySnapshot.docs.length > 0
        ? Math.max(...querySnapshot.docs.map(d => d.data().item || 0))
        : 0;

      let contador = 1;
      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length < 2) continue;
        const newItem = {
          item: maxItem + contador,
          acto: row[1] ? String(row[1]) : "",
          numeroEscritura: row[2] ? String(row[2]) : "",
          fechaEscritura: excelDateToString(row[3]),
          matricula: row[4] ? String(row[4]) : "",
          notaDevolutiva: row[5] ? String(row[5]) : "NO",
          motivo: row[6] ? String(row[6]) : "",
        };
        await addDoc(collection(db, "escrituras"), newItem);
        contador++;
      }
      alert("Importación completada.");
      e.target.value = "";
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="input-card" style={{ maxWidth: "1200px", margin: "2rem auto", padding: "2.5rem", background: "white", borderRadius: "16px", boxShadow: "0 10px 30px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb" }}>
      <h2 style={{ textAlign: "center", color: "#166534", fontSize: "1.8rem", marginBottom: "2rem", textTransform: "uppercase" }}>
        Escrituras Pendientes Florencia
      </h2>

      {/* PANEL ADMIN (solo visible cuando isAdmin=true) */}
      {isAdmin && (
        <div style={{ marginBottom: "2.5rem" }}>
          <h3 style={{ color: "#166534", marginBottom: "1rem" }}>
            {editingItem ? "Editar Escritura" : "Agregar Nueva Escritura"}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            <input type="text" placeholder="Acto" value={newEntry.acto} onChange={(e) => setNewEntry({ ...newEntry, acto: e.target.value })} style={{ padding: "12px", fontSize: "1rem", border: "1px solid #ddd", borderRadius: "8px" }} />
            <input type="text" placeholder="N° Escritura" value={newEntry.numeroEscritura} onChange={(e) => setNewEntry({ ...newEntry, numeroEscritura: e.target.value })} style={{ padding: "12px", fontSize: "1rem", border: "1px solid #ddd", borderRadius: "8px" }} />
            <input type="date" value={newEntry.fechaEscritura} onChange={(e) => setNewEntry({ ...newEntry, fechaEscritura: e.target.value })} style={{ padding: "12px", fontSize: "1rem", border: "1px solid #ddd", borderRadius: "8px", width: "100%" }} />
            <input type="text" placeholder="Matrícula" value={newEntry.matricula} onChange={(e) => setNewEntry({ ...newEntry, matricula: e.target.value })} style={{ padding: "12px", fontSize: "1rem", border: "1px solid #ddd", borderRadius: "8px" }} />
            <select value={newEntry.notaDevolutiva} onChange={(e) => setNewEntry({ ...newEntry, notaDevolutiva: e.target.value })} style={{ padding: "12px", fontSize: "1rem", border: "1px solid #ddd", borderRadius: "8px" }}>
              <option value="NO">NO</option>
              <option value="SI">SI</option>
            </select>
            <input type="text" placeholder="Motivo (opcional)" value={newEntry.motivo} onChange={(e) => setNewEntry({ ...newEntry, motivo: e.target.value })} style={{ padding: "12px", fontSize: "1rem", border: "1px solid #ddd", borderRadius: "8px" }} />
          </div>

          <button onClick={addOrUpdateEntry} style={{ padding: "12px 24px", background: "#166534", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", marginRight: "1rem" }}>
            {editingItem ? "Guardar Cambios" : "Agregar"}
          </button>
          {editingItem && (
            <button onClick={() => { setEditingItem(null); setNewEntry({ acto: "", numeroEscritura: "", fechaEscritura: "", matricula: "", notaDevolutiva: "NO", motivo: "" }); }} style={{ padding: "12px 24px", background: "#6b7280", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>
              Cancelar Edición
            </button>
          )}

          <div style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "1rem" }}>
            <button onClick={exportToExcel} style={{ padding: "12px 24px", background: "#6b21a8", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>📥 Exportar Excel</button>
            <label style={{ display: "inline-block", padding: "12px 24px", background: "#d97706", color: "white", borderRadius: "8px", cursor: "pointer" }}>
              📤 Importar Excel
              <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} style={{ display: "none" }} />
            </label>
            <button onClick={clearAll} style={{ padding: "12px 24px", background: "#b91c1c", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>🗑️ Borrar toda la base</button>
          </div>
        </div>
      )}

      {/* TABLA DE REGISTROS */}
      <table style={{ width: "100%", borderCollapse: "collapse", background: "white", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
        <thead>
          <tr style={{ background: "#166534", color: "white", textTransform: "uppercase" }}>
            <th style={{ padding: "16px", textAlign: "left" }}>ITEM</th>
            <th style={{ padding: "16px", textAlign: "left" }}>ACTO</th>
            <th style={{ padding: "16px", textAlign: "left" }}>N° ESCRITURA</th>
            <th style={{ padding: "16px", textAlign: "left" }}>FECHA</th>
            <th style={{ padding: "16px", textAlign: "left" }}>MATRÍCULA</th>
            <th style={{ padding: "16px", textAlign: "left" }}>NOTA DEVOLUTIVA</th>
            <th style={{ padding: "16px", textAlign: "left" }}>MOTIVO</th>
            {isAdmin && <th style={{ padding: "16px", textAlign: "center" }}>ACCIONES</th>}
          </tr>
        </thead>
        <tbody>
          {escrituras.map((r) => (
            <tr key={r.id} style={{ borderBottom: "1px solid #e5e7eb" }}>
              <td style={{ padding: "16px" }}>{r.item}</td>
              <td style={{ padding: "16px" }}>{r.acto}</td>
              <td style={{ padding: "16px" }}>{r.numeroEscritura}</td>
              <td style={{ padding: "16px" }}>{r.fechaEscritura}</td>
              <td style={{ padding: "16px" }}>{r.matricula}</td>
              <td style={{ padding: "16px", color: r.notaDevolutiva === "SI" ? "#b91c1c" : "#166534", fontWeight: "bold" }}>{r.notaDevolutiva}</td>
              <td style={{ padding: "16px" }}>{r.motivo || ""}</td>
              {isAdmin && (
                <td style={{ padding: "16px", textAlign: "center" }}>
                  <button onClick={() => editEntry(r)} style={{ background: "#d97706", color: "white", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", marginRight: "0.5rem" }}>
                    ✏️ Editar
                  </button>
                  <button onClick={() => deleteEntry(r.id)} style={{ background: "#b91c1c", color: "white", border: "none", padding: "8px 16px", borderRadius: "6px", cursor: "pointer" }}>
                    🗑️ Eliminar
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {escrituras.length === 0 && (
        <p style={{ textAlign: "center", padding: "40px 20px", color: "#6b7280", fontSize: "1.2rem" }}>
          No hay registros aún.{isAdmin ? " Agrega manualmente o importa un Excel." : ""}
        </p>
      )}
    </div>
  );
}
