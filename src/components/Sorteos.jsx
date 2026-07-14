import React, { useState, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { formatUSD, formatBs } from '../utils/helpers'

// ── SVG Wheel helpers ──────────────────────────────────────────
const polar = (cx, cy, r, deg) => {
  const rad = ((deg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}
const arc = (cx, cy, r, a1, a2) => {
  const s = polar(cx, cy, r, a1)
  const e = polar(cx, cy, r, a2)
  const lg = a2 - a1 > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${lg} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)} Z`
}

const COLORS = [
  '#FF6B6B','#FF8E53','#FFCA28','#66BB6A',
  '#26C6DA','#5C6BC0','#AB47BC','#EC407A',
  '#FF7043','#26A69A','#FFA726','#8D6E63'
]

export default function Sorteos() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [pedidos, setPedidos] = useState([])
  const [error, setError] = useState(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [debugText, setDebugText] = useState('')
  const [ventasPorCliente, setVentasPorCliente] = useState({})

  // Estados de la Ruleta
  const [spinning, setSpinning] = useState(false)
  const [rotation, setRotation] = useState(0)
  const [animateWheel, setAnimateWheel] = useState(false)
  const [winner, setWinner] = useState(null)
  
  const handleFiltrar = async () => {
    if (!startDate || !endDate) {
      setError('Por favor, selecciona una fecha de inicio y una fecha de fin.')
      return
    }
    
    setLoading(true)
    setError(null)
    setPedidos([])
    setDebugText('Iniciando consulta...')

    try {
      // Ajustar fechas para abarcar todo el día (UTC-4 Venezuela)
      const startIso = new Date(startDate + 'T00:00:00-04:00').toISOString()
      const endIso = new Date(endDate + 'T23:59:59-04:00').toISOString()

      // Consultar pedidos completados en el rango de fechas
      const { data: pedidosData, error: dbError } = await supabase
        .from('pedidos')
        .select(`
          id,
          total_usd,
          total_bs,
          created_at,
          cliente_id
        `)
        .eq('estado', 'completado')
        .gte('created_at', startIso)
        .lte('created_at', endIso)

      if (dbError) throw dbError
      
      setDebugText(`Pedidos crudos encontrados: ${pedidosData?.length || 0}. Fechas ISO: ${startIso} a ${endIso}`)

      let finalPedidos = pedidosData || []
      let mapVentas = {}
      
      if (finalPedidos.length > 0) {
        const clienteIds = [...new Set(finalPedidos.map(p => p.cliente_id).filter(Boolean))]
        if (clienteIds.length > 0) {
          
          // Buscar ventas independientemente para saltar la limitación del pedido_id null
          const { data: ventasData } = await supabase
            .from('ventas')
            .select('cliente_id, ganancia_usd')
            .gte('created_at', startIso)
            .lte('created_at', endIso)
            .in('cliente_id', clienteIds)
            
          if (ventasData) {
            ventasData.forEach(v => {
              if (v.cliente_id) {
                mapVentas[v.cliente_id] = (mapVentas[v.cliente_id] || 0) + Number(v.ganancia_usd || 0)
              }
            })
          }
          setVentasPorCliente(mapVentas)

          const inString = `(${clienteIds.join(',')})`
          const { data: clientesData, error: clientErr } = await supabase
            .from('clientes')
            .select('id, auth_user_id, nombres, apellidos, whatsapp, usuario')
            .or(`id.in.${inString},auth_user_id.in.${inString}`)
          
          if (!clientErr && clientesData) {
            const clientMap = {}
            clientesData.forEach(c => { 
              clientMap[c.id] = c 
              if (c.auth_user_id) clientMap[c.auth_user_id] = c
            })
            finalPedidos = finalPedidos.map(p => ({
              ...p,
              clientes: clientMap[p.cliente_id] || null
            }))
            
            setDebugText(prev => prev + ` | Clientes mapeados: ${finalPedidos.filter(p => p.clientes).length} de ${finalPedidos.length}`)
          } else {
            setDebugText(prev => prev + ` | Error clientes: ${clientErr?.message}`)
          }
        }
      }

      setPedidos(finalPedidos)
      setHasSearched(true)
    } catch (err) {
      console.error('Error al filtrar pedidos:', err)
      setError('Ocurrió un error al consultar la base de datos: ' + (err.message || err.toString()))
    } finally {
      setLoading(false)
    }
  }

  // Agrupar pedidos por usuario
  const usuariosAgrupados = useMemo(() => {
    if (!pedidos || pedidos.length === 0) return []
    
    const mapa = new Map()
    
    pedidos.forEach(pedido => {
      const clienteId = pedido.cliente_id
      const cliente = pedido.clientes
      
      if (!cliente) return // Ignorar si no hay datos del cliente

      if (!mapa.has(clienteId)) {
        let nombreCompleto = cliente.nombres || ''
        if (cliente.apellidos) nombreCompleto += ' ' + cliente.apellidos
        
        mapa.set(clienteId, {
          id: clienteId,
          nombres: nombreCompleto.trim() || cliente.usuario || 'Sin Nombre',
          telefono: cliente.whatsapp || cliente.telefono || 'Sin Teléfono',
          email: cliente.email || cliente.usuario || 'Sin Correo',
          rol: cliente.rol || 'Usuario',
          totalPedidos: 0,
          totalGastadoUSD: 0,
          totalGastadoBs: 0,
          gananciaNetaUSD: 0,
        })
      }
      
      const userStat = mapa.get(clienteId)
      userStat.totalPedidos += 1
      userStat.totalGastadoUSD += Number(pedido.total_usd || 0)
      userStat.totalGastadoBs += Number(pedido.total_bs || 0)
    })
    
    // Aplicar las ganancias obtenidas globalmente desde ventasPorCliente
    mapa.forEach((userStat, key) => {
      userStat.gananciaNetaUSD = ventasPorCliente[key] || 0
    })
    
    return Array.from(mapa.values()).sort((a, b) => b.totalGastadoUSD - a.totalGastadoUSD)
  }, [pedidos, ventasPorCliente])

  // Lógica de la Ruleta
  const segDeg = usuariosAgrupados.length > 0 ? 360 / usuariosAgrupados.length : 0
  const segments = []
  let accA = 0
  usuariosAgrupados.forEach((user, i) => {
    segments.push({ 
      ...user, 
      startAngle: accA, 
      endAngle: accA + segDeg, 
      midAngle: accA + segDeg / 2, 
      colorFallback: COLORS[i % COLORS.length] 
    })
    accA += segDeg
  })

  const handleSpin = () => {
    if (spinning || usuariosAgrupados.length === 0) return
    setSpinning(true)
    setWinner(null)

    const randomIndex = Math.floor(Math.random() * usuariosAgrupados.length)
    const winnerSegment = segments[randomIndex]
    const targetAngle = winnerSegment.midAngle

    // Spin: 6-8 full turns + land on segment
    const extraTurns = 6 + Math.floor(Math.random() * 3)
    const currentModulo = rotation % 360
    const finalModulo = (360 - (targetAngle % 360)) % 360
    const neededDelta = (finalModulo - currentModulo + 360) % 360
    const newRotation = rotation + (extraTurns * 360) + neededDelta

    setAnimateWheel(true)
    setRotation(newRotation)

    setTimeout(() => {
      setAnimateWheel(false)
      setWinner(winnerSegment)
      setSpinning(false)
    }, 6000)
  }

  return (
    <div className="page-content fade-in" style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '16px',
          background: 'linear-gradient(135deg, rgba(236,72,153,0.2) 0%, rgba(219,39,119,0.05) 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid rgba(236,72,153,0.3)',
          boxShadow: '0 0 20px rgba(236,72,153,0.1)'
        }}>
          <span style={{ fontSize: '28px' }}>🎁</span>
        </div>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '900', margin: 0, color: '#fff', letterSpacing: '-0.02em' }}>
            Módulo de Sorteos
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: '4px 0 0 0', fontSize: '14px' }}>
            Filtra a los usuarios que han realizado pedidos exitosos en un periodo de tiempo.
          </p>
        </div>
      </div>

      <div className="card glass-morphism" style={{ 
        marginBottom: '32px', 
        padding: '32px',
        background: 'linear-gradient(145deg, rgba(20,20,30,0.6) 0%, rgba(30,20,40,0.4) 100%)',
        border: '1px solid rgba(236,72,153,0.15)',
        boxShadow: '0 10px 30px -10px rgba(236,72,153,0.1)',
        borderRadius: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ width: '4px', height: '24px', background: '#ec4899', borderRadius: '4px', boxShadow: '0 0 10px #ec4899' }}></div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#fbcfe8', letterSpacing: '0.5px' }}>
            Rango de Búsqueda
          </h2>
        </div>
        
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-end' }}>
          <div style={{ flex: '1', minWidth: '220px', position: 'relative' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold', color: '#fbcfe8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              <span style={{ fontSize: '16px' }}>📅</span> Fecha de Inicio
            </label>
            <input 
              type="date" 
              className="input-field" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)}
              style={{ 
                width: '100%', 
                backgroundColor: 'rgba(0,0,0,0.3)', 
                border: '1px solid rgba(236,72,153,0.2)',
                borderRadius: '14px',
                padding: '14px 16px',
                color: '#fff',
                fontSize: '15px',
                outline: 'none',
                transition: 'all 0.3s ease',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
              }}
              onFocus={e => { e.target.style.borderColor = '#ec4899'; e.target.style.boxShadow = '0 0 0 3px rgba(236,72,153,0.2), inset 0 2px 4px rgba(0,0,0,0.5)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(236,72,153,0.2)'; e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.5)'; }}
            />
          </div>
          
          <div style={{ flex: '1', minWidth: '220px', position: 'relative' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 'bold', color: '#fbcfe8', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>
              <span style={{ fontSize: '16px' }}>🏁</span> Fecha de Fin
            </label>
            <input 
              type="date" 
              className="input-field" 
              value={endDate} 
              onChange={e => setEndDate(e.target.value)}
              style={{ 
                width: '100%', 
                backgroundColor: 'rgba(0,0,0,0.3)', 
                border: '1px solid rgba(236,72,153,0.2)',
                borderRadius: '14px',
                padding: '14px 16px',
                color: '#fff',
                fontSize: '15px',
                outline: 'none',
                transition: 'all 0.3s ease',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.5)'
              }}
              onFocus={e => { e.target.style.borderColor = '#ec4899'; e.target.style.boxShadow = '0 0 0 3px rgba(236,72,153,0.2), inset 0 2px 4px rgba(0,0,0,0.5)'; }}
              onBlur={e => { e.target.style.borderColor = 'rgba(236,72,153,0.2)'; e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.5)'; }}
            />
          </div>
          
          <div>
            <button 
              className="btn"
              onClick={handleFiltrar}
              disabled={loading}
              onMouseEnter={e => { if(!loading) { e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)'; e.currentTarget.style.boxShadow = '0 12px 24px rgba(236,72,153,0.4)'; } }}
              onMouseLeave={e => { if(!loading) { e.currentTarget.style.transform = 'translateY(0) scale(1)'; e.currentTarget.style.boxShadow = '0 8px 16px rgba(236,72,153,0.3)'; } }}
              style={{
                height: '52px', 
                padding: '0 36px',
                background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
                color: 'white', 
                fontWeight: '900', 
                border: 'none', 
                borderRadius: '14px',
                boxShadow: '0 8px 16px rgba(236,72,153,0.3)',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '15px',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}
            >
              {loading ? (
                <>
                  <span style={{ animation: 'spin 1s linear infinite', fontSize: '18px' }}>⏳</span> Consultando...
                </>
              ) : (
                <>
                  <span style={{ fontSize: '18px' }}>🔎</span> Filtrar Usuarios
                </>
              )}
            </button>
          </div>
        </div>
        
        {error && (
          <div style={{ marginTop: '24px', padding: '16px', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', color: '#ef4444', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 'bold' }}>
            <span style={{ fontSize: '20px' }}>⚠️</span> {error}
          </div>
        )}
        
        {debugText && (
          <div style={{ marginTop: '16px', padding: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '8px', color: '#aaa', fontSize: '12px', fontFamily: 'monospace' }}>
            🛠 Debug: {debugText}
          </div>
        )}
      </div>

      {hasSearched && usuariosAgrupados.length === 0 && !error && (
        <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'rgba(255,193,7,0.1)', border: '1px solid rgba(255,193,7,0.3)', borderRadius: '12px', color: '#fbbf24', textAlign: 'center', fontSize: '15px', fontWeight: 'bold' }}>
          No se encontraron pedidos completados en el rango de fechas seleccionado. Intenta con otras fechas.
        </div>
      )}

      {usuariosAgrupados.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.5s ease' }}>
          
          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="card glass-morphism" style={{ padding: '20px', textAlign: 'center', borderTop: '3px solid #3b82f6' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Usuarios Participantes</div>
              <div style={{ fontSize: '32px', fontWeight: '900', color: '#fff', marginTop: '8px' }}>{usuariosAgrupados.length}</div>
            </div>
            <div className="card glass-morphism" style={{ padding: '20px', textAlign: 'center', borderTop: '3px solid #10b981' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Pedidos</div>
              <div style={{ fontSize: '32px', fontWeight: '900', color: '#fff', marginTop: '8px' }}>{pedidos.length}</div>
            </div>
            <div className="card glass-morphism" style={{ padding: '20px', textAlign: 'center', borderTop: '3px solid #ec4899' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Volumen (USD)</div>
              <div style={{ fontSize: '32px', fontWeight: '900', color: '#fff', marginTop: '8px' }}>
                {formatUSD(usuariosAgrupados.reduce((acc, curr) => acc + curr.totalGastadoUSD, 0))}
              </div>
            </div>
            <div className="card glass-morphism" style={{ padding: '20px', textAlign: 'center', borderTop: '3px solid #f59e0b' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Ganancias Obtenidas</div>
              <div style={{ fontSize: '32px', fontWeight: '900', color: '#f59e0b', marginTop: '8px' }}>
                {formatUSD(usuariosAgrupados.reduce((acc, curr) => acc + curr.gananciaNetaUSD, 0))}
              </div>
            </div>
          </div>

          {/* Ruleta Local */}
          <div className="card glass-morphism" style={{ 
            padding: '40px', textAlign: 'center', 
            background: 'linear-gradient(145deg, rgba(20,20,30,0.6) 0%, rgba(30,20,40,0.4) 100%)',
            border: '1px solid rgba(236,72,153,0.15)', borderRadius: '24px',
            display: 'flex', flexDirection: 'column', alignItems: 'center'
          }}>
            <h2 style={{ fontSize: '24px', fontWeight: '900', color: '#fbcfe8', marginBottom: '8px' }}>Gira y Gana (Sorteo Local)</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '32px' }}>Escoge un ganador al azar de la lista filtrada.</p>
            
            <div className="wheel-container" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ zIndex: 10, marginBottom: -18, position: 'relative' }}>
                <div style={{ width: 0, height: 0, borderLeft: '16px solid transparent', borderRight: '16px solid transparent', borderTop: '34px solid #FF3333', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.5))' }} />
                <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 8, height: 8, borderRadius: '50%', background: '#fff', marginTop: -5 }} />
              </div>
              <div style={{
                transform: `rotate(${rotation}deg)`,
                transition: animateWheel ? 'transform 6s cubic-bezier(0.17,0.67,0.08,1)' : 'none',
                willChange: 'transform',
                borderRadius: '50%',
                boxShadow: '0 0 0 8px #0d1b4b, 0 0 0 14px #1a3a8f, 0 0 0 20px #FFD700, 0 25px 60px rgba(0,0,0,.7)'
              }}>
                <svg viewBox="0 0 300 300" width="380" height="380" style={{ display: 'block' }}>
                  <defs>
                    <radialGradient id="hubG" cx="40%" cy="35%"><stop offset="0%" stopColor="#60a5fa" /><stop offset="100%" stopColor="#1e3a8a" /></radialGradient>
                  </defs>
                  <circle cx={150} cy={150} r={138} fill="#0d1b4b" />
                  <circle cx={150} cy={150} r={134} fill="none" stroke="#FFD700" strokeWidth="2" strokeDasharray="5 3" />
                  
                  {segments.length === 0 ? (
                    <circle cx={150} cy={150} r={128} fill="#1e2a4a" />
                  ) : segments.map((seg, idx) => {
                    const fontSize = segments.length > 50 ? 3 : segments.length > 25 ? 4.5 : segments.length > 12 ? 6.5 : 9
                    // Mostrar solo el nombre y el primer apellido (truncado) para mantener la privacidad y diseño
                    const shortName = seg.nombres.split(' ').slice(0, 2).join(' ')
                    return (
                      <g key={seg.id}>
                        <path d={arc(150, 150, 128, seg.startAngle, seg.endAngle)} fill={seg.colorFallback} stroke="rgba(255,255,255,.2)" strokeWidth="1.5" />
                        <g transform={`rotate(${seg.midAngle - 90}, 150, 150)`}>
                          <text x={192} y={150} textAnchor="start" dominantBaseline="middle"
                            fontSize={fontSize} fontWeight="800" fill="white"
                            style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.8))' }}>
                            {shortName}
                          </text>
                        </g>
                      </g>
                    )
                  })}
                  
                  <circle cx={150} cy={150} r={42} fill="#0d1b4b" />
                  <circle cx={150} cy={150} r={38} fill="url(#hubG)" />
                  <circle cx={150} cy={150} r={32} fill="#1e3a8a" stroke="#FFD700" strokeWidth="2" />
                  <text x={150} y={150} textAnchor="middle" dominantBaseline="middle" fontSize="22">⭐</text>
                </svg>
              </div>

              {/* Decorative base */}
              <div style={{ marginTop: -8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: 44, height: 64, background: 'linear-gradient(180deg,#1a3a8f,#0d1f5c)', borderRadius: '4px 4px 0 0' }} />
                <div style={{ width: 180, height: 28, background: 'linear-gradient(180deg,#1a3a8f,#0d1f5c)', borderRadius: '8px 8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {[...Array(6)].map((_, i) => <div key={i} style={{ width: 12, height: 12, borderRadius: '50%', background: '#FFD700', boxShadow: '0 0 10px #FFD700' }} />)}
                </div>
                <div style={{ width: 220, height: 14, background: '#07123d', borderRadius: '0 0 10px 10px' }} />
              </div>

              <button onClick={handleSpin} disabled={spinning || usuariosAgrupados.length === 0}
                style={{
                  marginTop: 40, padding: '16px 40px', fontSize: 18, fontWeight: 900,
                  borderRadius: 50, border: 'none', cursor: spinning || usuariosAgrupados.length === 0 ? 'not-allowed' : 'pointer',
                  background: spinning || usuariosAgrupados.length === 0 ? 'rgba(255,255,255,.07)' : 'linear-gradient(135deg,#FFD700,#FF8C00)',
                  color: spinning || usuariosAgrupados.length === 0 ? 'var(--text-muted)' : '#1a1a2e',
                  transition: 'all .3s', boxShadow: spinning || usuariosAgrupados.length === 0 ? 'none' : '0 12px 35px rgba(255,215,0,.5)',
                  textTransform: 'uppercase', letterSpacing: 2
                }}>
                {spinning ? 'Girando...' : '🎲 GIRAR RULETA'}
              </button>
            </div>

            {winner && !spinning && (
              <div style={{
                marginTop: '32px', padding: '32px', borderRadius: '24px', width: '100%',
                background: 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(20,83,45,0.2) 100%)',
                border: '1px solid rgba(34,197,94,0.3)',
                animation: 'bounceIn 0.5s'
              }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🏆</div>
                <h2 style={{ fontSize: '14px', color: '#86efac', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 'bold', margin: '0 0 8px 0' }}>
                  ¡Tenemos un Ganador!
                </h2>
                <h1 style={{ fontSize: '32px', color: '#fff', fontWeight: '900', margin: '0 0 16px 0' }}>
                  {winner.nombres}
                </h1>
                <div style={{ display: 'inline-flex', flexWrap: 'wrap', justifyContent: 'center', gap: '24px', backgroundColor: 'rgba(0,0,0,0.3)', padding: '16px 24px', borderRadius: '16px' }}>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>📞 Teléfono</div>
                    <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff' }}>{winner.telefono}</div>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>🛍️ Pedidos</div>
                    <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff' }}>{winner.totalPedidos}</div>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>💰 Inversión</div>
                    <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff' }}>{formatUSD(winner.totalGastadoUSD)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Lista de Usuarios */}
          <div className="card glass-morphism" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff', margin: 0 }}>
                Lista de Participantes ({usuariosAgrupados.length})
              </h2>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: 'rgba(0,0,0,0.2)' }}>
                    <th style={{ padding: '16px 24px', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Usuario</th>
                    <th style={{ padding: '16px 24px', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Contacto</th>
                    <th style={{ padding: '16px 24px', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Rol</th>
                    <th style={{ padding: '16px 24px', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Pedidos</th>
                    <th style={{ padding: '16px 24px', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Gastado (USD)</th>
                    <th style={{ padding: '16px 24px', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Ganancias Obtenidas</th>
                  </tr>
                </thead>
                <tbody>
                  {usuariosAgrupados.map((user, idx) => (
                    <tr key={user.id} style={{ 
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'
                    }}>
                      <td style={{ padding: '16px 24px' }}>
                        <div style={{ fontWeight: 'bold', color: '#fff' }}>{user.nombres}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{user.email}</div>
                      </td>
                      <td style={{ padding: '16px 24px', color: '#cbd5e1' }}>
                        {user.telefono}
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
                          backgroundColor: user.rol === 'revendedor' ? 'rgba(168,85,247,0.1)' : 'rgba(59,130,246,0.1)',
                          color: user.rol === 'revendedor' ? '#d8b4fe' : '#93c5fd', border: `1px solid ${user.rol === 'revendedor' ? 'rgba(168,85,247,0.3)' : 'rgba(59,130,246,0.3)'}`
                        }}>
                          {user.rol}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', fontWeight: 'bold', color: '#fff' }}>
                        {user.totalPedidos}
                      </td>
                      <td style={{ padding: '16px 24px', fontWeight: 'bold', color: '#10b981' }}>
                        {formatUSD(user.totalGastadoUSD)}
                      </td>
                      <td style={{ padding: '16px 24px', fontWeight: 'bold', color: '#f59e0b' }}>
                        {formatUSD(user.gananciaNetaUSD)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
        </div>
      )}
    </div>
  )
}
