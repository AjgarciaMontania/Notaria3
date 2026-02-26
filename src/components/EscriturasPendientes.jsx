// src/components/EscriturasPendientes.jsx
import { useState, useEffect } from "react";
import * as XLSX from 'xlsx';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";  // Asegúrate de que este archivo exista

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
  const [editingItem, setEditingItem] = useState(null); // Para modo edición

  useEffect(() => {
    // Escucha cambios en tiempo real en la colección 'escrituras'
    const unsubscribe = onSnapshot(collection(db, "escrituras"), (querySnapshot) => {
      let data = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      // Ordena por item ascendente
      data.sort((a, b) => a.item - b.item);
      setEscrituras(data);
    });

    // Limpia la suscripción al desmontar el componente
    return () => unsubscribe();
  }, []);

  const addOrUpdateEntry = async () => {
    if (!newEntry.acto.trim() || !newEntry.numeroEscritura.trim()) {
      alert("Acto y Número de Escritura son obligatorios");
      return;
    }

    try {
      if (editingItem) {
        // Modo edición: actualiza el documento existente
        await updateDoc(doc(db, "escrituras", editingItem.id), newEntry);
        alert("Registro actualizado exitosamente");
      } else {
        // Modo agregar: calcula el próximo item
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
      // No necesitas refrescar manualmente; onSnapshot lo hace automáticamente
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
      // No necesitas refrescar; onSnapshot lo hace
    } catch (error) {
      console.error("Error al eliminar:", error);
      alert("Error al eliminar el registro");
    }
  };

  const clearAll = async () => {
    if (!window.confirm("¿Estás seguro de borrar TODA la base de datos?")) return;
    try {
      const querySnapshot = await getDocs(collection(db, "escrituras"));
      querySnapshot.forEach(async (d) => {
        await deleteDoc(doc(db, "escrituras", d.id));
      });
      // onSnapshot actualizará la lista a vacío automáticamente
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
    XLSX.writeFile(wb, `RELACION_ESCRITURAS_PENDIENTES_${new Date().toISOString().slice(0,10)}.xlsx`);
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

    // ✅ Obtener el máximo item actual ANTES de importar
    const querySnapshot = await getDocs(collection(db, "escrituras"));
    const maxItem = querySnapshot.docs.length > 0
      ? Math.max(...querySnapshot.docs.map(d => d.data().item || 0))
      : 0;

    let contador = 1;
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      // ✅ Permite filas con al menos 3 columnas (acto + escritura mínimo)
      if (!row || row.length < 2) continue;

      const newItem = {
        item: maxItem + contador, // ✅ Item correcto y secuencial
        acto: row[1] ? String(row[1]) : "",
        numeroEscritura: row[2] ? String(row[2]) : "",
        fechaEscritura: row[3] ? String(row[3]) : "",
        matricula: row[4] ? String(row[4]) : "",
        notaDevolutiva: row[5] ? String(row[5]) : "NO",
        motivo: row[6] ? String(row[6]) : "",
      };

      await addDoc(collection(db, "escrituras"), newItem);
      contador++;
    }
    alert("Importación completada.");
    e.target.value = ""; // ✅ Limpia el input para permitir reimportar el mismo archivo
  };
  reader.readAsBinaryString(file);
};

  return (
    <div className="input-card" style={{ maxWidth: "1200px", margin: "2rem auto", padding: "2.5rem", background: "white", borderRadius: "16px", boxShadow: "0 10px 30px rgba(0,0,0,0.08)", border: "1px solid #e5e7eb" }}>
      <h2 style={{ textAlign: "center", color: "#166534", fontSize: "1.8rem", marginBottom: "2rem", textTransform: "uppercase" }}>Escrituras Pendientes Florencia</h2>

      {/* ADMIN LOGIN */}
      {!isAdmin ? (
        <div style={{ maxWidth: "400px", margin: "0 auto 2rem", padding: "1.5rem", background: "#f3f4f6", borderRadius: "12px" }}>
          <label style={{ display: "block", fontWeight: "bold", marginBottom: "0.5rem" }}>Contraseña Admin:</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            style={{ width: "100%", padding: "12px", fontSize: "1rem", border: "1px solid #ddd", borderRadius: "8px", marginBottom: "1rem" }} 
          />
          <button 
            onClick={() => { if (password === ADMIN_PASSWORD) setIsAdmin(true); else alert("Contraseña incorrecta"); }} 
            style={{ width: "100%", padding: "12px", background: "#166534", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}
          >
            Ingresar como Admin
          </button>
        </div>
      ) : (
        <div style={{ marginBottom: "2.5rem" }}>
          {/* FORMULARIO AGREGAR/EDITAR */}
          <h3 style={{ color: "#166534", marginBottom: "1rem" }}>{editingItem ? "Editar Escritura" : "Agregar Nueva Escritura"}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
            <input type="text" placeholder="Acto" value={newEntry.acto} onChange={(e) => setNewEntry({...newEntry, acto: e.target.value})} style={{ padding: "12px", fontSize: "1rem", border: "1px solid #ddd", borderRadius: "8px" }} />
            <input type="text" placeholder="N° Escritura" value={newEntry.numeroEscritura} onChange={(e) => setNewEntry({...newEntry, numeroEscritura: e.target.value})} style={{ padding: "12px", fontSize: "1rem", border: "1px solid #ddd", borderRadius: "8px" }} />
            <input type="date" value={newEntry.fechaEscritura} onChange={(e) => setNewEntry({...newEntry, fechaEscritura: e.target.value})} style={{ padding: "12px", fontSize: "1rem", border: "1px solid #ddd", borderRadius: "8px", width: "100%" }} /> {/* Campo fecha más ancho */}
            <input type="text" placeholder="Matrícula" value={newEntry.matricula} onChange={(e) => setNewEntry({...newEntry, matricula: e.target.value})} style={{ padding: "12px", fontSize: "1rem", border: "1px solid #ddd", borderRadius: "8px" }} />
            <select value={newEntry.notaDevolutiva} onChange={(e) => setNewEntry({...newEntry, notaDevolutiva: e.target.value})} style={{ padding: "12px", fontSize: "1rem", border: "1px solid #ddd", borderRadius: "8px" }}>
              <option value="NO">NO</option>
              <option value="SI">SI</option>
            </select>
            <input type="text" placeholder="Motivo (opcional)" value={newEntry.motivo} onChange={(e) => setNewEntry({...newEntry, motivo: e.target.value})} style={{ padding: "12px", fontSize: "1rem", border: "1px solid #ddd", borderRadius: "8px" }} />
          </div>
          <button onClick={addOrUpdateEntry} style={{ padding: "12px 24px", background: "#166534", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", marginRight: "1rem" }}>
            {editingItem ? "Guardar Cambios" : "Agregar"}
          </button>
          {editingItem && (
            <button onClick={() => { setEditingItem(null); setNewEntry({ acto: "", numeroEscritura: "", fechaEscritura: "", matricula: "", notaDevolutiva: "NO", motivo: "" }); }} style={{ padding: "12px 24px", background: "#6b7280", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>
              Cancelar Edición
            </button>
          )}

          {/* BOTONES ADMIN */}
          <button onClick={exportToExcel} style={{ padding: "12px 24px", background: "#6b21a8", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", margin: "1rem 1rem 0 0" }}>📥 Exportar Excel</button>
          <label style={{ display: "inline-block", padding: "12px 24px", background: "#d97706", color: "white", borderRadius: "8px", cursor: "pointer", margin: "1rem 1rem 0 0" }}>
            📤 Importar Excel
            <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} style={{ display: "none" }} />
          </label>
          <button onClick={clearAll} style={{ padding: "12px 24px", background: "#b91c1c", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", margin: "1rem 1rem 0 0" }}>🗑️ Borrar toda la base</button>
          <button onClick={() => { setIsAdmin(false); setPassword(""); }} style={{ padding: "12px 24px", background: "#6b7280", color: "white", border: "none", borderRadius: "8px", cursor: "pointer", margin: "1rem 0 0 0" }}>Cerrar sesión Admin</button>
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
          No hay registros aún. Agrega manualmente o importa un Excel.
        </p>
      )}
    </div>
  );
}