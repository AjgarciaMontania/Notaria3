// Aviso de la actualización automática.
//
// Va montado aparte de App, al lado, y no dentro: así se ve esté donde esté la
// persona —en la pantalla de acceso, en escrituras, liquidando— y App no tiene
// que enterarse de que la actualización existe.
//
// Lo que hace al abrir la aplicación, en este orden:
//   1. Avisa que arrancó bien. Si NO se avisa, el plugin entiende que la
//      actualización dejó la aplicación rota y se devuelve solo a la anterior.
//      Es la red de seguridad de todo esto, por eso va primero y sin condiciones.
//   2. Mira si hay algo nuevo publicado en GitHub y lo baja.
//
// Cuando no hay nada que decir, no se pinta nada: no hay por qué avisar de que
// todo sigue igual.
import { useState, useEffect } from 'react';
import { confirmarArranque, buscarActualizacion, aplicarAhora } from '../lib/actualizacion.js';

const COLORES = {
  bajando: { fondo: '#eff6ff', borde: '#93c5fd', texto: '#1e40af' },
  lista: { fondo: '#f0fdf4', borde: '#6ee7b7', texto: '#065f46' },
  'exige-apk': { fondo: '#fffbeb', borde: '#fcd34d', texto: '#92400e' },
  error: { fondo: '#fef2f2', borde: '#fca5a5', texto: '#991b1b' },
};

export default function AvisoActualizacion() {
  const [estado, setEstado] = useState(null);
  const [oculto, setOculto] = useState(false);

  useEffect(() => {
    let vivo = true;
    (async () => {
      await confirmarArranque();
      const resultado = await buscarActualizacion((paso) => {
        if (vivo) setEstado(paso);
      });
      if (vivo) setEstado(resultado.tipo === 'nada' ? null : resultado);
    })();
    return () => { vivo = false; };
  }, []);

  if (!estado || oculto) return null;
  const color = COLORES[estado.tipo] || COLORES.lista;

  return (
    <div
      role="status"
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 9999,
        background: color.fondo,
        borderTop: `2px solid ${color.borde}`,
        color: color.texto,
        padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
        display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap',
        fontSize: '0.86rem', lineHeight: 1.45,
        boxShadow: '0 -2px 12px rgba(0,0,0,0.08)',
      }}
    >
      <span style={{ flex: '1 1 200px' }}>{estado.texto}</span>

      {estado.tipo === 'lista' && (
        <button
          onClick={aplicarAhora}
          style={{
            padding: '8px 16px', background: '#166534', color: 'white',
            border: 'none', borderRadius: '8px', fontFamily: 'inherit',
            fontSize: '0.84rem', fontWeight: 600,
          }}
        >
          Reiniciar ahora
        </button>
      )}

      {/* Mientras baja no se deja cerrar: cerrarlo daría a entender que se
          canceló, y la descarga sigue igual. */}
      {estado.tipo !== 'bajando' && (
        <button
          onClick={() => setOculto(true)}
          aria-label="Cerrar el aviso"
          style={{
            padding: '8px 12px', background: 'none', border: 'none',
            color: color.texto, fontFamily: 'inherit', fontSize: '0.95rem',
          }}
        >
          ✕
        </button>
      )}
    </div>
  );
}
