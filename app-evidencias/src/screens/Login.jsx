import { useState } from 'react';
import { NOMBRE_NOTARIA, VERSION_APP, MINUTOS_INACTIVIDAD } from '../config.js';
import { iniciarSesion, traducirError } from '../lib/sesion.js';
import escudo from '../assets/escudo.png';

export default function Login({ cerradaPorInactividad = false, alEscribir }) {
  const [correo, setCorreo] = useState('');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [error, setError] = useState('');
  const [entrando, setEntrando] = useState(false);

  const escribiendo = (poner) => (e) => {
    poner(e.target.value);
    setError('');
    alEscribir?.();
  };

  const intentar = async (e) => {
    e.preventDefault();
    if (!correo.trim() || !clave) {
      setError('Escribe tu usuario y tu contraseña.');
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
        <div className="login-marca">
          <img src={escudo} alt="" className="login-escudo" />
          <h1>Notaría Única</h1>
          <p className="login-notaria">{NOMBRE_NOTARIA.replace('Notaría Única de ', '')}</p>
          <span className="login-modulo">Evidencias y liquidación</span>
        </div>

        {cerradaPorInactividad && (
          <div className="login-aviso">
            🔒 Se cerró la sesión por seguridad, después de {MINUTOS_INACTIVIDAD} minutos
            sin actividad. Vuelve a entrar.
          </div>
        )}

        <form onSubmit={intentar} className="login-form">
          <div className="login-campo">
            <label htmlFor="correo">Usuario o correo</label>
            <input
              id="correo"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="username"
              value={correo}
              onChange={escribiendo(setCorreo)}
              placeholder="Tu usuario, o tu correo"
            />
          </div>

          <div className="login-campo">
            <label htmlFor="clave">Contraseña</label>
            <div className="campo-clave">
              <input
                id="clave"
                type={verClave ? 'text' : 'password'}
                autoComplete="current-password"
                value={clave}
                onChange={escribiendo(setClave)}
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
          </div>

          {error && <p className="login-error">⚠ {error}</p>}

          <button type="submit" className="boton principal ancho" disabled={entrando}>
            {entrando ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="login-pie">
          Usa la cuenta que te asignó la notaría. Por seguridad, la sesión se
          cierra sola tras {MINUTOS_INACTIVIDAD} minutos sin uso.
        </p>
      </div>

      <p className="login-version">Versión {VERSION_APP}</p>
    </div>
  );
}
