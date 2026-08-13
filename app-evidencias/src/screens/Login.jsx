import { useState } from 'react';
import { CLAVE_ACCESO, NOMBRE_NOTARIA } from '../config.js';

export default function Login({ onEntrar }) {
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [verClave, setVerClave] = useState(false);

  const intentar = (e) => {
    e.preventDefault();
    if (clave === CLAVE_ACCESO) {
      setError('');
      onEntrar();
    } else {
      setError('Clave incorrecta. Verifica e intenta de nuevo.');
      setClave('');
    }
  };

  return (
    <div className="login">
      <div className="login-caja">
        <div className="login-escudo">⚖️</div>
        <h1>Evidencias</h1>
        <p className="login-notaria">{NOMBRE_NOTARIA}</p>

        <form onSubmit={intentar}>
          <label htmlFor="clave">Clave de acceso</label>
          <div className="campo-clave">
            <input
              id="clave"
              type={verClave ? 'text' : 'password'}
              value={clave}
              onChange={(e) => {
                setClave(e.target.value);
                setError('');
              }}
              placeholder="Ingresa la clave"
              autoComplete="current-password"
              autoFocus
            />
            <button
              type="button"
              className="ojo"
              onClick={() => setVerClave((v) => !v)}
              aria-label={verClave ? 'Ocultar clave' : 'Mostrar clave'}
            >
              {verClave ? '🙈' : '👁️'}
            </button>
          </div>

          {error && <p className="error">{error}</p>}

          <button type="submit" className="boton principal ancho">
            Entrar
          </button>
        </form>

        <p className="login-pie">
          Los documentos que subas aquí aparecen de inmediato en el módulo de
          Evidencias de la página web.
        </p>
      </div>
    </div>
  );
}
