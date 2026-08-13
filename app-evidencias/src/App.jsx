import { useState, useEffect, useCallback, useRef } from 'react';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

import Login from './screens/Login.jsx';
import Carpetas from './screens/Carpetas.jsx';
import Archivos from './screens/Archivos.jsx';
import Recibidos from './screens/Recibidos.jsx';
import Escrituras from './screens/Escrituras.jsx';
import Liquidacion from './screens/Liquidacion.jsx';
import { MINUTOS_INACTIVIDAD } from './config.js';
import { puedeOperar } from '@calculo/roles.js';
import { useRol } from './lib/rol.js';
import { escucharCarpetas, escucharArchivos } from './lib/evidencias.js';
import { escucharEscrituras } from './lib/escrituras.js';
import { recogerPendientes, alRecibirArchivos } from './lib/compartidos.js';
import { alCambiarSesion, cerrarSesion } from './lib/sesion.js';

export default function App() {
  // undefined = todavía comprobando; null = sin sesión; objeto = sesión activa
  const [usuario, setUsuario] = useState(undefined);
  const autenticado = Boolean(usuario);
  // El nivel de acceso vive en Firestore y lo administra la página web.
  // Mientras se averigua, la app no se suscribe a nada: así una cuenta
  // restringida nunca llega a pedir datos que tiene prohibidos.
  const { rol, cargando: cargandoRol } = useRol(usuario);
  const puedeVerTodo = autenticado && puedeOperar(rol);
  const soloLiquida = autenticado && !cargandoRol && !puedeVerTodo;
  const [carpetas, setCarpetas] = useState([]);
  const [archivos, setArchivos] = useState([]);
  const [carpetaActual, setCarpetaActual] = useState(null);
  const [cargando, setCargando] = useState(true);
  // PDFs que otra app envió con el botón "Compartir" de Android
  const [compartidos, setCompartidos] = useState([]);
  // Pestaña activa: 'evidencias', 'escrituras' o 'liquidacion'
  const [pestana, setPestana] = useState('evidencias');
  const [escrituras, setEscrituras] = useState([]);
  const [cargandoEscrituras, setCargandoEscrituras] = useState(true);
  const temporizador = useRef(null);

  // Barra de estado con el verde de la notaría
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setBackgroundColor({ color: '#166534' }).catch(() => {});
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    }
  }, []);

  // Firebase avisa del estado de la sesión, incluida la recordada de la vez anterior
  useEffect(() => {
    return alCambiarSesion((cuenta) => {
      setUsuario(cuenta ?? null);
      if (!cuenta) setCarpetaActual(null);
    });
  }, []);

  const salir = useCallback(async () => {
    setCarpetaActual(null);
    await cerrarSesion();
  }, []);

  // Cierre automático por inactividad
  useEffect(() => {
    if (!autenticado) return;

    const reiniciar = () => {
      if (temporizador.current) clearTimeout(temporizador.current);
      temporizador.current = setTimeout(salir, MINUTOS_INACTIVIDAD * 60 * 1000);
    };

    reiniciar();
    const eventos = ['click', 'touchstart', 'keydown'];
    eventos.forEach((e) => window.addEventListener(e, reiniciar, { passive: true }));
    return () => {
      eventos.forEach((e) => window.removeEventListener(e, reiniciar));
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, [autenticado, salir]);

  // Datos en tiempo real (solo mientras hay sesión)
  useEffect(() => {
    if (!puedeVerTodo) return;
    setCargando(true);
    let recibidoCarpetas = false;
    let recibidoArchivos = false;
    const listo = () => {
      if (recibidoCarpetas && recibidoArchivos) setCargando(false);
    };

    const pararCarpetas = escucharCarpetas((datos) => {
      setCarpetas(datos);
      recibidoCarpetas = true;
      listo();
    });
    const pararArchivos = escucharArchivos((datos) => {
      setArchivos(datos);
      recibidoArchivos = true;
      listo();
    });

    return () => {
      pararCarpetas();
      pararArchivos();
    };
  }, [puedeVerTodo]);

  // Escrituras pendientes de Florencia
  useEffect(() => {
    if (!puedeVerTodo) return;
    setCargandoEscrituras(true);
    const parar = escucharEscrituras((datos) => {
      setEscrituras(datos);
      setCargandoEscrituras(false);
    });
    return parar;
  }, [puedeVerTodo]);

  /**
   * Añade archivos compartidos descartando los que ya estén en la lista.
   * La ruta la genera el plugin y es única por archivo recibido, así que
   * sirve de identificador. Es una red de seguridad: aunque algo entregue
   * el mismo archivo dos veces, no se sube por duplicado.
   */
  const agregarCompartidos = useCallback((llegados) => {
    setCompartidos((previos) => {
      const yaEstan = new Set(previos.map((a) => a.ruta));
      const nuevos = llegados.filter((a) => a.ruta && !yaEstan.has(a.ruta));
      return nuevos.length ? [...previos, ...nuevos] : previos;
    });
  }, []);

  // Archivos llegados por "Compartir" desde otra aplicación
  useEffect(() => {
    if (!puedeVerTodo) return;
    let oyente = null;
    let vivo = true;

    (async () => {
      // Primero el oyente, para no perder nada que llegue mientras tanto.
      oyente = await alRecibirArchivos((nuevos) => {
        if (vivo) agregarCompartidos(nuevos);
      });
      // Y luego se vacía la cola por si ya había algo esperando.
      const yaLlegados = await recogerPendientes();
      if (vivo && yaLlegados.length) agregarCompartidos(yaLlegados);
    })();

    return () => {
      vivo = false;
      if (oyente?.remove) oyente.remove();
    };
  }, [puedeVerTodo, agregarCompartidos]);

  // Botón "atrás" de Android: vuelve al listado de carpetas
  useEffect(() => {
    if (!carpetaActual) return;
    const alVolver = () => setCarpetaActual(null);
    window.addEventListener('popstate', alVolver);
    window.history.pushState({ vista: 'carpeta' }, '');
    return () => window.removeEventListener('popstate', alVolver);
  }, [carpetaActual]);

  if (usuario === undefined) {
    return (
      <div className="pantalla-carga">
        <div className="spinner" />
      </div>
    );
  }

  if (!autenticado) return <Login />;

  // Se sabe que hay sesión pero todavía no de qué nivel: se espera. Decidir
  // antes de tiempo mostraría la pantalla equivocada durante un instante.
  if (cargandoRol) {
    return (
      <div className="pantalla-carga">
        <div className="spinner" />
      </div>
    );
  }

  // Cuenta de solo liquidación: una sola pantalla, sin barra de pestañas.
  // Va antes que todo lo demás para que ni los archivos compartidos ni el
  // botón "atrás" puedan llevarla a otra parte.
  if (soloLiquida) return <Liquidacion onSalir={salir} />;

  // Si otra app compartió PDFs, eso manda sobre cualquier otra pantalla
  if (compartidos.length > 0) {
    return (
      <Recibidos
        archivos={compartidos}
        carpetas={carpetas}
        archivosExistentes={archivos}
        escrituras={escrituras}
        onCerrar={() => setCompartidos([])}
      />
    );
  }

  // La carpeta abierta se resuelve contra la lista viva, por si la renombran
  const carpetaViva = carpetaActual
    ? carpetas.find((c) => c.id === carpetaActual.id) || carpetaActual
    : null;

  // Dentro de una carpeta la pantalla ocupa todo: las pestañas estorbarían
  if (carpetaViva) {
    return (
      <Archivos
        carpeta={carpetaViva}
        archivos={archivos.filter((a) => a.folder === carpetaViva.name)}
        onVolver={() => setCarpetaActual(null)}
      />
    );
  }

  return (
    <div className="con-pestanas">
      <div className="cuerpo-pestanas">
        {pestana === 'evidencias' ? (
          <Carpetas
            carpetas={carpetas}
            archivos={archivos}
            cargando={cargando}
            onAbrir={setCarpetaActual}
            onSalir={salir}
          />
        ) : pestana === 'escrituras' ? (
          <Escrituras
            escrituras={escrituras}
            cargando={cargandoEscrituras}
            onSalir={salir}
          />
        ) : (
          <Liquidacion onSalir={salir} />
        )}
      </div>

      <nav className="pestanas">
        <button
          className={pestana === 'evidencias' ? 'activa' : undefined}
          onClick={() => setPestana('evidencias')}
        >
          <span className="pestana-icono">📁</span>
          Evidencias
        </button>
        <button
          className={pestana === 'escrituras' ? 'activa' : undefined}
          onClick={() => setPestana('escrituras')}
        >
          <span className="pestana-icono">📋</span>
          Escrituras
          {escrituras.filter((e) => !e.enviado).length > 0 && (
            <span className="pestana-globo">
              {escrituras.filter((e) => !e.enviado).length}
            </span>
          )}
        </button>
        <button
          className={pestana === 'liquidacion' ? 'activa' : undefined}
          onClick={() => setPestana('liquidacion')}
        >
          <span className="pestana-icono">🧮</span>
          Liquidar
        </button>
      </nav>
    </div>
  );
}
