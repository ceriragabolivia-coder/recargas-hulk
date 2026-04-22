import React, { useState, useEffect, useRef } from 'react'
import { useAuth } from '../hooks/useData'
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

// ── Main Component ─────────────────────────────────────────────
export default function Ruleta() {
  const { user, perfil } = useAuth()
  const isCliente = perfil?.rol?.toLowerCase() === 'cliente'
  const [premios, setPremios]             = useState([])
  const [config, setConfig]               = useState({ ruleta_activa: 'true', ruleta_titulo: '¡Gira y Gana!', ruleta_descripcion: '' })
  const [girosDisp, setGirosDisp]         = useState(0)
  const [spinning, setSpinning]           = useState(false)
  const [rotation, setRotation]           = useState(0)
  const [animate, setAnimate]             = useState(false)
  const [resultado, setResultado]         = useState(null)
  const [showModal, setShowModal]         = useState(false)
  const [historial, setHistorial]         = useState([])
  const [loading, setLoading]             = useState(true)
  
  const audioSpin = useRef(null)
  const audioWin = useRef(null)
  const audioLose = useRef(null)

  const CX = 150, CY = 150, R = 128, R_INNER = 32

  useEffect(() => {
    audioSpin.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2007/2007-preview.mp3')
    audioSpin.current.loop = true
    audioSpin.current.volume = 0.4
    audioWin.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3')
    audioLose.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2003/2003-preview.mp3')

    return () => {
      if (audioSpin.current) { audioSpin.current.pause(); audioSpin.current = null; }
    }
  }, [])

  useEffect(() => { if (user?.id) fetchAll() }, [user?.id])

  const fetchAll = async () => {
    setLoading(true)
    const [cfgRes, premiosRes, girosRes, histRes] = await Promise.all([
      supabase.from('configuracion').select('ruleta_activa,ruleta_titulo,ruleta_descripcion').single(),
      supabase.from('ruleta_premios').select('id,nombre,descripcion,tipo,valor,color,emoji,activo').eq('activo', true).order('created_at'),
      supabase.from('ruleta_giros_disponibles').select('giros_disponibles').eq('cliente_id', user.id).maybeSingle(),
      supabase.from('ruleta_giros').select('premio_nombre,tipo,valor,created_at').eq('cliente_id', user.id).order('created_at', { ascending: false }).limit(10)
    ])
    if (cfgRes.data) setConfig(prev => ({ ...prev, ...cfgRes.data }))
    setPremios(premiosRes.data || [])
    setGirosDisp(girosRes.data?.giros_disponibles || 0)
    setHistorial(histRes.data || [])
    setLoading(false)
  }

  // Build EQUAL-SIZE segments — probability is internal only (handled server-side by RPC)
  const segDeg = premios.length > 0 ? 360 / premios.length : 0
  const segments = []
  let accA = 0
  premios.forEach((p, i) => {
    segments.push({ ...p, startAngle: accA, endAngle: accA + segDeg, midAngle: accA + segDeg / 2, colorFallback: COLORS[i % COLORS.length] })
    accA += segDeg
  })

  const handleSpin = async () => {
    if (spinning || girosDisp <= 0 || segments.length === 0) return
    setSpinning(true)

    const { data: res, error } = await supabase.rpc('girar_ruleta', { p_cliente_id: user.id })
    if (error || res?.error) {
      setSpinning(false)
      alert(res?.error || error.message)
      return
    }

    // Find winner's center angle
    const winner = segments.find(s => s.id === res.premio_id)
    const targetAngle = winner ? winner.midAngle : 0

    // Spin: 6-8 full turns + land on segment
    const extraTurns = 6 + Math.floor(Math.random() * 3)
    const currentModulo = rotation % 360
    const finalModulo = (360 - (targetAngle % 360)) % 360
    const neededDelta = (finalModulo - currentModulo + 360) % 360
    const newRotation = rotation + (extraTurns * 360) + neededDelta

    setAnimate(true)
    setRotation(newRotation)
    if (audioSpin.current) audioSpin.current.play().catch(() => {})

    setTimeout(() => {
      setAnimate(false)
      if (audioSpin.current) {
        audioSpin.current.pause()
        audioSpin.current.currentTime = 0
      }
      
      if (res.tipo === 'sin_premio') {
        if (audioLose.current) audioLose.current.play().catch(() => {})
      } else {
        if (audioWin.current) audioWin.current.play().catch(() => {})
      }

      setResultado(res)
      setGirosDisp(res.giros_restantes ?? Math.max(0, girosDisp - 1))
      setHistorial(prev => [{ premio_nombre: res.premio_nombre, tipo: res.tipo, valor: res.valor, created_at: new Date().toISOString() }, ...prev].slice(0, 10))
      setSpinning(false)
      setShowModal(true)
    }, 6000)
  }

  const isActive = config.ruleta_activa !== 'false'

  // ── Empty / Inactive states ────────────────────────────────
  if (loading) return <div className="page-content" style={{ textAlign: 'center', padding: 80 }}><div className="spinner" /></div>

  if (!isActive) return (
    <div className="page-content" style={{ maxWidth: 500, margin: '0 auto', textAlign: 'center', padding: '80px 24px' }}>
      <div style={{ fontSize: 72, marginBottom: 16 }}>🎡</div>
      <h2>La ruleta no está disponible ahora</h2>
      <p style={{ color: 'var(--text-muted)' }}>Vuelve pronto para probar tu suerte 🍀</p>
    </div>
  )

  const wheelSize = Math.min(440, typeof window !== 'undefined' ? window.innerWidth - 64 : 440)

  return (
    <div className="page-content" style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px 40px' }}>
      <style>{`
        @keyframes winPop  { 0%{transform:scale(0.5);opacity:0} 70%{transform:scale(1.08)} 100%{transform:scale(1);opacity:1} }
        @keyframes starSpin{ from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes spinBtn { 0%,100%{box-shadow:0 0 20px rgba(255,215,0,.5)} 50%{box-shadow:0 0 40px rgba(255,215,0,.9)} }
        @keyframes float   { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
        .prize-item:hover { background: rgba(255,215,0,0.08) !important; border-color: rgba(255,215,0,0.3) !important; transform: translateX(5px); }
        .wheel-container { perspective: 1000px; }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 40, paddingTop: 20 }}>
        <h1 style={{ fontSize: 38, fontWeight: 900, margin: '0 0 10px', background: 'linear-gradient(135deg,#FFD700,#FF6B6B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {config.ruleta_titulo}
        </h1>
        {config.ruleta_descripcion && <p style={{ color: 'var(--text-muted)', fontSize: 16, margin: 0 }}>{config.ruleta_descripcion}</p>}
      </div>

      <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
        
        {/* COLUMNA IZQUIERDA: LISTA DE PREMIOS */}
        <div style={{ flex: '1 1 400px', minWidth: 320 }}>
          <div className="card" style={{ padding: '24px', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(255,255,255,0.02)' }}>
            <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 20, display: 'flex', alignItems: 'center', gap: '10px' }}>
              📜 Inventario de Premios
            </h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {premios.map(p => (
                <div 
                  key={p.id}
                  className="prize-item"
                  onClick={() => setResultado(p)}
                  style={{ 
                    padding: '12px 16px', borderRadius: '14px', background: 'rgba(255,255,255,0.03)', 
                    border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer', transition: 'all 0.2s ease',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '24px' }}>{p.emoji || '🎁'}</span>
                    <span style={{ fontWeight: 700, fontSize: '15px' }}>{p.nombre}</span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--accent-primary)', fontWeight: 800 }}>VER INFO</div>
                </div>
              ))}
            </div>

            {/* Panel de Información del Premio Seleccionado */}
            {resultado && !spinning && (
              <div style={{ 
                marginTop: '24px', padding: '20px', borderRadius: '20px', 
                background: 'rgba(255,215,0,0.05)', border: '1px solid rgba(255,215,0,0.2)',
                animation: 'winPop 0.3s ease-out'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '32px' }}>{resultado.emoji || '🎁'}</span>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#FFD700' }}>{resultado.nombre}</h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px' }}>Detalles del Premio</span>
                  </div>
                </div>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: 'var(--text-primary)' }}>
                  {resultado.descripcion || "Este premio se acredita automáticamente al ganar. ¡Prueba tu suerte para obtenerlo!"}
                </p>
                {resultado.valor > 0 && (
                  <div style={{ marginTop: '12px', display: 'flex', gap: '10px' }}>
                    <div style={{ padding: '4px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.1)', fontSize: '12px', fontWeight: 700 }}>
                      Valor: {resultado.tipo === 'saldo_bs' ? formatBs(resultado.valor) : resultado.tipo === 'saldo_usd' ? formatUSD(resultado.valor) : `${resultado.valor}% Desc.`}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Historial rápido */}
          {historial.length > 0 && (
            <div className="card" style={{ marginTop: '20px', padding: '20px', borderRadius: '24px' }}>
              <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 12 }}>🏆 Mis últimos premios</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {historial.map((h, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', borderRadius: 10, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{h.premio_nombre}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>{new Date(h.created_at).toLocaleDateString('es-VE')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: RULETA */}
        <div style={{ flex: '1 1 500px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          
          <div style={{ 
            display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 30, 
            padding: '8px 24px', borderRadius: '50px', background: girosDisp > 0 ? 'rgba(255,215,0,.15)' : 'rgba(255,255,255,.05)', 
            border: `2px solid ${girosDisp > 0 ? '#FFD700' : 'rgba(255,255,255,.1)'}`,
            boxShadow: girosDisp > 0 ? '0 0 20px rgba(255,215,0,0.2)' : 'none'
          }}>
            <span style={{ fontSize: '20px' }}>{girosDisp > 0 ? '🎰' : '⏳'}</span>
            <span style={{ fontWeight: 900, color: girosDisp > 0 ? '#FFD700' : 'var(--text-muted)', fontSize: 16 }}>
              {girosDisp > 0 ? `${girosDisp} GIROS DISPONIBLES` : 'SIN GIROS DISPONIBLES'}
            </span>
          </div>

          <div className="wheel-container" style={{ position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* Pointer arrow */}
            <div style={{ zIndex: 10, marginBottom: -18, position: 'relative' }}>
              <div style={{ width: 0, height: 0, borderLeft: '16px solid transparent', borderRight: '16px solid transparent', borderTop: '34px solid #FF3333', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.5))' }} />
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', width: 8, height: 8, borderRadius: '50%', background: '#fff', marginTop: -5 }} />
            </div>

            {/* Wheel SVG */}
            <div style={{
              transform: `rotate(${rotation}deg)`,
              transition: animate ? 'transform 6s cubic-bezier(0.17,0.67,0.08,1)' : 'none',
              willChange: 'transform',
              borderRadius: '50%',
              boxShadow: '0 0 0 8px #0d1b4b, 0 0 0 14px #1a3a8f, 0 0 0 20px #FFD700, 0 25px 60px rgba(0,0,0,.7)'
            }}>
              <svg viewBox="0 0 300 300" width={wheelSize} height={wheelSize} style={{ display: 'block' }}>
                <defs>
                  <radialGradient id="hubG" cx="40%" cy="35%"><stop offset="0%" stopColor="#60a5fa" /><stop offset="100%" stopColor="#1e3a8a" /></radialGradient>
                </defs>
                <circle cx={CX} cy={CY} r={R + 10} fill="#0d1b4b" />
                <circle cx={CX} cy={CY} r={R + 6}  fill="none" stroke="#FFD700" strokeWidth="2" strokeDasharray="5 3" />

                {segments.length === 0
                  ? <circle cx={CX} cy={CY} r={R} fill="#1e2a4a" />
                  : segments.map((seg, idx) => {
                      const fontSize = segments.length > 12 ? 6.5 : segments.length > 8 ? 7.5 : 9
                      return (
                        <g key={seg.id}>
                          <path d={arc(CX, CY, R, seg.startAngle, seg.endAngle)} fill={seg.color || seg.colorFallback} stroke="rgba(255,255,255,.2)" strokeWidth="1.5" />
                          <g transform={`rotate(${seg.midAngle - 90}, ${CX}, ${CY})`}>
                            <text x={CX + 42} y={CY} textAnchor="start" dominantBaseline="middle"
                              fontSize={fontSize} fontWeight="800" fill="white"
                              style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,.8))' }}>
                              {seg.emoji || '🎁'} {seg.nombre}
                            </text>
                          </g>
                        </g>
                      )
                    })
                }

                <circle cx={CX} cy={CY} r={R_INNER + 10} fill="#0d1b4b" />
                <circle cx={CX} cy={CY} r={R_INNER + 6}  fill="url(#hubG)" />
                <circle cx={CX} cy={CY} r={R_INNER}       fill="#1e3a8a" stroke="#FFD700" strokeWidth="2" />
                <text x={CX} y={CY} textAnchor="middle" dominantBaseline="middle" fontSize="22">⭐</text>
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

            {/* Spin button */}
            <button onClick={handleSpin} disabled={spinning || girosDisp <= 0 || segments.length === 0}
              style={{
                marginTop: 40, padding: '18px 70px', fontSize: 22, fontWeight: 1000,
                borderRadius: 50, border: 'none',
                cursor: spinning || girosDisp <= 0 ? 'not-allowed' : 'pointer',
                background: spinning || girosDisp <= 0 ? 'rgba(255,255,255,.07)' : 'linear-gradient(135deg,#FFD700,#FF8C00)',
                color: spinning || girosDisp <= 0 ? 'var(--text-muted)' : '#1a1a2e',
                transition: 'all .3s',
                boxShadow: spinning || girosDisp <= 0 ? 'none' : '0 12px 35px rgba(255,215,0,.5)',
                letterSpacing: 2,
                animation: girosDisp > 0 && !spinning ? 'spinBtn 2s infinite' : 'none',
                textTransform: 'uppercase'
              }}>
              {spinning ? 'Girando...' : '¡GIRAR AHORA!'}
            </button>
          </div>
        </div>

      </div>

      {/* Result Modal */}
      {showModal && resultado && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50000, background: 'rgba(0,0,0,.88)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowModal(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 28, padding: '40px', maxWidth: 450, width: '100%', textAlign: 'center', border: '2px solid #FFD700', boxShadow: '0 30px 80px rgba(0,0,0,0.9)', animation: 'winPop .6s cubic-bezier(.175,.885,.32,1.275)' }}
            onClick={e => e.stopPropagation()}>

            <div style={{ fontSize: 84, marginBottom: 16 }}>{resultado.tipo === 'sin_premio' ? '😅' : resultado.emoji || '🎁'}</div>

            <h2 style={{
              fontSize: 32, fontWeight: 1000, marginBottom: 12,
              ...(resultado.tipo !== 'sin_premio' ? { background: 'linear-gradient(135deg,#FFD700,#FF8C00)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' } : { color: 'var(--text-muted)' })
            }}>
              {resultado.tipo === 'sin_premio' ? '¡Suerte la próxima!' : '¡HA GANADO UN PREMIO! 🎉'}
            </h2>

            <div style={{ padding: '24px', borderRadius: 20, background: resultado.tipo === 'sin_premio' ? 'rgba(255,255,255,.04)' : 'rgba(255,215,0,.1)', border: `2px solid ${resultado.tipo === 'sin_premio' ? 'rgba(255,255,255,.1)' : '#FFD700'}`, marginBottom: 25 }}>
              <div style={{ fontSize: 24, fontWeight: 900, marginBottom: 6 }}>{resultado.premio_nombre || resultado.nombre}</div>
              {resultado.valor > 0 && (
                <div style={{ fontSize: 38, fontWeight: 1000, color: resultado.tipo === 'saldo_bs' ? '#a855f7' : '#22c55e' }}>
                  +{resultado.tipo === 'saldo_bs' ? formatBs(resultado.valor) : resultado.tipo === 'saldo_usd' ? formatUSD(resultado.valor) : `${resultado.valor}%`}
                </div>
              )}
              {resultado.acreditado && (
                <div style={{ color: '#22c55e', fontSize: 14, marginTop: 10, fontWeight: 700 }}>✅ Acreditado automáticamente</div>
              )}
            </div>

            <button className="btn btn-primary" style={{ width: '100%', height: 60, fontSize: 18, fontWeight: 900, borderRadius: 16 }} onClick={() => setShowModal(false)}>
              ENTENDIDO
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
