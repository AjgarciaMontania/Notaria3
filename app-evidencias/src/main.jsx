import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import AvisoActualizacion from './componentes/AvisoActualizacion.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    {/* Va aquí, al lado de App y no dentro, para que el aviso de actualización
        se vea esté donde esté la persona y App no tenga que enterarse. */}
    <AvisoActualizacion />
  </StrictMode>
);
