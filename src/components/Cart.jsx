import React from 'react'
import { useCart, useAuth } from '../hooks/useData'
import { formatUSD, formatBs } from '../utils/helpers'
import { useLocation } from 'react-router-dom'

export default function Cart({ onGoToCheckout }) {
  const { 
    cart, 
    removeFromCart, 
    updateQuantity, 
    clearCart,
    totalItems, 
    totalUSD, 
    totalBs,
    isCartOpen: isOpen,
    setIsCartOpen: setIsOpen
  } = useCart()
  const { perfil, isCliente } = useAuth()
  const location = useLocation()

  const isCheckoutPage = location.pathname.toLowerCase() === '/checkout'

  const handleGoToCheckout = () => {
    setIsOpen(false)
    onGoToCheckout()
  }

  if (isCheckoutPage || (cart.length === 0 && !isOpen)) return null

  return (
    <div style={{ 
      position: 'fixed', 
      bottom: '24px', 
      right: '24px', 
      zIndex: 9990, 
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-end',
      gap: '16px'
    }}>
      {/* Ventana del Carrito */}
      {isOpen && (
        <div className="card cart-popup" style={{ 
          width: '400px', 
          maxWidth: 'calc(100vw - 48px)', 
          maxHeight: '70vh', 
          display: 'flex', 
          flexDirection: 'column', 
          boxShadow: '0 20px 80px rgba(0,0,0,0.8)', 
          animation: 'slideUp 0.3s ease-out',
          border: '1px solid var(--border-color)',
          borderRadius: '24px',
          overflow: 'hidden'
        }}>
          <div className="card-header" style={{ padding: '20px 24px', backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="card-title" style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>🛒 Tu Pedido</h2>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setIsOpen(false)}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', minHeight: '100px' }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>El carrito está vacío.</div>
            ) : (
              cart.map(item => (
                <div key={item.cart_id || item.id} style={{ 
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', 
                  backgroundColor: 'var(--bg-panel)', borderRadius: '12px', border: '1px solid var(--border-color)' 
                }}>
                  <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', backgroundColor: 'var(--bg-card)', flexShrink: 0 }}>
                    {item.icono_url ? <img src={item.icono_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : '📦'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{item.nombre}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{item.juego}</div>
                    
                    <div style={{ marginTop: '6px', fontSize: '11px', padding: '6px', backgroundColor: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {item.metodo_recarga === 'solo_correo' ? (
                        <>
                          <div style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Correo:</span> <span style={{ fontFamily: 'monospace' }}>{item.account_email || 'No proporcionado'}</span></div>
                        </>
                      ) : item.metodo_recarga === 'solo_usuario' ? (
                        <>
                          <div style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Usuario:</span> <span style={{ fontFamily: 'monospace' }}>{item.account_user || 'No proporcionado'}</span></div>
                        </>
                      ) : item.metodo_recarga === 'cuenta_completa' ? (
                        <>
                          <div style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Correo:</span> <span style={{ fontFamily: 'monospace' }}>{item.account_email || 'No proporcionado'}</span></div>
                          <div style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Clave:</span> <span style={{ fontFamily: 'monospace' }}>{item.account_password || 'No proporcionada'}</span></div>
                        </>
                      ) : item.metodo_recarga === 'usuario_clave' ? (
                        <>
                          <div style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Usuario:</span> <span style={{ fontFamily: 'monospace' }}>{item.account_user || 'No proporcionado'}</span></div>
                          <div style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>Clave:</span> <span style={{ fontFamily: 'monospace' }}>{item.account_password || 'No proporcionada'}</span></div>
                        </>
                      ) : (
                        <div style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>ID Jugador:</span> <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{item.player_id || 'No proporcionado'}</span></div>
                      )}
                    </div>

                    <div style={{ fontSize: '13px', color: 'var(--accent-success)', fontWeight: 600, marginTop: 4 }}>{formatBs(item.venta_bs)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input 
                      type="number" 
                      min="1" 
                      className="form-input" 
                      style={{ width: '45px', textAlign: 'center', height: '32px', padding: 0 }}
                      value={item.quantity}
                      onChange={(e) => updateQuantity(item.cart_id, parseInt(e.target.value) || 1)}
                    />
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeFromCart(item.cart_id)}>🗑️</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="card-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '20px', backgroundColor: 'var(--bg-panel)' }}>
            {!isCliente && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Subtotal USD:</span>
                <span style={{ fontWeight: 'bold' }}>{formatUSD(totalUSD)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
              <span style={{ fontSize: '18px', fontWeight: 600 }}>Total Final:</span>
              <span style={{ fontSize: '20px', fontWeight: 800, color: 'var(--accent-success)' }}>{formatBs(totalBs)}</span>
            </div>
            <div className="flex gap-12">
              <button className="btn btn-ghost" style={{ flex: 1 }} onClick={clearCart}>Vaciar</button>
              <button className="btn btn-primary" style={{ flex: 2, height: '48px' }} onClick={handleGoToCheckout} disabled={cart.length === 0}>
                Continuar al Pago
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botón Flotante disparador (FAB) */}
      {!isOpen && totalItems > 0 && (
        <button 
          onClick={() => setIsOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '16px 24px',
            backgroundColor: 'var(--accent-primary)',
            color: '#000',
            borderRadius: '100px',
            border: 'none',
            outline: 'none',
            cursor: 'pointer',
            boxShadow: '0 12px 32px rgba(0, 210, 255, 0.4)',
            fontWeight: 'bold',
            fontSize: '16px',
            transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            animation: 'bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.05) translateY(-4px)';
            e.currentTarget.style.boxShadow = '0 16px 40px rgba(0, 210, 255, 0.6)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1) translateY(0)';
            e.currentTarget.style.boxShadow = '0 12px 32px rgba(0, 210, 255, 0.4)';
          }}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', fontSize: '22px' }}>
            🛒
            <span style={{ 
              position: 'absolute', top: '-12px', right: '-12px', 
              backgroundColor: '#ff3b30', color: '#fff', fontSize: '11px', 
              width: '22px', height: '22px', borderRadius: '50%', 
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid #000', fontWeight: '900',
              animation: 'pulse 2s infinite'
            }}>
              {totalItems}
            </span>
          </div>
          <span style={{ fontSize: '15px' }}>Carrito</span>
        </button>
      )}
    </div>
  )
}
