// src/components/EscriturasPendientes.jsx
import { useState, useEffect } from "react";
import * as XLSX from 'xlsx';
import { collection, addDoc, getDocs, updateDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import {
  subirSoporteYMarcarEnviadas,
  revertirEnvio,
  formatoFechaEnvio,
  subirReciboRegistro,
  quitarReciboRegistro,
  actualizarFechaRegistro,
  borrarArchivos,
  diasHabilesDesde,
  DIAS_HABILES_REGISTRO,
  estadoEscritura,
  aFechaLocal,
  hoyLocal,
} from "../utils/soportesEscrituras";
import { archivosHuerfanos } from "../utils/limpiezaArchivos";

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

  // ── Envío a la notaría ────────────────────────────────────────────────────
  // Un mismo soporte puede amparar varias escrituras, así que primero se
  // seleccionan las filas y después se adjunta un único archivo para todas.
  const [seleccion, setSeleccion] = useState([]);   // ids de escrituras marcadas
  const [subiendo, setSubiendo] = useState(false);
  const [filtro, setFiltro] = useState("todas");
  const [orden, setOrden] = useState("asc");   // "asc" = la más antigua primero
  const [reciboPara, setReciboPara] = useState(null);   // { id, fecha } fila que está adjuntando
  const [editandoFecha, setEditandoFecha] = useState(null); // { id, fecha } fila corrigiendo la fecha
  const [aviso, setAviso] = useState(null);

  const mostrarAviso = (tipo, texto, ms = 5000) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), ms);
  };

  const alternarSeleccion = (id) => {
    setSeleccion((previos) =>
      previos.includes(id) ? previos.filter((x) => x !== id) : [...previos, id]
    );
  };

  // ── Filtros por estado ────────────────────────────────────────────────────
  // Los mismos cuatro del celular, para que quien use las dos no tenga que
  // aprender dos formas distintas de mirar la misma lista.
  const FILTROS = [
    { id: "todas", texto: "Todas", estado: null },
    { id: "pendientes", texto: "Pendientes", estado: "pendiente" },
    { id: "registro", texto: "En registro", estado: "en-registro" },
    { id: "enviadas", texto: "Enviadas", estado: "enviada" },
  ];

  // Solo "En registro" y "Enviadas" se pueden ordenar por fecha: son los dos
  // estados que tienen una. "Todas" y "Pendientes" conservan el orden de
  // captura de siempre.
  const CAMPO_FECHA = { registro: "fechaRegistro", enviadas: "fechaEnvio" };
  const campoOrden = CAMPO_FECHA[filtro] || null;

  const filtradas = filtro === "todas"
    ? escrituras
    : escrituras.filter((e) => estadoEscritura(e) === FILTROS.find((f) => f.id === filtro)?.estado);

  // De la más antigua a la más reciente: en registro, la primera de la lista es
  // la que lleva más tiempo esperando en la ORIP, o sea la próxima en salir.
  //
  // Se ordena sobre una COPIA. sort() reordena el arreglo original, y el
  // original aquí es el estado de React: revolverlo haría que la tabla y los
  // datos dejaran de coincidir.
  const visibles = campoOrden
    ? [...filtradas].sort((a, b) => {
        const ta = Date.parse(a[campoOrden]);
        const tb = Date.parse(b[campoOrden]);
        // Una fila sin fecha no se puede comparar: se manda al final, mire
        // como mire el orden, para que no se cuele de primera.
        if (Number.isNaN(ta) && Number.isNaN(tb)) return 0;
        if (Number.isNaN(ta)) return 1;
        if (Number.isNaN(tb)) return -1;
        return orden === "asc" ? ta - tb : tb - ta;
      })
    : filtradas;

  // Los conteos se sacan SIEMPRE de la lista completa: son para decidir a
  // dónde ir, así que tienen que verse aunque estés parado en otro filtro.
  const conteos = escrituras.reduce(
    (cuenta, e) => {
      cuenta[estadoEscritura(e)]++;
      cuenta.todas++;
      return cuenta;
    },
    { todas: 0, pendiente: 0, "en-registro": 0, enviada: 0 }
  );
  const cuantas = (f) => (f.estado ? conteos[f.estado] : conteos.todas);

  // "Marcar todas" trabaja sobre lo que se está viendo. Si marcara también las
  // filas escondidas por el filtro, se enviarían escrituras que no estás
  // mirando.
  const pendientes = visibles.filter((e) => !e.enviado);
  const todasPendientesMarcadas =
    pendientes.length > 0 && pendientes.every((e) => seleccion.includes(e.id));

  const alternarTodas = () => {
    setSeleccion(todasPendientesMarcadas ? [] : pendientes.map((e) => e.id));
  };

  const adjuntarSoporte = async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;

    const elegidas = escrituras.filter((x) => seleccion.includes(x.id));
    if (elegidas.length === 0) return;

    setSubiendo(true);
    try {
      const { cantidad } = await subirSoporteYMarcarEnviadas(archivo, elegidas);
      setSeleccion([]);
      mostrarAviso(
        "ok",
        `${cantidad} ${cantidad === 1 ? "escritura marcada como enviada" : "escrituras marcadas como enviadas"} con el soporte "${archivo.name}"`
      );
    } catch (error) {
      console.error(error);
      mostrarAviso("error", `No se pudo adjuntar el soporte: ${error.message}`, 9000);
    } finally {
      setSubiendo(false);
    }
  };

  // ── Pagada y en registro ──────────────────────────────────────────────────
  // Etapa anterior al envío: se pagaron los impuestos y la escritura quedó
  // radicada en la ORIP. A diferencia del soporte de envío, el recibo es de
  // UNA sola escritura, así que se adjunta fila por fila.
  const [subiendoRecibo, setSubiendoRecibo] = useState(null); // id de la fila

  // La fecha que se guarda es la del PAGO, no la del día en que se sube el
  // recibo. Los impuestos suelen pagarse días antes de que alguien se siente a
  // adjuntar los soportes, y de esa fecha arranca el contador de los 15 días
  // hábiles de la ORIP. Si se pusiera la de hoy, una escritura que ya lleva una
  // semana esperando aparecería como recién radicada.
  const adjuntarRecibo = (registro) => async (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;

    const fecha = reciboPara?.id === registro.id ? reciboPara.fecha : hoyLocal();
    setSubiendoRecibo(registro.id);
    try {
      await subirReciboRegistro(archivo, registro, fecha);
      setReciboPara(null);
      mostrarAviso("ok", `Escritura ${registro.numeroEscritura} marcada como pagada el ${formatoFechaEnvio(fecha + "T12:00:00")}.`);
    } catch (error) {
      console.error(error);
      mostrarAviso("error", `No se pudo adjuntar el recibo: ${error.message}`, 9000);
    } finally {
      setSubiendoRecibo(null);
    }
  };

  /** Corrige la fecha de pago de una escritura que ya está en registro. */
  const guardarFechaRegistro = async (registro, fecha) => {
    setEditandoFecha(null);
    if (!fecha || fecha === aFechaLocal(registro.fechaRegistro)) return;
    try {
      await actualizarFechaRegistro(registro, fecha);
      mostrarAviso("ok", `Fecha de pago de la escritura ${registro.numeroEscritura} corregida.`);
    } catch (error) {
      mostrarAviso("error", `No se pudo cambiar la fecha: ${error.message}`, 9000);
    }
  };

  const devolverDeRegistro = async (registro) => {
    const texto =
      `¿Quitar el estado "en registro" de la escritura ${registro.numeroEscritura}?\n\n` +
      `Se eliminará el recibo "${registro.reciboNombre || ""}" y la fila volverá a pendiente.`;
    if (!window.confirm(texto)) return;
    try {
      await quitarReciboRegistro(registro);
      mostrarAviso("ok", "Escritura devuelta a pendiente.");
    } catch (error) {
      mostrarAviso("error", `No se pudo quitar: ${error.message}`, 9000);
    }
  };

  const devolverAPendiente = async (registro) => {
    const texto =
      `¿Devolver la escritura ${registro.numeroEscritura} al estado pendiente?\n\n` +
      `Se quitará el soporte "${registro.soporteNombre || ""}". Si ninguna otra ` +
      `escritura lo está usando, el archivo también se eliminará.`;
    if (!window.confirm(texto)) return;
    try {
      const { archivoBorrado } = await revertirEnvio(registro, escrituras);
      mostrarAviso(
        "ok",
        archivoBorrado
          ? "Escritura devuelta a pendiente y soporte eliminado."
          : "Escritura devuelta a pendiente. El soporte sigue disponible para las demás."
      );
    } catch (error) {
      mostrarAviso("error", `No se pudo revertir: ${error.message}`, 9000);
    }
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "escrituras"), (querySnapshot) => {
      let data = [];
      querySnapshot.forEach((doc) => {
        data.push({ id: doc.id, ...doc.data() });
      });
      // ── SOBRE EL CAMPO "item" ────────────────────────────────────────────
      // Ya NO es el número que se ve en la columna ITEM. Es solo la llave con
      // la que se ordena la lista: va creciendo y nunca se reescribe.
      //
      // El número que se muestra es la POSICIÓN en la tabla, así que al borrar
      // una escritura las de abajo se corren solas y la cuenta siempre va
      // 1, 2, 3… sin huecos. Antes se mostraba "item" tal cual y al borrar la
      // tercera quedaba 1, 2, 4.
      //
      // El "|| 0" es por si alguna ficha vieja no trae el campo: sin él la
      // resta daría NaN y el orden de la tabla saldría revuelto.
      data.sort((a, b) => (a.item || 0) - (b.item || 0));
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

  // Al borrar una escritura hay que llevarse también sus archivos de Storage.
  // Firestore y Storage son dos sitios distintos: borrar el registro no borra
  // el recibo ni el soporte, y quedaban ahí para siempre —ocupando espacio y
  // abriéndose con su enlace de descarga—. Qué se lleva y qué no lo decide
  // utils/limpiezaArchivos.js, que comparten la web y la APK.
  const deleteEntry = async (id) => {
    const registro = escrituras.find((e) => e.id === id);
    if (!window.confirm("¿Estás seguro de eliminar este registro?")) return;
    try {
      const rutas = archivosHuerfanos(registro ? [registro] : [], escrituras);
      await deleteDoc(doc(db, "escrituras", id));
      const { fallidos } = await borrarArchivos(rutas);
      if (fallidos.length > 0) {
        console.warn("Archivos que no se pudieron borrar:", fallidos);
        alert(
          "El registro se eliminó, pero " + fallidos.length +
          " archivo(s) quedaron en el servidor. Avísale al administrador."
        );
      }
    } catch (error) {
      console.error("Error al eliminar:", error);
      alert("Error al eliminar el registro");
    }
  };

  const clearAll = async () => {
    if (!window.confirm("¿Estás seguro de borrar TODA la base de datos?")) return;
    try {
      const querySnapshot = await getDocs(collection(db, "escrituras"));
      const todas = querySnapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      const rutas = archivosHuerfanos(todas, todas);
      await Promise.all(todas.map((e) => deleteDoc(doc(db, "escrituras", e.id))));
      const { fallidos } = await borrarArchivos(rutas);
      if (fallidos.length > 0) {
        console.warn("Archivos que no se pudieron borrar:", fallidos);
        alert(
          "La base se limpió, pero " + fallidos.length +
          " archivo(s) quedaron en el servidor. Avísale al administrador."
        );
      }
    } catch (error) {
      console.error("Error al limpiar:", error);
      alert("Error al limpiar la base");
    }
  };

  /**
   * Encabezado que se puede pulsar para dar vuelta al orden por fecha.
   *
   * Es una función corriente que devuelve JSX, no un componente: declarar un
   * componente dentro de otro lo vuelve a crear en cada dibujado y React le
   * borra el estado cada vez.
   */
  const encabezadoOrdenable = (texto, activo) =>
    activo ? (
      <button
        onClick={() => setOrden((previo) => (previo === "asc" ? "desc" : "asc"))}
        title={
          orden === "asc"
            ? "Ahora: la más antigua primero. Pulsa para invertir."
            : "Ahora: la más reciente primero. Pulsa para invertir."
        }
        style={{
          background: "none", border: "none", color: "white", cursor: "pointer",
          font: "inherit", textTransform: "uppercase", padding: 0,
          display: "inline-flex", alignItems: "center", gap: "4px",
        }}
      >
        {texto}
        <span style={{ fontSize: "0.95rem", lineHeight: 1 }}>{orden === "asc" ? "↑" : "↓"}</span>
      </button>
    ) : (
      texto
    );

  const exportToExcel = () => {
    // Se exporta LO QUE SE ESTÁ VIENDO, con el filtro puesto: así se puede
    // mandar a Florencia justo el grupo que interesa sin borrar filas a mano.
    // El ITEM del Excel es la misma posición que se ve en pantalla.
    const data = visibles.map((r, posicion) => ({
      ITEM: posicion + 1,
      ACTO: r.acto,
      "NUMERO ESCRITURA": r.numeroEscritura,
      "FECHA ESCRITURA": r.fechaEscritura,
      MATRICULA: r.matricula,
      "NOTA DEVOLUTIVA": r.notaDevolutiva,
      MOTIVO: r.motivo || "",
      "EN REGISTRO": r.enRegistro ? "SÍ" : "NO",
      "FECHA DE PAGO": formatoFechaEnvio(r.fechaRegistro),
      "DÍAS EN REGISTRO": r.enRegistro ? diasHabilesDesde(r.fechaRegistro) : "",
      RECIBO: r.reciboNombre || "",
      "ENLACE DEL RECIBO": r.reciboURL || "",
      ENVIADO: r.enviado ? "SÍ" : "NO",
      "FECHA DE ENVÍO": formatoFechaEnvio(r.fechaEnvio),
      "ENVIADO POR": r.enviadoPor || "",
      SOPORTE: r.soporteNombre || "",
      "ENLACE DEL SOPORTE": r.soporteURL || "",
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Escrituras Pendientes");
    // El filtro va en el nombre del archivo para no confundir dos descargas
    // del mismo día con contenidos distintos.
    const marca = filtro === "todas" ? "" : `_${FILTROS.find((f) => f.id === filtro)?.texto.toUpperCase().replace(/ /g, "_")}`;
    XLSX.writeFile(wb, `RELACION_ESCRITURAS_PENDIENTES${marca}_${hoyLocal()}.xlsx`);
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
    <div className="input-card" style={{ maxWidth: "1380px" }}>
      <h2 style={{ textAlign: "center", color: "#166534", fontSize: "1.8rem", marginBottom: "2rem", textTransform: "uppercase" }}>
        Escrituras Pendientes Florencia
      </h2>

      {/* PANEL ADMIN (solo visible cuando isAdmin=true) */}
      {isAdmin && (
        <div style={{ marginBottom: "2.5rem" }}>
          <h3 style={{ color: "#166534", marginBottom: "1rem" }}>
            {editingItem ? "Editar Escritura" : "Agregar Nueva Escritura"}
          </h3>
          <div className="form-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1rem", marginBottom: "1.5rem" }}>
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

          <div className="action-buttons" style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
            <button onClick={addOrUpdateEntry} style={{ padding: "12px 24px", background: "#166534", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>
              {editingItem ? "Guardar Cambios" : "Agregar"}
            </button>
            {editingItem && (
              <button onClick={() => { setEditingItem(null); setNewEntry({ acto: "", numeroEscritura: "", fechaEscritura: "", matricula: "", notaDevolutiva: "NO", motivo: "" }); }} style={{ padding: "12px 24px", background: "#6b7280", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>
                Cancelar Edición
              </button>
            )}
          </div>

          <div className="action-buttons" style={{ marginTop: "1rem", display: "flex", flexWrap: "wrap", gap: "1rem" }}>
            <button onClick={exportToExcel} style={{ padding: "12px 24px", background: "#6b21a8", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>📥 Exportar Excel</button>
            <label style={{ display: "inline-block", padding: "12px 24px", background: "#d97706", color: "white", borderRadius: "8px", cursor: "pointer" }}>
              📤 Importar Excel
              <input type="file" accept=".xlsx, .xls" onChange={handleImportExcel} style={{ display: "none" }} />
            </label>
            <button onClick={clearAll} style={{ padding: "12px 24px", background: "#b91c1c", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}>🗑️ Borrar toda la base</button>
          </div>
        </div>
      )}

      {aviso && (
        <div
          style={{
            padding: "12px 16px", borderRadius: "10px", marginBottom: "1rem",
            fontWeight: 600, fontSize: "0.95rem",
            background: aviso.tipo === "ok" ? "#dcfce7" : "#fee2e2",
            color: aviso.tipo === "ok" ? "#166534" : "#b91c1c",
          }}
        >
          {aviso.tipo === "ok" ? "✅ " : "⚠️ "}{aviso.texto}
        </div>
      )}

      {/* BARRA DE ENVÍO — aparece al marcar escrituras */}
      {seleccion.length > 0 && (
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexWrap: "wrap", gap: "1rem", padding: "1rem 1.2rem", marginBottom: "1rem",
            background: "#f0fdf4", border: "2px solid #86efac", borderRadius: "12px",
          }}
        >
          <span style={{ fontWeight: "bold", color: "#166534" }}>
            {seleccion.length}{" "}
            {seleccion.length === 1 ? "escritura seleccionada" : "escrituras seleccionadas"}
          </span>

          <div className="action-buttons" style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
            <label
              style={{
                padding: "12px 24px", borderRadius: "8px", cursor: subiendo ? "wait" : "pointer",
                background: subiendo ? "#9ca3af" : "#166534", color: "white", fontWeight: 600,
              }}
            >
              {subiendo ? "Subiendo soporte…" : "📎 Adjuntar soporte y marcar como enviadas"}
              <input
                type="file"
                accept="application/pdf,.pdf,image/*"
                onChange={adjuntarSoporte}
                disabled={subiendo}
                style={{ display: "none" }}
              />
            </label>
            <button
              onClick={() => setSeleccion([])}
              disabled={subiendo}
              style={{ padding: "12px 24px", background: "#6b7280", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* FILTROS POR ESTADO */}
      {escrituras.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", margin: "1.2rem 0 0.6rem" }}>
          {FILTROS.map((f) => {
            const activo = filtro === f.id;
            const total = cuantas(f);
            return (
              <button
                key={f.id}
                onClick={() => { setFiltro(f.id); setOrden("asc"); setSeleccion([]); }}
                title={`Ver solo las escrituras en estado "${f.texto}"`}
                style={{
                  display: "inline-flex", alignItems: "center", gap: "7px",
                  padding: "7px 14px", borderRadius: "999px", cursor: "pointer",
                  fontSize: "0.86rem", fontWeight: activo ? 700 : 500,
                  fontFamily: "inherit",
                  background: activo ? "#166534" : "white",
                  color: activo ? "white" : "#334155",
                  border: `1px solid ${activo ? "#166534" : "#cbd5e1"}`,
                }}
              >
                {f.texto}
                <span style={{
                  padding: "1px 8px", borderRadius: "999px", fontSize: "0.8rem", fontWeight: 700,
                  background: activo ? "rgba(255,255,255,0.22)" : "#f1f5f9",
                  color: activo ? "white" : "#475569",
                }}>
                  {total}
                </span>
              </button>
            );
          })}
          {filtro !== "todas" && (
            <span style={{ fontSize: "0.83rem", color: "#64748b" }}>
              Mostrando {visibles.length} de {escrituras.length}. El Excel exporta solo estas.
              {campoOrden && (
                orden === "asc"
                  ? " Ordenadas de la más antigua a la más reciente."
                  : " Ordenadas de la más reciente a la más antigua."
              )}
            </span>
          )}
        </div>
      )}

      {/* TABLA DE REGISTROS */}
      {escrituras.length > 0 && (
        <p className="scroll-hint compacta">← Desliza la tabla hacia los lados para ver todas las columnas →</p>
      )}
      {escrituras.length > 0 && visibles.length === 0 && (
        <p style={{ padding: "1.2rem", background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: "10px", color: "#64748b", textAlign: "center" }}>
          No hay escrituras en «{FILTROS.find((f) => f.id === filtro)?.texto}».
        </p>
      )}

      <div className="table-scroll compacta">
      {/* Anchos mínimos en píxeles definidos en index.css (.tabla-escrituras) */}
      <table className="tabla-compacta tabla-escrituras" style={{ width: "100%", borderCollapse: "collapse", background: "white", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
        <thead>
          <tr style={{ background: "#166534", color: "white", textTransform: "uppercase" }}>
            {/* Sin partir la palabra: la columna es estrecha y "ITEM" quedaba cortado en dos renglones. */}
            <th style={{ padding: "12px 10px", textAlign: "left", whiteSpace: "nowrap", fontSize: "0.85rem" }}>ITEM</th>
            <th className="celda-texto" style={{ padding: "12px 10px", textAlign: "left", whiteSpace: "normal", wordBreak: "break-word", fontSize: "0.85rem" }}>ACTO</th>
            <th style={{ padding: "12px 10px", textAlign: "left", whiteSpace: "normal", wordBreak: "break-word", fontSize: "0.85rem" }}>N° ESCRITURA</th>
            <th style={{ padding: "12px 10px", textAlign: "left", whiteSpace: "normal", wordBreak: "break-word", fontSize: "0.85rem" }}>FECHA</th>
            <th style={{ padding: "12px 10px", textAlign: "left", whiteSpace: "normal", wordBreak: "break-word", fontSize: "0.85rem" }}>MATRÍCULA</th>
            <th style={{ padding: "12px 10px", textAlign: "left", whiteSpace: "normal", wordBreak: "break-word", fontSize: "0.85rem" }}>NOTA DEVOLUTIVA</th>
            <th className="celda-texto" style={{ padding: "12px 10px", textAlign: "left", whiteSpace: "normal", wordBreak: "break-word", fontSize: "0.85rem" }}>MOTIVO</th>
            <th style={{ padding: "12px 10px", textAlign: "center", fontSize: "0.85rem" }} title="Impuestos pagados y escritura radicada en la ORIP">
              {encabezadoOrdenable("REGISTRO", filtro === "registro")}
            </th>
            <th style={{ padding: "12px 10px", textAlign: "center", fontSize: "0.85rem" }}>
              {encabezadoOrdenable("ENVÍO", filtro === "enviadas")}
              {pendientes.length > 0 && (
                <label
                  title="Marcar o desmarcar todas las pendientes"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "5px", marginTop: "4px", fontSize: "0.68rem", fontWeight: 400, textTransform: "none", cursor: "pointer", color: "white" }}
                >
                  <input
                    type="checkbox"
                    checked={todasPendientesMarcadas}
                    onChange={alternarTodas}
                    style={{ width: "15px", height: "15px", cursor: "pointer", accentColor: "#facc15" }}
                  />
                  todas
                </label>
              )}
            </th>
            {isAdmin && <th style={{ padding: "12px 10px", textAlign: "center", fontSize: "0.85rem" }}>ACCIONES</th>}
          </tr>
        </thead>
        <tbody>
          {visibles.map((r, posicion) => (
            <tr
              key={r.id}
              // El verde (enviada) manda sobre el amarillo (en registro):
              // es el estado más avanzado del recorrido.
              className={r.enviado ? "fila-enviada" : r.enRegistro ? "fila-en-registro" : undefined}
              style={{ borderBottom: "1px solid #e5e7eb" }}
            >
              <td style={{ padding: "12px 10px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{posicion + 1}</td>
              <td className="celda-texto" style={{ padding: "12px 10px", whiteSpace: "normal", wordBreak: "break-word", lineHeight: "1.4" }}>{r.acto}</td>
              <td style={{ padding: "12px 10px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.numeroEscritura}</td>
              <td style={{ padding: "12px 10px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.fechaEscritura}</td>
              <td style={{ padding: "12px 10px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.matricula}</td>
              <td style={{ padding: "12px 10px", color: r.notaDevolutiva === "SI" ? "#b91c1c" : "#166534", fontWeight: "bold", whiteSpace: "nowrap" }}>{r.notaDevolutiva}</td>
              <td className="celda-texto" style={{ padding: "12px 10px", whiteSpace: "normal", wordBreak: "break-word", lineHeight: "1.4" }}>{r.motivo || ""}</td>
              <td style={{ padding: "12px 10px", textAlign: "center", whiteSpace: "nowrap" }}>
                {r.enRegistro ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px" }}>
                    <strong style={{ color: "#854d0e", fontSize: "0.8rem" }}>🧾 Pagada</strong>
                    {/* La fecha se puede corregir sin volver a subir el recibo:
                        al adjuntarlo tarde es fácil dejar la del día. */}
                    {editandoFecha?.id === r.id ? (
                      <input
                        type="date"
                        autoFocus
                        value={editandoFecha.fecha}
                        max={hoyLocal()}
                        onChange={(ev) => setEditandoFecha({ id: r.id, fecha: ev.target.value })}
                        onBlur={() => guardarFechaRegistro(r, editandoFecha.fecha)}
                        onKeyDown={(ev) => {
                          if (ev.key === "Enter") guardarFechaRegistro(r, editandoFecha.fecha);
                          if (ev.key === "Escape") setEditandoFecha(null);
                        }}
                        style={{ fontSize: "0.72rem", padding: "2px 4px", border: "1px solid #a16207", borderRadius: "5px" }}
                      />
                    ) : isAdmin ? (
                      <button
                        onClick={() => setEditandoFecha({ id: r.id, fecha: aFechaLocal(r.fechaRegistro) })}
                        title="Cambiar la fecha del pago de impuestos"
                        style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "#854d0e", fontSize: "0.71rem", fontFamily: "inherit", textDecoration: "underline dotted" }}
                      >
                        {formatoFechaEnvio(r.fechaRegistro)} ✎
                      </button>
                    ) : (
                      <small style={{ color: "#854d0e", fontSize: "0.71rem" }}>
                        {formatoFechaEnvio(r.fechaRegistro)}
                      </small>
                    )}
                    {/* El contador solo tiene sentido mientras la escritura
                        siga en registro. Si ya se envió, salió de la ORIP y
                        avisar de una demora sería engañoso. */}
                    {!r.enviado && (() => {
                      const dias = diasHabilesDesde(r.fechaRegistro);
                      const pasada = dias > DIAS_HABILES_REGISTRO;
                      return (
                        <small
                          title={`La ORIP suele demorarse unos ${DIAS_HABILES_REGISTRO} días hábiles. No se descuentan festivos.`}
                          style={{ fontSize: "0.71rem", fontWeight: pasada ? 700 : 400, color: pasada ? "#b91c1c" : "#a16207" }}
                        >
                          {pasada ? `⚠ ${dias} días hábiles` : `${dias} de ${DIAS_HABILES_REGISTRO} días`}
                        </small>
                      );
                    })()}
                    {r.reciboURL && (
                      <a
                        href={r.reciboURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Abrir ${r.reciboNombre || "el recibo"} en una pestaña nueva`}
                        style={{ color: "#854d0e", fontSize: "0.77rem", fontWeight: 600 }}
                      >
                        📎 Ver recibo
                      </a>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => devolverDeRegistro(r)}
                        title="Quitar el recibo y devolver la escritura a pendiente"
                        style={{ background: "none", border: "none", color: "#b91c1c", cursor: "pointer", fontSize: "0.71rem", textDecoration: "underline", padding: 0 }}
                      >
                        Quitar
                      </button>
                    )}
                  </div>
                ) : isAdmin ? (
                  reciboPara?.id === r.id ? (
                    /* Se pregunta la fecha ANTES de elegir el archivo: es el
                       único momento en que quien adjunta se acuerda de cuándo
                       se pagó de verdad. */
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                      <small style={{ color: "#a16207", fontSize: "0.7rem" }}>Fecha del pago</small>
                      <input
                        type="date"
                        autoFocus
                        value={reciboPara.fecha}
                        max={hoyLocal()}
                        onChange={(ev) => setReciboPara({ id: r.id, fecha: ev.target.value })}
                        style={{ fontSize: "0.73rem", padding: "2px 4px", border: "1px solid #a16207", borderRadius: "5px" }}
                      />
                      <label
                        title="Elegir el recibo escaneado o la foto"
                        style={{ display: "inline-flex", alignItems: "center", gap: "5px", cursor: reciboPara.fecha ? "pointer" : "not-allowed", fontSize: "0.75rem", color: "#a16207", fontWeight: 700, margin: 0, opacity: reciboPara.fecha ? 1 : 0.5 }}
                      >
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={adjuntarRecibo(r)}
                          disabled={Boolean(subiendoRecibo) || !reciboPara.fecha}
                          style={{ display: "none" }}
                        />
                        {subiendoRecibo === r.id ? "Subiendo…" : "📎 Elegir archivo"}
                      </label>
                      <button
                        onClick={() => setReciboPara(null)}
                        style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: "0.7rem", textDecoration: "underline", padding: 0 }}
                      >
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setReciboPara({ id: r.id, fecha: hoyLocal() })}
                      title="Adjunta el recibo de pago de impuestos de esta escritura"
                      style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.77rem", color: "#a16207", fontWeight: 600, fontFamily: "inherit", padding: 0 }}
                    >
                      🧾 Adjuntar recibo
                    </button>
                  )
                ) : (
                  <span style={{ color: "#9ca3af", fontSize: "0.8rem" }}>—</span>
                )}
              </td>

              <td style={{ padding: "12px 10px", textAlign: "center", whiteSpace: "nowrap" }}>
                {r.enviado ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                    <strong style={{ color: "#166534", fontSize: "0.82rem" }}>
                      ✅ Enviada
                    </strong>
                    <small style={{ color: "#166534", fontSize: "0.72rem" }}>
                      {formatoFechaEnvio(r.fechaEnvio)}
                    </small>
                    {r.soporteURL && (
                      <a
                        href={r.soporteURL}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Abrir ${r.soporteNombre || "el soporte"} en una pestaña nueva`}
                        style={{ color: "#166534", fontSize: "0.78rem", fontWeight: 600 }}
                      >
                        📎 Ver soporte
                      </a>
                    )}
                    {isAdmin && (
                      <button
                        onClick={() => devolverAPendiente(r)}
                        title="Quitar el soporte y devolver la escritura a pendiente"
                        style={{ background: "none", border: "none", color: "#b91c1c", cursor: "pointer", fontSize: "0.72rem", textDecoration: "underline", padding: 0 }}
                      >
                        Devolver a pendiente
                      </button>
                    )}
                  </div>
                ) : (
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "0.8rem", color: "#6b7280", fontWeight: 400, margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={seleccion.includes(r.id)}
                      onChange={() => alternarSeleccion(r.id)}
                      style={{ width: "18px", height: "18px", cursor: "pointer", accentColor: "#166534" }}
                    />
                    Pendiente
                  </label>
                )}
              </td>
              {isAdmin && (
                <td style={{ padding: "12px 10px", textAlign: "center" }}>
                  <div className="acciones-escritura">
                    <button onClick={() => editEntry(r)} style={{ background: "#d97706" }}>
                      ✏️ Editar
                    </button>
                    <button onClick={() => deleteEntry(r.id)} style={{ background: "#b91c1c" }}>
                      🗑️ Eliminar
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      {escrituras.length === 0 && (
        <p style={{ textAlign: "center", padding: "40px 20px", color: "#6b7280", fontSize: "1.2rem" }}>
          No hay registros aún.{isAdmin ? " Agrega manualmente o importa un Excel." : ""}
        </p>
      )}
    </div>
  );
}
