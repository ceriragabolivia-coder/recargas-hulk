import React, { useState, useEffect } from 'react';
import { useConfiguracion, useAuth } from '../hooks/useData';
import AlertModal from './AlertModal';

export default function ProveedorCatalogo() {
  const { config, updateConfig } = useConfiguracion();
  const { perfil } = useAuth();
  
  const [apiKey, setApiKey] = useState('');
  const [saldo, setSaldo] = useState(null);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSaldo, setLoadingSaldo] = useState(false);
  const [alertModal, setAlertModal] = useState(null);

  // Cargar API Key inicial
  useEffect(() => {
    if (config?.tiendagiftven_api_key) {
      setApiKey(config.tiendagiftven_api_key);
    }
  }, [config]);

  // Consultar Saldo
  const fetchSaldo = async (keyToUse = apiKey) => {
    if (!keyToUse) return;
    setLoadingSaldo(true);
    try {
      const res = await fetch('/api/tiendagiftven/proxy?endpoint=saldo', {
        headers: { 'X-API-Key': keyToUse }
      });
      const data = await res.json();
      if (data.ok) {
        setSaldo(data.saldo);
      } else {
        setSaldo(null);
        if (data.error !== 'Unauthorized') {
          console.error("Error obteniendo saldo:", data.error);
        }
      }
    } catch (e) {
      console.error(e);
      setSaldo(null);
    }
    setLoadingSaldo(false);
  };

  // Consultar Productos
  const fetchProductos = async (keyToUse = apiKey) => {
    if (!keyToUse) return;
    setLoading(true);
    try {
      const res = await fetch('/api/tiendagiftven/proxy?endpoint=productos', {
        headers: { 'X-API-Key': keyToUse }
      });
      const data = await res.json();
      if (data.ok) {
        setProductos(data.productos);
      } else {
        setAlertModal({ type: 'error', message: data.error || 'Error obteniendo productos' });
      }
    } catch (e) {
      console.error(e);
      setAlertModal({ type: 'error', message: 'Error de red al consultar productos' });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (apiKey && config?.tiendagiftven_api_key) {
      fetchSaldo();
      fetchProductos();
    }
  }, [config?.tiendagiftven_api_key]);

  const handleSaveApi = async () => {
    if (!apiKey.trim()) {
      setAlertModal({ type: 'error', message: 'Debes ingresar una API Key' });
      return;
    }
    
    // Probar la API primero
    try {
      const res = await fetch('/api/tiendagiftven/proxy?endpoint=saldo', {
        headers: { 'X-API-Key': apiKey }
      });
      const data = await res.json();
      if (!data.ok) {
        setAlertModal({ type: 'error', message: 'API Key inválida: ' + (data.error || 'Acceso denegado') });
        return;
      }
      
      // Guardar en config
      await updateConfig('tiendagiftven_api_key', apiKey, true);
      
      // Intentar registrar el webhook automáticamente
      const webhookUrl = `${window.location.origin}/api/tiendagiftven/webhook`;
      try {
        await fetch('/api/tiendagiftven/proxy?endpoint=webhook', {
          method: 'POST',
          headers: { 
            'X-API-Key': apiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url: webhookUrl })
        });
      } catch (err) {
        console.error("Error registrando webhook", err);
      }
      
      setAlertModal({ type: 'success', message: 'API Key guardada correctamente. Webhook registrado (' + webhookUrl + ')' });
      fetchSaldo(apiKey);
      fetchProductos(apiKey);
    } catch (e) {
      setAlertModal({ type: 'error', message: 'Error de conexión con el proveedor' });
    }
  };

  if (perfil?.rol?.toLowerCase() !== 'admin' && perfil?.rol?.toLowerCase() !== 'administrador') {
    return <div style={{ padding: '20px' }}>Acceso denegado. Solo administradores.</div>;
  }

  return (
    <div className="dashboard-content" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '15px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '28px', fontWeight: 800 }}>📦 Proveedor: TiendaGiftVen</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
            Catálogo y configuración de conexión con la API de TiendaGiftVen.tech
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
        <div className="card fade-in">
          <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>🔑 Credenciales API</h3>
          <div className="form-group">
            <label>API Key de tu cuenta</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Ej: tgv_live_xxxxxxxxx"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" onClick={handleSaveApi}>
            Guardar y Conectar
          </button>
          
          <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
            <strong>Webhook URL automático:</strong><br />
            {window.location.origin}/api/tiendagiftven/webhook
          </div>
        </div>

        <div className="card fade-in" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', backgroundColor: 'rgba(0, 210, 255, 0.05)', border: '1px solid rgba(0, 210, 255, 0.1)' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Saldo Disponible</h3>
          {loadingSaldo ? (
            <div style={{ fontSize: '32px', fontWeight: 800 }}>Cargando...</div>
          ) : saldo !== null ? (
            <div style={{ fontSize: '42px', fontWeight: 900, color: '#fff', textShadow: '0 0 20px rgba(0, 210, 255, 0.4)' }}>
              ${parseFloat(saldo).toFixed(2)}
            </div>
          ) : (
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent-error)' }}>No conectado</div>
          )}
          <button className="btn btn-ghost btn-sm" style={{ marginTop: '12px' }} onClick={() => fetchSaldo()}>
            🔄 Actualizar
          </button>
        </div>
      </div>

      <h2 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '16px' }}>📚 Catálogo del Proveedor</h2>
      
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Cargando catálogo desde la API...
        </div>
      ) : productos.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}>
          No se pudieron cargar los productos. Asegúrate de haber guardado una API Key válida.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {productos.map(prod => (
            <div key={prod.id} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{prod.nombre}</h4>
                <div style={{ backgroundColor: 'rgba(0, 210, 255, 0.1)', color: 'var(--accent-primary)', padding: '4px 8px', borderRadius: '8px', fontSize: '14px', fontWeight: 800 }}>
                  ${parseFloat(prod.precio).toFixed(2)}
                </div>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                ID Proveedor: <strong>{prod.id}</strong> | {prod.categoria}
              </div>
              
              <div style={{ fontSize: '13px', color: '#c8d6e8', marginBottom: '16px', flex: 1 }}>
                {prod.descripcion}
              </div>
              
              <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>
                  Tipo de producto:
                </div>
                {prod.campos_requeridos && prod.campos_requeridos.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ fontSize: '12px', color: '#fbbf24', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      ⚡ Recarga Directa
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Campos: {prod.campos_requeridos.map(c => c.descripcion).join(' + ')}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: '#a855f7', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    🎁 Gift Card / PIN
                  </div>
                )}
                {prod.procesamiento_manual && (
                  <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '6px', fontWeight: 600 }}>
                    ⏳ Requiere procesamiento (Webhook)
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {alertModal && (
        <AlertModal
          isOpen={!!alertModal}
          type={alertModal.type}
          title={alertModal.title}
          message={alertModal.message}
          onConfirm={alertModal.onConfirm || (() => setAlertModal(null))}
          onCancel={() => setAlertModal(null)}
        />
      )}
    </div>
  );
}
