// src/components/InputSection.jsx
export default function InputSection({
  compraventa, onCompraventaChange,
  certificado, onCertificadoChange,
  hipoteca, onHipotecaChange,
  saber, onSaberChange,
  igac, onIgacChange,
  donacion, onDonacionChange,
  permuta, onPermutaChange,
  sucesion, onSucesionChange,
  sinCuantia, onSinCuantiaChange,
  dineroEnviado, onDineroChange,
  onIngresar, onCalcular, onLimpiar, onExportar, calcularDisabled
}) {
  return (
    <div className="input-card">
      <div className="inputs-container">
        {/* Fila 1 */}
        <div className="input-row three-columns">
          <div className="input-group">
            <label>Compraventa:</label>
            <input type="number" placeholder="Cantidad" value={compraventa} onChange={onCompraventaChange} min="0" />
          </div>
          <div className="input-group">
            <label>Certificado Cancelación Hipoteca:</label>
            <input type="number" placeholder="Cantidad" value={certificado} onChange={onCertificadoChange} min="0" />
          </div>
          <div className="input-group">
            <label>Hipoteca con Banco Agrario:</label>
            <input type="number" placeholder="Cantidad" value={hipoteca} onChange={onHipotecaChange} min="0" />
          </div>
        </div>

        {/* Fila 2 */}
        <div className="input-row two-columns">
          <div className="input-group">
            <label>Escritura para Saber:</label>
            <input type="number" placeholder="Cantidad" value={saber} onChange={onSaberChange} min="0" />
          </div>
          <div className="input-group">
            <label>Trámite IGAC:</label>
            <input type="number" placeholder="Cantidad" value={igac} onChange={onIgacChange} min="0" />
          </div>
        </div>

        {/* Fila 3 y 4 - Descomenta cuando quieras usarlos */}
        {/* 
        <div className="input-row three-columns">
          <div className="input-group"><label>Donación:</label><input type="number" value={donacion} onChange={onDonacionChange} min="0" /></div>
          <div className="input-group"><label>Permuta:</label><input type="number" value={permuta} onChange={onPermutaChange} min="0" /></div>
          <div className="input-group"><label>Sucesión:</label><input type="number" value={sucesion} onChange={onSucesionChange} min="0" /></div>
        </div>
        <div className="input-row two-columns">
          <div className="input-group"><label>Acto sin cuantía (poder, PH, etc.):</label><input type="number" value={sinCuantia} onChange={onSinCuantiaChange} min="0" /></div>
        </div>
        */}

        {/* DINERO ENVIADO */}
        <div className="dinero-group">
          <label>DINERO ENVIADO:</label>
          <input type="text" placeholder="Ingrese el monto enviado" value={dineroEnviado} onChange={onDineroChange} />
        </div>
      </div>

      <div className="button-row">
        <button className="ingresar" onClick={onIngresar}>Ingresar</button>
        <button className="calcular" onClick={() => onCalcular(dineroEnviado)} disabled={calcularDisabled}>Calcular</button>
        <button className="limpiar" onClick={onLimpiar}>Limpiar</button>
        <button className="exportar" onClick={onExportar}>Exportar Excel</button>
      </div>
    </div>
  );
}