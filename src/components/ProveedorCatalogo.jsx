import React, { useState, useEffect } from 'react';
import { useConfiguracion, useAuth } from '../hooks/useData';
import AlertModal from './AlertModal';

export default function ProveedorCatalogo() {
  const { config, updateConfig } = useConfiguracion();
  const { perfil } = useAuth();
  
  const [activeTab, setActiveTab] = useState('tiendagiftven');

  const [apiKey, setApiKey] = useState('');
  const [saldo, setSaldo] = useState(null);
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSaldo, setLoadingSaldo] = useState(false);
  const [alertModal, setAlertModal] = useState(null);

  // FazerCards state
  const [fcApiKey, setFcApiKey] = useState('');
  const [fcSaldo, setFcSaldo] = useState(null);
  const [loadingFcSaldo, setLoadingFcSaldo] = useState(false);
  const [fcProductos, setFcProductos] = useState([]);
  const [loadingFcProductos, setLoadingFcProductos] = useState(false);
  const [fcOffers, setFcOffers] = useState({});
  const [loadingFcOffers, setLoadingFcOffers] = useState({});
  const [expandedFcCategories, setExpandedFcCategories] = useState({});

  // Buscadores
  const [searchTermTGV, setSearchTermTGV] = useState('');
  const [searchTermFC, setSearchTermFC] = useState('');

  // Cargar API Key inicial
  useEffect(() => {
    if (config?.tiendagiftven_api_key) {
      setApiKey(config.tiendagiftven_api_key);
    }
    if (config?.fazercards_api_key) {
      setFcApiKey(config.fazercards_api_key);
    }
  }, [config]);

  // Consultar Saldo TiendaGiftVen
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
      }
    } catch (e) {
      setSaldo(null);
    }
    setLoadingSaldo(false);
  };

  // Consultar Saldo FazerCards
  const fetchFcSaldo = async (keyToUse = fcApiKey) => {
    if (!keyToUse) return;
    setLoadingFcSaldo(true);
    try {
      const res = await fetch('/api/fazercards/proxy?endpoint=balance', {
        headers: { 'X-API-Key': keyToUse }
      });
      const data = await res.json();
      if (data.ok && data.balance !== undefined) {
        setFcSaldo(data.balance);
      } else {
        setFcSaldo(null);
      }
    } catch (e) {
      setFcSaldo(null);
    }
    setLoadingFcSaldo(false);
  };

  // Consultar Productos FazerCards
  const fetchFcProductos = async (keyToUse = fcApiKey) => {
    if (!keyToUse) return;
    setLoadingFcProductos(true);
    try {
      const res = await fetch('/api/fazercards/proxy?endpoint=topups', {
        headers: { 'X-API-Key': keyToUse }
      });
      const data = await res.json();
      
      let allItems = [];
      if (data.ok && data.items) {
        allItems = [...data.items];
      }
      
      // Añadir Telegram manualmente
      allItems.unshift({
        category_id: 'telegram_premium',
        name: 'Telegram Premium',
        note: 'Telegram premium plans'
      });
      allItems.unshift({
        category_id: 'telegram_stars',
        name: 'Telegram Stars',
        note: 'Telegram stars quotes'
      });

      setFcProductos(allItems);

      if (!data.ok && !data.items) {
        setAlertModal({ type: 'error', message: data.error || 'Error obteniendo catálogo de FazerCards' });
      }
    } catch (e) {
      setAlertModal({ type: 'error', message: 'Error de red al consultar FazerCards' });
    }
    setLoadingFcProductos(false);
  };

  // Consultar Offers para una categoría de FazerCards
  const fetchFcOffers = async (categoryId) => {
    if (!fcApiKey) return;
    
    // Toggle expansión
    setExpandedFcCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));

    // Si ya los tenemos, no volvemos a descargar
    if (fcOffers[categoryId]) return;

    setLoadingFcOffers(prev => ({ ...prev, [categoryId]: true }));
    try {
      let url = `/api/fazercards/proxy?endpoint=topups/offers&category_id=${categoryId}`;
      if (categoryId === 'telegram_stars') {
        url = `/api/fazercards/proxy?endpoint=telegram/stars`;
      } else if (categoryId === 'telegram_premium') {
        url = `/api/fazercards/proxy?endpoint=telegram/premium`;
      }

      const res = await fetch(url, {
        headers: { 'X-API-Key': fcApiKey }
      });
      const data = await res.json();
      
      if (data.ok) {
        if (categoryId === 'telegram_stars') {
          if (data.price_per_star) {
            const presetAmounts = [50, 100, 200, 250, 500, 750, 1000, 1500, 2000, 3000, 5000, 10000];
            const offers = presetAmounts.map(amount => ({
              offer_id: amount,
              name: `${amount} Stars`,
              price_usd: parseFloat(data.price_per_star) * amount
            }));
            setFcOffers(prev => ({ ...prev, [categoryId]: offers }));
          }
        } else if (categoryId === 'telegram_premium') {
          if (data.plans) {
            const offers = data.plans.map(p => ({
              offer_id: p.months,
              name: `${p.months} Months Premium`,
              price_usd: p.price_usd
            }));
            setFcOffers(prev => ({ ...prev, [categoryId]: offers }));
          }
        } else if (data.offers) {
          setFcOffers(prev => ({ ...prev, [categoryId]: data.offers }));
        }
      }
    } catch (e) {
      console.error("Error fetching offers for", categoryId, e);
    }
    setLoadingFcOffers(prev => ({ ...prev, [categoryId]: false }));
  };

  // Consultar Productos TiendaGiftVen
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
      setAlertModal({ type: 'error', message: 'Error de red al consultar productos' });
    }
    setLoading(false);
  };

  useEffect(() => {
    if (config?.tiendagiftven_api_key) {
      fetchSaldo(config.tiendagiftven_api_key);
      fetchProductos(config.tiendagiftven_api_key);
    }
    if (config?.fazercards_api_key) {
      fetchFcSaldo(config.fazercards_api_key);
      fetchFcProductos(config.fazercards_api_key);
    }
  }, [config?.tiendagiftven_api_key, config?.fazercards_api_key]);

  const handleSaveApi = async () => {
    if (!apiKey.trim()) {
      setAlertModal({ type: 'error', message: 'Debes ingresar una API Key' });
      return;
    }
    try {
      const res = await fetch('/api/tiendagiftven/proxy?endpoint=saldo', {
        headers: { 'X-API-Key': apiKey }
      });
      const data = await res.json();
      if (!data.ok) {
        setAlertModal({ type: 'error', message: 'API Key inválida' });
        return;
      }
      await updateConfig('tiendagiftven_api_key', apiKey, true);
      setAlertModal({ type: 'success', message: 'API Key guardada correctamente.' });
      fetchSaldo(apiKey);
      fetchProductos(apiKey);
    } catch (e) {
      setAlertModal({ type: 'error', message: 'Error de conexión con el proveedor' });
    }
  };

  const handleSaveFcApi = async () => {
    if (!fcApiKey.trim()) {
      setAlertModal({ type: 'error', message: 'Debes ingresar una API Key' });
      return;
    }
    try {
      const res = await fetch('/api/fazercards/proxy?endpoint=balance', {
        headers: { 'X-API-Key': fcApiKey }
      });
      const data = await res.json();
      if (!data.ok) {
        setAlertModal({ type: 'error', message: 'API Key inválida' });
        return;
      }
      await updateConfig('fazercards_api_key', fcApiKey, true);
      setAlertModal({ type: 'success', message: 'API Key de FazerCards guardada correctamente.' });
      fetchFcSaldo(fcApiKey);
      fetchFcProductos(fcApiKey);
    } catch (e) {
      setAlertModal({ type: 'error', message: 'Error de conexión con FazerCards' });
    }
  };

  if (perfil?.rol?.toLowerCase() !== 'admin' && perfil?.rol?.toLowerCase() !== 'administrador') {
    return <div style={{ padding: '20px' }}>Acceso denegado. Solo administradores.</div>;
  }

  return (
    <div className="dashboard-content" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '12px' }}>
        <button 
          onClick={() => setActiveTab('tiendagiftven')}
          style={{ 
            background: 'none', border: 'none', color: activeTab === 'tiendagiftven' ? '#00d2ff' : 'var(--text-muted)', 
            fontSize: '18px', fontWeight: activeTab === 'tiendagiftven' ? 800 : 500, cursor: 'pointer', padding: '8px 16px',
            borderBottom: activeTab === 'tiendagiftven' ? '2px solid #00d2ff' : '2px solid transparent'
          }}
        >
          TiendaGiftVen
        </button>
        <button 
          onClick={() => setActiveTab('fazercards')}
          style={{ 
            background: 'none', border: 'none', color: activeTab === 'fazercards' ? '#00d2ff' : 'var(--text-muted)', 
            fontSize: '18px', fontWeight: activeTab === 'fazercards' ? 800 : 500, cursor: 'pointer', padding: '8px 16px',
            borderBottom: activeTab === 'fazercards' ? '2px solid #00d2ff' : '2px solid transparent'
          }}
        >
          FazerCards
        </button>
      </div>

      {activeTab === 'tiendagiftven' && (
        <div className="fade-in">
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>📦 Proveedor: TiendaGiftVen</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
              Catálogo y configuración de conexión con la API de TiendaGiftVen.tech
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
            <div className="card">
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

            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', backgroundColor: 'rgba(0, 210, 255, 0.05)', border: '1px solid rgba(0, 210, 255, 0.1)' }}>
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>📚 Catálogo del Proveedor</h2>
            <input 
              type="text" 
              placeholder="🔍 Buscar juego o servicio..." 
              className="form-input" 
              style={{ maxWidth: '300px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              value={searchTermTGV}
              onChange={(e) => setSearchTermTGV(e.target.value)}
            />
          </div>

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
              {productos.filter(p => (p.nombre || '').toLowerCase().includes(searchTermTGV.toLowerCase()) || (p.categoria || '').toLowerCase().includes(searchTermTGV.toLowerCase())).map(prod => (
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
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'fazercards' && (
        <div className="fade-in">
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>📦 Proveedor: FazerCards</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
              Gestión de conexión y balance con la API de FazerCards
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
            <div className="card">
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>🔑 Credenciales API</h3>
              <div className="form-group">
                <label>API Key de tu cuenta FazerCards</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej: fc_3e0467ab3d02..."
                  value={fcApiKey}
                  onChange={(e) => setFcApiKey(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={handleSaveFcApi}>
                Guardar y Conectar
              </button>
              
              <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <strong>Webhook URL automático:</strong><br />
                {window.location.origin}/api/fazercards/webhook
              </div>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', backgroundColor: 'rgba(0, 210, 255, 0.05)', border: '1px solid rgba(0, 210, 255, 0.1)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Saldo Disponible (FazerCards)</h3>
              {loadingFcSaldo ? (
                <div style={{ fontSize: '32px', fontWeight: 800 }}>Cargando...</div>
              ) : fcSaldo !== null ? (
                <div style={{ fontSize: '42px', fontWeight: 900, color: '#fff', textShadow: '0 0 20px rgba(0, 210, 255, 0.4)' }}>
                  ${parseFloat(fcSaldo).toFixed(2)}
                </div>
              ) : (
                <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent-error)' }}>No conectado</div>
              )}
              <button className="btn btn-ghost btn-sm" style={{ marginTop: '12px' }} onClick={() => fetchFcSaldo()}>
                🔄 Actualizar
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>📚 Catálogo de FazerCards</h2>
            <input 
              type="text" 
              placeholder="🔍 Buscar juego o servicio..." 
              className="form-input" 
              style={{ maxWidth: '300px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              value={searchTermFC}
              onChange={(e) => setSearchTermFC(e.target.value)}
            />
          </div>

          {loadingFcProductos ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Cargando catálogo desde FazerCards...
            </div>
          ) : fcProductos.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}>
              No se pudieron cargar los servicios. Asegúrate de tener una API Key válida.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {fcProductos.filter(p => (p.name || '').toLowerCase().includes(searchTermFC.toLowerCase()) || (p.category_id || '').toLowerCase().includes(searchTermFC.toLowerCase())).map(prod => (
                <div key={prod.category_id} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{prod.name}</h4>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    Category ID: <strong>{prod.category_id}</strong>
                  </div>
                  <div style={{ fontSize: '13px', color: '#c8d6e8', marginBottom: '16px', flex: 1, whiteSpace: 'pre-wrap' }}>
                    {prod.note}
                  </div>
                  
                  <button 
                    className="btn btn-ghost btn-sm" 
                    style={{ width: '100%', marginTop: 'auto', border: '1px solid rgba(255,255,255,0.1)' }}
                    onClick={() => fetchFcOffers(prod.category_id)}
                  >
                    {expandedFcCategories[prod.category_id] ? 'Ocultar Precios' : 'Ver Productos y Precios'}
                  </button>

                  {expandedFcCategories[prod.category_id] && (
                    <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                      {loadingFcOffers[prod.category_id] ? (
                        <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>Cargando productos...</div>
                      ) : fcOffers[prod.category_id] && fcOffers[prod.category_id].length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {fcOffers[prod.category_id].map(offer => (
                            <div key={offer.offer_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '8px', flexWrap: 'wrap', gap: '8px' }}>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontSize: '13px', fontWeight: 600 }}>{offer.name}</span>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Offer ID: <strong>{offer.offer_id}</strong></span>
                              </div>
                              <span style={{ fontSize: '13px', color: 'var(--accent-primary)', fontWeight: 800 }}>${parseFloat(offer.price_usd).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>No se encontraron productos.</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
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
