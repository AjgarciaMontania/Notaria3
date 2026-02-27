import { useState, useEffect } from "react";
import { collection, addDoc, onSnapshot, deleteDoc, doc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase";




const ADMIN_PASSWORD = "notaria2026";







export default function Evidencias() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [password, setPassword] = useState("");
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [currentFolder, setCurrentFolder] = useState(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploading, setUploading] = useState(false);

  // Escucha en tiempo real
  useEffect(() => {
    const unsubFolders = onSnapshot(collection(db, "folders"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.name.localeCompare(b.name));
      setFolders(data);
    });

    const unsubFiles = onSnapshot(collection(db, "files"), (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setFiles(data);
    });

    return () => {
      unsubFolders();
      unsubFiles();
    };
  }, []);

  const createFolder = async () => {
    if (!newFolderName.trim()) return alert("Ingresa un nombre de carpeta");
    const exists = folders.some(f => f.name.toLowerCase() === newFolderName.trim().toLowerCase());
    if (exists) return alert("Esa carpeta ya existe");

    try {
      await addDoc(collection(db, "folders"), {
        name: newFolderName.trim(),
        createdAt: new Date().toISOString()
      });
      setNewFolderName("");
      alert("✅ Carpeta creada");
    } catch (e) {
      alert("Error al crear carpeta");
    }
  };

  const handleUpload = async (e) => {
    if (!currentFolder) return alert("Selecciona una carpeta primero");
    const selectedFiles = Array.from(e.target.files);
    if (selectedFiles.length === 0) return;

    setUploading(true);
    try {
      for (const file of selectedFiles) {
        const storageRef = ref(storage, `evidencias/${currentFolder.name}/${file.name}`);
        await uploadBytes(storageRef, file, {
  contentType: file.type || "application/octet-stream"
});
        const downloadURL = await getDownloadURL(storageRef);

        await addDoc(collection(db, "files"), {
          folder: currentFolder.name,
          fileName: file.name,
          downloadURL,
          uploadDate: new Date().toISOString(),
          size: file.size,
          contentType: file.type,
          storagePath: `evidencias/${currentFolder.name}/${file.name}`
        });
      }
      alert(`✅ ${selectedFiles.length} archivo(s) subido(s)`);
    } catch (error) {
      console.error(error);
      alert("Error al subir archivos");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };


async function deleteFile(storagePath, docId) {
  try {
    // 1️⃣ Eliminar de Firebase Storage
    const fileRef = ref(storage, storagePath);
    await deleteObject(fileRef);

    // 2️⃣ Eliminar documento de Firestore
    await deleteDoc(doc(db, "files", docId));

    alert("Archivo eliminado correctamente");
  } catch (error) {
    console.error("Error al eliminar:", error);

    if (error.code === "storage/object-not-found") {
      // Si ya no existe en storage, al menos elimina el documento
      await deleteDoc(doc(db, "files", docId));
      alert("El archivo ya no existía en Storage, pero se limpió la base de datos.");
    } else {
      alert("Error al eliminar: " + error.message);
    }
  }
}

  const deleteFolder = async () => {
    const filesInFolder = files.filter(f => f.folder === currentFolder.name);
    if (filesInFolder.length > 0) return alert("No se puede eliminar una carpeta que contiene archivos");
    if (!window.confirm(`¿Eliminar la carpeta "${currentFolder.name}"?`)) return;

    try {
      await deleteDoc(doc(db, "folders", currentFolder.id));
      setCurrentFolder(null);
      alert("Carpeta eliminada");
    } catch (e) {
      alert("Error al eliminar carpeta");
    }
  };

 async function uploadFile(file) {
  try {
    const storagePath = `evidencias/${currentFolder.name}/${file.name}`;
    const storageRef = ref(storage, storagePath);

    // 🔥 Subir archivo binario real
    await uploadBytes(storageRef, file, {
      contentType: file.type
    });

    const downloadURL = await getDownloadURL(storageRef);

    console.log("Archivo subido correctamente");
  } catch (error) {
    console.error("Error al subir:", error);
  }
}

  const filesInCurrentFolder = files.filter(f => f.folder === currentFolder?.name);

  return (
    <div className="input-card" style={{ maxWidth: "1200px", margin: "2rem auto" }}>
      <h2 style={{ textAlign: "center", color: "#166534", marginBottom: "2rem" }}>
        📁 EVIDENCIAS NOTARIALES
      </h2>

      {/* LOGIN ADMIN */}
      {!isAdmin ? (
        <div style={{ maxWidth: "400px", margin: "0 auto 3rem", padding: "2rem", background: "#f3f4f6", borderRadius: "12px" }}>
          <label style={{ display: "block", fontWeight: "bold", marginBottom: "0.5rem" }}>Contraseña Admin:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: "100%", padding: "12px", fontSize: "1rem", borderRadius: "8px", marginBottom: "1rem" }}
          />
          <button
            onClick={() => password === ADMIN_PASSWORD ? setIsAdmin(true) : alert("Contraseña incorrecta")}
            style={{ width: "100%", padding: "12px", background: "#166534", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}
          >
            Ingresar como Admin
          </button>
        </div>
      ) : (
        <div style={{ marginBottom: "2rem", textAlign: "center" }}>
          <button
            onClick={() => { setIsAdmin(false); setPassword(""); }}
            style={{ padding: "10px 20px", background: "#6b7280", color: "white", border: "none", borderRadius: "8px", cursor: "pointer" }}
          >
            Cerrar sesión Admin
          </button>
        </div>
      )}

      {/* CREAR CARPETA (solo admin) */}
      {isAdmin && (
        <div style={{ marginBottom: "2rem", display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Nombre de nueva carpeta"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            style={{ padding: "12px", width: "320px", borderRadius: "8px", border: "1px solid #ddd" }}
          />
          <button onClick={createFolder} style={{ padding: "12px 24px", background: "#166534", color: "white", border: "none", borderRadius: "8px" }}>
            ➕ Crear Carpeta
          </button>
        </div>
      )}

      {/* LISTADO DE CARPETAS */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "center", marginBottom: "3rem" }}>
        {folders.length === 0 ? (
          <p style={{ color: "#666", fontStyle: "italic" }}>Aún no hay carpetas. Crea la primera.</p>
        ) : (
          folders.map(folder => (
            <button
              key={folder.id}
              onClick={() => setCurrentFolder(folder)}
              style={{
                padding: "14px 24px",
                background: currentFolder?.name === folder.name ? "#166534" : "#f3f4f6",
                color: currentFolder?.name === folder.name ? "white" : "#333",
                border: "none",
                borderRadius: "12px",
                cursor: "pointer",
                fontSize: "1.1rem",
                minWidth: "180px"
              }}
            >
              📁 {folder.name}
            </button>
          ))
        )}
      </div>

      {/* CONTENIDO DE LA CARPETA SELECCIONADA */}
      {currentFolder && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <h3 style={{ margin: 0, color: "#166534" }}>📁 {currentFolder.name}</h3>
            <div>
              {isAdmin && (
                <>
                  <label
                    style={{
                      display: "inline-block",
                      padding: "12px 28px",
                      background: "#d97706",
                      color: "white",
                      borderRadius: "9999px",
                      cursor: "pointer",
                      marginRight: "1rem"
                    }}
                  >
                    📤 Subir Archivos
                    <input
                      type="file"
                      multiple
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
                      onChange={handleUpload}
                      disabled={uploading}
                      style={{ display: "none" }}
                    />
                  </label>

                  {filesInCurrentFolder.length === 0 && (
                    <button
                      onClick={deleteFolder}
                      style={{ padding: "12px 24px", background: "#b91c1c", color: "white", border: "none", borderRadius: "9999px" }}
                    >
                      🗑️ Eliminar Carpeta
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          {filesInCurrentFolder.length === 0 ? (
            <p style={{ textAlign: "center", padding: "40px", color: "#666", fontSize: "1.2rem" }}>
              Esta carpeta está vacía.
              {isAdmin && " Sube archivos usando el botón naranja."}
            </p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#166534", color: "white" }}>
                  <th style={{ padding: "14px", textAlign: "left" }}>Nombre</th>
                  <th style={{ padding: "14px" }}>Tipo</th>
                  <th style={{ padding: "14px" }}>Tamaño</th>
                  <th style={{ padding: "14px" }}>Fecha</th>
                  <th style={{ padding: "14px" }}>Vista</th>
                  <th style={{ padding: "14px" }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filesInCurrentFolder
                  .sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate))
                  .map(file => {
                    const isImage = file.contentType?.startsWith("image/");
                    return (
                      <tr key={file.id} style={{ borderBottom: "1px solid #eee" }}>
                        <td style={{ padding: "14px" }}>{file.fileName}</td>
                        <td style={{ padding: "14px", textAlign: "center" }}>{file.contentType?.split("/")[1] || "—"}</td>
                        <td style={{ padding: "14px", textAlign: "center" }}>
                          {(file.size / (1024 * 1024)).toFixed(2)} MB
                        </td>
                        <td style={{ padding: "14px", textAlign: "center" }}>
                          {new Date(file.uploadDate).toLocaleDateString("es-CO")}
                        </td>
                        <td style={{ padding: "14px", textAlign: "center" }}>
                          {isImage ? (
                            <img
                              src={file.downloadURL}
                              alt={file.fileName}
                              style={{ maxHeight: "60px", maxWidth: "100px", objectFit: "contain", borderRadius: "4px" }}
                            />
                          ) : (
                            "📄"
                          )}
                        </td>
                        <td style={{ padding: "14px", textAlign: "center" }}>
                     <button
  onClick={async () => {
    try {
      const response = await fetch(file.downloadURL);
      const blob = await response.blob();

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.fileName;
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error al descargar:", error);
      alert("Error al descargar archivo");
    }
  }}
  style={{
    marginRight: "12px",
    color: "#166534",
    background: "none",
    border: "none",
    cursor: "pointer"
  }}
>
  📥 Descargar
</button>
                          {isAdmin && (
                            <button
                              onClick={() => deleteFile(file.storagePath, file.id)}
                              style={{ background: "#b91c1c", color: "white", border: "none", padding: "6px 12px", borderRadius: "6px", cursor: "pointer" }}
                            >
                              🗑️
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}

          <div style={{ textAlign: "center", marginTop: "2rem" }}>
            <button
              onClick={() => setCurrentFolder(null)}
              style={{ padding: "12px 32px", background: "#6b7280", color: "white", border: "none", borderRadius: "9999px" }}
            >
              ← Volver a todas las carpetas
            </button>
          </div>
        </div>
      )}
    </div>
  );


}
