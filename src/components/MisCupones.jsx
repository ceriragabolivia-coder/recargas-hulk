import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useData'

export default function MisCupones() {
  const { perfil, user } = useAuth()
  const [cupones, setCupones] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    const fetchCuponesActivos = async () => {
      setLoading(true)
      const userId = perfil?.id || user?.id
      if (!userId) { setLoading(false); return }
      
      // 1. Obtener todos los cupones activos con el conteo global de usos
      const { data: cuponesData, error } = await supabase
        .from('cupones')
        .select(`
          id, codigo, porcentaje, fecha_expiracion, limite_usos, activo,
          limite_usos_por_usuario, frecuencia_uso,
          cupones_usados(count)
        `)
        .eq('activo', true)
        
      if (error) {
        console.error('Error fetching cupones:', error)
        setLoading(false)
        return
      }

      // 2. Obtener usos de este usuario (con fecha del último uso por cupón)
      const { data: misUsos } = await supabase
        .from('cupones_usados')
        .select('cupon_id, created_at')
        .eq('cliente_id', userId)
        .order('created_at', { ascending: false })

      // Agrupar usos por cupón: { cupon_id: { count, lastUsed } }
      const usosPorCupon = {}
      ;(misUsos || []).forEach(u => {
        if (!usosPorCupon[u.cupon_id]) {
          usosPorCupon[u.cupon_id] = { count: 0, lastUsed: null }
        }
        usosPorCupon[u.cupon_id].count++
        if (!usosPorCupon[u.cupon_id].lastUsed || new Date(u.created_at) > new Date(usosPorCupon[u.cupon_id].lastUsed)) {
          usosPorCupon[u.cupon_id].lastUsed = u.created_at
        }
      })

      const ahora = new Date()

      const cuponesDisponibles = cuponesData.filter(cupon => {
        // Expirado globalmente
        if (cupon.fecha_expiracion && new Date(cupon.fecha_expiracion) < ahora) return false
        // Stock global agotado
        const totalUsados = cupon.cupones_usados?.[0]?.count || 0
        if (cupon.limite_usos && totalUsados >= cupon.limite_usos) return false

        const miUso = usosPorCupon[cupon.id]
        if (!miUso) return true // Nunca usado → mostrar

        const { count: misUsos, lastUsed } = miUso
        const frecuencia = cupon.frecuencia_uso || 'unico'
        const limitePersonal = cupon.limite_usos_por_usuario || null

        // ¿Alcancé mi límite personal total?
        if (limitePersonal && misUsos >= limitePersonal) return false

        // Calcular horas desde el último uso
        const diffHoras = lastUsed ? (ahora - new Date(lastUsed)) / (1000 * 60 * 60) : Infinity

        if (frecuencia === 'unico') return false           // Uso único → fuera
        if (frecuencia === '24h' && diffHoras < 24) return false
        if (frecuencia === 'semanal' && diffHoras < 168) return false
        if (frecuencia === 'mensual' && diffHoras < 720) return false

        return true // Frecuencia cumplida → mostrar de nuevo
      })

      setCupones(cuponesDisponibles)
      setLoading(false)
    }

    if (perfil || user) fetchCuponesActivos()
  }, [perfil, user])

  const copyToClipboard = (codigo) => {
    navigator.clipboard.writeText(codigo)
    setCopied(codigo)
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div className="page-content" style={{ maxWidth: '1200px', padding: '0 24px', margin: '0 auto' }}>
      <div className="page-header mb-32" style={{ textAlign: 'center' }}>
        <h1 className="page-title" style={{ fontSize: '32px', marginBottom: '8px' }}>Mis Cupones 🎁</h1>
        <p className="page-subtitle" style={{ fontSize: '16px' }}>Descubre ofertas exclusivas y ahorra en tu próxima recarga</p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          <div className="spinner" style={{ margin: '0 auto 16px' }}></div>
          Buscando las mejores ofertas para ti...
        </div>
      ) : cupones.length === 0 ? (
        <div className="empty-state card" style={{ padding: '80px 40px', textAlign: 'center', borderStyle: 'dashed' }}>
          <div style={{ fontSize: '64px', marginBottom: '24px' }}>🎟️</div>
          <h3 style={{ fontSize: '24px', marginBottom: '12px', fontWeight: 800 }}>No tienes cupones disponibles</h3>
          <p style={{ color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto', lineHeight: '1.6' }}>
            Ya utilizaste todos los cupones disponibles para tu cuenta, o los cupones activos aún están en período de espera.
            Sigue atento a nuestras redes para enterarte de nuevos códigos de descuento.
          </p>
        </div>
      ) : (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 420px), 1fr))', 
          gap: '32px',
          perspective: '1000px'
        }}>
          {cupones.map((cupon, index) => {
            // Paleta de colores vibrantes para elegancia
            const colors = [
              { main: '#6366f1', secondary: '#a855f7', blur: 'rgba(99, 102, 241, 0.3)' }, // Indigo / Purple
              { main: '#00d2ff', secondary: '#3a7bd5', blur: 'rgba(0, 210, 255, 0.3)' }, // Blue / Cyan
              { main: '#f43f5e', secondary: '#fb923c', blur: 'rgba(244, 63, 94, 0.3)' }, // Rose / Orange
              { main: '#10b981', secondary: '#3b82f6', blur: 'rgba(16, 185, 129, 0.3)' }, // Emerald / Blue
              { main: '#eab308', secondary: '#f97316', blur: 'rgba(234, 179, 8, 0.3)' },   // Yellow / Orange
            ]
            const color = colors[index % colors.length]

            return (
              <div 
                key={cupon.id} 
                className="coupon-card-hover"
                style={{ 
                  position: 'relative',
                  height: '240px',
                  borderRadius: '24px',
                  background: `linear-gradient(135deg, ${color.main} 0%, ${color.secondary} 100%)`,
                  display: 'flex',
                  color: '#fff',
                  boxShadow: `0 20px 40px ${color.blur}`,
                  overflow: 'hidden',
                  transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                  cursor: 'default'
                }}
              >
                {/* Decoración Fondo SVG */}
                <div style={{ position: 'absolute', top: '-20px', right: '-20px', fontSize: '120px', opacity: 0.1, pointerEvents: 'none' }}>🏷️</div>
                
                {/* Lado Izquierdo (Descuento) */}
                <div style={{ 
                  flex: '0 0 110px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  justifyContent: 'center', 
                  alignItems: 'center',
                  borderRight: '2px dashed rgba(255,255,255,0.3)',
                  position: 'relative'
                }}>
                  {/* Muescas de ticket (arriba y abajo) */}
                  <div style={{ position: 'absolute', top: '-10px', right: '-12px', width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-default)' }}></div>
                  <div style={{ position: 'absolute', bottom: '-10px', right: '-12px', width: '24px', height: '24px', borderRadius: '50%', background: 'var(--bg-default)' }}></div>
                  
                  <div style={{ fontSize: '38px', fontWeight: '900', lineHeight: '1' }}>{cupon.porcentaje}%</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '1px', marginTop: '4px' }}>OFF</div>
                </div>

                {/* Lado Derecho (Info y Código) */}
                <div style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ 
                      display: 'inline-block',
                      padding: '4px 12px', 
                      borderRadius: '20px', 
                      background: 'rgba(255,255,255,0.15)',
                      fontSize: '11px',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '10px'
                    }}>
                      CUPÓN EXCLUSIVO
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 500, opacity: 0.9, lineHeight: '1.4' }}>
                      {cupon.fecha_expiracion 
                        ? `VENCE EL: ${new Date(cupon.fecha_expiracion).toLocaleDateString('es-VE')}` 
                        : '¡VÁLIDO POR TIEMPO LIMITADO!'}
                    </div>
                  </div>

                  <div style={{ position: 'relative' }}>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', fontWeight: 700, marginBottom: '6px', textTransform: 'uppercase' }}>
                      Código de Descuento:
                    </div>
                    <div style={{ 
                      background: 'rgba(0,0,0,0.2)', 
                      backdropFilter: 'blur(10px)',
                      padding: '12px 16px', 
                      borderRadius: '16px', 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      border: '1px solid rgba(255,255,255,0.1)'
                    }}>
                      <div style={{ fontSize: '20px', fontWeight: '900', letterSpacing: '2px', color: '#fff', textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}>
                        {cupon.codigo}
                      </div>
                      <button 
                        onClick={() => copyToClipboard(cupon.codigo)}
                        className="btn-glass"
                        style={{ 
                          backgroundColor: copied === cupon.codigo ? '#10b981' : 'rgba(255,255,255,0.2)',
                          color: '#fff',
                          border: 'none',
                          padding: '6px 14px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '800',
                          textTransform: 'uppercase',
                          transition: 'all 0.2s',
                          cursor: 'pointer',
                          boxShadow: copied === cupon.codigo ? '0 0 15px rgba(16, 185, 129, 0.4)' : 'none'
                        }}
                      >
                        {copied === cupon.codigo ? '¡LISTO!' : 'COPIAR'}
                      </button>
                    </div>
                    
                    {cupon.limite_usos && (
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', marginTop: '8px', fontWeight: 600 }}>
                         Quedan solo unos pocos usos globales.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Estilos adicionales para efectos premium */}
      <style>{`
        .coupon-card-hover:hover {
          transform: translateY(-10px) rotateX(5deg) rotateY(-5deg);
          box-shadow: 0 40px 60px rgba(0,0,0,0.4) !important;
        }
        .btn-glass:hover {
          background-color: rgba(255,255,255,0.4) !important;
          transform: scale(1.05);
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .coupon-card-hover {
          animation: fadeIn 0.6s ease-out backwards;
        }
      `}</style>
    </div>
  )
}

