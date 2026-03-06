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
  fechaPago, onFechaPagoChange,
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

        {/* Fila 3 */}
        <div className="input-row three-columns">
          <div className="input-group">
            <label>Donación:</label>
            <input type="number" placeholder="Cantidad" value={donacion} onChange={onDonacionChange} min="0" />
          </div>
          <div className="input-group">
            <label>Permuta:</label>
            <input type="number" placeholder="Cantidad" value={permuta} onChange={onPermutaChange} min="0" />
          </div>
          <div className="input-group">
            <label>Sucesión:</label>
            <input type="number" placeholder="Cantidad" value={sucesion} onChange={onSucesionChange} min="0" />
          </div>
        </div>

        {/* Fila 4 */}
        <div className="input-row two-columns">
          <div className="input-group">
            <label>Acto sin cuantía (poder, PH, etc.):</label>
            <input type="number" placeholder="Cantidad" value={sinCuantia} onChange={onSinCuantiaChange} min="0" />
          </div>
        </div>

        {/* DINERO ENVIADO + FECHA DE PAGO */}
        <div className="input-row two-columns" style={{ alignItems: "flex-end" }}>
          <div className="dinero-group" style={{ flex: 2 }}>
            <label>DINERO ENVIADO:</label>
            <input type="text" placeholder="Ingrese el monto enviado" value={dineroEnviado} onChange={onDineroChange} />
          </div>
          <div className="input-group" style={{ flex: 1 }}>
            <label style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              📅 FECHA DE PAGO/REGISTRO ORIP:
              <span
                title="Si la escritura se paga después de 60 días de otorgada, la Gobernación del Caquetá cobra intereses de mora (~22.13% anual simple). Esta fecha se usa para calcularlos automáticamente."
                style={{ cursor: "help", background: "#166534", color: "white", borderRadius: "50%", width: "18px", height: "18px", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: "bold", flexShrink: 0 }}
              >?</span>
            </label>
            <input
              type="date"
              value={fechaPago}
              onChange={onFechaPagoChange}
              style={{ padding: "10px", fontSize: "1rem", border: "1px solid #d1d5db", borderRadius: "8px", width: "100%" }}
            />
          </div>
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
