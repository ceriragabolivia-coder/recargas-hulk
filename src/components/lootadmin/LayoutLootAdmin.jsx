import React, { useState } from 'react';
import { useAuth, useConfiguracion } from '../../hooks/useData';
import { Link } from 'react-router-dom';

const NAV_ITEMS = [
  { key: 'ventas', label: 'Dashboard', path: '/Dashboard', icon: '📊' },
  { key: 'pedidos', label: 'Órdenes', path: '/Gestion-Pedidos', icon: '📋' },
  { key: 'catalogo', label: 'Catálogo', path: '/Lista-De-Precios', icon: '🛍️' },
  { key: 'reportes', label: 'Reportes', path: '/Reportes', icon: '📈' },
  { key: 'productos', label: 'Stock Giftcards', path: '/Gestion-Productos', icon: '📦' },
  { key: 'usuarios', label: 'Usuarios', path: '/Usuarios', icon: '👥' },
  { key: 'config', label: 'Config. Financiera', path: '/Configuracion', icon: '💳' },
  { key: 'gestion_cupones', label: 'Cupones', path: '/Gestion-Cupones', icon: '🎟️' },
  { key: 'proveedor_tgv', label: 'Integración API', path: '/Proveedor-TiendaGiftVen', icon: '🔌' },
  { key: 'gestion_landing', label: 'Media', path: '/Gestion-Landing', icon: '🖼️' },
  { key: 'chats', label: 'Soporte Chat', path: '/Soporte', icon: '💬' },
  { key: 'interfaces_admin', label: 'Interfaces', path: '/Interfaces-Admin', icon: '🎨' },
];

export default function LayoutLootAdmin({ children, currentPage, onNavigate }) {
  const { user, perfil } = useAuth();
  const { config } = useConfiguracion();
  
  // The layout follows the LOOTADMIN screenshots.
  const handleNav = (e, key) => {
    e.preventDefault();
    if (onNavigate) {
      onNavigate(key);
    }
  };

  const getProfileName = () => {
    if (perfil?.nombre) return perfil.nombre;
    if (user?.email) return user.email.split('@')[0];
    return 'Admin';
  };

  const getAvatarUrl = () => {
    if (perfil?.foto_url) return perfil.foto_url;
    return 'https://ui-avatars.com/api/?name=' + getProfileName() + '&background=fce4e4&color=000';
  };

  return (
    <div className="lootadmin-theme">
      {/* Sidebar */}
      <aside className="loot-sidebar">
        <div className="loot-logo-container">
          {config?.sidebar_logo_url ? (
            <img src={config.sidebar_logo_url} alt="Logo" className="loot-logo-img" />
          ) : (
            <div className="loot-logo-img" style={{ background: 'var(--loot-primary)' }}></div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span className="loot-logo-text">{config?.sidebar_title || 'HULK'}</span>
            <span className="loot-logo-sub">PANEL OPERATIVO</span>
          </div>
        </div>

        <nav className="loot-nav">
          {NAV_ITEMS.map((item) => {
            const isActive = currentPage === item.key || (currentPage === 'gestion-pedidos' && item.key === 'pedidos');
            return (
              <button 
                key={item.key} 
                className={`loot-nav-item ${isActive ? 'active' : ''}`}
                onClick={(e) => handleNav(e, item.key)}
              >
                <span className="loot-nav-icon">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>

        <div style={{ padding: '20px' }}>
          <button 
            className="loot-nav-item" 
            style={{ justifyContent: 'center', backgroundColor: 'var(--loot-card-bg)', border: '1px solid var(--loot-border)' }}
            onClick={(e) => handleNav(e, 'catalogo')}
          >
            <span className="loot-nav-icon">🏠</span>
            Volver a la Tienda
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="loot-main">
        {/* Topbar */}
        <header className="loot-topbar">
          <div className="loot-pill accent">
            <span style={{ fontSize: '14px' }}>🪙</span> TIENDA GIFTVEN <span className="loot-pill-val">$0.00</span>
          </div>
          
          <div className="loot-icon-btn" onClick={(e) => handleNav(e, 'chats')}>
            <span style={{ fontSize: '18px' }}>🔔</span>
            <div className="loot-badge">1</div>
          </div>
          
          <div className="loot-pill" style={{ cursor: 'pointer' }} onClick={(e) => handleNav(e, 'chats')}>
            <span style={{ fontSize: '14px' }}>💬</span> SOPORTE
          </div>
          
          <div className="loot-profile" style={{ cursor: 'pointer' }} onClick={(e) => handleNav(e, 'perfil')}>
            <div className="loot-profile-info">
              <span className="loot-profile-name">{getProfileName()}</span>
              <span className="loot-profile-role">{user?.email || 'admin@admin.com'}</span>
            </div>
            <div className="loot-profile-avatar" style={{ backgroundImage: `url(${getAvatarUrl()})` }}>
              <div className="loot-status-dot"></div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        {children}
      </main>
    </div>
  );
}
