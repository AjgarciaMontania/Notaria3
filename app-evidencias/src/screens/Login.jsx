import { useState } from 'react';
import { NOMBRE_NOTARIA } from '../config.js';
import { iniciarSesion, traducirError } from '../lib/sesion.js';

export default function Login() {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState('');
  const [entrando, setEntrando] = useState(false);

  const intentar = async (e) => {
    e.preventDefault();
    if (!correo.trim() || !clave) {
      setError('Escribe tu correo y tu contraseña.');
      return;
    }
    setEntrando(true);
    setError('');
    try {
      await iniciarSesion(correo, clave);
      // No hace falta avisar a nadie: App.jsx escucha el cambio de sesión.
    } catch (fallo) {
      setError(traducirError(fallo));
      setClave('');
    } finally {
      setEntrando(false);
    }
  };

  return (
    <div className="login">
      <div className="login-caja">
        <div className="login-escudo">⚖️</div>
        <h1>Evidencias</h1>
        <p className="login-notaria">{NOMBRE_NOTARIA}</p>

        <form onSubmit={intentar}>
          <label htmlFor="correo">Correo</label>
          <input
            id="correo"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            value={correo}
            onChange={(e) => {
              setCorreo(e.target.value);
              setError('');
            }}
            placeholder="nombre@notaria.gov.co"
          />

          <label htmlFor="clave">Contraseña</label>
          <div className="campo-clave">
            <input
              id="clave"
              type={verClave ? 'text' : 'password'}
              autoComplete="current-password"
              value={clave}
              onChange={(e) => {
                setClave(e.target.value);
                setError('');
              }}
              placeholder="Tu contraseña"
            />
            <button
              type="button"
              className="ojo"
              onClick={() => setVerClave((v) => !v)}
              aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {verClave ? '🙈' : '👁️'}
            </button>
          </div>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="boton principal ancho" disabled={entrando}>
            {entrando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="login-pie">
          Usa la cuenta que te asignó la notaría. Los documentos que subas
          aparecen de inmediato en el módulo de Evidencias de la página web.
        </p>
      </div>
    </div>
  );
}
