// Panel de administración de usuarios. Solo lo ve el administrador.
//
// Ojo: aquí se reparten ROLES, no se crean cuentas de acceso. La cuenta
// (correo y contraseña) se crea en console.firebase.google.com →
// Authentication → Users, porque crear usuarios exige una clave de servidor
// que no puede vivir dentro de una página web pública.
import { useState } from "react";
import { useUsuarios } from "../hooks/useUsuarios";
import {
  ROLES,
  ETIQUETAS_ROL,
  CORREO_ADMIN_RAIZ,
  ROL_POR_DEFECTO,
} from "../utils/roles.js";

const CAJA = {
  maxWidth: "900px",
  margin: "1.5rem auto",
  padding: "1.5rem",
  background: "#f9fafb",
  border: "1px solid #d1d5db",
  borderRadius: "14px",
};

const INPUT = {
  padding: "10px",
  fontSize: "1rem",
  border: "1px solid #d1d5db",
  borderRadius: "8px",
  boxSizing: "border-box",
  width: "100%",
};

export default function UsuariosPanel({ correoActual }) {
  const { usuarios, cargando, error, guardar, eliminar } = useUsuarios(true);
  const [correo, setCorreo] = useState("");
  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState(ROLES.PERSONAL);
  const [aviso, setAviso] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const mostrar = (tipo, texto) => {
    setAviso({ tipo, texto });
    setTimeout(() => setAviso(null), 6000);
  };

  const enviar = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await guardar({ correo, rol, nombre }, correoActual);
      mostrar("ok", `Rol asignado a ${correo.trim().toLowerCase()}.`);
      setCorreo("");
      setNombre("");
      setRol(ROLES.PERSONAL);
    } catch (fallo) {
      mostrar("error", fallo.message || "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  };

  const cambiarRol = async (ficha, nuevoRol) => {
    try {
      await guardar({ correo: ficha.correo, rol: nuevoRol, nombre: ficha.nombre }, correoActual);
    } catch (fallo) {
      mostrar("error", fallo.message || "No se pudo cambiar el rol.");
    }
  };

  const quitar = async (ficha) => {
    const etiqueta = ETIQUETAS_ROL[ROL_POR_DEFECTO].nombre;
    if (
      !window.confirm(
        `¿Quitar la ficha de ${ficha.correo}?\n\n` +
          `La cuenta seguirá existiendo y podrá iniciar sesión, pero volverá ` +
          `al nivel por defecto: ${etiqueta}.`
      )
    )
      return;
    try {
      await eliminar(ficha.correo);
      mostrar("ok", `Ficha de ${ficha.correo} eliminada.`);
    } catch (fallo) {
      mostrar("error", fallo.message || "No se pudo eliminar.");
    }
  };

  return (
    <div style={CAJA}>
      <h3 style={{ color: "#166534", marginTop: 0 }}>👥 Usuarios y permisos</h3>

      <p style={{ color: "#4b5563", fontSize: "0.9rem", lineHeight: 1.5 }}>
        Aquí se reparten los niveles de acceso. La cuenta de correo y contraseña
        se crea aparte, en la consola de Firebase → Authentication → Users; una
        vez creada, asígnale aquí su nivel. Una cuenta sin ficha entra como{" "}
        <strong>{ETIQUETAS_ROL[ROL_POR_DEFECTO].nombre}</strong>.
      </p>

      {aviso && (
        <div
          style={{
            background: aviso.tipo === "ok" ? "#dcfce7" : "#fee2e2",
            border: `1px solid ${aviso.tipo === "ok" ? "#166534" : "#b91c1c"}`,
            color: aviso.tipo === "ok" ? "#166534" : "#b91c1c",
            borderRadius: "8px",
            padding: "10px 14px",
            marginBottom: "1rem",
            fontSize: "0.9rem",
          }}
        >
          {aviso.texto}
        </div>
      )}

      {/* ── Alta / cambio ─────────────────────────────────────────────────── */}
      <form
        onSubmit={enviar}
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
          gap: "0.75rem",
          alignItems: "end",
          marginBottom: "1.5rem",
        }}
      >
        <div>
          <label htmlFor="u-correo" style={{ display: "block", fontWeight: "bold", marginBottom: "0.35rem", fontSize: "0.9rem" }}>
            Correo de la cuenta
          </label>
          <input
            id="u-correo"
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="nombre@notaria.com"
            style={INPUT}
            required
          />
        </div>

        <div>
          <label htmlFor="u-nombre" style={{ display: "block", fontWeight: "bold", marginBottom: "0.35rem", fontSize: "0.9rem" }}>
            Nombre (opcional)
          </label>
          <input
            id="u-nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Para reconocerlo en la lista"
            style={INPUT}
          />
        </div>

        <div>
          <label htmlFor="u-rol" style={{ display: "block", fontWeight: "bold", marginBottom: "0.35rem", fontSize: "0.9rem" }}>
            Nivel
          </label>
          <select id="u-rol" value={rol} onChange={(e) => setRol(e.target.value)} style={INPUT}>
            {Object.values(ROLES).map((r) => (
              <option key={r} value={r}>
                {ETIQUETAS_ROL[r].nombre}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={guardando}
          style={{
            padding: "11px 18px",
            background: guardando ? "#6b7280" : "#166534",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: guardando ? "wait" : "pointer",
            fontWeight: "bold",
            fontSize: "1rem",
          }}
        >
          {guardando ? "Guardando…" : "Asignar nivel"}
        </button>
      </form>

      <p style={{ color: "#6b7280", fontSize: "0.85rem", marginTop: "-0.75rem", marginBottom: "1.25rem" }}>
        {Object.values(ROLES).map((r) => (
          <span key={r} style={{ display: "block" }}>
            <strong>{ETIQUETAS_ROL[r].nombre}:</strong> {ETIQUETAS_ROL[r].detalle}
          </span>
        ))}
      </p>

      {/* ── Administrador raíz ────────────────────────────────────────────── */}
      <div
        style={{
          background: "#fffbeb",
          border: "1px solid #d97706",
          borderRadius: "10px",
          padding: "0.85rem 1rem",
          marginBottom: "1rem",
          fontSize: "0.9rem",
          color: "#92400e",
        }}
      >
        🔑 <strong>{CORREO_ADMIN_RAIZ}</strong> es el administrador principal.
        Su nivel está fijado en el código y en las reglas de Firebase, así que
        no aparece en la lista ni se puede modificar desde aquí. Es la garantía
        de que nadie pueda dejarte fuera de tu propio sistema por error.
      </div>

      {/* ── Lista ─────────────────────────────────────────────────────────── */}
      {error && <p style={{ color: "#b91c1c" }}>{error}</p>}

      {cargando ? (
        <p style={{ color: "#6b7280" }}>Cargando usuarios…</p>
      ) : usuarios.length === 0 ? (
        <p style={{ color: "#6b7280" }}>
          Todavía no hay fichas. Todas las cuentas, salvo la principal, entran
          como {ETIQUETAS_ROL[ROL_POR_DEFECTO].nombre}.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.92rem" }}>
            <thead>
              <tr style={{ background: "#166534", color: "white" }}>
                <th style={{ padding: "10px", textAlign: "left" }}>CORREO</th>
                <th style={{ padding: "10px", textAlign: "left" }}>NOMBRE</th>
                <th style={{ padding: "10px", textAlign: "left", minWidth: "200px" }}>NIVEL</th>
                <th style={{ padding: "10px" }}></th>
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => (
                <tr key={u.correo} style={{ borderBottom: "1px solid #e5e7eb" }}>
                  <td style={{ padding: "10px", wordBreak: "break-all" }}>
                    {u.correo}
                    {u.correo === correoActual && (
                      <span style={{ color: "#166534", fontWeight: "bold" }}> (tú)</span>
                    )}
                  </td>
                  <td style={{ padding: "10px", color: "#6b7280" }}>{u.nombre || "—"}</td>
                  <td style={{ padding: "10px" }}>
                    <select
                      value={Object.values(ROLES).includes(u.rol) ? u.rol : ROL_POR_DEFECTO}
                      onChange={(e) => cambiarRol(u, e.target.value)}
                      style={{ ...INPUT, padding: "7px" }}
                    >
                      {Object.values(ROLES).map((r) => (
                        <option key={r} value={r}>
                          {ETIQUETAS_ROL[r].nombre}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={{ padding: "10px", textAlign: "right" }}>
                    <button
                      onClick={() => quitar(u)}
                      style={{
                        padding: "7px 12px",
                        background: "#b91c1c",
                        color: "white",
                        border: "none",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontSize: "0.85rem",
                      }}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
