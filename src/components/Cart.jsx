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

  if (totalItems === 0 && !isOpen) return null

  return (
    <div style={{ position: 'fixed', bottom: '80px', right: '20px', zIndex: 9990, maxWidth: 'calc(100vw - 32px)' }}>
      {/* Botón Flotante del Carrito - OCULTO EN CHECKOUT */}
      {!isOpen && !isCheckoutPage && (
        <button 
          className="btn btn-primary"
          style={{ 
            height: '34px', borderRadius: '17px', padding: '0 12px',
            boxShadow: '0 4px 16px rgba(0, 210, 255, 0.2)',
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '12px', fontWeight: '800', animation: 'bounceIn 0.5s'
          }}
          onClick={() => setIsOpen(true)}
        >
          <span style={{ fontSize: '14px' }}>🛒</span>
          <span>Ver Pedido</span>
          <span className="badge badge-error" style={{ marginLeft: 2, minWidth: 18, height: 18, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>
            {totalItems}
          </span>
        </button>
      )}

      {/* Ventana del Carrito */}
      {isOpen && (
        <div className="card cart-popup" style={{ 
          width: '400px', maxWidth: 'calc(100vw - 32px)', maxHeight: '80vh', display: 'flex', flexDirection: 'column', 
          boxShadow: '0 12px 64px rgba(0,0,0,0.6)', 
          animation: 'slideUp 0.3s ease-out'
        }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 className="card-title" style={{ margin: 0 }}>🛒 Tu Pedido</h2>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setIsOpen(false)}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                      {item.metodo_recarga === 'cuenta_completa' ? (
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
                      onChange={(e) => updateQuantity(item.cart_id || item.id, parseInt(e.target.value) || 1)}
                    />
                    <button className="btn btn-ghost btn-icon btn-sm" onClick={() => removeFromCart(item.cart_id || item.id)}>🗑️</button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="card-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '20px', backgroundColor: 'var(--bg-panel)' }}>
            {/* Subtotal USD hidden for Cliente role */}
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
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleGoToCheckout} disabled={cart.length === 0}>
                Continuar al Pago
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
