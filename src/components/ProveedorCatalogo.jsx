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
  const [searchTermPC, setSearchTermPC] = useState('');

  // PinCentral state
  const [pcApiKey, setPcApiKey] = useState('');
  const [pcApiSecret, setPcApiSecret] = useState('');
  const [pcSaldo, setPcSaldo] = useState(null);
  const [loadingPcSaldo, setLoadingPcSaldo] = useState(false);
  const [pcProductos, setPcProductos] = useState([]);
  const [loadingPcProductos, setLoadingPcProductos] = useState(false);

  // Central One state
  const [coSaldo, setCoSaldo] = useState(null);
  const [loadingCoSaldo, setLoadingCoSaldo] = useState(false);
  const [coProductos, setCoProductos] = useState([]);
  const [loadingCoProductos, setLoadingCoProductos] = useState(false);
  const [searchTermCO, setSearchTermCO] = useState('');

  // Xanler state
  const [xanlerApiKey, setXanlerApiKey] = useState('');
  const [xanlerApiSecret, setXanlerApiSecret] = useState('');
  const [xanlerSaldo, setXanlerSaldo] = useState(null);
  const [xanlerUsername, setXanlerUsername] = useState('');
  const [loadingXanlerSaldo, setLoadingXanlerSaldo] = useState(false);
  const [xanlerProductos, setXanlerProductos] = useState([]);
  const [loadingXanlerProductos, setLoadingXanlerProductos] = useState(false);
  const [xanlerItems, setXanlerItems] = useState({});
  const [loadingXanlerItems, setLoadingXanlerItems] = useState({});
  const [expandedXanlerProducts, setExpandedXanlerProducts] = useState({});
  const [searchTermXanler, setSearchTermXanler] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  const handleCopy = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(String(text));
    setCopiedId(String(text));
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Cargar API Key inicial
  useEffect(() => {
    if (config?.tiendagiftven_api_key) {
      setApiKey(config.tiendagiftven_api_key);
    }
    if (config?.fazercards_api_key) {
      setFcApiKey(config.fazercards_api_key);
    }
    if (config?.pincentral_api_key) {
      setPcApiKey(config.pincentral_api_key);
    }
    if (config?.pincentral_api_secret) {
      setPcApiSecret(config.pincentral_api_secret);
    }
    if (config?.xanler_api_key) {
      setXanlerApiKey(config.xanler_api_key);
    }
    if (config?.xanler_api_secret) {
      setXanlerApiSecret(config.xanler_api_secret);
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
      // Helper para hacer fetch con paginación
      const fetchAllPages = async (endpoint) => {
        let all = [];
        let cursor = null;
        while (true) {
          let url = `/api/fazercards/proxy?endpoint=${endpoint}&limit=500`;
          if (cursor) url += `&cursor=${cursor}`;
          const res = await fetch(url, { headers: { 'X-API-Key': keyToUse } });
          const data = await res.json();
          if (data.ok && data.items) {
            all = all.concat(data.items);
          } else {
             break; // Si falla, salir del loop con lo que tengamos
          }
          if (!data.meta || !data.meta.has_more || !data.meta.next_cursor) break;
          cursor = data.meta.next_cursor;
        }
        return all;
      };

      const topupItems = await fetchAllPages('topups');
      let allItems = [...topupItems];
      
      // Consultar Gift Cards
      try {
        const gcItemsRaw = await fetchAllPages('giftcards');
        const gcItems = gcItemsRaw.map(item => ({
          ...item,
          category_id: `giftcard:${item.category_id}`,
          name: `[Gift Card] ${item.name}`
        }));
        allItems = [...allItems, ...gcItems];
      } catch (e) {
        console.error("Error fetching giftcards", e);
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

      if (allItems.length <= 2 && fcApiKey) {
        setAlertModal({ type: 'warning', message: 'No se encontraron productos o hubo un problema de conexión parcial con FazerCards.' });
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
      let isGiftcard = false;
      let actualCategoryId = categoryId;
      
      if (categoryId === 'telegram_stars') {
        url = `/api/fazercards/proxy?endpoint=telegram/stars`;
      } else if (categoryId === 'telegram_premium') {
        url = `/api/fazercards/proxy?endpoint=telegram/premium`;
      } else if (categoryId.startsWith('giftcard:')) {
        isGiftcard = true;
        actualCategoryId = categoryId.replace('giftcard:', '');
        url = `/api/fazercards/proxy?endpoint=giftcards/cards&category_id=${actualCategoryId}`;
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
        } else if (isGiftcard && data.offers) {
           const offers = data.offers.map(o => ({
             offer_id: o.card_id,
             name: o.name,
             price_usd: o.price_usd
           }));
           setFcOffers(prev => ({ ...prev, [categoryId]: offers }));
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

  // Consultar Saldo PinCentral
  const fetchPcSaldo = async () => {
    if (!pcApiKey || !pcApiSecret) return;
    setLoadingPcSaldo(true);
    try {
      const res = await fetch('/api/pincentral/proxy?endpoint=account');
      const data = await res.json();
      if (!data.error && data.balance) {
        setPcSaldo(data.balance);
      } else {
        setPcSaldo(null);
      }
    } catch (e) {
      setPcSaldo(null);
    }
    setLoadingPcSaldo(false);
  };

  // Consultar Productos PinCentral
  const fetchPcProductos = async () => {
    if (!pcApiKey || !pcApiSecret) return;
    setLoadingPcProductos(true);
    try {
      const res = await fetch('/api/pincentral/proxy?endpoint=products');
      const data = await res.json();
      if (Array.isArray(data)) {
        setPcProductos(data);
      } else {
        setAlertModal({ type: 'error', message: data.error || 'Error obteniendo productos de PinCentral' });
      }
    } catch (e) {
      setAlertModal({ type: 'error', message: 'Error de red al consultar productos PinCentral' });
    }
    setLoadingPcProductos(false);
  };

  // Consultar Saldo Central One
  const fetchCoSaldo = async () => {
    setLoadingCoSaldo(true);
    try {
      const res = await fetch('/api/centralone/proxy?endpoint=saldo');
      const data = await res.json();
      if (data.ok && data.saldo !== undefined) {
        setCoSaldo(data.saldo);
      } else {
        setCoSaldo(null);
      }
    } catch (e) {
      setCoSaldo(null);
    }
    setLoadingCoSaldo(false);
  };

  // Consultar Productos Central One
  const fetchCoProductos = async () => {
    setLoadingCoProductos(true);
    try {
      const res = await fetch('/api/centralone/proxy?endpoint=productos');
      const data = await res.json();
      if (data.ok && data.productos) {
        setCoProductos(data.productos);
      } else {
        setAlertModal({ type: 'error', message: data.error || 'Error obteniendo productos de Central One' });
      }
    } catch (e) {
      setAlertModal({ type: 'error', message: 'Error de red al consultar productos Central One' });
    }
    setLoadingCoProductos(false);
  };

  // Consultar Saldo Xanler
  const fetchXanlerSaldo = async (keyToUse = xanlerApiKey, secretToUse = xanlerApiSecret) => {
    if (!keyToUse || !secretToUse) return;
    setLoadingXanlerSaldo(true);
    try {
      const res = await fetch('/api/xanler/proxy?endpoint=profile', {
        headers: {
          'X-API-Key': keyToUse,
          'X-API-Secret': secretToUse
        }
      });
      const data = await res.json();
      if (data.ok && data.saldo !== undefined) {
        setXanlerSaldo(data.saldo);
        setXanlerUsername(data.username || '');
      } else {
        setXanlerSaldo(null);
        setXanlerUsername('');
      }
    } catch (e) {
      setXanlerSaldo(null);
      setXanlerUsername('');
    }
    setLoadingXanlerSaldo(false);
  };

  // Consultar Productos Xanler
  const fetchXanlerProductos = async (keyToUse = xanlerApiKey, secretToUse = xanlerApiSecret) => {
    if (!keyToUse || !secretToUse) return;
    setLoadingXanlerProductos(true);
    try {
      const res = await fetch('/api/xanler/proxy?endpoint=product', {
        headers: {
          'X-API-Key': keyToUse,
          'X-API-Secret': secretToUse
        }
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.productos)) {
        setXanlerProductos(data.productos);
      } else {
        setXanlerProductos([]);
        if (data.error) {
          setAlertModal({ type: 'error', message: data.error });
        }
      }
    } catch (e) {
      setAlertModal({ type: 'error', message: 'Error de red al consultar productos de Xanler' });
    }
    setLoadingXanlerProductos(false);
  };

  // Consultar Items de un Producto de Xanler
  const fetchXanlerItems = async (productId, forceExpand = null) => {
    // Toggle o forzar expansión
    setExpandedXanlerProducts(prev => ({
      ...prev,
      [productId]: forceExpand !== null ? forceExpand : !prev[productId]
    }));

    if (xanlerItems[productId]) return;

    setLoadingXanlerItems(prev => ({ ...prev, [productId]: true }));
    try {
      const keyToUse = (xanlerApiKey || config?.xanler_api_key || '').trim();
      const secretToUse = (xanlerApiSecret || config?.xanler_api_secret || '').trim();

      const res = await fetch(`/api/xanler/proxy?endpoint=item&id=${productId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': keyToUse,
          'X-API-Secret': secretToUse
        },
        body: JSON.stringify({ id: productId })
      });
      const data = await res.json();
      if (data.ok && data.items) {
        setXanlerItems(prev => ({ ...prev, [productId]: data.items }));
      } else {
        setAlertModal({ type: 'error', message: data.error || 'No se pudieron obtener items para este producto' });
      }
    } catch (e) {
      console.error('Error fetching Xanler items:', e);
      setAlertModal({ type: 'error', message: 'Error al consultar items de Xanler: ' + e.message });
    }
    setLoadingXanlerItems(prev => ({ ...prev, [productId]: false }));
  };

  const handleToggleExpandAllXanler = async () => {
    const anyClosed = xanlerProductos.some(p => !expandedXanlerProducts[p.id]);
    const newState = anyClosed;
    const newExpanded = {};
    xanlerProductos.forEach(p => {
      newExpanded[p.id] = newState;
    });
    setExpandedXanlerProducts(newExpanded);

    if (newState) {
      for (const prod of xanlerProductos) {
        if (!xanlerItems[prod.id]) {
          fetchXanlerItems(prod.id, true);
        }
      }
    }
  };

  const handleSaveXanlerApi = async () => {
    if (!xanlerApiKey.trim() || !xanlerApiSecret.trim()) {
      setAlertModal({ type: 'error', message: 'Debes ingresar API Key y API Secret de Xanler' });
      return;
    }
    try {
      const res = await fetch('/api/xanler/proxy?endpoint=profile', {
        headers: {
          'X-API-Key': xanlerApiKey.trim(),
          'X-API-Secret': xanlerApiSecret.trim()
        }
      });
      const data = await res.json();
      if (!data.ok) {
        setAlertModal({ type: 'error', message: data.error || 'Credenciales de Xanler inválidas o error de conexión' });
        return;
      }
      await updateConfig('xanler_api_key', xanlerApiKey.trim(), true);
      await updateConfig('xanler_api_secret', xanlerApiSecret.trim(), true);
      setAlertModal({ type: 'success', message: `¡Conexión exitosa con Xanler! ${data.username ? `Usuario: ${data.username}` : ''}` });
      fetchXanlerSaldo(xanlerApiKey.trim(), xanlerApiSecret.trim());
      fetchXanlerProductos(xanlerApiKey.trim(), xanlerApiSecret.trim());
    } catch (e) {
      setAlertModal({ type: 'error', message: 'Error de conexión con Xanler: ' + e.message });
    }
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
    if (config?.pincentral_api_key && config?.pincentral_api_secret) {
      fetchPcSaldo();
      fetchPcProductos();
    }
    
    // Central One no necesita key manual
    fetchCoSaldo();
    fetchCoProductos();

    if (config?.xanler_api_key && config?.xanler_api_secret) {
      fetchXanlerSaldo(config.xanler_api_key, config.xanler_api_secret);
      fetchXanlerProductos(config.xanler_api_key, config.xanler_api_secret);
    }
  }, [config?.tiendagiftven_api_key, config?.fazercards_api_key, config?.pincentral_api_key, config?.pincentral_api_secret, config?.xanler_api_key, config?.xanler_api_secret]);

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

  const handleSavePcApi = async () => {
    if (!pcApiKey.trim() || !pcApiSecret.trim()) {
      setAlertModal({ type: 'error', message: 'Debes ingresar API Key y API Secret' });
      return;
    }
    try {
      // Intentar una llamada rápida de prueba, el proxy usa la DB pero 
      // para forzar el guardado guardaremos y luego llamaremos.
      await updateConfig('pincentral_api_key', pcApiKey, true);
      await updateConfig('pincentral_api_secret', pcApiSecret, true);
      setAlertModal({ type: 'success', message: 'Credenciales de PinCentral guardadas correctamente.' });
      setTimeout(() => {
        fetchPcSaldo();
        fetchPcProductos();
      }, 1000); // Esperar que la DB propague
    } catch (e) {
      setAlertModal({ type: 'error', message: 'Error guardando credenciales de PinCentral' });
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
        <button 
          onClick={() => setActiveTab('pincentral')}
          style={{ 
            background: 'none', border: 'none', color: activeTab === 'pincentral' ? '#00d2ff' : 'var(--text-muted)', 
            fontSize: '18px', fontWeight: activeTab === 'pincentral' ? 800 : 500, cursor: 'pointer', padding: '8px 16px',
            borderBottom: activeTab === 'pincentral' ? '2px solid #00d2ff' : '2px solid transparent'
          }}
        >
          PinCentral
        </button>
        <button 
          onClick={() => setActiveTab('centralone')}
          style={{ 
            background: 'none', border: 'none', color: activeTab === 'centralone' ? '#00d2ff' : 'var(--text-muted)', 
            fontSize: '18px', fontWeight: activeTab === 'centralone' ? 800 : 500, cursor: 'pointer', padding: '8px 16px',
            borderBottom: activeTab === 'centralone' ? '2px solid #00d2ff' : '2px solid transparent'
          }}
        >
          Central One
        </button>
        <button 
          onClick={() => setActiveTab('xanler')}
          style={{ 
            background: 'none', border: 'none', color: activeTab === 'xanler' ? '#00d2ff' : 'var(--text-muted)', 
            fontSize: '18px', fontWeight: activeTab === 'xanler' ? 800 : 500, cursor: 'pointer', padding: '8px 16px',
            borderBottom: activeTab === 'xanler' ? '2px solid #00d2ff' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: '6px'
          }}
        >
          <span>⚡ Xanler</span>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>📚 Catálogo de FazerCards</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => fetchFcProductos()} disabled={loadingFcProductos}>
                🔄 Recargar Catálogo
              </button>
            </div>
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

      {activeTab === 'pincentral' && (
        <div className="fade-in">
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>📦 Proveedor: PinCentral</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
              Catálogo y configuración de conexión con la API de PinCentral
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
            <div className="card">
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>🔑 Credenciales API</h3>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>API Key</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej: f4a8a5b2..."
                  value={pcApiKey}
                  onChange={(e) => setPcApiKey(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>API Secret</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej: xxxxxxxx"
                  value={pcApiSecret}
                  onChange={(e) => setPcApiSecret(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={handleSavePcApi}>
                Guardar y Conectar
              </button>
              
              <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>
                <strong>Webhook URL automático:</strong><br />
                {window.location.origin}/api/pincentral/webhook
              </div>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', backgroundColor: 'rgba(0, 210, 255, 0.05)', border: '1px solid rgba(0, 210, 255, 0.1)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Saldo Disponible (PinCentral)</h3>
              {loadingPcSaldo ? (
                <div style={{ fontSize: '32px', fontWeight: 800 }}>Cargando...</div>
              ) : pcSaldo !== null ? (
                <div style={{ fontSize: '42px', fontWeight: 900, color: '#fff', textShadow: '0 0 20px rgba(0, 210, 255, 0.4)' }}>
                  {pcSaldo}
                </div>
              ) : (
                <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent-error)' }}>No conectado</div>
              )}
              <button className="btn btn-ghost btn-sm" style={{ marginTop: '12px' }} onClick={() => fetchPcSaldo()}>
                🔄 Actualizar
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>📚 Catálogo de PinCentral</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => fetchPcProductos()} disabled={loadingPcProductos}>
                🔄 Recargar Catálogo
              </button>
            </div>
            <input 
              type="text" 
              placeholder="🔍 Buscar juego o servicio..." 
              className="form-input" 
              style={{ maxWidth: '300px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              value={searchTermPC}
              onChange={(e) => setSearchTermPC(e.target.value)}
            />
          </div>

          {loadingPcProductos ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Cargando catálogo desde PinCentral...
            </div>
          ) : pcProductos.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}>
              No se pudieron cargar los servicios. Asegúrate de tener Credenciales API válidas.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {pcProductos.filter(p => (p.name || '').toLowerCase().includes(searchTermPC.toLowerCase()) || (p.code || '').toLowerCase().includes(searchTermPC.toLowerCase()) || (p.product_group || '').toLowerCase().includes(searchTermPC.toLowerCase())).map(prod => (
                <div key={prod.code} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{prod.name}</h4>
                    <div style={{ backgroundColor: 'rgba(0, 210, 255, 0.1)', color: 'var(--accent-primary)', padding: '4px 8px', borderRadius: '8px', fontSize: '14px', fontWeight: 800 }}>
                      ${parseFloat(prod.price).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    ID Proveedor: <strong>{prod.code}</strong> | {prod.product_group}
                  </div>
                  <div style={{ fontSize: '13px', color: '#c8d6e8', flex: 1, whiteSpace: 'pre-wrap' }}>
                    Tipo: {prod.type === 'recharge' ? 'Recarga Directa' : 'PIN/Código'}
                    <br />
                    {prod.required_fields && prod.required_fields.length > 0 && (
                      <span>Campos extra: {prod.required_fields.join(', ')}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'centralone' && (
        <div className="fade-in">
          <div style={{ marginBottom: '24px' }}>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>📦 Proveedor: Central One</h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
              La API Key está protegida en tu servidor (Vercel). Puedes ver el saldo y catálogo aquí de forma segura.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', backgroundColor: 'rgba(0, 210, 255, 0.05)', border: '1px solid rgba(0, 210, 255, 0.1)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Saldo Disponible (Central One)</h3>
              {loadingCoSaldo ? (
                <div style={{ fontSize: '32px', fontWeight: 800 }}>Cargando...</div>
              ) : coSaldo !== null ? (
                <div style={{ fontSize: '42px', fontWeight: 900, color: '#fff', textShadow: '0 0 20px rgba(0, 210, 255, 0.4)' }}>
                  ${parseFloat(coSaldo).toFixed(2)}
                </div>
              ) : (
                <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent-error)' }}>No conectado o Error</div>
              )}
              <button className="btn btn-ghost btn-sm" style={{ marginTop: '12px' }} onClick={() => fetchCoSaldo()}>
                🔄 Actualizar Saldo
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>📚 Catálogo de Central One</h2>
              <button className="btn btn-ghost btn-sm" onClick={() => fetchCoProductos()} disabled={loadingCoProductos}>
                🔄 Recargar Catálogo
              </button>
            </div>
            <input 
              type="text" 
              placeholder="🔍 Buscar juego o servicio..." 
              className="form-input" 
              style={{ maxWidth: '300px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              value={searchTermCO}
              onChange={(e) => setSearchTermCO(e.target.value)}
            />
          </div>

          {loadingCoProductos ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Cargando catálogo de Central One...
            </div>
          ) : coProductos.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}>
              No se pudieron cargar los productos. Asegúrate de tener la variable CENTRAL_ONE_API_KEY en Vercel.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
              {coProductos.filter(p => (p.name || '').toLowerCase().includes(searchTermCO.toLowerCase()) || (p.product_id || '').toLowerCase().includes(searchTermCO.toLowerCase()) || (p.product_family_name || '').toLowerCase().includes(searchTermCO.toLowerCase())).map(prod => (
                <div key={prod.product_id} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                    <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{prod.name}</h4>
                    <div style={{ backgroundColor: 'rgba(0, 210, 255, 0.1)', color: 'var(--accent-primary)', padding: '4px 8px', borderRadius: '8px', fontSize: '14px', fontWeight: 800 }}>
                      ${parseFloat(prod.reseller_price).toFixed(2)}
                    </div>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                    ID Proveedor (product_id): <strong>{prod.product_id}</strong> | Categoría: {prod.product_family_name || 'Desconocida'}
                  </div>
                  <div style={{ fontSize: '13px', color: '#c8d6e8', flex: 1, whiteSpace: 'pre-wrap' }}>
                    Requiere campos extra: {prod.requires_target ? `Sí (${(prod.target_fields || []).join(', ')})` : 'No'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'xanler' && (
        <div className="fade-in">
          <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 800 }}>⚡ Proveedor: Xanler</h1>
              <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>
                Catálogo y configuración de conexión con la API de Xanler (Host to Host)
              </p>
            </div>
            <a 
              href="https://docs.xanler.com/" 
              target="_blank" 
              rel="noreferrer"
              className="btn btn-ghost btn-sm"
              style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#00d2ff' }}
            >
              📖 Ver Documentación Oficial
            </a>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '32px' }}>
            <div className="card">
              <h3 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px' }}>🔑 Credenciales API</h3>
              <div className="form-group" style={{ marginBottom: '12px' }}>
                <label>API Key de tu cuenta Xanler</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Ej: xanler_key_..."
                  value={xanlerApiKey}
                  onChange={(e) => setXanlerApiKey(e.target.value)}
                />
              </div>
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label>API Secret de tu cuenta Xanler</label>
                <input 
                  type="password" 
                  className="form-input" 
                  placeholder="Ej: xanler_secret_..."
                  value={xanlerApiSecret}
                  onChange={(e) => setXanlerApiSecret(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={handleSaveXanlerApi}>
                Guardar y Conectar
              </button>
              
              <div style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                <div style={{ marginBottom: '12px', padding: '10px 12px', backgroundColor: 'rgba(0, 210, 255, 0.08)', borderRadius: '8px', border: '1px solid rgba(0, 210, 255, 0.2)' }}>
                  <strong style={{ color: '#00d2ff', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    🔗 URL Callback / Webhook:
                  </strong>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <code style={{ color: '#fff', fontSize: '11px', wordBreak: 'break-all', flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {window.location.origin}/api/xanler/webhook
                    </code>
                    <button 
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '4px 10px', fontSize: '11px', border: '1px solid rgba(0, 210, 255, 0.3)', whiteSpace: 'nowrap' }}
                      onClick={() => handleCopy(`${window.location.origin}/api/xanler/webhook`)}
                      type="button"
                    >
                      {copiedId === `${window.location.origin}/api/xanler/webhook` ? '✅ Copiado' : '📋 Copiar'}
                    </button>
                  </div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', display: 'block', marginTop: '6px' }}>
                    Envía esta URL al soporte de Xanler (WhatsApp) para recibir las confirmaciones automáticas de pedidos.
                  </span>
                </div>

                <strong>Endpoint URL base:</strong><br />
                <code style={{ color: '#00d2ff', fontSize: '11px' }}>https://xanler.com/api/v1/{'{action}'}</code>
                <br />
                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                  Autenticación vía headers <code>API-KEY</code> y <code>API-SECRET</code>.
                </span>
              </div>
            </div>

            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', backgroundColor: 'rgba(0, 210, 255, 0.05)', border: '1px solid rgba(0, 210, 255, 0.1)' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>Saldo Disponible (Xanler)</h3>
              {loadingXanlerSaldo ? (
                <div style={{ fontSize: '32px', fontWeight: 800 }}>Cargando...</div>
              ) : xanlerSaldo !== null ? (
                <>
                  <div style={{ fontSize: '42px', fontWeight: 900, color: '#fff', textShadow: '0 0 20px rgba(0, 210, 255, 0.4)' }}>
                    ${parseFloat(xanlerSaldo).toFixed(2)}
                  </div>
                  {xanlerUsername && (
                    <div style={{ fontSize: '13px', color: 'var(--accent-primary)', marginTop: '4px', fontWeight: 600 }}>
                      👤 Usuario: {xanlerUsername}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--accent-error)' }}>No conectado</div>
              )}
              <button 
                className="btn btn-ghost btn-sm" 
                style={{ marginTop: '12px' }} 
                onClick={() => fetchXanlerSaldo()}
                disabled={loadingXanlerSaldo}
              >
                🔄 Actualizar Saldo
              </button>
            </div>
          </div>

          {/* Banner de Guía Rápida */}
          <div style={{ 
            marginBottom: '24px', 
            padding: '16px 20px', 
            backgroundColor: 'rgba(251, 191, 36, 0.08)', 
            border: '1px solid rgba(251, 191, 36, 0.25)', 
            borderRadius: '12px',
            fontSize: '13px',
            lineHeight: '1.6'
          }}>
            <div style={{ fontWeight: 800, color: '#fbbf24', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>💡 ¿Cómo vincular productos de Xanler en Ceriraga?</span>
            </div>
            <ol style={{ margin: 0, paddingLeft: '20px', color: '#e2e8f0' }}>
              <li>
                <strong>Paso 1:</strong> En <em>Gestión de Productos → Juego</em>, activa <strong>⚡ Auto-procesar con API</strong> y selecciona <strong>Xanler</strong> como proveedor.
              </li>
              <li>
                <strong>Paso 2:</strong> Copia el <strong>Product ID</strong> del juego que ves abajo (ej: <code>3</code> para Mobile Legends) y pégalo en <strong>Category ID del Proveedor API</strong> del juego.
              </li>
              <li>
                <strong>Paso 3:</strong> En cada paquete de ese juego, haz clic en <em>"Ver Items y Precios"</em>, copia el <strong>Item ID</strong> (ej: <code>181</code>) y pégalo en <strong>ID Producto Proveedor</strong>. ¡El costo se sincronizará automáticamente!
              </li>
            </ol>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '20px', fontWeight: 800, margin: 0 }}>📚 Catálogo de Productos Xanler</h2>
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={() => fetchXanlerProductos()} 
                disabled={loadingXanlerProductos}
              >
                🔄 Recargar Catálogo
              </button>
              <button 
                className="btn btn-primary btn-sm" 
                onClick={handleToggleExpandAllXanler}
                disabled={loadingXanlerProductos || xanlerProductos.length === 0}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              >
                👁️ {xanlerProductos.some(p => !expandedXanlerProducts[p.id]) ? 'Ver Todos los Precios' : 'Contraer Todos'}
              </button>
            </div>
            <input 
              type="text" 
              placeholder="🔍 Buscar juego o publisher en Xanler..." 
              className="form-input" 
              style={{ maxWidth: '320px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
              value={searchTermXanler}
              onChange={(e) => setSearchTermXanler(e.target.value)}
            />
          </div>

          {loadingXanlerProductos ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Cargando catálogo desde la API de Xanler...
            </div>
          ) : xanlerProductos.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '16px', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}>
              No se pudieron cargar los productos. Asegúrate de haber guardado las credenciales de Xanler (API Key y Secret).
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '16px' }}>
              {xanlerProductos
                .filter(p => 
                  (p.product || '').toLowerCase().includes(searchTermXanler.toLowerCase()) || 
                  (p.sub_title || '').toLowerCase().includes(searchTermXanler.toLowerCase()) ||
                  String(p.id).includes(searchTermXanler)
                )
                .map(prod => (
                  <div key={prod.id} className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '16px', fontWeight: 700 }}>{prod.product}</h4>
                      {xanlerItems[prod.id]?.length > 0 ? (
                        <span style={{ fontSize: '11px', color: '#00d2ff', backgroundColor: 'rgba(0, 210, 255, 0.1)', padding: '2px 8px', borderRadius: '6px', fontWeight: 700 }}>
                          {xanlerItems[prod.id].length} items (desde ${Math.min(...xanlerItems[prod.id].map(i => parseFloat(i.price) || 0)).toFixed(2)})
                        </span>
                      ) : prod.sub_title ? (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', backgroundColor: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '6px' }}>
                          {prod.sub_title}
                        </span>
                      ) : null}
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px', backgroundColor: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '8px' }}>
                      <span>Product ID (Category ID): <strong style={{ color: '#00d2ff', fontSize: '13px' }}>{prod.id}</strong></span>
                      <button 
                        className="btn btn-ghost btn-sm" 
                        style={{ padding: '2px 8px', fontSize: '11px' }}
                        onClick={() => handleCopy(prod.id)}
                        title="Copiar Category ID para el Juego"
                      >
                        {copiedId === String(prod.id) ? '✅ Copiado' : '📋 Copiar'}
                      </button>
                    </div>

                    <button 
                      className={`btn ${expandedXanlerProducts[prod.id] ? 'btn-ghost' : 'btn-primary'} btn-sm`} 
                      style={{ width: '100%', marginTop: 'auto', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', fontWeight: 700 }}
                      onClick={() => fetchXanlerItems(prod.id)}
                    >
                      {loadingXanlerItems[prod.id] ? '⏳ Cargando Precios...' : expandedXanlerProducts[prod.id] ? '🔼 Ocultar Precios' : '💰 Ver Paquetes y Precios'}
                    </button>

                    {expandedXanlerProducts[prod.id] && (
                      <div style={{ marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '16px' }}>
                        {loadingXanlerItems[prod.id] ? (
                          <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', padding: '12px' }}>
                            Cargando items de Xanler...
                          </div>
                        ) : xanlerItems[prod.id] && xanlerItems[prod.id].length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '350px', overflowY: 'auto', paddingRight: '4px' }}>
                            {xanlerItems[prod.id].map(it => (
                              <div 
                                key={it.id} 
                                style={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  alignItems: 'center', 
                                  backgroundColor: 'rgba(0,0,0,0.25)', 
                                  padding: '8px 12px', 
                                  borderRadius: '8px', 
                                  gap: '8px' 
                                }}
                              >
                                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span style={{ fontSize: '13px', fontWeight: 600 }}>{it.item}</span>
                                    <span style={{ 
                                      fontSize: '10px', 
                                      padding: '1px 6px', 
                                      borderRadius: '4px',
                                      fontWeight: 700,
                                      backgroundColor: it.status?.toLowerCase() === 'ready' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                      color: it.status?.toLowerCase() === 'ready' ? '#4ade80' : '#f87171'
                                    }}>
                                      {it.status}
                                    </span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                      Item ID: <strong style={{ color: '#fbbf24' }}>{it.id}</strong>
                                    </span>
                                    <button 
                                      onClick={() => handleCopy(it.id)}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '11px', color: '#00d2ff', padding: '0 4px' }}
                                      title="Copiar Item ID para el producto"
                                    >
                                      {copiedId === String(it.id) ? '✅' : '📋'}
                                    </button>
                                  </div>
                                </div>
                                <span style={{ fontSize: '13px', color: 'var(--accent-primary)', fontWeight: 800, whiteSpace: 'nowrap' }}>
                                  ${parseFloat(it.price).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', padding: '12px' }}>
                            No se encontraron items disponibles para este producto.
                          </div>
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
