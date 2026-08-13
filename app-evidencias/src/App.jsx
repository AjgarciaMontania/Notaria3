import { useState, useEffect, useCallback, useRef } from 'react';
import { Preferences } from '@capacitor/preferences';
import { StatusBar, Style } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';

import Login from './screens/Login.jsx';
import Carpetas from './screens/Carpetas.jsx';
import Archivos from './screens/Archivos.jsx';
import { MINUTOS_INACTIVIDAD } from './config.js';
import { escucharCarpetas, escucharArchivos } from './lib/evidencias.js';

const CLAVE_SESION = 'sesion_iniciada_en';

export default function App() {
  const [autenticado, setAutenticado] = useState(null); // null = comprobando
  const [carpetas, setCarpetas] = useState([]);
  const [archivos, setArchivos] = useState([]);
  const [carpetaActual, setCarpetaActual] = useState(null);
  const [cargando, setCargando] = useState(true);
  const temporizador = useRef(null);

  // Barra de estado con el verde de la notaría
  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      StatusBar.setBackgroundColor({ color: '#166534' }).catch(() => {});
      StatusBar.setStyle({ style: Style.Dark }).catch(() => {});
    }
  }, []);

  // ¿Hay una sesión reciente guardada?
  useEffect(() => {
    (async () => {
      const { value } = await Preferences.get({ key: CLAVE_SESION });
      const inicio = value ? Number(value) : 0;
      const vigente = Date.now() - inicio < MINUTOS_INACTIVIDAD * 60 * 1000;
      setAutenticado(Boolean(inicio) && vigente);
    })();
  }, []);

  const renovarSesion = useCallback(async () => {
    await Preferences.set({ key: CLAVE_SESION, value: String(Date.now()) });
  }, []);

  const entrar = useCallback(async () => {
    await renovarSesion();
    setAutenticado(true);
  }, [renovarSesion]);

  const salir = useCallback(async () => {
    await Preferences.remove({ key: CLAVE_SESION });
    setCarpetaActual(null);
    setAutenticado(false);
  }, []);

  // Cierre automático por inactividad
  useEffect(() => {
    if (!autenticado) return;

    const reiniciar = () => {
      if (temporizador.current) clearTimeout(temporizador.current);
      renovarSesion();
      temporizador.current = setTimeout(salir, MINUTOS_INACTIVIDAD * 60 * 1000);
    };

    reiniciar();
    const eventos = ['click', 'touchstart', 'keydown'];
    eventos.forEach((e) => window.addEventListener(e, reiniciar, { passive: true }));
    return () => {
      eventos.forEach((e) => window.removeEventListener(e, reiniciar));
      if (temporizador.current) clearTimeout(temporizador.current);
    };
  }, [autenticado, renovarSesion, salir]);

  // Datos en tiempo real (solo mientras hay sesión)
  useEffect(() => {
    if (!autenticado) return;
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
  }, [autenticado]);

  // Botón "atrás" de Android: vuelve al listado de carpetas
  useEffect(() => {
    if (!carpetaActual) return;
    const alVolver = () => setCarpetaActual(null);
    window.addEventListener('popstate', alVolver);
    window.history.pushState({ vista: 'carpeta' }, '');
    return () => window.removeEventListener('popstate', alVolver);
  }, [carpetaActual]);

  if (autenticado === null) {
    return (
      <div className="pantalla-carga">
        <div className="spinner" />
      </div>
    );
  }

  if (!autenticado) return <Login onEntrar={entrar} />;

  // La carpeta abierta se resuelve contra la lista viva, por si la renombran
  const carpetaViva = carpetaActual
    ? carpetas.find((c) => c.id === carpetaActual.id) || carpetaActual
    : null;

  return carpetaViva ? (
    <Archivos
      carpeta={carpetaViva}
      archivos={archivos.filter((a) => a.folder === carpetaViva.name)}
      onVolver={() => setCarpetaActual(null)}
    />
  ) : (
    <Carpetas
      carpetas={carpetas}
      archivos={archivos}
      cargando={cargando}
      onAbrir={setCarpetaActual}
      onSalir={salir}
    />
  );
}
